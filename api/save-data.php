<?php
header('Content-Type: application/json');
require_once __DIR__ . '/_auth.php';
$session = requireRole('admin');

$input = json_decode(file_get_contents('php://input'), true);
$dataDir = dirname(__DIR__) . '/data';
$file = $dataDir . '/data.json';

// load-data.php solo envía n8nConfig/notifyConfig (credenciales reales de
// n8n/Resend) a sesiones superadmin; un admin normal recibe esos dos campos
// con valores vacíos por defecto (ver normalize() en DataContext.jsx). Como
// este endpoint sobrescribe data.json completo con lo que llega aquí, si no
// hiciéramos nada un guardado de admin normal (p.ej. editar categorías o
// personalizar la marca) borraría las credenciales reales guardadas en
// disco. Para quien no es superadmin, conservamos el n8nConfig/notifyConfig
// que ya existía en el archivo en vez de lo que mandó el navegador.
if ((ROLE_LEVEL[$session['role']] ?? 0) < ROLE_LEVEL['superadmin'] && is_file($file)) {
    $current = json_decode(file_get_contents($file), true);
    if (is_array($current)) {
        if (array_key_exists('n8nConfig', $current)) {
            $input['n8nConfig'] = $current['n8nConfig'];
        } else {
            unset($input['n8nConfig']);
        }
        if (array_key_exists('notifyConfig', $current)) {
            $input['notifyConfig'] = $current['notifyConfig'];
        } else {
            unset($input['notifyConfig']);
        }
        // Mismo trato para las credenciales de meseros (usuario/hash de
        // clave): un admin normal nunca las recibe de load-data.php, así que
        // esto es solo un cinturón extra para que su guardado jamás las borre.
        if (array_key_exists('meseroAuth', $current)) {
            $input['meseroAuth'] = $current['meseroAuth'];
        } else {
            unset($input['meseroAuth']);
        }
    }
}

// Si la carpeta de datos no existe (primer arranque), la creamos
if (!is_dir($dataDir)) {
    @mkdir($dataDir, 0775, true);
}

if (!is_dir($dataDir)) {
    echo json_encode(['success' => false, 'error' => "No existe ni se pudo crear la carpeta $dataDir"]);
    exit;
}
if (!is_writable($dataDir)) {
    echo json_encode(['success' => false, 'error' => "Sin permiso de escritura en $dataDir (dueño actual: " . (function_exists('posix_getpwuid') ? posix_getpwuid(fileowner($dataDir))['name'] : fileowner($dataDir)) . ", proceso PHP corre como: " . (function_exists('posix_getpwuid') ? posix_getpwuid(posix_geteuid())['name'] : posix_geteuid()) . ")"]);
    exit;
}

// Forzamos a que las configuraciones (aunque estén vacías) se guarden
// como objeto JSON {} y no como arreglo [], para que nunca se repita
// el problema de "brandingConfig se convierte en un arreglo vacío".
if (isset($input['brandingConfig'])) $input['brandingConfig'] = (object) $input['brandingConfig'];
if (isset($input['takeoutConfig'])) $input['takeoutConfig'] = (object) $input['takeoutConfig'];
if (isset($input['n8nConfig'])) $input['n8nConfig'] = (object) $input['n8nConfig'];

if (file_put_contents($file, json_encode($input)) !== false) {
    echo json_encode(['success' => true]);
} else {
    $err = error_get_last();
    echo json_encode(['success' => false, 'error' => 'No se pudo escribir el archivo: ' . ($err['message'] ?? 'error desconocido')]);
}
?>