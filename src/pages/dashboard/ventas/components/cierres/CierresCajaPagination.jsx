import SecurityPaginationBar from '../../../seguridad/components/SecurityPaginationBar';

const clampPositiveInt = (value, fallback = 1) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const getPaginatedRows = (rows, currentPage, pageSize) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  const safePageSize = clampPositiveInt(pageSize, 6);
  const totalPages = Math.max(1, Math.ceil(safeRows.length / safePageSize));
  const safePage = Math.min(totalPages, Math.max(1, clampPositiveInt(currentPage, 1)));
  const start = (safePage - 1) * safePageSize;
  return {
    rows: safeRows.slice(start, start + safePageSize),
    page: safePage,
    pageSize: safePageSize,
    total: safeRows.length,
    totalPages
  };
};

export default function CierresCajaPagination({
  totalItems = 0,
  pageSize = 6,
  currentPage = 1,
  onPageChange
}) {
  const safeTotal = Math.max(0, Number(totalItems) || 0);
  const safePageSize = clampPositiveInt(pageSize, 6);
  const totalPages = Math.max(1, Math.ceil(safeTotal / safePageSize));
  const safeCurrentPage = Math.min(totalPages, Math.max(1, clampPositiveInt(currentPage, 1)));

  if (safeTotal <= 0) return null;

  return (
    <div className="ventas-page__pagination cierres-caja-pagination">
      <SecurityPaginationBar
        totalItems={safeTotal}
        pageSize={safePageSize}
        currentPage={safeCurrentPage}
        onPageChange={onPageChange}
        maxVisible={5}
        className="ventas-page__pagination-bar cierres-caja-pagination__bar"
      />
      <div className="ventas-page__page-size-label cierres-caja-pagination__label">
        <span>{safePageSize} por pagina</span>
        <span className="small text-muted">
          Pagina {safeCurrentPage} de {totalPages}
        </span>
      </div>
    </div>
  );
}
