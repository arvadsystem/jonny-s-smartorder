import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createFinancialOperationManager, FINANCIAL_OPERATION_STATUS } from './financialOperationManager.js';

const scope = Object.freeze({ userId: 7, sucursalId: 3, cashSessionId: 11, origin: 'CAJA' });
const payload = Object.freeze({ id_sucursal: 3, id_sesion_caja: 11, items: [{ id_producto: 1, cantidad: 1 }] });
const success = Object.freeze({ id_pedido: 41, id_factura: 51, codigo_venta: 'V-51' });
const storage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    values
  };
};
const config = (kind = 'VENTA_DIRECTA', body = payload, operationScope = scope) => ({
  kind,
  endpoint: kind.startsWith('PAGO') ? '/ventas/pedidos/41/registrar-pago' : '/ventas',
  payload: body,
  scope: operationScope,
  successId: 'id_factura',
  validateSuccess: (response) => Number(response?.id_factura) > 0
});
const temporaryError = () => Object.assign(new Error('timeout'), { status: 408, code: 'REQUEST_TIMEOUT' });

describe('gestor comun de operaciones financieras', () => {
  it('venta directa normal confirma un identificador persistido', async () => {
    const manager = createFinancialOperationManager({ storage: storage() });
    assert.equal(await manager.execute(config(), async () => success), success);
  });
  it('doble clic comparte una promesa y un POST', async () => {
    const manager = createFinancialOperationManager({ storage: storage() }); let calls = 0;
    const request = async () => { calls += 1; await new Promise((resolve) => setTimeout(resolve, 5)); return success; };
    await Promise.all([manager.execute(config(), request), manager.execute(config(), request)]);
    assert.equal(calls, 1);
  });
  it('timeout post-COMMIT queda desconocido', async () => {
    const state = storage(); const manager = createFinancialOperationManager({ storage: state });
    await assert.rejects(manager.execute(config(), async () => { throw temporaryError(); }));
    assert.equal(manager.read({ kind: 'VENTA_DIRECTA', scope }).status, FINANCIAL_OPERATION_STATUS.UNKNOWN);
  });
  it('HTTP 500 post-COMMIT queda desconocido y conserva la key', async () => {
    const state = storage(); const manager = createFinancialOperationManager({ storage: state }); let firstKey; let retryKey;
    await assert.rejects(manager.execute(config(), async (_body, key) => {
      firstKey = key;
      throw Object.assign(new Error('internal'), { status: 500, code: 'INTERNAL_ERROR' });
    }));
    assert.equal(manager.read({ kind: 'VENTA_DIRECTA', scope }).status, FINANCIAL_OPERATION_STATUS.UNKNOWN);
    await manager.execute(config(), async (_body, key) => { retryKey = key; return success; });
    assert.equal(retryKey, firstKey);
  });
  it('reintento manual conserva la misma key', async () => {
    const state = storage(); const manager = createFinancialOperationManager({ storage: state }); let firstKey;
    await assert.rejects(manager.execute(config(), async (_body, key) => { firstKey = key; throw temporaryError(); }));
    let retryKey; await manager.execute(config(), async (_body, key) => { retryKey = key; return success; });
    assert.equal(retryKey, firstKey);
  });
  for (const [name, response] of [['body exitoso vacio', null], ['JSON truncado', '{"id_factura":'], ['respuesta sin ID', { id_pedido: 41 }]]) {
    it(`${name} queda desconocido`, async () => {
      const state = storage(); const manager = createFinancialOperationManager({ storage: state });
      await assert.rejects(manager.execute(config(), async () => response));
      assert.equal(manager.read({ kind: 'VENTA_DIRECTA', scope }).status, FINANCIAL_OPERATION_STATUS.UNKNOWN);
    });
  }
  it('pago completo normal confirma factura', async () => {
    const manager = createFinancialOperationManager({ storage: storage() });
    assert.equal((await manager.execute(config('PAGO_41'), async () => success)).id_factura, 51);
  });
  for (const kind of ['PAGO_COMPLETO_41', 'PAGO_PARCIAL_41_D1', 'PAGO_DIVIDIDO_41_D1']) {
    it(`${kind} perdido reintenta la misma key`, async () => {
      const state = storage(); const manager = createFinancialOperationManager({ storage: state }); let a; let b;
      await assert.rejects(manager.execute(config(kind), async (_body, key) => { a = key; throw temporaryError(); }));
      await manager.execute(config(kind), async (_body, key) => { b = key; return success; });
      assert.equal(a, b);
    });
  }
  it('dos cobros concurrentes comparten solicitud', async () => {
    const manager = createFinancialOperationManager({ storage: storage() }); let calls = 0;
    const request = async () => { calls += 1; await new Promise((resolve) => setTimeout(resolve, 3)); return success; };
    await Promise.all([manager.execute(config('PAGO_41'), request), manager.execute(config('PAGO_41'), request)]);
    assert.equal(calls, 1);
  });
  it('rechazo funcional y edicion generan otra operacion', async () => {
    const state = storage(); const manager = createFinancialOperationManager({ storage: state }); let a; let b;
    await assert.rejects(manager.execute(config(), async (_body, key) => { a = key; throw Object.assign(new Error('stock'), { status: 409, code: 'STOCK' }); }));
    await manager.execute(config('VENTA_DIRECTA', { ...payload, items: [{ id_producto: 1, cantidad: 2 }] }), async (_body, key) => { b = key; return success; });
    assert.notEqual(a, b);
  });
  it('scope distinto no recupera el payload anterior', async () => {
    const state = storage(); const manager = createFinancialOperationManager({ storage: state });
    await assert.rejects(manager.execute(config(), async () => { throw temporaryError(); }));
    assert.equal(manager.read({ kind: 'VENTA_DIRECTA', scope: { ...scope, userId: 8 } }), null);
  });
  it('impresion fallida posterior no repite el cobro', async () => {
    const manager = createFinancialOperationManager({ storage: storage() }); let calls = 0;
    await manager.execute(config('PAGO_41'), async () => { calls += 1; return success; });
    await assert.rejects(async () => { throw new Error('printer'); });
    assert.equal(calls, 1);
  });
  it('recarga conserva operacion ambigua', async () => {
    const state = storage(); const first = createFinancialOperationManager({ storage: state });
    await assert.rejects(first.execute(config(), async () => { throw temporaryError(); }));
    const second = createFinancialOperationManager({ storage: state });
    assert.equal(second.read({ kind: 'VENTA_DIRECTA', scope }).status, FINANCIAL_OPERATION_STATUS.UNKNOWN);
  });
  it('otra pestaña reutiliza key persistida', async () => {
    const state = storage(); const first = createFinancialOperationManager({ storage: state }); let a; let b;
    await assert.rejects(first.execute(config(), async (_body, key) => { a = key; throw temporaryError(); }));
    const second = createFinancialOperationManager({ storage: state });
    await second.execute(config(), async (_body, key) => { b = key; return success; });
    assert.equal(a, b);
  });
  it('venta legitima posterior usa key nueva', async () => {
    const manager = createFinancialOperationManager({ storage: storage() }); const keys = [];
    await manager.execute(config(), async (_body, key) => { keys.push(key); return success; });
    await manager.execute(config(), async (_body, key) => { keys.push(key); return { ...success, id_factura: 52 }; });
    assert.notEqual(keys[0], keys[1]);
  });
  it('pago legitimo posterior usa operacion nueva', async () => {
    const manager = createFinancialOperationManager({ storage: storage() }); const keys = [];
    await manager.execute(config('PAGO_41_D1'), async (_body, key) => { keys.push(key); return success; });
    await manager.execute(config('PAGO_41_D2'), async (_body, key) => { keys.push(key); return { ...success, id_factura: 52 }; });
    assert.notEqual(keys[0], keys[1]);
  });
  it('payload ambiguo queda congelado y bloquea edicion', async () => {
    const state = storage(); const manager = createFinancialOperationManager({ storage: state });
    await assert.rejects(manager.execute(config(), async () => { throw temporaryError(); }));
    await assert.rejects(manager.execute(config('VENTA_DIRECTA', { ...payload, extra: true }), async () => success), { code: 'FINANCIAL_OPERATION_BLOCKED' });
  });
  it('scope incompleto no envia', async () => {
    const manager = createFinancialOperationManager({ storage: storage() }); let calls = 0;
    await assert.rejects(manager.execute(config('VENTA_DIRECTA', payload, { userId: 7 }), async () => { calls += 1; return success; }));
    assert.equal(calls, 0);
  });
  it('otra pestaña recupera SUCCESS desde servidor sin copiar payload ni reenviar POST', async () => {
    const shared = storage();
    const first = createFinancialOperationManager({ storage: storage(), sharedStorage: shared });
    await assert.rejects(first.execute(config(), async () => { throw temporaryError(); }));
    const sharedRecord = JSON.parse([...shared.values.values()][0]);
    assert.equal(Object.hasOwn(sharedRecord, 'payload'), false);
    const second = createFinancialOperationManager({ storage: storage(), sharedStorage: shared });
    let posts = 0;
    const result = await second.execute({
      ...config(),
      recover: async () => ({ status: 'SUCCESS', response_body: success })
    }, async () => { posts += 1; return success; });
    assert.equal(result.id_factura, 51);
    assert.equal(posts, 0);
  });
  it('otra pestaña conserva NOT_FOUND como desconocido sin POST ni rotar key', async () => {
    const shared = storage();
    const first = createFinancialOperationManager({ storage: storage(), sharedStorage: shared });
    await assert.rejects(first.execute(config(), async () => { throw temporaryError(); }));
    const before = JSON.parse([...shared.values.values()][0]);
    const second = createFinancialOperationManager({ storage: storage(), sharedStorage: shared });
    let posts = 0;
    await assert.rejects(second.execute({ ...config(), recover: async () => ({ status: 'NOT_FOUND' }) }, async () => { posts += 1; return success; }), {
      code: 'FINANCIAL_OPERATION_RESULT_UNKNOWN'
    });
    const after = JSON.parse([...shared.values.values()][0]);
    assert.equal(posts, 0);
    assert.equal(after.idempotencyKey, before.idempotencyKey);
    assert.equal(after.status, FINANCIAL_OPERATION_STATUS.UNKNOWN);
  });
});
