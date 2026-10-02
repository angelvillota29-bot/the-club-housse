<?php
// Acceso seguro a data/data.json (almacén de datos del sitio, un solo archivo).
//
// Antes cada endpoint leía el archivo, lo modificaba en memoria y lo volvía a
// escribir sin ningún candado: dos peticiones casi simultáneas (un pedido nuevo
// + el Receptor despachando otro, por ejemplo) se pisaban y una de las dos
// cambios se perdía; y si el archivo estaba momentáneamente ilegible se tomaba
// como "vacío" y se sobrescribía todo. Aquí:
//   - dataMutar() toma un candado exclusivo, lee, aplica el cambio y escribe de
//     forma ATÓMICA (archivo temporal + rename), así nadie lee nunca a medias.
//   - Si data.json existe pero no se puede interpretar, NO se sobrescribe: se
//     devuelve error y los datos reales quedan intactos.
//   - dataLeer() es para lecturas simples (sin candado: el rename atómico
//     garantiza que siempre ve una versión completa).

function dataPath() {
    return dirname(__DIR__) . '/data/data.json';
}

// [] si el archivo no existe todavía; null si existe pero no se puede leer
// como JSON (no hay que tratarlo como vacío).
function dataLeer() {
    $file = dataPath();
    if (!is_file($file)) return [];
    $raw = @file_get_contents($file);
    if ($raw === false) return null;
    if (trim($raw) === '') return [];
    $d = json_decode($raw, true);
    return is_array($d) ? $d : null;
}

// Ejecuta $fn(array &$data) con el candado tomado. Si $fn devuelve false, o un
// arreglo con la llave 'err', no se escribe nada. Devuelve
// ['ok' => bool, 'res' => lo que devolvió $fn, 'error' => texto si ok=false].
function dataMutar(callable $fn) {
    $dir = dirname(__DIR__) . '/data';
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    $lock = @fopen($dir . '/data.lock', 'c');
    if (!$lock) return ['ok' => false, 'error' => 'No se pudo abrir el candado de datos'];

    $got = false;
    for ($i = 0; $i < 100; $i++) { // hasta ~5 s
        if (flock($lock, LOCK_EX | LOCK_NB)) { $got = true; break; }
        usleep(50000);
    }
    if (!$got) {
        fclose($lock);
        return ['ok' => false, 'error' => 'El sistema está ocupado, intenta de nuevo'];
    }

    try {
        $file = dataPath();
        $data = dataLeer();
        if ($data === null) {
            return ['ok' => false, 'error' => 'El archivo de datos no se pudo leer; no se modificó nada'];
        }
        $res = $fn($data);
        if ($res === false || (is_array($res) && isset($res['err']))) {
            return ['ok' => true, 'res' => $res];
        }
        $json = json_encode($data);
        if ($json === false) return ['ok' => false, 'error' => 'No se pudo codificar los datos'];
        $tmp = $file . '.tmp' . getmypid();
        if (file_put_contents($tmp, $json) === false) {
            @unlink($tmp);
            $err = error_get_last();
            return ['ok' => false, 'error' => 'No se pudo escribir el archivo: ' . ($err['message'] ?? 'error desconocido')];
        }
        if (!rename($tmp, $file)) {
            @unlink($tmp);
            return ['ok' => false, 'error' => 'No se pudo reemplazar el archivo de datos'];
        }
        return ['ok' => true, 'res' => $res];
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}
