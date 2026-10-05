<?php
// Reglas del menú compartidas entre place-order.php (pedidos de la página y de
// los bots) y get-menu.php (lo que lee el bot): qué tipo es cada categoría y qué
// salsas hay. Mismas reglas que src/lib/menu.js de la página.

function normalizarNombre($s) {
    $s = function_exists('mb_strtolower') ? mb_strtolower((string) $s, 'UTF-8') : strtolower((string) $s);
    return trim(strtr($s, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n']));
}

// Salsas disponibles (sin costo). Se editan en Administración > Salsas.
function opcionesSalsas($data) {
    $def = ['Rosada', 'De ajo', 'De piña', 'Roja'];
    $cfg = (is_array($data) && isset($data['salsasConfig']['opciones']) && is_array($data['salsasConfig']['opciones'])) ? $data['salsasConfig']['opciones'] : null;
    if ($cfg === null) return $def;
    $out = [];
    foreach ($cfg as $o) {
        if (is_string($o) && trim($o) !== '' && strlen($o) <= 60) $out[] = trim($o);
    }
    return $out;
}

// Tipo de categoría: si la categoría trae la marca explícita manda esa; si no,
// se deduce del nombre.
//   esAdicion      -> son los adicionales (no se piden sueltos)
//   personalizable -> cada producto se puede pedir con adicionales
//   salsas         -> el cliente elige las salsas (sin costo)
//   salsasCasa     -> llevan salsas de la casa (no se elige)
//   esBebida       -> bebidas y gaseosas
function tipoCategoria($cat) {
    $n = normalizarNombre(is_array($cat) ? ($cat['name'] ?? '') : '');
    $familias = ['salchipapas', 'burguer', 'burger', 'hamburguesas', 'perros', 'colitas'];
    $marca = function ($campo, $porDefecto) use ($cat) {
        return (is_array($cat) && array_key_exists($campo, $cat) && $cat[$campo] !== null) ? !empty($cat[$campo]) : $porDefecto;
    };
    return [
        'esAdicion' => $marca('esAdicion', $n === 'adiciones'),
        'personalizable' => $marca('personalizable', in_array($n, $familias, true)),
        'salsas' => $marca('salsas', $n === 'salchipapas'),
        'salsasCasa' => in_array($n, ['burguer', 'burger', 'hamburguesas', 'perros', 'colitas'], true),
        'esBebida' => $marca('esBebida', in_array($n, ['bebidas', 'gaseosas'], true)),
    ];
}
