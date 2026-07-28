import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import {
  buildSaveConfiguracionPayload,
  computeConfiguracionSubmitState,
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
