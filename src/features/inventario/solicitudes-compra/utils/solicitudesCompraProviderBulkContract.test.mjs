import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relative) => readFile(new URL(relative, import.meta.url), 'utf8');

test('componente reusable usa AppSelect searchable, acciones seguras, resumen y modal accesible', async () => {
  const source = await read('../components/ProveedorBulkAssignment.jsx');
  assert.match(source, /<AppSelect[\s\S]*searchable/);
  assert.match(source, /Aplicar a todos/);
  assert.match(source, /Solo líneas sin proveedor/);
  assert.match(source, /disabled=\{unavailable\}/);
  assert.match(source, /Distribución por proveedor/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /Reemplazar en todas/);
});

test('revision normal monta control antes de lineas y conserva selector individual', async () => {
  const [panel, line, hook] = await Promise.all([read('../components/SolicitudCompraRevisionPanel.jsx'), read('../components/SolicitudCompraRevisionLinea.jsx'), read('../hooks/useSolicitudCompraRevision.js')]);
  assert.ok(panel.indexOf('<ProveedorBulkAssignment') < panel.indexOf('sol-comp-review-lines'));
  assert.match(panel, /canApprove \? <ProveedorBulkAssignment/);
  assert.match(line, /label="Proveedor"/);
  assert.match(hook, /applyProviderToLines\(current, providerId, 'all'\)/);
  assert.match(hook, /applyProviderToLines\(current, providerId, 'missing'\)/);
  assert.match(hook, /validateApprovalDraft\(lines\)/);
  assert.match(hook, /buildApprovalPayload\(\{ comentario: comment, detalles: lines \}\)/);
});

test('formalizacion monta control solamente en formalize y conserva payload por linea', async () => {
  const [component, hook] = await Promise.all([read('../components/CapturasCompraRapidaAdmin.jsx'), read('../hooks/useCapturasCompraRapidaAdmin.js')]);
  const formalize = component.slice(component.indexOf("flow.mode === 'formalize'"), component.indexOf("flow.mode === 'detail'"));
  const detail = component.slice(component.indexOf("flow.mode === 'detail'"));
  assert.match(formalize, /<ProveedorBulkAssignment/);
  assert.doesNotMatch(detail, /<ProveedorBulkAssignment/);
  assert.match(formalize, /label="Proveedor \*"/);
  assert.match(hook, /applyProviderToLines\(current, providerId, 'all'\)/);
  assert.match(hook, /applyProviderToLines\(current, providerId, 'missing'\)/);
  assert.match(hook, /id_proveedor: Number\(line\.id_proveedor\)/);
  assert.match(hook, /Number\(line\.id_proveedor\) > 0/);
});

test('responsive apila selector acciones y distribucion sin alterar Million', async () => {
  const [css, vite] = await Promise.all([read('../solicitudesCompra.css'), read('../../../../../vite.config.js')]);
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*sol-comp-provider-bulk__controls[\s\S]*grid-template-columns: 1fr/);
  assert.match(css, /sol-comp-provider-bulk__actions \.btn \{ width: 100%/);
  assert.match(vite, /ENABLE_MILLION_BUILD === 'true'/);
});
