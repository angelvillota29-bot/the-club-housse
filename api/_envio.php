<?php
// Domicilio por distancia con Google Maps. Está APAGADO por defecto: mientras
// no se active en Administración > Domicilio y no exista la variable de entorno
// GOOGLE_MAPS_API_KEY, todo sigue funcionando con el cargo fijo de siempre.
//
// Cómo funciona:
//   1. Se ubica la dirección que escribió el cliente (Geocoding API).
//   2. Se mide la distancia por calles desde el local (Routes API). Si no hay
//      ruta (otra ciudad, otro país...) se usa la distancia en línea recta.
//   3. Con la tabla de tramos (km -> precio) se obtiene el costo del domicilio.
//   4. Se entrega un "token" firmado con ese costo; place-order.php solo
//      acepta el costo que viene en un token válido (nunca el que diga el
//      navegador).
// La clave de Google vive SOLO en el servidor; nunca viaja al navegador.

require_once __DIR__ . '/_auth.php';

function envioConfigPorDefecto() {
    return [
        'enabled' => false,
        'origen' => ['direccion' => 'Cra 26P10 # 93-60, Marroquín I, Cali', 'lat' => null, 'lng' => null],
        'ciudad' => 'Cali, Valle del Cauca, Colombia',
        'maxKm' => 12,
        'tramos' => [
            ['hastaKm' => 0.5, 'precio' => 2000],
            ['hastaKm' => 1.5, 'precio' => 3000],
            ['hastaKm' => 3, 'precio' => 4000],
            ['hastaKm' => 5, 'precio' => 6000],
            ['hastaKm' => 8, 'precio' => 8000],
            ['hastaKm' => 12, 'precio' => 10000],
        ],
    ];
}

function envioConfig($data) {
    $def = envioConfigPorDefecto();
    $cfg = (is_array($data) && isset($data['deliveryFeeConfig']) && is_array($data['deliveryFeeConfig'])) ? $data['deliveryFeeConfig'] : [];
    $out = array_merge($def, array_intersect_key($cfg, $def));
    $out['origen'] = array_merge($def['origen'], (isset($cfg['origen']) && is_array($cfg['origen'])) ? $cfg['origen'] : []);
    $out['enabled'] = !empty($out['enabled']);
    $out['maxKm'] = (float) $out['maxKm'];
    $tramos = [];
    foreach ((is_array($out['tramos']) ? $out['tramos'] : []) as $t) {
        if (is_array($t) && isset($t['hastaKm'], $t['precio']) && is_numeric($t['hastaKm']) && is_numeric($t['precio'])) {
            $tramos[] = ['hastaKm' => (float) $t['hastaKm'], 'precio' => (int) $t['precio']];
        }
    }
    usort($tramos, fn($a, $b) => $a['hastaKm'] <=> $b['hastaKm']);
    $out['tramos'] = $tramos ?: $def['tramos'];
    return $out;
}

function envioClave() {
    $k = getenv('GOOGLE_MAPS_API_KEY');
    return $k ? $k : '';
}

// ── Acceso a Google (con un gancho para pruebas locales) ─────────────────────
function mapsFetch($method, $url, array $headers = [], $body = null) {
    if (isset($GLOBALS['__maps_fetch']) && is_callable($GLOBALS['__maps_fetch'])) {
        return $GLOBALS['__maps_fetch']($method, $url, $headers, $body);
    }
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 8);
    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    }
    if ($headers) curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    $resp = curl_exec($ch);
    curl_close($ch);
    if ($resp === false) return null;
    $j = json_decode($resp, true);
    return is_array($j) ? $j : null;
}

function normalizarDireccion($d) {
    $d = trim(preg_replace('/\s+/u', ' ', (string) $d));
    return function_exists('mb_strtolower') ? mb_strtolower($d, 'UTF-8') : strtolower($d);
}

function haversineKm($lat1, $lng1, $lat2, $lng2) {
    $r = 6371.0088;
    $dLat = deg2rad($lat2 - $lat1);
    $dLng = deg2rad($lng2 - $lng1);
    $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
    return 2 * $r * asin(min(1, sqrt($a)));
}

