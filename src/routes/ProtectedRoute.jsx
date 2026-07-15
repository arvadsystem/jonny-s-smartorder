import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import GlobalInactivityGuard from '../components/auth/GlobalInactivityGuard';

const MUST_CHANGE_ROUTE = '/dashboard/perfil/cambiar-contrasena';

const ReconnectSessionScreen = ({ message, onRetry }) => (
  <div
    style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      background: '#f8f9fa',
      color: '#212529',
      padding: 24
    }}
  >
    <div
      style={{
        width: '100%',
        maxWidth: 480,
        background: '#fff',
        border: '1px solid #e9ecef',
        borderRadius: 12,
        padding: 24,
        boxShadow: '0 8px 28px rgba(0,0,0,0.06)',
        textAlign: 'center'
      }}
    >
      <h2 style={{ margin: 0, fontSize: 22 }}>No se pudo validar la sesion</h2>
      <p style={{ margin: '12px 0 16px', color: '#495057' }}>
        {message || 'Hay un problema temporal de conexion con el servidor.'}
      </p>
      <button
        type="button"
        className="btn btn-primary"
        onClick={onRetry}
      >
        Reintentar
      </button>
    </div>
  </div>
);

const ProtectedRoute = () => {
  const { user, bootstrapState, bootstrapError, retryBootstrap } = useAuth();
  const location = useLocation();

  const mustChangePassword = Boolean(user?.must_change_password);
  const isMustChangeRoute = location.pathname.startsWith(MUST_CHANGE_ROUTE);
  const isDashboardRoute = location.pathname.startsWith('/dashboard');
  const isReconnecting = bootstrapState === 'reconnecting';

  if (!user && isDashboardRoute && isReconnecting) {
    return <ReconnectSessionScreen message={bootstrapError} onRetry={retryBootstrap} />;
  }

  // If user is not authenticated and not in reconnect flow, go to login.
  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  if (mustChangePassword && !isMustChangeRoute) {
    return <Navigate to={MUST_CHANGE_ROUTE} replace />;
  }

  if (!mustChangePassword && isMustChangeRoute) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <>
      <GlobalInactivityGuard />
      <Outlet />
    </>
  );
};

export default ProtectedRoute;

