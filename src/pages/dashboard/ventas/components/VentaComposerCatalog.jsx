import { useEffect, useRef, useState } from 'react';
import { FaImage } from 'react-icons/fa';
import { CATALOG_TABS } from '../hooks/useVentaComposer';

const buildDiscountBadgeLabel = (discount) => {
  if (!discount) return null;
  const type = String(discount.nombre_tipo_descuento || '').toUpperCase();
  const value = Number(discount.valor_descuento ?? 0);
  if (value <= 0) return 'Promo';
  if (type.includes('PORCENTAJE')) return `-${value.toFixed(0)}%`;
  return `L ${value.toFixed(0)} OFF`;
};

export default function VentaComposerCatalog({ composer, catalogLoading, catalogErrors = {} }) {
  const [filterOpen, setFilterOpen] = useState(false);
  const searchWrapRef = useRef(null);
  const hasFilters = composer.search.trim() !== '' || composer.activeCategory !== 'all';
  const searchPlaceholder = composer.activeCatalog === 'PRODUCTOS'
    ? 'Buscar productos...'
    : composer.activeCatalog === 'COMBOS'
      ? 'Buscar combos...'
      : 'Buscar recetas...';

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

  const handleClearFilters = () => {
    composer.setSearch('');
    composer.setActiveCategory('all');
    setFilterOpen(false);
  };

  const resolveImageUrl = (row) => row.imagen_principal_url || row.url_imagen || null;

  const activeCatalogError = (() => {
    if (composer.activeCatalog === 'PRODUCTOS') return catalogErrors.productos || null;
    if (composer.activeCatalog === 'COMBOS') return catalogErrors.combos || null;
    return catalogErrors.recetas || null;
  })();
  const hasCatalogErrors = Object.keys(catalogErrors || {}).length > 0;

  return (
    <div className="ventas-create-modal__catalog ventas-caja-layout__catalog">
      <div className="ventas-catalog__topbar ventas-catalog-toolbar ventas-catalog-compact-toolbar">
        <label className="ventas-catalog-dropdown">
          <span>Catálogo:</span>
          <select
            value={composer.activeCatalog}
            onChange={(event) => composer.setActiveCatalog(event.target.value)}
          >
            {CATALOG_TABS.map((tab) => (
              <option key={tab.key} value={tab.key}>
                {tab.label}
              </option>
            ))}
          </select>
        </label>

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

          <button
            type="button"
            className={`ventas-catalog__search-btn ${filterOpen ? 'is-active' : ''}`}
            onClick={() => setFilterOpen((current) => !current)}
            aria-label="Abrir filtros"
            title="Filtrar catálogo"
          >
            <i className="bi bi-sliders" />
          </button>

          {hasFilters ? (
            <button
              type="button"
              className="ventas-catalog__clear-btn"
              onClick={handleClearFilters}
              aria-label="Limpiar búsqueda y filtros"
              title="Limpiar búsqueda y filtros"
            >
              <i className="bi bi-x-lg" />
            </button>
          ) : null}

          {filterOpen ? (
            <div className="ventas-catalog__search-popup">
              <div className="ventas-catalog__categories-list">
                <div className="ventas-catalog__categories-label">
                  {composer.activeCatalog === 'PRODUCTOS' ? 'FILTRAR POR CATEGORÍA:' : 'FILTRAR POR DEPARTAMENTO:'}
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
        {catalogLoading ? 'Cargando catálogo...' : composer.resultsLabel}
      </div>
      {activeCatalogError ? (
        <div className="ventas-create-modal__error">
          {`Error en ${activeCatalogError.endpoint}${activeCatalogError.status ? ` (HTTP ${activeCatalogError.status})` : ''}: ${activeCatalogError.message}`}
        </div>
      ) : null}
      {!activeCatalogError && hasCatalogErrors ? (
        <div className="ventas-create-modal__error">
          Algunos catálogos auxiliares no cargaron. Productos, combos y recetas disponibles siguen habilitados.
        </div>
      ) : null}

      <div className="ventas-create-modal__products ventas-catalog-grid">
        {catalogLoading ? (
          <div className="ventas-create-modal__empty">
            <span className="spinner-border spinner-border-sm" aria-hidden="true" />
            <span>Cargando catálogo...</span>
          </div>
        ) : composer.currentCatalogRows.length === 0 ? (
          <div className="ventas-create-modal__empty">
            <i className="bi bi-search" />
            <span>
              {activeCatalogError
                ? 'No se pudo cargar este catálogo por un error de servidor/permisos.'
                : 'No hay resultados para ese filtro.'}
            </span>
          </div>
        ) : (
          composer.currentCatalogRows.map((row) => {
            const isProducto = composer.activeCatalog === 'PRODUCTOS';
            const isCombo = composer.activeCatalog === 'COMBOS';
            const kind = isProducto ? 'PRODUCTO' : isCombo ? 'COMBO' : 'RECETA';
            const itemId = isProducto ? row.id_producto : isCombo ? row.id_combo : row.id_receta;
            const itemName = isProducto ? row.nombre_producto : isCombo ? row.descripcion : row.nombre_receta;
            const imageSrc = resolveImageUrl(row);
            const precio = Number(row.precio || 0);
            const stockDisponible = isProducto ? Number(row.cantidad ?? 0) : null;
            const isOutOfStock = isProducto ? stockDisponible <= 0 : false;
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
                  </div>
                  <h6 className="vcp-card__name" title={itemName}>{itemName}</h6>

                  {isProducto ? (
                    <div className={`vcp-card__stock ${isOutOfStock ? 'is-empty' : ''}`}>
                      {isOutOfStock ? 'Agotado' : `Disponible: ${stockDisponible}`}
                    </div>
                  ) : (
                    <div className="vcp-card__stock">
                      {isCombo ? 'Combo con complementos' : 'Preparación de cocina'}
                    </div>
                  )}

                  <div className="vcp-card__footer">
                    <span className="vcp-card__price">L. {precio.toFixed(2)}</span>

                    <button
                      type="button"
                      className="vcp-card__add-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (isOutOfStock) return;
                        composer.addCatalogItem(kind, row);
                      }}
                      aria-label={`Agregar ${itemName}`}
                      disabled={isOutOfStock}
                    >
                      {isOutOfStock ? 'Sin stock' : 'Añadir +'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
