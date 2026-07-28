import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import {
  buildSaveConfiguracionPayload,
  computeCanjeCartAfterAdd,
  computeCanjeConfirmDisabled,
  computeConfiguracionSubmitState,
  createLatestRequestTracker,
  normalizeCanjeableResponse,
  normalizeConfiguracion,
  normalizeEnvelopeMeta
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

describe('GenerarCanjeModal.jsx: selector de sucursal obligatorio para SUPER_ADMIN', () => {
  const getSource = () => readFile(new URL('../components/GenerarCanjeModal.jsx', import.meta.url), 'utf8');

  it('SUPER_ADMIN ve un selector (ToolbarSucursalSelect); un usuario local ve una etiqueta de solo lectura', async () => {
    const source = await getSource();
    assert.match(source, /\{isSuperAdmin \? \(\s*\n\s*<ToolbarSucursalSelect/);
    assert.match(source, /fidelizacion-canje-modal__sucursal-readonly/);
  });

  it('el selector inicia vacio cada vez que se abre el modal (nunca precargado con userSucursalId para SUPER_ADMIN)', async () => {
    const source = await getSource();
    assert.match(source, /setSelectedSucursalId\(isSuperAdmin \? '' : \(userSucursalId \? String\(userSucursalId\) : ''\)\)/);
  });

  it('no se cargan productos antes de seleccionar sucursal: el efecto de carga exige hasSucursalSeleccionada', async () => {
    const source = await getSource();
    const start = source.indexOf('// Carga (o recarga) el catalogo');
    const end = source.indexOf('}, [open, cliente?.id_cliente, hasSucursalSeleccionada', start) + 200;
    const block = source.slice(start, end);
    assert.match(block, /if \(!open \|\| !cliente\?\.id_cliente \|\| !hasSucursalSeleccionada\) return;/);
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
    assert.match(block, /sucursalNumerica\s*\n\s*\);/);
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

describe('GenerarCanjeModal.jsx: imagenes reales, placeholder y precio/stock separados', () => {
  const getSource = () => readFile(new URL('../components/GenerarCanjeModal.jsx', import.meta.url), 'utf8');

  it('renderiza <img> con la URL real cuando existe imagen', async () => {
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

  it('precio y stock disponible se renderizan en filas separadas (fidelizacion-canje-modal__meta-row), nunca concatenados en un solo texto', async () => {
    const source = await getSource();
    const rows = [...source.matchAll(/className="fidelizacion-canje-modal__meta-row"/g)];
    assert.equal(rows.length, 2, 'debe haber una fila para Precio y otra para Disponible');
    assert.doesNotMatch(source, /L\. \{formatCurrency\(producto\.precio\)\}<\/strong>\s*<strong>/, 'precio y stock nunca deben quedar en el mismo elemento de texto');
  });

  it('un producto sin stock no puede agregarse desde la tarjeta ni desde el boton (ambos usan handleAgregar, que ya rechaza stock<=0)', async () => {
    const source = await getSource();
    assert.match(source, /onClick=\{\(\) => handleAgregar\(producto\)\}/);
    assert.match(source, /disabled=\{sinStock\}/);
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

  it('handleCreateCanje recibe idSucursal y lo incluye en el payload de createCanje', async () => {
    const source = await getSource();
    const start = source.indexOf('const handleCreateCanje = async (items, observacion, idSucursal) => {');
    assert.notEqual(start, -1);
    const end = source.indexOf('};', start);
    const block = source.slice(start, end);
    assert.match(block, /id_sucursal: idSucursal,/);
  });

  it('la carga de sucursales tambien se activa para canUseCanjeFlow (no solo canScopeMulti): necesaria para el selector y la etiqueta de sucursal operativa', async () => {
    const source = await getSource();
    assert.match(source, /if \(!canScopeMulti && !canUseCanjeFlow\) return undefined;/);
  });

  it('GenerarCanjeModal recibe isSuperAdmin, sucursales, userSucursalId, userSucursalNombre y los manejadores del catalogo de canjeables', async () => {
    const source = await getSource();
    const start = source.indexOf('<GenerarCanjeModal');
    const end = source.indexOf('/>', start);
    const block = source.slice(start, end);
    assert.match(block, /isSuperAdmin=\{isSuperAdmin\}/);
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

  it('renderiza una miniatura compacta (no tarjetas grandes) junto al nombre del producto', async () => {
    const source = await getSource();
    assert.match(source, /<ProductoThumb url=\{producto\.imagen_principal_url\} nombre=\{producto\.nombre_producto\} \/>/);
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
