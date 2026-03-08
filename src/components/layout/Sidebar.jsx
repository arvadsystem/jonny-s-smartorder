import { NavLink } from 'react-router-dom';
import logo from '../../assets/images/sinFondo.jpeg';
import { usePermisos } from '../../context/PermisosContext';
import { NAV_ITEM_PERMISSIONS } from '../../utils/permissions';

const MENU_ITEMS = [
  { name: 'Dashboard', path: '/dashboard', icon: 'bi-grid-1x2' },
  { name: 'Sucursales', path: '/dashboard/sucursales', icon: 'bi-shop' },
  { name: 'Personas/Empresas', path: '/dashboard/personas', icon: 'bi-people' },
  { name: 'Inventario', path: '/dashboard/inventario', icon: 'bi-box-seam' },
  { name: 'Ventas', path: '/dashboard/ventas', icon: 'bi-cart3' },
  { name: 'Cocina', path: '/dashboard/cocina', icon: 'bi-display' },
  { name: 'Menu', path: '/dashboard/menu', icon: 'bi-journal-text' },
  { name: 'Seguridad', path: '/dashboard/seguridad', icon: 'bi-shield-lock' },
  { name: 'Parametros', path: '/dashboard/parametros', icon: 'bi-sliders' },
  { name: 'Configuracion', path: '/dashboard/configuracion', icon: 'bi-gear' }
];

const Sidebar = ({ isCollapsed, toggleSidebar }) => {
  const { canAny, loading } = usePermisos();

  const visibleItems = MENU_ITEMS.filter((item) => {
    const required = NAV_ITEM_PERMISSIONS[item.path];
    if (!required || required.length === 0) return true;
    return canAny(required);
  });

  const renderLink = (item) => (
    <NavLink
      key={item.path}
      to={item.path}
      end={item.path === '/dashboard'}
      className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
      title={isCollapsed ? item.name : undefined}
    >
      <span className="menu-item-icon" aria-hidden="true">
        <i className={`bi ${item.icon}`} />
      </span>
      <span className="menu-item-label">{item.name}</span>
    </NavLink>
  );

  return (
    <aside className={`sidebar-wrapper ${isCollapsed ? 'collapsed' : ''}`} aria-label="Navegacion principal">
      <div className="sidebar-panel">
        <div className="sidebar-header">
          <NavLink className="brand" to="/dashboard" title="Jonny's Smart">
            <img className="brand-logo" src={logo} alt="Jonny's Smart" />
            <div className="brand-copy">
              <h4>Jonny's Smart</h4>
              <p>Sistema de gestion</p>
            </div>
          </NavLink>

          <button
            type="button"
            className="collapse-btn"
            onClick={toggleSidebar}
            aria-label={isCollapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
          >
            <i className={`bi ${isCollapsed ? 'bi-chevron-right' : 'bi-chevron-left'}`} />
          </button>
        </div>

        <nav className="sidebar-menu" aria-label="Modulos del sistema">
          {loading ? null : visibleItems.map((item) => renderLink(item))}
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;
