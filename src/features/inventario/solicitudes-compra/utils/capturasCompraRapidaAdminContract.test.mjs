import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('navegacion administrativa exige VER y GESTIONAR mientras operativo conserva CREAR y VER', async () => {
  const [tab, list] = await Promise.all([read('../SolicitudesCompraTab.jsx'), read('../components/SolicitudesCompraListado.jsx')]);
  assert.match(tab, /canQuickCaptureAdmin=\{canQuickCaptureView && canQuickCaptureManage\}/);
  assert.match(tab, /if \(!canQuickCaptureView \|\| !canQuickCaptureManage\)/);
  assert.match(tab, /if \(!canQuickCaptureCreate \|\| !canQuickCaptureView\)/);
  assert.match(list, /canQuickCaptureAdmin \? [\s\S]*Capturas rápidas/);
  assert.match(list, /canQuickCaptureCreate \? [\s\S]*Compra rápida/);
});

test('bandeja inicia PENDIENTE y filtros y busqueda llegan al query canonico', async () => {
  const [hook, component] = await Promise.all([read('../hooks/useCapturasCompraRapidaAdmin.js'), read('../components/CapturasCompraRapidaAdmin.jsx')]);
  assert.match(hook, /useState\('PENDIENTE'\)/);
  assert.match(hook, /listQuickCaptures\(\{ page, limit: 20, estado, buscar \}\)/);
  for (const state of ['PENDIENTE', 'FORMALIZADA', 'RECHAZADA', 'BORRADOR']) assert.match(component, new RegExp(state));
  assert.match(component, /Buscar por número, usuario, sucursal o almacén/);
  assert.match(component, /maxLength=\{120\}/);
});

test('cards muestran identidad cantidad de facturas y metadata requerida', async () => {
  const component = await read('../components/CapturasCompraRapidaAdmin.jsx');
  assert.match(component, /registrador\?\.nombre/);
  assert.match(component, /cantidad_evidencias/);
  for (const label of ['Sucursal', 'Almacén', 'Enviado por', 'Fecha de envío', 'Facturas']) assert.match(component, new RegExp(label));
});

test('detalle carga captura y evidencias juntas y galeria es read only', async () => {
  const [hook, component] = await Promise.all([read('../hooks/useCapturasCompraRapidaAdmin.js'), read('../components/CapturasCompraRapidaAdmin.jsx')]);
  assert.match(hook, /Promise\.all\(\[solicitudesCompraService\.getQuickCapture\(id\), solicitudesCompraService\.listQuickCaptureEvidence\(id\)\]\)/);
  assert.match(component, /url_firmada/);
  assert.match(component, /target="_blank" rel="noopener noreferrer"/);
  assert.doesNotMatch(component, /deleteQuickCaptureEvidence|uploadQuickCaptureInvoice|type="file"/);
});

test('rechazo depende exclusivamente de acciones puede_rechazar y modal no llama API al abrir', async () => {
  const component = await read('../components/CapturasCompraRapidaAdmin.jsx');
  assert.match(component, /capture\.acciones\?\.puede_rechazar === true/);
  assert.match(component, /setRejectOpen\(true\)/);
  assert.doesNotMatch(component, /rejectQuickCapture/);
  assert.match(component, /La captura permanecerá en el historial y las facturas no serán eliminadas/);
});

test('motivo obligatorio presets limite y doble submit quedan protegidos', async () => {
  const [hook, component] = await Promise.all([read('../hooks/useCapturasCompraRapidaAdmin.js'), read('../components/CapturasCompraRapidaAdmin.jsx')]);
  for (const preset of ['Factura duplicada', 'Compra ya registrada', 'Factura incorrecta', 'Enviada por error', 'Otro motivo']) assert.match(component, new RegExp(preset));
  assert.match(component, /maxLength=\{1000\}/);
  assert.match(component, /disabled=\{flow\.busy \|\| !flow\.reason\.trim\(\)\}/);
  assert.match(hook, /if \(actionLock\.current/);
  assert.equal((hook.match(/rejectQuickCapture\(/g) || []).length, 1);
  assert.match(component, /Rechazando…/);
});

test('exito 409 y 403 usan contratos visibles y refresh canonico', async () => {
  const hook = await read('../hooks/useCapturasCompraRapidaAdmin.js');
  assert.match(hook, /CAPTURA RECHAZADA/);
  assert.match(hook, /La captura fue rechazada correctamente/);
  assert.match(hook, /La captura cambió y ya no puede rechazarse/);
  assert.match(hook, /No tienes permiso para gestionar esta captura/);
  assert.match(hook, /Promise\.allSettled\(\[refreshDetail\(\), loadList/);
  assert.match(hook, /actionLock\.current = false/);
});

test('rechazada y formalizada son read only y muestran motivo u OC', async () => {
  const [admin, operative] = await Promise.all([read('../components/CapturasCompraRapidaAdmin.jsx'), read('../components/CapturasCompraRapidaOperativa.jsx')]);
  for (const source of [admin, operative]) {
    assert.match(source, /motivo_rechazo/);
    assert.match(source, /id_solicitud_compra/);
  }
  assert.doesNotMatch(admin, /Formalizar compra/);
});

test('servicio usa endpoint rechazo existente y QR2 y OC normal permanecen montados', async () => {
  const [service, tab] = await Promise.all([read('../../../../services/solicitudesCompraService.js'), read('../SolicitudesCompraTab.jsx')]);
  assert.match(service, /rejectQuickCapture: \(id, motivo_rechazo\)/);
  assert.match(service, /capturas-rapidas\/\$\{encodeURIComponent\(String\(id\)\)\}\/rechazar/);
  assert.match(tab, /CapturasCompraRapidaOperativa/);
  assert.match(tab, /CapturasCompraRapidaAdmin/);
  assert.match(tab, /NuevaSolicitudCompra/);
  assert.match(tab, /SolicitudCompraDetalle/);
});

test('CSS administrativo es focalizado y responsive sin overflow funcional', async () => {
  const css = await read('../solicitudesCompra.css');
  assert.match(css, /sol-comp-quick-admin/);
  assert.match(css, /sol-comp-modal-backdrop/);
  assert.match(css, /width: min\(36rem, 100%\)/);
});
