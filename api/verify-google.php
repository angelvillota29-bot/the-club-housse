<?php
header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
require_once __DIR__ . '/_auth.php';

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$idToken = $input['idToken'] ?? '';
if (!$idToken) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Falta el token de Google']);
    exit;
}

$info = verifyGoogleIdToken($idToken);
if (!$info) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'No se pudo verificar tu cuenta de Google. Si el sitio no tiene configurado GOOGLE_CLIENT_ID todavía, avísale al administrador.']);
    exit;
}

$dataFile = dirname(__DIR__) . '/data/data.json';
$data = file_exists($dataFile) ? (json_decode(file_get_contents($dataFile), true) ?: []) : [];
$usersData = $data['usersData'] ?? [];

$email = strtolower($info['email']);
$role = resolveRole($email, $usersData);
issueSession($email, $role);

echo json_encode(['success' => true, 'email' => $email, 'role' => $role, 'name' => $info['name'] ?? '']);
