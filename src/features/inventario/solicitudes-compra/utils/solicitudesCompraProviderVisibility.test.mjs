import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { canRenderProvider } from './solicitudesCompraProviderVisibility.js';

test('contrato administrativo con proveedor permite renderizarlo', () => {
  assert.equal(canRenderProvider({ proveedor: { nombre_proveedor: 'Proveedor A' } }), true);
});

test('contrato administrativo sin asignacion conserva Proveedor y Sin asignar', () => {
  const line = { proveedor: null };
  assert.equal(canRenderProvider(line), true);
  assert.equal(line.proveedor?.nombre_proveedor || 'Sin asignar', 'Sin asignar');
});

test('contrato operativo omite completamente proveedor', () => {
  assert.equal(canRenderProvider({ nombre: 'Producto' }), false);
});

test('detalle y recepcion respetan propiedad propia sin duplicar roles ni estados', async () => {
  const [detail, reception] = await Promise.all([
    readFile(new URL('../components/SolicitudCompraDetalle.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/SolicitudCompraRecepcionLinea.jsx', import.meta.url), 'utf8')
  ]);
  for (const source of [detail, reception]) {
    assert.match(source, /canRenderProvider\(line\)/);
    assert.match(source, /line\.proveedor\?\.nombre_proveedor \|\| 'Sin asignar'/);
    assert.doesNotMatch(source, /CAJERO|COCINA|ADMINISTRADOR|SUPER_ADMIN|estado\s*===/);
  }
});

test('selector administrativo de revision permanece intacto', async () => {
  const revision = await readFile(new URL('../components/SolicitudCompraRevisionLinea.jsx', import.meta.url), 'utf8');
  assert.match(revision, /label="Proveedor"/);
  assert.match(revision, /value=\{line\.id_proveedor\}/);
  assert.match(revision, /id_proveedor: value/);
});
