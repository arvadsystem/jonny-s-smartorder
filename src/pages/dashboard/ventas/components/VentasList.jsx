import VentaCard from './VentaCard';
import VentasTable from './VentasTable';

export default function VentasList({
  loading,
  ventas,
  totalVentas,
  hasActiveFilters,
  view,
  currentPage,
  totalPages,
  onPrevPage,
  onNextPage,
  onClearFilters,
  onOpenCreate,
  onOpenDetail,
  canCreate = true
}) {
  return (
    <>
      <div className="inv-prod-results-meta">
        <span>{loading ? 'Cargando ventas...' : `${ventas.length} resultados`}</span>
        <span>{loading ? '' : `Total: ${totalVentas}`}</span>
        {hasActiveFilters ? <span className="inv-prod-active-filter-pill">Filtros activos</span> : null}
      </div>

      <div className="inv-catpro-list">
        {loading ? (
          <div className="inv-catpro-loading" role="status" aria-live="polite">
            <span className="spinner-border spinner-border-sm" aria-hidden="true" />
            <span>Cargando ventas...</span>
          </div>
        ) : ventas.length === 0 ? (
          <div className="inv-catpro-empty">
            <div className="inv-catpro-empty-icon">
              <i className="bi bi-cart-x" />
            </div>
            <div className="inv-catpro-empty-title">No hay ventas para mostrar</div>
            <div className="inv-catpro-empty-sub">
              {hasActiveFilters
                ? 'Prueba limpiar filtros o registra una nueva venta.'
                : 'Todavia no se ha registrado ninguna venta.'}
            </div>

            <div className="d-flex gap-2 justify-content-center flex-wrap">
              {hasActiveFilters ? (
                <button type="button" className="btn btn-outline-secondary" onClick={onClearFilters}>
                  Limpiar filtros
                </button>
              ) : null}
              {canCreate ? (
                <button type="button" className="btn btn-primary" onClick={onOpenCreate}>
                  Nueva venta
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            {view === 'list' ? (
              <VentasTable ventas={ventas} onOpenDetail={onOpenDetail} />
            ) : (
              <div className="inv-catpro-grid ventas-page__sales-grid">
                {ventas.map((venta, index) => (
                  <VentaCard
                    key={venta?.id_factura ?? `${venta?.numero_venta}-${index}`}
                    venta={venta}
                    index={index}
                    view={view}
                    onOpenDetail={onOpenDetail}
                  />
                ))}
              </div>
            )}

            {totalPages > 1 ? (
              <div className="ventas-page__pagination">
                <button type="button" className="btn btn-outline-secondary" onClick={onPrevPage} disabled={currentPage <= 0}>
                  <i className="bi bi-chevron-left" /> Anterior
                </button>
                <span>
                  Pagina {currentPage + 1} de {totalPages}
                </span>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={onNextPage}
                  disabled={currentPage >= totalPages - 1}
                >
                  Siguiente <i className="bi bi-chevron-right" />
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
