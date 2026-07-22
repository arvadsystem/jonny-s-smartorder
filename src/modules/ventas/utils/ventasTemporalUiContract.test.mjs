import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const hookSource = await readFile(new URL('../../../pages/dashboard/ventas/hooks/useVentas.js', import.meta.url), 'utf8');
const viewSource = await readFile(new URL('../../../pages/dashboard/ventas/components/VentaOverviewView.jsx', import.meta.url), 'utf8');
const pageSource = await readFile(new URL('../../../pages/dashboard/ventas/VentasPage.jsx', import.meta.url), 'utf8');
const defaultsSource = await readFile(new URL('../constants/ventasDefaults.js', import.meta.url), 'utf8');

test('primera carga envia hoy-hoy y ambos parametros horarios', () => {
  assert.match(defaultsSource, /\.\.\.createDefaultVentasTemporalFilters\(\)/);
  assert.match(hookSource, /fechaDesde: requestFilters\.fechaDesde/);
  assert.match(hookSource, /fechaHasta: requestFilters\.fechaHasta/);
  assert.match(hookSource, /horaDesde: requestFilters\.horaDesde/);
  assert.match(hookSource, /horaHasta: requestFilters\.horaHasta/);
});

test('aplicar reinicia pagina una sola vez y limpiar vuelve a valores temporales por defecto', () => {
  assert.match(hookSource, /const setVentasFilterPatch[\s\S]*?next\.page = 1;[\s\S]*?return next;/);
  assert.match(hookSource, /const clearVentasFilters[\s\S]*?fechaDesde: ventasCurrentDay,[\s\S]*?fechaHasta: ventasCurrentDay,[\s\S]*?page: 1/);
  assert.match(viewSource, /createVentasTemporalFiltersForDay\(today\)/);
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

test('listado cancela la anterior e ignora respuestas obsoletas antes de actualizar estado o cache', () => {
  assert.match(hookSource, /const request = manager\.start\(\)/);
  assert.match(hookSource, /\{ signal: request\.controller\.signal \}/);
  assert.match(hookSource, /if \(!manager\.isCurrent\(request\)\) return null;[\s\S]*?setVentas\(rows\)/);
  assert.match(hookSource, /if \(isCancelledVentasListRequest\(error, request, manager\)\) return null;/);
  assert.match(hookSource, /if \(manager\.finish\(request\)\) setLoading\(false\)/);
  assert.match(hookSource, /abortVentasListAndResetLoading\(ventasListRequestManagerRef\.current, setLoading\)/);
});

test('vigila medianoche, foco y reanudacion sin polling agresivo', () => {
  assert.match(hookSource, /if \(String\(activeTab \|\| ''\)\.toLowerCase\(\) !== 'ventas'\) return undefined;/);
  assert.match(hookSource, /getMillisecondsUntilNextTegucigalpaDay\(\) \+ 50/);
  assert.match(hookSource, /syncTegucigalpaDay\(\);\s*scheduleNextDayCheck\(\);\s*window\.addEventListener/);
  assert.match(hookSource, /window\.addEventListener\('focus', handleFocus\)/);
  assert.match(hookSource, /document\.addEventListener\('visibilitychange', handleVisibilityChange\)/);
  assert.match(hookSource, /window\.removeEventListener\('focus', handleFocus\)/);
  assert.match(hookSource, /document\.removeEventListener\('visibilitychange', handleVisibilityChange\)/);
  assert.match(hookSource, /if \(timerId\) clearTimeout\(timerId\)/);
  assert.match(hookSource, /resolveVentasDayTransition/);
  assert.equal(hookSource.match(/window\.addEventListener\('focus', handleFocus\)/g)?.length, 1);
  assert.equal(hookSource.match(/document\.addEventListener\('visibilitychange', handleVisibilityChange\)/g)?.length, 1);
});

test('reentrada difiere la carga anterior y Strict Mode descarta el efecto especulativo', () => {
  assert.match(hookSource, /ventasPendingDaySyncRef/);
  assert.match(hookSource, /isVentasDefaultTemporalRange\(ventasFilters, pendingDaySync\.previousToday\)[\s\S]*?return null/);
  assert.match(hookSource, /scheduleVentasActiveTabLoad\(\(\) => \{\s*if \(active\) void loadActiveTab\(\);/);
  assert.match(hookSource, /active = false;\s*cancelScheduledLoad\(\);/);
});

test('panel abierto sincroniza solo el borrador temporal predeterminado', () => {
  assert.match(viewSource, /previousAppliedFiltersRef = useRef\(ventasFilters\)/);
  assert.match(viewSource, /previousAppliedFiltersRef\.current = ventasFilters;\s*if \(!filtersOpen\) return;/);
  assert.match(viewSource, /resolveVentasDraftForAppliedDayChange\(current, \{[\s\S]*?previousAppliedFilters,[\s\S]*?nextAppliedFilters: ventasFilters/);
  assert.match(viewSource, /const openFiltersDrawer = \(\) => \{[\s\S]*?fechaDesde: ventasFilters\?\.fechaDesde/);
});

test('cambio de dia actualiza estado visual, aborta e invalida antes de tocar filtros', () => {
  assert.match(hookSource, /const \[ventasCurrentDay, setVentasCurrentDay\] = useState\(\(\) => getTegucigalpaToday\(\)\)/);
  assert.match(hookSource, /const \[ventasFilters, setVentasFilters\] = useState\(\(\) => \(\{[\s\S]*?fechaDesde: ventasCurrentDay,[\s\S]*?fechaHasta: ventasCurrentDay/);
  assert.match(hookSource, /setVentasCurrentDay\(nextToday\);\s*abortVentasListRequest\(\);\s*invalidateVentasTotalsCache\(\);[\s\S]*?setVentasFilters/);
  assert.match(hookSource, /ventasTotalsCacheRef\.current = \{ key: '', summary: null, pagination: null \};\s*ventasLastFiltersRef\.current = null;/);
  assert.match(hookSource, /return \{[\s\S]*?ventasFilters,\s*ventasCurrentDay,/);
  assert.match(pageSource, /ventasCurrentDay=\{ventasCurrentDay\}/);
  assert.match(viewSource, /const today = ventasCurrentDay;/);
  assert.match(viewSource, /const cashierMinDate = scopeInfo\?\.limitedToLast72Hours \? getVentasCashierMinDate\(\) : undefined;/);
  assert.match(viewSource, /max=\{today\}/);
  assert.match(viewSource, /useMemo\(\(\) => countActiveFilters\(ventasFilters, today\), \[today, ventasFilters\]\)/);
});

test('cleanup cancela carga programada y normaliza loading mediante helper seguro', () => {
  assert.match(hookSource, /active = false;\s*cancelScheduledLoad\(\);\s*abortVentasListRequest\(\);/);
});
