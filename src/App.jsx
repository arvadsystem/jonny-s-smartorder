import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/auth/Login';
import DashboardLayout from './components/layout/DashboardLayout';
import Inicio from './pages/dashboard/Inicio';
import ProtectedRoute from './routes/ProtectedRoute';
import Inventario from './pages/dashboard/Inventario';
import Seguridad from "./pages/dashboard/Seguridad";
import Perfil from "./pages/dashboard/Perfil";
import Personas from './pages/dashboard/Personas';
import Sucursales from './pages/dashboard/Sucursales';
import Parametros from './pages/dashboard/Parametros'; // Importa la pagina de Parametros/Catalogos.
import Menu from './pages/dashboard/menu/Menu';
import RequirePerm from "./routes/RequirePerm";

// Estilos
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

const PaginaEnConstruccion = ({ titulo }) => {
  return (
    <div className="p-5 text-center">
      <h2>{titulo}</h2>
      <p>Próximamente...</p>
    </div>
  );
};

function App() {
  return (
    <Routes>
      {/* 1. Ruta Pública */}
      <Route path="/" element={<Login />} />

      {/* 2. RUTAS PROTEGIDAS */}
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<Inicio />} />
          <Route path="personas" element={<Personas />} />
          <Route path="sucursales" element={<Sucursales />} />
          <Route path="inventario" element={<Inventario />} />
          <Route path="ventas" element={<PaginaEnConstruccion titulo="Ventas" />} />
          <Route path="parametros" element={<Parametros />} />
          
          <Route path="menu" element={<Menu />} />
          
          {/* HU82: proteger la ruta Seguridad por permiso */}
          <Route
            path="seguridad"
            element={
              <RequirePerm perm="SEGURIDAD_VER">
                <Seguridad />
              </RequirePerm>
            }
          />

          <Route path="perfil" element={<Perfil />} />
          <Route path="configuracion" element={<PaginaEnConstruccion titulo="Configuración" />} />
        </Route> {/* Cierra DashboardLayout */}
      </Route> {/* Cierra ProtectedRoute */}

      {/* 3. Comodín */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;