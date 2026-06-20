import { useEffect, useRef, useState } from 'react';
import { FaImage } from 'react-icons/fa';
import AppSelect from '../../../../components/common/AppSelect';
import { resolveInventarioImageUrl } from '../../../../utils/inventarioImagenes';
import { CATALOG_TABS } from '../hooks/useVentaComposer';

const buildDiscountBadgeLabel = (discount) => {
  if (!discount) return null;
  const type = String(discount.nombre_tipo_descuento || '').toUpperCase();
  const value = Number(discount.valor_descuento ?? 0);
  if (value <= 0) return 'Promo';
  if (type.includes('PORCENTAJE')) return `-${value.toFixed(0)}%`;
  return `L ${value.toFixed(0)} OFF`;
};

const isExplicitlyOutOfStock = (row, isProducto) => {
  if (isProducto) return Number(row?.cantidad ?? row?.stock_disponible ?? 0) <= 0;

  const availabilityFields = [
    row?.disponible,
    row?.es_disponible,
    row?.esta_disponible,
    row?.tiene_stock,
    row?.stock_disponible,
    row?.cantidad_disponible,
    row?.cantidad
  ].filter((value) => value !== null && value !== undefined && value !== '');

  if (availabilityFields.length === 0) return false;
  return availabilityFields.some((value) => {
    if (typeof value === 'boolean') return value === false;
    if (typeof value === 'number') return value <= 0;
    const normalized = String(value).trim().toLowerCase();
    if (['false', 'no', 'agotado', 'sin stock', '0'].includes(normalized)) return true;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed <= 0;
  });
};

const buildResultsLabel = (catalogKey, count) => {
  if (catalogKey === 'DESCUENTOS') return `${count} ${count === 1 ? 'item' : 'items'} con descuento`;
  if (catalogKey === 'COMBOS') return `${count} ${count === 1 ? 'combo' : 'combos'}`;
  if (catalogKey === 'RECETAS') return `${count} ${count === 1 ? 'receta' : 'recetas'}`;
  if (catalogKey === 'EXTRAS') return `${count} ${count === 1 ? 'extra' : 'extras'}`;
  return `${count} ${count === 1 ? 'producto' : 'productos'}`;
};

