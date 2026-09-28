# Etapa 1: compila la SPA de React (Vite) a estáticos.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY index.html vite.config.js ./
COPY src ./src
RUN npm run build

# Etapa 2: PHP + Apache sirve el build estático y la API PHP existente.
FROM php:8.2-apache
RUN sed -i 's/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf \
    && a2enmod rewrite headers

COPY --from=build /app/dist/ /var/www/html/
COPY api/ /var/www/html/api/
COPY .htaccess /var/www/html/.htaccess
COPY entrypoint.sh /var/www/html/entrypoint.sh
COPY data-htaccess-deny /var/www/html/data/.htaccess

RUN mkdir -p /var/www/html/data /var/www/html/uploads \
    && chown -R www-data:www-data /var/www/html \
    && chmod -R 775 /var/www/html \
    && chmod +x /var/www/html/entrypoint.sh

EXPOSE 80
ENTRYPOINT ["/var/www/html/entrypoint.sh"]
