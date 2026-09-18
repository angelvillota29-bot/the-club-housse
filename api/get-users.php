<?php
// Lista de usuarios (usersData) para que el Receptor de Pedidos use el MISMO
// inicio de sesión que el panel del sitio (mismo email+password creados desde
// ahí). Requiere Authorization: Bearer <API Key>, misma llave que get-orders.php.
// No incluye el acceso "supremo" (SUPREME_ADMIN_EMAIL/"1234"): ese es solo un
// respaldo de arranque del sitio, no debe replicarse en otra app.
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

if (!$validKey || $providedKey !== $validKey) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'API Key inválida']);
    exit;
}

echo json_encode(['success' => true, 'users' => $data['usersData'] ?? []]);
