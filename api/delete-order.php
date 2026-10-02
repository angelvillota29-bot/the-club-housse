<?php
// Elimina un pedido de ordersData por su id (ej. cuando ya se imprimió el
// ticket en cocina y no hace falta guardarlo más). Requiere la misma API Key
// que get-orders.php.
header('Content-Type: application/json');
require_once __DIR__ . '/_data.php';
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

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
$validKey = getenv('N8N_API_KEY') ?: ($data['n8nConfig']['apiKey'] ?? '');

if (!$validKey || !hash_equals($validKey, $providedKey)) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'API Key inválida']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$id = $input['id'] ?? null;
if ($id === null) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Falta el id del pedido']);
    exit;
}

$res = dataMutar(function (&$data) use ($id) {
    $ordersData = $data['ordersData'] ?? [];
    $antes = count($ordersData);
    $ordersData = array_values(array_filter($ordersData, fn($o) => ($o['id'] ?? null) != $id));
    if (count($ordersData) === $antes) return ['err' => 'no_encontrado'];
    $data['ordersData'] = $ordersData;
    // "Despachar" solo quita el ticket de la cola de cocina; el pedido sigue en
    // el historial permanente. Se deja la hora del despacho en ese registro.
    if (isset($data['historialPedidos']) && is_array($data['historialPedidos'])) {
        $ahora = (int) round(microtime(true) * 1000);
        foreach ($data['historialPedidos'] as &$h) {
            if (($h['id'] ?? null) == $id) $h['despachadoAt'] = $ahora;
        }
        unset($h);
    }
    return true;
});

if (!$res['ok']) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'No se pudo guardar']);
    exit;
}
if (is_array($res['res'])) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Pedido no encontrado']);
    exit;
}

echo json_encode(['success' => true]);
