import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const read = (relative) => readFile(new URL(relative, import.meta.url), 'utf8');

test('servicio usa exclusivamente endpoints nuevos autorizados', async () => {
  const source = await read('../../../../services/solicitudesCompraService.js');
  assert.match(source, /\/solicitudes_compra\/catalogo/);
  assert.match(source, /crearSolicitud:[\s\S]*\/solicitudes_compra'[\s\S]*'POST'/);
  assert.match(source, /getSolicitudes:[\s\S]*\/solicitudes_compra/);
  assert.match(source, /getSolicitudById:[\s\S]*\/solicitudes_compra\/\$\{/);
  assert.doesNotMatch(source, /orden_compras|detalle_orden_compras|ordenes_compra_workflow|\/compras/);
});
test('query params usan URLSearchParams y omiten vacios', async () => {
  const source = await read('../../../../services/solicitudesCompraService.js');
  assert.match(source, /new URLSearchParams/); assert.match(source, /hasValue/); assert.doesNotMatch(source, /buscar=\$\{/);
});
test('Inventario monta componente nuevo y desconecta componente viejo', async () => {
  const source = await read('../../../../pages/dashboard/Inventario.jsx');
  assert.match(source, /SolicitudesCompraTab/); assert.doesNotMatch(source, /import OrdenesCompraTab/); assert.doesNotMatch(source, /<OrdenesCompraTab/);
});
test('archivo viejo permanece fisicamente', async () => {
  await access(new URL('../../../../pages/dashboard/inventario/OrdenesCompraTab.jsx', import.meta.url));
});
test('permisos controlan consulta, detalle y creacion', async () => {
  const source = await read('../SolicitudesCompraTab.jsx');
  assert.match(source, /VIEW_PERMISSIONS/); assert.match(source, /CREATE_PERMISSIONS/); assert.match(source, /<SinPermiso/); assert.match(source, /canCreate/);
});
test('componentes usan AppSelect para almacen y presentacion', async () => {
  const create = await read('../components/NuevaSolicitudCompra.jsx');
  const catalog = await read('../components/SolicitudCompraCatalogo.jsx');
  assert.match(create, /import AppSelect/); assert.match(create, /<AppSelect/); assert.match(catalog, /import AppSelect/); assert.match(catalog, /<AppSelect/);
  assert.match(create, /<AppSelect label="Almacén"/);
  assert.match(catalog, /<AppSelect label="Tipo"/);
  assert.doesNotMatch(`${create}\n${catalog}`, /<select\b/i);
});

test('AppSelect compartido permanece intacto', async () => {
  const { execFileSync } = await import('node:child_process');
  const path = new URL('../../../../components/common/AppSelect.jsx', import.meta.url);
  const hash = execFileSync('git', ['hash-object', path.pathname.replace(/^\/([A-Za-z]:)/, '$1')], { encoding: 'utf8' }).trim();
  assert.equal(hash, 'a9d55bd685841ce9207dda0ea656d7769a264b99');
});
test('flujo no contiene polling ni modales', async () => {
  const hook = await read('../hooks/useSolicitudesCompra.js');
  const tab = await read('../SolicitudesCompraTab.jsx');
  assert.doesNotMatch(hook, /setInterval|polling/i); assert.doesNotMatch(tab, /modal/i);
});
test('creacion operativa permanece separada de recepcion, evidencia y proveedores', async () => {
  const files = await Promise.all(['../hooks/useSolicitudesCompra.js', '../components/NuevaSolicitudCompra.jsx'].map(read));
  assert.doesNotMatch(files.join('\n'), /factura|createSignedUrl|subir.*imagen|\/recibir|\/evidencias|\/proveedores/i);
});
test('no hay imports Supabase ni credenciales o project IDs', async () => {
  const files = await Promise.all(['../SolicitudesCompraTab.jsx', '../hooks/useSolicitudesCompra.js', '../../../../services/solicitudesCompraService.js'].map(read));
  assert.doesNotMatch(files.join('\n'), /supabase|service_role|project[_-]?id|https?:\/\//i);
});
test('borrador se conserva ante error y doble envio queda bloqueado', async () => {
  const create = await read('../components/NuevaSolicitudCompra.jsx');
  const hook = await read('../hooks/useSolicitudesCompra.js');
  assert.match(create, /conserva el borrador/); assert.match(create, /submitting/); assert.match(hook, /submitLock\.current/);
});

test('catalogo inicia completo y la primera carga no solicita solo stock bajo', async () => {
  const catalog = await read('../components/SolicitudCompraCatalogo.jsx');
  assert.match(catalog, /useState\('all'\)/);
  assert.match(catalog, /loadCatalog\(\{ id_almacen: warehouseId, page: 1 \}\)/);
  assert.doesNotMatch(catalog, /useState\(true\)|solo_stock_bajo:\s*'true',\s*page:\s*1/);
});

test('alcance del catalogo usa opciones accesibles y solo reposicion envia true', async () => {
  const catalog = await read('../components/SolicitudCompraCatalogo.jsx');
  assert.match(catalog, /Todo el catálogo/);
  assert.match(catalog, /Necesitan reposición/);
  assert.match(catalog, /aria-pressed=\{scope === 'all'\}/);
  assert.match(catalog, /aria-pressed=\{scope === 'low'\}/);
  assert.match(catalog, /nextScope === 'low' \? \{ solo_stock_bajo: 'true' \} : \{\}/);
});

test('tipo alcance busqueda y limpiar filtros regresan a pagina uno', async () => {
  const catalog = await read('../components/SolicitudCompraCatalogo.jsx');
  assert.match(catalog, /catalogOptions\(1, \{ type: value \}\)/);
  assert.match(catalog, /catalogOptions\(1, \{ scope: nextScope \}\)/);
  assert.match(catalog, /load\(1\)/);
  assert.match(catalog, /setSearch\(''\);[\s\S]*setType\(''\);[\s\S]*setScope\('all'\)/);
  assert.match(catalog, /catalogOptions\(1, \{ search: '', type: '', scope: 'all' \}\)/);
});

test('cambio de almacen reinicia catalogo y borrador sin mostrar resultados previos', async () => {
  const create = await read('../components/NuevaSolicitudCompra.jsx');
  const catalog = await read('../components/SolicitudCompraCatalogo.jsx');
  assert.match(create, /setWarehouseId\(selected\); setLines\(\[\]\)/);
  assert.match(create, /<SolicitudCompraCatalogo key=\{warehouseId\}/);
  assert.match(catalog, /matchesWarehouse && !state\.loading \? state\.items : \[\]/);
});

test('indicador de pasos representa almacen catalogo y resumen sin ser navegacion', async () => {
  const create = await read('../components/NuevaSolicitudCompra.jsx');
  assert.match(create, /warehouse:\s*warehouseId \? 'is-complete' : 'is-current'/);
  assert.match(create, /catalog:\s*!warehouseId \? 'is-pending' : lines\.length \? 'is-complete' : 'is-current'/);
  assert.match(create, /summary:\s*warehouseId && lines\.length \? 'is-current' : 'is-pending'/);
  assert.match(create, /className=\{stepState\.warehouse\}/);
  assert.match(create, /className=\{stepState\.catalog\}/);
  assert.match(create, /className=\{stepState\.summary\}/);
  const steps = create.match(/<ol className="sol-comp-steps"[\s\S]*?<\/ol>/)?.[0] || '';
  assert.doesNotMatch(steps, /<button\b/);
});

test('frontend conserva exactamente el orden recibido y no filtra disponibles', async () => {
  const catalog = await read('../components/SolicitudCompraCatalogo.jsx');
  assert.match(catalog, /visibleItems\.map/);
  assert.doesNotMatch(catalog, /\.sort\(|estado_stock\s*!==\s*['"]DISPONIBLE|\.filter\([^)]*estado_stock/);
  assert.match(catalog, /sol-comp-stock--\$\{String\(item\.estado_stock\)/);
  assert.match(catalog, /<button type="button" className="btn sol-comp-add-action" onClick=\{add\}>/);
});

test('catalogo conserva badges presentaciones equivalencia y validaciones', async () => {
  const catalog = await read('../components/SolicitudCompraCatalogo.jsx');
  assert.match(catalog, /SIN_STOCK: 'Sin stock'/);
  assert.match(catalog, /STOCK_BAJO: 'Stock bajo'/);
  assert.match(catalog, /DISPONIBLE: 'Disponible'/);
  assert.match(catalog, /import AppSelect/);
  assert.match(catalog, /equivale a/);
  assert.match(catalog, /hasta 4 decimales/);
  assert.match(catalog, /entera positiva/);
});

test('listado conserva acciones y agrega filtro canceladas con aria pressed', async () => {
  const list = await read('../components/SolicitudesCompraListado.jsx');
  assert.match(list, /\['CANCELADA', 'Canceladas'\]/);
  assert.match(list, /aria-pressed=\{filter === filterValue\}/);
  assert.match(list, /'PENDIENTE' \? 'Revisar solicitud'/);
  assert.match(list, /'APROBADA' \? 'Recibir solicitud'/);
  assert.match(list, /: 'Ver detalle'/);
});

test('resumen no contiene datos monetarios y conserva payload actual', async () => {
  const [summary, create] = await Promise.all([
    read('../components/SolicitudCompraResumen.jsx'),
    read('../components/NuevaSolicitudCompra.jsx')
  ]);
  assert.doesNotMatch(summary, /precio|costo|impuesto|subtotal|total monetario/i);
  assert.match(create, /buildSolicitudPayload\(\{ idAlmacen: warehouseId, observacion: observation, detalles: lines \}\)/);
  assert.match(create, /upsertDraftLine\(lines, line\)/);
});

test('css permanece encapsulado y evita recorte u overflow horizontal intencional', async () => {
  const css = await read('../solicitudesCompra.css');
  const selectorBlockOpenings = css
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('@') && line.endsWith('{'));
  assert.ok(selectorBlockOpenings.length > 0);
  assert.ok(
    selectorBlockOpenings.every((selector) => selector.includes('.sol-comp-')),
  );
  assert.doesNotMatch(css, /overflow\s*:\s*hidden/i);
  const horizontalOverflowSelectors = [...css.matchAll(/([^{}]+)\{([^{}]*overflow-x\s*:[^{}]*)\}/gi)]
    .map(([, selectors]) => selectors.trim());
  assert.ok(horizontalOverflowSelectors.every((selectors) => selectors.includes('.sol-comp-filters')));
  const cssRuleBlocks = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const cardsWithFixedHeight = cssRuleBlocks.filter(
    ([, selectors, declarations]) =>
      selectors
        .split(',')
        .map((selector) => selector.trim())
        .some((selector) =>
          /^(?:\.sol-comp-request-card|\.sol-comp-catalog-card|\.sol-comp-detail-lines article)$/.test(
            selector,
          ),
        ) &&
      /(^|[;\s])height\s*:/i.test(declarations),
  );
  assert.deepEqual(cardsWithFixedHeight, []);
  assert.match(css, /\.sol-comp-catalog-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2/);
  assert.match(css, /@media \(max-width: 767px\)/);
  assert.match(css, /@media \(max-width: 479px\)/);
});

test('pulido visual usa tokens institucionales y corrige estructura superior', async () => {
  const css = await read('../solicitudesCompra.css');
  assert.match(css, /--sol-comp-primary:\s*var\(--c-accent\)/);
  assert.doesNotMatch(css, /#0d6efd/i);
  assert.doesNotMatch(css, /max-width:\s*620px/i);
  assert.match(css, /\.sol-comp-meta-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2/);
  assert.match(css, /\.sol-comp-warehouse\s*\{[^}]*grid-template-columns:/);
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.sol-comp-warehouse,[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(css, /\.sol-comp-request-card__footer\s*\{[^}]*border-top:/);
});

test('AppSelect tiene integracion visual completa y scoped', async () => {
  const css = await read('../solicitudesCompra.css');
  const required = [
    'app-select', 'app-select__label', 'app-select__trigger', 'app-select__value',
    'app-select__placeholder', 'app-select__chevron', 'app-select__menu',
    'app-select__search', 'app-select__list', 'app-select__option',
    'app-select__helper'
  ];
  required.forEach((className) => assert.match(css, new RegExp(`\\.sol-comp-section \\.${className.replace('.', '\\.')}`)));
  ['is-open', 'is-disabled', 'has-error'].forEach((state) => {
    assert.match(css, new RegExp(`\\.sol-comp-section \\.app-select\\.${state}`));
  });
  assert.match(css, /\.sol-comp-section \.app-select__option\.is-selected/);
  assert.match(css, /\.sol-comp-section \.app-select__trigger\s*\{[^}]*min-height:\s*44px/);
  assert.match(css, /\.sol-comp-section \.app-select__menu\s*\{[^}]*min-width:\s*100%/);
  assert.match(css, /\.sol-comp-section \.app-select__menu\s*\{[^}]*z-index:\s*80/);
});

test('barra de catalogo conserva controles y auxiliar una sola vez', async () => {
  const catalog = await read('../components/SolicitudCompraCatalogo.jsx');
  assert.match(catalog, /sol-comp-catalog-filters__primary/);
  assert.match(catalog, /sol-comp-catalog-filters__secondary/);
  assert.equal((catalog.match(/Los artículos sin stock o con stock bajo aparecen primero\./g) || []).length, 1);
  ['Todo el catálogo', 'Necesitan reposición', 'Limpiar filtros'].forEach((copy) => assert.match(catalog, new RegExp(copy)));
});

test('cards conservan estados stock contenido y accion para todos los articulos', async () => {
  const catalog = await read('../components/SolicitudCompraCatalogo.jsx');
  ['SIN_STOCK', 'STOCK_BAJO', 'DISPONIBLE'].forEach((state) => assert.match(catalog, new RegExp(state)));
  assert.match(catalog, /item\.cantidad \?\? 0/);
  assert.match(catalog, /item\.stock_minimo \?\? 0/);
  assert.match(catalog, /item\.unidad_base \|\| 'Unidad'/);
  assert.match(catalog, /visibleItems\.map\(\(item\) => <CatalogItem/);
  assert.doesNotMatch(catalog, /disabled=.*estado_stock|estado_stock.*disabled/);
});

test('presentacion conserva opcion base predeterminada equivalencia y payload visual', async () => {
  const catalog = await read('../components/SolicitudCompraCatalogo.jsx');
  assert.match(catalog, /presentations\.find\(\(option\) => option\.es_predeterminada_compra\) \|\| presentations\[0\]/);
  assert.match(catalog, /\{ value: 'base', label: `Unidad base/);
  assert.match(catalog, /<AppSelect label="Presentación de compra"/);
  assert.equal((catalog.match(/<small><i className="bi bi-arrow-left-right"/g) || []).length, 1);
  assert.match(catalog, /id_presentacion_insumo: Number\(presentation\)/);
  assert.match(catalog, /factor_conversion_visual: selected \? String\(visualFactor\) : null/);
  assert.match(catalog, /unidad_base_visual: selected\?\.unidad_base \|\| item\.unidad_base \|\| null/);
  assert.match(catalog, /nombre_presentacion_visual: selected\?\.nombre_presentacion \|\| null/);
});

test('cantidad del catalogo mantiene precision accesibilidad y limpieza selectiva', async () => {
  const catalog = await read('../components/SolicitudCompraCatalogo.jsx');
  assert.match(catalog, /step=\{isSupply \? '0\.0001' : '1'\}/);
  assert.match(catalog, /inputMode=\{isSupply \? 'decimal' : 'numeric'\}/);
  assert.match(catalog, /aria-describedby=\{error \? quantityErrorId : undefined\}/);
  assert.match(catalog, /id=\{quantityErrorId\}[^>]*role="alert"/);
  assert.match(catalog, /setQuantity\(''\)/);
  assert.doesNotMatch(catalog, /setPresentation\((?:''|'base'|null)\)/);
  assert.match(catalog, /onClick=\{add\}/);
});

test('resumen conserva llave transaccional lineas y eliminacion accesible', async () => {
  const summary = await read('../components/SolicitudCompraResumen.jsx');
  assert.match(summary, /const lineKey = `\$\{line\.tipo_item\}-\$\{line\.id_item\}-\$\{line\.id_presentacion_insumo \|\| 'base'\}`/);
  assert.match(summary, /key=\{lineKey\}/);
  assert.doesNotMatch(summary, /key=\{index\}/);
  assert.match(summary, /title="Eliminar línea"/);
  assert.match(summary, /aria-label=\{`Eliminar \$\{line\.nombre\}`\}/);
  assert.match(summary, /buildVisualEquivalence\(line\)/);
});

test('resumen muestra errores especificos vinculados sin cambiar validacion', async () => {
  const summary = await read('../components/SolicitudCompraResumen.jsx');
  assert.match(summary, /parseRequestedQuantity\(line\.cantidad, line\.tipo_item\)/);
  assert.match(summary, /Ingresa una cantidad entera mayor que cero\./);
  assert.match(summary, /Ingresa una cantidad mayor que cero con hasta cuatro decimales\./);
  assert.match(summary, /aria-invalid=\{!valid\}/);
  assert.match(summary, /aria-describedby=\{!valid \? errorId : undefined\}/);
  assert.match(summary, /id=\{errorId\}[^>]*role="alert"/);
  assert.match(summary, /step=\{line\.tipo_item === 'producto' \? '1' : '0\.0001'\}/);
  assert.match(summary, /inputMode=\{line\.tipo_item === 'producto' \? 'numeric' : 'decimal'\}/);
});

test('observacion y envio conservan contrato y estados', async () => {
  const summary = await read('../components/SolicitudCompraResumen.jsx');
  assert.match(summary, /maxLength="1000"/);
  assert.match(summary, /\{observation\.length\} \/ 1000/);
  assert.match(summary, /setObservation\(event\.target\.value\)/);
  assert.match(summary, /disabled=\{disabled \|\| submitting\}/);
  assert.match(summary, /onClick=\{onSubmit\}/);
  assert.match(summary, /submitting \? 'Enviando…'/);
  assert.match(summary, /Verifica las cantidades antes de enviar/);
});

test('catalogo y resumen no introducen datos monetarios', async () => {
  const source = `${await read('../components/SolicitudCompraCatalogo.jsx')}\n${await read('../components/SolicitudCompraResumen.jsx')}`;
  assert.doesNotMatch(source, /precio|costo|impuesto|subtotal|total monetario/i);
});

test('css limita catalogo a dos columnas y evita scroll o alturas rigidas', async () => {
  const css = await read('../solicitudesCompra.css');
  assert.match(css, /\.sol-comp-catalog-grid\s*\{[^}]*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.doesNotMatch(css, /\.sol-comp-catalog-grid\s*\{[^}]*repeat\(3/);
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.sol-comp-catalog-grid,[\s\S]*grid-template-columns:\s*1fr/);
  const protectedBlocks = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, selectors]) =>
    selectors.split(',').some((selector) => /^\s*\.sol-comp-(?:catalog-card|summary)\s*$/.test(selector))
  );
  protectedBlocks.forEach(([, , declarations]) => {
    assert.doesNotMatch(declarations, /(?:^|;)\s*(?:height|min-height|max-height|overflow|overflow-y)\s*:/i);
  });
  assert.doesNotMatch(css, /\.sol-comp-catalog-card__description\s*\{[^}]*(?:line-clamp|text-overflow|overflow\s*:)/i);
  assert.match(css, /\.sol-comp-add-row\s*\{[^}]*margin-top:\s*auto/);
});
