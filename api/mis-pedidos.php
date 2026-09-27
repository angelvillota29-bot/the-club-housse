<?php
// Historial y favoritos de la cuenta que tiene la sesión -- nunca expone
// pedidos de otras cuentas, solo filtra por el email de la propia cookie.
header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
require_once __DIR__ . '/_auth.php';

$session = readSession();
if (!$session) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Inicia sesión para ver tus pedidos']);
    exit;
}

$file = dirname(__DIR__) . '/data/data.json';
$data = file_exists($file) ? (json_decode(file_get_contents($file), true) ?: []) : [];
$historial = $data['historialPedidos'] ?? [];

$misPedidos = array_values(array_filter($historial, fn($o) => strtolower($o['accountEmail'] ?? '') === $session['email']));
usort($misPedidos, fn($a, $b) => ($b['createdAt'] ?? 0) <=> ($a['createdAt'] ?? 0));

// Favoritos: platillos más repetidos en los pedidos de esta cuenta (top 5).
$conteo = [];
$nombrePorId = [];
foreach ($misPedidos as $pedido) {
    foreach (($pedido['items'] ?? []) as $it) {
        $id = $it['dishId'] ?? null;
        if ($id === null) continue;
        $conteo[$id] = ($conteo[$id] ?? 0) + ($it['cantidad'] ?? 1);
        $nombrePorId[$id] = $it['name'] ?? '';
    }
}
arsort($conteo);
$favoritos = [];
foreach (array_slice(array_keys($conteo), 0, 5) as $id) {
    $favoritos[] = ['dishId' => $id, 'name' => $nombrePorId[$id], 'veces' => $conteo[$id]];
}

echo json_encode(['success' => true, 'pedidos' => $misPedidos, 'favoritos' => $favoritos]);
