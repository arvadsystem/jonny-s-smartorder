const clampPositiveInt = (value, fallback = 1) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const buildVisiblePages = (currentPage, totalPages, maxVisible = 5) => {
  const visible = clampPositiveInt(maxVisible, 5);
  if (totalPages <= visible) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const half = Math.floor(visible / 2);
  let start = Math.max(1, currentPage - half);
  let end = start + visible - 1;

  if (end > totalPages) {
    end = totalPages;
    start = Math.max(1, end - visible + 1);
  }

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
};

const SecurityPaginationBar = ({
  totalItems = 0,
  pageSize = 10,
  currentPage = 1,
  onPageChange,
  maxVisible = 5,
  className = "",
}) => {
  const safeTotal = Math.max(0, Number(totalItems) || 0);
  const safePageSize = clampPositiveInt(pageSize, 10);
  const totalPages = Math.max(1, Math.ceil(safeTotal / safePageSize));
  const safeCurrentPage = Math.min(totalPages, Math.max(1, Number(currentPage) || 1));

  const startItem = safeTotal === 0 ? 0 : (safeCurrentPage - 1) * safePageSize + 1;
  const endItem = safeTotal === 0 ? 0 : Math.min(safeCurrentPage * safePageSize, safeTotal);
  const pageWindow = `${startItem}-${endItem}`;
  const visiblePages = buildVisiblePages(safeCurrentPage, totalPages, maxVisible);

  const emitPage = (nextPage) => {
    if (!onPageChange) return;
    const safeNext = Math.min(totalPages, Math.max(1, Number(nextPage) || 1));
    if (safeNext === safeCurrentPage) return;
    onPageChange(safeNext);
  };

  return (
    <div className={`inv-warehouse-moves__pagination inv-ins-pagination sec-pagination-bar ${className}`.trim()}>
      <div className="inv-warehouse-moves__pagination-meta inv-ins-pagination__page">
        {`Mostrando ${pageWindow} de ${safeTotal}`}
      </div>

      <div className="inv-warehouse-moves__pagination-controls">
        <button
          type="button"
          className="inv-prod-toolbar-btn inv-warehouse-moves__page-btn"
          onClick={() => emitPage(safeCurrentPage - 1)}
          disabled={safeCurrentPage <= 1}
          aria-label="Página anterior"
        >
          <i className="bi bi-chevron-left" aria-hidden="true" />
          <span>Anterior</span>
        </button>

        <div className="inv-warehouse-moves__pagination-pages">
          {visiblePages.map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              className={`inv-warehouse-moves__page-number ${pageNumber === safeCurrentPage ? "is-active" : ""}`.trim()}
              onClick={() => emitPage(pageNumber)}
              aria-label={`Ir a la página ${pageNumber}`}
              aria-current={pageNumber === safeCurrentPage ? "page" : undefined}
            >
              {pageNumber}
            </button>
          ))}
        </div>

        <div className="inv-warehouse-moves__pagination-status inv-ins-pagination__page">
          {`Página ${safeCurrentPage} de ${totalPages}`}
        </div>

        <button
          type="button"
          className="inv-prod-toolbar-btn inv-warehouse-moves__page-btn"
          onClick={() => emitPage(safeCurrentPage + 1)}
          disabled={safeCurrentPage >= totalPages}
          aria-label="Página siguiente"
        >
          <span>Siguiente</span>
          <i className="bi bi-chevron-right" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

export default SecurityPaginationBar;
