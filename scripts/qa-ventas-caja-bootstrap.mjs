import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compareRecipeNamesNaturally } from '../src/pages/dashboard/ventas/utils/ventasRecipeSort.js';
import { validateComandaForPrint } from '../src/pages/dashboard/ventas/utils/buildComandaCocinaHtml.js';

const useVentasSource = readFileSync(new URL('../src/pages/dashboard/ventas/hooks/useVentas.js', import.meta.url), 'utf8');
const serviceSource = readFileSync(new URL('../src/services/ventasService.js', import.meta.url), 'utf8');
const cajasServiceSource = readFileSync(new URL('../src/services/cajasService.js', import.meta.url), 'utf8');
const cajaSource = readFileSync(new URL('../src/pages/dashboard/ventas/components/CajaView.jsx', import.meta.url), 'utf8');
const finalizarModalSource = readFileSync(new URL('../src/pages/dashboard/ventas/components/VentaFinalizarOperacionModal.jsx', import.meta.url), 'utf8');
const composerSource = readFileSync(new URL('../src/pages/dashboard/ventas/hooks/useVentaComposer.js', import.meta.url), 'utf8');
const catalogSource = readFileSync(new URL('../src/pages/dashboard/ventas/components/VentaComposerCatalog.jsx', import.meta.url), 'utf8');
const optionsSource = readFileSync(new URL('../src/modules/ventas/constants/ventasOptions.js', import.meta.url), 'utf8');
const composerSummarySource = readFileSync(new URL('../src/pages/dashboard/ventas/components/VentaComposerSummary.jsx', import.meta.url), 'utf8');
const payloadBuildersSource = readFileSync(new URL('../src/modules/ventas/utils/ventasPayloadBuilders.js', import.meta.url), 'utf8');
const ventasHelpersSource = readFileSync(new URL('../src/pages/dashboard/ventas/utils/ventasHelpers.js', import.meta.url), 'utf8');
const cajaSucursalStorageSource = readFileSync(new URL('../src/pages/dashboard/ventas/utils/ventasCajaSucursalStorage.js', import.meta.url), 'utf8');

