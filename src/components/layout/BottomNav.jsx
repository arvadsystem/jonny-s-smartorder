import React, { useMemo } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { usePermisos } from '../../context/PermisosContext';
import {
  getAllowedTabs,
  getVisibleModuleItems,
  hasAnyPermission,
  PERMISSIONS
} from '../../utils/permissions';

const INVENTARIO_STRONG_ADMIN_PERMISSIONS = [
  PERMISSIONS.INVENTARIO_ORDENES_COMPRA_VER_TODAS,
  PERMISSIONS.INVENTARIO_ORDENES_COMPRA_GESTIONAR,
  PERMISSIONS.INVENTARIO_ORDENES_COMPRA_CONVERTIR,
  PERMISSIONS.INVENTARIO_ORDENES_COMPRA_ABASTECER,
  PERMISSIONS.INVENTARIO_OC_APROBAR,
  PERMISSIONS.INVENTARIO_OC_RECHAZAR,
  PERMISSIONS.INVENTARIO_OC_CONVERTIR_CONTINUAR,
  PERMISSIONS.INVENTARIO_OC_ABASTECER,
  PERMISSIONS.INVENTARIO_CATEGORIAS_CREAR,
  PERMISSIONS.INVENTARIO_CATEGORIAS_EDITAR,
  PERMISSIONS.INVENTARIO_CATEGORIAS_INSUMOS_CREAR,
  PERMISSIONS.INVENTARIO_CATEGORIAS_INSUMOS_EDITAR,
  PERMISSIONS.INVENTARIO_INSUMOS_CREAR,
  PERMISSIONS.INVENTARIO_INSUMOS_EDITAR,
  PERMISSIONS.INVENTARIO_PRODUCTOS_CREAR,
  PERMISSIONS.INVENTARIO_PRODUCTOS_EDITAR,
  PERMISSIONS.INVENTARIO_ALMACENES_CREAR,
  PERMISSIONS.INVENTARIO_ALMACENES_EDITAR,
  PERMISSIONS.INVENTARIO_PROVEEDORES_CREAR,
  PERMISSIONS.INVENTARIO_PROVEEDORES_EDITAR,
  PERMISSIONS.INVENTARIO_MOBILIARIO_CREAR,
  PERMISSIONS.INVENTARIO_MOBILIARIO_EDITAR
];

const INVENTARIO_OPERATIONAL_PERMISSIONS = [
  PERMISSIONS.INVENTARIO_ORDENES_COMPRA_VER,
  PERMISSIONS.INVENTARIO_ORDENES_COMPRA_CREAR,
  PERMISSIONS.INVENTARIO_ORDENES_COMPRA_RECEPCIONAR,
  PERMISSIONS.INVENTARIO_OC_VER_FLUJO,
  PERMISSIONS.INVENTARIO_OC_VER_DETALLE,
  PERMISSIONS.INVENTARIO_OC_CREAR_SOLICITUD,
  PERMISSIONS.INVENTARIO_OC_EDITAR_SOLICITUD,
  PERMISSIONS.INVENTARIO_OC_RECEPCIONAR
];

const BOTTOM_NAV_LABELS = Object.freeze({
  personas: 'Personas',
  planillas: 'Planillas'
});

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isSuperAdmin, loading, permisos } = usePermisos();

  const isInInventario = location.pathname.startsWith('/dashboard/inventario');
  const currentTab = String(new URLSearchParams(location.search || '').get('tab') || '').toLowerCase();

  const hasStrongInventoryAdmin = hasAnyPermission(permisos, INVENTARIO_STRONG_ADMIN_PERMISSIONS, { isSuperAdmin });
  const isOperationalInventoryActor =
    !isSuperAdmin
    && hasAnyPermission(permisos, INVENTARIO_OPERATIONAL_PERMISSIONS, { isSuperAdmin })
    && !hasStrongInventoryAdmin;

  const visibleMenuItems = useMemo(
    () =>
      getVisibleModuleItems(permisos, { isSuperAdmin }).filter(
        (item) => item.key !== 'configuracion'
      ),
    [isSuperAdmin, permisos]
  );

  const visibleInventarioOptions = useMemo(
    () => {
      const tabs = getAllowedTabs('inventario', permisos, { isSuperAdmin });
      if (!isOperationalInventoryActor) return tabs;
      return tabs.filter((tab) => String(tab?.key || '').toLowerCase() === 'ordenes_compra');
    },
    [isOperationalInventoryActor, isSuperAdmin, permisos]
  );

  const goInventario = (tab) => {
    navigate(`/dashboard/inventario?tab=${tab}`);
  };

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

  const resolveBottomNavLabel = (item) => {
    const key = String(item?.key || '').trim().toLowerCase();
    return BOTTOM_NAV_LABELS[key] || item?.name || '';
  };

  return (
    <div className="bottom-nav">
      <div className="bottom-nav-scroll">
        {!loading &&
          visibleMenuItems.map((item) => {
            if (item.key === 'inventario') {
              return (
                <button
                  key={item.path}
                  type="button"
                  className={`bottom-nav-item ${isInInventario ? 'active' : ''}`}
                  onClick={() => {
                    const targetTab = visibleInventarioOptions[0]?.key || 'categorias';
                    goInventario(targetTab);
                  }}
                  title={item.name}
                >
                  <i className={`bi ${item.icon}`} />
                  <span>{resolveBottomNavLabel(item)}</span>
                </button>
              );
            }

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/dashboard'}
                className={({ isActive }) => `bottom-nav-item ${resolveIsActive(item, isActive) ? 'active' : ''}`}
                title={item.name}
              >
                <i className={`bi ${item.icon}`} />
                <span>{resolveBottomNavLabel(item)}</span>
              </NavLink>
            );
          })}
      </div>
    </div>
  );
};

export default BottomNav;
