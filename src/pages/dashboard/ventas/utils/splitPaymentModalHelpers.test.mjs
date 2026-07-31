// HOTFIX (saldo dividido oculto, ronda 2): pruebas ejecutables sobre las
// funciones puras realmente usadas por VentaRegistrarPagoPedidoModal.jsx.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  resolveActiveDivisionAssignedItemIds,
  computeFinancialSummary,
  resolveEstadoBadges,
  resolvePendingBalanceDisplay,
  shouldAutoActivateOrphanRecovery,
  resolveSplitDraftDivisionOrden,
  resolveCobrarDivisionOrden
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
