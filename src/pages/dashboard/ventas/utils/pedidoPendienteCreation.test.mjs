import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { dispatchPedidoPendientePostCreationTasks } from './pedidoPendienteCreation.js';

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

test('CajaView ofrece recuperacion y abandono consciente sin reset silencioso', async () => {
  const source = await readFile(new URL('../components/CajaView.jsx', import.meta.url), 'utf8');
  assert.match(source, /PEDIDO_PENDIENTE_RESULTADO_DESCONOCIDO/);
  assert.match(source, /recoverPedidoPendienteOperation/);
  assert.match(source, /Recuperar pedido/);
  assert.match(source, /window\.confirm/);
  assert.match(source, /explicit: true/);
  assert.match(source, /No se puede abandonar mientras exista una solicitud activa/);
  assert.match(source, /inert=\{pedidoPendienteComposerGuarded/);
  assert.match(source, /pedido-pendiente-storage-degraded-alert/);
  assert.match(source, /pedido-pendiente-storage-invalid-alert/);
  assert.match(source, /pedido-pendiente-scope-mismatch-alert/);
  assert.match(source, /PAYLOAD_NO_DISPONIBLE_EN_ESTA_PESTANA|Su payload privado no se comparte/);
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
