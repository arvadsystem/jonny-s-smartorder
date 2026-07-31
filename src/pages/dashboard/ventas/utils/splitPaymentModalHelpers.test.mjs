// HOTFIX (saldo dividido oculto, ronda 2 y 3): pruebas ejecutables sobre
// las funciones puras realmente usadas por VentaRegistrarPagoPedidoModal.jsx.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  resolveActiveDivisionAssignedItemIds,
  computeFinancialSummary,
  resolveEstadoBadges,
  resolvePendingBalanceDisplay,
  shouldAutoActivateOrphanRecovery,
  resolveSplitDraftDivisionOrden,
  resolveCobrarDivisionOrden,
  classifyDivisiones,
  shouldCloseModalAfterPayment,
  buildPaymentContinuationMessage,
  buildPaymentCompletionMessage,
  resolveStaleDraftItemIds,
  isStaleCuentaDivididaError,
  resolveSingleLeftoverAutoAssignment
} from './splitPaymentModalHelpers.mjs';
import { canCobrarPedido } from './pedidosPendientesHelpers.mjs';

const persona1Pagada = {
  id_cuenta_division: 501,
  etiqueta: 'Persona 1',
  estado: 'PAGADA',
  monto_pagado: 170,
  monto_pendiente: 0,
  items: [{ id_detalle_pedido: 3833 }]
};

describe('1) Resumen total/pagado/pendiente (computeFinancialSummary)', () => {
  it('expone siempre los mismos campos normalizados, incluyendo estado_pedido y estado_pago', () => {
    const summary = computeFinancialSummary({
      monto_total: 510,
      monto_pagado: 170,
      monto_pendiente: 340,
      estado_pedido: 'completado',
      estado_pago: 'pendiente_pago',
      items_count: 3,
      items_asignados: 1,
      items_sin_asignar: 2
    });
    assert.deepEqual(summary, {
      montoTotal: 510,
      montoPagado: 170,
      montoPendiente: 340,
      estadoPedido: 'COMPLETADO',
      estadoPago: 'PENDIENTE_PAGO',
      items: 3,
      itemsAsignados: 1,
      itemsSinAsignar: 2
    });
  });

  it('pedido 2265: monto_total=510, monto_pagado=170, monto_pendiente=340 se conservan exactos', () => {
    const summary = computeFinancialSummary({ monto_total: 510, monto_pagado: 170, monto_pendiente: 340 });
    assert.equal(summary.montoTotal, 510);
    assert.equal(summary.montoPagado, 170);
    assert.equal(summary.montoPendiente, 340);
  });
});

describe('2) Saldo global cuando no hay division PENDIENTE seleccionada (resolvePendingBalanceDisplay)', () => {
  it('cuenta dividida activa, sin persona seleccionada -> NUNCA L 0.00, muestra el saldo global', () => {
    const display = resolvePendingBalanceDisplay({
      hasCuentaDividida: true,
      selectedDivisionPendiente: null,
      montoPendienteGlobal: 340
    });
    assert.equal(display.amount, 340);
    assert.equal(display.isGlobalFallback, true);
    assert.notEqual(display.amount, 0);
  });

  it('cuenta dividida con persona PENDIENTE seleccionada -> usa el saldo de esa persona', () => {
    const display = resolvePendingBalanceDisplay({
      hasCuentaDividida: true,
      selectedDivisionPendiente: { monto_pendiente: 170, total: 170 },
      montoPendienteGlobal: 340
    });
    assert.equal(display.amount, 170);
    assert.equal(display.isGlobalFallback, false);
  });

  it('borrador de division activo pero sin lineas asignadas todavia -> saldo global, no L 0.00', () => {
    const display = resolvePendingBalanceDisplay({
      hasSplitDraft: true,
      selectedDraftDivisionHasItems: false,
      selectedDraftDivisionTotal: 0,
      montoPendienteGlobal: 340
    });
    assert.equal(display.amount, 340);
    assert.equal(display.isGlobalFallback, true);
  });

  it('borrador de division con lineas asignadas -> usa el total real de esas lineas', () => {
    const display = resolvePendingBalanceDisplay({
      hasSplitDraft: true,
      selectedDraftDivisionHasItems: true,
      selectedDraftDivisionTotal: 170,
      montoPendienteGlobal: 340
    });
    assert.equal(display.amount, 170);
    assert.equal(display.isGlobalFallback, false);
  });
});

