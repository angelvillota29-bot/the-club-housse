#!/bin/bash
set -e

# Los volúmenes se montan DESPUÉS de construir la imagen, así que el chown
# del Dockerfile no les llega. Lo hacemos aquí, en cada arranque, cuando el
# volumen ya está disponible.
mkdir -p /var/www/html/data /var/www/html/uploads
if [ ! -f /var/www/html/data/.htaccess ]; then
  echo "Require all denied" > /var/www/html/data/.htaccess
fi
chown -R www-data:www-data /var/www/html/data /var/www/html/uploads
chmod -R 775 /var/www/html/data /var/www/html/uploads

exec apache2-foreground
