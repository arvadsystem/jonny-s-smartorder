export const buildVisiblePageNumbers = (page, totalPages, max = 5) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeTotalPages = Math.max(1, Number(totalPages) || 1);
  const safeMax = Math.max(3, Number(max) || 5);

  if (safeTotalPages <= safeMax) {
    return Array.from({ length: safeTotalPages }, (_, index) => index + 1);
  }

  let start = Math.max(1, safePage - Math.floor(safeMax / 2));
  let end = Math.min(safeTotalPages, start + safeMax - 1);
  start = Math.max(1, end - safeMax + 1);

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
};

export const buildPageRangeLabel = ({ page, limit, total, currentLength }) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Number(limit) || 1);
  const safeTotal = Math.max(0, Number(total) || 0);
  const safeCurrentLength = Math.max(0, Number(currentLength) || 0);

  if (!safeTotal || !safeCurrentLength) return '0-0';
  const start = (safePage - 1) * safeLimit + 1;
  const end = Math.min(safeTotal, start + safeCurrentLength - 1);
  return `${start}-${end}`;
};
