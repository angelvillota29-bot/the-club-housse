<?php
// Cotiza el domicilio de una dirección (distancia desde el local -> costo).
// Lo llama la página al confirmar el pedido y el panel de administración para
// probar. Cuesta dinero cada consulta nueva a Google, por eso: límite por IP,
// tope diario global y caché de direcciones ya ubicadas.
header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
require_once __DIR__ . '/_auth.php';
require_once __DIR__ . '/_ratelimit.php';
require_once __DIR__ . '/_envio.php';

requirePostSameOrigin();

$input = json_decode(file_get_contents('php://input'), true);
$direccion = is_array($input) && is_string($input['direccion'] ?? null) ? trim($input['direccion']) : '';
if ($direccion === '' || (function_exists('mb_strlen') ? mb_strlen($direccion) : strlen($direccion)) > 200) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'codigo' => 'direccion', 'error' => 'Escribe tu dirección (máximo 200 caracteres).']);
    exit;
}

$data = dataLeer();
$data = is_array($data) ? $data : [];
$cfg = envioConfig($data);

// Un administrador puede probar aunque la función esté apagada.
$sesion = readSession();
$esAdmin = $sesion && (ROLE_LEVEL[$sesion['role']] ?? 0) >= ROLE_LEVEL['admin'];
if (!$cfg['enabled'] && !$esAdmin) {
    echo json_encode(['ok' => false, 'codigo' => 'desactivado', 'error' => 'El domicilio por distancia no está activo.']);
    exit;
}

if (!dentroDelLimite('envio:' . clientIp(), 20, 60) || !dentroDelLimite('envio-global', 400, 86400)) {
    http_response_code(429);
    echo json_encode(['ok' => false, 'codigo' => 'limite', 'error' => 'Demasiadas consultas. Espera un momento e intenta de nuevo.']);
    exit;
}

$q = cotizarEnvio($direccion, $data);
if (!empty($q['ok']) && !$q['fueraDeZona']) {
    $q['token'] = envioTokenCrear($direccion, $q);
}
if (!empty($q['ok']) && $q['fueraDeZona']) {
    $q['error'] = 'Esa dirección queda fuera de nuestra zona de reparto (' . $q['distanciaKm'] . ' km). Puedes pedir para recoger en el local o escribirnos por WhatsApp.';
}
echo json_encode($q);
