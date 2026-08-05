// HOTFIX (saldo dividido oculto): logica pura extraida de PedidosView.jsx
// para poder probarla con `node --test` (este repo no tiene
// @testing-library/react ni jsdom instalados, y esta prueba no debe
// agregar dependencias nuevas). Mismo patron ya usado en este directorio
// (ver ventaReversionFlow.test.mjs, ventasDetailSummary.test.mjs).
export const normalizePaymentCode = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');

export const isPedidoPendientePago = (pedido) => {
  const code = normalizePaymentCode(pedido?.estado_pago_control || pedido?.estado_pago);
  return code === 'PENDIENTE_PAGO' || code === 'PENDIENTE_DE_PAGO';
};

// La fuente de verdad principal es pedido.puede_cobrar, enviado por el
// backend (GET /ventas/pedidos-pendientes y GET /ventas/:id), calculado
// unicamente a partir de estado_pago + monto_pendiente. El fallback (solo
// se usa si el backend no envia el campo) tampoco debe depender de
// id_factura: una factura parcial de una cuenta dividida no significa que
// el pedido este totalmente pagado -- bloquear el cobro por eso era la
// causa exacta de que el saldo restante desapareciera del flujo de cobro.
export const canCobrarPedido = (pedido) => {
  if (pedido?.puede_cobrar === true) return true;
  if (pedido?.puede_cobrar === false) return false;
  return (
    isPedidoPendientePago(pedido) &&
    (Number(pedido?.monto_pendiente ?? 0) || 0) > 0
  );
};
