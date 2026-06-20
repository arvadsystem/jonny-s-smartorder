import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compareRecipeNamesNaturally } from '../src/pages/dashboard/ventas/utils/ventasRecipeSort.js';
import { validateComandaForPrint } from '../src/pages/dashboard/ventas/utils/buildComandaCocinaHtml.js';

const useVentasSource = readFileSync(new URL('../src/pages/dashboard/ventas/hooks/useVentas.js', import.meta.url), 'utf8');
const serviceSource = readFileSync(new URL('../src/services/ventasService.js', import.meta.url), 'utf8');
const cajaSource = readFileSync(new URL('../src/pages/dashboard/ventas/components/CajaView.jsx', import.meta.url), 'utf8');
const composerSource = readFileSync(new URL('../src/pages/dashboard/ventas/hooks/useVentaComposer.js', import.meta.url), 'utf8');
const catalogSource = readFileSync(new URL('../src/pages/dashboard/ventas/components/VentaComposerCatalog.jsx', import.meta.url), 'utf8');
const optionsSource = readFileSync(new URL('../src/modules/ventas/constants/ventasOptions.js', import.meta.url), 'utf8');
const composerSummarySource = readFileSync(new URL('../src/pages/dashboard/ventas/components/VentaComposerSummary.jsx', import.meta.url), 'utf8');
const payloadBuildersSource = readFileSync(new URL('../src/modules/ventas/utils/ventasPayloadBuilders.js', import.meta.url), 'utf8');

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
assert.match(useVentasSource, /catalogStatuses[\s\S]*recetas[\s\S]*productos[\s\S]*clientes/, 'los catalogos deben tener estados independientes');
assert.match(useVentasSource, /controller\.signal\.aborted[\s\S]*'idle'/, 'una cancelacion debe volver a idle');
assert.match(cajaSource, /hasCajaSession/, 'no deben solicitarse catalogos sin sesion activa');
assert.match(cajaSource, /cajaBootstrapData\?\.sesion_caja/, 'CajaView debe hidratar la sesion desde bootstrap');
assert.match(composerSource, /const DEFAULT_CATALOG_KEY = 'RECETAS'/, 'el catalogo inicial debe ser Recetas');
assert.match(composerSource, /const DEFAULT_DEPARTMENT_NAME = 'ALITAS'/, 'el departamento inicial debe ser Alitas');
assert.match(composerSource, /const DEFAULT_DEPARTMENT_ID = '5'/, 'el departamento inicial debe declarar directamente Alitas');
assert.match(composerSource, /activeCatalog:\s*DEFAULT_CATALOG_KEY[\s\S]*activeCategory:\s*DEFAULT_DEPARTMENT_ID/, 'Recetas y Alitas deben existir desde el estado inicial');
assert.doesNotMatch(composerSource, /current\.activeCategory !== 'all'[\s\S]{0,250}activeCategory:\s*defaultDepartmentId/, 'Alitas no debe activarse mediante un efecto posterior');
assert.doesNotMatch(
  composerSource,
  /selectedSucursal:\s*String\(normalizedSucursales\[0\]\.id_sucursal\)/,
  'superadmin con varias sucursales no debe seleccionar arbitrariamente la primera'
);
assert.match(composerSource, /normalizedSucursales\.length === 1/, 'una unica sucursal debe seleccionarse automaticamente');
assert.match(catalogSource, /catalogStatus === 'idle'[\s\S]*Catalogo pendiente/, 'idle no debe mostrarse como catalogo vacio');
assert.match(catalogSource, /catalogStatuses\[key\] === 'error'/, 'la alerta auxiliar debe depender solo de errores reales');
assert.match(catalogSource, /Reintentar/, 'un error de catalogo debe permitir reintento');
assert.match(catalogSource, /No hay productos\./, 'productos exitosos sin filas deben mostrar un estado vacio especifico');
assert.match(useVentasSource, /recipeCatalogCacheRef[\s\S]*`\$\{idSucursal\}:\$\{idTipoDepartamento \|\| 'ALL'\}`/, 'recetas deben usar cache por sucursal y departamento');
assert.match(useVentasSource, /getRecetasCatalog\([\s\S]*id_tipo_departamento/, 'otro departamento debe solicitarse al backend');
assert.match(useVentasSource, /cajaCatalogDataCacheRef/, 'productos y combos deben conservar cache independiente por sucursal');
assert.match(useVentasSource, /force = false[\s\S]*!force && cachedData/, 'los catalogos con error deben soportar reintento forzado');
assert.match(cajaSource, /activeCatalog[\s\S]*selectedSucursalId[\s\S]*catalogStatuses/, 'la demanda debe reintentarse cuando se resuelve la sucursal');
assert.match(useVentasSource, /sesiones_disponibles[\s\S]*setSucursales/, 'las sucursales seleccionables deben provenir de sesiones activas');
assert.match(useVentasSource, /sucursales_disponibles[\s\S]*setSucursales/, 'el selector de Caja debe poder usar sucursales disponibles del bootstrap');
assert.match(composerSource, /shouldLoadExtras[\s\S]*activeCatalog === 'EXTRAS'/, 'Extras debe cargarse solo bajo demanda');
assert.match(optionsSource, /key: 'EXTRAS'/, 'la pestaña Extras debe permanecer visible');
assert.match(composerSource, /getExtrasPermitidos/, 'el catalogo de Extras debe cargarse por sucursal');
assert.match(composerSource, /getCurrentQuantityInCartByKind\('ITEM'/, 'Extras debe soportar incremento de cantidad');
assert.match(composerSummarySource, /isStandaloneExtraLine/, 'el carrito debe distinguir extras independientes');

assert.match(payloadBuildersSource, /id_extra:\s*line\.kind === 'ITEM' \? line\.id_extra : null/, 'ITEM debe enviar id_extra');
assert.match(payloadBuildersSource, /if \(line\.kind === 'ITEM'\)[\s\S]{0,100}payload\.cantidad/, 'ITEM debe enviar su cantidad');
assert.match(payloadBuildersSource, /const extras = line\.kind === 'ITEM' \? \[\]/, 'ITEM no debe duplicarse como extra interno');

const standaloneExtraPrint = validateComandaForPrint({
  items: [{
    id_detalle: 1,
    nombre_item: 'Papas extra',
    cantidad: 2,
    es_linea_extra_independiente: true,
    extras: [{ id_extra: 31, nombre: 'Papas extra', cantidad: 2 }]
  }]
});
assert.equal(standaloneExtraPrint.ok, true);
assert.equal(standaloneExtraPrint.items[0].extras.length, 0, 'comanda no debe duplicar ITEM como extra interno');

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
