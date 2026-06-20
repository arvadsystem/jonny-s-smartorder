import {
  normalizeValidComplementIds,
  normalizeExtras,
  toNormalizedId
} from './ventasCartUtils';

export const buildVentaItemsPayload = (cart, { canApplyDiscount = false } = {}) =>
  (Array.isArray(cart) ? cart : []).map((line) => {
    const isSimpleProduct = line.kind === 'PRODUCTO';
    const payload = {
      cart_key: line.cartKey,
      line_id: line.lineId || null,
      id_producto: line.id_producto,
      id_combo: line.id_combo,
      id_receta: line.id_receta,
      id_extra: line.kind === 'ITEM' ? line.id_extra : null,
      cantidad: isSimpleProduct ? Number(line.cantidad) : 1
    };
    if (line.kind === 'ITEM') {
      payload.cantidad = Number(line.cantidad);
    }
    const lineDiscountId = Number(line.id_descuento_catalogo_linea || 0);
    if (canApplyDiscount && lineDiscountId > 0) {
      payload.id_descuento_catalogo = lineDiscountId;
    }
    if (line.kind !== 'PRODUCTO') {
      payload.observacion = String(line.observacion || '').trim() || null;
    }
    const complementos = ['PRODUCTO', 'ITEM'].includes(line.kind)
      ? []
      : normalizeValidComplementIds(line);
    if (complementos.length > 0) {
      payload.complementos = complementos.map((id) => ({ id_complemento: id }));
    }
    if (!['PRODUCTO', 'ITEM'].includes(line.kind) && line.complementos_incompletos_autorizados) {
      payload.complementos_incompletos_autorizados = true;
    }
    const extras = line.kind === 'ITEM' ? [] : normalizeExtras(line.extras);
    if (extras.length > 0) {
      payload.extras = extras.map((entry) => ({
        id_extra: entry.id_extra,
        cantidad: entry.cantidad
      }));
    }
    return payload;
  });

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
    efectivo_entregado: state.paymentMethod === 'efectivo' ? cashValue : null,
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
  const items = buildVentaItemsPayload(state.cart, { canApplyDiscount });
  return applyDiscountPayloadFields({
    id_cliente: state.selectedClient === 'cf' ? null : Number(state.selectedClient),
    id_sucursal: selectedSucursalId,
    items,
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
};
