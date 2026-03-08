import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/auth/Login';
import ForcePasswordChange from './pages/auth/ForcePasswordChange';
import DashboardLayout from './components/layout/DashboardLayout';
import Inicio from './pages/dashboard/Inicio';
import ProtectedRoute from './routes/ProtectedRoute';
import Inventario from './pages/dashboard/Inventario';
import Seguridad from './pages/dashboard/Seguridad';
import Perfil from './pages/dashboard/Perfil';
import Personas from './pages/dashboard/Personas';
import Sucursales from './pages/dashboard/Sucursales';
import Ventas from './pages/dashboard/Ventas';
import Cocina from './pages/dashboard/Cocina';
import Parametros from './pages/dashboard/Parametros'; // Importa la pagina de Parametros/Catalogos.
import Menu from './pages/dashboard/menu/Menu';
import RequirePerm from './routes/RequirePerm';
import { ROUTE_PERMISSIONS } from './utils/permissions';

// Estilos
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
      {/* 1. Ruta Publica */}
      <Route path="/" element={<Login />} />

      {/* 2. RUTAS PROTEGIDAS */}
      <Route element={<ProtectedRoute />}>
        <Route path="/cambiar-password" element={<ForcePasswordChange />} />
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route
            index
            element={
              <RequirePerm anyOf={ROUTE_PERMISSIONS.dashboard}>
                <Inicio />
              </RequirePerm>
            }
          />

          <Route
            path="personas"
            element={
              <RequirePerm anyOf={ROUTE_PERMISSIONS.personas}>
                <Personas />
              </RequirePerm>
            }
          />

          <Route
            path="sucursales"
            element={
              <RequirePerm anyOf={ROUTE_PERMISSIONS.sucursales}>
                <Sucursales />
              </RequirePerm>
            }
          />

          <Route
            path="inventario"
            element={
              <RequirePerm anyOf={ROUTE_PERMISSIONS.inventario}>
                <Inventario />
              </RequirePerm>
            }
          />

          <Route
            path="ventas"
            element={
              <RequirePerm anyOf={ROUTE_PERMISSIONS.ventas}>
                <Ventas />
              </RequirePerm>
            }
          />

          <Route
            path="cocina"
            element={
              <RequirePerm anyOf={ROUTE_PERMISSIONS.cocina}>
                <Cocina />
              </RequirePerm>
            }
          />

          <Route
            path="parametros"
            element={
              <RequirePerm anyOf={ROUTE_PERMISSIONS.parametros}>
                <Parametros />
              </RequirePerm>
            }
          />

          <Route
            path="menu"
            element={
              <RequirePerm anyOf={ROUTE_PERMISSIONS.menu}>
                <Menu />
              </RequirePerm>
            }
          />

          <Route
            path="seguridad"
            element={
              <RequirePerm anyOf={ROUTE_PERMISSIONS.seguridad}>
                <Seguridad />
              </RequirePerm>
            }
          />

          <Route
            path="perfil"
            element={
              <RequirePerm anyOf={ROUTE_PERMISSIONS.perfil}>
                <Perfil />
              </RequirePerm>
            }
          />

          <Route path="configuracion" element={<PaginaEnConstruccion titulo="Configuracion" />} />
        </Route>
      </Route>

      {/* 3. Comodin */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;
