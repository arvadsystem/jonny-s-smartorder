import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  buildPedidoPendienteOperationContext,
  createPedidoPendienteContextError,
  parsePositiveIntegerId,
  prepareAndSubmitPedidoPendiente,
  resolveAuthenticatedUserId,
  resolveAuthenticatedUserIdentity,
  resolvePedidoPendienteContextState
} from './authenticatedUserScope.js';

test('resolveAuthenticatedUserId acepta las representaciones legítimas del contrato', () => {
  assert.equal(resolveAuthenticatedUserId({ id: 30 }), 30);
  assert.equal(resolveAuthenticatedUserId({ id_usuario: 30 }), 30);
  assert.equal(resolveAuthenticatedUserId({ id: 30, id_usuario: 30 }), 30);
  assert.equal(resolveAuthenticatedUserId({ id: '30' }), 30);
  assert.equal(resolveAuthenticatedUserId({ id_usuario: '30' }), 30);
});

test('resolveAuthenticatedUserId rechaza valores no seguros', () => {
  for (const user of [{ id: 0 }, { id: -1 }, { id: 'abc' }, {}, null, undefined]) {
    assert.equal(resolveAuthenticatedUserId(user), null);
  }
  for (const value of [1.5, '1.5', '1e2', {}, NaN, Infinity]) {
    assert.equal(parsePositiveIntegerId(value), null);
  }
});

test('identificadores distintos se exponen como conflicto y no se ocultan', () => {
  assert.deepEqual(resolveAuthenticatedUserIdentity({ id: 30, id_usuario: 31 }), {
    id: null,
    status: 'conflict',
    fields: ['id_usuario', 'id'],
    values: [31, 30]
  });
});

test('scope principal de root conserva usuario, sucursal, sesión y origen canónicos', () => {
  const userId = resolveAuthenticatedUserId({ id: 30, id_usuario: undefined, nombre_usuario: 'root' });
  assert.deepEqual(buildPedidoPendienteOperationContext({ userId, sucursalId: 1, cashSessionId: 19 }), {
    userId: 30,
    sucursalId: 1,
    cashSessionId: 19,
    origin: 'SMARTORDER_POS'
  });
});

test('estado de contexto diferencia carga, faltantes y sesión cerrada', () => {
  assert.equal(resolvePedidoPendienteContextState({ loading: true }).code, 'PEDIDO_PENDIENTE_CONTEXT_LOADING');
  assert.equal(resolvePedidoPendienteContextState({ userId: null, sucursalId: 1, cashSessionId: 19 }).message,
    'No se puede crear el pedido: falta usuario autenticado.');
  assert.equal(resolvePedidoPendienteContextState({ userId: 30, sucursalId: null, cashSessionId: 19 }).message,
    'No se puede crear el pedido: falta sucursal.');
  const closed = resolvePedidoPendienteContextState({ userId: 30, sucursalId: 1, cashSessionId: null });
  assert.equal(closed.code, 'PEDIDO_PENDIENTE_SESION_CAJA_INACTIVA');
  assert.equal(createPedidoPendienteContextError(closed).code, 'PEDIDO_PENDIENTE_SESION_CAJA_INACTIVA');
});

test('contexto retrasado pasa a listo sin cambiar el scope', () => {
  const loading = resolvePedidoPendienteContextState({ userId: 30, sucursalId: 1, loading: true });
  const ready = resolvePedidoPendienteContextState({ userId: 30, sucursalId: 1, cashSessionId: 19 });
  assert.equal(loading.loading, true);
  assert.equal(ready.ready, true);
  assert.deepEqual(ready.context, { userId: 30, sucursalId: 1, cashSessionId: 19, origin: 'SMARTORDER_POS' });
});

