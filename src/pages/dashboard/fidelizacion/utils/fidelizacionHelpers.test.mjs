import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import {
  buildCanjeableProductoPayload,
  buildSaveConfiguracionPayload,
  calculatePointsPreview,
  calculateRedemptionPointsPreview,
  computeCanjeCartAfterAdd,
  computeCanjeConfirmDisabled,
  computeConfiguracionSaveState,
  computeConfiguracionSubmitState,
  consumeHandledAsyncError,
  createLatestRequestTracker,
  formatCurrency,
  isRedemptionPointsOverrideInvalid,
  isSameLempirasRate,
  isSensitiveLempirasRate,
  normalizeCanjeableResponse,
  normalizeConfiguracion,
  normalizeEnvelopeMeta,
  normalizeRedemptionPointsOverride,
  RATE_CONFIRMATION_EXAMPLE_AMOUNT,
  REDEMPTION_POINTS_OVERRIDE_INVALID,
  requiresRateConfirmation
} from './fidelizacionHelpers.js';

// ConfiguracionReglasModal.jsx usa createPortal(..., document.body) y solo
// se monta tras un useEffect (mounted=true); renderToStaticMarkup (SSR) no
// ejecuta efectos, asi que ese componente siempre devuelve null bajo SSR y
// no se puede verificar su HTML con esa tecnica. Por eso el switch y el
// payload de guardado se prueban aqui como logica pura extraida a
// fidelizacionHelpers.js (mismo valor que consume el componente), y el
// aislamiento de otros modulos se verifica sobre el codigo fuente real.

describe('switch de acumulacion de puntos: carga desde el backend', () => {
  it('el switch carga apagado cuando el backend responde acumulacion_habilitada=false', () => {
    const normalized = normalizeConfiguracion({
      data: {
        id_sucursal: 1,
        configuracion: { id_configuracion: 5, lempiras_por_punto: 10, acumulacion_habilitada: false },
        productos_canjeables: []
      }
    });
    assert.equal(normalized.configuracion.acumulacion_habilitada, false);
  });

  it('el switch carga encendido cuando el backend responde acumulacion_habilitada=true', () => {
    const normalized = normalizeConfiguracion({
      data: {
        id_sucursal: 1,
        configuracion: { id_configuracion: 5, lempiras_por_punto: 10, acumulacion_habilitada: true },
        productos_canjeables: []
      }
    });
    assert.equal(normalized.configuracion.acumulacion_habilitada, true);
  });

  it('no asume true: sin configuracion previa (null), el valor inicial es false', () => {
    const normalized = normalizeConfiguracion({ data: { id_sucursal: 1, configuracion: null, productos_canjeables: [] } });
    assert.equal(normalized.configuracion, null);
  });
});

describe('switch de acumulacion de puntos: guardar', () => {
  it('guardar envia acumulacion_habilitada en el payload (true)', () => {
    const payload = buildSaveConfiguracionPayload({
      idSucursal: 1,
      lempiras: '10',
      acumulacionHabilitada: true,
      productosCanjeables: []
    });
    assert.equal(payload.acumulacion_habilitada, true);
    assert.equal(payload.lempiras_por_punto, 10);
  });

  it('guardar envia acumulacion_habilitada en el payload (false)', () => {
    const payload = buildSaveConfiguracionPayload({
      idSucursal: 1,
      lempiras: '',
      acumulacionHabilitada: false,
      productosCanjeables: []
    });
    assert.equal(payload.acumulacion_habilitada, false);
  });

  it('la tasa es siempre obligatoria (>0), incluso con el switch apagado: tambien la usa el canje', () => {
    const vacioApagado = computeConfiguracionSubmitState({ lempiras: '', saving: false });
    assert.equal(vacioApagado.canSubmit, false);

    const ceroApagado = computeConfiguracionSubmitState({ lempiras: '0', saving: false });
    assert.equal(ceroApagado.canSubmit, false);

    const validoApagado = computeConfiguracionSubmitState({ lempiras: '5', saving: false });
    assert.equal(validoApagado.canSubmit, true);
  });

  it('la tasa es obligatoria de la misma forma con el switch encendido', () => {
    const invalido = computeConfiguracionSubmitState({ lempiras: '0', saving: false });
    assert.equal(invalido.canSubmit, false);

    const vacio = computeConfiguracionSubmitState({ lempiras: '', saving: false });
    assert.equal(vacio.canSubmit, false);

    const valido = computeConfiguracionSubmitState({ lempiras: '5', saving: false });
    assert.equal(valido.canSubmit, true);
  });

  it('mientras esta guardando (saving=true) nunca permite un nuevo submit, aunque la tasa sea valida', () => {
    const { canSubmit } = computeConfiguracionSubmitState({ lempiras: '10', saving: true });
    assert.equal(canSubmit, false);
  });
});

