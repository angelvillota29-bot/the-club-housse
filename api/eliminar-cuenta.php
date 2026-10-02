<?php
// Derecho al olvido: cualquier cuenta logueada puede pedir que se elimine.
// No borramos los pedidos históricos en sí (son el registro contable/de
// ventas del negocio) -- se anonimizan: se quita el correo de la cuenta y
// los datos personales del cliente en esas filas. Los pedidos ACTIVOS
// (ordersData, la cola de cocina) no se tocan -- si hay uno en curso, debe
// completarse primero para no perder la dirección/teléfono de una entrega
// ya en camino.
header('Content-Type: application/json');
require_once __DIR__ . '/_auth.php';
// Acción destructiva: solo POST desde nuestra propia página (anti-CSRF).
requirePostSameOrigin(false);

$session = readSession();
if (!$session) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Inicia sesión para eliminar tu cuenta']);
    exit;
}
$email = strtolower($session['email']);

$res = dataMutar(function (&$data) use ($email) {
    $anonimizados = 0;
    if (isset($data['historialPedidos']) && is_array($data['historialPedidos'])) {
        foreach ($data['historialPedidos'] as &$p) {
            if (strtolower($p['accountEmail'] ?? '') === $email) {
                $p['accountEmail'] = null;
                $p['cliente'] = ['nombre' => 'Cuenta eliminada', 'direccion' => '', 'telefono' => '', 'nota' => ''];
                $anonimizados++;
            }
        }
        unset($p);
    }
    // Si esta cuenta también era administrador simple, se le quita el acceso.
    if (isset($data['usersData']) && is_array($data['usersData'])) {
        $data['usersData'] = array_values(array_filter($data['usersData'], fn($u) => strtolower($u['email'] ?? '') !== $email));
    }
    return $anonimizados;
});

if (!$res['ok']) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'No se pudo procesar la solicitud, intenta de nuevo']);
    exit;
}

clearSession();
echo json_encode(['success' => true, 'pedidosAnonimizados' => $res['res']]);
