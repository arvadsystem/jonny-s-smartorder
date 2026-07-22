import SolicitudCompraEstado from './SolicitudCompraEstado';
import { formatDateTime } from '../utils/solicitudesCompraUtils';

const FILTERS = [
  ['', 'Todas'], ['PENDIENTE', 'Pendientes'], ['APROBADA', 'Aprobadas'],
  ['RECIBIDA', 'Recibidas'], ['RECHAZADA', 'Rechazadas']
];

export default function SolicitudesCompraListado({ state, filter, onFilter, onPage, onDetail, onCreate, canCreate, canReview, canReceive }) {
  const page = Number(state.pagination?.page || 1);
  const pages = Math.max(1, Number(state.pagination?.total_pages || 1));
  return (
    <section className="sol-comp-section" aria-labelledby="sol-comp-title">
      <header className="sol-comp-header">
        <div><h2 id="sol-comp-title">Solicitudes de compra</h2><p>Solicita productos e insumos para el inventario de tu sucursal.</p></div>
        {canCreate ? <button type="button" className="btn btn-primary" onClick={onCreate}><i className="bi bi-plus-lg" /> Nueva solicitud</button> : null}
      </header>
      <div className="sol-comp-filters" aria-label="Filtrar solicitudes por estado">
        {FILTERS.map(([value, label]) => <button type="button" key={label} className={filter === value ? 'is-active' : ''} onClick={() => onFilter(value)}>{label}</button>)}
      </div>
      <div aria-live="polite">
        {state.loading ? <div className="sol-comp-feedback"><span className="spinner-border spinner-border-sm" /> Cargando solicitudes…</div> : null}
        {state.error ? <div className="sol-comp-feedback sol-comp-feedback--error"><span>{state.error}</span><button type="button" className="btn btn-outline-danger btn-sm" onClick={() => onPage(page)}>Reintentar</button></div> : null}
        {!state.loading && !state.error && state.solicitudes.length === 0 ? <div className="sol-comp-empty"><i className="bi bi-inbox" /><h3>No hay solicitudes</h3><p>Las solicitudes que envíes aparecerán aquí.</p></div> : null}
      </div>
      <div className="sol-comp-list">
        {state.solicitudes.map((item) => (
          <article className="sol-comp-request-card" key={item.id_solicitud_compra}>
            <div className="sol-comp-card-top"><strong>Solicitud #{item.id_solicitud_compra}</strong><SolicitudCompraEstado estado={item.estado} /></div>
            <div className="sol-comp-meta-grid">
              <span><small>Fecha</small>{formatDateTime(item.fecha_creacion)}</span>
              <span><small>Sucursal</small>{item.sucursal?.nombre || '—'}</span>
              <span><small>Almacén</small>{item.almacen?.nombre || '—'}</span>
              <span><small>Solicitante</small>{item.solicitante?.nombre || '—'}</span>
            </div>
            <div className="sol-comp-counts"><span>{item.total_lineas || 0} líneas</span><span>{item.total_productos || 0} productos</span><span>{item.total_insumos || 0} insumos</span>{item.tiene_evidencia ? <span><i className="bi bi-paperclip" /> Evidencia</span> : null}</div>
            {item.observacion_solicitud ? <p className="sol-comp-observation">{item.observacion_solicitud}</p> : null}
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => onDetail(item.id_solicitud_compra)}>{canReview && String(item.estado || '').toUpperCase() === 'PENDIENTE' ? 'Revisar solicitud' : canReceive && String(item.estado || '').toUpperCase() === 'APROBADA' ? 'Recibir solicitud' : 'Ver detalle'}</button>
          </article>
        ))}
      </div>
      {!state.loading && !state.error && state.solicitudes.length ? (
        <nav className="sol-comp-pagination" aria-label="Paginación de solicitudes">
          <button type="button" className="btn btn-outline-secondary btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Anterior</button>
          <span>Página {page} de {pages}</span>
          <button type="button" className="btn btn-outline-secondary btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Siguiente</button>
        </nav>
      ) : null}
    </section>
  );
}
