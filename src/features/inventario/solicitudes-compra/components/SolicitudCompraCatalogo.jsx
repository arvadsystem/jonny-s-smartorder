import { useEffect, useMemo, useState } from 'react';
import AppSelect from '../../../../components/common/AppSelect';
import { parseRequestedQuantity } from '../utils/solicitudesCompraUtils';

const STOCK_LABELS = { SIN_STOCK: 'Sin stock', STOCK_BAJO: 'Stock bajo', DISPONIBLE: 'Disponible' };
const TYPE_OPTIONS = [{ value: '', label: 'Todos' }, { value: 'producto', label: 'Productos' }, { value: 'insumo', label: 'Insumos' }];

function CatalogItem({ item, onAdd }) {
  const isSupply = String(item.tipo_item).toLowerCase() === 'insumo';
  const presentations = useMemo(() => Array.isArray(item.presentaciones) ? item.presentaciones : [], [item.presentaciones]);
  const preferred = presentations.find((option) => option.es_predeterminada_compra) || presentations[0];
  const [presentation, setPresentation] = useState(preferred ? String(preferred.id_presentacion) : 'base');
  const [quantity, setQuantity] = useState('');
  const [error, setError] = useState('');
  const selected = presentations.find((option) => String(option.id_presentacion) === presentation);
  const quantityErrorId = `sol-comp-catalog-quantity-${item.tipo_item}-${item.id_item}`;
  const options = useMemo(() => [
    { value: 'base', label: `Unidad base (${item.unidad_base || 'Unidad'})` },
    ...presentations.map((option) => ({
      value: String(option.id_presentacion),
      label: option.nombre_presentacion,
      helperText: `${option.cantidad_presentacion || 1} ${option.unidad_presentacion || option.nombre_presentacion} equivale a ${option.cantidad_base} ${option.unidad_base || item.unidad_base}`
    }))
  ], [item.unidad_base, presentations]);

  const add = () => {
    const parsed = parseRequestedQuantity(quantity, item.tipo_item);
    if (!parsed) {
      setError(isSupply ? 'Ingresa una cantidad positiva con hasta 4 decimales.' : 'Ingresa una cantidad entera positiva.');
      return;
    }
    setError('');
    const presentationQuantity = Number(selected?.cantidad_presentacion || 1);
    const derivedFactor = Number(selected?.cantidad_base) / presentationQuantity;
    const visualFactor = selected?.factor_conversion ?? (Number.isFinite(derivedFactor) ? derivedFactor : 1);
    onAdd({
      tipo_item: String(item.tipo_item).toLowerCase(),
      id_item: Number(item.id_item),
      nombre: item.nombre,
      cantidad: parsed,
      ...(isSupply && presentation !== 'base' ? { id_presentacion_insumo: Number(presentation) } : {}),
      presentacion: selected?.nombre_presentacion || item.unidad_base || 'Unidad base',
      nombre_presentacion_visual: selected?.nombre_presentacion || null,
      factor_conversion_visual: selected ? String(visualFactor) : null,
      unidad_base_visual: selected?.unidad_base || item.unidad_base || null
    });
    setQuantity('');
  };

  return (
    <article className={`sol-comp-catalog-card sol-comp-catalog-card--${String(item.estado_stock || 'desconocido').toLowerCase()}`}>
      <div className="sol-comp-card-top">
        <div className="sol-comp-catalog-card__title"><span aria-hidden="true"><i className={`bi ${isSupply ? 'bi-basket' : 'bi-box-seam'}`} /></span><strong>{item.nombre}</strong></div>
        <span className={`sol-comp-stock sol-comp-stock--${String(item.estado_stock).toLowerCase()}`}>{STOCK_LABELS[item.estado_stock] || item.estado_stock}</span>
      </div>
      <p className="sol-comp-type">{isSupply ? 'Insumo' : 'Producto'} · {item.categoria || 'Sin categoría'}</p>
      {item.descripcion ? <p className="sol-comp-catalog-card__description">{item.descripcion}</p> : null}
      <div className="sol-comp-stock-values">
        <span><small>Existencia</small><b>{item.cantidad ?? 0}</b></span>
        <span><small>Stock mínimo</small><b>{item.stock_minimo ?? 0}</b></span>
        <span><small>Unidad base</small><b>{item.unidad_base || 'Unidad'}</b></span>
      </div>
      {isSupply && presentations.length ? (
        <div className="sol-comp-presentation">
          <AppSelect label="Presentación de compra" value={presentation} options={options} onChange={setPresentation} />
          {selected ? <small><i className="bi bi-arrow-left-right" aria-hidden="true" /> {selected.cantidad_presentacion || 1} {selected.unidad_presentacion || selected.nombre_presentacion} equivale a {selected.cantidad_base} {selected.unidad_base || item.unidad_base}</small> : null}
        </div>
      ) : null}
      <div className="sol-comp-add-row">
        <label>Cantidad solicitada<input aria-invalid={Boolean(error)} aria-describedby={error ? quantityErrorId : undefined} type="number" min="0" step={isSupply ? '0.0001' : '1'} inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
        <button type="button" className="btn btn-outline-primary" onClick={add}><i className="bi bi-plus-circle" aria-hidden="true" /> Agregar</button>
      </div>
      {error ? <small id={quantityErrorId} className="sol-comp-field-error" role="alert">{error}</small> : null}
    </article>
  );
}

