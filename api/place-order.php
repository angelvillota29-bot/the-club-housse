<?php
// Recibe un pedido armado en la propia página (carrito + checkout), valida
// disponibilidad/stock de cada platillo contra el horario (semanal o menú
// único), descuenta el stock, guarda el pedido en ordersData, y si hay
// notifyConfig configurado, avisa al dueño por correo (Resend). No requiere
// API Key: lo llama el navegador del cliente, igual que save-data.php.
require_once __DIR__ . '/_auth.php';
require_once __DIR__ . '/_ratelimit.php';

header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
date_default_timezone_set('America/Bogota');

function respuestaError($codigo, $mensaje) {
    http_response_code($codigo);
    echo json_encode(['success' => false, 'error' => $mensaje]);
    exit;
}

// Texto del cliente: siempre cadena, recortada a un largo razonable. Sin estos
// topes, un solo pedido enorme (o miles) podía inflar data.json hasta dejar el
// sitio lento o inservible, porque cada pedido se guarda dos veces.
function campoTexto($v, $max) {
    if (is_int($v) || is_float($v)) $v = (string) $v;
    if (!is_string($v)) return '';
    $v = trim($v);
    return function_exists('mb_substr') ? mb_substr($v, 0, $max) : substr($v, 0, $max);
}

if (!is_file(dataPath())) respuestaError(404, 'No hay datos');

$raw = file_get_contents('php://input');
if (strlen($raw) > 30000) respuestaError(413, 'El pedido es demasiado grande');
$input = json_decode($raw, true);
if (!is_array($input) || !$input) respuestaError(400, 'Datos inválidos');

// El correo de la cuenta se toma SOLO de la sesión autenticada del servidor
// (nunca de lo que mande el navegador) -- así un pedido jamás puede quedar
// atribuido a una cuenta que no sea la que realmente inició sesión.
$session = readSession();
$accountEmail = $session['email'] ?? null;

// Límite anti-inundación: solo para clientes normales (sin sesión, o con
// cuenta de Google pero sin rol especial) -- un mesero (o un admin) queda
// exento, ya que no tendría sentido limitarlos al tomar pedidos en el local.
$rolActual = ROLE_LEVEL[$session['role'] ?? ''] ?? 0;
if ($rolActual < ROLE_LEVEL['mesero'] && !dentroDelLimite('order:' . clientIp(), 10, 60)) {
    respuestaError(429, 'Se están recibiendo demasiados pedidos desde aquí en muy poco tiempo. Espera un momento e intenta de nuevo.');
}

$day = is_string($input['day'] ?? null) ? $input['day'] : null;
$cliente = is_array($input['cliente'] ?? null) ? $input['cliente'] : [];
$items = is_array($input['items'] ?? null) ? $input['items'] : [];
// 'pagina' = checkout directo del carrito; 'chat_web' = el bot desde el
// widget del propio sitio; 'whatsapp'/'telegram' = el bot por esos canales.
$canal = in_array($input['canal'] ?? '', ['pagina', 'chat_web', 'whatsapp', 'telegram'], true) ? $input['canal'] : 'pagina';
$metodoPago = ($input['metodoPago'] ?? '') === 'nequi' ? 'nequi' : 'efectivo';
// 'domicilio' (empaque + domicilio, pide dirección) · 'recoger' (solo
// empaque, sin dirección) · 'comer_aqui' (sin cargo, sin dirección).
$tipoEntrega = in_array($input['tipoEntrega'] ?? '', ['domicilio', 'recoger', 'comer_aqui'], true) ? $input['tipoEntrega'] : 'domicilio';

$nombre = campoTexto($cliente['nombre'] ?? '', 80);
$direccion = $tipoEntrega === 'domicilio' ? campoTexto($cliente['direccion'] ?? '', 200) : '';
$telefono = campoTexto($cliente['telefono'] ?? '', 30);
$nota = campoTexto($cliente['nota'] ?? '', 300);

if ($nombre === '' || ($tipoEntrega !== 'comer_aqui' && $telefono === '') || empty($items) || ($tipoEntrega === 'domicilio' && $direccion === '')) {
    respuestaError(400, 'Faltan datos del pedido (nombre, dirección, teléfono o platillos)');
}
if (count($items) > 40) respuestaError(400, 'El pedido tiene demasiados platillos distintos');

