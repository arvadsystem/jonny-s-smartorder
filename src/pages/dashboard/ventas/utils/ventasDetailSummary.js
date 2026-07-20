import { roundMoney } from '../../../../modules/ventas/utils/ventasMoneyUtils.js';

const toMoneyNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isStandaloneExtraItem = (item) => Boolean(item?.es_linea_extra_independiente || item?.origen_snapshot?.es_linea_extra_independiente);

const getStoredExtraSubtotal = (extra) => {
  const subtotal = toMoneyNumber(extra?.subtotal);
  if (subtotal > 0) return subtotal;
  return toMoneyNumber(extra?.precio_unitario ?? extra?.precio) * toMoneyNumber(extra?.cantidad);
};

const getAttachedExtrasSubtotal = (item) => {
  if (isStandaloneExtraItem(item)) return 0;
  const snapshotSubtotal = item?.origen_snapshot?.subtotal_extras;
  if (snapshotSubtotal !== undefined && snapshotSubtotal !== null && snapshotSubtotal !== '') {
    return toMoneyNumber(snapshotSubtotal);
  }
  return (Array.isArray(item?.extras) ? item.extras : [])
    .reduce((sum, extra) => sum + getStoredExtraSubtotal(extra), 0);
};

const getStoredLineSubtotal = (item) => toMoneyNumber(item?.sub_total ?? item?.subtotal_linea);

// Solo productos/recetas cuentan como "base items". Las lineas de extra
// independiente se clasifican como extras (no como base), sin alterar el total.
const getBaseLineSubtotal = (item) => (isStandaloneExtraItem(item) ? 0 : getStoredLineSubtotal(item));
const getStandaloneExtraSubtotal = (item) => (isStandaloneExtraItem(item) ? getStoredLineSubtotal(item) : 0);

export const buildVentaDetailSummary = ({ items = [], total = null } = {}) => {
  const detailItems = Array.isArray(items) ? items : [];
  const base_items = roundMoney(detailItems.reduce((sum, item) => sum + getBaseLineSubtotal(item), 0));
  const extras = roundMoney(detailItems.reduce(
    (sum, item) => sum + getAttachedExtrasSubtotal(item) + getStandaloneExtraSubtotal(item),
    0
  ));
  const subtotal_bruto = roundMoney(base_items + extras);
  const storedTotal = toMoneyNumber(total);

  return {
    base_items,
    extras,
    subtotal_bruto,
    total: storedTotal > 0 ? roundMoney(storedTotal) : subtotal_bruto
  };
};