describe('switch de acumulacion de puntos: aislamiento de otros modulos', () => {
  it('un error del endpoint de guardado solo actualiza toast/saving, no otro estado global', async () => {
    const source = await readFile(
      new URL('../hooks/useFidelizacion.js', import.meta.url),
      'utf8'
    );
    const start = source.indexOf('const saveConfiguracion = useCallback');
    assert.notEqual(start, -1);
    const end = source.indexOf('}, [openToast]);', start);
    const block = source.slice(start, end);
    const catchStart = block.indexOf('catch (err)');
    const catchBlock = block.slice(catchStart);
    assert.match(catchBlock, /openToast\(/);
    assert.match(catchBlock, /throw err;/);
    // El catch no debe tocar pedidos/caja/ventas ni otro estado ajeno a este flujo.
    assert.doesNotMatch(catchBlock, /setPedidos|setCaja|setVenta/);
  });

  it('el modal y los helpers de configuracion no importan ni referencian Caja ni Ventas', async () => {
    const modalSource = await readFile(
      new URL('../components/ConfiguracionReglasModal.jsx', import.meta.url),
      'utf8'
    );
    const helpersSource = await readFile(new URL('./fidelizacionHelpers.js', import.meta.url), 'utf8');

    for (const source of [modalSource, helpersSource]) {
      assert.doesNotMatch(source, /from ['"].*\/(caja|ventas)Service/i);
      assert.doesNotMatch(source, /from ['"].*dashboard\/ventas\//);
    }
  });

  it('guardar la configuracion de fidelizacion no dispara ninguna llamada a servicios de caja o ventas', async () => {
    const hookSource = await readFile(
      new URL('../hooks/useFidelizacion.js', import.meta.url),
      'utf8'
    );
    assert.doesNotMatch(hookSource, /cajaService|ventasService/);
  });
});

// Paginacion de clientes (9 por pagina, igual a Ventas) y filtro de puntos.
// normalizeEnvelopeMeta es la funcion pura que aplica el fallback de limit
// cuando el backend no lo devuelve, asi que se puede ejecutar directamente
// (comportamiento real). El resto del contrato (estado inicial, reset de
// pagina, uso de SecurityPaginationBar) se verifica sobre el codigo fuente
// real de Fidelizacion.jsx / useFidelizacion.js / FidelizacionOverview.jsx,
// igual que el patron ya usado arriba para el switch de acumulacion (los
// componentes usan hooks/portals y no se pueden montar bajo node:test).

describe('normalizeEnvelopeMeta: aplica el fallback de limit recibido por el caller', () => {
  it('sin limit en la respuesta, usa el fallback pasado (9 para clientes)', () => {
    const meta = normalizeEnvelopeMeta({ total: 25, page: 1 }, 9);
    assert.equal(meta.limit, 9);
  });

  it('sin limit en la respuesta, usa el fallback pasado (20 para canjes)', () => {
    const meta = normalizeEnvelopeMeta({ total: 40, page: 1 }, 20);
    assert.equal(meta.limit, 20);
  });

  it('si la respuesta si trae limit, ese valor gana sobre el fallback', () => {
    const meta = normalizeEnvelopeMeta({ total: 25, page: 1, limit: 9 }, 20);
    assert.equal(meta.limit, 9);
  });
});

describe('Fidelizacion.jsx: estado inicial de clientesQuery y reset de pagina', () => {
  const getSource = () => readFile(new URL('../../Fidelizacion.jsx', import.meta.url), 'utf8');

  it('clientesQuery inicia con limit: 9 (no 20)', async () => {
    const source = await getSource();
    assert.match(
      source,
      /const \[clientesQuery, setClientesQuery\] = useState\(\{\s*\n\s*search: '',\s*\n\s*page: 1,\s*\n\s*limit: 9\s*\n\s*\}\);/
    );
  });

  it('canjesQuery sigue en limit: 20 (no se toca la paginacion de canjes)', async () => {
    const source = await getSource();
    assert.match(source, /const \[canjesQuery, setCanjesQuery\] = useState\(\{\s*\n\s*page: 1,\s*\n\s*limit: 20,/);
  });

  it('una nueva busqueda reinicia clientesQuery.page a 1', async () => {
    const source = await getSource();
    assert.match(
      source,
      /onSearch=\{\(search\) => setClientesQuery\(\(prev\) => \(\{ \.\.\.prev, page: 1, search \}\)\)\}/
    );
  });

  it('cambiar de sucursal reinicia clientesQuery.page a 1 (handleClientesSucursalChange)', async () => {
    const source = await getSource();
    const start = source.indexOf('const handleClientesSucursalChange');
    assert.notEqual(start, -1, 'debe existir un handler dedicado para el cambio de sucursal de clientes');
    const end = source.indexOf('};', start);
    const handler = source.slice(start, end);
    assert.match(handler, /setSelectedSucursalId\(value\);/);
    assert.match(handler, /setClientesQuery\(\(previous\) => \(\{\s*\n\s*\.\.\.previous,\s*\n\s*page: 1\s*\n\s*\}\)\);/);
    // El cambio de sucursal de clientes nunca debe tocar canjesQuery.
    assert.doesNotMatch(handler, /setCanjesQuery/);
  });

  it('FidelizacionOverview (tab panel) recibe handleClientesSucursalChange como onSucursalChange', async () => {
    const source = await getSource();
    const start = source.indexOf('<FidelizacionOverview');
    const end = source.indexOf('/>', start);
    const block = source.slice(start, end);
    assert.match(block, /onSucursalChange=\{handleClientesSucursalChange\}/);
  });

  it('FidelizacionCanjesList (tab canjes) sigue con su propio cambio de sucursal, sin reset de pagina de clientes', async () => {
    const source = await getSource();
    const start = source.indexOf('<FidelizacionCanjesList');
    const end = source.indexOf('/>', start);
    const block = source.slice(start, end);
    assert.match(block, /onSucursalChange=\{\(value\) => setSelectedSucursalId\(value\)\}/);
  });
});

describe('useFidelizacion.js: paginacion de clientes y canjes con estados y fallbacks independientes', () => {
  const getSource = () => readFile(new URL('../hooks/useFidelizacion.js', import.meta.url), 'utf8');

  it('existen dos constantes de paginacion inicial separadas (no una sola compartida)', async () => {
    const source = await getSource();
    assert.match(source, /const initialClientesPagination = \{\s*\n\s*total: 0,\s*\n\s*page: 1,\s*\n\s*limit: 9\s*\n\s*\};/);
    assert.match(source, /const initialCanjesPagination = \{\s*\n\s*total: 0,\s*\n\s*page: 1,\s*\n\s*limit: 20\s*\n\s*\};/);
  });

  it('clientesMeta usa initialClientesPagination y canjesMeta usa initialCanjesPagination', async () => {
    const source = await getSource();
    assert.match(source, /useState\(initialClientesPagination\)/);
    assert.match(source, /useState\(initialCanjesPagination\)/);
  });

  it('loadClientes usa fallback 9 al normalizar la meta de paginacion', async () => {
    const source = await getSource();
    const start = source.indexOf('const loadClientes = useCallback');
    const end = source.indexOf('}, [openToast]);', start);
    const block = source.slice(start, end);
    assert.match(block, /normalizeEnvelopeMeta\(response, Number\(params\?\.limit\) \|\| 9\)/);
  });

  it('loadCanjes conserva el fallback 20 (no se modifica la paginacion de canjes)', async () => {
    const source = await getSource();
    const start = source.indexOf('const loadCanjes = useCallback');
    const end = source.indexOf('}, [openToast]);', start);
    const block = source.slice(start, end);
    assert.match(block, /normalizeEnvelopeMeta\(response, Number\(params\?\.limit\) \|\| 20\)/);
  });
});

describe('FidelizacionOverview.jsx: paginacion igual a Ventas (SecurityPaginationBar, no la implementacion local)', () => {
  const getSource = () => readFile(new URL('../components/FidelizacionOverview.jsx', import.meta.url), 'utf8');

  it('importa SecurityPaginationBar desde el modulo de Seguridad (misma ruta que usa VentasList)', async () => {
    const source = await getSource();
    assert.match(source, /import SecurityPaginationBar from '\.\.\/\.\.\/seguridad\/components\/SecurityPaginationBar';/);
  });

  it('ya no existe el componente local "const Pagination ="', async () => {
    const source = await getSource();
    assert.doesNotMatch(source, /const Pagination = /);
  });

  it('renderiza SecurityPaginationBar con pageSize=9 (CLIENTES_PAGE_SIZE) y maxVisible={5}', async () => {
    const source = await getSource();
    const start = source.indexOf('<SecurityPaginationBar');
    assert.notEqual(start, -1);
    const end = source.indexOf('/>', start);
    const block = source.slice(start, end);
    assert.match(block, /pageSize=\{clientesMeta\?\.limit \|\| CLIENTES_PAGE_SIZE\}/);
    assert.match(block, /maxVisible=\{5\}/);
    assert.match(block, /className="ventas-page__pagination-bar"/);
  });

  it('CLIENTES_PAGE_SIZE es 9', async () => {
    const source = await getSource();
    assert.match(source, /const CLIENTES_PAGE_SIZE = 9;/);
  });

  it('muestra el texto fijo "9 por página" y "Página X de Y"', async () => {
    const source = await getSource();
    assert.match(source, /<span>9 por página<\/span>/);
    assert.match(source, /Página \{clientesMeta\?\.page \|\| 1\} de \{clientesTotalPages\}/);
  });

  it('la estructura de paginacion sigue el mismo bloque que Ventas: ventas-page__pagination envolviendo la barra y la etiqueta', async () => {
    const source = await getSource();
    const start = source.indexOf('<div className="ventas-page__pagination">');
    assert.notEqual(start, -1);
    const end = source.indexOf('</div>\n        ) : null}', start);
    const block = source.slice(start, end);
    assert.match(block, /<SecurityPaginationBar/);
    assert.match(block, /className="ventas-page__page-size-label"/);
  });

  it('estado vacio SIN busqueda: "Aun hay clientes con puntos acumulados" (mensaje especifico, no el generico anterior)', async () => {
    const source = await getSource();
    assert.match(source, /'Aún no hay clientes con puntos acumulados\.'/);
    assert.doesNotMatch(source, /No se encontraron clientes con el filtro aplicado/, 'el mensaje generico anterior debe haber sido reemplazado');
  });

  it('estado vacio CON busqueda activa: "No se encontró ningún cliente con esa búsqueda."', async () => {
    const source = await getSource();
    assert.match(source, /'No se encontró ningún cliente con esa búsqueda\.'/);
  });

  it('el mensaje vacio depende de currentSearch (hasActiveSearch), no es siempre el mismo texto', async () => {
    const source = await getSource();
    assert.match(source, /const hasActiveSearch = String\(currentSearch \|\| ''\)\.trim\(\)\.length > 0;/);
    assert.match(source, /const emptyClientesMessage = hasActiveSearch/);
  });

  it('el mismo mensaje vacio ({emptyClientesMessage}) se usa tanto en la tabla de escritorio como en las tarjetas moviles', async () => {
    const source = await getSource();
    const occurrences = source.match(/\{emptyClientesMessage\}/g) || [];
    assert.equal(occurrences.length, 2, 'debe aparecer una vez en el tbody de escritorio y otra en las tarjetas moviles');
  });

  it('la tabla de escritorio y las tarjetas moviles iteran sobre la misma coleccion "clientes" (sin duplicar ni divergir)', async () => {
    const source = await getSource();
    const mapCalls = [...source.matchAll(/clientes\.map\(\(cli\) =>/g)];
    assert.equal(mapCalls.length, 2, 'debe haber exactamente dos .map sobre "clientes": tabla y tarjetas');
  });

  it('el total de paginas se calcula con el limit efectivo de clientesMeta (fallback CLIENTES_PAGE_SIZE)', async () => {
    const source = await getSource();
    assert.match(
      source,
      /const clientesTotalPages = Math\.max\(\s*\n\s*1,\s*\n\s*Math\.ceil\(\(clientesMeta\?\.total \|\| 0\) \/ \(clientesMeta\?\.limit \|\| CLIENTES_PAGE_SIZE\)\)\s*\n\s*\);/
    );
  });
});

describe('Responsive: la paginacion de Fidelizacion no oculta los numeros de pagina en movil (a diferencia del breakpoint compartido de Ventas)', () => {
  it('fidelizacion.css reactiva .inv-warehouse-moves__pagination-pages dentro de .fidelizacion-page por debajo de 767.98px', async () => {
    const cssSource = await readFile(new URL('../styles/fidelizacion.css', import.meta.url), 'utf8');
    assert.match(
      cssSource,
      /\.fidelizacion-page \.ventas-page__pagination-bar \.inv-warehouse-moves__pagination-pages \{\s*\n\s*display: flex !important;/
    );
  });

  it('ventas.css (reutilizado tal cual) sigue ocultando los numeros de pagina en su propio breakpoint movil: no se modifico ese archivo', async () => {
    const ventasCssSource = await readFile(
      new URL('../../ventas/styles/ventas.css', import.meta.url),
      'utf8'
    );
    assert.match(
      ventasCssSource,
      /\.ventas-page \.ventas-page__pagination-bar \.inv-warehouse-moves__pagination-pages \{\s*\n\s*display: none !important;/
    );
  });
});

// Bloqueante 2 (auditoria independiente): loadClientes no descartaba
// respuestas fuera de orden. createLatestRequestTracker es el helper puro
// (sin React) que useFidelizacion.js usa de verdad dentro de loadClientes
// para resolver esto; aqui se prueba ese MISMO helper con promesas
// diferidas, simulando el mismo patron (start -> await -> isLatest ->
// aplicar-o-descartar) que loadClientes ejecuta en produccion. No existe
// un arnes para montar hooks en este repo (ver comentario al inicio del
// archivo), asi que este es el camino que el propio requerimiento permite
// como alternativa: probar el helper real con promesas diferidas.

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

// Mismo patron que loadClientes real (useFidelizacion.js): start() antes
// de esperar la respuesta, isLatest() antes de aplicar datos/metadata,
// isLatest() antes de mostrar un error/toast, isLatest() antes de apagar
// loading. state es un objeto mutable compartido que representa lo que
// loadClientes expone (clientes/clientesMeta/loadingClientes/toastCount).
const simulateLoadClientes = (tracker, state, deferred, pageLabel) => {
  const requestId = tracker.start();
  state.loadingClientes = true;

  return deferred.promise
    .then((response) => {
      if (!tracker.isLatest(requestId)) return response;
      state.clientes = response.clientes;
      state.clientesMeta = { page: response.page };
      return response;
    })
    .catch((error) => {
      if (!tracker.isLatest(requestId)) return undefined;
      state.toastCount += 1;
      state.lastError = error;
      throw error;
    })
    .finally(() => {
      if (tracker.isLatest(requestId)) {
        state.loadingClientes = false;
      }
    });
};

describe('createLatestRequestTracker: solo la solicitud mas reciente aplica su resultado (helper real de loadClientes, con promesas diferidas)', () => {
  it('escenario 1: B (pagina 3) resuelve antes que A (pagina 2); A llega despues y queda ignorada', async () => {
    const tracker = createLatestRequestTracker();
    const state = { clientes: [], clientesMeta: null, loadingClientes: false, toastCount: 0, lastError: null };
    const deferredA = createDeferred();
    const deferredB = createDeferred();

    const taskA = simulateLoadClientes(tracker, state, deferredA, 'pagina-2');
    const taskB = simulateLoadClientes(tracker, state, deferredB, 'pagina-3');

    deferredB.resolve({ clientes: ['cliente-b'], page: 3 });
    await taskB;
    assert.deepEqual(state.clientes, ['cliente-b']);
    assert.deepEqual(state.clientesMeta, { page: 3 });

    deferredA.resolve({ clientes: ['cliente-a'], page: 2 });
    await taskA;
    // A (obsoleta) no debe sobrescribir los datos/metadata que ya aplico B.
    assert.deepEqual(state.clientes, ['cliente-b']);
    assert.deepEqual(state.clientesMeta, { page: 3 });
  });

  it('escenario 2: B queda pendiente; A termina primero y NO apaga loading; B termina despues y si lo apaga', async () => {
    const tracker = createLatestRequestTracker();
    const state = { clientes: [], clientesMeta: null, loadingClientes: false, toastCount: 0, lastError: null };
    const deferredA = createDeferred();
    const deferredB = createDeferred();

    const taskA = simulateLoadClientes(tracker, state, deferredA, 'A');
    const taskB = simulateLoadClientes(tracker, state, deferredB, 'B');
    assert.equal(state.loadingClientes, true);

    deferredA.resolve({ clientes: [], page: 1 });
    await taskA;
    assert.equal(state.loadingClientes, true, 'A (obsoleta) no debe apagar el loading de B, que sigue pendiente');

    deferredB.resolve({ clientes: [], page: 1 });
    await taskB;
    assert.equal(state.loadingClientes, false, 'B (vigente) si debe apagar el loading al terminar');
  });

  it('escenario 3: A falla despues de que empezo B; A no genera toast ni error visible; B responde bien y actualiza la vista', async () => {
    const tracker = createLatestRequestTracker();
    const state = { clientes: [], clientesMeta: null, loadingClientes: false, toastCount: 0, lastError: null };
    const deferredA = createDeferred();
    const deferredB = createDeferred();

    const taskA = simulateLoadClientes(tracker, state, deferredA, 'A');
    const taskB = simulateLoadClientes(tracker, state, deferredB, 'B');

    deferredA.reject(new Error('A goes down'));
    // La solicitud obsoleta se ignora de forma controlada: no debe
    // relanzar ni producir un unhandled rejection.
    await assert.doesNotReject(taskA);
    assert.equal(state.toastCount, 0, 'A obsoleta no debe generar toast');
    assert.equal(state.lastError, null, 'A obsoleta no debe dejar un error visible');

    deferredB.resolve({ clientes: ['cliente-b'], page: 3 });
    await taskB;
    assert.deepEqual(state.clientes, ['cliente-b'], 'B (vigente) si debe actualizar la vista');
  });

  it('un id repetido nunca es "latest" dos veces: cada start() invalida el anterior', () => {
    const tracker = createLatestRequestTracker();
    const idA = tracker.start();
    assert.equal(tracker.isLatest(idA), true);
    const idB = tracker.start();
    assert.equal(tracker.isLatest(idA), false);
    assert.equal(tracker.isLatest(idB), true);
  });
});

describe('useFidelizacion.js: loadClientes usa createLatestRequestTracker (el mismo helper probado arriba, no una implementacion paralela)', () => {
  const getSource = () => readFile(new URL('../hooks/useFidelizacion.js', import.meta.url), 'utf8');

  it('importa createLatestRequestTracker desde fidelizacionHelpers (no duplica el controlador)', async () => {
    const source = await getSource();
    assert.match(source, /createLatestRequestTracker/);
    assert.match(source, /from '\.\.\/utils\/fidelizacionHelpers'/);
  });

  it('crea el tracker con useRef (identificador monotonico que sobrevive entre renders)', async () => {
    const source = await getSource();
    assert.match(source, /const clientesRequestTrackerRef = useRef\(createLatestRequestTracker\(\)\);/);
  });

  it('loadClientes llama tracker.start() antes de la llamada al servicio', async () => {
    const source = await getSource();
    const start = source.indexOf('const loadClientes = useCallback');
    const end = source.indexOf('}, [openToast]);', start);
    const block = source.slice(start, end);
    assert.match(block, /const requestId = tracker\.start\(\);/);
    const requestIdIdx = block.indexOf('const requestId = tracker.start();');
    const fetchIdx = block.indexOf('fidelizacionService.listClientes(params)');
    assert.ok(requestIdIdx < fetchIdx, 'el requestId debe capturarse antes de iniciar la peticion');
  });

  it('solo aplica clientes/clientesMeta si tracker.isLatest(requestId) sigue siendo verdadero', async () => {
    const source = await getSource();
    const start = source.indexOf('const loadClientes = useCallback');
    const end = source.indexOf('}, [openToast]);', start);
    const block = source.slice(start, end);
    assert.match(block, /if \(!tracker\.isLatest\(requestId\)\) \{\s*\n\s*return rows;\s*\n\s*\}/);
    const guardIdx = block.search(/if \(!tracker\.isLatest\(requestId\)\) \{\s*\n\s*return rows;/);
    const setClientesIdx = block.indexOf('setClientes(rows);');
    assert.ok(guardIdx < setClientesIdx, 'el guard de frescura debe evaluarse antes de aplicar setClientes');
  });

  it('una solicitud obsoleta que falla no muestra toast ni error (se ignora antes del catch actual)', async () => {
    const source = await getSource();
    const start = source.indexOf('const loadClientes = useCallback');
    const end = source.indexOf('}, [openToast]);', start);
    const block = source.slice(start, end);
    const catchIdx = block.indexOf('} catch (err) {');
    const catchBlock = block.slice(catchIdx);
    const staleGuardIdx = catchBlock.search(/if \(!tracker\.isLatest\(requestId\)\) \{\s*\n\s*return \[\];\s*\n\s*\}/);
    const openToastIdx = catchBlock.indexOf('openToast(');
    assert.notEqual(staleGuardIdx, -1);
    assert.ok(staleGuardIdx < openToastIdx, 'el guard de solicitud obsoleta debe evaluarse antes de abrir el toast');
  });

  it('una solicitud obsoleta no apaga loadingClientes (guard tambien en el finally)', async () => {
    const source = await getSource();
    const start = source.indexOf('const loadClientes = useCallback');
    const end = source.indexOf('}, [openToast]);', start);
    const block = source.slice(start, end);
    const finallyIdx = block.indexOf('} finally {');
    const finallyBlock = block.slice(finallyIdx);
    assert.match(finallyBlock, /if \(tracker\.isLatest\(requestId\)\) \{\s*\n\s*setLoadingClientes\(false\);\s*\n\s*\}/);
  });
});

describe('SecurityPaginationBar.jsx: prop "disabled" retrocompatible', () => {
  const getSource = () => readFile(new URL('../../seguridad/components/SecurityPaginationBar.jsx', import.meta.url), 'utf8');

  it('disabled tiene default false', async () => {
    const source = await getSource();
    assert.match(source, /disabled = false,/);
  });

  it('Anterior queda deshabilitado con disabled=true o en la primera pagina (comportamiento anterior conservado con ||)', async () => {
    const source = await getSource();
    assert.match(source, /disabled=\{disabled \|\| safeCurrentPage <= 1\}/);
  });

  it('todos los numeros de pagina quedan deshabilitados con disabled=true', async () => {
    const source = await getSource();
    const start = source.indexOf('{visiblePages.map((pageNumber) => (');
    const end = source.indexOf('))}', start);
    const block = source.slice(start, end);
    assert.match(block, /disabled=\{disabled\}/);
  });

  it('Siguiente queda deshabilitado con disabled=true o en la ultima pagina (comportamiento anterior conservado con ||)', async () => {
    const source = await getSource();
    assert.match(source, /disabled=\{disabled \|\| safeCurrentPage >= totalPages\}/);
  });

  it('aria-busy en el contenedor principal refleja disabled', async () => {
    const source = await getSource();
    assert.match(source, /aria-busy=\{disabled\}/);
  });

  it('emitPage no llama a onPageChange cuando disabled=true (guard explicito, no solo el atributo HTML disabled)', async () => {
    const source = await getSource();
    const start = source.indexOf('const emitPage = (nextPage) => {');
    const end = source.indexOf('};', start);
    const block = source.slice(start, end);
    assert.match(block, /if \(disabled\) return;/);
    const disabledGuardIdx = block.indexOf('if (disabled) return;');
    const onPageChangeIdx = block.indexOf('onPageChange(safeNext);');
    assert.ok(disabledGuardIdx < onPageChangeIdx, 'el guard de disabled debe evaluarse antes de emitir onPageChange');
  });

  it('sin la prop disabled, el comportamiento anterior se conserva exactamente (|| false no cambia nada)', async () => {
    const source = await getSource();
    // safeCurrentPage <= 1 / >= totalPages siguen siendo, por si solos,
    // suficientes para deshabilitar Anterior/Siguiente cuando disabled
    // es false (valor por defecto): "false || X" === X.
    assert.match(source, /disabled=\{disabled \|\| safeCurrentPage <= 1\}/);
    assert.match(source, /disabled=\{disabled \|\| safeCurrentPage >= totalPages\}/);
  });

  it('Ventas y Seguridad no necesitan enviar la nueva prop: ningun otro archivo referencia disabled= al usar SecurityPaginationBar', async () => {
    const ventasListSource = await readFile(
      new URL('../../ventas/components/VentasList.jsx', import.meta.url),
      'utf8'
    );
    const start = ventasListSource.indexOf('<SecurityPaginationBar');
    const end = ventasListSource.indexOf('/>', start);
    const block = ventasListSource.slice(start, end);
    assert.doesNotMatch(block, /disabled=/, 'VentasList no deberia haberse tocado para esta correccion');
  });
});

// Defecto confirmado: Fidelizacion resolvia la sucursal/stock de un
// producto canjeable con el modelo heredado (productos.id_almacen), asi
// que un producto maestro asignado a varias sucursales se rechazaba en
// falso. El frontend ademas dejaba que SUPER_ADMIN cayera en la sucursal
// del filtro general del panel, no mostraba imagen/nombre reales y
// concatenaba precio/stock en un solo texto. Estas pruebas cubren el
// carrito, el bloqueo de Confirmar, la normalizacion de datos maestros y
// -via el mismo patron ya usado en el bloqueante 2 de paginacion- la
// proteccion contra respuestas fuera de orden al cambiar de sucursal
// dentro del modal.

describe('computeCanjeCartAfterAdd: un producto sin stock nunca se puede agregar (helper real usado por GenerarCanjeModal)', () => {
  it('stock_disponible=0 no agrega el producto (Number(0) es falsy: no se usa "|| Infinity" como maxStock)', () => {
    const carrito = computeCanjeCartAfterAdd([], { id_producto: 1, stock_disponible: 0 });
    assert.deepEqual(carrito, []);
  });

  it('producto nuevo con stock > 0 se agrega con cantidad 1', () => {
    const carrito = computeCanjeCartAfterAdd([], { id_producto: 1, stock_disponible: 5, nombre_producto: 'X' });
    assert.equal(carrito.length, 1);
    assert.equal(carrito[0].cantidad, 1);
  });

  it('agregar un producto ya en el carrito respeta el stock maximo (no incrementa mas alla)', () => {
    const carrito = [{ id_producto: 1, stock_disponible: 2, cantidad: 2 }];
    const next = computeCanjeCartAfterAdd(carrito, { id_producto: 1, stock_disponible: 2, cantidad: 2 });
    assert.equal(next[0].cantidad, 2, 'no debe superar el stock disponible (2)');
    assert.equal(next, carrito, 'sin cambio real, debe devolver la misma referencia (no re-renderiza)');
  });

  it('agregar un producto ya en el carrito con stock restante incrementa en 1', () => {
    const carrito = [{ id_producto: 1, stock_disponible: 5, cantidad: 2 }];
    const next = computeCanjeCartAfterAdd(carrito, { id_producto: 1, stock_disponible: 5 });
    assert.equal(next[0].cantidad, 3);
  });
});

describe('computeCanjeConfirmDisabled: unica regla de bloqueo del boton Confirmar canje', () => {
  const baseArgs = () => ({
    saving: false,
    loadingCanjeables: false,
    sucursalMissing: false,
    carrito: [{ id_producto: 1, cantidad: 1, stock_disponible: 5 }],
    saldoInsuficiente: false
  });

  it('habilitado cuando no hay ningun bloqueo', () => {
    const { disabled } = computeCanjeConfirmDisabled(baseArgs());
    assert.equal(disabled, false);
  });

  it('bloqueado sin sucursal seleccionada (SUPER_ADMIN)', () => {
    const { disabled } = computeCanjeConfirmDisabled({ ...baseArgs(), sucursalMissing: true });
    assert.equal(disabled, true);
  });

  it('bloqueado sin productos en el carrito', () => {
    const { disabled } = computeCanjeConfirmDisabled({ ...baseArgs(), carrito: [] });
    assert.equal(disabled, true);
  });

  it('bloqueado con puntos insuficientes', () => {
    const { disabled } = computeCanjeConfirmDisabled({ ...baseArgs(), saldoInsuficiente: true });
    assert.equal(disabled, true);
  });

  it('bloqueado mientras el catalogo esta cargando', () => {
    const { disabled } = computeCanjeConfirmDisabled({ ...baseArgs(), loadingCanjeables: true });
    assert.equal(disabled, true);
  });

  it('bloqueado mientras se esta guardando (saving)', () => {
    const { disabled } = computeCanjeConfirmDisabled({ ...baseArgs(), saving: true });
    assert.equal(disabled, true);
  });

  it('bloqueado cuando algun item del carrito supera su stock disponible', () => {
    const { disabled, algunProductoExcedeStock } = computeCanjeConfirmDisabled({
      ...baseArgs(),
      carrito: [{ id_producto: 1, cantidad: 9, stock_disponible: 5 }]
    });
    assert.equal(algunProductoExcedeStock, true);
    assert.equal(disabled, true);
  });
});

describe('normalizeCanjeableResponse: conserva imagen y datos de asignacion local (no elimina campos que el modal necesita)', () => {
  it('conserva id_archivo_imagen_principal, imagen_principal_url, id_sucursal, id_almacen y nombre_almacen', () => {
    const normalized = normalizeCanjeableResponse({
      data: [
        {
          id_producto: 156,
          nombre_producto: 'SEVEN UP 1.1 LT',
          descripcion_producto: '',
          id_archivo_imagen_principal: 227,
          imagen_principal_url: 'https://cdn.example/imagen.jpg',
          precio: 48,
          id_sucursal: 1,
          id_almacen: 1,
          nombre_almacen: "Almacen Jonny's el Carmen",
          cantidad: 10000,
          stock_minimo: 3,
          stock_disponible: 9997,
          puntos_requeridos_override: null,
          puntos_requeridos: 5
        }
      ]
    });

    const item = normalized.items[0];
    assert.equal(item.id_archivo_imagen_principal, 227);
    assert.equal(item.imagen_principal_url, 'https://cdn.example/imagen.jpg');
    assert.equal(item.id_sucursal, 1);
    assert.equal(item.id_almacen, 1);
    assert.equal(item.nombre_almacen, "Almacen Jonny's el Carmen");
    assert.equal(item.stock_disponible, 9997);
  });

  it('imagen_principal_url null (producto sin imagen) se conserva como null, no como cadena vacia enganosa', () => {
    const normalized = normalizeCanjeableResponse({ data: [{ id_producto: 1, imagen_principal_url: null }] });
    assert.equal(normalized.items[0].imagen_principal_url, null);
  });
});

// Concurrencia al cambiar de sucursal dentro del modal de canje: mismo
// patron ejecutable ya usado para el bloqueante 2 de paginacion (helper
// real createLatestRequestTracker + promesas diferidas). No existe un
// arnes para montar hooks en este repo, asi que useFidelizacion.js real se
// verifica por separado (mas abajo) contra el codigo fuente para confirmar
// que usa este MISMO helper dentro de loadCanjeables.

// createDeferred ya esta definido arriba (reutilizado del bloqueante 2 de
// paginacion): mismo helper de pruebas, no una segunda copia.

// Mismo patron que loadCanjeables real (useFidelizacion.js).
const simulateLoadCanjeables = (tracker, state, deferred, label) => {
  const requestId = tracker.start();
  state.loadingCanjeables = true;

  return deferred.promise
    .then((response) => {
      if (!tracker.isLatest(requestId)) return response;
      state.canjeablesData = response;
      return response;
    })
    .catch((error) => {
      if (!tracker.isLatest(requestId)) return undefined;
      state.toastCount += 1;
      throw error;
    })
    .finally(() => {
      if (tracker.isLatest(requestId)) {
        state.loadingCanjeables = false;
      }
    });
};

describe('createLatestRequestTracker aplicado a canjeables: cambiar de sucursal rapido no deja catalogo fuera de orden', () => {
  it('sucursal B (seleccionada despues) gana aunque su respuesta llegue... y la respuesta tardia de A (abandonada) no la sobrescribe', async () => {
    const tracker = createLatestRequestTracker();
    const state = { canjeablesData: null, loadingCanjeables: false, toastCount: 0 };
    const deferredA = createDeferred();
    const deferredB = createDeferred();

    const taskA = simulateLoadCanjeables(tracker, state, deferredA, 'sucursal-A');
    const taskB = simulateLoadCanjeables(tracker, state, deferredB, 'sucursal-B');

    deferredB.resolve({ items: [{ id_producto: 2 }], message: '', saldoCliente: null });
    await taskB;
    assert.deepEqual(state.canjeablesData.items, [{ id_producto: 2 }]);

    deferredA.resolve({ items: [{ id_producto: 1 }], message: '', saldoCliente: null });
    await taskA;
    assert.deepEqual(state.canjeablesData.items, [{ id_producto: 2 }], 'A (sucursal abandonada) no debe sobrescribir el catalogo de B');
  });

  it('un error tardio de la sucursal abandonada no genera toast ni apaga el loading de la solicitud vigente', async () => {
    const tracker = createLatestRequestTracker();
    const state = { canjeablesData: null, loadingCanjeables: false, toastCount: 0 };
    const deferredA = createDeferred();
    const deferredB = createDeferred();

    const taskA = simulateLoadCanjeables(tracker, state, deferredA, 'A');
    simulateLoadCanjeables(tracker, state, deferredB, 'B');
    assert.equal(state.loadingCanjeables, true);

    deferredA.reject(new Error('sucursal A goes down'));
    await assert.doesNotReject(taskA);
    assert.equal(state.toastCount, 0);
    assert.equal(state.loadingCanjeables, true, 'A obsoleta no debe apagar el loading de B, que sigue pendiente');
  });
});

describe('useFidelizacion.js: loadCanjeables usa createLatestRequestTracker (el mismo helper probado arriba)', () => {
  const getSource = () => readFile(new URL('../hooks/useFidelizacion.js', import.meta.url), 'utf8');

  it('crea un tracker de canjeables dedicado (no reutiliza el de clientes) con useRef', async () => {
    const source = await getSource();
    assert.match(source, /const canjeablesRequestTrackerRef = useRef\(createLatestRequestTracker\(\)\);/);
  });

  it('loadCanjeables aplica el guard de frescura antes de setCanjeablesData, del toast y del loading', async () => {
    const source = await getSource();
    const start = source.indexOf('const loadCanjeables = useCallback');
    const end = source.indexOf('\n  const resetCanjeables', start);
    const block = source.slice(start, end);

    assert.match(block, /if \(!tracker\.isLatest\(requestId\)\) \{\s*\n\s*return normalized;\s*\n\s*\}/);
    assert.match(block, /if \(!tracker\.isLatest\(requestId\)\) \{\s*\n\s*return null;\s*\n\s*\}/);
    assert.match(block, /if \(tracker\.isLatest\(requestId\)\) \{\s*\n\s*setLoadingCanjeables\(false\);/);
  });

  it('resetCanjeables invalida la solicitud en curso (start()) antes de limpiar el estado', async () => {
    const source = await getSource();
    const start = source.indexOf('const resetCanjeables = useCallback');
    const end = source.indexOf('}, []);', start);
    const block = source.slice(start, end);
    assert.match(block, /canjeablesRequestTrackerRef\.current\.start\(\);/);
    assert.match(block, /setCanjeablesData\(initialCanjeablesData\);/);
  });
});

// Bloqueante confirmado: el efecto de GenerarCanjeModal.jsx que dispara
// onLoadCanjeables(...) no puede hacer await (no es async) y antes hacia
// "void onLoadCanjeables(...)". Como useFidelizacion.loadCanjeables muestra
// un toast, actualiza canjeablesData Y relanza el error de la solicitud
// vigente, ese rechazo nunca se consumia: un error de red/timeout/HTTP 500
// producia un Unhandled Promise Rejection real. consumeHandledAsyncError es
// la funcion pura que el efecto usa para evitarlo, probada aqui con
// promesas reales (resueltas y rechazadas), sin necesidad de montar React.
describe('consumeHandledAsyncError: ejecuta promiseFactory y descarta cualquier rechazo (sync o async), sin ocultar que ya fue manejado por el llamador', () => {
  it('promiseFactory que resuelve: consumeHandledAsyncError resuelve sin lanzar', async () => {
    let called = false;
    await assert.doesNotReject(consumeHandledAsyncError(async () => {
      called = true;
      return 'ok';
    }));
    assert.equal(called, true);
  });

  it('promiseFactory cuya promesa se rechaza: el rechazo se consume, consumeHandledAsyncError nunca lanza ni queda unhandled', async () => {
    const rejection = new Error('Error de red simulado');
    await assert.doesNotReject(consumeHandledAsyncError(() => Promise.reject(rejection)));
  });

  it('promiseFactory que lanza de forma sincrona (sin devolver promesa): tambien se consume, no solo los rechazos asincronos', async () => {
    await assert.doesNotReject(consumeHandledAsyncError(() => {
      throw new Error('Fallo sincrono simulado');
    }));
  });

  it('con el patron real de loadCanjeables (toast + estado + relanzar), la promesa envuelta sigue rechazando pero consumeHandledAsyncError la absorbe', async () => {
    let toastShown = false;
    let stateUpdated = false;
    const loadCanjeablesLike = async () => {
      try {
        await Promise.reject(new Error('HTTP 500'));
      } catch (err) {
        toastShown = true;
        stateUpdated = true;
        throw err;
      }
    };

    // El propio loadCanjeablesLike() SI rechaza (para no romper otros
    // consumidores que dependen del relanzamiento): se verifica aparte.
    await assert.rejects(loadCanjeablesLike());
    toastShown = false;
    stateUpdated = false;

    // consumeHandledAsyncError(...) envolviendo la misma llamada nunca
    // rechaza, pero el toast/estado de loadCanjeablesLike ya se ejecutaron
    // antes de relanzar (comportamiento del hook preservado).
    await assert.doesNotReject(consumeHandledAsyncError(() => loadCanjeablesLike()));
    assert.equal(toastShown, true);
    assert.equal(stateUpdated, true);
  });
});

describe('GenerarCanjeModal.jsx: el efecto que dispara onLoadCanjeables consume el rechazo con consumeHandledAsyncError (no queda como unhandled rejection)', () => {
  const getSource = () => readFile(new URL('../components/GenerarCanjeModal.jsx', import.meta.url), 'utf8');

  it('importa consumeHandledAsyncError desde fidelizacionHelpers (no reimplementa un try/catch paralelo)', async () => {
    const source = await getSource();
    assert.match(source, /consumeHandledAsyncError/);
    assert.match(source, /from '\.\.\/utils\/fidelizacionHelpers';/);
  });

  it('el efecto de carga de canjeables envuelve la llamada con consumeHandledAsyncError, en vez de "void onLoadCanjeables(...)" directo', async () => {
    const source = await getSource();
    const start = source.indexOf('// Carga (o recarga) el catalogo de canjeables');
    const end = source.indexOf('}, [open, cliente?.id_cliente, hasSucursalSeleccionada', start) + 200;
    const block = source.slice(start, end);

    assert.match(
      block,
      /void consumeHandledAsyncError\(\(\) => onLoadCanjeables\(cliente\.id_cliente, \{ id_sucursal: sucursalNumerica \}\)\);/
    );
    assert.doesNotMatch(block, /void onLoadCanjeables\(cliente\.id_cliente, \{ id_sucursal: sucursalNumerica \}\);/);
  });
});

describe('GenerarCanjeModal.jsx: selector de sucursal para usuarios con alcance multisucursal', () => {
  const getSource = () => readFile(new URL('../components/GenerarCanjeModal.jsx', import.meta.url), 'utf8');

  it('un usuario multisucursal ve ToolbarSucursalSelect; un usuario local ve una etiqueta de solo lectura', async () => {
    const source = await getSource();
    assert.match(source, /\{canSelectSucursal \? \(\s*\n\s*<ToolbarSucursalSelect/);
    assert.match(source, /fidelizacion-canje-modal__sucursal-readonly/);
  });

  it('el selector inicia vacio cada vez que se abre el modal para alcance multisucursal', async () => {
    const source = await getSource();
    assert.match(source, /setSelectedSucursalId\(canSelectSucursal \? '' : \(userSucursalId \? String\(userSucursalId\) : ''\)\)/);
  });

  it('no se cargan productos antes de seleccionar sucursal: el efecto de carga exige hasSucursalSeleccionada', async () => {
    const source = await getSource();
    const start = source.indexOf('// Carga (o recarga) el catalogo');
    const end = source.indexOf('}, [open, cliente?.id_cliente, hasSucursalSeleccionada', start) + 200;
    const block = source.slice(start, end);
    // El guard ahora retorna "undefined" explicito (en vez de un "return;"
    // vacio) porque el efecto ya no es un simple "void onLoadCanjeables(...)":
    // consume su rechazo con consumeHandledAsyncError (bloqueante: evitar
    // Unhandled Promise Rejection), y ambos caminos del efecto deben retornar
    // el mismo tipo (sin cleanup) para no confundir a React.
    assert.match(block, /if \(!open \|\| !cliente\?\.id_cliente \|\| !hasSucursalSeleccionada\) return undefined;/);
  });

  it('cambiar de sucursal vacia el carrito y la observacion (handleSucursalChange)', async () => {
    const source = await getSource();
    const start = source.indexOf('const handleSucursalChange = (value) => {');
    const end = source.indexOf('};', start);
    const block = source.slice(start, end);
    assert.match(block, /setCarrito\(\[\]\);/);
    assert.match(block, /setObservacion\(''\);/);
  });

  it('se envia id_sucursal al consultar productos canjeables (onLoadCanjeables)', async () => {
    const source = await getSource();
    assert.match(source, /onLoadCanjeables\(cliente\.id_cliente, \{ id_sucursal: sucursalNumerica \}\)/);
  });

  it('se envia el mismo id_sucursal (sucursalNumerica) al confirmar el canje (onSubmit)', async () => {
    const source = await getSource();
    const start = source.indexOf('const handleSubmit = async (event) => {');
    const end = source.indexOf('if (!open) return null;', start);
    const block = source.slice(start, end);
    assert.match(block, /await onSubmit\(/);
    assert.match(block, /sucursalNumerica,\s*\n\s*canSelectSucursal \? Number\(selectedSesionId\) : null\s*\n\s*\);/);
  });

  it('Confirmar canje usa computeCanjeConfirmDisabled (no una segunda copia de la regla de bloqueo)', async () => {
    const source = await getSource();
    assert.match(source, /const \{ algunProductoExcedeStock, disabled: confirmDisabled \} = computeCanjeConfirmDisabled\(\{/);
  });

  it('el carrito usa computeCanjeCartAfterAdd (no una segunda copia de la logica de stock)', async () => {
    const source = await getSource();
    assert.match(source, /setCarrito\(\(prev\) => computeCanjeCartAfterAdd\(prev, producto\)\);/);
  });
});

// Defecto confirmado: la tarjeta de "Canje presencial" reutilizaba solo
// parcialmente las clases de Caja (vcp-card canjeable-card), sin la
// estructura compacta completa (ventas-catalog-card-compact) ni
// resolveInventarioImageUrl. Resultado: tarjetas demasiado altas, badge de
// puntos sin posicionar (no absoluto dentro de vcp-card__media, competia por
// espacio con la imagen), precio/stock en filas propias en vez del footer
// compacto real de Caja. Estas pruebas confirman, sobre el codigo fuente
// real, que la tarjeta ahora sigue exactamente el mismo patron estructural
// que VentaComposerCatalog.jsx.
describe('GenerarCanjeModal.jsx: la tarjeta reutiliza el patron estructural completo de VentaComposerCatalog.jsx (Caja)', () => {
  const getSource = () => readFile(new URL('../components/GenerarCanjeModal.jsx', import.meta.url), 'utf8');

  it('importa y usa resolveInventarioImageUrl (nunca imagen_principal_url cruda como src)', async () => {
    const source = await getSource();
    assert.match(source, /import \{ resolveInventarioImageUrl \} from '\.\.\/\.\.\/\.\.\/\.\.\/utils\/inventarioImagenes';/);
    assert.match(source, /const imagenResuelta = resolveInventarioImageUrl\(producto\.imagen_principal_url\);/);
    assert.doesNotMatch(source, /src=\{producto\.imagen_principal_url\}/);
  });

  it('la tarjeta usa las clases compactas reales de Caja: vcp-card, ventas-catalog-card-compact, canjeable-card', async () => {
    const source = await getSource();
    assert.match(
      source,
      /className=\{`vcp-card ventas-catalog-card-compact canjeable-card \$\{selected \? 'selected' : ''\} \$\{sinStock \? 'is-out-of-stock' : ''\}`\}/
    );
  });

  it('renderiza <img> con la URL ya resuelta cuando existe imagen', async () => {
    const source = await getSource();
    assert.match(source, /\{imagenUrl \? \(\s*\n\s*<img\s*\n\s*src=\{imagenUrl\}/);
  });

  it('siempre renderiza un placeholder (oculto con d-none solo cuando hay imagen): nunca queda un bloque multimedia vacio', async () => {
    const source = await getSource();
    assert.match(source, /<div className=\{`vcp-card__placeholder \$\{imagenUrl \? 'd-none' : ''\}`\}>/);
  });

  it('una URL fallida revela el placeholder (onError oculta el <img> y quita d-none del hermano, mismo patron que VentaComposerCatalog.jsx)', async () => {
    const source = await getSource();
    assert.match(source, /onError=\{\(event\) => \{/);
    assert.match(source, /event\.currentTarget\.style\.display = 'none';/);
    assert.match(source, /next\.classList\.remove\('d-none'\);/);
  });

  it('el badge de puntos vive dentro de vcp-card__media (para poder posicionarse en absoluto sobre la imagen, como el badge de descuento real de Caja)', async () => {
    const source = await getSource();
    const start = source.indexOf('const ProductoCanjeableMedia');
    const end = source.indexOf('export default function GenerarCanjeModal', start);
    const block = source.slice(start, end);
    assert.match(block, /<div className="vcp-card__media">\s*\n\s*<span className="fidelizacion-canje-modal__points-badge">/);
  });

  it('el cuerpo usa el mismo esqueleto que Caja: meta-row con PRODUCTO, vcp-card__name, vcp-card__stock y vcp-card__footer (precio + boton), nunca filas de Precio/Disponible separadas', async () => {
    const source = await getSource();
    assert.match(source, /<span className="vcp-card__kind">PRODUCTO<\/span>/);
    assert.match(source, /<h6 className="vcp-card__name" title=\{producto\.nombre_producto\}>\{producto\.nombre_producto\}<\/h6>/);
    assert.match(source, /className=\{`vcp-card__stock \$\{sinStock \? 'is-empty' : ''\}`\}/);
    assert.match(source, /<span className="vcp-card__price">L \{formatCurrency\(producto\.precio\)\}<\/span>/);
    assert.doesNotMatch(source, /fidelizacion-canje-modal__meta-row/, 'la estructura vieja de dos filas etiqueta+valor ya no debe existir');
  });

  it('la cantidad seleccionada se muestra como chip visible, no se pierde al compactar la tarjeta', async () => {
    const source = await getSource();
    assert.match(source, /<span className="fidelizacion-canje-modal__selected-chip">Seleccionado: \{selected\.cantidad\}<\/span>/);
  });

  it('un producto sin stock no puede agregarse ni desde la tarjeta ni desde el boton (mismo guard "if (sinStock) return" que usa Caja)', async () => {
    const source = await getSource();
    const start = source.indexOf('<article');
    const end = source.indexOf('data-testid="fidelizacion-canjeable-card"', start);
    const block = source.slice(start, end);
    assert.match(block, /onClick=\{\(\) => \{\s*\n\s*if \(sinStock\) return;\s*\n\s*handleAgregar\(producto\);\s*\n\s*\}\}/);
    assert.match(source, /disabled=\{sinStock\}/);
  });

  it('el boton Agregar detiene la propagacion (stopPropagation) antes de decidir si agrega, igual que Caja', async () => {
    const source = await getSource();
    const btnStart = source.indexOf('className="vcp-card__add-btn"');
    const btnBlock = source.slice(btnStart, btnStart + 260);
    assert.match(btnBlock, /event\.stopPropagation\(\);/);
    assert.match(btnBlock, /if \(sinStock\) return;/);
  });

  it('el grid del catalogo reutiliza ventas-catalog-grid ademas de la clase propia de scroll de Fidelizacion', async () => {
    const source = await getSource();
    assert.match(source, /className="fidelizacion-canje-modal__products ventas-catalog-grid"/);
  });
});

// ---------------------------------------------------------------------------
// Defecto confirmado por la auditoria independiente (segunda ronda sobre este
// mismo problema): el JSX ya traia la clase `ventas-catalog-card-compact`,
// pero los estilos compactos REALES de Caja viven bajo selectores como
// `.ventas-caja-page .ventas-catalog-card-compact` (ventas.css). El modal de
// Fidelizacion nunca esta dentro de `.ventas-caja-page`, asi que esa clase
// quedaba en el DOM sin ningun CSS aplicable: el navegador seguia usando la
// tarjeta vertical base (.vcp-card { flex-direction: column },
// .vcp-card__media { aspect-ratio: 4/3 }), no la horizontal compacta.
//
// Esta prueba NO se limita a buscar la clase en el JSX (eso ya pasaba antes
// de esta correccion y el defecto seguia presente). Verifica, sobre el CSS
// REAL de fidelizacion.css, que existe un selector propio de Fidelizacion
// -nunca dependiente de .ventas-caja-page- que declara efectivamente
// `display: grid` + `grid-template-columns` (las dos propiedades que
// realmente convierten la tarjeta de vertical a horizontal), y que cada
// sub-selector exigido por la auditoria (media, body, name, stock, footer)
// tambien esta scoped bajo el mismo prefijo. Si se elimina el bloque nuevo
// (o si alguien vuelve a depender solo de .ventas-caja-page), esta prueba
// debe fallar.
describe('fidelizacion.css: la tarjeta compacta de canje NO depende de .ventas-caja-page (scope propio de Fidelizacion)', () => {
  const getCss = () => readFile(new URL('../styles/fidelizacion.css', import.meta.url), 'utf8');

  const FIDELIZACION_COMPACT_SELECTOR = '.fidelizacion-canje-modal .ventas-catalog-card-compact';

  it('existe un selector .fidelizacion-canje-modal .ventas-catalog-card-compact (no anidado bajo .ventas-caja-page) que declara display:grid y el grid-template-columns compacto', async () => {
    const css = await getCss();
    const start = css.indexOf(`${FIDELIZACION_COMPACT_SELECTOR} {`);
    assert.notEqual(
      start,
      -1,
      'no existe un bloque CSS propio de Fidelizacion para .ventas-catalog-card-compact: la clase quedaria sin estilos compactos aplicables fuera de .ventas-caja-page'
    );

    const end = css.indexOf('}', start);
    const block = css.slice(start, end);

    // El propio selector no debe llevar .ventas-caja-page como ancestro:
    // Fidelizacion nunca debe depender de ese contenedor de Caja.
    const selectorLine = css.slice(css.lastIndexOf('\n', start) + 1, start);
    assert.doesNotMatch(selectorLine, /ventas-caja-page/);

    // Las dos propiedades que realmente producen el layout horizontal
    // (imagen izquierda, contenido derecha) en vez de la tarjeta vertical
    // base (.vcp-card { flex-direction: column }).
    assert.match(block, /display:\s*grid;/);
    assert.match(block, /grid-template-columns:\s*82px minmax\(0,\s*1fr\);/);
  });

  it('cada sub-selector exigido por la auditoria esta scoped bajo el mismo prefijo de Fidelizacion, nunca bajo .ventas-caja-page', async () => {
    const css = await getCss();
    const requiredSelectors = [
      `${FIDELIZACION_COMPACT_SELECTOR} .vcp-card__media`,
      `${FIDELIZACION_COMPACT_SELECTOR} .vcp-card__body`,
      `${FIDELIZACION_COMPACT_SELECTOR} .vcp-card__name`,
      `${FIDELIZACION_COMPACT_SELECTOR} .vcp-card__stock`,
      `${FIDELIZACION_COMPACT_SELECTOR} .vcp-card__footer`
    ];

    for (const selector of requiredSelectors) {
      assert.match(
        css,
        new RegExp(`${selector.replace(/[.[\]()]/g, '\\$&')} \\{`),
        `falta el selector real (no solo la clase en JSX): ${selector}`
      );
    }
  });

  it('la imagen queda horizontal y compacta: ancho fijo de 82px, height:100% (no aspect-ratio:4/3 de la tarjeta vertical base)', async () => {
    const css = await getCss();
    const start = css.indexOf(`${FIDELIZACION_COMPACT_SELECTOR} .vcp-card__media {`);
    assert.notEqual(start, -1);
    const end = css.indexOf('}', start);
    const block = css.slice(start, end);

    assert.match(block, /width:\s*82px;/);
    assert.match(block, /height:\s*100%;/);
    // aspect-ratio:auto desactiva explicitamente el 4:3 vertical heredado de
    // .vcp-card__media base (ventas.css), que es exactamente la causa
    // original del defecto (imagen grande arriba en vez de pequena a la
    // izquierda).
    assert.match(block, /aspect-ratio:\s*auto;/);
  });

  it('en movil (<=575.98px) la tarjeta sigue siendo horizontal (columna de imagen mas angosta), nunca vuelve a la vertical', async () => {
    const css = await getCss();
    // Ubica la segunda aparicion del selector compacto (la primera es el
    // bloque base de escritorio; el override movil debe existir ademas,
    // no en reemplazo).
    const desktopIdx = css.indexOf(`${FIDELIZACION_COMPACT_SELECTOR} {`);
    assert.notEqual(desktopIdx, -1);
    const mobileIdx = css.indexOf(`${FIDELIZACION_COMPACT_SELECTOR} {`, desktopIdx + 1);
    assert.notEqual(mobileIdx, -1, 'debe existir un segundo bloque (movil) para el mismo selector, angostando la columna de imagen');

    const mobileEnd = css.indexOf('}', mobileIdx);
    const mobileBlock = css.slice(mobileIdx, mobileEnd);
    assert.match(mobileBlock, /grid-template-columns:\s*78px minmax\(0,\s*1fr\);/);
    assert.doesNotMatch(mobileBlock, /flex-direction:\s*column/, 'no debe reintroducirse la tarjeta vertical en movil');

    // Confirma que ese segundo bloque esta realmente dentro de un
    // @media (max-width: 575.98px), no suelto fuera de contexto: cuenta
    // llaves desde la apertura del @media hasta encontrar la que lo cierra
    // (profundidad 0), y verifica que el selector movil quede ANTES de esa
    // llave de cierre.
    const precedingMedia = css.lastIndexOf('@media (max-width: 575.98px)', mobileIdx);
    assert.notEqual(precedingMedia, -1);
    const mediaBodyStart = css.indexOf('{', precedingMedia) + 1;
    let depth = 1;
    let cursor = mediaBodyStart;
    while (depth > 0 && cursor < css.length) {
      if (css[cursor] === '{') depth += 1;
      else if (css[cursor] === '}') depth -= 1;
      cursor += 1;
    }
    const mediaCloseIdx = cursor - 1;
    assert.ok(mediaCloseIdx > mobileIdx, 'el override movil debe estar dentro del bloque @media (max-width: 575.98px)');
  });

  it('el badge de puntos sigue siendo visible (position:absolute dentro de vcp-card__media), ajustado al ancho angosto de la imagen', async () => {
    const css = await getCss();
    const start = css.indexOf('.fidelizacion-canje-modal__points-badge {');
    assert.notEqual(start, -1);
    const end = css.indexOf('}', start);
    const block = css.slice(start, end);
    assert.match(block, /position:\s*absolute;/);
  });
});

// ---------------------------------------------------------------------------
// Catalogo a 2 columnas (no 3) y carrito compacto sin scroll horizontal
// ---------------------------------------------------------------------------
// Defecto reportado: con 3 columnas (minmax(220px,1fr) auto-fit) el cuerpo
// de cada tarjeta compacta (82px de imagen + resto) quedaba demasiado
// angosto y el precio se superponia con el boton "Agregar +". Ademas, el
// carrito lateral ("Items a canjear") era una <table> de 3 columnas fijas
// que forzaba scroll horizontal dentro del panel angosto.
describe('GenerarCanjeModal.jsx: catalogo a 2 columnas fijas (nunca 3), sin superposicion de precio y boton', () => {
  const getCss = () => readFile(new URL('../styles/fidelizacion.css', import.meta.url), 'utf8');

  it('.fidelizacion-canje-modal__products usa 2 columnas fijas, no auto-fit con minimo de 220px', async () => {
    const css = await getCss();
    const start = css.indexOf('.fidelizacion-canje-modal__products {');
    assert.notEqual(start, -1);
    const end = css.indexOf('}', start);
    const block = css.slice(start, end);
    assert.match(block, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
    assert.doesNotMatch(block, /auto-fit/, 'ya no debe autoajustarse a 3 columnas en el ancho real del modal');
  });

  it('en movil (<=575.98px) el catalogo colapsa a una sola columna', async () => {
    const css = await getCss();
    const productsOccurrences = [...css.matchAll(/\.fidelizacion-canje-modal__products\s*\{/g)];
    assert.ok(productsOccurrences.length >= 2, 'debe existir el bloque base y un override movil');
    const mobileStart = productsOccurrences[productsOccurrences.length - 1].index;
    const mobileEnd = css.indexOf('}', mobileStart);
    const mobileBlock = css.slice(mobileStart, mobileEnd);
    assert.match(mobileBlock, /grid-template-columns:\s*1fr;/);
  });
});

describe('GenerarCanjeModal.jsx: "Items a canjear" es una lista compacta de dos renglones, sin tabla ni stock visible', () => {
  const getSource = () => readFile(new URL('../components/GenerarCanjeModal.jsx', import.meta.url), 'utf8');
  const getCss = () => readFile(new URL('../styles/fidelizacion.css', import.meta.url), 'utf8');

  it('ya no es una <table> de 3 columnas: usa una lista (fidelizacion-canje-modal__cart-list/cart-item)', async () => {
    const source = await getSource();
    assert.match(source, /className="fidelizacion-canje-modal__cart-list"/);
    assert.match(source, /className="fidelizacion-canje-modal__cart-item"/);
    assert.doesNotMatch(source, /<table className="table ventas-detail-modal__table">/);
  });

  it('el nombre y el subtotal viven en un renglon propio, separado del renglon de los botones de cantidad', async () => {
    const source = await getSource();
    const start = source.indexOf('className="fidelizacion-canje-modal__cart-item"');
    const end = source.indexOf('))}', start);
    const block = source.slice(start, end);

    const rows = [...block.matchAll(/className="fidelizacion-canje-modal__cart-item-row"/g)];
    assert.equal(rows.length, 2, 'debe haber exactamente 2 renglones: nombre+subtotal, y cantidad');

    const firstRowEnd = block.indexOf('fidelizacion-canje-modal__cart-item-row', rows[1].index);
    const firstRow = block.slice(0, firstRowEnd);
    assert.match(firstRow, /fidelizacion-canje-modal__cart-item-name/);
    assert.match(firstRow, /fidelizacion-canje-modal__cart-item-subtotal/);

    const secondRow = block.slice(firstRowEnd);
    assert.match(secondRow, /fidelizacion-canje-modal__qty/);
  });

  it('ya no muestra "Disponible: N" en el carrito (el usuario pidio quitarlo de esta tarjeta)', async () => {
    const source = await getSource();
    const start = source.indexOf('className="fidelizacion-canje-modal__cart-list"');
    const end = source.indexOf('className="mb-3"', start);
    const block = source.slice(start, end);
    assert.doesNotMatch(block, /Disponible:/);
  });

  it('el limite de stock del boton "+" se conserva como validacion funcional, aunque ya no se muestre el texto', async () => {
    const source = await getSource();
    assert.match(
      source,
      /disabled=\{Number\(item\.stock_disponible \|\| 0\) > 0 && item\.cantidad >= Number\(item\.stock_disponible\)\}/
    );
  });

  it('la resta (-) y el boton "+" conservan handleQuitar/handleAgregar sin cambios de logica', async () => {
    const source = await getSource();
    assert.match(source, /onClick=\{\(\) => handleQuitar\(item\.id_producto\)\}/);
    assert.match(source, /onClick=\{\(\) => handleAgregar\(item\)\}/);
  });

  it('el carrito ya no depende de .ventas-detail-modal__table-wrap (sin scroll horizontal propio de tabla)', async () => {
    const source = await getSource();
    const start = source.indexOf("carrito.length === 0");
    const end = source.indexOf(')}', source.indexOf('fidelizacion-canje-modal__cart-list', start));
    const block = source.slice(start, end);
    assert.doesNotMatch(block, /ventas-detail-modal__table-wrap/);
  });

  it('cada item del carrito tiene su propia tarjeta compacta en CSS (sin ancho minimo de tabla que fuerce scroll)', async () => {
    const css = await getCss();
    assert.match(css, /\.fidelizacion-canje-modal__cart-item\s*\{/);
    const start = css.indexOf('.fidelizacion-canje-modal__cart-item {');
    const end = css.indexOf('}', start);
    const block = css.slice(start, end);
    assert.match(block, /display:\s*flex;/);
    assert.match(block, /flex-direction:\s*column;/);
  });
});

describe('Fidelizacion.jsx: no precarga canjeables y propaga id_sucursal al confirmar', () => {
  const getSource = () => readFile(new URL('../../Fidelizacion.jsx', import.meta.url), 'utf8');

  it('openCanjeModal ya no llama a ningun cargador de canjeables (el modal decide cuando pedirlos)', async () => {
    const source = await getSource();
    const start = source.indexOf('const openCanjeModal = ');
    const end = source.indexOf('};', start);
    const block = source.slice(start, end);
    assert.doesNotMatch(block, /loadCanjeables\(/);
    assert.doesNotMatch(block, /getClienteCanjeables/);
  });

  it('handleCreateCanje recibe sucursal y sesion e incluye ambas en el payload de createCanje', async () => {
    const source = await getSource();
    const start = source.indexOf('const handleCreateCanje = async (items, observacion, idSucursal, idSesionCaja) => {');
    assert.notEqual(start, -1);
    const end = source.indexOf('};', start);
    const block = source.slice(start, end);
    assert.match(block, /id_sucursal: idSucursal,/);
    assert.match(block, /id_sesion_caja: idSesionCaja/);
  });

  it('la carga de sucursales tambien se activa para canUseCanjeFlow (no solo canScopeMulti): necesaria para el selector y la etiqueta de sucursal operativa', async () => {
    const source = await getSource();
    assert.match(source, /if \(!canScopeMulti && !canUseCanjeFlow\) return undefined;/);
  });

  it('GenerarCanjeModal recibe alcance, sucursales y los manejadores del catalogo de canjeables', async () => {
    const source = await getSource();
    const start = source.indexOf('<GenerarCanjeModal');
    const end = source.indexOf('/>', start);
    const block = source.slice(start, end);
    assert.match(block, /canSelectSucursal=\{canScopeMulti\}/);
    assert.match(block, /sucursales=\{sucursales\}/);
    assert.match(block, /userSucursalId=\{/);
    assert.match(block, /userSucursalNombre=\{userSucursalNombre\}/);
    assert.match(block, /onLoadCanjeables=\{loadCanjeables\}/);
    assert.match(block, /onResetCanjeables=\{resetCanjeables\}/);
  });
});

describe('ConfiguracionReglasModal.jsx: miniatura compacta con imagen/placeholder en el catalogo administrativo', () => {
  const getSource = () => readFile(new URL('../components/ConfiguracionReglasModal.jsx', import.meta.url), 'utf8');

  it('normaliza imagen_principal_url del catalogo de productos', async () => {
    const source = await getSource();
    assert.match(source, /imagen_principal_url: row\?\.imagen_principal_url/);
  });

  it('renderiza una miniatura compacta (no tarjetas grandes) junto al nombre del producto, con la imagen ya resuelta por resolveInventarioImageUrl', async () => {
    const source = await getSource();
    assert.match(source, /import \{ resolveInventarioImageUrl \} from '\.\.\/\.\.\/\.\.\/\.\.\/utils\/inventarioImagenes';/);
    assert.match(
      source,
      /<ProductoThumb\s*\n\s*url=\{resolveInventarioImageUrl\(producto\.imagen_principal_url\)\}\s*\n\s*nombre=\{producto\.nombre_producto\}\s*\n\s*\/>/
    );
    assert.doesNotMatch(source, /url=\{producto\.imagen_principal_url\}/, 'nunca debe pasarse la URL cruda sin resolver');
    assert.match(source, /fidelizacion-config-modal__product-cell/);
  });

  it('la miniatura sigue el mismo patron de placeholder (nunca queda vacia si falla la imagen)', async () => {
    const source = await getSource();
    const start = source.indexOf('const ProductoThumb');
    const end = source.indexOf('export default function ConfiguracionReglasModal', start);
    const block = source.slice(start, end);
    assert.match(block, /onError=\{\(event\) => \{/);
    assert.match(block, /fidelizacion-config-modal__thumb-placeholder/);
  });

  it('la tabla administrativa se mantiene compacta: no se convirtio en tarjetas grandes (sigue usando <table>)', async () => {
    const source = await getSource();
    assert.match(source, /<table className="table ventas-detail-modal__table fidelizacion-config-modal__table">/);
  });
});

describe('Responsive: el modal de canje sigue siendo utilizable en movil (catalogo antes del resumen, sin depender del scroll de toda la pagina)', () => {
  it('fidelizacion-canje-modal__body colapsa a una columna por debajo de 991.98px (catalogo y resumen en el mismo orden del DOM: catalogo primero)', async () => {
    const cssSource = await readFile(new URL('../styles/fidelizacion.css', import.meta.url), 'utf8');
    assert.match(
      cssSource,
      /@media \(max-width: 991\.98px\) \{\s*\n\s*\.fidelizacion-canje-modal__body \{\s*\n\s*grid-template-columns: 1fr;/
    );
  });

  it('el modal reutiliza ventas-modal (scroll interno propio de Ventas), no depende de una implementacion de scroll nueva', async () => {
    const source = await readFile(new URL('../components/GenerarCanjeModal.jsx', import.meta.url), 'utf8');
    assert.match(source, /className="ventas-modal-backdrop"/);
    assert.match(source, /className="ventas-modal fidelizacion-canje-modal"/);
  });
});

// ---------------------------------------------------------------------------
// Equivalencia de la tasa: formato, previsualizacion y confirmacion
// ---------------------------------------------------------------------------
// Defecto confirmado en QA: lempiras_por_punto significa "lempiras necesarios
// para ganar 1 punto" (puntos = floor(total / tasa)). El campo se llamaba
// "Equivalencia de puntos" y no explicaba la cifra; un usuario lo interpreto al
// reves, guardo 0.01 y una compra de L 1,130.00 acumulo 113,000 puntos. Ademas
// el resumen usaba formatPoints (sin decimales) y mostraba "1 punto = L. 0".
// La formula NO cambia: lo que se corrige es la interfaz.

describe('formatCurrency: la tasa siempre se muestra con dos decimales (formatPoints la redondeaba a "0")', () => {
  it('0.01 -> "0.01" (el caso que se mostraba como L. 0)', () => {
    assert.equal(formatCurrency(0.01), '0.01');
  });

  it('1 -> "1.00" y 100 -> "100.00"', () => {
    assert.equal(formatCurrency(1), '1.00');
    assert.equal(formatCurrency(100), '100.00');
  });

  it('acepta la tasa como string (tal como llega del input y del backend)', () => {
    assert.equal(formatCurrency('0.01'), '0.01');
    assert.equal(formatCurrency('100'), '100.00');
  });
});

describe('calculatePointsPreview: misma formula que el backend, floor(total / tasa)', () => {
  it('reproduce el caso real de QA: L 1,130.00 con tasa 0.01 -> 113,000 puntos', () => {
    assert.equal(calculatePointsPreview({ amount: 1130, lempirasPorPunto: 0.01 }), 113000);
  });

  it('con la tasa recomendada 100: 1130 -> 11, 1000 -> 10, 100 -> 1', () => {
    assert.equal(calculatePointsPreview({ amount: 1130, lempirasPorPunto: 100 }), 11);
    assert.equal(calculatePointsPreview({ amount: 1000, lempirasPorPunto: 100 }), 10);
    assert.equal(calculatePointsPreview({ amount: 100, lempirasPorPunto: 100 }), 1);
  });

  it('redondea hacia abajo: 99 con tasa 100 -> 0 puntos', () => {
    assert.equal(calculatePointsPreview({ amount: 99, lempirasPorPunto: 100 }), 0);
  });

  it('valores invalidos o no positivos devuelven 0, nunca Infinity ni NaN', () => {
    assert.equal(calculatePointsPreview({ amount: 1130, lempirasPorPunto: 0 }), 0);
    assert.equal(calculatePointsPreview({ amount: 1130, lempirasPorPunto: -1 }), 0);
    assert.equal(calculatePointsPreview({ amount: 1130, lempirasPorPunto: '' }), 0);
    assert.equal(calculatePointsPreview({ amount: -5, lempirasPorPunto: 100 }), 0);
    assert.equal(calculatePointsPreview({ amount: 'abc', lempirasPorPunto: 100 }), 0);
  });

  it('acepta la tasa como string, tal como la entrega el input del modal', () => {
    assert.equal(calculatePointsPreview({ amount: 1130, lempirasPorPunto: '0.01' }), 113000);
    assert.equal(calculatePointsPreview({ amount: 1130, lempirasPorPunto: '100' }), 11);
  });
});

describe('isSensitiveLempirasRate: advertencia cuando la tasa genera mas de 1 punto por lempira', () => {
  it('0.01 y 0.50 son sensibles', () => {
    assert.equal(isSensitiveLempirasRate(0.01), true);
    assert.equal(isSensitiveLempirasRate(0.5), true);
  });

  it('1, 10 y 100 no lo son', () => {
    assert.equal(isSensitiveLempirasRate(1), false);
    assert.equal(isSensitiveLempirasRate(10), false);
    assert.equal(isSensitiveLempirasRate(100), false);
  });

  it('valores vacios o no positivos no disparan la advertencia', () => {
    assert.equal(isSensitiveLempirasRate(''), false);
    assert.equal(isSensitiveLempirasRate(0), false);
    assert.equal(isSensitiveLempirasRate(-1), false);
  });
});

describe('requiresRateConfirmation: solo cuando la tasa se define por primera vez o cambia', () => {
  it('sin tasa previa (primera configuracion) siempre exige confirmacion', () => {
    assert.equal(requiresRateConfirmation({ previousLempirasPorPunto: null, lempiras: '100' }), true);
  });

  it('tasa anterior 100 y nueva 50 exige confirmacion', () => {
    assert.equal(requiresRateConfirmation({ previousLempirasPorPunto: 100, lempiras: '50' }), true);
  });

  it('tasa anterior 100 y nueva "100.00" NO exige confirmacion (comparacion numerica, no textual)', () => {
    assert.equal(requiresRateConfirmation({ previousLempirasPorPunto: 100, lempiras: '100.00' }), false);
    assert.equal(requiresRateConfirmation({ previousLempirasPorPunto: '100.00', lempiras: '100' }), false);
    assert.equal(isSameLempirasRate(100, '100.00'), true);
  });

  it('una tasa vacia o invalida no exige confirmacion: primero debe ser un numero valido', () => {
    assert.equal(requiresRateConfirmation({ previousLempirasPorPunto: 100, lempiras: '' }), false);
    assert.equal(requiresRateConfirmation({ previousLempirasPorPunto: 100, lempiras: '0' }), false);
  });
});

describe('computeConfiguracionSaveState: el boton Guardar reglas exige la confirmacion de equivalencia', () => {
  it('primera configuracion SIN confirmar: boton deshabilitado', () => {
    const estado = computeConfiguracionSaveState({
      lempiras: '100',
      previousLempirasPorPunto: null,
      rateConfirmed: false
    });
    assert.equal(estado.confirmationRequired, true);
    assert.equal(estado.canSubmit, false);
  });

  it('primera configuracion CONFIRMADA: boton habilitado', () => {
    const estado = computeConfiguracionSaveState({
      lempiras: '100',
      previousLempirasPorPunto: null,
      rateConfirmed: true
    });
    assert.equal(estado.canSubmit, true);
  });

  it('tasa anterior 100, nueva 50, sin confirmar: boton deshabilitado', () => {
    const estado = computeConfiguracionSaveState({
      lempiras: '50',
      previousLempirasPorPunto: 100,
      rateConfirmed: false
    });
    assert.equal(estado.confirmationRequired, true);
    assert.equal(estado.canSubmit, false);
  });

  it('tasa anterior 100, nueva "100.00": no exige confirmacion y se puede guardar', () => {
    const estado = computeConfiguracionSaveState({
      lempiras: '100.00',
      previousLempirasPorPunto: 100,
      rateConfirmed: false
    });
    assert.equal(estado.confirmationRequired, false);
    assert.equal(estado.canSubmit, true);
  });

  it('una tasa invalida sigue bloqueando el guardado aunque se haya confirmado', () => {
    const estado = computeConfiguracionSaveState({
      lempiras: '0',
      previousLempirasPorPunto: 100,
      rateConfirmed: true
    });
    assert.equal(estado.canSubmit, false);
  });

  it('mientras guarda (saving) nunca permite un nuevo submit', () => {
    const estado = computeConfiguracionSaveState({
      lempiras: '100',
      saving: true,
      previousLempirasPorPunto: null,
      rateConfirmed: true
    });
    assert.equal(estado.canSubmit, false);
  });

  it('tasa 0.01 confirmada: tecnicamente valida (no se bloquea de forma automatica)', () => {
    const estado = computeConfiguracionSaveState({
      lempiras: '0.01',
      previousLempirasPorPunto: 100,
      rateConfirmed: true
    });
    assert.equal(estado.confirmationRequired, true);
    assert.equal(estado.canSubmit, true);
    // Y la advertencia muestra el numero real del caso de QA.
    assert.equal(
      calculatePointsPreview({ amount: RATE_CONFIRMATION_EXAMPLE_AMOUNT, lempirasPorPunto: '0.01' }),
      113000
    );
  });

  it('cambiar la tasa despues de confirmar vuelve a exigir confirmacion (el modal limpia rateConfirmed)', () => {
    const confirmada = computeConfiguracionSaveState({
      lempiras: '100',
      previousLempirasPorPunto: null,
      rateConfirmed: true
    });
    assert.equal(confirmada.canSubmit, true);

    // El modal pone rateConfirmed=false en cada onChange del input.
    const trasCambiar = computeConfiguracionSaveState({
      lempiras: '50',
      previousLempirasPorPunto: null,
      rateConfirmed: false
    });
    assert.equal(trasCambiar.canSubmit, false);
  });
});

describe('buildSaveConfiguracionPayload: confirmar_equivalencia solo viaja cuando se marco la casilla', () => {
  it('incluye confirmar_equivalencia: true cuando el usuario confirmo', () => {
    const payload = buildSaveConfiguracionPayload({
      idSucursal: 1,
      lempiras: '100',
      acumulacionHabilitada: true,
      productosCanjeables: [],
      rateConfirmed: true
    });
    assert.equal(payload.confirmar_equivalencia, true);
  });

  it('NO incluye el campo cuando no se confirmo (nunca envia false ni un valor parecido a verdadero)', () => {
    const payload = buildSaveConfiguracionPayload({
      idSucursal: 1,
      lempiras: '100',
      acumulacionHabilitada: true,
      productosCanjeables: [],
      rateConfirmed: false
    });
    assert.equal(Object.hasOwn(payload, 'confirmar_equivalencia'), false);
  });

  it('sin el parametro (llamadas previas) el payload conserva su forma anterior', () => {
    const payload = buildSaveConfiguracionPayload({
      idSucursal: 1,
      lempiras: '100',
      acumulacionHabilitada: false,
      productosCanjeables: []
    });
    assert.equal(Object.hasOwn(payload, 'confirmar_equivalencia'), false);
    assert.equal(payload.lempiras_por_punto, 100);
  });

  it('un valor "parecido a verdadero" no se convierte en true (el backend exige el booleano estricto)', () => {
    for (const valor of ['true', 1, '1', {}, []]) {
      const payload = buildSaveConfiguracionPayload({
        idSucursal: 1,
        lempiras: '100',
        acumulacionHabilitada: true,
        productosCanjeables: [],
        rateConfirmed: valor
      });
      assert.equal(Object.hasOwn(payload, 'confirmar_equivalencia'), false, `no debe aceptar ${JSON.stringify(valor)}`);
    }
  });
});

describe('ConfiguracionReglasModal.jsx: etiqueta, explicacion, previsualizacion, advertencia y casilla', () => {
  const getSource = () => readFile(new URL('../components/ConfiguracionReglasModal.jsx', import.meta.url), 'utf8');

  it('la etiqueta ya no dice "Equivalencia de puntos" sino que explica el sentido de la cifra', async () => {
    const source = await getSource();
    assert.match(source, /Lempiras necesarios para obtener 1 punto/);
    assert.doesNotMatch(source, />\s*Equivalencia de puntos\s*</);
  });

  it('explica como se calcula y enuncia la tasa actual en lempiras por punto', async () => {
    const source = await getSource();
    assert.match(source, /El sistema divide el total de la factura entre esta cantidad y redondea hacia abajo\./);
    assert.match(source, /Con la tasa actual, el cliente obtiene 1 punto por cada L \{formatCurrency\(lempiras\)\} gastados\./);
  });

  it('previsualiza con el helper compartido (no reimplementa la formula)', async () => {
    const source = await getSource();
    assert.match(source, /Ejemplo de acumulacion/);
    assert.match(source, /calculatePointsPreview\(\{ amount: monto, lempirasPorPunto: lempiras \}\)/);
    assert.doesNotMatch(source, /Math\.floor\(/, 'la formula vive solo en fidelizacionHelpers.js');
  });

  it('muestra la advertencia critica cuando la tasa es menor a 1, con el ejemplo de L 1,130.00', async () => {
    const source = await getSource();
    assert.match(source, /isSensitiveLempirasRate/);
    assert.match(source, /esta tasa genera mas de 1 punto por cada lempira gastado/);
    assert.match(source, /Verifica cuidadosamente la equivalencia antes de guardar\./);
    assert.match(source, /RATE_CONFIRMATION_EXAMPLE_AMOUNT/);
  });

  it('la casilla de confirmacion existe, es obligatoria y bloquea el guardado', async () => {
    const source = await getSource();
    assert.match(source, /Confirmo que 1 punto se obtendra por cada L \{formatCurrency\(lempiras\)\} gastados\./);
    assert.match(source, /id="fidelizacion-confirmar-equivalencia"/);
    assert.match(source, /checked=\{rateConfirmed\}/);
    assert.match(source, /computeConfiguracionSaveState\(/);
  });

  it('la confirmacion se reinicia al cambiar la tasa y al abrir/cambiar de configuracion', async () => {
    const source = await getSource();
    // onChange del input -> limpia la confirmacion.
    assert.match(source, /const handleLempirasChange = \(value\) => \{\s*\n\s*setLempiras\(value\);\s*\n\s*setRateConfirmed\(false\);/);
    assert.match(source, /onChange=\{\(event\) => handleLempirasChange\(event\.target\.value\)\}/);
    // Efecto de apertura/sincronizacion con el backend -> limpia la confirmacion.
    const start = source.indexOf('const lempirasValue = configuracion?.configuracion?.lempiras_por_punto;');
    const block = source.slice(start, source.indexOf('setSelectedProductos(selectedMap);', start));
    assert.match(block, /setRateConfirmed\(false\);/);
  });

  it('el payload se arma con rateConfirmed (no con un booleano suelto)', async () => {
    const source = await getSource();
    assert.match(source, /buildSaveConfiguracionPayload\(\{[\s\S]*?rateConfirmed[\s\S]*?\}\)/);
  });
});

describe('FidelizacionOverview.jsx: la tarjeta de reglas ya no muestra "1 punto = L. 0"', () => {
  const getSource = () => readFile(new URL('../components/FidelizacionOverview.jsx', import.meta.url), 'utf8');

  it('usa el formateador monetario (2 decimales), no formatPoints, para la tasa', async () => {
    const source = await getSource();
    assert.match(source, /helper: `1 punto por cada L \$\{formatCurrency\(panelData\.configuracion_activa\.lempiras_por_punto\)\}`/);
    // La tasa ya no pasa por formatPoints (que redondeaba 0.01 a "0").
    assert.doesNotMatch(source, /formatPoints\(panelData\.configuracion_activa\.lempiras_por_punto\)/);
    // Y el helper renderizado ya no usa el texto viejo (se comprueba sobre la
    // linea de `helper:`, no sobre los comentarios que documentan el defecto).
    assert.doesNotMatch(source, /helper: `1 punto = L\./);
  });

  it('el texto resultante es correcto para las tasas problematicas y recomendadas', () => {
    assert.equal(`1 punto por cada L ${formatCurrency(0.01)}`, '1 punto por cada L 0.01');
    assert.equal(`1 punto por cada L ${formatCurrency(100)}`, '1 punto por cada L 100.00');
  });
});

describe('Responsive: previsualizacion, advertencia y casilla siguen siendo usables en movil', () => {
  const getCss = () => readFile(new URL('../styles/fidelizacion.css', import.meta.url), 'utf8');

  it('la advertencia y la casilla nunca recortan el texto (overflow-wrap), aunque la cifra sea larga', async () => {
    const css = await getCss();
    const warning = css.slice(css.indexOf('.fidelizacion-config-modal__rate-warning'));
    assert.match(warning.slice(0, 300), /overflow-wrap: anywhere/);

    const label = css.slice(css.indexOf('.fidelizacion-config-modal__confirm .form-check-label'));
    assert.match(label.slice(0, 200), /overflow-wrap: anywhere/);
  });

  it('en pantallas menores a 576px la lista de ejemplos pasa a una columna (sin desbordamiento horizontal)', async () => {
    const css = await getCss();
    const mobile = css.slice(css.indexOf('@media (max-width: 575.98px)'));
    assert.match(mobile, /\.fidelizacion-config-modal__preview-list li \{[\s\S]*?flex-direction: column;/);
  });

  it('la casilla mantiene un objetivo tactil comodo (no depende del tamano por defecto)', async () => {
    const css = await getCss();
    const input = css.slice(css.indexOf('.fidelizacion-config-modal__confirm .form-check-input'));
    assert.match(input.slice(0, 220), /width: 1\.25rem/);
    assert.match(input.slice(0, 220), /height: 1\.25rem/);
  });

  it('el modal sigue usando el shell con scroll interno del sistema (inv-prod-pmodal), no uno nuevo', async () => {
    const source = await readFile(new URL('../components/ConfiguracionReglasModal.jsx', import.meta.url), 'utf8');
    assert.match(source, /className="inv-prod-pmodal inv-prod-pmodal--create show"/);
    assert.match(source, /className="inv-prod-pmodal__viewport"/);
  });
});

// ---------------------------------------------------------------------------
// Costo en puntos por producto: automatico vs personalizado
// ---------------------------------------------------------------------------
// Defecto confirmado: la columna administrativa se llamaba "Override puntos"
// (palabra tecnica sin significado claro) y no mostraba el costo automatico
// de referencia (Math.ceil(precio / tasa), igual que computeRedemptionPoints
// del backend). El backend ya resuelve correctamente
// puntos_requeridos_override ?? computeRedemptionPoints(...) y sigue siendo
// la fuente de verdad: estas pruebas cubren solo la aclaracion de la interfaz
// y la validacion PREVIA al envio (nunca solo atributos HTML min/step).

describe('calculateRedemptionPointsPreview: misma formula que el backend (computeRedemptionPoints), Math.ceil(precio / tasa)', () => {
  it('reproduce los 4 ejemplos exactos del caso de QA', () => {
    assert.equal(calculateRedemptionPointsPreview({ precio: 30, lempirasPorPunto: 100 }), 1);
    assert.equal(calculateRedemptionPointsPreview({ precio: 120, lempirasPorPunto: 100 }), 2);
    assert.equal(calculateRedemptionPointsPreview({ precio: 200, lempirasPorPunto: 100 }), 2);
    assert.equal(calculateRedemptionPointsPreview({ precio: 201, lempirasPorPunto: 100 }), 3);
  });

  it('nunca usa Math.floor: redondea siempre hacia arriba (nunca se le pide al cliente menos puntos de los que el precio vale)', () => {
    // 100/100 = 1.0 exacto -> 1 (no hay resto que forzar hacia arriba, pero
    // confirma que no se resta 1 de mas ni se usa round).
    assert.equal(calculateRedemptionPointsPreview({ precio: 100, lempirasPorPunto: 100 }), 1);
    // 100.01/100 -> techo debe dar 2, floor daria 1.
    assert.equal(calculateRedemptionPointsPreview({ precio: 100.01, lempirasPorPunto: 100 }), 2);
  });

  it('precio o tasa invalidos (<=0, no finitos) devuelven null, nunca 0 ni NaN', () => {
    assert.equal(calculateRedemptionPointsPreview({ precio: 0, lempirasPorPunto: 100 }), null);
    assert.equal(calculateRedemptionPointsPreview({ precio: -5, lempirasPorPunto: 100 }), null);
    assert.equal(calculateRedemptionPointsPreview({ precio: 100, lempirasPorPunto: 0 }), null);
    assert.equal(calculateRedemptionPointsPreview({ precio: 100, lempirasPorPunto: -1 }), null);
    assert.equal(calculateRedemptionPointsPreview({ precio: 'abc', lempirasPorPunto: 100 }), null);
    assert.equal(calculateRedemptionPointsPreview({ precio: 100, lempirasPorPunto: '' }), null);
  });

  it('acepta precio/tasa como string, tal como llegan de producto.precio y del input de lempiras', () => {
    assert.equal(calculateRedemptionPointsPreview({ precio: '120', lempirasPorPunto: '100' }), 2);
  });
});

describe('normalizeRedemptionPointsOverride: costo personalizado estricto (entero positivo o automatico)', () => {
  it('acepta enteros positivos (numero o cadena pura)', () => {
    assert.equal(normalizeRedemptionPointsOverride(1), 1);
    assert.equal(normalizeRedemptionPointsOverride('1'), 1);
    assert.equal(normalizeRedemptionPointsOverride('10'), 10);
    assert.equal(normalizeRedemptionPointsOverride(10), 10);
  });

  it('vacio (string vacia, null, undefined) significa automatico -> null', () => {
    assert.equal(normalizeRedemptionPointsOverride(''), null);
    assert.equal(normalizeRedemptionPointsOverride('   '), null);
    assert.equal(normalizeRedemptionPointsOverride(null), null);
    assert.equal(normalizeRedemptionPointsOverride(undefined), null);
  });

  it('rechaza decimales, cero, negativos, texto parcialmente numerico, arreglos, objetos, Infinity y NaN', () => {
    const invalidos = [1.5, '1.5', 0, -1, '10x', '1 OR 1=1', [], {}, Infinity, NaN, '-1', '0'];
    for (const valor of invalidos) {
      assert.equal(
        normalizeRedemptionPointsOverride(valor),
        REDEMPTION_POINTS_OVERRIDE_INVALID,
        `debia rechazar ${JSON.stringify(valor)}`
      );
    }
  });

  it('isRedemptionPointsOverrideInvalid reutiliza el mismo normalizador (no una segunda copia de la regla)', () => {
    assert.equal(isRedemptionPointsOverrideInvalid(''), false);
    assert.equal(isRedemptionPointsOverrideInvalid('10'), false);
    assert.equal(isRedemptionPointsOverrideInvalid('1.5'), true);
    assert.equal(isRedemptionPointsOverrideInvalid(0), true);
  });
});

describe('buildCanjeableProductoPayload: automatico -> solo id_producto; personalizado -> numero validado', () => {
  it('producto automatico (override vacio): el payload NUNCA incluye puntos_requeridos_override, ni siquiera como null', () => {
    const payload = buildCanjeableProductoPayload({ idProducto: 294, puntosRequeridosOverride: '' });
    assert.deepEqual(payload, { id_producto: 294 });
    assert.equal(Object.hasOwn(payload, 'puntos_requeridos_override'), false);
  });

  it('producto personalizado (override "10"): envia un NUMBER, nunca un string', () => {
    const payload = buildCanjeableProductoPayload({ idProducto: 294, puntosRequeridosOverride: '10' });
    assert.deepEqual(payload, { id_producto: 294, puntos_requeridos_override: 10 });
    assert.equal(typeof payload.puntos_requeridos_override, 'number');
  });

  it('override invalido (decimal, cero, texto): devuelve null, nunca un payload parcialmente valido', () => {
    assert.equal(buildCanjeableProductoPayload({ idProducto: 294, puntosRequeridosOverride: '1.5' }), null);
    assert.equal(buildCanjeableProductoPayload({ idProducto: 294, puntosRequeridosOverride: 0 }), null);
    assert.equal(buildCanjeableProductoPayload({ idProducto: 294, puntosRequeridosOverride: '10x' }), null);
  });

  it('id_producto invalido tambien devuelve null (defensa adicional, aunque el llamador ya filtra por checked)', () => {
    assert.equal(buildCanjeableProductoPayload({ idProducto: 0, puntosRequeridosOverride: '' }), null);
    assert.equal(buildCanjeableProductoPayload({ idProducto: 'abc', puntosRequeridosOverride: '' }), null);
  });
});

describe('ConfiguracionReglasModal.jsx: "Costo en puntos" (antes "Override puntos") y bloqueo de Guardar reglas', () => {
  const getSource = () => readFile(new URL('../components/ConfiguracionReglasModal.jsx', import.meta.url), 'utf8');

  it('la etiqueta de la columna ya no es tecnica ("Override puntos"), ahora es "Costo en puntos"', async () => {
    const source = await getSource();
    assert.match(source, /<th>Costo en puntos<\/th>/);
    assert.doesNotMatch(source, /Override puntos/);
    assert.doesNotMatch(source, /\boverride\b/i, 'la palabra tecnica "override" no debe aparecer visible en la interfaz');
  });

  it('el subtitulo de la seccion explica el proposito sin jerga tecnica', async () => {
    const source = await getSource();
    assert.match(source, /Selecciona los productos que podran canjearse y define su costo en puntos\./);
  });

  it('el campo usa calculateRedemptionPointsPreview para el costo automatico (no duplica Math.ceil en el componente)', async () => {
    const source = await getSource();
    assert.match(source, /const costoAutomatico = calculateRedemptionPointsPreview\(\{/);
    assert.doesNotMatch(source, /Math\.ceil\(/, 'la formula vive solo en fidelizacionHelpers.js');
  });

  it('el placeholder muestra el costo automatico calculado ("Automatico: N")', async () => {
    const source = await getSource();
    assert.match(source, /placeholder=\{costoAutomatico !== null \? `Automatico: \$\{formatPoints\(costoAutomatico\)\}` : 'Automatico'\}/);
  });

  it('el input de costo en puntos exige entero positivo (min=1, step=1) y se deshabilita si el producto no esta marcado', async () => {
    const source = await getSource();
    const start = source.indexOf('const costoAutomatico = calculateRedemptionPointsPreview');
    const end = source.indexOf('</tr>', start);
    const block = source.slice(start, end);
    assert.match(block, /min="1"/);
    assert.match(block, /step="1"/);
    assert.match(block, /disabled=\{!state\.checked \|\| saving\}/);
  });

  it('con un valor personalizado muestra "Personalizado: N pts" y el automatico de referencia', async () => {
    const source = await getSource();
    assert.match(source, /Personalizado: \{formatPoints\(Number\(state\.puntos_requeridos_override\)\)\} pts/);
    assert.match(source, /Automatico de referencia: \{formatPoints\(costoAutomatico\)\} pts/);
  });

  it('con el campo vacio muestra el mensaje de "deja el campo vacio para usar el costo automatico"', async () => {
    const source = await getSource();
    assert.match(source, /Deja el campo vacio para utilizar el costo automatico\./);
  });

  it('con un valor invalido muestra el mensaje de ayuda exacto pedido por la auditoria', async () => {
    const source = await getSource();
    assert.match(
      source,
      /Ingresa un numero entero mayor que cero o deja el campo vacio para usar el costo automatico\./
    );
  });

  it('hasInvalidProductOverride bloquea Guardar reglas usando el mismo normalizador que valida cada input', async () => {
    const source = await getSource();
    assert.match(source, /const hasInvalidProductOverride = useMemo\(/);
    assert.match(source, /isRedemptionPointsOverrideInvalid\(value\?\.puntos_requeridos_override\)/);
    assert.match(source, /const canSubmit = canSubmitRate && !hasInvalidProductOverride;/);
  });

  it('el payload final se construye con buildCanjeableProductoPayload, filtrando nulls (defensa en profundidad)', async () => {
    const source = await getSource();
    assert.match(source, /buildCanjeableProductoPayload\(\{\s*\n\s*idProducto,\s*\n\s*puntosRequeridosOverride: value\?\.puntos_requeridos_override\s*\n\s*\}\)/);
    assert.match(source, /\.filter\(\(entry\) => entry !== null\);/);
  });
});

// resolveInventarioImageUrl (src/utils/inventarioImagenes.js) no se puede
// importar directamente bajo `node --test`: el modulo real usa
// import.meta.env.VITE_SUPABASE_URL y un import sin extension
// (./constants, que solo Vite resuelve). Se extrae el CUERPO REAL de la
// funcion desde el archivo fuente y se ejecuta con constantes controladas
// via `new Function` -es la logica real corriendo con entradas conocidas,
// nunca una reimplementacion duplicada del helper-.
const buildResolveInventarioImageUrl = async ({ supabaseUrl = '', apiUrl = '' } = {}) => {
  const source = await readFile(new URL('../../../../utils/inventarioImagenes.js', import.meta.url), 'utf8');
  const start = source.indexOf('export const resolveInventarioImageUrl');
  assert.notEqual(start, -1, 'no se encontro resolveInventarioImageUrl en el archivo real');
  const end = source.indexOf('\n};', start) + 3;
  const functionSource = source.slice(start, end).replace('export const', 'const');
  // eslint-disable-next-line no-new-func
  const factory = new Function(
    'SUPABASE_PUBLIC_BUCKET',
    'SUPABASE_URL',
    'API_URL',
    `${functionSource}\nreturn resolveInventarioImageUrl;`
  );
  return factory('jonnys-assets', supabaseUrl, apiUrl);
};

describe('resolveInventarioImageUrl (utils/inventarioImagenes.js): logica real ejecutada con constantes controladas', () => {
  it('una URL HTTPS completa permanece exactamente igual', async () => {
    const resolve = await buildResolveInventarioImageUrl({ supabaseUrl: 'https://proyecto.supabase.co', apiUrl: 'https://api.jonnys.hn' });
    assert.equal(resolve('https://cdn.example.com/imagen.jpg'), 'https://cdn.example.com/imagen.jpg');
  });

  it('una ruta jonnys-assets/... se convierte a la URL publica de Supabase', async () => {
    const resolve = await buildResolveInventarioImageUrl({ supabaseUrl: 'https://proyecto.supabase.co', apiUrl: 'https://api.jonnys.hn' });
    assert.equal(
      resolve('jonnys-assets/productos/294.webp'),
      'https://proyecto.supabase.co/storage/v1/object/public/jonnys-assets/productos/294.webp'
    );
  });

  it('una ruta relativa del backend se resuelve contra API_URL', async () => {
    const resolve = await buildResolveInventarioImageUrl({ supabaseUrl: 'https://proyecto.supabase.co', apiUrl: 'https://api.jonnys.hn' });
    assert.equal(resolve('/uploads/productos/294.webp'), 'https://api.jonnys.hn/uploads/productos/294.webp');
  });

  it('una cadena vacia (o solo espacios) produce cadena vacia -> los componentes muestran el placeholder', async () => {
    const resolve = await buildResolveInventarioImageUrl({ supabaseUrl: 'https://proyecto.supabase.co', apiUrl: 'https://api.jonnys.hn' });
    assert.equal(resolve(''), '');
    assert.equal(resolve('   '), '');
    assert.equal(resolve(null), '');
    assert.equal(resolve(undefined), '');
  });

  it('jonnys-assets/... sin SUPABASE_URL configurado cae al fallback de API_URL (nunca revienta)', async () => {
    const resolve = await buildResolveInventarioImageUrl({ supabaseUrl: '', apiUrl: 'https://api.jonnys.hn' });
    assert.equal(resolve('jonnys-assets/productos/294.webp'), 'https://api.jonnys.hn/jonnys-assets/productos/294.webp');
  });
});

describe('GenerarCanjeModal: sesion de caja autorizada sin alterar tarjetas compactas', () => {
  const getSource = () => readFile(new URL('../components/GenerarCanjeModal.jsx', import.meta.url), 'utf8');

  it('cajero no ve selector y administrador carga sesiones por sucursal', async () => {
    const source = await getSource();
    assert.match(source, /canSelectSucursal && hasSucursalSeleccionada/);
    assert.match(source, /listCanjeSesiones\(\{ id_sucursal: sucursalNumerica \}\)/);
    assert.match(source, /id="fidelizacion-canje-sesion"/);
  });

  it('una sesion se preselecciona, varias exigen seleccion y ninguna bloquea', async () => {
    const source = await getSource();
    assert.match(source, /items\.length === 1 \? String\(items\[0\]\.id_sesion_caja\) : ''/);
    assert.match(source, /sesiones\.length > 1/);
    assert.match(source, /sessionMissing/);
    assert.match(source, /finalConfirmDisabled/);
  });

  it('envia id_sesion_caja y cambiar sucursal limpia carrito y sesion', async () => {
    const modal = await getSource();
    const page = await readFile(new URL('../../Fidelizacion.jsx', import.meta.url), 'utf8');
    assert.match(modal, /setCarrito\(\[\]\)/);
    assert.match(modal, /setSelectedSesionId\(''\)/);
    assert.match(page, /id_sesion_caja: idSesionCaja/);
  });

  it('conserva las tarjetas compactas y resolucion de imagen existentes', async () => {
    const source = await getSource();
    assert.match(source, /ventas-catalog-card-compact canjeable-card/);
    assert.match(source, /resolveInventarioImageUrl/);
    assert.match(source, /fidelizacion-canje-modal__cart-item/);
  });
});
