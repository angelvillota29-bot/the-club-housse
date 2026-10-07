<?php
// REINICIO TOTAL de datos de operación, para empezar la producción real "en
// limpio". Solo lo dispara el administrador total desde el Receptor de Pedidos
// (que exige su sesión y que escriba REINICIAR); aquí además se exige la API Key.
//
// Borra: la cola de pedidos, el historial de ventas, el registro de pedidos
// eliminados, los contadores anti-spam, la caché de direcciones y vuelve el
// stock de cada platillo a su valor diario.
// Reinicia el consecutivo de los recibos (vuelve a 1). Los comprobantes de pago
// NO se borran: la carpeta data/comprobantes se mueve a un respaldo.
// NO borra: menú, categorías, horarios, usuarios, mesero, configuraciones,
// credenciales ni la conexión con Google.
// Antes de borrar guarda una copia completa en data/respaldo-reinicio-*.json
// (carpeta privada) por si se reinicia por error; se conservan las últimas 5.
header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
require_once __DIR__ . '/_data.php';
date_default_timezone_set('America/Bogota');

$data = dataLeer();
if (!is_array($data) || !$data) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'No hay datos']);
    exit;
}

$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? (function_exists('apache_request_headers') ? (apache_request_headers()['Authorization'] ?? '') : '');
$providedKey = '';
if (preg_match('/Bearer\s+(.+)/i', $authHeader, $m)) $providedKey = trim($m[1]);
$validKey = getenv('N8N_API_KEY') ?: ($data['n8nConfig']['apiKey'] ?? '');
if (!$validKey || !hash_equals($validKey, $providedKey)) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'API Key inválida']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input) || ($input['confirmacion'] ?? '') !== 'REINICIAR') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Falta la confirmación REINICIAR']);
    exit;
}
$por = substr(trim((string) ($input['reiniciadoPor'] ?? '')), 0, 120);
$dirData = dirname(__DIR__) . '/data';

$res = dataMutar(function (&$d) use ($por, $dirData) {
    // 1) Copia de seguridad completa ANTES de borrar.
    $respaldo = $dirData . '/respaldo-reinicio-' . date('Ymd-His') . '.json';
    if (@file_put_contents($respaldo, json_encode($d)) === false) {
        return ['err' => [500, 'No se pudo crear la copia de seguridad; no se borró nada.']];
    }
    $viejos = glob($dirData . '/respaldo-reinicio-*.json') ?: [];
    sort($viejos);
    foreach (array_slice($viejos, 0, max(0, count($viejos) - 5)) as $f) @unlink($f);

    // 2) Borrar solo datos de operación.
    $resumen = [
        'pedidosEnCola' => is_array($d['ordersData'] ?? null) ? count($d['ordersData']) : 0,
        'pedidosEnHistorial' => is_array($d['historialPedidos'] ?? null) ? count($d['historialPedidos']) : 0,
        'pedidosEliminadosRegistrados' => is_array($d['pedidosEliminados'] ?? null) ? count($d['pedidosEliminados']) : 0,
    ];
    $d['ordersData'] = [];
    $d['historialPedidos'] = [];
    $d['pedidosEliminados'] = [];
    foreach (['schedule', 'singleMenuSchedule'] as $k) {
        if (isset($d[$k]) && is_array($d[$k])) {
            foreach ($d[$k] as &$fila) {
                if (array_key_exists('stockDefinido', $fila) && $fila['stockDefinido'] !== null) $fila['stock'] = $fila['stockDefinido'];
            }
            unset($fila);
        }
    }
    // El consecutivo de los recibos vuelve a empezar en 1.
    $d['contadorPedidos'] = 0;
    // Los comprobantes de pago no se borran: la carpeta se mueve a un respaldo.
    $dirComp = $dirData . '/comprobantes';
    if (is_dir($dirComp)) {
        $resumen['comprobantesGuardados'] = count(glob($dirComp . '/*') ?: []);
        @rename($dirComp, $dirData . '/comprobantes-respaldo-' . date('Ymd-His'));
    }
    $d['ultimoReinicio'] = ['at' => (int) round(microtime(true) * 1000), 'por' => $por];
    return $resumen;
});

if (!$res['ok']) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'No se pudo completar el reinicio']);
    exit;
}
if (isset($res['res']['err'])) {
    http_response_code($res['res']['err'][0]);
    echo json_encode(['success' => false, 'error' => $res['res']['err'][1]]);
    exit;
}

// Contadores anti-spam y caché de direcciones: archivos auxiliares, se vacían.
@unlink($dirData . '/ratelimit.json');
@unlink($dirData . '/envio-cache.json');

echo json_encode(['success' => true, 'borrado' => $res['res']]);
