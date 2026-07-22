import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createCatalogRequestCoordinator, createEmptyCatalogState } from './solicitudesCompraUtils.js';

const read = (relative) => readFile(new URL(relative, import.meta.url), 'utf8');

test('respuesta antigua del catalogo no puede sobrescribir la nueva', () => {
  const coordinator = createCatalogRequestCoordinator();
  const oldRequest = coordinator.begin('1');
  const newRequest = coordinator.begin('1');
  assert.equal(coordinator.isCurrent(oldRequest, '1'), false);
  assert.equal(coordinator.isCurrent(newRequest, '1'), true);
});

test('cambiar almacen invalida solicitud anterior y limpia items', () => {
  const coordinator = createCatalogRequestCoordinator();
  const oldRequest = coordinator.begin('1');
  coordinator.invalidate();
  const state = createEmptyCatalogState('2', true);
  assert.equal(coordinator.isCurrent(oldRequest, '1'), false);
  assert.deepEqual(state.items, []);
  assert.deepEqual(state.pagination, { page: 1, total_pages: 1 });
  assert.equal(state.error, '');
  assert.equal(state.requestedWarehouseId, '2');
});

test('cambios rapidos de filtros conservan solo la ultima solicitud', () => {
  const coordinator = createCatalogRequestCoordinator();
  const searchRequest = coordinator.begin('7');
  const typeRequest = coordinator.begin('7');
  const pageRequest = coordinator.begin('7');
  assert.equal(coordinator.isCurrent(searchRequest, '7'), false);
  assert.equal(coordinator.isCurrent(typeRequest, '7'), false);
  assert.equal(coordinator.isCurrent(pageRequest, '7'), true);
});

test('durante carga o cambio de almacen no se renderizan cards anteriores', async () => {
  const catalog = await read('../components/SolicitudCompraCatalogo.jsx');
  assert.match(catalog, /requestedWarehouseId/);
  assert.match(catalog, /matchesWarehouse && !state\.loading/);
  assert.match(catalog, /visibleItems\.map/);
});

test('hook descarta respuestas obsoletas y limpia catalogo antes de cargar', async () => {
  const hook = await read('../hooks/useSolicitudesCompra.js');
  assert.match(hook, /catalogRequest\.current\.begin/);
  assert.match(hook, /setCatalogState\(createEmptyCatalogState\(warehouseId, true\)\)/);
  assert.match(hook, /if \(!catalogRequest\.current\.isCurrent/);
});

test('OrdenesCompraTab conserva exactamente su SHA de Git', async () => {
  const content = await readFile(new URL('../../../../pages/dashboard/inventario/OrdenesCompraTab.jsx', import.meta.url));
  const normalized = Buffer.from(content.toString('utf8').replace(/\r\n/g, '\n'));
  const header = Buffer.from(`blob ${normalized.length}\0`);
  assert.equal(createHash('sha1').update(header).update(normalized).digest('hex'), '08b35bb7ca08789a3781a10423359e1da01b154b');
});
