<?php
header('Content-Type: application/json');
require_once __DIR__ . '/_auth.php';

clearSession();
echo json_encode(['success' => true]);
