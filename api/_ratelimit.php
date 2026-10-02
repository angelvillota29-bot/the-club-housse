<?php
// Límite simple de peticiones por IP, en archivo plano (igual de "sin
// infraestructura extra" que el resto del sistema). Pensado para frenar una
// inundación automatizada de pedidos falsos, no como control de concurrencia
// de datos (eso es otro problema, ver data.json). El archivo que usa es
// pequeño y de vida corta (unos minutos de ventana), nunca crece sin límite
// como data.json -- por eso el bloqueo que usa aquí sí es seguro de tener.
//
// Si no se puede tomar el bloqueo rápido, se deja pasar la petición (falla
// "abierto"): es mejor dejar pasar algún pedido de más bajo contención
// extrema que arriesgarse a tumbar el sitio por esto, que es solo una capa
// extra de protección, no el único control.

// IP real del visitante. El sitio corre detrás del proxy de EasyPanel
// (Traefik), que AGREGA la IP real al FINAL de X-Forwarded-For. Lo que viene
// antes lo escribe el propio visitante y se puede falsificar, así que se
// toma la ÚLTIMA entrada válida (nunca la primera: con la primera bastaba
// mandar una cabecera falsa distinta en cada petición para saltarse el
// límite de pedidos y el de intentos de login).
// Si algún día el sitio queda detrás de Cloudflare además de Traefik, la
// última entrada sería la de Cloudflare y habría que ajustar esto.
function clientIp() {
    $fwd = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';
    if ($fwd !== '') {
        $parts = array_reverse(explode(',', $fwd));
        foreach ($parts as $p) {
            $ip = trim($p);
            if ($ip !== '' && filter_var($ip, FILTER_VALIDATE_IP)) return $ip;
        }
    }
    return $_SERVER['REMOTE_ADDR'] ?? 'desconocida';
}

// Devuelve true si la petición se puede procesar, false si se pasó del
// límite. $key identifica qué se está limitando (ej. "order:1.2.3.4" o
// "mesero-login:1.2.3.4"), $limit es el máximo de peticiones permitidas
// dentro de $windowSeconds.
function dentroDelLimite(string $key, int $limit, int $windowSeconds): bool {
    $file = dirname(__DIR__) . '/data/ratelimit.json';
    $fp = @fopen($file, 'c+');
    if (!$fp) return true; // sin archivo no hay cómo limitar -- se deja pasar

    $lockDeadline = microtime(true) + 0.3; // espera corta: esto es defensa extra, no un candado crítico
    $lockAcquired = false;
    do {
        $lockAcquired = flock($fp, LOCK_EX | LOCK_NB);
        if ($lockAcquired) break;
        usleep(10000);
    } while (microtime(true) < $lockDeadline);
    if (!$lockAcquired) {
        fclose($fp);
        return true; // contención: se deja pasar en vez de bloquear al visitante
    }

    $raw = stream_get_contents($fp);
    $store = $raw ? (json_decode($raw, true) ?: []) : [];
    if (!is_array($store)) $store = [];

    $now = microtime(true);

    // Poda general: si hay demasiadas llaves distintas (muchas IPs), se
    // sueltan las que ya no tienen marcas recientes, para que el archivo no
    // crezca sin límite con el tráfico normal del sitio.
    if (count($store) > 500) {
        foreach ($store as $k => $marcas) {
            $marcas = array_values(array_filter((array) $marcas, fn($t) => $t > $now - $windowSeconds));
            if (empty($marcas)) unset($store[$k]);
            else $store[$k] = $marcas;
        }
    }

    $marcas = array_values(array_filter((array) ($store[$key] ?? []), fn($t) => $t > $now - $windowSeconds));

    $permitido = count($marcas) < $limit;
    if ($permitido) {
        $marcas[] = $now;
        $store[$key] = $marcas;
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($store));
        fflush($fp);
    }

    flock($fp, LOCK_UN);
    fclose($fp);
    return $permitido;
}
