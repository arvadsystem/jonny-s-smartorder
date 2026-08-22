import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relative) => readFile(new URL(relative, import.meta.url), 'utf8');

test('catalogo usa debounce nativo de 300 ms desde el primer caracter', async () => {
  const [component, controller] = await Promise.all([read('../components/SolicitudCompraCatalogo.jsx'), read('./solicitudesCompraCatalogSearch.js')]);
  assert.match(component, /onChange=\{\(event\) => changeSearch\(event\.target\.value\)\}/);
  assert.match(component, /searchController\.changeSearch\(value\)/);
  assert.match(controller, /delay = 300/);
  assert.match(controller, /pendingTimer = scheduleTimer/);
  assert.match(controller, /cancelTimer\(pendingTimer\)/);
  assert.doesNotMatch(`${component}\n${controller}`, /from ['"](?:lodash|use-debounce)|require\(['"](?:lodash|use-debounce)/i);
});

test('Enter Escape Buscar y Limpiar cancelan debounce y ejecutan inmediatamente', async () => {
  const source = await read('../components/SolicitudCompraCatalogo.jsx');
  assert.match(source, /event\.key === 'Enter'[\s\S]*searchController\.submit\(\)/);
  assert.match(source, /event\.key === 'Escape'[\s\S]*setSearch\(''\)[\s\S]*searchController\.escape\(\)/);
  assert.match(source, /onClick=\{\(\) => searchController\.submit\(\)\}/);
  assert.match(source, /const clearFilters = \(\) => \{[\s\S]*setSearch\(''\)[\s\S]*searchController\.clear\(\)/);
});

test('tipo alcance y paginacion conservan los filtros actuales', async () => {
  const source = await read('../components/SolicitudCompraCatalogo.jsx');
  assert.match(source, /searchController\.changeType\(value\)/);
  assert.match(source, /searchController\.changeScope\(nextScope\)/);
  assert.match(source, /searchController\.page\(page - 1\)/);
  assert.match(source, /searchController\.page\(page \+ 1\)/);
});

test('desmontaje limpia timeout y proteccion stale permanece en el hook', async () => {
  const catalog = await read('../components/SolicitudCompraCatalogo.jsx');
  const hook = await read('../hooks/useSolicitudesCompra.js');
  assert.match(catalog, /return \(\) => searchController\.dispose\(\)/);
  assert.match(hook, /createCatalogRequestCoordinator/);
  assert.match(hook, /catalogRequest\.current\.isCurrent/);
});

test('busqueda no filtra items localmente ni modifica resumen', async () => {
  const source = await read('../components/SolicitudCompraCatalogo.jsx');
  assert.doesNotMatch(source, /state\.items\.(?:filter|find|reduce)/);
  assert.doesNotMatch(source, /setLines|setObservation|upsertDraftLine|buildSolicitudPayload/);
  assert.match(source, /No encontramos artículos\{search \? ` para “\$\{search\}”` : ''\}/);
  assert.match(source, /Buscando catálogo…/);
});
