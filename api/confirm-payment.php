<?php
// Marca un pedido como "pago confirmado" (lo llama el Receptor de Pedidos
// cuando el cajero confirma el pago). Solo a partir de ahí el pedido cuenta
// como venta en el Historial y las Analíticas. Mismo patrón y misma API Key
// que delete-order.php/get-historial.php.
header('Content-Type: application/json');
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

$ahora = (int) round(microtime(true) * 1000);
$encontrado = false;
// El mismo pedido vive en la cola de cocina (ordersData, si todavía no se
// despacha) y en el historial permanente: se marca en ambos.
foreach (['ordersData', 'historialPedidos'] as $lista) {
    if (!isset($data[$lista]) || !is_array($data[$lista])) continue;
    foreach ($data[$lista] as &$o) {
        if (($o['id'] ?? null) == $id) {
            $o['pagoConfirmado'] = true;
            $o['pagoConfirmadoAt'] = $ahora;
            $encontrado = true;
        }
    }
    unset($o);
}

if (!$encontrado) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Pedido no encontrado']);
    exit;
}

if (file_put_contents($file, json_encode($data)) === false) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'No se pudo guardar']);
    exit;
}

echo json_encode(['success' => true]);
