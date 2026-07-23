import SolicitudCompraEstado from './SolicitudCompraEstado';
import SolicitudCompraRevisionPanel from './SolicitudCompraRevisionPanel';
import SolicitudCompraRecepcionPanel from './SolicitudCompraRecepcionPanel';
import SolicitudCompraEvidencias from './SolicitudCompraEvidencias';
import { formatDateTime } from '../utils/solicitudesCompraUtils';

const value = (raw) => raw === null || raw === undefined ? '—' : raw;
const baseValue = (raw, unit) => raw === null || raw === undefined ? '—' : `${raw}${unit ? ` ${unit}` : ''}`;
const STOCK_LABELS = { SIN_STOCK: 'Sin stock', STOCK_BAJO: 'Stock bajo', DISPONIBLE: 'Disponible' };

const TraceItem = ({ icon, label, children, tone = 'neutral' }) => (
  <span className={`sol-comp-trace-item sol-comp-trace-item--${tone}`}><i className={`bi ${icon}`} aria-hidden="true" /><small>{label}</small><b>{children}</b></span>
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
        <div className="sol-comp-detail-header__status"><SolicitudCompraEstado estado={request.estado} showMessage /></div>
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
          <TraceItem icon={request.inventario_aplicado ? 'bi-check-circle' : 'bi-circle'} label="Inventario" tone={request.inventario_aplicado ? 'positive' : 'neutral'}>{request.inventario_aplicado ? 'Aplicado' : 'No aplicado'}</TraceItem>
          <TraceItem icon={request.tiene_evidencia ? 'bi-file-earmark-image' : 'bi-file-earmark'} label="Evidencia" tone={request.tiene_evidencia ? 'positive' : 'neutral'}>{request.tiene_evidencia ? 'Registrada' : 'Sin evidencia'}</TraceItem>
        </div>
      </section>
      <div className="sol-comp-notes">
        {request.observacion_solicitud ? <div className="sol-comp-note sol-comp-note--request"><i className="bi bi-chat-left-text" aria-hidden="true" /><div><strong>Observación de solicitud</strong><p>{request.observacion_solicitud}</p></div></div> : null}
        {request.comentario_revision ? <div className="sol-comp-note sol-comp-note--review"><i className="bi bi-shield-check" aria-hidden="true" /><div><strong>Comentario de Administración</strong><p>{request.comentario_revision}</p></div></div> : null}
        {request.observacion_recepcion ? <div className="sol-comp-note sol-comp-note--reception"><i className="bi bi-box2-heart" aria-hidden="true" /><div><strong>Observación de recepción</strong><p>{request.observacion_recepcion}</p></div></div> : null}
      </div>
      <div className="sol-comp-lines-heading"><div className="sol-comp-panel-heading"><span aria-hidden="true"><i className="bi bi-list-check" /></span><div><h3 id="sol-comp-lines-title">Artículos solicitados</h3></div></div><span>{details.length} {details.length === 1 ? 'línea' : 'líneas'}</span></div>
      {!details.length ? <div className="sol-comp-empty sol-comp-detail-empty"><i className="bi bi-inbox" aria-hidden="true" /><h4>No hay artículos registrados</h4><p>La solicitud no contiene líneas disponibles para mostrar.</p></div> : null}
      <div className="sol-comp-detail-lines" aria-labelledby="sol-comp-lines-title">{details.map((line) => {
        const stockKey = String(line.estado_stock || '').toUpperCase();
        return (
          <article key={line.id_solicitud_detalle ?? 'invalid-contract-detail'}>
            <div className="sol-comp-card-top"><div className="sol-comp-line-title"><span aria-hidden="true"><i className={`bi ${line.tipo_item === 'PRODUCTO' ? 'bi-box-seam' : 'bi-basket'}`} /></span><strong>{line.nombre || '—'}</strong></div><span className="sol-comp-type-pill">{line.tipo_item === 'PRODUCTO' ? 'Producto' : 'Insumo'}</span></div>
            <div className="sol-comp-line-meta">
              <span><small>Categoría</small><b>{line.categoria || '—'}</b></span>
              <span><small>Presentación</small><b>{line.presentacion_snapshot || '—'}</b></span>
              <span><small>Unidad base</small><b>{line.unidad_base || '—'}</b></span>
            </div>
            <div className="sol-comp-quantity-groups">
              <div className="sol-comp-quantity sol-comp-quantity--requested"><small>Solicitado</small><span>{value(line.cantidad_solicitada)}</span><em>Base: {baseValue(line.cantidad_base_solicitada, line.unidad_base)}</em></div>
              <div className="sol-comp-quantity sol-comp-quantity--approved"><small>Aprobado</small><span>{value(line.cantidad_aprobada)}</span><em>Base: {baseValue(line.cantidad_base_aprobada, line.unidad_base)}</em></div>
              <div className="sol-comp-quantity sol-comp-quantity--received"><small>Recibido</small><span>{value(line.cantidad_recibida)}</span><em>Base: {baseValue(line.cantidad_base_recibida, line.unidad_base)}</em></div>
            </div>
            <div className="sol-comp-line-context">
              <span><i className="bi bi-boxes" aria-hidden="true" /><small>Stock actual</small><b>{value(line.stock_actual)}</b></span>
              <span><i className="bi bi-speedometer2" aria-hidden="true" /><small>Stock mínimo</small><b>{value(line.stock_minimo)}</b></span>
              <span className={`sol-comp-line-stock sol-comp-line-stock--${stockKey.toLowerCase() || 'unknown'}`}><i className="bi bi-activity" aria-hidden="true" /><small>Estado de stock</small><b>{STOCK_LABELS[stockKey] || line.estado_stock || '—'}</b></span>
              <span><i className="bi bi-truck" aria-hidden="true" /><small>Proveedor</small><b>{line.proveedor?.nombre_proveedor || 'Sin asignar'}</b></span>
            </div>
          </article>
        );
      })}</div>
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
