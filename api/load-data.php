<?php
header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
require_once __DIR__ . '/_auth.php';
// Este endpoint es público (lo llama cualquier visitante para ver el menú),
// así que NO puede exigir sesión -- pero antes devolvía data.json COMPLETO
// a cualquiera, incluyendo usersData, la API key de n8n, el historial de
// pedidos (nombres/direcciones/teléfonos de clientes) y la config de avisos.
// Solo un admin de verdad recibe el objeto completo (lo necesita para que
// save-data.php pueda sobrescribirlo tal cual, sin perder esos campos),
// excepto n8nConfig/notifyConfig (credenciales reales) que solo van a
// superadmin -- save-data.php conserva esos dos campos tal cual estén en
// disco cuando quien guarda es un admin no-superadmin.
$session = readSession();
$isAdmin = $session && (ROLE_LEVEL[$session['role']] ?? 0) >= ROLE_LEVEL['admin'];
// n8nConfig/notifyConfig cargan credenciales reales (API key de n8n, API key
// de Resend): un admin normal (no superadmin) tiene esas pestañas ocultas en
// el panel, pero sin este chequeo igual las recibía en el payload y podía
// leerlas desde DevTools. Solo superadmin debe ver estos dos objetos.
$isSuperAdmin = $session && ($session['role'] ?? '') === 'superadmin';
$file = dirname(__DIR__) . '/data/data.json';
if (!file_exists($file)) {
    echo json_encode(['categories' => [], 'dishes' => [], 'schedule' => [], 'takeoutConfig' => ['enabled' => false, 'fee' => 0], 'brandingConfig' => [], 'usersData' => [], 'n8nConfig' => ['apiKey' => '']]);
    exit;
}

$data = dataLeer();
if (!is_array($data)) {
    // Antes aquí se imprimía el archivo crudo (saltándose el filtrado de
    // datos privados); ahora se responde un error y no se filtra nada.
    http_response_code(503);
    echo json_encode(['success' => false, 'error' => 'Los datos no están disponibles en este momento, intenta de nuevo']);
    exit;
}

// Reinicio diario de stock -- antes lo hacía el navegador de CUALQUIER
// visitante (normalize() en DataContext.jsx) guardando de vuelta vía
// save-data.php; ahora que ese endpoint exige sesión de admin, esta misma
// lógica (igual a la de place-order.php) vive aquí para que el stock se
// corrija solo sin depender de que alguien compre o un admin entre primero.
date_default_timezone_set('America/Bogota');
function reiniciarStockDiarioLD(array &$filas, string $hoyFecha): bool {
    $cambio = false;
    foreach ($filas as &$f) {
        if (!array_key_exists('stockDefinido', $f)) {
            $f['stockDefinido'] = $f['stock'] ?? null;
            $cambio = true;
        }
        if (!array_key_exists('stockResetDate', $f)) {
            $f['stockResetDate'] = $hoyFecha;
            $cambio = true;
        }
        if ($f['stockDefinido'] !== null && $f['stockResetDate'] !== $hoyFecha) {
            $f['stock'] = $f['stockDefinido'];
            $f['stockResetDate'] = $hoyFecha;
            $cambio = true;
        }
    }
    unset($f);
    return $cambio;
}
$hoyFecha = date('Y-m-d');
$cambio = false;
if (isset($data['schedule']) && is_array($data['schedule'])) $cambio = reiniciarStockDiarioLD($data['schedule'], $hoyFecha) || $cambio;
if (isset($data['singleMenuSchedule']) && is_array($data['singleMenuSchedule'])) $cambio = reiniciarStockDiarioLD($data['singleMenuSchedule'], $hoyFecha) || $cambio;

if ($cambio) {
    // Se aplica el reinicio sobre los datos más recientes y con candado, para
    // no pisar un pedido que entró justo en este instante.
    dataMutar(function (&$d) use ($hoyFecha) {
        $c = false;
        if (isset($d['schedule']) && is_array($d['schedule'])) $c = reiniciarStockDiarioLD($d['schedule'], $hoyFecha) || $c;
        if (isset($d['singleMenuSchedule']) && is_array($d['singleMenuSchedule'])) $c = reiniciarStockDiarioLD($d['singleMenuSchedule'], $hoyFecha) || $c;
        return $c;
    });
}

if (!$isAdmin) {
    unset($data['usersData'], $data['n8nConfig'], $data['ordersData'], $data['notifyConfig'], $data['historialPedidos'], $data['meseroAuth']);
} elseif (!$isSuperAdmin) {
    // Un admin normal tampoco necesita la lista de administradores, la cola de
    // pedidos ni el historial (con nombres, direcciones y teléfonos de clientes).
    unset($data['n8nConfig'], $data['notifyConfig'], $data['meseroAuth'], $data['usersData'], $data['ordersData'], $data['historialPedidos']);
}

echo json_encode($data);
?>