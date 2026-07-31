// HOTFIX (saldo dividido oculto): canCobrarPedido ya NO debe bloquear el
// cobro solo porque exista id_factura (Escenario D del ticket: factura
// parcial + monto_pendiente > 0 => puede_cobrar debe ser true).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canCobrarPedido, isPedidoPendientePago, normalizePaymentCode } from './pedidosPendientesHelpers.mjs';

describe('normalizePaymentCode', () => {
  it('normaliza acentos, mayusculas y separadores', () => {
    assert.equal(normalizePaymentCode('pendiente-pago'), 'PENDIENTE_PAGO');
    assert.equal(normalizePaymentCode('Pendiente de Pago'), 'PENDIENTE_DE_PAGO');
  });
});

describe('isPedidoPendientePago', () => {
  it('reconoce PENDIENTE_PAGO desde estado_pago_control', () => {
    assert.equal(isPedidoPendientePago({ estado_pago_control: 'pendiente_pago' }), true);
  });
  it('reconoce PENDIENTE_DE_PAGO desde estado_pago (legacy)', () => {
    assert.equal(isPedidoPendientePago({ estado_pago: 'Pendiente de Pago' }), true);
  });
  it('PAGADO_CONFIRMADO no es pendiente', () => {
    assert.equal(isPedidoPendientePago({ estado_pago_control: 'PAGADO_CONFIRMADO' }), false);
  });
});

describe('canCobrarPedido — Escenario D (factura parcial + saldo pendiente)', () => {
  it('backend envia puede_cobrar=true -> se respeta directamente (fuente principal)', () => {
    assert.equal(canCobrarPedido({ puede_cobrar: true, id_factura: 2277, monto_pendiente: 0 }), true);
  });

  it('backend envia puede_cobrar=false -> se respeta directamente aunque el fallback diria otra cosa', () => {
    assert.equal(canCobrarPedido({ puede_cobrar: false, estado_pago_control: 'PENDIENTE_PAGO', monto_pendiente: 340 }), false);
  });

  it('HOTFIX: sin puede_cobrar del backend, id_factura presente (cuenta dividida parcial) YA NO bloquea el cobro', () => {
    const pedido = {
      estado_pago_control: 'PENDIENTE_PAGO',
      monto_pendiente: 340,
      id_factura: 2277 // factura 2277 del incidente VTA-00034 / pedido 2265
    };
    assert.equal(canCobrarPedido(pedido), true, 'una factura parcial no debe impedir seguir cobrando el saldo restante');
  });

  it('sin puede_cobrar del backend, sin id_factura, con saldo pendiente -> cobrable (comportamiento previo intacto)', () => {
    assert.equal(canCobrarPedido({ estado_pago_control: 'PENDIENTE_PAGO', monto_pendiente: 510 }), true);
  });

  it('sin puede_cobrar del backend, monto_pendiente=0 -> no cobrable', () => {
    assert.equal(canCobrarPedido({ estado_pago_control: 'PENDIENTE_PAGO', monto_pendiente: 0, id_factura: null }), false);
  });

  it('sin puede_cobrar del backend, estado_pago distinto de PENDIENTE_PAGO -> no cobrable aunque haya saldo numerico', () => {
    assert.equal(canCobrarPedido({ estado_pago_control: 'PAGADO_CONFIRMADO', monto_pendiente: 10 }), false);
  });
});
