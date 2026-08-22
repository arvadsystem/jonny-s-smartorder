import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogSearchController } from './solicitudesCompraCatalogSearch.js';

const fixture = () => {
  const requests = [];
  const timers = new Map();
  let nextTimer = 1;
  const controller = createCatalogSearchController({
    getWarehouseId: () => 11,
    loadCatalog: async (options) => { requests.push(options); },
    scheduleTimer: (callback) => { const id = nextTimer++; timers.set(id, callback); return id; },
    cancelTimer: (id) => timers.delete(id)
  });
  const flush = async () => {
    const pending = [...timers.values()];
    timers.clear();
    for (const callback of pending) callback();
    await Promise.resolve();
  };
  return { controller, requests, timers, flush };
};

test('c co con antes del debounce producen solo buscar con', async () => {
  const f = fixture();
  f.controller.changeSearch('c');
  f.controller.changeSearch('co');
  f.controller.changeSearch('con');
  assert.equal(f.timers.size, 1);
  await f.flush();
  assert.deepEqual(f.requests.map((request) => request.buscar), ['con']);
});

test('Enter inmediato usa el valor mas reciente y cancela debounce', async () => {
  const f = fixture();
  f.controller.changeSearch('concentrado');
  f.controller.changeSearch('concentrado pina');
  await f.controller.submit();
  await f.flush();
  assert.deepEqual(f.requests.map((request) => request.buscar), ['concentrado pina']);
});

test('primer clic Buscar usa azucar y no duplica request pendiente', async () => {
  const f = fixture();
  f.controller.changeSearch('azucar');
  await f.controller.submit();
  await f.flush();
  assert.deepEqual(f.requests.map((request) => request.buscar), ['azucar']);
});

test('Escape limpia texto y ejecuta una sola consulta inmediata', async () => {
  const f = fixture();
  f.controller.changeSearch('pina');
  await f.controller.escape();
  await f.flush();
  assert.deepEqual(f.requests.map((request) => request.buscar), ['']);
});

test('tipo y scope inmediatos conservan texto mas reciente', async () => {
  const type = fixture();
  type.controller.changeSearch('pina');
  await type.controller.changeType('insumo');
  await type.flush();
  assert.deepEqual(type.requests, [{ id_almacen: 11, buscar: 'pina', tipo: 'insumo', page: 1 }]);

  const scope = fixture();
  scope.controller.changeSearch('pina');
  await scope.controller.changeScope('low');
  await scope.flush();
  assert.deepEqual(scope.requests, [{ id_almacen: 11, buscar: 'pina', tipo: '', solo_stock_bajo: 'true', page: 1 }]);
});

test('paginacion conserva todos los filtros vigentes', async () => {
  const f = fixture();
  f.controller.changeSearch('azucar');
  await f.controller.changeType('insumo');
  await f.controller.changeScope('low');
  f.requests.length = 0;
  await f.controller.page(3);
  assert.deepEqual(f.requests, [{ id_almacen: 11, buscar: 'azucar', tipo: 'insumo', solo_stock_bajo: 'true', page: 3 }]);
});

test('Limpiar filtros genera una sola consulta con valores iniciales', async () => {
  const f = fixture();
  f.controller.changeSearch('pina');
  await f.controller.changeType('insumo');
  await f.controller.changeScope('low');
  f.requests.length = 0;
  await f.controller.clear();
  await f.flush();
  assert.deepEqual(f.requests, [{ id_almacen: 11, buscar: '', tipo: '', page: 1 }]);
});
