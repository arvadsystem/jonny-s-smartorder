import { roundMoney } from '../../../../modules/ventas/utils/ventasMoneyUtils.js';

const toMoneyNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const isStandaloneExtraItem = (item) => {
  if (item?.es_linea_extra_independiente || item?.origen_snapshot?.es_linea_extra_independiente) return true;
  const kind = String(item?.tipo_item || item?.kind || '').trim().toUpperCase();
  return ['ITEM', 'EXTRA'].includes(kind)
    && !item?.id_producto
    && !item?.id_receta
    && Boolean(item?.id_extra ?? item?.entityId);
};

const getStoredExtraSubtotal = (extra) => {
  const subtotal = toMoneyNumber(extra?.subtotal);
  if (subtotal > 0) return subtotal;
  return toMoneyNumber(extra?.precio_unitario ?? extra?.precio) * toMoneyNumber(extra?.cantidad);
};

const getAttachedExtrasSubtotal = (item) => {
  if (isStandaloneExtraItem(item)) return 0;
  const snapshotSubtotal = toMoneyNumber(item?.origen_snapshot?.subtotal_extras);
  const nestedSubtotal = (Array.isArray(item?.extras) ? item.extras : [])
    .reduce((sum, extra) => sum + getStoredExtraSubtotal(extra), 0);
  return Math.max(snapshotSubtotal, nestedSubtotal);
};

const getStoredLineSubtotal = (item) => {
  const stored = item?.sub_total ?? item?.subtotal_linea;
  if (stored !== undefined && stored !== null && stored !== '') return toMoneyNumber(stored);
  return toMoneyNumber(item?.precio_unitario ?? item?.precio) * toMoneyNumber(item?.cantidad);
};

// Solo productos/recetas cuentan como "base items". Las lineas de extra
// independiente se clasifican como extras (no como base), sin alterar el total.
const getBaseLineSubtotal = (item) => (isStandaloneExtraItem(item) ? 0 : getStoredLineSubtotal(item));
const getStandaloneExtraSubtotal = (item) => (isStandaloneExtraItem(item) ? getStoredLineSubtotal(item) : 0);

export const getVentaItemSummaryParts = (item) => ({
  base: getBaseLineSubtotal(item),
  extras: getAttachedExtrasSubtotal(item) + getStandaloneExtraSubtotal(item)
});

export const buildVentaDetailSummary = ({ items = [], total = null } = {}) => {
  const detailItems = Array.isArray(items) ? items : [];
  const base_items = roundMoney(detailItems.reduce((sum, item) => sum + getVentaItemSummaryParts(item).base, 0));
  const extras = roundMoney(detailItems.reduce(
    (sum, item) => sum + getVentaItemSummaryParts(item).extras,
    0
  ));
  const subtotal_bruto = roundMoney(base_items + extras);
  const hasStoredTotal = total !== null && total !== undefined && Number.isFinite(Number(total));
  const storedTotal = toMoneyNumber(total);

  return {
    base_items,
    extras,
    subtotal_bruto,
    total: hasStoredTotal ? roundMoney(storedTotal) : subtotal_bruto
  };
};
