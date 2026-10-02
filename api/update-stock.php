<?php
header('Content-Type: application/json');
require_once __DIR__ . '/_data.php';
$headers = getallheaders();
$authHeader = $headers['Authorization'] ?? '';
$apiKey = str_replace('Bearer ', '', $authHeader);

$file = dirname(__DIR__) . '/data/data.json';
if (!file_exists($file)) { echo json_encode(['success' => false, 'error' => 'No hay datos']); exit; }

$data = json_decode(file_get_contents($file), true);
// La API Key vive de preferencia en la variable de entorno N8N_API_KEY; si
// todavía no la configuraste ahí, cae al valor guardado en data.json como
// respaldo (igual que get-menu.php, get-orders.php, etc.).
$validKey = getenv('N8N_API_KEY') ?: ($data['n8nConfig']['apiKey'] ?? '');
if (!$validKey || !hash_equals($validKey, $apiKey)) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'API Key inválida']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
// "id" = el id del horario (schedule), NO el id del platillo. Un mismo platillo
// aparece varios dias con SU PROPIO stock (ver schedule[].id en script.js), asi
// que hay que tocar la fila de schedule, igual que hace el panel (window.updateStock).
$scheduleId = $input['id'] ?? null;
$newStock = $input['stock'] ?? null;

if ($scheduleId === null || $newStock === null) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Faltan datos']);
    exit;
}

$res = dataMutar(function (&$data) use ($scheduleId, $newStock) {
    if (!isset($data['schedule']) || !is_array($data['schedule'])) return ['err' => 'no_encontrado'];
    foreach ($data['schedule'] as &$s) {
        if ($s['id'] == $scheduleId) {
            $s['stock'] = (int)$newStock;
            return true;
        }
    }
    unset($s);
    return ['err' => 'no_encontrado'];
});
if (!$res['ok']) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'No se pudo guardar']);
} elseif (is_array($res['res'])) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Horario no encontrado']);
} else {
    echo json_encode(['success' => true]);
}
