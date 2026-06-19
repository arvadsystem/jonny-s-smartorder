import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute';
import ClienteRoute from './routes/ClienteRoute';
import RequirePerm from './routes/RequirePerm';
import { resolveCierresCajaTab } from './utils/cierresCajaRouting';

import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

// Auth
const Login = lazy(() => import('./pages/auth/Login'));
const Registro = lazy(() => import('./pages/auth/Registro'));
const RecuperarPassword = lazy(() => import('./pages/auth/RecuperarPassword'));
const AuthCallback = lazy(() => import('./pages/auth/AuthCallback'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));
const ForcePasswordChange = lazy(() => import('./pages/auth/ForcePasswordChange'));

// Layouts
const DashboardLayout = lazy(() => import('./components/layout/DashboardLayout'));
const PublicLayout = lazy(() => import('./components/layout/PublicLayout'));

// Dashboard pages
const Inicio = lazy(() => import('./pages/dashboard/Inicio'));
const Inventario = lazy(() => import('./pages/dashboard/Inventario'));
const Seguridad = lazy(() => import('./pages/dashboard/Seguridad'));
const Perfil = lazy(() => import('./pages/dashboard/Perfil'));
const CambioContrasena = lazy(() => import('./pages/dashboard/CambioContrasena'));
const Personas = lazy(() => import('./pages/dashboard/Personas'));
const Sucursales = lazy(() => import('./pages/dashboard/Sucursales'));
const Ventas = lazy(() => import('./pages/dashboard/Ventas'));
const CierresCaja = lazy(() => import('./pages/dashboard/CierresCaja'));
const Cocina = lazy(() => import('./pages/dashboard/Cocina'));
const Planillas = lazy(() => import('./pages/dashboard/personas/Planillas'));
const Fidelizacion = lazy(() => import('./pages/dashboard/Fidelizacion'));
const Reportes = lazy(() => import('./pages/dashboard/Reportes'));
const Menu = lazy(() => import('./pages/dashboard/menu/Menu'));
const EmailCampaignsPage = lazy(() => import('./pages/dashboard/configuracion/EmailCampaignsPage'));

// Público
const PublicMenuRoutes = lazy(() =>
  import('./modules/public-menu').then((module) => ({
    default: module.PublicMenuRoutes,
  }))
);

const Carrito = lazy(() => import('./pages/public/Carrito'));

const CierresCajaLegacyRedirect = () => {
  const location = useLocation();

  const suffix = String(location.pathname || '').replace(
    /^\/dashboard\/(?:ventas\/)?(?:cierre-caja|cierres-caja|cierres)\/?/i,
    ''
  );

  const firstPathSegment = suffix.split('/').filter(Boolean)[0] || '';

  const nextParams = new URLSearchParams(location.search || '');
  const tabFromQuery = resolveCierresCajaTab(nextParams.get('tab'), '');
  const tabFromPath = resolveCierresCajaTab(firstPathSegment, '');
  const resolvedTab = tabFromQuery || tabFromPath || 'operacion';

  nextParams.set('tab', resolvedTab);

  return <Navigate to={`/dashboard/cierres-caja?${nextParams.toString()}`} replace />;
};

const PaginaEnConstruccion = ({ titulo }) => {
  return (
    <div className="p-5 text-center">
      <h2>{titulo}</h2>
      <p>Próximamente...</p>
    </div>
  );
};

