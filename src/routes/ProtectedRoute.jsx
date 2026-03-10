import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const MUST_CHANGE_ROUTE = '/cambiar-password';

const ProtectedRoute = () => {
  const { user } = useAuth();
  const location = useLocation();

  const mustChangePassword = Boolean(user?.must_change_password);
  const isMustChangeRoute = location.pathname.startsWith(MUST_CHANGE_ROUTE);

  // Si no hay usuario autenticado, redirigir al Login
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Si el usuario tiene contrasena temporal, bloquear acceso al resto del sistema.
  if (mustChangePassword && !isMustChangeRoute) {
    return <Navigate to={MUST_CHANGE_ROUTE} replace />;
  }

  // Si ya cambio la contrasena, no debe regresar a la vista forzada.
  if (!mustChangePassword && isMustChangeRoute) {
    return <Navigate to="/dashboard" replace />;
  }

  // Si hay usuario, renderizar el contenido de la ruta (DashboardLayout, etc.)
  return <Outlet />;
};

export default ProtectedRoute;
