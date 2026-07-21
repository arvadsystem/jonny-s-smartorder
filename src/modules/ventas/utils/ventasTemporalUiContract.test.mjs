import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const hookSource = await readFile(new URL('../../../pages/dashboard/ventas/hooks/useVentas.js', import.meta.url), 'utf8');
const viewSource = await readFile(new URL('../../../pages/dashboard/ventas/components/VentaOverviewView.jsx', import.meta.url), 'utf8');
const defaultsSource = await readFile(new URL('../constants/ventasDefaults.js', import.meta.url), 'utf8');

test('primera carga envia hoy-hoy y ambos parametros horarios', () => {
  assert.match(defaultsSource, /\.\.\.createDefaultVentasTemporalFilters\(\)/);
  assert.match(hookSource, /fechaDesde: ventasFilters\.fechaDesde/);
  assert.match(hookSource, /fechaHasta: ventasFilters\.fechaHasta/);
  assert.match(hookSource, /horaDesde: ventasFilters\.horaDesde/);
  assert.match(hookSource, /horaHasta: ventasFilters\.horaHasta/);
});

test('aplicar reinicia pagina una sola vez y limpiar vuelve a valores temporales por defecto', () => {
  assert.match(hookSource, /const setVentasFilterPatch[\s\S]*?next\.page = 1;[\s\S]*?return next;/);
  assert.match(hookSource, /const clearVentasFilters[\s\S]*?const defaults = createDefaultVentasFilters\(\)/);
  assert.match(viewSource, /onFiltersChange\?\.\(filtersDraft\);/);
});

test('cambio de sucursal y paginacion conservan el resto de filtros', () => {
  assert.match(hookSource, /const setVentasPage[\s\S]*?setVentasFilters\(\(prev\) => \(\{\s*\.\.\.prev,/);
  assert.match(hookSource, /const setVentasSucursal[\s\S]*?setVentasFilters\(\(prev\) => \(\{\s*\.\.\.prev,/);
});

test('varios dias limpian y deshabilitan horas, y el frontend valida antes de consultar', () => {
  assert.match(viewSource, /if \(next\.fechaDesde !== next\.fechaHasta\)[\s\S]*?next\.horaDesde = '';[\s\S]*?next\.horaHasta = '';/);
  assert.match(viewSource, /disabled=\{!isSingleDay\}/);
  assert.match(viewSource, /validateVentasTemporalFilters\(filtersDraft/);
});

test('las cards siguen usando exclusivamente el summary recibido del backend', () => {
  assert.match(hookSource, /const backendSummary = response\?\.summary/);
  assert.match(hookSource, /setSummary\(normalizedSummary\)/);
  assert.doesNotMatch(hookSource, /setSummary\([^)]*rows/);
});
