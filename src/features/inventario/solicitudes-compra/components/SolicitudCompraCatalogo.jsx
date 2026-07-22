import { useEffect, useMemo, useState } from 'react';
import AppSelect from '../../../../components/common/AppSelect';
import { parseRequestedQuantity } from '../utils/solicitudesCompraUtils';

const STOCK_LABELS = { SIN_STOCK: 'Sin stock', STOCK_BAJO: 'Stock bajo', DISPONIBLE: 'Disponible' };

function CatalogItem({ item, onAdd }) {
  const isSupply = String(item.tipo_item).toLowerCase() === 'insumo';
  const presentations = useMemo(() => Array.isArray(item.presentaciones) ? item.presentaciones : [], [item.presentaciones]);
  const preferred = presentations.find((option) => option.es_predeterminada_compra) || presentations[0];
  const [presentation, setPresentation] = useState(preferred ? String(preferred.id_presentacion) : 'base');
  const [quantity, setQuantity] = useState('');
  const [error, setError] = useState('');
  const selected = presentations.find((option) => String(option.id_presentacion) === presentation);
  const options = useMemo(() => [
    { value: 'base', label: `Unidad base (${item.unidad_base || 'Unidad'})` },
    ...presentations.map((option) => ({
      value: String(option.id_presentacion), label: option.nombre_presentacion,
      helperText: `${option.cantidad_presentacion || 1} ${option.unidad_presentacion || option.nombre_presentacion} equivale a ${option.cantidad_base} ${option.unidad_base || item.unidad_base}`
    }))
  ], [item.unidad_base, presentations]);

  const add = () => {
    const parsed = parseRequestedQuantity(quantity, item.tipo_item);
    if (!parsed) { setError(isSupply ? 'Ingresa una cantidad positiva con hasta 4 decimales.' : 'Ingresa una cantidad entera positiva.'); return; }
    setError('');
    const presentationQuantity = Number(selected?.cantidad_presentacion || 1);
    const derivedFactor = Number(selected?.cantidad_base) / presentationQuantity;
    const visualFactor = selected?.factor_conversion ?? (Number.isFinite(derivedFactor) ? derivedFactor : 1);
    onAdd({
      tipo_item: String(item.tipo_item).toLowerCase(), id_item: Number(item.id_item), nombre: item.nombre,
      cantidad: parsed, ...(isSupply && presentation !== 'base' ? { id_presentacion_insumo: Number(presentation) } : {}),
      presentacion: selected?.nombre_presentacion || item.unidad_base || 'Unidad base',
      nombre_presentacion_visual: selected?.nombre_presentacion || null,
      factor_conversion_visual: selected ? String(visualFactor) : null,
      unidad_base_visual: selected?.unidad_base || item.unidad_base || null
    });
    setQuantity('');
  };

  return (
    <article className="sol-comp-catalog-card">
      <div className="sol-comp-card-top"><strong>{item.nombre}</strong><span className={`sol-comp-stock sol-comp-stock--${String(item.estado_stock).toLowerCase()}`}>{STOCK_LABELS[item.estado_stock] || item.estado_stock}</span></div>
      <p className="sol-comp-type">{isSupply ? 'Insumo' : 'Producto'} · {item.categoria || 'Sin categoría'}</p>
      {item.descripcion ? <p>{item.descripcion}</p> : null}
      <div className="sol-comp-stock-values"><span>Actual: <b>{item.cantidad ?? 0}</b></span><span>Mínimo: <b>{item.stock_minimo ?? 0}</b></span><span>Base: <b>{item.unidad_base || 'Unidad'}</b></span></div>
      {isSupply && presentations.length ? <AppSelect label="Presentación" value={presentation} options={options} onChange={setPresentation} /> : null}
      <div className="sol-comp-add-row">
        <label>Cantidad<input aria-invalid={Boolean(error)} type="number" min="0" step={isSupply ? '0.0001' : '1'} inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
        <button type="button" className="btn btn-outline-primary" onClick={add}>Agregar</button>
      </div>
      {error ? <small className="sol-comp-field-error" role="alert">{error}</small> : null}
    </article>
  );
}

export default function SolicitudCompraCatalogo({ warehouseId, state, loadCatalog, onAdd }) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [lowStock, setLowStock] = useState(true);
  const page = Number(state.pagination?.page || 1);
  const matchesWarehouse = state.requestedWarehouseId === String(warehouseId);
  const visibleItems = matchesWarehouse && !state.loading ? state.items : [];
  const load = (nextPage = 1) => loadCatalog({ id_almacen: warehouseId, buscar: search.trim(), tipo: type, solo_stock_bajo: lowStock ? 'true' : '', page: nextPage });
  useEffect(() => { if (warehouseId) void loadCatalog({ id_almacen: warehouseId, solo_stock_bajo: 'true', page: 1 }); }, [loadCatalog, warehouseId]);
  return (
    <section className="sol-comp-catalog" aria-labelledby="catalog-title">
      <h3 id="catalog-title">Catálogo del almacén</h3>
      <div className="sol-comp-catalog-filters">
        <label>Buscar<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); load(); } }} /></label>
        <AppSelect label="Tipo" value={type} options={[{ value: '', label: 'Todos' }, { value: 'producto', label: 'Productos' }, { value: 'insumo', label: 'Insumos' }]} onChange={(value) => { setType(value); void loadCatalog({ id_almacen: warehouseId, buscar: search.trim(), tipo: value, solo_stock_bajo: lowStock ? 'true' : '', page: 1 }); }} />
        <label className="sol-comp-check"><input type="checkbox" checked={lowStock} onChange={(event) => { const checked = event.target.checked; setLowStock(checked); void loadCatalog({ id_almacen: warehouseId, buscar: search.trim(), tipo: type, solo_stock_bajo: checked ? 'true' : '', page: 1 }); }} /> Solo stock bajo</label>
        <button type="button" className="btn btn-outline-secondary" onClick={() => load()}>Buscar</button>
      </div>
      <div aria-live="polite">{state.loading ? <div className="sol-comp-feedback">Cargando catálogo…</div> : null}{state.error ? <div className="sol-comp-feedback sol-comp-feedback--error">{state.error} <button type="button" onClick={() => load(page)}>Reintentar</button></div> : null}</div>
      <div className="sol-comp-catalog-grid">{visibleItems.map((item) => <CatalogItem key={`${item.tipo_item}-${item.id_item}`} item={item} onAdd={onAdd} />)}</div>
      {!state.loading && !state.error && matchesWarehouse && !visibleItems.length ? <div className="sol-comp-empty">No hay artículos para estos filtros.</div> : null}
      <div className="sol-comp-pagination"><button type="button" className="btn btn-outline-secondary btn-sm" disabled={page <= 1} onClick={() => load(page - 1)}>Anterior</button><span>Página {page} de {Math.max(1, Number(state.pagination?.total_pages || 1))}</span><button type="button" className="btn btn-outline-secondary btn-sm" disabled={page >= Number(state.pagination?.total_pages || 1)} onClick={() => load(page + 1)}>Siguiente</button></div>
    </section>
  );
}