export default function SolicitudCompraCatalogo({ warehouseId, state, loadCatalog, onAdd }) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [scope, setScope] = useState('all');
  const page = Number(state.pagination?.page || 1);
  const matchesWarehouse = state.requestedWarehouseId === String(warehouseId);
  const visibleItems = matchesWarehouse && !state.loading ? state.items : [];
  const catalogOptions = (nextPage = 1, overrides = {}) => {
    const nextSearch = overrides.search ?? search;
    const nextType = overrides.type ?? type;
    const nextScope = overrides.scope ?? scope;
    return {
      id_almacen: warehouseId,
      buscar: nextSearch.trim(),
      tipo: nextType,
      ...(nextScope === 'low' ? { solo_stock_bajo: 'true' } : {}),
      page: nextPage
    };
  };
  const load = (nextPage = 1) => loadCatalog(catalogOptions(nextPage));
  const changeScope = (nextScope) => {
    setScope(nextScope);
    void loadCatalog(catalogOptions(1, { scope: nextScope }));
  };
  const clearFilters = () => {
    setSearch('');
    setType('');
    setScope('all');
    void loadCatalog(catalogOptions(1, { search: '', type: '', scope: 'all' }));
  };
  useEffect(() => {
    if (warehouseId) void loadCatalog({ id_almacen: warehouseId, page: 1 });
  }, [loadCatalog, warehouseId]);

  return (
    <section className="sol-comp-catalog" aria-labelledby="catalog-title">
      <div className="sol-comp-panel-heading"><span aria-hidden="true"><i className="bi bi-grid-3x3-gap" /></span><div><h3 id="catalog-title">Catálogo del almacén</h3></div></div>
      <div className="sol-comp-catalog-filters">
        <div className="sol-comp-catalog-filters__primary">
          <label className="sol-comp-search-field">Buscar<input type="search" placeholder="Nombre o descripción" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); load(1); } }} /></label>
          <AppSelect label="Tipo" value={type} options={TYPE_OPTIONS} onChange={(value) => { setType(value); void loadCatalog(catalogOptions(1, { type: value })); }} />
          <button type="button" className="btn btn-primary" onClick={() => load(1)}><i className="bi bi-search" aria-hidden="true" /> Buscar</button>
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
        {state.loading ? <div className="sol-comp-feedback"><span className="spinner-border spinner-border-sm" /> Cargando catálogo…</div> : null}
        {state.error ? <div className="sol-comp-feedback sol-comp-feedback--error">{state.error} <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => load(page)}>Reintentar</button></div> : null}
      </div>
      <div className="sol-comp-catalog-grid">{visibleItems.map((item) => <CatalogItem key={`${item.tipo_item}-${item.id_item}`} item={item} onAdd={onAdd} />)}</div>
      {!state.loading && !state.error && matchesWarehouse && !visibleItems.length ? <div className="sol-comp-empty"><i className="bi bi-search" aria-hidden="true" /><h4>No encontramos artículos</h4><p>Prueba con otros filtros o vuelve a todo el catálogo.</p></div> : null}
      <nav className="sol-comp-pagination" aria-label="Paginación del catálogo">
        <button type="button" className="btn btn-outline-secondary btn-sm" disabled={page <= 1} onClick={() => load(page - 1)}>Anterior</button>
        <span>Página {page} de {Math.max(1, Number(state.pagination?.total_pages || 1))}</span>
        <button type="button" className="btn btn-outline-secondary btn-sm" disabled={page >= Number(state.pagination?.total_pages || 1)} onClick={() => load(page + 1)}>Siguiente</button>
      </nav>
    </section>
  );
}