// ── Caché de direcciones ya ubicadas (ahorra llamadas que se pagan) ──────────
function envioCacheLeer($clave) {
    $f = dirname(__DIR__) . '/data/envio-cache.json';
    if (!is_file($f)) return null;
    $c = json_decode((string) @file_get_contents($f), true);
    $e = is_array($c) ? ($c[$clave] ?? null) : null;
    return ($e && ($e['exp'] ?? 0) > time()) ? $e['v'] : null;
}
function envioCacheGuardar($clave, $valor) {
    $f = dirname(__DIR__) . '/data/envio-cache.json';
    $c = is_file($f) ? json_decode((string) @file_get_contents($f), true) : [];
    if (!is_array($c)) $c = [];
    $c[$clave] = ['exp' => time() + 60 * 60 * 24 * 30, 'v' => $valor];
    if (count($c) > 2000) { // poda: se queda con las más recientes
        uasort($c, fn($a, $b) => ($b['exp'] ?? 0) <=> ($a['exp'] ?? 0));
        $c = array_slice($c, 0, 1500, true);
    }
    $tmp = $f . '.tmp' . getmypid();
    if (@file_put_contents($tmp, json_encode($c)) !== false) @rename($tmp, $f);
}

// Ubica una dirección. Devuelve ['lat','lng','formatted','barrio','aproximada']
// o ['error' => 'no_encontrada'|'servicio'].
function geocodificar($direccion, $cfg) {
    $dir = trim($direccion);
    $consulta = $dir;
    // Una dirección con números ("Cra 26 # 10-20") es de la ciudad del local: se
    // le agrega la ciudad. Un nombre sin números ("Pekín", "Barrio El Peñón") se
    // busca tal cual, solo sesgado hacia Cali, para poder medir hasta cualquier lugar.
    if (preg_match('/\d/', $dir) && !preg_match('/\bcali\b/i', $dir)) $consulta = $dir . ', ' . $cfg['ciudad'];
    $clave = 'geo:' . sha1(normalizarDireccion($consulta));
    if (($c = envioCacheLeer($clave)) !== null) return $c;

    $url = 'https://maps.googleapis.com/maps/api/geocode/json?' . http_build_query([
        'address' => $consulta,
        'language' => 'es',
        'region' => 'co',
        'bounds' => '3.30,-76.65|3.55,-76.42', // sesgo (no restricción) hacia Cali
        'key' => envioClave(),
    ]);
    $r = mapsFetch('GET', $url);
    if (!is_array($r)) return ['error' => 'servicio'];
    $estado = $r['status'] ?? '';
    if ($estado === 'ZERO_RESULTS') return ['error' => 'no_encontrada'];
    if ($estado !== 'OK' || empty($r['results'][0])) return ['error' => 'servicio'];
    $res = $r['results'][0];
    $barrio = '';
    foreach (($res['address_components'] ?? []) as $comp) {
        $tipos = $comp['types'] ?? [];
        if (in_array('neighborhood', $tipos, true) || in_array('sublocality_level_1', $tipos, true) || in_array('sublocality', $tipos, true)) {
            $barrio = $comp['long_name'] ?? '';
            break;
        }
    }
    $tipoUbic = $res['geometry']['location_type'] ?? '';
    $out = [
        'lat' => (float) ($res['geometry']['location']['lat'] ?? 0),
        'lng' => (float) ($res['geometry']['location']['lng'] ?? 0),
        'formatted' => (string) ($res['formatted_address'] ?? $dir),
        'barrio' => (string) $barrio,
        'aproximada' => !empty($res['partial_match']) || $tipoUbic === 'APPROXIMATE',
    ];
    envioCacheGuardar($clave, $out);
    return $out;
}

// Distancia en km desde el local. Por calles si hay ruta; si no, en línea recta.
function distanciaDesdeLocal($o, $d) {
    $recta = haversineKm($o['lat'], $o['lng'], $d['lat'], $d['lng']);
    // Más allá de ~300 km en línea recta no hay entrega posible: no se gasta una
    // consulta de rutas (y a otro país ni existe ruta por tierra).
    if ($recta > 300) return ['km' => $recta, 'metodo' => 'linea_recta', 'minutos' => null];
    $body = json_encode([
        'origin' => ['location' => ['latLng' => ['latitude' => $o['lat'], 'longitude' => $o['lng']]]],
        'destination' => ['location' => ['latLng' => ['latitude' => $d['lat'], 'longitude' => $d['lng']]]],
        'travelMode' => 'DRIVE',
        'languageCode' => 'es-CO',
        'units' => 'METRIC',
    ]);
    $r = mapsFetch('POST', 'https://routes.googleapis.com/directions/v2:computeRoutes', [
        'Content-Type: application/json',
        'X-Goog-Api-Key: ' . envioClave(),
        'X-Goog-FieldMask: routes.distanceMeters,routes.duration',
    ], $body);
    if (is_array($r) && !empty($r['routes'][0]['distanceMeters'])) {
        $seg = isset($r['routes'][0]['duration']) ? (int) rtrim((string) $r['routes'][0]['duration'], 's') : null;
        return ['km' => $r['routes'][0]['distanceMeters'] / 1000, 'metodo' => 'ruta', 'minutos' => $seg !== null ? (int) round($seg / 60) : null];
    }
    return ['km' => $recta, 'metodo' => 'linea_recta', 'minutos' => null];
}

