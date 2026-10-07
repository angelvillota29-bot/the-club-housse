<?php
// Elimina un pedido del historial (y de la cola, si aún estaba ahí) cuando se
// confirmó pero después se canceló o hubo un error. Solo se permite para
// pedidos de HOY y de AYER (hora de Bogotá): pasado ese plazo el pedido queda
// fijo porque alimenta las ventas y la futura facturación. El servidor lo
// exige; no depende de que el botón desaparezca en pantalla.
// Cada eliminación deja un registro en data.json > pedidosEliminados (quién,
// cuándo y qué pedido era) para tener rastro. Misma API Key que delete-order.php.
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
$id = is_array($input) ? ($input['id'] ?? null) : null;
if ($id === null || !(is_int($id) || is_string($id))) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Falta el id del pedido']);
    exit;
}
$por = substr(trim((string) ($input['eliminadoPor'] ?? '')), 0, 120);
$ahora = (int) round(microtime(true) * 1000);
$hoy = date('Y-m-d');
$ayer = date('Y-m-d', strtotime('-1 day'));

$res = dataMutar(function (&$d) use ($id, $por, $ahora, $hoy, $ayer) {
    $hist = isset($d['historialPedidos']) && is_array($d['historialPedidos']) ? $d['historialPedidos'] : [];
    $pedido = null;
    foreach ($hist as $h) {
        if (($h['id'] ?? null) == $id) { $pedido = $h; break; }
    }
    if (!$pedido) return ['err' => [404, 'Pedido no encontrado']];
    $fechaPedido = date('Y-m-d', intdiv((int) ($pedido['createdAt'] ?? 0), 1000));
    if ($fechaPedido !== $hoy && $fechaPedido !== $ayer) {
        return ['err' => [403, 'Solo se pueden eliminar pedidos de hoy y de ayer.']];
    }
    $d['historialPedidos'] = array_values(array_filter($hist, fn($h) => ($h['id'] ?? null) != $id));
    if (isset($d['ordersData']) && is_array($d['ordersData'])) {
        $d['ordersData'] = array_values(array_filter($d['ordersData'], fn($o) => ($o['id'] ?? null) != $id));
    }
    if (!isset($d['pedidosEliminados']) || !is_array($d['pedidosEliminados'])) $d['pedidosEliminados'] = [];
    $d['pedidosEliminados'][] = [
        'id' => $pedido['id'] ?? null,
        'creadoAt' => $pedido['createdAt'] ?? null,
        'total' => $pedido['total'] ?? 0,
        'cliente' => $pedido['cliente']['nombre'] ?? '',
        'metodoPago' => $pedido['metodoPago'] ?? '',
        'pagoConfirmado' => $pedido['pagoConfirmado'] ?? null,
        'consecutivo' => $pedido['consecutivo'] ?? null,
        // Los archivos de los comprobantes NO se borran nunca: aquí queda la referencia.
        'comprobantes' => $pedido['comprobantes'] ?? [],
        'eliminadoAt' => $ahora,
        'eliminadoPor' => $por,
    ];
    if (count($d['pedidosEliminados']) > 1000) $d['pedidosEliminados'] = array_slice($d['pedidosEliminados'], -1000);
    return true;
});

if (!$res['ok']) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'No se pudo guardar']);
    exit;
}
if (is_array($res['res'])) {
    http_response_code($res['res']['err'][0]);
    echo json_encode(['success' => false, 'error' => $res['res']['err'][1]]);
    exit;
}
echo json_encode(['success' => true]);
