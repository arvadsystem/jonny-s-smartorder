import SolicitudCompraEstado from './SolicitudCompraEstado';
import SolicitudCompraRevisionPanel from './SolicitudCompraRevisionPanel';
import SolicitudCompraRecepcionPanel from './SolicitudCompraRecepcionPanel';
import SolicitudCompraEvidencias from './SolicitudCompraEvidencias';
import { formatDateTime } from '../utils/solicitudesCompraUtils';

const value = (raw) => raw === null || raw === undefined ? '—' : raw;

const TraceItem = ({ icon, label, children }) => (
  <span><i className={`bi ${icon}`} aria-hidden="true" /><small>{label}</small><b>{children}</b></span>
);

export default function SolicitudCompraDetalle({ state, onBack, onRetry, reloadDetail, reloadList, canApprove, canReject, canReceive, canViewEvidence, openToast }) {
  if (state.loading) return <div className="sol-comp-feedback" aria-live="polite"><span className="spinner-border spinner-border-sm" /> Cargando detalle…</div>;
  if (state.error) return <div className="sol-comp-feedback sol-comp-feedback--error"><span>{state.error}</span><button type="button" className="btn btn-outline-danger btn-sm" onClick={onRetry}>Reintentar</button><button type="button" className="btn btn-link btn-sm" onClick={onBack}>Volver</button></div>;
  const payload = state.data || {};
  const request = payload.solicitud || {};
  const details = Array.isArray(payload.detalles) ? payload.detalles : [];
  return (
    <section className="sol-comp-section">
      <button type="button" className="sol-comp-back" onClick={onBack}><i className="bi bi-arrow-left" aria-hidden="true" /> Volver a solicitudes</button>
      <header className="sol-comp-detail-header">
        <div className="sol-comp-detail-header__main">
          <span className="sol-comp-header__icon" aria-hidden="true"><i className="bi bi-receipt-cutoff" /></span>
          <div><small>Detalle de abastecimiento</small><h2>Solicitud #{request.id_solicitud_compra}</h2><p>Consulta cantidades, responsables y avance de la solicitud.</p></div>
        </div>
        <SolicitudCompraEstado estado={request.estado} showMessage />
      </header>
      <div className="sol-comp-detail-primary">
        <TraceItem icon="bi-shop" label="Sucursal">{request.sucursal?.nombre || '—'}</TraceItem>
        <TraceItem icon="bi-building" label="Almacén">{request.almacen?.nombre || '—'}</TraceItem>
        <TraceItem icon="bi-person" label="Solicitante">{request.solicitante?.nombre || '—'}</TraceItem>
        <TraceItem icon="bi-calendar3" label="Creación">{formatDateTime(request.fecha_creacion)}</TraceItem>
      </div>
      <section className="sol-comp-trace" aria-labelledby="sol-comp-trace-title">
        <div className="sol-comp-panel-heading"><span aria-hidden="true"><i className="bi bi-clock-history" /></span><div><h3 id="sol-comp-trace-title">Trazabilidad</h3><p>Responsables y registros disponibles hasta este momento.</p></div></div>
        <div className="sol-comp-detail-meta">
          <TraceItem icon="bi-person-check" label="Revisor">{request.revisor?.nombre || '—'}</TraceItem>
          <TraceItem icon="bi-calendar-check" label="Revisión">{formatDateTime(request.fecha_revision)}</TraceItem>
          <TraceItem icon="bi-person-down" label="Receptor">{request.receptor?.nombre || '—'}</TraceItem>
          <TraceItem icon="bi-calendar2-check" label="Recepción">{formatDateTime(request.fecha_recepcion)}</TraceItem>
          <TraceItem icon="bi-box-arrow-in-down" label="Inventario">{request.inventario_aplicado ? 'Aplicado' : 'No aplicado'}</TraceItem>
          <TraceItem icon="bi-paperclip" label="Evidencia">{request.tiene_evidencia ? 'Registrada' : 'Sin evidencia'}</TraceItem>
        </div>
      </section>
      <div className="sol-comp-notes">
        {request.observacion_solicitud ? <div className="sol-comp-note"><i className="bi bi-chat-left-text" aria-hidden="true" /><div><strong>Observación de solicitud</strong><p>{request.observacion_solicitud}</p></div></div> : null}
        {request.comentario_revision ? <div className="sol-comp-note"><i className="bi bi-shield-check" aria-hidden="true" /><div><strong>Comentario de Administración</strong><p>{request.comentario_revision}</p></div></div> : null}
        {request.observacion_recepcion ? <div className="sol-comp-note"><i className="bi bi-box2-heart" aria-hidden="true" /><div><strong>Observación de recepción</strong><p>{request.observacion_recepcion}</p></div></div> : null}
      </div>
      <div className="sol-comp-panel-heading sol-comp-lines-heading"><span aria-hidden="true"><i className="bi bi-list-check" /></span><div><h3>Artículos solicitados</h3><p>{details.length} {details.length === 1 ? 'línea registrada' : 'líneas registradas'}.</p></div></div>
      <div className="sol-comp-detail-lines">{details.map((line) => (
        <article key={line.id_solicitud_detalle ?? 'invalid-contract-detail'}>
          <div className="sol-comp-card-top"><div className="sol-comp-line-title"><span aria-hidden="true"><i className={`bi ${line.tipo_item === 'PRODUCTO' ? 'bi-box-seam' : 'bi-basket'}`} /></span><strong>{line.nombre}</strong></div><span className="sol-comp-type-pill">{line.tipo_item === 'PRODUCTO' ? 'Producto' : 'Insumo'}</span></div>
          <p>{line.categoria || 'Sin categoría'} · {line.presentacion_snapshot || line.unidad_base || 'Unidad'}</p>
          <div className="sol-comp-quantity-groups">
            <div><small>Solicitado</small><span>{value(line.cantidad_solicitada)}</span><em>Base: {value(line.cantidad_base_solicitada)}</em></div>
            <div><small>Aprobado</small><span>{value(line.cantidad_aprobada)}</span><em>Base: {value(line.cantidad_base_aprobada)}</em></div>
            <div><small>Recibido</small><span>{value(line.cantidad_recibida)}</span><em>Base: {value(line.cantidad_base_recibida)}</em></div>
          </div>
          <div className="sol-comp-counts"><span>Stock: {value(line.stock_actual)}</span><span>Mínimo: {value(line.stock_minimo)}</span><span>{line.estado_stock || '—'}</span><span>Proveedor: {line.proveedor?.nombre_proveedor || '—'}</span></div>
        </article>
      ))}</div>
      {String(request.estado || '').toUpperCase() === 'PENDIENTE' && (canApprove || canReject) ? (
        <SolicitudCompraRevisionPanel key={request.id_solicitud_compra} solicitud={request} detalles={details} canApprove={canApprove} canReject={canReject} reloadDetail={reloadDetail} reloadList={reloadList} openToast={openToast} />
      ) : null}
      {String(request.estado || '').toUpperCase() === 'APROBADA' && canReceive ? (
        <SolicitudCompraRecepcionPanel key={request.id_solicitud_compra} solicitud={request} detalles={details} canReceive={canReceive} reloadDetail={reloadDetail} reloadList={reloadList} openToast={openToast} />
      ) : null}
      {request.tiene_evidencia && canViewEvidence ? <div className="sol-comp-evidence-access"><SolicitudCompraEvidencias key={request.id_solicitud_compra} idSolicitud={request.id_solicitud_compra} /></div> : null}
    </section>
  );
}
