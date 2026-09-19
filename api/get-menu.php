<?php
// Menú completo (o filtrado por día) para integraciones externas: el bot de
// IA (Cloudflare Worker, member/tools.local.ts) y N8N. Requiere
// Authorization: Bearer <API Key> que coincida con la API Key configurada
// (variable de entorno N8N_API_KEY, o data.n8nConfig.apiKey como respaldo).
header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
date_default_timezone_set('America/Bogota');

$file = dirname(__DIR__) . '/data/data.json';
if (!file_exists($file)) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'No hay datos']);
    exit;
}

$data = json_decode(file_get_contents($file), true);

$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? (function_exists('apache_request_headers') ? (apache_request_headers()['Authorization'] ?? '') : '');
$providedKey = '';
if (preg_match('/Bearer\s+(.+)/i', $authHeader, $m)) $providedKey = trim($m[1]);
// La API Key vive de preferencia en la variable de entorno N8N_API_KEY (no en
// el archivo de datos, que se sirve tal cual por load-data.php); si todavía
// no la configuraste ahí, cae al valor guardado en data.json como respaldo.
$validKey = getenv('N8N_API_KEY') ?: ($data['n8nConfig']['apiKey'] ?? '');

if (!$validKey || $providedKey !== $validKey) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'API Key inválida']);
    exit;
}

$dishes = $data['dishes'] ?? [];
$categories = $data['categories'] ?? [];
$takeoutConfig = $data['takeoutConfig'] ?? ['enabled' => false, 'fee' => 0, 'domicilioFee' => 0];
$deliveryZoneConfig = $data['deliveryZoneConfig'] ?? ['enabled' => false, 'address' => '', 'carreraFrom' => '', 'carreraTo' => '', 'calleFrom' => '', 'calleTo' => ''];
$businessOpenConfig = $data['businessOpenConfig'] ?? ['mode' => 'manual', 'abiertoManual' => true];
function estaAbiertoAhora(array $cfg): bool {
    if (($cfg['mode'] ?? 'manual') !== 'horario') return ($cfg['abiertoManual'] ?? true) !== false;
    $start = $cfg['horario']['start'] ?? null;
    $end = $cfg['horario']['end'] ?? null;
    if (!$start || !$end) return true;
    $now = date('H:i');
    return $start <= $end ? ($now >= $start && $now < $end) : ($now >= $start || $now < $end);
}
$negocioAbierto = estaAbiertoAhora($businessOpenConfig);
// 'semanal' (horario por día, el de siempre) o 'unico' (mismo menú todos los
// días -- vive en singleMenuSchedule, aparte, sin borrar el horario semanal).
$menuMode = ($data['menuMode'] ?? 'semanal') === 'unico' ? 'unico' : 'semanal';

$dishesById = [];
foreach ($dishes as $d) { $dishesById[$d['id']] = $d; }
$categoriesById = [];
foreach ($categories as $c) { $categoriesById[$c['id']] = $c; }

// ── Reinicio diario de stock: cada fila con "stockDefinido" definido vuelve
// sola a ese número la primera vez que se consulta en un día nuevo. Se
// guarda de una vez en disco para que quede al día para cualquiera que
// consulte después (otro cliente, N8N, un pedido). ──────────────────────
function reiniciarStockDiario(array &$filas, string $hoyFecha): bool {
    $cambio = false;
    foreach ($filas as &$f) {
        if (array_key_exists('stockDefinido', $f) && $f['stockDefinido'] !== null && ($f['stockResetDate'] ?? null) !== $hoyFecha) {
            $f['stock'] = $f['stockDefinido'];
            $f['stockResetDate'] = $hoyFecha;
            $cambio = true;
        }
    }
    unset($f);
    return $cambio;
}
$hoyFecha = date('Y-m-d');
$schedule = $menuMode === 'unico' ? ($data['singleMenuSchedule'] ?? []) : ($data['schedule'] ?? []);
if (reiniciarStockDiario($schedule, $hoyFecha)) {
    if ($menuMode === 'unico') $data['singleMenuSchedule'] = $schedule;
    else $data['schedule'] = $schedule;
    @file_put_contents($file, json_encode($data));
}

// ── Resolver ?day= ("today" = el día de hoy según el reloj del servidor, o
// un nombre de día literal) -- en modo único no aplica, es el mismo menú
// todos los días, pero se sigue devolviendo bajo la llave del día actual
// para que el resto del contrato (menuByDay[dia]) no cambie. ────────────
$diasSemanaPhp = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
$dayParam = $_GET['day'] ?? null;
$resolvedDay = null;
if ($menuMode === 'unico') {
    $resolvedDay = $diasSemanaPhp[(int) date('w')];
} elseif ($dayParam === 'today') {
    $resolvedDay = $diasSemanaPhp[(int) date('w')];
} elseif ($dayParam) {
    $resolvedDay = $dayParam;
}

// ── Días a incluir: solo el resuelto, o los 7 si no se pidió filtro (en
// modo único siempre es solo el día actual, ya resuelto arriba). ────────
$diasAIncluir = $resolvedDay ? [$resolvedDay] : $diasSemanaPhp;

$menuByDay = [];
foreach ($diasAIncluir as $dia) {
    $items = [];
    foreach ($schedule as $s) {
        // Modo único: una sola lista de platillos, sin día -- se repite
        // igual para cualquier día que se pida. Modo semanal: solo la fila
        // de ESE día.
        if ($menuMode === 'semanal' && $s['day'] !== $dia) continue;
        $dish = $dishesById[$s['dishId']] ?? null;
        if (!$dish) continue;
        $cat = $categoriesById[$dish['categoryId']] ?? null;

        $available = $s['available'] ?? true;
        $stock = array_key_exists('stock', $s) ? $s['stock'] : null;
        $items[] = [
            'scheduleId' => $s['id'],
            'dishId' => $dish['id'],
            'name' => $dish['name'],
            'description' => $dish['desc'] ?? '',
            'category' => $cat['name'] ?? '',
            'deliveryEnabled' => $cat['deliveryEnabled'] ?? true,
            'price' => $dish['price'] ?? '$ 0',
            'available' => $available,
            'stock' => $stock,
            'isSoldOut' => ($available === false) || ($stock === 0),
            // Cargo de empaque de ESTE platillo (null si la categoría está
            // exenta o el cobro está apagado) -- el de domicilio es UNA vez
            // por pedido, no por platillo, y viaja aparte en takeoutConfig.
            'empaqueFee' => (empty($takeoutConfig['enabled']) || !empty($cat['exentoEmpaque'])) ? null : (int) ($takeoutConfig['fee'] ?? 0),
        ];
    }
    $menuByDay[$dia] = $items;
}

echo json_encode([
    'success' => true,
    'appliedFilters' => ['day' => $resolvedDay],
    'menuMode' => $menuMode,
    'abierto' => $negocioAbierto,
    'businessOpenConfig' => $businessOpenConfig,
    'takeoutConfig' => $takeoutConfig,
    'deliveryZoneConfig' => $deliveryZoneConfig,
    'menuByDay' => $menuByDay,
]);
