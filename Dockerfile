FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci --no-audit --no-fund

COPY . .

ENV NODE_ENV=production

RUN npm run build


FROM nginx:1.27-alpine

RUN set -eux; \
  cat > /etc/nginx/conf.d/default.conf <<'EOF'
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    client_max_body_size 30m;

    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    proxy_connect_timeout 15s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    error_page 502 503 504 = @api_error;

    location @api_error {
        default_type application/json;
        return 502 '{"error":true,"message":"Backend QA no disponible desde Nginx del frontend."}';
    }

    location = /login {
        proxy_pass http://jonnys-qa-backend-qa:3001;
    }

    location = /logout {
        proxy_pass http://jonnys-qa-backend-qa:3001;
    }

    location = /me {
        proxy_pass http://jonnys-qa-backend-qa:3001;
    }

    location = /status {
        proxy_pass http://jonnys-qa-backend-qa:3001;
    }

    location ^~ /api/ {
        proxy_pass http://jonnys-qa-backend-qa:3001;
    }

    location ^~ /seguridad/ {
        proxy_pass http://jonnys-qa-backend-qa:3001;
    }

    location ^~ /ventas/ {
        proxy_pass http://jonnys-qa-backend-qa:3001;
    }

    location ^~ /sucursales/ {
        proxy_pass http://jonnys-qa-backend-qa:3001;
    }

    location ^~ /productos/ {
        proxy_pass http://jonnys-qa-backend-qa:3001;
    }

    location ^~ /cocina/ {
        proxy_pass http://jonnys-qa-backend-qa:3001;
    }

    location ^~ /uploads/ {
        proxy_pass http://jonnys-qa-backend-qa:3001;
    }

    location ^~ /usuarios/ {
        proxy_pass http://jonnys-qa-backend-qa:3001;
    }

    location ^~ /clientes/ {
        proxy_pass http://jonnys-qa-backend-qa:3001;
    }

    location ^~ /empleados/ {
        proxy_pass http://jonnys-qa-backend-qa:3001;
    }

    location ^~ /proveedores/ {
        proxy_pass http://jonnys-qa-backend-qa:3001;
    }

    location ^~ /compras/ {
        proxy_pass http://jonnys-qa-backend-qa:3001;
    }

    location ^~ /orden_compras/ {
        proxy_pass http://jonnys-qa-backend-qa:3001;
    }

    location ^~ /movimientos/ {
        proxy_pass http://jonnys-qa-backend-qa:3001;
    }

    location ^~ /movimientos_inventario/ {
        proxy_pass http://jonnys-qa-backend-qa:3001;
    }

    location ^~ /kardex/ {
        proxy_pass http://jonnys-qa-backend-qa:3001;
    }

    location ^~ /perfil/ {
        proxy_pass http://jonnys-qa-backend-qa:3001;
    }

    location ^~ /email-campaigns/ {
        proxy_pass http://jonnys-qa-backend-qa:3001;
    }

    location ^~ /archivos/ {
        proxy_pass http://jonnys-qa-backend-qa:3001;
    }

    location ^~ /menu-pos/ {
        proxy_pass http://jonnys-qa-backend-qa:3001;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|webp|woff2?)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
