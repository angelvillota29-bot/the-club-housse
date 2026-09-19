<?php
// Recibe un pedido armado en la propia página (carrito + checkout), valida
// disponibilidad/stock de cada platillo contra el horario (semanal o menú
// único), descuenta el stock, guarda el pedido en ordersData, y si hay
// notifyConfig configurado, avisa al dueño por correo (Resend). No requiere
// API Key: lo llama el navegador del cliente, igual que save-data.php.
header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
date_default_timezone_set('America/Bogota');

$file = dirname(__DIR__) . '/data/data.json';
if (!file_exists($file)) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'No hay datos']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Datos inválidos']);
    exit;
}

$menuMode = ($input['menuMode'] ?? 'semanal') === 'unico' ? 'unico' : 'semanal';
$day = $input['day'] ?? null;
$cliente = $input['cliente'] ?? [];
$items = $input['items'] ?? [];
// 'pagina' = checkout directo del carrito; 'chat_web' = el bot desde el
// widget del propio sitio; 'whatsapp'/'telegram' = el bot por esos canales.
$canal = in_array($input['canal'] ?? '', ['pagina', 'chat_web', 'whatsapp', 'telegram'], true) ? $input['canal'] : 'pagina';
$metodoPago = ($input['metodoPago'] ?? '') === 'nequi' ? 'nequi' : 'efectivo';
// 'domicilio' (empaque + domicilio, pide dirección) · 'recoger' (solo
// empaque, sin dirección) · 'comer_aqui' (sin cargo, sin dirección).
$tipoEntrega = in_array($input['tipoEntrega'] ?? '', ['domicilio', 'recoger', 'comer_aqui'], true) ? $input['tipoEntrega'] : 'domicilio';

$nombre = trim($cliente['nombre'] ?? '');
$direccion = $tipoEntrega === 'domicilio' ? trim($cliente['direccion'] ?? '') : '';
$telefono = trim($cliente['telefono'] ?? '');
$nota = trim($cliente['nota'] ?? '');

if (($menuMode === 'semanal' && !$day) || $nombre === '' || $telefono === '' || empty($items) || ($tipoEntrega === 'domicilio' && $direccion === '')) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Faltan datos del pedido (nombre, dirección, teléfono o platillos)']);
    exit;
}

// Solo se aceptan pedidos del día de HOY (el reloj del servidor manda, no lo
// que mande el navegador) -- evita pedidos "atrasados" de otro día del menú.
// En modo "menú único" no aplica: es el mismo menú todos los días.
$diasSemanaPhp = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
$hoy = $diasSemanaPhp[(int) date('w')];
if ($menuMode === 'semanal' && $day !== $hoy) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => "Solo se pueden hacer pedidos del día de hoy ($hoy). Cambia el día en la página e intenta de nuevo."]);
    exit;
}

$data = json_decode(file_get_contents($file), true);
$dishes = $data['dishes'] ?? [];
$categories = $data['categories'] ?? [];
$takeoutConfig = $data['takeoutConfig'] ?? ['enabled' => false, 'fee' => 0, 'domicilioFee' => 0];

$dishesById = [];
foreach ($dishes as $d) { $dishesById[$d['id']] = $d; }

$categoriesById = [];
foreach ($categories as $c) { $categoriesById[$c['id']] = $c; }

// ── Reinicio diario de stock (igual que en el navegador): cada fila con un
// "stockDefinido" definido vuelve sola a ese número la primera vez que se
// consulta en un día nuevo -- así el dueño no tiene que resetear a mano. ──
function reiniciarStockDiario(array &$filas, string $hoyFecha): bool {
    $cambio = false;
    foreach ($filas as &$f) {
        if (array_key_exists('stockDefinido', $f) && $f['stockDefinido'] !== null && ($f['stockResetDate'] ?? null) !== $hoyFecha) {
            $f['stock'] = $f['stockDefinido'];
            $f['stockResetDate'] = $hoyFecha;
            $cambio = true;
        }
    }
    unset($f);
    return $cambio;
}
$hoyFecha = date('Y-m-d');
$schedule = $menuMode === 'unico' ? ($data['singleMenuSchedule'] ?? []) : ($data['schedule'] ?? []);
reiniciarStockDiario($schedule, $hoyFecha);

