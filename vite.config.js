import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import million from 'million/compiler';

const BACKEND = 'http://localhost:3001';

const buildProxyTarget = () => ({
  target: BACKEND,
  changeOrigin: true,
  secure: false,
  timeout: 15000,
  proxyTimeout: 15000,
  configure: (proxy) => {
    proxy.on('error', (error, req) => {
      const method = req?.method || 'UNKNOWN';
      const url = req?.url || '-';
      const code = error?.code || error?.message || 'PROXY_ERROR';
      // Keep explicit logs in dev terminal to correlate ECONNRESET cases.
      console.error(`[vite][proxy] ${method} ${url} -> ${code}`);
    });
  }
});

const proxiedPaths = [
  '/login',
  '/logout',
  '/me',
  '/status',
  '/api',
  '/seguridad',
  '/uploads',
  '/usuarios',
  '/categorias',
  '/productos',
  '/insumos',
  '/proveedores',
  '/almacenes',
  '/sucursales',
  '/ventas',
  '/cocina',
  '/clientes',
  '/empleados',
  '/personas',
  '/empresas',
  '/parametros',
  '/movimientos',
  '/perfil',
  '/archivos'
];

const proxy = Object.fromEntries(proxiedPaths.map((path) => [path, buildProxyTarget()]));

export default defineConfig({
  plugins: [million.vite({ auto: true }), react()],
  server: {
    proxy
  }
});

