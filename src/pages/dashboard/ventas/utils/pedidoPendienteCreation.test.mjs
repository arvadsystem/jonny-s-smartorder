import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { dispatchPedidoPendientePostCreationTasks, resolvePedidoPendienteUiAfterError } from './pedidoPendienteCreation.js';

// ==========================================================================
// RONDA 4: ventasService/storage es la fuente de verdad. Estas pruebas ejecutan
// (no solo inspeccionan por texto) el helper real que CajaView usa en los catch de
// creacion/recuperacion para decidir que debe reflejar React -- demostrando que un
// UNKNOWN "fantasma" ya no puede sobrevivir en React despues de que el service
// resolvio un estado terminal.
// ==========================================================================

test('resolvePedidoPendienteUiAfterError: si el service ya no tiene operacion, el resultado es null -- SIN importar target ni error.operation', () => {
  const previousOperation = { operationId: 'op-1', status: 'RESULTADO_DESCONOCIDO', hasRecoveryPayload: true };
  const errorWithStaleOperation = new Error('El servidor confirmó que el pedido no fue creado.');
  errorWithStaleOperation.code = 'PEDIDO_PENDIENTE_SERVER_TRUTH_FAILED';
  // Simula el bug original: el error o el target previo todavia "recuerdan" el UNKNOWN,
  // pero el service (fuente de verdad) ya lo limpio.
  errorWithStaleOperation.operation = previousOperation;

  const result = resolvePedidoPendienteUiAfterError({
    serviceOperation: null,
    previousOperation,
    error: errorWithStaleOperation
  });

  assert.equal(result, null);
});

test('resolvePedidoPendienteUiAfterError: sin argumentos (llamada vacia) tambien resuelve a null', () => {
  assert.equal(resolvePedidoPendienteUiAfterError(), null);
  assert.equal(resolvePedidoPendienteUiAfterError({}), null);
});

test('resolvePedidoPendienteUiAfterError: si el service SI tiene una operacion (UNKNOWN/IN_PROGRESS real), se conserva -- el POS sigue protegido', () => {
  const serviceOperation = { operationId: 'op-2', status: 'RESULTADO_DESCONOCIDO', hasRecoveryPayload: true };
  const result = resolvePedidoPendienteUiAfterError({
    serviceOperation,
    previousOperation: { operationId: 'op-2-vieja-copia', status: 'ENVIANDO' },
    error: new Error('timeout')
  });
  assert.equal(result, serviceOperation);
});

test('resolvePedidoPendienteUiAfterError: NUNCA devuelve previousOperation ni error.operation cuando difieren del service (aunque el service tenga una operacion distinta)', () => {
  // El service es la unica fuente de verdad: incluso si previousOperation/error.operation
  // sugieren otra cosa, el resultado debe ser exactamente lo que devuelve el service.
  const serviceOperation = { operationId: 'op-nueva', status: 'NUEVA' };
  const staleError = new Error('otro error');
  staleError.operation = { operationId: 'op-vieja-distinta', status: 'RESULTADO_DESCONOCIDO' };
  const result = resolvePedidoPendienteUiAfterError({
    serviceOperation,
    previousOperation: { operationId: 'op-vieja-distinta', status: 'RESULTADO_DESCONOCIDO' },
    error: staleError
  });
  assert.equal(result, serviceOperation);
  assert.notEqual(result.operationId, 'op-vieja-distinta');
});

test('fallos auxiliares posteriores al 201 se absorben sin alterar la respuesta creada', async () => {
  const response = { id_pedido: 501, numero_pedido: 'PED-00501' };
  const errors = [];
  const tasks = dispatchPedidoPendientePostCreationTasks([
    { name: 'summary', run: async () => { throw new Error('SUMMARY_FAILED'); } },
    { name: 'print-prompt', run: () => { throw new Error('PROMPT_FAILED'); } }
  ], ({ name, error }) => errors.push({ name, message: error.message }));

  assert.equal(response.id_pedido, 501);
  assert.deepEqual(await Promise.all(tasks), [null, null]);
  assert.deepEqual(errors.sort((left, right) => left.name.localeCompare(right.name)), [
    { name: 'print-prompt', message: 'PROMPT_FAILED' },
    { name: 'summary', message: 'SUMMARY_FAILED' }
  ]);
});