// ── Abierto/Cerrado: nunca confiar en lo que mande el navegador o el bot --
// se recalcula aquí con la hora del SERVIDOR contra la config guardada.
function estaAbiertoAhora(array $cfg): bool {
    if (($cfg['mode'] ?? 'manual') !== 'horario') return ($cfg['abiertoManual'] ?? true) !== false;
    $start = $cfg['horario']['start'] ?? null;
    $end = $cfg['horario']['end'] ?? null;
    if (!$start || !$end) return true;
    $now = date('H:i');
    return $start <= $end ? ($now >= $start && $now < $end) : ($now >= $start || $now < $end);
}
$businessOpenConfig = $data['businessOpenConfig'] ?? ['mode' => 'manual', 'abiertoManual' => true];
if (!estaAbiertoAhora($businessOpenConfig)) {
    http_response_code(409);
    echo json_encode(['success' => false, 'error' => 'Estamos cerrados ahora mismo, no se pueden hacer pedidos.']);
    exit;
}

// Cargo de empaque de ESTE platillo -- se cobra en domicilio Y en recoger
// (el pedido igual sale empacado), nunca en comer aquí. Nunca se confía en
// el precio que mande el navegador, siempre se recalcula aquí.
function cargoEmpaque($dish, $categoriesById, $takeoutConfig, $tipoEntrega) {
    if (empty($takeoutConfig['enabled']) || $tipoEntrega === 'comer_aqui') return 0;
    $cat = $categoriesById[$dish['categoryId']] ?? null;
    if (!$cat || !empty($cat['exentoEmpaque'])) return 0;
    return (int) ($takeoutConfig['fee'] ?? 0);
}

// Fila de horario por platillo -- en modo semanal, solo la del día pedido;
// en modo único, una sola fila por platillo (no hay día).
$scheduleIdxByDishId = [];
foreach ($schedule as $i => $s) {
    if ($menuMode === 'unico' || $s['day'] === $day) $scheduleIdxByDishId[$s['dishId']] = $i;
}

$resueltos = [];
$total = 0;

foreach ($items as $item) {
    $dishId = $item['dishId'] ?? null;
    $cantidad = max(1, (int)($item['cantidad'] ?? 1));
    if ($dishId === null || !isset($dishesById[$dishId])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Uno de los platillos de tu pedido ya no existe']);
        exit;
    }
    $dish = $dishesById[$dishId];
    if (!isset($scheduleIdxByDishId[$dishId])) {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => '"' . $dish['name'] . '" ya no está disponible']);
        exit;
    }
    $schedIdx = $scheduleIdxByDishId[$dishId];
    $schedRow = $schedule[$schedIdx];
    if (($schedRow['available'] ?? true) === false) {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => '"' . $dish['name'] . '" ya no está disponible']);
        exit;
    }
    if ($schedRow['stock'] !== null && $schedRow['stock'] < $cantidad) {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'Ya no queda suficiente "' . $dish['name'] . '" (quedan ' . $schedRow['stock'] . ')']);
        exit;
    }
    $precioUnitario = (int) preg_replace('/\D/', '', (string) $dish['price']) + cargoEmpaque($dish, $categoriesById, $takeoutConfig, $tipoEntrega);
    $total += $precioUnitario * $cantidad;
    $resueltos[] = [
        'dishId' => $dishId,
        'scheduleIdx' => $schedIdx,
        'name' => $dish['name'],
        'cantidad' => $cantidad,
        'precioUnitario' => $precioUnitario,
    ];
}

// Cargo de domicilio: UNA vez por pedido (no por platillo), solo cuando se
// entrega a domicilio.
$cargoDomicilio = ($tipoEntrega === 'domicilio' && !empty($takeoutConfig['enabled'])) ? (int) ($takeoutConfig['domicilioFee'] ?? 0) : 0;
$total += $cargoDomicilio;

