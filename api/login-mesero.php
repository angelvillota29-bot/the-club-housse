<?php
// Login alterno para meseros: usuario/clave compartidos (sin Google), un solo
// par de credenciales para todo el personal, configurado por el superadmin
// en el panel (Usuarios -> Acceso de meseros, ver set-mesero-credentials.php).
// El rol 'mesero' no puede entrar al panel de admin ni alterar nada -- solo
// queda exento del límite anti-inundación de pedidos (ver place-order.php).
header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
require_once __DIR__ . '/_auth.php';
require_once __DIR__ . '/_ratelimit.php';

// Para que no sea viable adivinar la clave compartida a punta de intentos.
if (!dentroDelLimite('mesero-login:' . clientIp(), 8, 300)) {
    http_response_code(429);
    echo json_encode(['success' => false, 'error' => 'Demasiados intentos. Espera unos minutos e intenta de nuevo.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$usuario = strtolower(trim($input['usuario'] ?? ''));
$clave = (string) ($input['clave'] ?? '');
if ($usuario === '' || $clave === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Falta usuario o clave']);
    exit;
}

$file = dirname(__DIR__) . '/data/data.json';
$data = file_exists($file) ? (json_decode(file_get_contents($file), true) ?: []) : [];
$meseroAuth = $data['meseroAuth'] ?? null;

if (!$meseroAuth || empty($meseroAuth['usuario']) || empty($meseroAuth['passwordHash'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'El acceso de meseros no está configurado todavía.']);
    exit;
}

// Se evalúan ambas comprobaciones siempre (sin cortocircuito) para no dar
// pistas de tiempo sobre si el usuario era correcto pero la clave no.
$usuarioOk = hash_equals(strtolower($meseroAuth['usuario']), $usuario);
$claveOk = password_verify($clave, $meseroAuth['passwordHash']);
if (!$usuarioOk || !$claveOk) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Usuario o clave incorrectos']);
    exit;
}

// El campo "email" de la sesión guarda el nombre de usuario del mesero, no un
// correo real -- issueSession()/readSession() no le dan ningún tratamiento
// especial, es solo el identificador que se muestra en la barra de arriba.
issueSession($usuario, 'mesero');
echo json_encode(['success' => true, 'email' => $usuario, 'role' => 'mesero']);
