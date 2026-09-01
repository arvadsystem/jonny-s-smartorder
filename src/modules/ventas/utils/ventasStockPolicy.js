const parseFiniteInventoryValue = (value, fieldName) => {
  const normalized = typeof value === 'string' && value.trim() !== ''
    ? Number(value)
    : value;

  if (typeof normalized !== 'number' || !Number.isFinite(normalized)) {
    throw new TypeError(`${fieldName} debe ser un numero finito.`);
  }

  return normalized;
};

export const getProjectedStock = (stock, requestedQuantity) =>
  parseFiniteInventoryValue(stock, 'stock') -
  parseFiniteInventoryValue(requestedQuantity, 'requestedQuantity');

export const hasStockShortage = (stock, requestedQuantity) =>
  getProjectedStock(stock, requestedQuantity) < 0;

export const isSaleBlockedByStock = () => false;
