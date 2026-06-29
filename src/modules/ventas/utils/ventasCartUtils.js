import { roundMoney } from './ventasMoneyUtils.js';

export const VENTA_LINE_MIN_QUANTITY = 1;
export const VENTA_LINE_MAX_QUANTITY = 999;
export const VENTA_BULK_QUANTITY_CONFIRM_THRESHOLD = 10;

export const parseVentaLineQuantity = (value) => {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value >= VENTA_LINE_MIN_QUANTITY && value <= VENTA_LINE_MAX_QUANTITY
      ? value
      : null;
  }
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!/^[1-9]\d*$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed >= VENTA_LINE_MIN_QUANTITY && parsed <= VENTA_LINE_MAX_QUANTITY
    ? parsed
    : null;
};

export const clampVentaLineQuantity = (value) => {
  const parsed = typeof value === 'number' && Number.isFinite(value)
    ? Math.trunc(value)
    : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return VENTA_LINE_MIN_QUANTITY;
  return Math.min(VENTA_LINE_MAX_QUANTITY, Math.max(VENTA_LINE_MIN_QUANTITY, parsed));
};

export const normalizeComplementIds = (value) =>
  [...new Set(
    (Array.isArray(value) ? value : [])
      .map((entry) => Number(entry?.id_complemento ?? entry))
      .filter((id) => Number.isInteger(id) && id > 0)
  )].sort((a, b) => a - b);

export const normalizeValidComplementIds = (line) => {
  if (!line || ['PRODUCTO', 'ITEM'].includes(String(line.kind || '').toUpperCase())) return [];
  const allowedIds = new Set(
    (Array.isArray(line.complementos_disponibles) ? line.complementos_disponibles : [])
      .filter((entry) => entry?.disponible !== false)
      .map((entry) => Number(entry?.id_complemento ?? entry?.id_salsa ?? 0))
      .filter((id) => Number.isInteger(id) && id > 0)
  );
  return normalizeComplementIds(line.complementos).filter((id) => allowedIds.has(id));
};

export const buildComplementSignature = (value) => {
  const ids = normalizeComplementIds(value);
  if (ids.length === 0) return 'none';
  return ids.join('-');
};

export const normalizeExtras = (value) =>
  (Array.isArray(value) ? value : [])
    .map((entry) => ({
      id_extra: Number(entry?.id_extra ?? 0),
      cantidad: Number(entry?.cantidad ?? 0),
      codigo: String(entry?.codigo || '').trim(),
      nombre: String(entry?.nombre || 'Extra').trim(),
      precio: roundMoney(entry?.precio ?? entry?.precio_unitario ?? 0),
      id_insumo: Number(entry?.id_insumo ?? 0) || null,
      id_insumo_maestro: Number(entry?.id_insumo_maestro ?? 0) || null,
      stock_disponible: entry?.stock_disponible ?? null,
      cantidad_consumo_base: entry?.cantidad_consumo_base ?? null,
      id_unidad_base: Number(entry?.id_unidad_base ?? 0) || null,
      disponible: entry?.disponible !== false,
      inventario_configurado: entry?.inventario_configurado !== false,
      motivo_no_disponible: String(entry?.motivo_no_disponible || '').trim() || null,
      codigo_no_disponible: String(entry?.codigo_no_disponible || '').trim() || null
    }))
    .filter((entry) => Number.isInteger(entry.id_extra) && entry.id_extra > 0 && Number.isInteger(entry.cantidad) && entry.cantidad > 0)
    .sort((left, right) => left.id_extra - right.id_extra);

export const buildExtrasSignature = (value) => {
  const extras = normalizeExtras(value);
  if (extras.length === 0) return 'noextras';
  return extras.map((entry) => `${entry.id_extra}x${entry.cantidad}`).join('-');
};

export const getExtrasSubtotal = (value) =>
  roundMoney(normalizeExtras(value).reduce((sum, entry) => sum + Number(entry.precio || 0) * Number(entry.cantidad || 0), 0));

