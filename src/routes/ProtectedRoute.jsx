import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const ProtectedRoute = () => {
  const { user } = useAuth();

  // Si no hay usuario autenticado, redirigir al Login
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Si hay usuario, renderizar el contenido de la ruta (DashboardLayout, etc.)
  return <Outlet />;
};

export default ProtectedRoute;