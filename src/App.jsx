import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/auth/Login';
import DashboardLayout from './components/layout/DashboardLayout';
import Inicio from './pages/dashboard/Inicio';

// Estilos de Bootstrap
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

// --- COMPONENTE TEMPORAL ---
// Esto servirá para que veas que la navegación funciona sin crear archivos todavía.
// Más adelante reemplazarás esto con: import Sucursales from './pages/Sucursales';
const PaginaEnConstruccion = ({ titulo }) => {
  return (
    <div className="p-5">
      <h2 className="fw-bold text-dark">{titulo}</h2>
      <p className="text-muted">Esta sección está lista para desarrollarse.</p>
      <div className="p-5 border border-dashed rounded bg-white text-center text-muted">
        <i className="bi bi-cone-striped fs-1 d-block mb-3"></i>
        Contenido de {titulo} aquí...
      </div>
    </div>
  );
};

function App() {
  return (
    <Routes>
      {/* 1. Ruta Pública: Login */}
      <Route path="/" element={<Login />} />

      {/* 2. Rutas Privadas: Dashboard (Layout con Sidebar) */}
      <Route path="/dashboard" element={<DashboardLayout />}>
        
        {/* Pantalla principal (Bienvenida) */}
        <Route index element={<Inicio />} />

        {/* --- NUEVAS RUTAS DEL MENÚ --- */}
        {/* Al definir estas rutas, React Router ya no te mandará al Login */}
        <Route path="sucursales" element={<PaginaEnConstruccion titulo="Gestión de Sucursales" />} />
        <Route path="personas" element={<PaginaEnConstruccion titulo="Personas y Empresas" />} />
        <Route path="inventario" element={<PaginaEnConstruccion titulo="Control de Inventario" />} />
        <Route path="ventas" element={<PaginaEnConstruccion titulo="Punto de Ventas" />} />
        <Route path="menu" element={<PaginaEnConstruccion titulo="Gestión del Menú" />} />
        <Route path="seguridad" element={<PaginaEnConstruccion titulo="Seguridad y Accesos" />} />
        <Route path="configuracion" element={<PaginaEnConstruccion titulo="Configuración del Sistema" />} />

      </Route>

      {/* 3. Comodín: Cualquier ruta desconocida redirige al Login */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;