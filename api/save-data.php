<?php
header('Content-Type: application/json');
require_once __DIR__ . '/_auth.php';
// Solo POST desde nuestra propia página (anti-CSRF) y solo administradores.
requirePostSameOrigin();
$session = requireRole('admin');
$esSuper = (ROLE_LEVEL[$session['role']] ?? 0) >= ROLE_LEVEL['superadmin'];

$raw = file_get_contents('php://input');
if (strlen($raw) > 8 * 1024 * 1024) {
    http_response_code(413);
    echo json_encode(['success' => false, 'error' => 'Los datos son demasiado grandes']);
    exit;
}
$input = json_decode($raw, true);
// Un guardado legítimo siempre trae el menú completo; un cuerpo vacío o
// incompleto (p.ej. una visita directa a la URL) jamás debe poder vaciar el
// almacén de datos.
if (!is_array($input) || !isset($input['dishes']) || !is_array($input['dishes']) || !isset($input['categories']) || !is_array($input['categories'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Datos inválidos: no se guardó nada']);
    exit;
}

// Este endpoint reemplaza data.json completo con lo que manda el navegador,
// así que hay campos que NUNCA se aceptan del navegador (se conserva lo que ya
// hay en disco):
//  - meseroAuth: solo set-mesero-credentials.php lo cambia (si no, una copia
//    vieja en el navegador restauraría una clave ya cambiada).
//  - historialPedidos: registro permanente de ventas; ninguna pantalla lo edita.
//  - Si quien guarda NO es superadmin: además n8nConfig/notifyConfig
//    (credenciales reales), usersData (quién es administrador) y ordersData
//    (cola de pedidos). Esas pestañas están ocultas para un admin normal, pero
//    antes solo se ocultaban en la pantalla; ahora el servidor también lo exige.
$res = dataMutar(function (&$actual) use ($input, $esSuper) {
    $fijos = ['meseroAuth', 'historialPedidos', 'pedidosEliminados', 'ultimoReinicio'];
    if (!$esSuper) $fijos = array_merge($fijos, ['n8nConfig', 'notifyConfig', 'usersData', 'ordersData']);
    foreach ($fijos as $k) {
        if (array_key_exists($k, $actual)) $input[$k] = $actual[$k];
        else unset($input[$k]);
    }
    // Las configuraciones (aunque estén vacías) se guardan como objeto JSON {}
    // y no como arreglo [] (evita que brandingConfig se vuelva un arreglo vacío).
    foreach (['brandingConfig', 'takeoutConfig', 'n8nConfig'] as $k) {
        if (isset($input[$k]) && is_array($input[$k])) $input[$k] = (object) $input[$k];
    }
    $actual = $input;
    return true;
});

if ($res['ok']) {
    echo json_encode(['success' => true]);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $res['error']]);
}
