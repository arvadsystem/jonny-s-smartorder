import {
  normalizeValidComplementIds,
  normalizeExtras,
  toNormalizedId
} from './ventasCartUtils';

export const buildVentaItemsPayload = (cart, { canApplyDiscount = false } = {}) =>
  (Array.isArray(cart) ? cart : []).map((line) => {
    const payload = {
      cart_key: line.cartKey,
      id_producto: line.id_producto,
      id_combo: line.id_combo,
      id_receta: line.id_receta,
      cantidad: Number(line.cantidad)
    };
    const lineDiscountId = Number(line.id_descuento_catalogo_linea || 0);
    if (canApplyDiscount && lineDiscountId > 0) {
      payload.id_descuento_catalogo = lineDiscountId;
    }
    if (line.kind !== 'PRODUCTO') {
      payload.observacion = String(line.observacion || '').trim() || null;
    }
    const complementos = line.kind === 'PRODUCTO'
      ? []
      : normalizeValidComplementIds(line);
    if (complementos.length > 0) {
      payload.complementos = complementos.map((id) => ({ id_complemento: id }));
    }
    if (line.kind !== 'PRODUCTO' && line.complementos_incompletos_autorizados) {
      payload.complementos_incompletos_autorizados = true;
    }
    const extras = normalizeExtras(line.extras);
    if (extras.length > 0) {
      payload.extras = extras.map((entry) => ({
        id_extra: entry.id_extra,
        cantidad: entry.cantidad
      }));
    }
    return payload;
  });

export const buildDescuentosLineaPayload = (cart, { canApplyDiscount = false } = {}) => {
  if (!canApplyDiscount) return [];
  return (Array.isArray(cart) ? cart : [])
    .map((line) => ({
      cart_key: line.cartKey,
      id_descuento_catalogo: Number(line.id_descuento_catalogo_linea || 0)
    }))
    .filter((line) => line.id_descuento_catalogo > 0);
};

export const applyDiscountPayloadFields = (payload, { canApplyDiscount = false, selectedDiscountId = '' } = {}) => {
  if (!canApplyDiscount) return payload;
  if (selectedDiscountId) {
    return {
      ...payload,
      id_descuento_catalogo: Number(selectedDiscountId)
    };
  }
  return payload;
};

export const buildPaidSalePayload = ({
  state,
  selectedSucursalId,
  cashValue,
  canApplyDiscount = false,
  cuentaDividida
}) =>
  applyDiscountPayloadFields({
    id_cliente: state.selectedClient === 'cf' ? null : Number(state.selectedClient),
    id_sucursal: selectedSucursalId,
    metodo_pago: state.paymentMethod,
    referencia_pago: state.paymentMethod !== 'efectivo' ? state.referenciaPago.trim() : null,
    efectivo_entregado: cashValue,
    id_sesion_caja: toNormalizedId(state.temporarySessionId),
    descripcion_pedido: null,
    items: buildVentaItemsPayload(state.cart, { canApplyDiscount }),
    ...(Array.isArray(cuentaDividida) ? { cuenta_dividida: cuentaDividida } : {})
  }, {
    canApplyDiscount,
    selectedDiscountId: state.selectedDiscountId
  });

export const buildPedidoPendientePayload = ({
  state,
  selectedSucursalId,
  canApplyDiscount = false,
  contacto,
  contexto,
  pagoPendiente,
  delivery,
  cuentaDividida
}) => {
  const descuentosLinea = buildDescuentosLineaPayload(state.cart, { canApplyDiscount });
  const payload = applyDiscountPayloadFields({
    id_cliente: state.selectedClient === 'cf' ? null : Number(state.selectedClient),
    id_sucursal: selectedSucursalId,
    items: buildVentaItemsPayload(state.cart, { canApplyDiscount }),
    id_sesion_caja: toNormalizedId(state.temporarySessionId),
    contacto,
    contexto,
    pago_pendiente: pagoPendiente,
    delivery,
    ...(Array.isArray(cuentaDividida) ? { cuenta_dividida: cuentaDividida } : {})
  }, {
    canApplyDiscount,
    selectedDiscountId: state.selectedDiscountId
  });
  if (descuentosLinea.length > 0) {
    payload.descuentos_linea = descuentosLinea;
  }
  return payload;
};
