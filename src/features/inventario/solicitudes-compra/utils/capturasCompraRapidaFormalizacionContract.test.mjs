import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('formalizacion depende de capacidad backend y clic inicial no ejecuta POST', async () => {
  const [component, hook] = await Promise.all([read('../components/CapturasCompraRapidaAdmin.jsx'), read('../hooks/useCapturasCompraRapidaAdmin.js')]);
  assert.match(component, /acciones\?\.puede_formalizar === true/);
  assert.match(component, /onClick=\{flow\.startFormalization\}/);
  assert.match(hook, /getQuickCaptureProviders/);
  assert.match(hook, /formalizeQuickCapture[\s\S]*confirmOpen/);
});

test('preparacion conserva almacen fijo facturas catalogo labels y proveedor obligatorio', async () => {
  const component = await read('../components/CapturasCompraRapidaAdmin.jsx');
  assert.match(component, /Almacén fijo/);
  assert.match(component, /warehouseId=\{capture\.id_almacen\}/);
  assert.match(component, /flow\.evidence\.map/);
  assert.match(component, /Cantidad recibida/);
  assert.match(component, /Agregar a compra/);
  assert.match(component, /Entrada al inventario/);
  assert.match(component, /Proveedor \*/);
});

test('upsert action lock payload exacto confirmacion refresh y Ver OC usan flujo canonico', async () => {
  const [component, hook, service, tab] = await Promise.all([read('../components/CapturasCompraRapidaAdmin.jsx'), read('../hooks/useCapturasCompraRapidaAdmin.js'), read('../../../../services/solicitudesCompraService.js'), read('../SolicitudesCompraTab.jsx')]);
  assert.match(hook, /upsertDraftLine/);
  assert.match(hook, /actionLock\.current/);
  assert.match(hook, /tipo_item: line\.tipo_item, id_item: Number\(line\.id_item\)/);
  assert.match(hook, /id_proveedor: Number\(line\.id_proveedor\)/);
  assert.match(component, /Formalizar compra e ingresar a inventario/);
  assert.match(component, /Formalizando…/);
  assert.match(hook, /COMPRA FORMALIZADA/);
  assert.match(hook, /Promise\.all\(\[refreshDetail\(\), loadList/);
  assert.match(service, /capturas-rapidas\/\$\{encodeURIComponent\(String\(id\)\)\}\/formalizar/);
  assert.match(component, /onOpenRequest\(capture\.id_solicitud_compra\)/);
  assert.match(tab, /onOpenRequest=\{flow\.openDetail\}/);
});

test('409 403 y errores explicitos son visibles y rechazo muestra error dentro del modal', async () => {
  const [component, hook] = await Promise.all([read('../components/CapturasCompraRapidaAdmin.jsx'), read('../hooks/useCapturasCompraRapidaAdmin.js')]);
  assert.match(hook, /La captura cambió y ya no puede formalizarse/);
  assert.match(hook, /No tienes permiso para formalizar esta captura/);
  assert.match(hook, /mapReceptionError\(error\)/);
  assert.match(component, /flow\.rejectOpen[\s\S]*flow\.error[\s\S]*Confirmar rechazo/);
});
