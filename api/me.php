<?php
header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
require_once __DIR__ . '/_auth.php';

$session = readSession();
if (!$session) {
    echo json_encode(['success' => false]);
    exit;
}
echo json_encode(['success' => true, 'email' => $session['email'], 'role' => $session['role']]);
