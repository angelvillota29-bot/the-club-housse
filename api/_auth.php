<?php
// Sesión basada en Google Sign-In, sin base de datos de sesiones: la cookie
// guarda {email, role, exp} firmado con HMAC-SHA256 (SESSION_SECRET), igual
// de "sin infraestructura extra" que el resto del sistema (archivos planos).
// role: 'cliente' (cualquier cuenta de Google) | 'admin' (correo en
// usersData) | 'superadmin' (SUPREME_ADMIN_EMAIL).

const SESSION_COOKIE = 'housse_session';
const SESSION_TTL = 60 * 60 * 24 * 30; // 30 días
const SUPREME_ADMIN_EMAIL = 'angelvillota4@gmail.com';
const ROLE_LEVEL = ['cliente' => 1, 'admin' => 2, 'superadmin' => 3];

function sessionSecret() {
    return getenv('SESSION_SECRET') ?: 'housse-dev-secret-cambia-esto-en-easypanel';
}

function issueSession($email, $role) {
    $payload = json_encode(['email' => $email, 'role' => $role, 'exp' => time() + SESSION_TTL]);
    $b64 = rtrim(strtr(base64_encode($payload), '+/', '-_'), '=');
    $sig = hash_hmac('sha256', $b64, sessionSecret());
    $token = $b64 . '.' . $sig;
    setcookie(SESSION_COOKIE, $token, [
        'expires' => time() + SESSION_TTL,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure' => !empty($_SERVER['HTTPS']),
    ]);
}

function clearSession() {
    setcookie(SESSION_COOKIE, '', ['expires' => time() - 3600, 'path' => '/']);
}

function readSession() {
    $token = $_COOKIE[SESSION_COOKIE] ?? '';
    if (!$token || strpos($token, '.') === false) return null;
    [$b64, $sig] = explode('.', $token, 2);
    if (!hash_equals(hash_hmac('sha256', $b64, sessionSecret()), $sig)) return null;
    $payload = json_decode(base64_decode(strtr($b64, '-_', '+/')), true);
    if (!$payload || ($payload['exp'] ?? 0) < time()) return null;
    return $payload;
}

function requireRole($minRole) {
    $session = readSession();
    if (!$session || (ROLE_LEVEL[$session['role']] ?? 0) < ROLE_LEVEL[$minRole]) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'No autorizado. Inicia sesión con una cuenta autorizada.']);
        exit;
    }
    return $session;
}

// Verifica el ID token de Google contra el propio Google (server-to-server,
// sin librerías) y confirma que es para ESTA app (aud = GOOGLE_CLIENT_ID).
function verifyGoogleIdToken($idToken) {
    $ch = curl_init('https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($idToken));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 8);
    $resp = curl_exec($ch);
    curl_close($ch);
    if (!$resp) return null;
    $info = json_decode($resp, true);
    $clientId = getenv('GOOGLE_CLIENT_ID');
    if (!$info || !$clientId || ($info['aud'] ?? '') !== $clientId) return null;
    if (($info['email_verified'] ?? 'false') !== 'true' || empty($info['email'])) return null;
    return $info;
}

function resolveRole($email, $usersData) {
    if (strtolower($email) === SUPREME_ADMIN_EMAIL) return 'superadmin';
    foreach ($usersData as $u) {
        if (strtolower($u['email'] ?? '') === strtolower($email)) return 'admin';
    }
    return 'cliente';
}
