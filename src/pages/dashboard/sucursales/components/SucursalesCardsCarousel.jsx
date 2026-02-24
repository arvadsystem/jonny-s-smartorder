import SucursalCard from './SucursalCard';

export default function SucursalesCardsCarousel({
  loading,
  filteredSucursales,
  totalSucursales,
  hasActiveFilters,
  drawerOpen,
  filtersOpen,
  pages,
  cardsPerPage,
  carouselRef,
  onCarouselWheel,
  onScrollPrev,
  onScrollNext,
  onClearFilters,
  onOpenCreate,
  canTapCardToEdit,
  togglingEstadoId,
  onOpenEdit,
  onOpenDelete,
  onToggleEstado
}) {
  return (
    <>
      <div className="inv-prod-results-meta inv-cat-v2__results-meta">
        <span>{loading ? 'Cargando sucursales...' : `${filteredSucursales.length} resultados`}</span>
        <span>{loading ? '' : `Total: ${totalSucursales}`}</span>
        {hasActiveFilters ? <span className="inv-prod-active-filter-pill">Filtros activos</span> : null}
      </div>

      <div className={`inv-catpro-list ${drawerOpen || filtersOpen ? 'drawer-open' : ''}`}>
        {loading ? (
          <div className="inv-catpro-loading" role="status" aria-live="polite">
            <span className="spinner-border spinner-border-sm" aria-hidden="true" />
            <span>Cargando sucursales...</span>
          </div>
        ) : filteredSucursales.length === 0 ? (
          <div className="inv-catpro-empty">
            <div className="inv-catpro-empty-icon">
              <i className="bi bi-shop-window" />
            </div>
            <div className="inv-catpro-empty-title">No hay sucursales para mostrar</div>
            <div className="inv-catpro-empty-sub">
              {hasActiveFilters ? 'Prueba limpiar filtros o crea una nueva sucursal.' : 'Crea tu primera sucursal.'}
            </div>

            <div className="d-flex gap-2 justify-content-center flex-wrap">
              {hasActiveFilters ? (
                <button type="button" className="btn btn-outline-secondary" onClick={onClearFilters}>
                  Limpiar filtros
                </button>
              ) : null}
              <button type="button" className="btn btn-primary" onClick={onOpenCreate}>
                Nueva sucursal
              </button>
            </div>
          </div>
        ) : (
          <div className="inv-catpro-carousel-wrap inv-prod-carousel-stage">
            <button
              type="button"
              className={`btn inv-prod-carousel-float is-prev ${pages.length > 1 ? 'is-visible' : ''}`}
              onClick={onScrollPrev}
              aria-label="Pagina anterior"
              disabled={pages.length <= 1}
            >
              <i className="bi bi-chevron-left" />
            </button>

            <div className="inv-catpro-carousel" ref={carouselRef} onWheel={onCarouselWheel}>
              {pages.map((page, pageIdx) => {
                const colsClass = cardsPerPage >= 6 ? 'cols-3' : cardsPerPage >= 4 ? 'cols-2' : 'cols-1';

                return (
                  <div className="inv-catpro-page" key={`page-${pageIdx}`} aria-label={`Pagina ${pageIdx + 1}`}>
                    <div className={`inv-catpro-grid inv-catpro-grid-page ${colsClass}`}>
                      {page.map((sucursal, idx) => {
                        const globalIdx = pageIdx * cardsPerPage + idx;
                        const isToggling = togglingEstadoId === sucursal?.id_sucursal;

                        return (
                          <SucursalCard
                            key={sucursal?.id_sucursal ?? `suc-${globalIdx}`}
                            sucursal={sucursal}
                            index={globalIdx}
                            canTapToEdit={canTapCardToEdit}
                            isToggling={isToggling}
                            onOpenEdit={onOpenEdit}
                            onOpenDelete={onOpenDelete}
                            onToggleEstado={onToggleEstado}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              className={`btn inv-prod-carousel-float is-next ${pages.length > 1 ? 'is-visible' : ''}`}
              onClick={onScrollNext}
              aria-label="Pagina siguiente"
              disabled={pages.length <= 1}
            >
              <i className="bi bi-chevron-right" />
            </button>
          </div>
        )}
      </div>
    </>
  );
}

