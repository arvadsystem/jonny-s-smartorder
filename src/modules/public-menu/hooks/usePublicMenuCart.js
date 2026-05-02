import { useEffect, useMemo, useState } from 'react';
import { PUBLIC_MENU_CART_STORAGE_KEY } from '../types/publicMenuTypes';
import {
  getItemExtraOptions,
  normalizeSelectedSauces
} from '../utils/publicMenuItemConfig';

const toMoney = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Number(parsed.toFixed(2));
};

const toPositiveInt = (value, fallback = 1) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const normalizeLineNote = (value, maxLength = 100) =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, maxLength);

const CART_SNAPSHOT_SCHEMA_VERSION = 2;

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isValidCartLine = (line) => {
  if (!isPlainObject(line)) return false;

  const idDetalle = Number(line?.id_detalle_menu || 0);
  const cantidad = Number(line?.cantidad || 0);
  const precioUnitario = Number(line?.precio_unitario);
  const subtotal = Number(line?.subtotal);
  const lineKey = String(line?.line_key || '').trim();

  if (!idDetalle || !lineKey) return false;
  if (!Number.isInteger(cantidad) || cantidad <= 0) return false;
  if (!Number.isFinite(precioUnitario) || precioUnitario < 0) return false;
  if (!Number.isFinite(subtotal) || subtotal < 0) return false;
  if (!Array.isArray(line?.extras)) return false;
  if (!Array.isArray(line?.salsas_por_unidad)) return false;
  if (line?.nota !== undefined && typeof line.nota !== 'string') return false;

  return true;
};

const getStorageSnapshot = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PUBLIC_MENU_CART_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Number(parsed?.schemaVersion || 0) !== CART_SNAPSHOT_SCHEMA_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
};

const persistSnapshot = (snapshot) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PUBLIC_MENU_CART_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Si localStorage falla, el carrito sigue funcionando en memoria.
  }
};

const clearSnapshot = () => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PUBLIC_MENU_CART_STORAGE_KEY);
  } catch {
    // no-op
  }
};

const normalizeSelectedExtras = (product, extras = []) => {
  const optionsById = new Map(
    getItemExtraOptions(product).map((extra) => [String(extra.id_extra), extra])
  );
  const requestedIds = [
    ...new Set(
      (Array.isArray(extras) ? extras : [])
        .map((entry) => String(entry?.id_extra || entry || '').trim())
        .filter(Boolean)
    )
  ];

  return requestedIds
    .map((id) => optionsById.get(id))
    .filter(Boolean)
    .map((extra) => ({
      id_extra: String(extra.id_extra),
      codigo: String(extra.codigo || extra.id_extra),
      nombre: String(extra.nombre || 'Extra'),
      precio_adicional: toMoney(extra.precio_adicional || 0)
    }));
};

const buildConfigSignature = ({ extras = [], salsasPorUnidad = [], nota = '' }) => {
  const extrasToken = (Array.isArray(extras) ? extras : [])
    .map((entry) => String(entry?.id_extra || '').trim())
    .filter(Boolean)
    .sort()
    .join('|');

  const saucesToken = normalizeSelectedSauces(salsasPorUnidad)
    .map((entry) => `${entry.id_salsa}:${entry.cantidad}`)
    .join('|');

  // Incluye nota para no mezclar lineas distintas cuando el cliente deja instrucciones.
  const noteToken = normalizeLineNote(nota, 100);
  return `${extrasToken}::${saucesToken}::${noteToken}`;
};

const buildLineKey = ({ idDetalleMenu, configSignature }) =>
  `${Number(idDetalleMenu || 0)}::${String(configSignature || '')}`;

const buildCartLine = ({ product, quantity = 1, extras = [], salsasPorUnidad = [], nota = '' }) => {
  const idDetalleMenu = Number(product?.id_detalle_menu || 0);
  const safeQuantity = toPositiveInt(quantity, 1);
  const normalizedNote = normalizeLineNote(nota, 100);
  const normalizedExtras = normalizeSelectedExtras(product, extras);
  const normalizedSauces = normalizeSelectedSauces(salsasPorUnidad);
  const extrasAmountPerUnit = normalizedExtras.reduce(
    (sum, extra) => sum + Number(extra?.precio_adicional || 0),
    0
  );
  const precioBase = toMoney(product?.precio?.final || 0);
  const precioUnitario = toMoney(precioBase + extrasAmountPerUnit);
  const subtotal = toMoney(precioUnitario * safeQuantity);
  const configSignature = buildConfigSignature({
    extras: normalizedExtras,
    salsasPorUnidad: normalizedSauces,
    nota: normalizedNote
  });

  return {
    line_key: buildLineKey({ idDetalleMenu, configSignature }),
    id_detalle_menu: idDetalleMenu,
    tipo_item: String(product?.tipo_item || 'PRODUCTO'),
    id_item_origen: Number(product?.id_item_base || 0) || null,
    nombre: String(product?.nombre || 'Item sin nombre'),
    cantidad: safeQuantity,
    precio_unitario: precioUnitario,
    subtotal,
    extras: normalizedExtras,
    salsas_por_unidad: normalizedSauces,
    nota: normalizedNote
  };
};

const recalculateLine = (line, nextQuantity) => {
  const cantidad = toPositiveInt(nextQuantity, 1);
  const precioUnitario = toMoney(line?.precio_unitario || 0);
  return {
    ...line,
    cantidad,
    subtotal: toMoney(precioUnitario * cantidad)
  };
};

const isSimpleLine = (line) =>
  (!Array.isArray(line?.extras) || line.extras.length === 0) &&
  (!Array.isArray(line?.salsas_por_unidad) || line.salsas_por_unidad.length === 0);