test('un fallo al notificar el error auxiliar tampoco rechaza la creacion confirmada', async () => {
  const tasks = dispatchPedidoPendientePostCreationTasks([
    { name: 'qz', run: () => Promise.reject(new Error('QZ_DISCONNECTED')) }
  ], () => {
    throw new Error('TOAST_FAILED');
  });

  assert.deepEqual(await Promise.all(tasks), [null]);
});

test('Caja espera el encolado post-COMMIT y absorbe su fallo sin repetir el pedido', async () => {
  const source = await readFile(new URL('../components/CajaView.jsx', import.meta.url), 'utf8');
  assert.match(source, /const finalizePedidoPendienteCreation = async/);
  assert.match(source, /await onPedidoPendienteCreated\?\.\(response\)/);
  assert.match(source, /catch \{[\s\S]{0,300}COMANDA COCINA/);
  assert.match(source, /return finalizePedidoPendienteCreation\(response\)/);
});

test('CajaView ofrece recuperacion/verificacion sin reset silencioso ni abandono directo de UNKNOWN', async () => {
  const source = await readFile(new URL('../components/CajaView.jsx', import.meta.url), 'utf8');
  assert.match(source, /PEDIDO_PENDIENTE_RESULTADO_DESCONOCIDO/);
  assert.match(source, /recoverPedidoPendienteOperation/);
  assert.match(source, /Recuperar pedido/);
  assert.match(source, /reconcilePedidoPendienteOperation/);
  assert.match(source, /Verificar resultado/);
  // RONDA 3: un UNKNOWN (con o sin payload) ya no puede abandonarse directamente --
  // ni con confirmacion consciente del usuario. Ver pedidoPendienteOrphanLockFix.test.mjs
  // y ventasServicePendingOrderIdempotency.test.mjs para la regla completa.
  assert.doesNotMatch(source, /const handleAbandonPedidoPendiente = /);
  assert.doesNotMatch(source, />\s*Abandonar operación\s*</);
  assert.match(source, /inert=\{pedidoPendienteComposerGuarded/);
  assert.match(source, /pedido-pendiente-storage-degraded-alert/);
  assert.match(source, /pedido-pendiente-storage-invalid-alert/);
  assert.match(source, /pedido-pendiente-scope-mismatch-alert/);
  assert.match(source, /PAYLOAD_NO_DISPONIBLE_EN_ESTA_PESTANA|Su payload privado no se comparte/);
});

test('RONDA 4: handleCreatePedidoPendiente y handleRecoverPedidoPendiente usan resolvePedidoPendienteUiAfterError en su catch (no error.operation ni target sueltos)', async () => {
  const source = await readFile(new URL('../components/CajaView.jsx', import.meta.url), 'utf8');

  const createIdx = source.indexOf('const handleCreatePedidoPendiente = async');
  assert.notEqual(createIdx, -1);
  const createSnippet = source.slice(createIdx, createIdx + 3200);
  assert.match(
    createSnippet,
    /const serviceOperation = ventasService\.getPedidoPendienteOperation\(\);\s+const nextOperation = resolvePedidoPendienteUiAfterError\(\{\s+serviceOperation,/,
    'El catch de creacion debe consultar el service y pasar el resultado por resolvePedidoPendienteUiAfterError.'
  );
  assert.doesNotMatch(
    createSnippet,
    /const currentOperation = error\?\.operation \|\|/,
    'Ya no debe existir el fallback inseguro a error.operation en el catch de creacion.'
  );

  const recoverIdx = source.indexOf('const handleRecoverPedidoPendiente = async');
  assert.notEqual(recoverIdx, -1);
  const recoverSnippet = source.slice(recoverIdx, recoverIdx + 3200);
  assert.match(
    recoverSnippet,
    /const serviceOperation = ventasService\.getPedidoPendienteOperation\(\);\s+const nextOperation = resolvePedidoPendienteUiAfterError\(\{\s+serviceOperation,/,
    'El catch de recuperacion debe consultar el service y pasar el resultado por resolvePedidoPendienteUiAfterError.'
  );
  assert.doesNotMatch(
    recoverSnippet,
    /error\?\.operation \|\| ventasService\.getPedidoPendienteOperation\(\) \|\| target/,
    'Ya no debe existir el fallback inseguro "error.operation || service || target" en el catch de recuperacion.'
  );
  assert.match(
    recoverSnippet,
    /if \(!nextOperation\) \{[\s\S]{0,450}'PEDIDO NO CREADO'/,
    'Cuando el service ya no tiene operacion, debe mostrarse "PEDIDO NO CREADO", no "RESULTADO PENDIENTE".'
  );
});

test('RONDA 4: el evento operation-released trata REJECTED como terminal (igual que CONFIRMED/ABANDONED) y respeta el operationId', async () => {
  const source = await readFile(new URL('../components/CajaView.jsx', import.meta.url), 'utf8');
  const idx = source.indexOf("event?.type === 'operation-released'");
  assert.notEqual(idx, -1);
  const snippet = source.slice(idx, idx + 900);
  assert.match(snippet, /event\.operationId === current\.operationId/, 'Debe verificar que el evento pertenece a la operacion actual antes de limpiar.');
  assert.match(snippet, /PEDIDO_PENDIENTE_OPERATION_STATUS\.CONFIRMED/);
  assert.match(snippet, /PEDIDO_PENDIENTE_OPERATION_STATUS\.REJECTED/);
  assert.match(snippet, /PEDIDO_PENDIENTE_OPERATION_STATUS\.ABANDONED/);
});

test('RONDA 4: el texto obsoleto sobre "abandonar" un UNKNOWN ya no aparece en el mensaje de mutacion bloqueada', async () => {
  const source = await readFile(new URL('../components/CajaView.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /Recupera o abandona conscientemente la operación anterior/);
  assert.match(source, /Verifica o recupera el resultado de la operación anterior antes de modificar el pedido\./);
});

test('RONDA 5 (hallazgo de QA real): el callback de suscripcion NO degrada una operacion propia (con payload) usando la lista compartida (sin payload)', async () => {
  // Bug encontrado probando en QA con dos pestañas reales: el timer periodico de 5s
  // (ver PEDIDO_PENDIENTE_LEASE_RENEW_MS en ventasService.js) dispara este callback
  // con `operations` = listSharedPedidoPendienteOperations(...), que SIEMPRE viene sin
  // payload (hasRecoveryPayload: false por construccion). Antes de este fix, el
  // callback hacia `operations.find(...)` incondicionalmente y sobreescribia la copia
  // PROPIA (con payload, recuperable) de la pestaña dueña con la version "huerfana",
  // mostrando "Existe una operación en otra pestaña" sobre el propio pedido pendiente
  // de esa misma pestaña -- de forma intermitente, cada ~5 segundos.
  const source = await readFile(new URL('../components/CajaView.jsx', import.meta.url), 'utf8');
  const idx = source.indexOf('setPedidoPendienteOperation((current) => {');
  assert.notEqual(idx, -1);
  const snippet = source.slice(idx, idx + 2400);
  assert.match(
    snippet,
    /if \(current\.hasRecoveryPayload !== false\) \{\s*\n\s*const own = ventasService\.getPedidoPendienteOperation\(\);/,
    'Cuando current tiene payload propio, debe re-derivarse desde ventasService.getPedidoPendienteOperation() (lectura propia), no desde la lista compartida.'
  );
  // La rama de la lista compartida (operations.find) solo debe alcanzarse para el caso
  // huerfano (hasRecoveryPayload === false), nunca para una operacion propia.
  const ownBranchIdx = snippet.indexOf('current.hasRecoveryPayload !== false');
  const sharedBranchIdx = snippet.indexOf('operations.find((operation) => operation.operationId === current.operationId)');
  assert.notEqual(sharedBranchIdx, -1, 'Debe seguir existiendo la rama basada en la lista compartida para el caso huerfano.');
  assert.ok(ownBranchIdx < sharedBranchIdx, 'La rama de "operacion propia" debe evaluarse ANTES que la rama basada en la lista compartida.');
});

test('el compositor bloquea mutaciones materiales y reset normal durante una operacion ambigua', async () => {
  const source = await readFile(new URL('../hooks/useVentaComposer.js', import.meta.url), 'utf8');
  assert.match(source, /const rejectBlockedMutation/);
  assert.match(source, /if \(!force && \(mutationBlocked \|\| onReset\?\.\(\) === false\)\)/);
  for (const mutation of [
    'addCatalogItem',
    'updateLine',
    'removeLine',
    'confirmComplementModal',
    'confirmExtrasModal',
    'setSelectedSucursal',
    'setTemporarySessionId',
    'setSelectedClient',
    'setPaymentMethod'
  ]) {
    assert.match(source, new RegExp(`${mutation}[\\s\\S]{0,180}rejectBlockedMutation`));
  }
});
