import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute';
import ClienteRoute from './routes/ClienteRoute';
import RequirePerm from './routes/RequirePerm';

import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

// Lazy-load por ruta para que /menu-publico renderice sin compilar todo el dashboard.
const Login = lazy(() => import('./pages/auth/Login'));
const Registro = lazy(() => import('./pages/auth/Registro'));
const RecuperarPassword = lazy(() => import('./pages/auth/RecuperarPassword'));
const AuthCallback = lazy(() => import('./pages/auth/AuthCallback'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));
const ForcePasswordChange = lazy(() => import('./pages/auth/ForcePasswordChange'));

const DashboardLayout = lazy(() => import('./components/layout/DashboardLayout'));
const PublicLayout = lazy(() => import('./components/layout/PublicLayout'));

const Inicio = lazy(() => import('./pages/dashboard/Inicio'));
const Inventario = lazy(() => import('./pages/dashboard/Inventario'));
const Seguridad = lazy(() => import('./pages/dashboard/Seguridad'));
const Perfil = lazy(() => import('./pages/dashboard/Perfil'));
const CambioContrasena = lazy(() => import('./pages/dashboard/CambioContrasena'));
const Personas = lazy(() => import('./pages/dashboard/Personas'));
const Sucursales = lazy(() => import('./pages/dashboard/Sucursales'));
const Ventas = lazy(() => import('./pages/dashboard/Ventas'));
const Cocina = lazy(() => import('./pages/dashboard/Cocina'));
const Planillas = lazy(() => import('./pages/dashboard/personas/Planillas'));
const Fidelizacion = lazy(() => import('./pages/dashboard/Fidelizacion'));
const Menu = lazy(() => import('./pages/dashboard/menu/Menu'));

const PublicMenuRoutes = lazy(() =>
  import('./modules/public-menu').then((module) => ({ default: module.PublicMenuRoutes }))
);

const PaginaEnConstruccion = ({ titulo }) => {
  return (
    <div className="p-5 text-center">
      <h2>{titulo}</h2>
      <p>Proximamente...</p>
    </div>
  );
};

const RouteBootFallback = () => (
  <div className="d-flex align-items-center justify-content-center vh-100 bg-light" role="status" aria-live="polite">
    <div className="text-center text-dark">
      <div className="spinner-border spinner-border-sm" aria-hidden="true" />
      <div className="mt-2">Cargando...</div>
    </div>
  </div>
);

function App() {
  return (
    <Suspense fallback={<RouteBootFallback />}>
      <Routes>
        {/* Rutas de autenticacion */}
        <Route path="/login" element={<Login />} />
        <Route path="/auth/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/recuperar-password" element={<RecuperarPassword />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Inicio y menu publico */}
        <Route path="/" element={<Navigate to="/menu-publico" replace />} />
        <Route path="/menu-publico/*" element={<PublicMenuRoutes />} />

        {/* Compatibilidad de enlace legado: carrito antiguo redirige al flujo nuevo de menu publico. */}
        <Route path="/carrito" element={<Navigate to="/menu-publico/menu" replace />} />

        {/* Rutas protegidas staff */}
        <Route element={<ProtectedRoute />}>
          <Route path="/cambiar-password" element={<ForcePasswordChange />} />

          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<Inicio />} />

            <Route path="personas" element={<RequirePerm moduleKey="personas"><Personas /></RequirePerm>} />
            <Route path="sucursales" element={<RequirePerm moduleKey="sucursales"><Sucursales /></RequirePerm>} />
            <Route path="inventario" element={<RequirePerm moduleKey="inventario"><Inventario /></RequirePerm>} />
            <Route path="ventas" element={<RequirePerm moduleKey="ventas"><Ventas /></RequirePerm>} />
            <Route path="cocina" element={<RequirePerm moduleKey="cocina"><Cocina /></RequirePerm>} />
            <Route path="planillas" element={<RequirePerm moduleKey="planillas"><Planillas /></RequirePerm>} />
            <Route path="fidelizacion" element={<RequirePerm moduleKey="fidelizacion"><Fidelizacion /></RequirePerm>} />
            <Route path="menu" element={<RequirePerm moduleKey="menu"><Menu /></RequirePerm>} />
            <Route path="seguridad" element={<RequirePerm moduleKey="seguridad"><Seguridad /></RequirePerm>} />
            <Route path="perfil" element={<RequirePerm moduleKey="perfil"><Perfil /></RequirePerm>} />
            <Route path="perfil/cambiar-contrasena" element={<CambioContrasena />} />
            <Route path="configuracion" element={<RequirePerm moduleKey="configuracion"><PaginaEnConstruccion titulo="Configuracion" /></RequirePerm>} />
          </Route>
        </Route>

        {/* Rutas protegidas cliente */}
        <Route element={<ClienteRoute />}>
          <Route element={<PublicLayout />}>
            <Route path="/cliente/pedidos" element={<PaginaEnConstruccion titulo="Mis Pedidos" />} />
            <Route path="/cliente/perfil" element={<PaginaEnConstruccion titulo="Mi Perfil" />} />
            <Route path="/cliente/checkout" element={<PaginaEnConstruccion titulo="Confirmar Pedido" />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/menu-publico" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
