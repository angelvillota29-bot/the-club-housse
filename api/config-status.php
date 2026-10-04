<?php
// Le dice al panel SI las llaves de Resend/N8N están configuradas como
// variable de entorno, sin revelar su valor real -- así el panel puede
// mostrar "✅ Configurada" sin que la llave viaje nunca al navegador.
header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

echo json_encode([
    'resendConfigured' => getenv('RESEND_API_KEY') !== false && getenv('RESEND_API_KEY') !== '',
    // Solo dice SI la clave de Google Maps (domicilio por distancia) está puesta en el servidor.
    'mapsConfigured' => getenv('GOOGLE_MAPS_API_KEY') !== false && getenv('GOOGLE_MAPS_API_KEY') !== '',
    'n8nConfigured' => getenv('N8N_API_KEY') !== false && getenv('N8N_API_KEY') !== '',
    // Client ID de Google no es secreto -- se necesita en el navegador para
    // iniciar el login, por eso viaja aquí (distinto de las llaves de arriba).
    'googleClientId' => getenv('GOOGLE_CLIENT_ID') ?: '',
]);
