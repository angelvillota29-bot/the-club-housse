<?php
// Entrega la imagen de un comprobante de pago. Solo para la caja (API Key, vía
// el proxy del Receptor) o un administrador con sesión: son datos privados del
// cliente. GET ?id=<pedido>&n=<número del comprobante, desde 0>
require_once __DIR__ . '/_auth.php';
require_once __DIR__ . '/_data.php';
require_once __DIR__ . '/_comprobante.php';

function verFallo($codigo, $mensaje) {
    http_response_code($codigo);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => $mensaje]);
    exit;
}

$data = dataLeer();
if (!is_array($data) || !$data) verFallo(404, 'No hay datos');

$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? (function_exists('apache_request_headers') ? (apache_request_headers()['Authorization'] ?? '') : '');
$providedKey = '';
if (preg_match('/Bearer\s+(.+)/i', $authHeader, $m)) $providedKey = trim($m[1]);
$validKey = getenv('N8N_API_KEY') ?: ($data['n8nConfig']['apiKey'] ?? '');
$autorizado = $providedKey !== '' && $validKey && hash_equals($validKey, $providedKey);
if (!$autorizado) {
    $session = readSession();
    $autorizado = $session && (ROLE_LEVEL[$session['role'] ?? ''] ?? 0) >= ROLE_LEVEL['admin'];
}
if (!$autorizado) verFallo(401, 'No autorizado');

$id = (string) ($_GET['id'] ?? '');
$n = (string) ($_GET['n'] ?? '0');
if (!comprobanteIdValido($id) || !ctype_digit($n) || (int) $n >= COMPROBANTE_MAX_POR_PEDIDO) verFallo(400, 'Comprobante no válido');

$c = comprobanteBuscar($id, (int) $n);
if (!$c) verFallo(404, 'Comprobante no encontrado');

header('Content-Type: ' . $c['mime']);
header('X-Content-Type-Options: nosniff');
header('Cache-Control: private, no-store');
header('Content-Disposition: inline; filename="comprobante-' . $id . '-' . (int) $n . '"');
header('Content-Length: ' . filesize($c['ruta']));
readfile($c['ruta']);