const RouteBootFallback = () => (
  <div
    className="d-flex align-items-center justify-content-center vh-100 bg-light"
    role="status"
    aria-live="polite"
  >
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
        {/* Rutas de autenticación */}
        <Route path="/login" element={<Login />} />
        <Route path="/auth/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/recuperar-password" element={<RecuperarPassword />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Inicio y mundo público */}
        <Route path="/" element={<Navigate to="/menu-publico" replace />} />
        <Route path="/menu" element={<Navigate to="/menu-publico" replace />} />
        <Route path="/menu/*" element={<Navigate to="/menu-publico" replace />} />
        <Route path="/menu-publico/*" element={<PublicMenuRoutes />} />

        {/* Mundo público */}
        <Route element={<PublicLayout />}>
          <Route path="/carrito" element={<Carrito />} />
        </Route>

        {/* Rutas protegidas staff */}
        <Route element={<ProtectedRoute />}>
          <Route path="/cambiar-password" element={<ForcePasswordChange />} />

          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<Inicio />} />

            <Route
              path="personas"
              element={
                <RequirePerm moduleKey="personas">
                  <Personas />
                </RequirePerm>
              }
            />
            <Route
              path="sucursales"
              element={
                <RequirePerm moduleKey="sucursales">
                  <Sucursales />
                </RequirePerm>
              }
            />
            <Route
              path="inventario"
              element={
                <RequirePerm moduleKey="inventario">
                  <Inventario />
                </RequirePerm>
              }
            />
            <Route
              path="ventas"
              element={
                <RequirePerm moduleKey="ventas">
                  <Ventas />
                </RequirePerm>
              }
            />
            <Route
              path="cierres-caja"
              element={
                <RequirePerm moduleKey="cierres-caja">
                  <CierresCaja />
                </RequirePerm>
              }
            />
            <Route path="cierres-caja/*" element={<CierresCajaLegacyRedirect />} />
            <Route path="cierre-caja/*" element={<CierresCajaLegacyRedirect />} />
            <Route path="cierres/*" element={<CierresCajaLegacyRedirect />} />
            <Route path="ventas/cierres-caja/*" element={<CierresCajaLegacyRedirect />} />
            <Route path="ventas/cierre-caja/*" element={<CierresCajaLegacyRedirect />} />
            <Route path="ventas/cierres/*" element={<CierresCajaLegacyRedirect />} />
            <Route
              path="cocina"
              element={
                <RequirePerm moduleKey="cocina">
                  <Cocina />
                </RequirePerm>
              }
            />
            <Route
              path="planillas"
              element={
                <RequirePerm moduleKey="planillas">
                  <Planillas />
                </RequirePerm>
              }
            />
            <Route
              path="fidelizacion"
              element={
                <RequirePerm moduleKey="fidelizacion">
                  <Fidelizacion />
                </RequirePerm>
              }
            />
            <Route
              path="reportes"
              element={
                <RequirePerm moduleKey="reportes">
                  <Reportes />
                </RequirePerm>
              }
            />
            <Route
              path="menu"
              element={
                <RequirePerm moduleKey="menu">
                  <Menu />
                </RequirePerm>
              }
            />
            <Route
              path="seguridad"
              element={
                <RequirePerm moduleKey="seguridad">
                  <Seguridad />
                </RequirePerm>
              }
            />
            <Route
              path="perfil"
              element={
                <RequirePerm moduleKey="perfil">
                  <Perfil />
                </RequirePerm>
              }
            />
            <Route path="perfil/cambiar-contrasena" element={<CambioContrasena />} />
            <Route
              path="configuracion"
              element={
                <RequirePerm moduleKey="configuracion">
                  <PaginaEnConstruccion titulo="Configuración" />
                </RequirePerm>
              }
            />
            <Route
              path="configuracion/campanas-correo"
              element={
                <RequirePerm moduleKey="configuracion">
                  <EmailCampaignsPage />
                </RequirePerm>
              }
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Route>

        {/* Rutas protegidas cliente */}
        <Route element={<ClienteRoute />}>
          <Route element={<PublicLayout />}>
            <Route
              path="/cliente/pedidos"
              element={<PaginaEnConstruccion titulo="Mis Pedidos" />}
            />
            <Route
              path="/cliente/perfil"
              element={<PaginaEnConstruccion titulo="Mi Perfil" />}
            />
            <Route
              path="/cliente/checkout"
              element={<PaginaEnConstruccion titulo="Confirmar Pedido" />}
            />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/menu-publico" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
