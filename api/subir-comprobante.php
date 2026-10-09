<?php
// Agrega otro comprobante de pago (foto/captura) a un pedido por Nequi o
// Daviplata. Solo la caja (Receptor, con la API Key de siempre): por ejemplo el
// que el cliente mandó por WhatsApp. El comprobante de los pedidos hechos en la
// página ya llega con el pedido (place-order.php).
// Un comprobante guardado no se puede borrar ni reemplazar: si salió mal se
// agrega otro (hasta 3 por pedido). Ver api/_comprobante.php.
header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
require_once __DIR__ . '/_auth.php';
require_once __DIR__ . '/_data.php';
require_once __DIR__ . '/_comprobante.php';

function comprobanteFallo($codigo, $mensaje) {
    http_response_code($codigo);
    echo json_encode(['success' => false, 'error' => $mensaje]);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    comprobanteFallo(405, 'Método no permitido');
}

$data = dataLeer();
if (!is_array($data) || !$data) comprobanteFallo(404, 'No hay datos');

// ¿Viene de la caja (API Key) o del cliente (firma del pedido)?
$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? (function_exists('apache_request_headers') ? (apache_request_headers()['Authorization'] ?? '') : '');
$providedKey = '';
if (preg_match('/Bearer\s+(.+)/i', $authHeader, $m)) $providedKey = trim($m[1]);
$validKey = getenv('N8N_API_KEY') ?: ($data['n8nConfig']['apiKey'] ?? '');
$desdeCaja = $providedKey !== '' && $validKey && hash_equals($validKey, $providedKey);

$orderId = (string) ($_POST['orderId'] ?? '');
if (!comprobanteIdValido($orderId)) comprobanteFallo(400, 'Falta el pedido al que pertenece el comprobante');

if (!$desdeCaja) comprobanteFallo(401, 'No autorizado');
$por = substr(trim((string) ($_POST['subidoPor'] ?? '')), 0, 120) ?: 'caja';

$f = $_FILES['comprobante'] ?? null;
if (!is_array($f) || ($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    $codigoSubida = is_array($f) ? ($f['error'] ?? 0) : 0;
    if ($codigoSubida === UPLOAD_ERR_INI_SIZE || $codigoSubida === UPLOAD_ERR_FORM_SIZE) comprobanteFallo(413, 'La foto es demasiado pesada. Prueba con una captura de pantalla.');
    comprobanteFallo(400, 'No llegó ninguna foto');
}
if (($f['size'] ?? 0) <= 0 || $f['size'] > COMPROBANTE_MAX_BYTES) comprobanteFallo(413, 'La foto es demasiado pesada (máximo 3 MB)');
$tipo = comprobanteExtension($f['tmp_name']);
if ($tipo === null) comprobanteFallo(400, 'Solo se aceptan fotos JPG, PNG o WebP');
[$ext, $mime] = $tipo;
$tmp = $f['tmp_name'];
$ahora = (int) round(microtime(true) * 1000);
$tamano = (int) $f['size'];

$res = dataMutar(function (&$d) use ($orderId, $por, $ext, $mime, $tmp, $ahora, $tamano) {
    $lista = isset($d['historialPedidos']) && is_array($d['historialPedidos']) ? $d['historialPedidos'] : [];
    $pedido = null;
    foreach ($lista as $h) {
        if ((string) ($h['id'] ?? '') === $orderId) { $pedido = $h; break; }
    }
    if (!$pedido) return ['err' => [404, 'Pedido no encontrado']];
    if (!in_array($pedido['metodoPago'] ?? '', ['nequi', 'daviplata'], true)) {
        return ['err' => [409, 'Este pedido no es por Nequi ni Daviplata']];
    }
    $existentes = isset($pedido['comprobantes']) && is_array($pedido['comprobantes']) ? $pedido['comprobantes'] : [];
    if (count($existentes) >= COMPROBANTE_MAX_POR_PEDIDO) {
        return ['err' => [409, 'Este pedido ya tiene ' . COMPROBANTE_MAX_POR_PEDIDO . ' comprobantes guardados']];
    }
    $n = count($existentes);

    $dir = comprobanteDir();
    if (!is_dir($dir) && !@mkdir($dir, 0775, true)) return ['err' => [500, 'No se pudo preparar la carpeta de comprobantes']];
    $destino = comprobanteRuta($orderId, $n, $ext);
    if (file_exists($destino) || comprobanteBuscar($orderId, $n)) return ['err' => [409, 'Ese comprobante ya existe']];
    if (!@move_uploaded_file($tmp, $destino)) return ['err' => [500, 'No se pudo guardar la foto']];
    @chmod($destino, 0664);

    $meta = ['n' => $n, 'mime' => $mime, 'bytes' => $tamano, 'at' => $ahora, 'por' => $por];
    // El mismo pedido vive en la cola de cocina y en el historial permanente.
    foreach (['ordersData', 'historialPedidos'] as $k) {
        if (!isset($d[$k]) || !is_array($d[$k])) continue;
        foreach ($d[$k] as &$o) {
            if ((string) ($o['id'] ?? '') === $orderId) {
                if (!isset($o['comprobantes']) || !is_array($o['comprobantes'])) $o['comprobantes'] = [];
                $o['comprobantes'][] = $meta;
            }
        }
        unset($o);
    }
    return ['comprobante' => $meta];
});

if (!$res['ok']) comprobanteFallo(500, 'No se pudo guardar el comprobante, intenta de nuevo');
if (isset($res['res']['err'])) comprobanteFallo($res['res']['err'][0], $res['res']['err'][1]);

echo json_encode(['success' => true, 'comprobante' => $res['res']['comprobante']]);
