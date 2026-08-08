// Incidente: POST /ventas/pedidos-pendientes fallaba y el POS quedaba bloqueado
// mostrando "RESULTADO PENDIENTE" o "Existe una operación en otra pestaña" incluso
// sin otra pestaña real y tras recargar. CajaView.jsx es un componente React sin
// jsdom/Testing Library disponible en este proyecto -- esta prueba lee el codigo
// fuente y confirma, de forma ejecutable, que el boton "Abandonar operación" ya
// esta disponible para el caso huerfano (registro de coordinacion sin payload,
// lease vencido), no solo cuando canRecoverPedidoPendiente es true. La logica de
// estados en si vive en ventasServicePendingOrderIdempotency.test.mjs.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('src/pages/dashboard/ventas/components/CajaView.jsx'), 'utf8');

describe('Fix: candado huerfano de pedido pendiente ya no bloquea el POS para siempre', () => {
  it('define canAbandonOrphanPedidoPendiente para el caso sin payload + lease vencido', () => {
    assert.match(
      source,
      /const canAbandonOrphanPedidoPendiente = Boolean\(visiblePedidoPendienteOperation\)\s*&&\s*visiblePedidoPendienteOperation\.hasRecoveryPayload === false\s*&&\s*Boolean\(visiblePedidoPendienteOperation\.leaseExpired\);/,
      'Debe existir una condicion explicita para el registro huerfano (coordinacion sin payload, lease vencido).'
    );
  });

  it('el boton "Abandonar operación" se habilita tambien cuando el registro es huerfano, no solo cuando canRecoverPedidoPendiente', () => {
    const buttonBlockIdx = source.indexOf('Abandonar operación');
    assert.notEqual(buttonBlockIdx, -1, 'No se encontro el boton de abandonar.');
    const before = source.slice(Math.max(0, buttonBlockIdx - 400), buttonBlockIdx);
    assert.match(
      before,
      /canRecoverPedidoPendiente \|\| canAbandonOrphanPedidoPendiente \? \(/,
      'El boton debe renderizarse tambien para el caso huerfano, no solo cuando canRecoverPedidoPendiente es true (si no, el usuario no tiene ninguna accion disponible en la UI).'
    );
  });

  it('el mensaje del banner distingue el caso huerfano-recuperable del caso "otra pestaña activa"', () => {
    assert.match(
      source,
      /canAbandonOrphanPedidoPendiente\s*\n\s*\? 'Existe un registro de una operación en otra pestaña, pero su tiempo de espera ya venció\. Puedes liberarlo para continuar vendiendo\.'/,
      'Debe existir copy especifico indicando que el lock puede liberarse cuando el lease vencio.'
    );
  });
});
