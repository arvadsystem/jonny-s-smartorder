import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relative) => readFile(new URL(relative, import.meta.url), 'utf8');

test('servicio envia buscar como filtro del listado', async () => {
  const source = await read('../../../../services/solicitudesCompraService.js');
  assert.match(source, /LIST_FILTERS\s*=\s*\[[^\]]*'buscar'/);
  assert.match(source, /getSolicitudes:[\s\S]*LIST_FILTERS/);
});

test('hook conserva busqueda, usa debounce nativo y protege respuestas obsoletas', async () => {
  const source = await read('../hooks/useSolicitudesCompra.js');
  assert.match(source, /setTimeout\(execute,\s*300\)/);
  assert.match(source, /clearTimeout\(debounceRef\.current\)/);
  assert.match(source, /requestId !== listRequest\.current/);
  assert.match(source, /mounted\.current/);
  assert.match(source, /buscar:\s*search/);
  assert.doesNotMatch(source, /lodash|use-debounce|debounce\(/i);
});

test('listado ofrece busqueda accesible, Enter, Escape, limpiar y estado vacio contextual', async () => {
  const source = await read('../components/SolicitudesCompraListado.jsx');
  assert.match(source, /type="search"/);
  assert.match(source, /Buscar por número, solicitante, artículo, sucursal o almacén/);
  assert.match(source, /event\.key === 'Enter'/);
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /Limpiar búsqueda/);
  assert.match(source, /No encontramos solicitudes/);
  assert.match(source, /dentro del estado seleccionado/);
});

test('paginacion, cambio de estado y retorno de detalle conservan buscar', async () => {
  const source = await read('../SolicitudesCompraTab.jsx');
  assert.match(source, /onPage=\{\(page\) => flow\.loadList\(\{ page, estado: flow\.filter, buscar: flow\.search \}\)\}/);
  assert.match(source, /reloadList=\{\(\) => flow\.loadList\(\{[\s\S]*buscar: flow\.search/);
  const hook = await read('../hooks/useSolicitudesCompra.js');
  assert.match(hook, /loadList\(\{ page: 1, estado, buscar: search \}\)/);
});
