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
  assert.doesNotMatch(source, /orden_compras|detalle_orden_compras|ordenes_compra_workflow|\/compras|recibir|evidencias/);
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
test('flujo no implementa factura, evidencia, recepcion o proveedor', async () => {
  const files = await Promise.all(['../SolicitudesCompraTab.jsx', '../hooks/useSolicitudesCompra.js', '../components/NuevaSolicitudCompra.jsx'].map(read));
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
