<?php
// Lista los pedidos guardados (ordersData) para el "Receptor de pedidos"
// (pantalla de cocina). Requiere Authorization: Bearer <API Key>, misma
// llave que usa el bot (N8N_API_KEY / RESTAURANTE_API_KEY).
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
$validKey = getenv('N8N_API_KEY') ?: ($data['n8nConfig']['apiKey'] ?? '');

if (!$validKey || $providedKey !== $validKey) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'API Key inválida']);
    exit;
}

$ordersData = $data['ordersData'] ?? [];
// Más recientes primero.
usort($ordersData, fn($a, $b) => ($b['createdAt'] ?? 0) <=> ($a['createdAt'] ?? 0));

echo json_encode(['success' => true, 'orders' => $ordersData]);
