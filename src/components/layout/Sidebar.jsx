import { NavLink, useLocation } from 'react-router-dom';
import logo from '../../assets/images/sinFondo.jpeg';
import { usePermisos } from '../../context/PermisosContext';
import { getVisibleModuleItems } from '../../utils/permissions';

const Sidebar = ({ isCollapsed, toggleSidebar }) => {
  const location = useLocation();
  const { isSuperAdmin, loading, permisos } = usePermisos();
  const visibleItems = getVisibleModuleItems(permisos, { isSuperAdmin });
  const sidebarItems = visibleItems.filter((item) => item.path !== '/dashboard/configuracion');
  const currentTab = String(new URLSearchParams(location.search || '').get('tab') || '').toLowerCase();
  const GROUPS = [
    { key: 'operacion', label: 'Operacion', itemKeys: ['dashboard', 'ventas', 'cierres-caja', 'cocina'] },
    { key: 'inventario', label: 'Inventario', itemKeys: ['inventario', 'sucursales', 'menu'] },
    { key: 'gestion', label: 'Gestion', itemKeys: ['personas', 'planillas', 'fidelizacion', 'reportes'] },
    { key: 'sistema', label: 'Sistema', itemKeys: ['seguridad', 'configuracion'] }
  ];

  const resolveIsActive = (item, isActive) => {
    if (item.key === 'planillas') {
      return location.pathname === '/dashboard/planillas'
        || (location.pathname === '/dashboard/personas' && currentTab === 'planillas');
    }

    if (item.key === 'personas' && location.pathname === '/dashboard/personas' && currentTab === 'planillas') {
      return false;
    }

    return isActive;
  };

  const renderLink = (item) => (
    <NavLink
      key={item.path}
      to={item.path}
      end={item.path === '/dashboard'}
      className={({ isActive }) => `menu-item ${resolveIsActive(item, isActive) ? 'active' : ''}`}
      title={isCollapsed ? item.name : undefined}
    >
      <span className="menu-item-icon" aria-hidden="true">
        <i className={`bi ${item.icon}`} />
      </span>
      <span className="menu-item-label">{item.name}</span>
    </NavLink>
  );

  const groupedItems = (() => {
    const grouped = GROUPS.map((group) => ({
      ...group,
      items: sidebarItems.filter((item) => group.itemKeys.includes(item.key))
    })).filter((group) => group.items.length > 0);

    const groupedKeys = new Set(grouped.flatMap((group) => group.items.map((item) => item.key)));
    const otherItems = sidebarItems.filter((item) => !groupedKeys.has(item.key));

    if (otherItems.length > 0) {
      grouped.push({ key: 'otros', label: 'Otros', itemKeys: [], items: otherItems });
    }

    return grouped;
  })();

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
            aria-expanded={!isCollapsed}
            aria-controls="sidebar-menu-principal"
          >
            <i className={`bi ${isCollapsed ? 'bi-chevron-right' : 'bi-chevron-left'}`} />
          </button>
        </div>

        <nav id="sidebar-menu-principal" className="sidebar-menu" aria-label="Modulos del sistema">
          {loading
            ? null
            : groupedItems.map((group) => (
              <section key={group.key} className="menu-group" aria-label={`Grupo ${group.label}`}>
                <div className="menu-group-title">{group.label}</div>
                <div className="menu-group-items">{group.items.map((item) => renderLink(item))}</div>
              </section>
            ))}
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;
