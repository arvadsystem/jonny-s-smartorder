import { toNormalizedId } from './ventasCartUtils';
import { roundMoney } from './ventasMoneyUtils';

export const normalizeDiscountType = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

export const normalizeDiscountScope = (value) => {
  const normalized = String(value || 'FACTURA_COMPLETA')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

  if (normalized === 'PRODUCTOS') return 'PRODUCTO';
  if (normalized === 'RECETAS') return 'RECETA';
  if (normalized === 'COMBOS') return 'COMBO';
  return normalized || 'FACTURA_COMPLETA';
};

const appendDiscountTargetIds = (ids, value, legacyKey) => {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((entry) => appendDiscountTargetIds(ids, entry, legacyKey));
    return;
  }
  if (typeof value === 'string' && value.includes(',')) {
    value.split(',').forEach((entry) => appendDiscountTargetIds(ids, entry, legacyKey));
    return;
  }
  if (typeof value === 'object') {
    appendDiscountTargetIds(
      ids,
      value[legacyKey] ?? value.id ?? value.value ?? value.id_producto ?? value.id_receta ?? value.id_combo,
      legacyKey
    );
    return;
  }
  const id = toNormalizedId(value);
  if (id) ids.add(id);
};

export const parseDiscountDate = (value) => {
  if (!value) return null;
  const source = String(value).trim();
  if (!source) return null;

  const parsedNative = new Date(source);
  if (Number.isFinite(parsedNative.getTime())) return parsedNative;

  const match = source.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) return null;

  const asLocal = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4] || 0),
    Number(match[5] || 0),
    Number(match[6] || 0)
  );
  return Number.isFinite(asLocal.getTime()) ? asLocal : null;
};

export const computeDiscountAmount = (subtotal, selectedDiscount) => {
  if (!selectedDiscount) return 0;

  const discountValue = roundMoney(Number(selectedDiscount.valor_descuento ?? 0));
  if (discountValue <= 0 || subtotal <= 0) return 0;

  const discountType = normalizeDiscountType(selectedDiscount.nombre_tipo_descuento);
  if (discountType.includes('PORCENTAJE')) {
    return roundMoney(Math.min(subtotal, (subtotal * discountValue) / 100));
  }

  return roundMoney(Math.min(subtotal, discountValue));
};

export const isDiscountActiveAtDate = (discount, now = new Date()) => {
  const start = parseDiscountDate(discount?.fecha_inicio);
  const end = parseDiscountDate(discount?.fecha_fin);
  if (start && Number.isFinite(start.getTime()) && now < start) return false;
  if (end && Number.isFinite(end.getTime()) && now > end) return false;
  return true;
};

export const isDiscountAllowedForSucursal = (discount, idSucursal) => {
  const idSucursalDiscount = toNormalizedId(discount?.id_sucursal);
  if (!idSucursalDiscount) return true;
  if (!idSucursal) return false;
  return Number(idSucursalDiscount) === Number(idSucursal);
};

export const normalizeDiscountTargetIds = (discount, key, legacyKey) => {
  const objetivos = discount?.objetivos && typeof discount.objetivos === 'object' ? discount.objetivos : {};
  const ids = new Set();
  appendDiscountTargetIds(ids, objetivos[key], legacyKey);
  appendDiscountTargetIds(ids, discount?.[key], legacyKey);
  appendDiscountTargetIds(ids, discount?.[`${key}_ids`], legacyKey);
  appendDiscountTargetIds(ids, discount?.[legacyKey], legacyKey);
  return [...ids].map(Number);
};

export const isDiscountApplicableToLine = (discount, line, selectedSucursalId) => {
  const scope = normalizeDiscountScope(discount.alcance);
  if (scope === 'FACTURA_COMPLETA') return false;
  if (scope !== String(line.kind || '').toUpperCase()) return false;
  if (!isDiscountAllowedForSucursal(discount, selectedSucursalId)) return false;
  if (scope === 'PRODUCTO') {
    return normalizeDiscountTargetIds(discount, 'productos', 'id_producto').includes(Number(line.id_producto || 0));
  }
  if (scope === 'RECETA') {
    return normalizeDiscountTargetIds(discount, 'recetas', 'id_receta').includes(Number(line.id_receta || 0));
  }
  if (scope === 'COMBO') {
    return normalizeDiscountTargetIds(discount, 'combos', 'id_combo').includes(Number(line.id_combo || 0));
  }
  return false;
};

export const resolveBestDiscountForLine = ({ discounts, line, selectedSucursalId }) => {
  const lineSubtotal = roundMoney(Number(line?.precio_unitario ?? 0) * Number(line?.cantidad ?? 0));
  if (lineSubtotal <= 0) return null;

  let best = null;
  for (const discount of discounts) {
    if (!isDiscountApplicableToLine(discount, line, selectedSucursalId)) continue;

    const benefit = computeDiscountAmount(lineSubtotal, discount);
    if (benefit <= 0) continue;

    if (!best || benefit > best.benefit) {
      best = { discount, benefit };
    }
  }

  return best?.discount || null;
};
