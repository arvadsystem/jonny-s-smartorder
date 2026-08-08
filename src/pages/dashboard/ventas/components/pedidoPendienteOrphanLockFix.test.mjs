// Incidente (ronda 1): POST /ventas/pedidos-pendientes fallaba y el POS quedaba
// bloqueado mostrando "RESULTADO PENDIENTE" / "Existe una operación en otra pestaña"
// incluso sin otra pestaña real y tras recargar.
//
// Ronda 2: se prohibio liberar un registro huerfano (otra pestaña, sin payload) solo
// porque su lease vencio.
//
// Ronda 3 (este archivo): la auditoria encontro que un UNKNOWN CON payload propio
// todavia podia "Abandonar operación" (explicit=true), lo que permitia borrar el
// operationId/idempotency-key de un pedido que el servidor pudo haber creado y
// duplicarlo en el siguiente intento. La regla final: NINGUN UNKNOWN (con o sin
// payload) puede abandonarse directamente. Por eso "Abandonar operación" se elimino
// por completo de este banner -- la unica accion posible para un lock visible aqui es
// verificar con el servidor (reutilizando "Recuperar pedido"/"Verificar resultado",
// que ahora reconcilian antes de decidir).
//
// CajaView.jsx es un componente React sin jsdom/Testing Library disponible en este
// proyecto -- esta prueba lee el codigo fuente y confirma, de forma ejecutable, que:
//   1. "Abandonar operación" y handleAbandonPedidoPendiente ya no existen en el archivo;
//   2. el banner de pedido pendiente solo ofrece "Recuperar pedido" (payload propio,
//      reconcilia antes de decidir) y "Verificar resultado" (huerfano, solo lectura);
//   3. la reconciliacion automatica del huerfano se dispara una sola vez, sin polling.
// La logica de estados en si vive en ventasServicePendingOrderIdempotency.test.mjs.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('src/pages/dashboard/ventas/components/CajaView.jsx'), 'utf8');

describe('Fix (ronda 3): ningun UNKNOWN puede abandonarse directamente -- "Abandonar operación" eliminado del banner', () => {
  it('ya NO existe canAbandonOrphanPedidoPendiente (bypass de la ronda 1, eliminado en ronda 2)', () => {
    assert.doesNotMatch(source, /canAbandonOrphanPedidoPendiente/);
  });

  it('"Abandonar operación" y handleAbandonPedidoPendiente ya NO existen como JSX/handler en CajaView.jsx', () => {
    // Solo se prohibe el JSX/handler reales; los comentarios que documentan la
    // eliminacion (para auditoria futura) pueden seguir mencionando el texto.
    assert.doesNotMatch(
      source,
      />\s*Abandonar operación\s*</,
      'No debe existir ningun boton JSX con el texto "Abandonar operación".'
    );
    assert.doesNotMatch(
      source,
      /onClick=\{handleAbandonPedidoPendiente\}/,
      'No debe existir ningun onClick que dispare un abandono manual.'
    );
    assert.doesNotMatch(
      source,
      /const handleAbandonPedidoPendiente = /,
      'El handler de abandono manual debe estar eliminado -- ya no hay ningun camino de UI hacia el.'
    );
  });

  it('define canVerifyOrphanPedidoPendiente para el caso sin payload + lease vencido (accion de solo verificacion)', () => {
    assert.match(
      source,
      /const canVerifyOrphanPedidoPendiente = Boolean\(visiblePedidoPendienteOperation\)\s*&&\s*visiblePedidoPendienteOperation\.hasRecoveryPayload === false\s*&&\s*Boolean\(visiblePedidoPendienteOperation\.leaseExpired\);/
    );
  });

  it('el boton principal del banner es "Recuperar pedido"/"Verificando..." y llama a ventasService.recoverPedidoPendienteOperation (payload propio)', () => {
    const idx = source.indexOf('const handleRecoverPedidoPendiente');
    assert.notEqual(idx, -1);
    const snippet = source.slice(idx, idx + 900);
    assert.match(snippet, /ventasService\.recoverPedidoPendienteOperation\(target\.operationId, \{/);
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
    assert.match(source, /const autoReconciledPedidoPendienteIdsRef = useRef\(new Set\(\)\);/);
    assert.match(
      source,
      /if \(!operationId \|\| autoReconciledPedidoPendienteIdsRef\.current\.has\(operationId\)\) return;\s*\n\s*autoReconciledPedidoPendienteIdsRef\.current\.add\(operationId\);/,
      'Debe marcar la operacion como intentada antes de reconciliar, para no reintentar en cada render.'
    );
  });

  it('el banner nunca ofrece "liberar" el candado por vencimiento de lease -- solo verificar con el servidor', () => {
    assert.doesNotMatch(source, /Puedes liberarlo para continuar vendiendo/);
    assert.match(source, /No se puede reintentar desde aquí; verifica con el servidor antes de continuar vendiendo\./);
    assert.match(
      source,
      /No sabemos con certeza si el servidor registró el pedido\. Verifica el resultado con la misma clave antes de crear o modificar otro pedido: nunca se reenviará como una operación nueva\./
    );
  });
});
