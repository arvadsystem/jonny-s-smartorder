import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  OC_PENDING_MAX_AGE_MS,
  OC_PENDING_STORAGE_KEY,
  clearPendingOcSubmission,
  createPendingOcSubmission,
  createUuidV4,
  isAmbiguousCreateError,
  loadPendingOcSubmission,
  pollOcReconciliation,
  savePendingOcSubmission
} from './solicitudesCompraCreateRecovery.js';

const makeStorage = () => {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key), values };
};

test('UUID usa randomUUID y fallback getRandomValues produce UUID v4', () => {
  assert.equal(createUuidV4({ randomUUID: () => '123e4567-e89b-42d3-a456-426614174000' }), '123e4567-e89b-42d3-a456-426614174000');
  const uuid = createUuidV4({ getRandomValues: (bytes) => { bytes.fill(0xab); return bytes; } });
  assert.match(uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('snapshot conserva mismo UUID y payload a través de sessionStorage', () => {
  const storage = makeStorage();
  const pending = createPendingOcSubmission({ id_almacen: 11, detalles: [{ id_item: 1 }] }, 1000);
  savePendingOcSubmission(pending, storage);
  const recovered = loadPendingOcSubmission(storage, 2000);
  assert.equal(recovered.client_request_id, pending.client_request_id);
  assert.deepEqual(recovered.payload, pending.payload);
  assert.equal(JSON.parse(storage.values.get(OC_PENDING_STORAGE_KEY)).version, 1);
  clearPendingOcSubmission(storage);
  assert.equal(storage.getItem(OC_PENDING_STORAGE_KEY), null);
});

test('pending mayor de 24 horas se elimina', () => {
  const storage = makeStorage();
  const pending = createPendingOcSubmission({ id_almacen: 11, detalles: [] }, 1000);
  savePendingOcSubmission(pending, storage);
  assert.equal(loadPendingOcSubmission(storage, 1000 + OC_PENDING_MAX_AGE_MS + 1), null);
  assert.equal(storage.getItem(OC_PENDING_STORAGE_KEY), null);
});

test('clasifica timeout, fetch y 502/503/504 como ambiguos', () => {
  for (const error of [{ code: 'REQUEST_TIMEOUT' }, { code: 'FETCH_ERROR' }, { status: 502 }, { status: 503 }, { status: 504 }]) assert.equal(isAmbiguousCreateError(error), true);
  assert.equal(isAmbiguousCreateError({ status: 400 }), false);
});

test('polling termina en found=true y conserva UUID', async () => {
  const ids = []; let calls = 0;
  const result = await pollOcReconciliation({ clientRequestId: 'uuid-a', delays: [0, 1, 1], wait: async () => {},
    reconcile: async (id) => { ids.push(id); calls += 1; return calls === 3 ? { found: true, solicitud: { id_solicitud_compra: 500 } } : { found: false }; } });
  assert.equal(result.solicitud.id_solicitud_compra, 500);
  assert.deepEqual(ids, ['uuid-a', 'uuid-a', 'uuid-a']);
});

test('polling limitado termina found=false', async () => {
  let calls = 0;
  const result = await pollOcReconciliation({ clientRequestId: 'uuid-a', delays: [0, 1], wait: async () => {}, reconcile: async () => { calls += 1; return { found: false }; } });
  assert.deepEqual(result, { ok: true, found: false });
  assert.equal(calls, 2);
});

test('contrato frontend mantiene timeout global 15000 y create focal 60000', async () => {
  const [api, service, hook, component] = await Promise.all([
    readFile(new URL('../../../../services/api.js', import.meta.url), 'utf8'),
    readFile(new URL('../../../../services/solicitudesCompraService.js', import.meta.url), 'utf8'),
    readFile(new URL('../hooks/useSolicitudesCompra.js', import.meta.url), 'utf8'),
    readFile(new URL('../components/NuevaSolicitudCompra.jsx', import.meta.url), 'utf8')
  ]);
  assert.match(api, /DEFAULT_REQUEST_TIMEOUT_MS = 15000/);
  assert.match(service, /crearSolicitud:[\s\S]*timeoutMs: 60000/);
  assert.match(service, /envios\/\$\{encodeURIComponent/);
  assert.match(hook, /RECONCILING/);
  assert.doesNotMatch(hook, /NO SE PUDO ENVIAR[\s\S]{0,200}isAmbiguousCreateError/);
  assert.match(component, /aria-busy=\{locked\}/);
  assert.match(component, /Verificando envío/);
});
