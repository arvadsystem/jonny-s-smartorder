const leadingQuantity = (value) => {
  const match = String(value || '').trim().match(/^(\d+(?:[.,]\d+)?)(?:\s|$)/);
  if (!match) return null;
  const parsed = Number(match[1].replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

export const compareRecipeNamesNaturally = (left, right) => {
  const leftName = String(left?.nombre_receta ?? left ?? '').trim();
  const rightName = String(right?.nombre_receta ?? right ?? '').trim();
  const leftQuantity = leadingQuantity(leftName);
  const rightQuantity = leadingQuantity(rightName);
  if (leftQuantity !== null && rightQuantity !== null && leftQuantity !== rightQuantity) {
    return leftQuantity - rightQuantity;
  }
  if (leftQuantity !== null && rightQuantity === null) return -1;
  if (leftQuantity === null && rightQuantity !== null) return 1;
  return leftName.localeCompare(rightName, 'es', { sensitivity: 'base', numeric: true });
};
