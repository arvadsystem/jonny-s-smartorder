import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = (relative) => readFile(new URL(relative, import.meta.url), 'utf8');

test('catalogo administrativo reutiliza componente canonico con almacen fijo y labels requeridos', async () => {
  const panel = await read('../components/SolicitudCompraRevisionPanel.jsx');
  assert.match(panel, /<SolicitudCompraCatalogo/);
  assert.match(panel, /warehouseId=\{solicitud\?\.almacen\?\.id_almacen\}/);
  assert.match(panel, /quantityLabel="Cantidad a agregar"/);
  assert.match(panel, /addLabel="Agregar a solicitud"/);
  assert.match(panel, /previewLabel="Cantidad que se aprobará"/);
  assert.match(panel, /canApprove \? <section className="sol-comp-review-catalog"/);
});

test('lineas muestran origen y Quitar queda limitado a temporales administrativas', async () => {
  const line = await read('../components/SolicitudCompraRevisionLinea.jsx');
  assert.match(line, /Agregado por Administración/);
  assert.match(line, /Solicitado por sucursal/);
  assert.match(line, /administrative \? <button[\s\S]*>Quitar<\/button> : null/);
});

test('hook agrega sin POST inmediato bloquea duplicados y permite quitar solo temporal', async () => {
  const hook = await read('../hooks/useSolicitudCompraRevision.js');
  const add = hook.slice(hook.indexOf('const addAdministrativeLine'), hook.indexOf('const removeAdministrativeLine'));
  assert.match(add, /administrativeLineKey/);
  assert.match(add, /Este artículo ya está en la solicitud/);
  assert.doesNotMatch(add, /aprobarSolicitud|apiFetch|fetch\(/);
  assert.match(hook, /line\.id_solicitud_detalle \|\| line\._line_key !== lineKey/);
});

test('modal de aprobacion incluye nuevas y conserva provider bulk', async () => {
  const panel = await read('../components/SolicitudCompraRevisionPanel.jsx');
  assert.match(panel, /<ProveedorBulkAssignment[\s\S]*lines=\{review\.lines\}/);
  assert.match(panel, /review\.lines\.map/);
  assert.match(panel, /line\.origen_linea === 'ADMINISTRACION' \? 'Agregado por Administración'/);
});

test('detalle posterior conserva origen y recepcion normal permanece montada', async () => {
  const detail = await read('../components/SolicitudCompraDetalle.jsx');
  assert.match(detail, /line\.origen_linea === 'ADMINISTRACION' \? 'Agregado por Administración'/);
  assert.match(detail, /<SolicitudCompraRecepcionPanel/);
  assert.doesNotMatch(detail, /recepcionAdministrativa|movimientoManual/);
});
