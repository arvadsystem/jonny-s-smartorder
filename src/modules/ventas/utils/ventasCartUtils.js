import { roundMoney } from './ventasMoneyUtils';

export const normalizeComplementIds = (value) =>
  [...new Set(
    (Array.isArray(value) ? value : [])
      .map((entry) => Number(entry?.id_complemento ?? entry))
      .filter((id) => Number.isInteger(id) && id > 0)
  )].sort((a, b) => a - b);

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
      stock_disponible: entry?.stock_disponible ?? null
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

export const getExtrasCount = (value) =>
  normalizeExtras(value).reduce((sum, entry) => sum + Number(entry.cantidad || 0), 0);

export const clampExtrasToQuantity = (extras, quantity) => {
  const max = Math.max(0, Number(quantity || 0));
  return normalizeExtras(extras)
    .map((entry) => ({ ...entry, cantidad: Math.min(Number(entry.cantidad || 0), max) }))
    .filter((entry) => entry.cantidad > 0);
};

export const buildCartKey = (kind, entityId, complementos = [], extras = []) =>
  `${kind}:${entityId}:${buildComplementSignature(complementos)}:${buildExtrasSignature(extras)}`;

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

const addComboDepartmentId = (ids, value) => {
  const id = toNormalizedId(value);
  if (id) ids.add(id);
};

const addComboDepartmentArrayIds = (ids, value) => {
  if (!Array.isArray(value)) return;
  value.forEach((entry) => {
    if (entry && typeof entry === 'object') {
      addComboDepartmentId(
        ids,
        entry.id_tipo_departamento ?? entry.id_departamento ?? entry.id ?? entry.value
      );
      return;
    }
    addComboDepartmentId(ids, entry);
  });
};

export const getComboDepartmentIds = (combo) => {
  const ids = new Set();
  addComboDepartmentId(ids, combo?.id_tipo_departamento);
  addComboDepartmentId(ids, combo?.id_tipo_departamento_principal);
  addComboDepartmentArrayIds(ids, combo?.departamentos_ids);
  addComboDepartmentArrayIds(ids, combo?.departamentos);
  addComboDepartmentArrayIds(ids, combo?.departamentos_derivados);
  return [...ids];
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
  if (catalogKey === 'COMBOS') {
    return `${count} ${count === 1 ? 'combo' : 'combos'}`;
  }

  if (catalogKey === 'RECETAS') {
    return `${count} ${count === 1 ? 'receta' : 'recetas'}`;
  }

  return `${count} ${count === 1 ? 'producto' : 'productos'}`;
};