// Todo válido -- descuenta stock (solo donde el stock se controla; null =
// ilimitado). Nunca queda en negativo.
foreach ($resueltos as $r) {
    if ($schedule[$r['scheduleIdx']]['stock'] !== null) {
        $schedule[$r['scheduleIdx']]['stock'] = max(0, $schedule[$r['scheduleIdx']]['stock'] - $r['cantidad']);
    }
}
if ($menuMode === 'unico') $data['singleMenuSchedule'] = $schedule;
else $data['schedule'] = $schedule;

if (!isset($data['ordersData']) || !is_array($data['ordersData'])) $data['ordersData'] = [];
if (!isset($data['historialPedidos']) || !is_array($data['historialPedidos'])) $data['historialPedidos'] = [];
$orderId = (int) round(microtime(true) * 1000);
$order = [
    'id' => $orderId,
    'createdAt' => $orderId,
    'day' => $menuMode === 'unico' ? 'Menú único' : $day,
    'tipoEntrega' => $tipoEntrega,
    'cliente' => ['nombre' => $nombre, 'direccion' => $direccion, 'telefono' => $telefono, 'nota' => $nota],
    'items' => array_map(function ($r) {
        return ['dishId' => $r['dishId'], 'name' => $r['name'], 'cantidad' => $r['cantidad'], 'precioUnitario' => $r['precioUnitario']];
    }, $resueltos),
    'cargoDomicilio' => $cargoDomicilio,
    'total' => $total,
    'estado' => 'pendiente',
    'canal' => $canal,
    'metodoPago' => $metodoPago,
];
$data['ordersData'][] = $order;
// Registro PERMANENTE: a diferencia de ordersData (la cola de cocina, que se
// vacía al eliminar el ticket), este nunca se borra desde el Receptor de
// Pedidos -- es el historial de ventas para el panel de admin.
$data['historialPedidos'][] = $order;

if (file_put_contents($file, json_encode($data)) === false) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'No se pudo guardar el pedido, intenta de nuevo']);
    exit;
}

// Aviso por correo (opcional; si falla, NO se revierte el pedido, ya quedó guardado).
// La API Key de Resend vive de preferencia en la variable de entorno
// RESEND_API_KEY (nunca en data.json, que se sirve tal cual por load-data.php);
// si todavía no la configuraste ahí, cae al valor guardado como respaldo.
$notify = $data['notifyConfig'] ?? [];
$resendKey = getenv('RESEND_API_KEY') ?: ($notify['resendApiKey'] ?? '');
$ownerEmail = $notify['ownerEmail'] ?? '';
if ($resendKey && $ownerEmail) {
    $itemsHtml = '';
    foreach ($order['items'] as $it) {
        $itemsHtml .= $it['cantidad'] . ' x ' . $it['name'] . ' - $' . number_format($it['precioUnitario'] * $it['cantidad'], 0, ',', '.') . '<br>';
    }
    $tipoEntregaLabel = ['domicilio' => 'A domicilio', 'recoger' => 'Para recoger', 'comer_aqui' => 'Comer aquí'][$tipoEntrega] ?? $tipoEntrega;
    $html = "<h2>Nuevo pedido #{$orderId}</h2>" .
        "<p><b>Cliente:</b> {$nombre}<br><b>Teléfono:</b> {$telefono}" .
        ($direccion !== '' ? "<br><b>Dirección:</b> {$direccion}" : '') .
        ($nota !== '' ? "<br><b>Nota:</b> {$nota}" : '') . '</p>' .
        "<p><b>Entrega:</b> {$tipoEntregaLabel}</p>" .
        "<p><b>Pedido:</b><br>{$itemsHtml}</p>" .
        '<p><b>Total: $' . number_format($total, 0, ',', '.') . '</b></p>';
    $ch = curl_init('https://api.resend.com/emails');
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Authorization: Bearer ' . $resendKey, 'Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        'from' => 'Pedidos <onboarding@resend.dev>',
        'to' => [$ownerEmail],
        'subject' => "Nuevo pedido #{$orderId} - {$nombre}",
        'html' => $html,
    ]));
    curl_setopt($ch, CURLOPT_TIMEOUT, 8);
    curl_exec($ch);
    curl_close($ch);
}

echo json_encode(['success' => true, 'orderId' => $orderId, 'total' => $total]);
