import SinPermiso from '../../../components/common/SinPermiso';
import { usePermisos } from '../../../context/PermisosContext';
import { PERMISSIONS } from '../../../utils/permissions';
import useSolicitudesCompra from './hooks/useSolicitudesCompra';
import SolicitudesCompraListado from './components/SolicitudesCompraListado';
import NuevaSolicitudCompra from './components/NuevaSolicitudCompra';
import SolicitudCompraDetalle from './components/SolicitudCompraDetalle';
import CapturasCompraRapidaOperativa from './components/CapturasCompraRapidaOperativa';
import CapturasCompraRapidaAdmin from './components/CapturasCompraRapidaAdmin';
import './solicitudesCompra.css';

const VIEW_PERMISSIONS = [PERMISSIONS.INVENTARIO_OC_VER_FLUJO, PERMISSIONS.INVENTARIO_OC_VER_DETALLE, PERMISSIONS.INVENTARIO_OC_VER_EVIDENCIAS, PERMISSIONS.INVENTARIO_OC_RECEPCIONAR, PERMISSIONS.INVENTARIO_ORDENES_COMPRA_VER, PERMISSIONS.INVENTARIO_ORDENES_COMPRA_VER_TODAS, PERMISSIONS.INVENTARIO_ORDENES_COMPRA_RECEPCIONAR];
const CREATE_PERMISSIONS = [PERMISSIONS.INVENTARIO_OC_CREAR_SOLICITUD, PERMISSIONS.INVENTARIO_ORDENES_COMPRA_CREAR];
const APPROVE_PERMISSIONS = [PERMISSIONS.INVENTARIO_OC_APROBAR, PERMISSIONS.INVENTARIO_ORDENES_COMPRA_GESTIONAR];
const REJECT_PERMISSIONS = [PERMISSIONS.INVENTARIO_OC_RECHAZAR, PERMISSIONS.INVENTARIO_ORDENES_COMPRA_GESTIONAR];
const RECEIVE_PERMISSIONS = [PERMISSIONS.INVENTARIO_OC_RECEPCIONAR, PERMISSIONS.INVENTARIO_ORDENES_COMPRA_RECEPCIONAR];
const EVIDENCE_PERMISSIONS = [PERMISSIONS.INVENTARIO_OC_VER_EVIDENCIAS, PERMISSIONS.INVENTARIO_OC_VER_DETALLE, PERMISSIONS.INVENTARIO_OC_VER_FLUJO, PERMISSIONS.INVENTARIO_ORDENES_COMPRA_VER, PERMISSIONS.INVENTARIO_ORDENES_COMPRA_VER_TODAS, PERMISSIONS.INVENTARIO_OC_RECEPCIONAR, PERMISSIONS.INVENTARIO_ORDENES_COMPRA_RECEPCIONAR];

export default function SolicitudesCompraTab({ openToast }) {
  const { canAny, loading } = usePermisos();
  const canView = canAny(VIEW_PERMISSIONS);
  const canCreate = canAny(CREATE_PERMISSIONS);
  const canApprove = canAny(APPROVE_PERMISSIONS);
  const canReject = canAny(REJECT_PERMISSIONS);
  const canReceive = canAny(RECEIVE_PERMISSIONS);
  const canViewEvidence = canAny(EVIDENCE_PERMISSIONS);
  const canQuickCaptureCreate = canAny([PERMISSIONS.INVENTARIO_OC_CAPTURA_RAPIDA_CREAR]);
  const canQuickCaptureView = canAny([PERMISSIONS.INVENTARIO_OC_CAPTURA_RAPIDA_VER]);
  const canQuickCaptureManage = canAny([PERMISSIONS.INVENTARIO_OC_CAPTURA_RAPIDA_GESTIONAR]);
  const flow = useSolicitudesCompra({ canView, openToast });
  if (loading) return null;
  if (!canView) return <SinPermiso permiso={VIEW_PERMISSIONS.join(' o ')} detalle="No tienes acceso para consultar solicitudes de compra." />;
  if (flow.view === 'nueva') {
    if (!canCreate) return <SinPermiso permiso={CREATE_PERMISSIONS.join(' o ')} detalle="No tienes permiso para crear solicitudes." />;
    return <NuevaSolicitudCompra warehouses={flow.warehouses} warehousesLoading={flow.warehousesLoading} catalogState={flow.catalogState} loadCatalog={flow.loadCatalog} submit={flow.submit} onBack={() => flow.setView('listado')} openToast={openToast} />;
  }
  if (flow.view === 'captura-rapida') {
    if (!canQuickCaptureCreate || !canQuickCaptureView) return <SinPermiso permiso={PERMISSIONS.INVENTARIO_OC_CAPTURA_RAPIDA_CREAR} detalle="No tienes permiso para operar capturas rápidas." />;
    return <CapturasCompraRapidaOperativa onBack={() => flow.setView('listado')} openToast={openToast} />;
  }
  if (flow.view === 'capturas-rapidas-admin') {
    if (!canQuickCaptureView || !canQuickCaptureManage) return <SinPermiso permiso={PERMISSIONS.INVENTARIO_OC_CAPTURA_RAPIDA_GESTIONAR} detalle="No tienes permiso para gestionar capturas rápidas." />;
    return <CapturasCompraRapidaAdmin onBack={() => flow.setView('listado')} openToast={openToast} />;
  }
  if (flow.view === 'detalle') return <SolicitudCompraDetalle state={flow.detailState} onBack={() => flow.setView('listado')} onRetry={() => flow.openDetail(flow.detailState.id)} reloadDetail={() => flow.openDetail(flow.detailState.id)} reloadList={() => flow.loadList({ page: Number(flow.listState.pagination?.page || 1), estado: flow.filter, buscar: flow.search })} canApprove={canApprove} canReject={canReject} canReceive={canReceive} canViewEvidence={canViewEvidence} openToast={openToast} />;
  return <SolicitudesCompraListado state={flow.listState} filter={flow.filter} onFilter={flow.setFilter} search={flow.search} onSearch={flow.setSearch} onClearSearch={flow.clearSearch} onPage={(page) => flow.loadList({ page, estado: flow.filter, buscar: flow.search })} onDetail={flow.openDetail} onCreate={flow.openCreate} onQuickCapture={() => flow.setView('captura-rapida')} onQuickCaptureAdmin={() => flow.setView('capturas-rapidas-admin')} onRefresh={() => flow.loadList({ page: Number(flow.listState.pagination?.page || 1), estado: flow.filter, buscar: flow.search })} openToast={openToast} canCreate={canCreate} canQuickCaptureCreate={canQuickCaptureCreate} canQuickCaptureAdmin={canQuickCaptureView && canQuickCaptureManage} canReview={canApprove || canReject} canReject={canReject} canReceive={canReceive} />;
}
