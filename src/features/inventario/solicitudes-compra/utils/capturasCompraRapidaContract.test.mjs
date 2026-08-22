import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prevalidateInvoiceFiles, uploadInvoiceFilesSequentially, validateInvoiceBatch } from './solicitudesCompraRecepcionUtils.js';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const file = (name = 'factura.jpg', type = 'image/jpeg', bytes = [0xff, 0xd8, 0xff]) => ({ name, type, size: bytes.length, slice: () => ({ arrayBuffer: async () => Uint8Array.from(bytes).buffer }) });

test('permisos y boton Compra rapida dependen exclusivamente de CREAR', async () => {
  const [permissions, tab, list] = await Promise.all([read('../../../../utils/permissions.js'), read('../SolicitudesCompraTab.jsx'), read('../components/SolicitudesCompraListado.jsx')]);
  for (const permission of ['INVENTARIO_OC_CAPTURA_RAPIDA_CREAR', 'INVENTARIO_OC_CAPTURA_RAPIDA_VER', 'INVENTARIO_OC_CAPTURA_RAPIDA_GESTIONAR']) assert.match(permissions, new RegExp(permission));
  assert.match(tab, /canQuickCaptureCreate = canAny\(\[PERMISSIONS\.INVENTARIO_OC_CAPTURA_RAPIDA_CREAR\]\)/);
  assert.match(list, /canQuickCaptureCreate \? [\s\S]*Compra rápida/);
});

test('abrir pantalla no crea draft y creación ocurre después de prevalidar lote', async () => {
  const hook = await read('../hooks/useCapturasCompraRapida.js');
  assert.doesNotMatch(hook, /useEffect\([^)]*createQuickCapture/);
  assert.ok(hook.indexOf('await prevalidateInvoiceFiles(files)') < hook.indexOf('await solicitudesCompraService.createQuickCapture()'));
});

test('lote con una imagen invalida no llega a acciones servidor', async () => {
  const invalid = file('factura.pdf', 'application/pdf', [1, 2]);
  assert.equal(validateInvoiceBatch([file(), invalid], 0).valid, false);
  await assert.rejects(prevalidateInvoiceFiles([file(), file('falsa.png', 'image/png', [0xff, 0xd8, 0xff])]));
});

test('uploads se ejecutan secuencialmente y conservan fallos parciales', async () => {
  const order = [];
  const result = await uploadInvoiceFilesSequentially([file('1.jpg'), file('2.jpg'), file('3.jpg')], async (current) => {
    order.push(`start-${current.name}`);
    if (current.name === '2.jpg') throw new Error('red');
    order.push(`end-${current.name}`);
  });
  assert.deepEqual(order, ['start-1.jpg', 'end-1.jpg', 'start-2.jpg', 'start-3.jpg', 'end-3.jpg']);
  assert.equal(result.uploaded, 2);
  assert.equal(result.failures.length, 1);
});

test('máximo diez y evidencia once bloqueada', () => {
  assert.equal(validateInvoiceBatch([file()], 9).valid, true);
  assert.equal(validateInvoiceBatch([file()], 10).valid, false);
});

test('hook usa un solo create actionLock una llamada send y conserva borrador al volver', async () => {
  const hook = await read('../hooks/useCapturasCompraRapida.js');
  assert.equal((hook.match(/createQuickCapture\(\)/g) || []).length, 1);
  assert.match(hook, /if \(actionLock\.current/);
  assert.equal((hook.match(/sendQuickCapture\(/g) || []).length, 1);
  assert.doesNotMatch(hook, /setMode\('list'\)[\s\S]{0,80}discardQuickCapture/);
});

test('pantalla soporta cámara selección múltiple previews estados y responsive sin observación', async () => {
  const [component, css] = await Promise.all([read('../components/CapturasCompraRapidaOperativa.jsx'), read('../solicitudesCompra.css')]);
  assert.match(component, /capture="environment"/);
  assert.match(component, /accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(component, /multiple/);
  assert.match(component, /de \{MAX_INVOICE_EVIDENCES\} imágenes/);
  assert.match(component, /BORRADOR|PENDIENTE/);
  assert.match(component, /FORMALIZADA|RECHAZADA|item\.estado/);
  assert.match(component, /Enviando…/);
  assert.match(component, /Descartar borrador/);
  assert.doesNotMatch(component, /observaci[oó]n/i);
  assert.match(css, /sol-comp-quick-capture/);
});

test('service frontend reutiliza apiFetch y contiene ocho operaciones sin cliente paralelo', async () => {
  const source = await read('../../../../services/solicitudesCompraService.js');
  for (const method of ['createQuickCapture', 'listQuickCaptures', 'getQuickCapture', 'listQuickCaptureEvidence', 'uploadQuickCaptureInvoice', 'deleteQuickCaptureEvidence', 'discardQuickCapture', 'sendQuickCapture']) assert.match(source, new RegExp(method));
  assert.doesNotMatch(source, /axios|createClient|supabase/);
});

test('flujo OC normal permanece montado', async () => {
  const tab = await read('../SolicitudesCompraTab.jsx');
  assert.match(tab, /NuevaSolicitudCompra/);
  assert.match(tab, /SolicitudCompraDetalle/);
  assert.match(tab, /SolicitudesCompraListado/);
});