describe('3) Deteccion de lineas sin asignar (computeFinancialSummary.itemsSinAsignar)', () => {
  it('3 items totales, 1 asignado -> 2 sin asignar (pedido 2265: Persona1 asignada, 2 huerfanas)', () => {
    const summary = computeFinancialSummary({ items_count: 3, items_asignados: 1, items_sin_asignar: 2 });
    assert.equal(summary.itemsSinAsignar, 2);
  });
});

describe('4) Auto-activacion del modo de recuperacion (shouldAutoActivateOrphanRecovery) — pedido 2265', () => {
  it('cuenta dividida existente + sin division PENDIENTE + lineas sin asignar + saldo>0 -> se activa', () => {
    const activar = shouldAutoActivateOrphanRecovery({
      hasCuentaDividida: true,
      divisiones: [persona1Pagada],
      unassignedLineCount: 2,
      montoPendiente: 340
    });
    assert.equal(activar, true);
  });

  it('si ya existe una division PENDIENTE, NO se auto-activa (el cajero ya tiene a quien cobrar)', () => {
    const activar = shouldAutoActivateOrphanRecovery({
      hasCuentaDividida: true,
      divisiones: [persona1Pagada, { estado: 'PENDIENTE', items: [{ id_detalle_pedido: 3834 }] }],
      unassignedLineCount: 1,
      montoPendiente: 170
    });
    assert.equal(activar, false);
  });

  it('sin lineas sin asignar, no se activa (nada que recuperar)', () => {
    assert.equal(shouldAutoActivateOrphanRecovery({
      hasCuentaDividida: true,
      divisiones: [persona1Pagada],
      unassignedLineCount: 0,
      montoPendiente: 340
    }), false);
  });

  it('saldo en cero, no se activa aunque haya lineas tecnicamente sin asignar', () => {
    assert.equal(shouldAutoActivateOrphanRecovery({
      hasCuentaDividida: true,
      divisiones: [persona1Pagada],
      unassignedLineCount: 2,
      montoPendiente: 0
    }), false);
  });

  it('sin cuenta dividida, nunca se activa', () => {
    assert.equal(shouldAutoActivateOrphanRecovery({
      hasCuentaDividida: false,
      divisiones: [],
      unassignedLineCount: 2,
      montoPendiente: 340
    }), false);
  });
});

describe('5) Persona2/Persona3: orden visual de nuevas divisiones (resolveSplitDraftDivisionOrden)', () => {
  it('con Persona 1 existente (offset=1), Persona2 -> orden 2, Persona3 -> orden 3', () => {
    assert.equal(resolveSplitDraftDivisionOrden({ splitDraftLabelOffset: 1, index: 0 }), 2);
    assert.equal(resolveSplitDraftDivisionOrden({ splitDraftLabelOffset: 1, index: 1 }), 3);
  });

  it('sin cuenta dividida previa (offset=0), la primera division nueva es orden 1', () => {
    assert.equal(resolveSplitDraftDivisionOrden({ splitDraftLabelOffset: 0, index: 0 }), 1);
  });
});

describe('6) cobrar_division_orden correcto (resolveCobrarDivisionOrden) — nunca lleva el offset sumado', () => {
  it('pedido 2265: Persona 2 es la UNICA division del envio -> posicion 1 (no 2, aunque su etiqueta sea "Persona 2")', () => {
    assert.equal(resolveCobrarDivisionOrden({ selectedIndex: 0 }), 1);
  });

  it('segunda division del mismo envio -> posicion 2', () => {
    assert.equal(resolveCobrarDivisionOrden({ selectedIndex: 1 }), 2);
  });

  it('ninguna division seleccionada -> null (nunca 0 ni un valor ambiguo)', () => {
    assert.equal(resolveCobrarDivisionOrden({ selectedIndex: -1 }), null);
  });
});

