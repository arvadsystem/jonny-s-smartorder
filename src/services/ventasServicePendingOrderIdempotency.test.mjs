import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { createServer } from 'vite';

const createStorage = (values, behavior) => ({
  get length() { return values.size; },
  key(index) { return [...values.keys()][index] ?? null; },
  getItem(key) {
    if (behavior.getError) throw behavior.getError;
    return values.has(key) ? values.get(key) : null;
  },
  setItem(key, value) {
    if (behavior.setError) throw behavior.setError;
    values.set(key, String(value));
    behavior.onSet?.({ key, value: String(value), values });
  },
  removeItem(key) {
    if (behavior.removeError) throw behavior.removeError;
    values.delete(key);
  }
});

const sessionValues = new Map();
const localValues = new Map();
const storageListeners = new Set();
const sessionBehavior = {};
const localBehavior = {};
const sessionStorage = createStorage(sessionValues, sessionBehavior);
const localStorage = createStorage(localValues, localBehavior);
const broadcastMessages = [];
class BroadcastChannelMock {
  addEventListener() {}
  postMessage(message) { broadcastMessages.push(structuredClone(message)); }
  close() {}
}
const operationScope = { userId: 7, sucursalId: 1, cashSessionId: 91 };

const jsonResponse = (body, status = 201) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' }
});

