import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import '../../../assets/styles/_menu.scss';
import SinPermiso from '../../../components/common/SinPermiso';
import { usePermisos } from '../../../context/PermisosContext';
import { getAllowedTabs, MODULE_PRIMARY_PERMISSION } from '../../../utils/permissions';
import CombosAdmin from './CombosAdmin';
import MenuPublicacionAdmin from './MenuPublicacionAdmin';
import MenuSalsasAdmin from './MenuSalsasAdmin';
import MenuVistaPreviaAdmin from './MenuVistaPreviaAdmin';
import RecetasAdmin from './RecetasAdmin';

// El tab "productos-menu" se retira por decision operativa.
const MENU_TAB_KEYS = ['recetas', 'combos', 'salsas', 'publicacion', 'vista-previa'];

const Menu = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isSuperAdmin, loading: permisosLoading, permisos } = usePermisos();

  const allowedTabs = useMemo(
    () => getAllowedTabs('menu', permisos, { isSuperAdmin }).map((tab) => tab.key),
    [isSuperAdmin, permisos]
  );

  const fallbackTab = allowedTabs[0] || null;

  const activeTab = useMemo(() => {
    if (!fallbackTab) return null;
    const tabFromQuery = String(searchParams.get('tab') || fallbackTab).toLowerCase();
    const normalizedTab = MENU_TAB_KEYS.includes(tabFromQuery) ? tabFromQuery : fallbackTab;
    return allowedTabs.includes(normalizedTab) ? normalizedTab : fallbackTab;
  }, [allowedTabs, fallbackTab, searchParams]);

  useEffect(() => {
    if (permisosLoading || !activeTab) return;
    const rawTab = String(searchParams.get('tab') || '').toLowerCase();
    if (rawTab === activeTab) return;

    const next = new URLSearchParams(searchParams);
    next.set('tab', activeTab);
    setSearchParams(next, { replace: true });
  }, [activeTab, permisosLoading, searchParams, setSearchParams]);

  const renderView = () => {
    if (activeTab === 'recetas') return <RecetasAdmin />;
    if (activeTab === 'combos') return <CombosAdmin />;
    if (activeTab === 'salsas') return <MenuSalsasAdmin />;
    if (activeTab === 'publicacion') return <MenuPublicacionAdmin showPreview={false} />;
    return <MenuVistaPreviaAdmin />;
  };

  if (permisosLoading) return null;

  if (!activeTab) {
    return (
      <SinPermiso
        permiso={MODULE_PRIMARY_PERMISSION.menu}
        detalle="No tienes acceso a ningun submodulo de Menu."
      />
    );
  }

  return (
    <div className="container-fluid p-3">
      <div className="card shadow-sm mb-3 inv-prod-card menu-module-head">
        <div className="card-header inv-prod-header">
          <div className="inv-prod-title-wrap">
            <div className="inv-prod-title-row">
              <i className="bi bi-grid-1x2-fill inv-prod-title-icon" />
              <span className="inv-prod-title">Menu</span>
            </div>
            {/* Las tabs de Menu ahora viven en la barra superior global para mantener consistencia con Ventas. */}
            <div className="inv-prod-subtitle">
              Administracion de recetas, combos, salsas, publicacion y vista previa.
            </div>
          </div>
        </div>
      </div>

      {renderView()}
    </div>
  );
};

export default Menu;
