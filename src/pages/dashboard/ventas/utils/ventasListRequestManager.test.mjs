import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createVentasListRequestManager,
  isCancelledVentasListRequest,
  scheduleVentasActiveTabLoad
} from './ventasListRequestManager.js';

const createStateHarness = () => ({
  loading: false,
  rows: [],
  summary: null,
  pagination: null,
  scope: null,
  cache: null,
  lastFilters: null,
  errors: []
});

const commitIfCurrent = (manager, request, state, payload) => {
  if (!manager.isCurrent(request)) return false;
  state.rows = payload.rows;
  state.summary = payload.summary;
  state.pagination = payload.pagination;
  state.scope = payload.scope;
  state.cache = payload.cache;
  state.lastFilters = payload.filters;
  return true;
};

test('A lenta y B rapida: solo la ultima solicitud actualiza todo el estado', () => {
  const manager = createVentasListRequestManager();
  const state = createStateHarness();
  const requestA = manager.start();
  const requestB = manager.start();

  assert.equal(requestA.controller.signal.aborted, true);
  assert.equal(commitIfCurrent(manager, requestB, state, {
    rows: ['B'], summary: 'summary-B', pagination: 'pagination-B', scope: 'scope-B', cache: 'cache-B', filters: 'filters-B'
  }), true);
  assert.equal(commitIfCurrent(manager, requestA, state, {
    rows: ['A'], summary: 'summary-A', pagination: 'pagination-A', scope: 'scope-A', cache: 'cache-A', filters: 'filters-A'
  }), false);
  assert.deepEqual(state, {
    loading: false,
    rows: ['B'],
    summary: 'summary-B',
    pagination: 'pagination-B',
    scope: 'scope-B',
    cache: 'cache-B',
    lastFilters: 'filters-B',
    errors: []
  });
});

test('la ultima iniciada sigue siendo la unica valida aunque responda mas lento', () => {
  const manager = createVentasListRequestManager();
  const requestA = manager.start();
  const requestB = manager.start();
  assert.equal(manager.isCurrent(requestA), false);
  assert.equal(manager.isCurrent(requestB), true);
});

test('finalizar una solicitud cancelada no cambia loading de la vigente ni muestra error', () => {
  const manager = createVentasListRequestManager();
  const state = createStateHarness();
  const requestA = manager.start();
  state.loading = true;
  const requestB = manager.start();

  if (manager.finish(requestA)) state.loading = false;
  if (!isCancelledVentasListRequest({ code: 'REQUEST_TIMEOUT' }, requestA, manager)) state.errors.push('A');
  assert.equal(state.loading, true);
  assert.deepEqual(state.errors, []);

  if (manager.finish(requestB)) state.loading = false;
  assert.equal(state.loading, false);
});

test('desmontaje aborta la vigente e impide actualizaciones tardias', () => {
  const manager = createVentasListRequestManager();
  const request = manager.start();
  manager.abort();
  assert.equal(request.controller.signal.aborted, true);
  assert.equal(manager.isCurrent(request), false);
});

test('cambios rapidos siempre invalidan fecha, sucursal, estado, busqueda, pagina y limpiar anteriores', () => {
  const manager = createVentasListRequestManager();
  const requests = ['fecha', 'sucursal', 'estado', 'busqueda', 'pagina', 'limpiar'].map(() => manager.start());
  requests.slice(0, -1).forEach((request) => assert.equal(manager.isCurrent(request), false));
  assert.equal(manager.isCurrent(requests.at(-1)), true);
});

test('Strict Mode cancela el efecto especulativo y ejecuta una sola carga vigente', async () => {
  const started = [];
  const cancelSpeculative = scheduleVentasActiveTabLoad(() => started.push('speculative'));
  cancelSpeculative();
  const cancelCurrent = scheduleVentasActiveTabLoad(() => started.push('current'));

  await new Promise((resolve) => queueMicrotask(resolve));

  assert.deepEqual(started, ['current']);
  cancelCurrent();
});
