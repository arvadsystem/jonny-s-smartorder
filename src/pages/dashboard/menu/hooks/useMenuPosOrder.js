import { useCallback, useMemo, useRef, useState } from 'react';
import { buildDefaultProductConfiguration, normalizeProductConfiguration } from '../utils/menuPosProductConfig';
import {
  buildMenuPosOrderPayload,
  buildOrderLineFromProduct,
  calculateOrderTotal,
  calculateLineSubtotal,
  updateLineQuantity
} from '../utils/menuPosOrderUtils';
import { submitMenuPosOrder } from '../services/menuPosOrderService';

const useMenuPosOrder = () => {
  const [items, setItems] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const lineCounterRef = useRef(0);

  const totalItems = useMemo(
    () => items.reduce((total, item) => total + Number(item?.cantidad || 0), 0),
    [items]
  );

  const totalAmount = useMemo(
    () => calculateOrderTotal(items),
    [items]
  );

  const clearSubmitState = useCallback(() => {
    setSubmitError('');
    setSubmitSuccess('');
  }, []);

  const getNextLineKey = useCallback(() => {
    lineCounterRef.current += 1;
    return `menu-line-${Date.now()}-${lineCounterRef.current}`;
  }, []);

  // Agrega una linea configurable y fusiona cantidades cuando la configuracion es identica.
  const addConfiguredProduct = useCallback((product, rawConfiguration = null) => {
    if (!product) return;

    clearSubmitState();

    const normalizedConfiguration = normalizeProductConfiguration(
      product,
      rawConfiguration || buildDefaultProductConfiguration(product)
    );

    const nextLine = buildOrderLineFromProduct({
      product,
      lineKey: getNextLineKey(),
      configuration: normalizedConfiguration
    });

    setItems((currentItems) => {
      const index = currentItems.findIndex((line) => line.configKey === nextLine.configKey);
      if (index === -1) {
        return [...currentItems, nextLine];
      }

      const currentLine = currentItems[index];
      const nextQuantity = Number(currentLine?.cantidad || 0) + Number(nextLine?.cantidad || 0);
      const mergedLine = {
        ...currentLine,
        cantidad: nextQuantity,
        subtotalLinea: calculateLineSubtotal(currentLine?.precioUnitario || 0, nextQuantity)
      };

      const mergedItems = [...currentItems];
      mergedItems[index] = mergedLine;
      return mergedItems;
    });
  }, [clearSubmitState, getNextLineKey]);

  const increaseLineQuantity = useCallback((lineKey) => {
    setItems((currentItems) => currentItems.map((line) => {
      if (line.lineKey !== lineKey) return line;
      return updateLineQuantity(line, Number(line?.cantidad || 0) + 1);
    }));
  }, []);

  const decreaseLineQuantity = useCallback((lineKey) => {
    setItems((currentItems) => currentItems.map((line) => {
      if (line.lineKey !== lineKey) return line;
      return updateLineQuantity(line, Math.max(1, Number(line?.cantidad || 0) - 1));
    }));
  }, []);

  const removeLine = useCallback((lineKey) => {
    setItems((currentItems) => currentItems.filter((line) => line.lineKey !== lineKey));
  }, []);

  const clearOrder = useCallback(() => {
    setItems([]);
    clearSubmitState();
  }, [clearSubmitState]);

  // Construye y envia el pedido al endpoint real de ventas sin tocar su logica interna.
  const confirmOrder = useCallback(async () => {
    if (items.length === 0) {
      setSubmitError('Agrega al menos un producto al carrito.');
      setSubmitSuccess('');
      return null;
    }

    clearSubmitState();
    const payload = buildMenuPosOrderPayload({ items, totalAmount });
    setIsSubmitting(true);

    try {
      const response = await submitMenuPosOrder(payload);
      const numeroVenta = response?.numero_venta ? ` (${response.numero_venta})` : '';
      setSubmitSuccess(
        response?.message ? `${response.message}${numeroVenta}` : `Pedido enviado${numeroVenta}.`
      );
      setItems([]);
      return response;
    } catch (error) {
      setSubmitError(error?.message || 'No se pudo enviar el pedido.');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [clearSubmitState, items, totalAmount]);

  return {
    items,
    totalItems,
    totalAmount,
    addConfiguredProduct,
    increaseLineQuantity,
    decreaseLineQuantity,
    removeLine,
    clearOrder,
    confirmOrder,
    isSubmitting,
    submitError,
    submitSuccess
  };
};

export default useMenuPosOrder;
