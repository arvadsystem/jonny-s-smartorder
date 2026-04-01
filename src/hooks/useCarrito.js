/**
 * useCarrito.js
 * Hook para manejar el carrito de compras del cliente.
 * - Si el usuario NO está autenticado: persistencia en localStorage.
 * - Si el usuario SÍ está autenticado: misma lógica, listo para futura fusión con servidor.
 */
import { useState, useEffect, useCallback } from 'react';

const CARRITO_KEY = 'jonnys_carrito';

const leerCarritoLocal = () => {
  try {
    const raw = localStorage.getItem(CARRITO_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const guardarCarritoLocal = (items) => {
  try {
    localStorage.setItem(CARRITO_KEY, JSON.stringify(items));
  } catch {
    // ignorar errores de escritura en localStorage
  }
};

const limpiarCarritoLocal = () => {
  try {
    localStorage.removeItem(CARRITO_KEY);
  } catch {}
};

/**
 * @returns {{
 *   items: Array<{id: number, nombre: string, precio: number, cantidad: number, imagen_url?: string}>,
 *   agregar: (item: object) => void,
 *   quitar: (id: number) => void,
 *   actualizar: (id: number, cantidad: number) => void,
 *   limpiar: () => void,
 *   total: number,
 *   cantidad: number
 * }}
 */
export const useCarrito = () => {
  const [items, setItems] = useState(() => leerCarritoLocal());

  // Sincronizar al localStorage cuando cambien los items
  useEffect(() => {
    guardarCarritoLocal(items);
  }, [items]);

  const agregar = useCallback((nuevoItem) => {
    setItems((prev) => {
      const existente = prev.find((i) => i.id === nuevoItem.id);
      if (existente) {
        return prev.map((i) =>
          i.id === nuevoItem.id ? { ...i, cantidad: i.cantidad + 1 } : i
        );
      }
      return [...prev, { ...nuevoItem, cantidad: 1 }];
    });
  }, []);

  const quitar = useCallback((id) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const actualizar = useCallback((id, cantidad) => {
    const cant = Number(cantidad);
    if (cant <= 0) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, cantidad: cant } : i))
    );
  }, []);

  const limpiar = useCallback(() => {
    setItems([]);
    limpiarCarritoLocal();
  }, []);

  const total = items.reduce((sum, i) => sum + i.precio * i.cantidad, 0);
  const cantidad = items.reduce((sum, i) => sum + i.cantidad, 0);

  return { items, agregar, quitar, actualizar, limpiar, total, cantidad };
};
