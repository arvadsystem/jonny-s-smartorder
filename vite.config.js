import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import million from 'million/compiler';
import process from 'node:process';

const BACKEND = 'http://localhost:3001';

const buildProxyTarget = () => ({
  target: BACKEND,
  changeOrigin: true,
  secure: false,
  // Publicacion de menu puede enviar muchos items y tardar mas de 15s.
  timeout: 60000,
  proxyTimeout: 60000,
  bypass: (req) => {
    // Si la peticion acepta HTML (navegacion directa/refresco)
    // O si la ruta es parte del modulo de menu publico,
    // NO debemos proxearla al backend para que el SPA fallback funcione.
    if (req.headers.accept?.includes('text/html') || req.url.startsWith('/menu-publico')) {
      return req.url;
    }
    return null;
  },
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
  '/planillas',
  '/personas',
  '/empresas',
  '/parametros',
  '/movimientos',
  '/perfil',
  '/reportes',
  '/email-campaigns',
  '/archivos',
  '/mobiliario',
  '/solicitudes_compra',
  '/orden_compras',
  '/detalle_orden_compras',
  '/compras',
  '/detalle_compras',
  '/tipo_departamento',
  '/movimientos_inventario',
  '/kardex',
  '/correos',
  '/telefonos',
  '/direcciones'
];

const proxy = Object.fromEntries(proxiedPaths.map((path) => [path, buildProxyTarget()]));

export default defineConfig(({ command }) => ({
  // Million en build por defecto. Para habilitarlo en dev:
  // VITE_ENABLE_MILLION_DEV=true npm run dev
  plugins:
    command === 'build' || process.env.VITE_ENABLE_MILLION_DEV === 'true'
      ? [million.vite({ auto: true }), react()]
      : [react()],
  // Evita recargas completas al navegar por primera vez a rutas lazy
  // que traen dependencias pesadas no pre-optimizadas.
  optimizeDeps: {
    include: ['framer-motion', 'react-icons/fi', 'react-select', 'react-select/async', 'react-dom']
  },
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    proxy
  }
}));

