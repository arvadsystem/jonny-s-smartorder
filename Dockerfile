FROM nginx:1.27-alpine

# SPA fallback for React Router + reverse proxy to backend API
RUN set -eux; \
  cat > /etc/nginx/conf.d/default.conf <<'EOF'
server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  # Proxy backend routes to API service to avoid CORS issues in production.
  location ~ ^/(login|logout|me|status|api|seguridad|uploads|usuarios|categorias|productos|insumos|proveedores|almacenes|sucursales|ventas|cocina|clientes|empleados|planillas|personas|empresas|parametros|movimientos|perfil|email-campaigns|archivos|mobiliario|orden_compras|detalle_orden_compras|compras|detalle_compras|tipo_departamento|movimientos_inventario|kardex|correos|telefonos|direcciones)(/|$) {
    proxy_pass https://api.jonnyshn.com;
    proxy_ssl_server_name on;
    proxy_set_header Host api.jonnyshn.com;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
    proxy_http_version 1.1;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }

  location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|webp|woff2?)$ {
    expires 7d;
    add_header Cache-Control "public, immutable";
    try_files $uri =404;
  }
}
EOF

COPY dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
