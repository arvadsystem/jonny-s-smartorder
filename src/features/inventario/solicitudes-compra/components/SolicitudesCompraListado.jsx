import SolicitudCompraEstado from './SolicitudCompraEstado';
import { formatDateTime } from '../utils/solicitudesCompraUtils';

const FILTERS = [
  ['', 'Todas'], ['PENDIENTE', 'Pendientes'], ['APROBADA', 'Aprobadas'],
  ['RECIBIDA', 'Recibidas'], ['RECHAZADA', 'Rechazadas'], ['CANCELADA', 'Canceladas']
];

export default function SolicitudesCompraListado({ state, filter, onFilter, onPage, onDetail, onCreate, canCreate, canReview, canReceive }) {
  const page = Number(state.pagination?.page || 1);
  const pages = Math.max(1, Number(state.pagination?.total_pages || 1));
  return (
    <section className="sol-comp-section" aria-labelledby="sol-comp-title">
      <header className="sol-comp-header">
        <div className="sol-comp-header__copy">
          <span className="sol-comp-header__icon" aria-hidden="true"><i className="bi bi-clipboard2-check" /></span>
          <div><h2 id="sol-comp-title">Solicitudes de compra</h2><p>Solicita y da seguimiento al abastecimiento de inventario de tu sucursal.</p></div>
        </div>
        {canCreate ? <button type="button" className="btn btn-primary sol-comp-primary-action" onClick={onCreate}><i className="bi bi-plus-circle" aria-hidden="true" /> Nueva solicitud</button> : null}
      </header>
      <div className="sol-comp-filters" aria-label="Filtrar solicitudes por estado">
        {FILTERS.map(([filterValue, label]) => (
          <button type="button" key={label} aria-pressed={filter === filterValue} className={filter === filterValue ? 'is-active' : ''} onClick={() => onFilter(filterValue)}>{label}</button>
        ))}
      </div>
      <div aria-live="polite">
        {state.loading ? <div className="sol-comp-feedback"><span className="spinner-border spinner-border-sm" /> Cargando solicitudes…</div> : null}
        {state.error ? <div className="sol-comp-feedback sol-comp-feedback--error"><span>{state.error}</span><button type="button" className="btn btn-outline-danger btn-sm" onClick={() => onPage(page)}>Reintentar</button></div> : null}
        {!state.loading && !state.error && state.solicitudes.length === 0 ? <div className="sol-comp-empty"><i className="bi bi-inbox" aria-hidden="true" /><h3>No hay solicitudes</h3><p>Las solicitudes que envíes aparecerán aquí.</p></div> : null}
      </div>
      <div className="sol-comp-list">
        {state.solicitudes.map((item) => (
          <article className="sol-comp-request-card" key={item.id_solicitud_compra}>
            <div className="sol-comp-card-top">
              <div className="sol-comp-request-card__identity"><span aria-hidden="true"><i className="bi bi-receipt" /></span><strong>Solicitud #{item.id_solicitud_compra}</strong></div>
              <SolicitudCompraEstado estado={item.estado} />
            </div>
            <div className="sol-comp-meta-grid">
              <span><small><i className="bi bi-calendar3" aria-hidden="true" /> Fecha</small>{formatDateTime(item.fecha_creacion)}</span>
              <span><small><i className="bi bi-shop" aria-hidden="true" /> Sucursal</small>{item.sucursal?.nombre || '—'}</span>
              <span><small><i className="bi bi-building" aria-hidden="true" /> Almacén</small>{item.almacen?.nombre || '—'}</span>
              <span><small><i className="bi bi-person" aria-hidden="true" /> Solicitante</small>{item.solicitante?.nombre || '—'}</span>
            </div>
            <div className="sol-comp-counts">
              <span><i className="bi bi-list-check" aria-hidden="true" /> {item.total_lineas || 0} líneas</span>
              <span><i className="bi bi-box-seam" aria-hidden="true" /> {item.total_productos || 0} productos</span>
              <span><i className="bi bi-basket" aria-hidden="true" /> {item.total_insumos || 0} insumos</span>
              {item.tiene_evidencia ? <span className="is-evidence"><i className="bi bi-paperclip" aria-hidden="true" /> Evidencia</span> : null}
            </div>
            {item.observacion_solicitud ? <p className="sol-comp-observation">{item.observacion_solicitud}</p> : null}
            <div className="sol-comp-request-card__footer">
              <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => onDetail(item.id_solicitud_compra)}>
                {canReview && String(item.estado || '').toUpperCase() === 'PENDIENTE' ? 'Revisar solicitud' : canReceive && String(item.estado || '').toUpperCase() === 'APROBADA' ? 'Recibir solicitud' : 'Ver detalle'} <i className="bi bi-arrow-right" aria-hidden="true" />
              </button>
            </div>
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
