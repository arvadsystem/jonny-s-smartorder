import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relative) => readFile(new URL(relative, import.meta.url), 'utf8');

test('catalogo usa debounce nativo de 300 ms desde el primer caracter', async () => {
  const source = await read('../components/SolicitudCompraCatalogo.jsx');
  assert.match(source, /onChange=\{\(event\) => changeSearch\(event\.target\.value\)\}/);
  assert.match(source, /setTimeout\(\(\) => \{[\s\S]*catalogOptions\(1, \{ search: value \}\)[\s\S]*\}, 300\)/);
  assert.match(source, /clearTimeout\(debounceRef\.current\)/);
  assert.doesNotMatch(source, /from ['"](?:lodash|use-debounce)|require\(['"](?:lodash|use-debounce)/i);
});

test('Enter Escape Buscar y Limpiar cancelan debounce y ejecutan inmediatamente', async () => {
  const source = await read('../components/SolicitudCompraCatalogo.jsx');
  assert.match(source, /event\.key === 'Enter'[\s\S]*void load\(1\)/);
  assert.match(source, /event\.key === 'Escape'[\s\S]*setSearch\(''\)[\s\S]*search: ''/);
  assert.match(source, /onClick=\{\(\) => load\(1\)\}/);
  assert.match(source, /const clearFilters = \(\) => \{[\s\S]*cancelDebounce\(\)[\s\S]*search: '', type: '', scope: 'all'/);
});

test('tipo alcance y paginacion conservan los filtros actuales', async () => {
  const source = await read('../components/SolicitudCompraCatalogo.jsx');
  assert.match(source, /catalogOptions\(1, \{ type: value \}\)/);
  assert.match(source, /catalogOptions\(1, \{ scope: nextScope \}\)/);
  assert.match(source, /onClick=\{\(\) => load\(page - 1\)\}/);
  assert.match(source, /onClick=\{\(\) => load\(page \+ 1\)\}/);
});

test('desmontaje limpia timeout y proteccion stale permanece en el hook', async () => {
  const catalog = await read('../components/SolicitudCompraCatalogo.jsx');
  const hook = await read('../hooks/useSolicitudesCompra.js');
  assert.match(catalog, /return \(\) => \{[\s\S]*clearTimeout\(debounceRef\.current\)/);
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
