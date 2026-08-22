import { useEffect, useMemo, useState } from 'react';
import AppSelect from '../../../../components/common/AppSelect';
import { parseRequestedQuantity } from '../utils/solicitudesCompraUtils';
import { buildConversionPreview, normalizeConversionDecimal } from '../utils/solicitudesCompraConversionUtils';
import { createCatalogSearchController } from '../utils/solicitudesCompraCatalogSearch';

const STOCK_LABELS = { SIN_STOCK: 'Sin stock', STOCK_BAJO: 'Stock bajo', DISPONIBLE: 'Disponible' };
const TYPE_OPTIONS = [{ value: '', label: 'Todos' }, { value: 'producto', label: 'Productos' }, { value: 'insumo', label: 'Insumos' }];

function CatalogItem({ item, onAdd }) {
  const isSupply = String(item.tipo_item).toLowerCase() === 'insumo';
  const isSolicitable = item.solicitable !== false;
  const presentations = useMemo(() => Array.isArray(item.presentaciones) ? item.presentaciones : [], [item.presentaciones]);
  const preferred = presentations.find((option) => option.es_predeterminada_compra) || presentations[0];
  const [presentation, setPresentation] = useState(preferred ? String(preferred.id_presentacion) : 'base');
  const [quantity, setQuantity] = useState('');
  const [error, setError] = useState('');
  const selected = presentations.find((option) => String(option.id_presentacion) === presentation);
  const selectedFactor = selected ? normalizeConversionDecimal(selected.factor_conversion) : '1';
  const conversionPreview = buildConversionPreview({
    quantity,
    presentationLabel: selected?.unidad_presentacion || selected?.nombre_presentacion || (isSupply ? item.unidad_base : 'Unidades'),
    baseUnit: isSupply ? (selected?.unidad_base || item.unidad_base || 'Unidad base') : 'Unidades',
    factor: selectedFactor || '1',
    baseOnly: !selected
  });
  const quantityErrorId = `sol-comp-catalog-quantity-${item.tipo_item}-${item.id_item}`;
  const unavailableMessageId = `sol-comp-catalog-unavailable-${item.tipo_item}-${item.id_item}`;
  const options = useMemo(() => [
    { value: 'base', label: `Unidad base (${isSolicitable ? (item.unidad_base || 'Unidad') : 'Sin configurar'})` },
    ...presentations.map((option) => ({
      value: String(option.id_presentacion),
      label: option.nombre_presentacion,
      helperText: `${option.cantidad_presentacion || 1} ${option.unidad_presentacion || option.nombre_presentacion} equivale a ${option.cantidad_base} ${option.unidad_base || item.unidad_base}`
    }))
  ], [isSolicitable, item.unidad_base, presentations]);

  const add = () => {
    if (!isSolicitable) return;
    const parsed = parseRequestedQuantity(quantity, item.tipo_item);
    if (!parsed) {
      setError(isSupply ? 'Ingresa una cantidad positiva con hasta 6 decimales.' : 'Ingresa una cantidad entera positiva.');
      return;
    }
    setError('');
    const visualFactor = selectedFactor || '1';
    onAdd({
      tipo_item: String(item.tipo_item).toLowerCase(),
      id_item: Number(item.id_item),
      nombre: item.nombre,
      cantidad: parsed,
      ...(isSupply && presentation !== 'base' ? { id_presentacion_insumo: Number(presentation) } : {}),
      presentacion: selected?.nombre_presentacion || item.unidad_base || 'Unidad base',
      nombre_presentacion_visual: selected?.nombre_presentacion || null,
      factor_conversion_visual: String(visualFactor),
      unidad_base_visual: isSupply ? (selected?.unidad_base || item.unidad_base || null) : 'Unidades',
      unidad_presentacion_visual: selected?.unidad_presentacion || null,
      cantidad_presentacion_visual: selected?.cantidad_presentacion ?? null
    });
    setQuantity('');
  };

  return (
    <article className={`sol-comp-catalog-card sol-comp-catalog-card--${String(item.estado_stock || 'desconocido').toLowerCase()}${isSolicitable ? '' : ' sol-comp-catalog-card--configuration-pending'}`}>
      <div className="sol-comp-card-top">
        <div className="sol-comp-catalog-card__title"><span aria-hidden="true"><i className={`bi ${isSupply ? 'bi-basket' : 'bi-box-seam'}`} /></span><strong>{item.nombre}</strong></div>
        <div className="sol-comp-catalog-card__badges">
          {!isSolicitable ? <span className="sol-comp-configuration-badge">Configuración pendiente</span> : null}
          <span className={`sol-comp-stock sol-comp-stock--${String(item.estado_stock).toLowerCase()}`}>{STOCK_LABELS[item.estado_stock] || item.estado_stock}</span>
        </div>
      </div>
      <p className="sol-comp-type">{isSupply ? 'Insumo' : 'Producto'} · {item.categoria || 'Sin categoría'}</p>
      {item.descripcion ? <p className="sol-comp-catalog-card__description">{item.descripcion}</p> : null}
      {!isSolicitable ? <p id={unavailableMessageId} className="sol-comp-configuration-message">Este insumo no tiene una unidad base configurada. No puede agregarse a la solicitud hasta que el área de Inventario corrija su configuración.</p> : null}
      <div className="sol-comp-catalog-card__inventory">
        <div className="sol-comp-stock-values">
          <span><small>Existencia</small><b>{item.cantidad ?? 0}</b></span>
          <span><small>Stock mínimo</small><b>{item.stock_minimo ?? 0}</b></span>
          <span><small>Unidad base</small><b>{isSolicitable ? (item.unidad_base || 'Unidad') : 'Sin configurar'}</b></span>
        </div>
      </div>
      {isSupply && presentations.length ? (
        <div className="sol-comp-presentation">
          <AppSelect label="Presentación de compra" value={presentation} options={options} onChange={setPresentation} disabled={!isSolicitable} helperText={!isSolicitable ? 'Configuración pendiente' : ''} />
          {selected ? <div className="sol-comp-conversion-info">
            <strong>{selected.nombre_presentacion}</strong>
            <small><i className="bi bi-arrow-left-right" aria-hidden="true" /> {selected.cantidad_presentacion || 1} {selected.unidad_presentacion || 'Unidad de presentación'} equivale a {selected.cantidad_base} {selected.unidad_base || item.unidad_base}</small>
            <small>Conversión tomada de Presentaciones y conversiones.</small>
          </div> : <div className="sol-comp-conversion-info"><strong>Solo unidad base</strong><small>Sin presentación de compra seleccionada. Se solicitará directamente en {item.unidad_base}.</small></div>}
        </div>
      ) : <div className="sol-comp-base-presentation"><i className={`bi ${isSolicitable ? 'bi-box' : 'bi-exclamation-circle'}`} aria-hidden="true" /><span><strong>{isSupply ? (isSolicitable ? 'Solo unidad base' : 'Unidad base sin configurar') : 'Solicitud por unidad'}</strong>{isSolicitable ? <small>{isSupply ? `Este insumo no tiene una presentación de compra configurada. Se solicitará directamente en ${item.unidad_base}.` : 'Se solicitará directamente en Unidades.'}</small> : null}</span></div>}
      <div className="sol-comp-add-row">
        <label>Cantidad solicitada
          <input aria-invalid={Boolean(error)} aria-disabled={!isSolicitable} aria-describedby={error ? quantityErrorId : (!isSolicitable ? unavailableMessageId : undefined)} disabled={!isSolicitable} type="number" min="0" step={isSupply ? '0.000001' : '1'} inputMode={isSupply ? 'decimal' : 'numeric'} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          {error ? <small id={quantityErrorId} className="sol-comp-field-error" role="alert">{error}</small> : null}
        </label>
        <button type="button" className="btn sol-comp-add-action" disabled={!isSolicitable} aria-disabled={!isSolicitable} aria-describedby={!isSolicitable ? unavailableMessageId : undefined} onClick={add}><i className={`bi ${isSolicitable ? 'bi-plus-circle' : 'bi-exclamation-circle'}`} aria-hidden="true" /> {isSolicitable ? 'Agregar' : 'No disponible'}</button>
      </div>
      {isSolicitable && conversionPreview.valid ? <div className="sol-comp-conversion-preview" aria-live="polite"><small>Entrada estimada al inventario:</small><strong>{conversionPreview.baseQuantity} {conversionPreview.baseUnit}</strong></div> : null}
    </article>
  );
}

