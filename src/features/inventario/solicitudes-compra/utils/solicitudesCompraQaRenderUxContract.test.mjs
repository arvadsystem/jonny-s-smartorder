import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { uploadInvoiceFilesSequentially } from './solicitudesCompraRecepcionUtils.js';

const read = (relative) => readFile(new URL(relative, import.meta.url), 'utf8');

test('build conserva React y scrub, mientras Million es opt-in explicito', async () => {
  const source = await read('../../../../../vite.config.js');
  assert.match(source, /process\.env\.ENABLE_MILLION_BUILD === 'true'/);
  assert.match(source, /million\.vite\(\{ auto: true \}\)/);
  assert.match(source, /react\(\)/);
  assert.match(source, /command === 'build' \? \[scrubBundledLocalhostFallbacks\(\)\] : \[\]/);
  assert.doesNotMatch(source, /command === 'build'\s*\?\s*\[million\.vite/);
});

test('captura clona FileList antes de limpiar el input y no fuerza renders o recargas', async () => {
  const [component, hook] = await Promise.all([
    read('../components/CapturasCompraRapidaOperativa.jsx'),
    read('../hooks/useCapturasCompraRapida.js'),
  ]);
  const clone = component.indexOf('Array.from(event.currentTarget.files || [])');
  const clear = component.indexOf("event.currentTarget.value = ''");
  assert.ok(clone >= 0 && clear > clone);
  assert.doesNotMatch(`${component}\n${hook}`, /window\.location\.reload|forceUpdate|flushSync/);
});

test('previews locales tienen ciclo de vida, estados y progreso antes de la carga remota', async () => {
  const [component, hook, helper] = await Promise.all([
    read('../components/CapturasCompraRapidaOperativa.jsx'),
    read('../hooks/useCapturasCompraRapida.js'),
    read('./solicitudesCompraRecepcionUtils.js'),
  ]);
  assert.match(hook, /URL\.createObjectURL/);
  assert.match(hook, /URL\.revokeObjectURL/);
  assert.ok(hook.indexOf('createTemporaryPreviews(files)') < hook.indexOf('await prevalidateInvoiceFiles(files)'));
  for (const state of ['PENDIENTE', 'SUBIENDO', 'GUARDADA', 'ERROR']) assert.match(`${component}\n${hook}`, new RegExp(state));
  assert.match(component, /uploadProgress\.completed/);
  assert.match(helper, /onProgress\?\.\(\{ phase: 'uploading'/);
});

test('progreso secuencial recorre 0/N hasta N/N y conserva el fallo parcial', async () => {
  const files = [{ name: 'uno.jpg' }, { name: 'dos.jpg' }];
  const events = [];
  const result = await uploadInvoiceFilesSequentially(files, async (file) => {
    if (file.name === 'dos.jpg') throw new Error('fallo simulado');
  }, (event) => events.push(event));
  assert.deepEqual(events.map(({ phase, completed, total }) => [phase, completed, total]), [
    ['uploading', 0, 2], ['saved', 1, 2], ['uploading', 1, 2], ['error', 2, 2],
  ]);
  assert.equal(result.uploaded, 1);
  assert.equal(result.failures.length, 1);
});

test('descarte usa modal interno accesible y bloquea acciones durante la carga', async () => {
  const component = await read('../components/CapturasCompraRapidaOperativa.jsx');
  assert.doesNotMatch(component, /window\.confirm|confirm\(/);
  assert.match(component, /role="dialog"/);
  assert.match(component, /aria-modal="true"/);
  assert.match(component, /flow\.busy === 'upload'/);
  assert.match(component, /disabled=\{flow\.busy/);
});

test('bandeja administrativa busca con debounce y permite envio inmediato', async () => {
  const [component, hook] = await Promise.all([
    read('../components/CapturasCompraRapidaAdmin.jsx'),
    read('../hooks/useCapturasCompraRapidaAdmin.js'),
  ]);
  assert.match(hook, /searchDebounce\.current = setTimeout\([\s\S]{0,180}loadList\([\s\S]{0,180}, 300\)/);
  assert.match(hook, /const submitSearch/);
  assert.match(component, /flow\.submitSearch\(event\.currentTarget\.elements\.namedItem\('quick-capture-search'\)/);
  assert.match(component, /event\.key === 'Escape'/);
});

test('jerarquia operativa y responsive permanecen visibles sin hacks', async () => {
  const [list, operative, admin, css] = await Promise.all([
    read('../components/SolicitudesCompraListado.jsx'),
    read('../components/CapturasCompraRapidaOperativa.jsx'),
    read('../components/CapturasCompraRapidaAdmin.jsx'),
    read('../solicitudesCompra.css'),
  ]);
  for (const label of ['Nueva solicitud', 'Compra rápida', 'Capturas rápidas']) assert.match(list, new RegExp(label));
  for (const label of ['Factura', 'Enviar', 'Administración']) assert.match(operative, new RegExp(label));
  assert.match(admin, /Revisar captura/);
  assert.match(css, /@media \(max-width: 767px\)/);
  assert.match(css, /sol-comp-quick-steps/);
  assert.match(css, /sol-comp-action-with-help/);
});
