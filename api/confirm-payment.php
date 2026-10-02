<?php
// Marca un pedido como "pago confirmado" (lo llama el Receptor de Pedidos
// cuando el cajero confirma el pago). Solo a partir de ahí el pedido cuenta
// como venta en el Historial y las Analíticas. Mismo patrón y misma API Key
// que delete-order.php/get-historial.php.
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

// Quién confirmó (correo del usuario del Receptor), para tener rastro de
// auditoría -- se usará cuando todo esto se conecte con la facturación DIAN.
$confirmadoPor = substr(trim((string) ($input['confirmadoPor'] ?? '')), 0, 120);
$ahora = (int) round(microtime(true) * 1000);

$res = dataMutar(function (&$data) use ($id, $confirmadoPor, $ahora) {
    $encontrado = false;
    // El mismo pedido vive en la cola de cocina (ordersData, si todavía no se
    // despacha) y en el historial permanente: se marca en ambos.
    foreach (['ordersData', 'historialPedidos'] as $lista) {
        if (!isset($data[$lista]) || !is_array($data[$lista])) continue;
        foreach ($data[$lista] as &$o) {
            if (($o['id'] ?? null) == $id) {
                $o['pagoConfirmado'] = true;
                $o['pagoConfirmadoAt'] = $ahora;
                $o['pagoConfirmadoPor'] = $confirmadoPor;
                $encontrado = true;
            }
        }
        unset($o);
    }
    return $encontrado ? true : ['err' => 'no_encontrado'];
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