export default function SolicitudCompraCatalogo({ warehouseId, state, loadCatalog, onAdd }) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [scope, setScope] = useState('all');
  const [searchController] = useState(() => createCatalogSearchController({
    getWarehouseId: () => warehouseId,
    loadCatalog
  }));
  const page = Number(state.pagination?.page || 1);
  const matchesWarehouse = state.requestedWarehouseId === String(warehouseId);
  const visibleItems = matchesWarehouse && !state.loading ? state.items : [];
  const hasUnavailableItems = visibleItems.some((item) => item.solicitable === false);
  const changeSearch = (value) => {
    setSearch(value);
    searchController.changeSearch(value);
  };
  const changeScope = (nextScope) => {
    setScope(nextScope);
    void searchController.changeScope(nextScope);
  };
  const clearFilters = () => {
    setSearch('');
    setType('');
    setScope('all');
    void searchController.clear();
  };
  useEffect(() => {
    searchController.setContext({ getWarehouseId: () => warehouseId, loadCatalog });
    if (warehouseId) void loadCatalog({ id_almacen: warehouseId, page: 1 });
    return () => searchController.dispose();
  }, [loadCatalog, searchController, warehouseId]);

  return (
    <section className="sol-comp-catalog" aria-labelledby="catalog-title">
      <div className="sol-comp-panel-heading"><span aria-hidden="true"><i className="bi bi-grid-3x3-gap" /></span><div><h3 id="catalog-title">Catálogo del almacén</h3></div></div>
      <div className="sol-comp-catalog-filters">
        <div className="sol-comp-catalog-filters__primary">
          <label className="sol-comp-search-field">Buscar<input type="search" placeholder="Nombre o descripción" value={search} onChange={(event) => changeSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void searchController.submit(); } if (event.key === 'Escape') { event.preventDefault(); setSearch(''); void searchController.escape(); } }} /></label>
          <AppSelect label="Tipo" value={type} options={TYPE_OPTIONS} onChange={(value) => { setType(value); void searchController.changeType(value); }} />
          <button type="button" className="btn btn-primary" onClick={() => searchController.submit()}><i className="bi bi-search" aria-hidden="true" /> Buscar</button>
          <button type="button" className="btn btn-outline-secondary" onClick={clearFilters}><i className="bi bi-arrow-counterclockwise" aria-hidden="true" /> Limpiar filtros</button>
        </div>
        <div className="sol-comp-catalog-filters__secondary">
          <fieldset className="sol-comp-scope">
            <legend>Alcance</legend>
            <div>
              <button type="button" aria-pressed={scope === 'all'} className={scope === 'all' ? 'is-active' : ''} onClick={() => changeScope('all')}>Todo el catálogo</button>
              <button type="button" aria-pressed={scope === 'low'} className={scope === 'low' ? 'is-active' : ''} onClick={() => changeScope('low')}>Necesitan reposición</button>
            </div>
          </fieldset>
          <p><i className="bi bi-info-circle" aria-hidden="true" /> Los artículos sin stock o con stock bajo aparecen primero.</p>
        </div>
      </div>
      <div aria-live="polite">
        {state.loading ? <div className="sol-comp-feedback"><span className="spinner-border spinner-border-sm" /> Buscando catálogo…</div> : null}
        {state.error ? <div className="sol-comp-feedback sol-comp-feedback--error">{state.error} <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => searchController.page(page)}>Reintentar</button></div> : null}
      </div>
      {hasUnavailableItems ? <div className="sol-comp-catalog-warning" role="status"><i className="bi bi-exclamation-triangle" aria-hidden="true" /> Algunos insumos no pueden solicitarse porque su unidad base está pendiente de configuración. Repórtalos al responsable de Inventario.</div> : null}
      <div className="sol-comp-catalog-grid">{visibleItems.map((item) => <CatalogItem key={`${item.tipo_item}-${item.id_item}`} item={item} onAdd={onAdd} />)}</div>
      {!state.loading && !state.error && matchesWarehouse && !visibleItems.length ? <div className="sol-comp-empty"><i className="bi bi-search" aria-hidden="true" /><h4>No encontramos artículos{search ? ` para “${search}”` : ''}</h4><p>Los filtros actuales no produjeron coincidencias.</p></div> : null}
      <nav className="sol-comp-pagination" aria-label="Paginación del catálogo">
        <button type="button" className="btn btn-outline-secondary btn-sm" disabled={page <= 1} onClick={() => searchController.page(page - 1)}>Anterior</button>
        <span>Página {page} de {Math.max(1, Number(state.pagination?.total_pages || 1))}</span>
        <button type="button" className="btn btn-outline-secondary btn-sm" disabled={page >= Number(state.pagination?.total_pages || 1)} onClick={() => searchController.page(page + 1)}>Siguiente</button>
      </nav>
    </section>
  );
}
