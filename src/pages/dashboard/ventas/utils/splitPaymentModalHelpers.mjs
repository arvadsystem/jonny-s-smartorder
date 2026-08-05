// HOTFIX (saldo dividido oculto, ronda 2 y 3): logica PURA extraida de
// VentaRegistrarPagoPedidoModal.jsx. Usada realmente por el componente
// (no duplicada solo para pruebas) -- ver
// routers/ventas/services/cuentaDivididaSplitService.js en el backend
// para el equivalente del lado servidor.
import { formatCurrency } from '../../../../modules/ventas/utils/ventasMoneyUtils.js';

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

// ---------------------------------------------------------------------
// Ronda 3: reconstruccion dinamica del modal despues de cada pago.
// ---------------------------------------------------------------------

// Clasifica las divisiones del pedido en PAGADA/PENDIENTE/ANULADA
// (seccion 10 del ticket). Las PAGADA se muestran como historial
// bloqueado; las PENDIENTE son seleccionables; las ANULADA solo en una
// seccion secundaria si acaso.
export const classifyDivisiones = (divisiones = []) => {
  const list = Array.isArray(divisiones) ? divisiones : [];
  return {
    paid: list.filter((division) => normalizeEstadoDivision(division) === 'PAGADA'),
    pending: list.filter((division) => normalizeEstadoDivision(division) === 'PENDIENTE'),
    cancelled: list.filter((division) => normalizeEstadoDivision(division) === 'ANULADA')
  };
};

const PAGADO_CONFIRMADO_CODES = new Set(['PAGADO_CONFIRMADO']);

// Fuente PRINCIPAL para decidir si el modal debe cerrarse tras un pago
// (seccion 7, paso 12): solo cuando el backend confirma monto_pendiente
// <= 0.05 -- nunca por una heuristica local como
// shouldExpectMoreSplitPayments, que solo sirve para armar el mensaje
// contextual, no para decidir el cierre.
export const shouldCloseModalAfterPayment = ({ estadoPago, montoPendiente } = {}) => {
  const pendiente = Number(montoPendiente ?? 0) || 0;
  if (pendiente > 0.05) return false;
  const estado = String(estadoPago || '').trim().toUpperCase();
  return PAGADO_CONFIRMADO_CODES.has(estado);
};

// Mensaje contextual cuando el pedido AUN tiene saldo pendiente tras un
// pago (seccion 6): usa el nombre real de la division cobrada y el saldo
// real devuelto por el backend -- nunca solo "Pago registrado
// correctamente."
export const buildPaymentContinuationMessage = ({ paidLabel, montoPendiente, nextLabel } = {}) => {
  const parts = [];
  parts.push(paidLabel ? `${paidLabel} pagada correctamente.` : 'Pago registrado correctamente.');
  parts.push(`Quedan ${formatCurrency(montoPendiente)} pendientes.`);
  if (nextLabel) parts.push(`Continúa con ${nextLabel}.`);
  return parts.join(' ');
};

// Mensaje final cuando el saldo llega a cero (seccion 6): solo en este
// momento se puede cerrar el modal automaticamente.
export const buildPaymentCompletionMessage = ({ montoTotal } = {}) => (
  `Cuenta pagada completamente. Total cobrado: ${formatCurrency(montoTotal)}.`
);

// Detecta lineas del borrador local que YA NO existen en el conjunto de
// lineas realmente disponibles segun la ultima respuesta del backend
// (seccion 8): el payload enviado siempre debe ser un subconjunto de las
// lineas activas y disponibles actuales -- nunca reenviar una linea que
// paso a pertenecer a una division PAGADA u otra PENDIENTE mientras el
// modal seguia abierto.
export const resolveStaleDraftItemIds = ({ draftItemIds = [], availableItemIds = [] } = {}) => {
  const available = availableItemIds instanceof Set ? availableItemIds : new Set(availableItemIds || []);
  return (Array.isArray(draftItemIds) ? draftItemIds : []).filter((id) => !available.has(id));
};

// Codigos de error del backend que indican que el pedido cambio mientras
// el cajero lo tenia abierto (linea ya facturada/asignada a otra
// subcuenta, o division duplicada dentro del mismo envio). Nunca se
// deben mostrar tal cual -- disparan un refresco y un mensaje claro en
// vez de un error tecnico (seccion 8).
const STALE_CUENTA_DIVIDIDA_ERROR_CODES = new Set([
  'CUENTA_DIVIDIDA_ITEM_NO_ENCONTRADO',
  'CUENTA_DIVIDIDA_ITEM_DUPLICADO',
  'CUENTA_DIVISION_NO_ENCONTRADA',
  'CUENTA_DIVISION_NO_PENDIENTE',
  'CUENTA_DIVISION_YA_FACTURADA',
  'CUENTA_DIVISION_YA_COBRADA',
  'PEDIDO_NO_PENDIENTE_PAGO',
  'PEDIDO_YA_PAGADO'
]);

export const isStaleCuentaDivididaError = (error) => (
  STALE_CUENTA_DIVIDIDA_ERROR_CODES.has(String(error?.code || '').trim().toUpperCase())
);

// Seccion 12: cuando queda EXACTAMENTE una linea sin asignar, no tiene
// sentido obligar al cajero a presionar "Agregar persona" y asignarla a
// mano -- se resuelve automaticamente sin ambiguedad. Con 2+ lineas
// (seccion 13) la asignacion debe requerir confirmacion explicita
// (pendingAutoAssignConfirm), porque existe mas de una distribucion
// posible.
export const resolveSingleLeftoverAutoAssignment = (unassignedItems = []) => {
  const items = Array.isArray(unassignedItems) ? unassignedItems : [];
  return items.length === 1 ? items[0] : null;
};
