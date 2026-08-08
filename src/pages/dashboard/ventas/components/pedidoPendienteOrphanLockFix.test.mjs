// Incidente (ronda 1): POST /ventas/pedidos-pendientes fallaba y el POS quedaba
// bloqueado mostrando "RESULTADO PENDIENTE" / "Existe una operación en otra pestaña"
// incluso sin otra pestaña real y tras recargar.
//
// Hallazgo de auditoria (ronda 2): la solucion de la ronda 1 permitia "Abandonar
// operación" para un registro huerfano (otra pestaña, sin payload) con solo
// leaseExpired=true. Eso es incorrecto: leaseExpired describe unicamente si sigue
// existiendo una pestaña dueña del navegador, NUNCA si el pedido existe o no en el
// servidor. Un UNKNOWN real solo puede liberarse cuando el servidor confirma un
// estado terminal (FAILED) via GET /ventas/idempotency-result con la MISMA
// idempotency-key -- nunca solo por vencimiento de lease.
//
// CajaView.jsx es un componente React sin jsdom/Testing Library disponible en este
// proyecto -- esta prueba lee el codigo fuente y confirma, de forma ejecutable, que:
//   1. el registro huerfano YA NO ofrece "Abandonar operación" como accion primaria;
//   2. en su lugar ofrece "Verificar resultado", que reconcilia con el servidor;
//   3. "Abandonar operación" solo aparece para el caso con payload propio (riesgo
//      consciente y explicito del propio operador, no relacionado con este incidente).
// La logica de estados en si vive en ventasServicePendingOrderIdempotency.test.mjs.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('src/pages/dashboard/ventas/components/CajaView.jsx'), 'utf8');

describe('Fix (ronda 2): candado huerfano ya no se libera solo por leaseExpired -- requiere verificar con el servidor', () => {
  it('ya NO existe canAbandonOrphanPedidoPendiente (el bypass de la ronda 1 fue eliminado)', () => {
    assert.doesNotMatch(
      source,
      /canAbandonOrphanPedidoPendiente/,
      'El bypass de abandono para el caso huerfano debe estar completamente eliminado, no solo renombrado.'
    );
  });

  it('define canVerifyOrphanPedidoPendiente para el caso sin payload + lease vencido', () => {
    assert.match(
      source,
      /const canVerifyOrphanPedidoPendiente = Boolean\(visiblePedidoPendienteOperation\)\s*&&\s*visiblePedidoPendienteOperation\.hasRecoveryPayload === false\s*&&\s*Boolean\(visiblePedidoPendienteOperation\.leaseExpired\);/,
      'Debe existir una condicion explicita para el registro huerfano (coordinacion sin payload, lease vencido) que habilite VERIFICAR, no abandonar.'
    );
  });

  it('el boton "Abandonar operación" ya NO se habilita para el caso huerfano -- solo para canRecoverPedidoPendiente (payload propio)', () => {
    const buttonBlockIdx = source.indexOf('Abandonar operación');
    assert.notEqual(buttonBlockIdx, -1, 'No se encontro el boton de abandonar.');
    const before = source.slice(Math.max(0, buttonBlockIdx - 400), buttonBlockIdx);
    assert.match(
      before,
      /\{canRecoverPedidoPendiente \? \(/,
      'El boton de abandonar debe depender unicamente de canRecoverPedidoPendiente (payload propio), nunca del caso huerfano.'
    );
    assert.doesNotMatch(
      before,
      /canVerifyOrphanPedidoPendiente/,
      'canVerifyOrphanPedidoPendiente no debe habilitar el boton de abandonar.'
    );
  });

  it('existe un boton "Verificar resultado" habilitado por canVerifyOrphanPedidoPendiente, que llama a handleReconcilePedidoPendiente', () => {
    const idx = source.indexOf("{verifyingPedidoPendiente ? 'Verificando...' : 'Verificar resultado'}");
    assert.notEqual(idx, -1, 'Debe existir el boton JSX "Verificar resultado".');
    const before = source.slice(Math.max(0, idx - 400), idx);
    assert.match(before, /canVerifyOrphanPedidoPendiente \? \(/);
    assert.match(before, /onClick=\{\(\) => handleReconcilePedidoPendiente\(\)\}/);
  });

  it('handleReconcilePedidoPendiente reconcilia via ventasService.reconcilePedidoPendienteOperation (misma idempotency-key, sin generar una nueva)', () => {
    const idx = source.indexOf('const handleReconcilePedidoPendiente');
    assert.notEqual(idx, -1);
    const snippet = source.slice(idx, idx + 1600);
    assert.match(snippet, /ventasService\.reconcilePedidoPendienteOperation\(target\.operationId, \{/);
    assert.match(snippet, /if \(result\.status === 'SUCCESS'\) \{/);
    assert.match(snippet, /if \(result\.status === 'FAILED'\) \{/);
  });

  it('la reconciliacion automatica se dispara UNA sola vez por operacion (guardada en un ref), no en cada render/poll', () => {
    const idx = source.indexOf('autoReconciledPedidoPendienteIdsRef');
    assert.notEqual(idx, -1, 'Debe existir un mecanismo para no repetir la reconciliacion automatica indefinidamente.');
    assert.match(source, /const autoReconciledPedidoPendienteIdsRef = useRef\(new Set\(\)\);/);
    assert.match(
      source,
      /if \(!operationId \|\| autoReconciledPedidoPendienteIdsRef\.current\.has\(operationId\)\) return;\s*\n\s*autoReconciledPedidoPendienteIdsRef\.current\.add\(operationId\);/,
      'Debe marcar la operacion como intentada antes de reconciliar, para no reintentar en cada render.'
    );
  });

  it('el mensaje del banner para el caso huerfano ya no promete "liberar" -- indica que se debe verificar con el servidor', () => {
    assert.doesNotMatch(
      source,
      /Puedes liberarlo para continuar vendiendo/,
      'El copy de la ronda 1 sugeria que el lease vencido por si solo autorizaba liberar el candado -- eso ya no es correcto.'
    );
    assert.match(
      source,
      /No se puede reintentar desde aquí; verifica con el servidor antes de continuar vendiendo\./
    );
  });
});