describe('7) ANULADA no reserva lineas / 8) PAGADA si reserva (resolveActiveDivisionAssignedItemIds)', () => {
  it('7) una division ANULADA libera su linea para poder reasignarla', () => {
    const ids = resolveActiveDivisionAssignedItemIds([
      { estado: 'ANULADA', items: [{ id_detalle_pedido: 3834 }] }
    ]);
    assert.ok(!ids.has(3834));
  });

  it('8) una division PAGADA bloquea su linea (nunca se libera)', () => {
    const ids = resolveActiveDivisionAssignedItemIds([persona1Pagada]);
    assert.ok(ids.has(3833));
  });

  it('una division PENDIENTE tambien reserva su linea', () => {
    const ids = resolveActiveDivisionAssignedItemIds([{ estado: 'PENDIENTE', items: [{ id_detalle_pedido: 3835 }] }]);
    assert.ok(ids.has(3835));
  });
});

describe('9) COMPLETADO + PENDIENTE_PAGO se muestran como etiquetas separadas (resolveEstadoBadges)', () => {
  it('nunca se fusionan -- ambas etiquetas coexisten', () => {
    const badges = resolveEstadoBadges({ estado_pedido: 'COMPLETADO', estado_pago: 'PENDIENTE_PAGO' });
    assert.deepEqual(badges.operational, { code: 'COMPLETADO', label: 'Pedido completado' });
    assert.deepEqual(badges.financial, { code: 'PENDIENTE_PAGO', label: 'Pago pendiente' });
  });

  it('un pedido pagado no muestra la etiqueta financiera "Pago pendiente"', () => {
    const badges = resolveEstadoBadges({ estado_pedido: 'COMPLETADO', estado_pago: 'PAGADO_CONFIRMADO' });
    assert.equal(badges.financial, null);
    assert.deepEqual(badges.operational, { code: 'COMPLETADO', label: 'Pedido completado' });
  });
});

describe('10) NO_ENTREGADO segun la decision confirmada (Caso A: no bloquea el cobro)', () => {
  it('resolveEstadoBadges etiqueta NO_ENTREGADO como estado operativo, independiente del financiero', () => {
    const badges = resolveEstadoBadges({ estado_pedido: 'NO_ENTREGADO', estado_pago: 'PENDIENTE_PAGO' });
    assert.deepEqual(badges.operational, { code: 'NO_ENTREGADO', label: 'No entregado' });
    assert.deepEqual(badges.financial, { code: 'PENDIENTE_PAGO', label: 'Pago pendiente' });
  });

  it('canCobrarPedido nunca inspecciona estado_pedido -- un pedido NO_ENTREGADO con saldo pendiente sigue siendo cobrable', () => {
    const pedido = {
      estado_pedido: 'NO_ENTREGADO',
      estado_pago_control: 'PENDIENTE_PAGO',
      monto_pendiente: 340,
      id_factura: 2277
    };
    assert.equal(canCobrarPedido(pedido), true);
  });
});

// ---------------------------------------------------------------------
// Ronda 3: reconstruccion dinamica del modal tras cada pago (los 20
// escenarios pedidos en el ticket, numerados igual que la seccion 14).
// ---------------------------------------------------------------------
const persona2Pendiente = {
  id_cuenta_division: 502,
  etiqueta: 'Persona 2',
  estado: 'PENDIENTE',
  total: 170,
  monto_pagado: 0,
  monto_pendiente: 170,
  items: [{ id_detalle_pedido: 3834 }]
};

const persona3PendienteOtra = {
  id_cuenta_division: 503,
  etiqueta: 'Persona 3',
  estado: 'PENDIENTE',
  total: 380,
  monto_pagado: 0,
  monto_pendiente: 380,
  items: [{ id_detalle_pedido: 3835 }]
};

describe('1) Persona pagada nunca vuelve a ser persona activa', () => {
  it('classifyDivisiones nunca coloca una division PAGADA en pending', () => {
    const { pending } = classifyDivisiones([persona1Pagada, persona2Pendiente]);
    assert.ok(!pending.some((d) => d.id_cuenta_division === persona1Pagada.id_cuenta_division));
    assert.equal(pending.length, 1);
    assert.equal(pending[0].id_cuenta_division, persona2Pendiente.id_cuenta_division);
  });
});