export default function VentaComposerCatalog({
  composer,
  catalogLoading,
  catalogStatus = 'idle',
  catalogStatuses = {},
  catalogErrors = {},
  onRetry
}) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [showOutOfStock, setShowOutOfStock] = useState(false);
  const searchWrapRef = useRef(null);
  const isDiscountCatalog = composer.activeCatalog === 'DESCUENTOS';
  const catalogTabs = composer.canApplyDiscount
    ? [...CATALOG_TABS, { key: 'DESCUENTOS', label: 'Descuentos', icon: 'bi bi-tags' }]
    : CATALOG_TABS;
  const discountCatalogRows = Array.isArray(composer.discountCatalogRows)
    ? composer.discountCatalogRows
    : [];
  const visibleDiscountRows = discountCatalogRows.filter(({ kind, row }) => {
    const isProducto = kind === 'PRODUCTO';
    return !isExplicitlyOutOfStock(row, isProducto);
  });
  const hasFilters = isDiscountCatalog
    ? composer.search.trim() !== ''
    : (composer.search.trim() !== '' || composer.activeCategory !== 'all');
  const isExtrasCatalog = composer.activeCatalog === 'EXTRAS';
  const searchPlaceholder = composer.activeCatalog === 'PRODUCTOS'
    ? 'Buscar productos...'
    : composer.activeCatalog === 'COMBOS'
      ? 'Buscar combos...'
      : composer.activeCatalog === 'RECETAS'
        ? 'Buscar recetas...'
        : isExtrasCatalog
          ? 'Buscar extras...'
        : 'Buscar items con descuento...';

  useEffect(() => {
    if (!filterOpen) return undefined;
    const handleOutsideClick = (event) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(event.target)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [filterOpen]);

  useEffect(() => {
    if (composer.canApplyDiscount || composer.activeCatalog !== 'DESCUENTOS') return;
    composer.setActiveCatalog('PRODUCTOS');
  }, [composer]);

  const handleClearFilters = () => {
    composer.setSearch('');
    composer.setActiveCategory('all');
    setFilterOpen(false);
  };

  const resolveImageUrl = (row) => {
    const rawUrl = row?.imagen_principal_url || row?.url_imagen || null;
    return rawUrl ? resolveInventarioImageUrl(rawUrl) : null;
  };

  const activeCatalogError = catalogStatus === 'error' ? (() => {
    if (isDiscountCatalog) return catalogErrors.descuentos || null;
    if (isExtrasCatalog && composer.currentCatalogError) {
      return {
        endpoint: '/ventas/catalogos/extras-permitidos',
        status: null,
        message: composer.currentCatalogError
      };
    }
    if (composer.activeCatalog === 'PRODUCTOS') return catalogErrors.productos || null;
    if (composer.activeCatalog === 'COMBOS') return catalogErrors.combos || null;
    return catalogErrors.recetas || null;
  })() : null;
  const hasNonDiscountCatalogErrors = ['productos', 'combos', 'recetas']
    .some((key) => catalogStatuses[key] === 'error');
  const visibleCatalogRows = composer.currentCatalogRows.filter((row) => {
    if (isDiscountCatalog) return false;
    const isProducto = composer.activeCatalog === 'PRODUCTOS';
    const isOutOfStock = isExplicitlyOutOfStock(row, isProducto);
    return showOutOfStock ? isOutOfStock : !isOutOfStock;
  });
  const outOfStockCount = composer.currentCatalogRows.filter((row) => {
    if (isDiscountCatalog) return false;
    const isProducto = composer.activeCatalog === 'PRODUCTOS';
    return isExplicitlyOutOfStock(row, isProducto);
  }).length;

  return (
    <div className="ventas-create-modal__catalog ventas-caja-layout__catalog">
      <div className="ventas-catalog__topbar ventas-catalog-toolbar ventas-catalog-compact-toolbar">
        <AppSelect
          value={composer.activeCatalog}
          options={catalogTabs.map((tab) => ({
            value: tab.key,
            label: tab.label
          }))}
          onChange={composer.setActiveCatalog}
          placeholder="Selecciona catalogo"
          className="ventas-catalog-dropdown app-select--compact app-select--warm"
        />

        <div className="ventas-catalog__search-wrap" ref={searchWrapRef}>
          <label className="ventas-catalog-search-field">
            <i className="bi bi-search" aria-hidden="true" />
            <input
              type="search"
              className="ventas-catalog__search-input"
              placeholder={searchPlaceholder}
              value={composer.search}
              onChange={(event) => composer.setSearch(event.target.value)}
              onKeyDown={composer.handleSearchKeyDown}
            />
          </label>

          {!isDiscountCatalog && !isExtrasCatalog ? (
            <button
              type="button"
              className={`ventas-catalog__search-btn ${filterOpen ? 'is-active' : ''}`}
              onClick={() => setFilterOpen((current) => !current)}
              aria-label="Abrir filtros"
              title="Filtrar catalogo"
            >
              <i className="bi bi-sliders" />
            </button>
          ) : null}

          {hasFilters ? (
            <button
              type="button"
              className="ventas-catalog__clear-btn"
              onClick={handleClearFilters}
              aria-label="Limpiar busqueda y filtros"
              title="Limpiar busqueda y filtros"
            >
              <i className="bi bi-x-lg" />
            </button>
          ) : null}

          {!isDiscountCatalog && !isExtrasCatalog && filterOpen ? (
            <div className="ventas-catalog__search-popup">
              <div className="ventas-catalog__categories-list">
                <div className="ventas-catalog__categories-label">
                  {composer.activeCatalog === 'PRODUCTOS' ? 'FILTRAR POR CATEGORIA:' : 'FILTRAR POR DEPARTAMENTO:'}
                </div>
                <button
                  type="button"
                  className={`ventas-catalog__category-item ${composer.activeCategory === 'all' ? 'is-selected' : ''}`}
                  onClick={() => {
                    composer.setActiveCategory('all');
                    setFilterOpen(false);
                  }}
                >
                  <span>{composer.activeCatalog === 'PRODUCTOS' ? 'Todos los productos' : 'Todos los departamentos'}</span>
                  {composer.activeCategory === 'all' ? <i className="bi bi-check2" /> : null}
                </button>

                {composer.activeCatalog === 'PRODUCTOS'
                  ? composer.categorias.map((categoria) => {
                      const isSelected = String(composer.activeCategory) === String(categoria.id_categoria_producto);
                      return (
                        <button
                          key={categoria.id_categoria_producto}
                          type="button"
                          className={`ventas-catalog__category-item ${isSelected ? 'is-selected' : ''}`}
                          onClick={() => {
                            composer.setActiveCategory(String(categoria.id_categoria_producto));
                            setFilterOpen(false);
                          }}
                        >
                          <span>{categoria.nombre_categoria}</span>
                          {isSelected ? <i className="bi bi-check2" /> : null}
                        </button>
                      );
                    })
                  : composer.tiposDepartamento.map((tipo) => {
                      const isSelected = String(composer.activeCategory) === String(tipo.id_tipo_departamento);
                      return (
                        <button
                          key={tipo.id_tipo_departamento}
                          type="button"
                          className={`ventas-catalog__category-item ${isSelected ? 'is-selected' : ''}`}
                          onClick={() => {
                            composer.setActiveCategory(String(tipo.id_tipo_departamento));
                            setFilterOpen(false);
                          }}
                        >
                          <span>{tipo.nombre_tipo_departamento}</span>
                          {isSelected ? <i className="bi bi-check2" /> : null}
                        </button>
                      );
                    })}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="ventas-create-modal__results-meta ventas-catalog-results">
        <span>
          {catalogStatus === 'idle'
            ? 'Catalogo pendiente'
            : (composer.currentCatalogLoading || catalogLoading)
            ? 'Cargando catalogo...'
            : buildResultsLabel(composer.activeCatalog, isDiscountCatalog ? visibleDiscountRows.length : visibleCatalogRows.length)}
        </span>
        {!isDiscountCatalog ? (
          <label className="ventas-catalog__stock-toggle">
            <input
              type="checkbox"
              checked={showOutOfStock}
              onChange={(event) => setShowOutOfStock(event.target.checked)}
            />
            <span>Ver agotados</span>
            {outOfStockCount > 0 && !showOutOfStock ? <small>{outOfStockCount}</small> : null}
          </label>
        ) : (
          <span className="ventas-catalog-results__hint">Solo se muestran items con descuento aplicable</span>
        )}
      </div>
      {activeCatalogError ? (
        <div className="ventas-create-modal__error">
          <span>{`Error en ${activeCatalogError.endpoint}${activeCatalogError.status ? ` (HTTP ${activeCatalogError.status})` : ''}: ${activeCatalogError.message}`}</span>
          <button type="button" className="btn btn-sm btn-outline-danger ms-2" onClick={onRetry}>
            Reintentar
          </button>
        </div>
      ) : null}
      {!isDiscountCatalog && !activeCatalogError && hasNonDiscountCatalogErrors ? (
        <div className="ventas-create-modal__error">
          Algunos catalogos auxiliares no cargaron. Productos, combos y recetas disponibles siguen habilitados.
        </div>
      ) : null}

      {isDiscountCatalog ? (
        <div className="ventas-discounts-panel">
          {catalogStatus === 'idle' ? null : catalogLoading ? (
            <div className="ventas-create-modal__empty ventas-discounts-panel__empty">
              <span className="spinner-border spinner-border-sm" aria-hidden="true" />
              <span>Cargando descuentos...</span>
            </div>
          ) : visibleDiscountRows.length === 0 ? (
            <div className="ventas-create-modal__empty ventas-discounts-panel__empty">
              <i className="bi bi-tags" />
              <span>No hay productos, combos o recetas con descuentos aplicables para esta sucursal.</span>
            </div>
          ) : (
            <>
              <div className="ventas-discounts-panel__summary">
                <span>Promociones disponibles</span>
                <strong>{buildResultsLabel('DESCUENTOS', visibleDiscountRows.length)}</strong>
              </div>
              <div className="ventas-create-modal__products ventas-catalog-grid">
                {visibleDiscountRows.map(({ kind, row, discount }) => {
                  const isProducto = kind === 'PRODUCTO';
                  const isCombo = kind === 'COMBO';
                  const itemId = isProducto ? row.id_producto : isCombo ? row.id_combo : row.id_receta;
                  const itemName = isProducto ? row.nombre_producto : isCombo ? (row.nombre_combo || row.descripcion || 'Combo') : row.nombre_receta;
                  const imageSrc = resolveImageUrl(row);
                  const precio = Number(row.precio || 0);
                  const stockDisponible = isProducto ? Number(row.cantidad ?? 0) : null;
                  const badgeLabel = buildDiscountBadgeLabel(discount);
                  const discountAddOptions = { discount };
                  return (
                    <div
                      key={`DESCUENTO-${kind}-${itemId}`}
                      className="vcp-card ventas-catalog-card-compact ventas-catalog-card-compact--discount"
                      onClick={() => composer.addCatalogItem(kind, row, [], discountAddOptions)}
                      data-testid="ventas-catalog-card"
                      data-catalog-kind={kind}
                      data-catalog-id={itemId}
                      data-catalog-name={itemName}
                      data-catalog-stock={stockDisponible ?? ''}
                    >
                      <div className="vcp-card__media">
                        {badgeLabel ? (
                          <span className="vcp-card__discount-badge">{badgeLabel}</span>
                        ) : null}
                        {imageSrc ? (
                          <img
                            src={imageSrc}
                            alt={itemName}
                            className="vcp-card__image"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={(event) => {
                              event.currentTarget.style.display = 'none';
                              const next = event.currentTarget.nextElementSibling;
                              if (next) next.classList.remove('d-none');
                            }}
                          />
                        ) : null}
                        <div className={`vcp-card__placeholder ${imageSrc ? 'd-none' : ''}`}>
                          <FaImage className="vcp-card__placeholder-icon" />
                        </div>
                      </div>

                      <div className="vcp-card__body">
                        <div className="vcp-card__meta-row">
                          <span className="vcp-card__kind">{kind}</span>
                          <span className="ventas-discount-chip">{discount.nombre_descuento}</span>
                        </div>
                        <h6 className="vcp-card__name" title={itemName}>{itemName}</h6>

                        <div className="vcp-card__stock">
                          {isProducto ? `Disponible: ${stockDisponible}` : isCombo ? 'Combo con descuento' : 'Receta con descuento'}
                        </div>

                        <div className="vcp-card__footer">
                          <span className="vcp-card__price">L. {precio.toFixed(2)}</span>

                          <button
                            type="button"
                            className="vcp-card__add-btn"
                            data-testid="ventas-catalog-add"
                            onClick={(event) => {
                              event.stopPropagation();
                              composer.addCatalogItem(kind, row, [], discountAddOptions);
                            }}
                            aria-label={`Agregar ${itemName} con descuento`}
                          >
                            Agregar +
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      ) : (
      <div className="ventas-create-modal__products ventas-catalog-grid">
        {catalogStatus === 'idle' ? null : (composer.currentCatalogLoading || catalogLoading) ? (
          <div className="ventas-create-modal__empty">
            <span className="spinner-border spinner-border-sm" aria-hidden="true" />
            <span>Cargando catalogo...</span>
          </div>
        ) : visibleCatalogRows.length === 0 ? (
          <div className="ventas-create-modal__empty">
            <i className="bi bi-search" />
            <span>
              {activeCatalogError
                ? 'No se pudo cargar este catalogo por un error de servidor/permisos.'
                : showOutOfStock
                  ? 'No hay items agotados para ese filtro.'
                : outOfStockCount > 0
                  ? 'Solo hay items agotados para ese filtro.'
                  : composer.activeCatalog === 'PRODUCTOS'
                    ? 'No hay productos.'
                    : 'No hay resultados para ese filtro.'}
            </span>
          </div>
        ) : (
          visibleCatalogRows.map((row) => {
            const isProducto = composer.activeCatalog === 'PRODUCTOS';
            const isCombo = composer.activeCatalog === 'COMBOS';
            const isExtra = composer.activeCatalog === 'EXTRAS';
            const kind = isProducto ? 'PRODUCTO' : isCombo ? 'COMBO' : isExtra ? 'ITEM' : 'RECETA';
            const itemId = isProducto ? row.id_producto : isCombo ? row.id_combo : isExtra ? row.id_extra : row.id_receta;
            const itemName = isProducto ? row.nombre_producto : isCombo ? (row.nombre_combo || row.descripcion || 'Combo') : isExtra ? row.nombre : row.nombre_receta;
            const imageSrc = resolveImageUrl(row);
            const precio = Number(row.precio || 0);
            const stockDisponible = isProducto ? Number(row.cantidad ?? 0) : null;
            const isOutOfStock = isExplicitlyOutOfStock(row, isProducto);
            const badgeDiscount = composer.getBestCatalogDiscount(kind, row);
            const badgeLabel = buildDiscountBadgeLabel(badgeDiscount);

            return (
              <div
                key={`${composer.activeCatalog}-${itemId}`}
                className={`vcp-card ventas-catalog-card-compact ${isOutOfStock ? 'is-out-of-stock' : ''}`}
                onClick={() => {
                  if (isOutOfStock) return;
                  composer.addCatalogItem(kind, row);
                }}
                data-testid="ventas-catalog-card"
                data-catalog-kind={kind}
                data-catalog-id={itemId}
                data-catalog-name={itemName}
                data-catalog-stock={stockDisponible ?? ''}
              >
                <div className="vcp-card__media">
                  {badgeLabel ? (
                    <span className="vcp-card__discount-badge">{badgeLabel}</span>
                  ) : null}
                  {imageSrc ? (
                    <img
                      src={imageSrc}
                      alt={itemName}
                      className="vcp-card__image"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                        const next = event.currentTarget.nextElementSibling;
                        if (next) next.classList.remove('d-none');
                      }}
                    />
                  ) : null}
                  <div className={`vcp-card__placeholder ${imageSrc ? 'd-none' : ''}`}>
                    <FaImage className="vcp-card__placeholder-icon" />
                  </div>
                </div>

                <div className="vcp-card__body">
                        <div className="vcp-card__meta-row">
                          <span className="vcp-card__kind">{isExtra ? 'EXTRA' : kind}</span>
                        </div>
                  <h6 className="vcp-card__name" title={itemName}>{itemName}</h6>

                  {isProducto ? (
                    <div className={`vcp-card__stock ${isOutOfStock ? 'is-empty' : ''}`}>
                      {isOutOfStock ? 'Agotado' : `Disponible: ${stockDisponible}`}
                    </div>
                  ) : (
                    <div className={`vcp-card__stock ${isOutOfStock ? 'is-empty' : ''}`}>
                      {isOutOfStock ? 'Agotado' : isCombo ? 'Combo con complementos' : isExtra ? 'Extra independiente' : 'Preparacion de cocina'}
                    </div>
                  )}

                  <div className="vcp-card__footer">
                    <span className="vcp-card__price">L. {precio.toFixed(2)}</span>

                    <button
                      type="button"
                      className="vcp-card__add-btn"
                      data-testid="ventas-catalog-add"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (isOutOfStock) return;
                        composer.addCatalogItem(kind, row);
                      }}
                      aria-label={`Agregar ${itemName}`}
                      disabled={isOutOfStock}
                    >
                      {isOutOfStock ? 'Sin stock' : 'Anadir +'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      )}
    </div>
  );
}
