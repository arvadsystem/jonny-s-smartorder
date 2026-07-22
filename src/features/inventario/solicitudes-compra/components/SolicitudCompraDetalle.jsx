import SolicitudCompraEstado from './SolicitudCompraEstado';
import SolicitudCompraRevisionPanel from './SolicitudCompraRevisionPanel';
import { formatDateTime } from '../utils/solicitudesCompraUtils';

const value = (raw) => raw === null || raw === undefined ? '—' : raw;

export default function SolicitudCompraDetalle({ state, onBack, onRetry, reloadDetail, reloadList, canApprove, canReject, openToast }) {
  if (state.loading) return <div className="sol-comp-feedback" aria-live="polite">Cargando detalle…</div>;
  if (state.error) return <div className="sol-comp-feedback sol-comp-feedback--error"><span>{state.error}</span><button type="button" className="btn btn-outline-danger btn-sm" onClick={onRetry}>Reintentar</button><button type="button" className="btn btn-link btn-sm" onClick={onBack}>Volver</button></div>;
  const payload = state.data || {};
  const request = payload.solicitud || {};
  const details = Array.isArray(payload.detalles) ? payload.detalles : [];
  return (
    <section className="sol-comp-section">
      <button type="button" className="sol-comp-back" onClick={onBack}><i className="bi bi-arrow-left" /> Volver</button>
      <header className="sol-comp-detail-header"><div><h2>Solicitud #{request.id_solicitud_compra}</h2><SolicitudCompraEstado estado={request.estado} showMessage /></div></header>
      <div className="sol-comp-detail-meta">
        <span><small>Sucursal</small>{request.sucursal?.nombre || '—'}</span><span><small>Almacén</small>{request.almacen?.nombre || '—'}</span>
        <span><small>Solicitante</small>{request.solicitante?.nombre || '—'}</span><span><small>Creación</small>{formatDateTime(request.fecha_creacion)}</span>
        <span><small>Revisor</small>{request.revisor?.nombre || '—'}</span><span><small>Revisión</small>{formatDateTime(request.fecha_revision)}</span>
        <span><small>Receptor</small>{request.receptor?.nombre || '—'}</span><span><small>Recepción</small>{formatDateTime(request.fecha_recepcion)}</span>
        <span><small>Inventario</small>{request.inventario_aplicado ? 'Aplicado' : 'No aplicado'}</span><span><small>Evidencia</small>{request.tiene_evidencia ? 'Registrada' : 'Sin evidencia'}</span>
      </div>
      {request.observacion_solicitud ? <div className="sol-comp-note"><strong>Observación de solicitud</strong><p>{request.observacion_solicitud}</p></div> : null}
      {request.comentario_revision ? <div className="sol-comp-note"><strong>Comentario de Administración</strong><p>{request.comentario_revision}</p></div> : null}
      <div className="sol-comp-detail-lines">{details.map((line) => (
        <article key={line.id_solicitud_detalle ?? 'invalid-contract-detail'}>
          <div className="sol-comp-card-top"><strong>{line.nombre}</strong><span>{line.tipo_item === 'PRODUCTO' ? 'Producto' : 'Insumo'}</span></div>
          <p>{line.categoria || 'Sin categoría'} · {line.presentacion_snapshot || line.unidad_base || 'Unidad'}</p>
          <div className="sol-comp-quantities"><span>Solicitada <b>{value(line.cantidad_solicitada)}</b></span><span>Base solicitada <b>{value(line.cantidad_base_solicitada)}</b></span><span>Aprobada <b>{value(line.cantidad_aprobada)}</b></span><span>Base aprobada <b>{value(line.cantidad_base_aprobada)}</b></span><span>Recibida <b>{value(line.cantidad_recibida)}</b></span><span>Base recibida <b>{value(line.cantidad_base_recibida)}</b></span></div>
          <div className="sol-comp-counts"><span>Stock: {value(line.stock_actual)}</span><span>Mínimo: {value(line.stock_minimo)}</span><span>{line.estado_stock || '—'}</span>{line.proveedor?.nombre_proveedor ? <span>Proveedor: {line.proveedor.nombre_proveedor}</span> : null}</div>
        </article>
      ))}</div>
      {String(request.estado || '').toUpperCase() === 'PENDIENTE' && (canApprove || canReject) ? (
        <SolicitudCompraRevisionPanel
          key={request.id_solicitud_compra}
          solicitud={request}
          detalles={details}
          canApprove={canApprove}
          canReject={canReject}
          reloadDetail={reloadDetail}
          reloadList={reloadList}
          openToast={openToast}
        />
      ) : null}
    </section>
  );
}
