const normalizeItemType = (item) => String(item?.tipo_item || '').trim().toUpperCase();

export const isKitchenPreparationItem = (item) => {
  const type = normalizeItemType(item);
  const isStandaloneExtra = Boolean(
    item?.es_linea_extra_independiente
    || item?.origen_snapshot?.es_linea_extra_independiente
    || type === 'EXTRA'
    || type === 'EXTRA_INDEPENDIENTE'
  );
  const hasProduct = Number(item?.id_producto || 0) > 0;
  const hasRecipe = Number(item?.id_receta || 0) > 0;
  if (hasProduct && hasRecipe) return false;
  if (isStandaloneExtra) {
    const idExtra = Number(item?.id_extra || item?.origen_snapshot?.id_extra || 0);
    const name = String(item?.nombre_item || item?.nombre_producto || item?.nombre_extra_snapshot || '').trim();
    const quantity = Number(item?.cantidad || 0);
    return Number.isSafeInteger(idExtra) && idExtra > 0 && name.length > 0 && Number.isFinite(quantity) && quantity > 0;
  }
  return !hasProduct && (hasRecipe || type === 'RECETA');
};

export const canPrintKitchenComanda = (venta) => {
  if (venta?.requiere_cocina === false || venta?.requiere_revision === true) return false;
  return (Array.isArray(venta?.items) ? venta.items : []).some(isKitchenPreparationItem);
};
