import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compareRecipeNamesNaturally } from '../src/pages/dashboard/ventas/utils/ventasRecipeSort.js';

const useVentasSource = readFileSync(new URL('../src/pages/dashboard/ventas/hooks/useVentas.js', import.meta.url), 'utf8');
const serviceSource = readFileSync(new URL('../src/services/ventasService.js', import.meta.url), 'utf8');
const cajaSource = readFileSync(new URL('../src/pages/dashboard/ventas/components/CajaView.jsx', import.meta.url), 'utf8');

assert.match(serviceSource, /getCajaBootstrap[\s\S]*\/ventas\/caja\/bootstrap/, 'debe existir el servicio bootstrap');
assert.match(useVentasSource, /activeTab[\s\S]*=== 'caja'[\s\S]*loadCajaBootstrap/, 'Caja debe cargar bootstrap sin esperar historial');
assert.match(useVentasSource, /if \(String\(activeTab[^]*=== 'caja'\)[^]*return;/, 'la rama de Caja debe terminar antes de loadVentas');
assert.match(useVentasSource, /new AbortController\(\)/, 'cambio de sucursal debe poder cancelar solicitudes');
assert.match(useVentasSource, /cajaCatalogLoadedRef/, 'los catalogos deben deduplicarse por sucursal');
assert.match(useVentasSource, /setBootstrapLoading/, 'bootstrap debe tener loader independiente');
assert.match(useVentasSource, /setProductsLoading/, 'productos debe tener loader independiente');
assert.match(useVentasSource, /setCombosLoading/, 'combos debe tener loader independiente');
assert.match(useVentasSource, /setClientsLoading/, 'clientes debe tener loader independiente');
assert.match(useVentasSource, /setDiscountsLoading/, 'descuentos debe tener loader independiente');
assert.match(cajaSource, /onCatalogDemand\?\.\(composer\.activeCatalog/, 'el catalogo activo debe cargarse bajo demanda');

const initialCajaBranch = useVentasSource.slice(
  useVentasSource.indexOf("if (String(activeTab || '').toLowerCase() === 'caja')"),
  useVentasSource.indexOf('const ventasResult = await loadVentas()', useVentasSource.indexOf("if (String(activeTab || '').toLowerCase() === 'caja')"))
);
assert.doesNotMatch(initialCajaBranch, /getClientesCatalog|getProductosCatalog|getCombosCatalog|getDescuentosCatalog|loadVentas\(/);

const names = ['ALITA UNIDAD', '30 ALITAS', '8 ALITAS', '12 ALITAS', '6 ALITAS', '24 ALITAS', '18 ALITAS'];
assert.deepEqual([...names].sort(compareRecipeNamesNaturally), [
  '6 ALITAS',
  '8 ALITAS',
  '12 ALITAS',
  '18 ALITAS',
  '24 ALITAS',
  '30 ALITAS',
  'ALITA UNIDAD'
]);

console.log('OK frontend ventas caja bootstrap QA');
