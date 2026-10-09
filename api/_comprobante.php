<?php
// Comprobantes de pago (captura de pantalla del Nequi/Daviplata).
//
// Se guardan como archivos en data/comprobantes/ (carpeta privada: el servidor
// niega el acceso web directo) y en el pedido solo queda la lista de datos
// ("comprobantes": n, tipo, tamaño, quién y cuándo). Reglas:
//  - El cliente adjunta el primero al hacer el pedido (place-order.php lo exige
//    por Nequi/Daviplata); la caja puede agregar más (subir-comprobante.php).
//  - Un comprobante, una vez guardado, NO se puede borrar ni reemplazar desde
//    ninguna pantalla; si la foto salió mal se agrega otra (máx. 3 por pedido).
//  - Aunque el pedido se elimine del historial (pedido cancelado de hoy/ayer),
//    el archivo se conserva y su referencia queda en "pedidosEliminados".
//  - Solo el reinicio total mueve la carpeta a un respaldo (nunca la borra).

const COMPROBANTE_MAX_BYTES = 3 * 1024 * 1024;
const COMPROBANTE_MAX_POR_PEDIDO = 3;

function comprobanteDir() {
    return dirname(__DIR__) . '/data/comprobantes';
}

// El id del pedido es un número de milisegundos: nada más pasa a un nombre de archivo.
function comprobanteIdValido($id) {
    return (is_int($id) || is_string($id)) && preg_match('/^\d{10,16}$/', (string) $id) === 1;
}

// Extensión segura según el CONTENIDO real del archivo (nunca el nombre que
// manda el navegador). null si no es una imagen permitida.
function comprobanteExtension($rutaTmp) {
    if (!is_file($rutaTmp)) return null;
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = $finfo ? finfo_file($finfo, $rutaTmp) : '';
    if ($finfo) finfo_close($finfo);
    $permitidos = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    if (!isset($permitidos[$mime])) return null;
    if (@getimagesize($rutaTmp) === false) return null;
    return [$permitidos[$mime], $mime];
}

function comprobanteRuta($orderId, $n, $ext) {
    return comprobanteDir() . '/' . $orderId . '-' . (int) $n . '.' . $ext;
}

// Busca el archivo de un comprobante por pedido y número. null si no existe.
function comprobanteBuscar($orderId, $n) {
    if (!comprobanteIdValido($orderId)) return null;
    foreach (['jpg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'] as $ext => $mime) {
        $ruta = comprobanteRuta($orderId, $n, $ext);
        if (is_file($ruta)) return ['ruta' => $ruta, 'mime' => $mime];
    }
    return null;
}
