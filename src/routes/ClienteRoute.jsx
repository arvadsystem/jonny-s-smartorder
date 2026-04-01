/**
 * ClienteRoute.jsx
 * Protege las rutas que requieren que el usuario sea un Cliente autenticado.
 * Si no está autenticado, redirige al login.
 * Si está autenticado pero es empleado/admin, redirige al dashboard.
 */
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const ClienteRoute = () => {
  const { user, bootstrapState } = useAuth();

  // Mientras carga la sesión, no redirigir aún
  if (bootstrapState === 'checking') return null;

  // No autenticado → ir al login
  if (!user) return <Navigate to="/" replace />;

  const isCliente = user.tipo_usuario === 'CLIENTE' || user.roles?.includes('Cliente');

  // Si es empleado/admin, lo mandamos al dashboard
  if (!isCliente) return <Navigate to="/dashboard" replace />;

  return <Outlet />;
};

export default ClienteRoute;
