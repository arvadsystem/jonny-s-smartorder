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

  it('HTTP 500 antes de conocer el resultado queda ambiguo y conserva operacion, key, payload y carrito bloqueado', async () => {
    const keys = [];
    const payload = { id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 11, cantidad: 2 }] };
    const operation = beginOperation(payload);
    globalThis.fetch = async (url, options) => {
      keys.push(options.headers['Idempotency-Key']);
      return jsonResponse({ error: true, message: 'Error interno.' }, 500);
    };

    await assert.rejects(
      () => createOrder(payload, operation),
      (error) => error.code === 'PEDIDO_PENDIENTE_RESULTADO_DESCONOCIDO'
    );

    const unknown = ventasService.getPedidoPendienteOperation();
    assert.equal(unknown.status, ventasService.PEDIDO_PENDIENTE_OPERATION_STATUS.UNKNOWN);
    assert.equal(unknown.operationId, operation.operationId);
    assert.equal(unknown.idempotencyKey, operation.idempotencyKey);
    assert.deepEqual(unknown.payload, payload);
    assert.equal(ventasService.isPedidoPendienteOperationLocked(unknown), true);
    assert.equal(new Set(keys).size, 1);
  });

  it('HTTP 500 posterior a COMMIT recupera por replay el mismo pedido con la misma key y sin POST logico nuevo', async () => {
    const calls = [];
    const payload = { id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 111, cantidad: 1 }] };
    const operation = beginOperation(payload);
    globalThis.fetch = async (url, options) => {
      calls.push({ key: options.headers['Idempotency-Key'], body: JSON.parse(options.body) });
      if (calls.length === 1) {
        return jsonResponse({ error: true, message: 'Respuesta perdida despues del COMMIT.' }, 500);
      }
      return jsonResponse({ id_pedido: 411, idempotent_replay: true });
    };

    const response = await createOrder(payload, operation);

    assert.equal(response.id_pedido, 411);
    assert.equal(response.idempotent_replay, true);
    assert.equal(calls.length, 2);
    assert.equal(new Set(calls.map((call) => call.key)).size, 1);
    assert.equal(calls[0].key, operation.idempotencyKey);
    assert.deepEqual(calls[0].body, calls[1].body);
    assert.equal(ventasService.getPedidoPendienteOperation(), null);
  });

  // RONDA 3: un UNKNOWN (con payload propio o sin el) ya NUNCA puede abandonarse
  // directamente -- ni siquiera con explicit=true. La unica salida es reconciliar
  // con el servidor (ver ESCENARIO 1/2/3/4/5 mas abajo).
  it('RONDA 3 - ESCENARIO 1: ni un reset normal ni un abandono explicito eliminan una operacion UNKNOWN -- el lock permanece', async () => {
    const payload = { id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 12 }] };
    const operation = beginOperation(payload);
    await exhaustAsUnknown(payload, operation);

    assert.equal(ventasService.abandonPedidoPendienteOperation(operation.operationId), false);
    assert.equal(ventasService.getPedidoPendienteOperation().operationId, operation.operationId);
    assert.equal(ventasService.abandonPedidoPendienteOperation(operation.operationId, {
      explicit: true,
      operationScope
    }), false, 'explicit=true ya no autoriza abandonar un UNKNOWN, tenga o no payload propio');
    const stillLocked = ventasService.getPedidoPendienteOperation();
    assert.equal(stillLocked.operationId, operation.operationId);
    assert.equal(stillLocked.status, ventasService.PEDIDO_PENDIENTE_OPERATION_STATUS.UNKNOWN);
    assert.ok(localValues.size > 0, 'el registro de coordinacion tambien debe seguir intacto');
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
    // RONDA 3: recoverPedidoPendienteOperation ahora reconcilia primero (GET) antes de
    // reintentar el POST. El servidor todavia no tiene registro (NOT_FOUND) -> cae al
    // replay existente con la MISMA idempotency-key, que aqui si logra crear el pedido.
    globalThis.fetch = async (url, options) => {
      const method = String(options?.method || 'GET').toUpperCase();
      if (method === 'GET' && String(url).includes('/ventas/idempotency-result')) {
        return jsonResponse({ status: 'NOT_FOUND' }, 404);
      }
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

  it('un error funcional no reintentable realiza una solicitud y libera el bloqueo de inmediato (sin tombstone RECHAZADA)', async () => {
    const keys = [];
    globalThis.fetch = async (url, options) => {
      keys.push(options.headers['Idempotency-Key']);
      return jsonResponse({ error: true, code: 'CAJA_CERRADA', message: 'Caja cerrada.' }, 409);
    };
    const payload = { id_sucursal: 1, id_sesion_caja: 91, items: [{ id_producto: 4 }] };
    const operation = beginOperation(payload);

    await assert.rejects(() => createOrder(payload, operation), (error) => error.code === 'CAJA_CERRADA');
    assert.equal(keys.length, 1);
    // Un rechazo definitivo (el servidor confirmo que no se creo el pedido) debe liberar
    // el candado de inmediato: ni el registro privado (sessionStorage) ni el de coordinacion
    // (localStorage) deben sobrevivir, para no bloquear la siguiente venta.
    assert.equal(ventasService.getPedidoPendienteOperation(), null);
    assert.equal(localValues.size, 0);

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

  it('leaseExpired se recalcula en cada lectura, no solo en la transicion SENDING->UNKNOWN', async () => {
    // Bug del incidente: un registro que ya estaba en UNKNOWN nunca volvia a marcarse
    // leaseExpired en lecturas posteriores, aunque su lease llevara minutos vencido.
    // Eso dejaba el banner "espera a que termine" (no recuperable) para siempre, en
    // vez de habilitar recuperar/abandonar cuando ninguna pestaña puede seguir siendo
    // dueña de la operacion.
    const payload = { id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 182 }] };
    const operation = beginOperation(payload);
    await exhaustAsUnknown(payload, operation);

    const freshRead = ventasService.getPedidoPendienteOperation(operationScope);
    assert.equal(freshRead.status, ventasService.PEDIDO_PENDIENTE_OPERATION_STATUS.UNKNOWN);
    assert.equal(freshRead.leaseExpired, undefined);

    const sessionKey = [...sessionValues.keys()][0];
    const stored = JSON.parse(sessionValues.get(sessionKey));
    sessionValues.set(sessionKey, JSON.stringify({
      ...stored,
      lease: { token: stored.lease.token, until: Date.now() - 1 }
    }));
    // Simula un refresco de pestaña: la cache en memoria del modulo desaparece y la
    // proxima lectura debe re-parsear sessionStorage (que es lo que sobrevive a un
    // refresh) en vez de devolver el snapshot en memoria ya obsoleto.
    ventasService.__resetPedidoPendienteOperationRuntimeForTests();

    const expiredRead = ventasService.getPedidoPendienteOperation(operationScope);
    assert.equal(expiredRead.status, ventasService.PEDIDO_PENDIENTE_OPERATION_STATUS.UNKNOWN);
    assert.equal(expiredRead.leaseExpired, true);
    assert.equal(expiredRead.operationId, operation.operationId);
    assert.equal(expiredRead.idempotencyKey, operation.idempotencyKey);
  });

  // OBSOLETO (ronda 2 lo permitia): este test aseguraba que un registro huerfano de
  // coordinacion con lease vencido podia abandonarse con explicit=true. La auditoria de
  // la ronda 3 identifico que ese bypass segue siendo inseguro (leaseExpired nunca es
  // evidencia de que el pedido no se creo) y exige que NINGUN UNKNOWN se abandone sin
  // reconciliar -- ni siquiera el huerfano. La version corregida es el test equivalente
  // "ESCENARIO 14" mas abajo (registro huerfano + explicit abandon -> false, se mantiene
  // el candado; la unica salida es reconcilePedidoPendienteOperation).
  it('un registro huerfano de coordinacion (otra pestaña, sin payload) con lease vencido NUNCA puede abandonarse -- ni con explicit=true', async () => {
    const payload = { id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 183 }] };
    const operation = beginOperation(payload);
    await exhaustAsUnknown(payload, operation);

    const sharedKey = [...localValues.keys()][0];
    const shared = JSON.parse(localValues.get(sharedKey));
    localValues.set(sharedKey, JSON.stringify({
      ...shared,
      owner: { ownerId: 'tab:cerrada-hace-rato' },
      lease: { token: 'lease-vencido', until: Date.now() - 1 }
    }));
    // Simula que la pestaña original ya cerro: sin registro privado propio.
    sessionValues.clear();
    ventasService.__resetPedidoPendienteOperationRuntimeForTests();

    const orphan = ventasService.listSharedPedidoPendienteOperations(operationScope)[0];
    assert.equal(orphan.hasRecoveryPayload, false);
    assert.equal(orphan.leaseExpired, true);

    assert.equal(ventasService.abandonPedidoPendienteOperation(orphan.operationId, { operationScope }), false);
    assert.equal(
      ventasService.abandonPedidoPendienteOperation(orphan.operationId, { explicit: true, operationScope }),
      false,
      'ni explicit=true ni leaseExpired=true autorizan abandonar un registro que alguna vez se envio al servidor'
    );
    assert.equal(ventasService.listSharedPedidoPendienteOperations(operationScope).length, 1, 'el candado debe seguir intacto');
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
    // El primer error ambiguo dispara UNA consulta server-truth (GET /ventas/idempotency-result)
    // ademas del POST original -- ambas usan la MISMA idempotency-key, nunca una nueva.
    assert.equal(keys.length, 2);
    assert.ok(keys.every((key) => key === operation.idempotencyKey));
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
    // Simula que ESTA pestaña ya no tiene el registro privado (p.ej. otra pestaña
    // distinta a la que lo creo), sin depender de abandonPedidoPendienteOperation
    // (que ya nunca limpia un UNKNOWN, con o sin payload).
    sessionValues.clear();
    ventasService.__resetPedidoPendienteOperationRuntimeForTests();
    await assert.rejects(
      () => ventasService.recoverPedidoPendienteOperation(operation.operationId, { operationScope }),
      (error) => error.code === 'PEDIDO_PENDIENTE_PAYLOAD_NO_DISPONIBLE_EN_ESTA_PESTANA'
    );
  });

  // ==========================================================================
  // RONDA 2: reconciliacion server-truth (GET /ventas/idempotency-result)
  // ==========================================================================
  // Enruta el mock de fetch segun si es el POST original o la consulta de
  // verificacion (GET /ventas/idempotency-result), para poder simular
  // independientemente "que respondio el POST" vs "que dice el servidor de verdad".
  const routeFetch = ({ onPost, onReconcile }) => async (url, options) => {
    const method = String(options?.method || 'GET').toUpperCase();
    if (method === 'GET' && String(url).includes('/ventas/idempotency-result')) {
      return onReconcile(url, options);
    }
    return onPost(url, options);
  };

  it('ESCENARIO 1: POST -> 201 SUCCESS -> CONFIRMED sin lock', async () => {
    globalThis.fetch = async () => jsonResponse({ id_pedido: 701 });
    const payload = { id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 40 }] };
    const operation = beginOperation(payload);
    const response = await createOrder(payload, operation);
    assert.equal(response.id_pedido, 701);
    assert.equal(ventasService.getPedidoPendienteOperation(), null);
    assert.equal(localValues.size, 0);
  });

  it('ESCENARIO 3: POST -> 500, server-truth FAILED -> cleanup inmediato, nunca UNKNOWN', async () => {
    const postCalls = [];
    const reconcileCalls = [];
    globalThis.fetch = routeFetch({
      onPost: async (url, options) => {
        postCalls.push(options.headers['Idempotency-Key']);
        return jsonResponse({ error: true, message: 'Rollback.' }, 500);
      },
      onReconcile: async (url, options) => {
        reconcileCalls.push(options.headers['Idempotency-Key']);
        return jsonResponse({ status: 'FAILED', http_status: 500 });
      }
    });
    const payload = { id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 41 }] };
    const operation = beginOperation(payload);
    await assert.rejects(
      () => createOrder(payload, operation),
      (error) => error.code === 'PEDIDO_PENDIENTE_SERVER_TRUTH_FAILED'
    );
    assert.equal(postCalls.length, 1, 'no debe reintentar el POST una vez que el servidor confirma FAILED');
    assert.equal(reconcileCalls.length, 1);
    assert.equal(reconcileCalls[0], operation.idempotencyKey);
    assert.equal(ventasService.getPedidoPendienteOperation(), null, 'debe liberar el candado por completo, nunca quedar UNKNOWN');
    assert.equal(localValues.size, 0);
  });

  it('ESCENARIO 4: POST -> 500, server-truth SUCCESS -> recupera el pedido, no duplica', async () => {
    const postCalls = [];
    globalThis.fetch = routeFetch({
      onPost: async (url, options) => {
        postCalls.push(options.headers['Idempotency-Key']);
        return jsonResponse({ error: true, message: 'Respuesta perdida.' }, 500);
      },
      onReconcile: async () => jsonResponse({ status: 'SUCCESS', id_pedido: 702 })
    });
    const payload = { id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 42 }] };
    const operation = beginOperation(payload);
    const response = await createOrder(payload, operation);
    assert.equal(response.id_pedido, 702);
    assert.equal(postCalls.length, 1, 'no debe generar un segundo POST logico -- la confirmacion vino de la consulta, no de un reintento');
    assert.equal(ventasService.getPedidoPendienteOperation(), null);
  });

  it('ESCENARIO 6: POST -> timeout, server-truth FAILED -> cleanup', async () => {
    globalThis.fetch = routeFetch({
      onPost: async () => jsonResponse({ error: true, code: 'REQUEST_TIMEOUT' }, 408),
      onReconcile: async () => jsonResponse({ status: 'FAILED' })
    });
    const payload = { id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 43 }] };
    const operation = beginOperation(payload);
    await assert.rejects(
      () => createOrder(payload, operation),
      (error) => error.code === 'PEDIDO_PENDIENTE_SERVER_TRUTH_FAILED'
    );
    assert.equal(ventasService.getPedidoPendienteOperation(), null);
  });

  it('ESCENARIO 7: POST -> timeout, server-truth IN_PROGRESS -> mantiene proteccion (no libera, no duplica)', async () => {
    globalThis.fetch = routeFetch({
      onPost: async () => jsonResponse({ error: true, code: 'REQUEST_TIMEOUT' }, 408),
      onReconcile: async () => jsonResponse({ status: 'PROCESSING' })
    });
    const payload = { id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 44 }] };
    const operation = beginOperation(payload);
    await assert.rejects(
      () => createOrder(payload, operation),
      (error) => error.code === 'PEDIDO_PENDIENTE_RESULTADO_DESCONOCIDO'
    );
    const stored = ventasService.getPedidoPendienteOperation();
    assert.equal(stored.status, ventasService.PEDIDO_PENDIENTE_OPERATION_STATUS.UNKNOWN);
    assert.equal(stored.idempotencyKey, operation.idempotencyKey);
    assert.equal(ventasService.isPedidoPendienteOperationLocked(stored), true);
  });

  it('ESCENARIO 8: POST -> timeout, server-truth NOT_FOUND -> UNKNOWN protegido, misma key', async () => {
    globalThis.fetch = routeFetch({
      onPost: async () => jsonResponse({ error: true, code: 'REQUEST_TIMEOUT' }, 408),
      onReconcile: async () => jsonResponse({ status: 'NOT_FOUND' }, 404)
    });
    const payload = { id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 45 }] };
    const operation = beginOperation(payload);
    await assert.rejects(
      () => createOrder(payload, operation),
      (error) => error.code === 'PEDIDO_PENDIENTE_RESULTADO_DESCONOCIDO'
    );
    const stored = ventasService.getPedidoPendienteOperation();
    assert.equal(stored.status, ventasService.PEDIDO_PENDIENTE_OPERATION_STATUS.UNKNOWN);
    assert.equal(stored.idempotencyKey, operation.idempotencyKey);
  });

  it('ESCENARIO 10/11/12/13: registro huerfano (otra pestaña cerrada, lease vencido) -- reconcilePedidoPendienteOperation decide segun server-truth', async () => {
    const makeOrphan = async (receta) => {
      const payload = { id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: receta }] };
      const operation = beginOperation(payload);
      globalThis.fetch = async () => jsonResponse({ error: true, code: 'REQUEST_TIMEOUT' }, 408);
      await assert.rejects(() => createOrder(payload, operation));
      const sharedKey = [...localValues.keys()][0];
      const shared = JSON.parse(localValues.get(sharedKey));
      localValues.set(sharedKey, JSON.stringify({
        ...shared,
        owner: { ownerId: 'tab:cerrada' },
        lease: { token: 'lease-vencido', until: Date.now() - 1 }
      }));
      sessionValues.clear();
      // Simula que la pestaña realmente cerro: sin esto, la cache en memoria del
      // modulo (misma pestaña/proceso de test) seguiria devolviendo el registro
      // original con payload, en vez del huerfano de coordinacion.
      ventasService.__resetPedidoPendienteOperationRuntimeForTests();
      const orphan = ventasService.listSharedPedidoPendienteOperations(operationScope)[0];
      assert.equal(orphan.hasRecoveryPayload, false);
      assert.equal(orphan.leaseExpired, true);
      return orphan;
    };

    // 10) SUCCESS -> recupera, nunca "abandona"
    let orphan = await makeOrphan(46);
    globalThis.fetch = async () => jsonResponse({ status: 'SUCCESS', id_pedido: 710 });
    let result = await ventasService.reconcilePedidoPendienteOperation(orphan.operationId, { operationScope });
    assert.deepEqual(result, { status: 'SUCCESS', idPedido: 710 });
    assert.equal(ventasService.listSharedPedidoPendienteOperations(operationScope).length, 0);

    // 11) FAILED -> cleanup seguro
    orphan = await makeOrphan(47);
    globalThis.fetch = async () => jsonResponse({ status: 'FAILED' });
    result = await ventasService.reconcilePedidoPendienteOperation(orphan.operationId, { operationScope });
    assert.deepEqual(result, { status: 'FAILED' });
    assert.equal(ventasService.listSharedPedidoPendienteOperations(operationScope).length, 0);

    // 12) IN_PROGRESS -> mantiene bloqueo (no se toca el storage)
    orphan = await makeOrphan(48);
    globalThis.fetch = async () => jsonResponse({ status: 'PROCESSING' });
    result = await ventasService.reconcilePedidoPendienteOperation(orphan.operationId, { operationScope });
    assert.deepEqual(result, { status: 'IN_PROGRESS' });
    assert.ok(ventasService.listSharedPedidoPendienteOperations(operationScope).some((op) => op.operationId === orphan.operationId));

    // 13) NOT_FOUND -> NO permite abandono, mantiene UNKNOWN protegido
    orphan = await makeOrphan(49);
    globalThis.fetch = async () => jsonResponse({ status: 'NOT_FOUND' }, 404);
    result = await ventasService.reconcilePedidoPendienteOperation(orphan.operationId, { operationScope });
    assert.deepEqual(result, { status: 'NOT_FOUND' });
    assert.ok(ventasService.listSharedPedidoPendienteOperations(operationScope).some((op) => op.operationId === orphan.operationId));
    assert.equal(
      ventasService.abandonPedidoPendienteOperation(orphan.operationId, { explicit: true, operationScope }),
      false,
      'un NOT_FOUND no autoriza abandonar: el resultado real sigue sin confirmarse'
    );
  });

  it('ESCENARIO 14: UNKNOWN huerfano + explicit abandon -- ya NO puede limpiarse localmente sin reconciliar (revierte el bypass de la ronda 1)', async () => {
    const payload = { id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 50 }] };
    const operation = beginOperation(payload);
    globalThis.fetch = async () => jsonResponse({ error: true, code: 'REQUEST_TIMEOUT' }, 408);
    await assert.rejects(() => createOrder(payload, operation));
    const sharedKey = [...localValues.keys()][0];
    const shared = JSON.parse(localValues.get(sharedKey));
    localValues.set(sharedKey, JSON.stringify({
      ...shared,
      owner: { ownerId: 'tab:cerrada' },
      lease: { token: 'lease-vencido', until: Date.now() - 1 }
    }));
    sessionValues.clear();
    ventasService.__resetPedidoPendienteOperationRuntimeForTests();
    const orphan = ventasService.listSharedPedidoPendienteOperations(operationScope)[0];
    assert.equal(orphan.hasRecoveryPayload, false);
    assert.equal(orphan.leaseExpired, true);

    const abandoned = ventasService.abandonPedidoPendienteOperation(orphan.operationId, {
      explicit: true,
      operationScope
    });
    assert.equal(abandoned, false, 'leaseExpired no es evidencia financiera: nunca debe bastar por si solo para liberar el candado');
    assert.equal(ventasService.listSharedPedidoPendienteOperations(operationScope).length, 1);
  });

  it('ESCENARIO 17: el servidor creo el pedido pero el navegador perdio la respuesta -- 0 POST logicos nuevos, mismo id_pedido', async () => {
    const postCalls = [];
    globalThis.fetch = routeFetch({
      onPost: async (url, options) => {
        postCalls.push(options.headers['Idempotency-Key']);
        return Promise.reject(Object.assign(new Error('network lost'), { code: 'FETCH_ERROR', status: 0 }));
      },
      onReconcile: async () => jsonResponse({ status: 'SUCCESS', id_pedido: 703 })
    });
    const payload = { id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 51 }] };
    const operation = beginOperation(payload);
    const response = await createOrder(payload, operation);
    assert.equal(response.id_pedido, 703);
    assert.equal(postCalls.length, 1, 'el unico POST logico es el original -- la recuperacion fue una consulta, no un reenvio');
  });

  // ==========================================================================
  // RONDA 3: recoverPedidoPendienteOperation reconcilia PRIMERO (server-truth) para
  // un UNKNOWN con payload propio, en vez de reenviar el POST a ciegas. Solo si el
  // servidor responde NOT_FOUND cae al replay existente, siempre con la MISMA
  // operationId/idempotency-key/payload.
  // ==========================================================================
  const makeUnknownWithPayload = async (receta) => {
    const payload = { id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: receta }] };
    const operation = beginOperation(payload);
    globalThis.fetch = async () => jsonResponse({ error: true, code: 'REQUEST_TIMEOUT' }, 408);
    await assert.rejects(() => createOrder(payload, operation));
    const unknown = ventasService.getPedidoPendienteOperation(operationScope);
    assert.equal(unknown.status, ventasService.PEDIDO_PENDIENTE_OPERATION_STATUS.UNKNOWN);
    assert.equal(unknown.hasRecoveryPayload, true);
    return operation;
  };

  it('RONDA 3 - ESCENARIO 2: UNKNOWN + payload propio, server-truth SUCCESS -> recupera el mismo id_pedido, limpia el lock, sin nuevo POST logico', async () => {
    const operation = await makeUnknownWithPayload(60);
    const postCalls = [];
    globalThis.fetch = routeFetch({
      onPost: async (url, options) => { postCalls.push(options.headers['Idempotency-Key']); return jsonResponse({ id_pedido: 999 }); },
      onReconcile: async () => jsonResponse({ status: 'SUCCESS', id_pedido: 720 })
    });
    const response = await ventasService.recoverPedidoPendienteOperation(operation.operationId, { operationScope });
    assert.equal(response.id_pedido, 720);
    assert.equal(postCalls.length, 0, 'no debe reenviar el POST -- la reconciliacion ya confirmo el resultado');
    assert.equal(ventasService.getPedidoPendienteOperation(), null);
  });

  it('RONDA 3 - ESCENARIO 3: UNKNOWN + payload propio, server-truth FAILED -> limpia el lock y permite un nuevo intento', async () => {
    const operation = await makeUnknownWithPayload(61);
    globalThis.fetch = routeFetch({
      onPost: async () => jsonResponse({ id_pedido: 999 }),
      onReconcile: async () => jsonResponse({ status: 'FAILED' })
    });
    await assert.rejects(
      () => ventasService.recoverPedidoPendienteOperation(operation.operationId, { operationScope }),
      (error) => error.code === 'PEDIDO_PENDIENTE_SERVER_TRUTH_FAILED'
    );
    assert.equal(ventasService.getPedidoPendienteOperation(), null);
    const next = beginOperation({ id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 61 }] });
    assert.notEqual(next.operationId, operation.operationId);
    assert.notEqual(next.idempotencyKey, operation.idempotencyKey);
  });

  it('RONDA 3 - ESCENARIO 4: UNKNOWN + payload propio, server-truth IN_PROGRESS -> mantiene el lock', async () => {
    const operation = await makeUnknownWithPayload(62);
    globalThis.fetch = routeFetch({
      onPost: async () => jsonResponse({ id_pedido: 999 }),
      onReconcile: async () => jsonResponse({ status: 'PROCESSING' })
    });
    await assert.rejects(
      () => ventasService.recoverPedidoPendienteOperation(operation.operationId, { operationScope }),
      (error) => error.code === 'PEDIDO_PENDIENTE_EN_PROCESO'
    );
    const stored = ventasService.getPedidoPendienteOperation();
    assert.equal(stored.operationId, operation.operationId);
    assert.equal(stored.idempotencyKey, operation.idempotencyKey);
    assert.equal(ventasService.isPedidoPendienteOperationLocked(stored), true);
  });

  it('RONDA 3 - ESCENARIO 5: UNKNOWN + payload propio, server-truth NOT_FOUND -> mantiene UNKNOWN (no es FAILED)', async () => {
    const operation = await makeUnknownWithPayload(63);
    globalThis.fetch = routeFetch({
      onPost: async () => Promise.reject(Object.assign(new Error('sigue caido'), { code: 'FETCH_ERROR', status: 0 })),
      onReconcile: async () => jsonResponse({ status: 'NOT_FOUND' }, 404)
    });
    await assert.rejects(
      () => ventasService.recoverPedidoPendienteOperation(operation.operationId, { operationScope }),
      (error) => error.code === 'PEDIDO_PENDIENTE_RESULTADO_DESCONOCIDO'
    );
    const stored = ventasService.getPedidoPendienteOperation();
    assert.equal(stored.status, ventasService.PEDIDO_PENDIENTE_OPERATION_STATUS.UNKNOWN);
    assert.equal(stored.idempotencyKey, operation.idempotencyKey);
  });

  it('RONDA 3 - ESCENARIO 6: UNKNOWN + payload propio, server-truth NOT_FOUND -> el replay posterior usa la MISMA idempotency-key', async () => {
    const operation = await makeUnknownWithPayload(64);
    const postKeys = [];
    globalThis.fetch = routeFetch({
      onPost: async (url, options) => { postKeys.push(options.headers['Idempotency-Key']); return jsonResponse({ id_pedido: 730, idempotent_replay: true }); },
      onReconcile: async () => jsonResponse({ status: 'NOT_FOUND' }, 404)
    });
    const response = await ventasService.recoverPedidoPendienteOperation(operation.operationId, { operationScope });
    assert.equal(response.id_pedido, 730);
    assert.equal(postKeys.length, 1);
    assert.equal(postKeys[0], operation.idempotencyKey, 'el replay tras NOT_FOUND debe usar la MISMA idempotency-key, nunca una nueva');
  });

  it('RONDA 3 - ESCENARIO 7: NEW + hasBeenSent=false puede cancelarse localmente de forma segura (nunca hubo POST)', () => {
    const operation = beginOperation({ id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 65 }] });
    assert.equal(operation.status, ventasService.PEDIDO_PENDIENTE_OPERATION_STATUS.NEW);
    assert.equal(operation.hasBeenSent, false);
    assert.equal(ventasService.abandonPedidoPendienteOperation(operation.operationId, { operationScope }), true);
    assert.equal(ventasService.getPedidoPendienteOperation(), null);
  });

  it('RONDA 3 - ESCENARIO 8: SENDING (propietaria, aun sin resolver) -- NO se puede abandonar', async () => {
    let release;
    globalThis.fetch = () => new Promise((resolve) => { release = () => resolve(jsonResponse({ id_pedido: 900 })); });
    const payload = { id_sucursal: 1, id_sesion_caja: 91, items: [{ id_receta: 66 }] };
    const operation = beginOperation(payload);
    const request = createOrder(payload, operation);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(ventasService.getPedidoPendienteOperation().status, ventasService.PEDIDO_PENDIENTE_OPERATION_STATUS.SENDING);
    assert.equal(ventasService.abandonPedidoPendienteOperation(operation.operationId, { explicit: true, operationScope }), false);
    release();
    await request;
  });

  it('RONDA 3 - ESCENARIO 12: pedido creado en servidor + respuesta perdida -> UNKNOWN -> el usuario NO puede abandonar -> reconciliar recupera el pedido original sin POST adicional', async () => {
    const operation = await makeUnknownWithPayload(67);

    // El cajero intenta abandonar antes de saber el resultado: debe fallar siempre.
    assert.equal(ventasService.abandonPedidoPendienteOperation(operation.operationId, { explicit: true, operationScope }), false);
    assert.equal(ventasService.getPedidoPendienteOperation().operationId, operation.operationId);

    const postCalls = [];
    globalThis.fetch = routeFetch({
      onPost: async (url, options) => { postCalls.push(options.headers['Idempotency-Key']); return jsonResponse({ id_pedido: 999 }); },
      onReconcile: async () => jsonResponse({ status: 'SUCCESS', id_pedido: 4000 })
    });
    const response = await ventasService.recoverPedidoPendienteOperation(operation.operationId, { operationScope });
    assert.equal(response.id_pedido, 4000);
    assert.equal(postCalls.length, 0, 'cero POST logicos adicionales -- la recuperacion fue una consulta de verdad, no un reenvio');
    assert.equal(ventasService.getPedidoPendienteOperation(), null);
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