describe('2/9) Linea PAGADA no aparece en disponibles ni puede reasignarse', () => {
  it('resolveActiveDivisionAssignedItemIds reserva la linea de una division PAGADA de forma permanente', () => {
    const ids = resolveActiveDivisionAssignedItemIds([persona1Pagada]);
    assert.ok(ids.has(3833));
  });
});

describe('10) Linea PENDIENTE de otra persona no puede reasignarse', () => {
  it('resolveActiveDivisionAssignedItemIds reserva tambien las lineas de divisiones PENDIENTE', () => {
    const ids = resolveActiveDivisionAssignedItemIds([persona2Pendiente, persona3PendienteOtra]);
    assert.ok(ids.has(3834));
    assert.ok(ids.has(3835));
  });
});

describe('11) Linea ANULADA vuelve a estar disponible unicamente cuando corresponde', () => {
  it('una division ANULADA no reserva su linea (vuelve a estar disponible)', () => {
    const anulada = { id_cuenta_division: 999, estado: 'ANULADA', items: [{ id_detalle_pedido: 4001 }] };
    const ids = resolveActiveDivisionAssignedItemIds([anulada]);
    assert.ok(!ids.has(4001));
  });

  it('una division PAGADA (nunca ANULADA) jamas libera su linea, aunque el pedido tenga otras ANULADA', () => {
    const anulada = { id_cuenta_division: 999, estado: 'ANULADA', items: [{ id_detalle_pedido: 4001 }] };
    const ids = resolveActiveDivisionAssignedItemIds([persona1Pagada, anulada]);
    assert.ok(ids.has(3833));
    assert.ok(!ids.has(4001));
  });
});

describe('5/6) Cierre del modal SOLO cuando el backend confirma saldo cero (shouldCloseModalAfterPayment)', () => {
  it('5) PAGADO_CONFIRMADO + monto_pendiente=0 -> cierra', () => {
    assert.equal(shouldCloseModalAfterPayment({ estadoPago: 'PAGADO_CONFIRMADO', montoPendiente: 0 }), true);
  });

  it('6) PENDIENTE_PAGO + saldo>0 -> permanece abierto', () => {
    assert.equal(shouldCloseModalAfterPayment({ estadoPago: 'PENDIENTE_PAGO', montoPendiente: 380 }), false);
  });

  it('nunca cierra por una heuristica local -- solo por el saldo real devuelto por el backend (redondeo <= 0.05)', () => {
    assert.equal(shouldCloseModalAfterPayment({ estadoPago: 'PAGADO_CONFIRMADO', montoPendiente: 0.04 }), true);
    assert.equal(shouldCloseModalAfterPayment({ estadoPago: 'PENDIENTE_PAGO', montoPendiente: 0.5 }), false);
  });

  it('saldo cero sin PAGADO_CONFIRMADO no cierra el modal', () => {
    assert.equal(shouldCloseModalAfterPayment({ estadoPago: 'PENDIENTE_PAGO', montoPendiente: 0 }), false);
    assert.equal(shouldCloseModalAfterPayment({ estadoPago: '', montoPendiente: 0 }), false);
  });
});

describe('12) El mensaje de continuidad usa el nombre real de la persona pagada y el saldo real', () => {
  it('incluye la etiqueta pagada, el saldo formateado y la siguiente persona', () => {
    const message = buildPaymentContinuationMessage({ paidLabel: 'Persona 1', montoPendiente: 550, nextLabel: 'Persona 2' });
    assert.match(message, /Persona 1 pagada correctamente\./);
    assert.match(message, /Quedan L 550\.00 pendientes\./);
    assert.match(message, /Continúa con Persona 2\./);
  });

  it('sin siguiente persona conocida, omite la frase "Continúa con" (no inventa un nombre)', () => {
    const message = buildPaymentContinuationMessage({ paidLabel: 'Persona 1', montoPendiente: 550, nextLabel: null });
    assert.doesNotMatch(message, /Continúa con/);
  });

  it('mensaje final cuando el saldo llega a cero usa el total real cobrado', () => {
    const message = buildPaymentCompletionMessage({ montoTotal: 690 });
    assert.equal(message, 'Cuenta pagada completamente. Total cobrado: L 690.00.');
  });
});