test('cambios de usuario, sucursal y sesión reconstruyen el contexto explícitamente', () => {
  const withoutUser = resolvePedidoPendienteContextState({ userId: null, sucursalId: 1, cashSessionId: 19 });
  const initial = resolvePedidoPendienteContextState({ userId: 30, sucursalId: 1, cashSessionId: 19 });
  const nextSucursal = resolvePedidoPendienteContextState({ userId: 30, sucursalId: 2, cashSessionId: 27 });
  const nextSession = resolvePedidoPendienteContextState({ userId: 30, sucursalId: 2, cashSessionId: 28 });
  assert.equal(withoutUser.ready, false);
  assert.deepEqual(initial.context, { userId: 30, sucursalId: 1, cashSessionId: 19, origin: 'SMARTORDER_POS' });
  assert.deepEqual(nextSucursal.context, { userId: 30, sucursalId: 2, cashSessionId: 27, origin: 'SMARTORDER_POS' });
  assert.deepEqual(nextSession.context, { userId: 30, sucursalId: 2, cashSessionId: 28, origin: 'SMARTORDER_POS' });
});

test('caso root usa ruta rápida local y envía una sola operación lógica', async () => {
  const calls = { revalidate: 0, prepare: 0, submit: 0 };
  const expectedScope = buildPedidoPendienteOperationContext({ userId: 30, sucursalId: 1, cashSessionId: 19 });
  const result = await prepareAndSubmitPedidoPendiente({
    payload: { id_sucursal: 1, id_sesion_caja: 19, items: [{ id_receta: 7 }] },
    localContext: expectedScope,
    revalidateContext: async () => {
      calls.revalidate += 1;
      return expectedScope;
    },
    prepareOperation: (_payload, options) => {
      calls.prepare += 1;
      assert.deepEqual(options.operationScope, expectedScope);
      return { operationId: 'op-root-30' };
    },
    submitOperation: async (_payload, options) => {
      calls.submit += 1;
      assert.equal(options.operationId, 'op-root-30');
      assert.deepEqual(options.operationScope, expectedScope);
      return { id_pedido: 101 };
    }
  });

  assert.deepEqual(calls, { revalidate: 0, prepare: 1, submit: 1 });
  assert.equal(result.response.id_pedido, 101);
});

test('una falla auxiliar no bloquea la ruta rápida con contexto local completo', async () => {
  let revalidated = 0;
  const scope = buildPedidoPendienteOperationContext({ userId: 30, sucursalId: 1, cashSessionId: 19 });
  const result = await prepareAndSubmitPedidoPendiente({
    payload: { id_sucursal: 1, id_sesion_caja: 19, items: [{ id_receta: 7 }] },
    localContext: scope,
    revalidateContext: async () => {
      revalidated += 1;
      throw Object.assign(new Error('bootstrap caído'), { status: 500 });
    },
    prepareOperation: () => ({ operationId: 'op-fast-path' }),
    submitOperation: async () => ({ id_pedido: 103 })
  });

  assert.equal(revalidated, 0);
  assert.equal(result.response.id_pedido, 103);
});

test('una sesion revalidada reemplaza solo el contexto obsoleto y conserva el carrito completo', async () => {
  const originalPayload = {
    id_sucursal: 1,
    id_sesion_caja: 19,
    id_cliente: 44,
    descuento: 25,
    items: [{ id_receta: 7, cantidad: 2, extras: [{ id_extra: 9, cantidad: 1 }] }],
    contacto: { nombre_contacto: 'Ana' },
    delivery: { direccion_entrega: 'Centro' }
  };
  const refreshedScope = buildPedidoPendienteOperationContext({
    userId: 30,
    sucursalId: 1,
    cashSessionId: 20
  });
  let preparedPayload = null;
  let submittedPayload = null;

  const result = await prepareAndSubmitPedidoPendiente({
    payload: originalPayload,
    revalidateContext: async () => refreshedScope,
    prepareOperation: (payload, options) => {
      preparedPayload = payload;
      assert.deepEqual(options.operationScope, refreshedScope);
      return { operationId: 'op-session-20' };
    },
    submitOperation: async (payload) => {
      submittedPayload = payload;
      return { id_pedido: 102 };
    }
  });

  assert.equal(originalPayload.id_sesion_caja, 19);
  assert.equal(preparedPayload.id_sesion_caja, 20);
  assert.equal(submittedPayload.id_sesion_caja, 20);
  assert.equal(preparedPayload.id_sucursal, 1);
  assert.deepEqual(preparedPayload.items, originalPayload.items);
  assert.deepEqual(preparedPayload.contacto, originalPayload.contacto);
  assert.deepEqual(preparedPayload.delivery, originalPayload.delivery);
  assert.equal(preparedPayload.id_cliente, 44);
  assert.equal(preparedPayload.descuento, 25);
  assert.deepEqual(result.payload, preparedPayload);
});