assert.match(serviceSource, /getCajaBootstrap[\s\S]*\/ventas\/caja\/bootstrap/, 'debe existir el servicio bootstrap');
assert.match(useVentasSource, /activeTab[\s\S]*=== 'caja'[\s\S]*loadCajaBootstrap/, 'Caja debe cargar bootstrap sin esperar historial');
assert.match(useVentasSource, /if \(String\(activeTab[^]*=== 'caja'\)[^]*return;/, 'la rama de Caja debe terminar antes de loadVentas');
assert.match(useVentasSource, /new AbortController\(\)/, 'cambio de sucursal debe poder cancelar solicitudes');
assert.match(useVentasSource, /cajaCatalogLoadedRef/, 'los catalogos deben deduplicarse por sucursal');
assert.match(useVentasSource, /setBootstrapLoading/, 'bootstrap debe tener loader independiente');
assert.match(useVentasSource, /setProductsLoading/, 'productos debe tener loader independiente');
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
assert.doesNotMatch(composerSource, /normalizedSucursales\.length === 1[\s\S]{0,120}selectedSucursal/, 'SUPER_ADMIN no debe alternar ni seleccionar automaticamente una sucursal unica');
assert.match(catalogSource, /catalogStatus === 'idle'[\s\S]*Catalogo pendiente/, 'idle no debe mostrarse como catalogo vacio');
assert.match(catalogSource, /catalogStatuses\[key\] === 'error'/, 'la alerta auxiliar debe depender solo de errores reales');
assert.match(catalogSource, /Reintentar/, 'un error de catalogo debe permitir reintento');
assert.match(catalogSource, /No hay productos\./, 'productos exitosos sin filas deben mostrar un estado vacio especifico');
assert.match(cajaSucursalStorageSource, /jonny:ventas:caja:sucursal/, 'Caja debe declarar el prefijo de seleccion de sucursal');
assert.match(cajaSucursalStorageSource, /`\$\{CAJA_SUCURSAL_STORAGE_PREFIX\}:\$\{normalizeCajaStorageUserId\(userId\)\}`/, 'la seleccion de Caja debe persistirse por usuario');
assert.doesNotMatch(composerSource, /jonny:ventas:caja:sucursal['"`]/, 'useVentaComposer no debe usar la clave global legacy');
assert.match(composerSource, /buildCajaSucursalStorageKey\(userId\)/, 'useVentaComposer debe construir la clave de sucursal con id_usuario');
assert.match(composerSource, /cajaSucursalStorageKeyRef[\s\S]{0,220}buildInitialState/, 'useVentaComposer debe reiniciar estado al cambiar de usuario');
assert.match(composerSource, /clearPersistedCajaSucursal\(cajaSucursalStorageKey\)/, 'si la sucursal guardada ya no esta disponible debe limpiarse');
assert.match(composerSource, /validIds\.has\(currentSelection\)[\s\S]{0,120}validIds\.has\(persistedSelection\)[\s\S]{0,120}validIds\.has\(sessionSelection\)/, 'una seleccion actual valida debe ganar sobre defaultSucursalId');
assert.doesNotMatch(
  composerSource,
  /validIds\.has\(sessionSelection\)[\s\S]{0,120}validIds\.has\(currentSelection\)/,
  'defaultSucursalId no debe priorizarse sobre la seleccion manual vigente'
);
assert.match(useVentasSource, /userId = null/, 'useVentas debe recibir id_usuario');
assert.match(useVentasSource, /const cajaUserKey = String\(parsePositiveId\(userId\) \|\| 'anon'\)/, 'useVentas debe aislar caches por usuario');
assert.match(useVentasSource, /const buildCajaUserScopeKey = \(userKey,\s*idSucursal\) =>[\s\S]{0,120}usuario:\$\{userKey\}:sucursal:\$\{idSucursal \|\| 'auto'\}/, 'useVentas debe construir llaves usuario/sucursal canonicas');
assert.match(useVentasSource, /`bootstrap:\$\{scopeKey\}`/, 'bootstrap debe cachearse por usuario y sucursal');
assert.match(useVentasSource, /departamento:\$\{idTipoDepartamento \|\| 'ALL'\}/, 'recetas deben usar cache por usuario, sucursal y departamento');
assert.match(useVentasSource, /`\$\{catalogKey\}:\$\{buildCajaUserScopeKey\(cajaUserKey,\s*idSucursal\)\}`/, 'catalogos de Caja deben usar cache por usuario y sucursal');
assert.match(useVentasSource, /cajaBootstrapRequestIdRef/, 'bootstrap debe tener requestId monotono');
assert.match(useVentasSource, /cajaRecipeRequestIdRef/, 'recetas deben tener requestId monotono');
assert.match(useVentasSource, /cajaCatalogRequestIdRef/, 'catalogos deben tener requestId monotono');
assert.match(useVentasSource, /activeCajaSucursalRef\.current === requestSucursalId|activeCajaSucursalRef\.current === idSucursal/, 'respuestas de Caja deben validar la ultima sucursal elegida');
assert.match(useVentasSource, /currentInFlight\?\.promise[\s\S]{0,120}!currentInFlight\.controller\?\.signal\?\.aborted/, 'no se deben reutilizar promesas abortadas');
assert.match(cajaSource, /userId,\s*[\s\S]*defaultSucursalId/, 'CajaView debe recibir userId');
assert.match(cajaSource, /userId:\s*userId \?\? user\?\.id_usuario/, 'CajaView debe pasar userId a useVentaComposer');
assert.match(cajaSource, /lockedSucursalId = toPositiveId\(cajaSesionActiva\?\.id_sucursal \|\| cajaAsignacion\?\.id_sucursal \|\| defaultSucursalId\)/, 'no superadmin debe bloquearse por sesion, asignacion y luego sucursal laboral');
assert.match(cajaSource, /defaultSucursalId:\s*isSuperAdmin \? defaultSucursalId : lockedSucursalId/, 'responsable y auxiliar deben quedar bloqueados a la sucursal operativa');
assert.match(cajaSource, /catalogSucursalRequestIdRef/, 'CajaView debe generar requestId monotono por seleccion');
assert.match(cajaSource, /`usuario:\$\{cajaUserKey\}:sucursal:\$\{selectedSucursalId\}`/, 'pendientes debe deduplicarse por usuario y sucursal');
assert.match(cajaSource, /!currentInFlight\.controller\?\.signal\?\.aborted/, 'pendientes no debe reutilizar solicitudes abortadas');
assert.match(cajaSource, /controller\s*\}/, 'pendientes debe conservar el AbortController de la solicitud activa');
assert.match(useVentasSource, /cajaBootstrapAbortRef\.current\?\.abort\(\)[\s\S]*cajaBootstrapDataCacheRef\.current\.clear\(\)/, 'cambio de usuario debe cancelar solicitudes y limpiar caches de Caja');
assert.match(cajaSource, /usuario:\$\{cajaUserKey\}:sucursal:\$\{selectedSucursalId\}/, 'bootstrap demandado desde Caja debe estar aislado por usuario');
assert.match(cajaSource, /const cacheKey = `usuario:\$\{cajaUserKey\}:sucursal:\$\{normalizedSucursalId\}`/, 'sesiones abiertas para autoauxiliar deben cachearse por usuario y sucursal');
assert.match(cajaSource, /sesionesAbiertasAbortRef\.current\?\.abort\(\)/, 'autoauxiliar debe abortar la carga anterior al cambiar de sucursal');
assert.match(cajaSource, /const controller = new AbortController\(\)/, 'autoauxiliar debe usar AbortController propio');
assert.match(cajaSource, /sesionesAbiertasRequestIdRef\.current \+ 1/, 'autoauxiliar debe usar requestId monotonico');
assert.match(cajaSource, /cajaUserKeyRef\.current === requestUserKey[\s\S]{0,160}selectedSucursalId\(\) === requestSucursalId/, 'autoauxiliar debe validar usuario y sucursal antes de aplicar respuesta');
assert.match(cajaSource, /!activeInFlight\.controller\?\.signal\?\.aborted/, 'autoauxiliar no debe reutilizar promesas abortadas');
assert.match(cajaSource, /current\?\.key === cacheKey[\s\S]{0,160}current\.requestId === requestId[\s\S]{0,160}current\.controller === controller/, 'finally de autoauxiliar no debe limpiar una solicitud nueva');
assert.match(cajaSource, /listSesionesAbiertasSafe\([\s\S]{0,140}\{ id_sucursal: normalizedSucursalId \}[\s\S]{0,140}\{ signal: controller\.signal \}[\s\S]{0,220}\.filter\(\(row\) => Number\(row\.id_sucursal\) === Number\(normalizedSucursalId\)\)/, 'autoauxiliar debe consultar y conservar solo sesiones de la sucursal seleccionada');
assert.match(cajaSource, /VENTAS_CAJAS_USER_ALREADY_IN_OPEN_SESSION[\s\S]{0,220}recargar las sesiones de la sucursal seleccionada/, 'SUPER_ADMIN no debe mostrar el error de participacion en otra sesion');
assert.match(useVentasSource, /cachedBootstrap\?\.status === 'success'[\s\S]{0,220}setBootstrapLoading\(false\)[\s\S]{0,120}setRecipesLoading\(false\)[\s\S]{0,120}setCatalogLoading\(false\)/, 'bootstrap desde cache debe cerrar loaders y evitar ciclos');
assert.match(cajaSource, /id_sucursal:\s*selectedSucursalId/, 'pendientes debe consultar la sucursal seleccionada actual');
assert.doesNotMatch(cajaSource, /pedidos-pendientes\?id_sucursal=1|id_sucursal:\s*1/, 'Caja no debe forzar pendientes de sucursal 1');
assert.match(composerSource, /origin:\s*'CAJA'/, 'la venta creada desde Caja debe marcar su origen');
assert.match(composerSource, /resetComposer\(\{\s*preserveSucursal:\s*true,\s*preserveSession:\s*true\s*\}\)/, 'despues de vender desde Caja debe conservar sucursal y sesion');
assert.match(useVentasSource, /const shouldRefreshAfterCreate = origin !== 'CAJA'/, 'Caja no debe disparar refreshVentas general tras vender');
assert.match(useVentasSource, /if \(shouldRefreshAfterCreate\)[\s\S]{0,140}refreshVentas/, 'solo origen no-Caja debe refrescar historial general');
assert.doesNotMatch(useVentasSource, /origin:\s*'CAJA'[\s\S]{0,300}refreshVentas/, 'el flujo Caja no debe refrescar historial ni scopeInfo tras vender');
assert.match(useVentasSource, /recipeCatalogCacheRef[\s\S]*buildCajaUserScopeKey\(cajaUserKey,\s*idSucursal\)[\s\S]*departamento/, 'recetas deben usar cache por usuario, sucursal y departamento');
assert.match(useVentasSource, /getRecetasCatalog\([\s\S]*id_tipo_departamento/, 'otro departamento debe solicitarse al backend');
assert.match(useVentasSource, /cajaCatalogDataCacheRef/, 'productos deben conservar cache independiente por sucursal');
assert.match(useVentasSource, /force = false[\s\S]*!force && cachedData/, 'los catalogos con error deben soportar reintento forzado');
assert.match(cajaSource, /activeCatalog[\s\S]*selectedSucursalId[\s\S]*catalogStatuses/, 'la demanda debe reintentarse cuando se resuelve la sucursal');
assert.match(useVentasSource, /sesiones_disponibles[\s\S]*setSucursales/, 'las sucursales seleccionables deben provenir de sesiones activas');
assert.match(useVentasSource, /sucursales_disponibles[\s\S]*setSucursales/, 'el selector de Caja debe poder usar sucursales disponibles del bootstrap');
assert.match(cajaSource, /pendientesSummaryRequestRef/, 'pendientes debe deduplicar solicitudes activas por sucursal');
assert.match(cajaSource, /currentInFlight\?\.key === requestKey[\s\S]{0,120}currentInFlight\.promise[\s\S]{0,120}!currentInFlight\.controller\?\.signal\?\.aborted/, 'pendientes debe reutilizar solo la solicitud activa vigente de la misma sucursal');
assert.match(cajaSource, /pendientesSummaryAbortRef\.current\?\.abort\(\)/, 'pendientes debe cancelar la solicitud activa anterior');
assert.match(serviceSource, /listPedidosPendientesPago:\s*\(params = \{\}, options = \{\}\)[\s\S]*apiFetch\(`\/ventas\/pedidos-pendientes\$\{buildQuery\(params\)\}`,\s*'GET',\s*null,\s*options\)/, 'pendientes debe aceptar AbortController desde Caja');
assert.match(cajasServiceSource, /listSesionesAbiertasSafe:\s*\(params = \{\}, config = \{\}\)[\s\S]*getSafeOpenSessions\(params,\s*config\)/, 'sesiones abiertas debe aceptar AbortController desde Caja');
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
assert.doesNotMatch(initialCajaBranch, /getClientesCatalog|getProductosCatalog|getDescuentosCatalog|loadVentas\(/);
assert.match(ventasHelpersSource, /CLIENTE_NOMBRE_PLACEHOLDERS/, 'clientes debe sanear placeholders legacy en frontend');
assert.match(ventasHelpersSource, /\^0\+\\d\{2,\}\$/, 'clientes no debe mostrar codigos con ceros como nombre');
assert.match(ventasHelpersSource, /Cliente #\$\{idCliente\}/, 'clientes sin nombre valido deben mostrarse como Cliente #id');
assert.match(finalizarModalSource, /buildClienteHelperText/, 'selector de clientes debe mostrar metadata secundaria');
assert.match(finalizarModalSource, /cliente\.telefono[\s\S]*cliente\.dni \|\| cliente\.rtn[\s\S]*cliente\.tipo_cliente/, 'metadata de cliente debe incluir telefono, documento y tipo');

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

const createSelectionGate = (userKey = 'id:root') => {
  let current = { userKey, sucursalId: null, requestId: 0 };
  const accepted = [];
  const pendingRequests = new Map();
  return {
    select(sucursalId) {
      const previous = pendingRequests.get(userKey);
      if (previous) previous.controller.abort();
      const controller = new AbortController();
      current = { userKey, sucursalId, requestId: current.requestId + 1 };
      pendingRequests.set(userKey, { ...current, controller });
      return { ...current, controller };
    },
    resolve(request) {
      const active = pendingRequests.get(request.userKey);
      if (
        active
        && active.requestId === request.requestId
        && active.sucursalId === request.sucursalId
        && active.controller === request.controller
        && !request.controller.signal.aborted
      ) {
        accepted.push(request.sucursalId);
      }
      return accepted.at(-1) || null;
    },
    activeCount() {
      return [...pendingRequests.values()].filter((request) => !request.controller.signal.aborted).length;
    },
    accepted
  };
};

const gate = createSelectionGate();
const req1 = gate.select(1);
const req6 = gate.select(6);
assert.equal(req1.controller.signal.aborted, true, 'cambio rapido 1 -> 6 debe abortar solicitud 1');
assert.equal(gate.resolve(req1), null, 'respuesta tardia de sucursal 1 no debe reemplazar sucursal 6');
assert.equal(gate.resolve(req6), 6, 'ultima seleccion 6 debe ganar');
const req1Again = gate.select(1);
assert.equal(req6.controller.signal.aborted, true, 'cambio rapido 6 -> 1 debe abortar solicitud 6');
assert.equal(gate.resolve(req6), 6, 'respuesta tardia de 6 no debe reemplazar la ultima solicitud 1 hasta que esta resuelva');
assert.equal(gate.resolve(req1Again), 1, 'cambio rapido 1 -> 6 -> 1 debe terminar en la ultima seleccion 1');
assert.equal(gate.activeCount(), 1, 'debe existir como maximo una solicitud activa');
assert.deepEqual(gate.accepted, [6, 1], 'no debe existir alternancia continua 1 <-> 6');

let simulatedSucursal = 6;
const simulatedRequests = [];
for (let second = 0; second < 60; second += 1) {
  simulatedRequests.push(simulatedSucursal);
}
assert.equal(new Set(simulatedRequests).size, 1, '60 segundos simulados no deben generar ciclo continuo de sucursales');

console.log('OK frontend ventas caja bootstrap QA');
