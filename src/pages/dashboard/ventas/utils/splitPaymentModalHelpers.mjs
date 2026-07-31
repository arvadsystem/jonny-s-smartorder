// HOTFIX (saldo dividido oculto, ronda 2): logica PURA extraida de
// VentaRegistrarPagoPedidoModal.jsx. Usada realmente por el componente
// (no duplicada solo para pruebas) -- ver
// routers/ventas/services/cuentaDivididaSplitService.js en el backend
// para el equivalente del lado servidor.

const normalizeEstadoDivision = (division) => String(division?.estado || '').trim().toUpperCase();

export const isDivisionAnulada = (division) => normalizeEstadoDivision(division) === 'ANULADA';

// Lineas reservadas por la cuenta dividida actual: cualquier division
// ACTIVA (PAGADA o PENDIENTE) reserva sus lineas. Una division ANULADA
// nunca reserva -- sus lineas vuelven a estar disponibles para una
// persona nueva (correccion #6).
export const resolveActiveDivisionAssignedItemIds = (divisiones = []) => {
  const ids = new Set();
  for (const division of Array.isArray(divisiones) ? divisiones : []) {
    if (isDivisionAnulada(division)) continue;
    const items = Array.isArray(division?.items) ? division.items : [];
    for (const item of items) {
      const id = Number(item?.id_detalle_pedido);
      if (Number.isInteger(id) && id > 0) ids.add(id);
    }
  }
  return ids;
};

// Resumen financiero completo (correccion #2): siempre expone los mismos
// campos, sin importar si el pedido tiene cuenta dividida o no.
export const computeFinancialSummary = (pedido) => ({
  montoTotal: Number(pedido?.monto_total ?? 0) || 0,
  montoPagado: Number(pedido?.monto_pagado ?? 0) || 0,
  montoPendiente: Number(pedido?.monto_pendiente ?? 0) || 0,
  estadoPedido: String(pedido?.estado_pedido || '').trim().toUpperCase(),
  estadoPago: String(pedido?.estado_pago || pedido?.estado_pago_control || '').trim().toUpperCase(),
  items: Number(pedido?.items_count ?? 0) || 0,
  itemsAsignados: Number(pedido?.items_asignados ?? 0) || 0,
  itemsSinAsignar: Number(pedido?.items_sin_asignar ?? 0) || 0
});

const ESTADO_PEDIDO_LABELS = {
  COMPLETADO: 'Pedido completado',
  NO_ENTREGADO: 'No entregado',
  EN_COCINA: 'En cocina',
  LISTO_PARA_ENTREGA: 'Listo para entrega',
  PENDIENTE: 'Pendiente',
  CANCELADO: 'Cancelado'
};

const PENDIENTE_PAGO_CODES = new Set(['PENDIENTE_PAGO', 'PENDIENTE_DE_PAGO']);

// Estado operativo y financiero como etiquetas SEPARADAS (correccion #3):
// nunca deben fusionarse en una sola. Un pedido COMPLETADO con pago
// PENDIENTE_PAGO debe mostrar ambas etiquetas a la vez.
export const resolveEstadoBadges = (pedido) => {
  const estadoPedido = String(pedido?.estado_pedido || '').trim().toUpperCase();
  const estadoPago = String(pedido?.estado_pago || pedido?.estado_pago_control || '').trim().toUpperCase();
  return {
    operational: estadoPedido
      ? { code: estadoPedido, label: ESTADO_PEDIDO_LABELS[estadoPedido] || estadoPedido }
      : null,
    financial: PENDIENTE_PAGO_CODES.has(estadoPago)
      ? { code: estadoPago, label: 'Pago pendiente' }
      : null
  };
};

