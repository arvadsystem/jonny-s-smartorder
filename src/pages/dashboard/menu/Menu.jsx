import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import '../../../assets/styles/_menu.scss';
import SinPermiso from '../../../components/common/SinPermiso';
import { usePermisos } from '../../../context/PermisosContext';
import { getAllowedTabs, MODULE_PRIMARY_PERMISSION } from '../../../utils/permissions';
import DepartamentosAdmin from './DepartamentosAdmin';
import ExtrasAdmin from './ExtrasAdmin';
import MenuCarruselAdmin from './MenuCarruselAdmin';
import MenuPublicacionAdmin from './MenuPublicacionAdmin';
import MenuSalsasAdmin from './MenuSalsasAdmin';
import MenuVistaPreviaAdmin from './MenuVistaPreviaAdmin';
import RecetasAdmin from './RecetasAdmin';

// El tab "productos-menu" se retira por decision operativa.
const MENU_TAB_KEYS = ['departamentos', 'recetas', 'extras', 'salsas', 'publicacion', 'carrusel', 'vista-previa'];

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
    if (activeTab === 'departamentos') return <DepartamentosAdmin />;
    if (activeTab === 'recetas') return <RecetasAdmin />;
    if (activeTab === 'extras') return <ExtrasAdmin />;
    if (activeTab === 'salsas') return <MenuSalsasAdmin />;
    if (activeTab === 'publicacion') return <MenuPublicacionAdmin showPreview={false} />;
    if (activeTab === 'carrusel') return <MenuCarruselAdmin />;
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
      {renderView()}
    </div>
  );
};

export default Menu;
