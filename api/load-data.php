<?php
header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
$file = dirname(__DIR__) . '/data/data.json';
if (!file_exists($file)) {
    echo json_encode(['categories' => [], 'dishes' => [], 'schedule' => [], 'takeoutConfig' => ['enabled' => false, 'fee' => 0], 'brandingConfig' => [], 'usersData' => [], 'n8nConfig' => ['apiKey' => '']]);
    exit;
}

$data = json_decode(file_get_contents($file), true);
if (!is_array($data)) {
    echo file_get_contents($file);
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
    @file_put_contents($file, json_encode($data));
}

echo json_encode($data);
?>