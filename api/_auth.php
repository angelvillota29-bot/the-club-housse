<?php
// Sesión basada en Google Sign-In, sin base de datos de sesiones: la cookie
// guarda {email, role, exp} firmado con HMAC-SHA256 (SESSION_SECRET), igual
// de "sin infraestructura extra" que el resto del sistema (archivos planos).
// role: 'cliente' (cualquier cuenta de Google) | 'mesero' (usuario/clave
// compartidos, ver login-mesero.php -- no puede alterar nada, solo queda
// exento del límite de pedidos) | 'admin' (correo en usersData) |
// 'superadmin' (SUPREME_ADMIN_EMAIL). El campo 'email' de la sesión de un
// mesero en realidad guarda su nombre de usuario, no un correo real.

require_once __DIR__ . '/_data.php';

const SESSION_COOKIE = 'housse_session';
const SESSION_TTL = 60 * 60 * 24 * 30; // 30 días
const SUPREME_ADMIN_EMAIL = 'angelvillota4@gmail.com';
const ROLE_LEVEL = ['cliente' => 1, 'mesero' => 2, 'admin' => 3, 'superadmin' => 4];

function sessionSecret() {
    $secret = getenv('SESSION_SECRET');
    if (!$secret) {
        // No hay fallback: firmar/verificar sesiones con un secreto que
        // cualquiera puede leer en el código fuente público permitiría
        // forjar cookies de superadmin. Fallamos cerrado hasta que se
        // provisione un secreto real en el entorno.
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Configuración del servidor incompleta: falta SESSION_SECRET.']);
        exit;
    }
    return $secret;
}

function issueSession($email, $role, array $extra = []) {
    $payload = json_encode(['email' => $email, 'role' => $role, 'exp' => time() + SESSION_TTL] + $extra);
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
    return sesionVigente($payload);
}

// Huella de las credenciales de mesero: si el superadmin cambia usuario o
// clave, las cookies de mesero emitidas antes dejan de servir.
function meseroVersion($meseroAuth) {
    return substr(hash('sha256', ($meseroAuth['usuario'] ?? '') . '|' . ($meseroAuth['passwordHash'] ?? '')), 0, 16);
}

// La cookie firmada solo prueba QUIÉN es la persona; el rol se vuelve a
// calcular en cada petición contra los datos actuales. Así, si se quita a un
// administrador o se cambia la clave de mesero, el acceso se corta de
// inmediato y no 30 días después cuando caduque la cookie.
function sesionVigente(array $p) {
    $data = dataLeer();
    $data = is_array($data) ? $data : [];
    if (($p['role'] ?? '') === 'mesero') {
        $auth = $data['meseroAuth'] ?? null;
        if (!is_array($auth) || empty($auth['usuario']) || empty($auth['passwordHash'])) return null;
        if (!hash_equals(meseroVersion($auth), (string) ($p['mv'] ?? ''))) return null;
        return $p;
    }
    $users = $data['usersData'] ?? [];
    $p['role'] = resolveRole((string) ($p['email'] ?? ''), is_array($users) ? $users : []);
    return $p;
}

// Para endpoints que cambian datos con la cookie de sesión: solo POST, y solo
// si la petición viene de nuestra propia página. Sin esto, una página ajena
// podía hacer que el navegador de un administrador llamara al endpoint (CSRF).
function requirePostSameOrigin($exigirJson = true) {
    $fallo = function ($code, $msg) {
        http_response_code($code);
        echo json_encode(['success' => false, 'error' => $msg]);
        exit;
    };
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        header('Allow: POST');
        $fallo(405, 'Método no permitido');
    }
    $sfs = $_SERVER['HTTP_SEC_FETCH_SITE'] ?? '';
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($sfs !== '') {
        if ($sfs !== 'same-origin' && $sfs !== 'none') $fallo(403, 'Petición de origen no permitido');
    } elseif ($origin !== '') {
        $hostOrigen = strtolower((string) parse_url($origin, PHP_URL_HOST));
        $hostSitio = strtolower(explode(':', $_SERVER['HTTP_HOST'] ?? '')[0]);
        if ($hostOrigen === '' || $hostOrigen !== $hostSitio) $fallo(403, 'Petición de origen no permitido');
    } elseif ($exigirJson && stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') === false) {
        // Sin cabeceras de origen (navegadores muy viejos u otros clientes):
        // exigir JSON obliga a un "preflight" que un sitio ajeno no pasa.
        $fallo(403, 'Petición no permitida');
    }
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