export const usePublicMenuCart = ({ branch }) => {
  const branchId = Number(branch?.id || 0) || null;
  const branchSlug = String(branch?.slug || '').trim() || null;

  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!branchId) {
      setItems([]);
      return;
    }

    const snapshot = getStorageSnapshot();
    const snapshotBranchId = Number(snapshot?.branchId || 0) || null;

    if (!snapshot || snapshotBranchId !== branchId) {
      setItems([]);
      clearSnapshot();
      return;
    }

    const safeItems = (Array.isArray(snapshot.items) ? snapshot.items : []).filter(isValidCartLine);
    setItems(safeItems);
  }, [branchId]);

  useEffect(() => {
    if (!branchId) return;
    persistSnapshot({
      schemaVersion: CART_SNAPSHOT_SCHEMA_VERSION,
      branchId,
      branchSlug,
      items
    });
  }, [branchId, branchSlug, items]);

  const addItem = (product, configuration = {}) => {
    const nextLine = buildCartLine({
      product,
      quantity: configuration?.cantidad || 1,
      extras: configuration?.extras,
      salsasPorUnidad: configuration?.salsasPorUnidad,
      nota: configuration?.nota
    });

    if (!nextLine.id_detalle_menu) return;

    setItems((current) => {
      const index = current.findIndex((line) => line?.line_key === nextLine.line_key);
      if (index === -1) return [...current, nextLine];

      const copy = [...current];
      const previous = copy[index];
      const quantity = toPositiveInt(previous?.cantidad, 1) + toPositiveInt(nextLine.cantidad, 1);
      copy[index] = recalculateLine(previous, quantity);
      return copy;
    });
  };

  const increaseItemByLine = (lineKey) => {
    const safeLineKey = String(lineKey || '').trim();
    if (!safeLineKey) return;

    setItems((current) =>
      current.map((line) => {
        if (String(line?.line_key || '') !== safeLineKey) return line;
        return recalculateLine(line, toPositiveInt(line?.cantidad, 1) + 1);
      })
    );
  };

  const decreaseItemByLine = (lineKey) => {
    const safeLineKey = String(lineKey || '').trim();
    if (!safeLineKey) return;

    setItems((current) =>
      current
        .map((line) => {
          if (String(line?.line_key || '') !== safeLineKey) return line;
          const nextQuantity = toPositiveInt(line?.cantidad, 1) - 1;
          if (nextQuantity <= 0) return null;
          return recalculateLine(line, nextQuantity);
        })
        .filter(Boolean)
    );
  };

  const removeItemByLine = (lineKey) => {
    const safeLineKey = String(lineKey || '').trim();
    if (!safeLineKey) return;

    setItems((current) =>
      current.filter((line) => String(line?.line_key || '') !== safeLineKey)
    );
  };

  // Para cards simples (sin extras/salsas), mantiene UX rapida de +/-.
  const increaseSimpleItem = (product) => {
    const targetId = Number(product?.id_detalle_menu || 0);
    if (!targetId) return;

    setItems((current) => {
      const index = current.findIndex(
        (line) => Number(line?.id_detalle_menu || 0) === targetId && isSimpleLine(line)
      );

      if (index === -1) {
        const line = buildCartLine({ product, quantity: 1 });
        return line.id_detalle_menu ? [...current, line] : current;
      }

      const copy = [...current];
      copy[index] = recalculateLine(copy[index], toPositiveInt(copy[index]?.cantidad, 1) + 1);
      return copy;
    });
  };

  const decreaseSimpleItem = (product) => {
    const targetId = Number(product?.id_detalle_menu || 0);
    if (!targetId) return;

    setItems((current) =>
      current
        .map((line) => {
          if (Number(line?.id_detalle_menu || 0) !== targetId || !isSimpleLine(line)) {
            return line;
          }

          const nextQuantity = toPositiveInt(line?.cantidad, 1) - 1;
          if (nextQuantity <= 0) return null;
          return recalculateLine(line, nextQuantity);
        })
        .filter(Boolean)
    );
  };

  const clearCart = () => {
    setItems([]);
    clearSnapshot();
  };

  const totalItems = useMemo(
    () => items.reduce((sum, item) => sum + toPositiveInt(item?.cantidad, 1), 0),
    [items]
  );

  const total = useMemo(
    () => toMoney(items.reduce((sum, item) => sum + toMoney(item?.subtotal), 0)),
    [items]
  );

  const buildOrderPayload = () => ({
    id_sucursal: branchId,
    sucursal_slug: branchSlug,
    origen: 'public-menu',
    items: items.map((item) => ({
      id_detalle_menu: Number(item.id_detalle_menu || 0) || null,
      tipo_item: item.tipo_item,
      id_item_origen: item.id_item_origen,
      nombre: item.nombre,
      cantidad: toPositiveInt(item.cantidad, 1),
      precio_unitario: toMoney(item.precio_unitario),
      subtotal: toMoney(item.subtotal),
      extras: (Array.isArray(item.extras) ? item.extras : []).map((extra) => ({
        id_extra: String(extra?.id_extra || '').trim()
      })).filter((extra) => extra.id_extra),
      salsas_por_unidad: normalizeSelectedSauces(item.salsas_por_unidad),
      nota: normalizeLineNote(item?.nota, 100)
    })),
    total
  });

  return {
    items,
    totalItems,
    total,
    addItem,
    increaseItemByLine,
    decreaseItemByLine,
    removeItemByLine,
    increaseSimpleItem,
    decreaseSimpleItem,
    clearCart,
    buildOrderPayload
  };
};
