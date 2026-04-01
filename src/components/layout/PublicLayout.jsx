/**
 * PublicLayout.jsx
 * Layout para el mundo público del cliente.
 * Barra superior sencilla con logo, acceso al carrito y botón de login.
 */
import { Outlet, useNavigate } from 'react-router-dom';
import { useCarrito } from '../../hooks/useCarrito';
import { useAuth } from '../../hooks/useAuth';
import logo from '../../assets/images/logo-sin-fondo.png';
import './PublicLayout.scss';

const PublicLayout = () => {
  const navigate = useNavigate();
  const { cantidad } = useCarrito();
  const { user } = useAuth();

  const isCliente = user?.tipo_usuario === 'CLIENTE' || user?.roles?.includes('Cliente');

  return (
    <div className="public-layout">
      {/* NAV BAR */}
      <nav className="public-nav">
        <div className="public-nav__brand" onClick={() => navigate('/menu')} role="button" tabIndex={0}>
          <img src={logo} alt="Jonnys" className="public-nav__logo" />
          <span className="public-nav__brand-name">JONNY'S</span>
        </div>

        <div className="public-nav__actions">
          {/* Carrito */}
          <button
            className="public-nav__cart-btn"
            onClick={() => navigate('/carrito')}
            title="Ver carrito"
          >
            <i className="bi bi-cart3" />
            {cantidad > 0 && <span className="public-nav__badge">{cantidad}</span>}
          </button>

          {/* Si es cliente autenticado */}
          {isCliente ? (
            <button
              className="public-nav__user-btn"
              onClick={() => navigate('/cliente/pedidos')}
              title="Mis pedidos"
            >
              <i className="bi bi-person-circle" />
              <span>Mis pedidos</span>
            </button>
          ) : (
            <button
              className="public-nav__login-btn"
              onClick={() => navigate('/')}
            >
              Iniciar sesión
            </button>
          )}
        </div>
      </nav>

      {/* CONTENIDO */}
      <main className="public-main">
        <Outlet />
      </main>

      {/* FOOTER */}
      <footer className="public-footer">
        <p>© {new Date().getFullYear()} Jonny's SmartOrder — Honduras</p>
      </footer>
    </div>
  );
};

export default PublicLayout;
