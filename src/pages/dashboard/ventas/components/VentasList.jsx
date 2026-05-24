import VentaCard from './VentaCard';
import VentasTable from './VentasTable';
import SecurityPaginationBar from '../../seguridad/components/SecurityPaginationBar';

export default function VentasList({
  loading,
  ventas,
  totalVentas,
  hasActiveFilters,
  view,
  currentPage,
  pageSize,
  totalPages,
  onPageChange,
  onPageSizeChange,
  limitedToLast72Hours = false,
  onClearFilters,
  onOpenCreate,
  onOpenDetail,
  canCreate = true
}) {
  const currentRows = Array.isArray(ventas) ? ventas.length : 0;
  const safePageSize = Number.parseInt(String(pageSize ?? ''), 10) || 6;
  const total = Number.parseInt(String(totalVentas ?? ''), 10) || 0;
  const startIndex = total === 0 ? 0 : ((currentPage - 1) * safePageSize) + 1;
  const endIndex = total === 0 ? 0 : Math.min((currentPage - 1) * safePageSize + currentRows, total);

  return (
    <>
      <div className="inv-prod-results-meta">
        <span>{loading ? 'Cargando ventas...' : `${currentRows} resultados`}</span>
        <span>{loading ? '' : `Mostrando ${startIndex}-${endIndex} de ${total}`}</span>
        {hasActiveFilters ? <span className="inv-prod-active-filter-pill">Filtros activos</span> : null}
        {!loading && limitedToLast72Hours ? (
          <span className="inv-prod-active-filter-pill">Mostrando historial permitido de las ultimas 72 horas.</span>
        ) : null}
      </div>

      <div className="inv-catpro-list">
        {loading ? (
          <div className="inv-catpro-loading" role="status" aria-live="polite">
            <span className="spinner-border spinner-border-sm" aria-hidden="true" />
            <span>Cargando ventas...</span>
          </div>
        ) : currentRows === 0 ? (
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
                <SecurityPaginationBar
                  totalItems={total}
                  pageSize={safePageSize}
                  currentPage={currentPage}
                  onPageChange={onPageChange}
                  maxVisible={5}
                  className="ventas-page__pagination-bar"
                />
                <div className="ventas-page__page-size-label">
                  <span>6 por pagina</span>
                  <span className="small text-muted">
                    Pagina {currentPage} de {totalPages}
                  </span>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