describe('maquina de estados e idempotencia de pedidos pendientes', () => {
  let viteServer;
  let ventasService;
  let originalWindow;
  let originalFetch;
  let activeOperations = [];
  const originalEnv = {
    retries: process.env.VITE_VENTAS_CREATE_RECOVERY_RETRIES,
    delay: process.env.VITE_VENTAS_CREATE_RECOVERY_DELAY_MS
  };

  const beginOperation = (payload, operationId = null, scope = operationScope) => {
    const operation = ventasService.preparePedidoPendienteOperation(payload, {
      operationId,
      operationScope: scope
    });
    activeOperations.push({ operationId: operation.operationId, operationScope: scope });
    return operation;
  };

  const createOrder = (payload, operation) => ventasService.createPedidoPendiente(payload, {
    operationId: operation.operationId,
    operationScope: operation.operationScope
  });

  const exhaustAsUnknown = async (payload, operation, keys = []) => {
    globalThis.fetch = async (url, options) => {
      keys.push(options.headers['Idempotency-Key']);
      return jsonResponse({ error: true, code: 'REQUEST_TIMEOUT', message: 'Timeout.' }, 408);
    };
    await assert.rejects(
      () => createOrder(payload, operation),
      (error) => error.code === 'PEDIDO_PENDIENTE_RESULTADO_DESCONOCIDO'
    );
    return ventasService.getPedidoPendienteOperation();
  };

  before(async () => {
    process.env.VITE_VENTAS_CREATE_RECOVERY_RETRIES = '1';
    process.env.VITE_VENTAS_CREATE_RECOVERY_DELAY_MS = '1';
    originalWindow = globalThis.window;
    originalFetch = globalThis.fetch;
    globalThis.window = {
      sessionStorage,
      localStorage,
      BroadcastChannel: BroadcastChannelMock,
      dispatchEvent() {},
      addEventListener(type, listener) {
        if (type === 'storage') storageListeners.add(listener);
      },
      removeEventListener(type, listener) {
        if (type === 'storage') storageListeners.delete(listener);
      }
    };
    viteServer = await createServer({
      appType: 'custom',
      configFile: false,
      logLevel: 'silent',
      root: process.cwd(),
      server: { middlewareMode: true }
    });
    ventasService = (await viteServer.ssrLoadModule('/src/services/ventasService.js')).default;
  });

  after(async () => {
    await viteServer?.close();
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
    if (originalEnv.retries === undefined) delete process.env.VITE_VENTAS_CREATE_RECOVERY_RETRIES;
    else process.env.VITE_VENTAS_CREATE_RECOVERY_RETRIES = originalEnv.retries;
    if (originalEnv.delay === undefined) delete process.env.VITE_VENTAS_CREATE_RECOVERY_DELAY_MS;
    else process.env.VITE_VENTAS_CREATE_RECOVERY_DELAY_MS = originalEnv.delay;
  });

  beforeEach(() => {
    sessionValues.clear();
    localValues.clear();
    broadcastMessages.length = 0;
    for (const behavior of [sessionBehavior, localBehavior]) {
      delete behavior.getError;
      delete behavior.setError;
      delete behavior.removeError;
      delete behavior.onSet;
    }
    activeOperations = [];
  });

  afterEach(() => {
    for (const operation of activeOperations) {
      ventasService.abandonPedidoPendienteOperation(operation.operationId, {
        explicit: true,
        operationScope: operation.operationScope
      });
    }
    ventasService.__resetPedidoPendienteOperationRuntimeForTests();
  });

  it('una operacion nueva conserva operationId, clave, fingerprint y snapshot', () => {
    const payload = { id_sucursal: 1, id_sesion_caja: 91, items: [{ id_producto: 5, cantidad: 1 }] };
    const operation = beginOperation(payload);
    payload.items[0].cantidad = 9;

    assert.equal(operation.status, ventasService.PEDIDO_PENDIENTE_OPERATION_STATUS.NEW);
    assert.match(operation.operationId, /^pedido-pendiente:/);
    assert.ok(operation.idempotencyKey);
    assert.equal(operation.payload.items[0].cantidad, 1);
  });

  it('doble clic, Enter y clic comparten una promesa y un solo POST', async () => {
    let release;
    const calls = [];
    globalThis.fetch = (url, options) => {
      calls.push({ url, options });
      return new Promise((resolve) => { release = () => resolve(jsonResponse({ id_pedido: 102 })); });
    };
    const payload = { items: [{ cantidad: 1, id_receta: 9 }], id_sucursal: 1, id_sesion_caja: 91 };
    const operation = beginOperation(payload);

    const first = createOrder(payload, operation);
    const second = createOrder({ id_sesion_caja: 91, id_sucursal: 1, items: [{ id_receta: 9, cantidad: 1 }] }, operation);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(calls.length, 1);
    assert.equal(ventasService.getPedidoPendienteOperation().status, ventasService.PEDIDO_PENDIENTE_OPERATION_STATUS.SENDING);
    release();
    assert.deepEqual(await Promise.all([first, second]), [{ id_pedido: 102 }, { id_pedido: 102 }]);
  });

  it('reintentos agotados marcan RESULTADO_DESCONOCIDO y conservan identidad y payload congelado', async () => {
    const keys = [];
    const payload = { id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 10, cantidad: 2 }] };
    const operation = beginOperation(payload);
    const unknown = await exhaustAsUnknown(payload, operation, keys);

    assert.equal(unknown.status, ventasService.PEDIDO_PENDIENTE_OPERATION_STATUS.UNKNOWN);
    assert.equal(unknown.operationId, operation.operationId);
    assert.equal(unknown.idempotencyKey, operation.idempotencyKey);
    assert.deepEqual(unknown.payload, payload);
    assert.equal(new Set(keys).size, 1);
  });

  it('reset normal no elimina una operacion ambigua y abandono explicito si lo hace', async () => {
    const payload = { id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 12 }] };
    const operation = beginOperation(payload);
    await exhaustAsUnknown(payload, operation);

    assert.equal(ventasService.abandonPedidoPendienteOperation(operation.operationId), false);
    assert.equal(ventasService.getPedidoPendienteOperation().operationId, operation.operationId);
    assert.equal(ventasService.abandonPedidoPendienteOperation(operation.operationId, {
      explicit: true,
      operationScope
    }), true);
    assert.equal(ventasService.getPedidoPendienteOperation(), null);
    assert.equal(localValues.size, 0);
  });

  it('una mutacion de payload ambiguo queda bloqueada sin rotar operationId ni clave', async () => {
    const payload = { id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 13, cantidad: 1 }] };
    const operation = beginOperation(payload);
    await exhaustAsUnknown(payload, operation);

    assert.throws(
      () => beginOperation({ ...payload, items: [{ id_receta: 13, cantidad: 2 }] }, operation.operationId),
      (error) => error.code === 'PEDIDO_PENDIENTE_RESULTADO_DESCONOCIDO'
    );
    assert.throws(
      () => beginOperation(payload, null, { ...operationScope, sucursalId: 2 }),
      (error) => ['PEDIDO_PENDIENTE_RESULTADO_DESCONOCIDO', 'PEDIDO_PENDIENTE_SCOPE_NO_COINCIDE'].includes(error.code)
    );
    const stored = ventasService.getPedidoPendienteOperation();
    assert.equal(stored.operationId, operation.operationId);
    assert.equal(stored.idempotencyKey, operation.idempotencyKey);
  });

  it('recuperar reutiliza snapshot y clave, y un replay confirma el mismo pedido', async () => {
    const keys = [];
    const bodies = [];
    const payload = { id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 14, cantidad: 1 }] };
    const operation = beginOperation(payload);
    await exhaustAsUnknown(payload, operation, keys);
    payload.items[0].cantidad = 99;
    globalThis.fetch = async (url, options) => {
      keys.push(options.headers['Idempotency-Key']);
      bodies.push(JSON.parse(options.body));
      return jsonResponse({ id_pedido: 414, idempotent_replay: true });
    };

    const response = await ventasService.recoverPedidoPendienteOperation(operation.operationId, { operationScope });

    assert.equal(response.id_pedido, 414);
    assert.equal(response.idempotent_replay, true);
    assert.equal(bodies[0].items[0].cantidad, 1);
    assert.equal(new Set(keys).size, 1);
    assert.equal(ventasService.getPedidoPendienteOperation(), null);
  });

  it('recuperacion que completa la creacion usa la misma reserva una sola vez', async () => {
    const keys = [];
    const payload = { id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 15 }] };
    const operation = beginOperation(payload);
    await exhaustAsUnknown(payload, operation, keys);
    let successfulCreates = 0;
    globalThis.fetch = async (url, options) => {
      keys.push(options.headers['Idempotency-Key']);
      successfulCreates += 1;
      return jsonResponse({ id_pedido: 415 });
    };

    const response = await ventasService.recoverPedidoPendienteOperation(operation.operationId, { operationScope });

    assert.equal(response.id_pedido, 415);
    assert.equal(successfulCreates, 1);
    assert.equal(new Set(keys).size, 1);
  });

  it('cerrar, reabrir y recargar la pestaña conservan la operacion ambigua', async () => {
    const payload = { id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 16 }] };
    const operation = beginOperation(payload);
    await exhaustAsUnknown(payload, operation);

    const reopened = beginOperation(payload, operation.operationId);
    const reloaded = ventasService.getPedidoPendienteOperation();
    assert.equal(reopened.operationId, operation.operationId);
    assert.equal(reopened.idempotencyKey, operation.idempotencyKey);
    assert.equal(reloaded.status, ventasService.PEDIDO_PENDIENTE_OPERATION_STATUS.UNKNOWN);
    assert.ok(sessionValues.size > 0);
  });

  it('un error funcional no reintentable realiza una solicitud y queda RECHAZADA', async () => {
    const keys = [];
    globalThis.fetch = async (url, options) => {
      keys.push(options.headers['Idempotency-Key']);
      return jsonResponse({ error: true, code: 'CAJA_CERRADA', message: 'Caja cerrada.' }, 409);
    };
    const payload = { id_sucursal: 1, id_sesion_caja: 91, items: [{ id_producto: 4 }] };
    const operation = beginOperation(payload);

    await assert.rejects(() => createOrder(payload, operation), (error) => error.code === 'CAJA_CERRADA');
    assert.equal(keys.length, 1);
    assert.equal(ventasService.getPedidoPendienteOperation().status, ventasService.PEDIDO_PENDIENTE_OPERATION_STATUS.REJECTED);

    const nextConfirmation = beginOperation(payload, operation.operationId);
    assert.notEqual(nextConfirmation.operationId, operation.operationId);
    assert.notEqual(nextConfirmation.idempotencyKey, operation.idempotencyKey);
    assert.equal(nextConfirmation.status, ventasService.PEDIDO_PENDIENTE_OPERATION_STATUS.NEW);
  });

  it('un cambio material antes del POST puede reemplazar la clave', () => {
    const first = beginOperation({ id_sucursal: 1, items: [{ cantidad: 1 }] });
    const changed = beginOperation({ id_sucursal: 1, items: [{ cantidad: 2 }] }, first.operationId);
    assert.notEqual(first.idempotencyKey, changed.idempotencyKey);
    assert.equal(changed.status, ventasService.PEDIDO_PENDIENTE_OPERATION_STATUS.NEW);
  });

  it('no permite abandonar mientras existe una solicitud activa', async () => {
    let release;
    globalThis.fetch = () => new Promise((resolve) => { release = () => resolve(jsonResponse({ id_pedido: 501 })); });
    const payload = { id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 17 }] };
    const operation = beginOperation(payload);
    const request = createOrder(payload, operation);
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(ventasService.abandonPedidoPendienteOperation(operation.operationId, { explicit: true, operationScope }), false);
    release();
    await request;
  });

  it('otra pestaña detecta la operacion compartida y un reset normal no la elimina', async () => {
    const payload = { id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 18 }] };
    const operation = beginOperation(payload);
    await exhaustAsUnknown(payload, operation);
    const snapshots = [];
    const unsubscribe = ventasService.subscribePedidoPendienteOperations(operationScope, (operations) => {
      snapshots.push(operations);
    });
    for (const listener of storageListeners) listener({ key: [...localValues.keys()][0] });

    assert.ok(snapshots.some((operations) => operations.some((item) => item.operationId === operation.operationId)));
    assert.equal(ventasService.abandonPedidoPendienteOperation(operation.operationId), false);
    assert.ok(ventasService.listSharedPedidoPendienteOperations(operationScope).some((item) => item.operationId === operation.operationId));
    unsubscribe();
  });

  it('RESULTADO_DESCONOCIDO persiste al vencer el lease sin eliminar ni cambiar la clave', async () => {
    const payload = { id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 181 }] };
    const operation = beginOperation(payload);
    await exhaustAsUnknown(payload, operation);
    const sharedKey = [...localValues.keys()][0];
    const shared = JSON.parse(localValues.get(sharedKey));
    localValues.set(sharedKey, JSON.stringify({
      ...shared,
      owner: { ownerId: 'tab:otra' },
      lease: { token: 'lease-otra', until: Date.now() - 1 }
    }));

    const visible = ventasService.listSharedPedidoPendienteOperations(operationScope);
    assert.equal(visible[0].status, ventasService.PEDIDO_PENDIENTE_OPERATION_STATUS.UNKNOWN);
    assert.equal(visible[0].operationId, operation.operationId);
    assert.equal(visible[0].idempotencyKey, operation.idempotencyKey);
    assert.equal(ventasService.getPedidoPendienteOperation(operationScope).status, ventasService.PEDIDO_PENDIENTE_OPERATION_STATUS.UNKNOWN);
  });

  it('confirmar publica la liberacion y un registro confirmado no bloquea otro pedido', async () => {
    const payload = { id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 19 }] };
    const operation = beginOperation(payload);
    await exhaustAsUnknown(payload, operation);
    const snapshots = [];
    const unsubscribe = ventasService.subscribePedidoPendienteOperations(operationScope, (operations) => {
      snapshots.push(operations.map((item) => item.operationId));
    });
    globalThis.fetch = async () => jsonResponse({ id_pedido: 519, idempotent_replay: true });
    await ventasService.recoverPedidoPendienteOperation(operation.operationId, { operationScope });
    const next = beginOperation(payload);

    assert.ok(snapshots.some((ids) => ids.includes(operation.operationId)));
    assert.deepEqual(snapshots.at(-1), []);
    assert.notEqual(next.operationId, operation.operationId);
    assert.notEqual(next.idempotencyKey, operation.idempotencyKey);
    unsubscribe();
  });

  it('una confirmacion recibida por storage libera la copia de otra pestaña', async () => {
    const payload = { id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 191 }] };
    const operation = beginOperation(payload);
    await exhaustAsUnknown(payload, operation);
    const sharedKey = [...localValues.keys()][0];
    const unknown = JSON.parse(localValues.get(sharedKey));
    const confirmed = JSON.stringify({
      ...unknown,
      status: ventasService.PEDIDO_PENDIENTE_OPERATION_STATUS.CONFIRMED,
      confirmedPedidoId: 591,
      confirmedAt: Date.now(),
      lease: { token: '', until: 0 }
    });
    const events = [];
    const unsubscribe = ventasService.subscribePedidoPendienteOperations(operationScope, (operations, event) => {
      events.push({ operations, event });
    });
    localValues.set(sharedKey, confirmed);
    for (const listener of storageListeners) listener({ key: sharedKey, oldValue: JSON.stringify(unknown), newValue: confirmed });
    localValues.delete(sharedKey);
    for (const listener of storageListeners) listener({ key: sharedKey, oldValue: confirmed, newValue: null });

    assert.equal(ventasService.getPedidoPendienteOperation(), null);
    assert.deepEqual(ventasService.listSharedPedidoPendienteOperations(operationScope), []);
    assert.ok(events.some(({ event }) => event?.type === 'operation-released' && event.confirmedPedidoId === 591));
    unsubscribe();
  });

  it('dos operaciones legitimas identicas posteriores usan claves diferentes', async () => {
    let idPedido = 600;
    globalThis.fetch = async () => jsonResponse({ id_pedido: ++idPedido });
    const payload = { id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 20 }] };
    const first = beginOperation(payload);
    await createOrder(payload, first);
    const second = beginOperation(payload);
    await createOrder(payload, second);

    assert.notEqual(first.operationId, second.operationId);
    assert.notEqual(first.idempotencyKey, second.idempotencyKey);
  });

  it('QuotaExceededError degrada la persistencia sin perder la proteccion en memoria', () => {
    sessionBehavior.setError = Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
    const operation = beginOperation({ id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 21 }] });
    assert.equal(operation.persistenceDegraded, true);
    assert.equal(ventasService.getPedidoPendienteOperation(operationScope).idempotencyKey, operation.idempotencyKey);
  });

  it('SecurityError degrada la persistencia sin lanzar desde prepare', () => {
    sessionBehavior.setError = Object.assign(new Error('blocked'), { name: 'SecurityError' });
    const operation = beginOperation({ id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 22 }] });
    assert.equal(operation.persistenceDegraded, true);
    assert.equal(operation.status, ventasService.PEDIDO_PENDIENTE_OPERATION_STATUS.NEW);
  });

  it('getItem bloqueado se reporta como almacenamiento degradado', () => {
    sessionBehavior.getError = Object.assign(new Error('blocked'), { name: 'SecurityError' });
    const context = ventasService.getPedidoPendienteOperationContext(operationScope);
    assert.equal(context.operation, null);
    assert.equal(context.persistenceDegraded, true);
    assert.equal(context.lastStatus, ventasService.PEDIDO_PENDIENTE_STORAGE_RESULT.UNAVAILABLE);
  });

  it('una operacion ambigua permanece en memoria si setItem falla durante el timeout', async () => {
    const payload = { id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 23 }] };
    const operation = beginOperation(payload);
    sessionBehavior.setError = Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
    const unknown = await exhaustAsUnknown(payload, operation);
    assert.equal(unknown.status, ventasService.PEDIDO_PENDIENTE_OPERATION_STATUS.UNKNOWN);
    assert.equal(unknown.idempotencyKey, operation.idempotencyKey);
    assert.equal(unknown.persistenceDegraded, true);
  });

  it('removeItem fallido despues del 201 no invalida el exito y deja tombstone CONFIRMADA', async () => {
    const payload = { id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 24 }] };
    const operation = beginOperation(payload);
    sessionBehavior.removeError = Object.assign(new Error('blocked'), { name: 'SecurityError' });
    localBehavior.removeError = Object.assign(new Error('blocked'), { name: 'SecurityError' });
    globalThis.fetch = async () => jsonResponse({ id_pedido: 624 });

    const response = await createOrder(payload, operation);

    assert.equal(response.id_pedido, 624);
    const residuals = [...sessionValues.values(), ...localValues.values()].map((value) => JSON.parse(value));
    assert.ok(residuals.some((record) => record.status === ventasService.PEDIDO_PENDIENTE_OPERATION_STATUS.CONFIRMED));
    delete sessionBehavior.removeError;
    delete localBehavior.removeError;
    assert.equal(ventasService.getPedidoPendienteOperationContext(operationScope).operation, null);
  });

  it('fallar al persistir CONFIRMADA tampoco convierte el 201 en error', async () => {
    const payload = { id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 25 }] };
    const operation = beginOperation(payload);
    sessionBehavior.setError = Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
    localBehavior.setError = Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
    globalThis.fetch = async () => jsonResponse({ id_pedido: 625 });
    assert.equal((await createOrder(payload, operation)).id_pedido, 625);
  });

  it('JSON corrupto se marca INVALID, no se elimina y no ejecuta POST', async () => {
    const seed = beginOperation({ id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 26 }] });
    const recoveryKey = [...sessionValues.keys()][0];
    ventasService.abandonPedidoPendienteOperation(seed.operationId, { explicit: true, operationScope });
    sessionValues.set(recoveryKey, '{"schemaVersion":1');
    let calls = 0;
    globalThis.fetch = async () => { calls += 1; return jsonResponse({ id_pedido: 626 }); };

    assert.equal(ventasService.getPedidoPendienteOperationContext(operationScope).invalidRecord, true);
    assert.equal(sessionValues.has(recoveryKey), true);
    await assert.rejects(
      () => ventasService.createPedidoPendiente({ id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 26 }] }, { operationScope }),
      (error) => error.code === 'PEDIDO_PENDIENTE_REGISTRO_INVALIDO'
    );
    assert.equal(calls, 0);
  });

  it('registro vacio se marca INVALID y no se recupera', () => {
    const seed = beginOperation({ id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 27 }] });
    const key = [...sessionValues.keys()][0];
    ventasService.abandonPedidoPendienteOperation(seed.operationId, { explicit: true, operationScope });
    sessionValues.set(key, '');
    assert.equal(ventasService.getPedidoPendienteOperationContext(operationScope).invalidRecord, true);
    assert.equal(sessionValues.has(key), true);
  });

  it('version desconocida, estado invalido, clave ausente y scope incompleto se rechazan estrictamente', () => {
    const operation = beginOperation({ id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 28 }] });
    const stored = JSON.parse([...sessionValues.values()][0]);
    assert.equal(ventasService.validateStoredPedidoPendienteOperation({ ...stored, schemaVersion: 99 }), false);
    assert.equal(ventasService.validateStoredPedidoPendienteOperation({ ...stored, status: 'MAGICA' }), false);
    assert.equal(ventasService.validateStoredPedidoPendienteOperation({ ...stored, idempotencyKey: '' }), false);
    assert.equal(ventasService.validateStoredPedidoPendienteOperation({ ...stored, scope: { ...stored.scope, cashSessionId: '' } }), false);
    assert.equal(operation.schemaVersion, ventasService.PEDIDO_PENDIENTE_SCHEMA_VERSION);
  });

  it('el serializador persiste solo campos permitidos y excluye tokens, headers y temporales UI', () => {
    const serialized = ventasService.serializePedidoPendienteRecoveryPayload({
      id_sucursal: 1,
      id_sesion_caja: 91,
      token: 'secret-token',
      headers: { Authorization: 'secret' },
      uiDraft: true,
      items: [{ id_receta: 29, cantidad: 1, uiLabel: 'privado' }],
      contacto: { nombre_contacto: 'Ana', telefono_contacto: '9999', accessToken: 'secret' }
    });
    assert.deepEqual(Object.keys(serialized).sort(), ['contacto', 'id_sesion_caja', 'id_sucursal', 'items']);
    assert.equal(serialized.token, undefined);
    assert.equal(serialized.headers, undefined);
    assert.equal(serialized.items[0].uiLabel, undefined);
    assert.equal(serialized.contacto.accessToken, undefined);
  });

  it('localStorage y BroadcastChannel contienen solo coordinacion tecnica sin payload ni PII', async () => {
    const payload = {
      id_sucursal: 1,
      id_sesion_caja: 91,
      items: [{ id_receta: 30 }],
      contacto: { nombre_contacto: 'Nombre Privado', telefono_contacto: '9999' },
      delivery: { direccion_entrega: 'Direccion Privada' }
    };
    const operation = beginOperation(payload);
    await exhaustAsUnknown(payload, operation);
    const coordinationText = [...localValues.values()].join(' ');
    const broadcastText = JSON.stringify(broadcastMessages);
    for (const forbidden of ['Nombre Privado', '9999', 'Direccion Privada', '"payload"']) {
      assert.equal(coordinationText.includes(forbidden), false);
      assert.equal(broadcastText.includes(forbidden), false);
    }
    assert.ok([...sessionValues.values()].some((value) => value.includes('Nombre Privado')));
  });

  it('el contexto seguro de logs nunca incluye payload ni PII', () => {
    const context = ventasService.buildPedidoPendienteSafeLogContext({
      operationId: 'op-safe',
      status: 'RESULTADO_DESCONOCIDO',
      payload: { telefono: '9999', direccion: 'privada' }
    });
    assert.deepEqual(context, { operationId: 'op-safe', status: 'RESULTADO_DESCONOCIDO' });
  });

  it('la adquisicion write-read-verify pierde la carrera si otra pestaña sobrescribe el lease', async () => {
    const payload = { id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 31 }] };
    const operation = beginOperation(payload);
    let overwritten = false;
    localBehavior.onSet = ({ key, value, values }) => {
      if (overwritten || !key.includes('ventas_pedido_pendiente_shared_v2:')) return;
      overwritten = true;
      const record = JSON.parse(value);
      values.set(key, JSON.stringify({
        ...record,
        owner: { ownerId: 'tab:ganadora' },
        lease: { token: 'lease-ganadora', until: Date.now() + 60000 }
      }));
    };
    let calls = 0;
    globalThis.fetch = async () => { calls += 1; return jsonResponse({ id_pedido: 631 }); };
    await assert.rejects(
      () => createOrder(payload, operation),
      (error) => error.code === 'PEDIDO_PENDIENTE_LEASE_NO_ADQUIRIDO'
    );
    assert.equal(calls, 0);
  });

  it('cada adquisicion usa leaseToken y confirma owner/token/vence por relectura', () => {
    const operation = beginOperation({ id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 32 }] });
    const acquired = ventasService.acquirePedidoPendienteOperationLease(operation);
    assert.equal(acquired.acquired, true);
    assert.ok(acquired.operation.leaseToken);
    assert.ok(acquired.operation.leaseExpiresAt > Date.now());
    const stored = JSON.parse([...localValues.values()][0]);
    assert.equal(stored.owner.ownerId, acquired.operation.ownerTabId);
    assert.equal(stored.lease.token, acquired.operation.leaseToken);
  });

  it('lease vencido permite adquisicion sin cambiar operationId, key ni payload', () => {
    const operation = beginOperation({ id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 33 }] });
    const initial = ventasService.acquirePedidoPendienteOperationLease(operation);
    const key = [...localValues.keys()][0];
    const stored = JSON.parse(localValues.get(key));
    localValues.set(key, JSON.stringify({
      ...stored,
      owner: { ownerId: 'tab:anterior' },
      lease: { token: 'lease-anterior', until: Date.now() - 1 }
    }));
    const reacquired = ventasService.acquirePedidoPendienteOperationLease(operation);
    assert.equal(reacquired.acquired, true);
    assert.equal(reacquired.operation.operationId, operation.operationId);
    assert.equal(reacquired.operation.idempotencyKey, operation.idempotencyKey);
    assert.deepEqual(reacquired.operation.payload, operation.payload);
    assert.notEqual(reacquired.operation.leaseToken, initial.operation.leaseToken);
  });

  it('solo el propietario actual renueva y el propietario antiguo no sobrescribe el lease', () => {
    const operation = beginOperation({ id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 34 }] });
    const acquired = ventasService.acquirePedidoPendienteOperationLease(operation).operation;
    const key = [...localValues.keys()][0];
    const sendingStored = JSON.parse(localValues.get(key));
    localValues.set(key, JSON.stringify({
      ...sendingStored,
      status: ventasService.PEDIDO_PENDIENTE_OPERATION_STATUS.SENDING,
      hasBeenSent: true
    }));
    const renewed = ventasService.renewPedidoPendienteOperationLease({
      ...acquired,
      status: ventasService.PEDIDO_PENDIENTE_OPERATION_STATUS.SENDING
    });
    assert.ok(renewed.leaseExpiresAt >= acquired.leaseExpiresAt);
    const stored = JSON.parse(localValues.get(key));
    localValues.set(key, JSON.stringify({
      ...stored,
      owner: { ownerId: 'tab:nueva' },
      lease: { token: 'lease-nueva', until: Date.now() + 60000 }
    }));
    assert.equal(ventasService.renewPedidoPendienteOperationLease(renewed), null);
    assert.equal(JSON.parse(localValues.get(key)).lease.token, 'lease-nueva');
  });

  it('perder el lease despues del primer intento impide el siguiente POST y conserva la key', async () => {
    const payload = { id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 35 }] };
    const operation = beginOperation(payload);
    const keys = [];
    globalThis.fetch = async (url, options) => {
      keys.push(options.headers['Idempotency-Key']);
      const key = [...localValues.keys()][0];
      const stored = JSON.parse(localValues.get(key));
      localValues.set(key, JSON.stringify({
        ...stored,
        owner: { ownerId: 'tab:otra' },
        lease: { token: 'lease-otra', until: Date.now() + 60000 }
      }));
      return jsonResponse({ error: true, code: 'REQUEST_TIMEOUT' }, 408);
    };
    await assert.rejects(
      () => createOrder(payload, operation),
      (error) => error.code === 'PEDIDO_PENDIENTE_RESULTADO_DESCONOCIDO'
    );
    assert.equal(keys.length, 1);
    assert.equal(keys[0], operation.idempotencyKey);
  });

  it('scope exacto restaura y usuario, sucursal o caja distintos no restauran ni exponen payload', () => {
    const payload = { id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 36 }], contacto: { nombre_contacto: 'Privado' } };
    const operation = beginOperation(payload);
    assert.equal(ventasService.getPedidoPendienteOperationContext(operationScope).operation.operationId, operation.operationId);
    for (const different of [
      { ...operationScope, userId: 8 },
      { ...operationScope, sucursalId: 2 },
      { ...operationScope, cashSessionId: 92 }
    ]) {
      const context = ventasService.getPedidoPendienteOperationContext(different);
      assert.equal(context.operation, null);
      assert.equal(context.scopeMismatch, true);
      assert.equal(JSON.stringify(context).includes('Privado'), false);
    }
  });

  it('scope incompleto no prepara ni recupera y nunca ejecuta POST', async () => {
    let calls = 0;
    globalThis.fetch = async () => { calls += 1; return jsonResponse({ id_pedido: 637 }); };
    const incomplete = { userId: 7, sucursalId: 1, cashSessionId: '' };
    assert.throws(
      () => ventasService.preparePedidoPendienteOperation({ id_sucursal: 1, items: [{ id_receta: 37 }] }, { operationScope: incomplete }),
      (error) => error.code === 'PEDIDO_PENDIENTE_SCOPE_INVALIDO'
    );
    await assert.rejects(
      () => ventasService.recoverPedidoPendienteOperation('op-incompleta', { operationScope: incomplete }),
      (error) => error.code === 'PEDIDO_PENDIENTE_SCOPE_INVALIDO'
    );
    assert.equal(calls, 0);
  });

  it('otra pestaña detecta metadatos pero no recibe ni recupera el payload privado', async () => {
    const payload = { id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 38 }], contacto: { nombre_contacto: 'Privado' } };
    const operation = beginOperation(payload);
    await exhaustAsUnknown(payload, operation);
    const shared = ventasService.listSharedPedidoPendienteOperations(operationScope)[0];
    assert.equal(shared.hasRecoveryPayload, false);
    assert.equal(shared.payload, null);
    const coordinationEntries = [...localValues.entries()];
    ventasService.abandonPedidoPendienteOperation(operation.operationId, { explicit: true, operationScope });
    for (const [key, value] of coordinationEntries) localValues.set(key, value);
    await assert.rejects(
      () => ventasService.recoverPedidoPendienteOperation(operation.operationId, { operationScope }),
      (error) => error.code === 'PEDIDO_PENDIENTE_PAYLOAD_NO_DISPONIBLE_EN_ESTA_PESTANA'
    );
  });

  it('desmontar la suscripcion limpia ambos temporizadores de lease', () => {
    const originalSetInterval = globalThis.setInterval;
    const originalClearInterval = globalThis.clearInterval;
    const handles = [];
    const cleared = [];
    globalThis.setInterval = (callback) => {
      const handle = { callback };
      handles.push(handle);
      return handle;
    };
    globalThis.clearInterval = (handle) => { cleared.push(handle); };
    try {
      const unsubscribe = ventasService.subscribePedidoPendienteOperations(operationScope, () => {});
      unsubscribe();
      assert.equal(handles.length, 2);
      assert.deepEqual(cleared, handles);
    } finally {
      globalThis.setInterval = originalSetInterval;
      globalThis.clearInterval = originalClearInterval;
    }
  });
});