// Que monto/etiqueta mostrar como "pendiente" (correccion #2): nunca
// "L 0.00" cuando existe cuenta dividida pero todavia no hay una persona
// PENDIENTE seleccionada, ni cuando el borrador de division nueva esta
// activo pero todavia no tiene lineas asignadas -- en ambos casos se
// muestra el saldo GLOBAL del pedido con una etiqueta que deja claro que
// no es el monto de una persona puntual.
export const resolvePendingBalanceDisplay = ({
  hasSplitDraft = false,
  hasCuentaDividida = false,
  selectedDivisionPendiente = null,
  selectedDraftDivisionTotal = 0,
  selectedDraftDivisionHasItems = false,
  montoPendienteGlobal = 0
} = {}) => {
  if (hasSplitDraft) {
    if (!selectedDraftDivisionHasItems) {
      return {
        amount: Number(montoPendienteGlobal || 0) || 0,
        isGlobalFallback: true,
        label: 'Total pendiente del pedido (asigna lineas a esta persona)'
      };
    }
    return {
      amount: Number(selectedDraftDivisionTotal || 0) || 0,
      isGlobalFallback: false,
      label: 'Total pendiente persona'
    };
  }
  if (hasCuentaDividida) {
    if (selectedDivisionPendiente) {
      return {
        amount: Number(selectedDivisionPendiente.monto_pendiente ?? selectedDivisionPendiente.total ?? 0) || 0,
        isGlobalFallback: false,
        label: 'Total pendiente persona'
      };
    }
    return {
      amount: Number(montoPendienteGlobal || 0) || 0,
      isGlobalFallback: true,
      label: 'Total pendiente del pedido (sin persona seleccionada)'
    };
  }
  return { amount: Number(montoPendienteGlobal || 0) || 0, isGlobalFallback: false, label: 'Total pendiente' };
};

// Activacion automatica del modo de recuperacion de lineas huerfanas
// (correccion #4): cuenta dividida existente + ninguna division
// PENDIENTE + lineas activas sin asignar + saldo>0. Cubre exactamente el
// caso del pedido 2265 (Persona 1 pagada, 2 lineas huerfanas, saldo>0).
export const shouldAutoActivateOrphanRecovery = ({
  hasCuentaDividida = false,
  divisiones = [],
  unassignedLineCount = 0,
  montoPendiente = 0
} = {}) => {
  if (!hasCuentaDividida) return false;
  if (Number(montoPendiente || 0) <= 0) return false;
  if (Number(unassignedLineCount || 0) <= 0) return false;
  const hasPendingDivision = (Array.isArray(divisiones) ? divisiones : []).some((division) => (
    normalizeEstadoDivision(division) === 'PENDIENTE'
  ));
  return !hasPendingDivision;
};

// Orden mostrado/enviado para cada division nueva del borrador
// (correccion #1). El backend NUNCA confia en este valor -- siempre lo
// recalcula desde el maximo orden existente -- pero el frontend igual
// debe enviarlo de forma consistente con el numero de "Persona" visible
// en pantalla (splitDraftLabelOffset + index + 1).
export const resolveSplitDraftDivisionOrden = ({ splitDraftLabelOffset = 0, index = 0 } = {}) => (
  Number(splitDraftLabelOffset || 0) + Number(index || 0) + 1
);

// Posicion (1-based) de la division seleccionada DENTRO del envio actual
// de cuenta_dividida (correccion #1). El backend identifica la division
// a cobrar por su POSICION en el arreglo submitted (selectNewDivisionToCharge),
// nunca por el valor de orden -- por eso este valor jamas debe llevar
// splitDraftLabelOffset sumado: sumarlo rompe la seleccion en cuanto el
// envio actual tiene menos divisiones que el offset visual sugeriria
// (caso real del pedido 2265: Persona 1 ya esta paga, Persona 2 es la
// UNICA division de este envio -> posicion 1, aunque su etiqueta visual
// sea "Persona 2").
export const resolveCobrarDivisionOrden = ({ selectedIndex = -1 } = {}) => (
  Number.isInteger(selectedIndex) && selectedIndex >= 0 ? selectedIndex + 1 : null
);