// Precio según los tramos. null = fuera de la zona de reparto.
function tarifaPorDistancia($km, $cfg) {
    if ($km > $cfg['maxKm']) return null;
    foreach ($cfg['tramos'] as $t) {
        if ($km <= $t['hastaKm']) return $t['precio'];
    }
    return null;
}

// Cotiza el domicilio de una dirección. Siempre devuelve un arreglo con 'ok'.
function cotizarEnvio($direccion, $data) {
    $cfg = envioConfig($data);
    if (envioClave() === '') return ['ok' => false, 'codigo' => 'no_configurado', 'error' => 'El cálculo de domicilio todavía no está conectado con Google.'];

    // Punto de partida: coordenadas guardadas o, si faltan, se ubica la dirección del local.
    $o = $cfg['origen'];
    if (!is_numeric($o['lat']) || !is_numeric($o['lng'])) {
        $g = geocodificar($o['direccion'], $cfg);
        if (isset($g['error'])) return ['ok' => false, 'codigo' => 'origen', 'error' => 'No se pudo ubicar la dirección del local en el mapa.'];
        $o = ['lat' => $g['lat'], 'lng' => $g['lng']];
    }

    $d = geocodificar($direccion, $cfg);
    if (isset($d['error'])) {
        return $d['error'] === 'no_encontrada'
            ? ['ok' => false, 'codigo' => 'no_encontrada', 'error' => 'No encontramos esa dirección. Revisa que tenga el barrio y el número (ej. Cra 26 # 10-20, Marroquín I).']
            : ['ok' => false, 'codigo' => 'servicio', 'error' => 'No pudimos calcular el domicilio en este momento. Intenta de nuevo en un momento.'];
    }
    $dist = distanciaDesdeLocal(['lat' => (float) $o['lat'], 'lng' => (float) $o['lng']], $d);
    $km = round($dist['km'], 1);
    $costo = tarifaPorDistancia($dist['km'], $cfg);
    return [
        'ok' => true,
        'direccion' => $d['formatted'],
        'barrio' => $d['barrio'],
        'aproximada' => $d['aproximada'],
        'distanciaKm' => $km,
        'metodo' => $dist['metodo'],
        'minutos' => $dist['minutos'],
        'costo' => $costo,
        'fueraDeZona' => $costo === null,
    ];
}

// ── Token firmado: ata un costo a la dirección exacta que se cotizó ──────────
function envioTokenCrear($direccion, $q) {
    $payload = json_encode([
        'd' => sha1(normalizarDireccion($direccion)),
        'c' => (int) $q['costo'],
        'k' => $q['distanciaKm'],
        'b' => $q['barrio'],
        'e' => time() + 60 * 30,
    ]);
    $b64 = rtrim(strtr(base64_encode($payload), '+/', '-_'), '=');
    return $b64 . '.' . hash_hmac('sha256', 'envio|' . $b64, sessionSecret());
}

// Devuelve ['costo','distanciaKm','barrio'] si el token es válido, vigente y de
// esta misma dirección; si no, null.
function envioTokenValido($token, $direccion) {
    if (!is_string($token) || strpos($token, '.') === false) return null;
    [$b64, $sig] = explode('.', $token, 2);
    if (!hash_equals(hash_hmac('sha256', 'envio|' . $b64, sessionSecret()), $sig)) return null;
    $p = json_decode(base64_decode(strtr($b64, '-_', '+/')), true);
    if (!is_array($p) || ($p['e'] ?? 0) < time()) return null;
    if (!hash_equals((string) ($p['d'] ?? ''), sha1(normalizarDireccion($direccion)))) return null;
    return ['costo' => (int) $p['c'], 'distanciaKm' => $p['k'] ?? null, 'barrio' => (string) ($p['b'] ?? '')];
}
