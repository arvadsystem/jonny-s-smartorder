import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/auth/Login';
import Registro from './pages/auth/Registro';
import RecuperarPassword from './pages/auth/RecuperarPassword';
import AuthCallback from './pages/auth/AuthCallback';
import ResetPassword from './pages/auth/ResetPassword';
import ForcePasswordChange from './pages/auth/ForcePasswordChange';
import DashboardLayout from './components/layout/DashboardLayout';
import PublicLayout from './components/layout/PublicLayout';
import Inicio from './pages/dashboard/Inicio';
import ProtectedRoute from './routes/ProtectedRoute';
import ClienteRoute from './routes/ClienteRoute';
import Inventario from './pages/dashboard/Inventario';
import Seguridad from './pages/dashboard/Seguridad';
import Perfil from './pages/dashboard/Perfil';
import CambioContrasena from './pages/dashboard/CambioContrasena';
import Personas from './pages/dashboard/Personas';
import Sucursales from './pages/dashboard/Sucursales';
import Ventas from './pages/dashboard/Ventas';
import Cocina from './pages/dashboard/Cocina';
import Planillas from './pages/dashboard/personas/Planillas';
import Fidelizacion from './pages/dashboard/Fidelizacion';
import Menu from './pages/dashboard/menu/Menu';
import EmailCampaignsPage from './pages/dashboard/configuracion/EmailCampaignsPage';
import RequirePerm from './routes/RequirePerm';
import { PublicMenuRoutes } from './modules/public-menu';
import Carrito from './pages/public/Carrito';

import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

const PaginaEnConstruccion = ({ titulo }) => {
  return (
    <div className="p-5 text-center">
      <h2>{titulo}</h2>
      <p>Proximamente...</p>
    </div>
  );
};

function App() {
  return (
    <Routes>
      {/* ── Rutas de Autenticación ────────────────────────────────────────── */}
      <Route path="/login" element={<Login />} />
      <Route path="/auth/login" element={<Login />} />
      <Route path="/registro" element={<Registro />} />
      <Route path="/recuperar-password" element={<RecuperarPassword />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* ── Inicio y Mundo Público ───────────────────────────────────────── */}
      <Route path="/" element={<Navigate to="/menu-publico" replace />} />
      <Route path="/menu-publico/*" element={<PublicMenuRoutes />} />

      {/* ── Mundo Público (sin auth requerida) ───────────────── */}
      <Route element={<PublicLayout />}>
        
        <Route path="/carrito" element={<Carrito />} />
      </Route>

      {/* ── Rutas protegidas staff ────────────────────────────── */}
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
          <Route path="configuracion/campanas-correo" element={<RequirePerm moduleKey="configuracion"><EmailCampaignsPage /></RequirePerm>} />
        </Route>
      </Route>

      {/* ── Rutas protegidas cliente ──────────────────────────── */}
      <Route element={<ClienteRoute />}>
        <Route element={<PublicLayout />}>
          <Route path="/cliente/pedidos" element={<PaginaEnConstruccion titulo="Mis Pedidos" />} />
          <Route path="/cliente/perfil" element={<PaginaEnConstruccion titulo="Mi Perfil" />} />
          <Route path="/cliente/checkout" element={<PaginaEnConstruccion titulo="Confirmar Pedido" />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/menu-publico" replace />} />
    </Routes>
  );
}

export default App;