export const getLineExtrasSubtotal = (line) =>
  roundMoney(getExtrasSubtotal(line?.extras) * clampVentaLineQuantity(line?.cantidad ?? 1));

export const getExtrasCount = (value) =>
  normalizeExtras(value).reduce((sum, entry) => sum + Number(entry.cantidad || 0), 0);

let cartLineCounter = 0;

export const isCustomizableVentaLineKind = (kind) => String(kind || '').toUpperCase() === 'RECETA';

export const createCartLineId = () => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  cartLineCounter += 1;
  const randomPart = Math.random().toString(36).slice(2, 12);
  return `line_${Date.now().toString(36)}_${cartLineCounter.toString(36)}_${randomPart}`;
};

export const buildCartKey = (kind, entityId, complementos = [], extras = [], lineId = null) => {
  const normalizedKind = String(kind || '').toUpperCase();
  if (isCustomizableVentaLineKind(normalizedKind) && lineId) {
    return `${normalizedKind}:line:${lineId}`;
  }
  return `${normalizedKind}:${entityId}:${buildComplementSignature(complementos)}:${buildExtrasSignature(extras)}`;
};

const normalizeSignatureText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

export const buildVentaLineConfigSignature = (line) => {
  const kind = String(line?.kind || '').toUpperCase();
  const entityId = Number(line?.entityId ?? line?.id_producto ?? line?.id_receta ?? line?.id_extra ?? 0) || 0;
  const complementSignature = buildComplementSignature(line?.complementos);
  const extrasSignature = buildExtrasSignature(line?.extras);
  const observation = normalizeSignatureText(line?.observacion);
  const lineDiscount = String(line?.id_descuento_catalogo_linea || '').trim() || 'none';
  return [kind, entityId, complementSignature, extrasSignature, observation, lineDiscount].join('|');
};

export const mergeEquivalentVentaLines = (cart) => {
  const merged = [];
  const indexBySignature = new Map();
  let mergeCount = 0;

  for (const line of Array.isArray(cart) ? cart : []) {
    const cantidad = clampVentaLineQuantity(line?.cantidad ?? 1);
    const normalizedLine = { ...line, cantidad };
    const signature = buildVentaLineConfigSignature(normalizedLine);
    const existingIndex = indexBySignature.get(signature);
    if (existingIndex === undefined) {
      indexBySignature.set(signature, merged.length);
      merged.push(normalizedLine);
      continue;
    }

    const existing = merged[existingIndex];
    merged[existingIndex] = {
      ...existing,
      cantidad: clampVentaLineQuantity(Number(existing.cantidad || 0) + cantidad)
    };
    mergeCount += 1;
  }

  return { cart: merged, merged: mergeCount > 0, mergeCount };
};

export const findLineIndex = (cart, cartKey) =>
  cart.findIndex((line) => String(line.cartKey) === String(cartKey));

export const toNormalizedId = (value) => {
  if (value === null || value === undefined) return null;
  const asString = String(value).trim();
  if (!asString || asString.toLowerCase() === 'null' || asString.toLowerCase() === 'undefined') {
    return null;
  }
  const parsed = Number.parseInt(asString, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const filterBySearch = (rows, search, fields) => {
  const needle = String(search || '').trim().toLowerCase();
  if (!needle) return rows;

  return rows.filter((row) =>
    fields
      .map((field) => row?.[field])
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(needle)
  );
};

export const getResultsLabel = (catalogKey, count) => {
  if (catalogKey === 'RECETAS') {
    return `${count} ${count === 1 ? 'receta' : 'recetas'}`;
  }

  if (catalogKey === 'EXTRAS') {
    return `${count} ${count === 1 ? 'extra' : 'extras'}`;
  }

  return `${count} ${count === 1 ? 'producto' : 'productos'}`;
};
