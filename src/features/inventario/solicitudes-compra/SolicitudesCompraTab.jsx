import SinPermiso from '../../../components/common/SinPermiso';
import { usePermisos } from '../../../context/PermisosContext';
import { PERMISSIONS } from '../../../utils/permissions';
import useSolicitudesCompra from './hooks/useSolicitudesCompra';
import SolicitudesCompraListado from './components/SolicitudesCompraListado';
import NuevaSolicitudCompra from './components/NuevaSolicitudCompra';
import SolicitudCompraDetalle from './components/SolicitudCompraDetalle';
import './solicitudesCompra.css';

const VIEW_PERMISSIONS = [PERMISSIONS.INVENTARIO_OC_VER_FLUJO, PERMISSIONS.INVENTARIO_OC_VER_DETALLE, PERMISSIONS.INVENTARIO_ORDENES_COMPRA_VER, PERMISSIONS.INVENTARIO_ORDENES_COMPRA_VER_TODAS];
const CREATE_PERMISSIONS = [PERMISSIONS.INVENTARIO_OC_CREAR_SOLICITUD, PERMISSIONS.INVENTARIO_ORDENES_COMPRA_CREAR];

export default function SolicitudesCompraTab({ openToast }) {
  const { canAny, loading } = usePermisos();
  const canView = canAny(VIEW_PERMISSIONS);
  const canCreate = canAny(CREATE_PERMISSIONS);
  const flow = useSolicitudesCompra({ canView, openToast });
  if (loading) return null;
  if (!canView) return <SinPermiso permiso={VIEW_PERMISSIONS.join(' o ')} detalle="No tienes acceso para consultar solicitudes de compra." />;
  if (flow.view === 'nueva') {
    if (!canCreate) return <SinPermiso permiso={CREATE_PERMISSIONS.join(' o ')} detalle="No tienes permiso para crear solicitudes." />;
    return <NuevaSolicitudCompra warehouses={flow.warehouses} warehousesLoading={flow.warehousesLoading} catalogState={flow.catalogState} loadCatalog={flow.loadCatalog} submit={flow.submit} onBack={() => flow.setView('listado')} openToast={openToast} />;
  }
  if (flow.view === 'detalle') return <SolicitudCompraDetalle state={flow.detailState} onBack={() => flow.setView('listado')} onRetry={() => flow.openDetail(flow.detailState.id)} />;
  return <SolicitudesCompraListado state={flow.listState} filter={flow.filter} onFilter={flow.setFilter} onPage={(page) => flow.loadList({ page, estado: flow.filter })} onDetail={flow.openDetail} onCreate={flow.openCreate} canCreate={canCreate} />;
}
