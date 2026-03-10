import { NavLink } from 'react-router-dom';
import logo from '../../assets/images/sinFondo.jpeg';
import { usePermisos } from '../../context/PermisosContext';
import { getVisibleModuleItems } from '../../utils/permissions';

const Sidebar = ({ isCollapsed, toggleSidebar }) => {
  const { isSuperAdmin, loading, permisos } = usePermisos();
  const visibleItems = getVisibleModuleItems(permisos, { isSuperAdmin });

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