import { useEffect, useMemo, useState } from 'react';
import { PUBLIC_MENU_CART_STORAGE_KEY } from '../types/publicMenuTypes';

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

const getStorageSnapshot = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PUBLIC_MENU_CART_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const persistSnapshot = (snapshot) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PUBLIC_MENU_CART_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // no-op
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

const buildCartItem = (product) => {
  const idDetalleMenu = Number(product?.id_detalle_menu || 0);
  const precioUnitario = toMoney(product?.precio?.final);
  const quantity = 1;

  return {
    id_detalle_menu: idDetalleMenu,
    tipo_item: String(product?.tipo_item || 'PRODUCTO'),
    id_item_origen: Number(product?.id_item_base || 0) || null,
    nombre: String(product?.nombre || 'Item sin nombre'),
    cantidad: quantity,
    precio_unitario: precioUnitario,
    subtotal: toMoney(precioUnitario * quantity)
  };
};

export const usePublicMenuCart = ({ branch }) => {
  const branchId = Number(branch?.id || 0) || null;
  const branchSlug = String(branch?.slug || '').trim() || null;

  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!branchId) {
      setItems([]);
      clearSnapshot();
      return;
    }

    const snapshot = getStorageSnapshot();
    const snapshotBranchId = Number(snapshot?.branchId || 0) || null;

    if (!snapshot || snapshotBranchId !== branchId) {
      setItems([]);
      clearSnapshot();
      return;
    }

    const safeItems = Array.isArray(snapshot.items) ? snapshot.items : [];
    setItems(safeItems);
  }, [branchId]);

  useEffect(() => {
    if (!branchId) return;
    persistSnapshot({
      branchId,
      branchSlug,
      items
    });
  }, [branchId, branchSlug, items]);

  const addItem = (product) => {
    const nextItem = buildCartItem(product);
    if (!nextItem.id_detalle_menu) return;

    setItems((current) => {
      const index = current.findIndex(
        (item) => Number(item?.id_detalle_menu || 0) === nextItem.id_detalle_menu
      );

      if (index === -1) {
        return [...current, nextItem];
      }

      const copy = [...current];
      const previous = copy[index];
      const cantidad = toPositiveInt(previous?.cantidad, 1) + 1;
      copy[index] = {
        ...previous,
        cantidad,
        subtotal: toMoney(toMoney(previous?.precio_unitario) * cantidad)
      };
      return copy;
    });
  };

  const increaseItem = (idDetalleMenu) => {
    const targetId = Number(idDetalleMenu || 0);
    if (!targetId) return;

    setItems((current) =>
      current.map((item) => {
        if (Number(item?.id_detalle_menu || 0) !== targetId) return item;
        const cantidad = toPositiveInt(item?.cantidad, 1) + 1;
        return {
          ...item,
          cantidad,
          subtotal: toMoney(toMoney(item?.precio_unitario) * cantidad)
        };
      })
    );
  };

  const decreaseItem = (idDetalleMenu) => {
    const targetId = Number(idDetalleMenu || 0);
    if (!targetId) return;

    setItems((current) =>
      current
        .map((item) => {
          if (Number(item?.id_detalle_menu || 0) !== targetId) return item;
          const cantidad = toPositiveInt(item?.cantidad, 1) - 1;
          if (cantidad <= 0) return null;
          return {
            ...item,
            cantidad,
            subtotal: toMoney(toMoney(item?.precio_unitario) * cantidad)
          };
        })
        .filter(Boolean)
    );
  };

  const removeItem = (idDetalleMenu) => {
    const targetId = Number(idDetalleMenu || 0);
    if (!targetId) return;
    setItems((current) =>
      current.filter((item) => Number(item?.id_detalle_menu || 0) !== targetId)
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
      tipo_item: item.tipo_item,
      id_item_origen: item.id_item_origen,
      nombre: item.nombre,
      cantidad: toPositiveInt(item.cantidad, 1),
      precio_unitario: toMoney(item.precio_unitario),
      subtotal: toMoney(item.subtotal)
    })),
    total
  });

  return {
    items,
    totalItems,
    total,
    addItem,
    increaseItem,
    decreaseItem,
    removeItem,
    clearCart,
    buildOrderPayload
  };
};