test('Caja no fuerza bootstrap y limita la revalidación dirigida a la consulta pequeña de sesión', async () => {
  const source = await readFile(new URL('../components/CajaView.jsx', import.meta.url), 'utf8');
  const handlerStart = source.indexOf('const revalidatePedidoPendienteContext = async (payload = {}) =>');
  const handlerEnd = source.indexOf('const finalizePedidoPendienteCreation = async', handlerStart);
  const handler = source.slice(handlerStart, handlerEnd);
  assert.ok(handlerStart >= 0 && handlerEnd > handlerStart);
  assert.equal(handler.includes('onCatalogSucursalChange'), false);
  assert.equal(handler.includes('PEDIDO_CONTEXT_REVALIDATION_TIMEOUT_MS'), true);
  assert.equal(handler.includes('activeRequest.key === requestKey'), true);
  assert.equal(handler.includes('controller.signal'), true);
  assert.equal(handler.includes('isCurrentRequest()'), true);
  assert.equal(handler.includes('await cajasService.getMiSesionActiva'), true);
});

test('venta pagada directa conserva su ruta sin bootstrap ni lectura obligatoria de sesión', async () => {
  const source = await readFile(new URL('../hooks/useVentaComposer.js', import.meta.url), 'utf8');
  const handlerStart = source.indexOf('const submitPaidSale = async');
  const handlerEnd = source.indexOf('const handleSubmit = async', handlerStart);
  const handler = source.slice(handlerStart, handlerEnd);
  assert.ok(handlerStart >= 0 && handlerEnd > handlerStart);
  assert.equal(handler.includes('onCatalogSucursalChange'), false);
  assert.equal(handler.includes('getMiSesionActiva'), false);
  assert.equal(handler.includes('getMiAsignacionActiva'), false);
  assert.equal(handler.includes('await onSubmit('), true);
});

test('rechazo definitivo solo revalida para el siguiente intento y nunca reenvía', async () => {
  const source = await readFile(new URL('../components/CajaView.jsx', import.meta.url), 'utf8');
  const handlerStart = source.indexOf('const handleCreatePedidoPendiente = async (payload) =>');
  const handlerEnd = source.indexOf('const handleRecoverPedidoPendiente = async', handlerStart);
  const handler = source.slice(handlerStart, handlerEnd);
  const submissionCount = handler.split('prepareAndSubmitPedidoPendiente({').length - 1;
  assert.equal(submissionCount, 1);
  assert.equal(handler.includes('isDefinitiveCajaSessionError(error)'), true);
  assert.equal(handler.includes('if (!didRevalidateContext)'), true);
  assert.equal(handler.includes('await revalidatePedidoPendienteContext(payload)'), true);
});

test('un contexto inválido no prepara ni envía una operación', async () => {
  let prepared = 0;
  let submitted = 0;
  await assert.rejects(
    prepareAndSubmitPedidoPendiente({
      payload: {},
      revalidateContext: async () => {
        throw createPedidoPendienteContextError(resolvePedidoPendienteContextState({
          userId: 30,
          sucursalId: 1,
          cashSessionId: null
        }));
      },
      prepareOperation: () => { prepared += 1; },
      submitOperation: async () => { submitted += 1; }
    }),
    (error) => error.code === 'PEDIDO_PENDIENTE_SESION_CAJA_INACTIVA'
  );
  assert.equal(prepared, 0);
  assert.equal(submitted, 0);
});

test('Caja adquiere el bloqueo local antes de iniciar la revalidación asíncrona', async () => {
  const source = await readFile(new URL('../components/CajaView.jsx', import.meta.url), 'utf8');
  const handlerStart = source.indexOf('const handleCreatePedidoPendiente = async (payload) =>');
  const lockIndex = source.indexOf('creatingPedidoPendienteRef.current = true;', handlerStart);
  const submissionIndex = source.indexOf('prepareAndSubmitPedidoPendiente({', handlerStart);
  assert.ok(handlerStart >= 0 && lockIndex > handlerStart && submissionIndex > lockIndex);
});