// Un mismo platillo repetido en varias líneas se suma ANTES de validar el
// stock; si no, cada línea pasaba por separado y se podía pedir más de lo que
// había disponible.
$pedidoPorPlato = [];
foreach ($items as $item) {
    $dishId = is_array($item) ? ($item['dishId'] ?? null) : null;
    if (!is_int($dishId) && !is_string($dishId)) respuestaError(400, 'Uno de los platillos de tu pedido no es válido');
    $cantidad = min(50, max(1, (int) ($item['cantidad'] ?? 1)));
    $pedidoPorPlato[$dishId] = min(100, ($pedidoPorPlato[$dishId] ?? 0) + $cantidad);
}

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

// ── Abierto/Cerrado: nunca confiar en lo que mande el navegador o el bot --
// se recalcula aquí con la hora del SERVIDOR contra la config guardada. ──
function estaAbiertoAhora(array $cfg): bool {
    if (($cfg['mode'] ?? 'manual') !== 'horario') return ($cfg['abiertoManual'] ?? true) !== false;
    $start = $cfg['horario']['start'] ?? null;
    $end = $cfg['horario']['end'] ?? null;
    if (!$start || !$end) return true;
    $now = date('H:i');
    return $start <= $end ? ($now >= $start && $now < $end) : ($now >= $start || $now < $end);
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

$diasSemanaPhp = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
$hoy = $diasSemanaPhp[(int) date('w')];
$hoyFecha = date('Y-m-d');
$orderId = (int) round(microtime(true) * 1000);

// Todo lo que lee y cambia el almacén de datos ocurre con el candado tomado:
// dos pedidos simultáneos ya no se pisan ni descuentan el mismo stock dos veces.
$res = dataMutar(function (&$data) use ($pedidoPorPlato, $day, $nombre, $direccion, $telefono, $nota, $tipoEntrega, $canal, $metodoPago, $accountEmail, $hoy, $hoyFecha, $orderId) {
    // El modo de menú sale de lo guardado en el servidor, no de lo que diga el
    // navegador (antes se podía pedir "modo único" para saltarse el día).
    $menuMode = ($data['menuMode'] ?? 'semanal') === 'unico' ? 'unico' : 'semanal';
    $dishes = $data['dishes'] ?? [];
    $categories = $data['categories'] ?? [];
    $takeoutConfig = $data['takeoutConfig'] ?? ['enabled' => false, 'fee' => 0, 'domicilioFee' => 0];

    // Solo se aceptan pedidos del día de HOY (el reloj del servidor manda, no lo
    // que mande el navegador) -- evita pedidos "atrasados" de otro día del menú.
    // En modo "menú único" no aplica: es el mismo menú todos los días.
    if ($menuMode === 'semanal') {
        if (!$day) return ['err' => [400, 'Faltan datos del pedido (día del menú)']];
        if ($day !== $hoy) return ['err' => [400, "Solo se pueden hacer pedidos del día de hoy ($hoy). Cambia el día en la página e intenta de nuevo."]];
    }

    $dishesById = [];
    foreach ($dishes as $d) { $dishesById[$d['id']] = $d; }
    $categoriesById = [];
    foreach ($categories as $c) { $categoriesById[$c['id']] = $c; }

    $schedule = $menuMode === 'unico' ? ($data['singleMenuSchedule'] ?? []) : ($data['schedule'] ?? []);
    reiniciarStockDiario($schedule, $hoyFecha);

    if (!estaAbiertoAhora($data['businessOpenConfig'] ?? ['mode' => 'manual', 'abiertoManual' => true])) {
        return ['err' => [409, 'Estamos cerrados ahora mismo, no se pueden hacer pedidos.']];
    }

    // Fila de horario por platillo -- en modo semanal, solo la del día pedido;
    // en modo único, una sola fila por platillo (no hay día).
    $scheduleIdxByDishId = [];
    foreach ($schedule as $i => $s) {
        if ($menuMode === 'unico' || $s['day'] === $day) $scheduleIdxByDishId[$s['dishId']] = $i;
    }

    $resueltos = [];
    $total = 0;
    foreach ($pedidoPorPlato as $dishId => $cantidad) {
        if (!isset($dishesById[$dishId])) {
            return ['err' => [400, 'Uno de los platillos de tu pedido ya no existe']];
        }
        $dish = $dishesById[$dishId];
        if (!isset($scheduleIdxByDishId[$dishId])) {
            return ['err' => [409, '"' . $dish['name'] . '" ya no está disponible']];
        }
        $schedIdx = $scheduleIdxByDishId[$dishId];
        $schedRow = $schedule[$schedIdx];
        if (($schedRow['available'] ?? true) === false) {
            return ['err' => [409, '"' . $dish['name'] . '" ya no está disponible']];
        }
        if ($schedRow['stock'] !== null && $schedRow['stock'] < $cantidad) {
            return ['err' => [409, 'Ya no queda suficiente "' . $dish['name'] . '" (quedan ' . $schedRow['stock'] . ')']];
        }
        $precioUnitario = (int) preg_replace('/\D/', '', (string) $dish['price']) + cargoEmpaque($dish, $categoriesById, $takeoutConfig, $tipoEntrega);
        $total += $precioUnitario * $cantidad;
        $resueltos[] = [
            'dishId' => $dish['id'],
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
        'accountEmail' => $accountEmail,
        // El pedido solo cuenta como venta en el Historial/Analíticas del Receptor
        // de Pedidos cuando el cajero confirma el pago (api/confirm-payment.php).
        'pagoConfirmado' => false,
    ];
    $data['ordersData'][] = $order;
    // Registro PERMANENTE: a diferencia de ordersData (la cola de cocina, que se
    // vacía al eliminar el ticket), este nunca se borra desde el Receptor de
    // Pedidos -- es el historial de ventas para el panel de admin.
    $data['historialPedidos'][] = $order;

    return ['order' => $order, 'notify' => $data['notifyConfig'] ?? []];
});

if (!$res['ok']) respuestaError(503, 'No se pudo guardar el pedido, intenta de nuevo en un momento');
if (isset($res['res']['err'])) respuestaError($res['res']['err'][0], $res['res']['err'][1]);

$order = $res['res']['order'];
$notify = $res['res']['notify'];
$total = $order['total'];

// Aviso por correo (opcional; si falla, NO se revierte el pedido, ya quedó guardado).
// La API Key de Resend vive de preferencia en la variable de entorno
// RESEND_API_KEY (nunca en data.json, que se sirve tal cual por load-data.php);
// si todavía no la configuraste ahí, cae al valor guardado como respaldo.
$resendKey = getenv('RESEND_API_KEY') ?: ($notify['resendApiKey'] ?? '');
$ownerEmail = $notify['ownerEmail'] ?? '';
if ($resendKey && $ownerEmail) {
    // Todo lo que viene del cliente (y los nombres de platillos, que el admin
    // puede escribir libremente) se escapa solo aquí, al interpolarlo en el
    // HTML del correo. El valor crudo sigue guardándose tal cual en
    // ordersData/historialPedidos para el panel de admin y el ticket.
    $esc = fn($t) => htmlspecialchars((string) $t, ENT_QUOTES, 'UTF-8');
    $itemsHtml = '';
    foreach ($order['items'] as $it) {
        $itemsHtml .= $it['cantidad'] . ' x ' . $esc($it['name']) . ' - $' . number_format($it['precioUnitario'] * $it['cantidad'], 0, ',', '.') . '<br>';
    }
    $tipoEntregaLabel = ['domicilio' => 'A domicilio', 'recoger' => 'Para recoger', 'comer_aqui' => 'Comer aquí'][$tipoEntrega] ?? $tipoEntrega;
    $html = "<h2>Nuevo pedido #{$orderId}</h2>" .
        '<p><b>Cliente:</b> ' . $esc($nombre) .
        ($telefono !== '' ? '<br><b>Teléfono:</b> ' . $esc($telefono) : '') .
        ($direccion !== '' ? '<br><b>Dirección:</b> ' . $esc($direccion) : '') .
        ($nota !== '' ? '<br><b>Nota:</b> ' . $esc($nota) : '') . '</p>' .
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
        'subject' => "Nuevo pedido #{$orderId} - " . preg_replace('/[\r\n]+/', ' ', $nombre),
        'html' => $html,
    ]));
    curl_setopt($ch, CURLOPT_TIMEOUT, 8);
    curl_exec($ch);
    curl_close($ch);
}

echo json_encode(['success' => true, 'orderId' => $orderId, 'total' => $total]);