describe('13/14) Pagadas conserva historial completo; Pendientes solo contiene PENDIENTE', () => {
  it('13) classifyDivisiones.paid conserva TODAS las divisiones pagadas, no solo la ultima', () => {
    const otraPagada = { id_cuenta_division: 504, estado: 'PAGADA', items: [] };
    const { paid } = classifyDivisiones([persona1Pagada, otraPagada, persona2Pendiente]);
    assert.equal(paid.length, 2);
  });

  it('14) classifyDivisiones.pending nunca incluye PAGADA ni ANULADA', () => {
    const anulada = { id_cuenta_division: 999, estado: 'ANULADA', items: [] };
    const { pending } = classifyDivisiones([persona1Pagada, persona2Pendiente, anulada]);
    assert.equal(pending.length, 1);
    assert.equal(pending[0].id_cuenta_division, persona2Pendiente.id_cuenta_division);
  });
});

describe('8/16) itemIds obsoletos nunca se envian (resolveStaleDraftItemIds)', () => {
  it('8) detecta un id del borrador que ya no esta en las lineas disponibles actuales', () => {
    const stale = resolveStaleDraftItemIds({ draftItemIds: [3833, 3834], availableItemIds: [3834, 3835] });
    assert.deepEqual(stale, [3833]);
  });

  it('16) sin ids obsoletos, el arreglo resultante esta vacio (se puede enviar el pago)', () => {
    const stale = resolveStaleDraftItemIds({ draftItemIds: [3834], availableItemIds: [3834, 3835] });
    assert.deepEqual(stale, []);
  });

  it('acepta un Set para availableItemIds sin duplicar logica de conversion', () => {
    const stale = resolveStaleDraftItemIds({ draftItemIds: [3833], availableItemIds: new Set([3834]) });
    assert.deepEqual(stale, [3833]);
  });
});

describe('17) Error de linea inexistente/duplicada provoca reconstruccion segura (isStaleCuentaDivididaError)', () => {
  it('reconoce los codigos de conflicto que indican que el pedido cambio mientras se cobraba', () => {
    const staleCodes = [
      'CUENTA_DIVIDIDA_ITEM_NO_ENCONTRADO',
      'CUENTA_DIVIDIDA_ITEM_DUPLICADO',
      'CUENTA_DIVISION_NO_ENCONTRADA',
      'CUENTA_DIVISION_NO_PENDIENTE',
      'CUENTA_DIVISION_YA_FACTURADA',
      'CUENTA_DIVISION_YA_COBRADA',
      'PEDIDO_NO_PENDIENTE_PAGO',
      'PEDIDO_YA_PAGADO'
    ];
    staleCodes.forEach((code) => assert.equal(isStaleCuentaDivididaError({ code }), true, code));
  });

  it('un error no relacionado (ej. de red) nunca dispara la reconstruccion silenciosa', () => {
    assert.equal(isStaleCuentaDivididaError({ code: 'HTTP_ERROR' }), false);
    assert.equal(isStaleCuentaDivididaError({}), false);
  });
});

describe('19/20) Una sola persona restante se asigna sola; varias requieren confirmacion', () => {
  it('19) exactamente una linea sobrante -> se resuelve automaticamente sin ambiguedad', () => {
    const item = { id_detalle_pedido: 3835, nombre_item: '18 ALITAS', total_linea: 380 };
    assert.deepEqual(resolveSingleLeftoverAutoAssignment([item]), item);
  });

  it('20) varias lineas sobrantes -> no hay asignacion automatica sin ambiguedad (requiere confirmacion explicita)', () => {
    const items = [
      { id_detalle_pedido: 3834, total_linea: 170 },
      { id_detalle_pedido: 3835, total_linea: 380 }
    ];
    assert.equal(resolveSingleLeftoverAutoAssignment(items), null);
  });

  it('sin lineas sobrantes, no hay nada que asignar', () => {
    assert.equal(resolveSingleLeftoverAutoAssignment([]), null);
  });
});
