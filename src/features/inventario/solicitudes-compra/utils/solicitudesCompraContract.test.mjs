import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const read = (relative) => readFile(new URL(relative, import.meta.url), 'utf8');

test('servicio usa exclusivamente endpoints nuevos autorizados', async () => {
  const source = await read('../../../../services/solicitudesCompraService.js');
  assert.match(source, /\/solicitudes_compra\/catalogo/);
  assert.match(source, /crearSolicitud:[\s\S]*\/solicitudes_compra'[\s\S]*'POST'/);
  assert.match(source, /getSolicitudes:[\s\S]*\/solicitudes_compra/);
  assert.match(source, /getSolicitudById:[\s\S]*\/solicitudes_compra\/\$\{/);
  assert.doesNotMatch(source, /orden_compras|detalle_orden_compras|ordenes_compra_workflow|\/compras/);
});
test('query params usan URLSearchParams y omiten vacios', async () => {
  const source = await read('../../../../services/solicitudesCompraService.js');
  assert.match(source, /new URLSearchParams/); assert.match(source, /hasValue/); assert.doesNotMatch(source, /buscar=\$\{/);
});
test('Inventario monta componente nuevo y desconecta componente viejo', async () => {
  const source = await read('../../../../pages/dashboard/Inventario.jsx');
  assert.match(source, /SolicitudesCompraTab/); assert.doesNotMatch(source, /import OrdenesCompraTab/); assert.doesNotMatch(source, /<OrdenesCompraTab/);
});
test('archivo viejo permanece fisicamente', async () => {
  await access(new URL('../../../../pages/dashboard/inventario/OrdenesCompraTab.jsx', import.meta.url));
});
test('permisos controlan consulta, detalle y creacion', async () => {
  const source = await read('../SolicitudesCompraTab.jsx');
  assert.match(source, /VIEW_PERMISSIONS/); assert.match(source, /CREATE_PERMISSIONS/); assert.match(source, /<SinPermiso/); assert.match(source, /canCreate/);
});
test('componentes usan AppSelect para almacen y presentacion', async () => {
  const create = await read('../components/NuevaSolicitudCompra.jsx');
  const catalog = await read('../components/SolicitudCompraCatalogo.jsx');
  assert.match(create, /import AppSelect/); assert.match(create, /<AppSelect/); assert.match(catalog, /import AppSelect/); assert.match(catalog, /<AppSelect/);
});
test('flujo no contiene polling ni modales', async () => {
  const hook = await read('../hooks/useSolicitudesCompra.js');
  const tab = await read('../SolicitudesCompraTab.jsx');
  assert.doesNotMatch(hook, /setInterval|polling/i); assert.doesNotMatch(tab, /modal/i);
});
test('creacion operativa permanece separada de recepcion, evidencia y proveedores', async () => {
  const files = await Promise.all(['../hooks/useSolicitudesCompra.js', '../components/NuevaSolicitudCompra.jsx'].map(read));
  assert.doesNotMatch(files.join('\n'), /factura|createSignedUrl|subir.*imagen|\/recibir|\/evidencias|\/proveedores/i);
});
test('no hay imports Supabase ni credenciales o project IDs', async () => {
  const files = await Promise.all(['../SolicitudesCompraTab.jsx', '../hooks/useSolicitudesCompra.js', '../../../../services/solicitudesCompraService.js'].map(read));
  assert.doesNotMatch(files.join('\n'), /supabase|service_role|project[_-]?id|https?:\/\//i);
});
test('borrador se conserva ante error y doble envio queda bloqueado', async () => {
  const create = await read('../components/NuevaSolicitudCompra.jsx');
  const hook = await read('../hooks/useSolicitudesCompra.js');
  assert.match(create, /conserva el borrador/); assert.match(create, /submitting/); assert.match(hook, /submitLock\.current/);
});

test('catalogo inicia completo y la primera carga no solicita solo stock bajo', async () => {
  const catalog = await read('../components/SolicitudCompraCatalogo.jsx');
  assert.match(catalog, /useState\('all'\)/);
  assert.match(catalog, /loadCatalog\(\{ id_almacen: warehouseId, page: 1 \}\)/);
  assert.doesNotMatch(catalog, /useState\(true\)|solo_stock_bajo:\s*'true',\s*page:\s*1/);
});

test('alcance del catalogo usa opciones accesibles y solo reposicion envia true', async () => {
  const catalog = await read('../components/SolicitudCompraCatalogo.jsx');
  assert.match(catalog, /Todo el catálogo/);
  assert.match(catalog, /Necesitan reposición/);
  assert.match(catalog, /aria-pressed=\{scope === 'all'\}/);
  assert.match(catalog, /aria-pressed=\{scope === 'low'\}/);
  assert.match(catalog, /nextScope === 'low' \? \{ solo_stock_bajo: 'true' \} : \{\}/);
});

test('tipo alcance busqueda y limpiar filtros regresan a pagina uno', async () => {
  const catalog = await read('../components/SolicitudCompraCatalogo.jsx');
  assert.match(catalog, /catalogOptions\(1, \{ type: value \}\)/);
  assert.match(catalog, /catalogOptions\(1, \{ scope: nextScope \}\)/);
  assert.match(catalog, /load\(1\)/);
  assert.match(catalog, /setSearch\(''\);[\s\S]*setType\(''\);[\s\S]*setScope\('all'\)/);
  assert.match(catalog, /catalogOptions\(1, \{ search: '', type: '', scope: 'all' \}\)/);
});

test('cambio de almacen reinicia catalogo y borrador sin mostrar resultados previos', async () => {
  const create = await read('../components/NuevaSolicitudCompra.jsx');
  const catalog = await read('../components/SolicitudCompraCatalogo.jsx');
  assert.match(create, /setWarehouseId\(selected\); setLines\(\[\]\)/);
  assert.match(create, /<SolicitudCompraCatalogo key=\{warehouseId\}/);
  assert.match(catalog, /matchesWarehouse && !state\.loading \? state\.items : \[\]/);
});

test('frontend conserva exactamente el orden recibido y no filtra disponibles', async () => {
  const catalog = await read('../components/SolicitudCompraCatalogo.jsx');
  assert.match(catalog, /visibleItems\.map/);
  assert.doesNotMatch(catalog, /\.sort\(|estado_stock\s*!==\s*['"]DISPONIBLE|\.filter\([^)]*estado_stock/);
  assert.match(catalog, /sol-comp-stock--\$\{String\(item\.estado_stock\)/);
  assert.match(catalog, /<button type="button" className="btn btn-outline-primary" onClick=\{add\}>/);
});

test('catalogo conserva badges presentaciones equivalencia y validaciones', async () => {
  const catalog = await read('../components/SolicitudCompraCatalogo.jsx');
  assert.match(catalog, /SIN_STOCK: 'Sin stock'/);
  assert.match(catalog, /STOCK_BAJO: 'Stock bajo'/);
  assert.match(catalog, /DISPONIBLE: 'Disponible'/);
  assert.match(catalog, /import AppSelect/);
  assert.match(catalog, /equivale a/);
  assert.match(catalog, /hasta 4 decimales/);
  assert.match(catalog, /entera positiva/);
});

test('listado conserva acciones y agrega filtro canceladas con aria pressed', async () => {
  const list = await read('../components/SolicitudesCompraListado.jsx');
  assert.match(list, /\['CANCELADA', 'Canceladas'\]/);
  assert.match(list, /aria-pressed=\{filter === filterValue\}/);
  assert.match(list, /'PENDIENTE' \? 'Revisar solicitud'/);
  assert.match(list, /'APROBADA' \? 'Recibir solicitud'/);
  assert.match(list, /: 'Ver detalle'/);
});

test('resumen no contiene datos monetarios y conserva payload actual', async () => {
  const [summary, create] = await Promise.all([
    read('../components/SolicitudCompraResumen.jsx'),
    read('../components/NuevaSolicitudCompra.jsx')
  ]);
  assert.doesNotMatch(summary, /precio|costo|impuesto|subtotal|total monetario/i);
  assert.match(create, /buildSolicitudPayload\(\{ idAlmacen: warehouseId, observacion: observation, detalles: lines \}\)/);
  assert.match(create, /upsertDraftLine\(lines, line\)/);
});

test('css permanece encapsulado y evita recorte u overflow horizontal intencional', async () => {
  const css = await read('../solicitudesCompra.css');
  const selectorBlockOpenings = css
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('@') && line.endsWith('{'));
  assert.ok(selectorBlockOpenings.length > 0);
  assert.ok(
    selectorBlockOpenings.every((selector) => selector.includes('.sol-comp-')),
  );
  assert.doesNotMatch(css, /overflow-x\s*:|overflow\s*:\s*hidden/i);
  const cssRuleBlocks = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const cardsWithFixedHeight = cssRuleBlocks.filter(
    ([, selectors, declarations]) =>
      selectors
        .split(',')
        .map((selector) => selector.trim())
        .some((selector) =>
          /^(?:\.sol-comp-request-card|\.sol-comp-catalog-card|\.sol-comp-detail-lines article)$/.test(
            selector,
          ),
        ) &&
      /(^|[;\s])height\s*:/i.test(declarations),
  );
  assert.deepEqual(cardsWithFixedHeight, []);
  assert.match(css, /grid-template-columns:\s*repeat\(3/);
  assert.match(css, /@media \(max-width: 767px\)/);
  assert.match(css, /@media \(max-width: 479px\)/);
});
