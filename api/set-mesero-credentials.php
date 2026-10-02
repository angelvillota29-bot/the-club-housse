<?php
// Deja al superadmin fijar/cambiar el usuario y clave compartidos de los
// meseros. Endpoint aparte (no el genérico save-data.php) para que la clave
// se reciba en texto plano UNA sola vez, se convierta aquí mismo a hash
// (password_hash) y nunca se guarde ni se vuelva a mandar en texto plano.
header('Content-Type: application/json');
require_once __DIR__ . '/_auth.php';
requirePostSameOrigin();
requireRole('superadmin');

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$usuario = strtolower(trim($input['usuario'] ?? ''));
$clave = (string) ($input['clave'] ?? '');
if ($usuario === '' || $clave === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Falta usuario o clave']);
    exit;
}
if (strlen($clave) < 6) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'La clave debe tener al menos 6 caracteres']);
    exit;
}

$hash = password_hash($clave, PASSWORD_DEFAULT);
$res = dataMutar(function (&$data) use ($usuario, $hash) {
    $data['meseroAuth'] = ['usuario' => $usuario, 'passwordHash' => $hash];
    return true;
});

if (!$res['ok']) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'No se pudo guardar']);
    exit;
}

echo json_encode(['success' => true, 'usuario' => $usuario]);
