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

export default function VentaComposerCatalog({ composer, catalogLoading }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef(null);
  const searchWrapRef = useRef(null);

  const hasFilters = composer.search.trim() !== '' || composer.activeCategory !== 'all';
  const showX = searchOpen || hasFilters;

  useEffect(() => {
    if (!searchOpen) return undefined;
    const handleOutsideClick = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [searchOpen]);

  const handleSearchToggle = () => {
    if (showX) {
      setSearchOpen(false);
      composer.setSearch('');
      composer.setActiveCategory('all');
    } else {
      setSearchOpen(true);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  };

  const resolveImageUrl = (row) => {
    return row.imagen_principal_url || row.url_imagen || null;
  };

  return (
    <div className="ventas-create-modal__catalog">
      <div className="ventas-catalog__topbar">
        <div className="ventas-create-modal__catalog-tabs" role="tablist" aria-label="Tipos de venta">
          {CATALOG_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`ventas-create-modal__catalog-tab ${composer.activeCatalog === tab.key ? 'is-active' : ''}`}
              aria-pressed={composer.activeCatalog === tab.key}
              onClick={() => composer.setActiveCatalog(tab.key)}
            >
              <i className={tab.icon} /> {tab.label}
            </button>
          ))}
        </div>

        <div className="ventas-catalog__search-wrap" style={{ position: 'relative' }} ref={searchWrapRef}>
          {searchOpen && (
            <input
              ref={searchInputRef}
              type="search"
              className="ventas-catalog__search-input"
              placeholder={
                composer.activeCatalog === 'PRODUCTOS'
                  ? 'Buscar producto...'
                  : composer.activeCatalog === 'COMBOS'
                    ? 'Buscar combo...'
                    : 'Buscar receta...'
              }
              value={composer.search}
              onChange={(e) => composer.setSearch(e.target.value)}
              onKeyDown={composer.handleSearchKeyDown}
            />
          )}

          <button
            type="button"
            className="ventas-catalog__search-btn"
            onClick={handleSearchToggle}
            aria-label={showX ? 'Limpiar filtros' : 'Abrir buscador'}
            title={showX ? 'Limpiar filtros y cerrar' : 'Buscar y filtrar'}
          >
            <i className={showX ? 'bi bi-x-lg' : 'bi bi-search'} />
          </button>

          {searchOpen && (
            <div className="ventas-catalog__search-popup" style={{ right: 0, left: 'auto' }}>
              <div className="ventas-catalog__categories-list">
                <div className="ventas-catalog__categories-label">
                  {composer.activeCatalog === 'PRODUCTOS' ? 'FILTRAR POR CATEGORÍA:' : 'FILTRAR POR DEPARTAMENTO:'}
                </div>
                <button
                  type="button"
                  className={`ventas-catalog__category-item ${composer.activeCategory === 'all' ? 'is-selected' : ''}`}
                  onClick={() => {
                    composer.setActiveCategory('all');
                    setSearchOpen(false);
                  }}
                >
                  <span>{composer.activeCatalog === 'PRODUCTOS' ? 'Todos los productos' : 'Todos los departamentos'}</span>
                  {composer.activeCategory === 'all' && <i className="bi bi-check2" />}
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
                            setSearchOpen(false);
                          }}
                        >
                          <span>{categoria.nombre_categoria}</span>
                          {isSelected && <i className="bi bi-check2" />}
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
                            setSearchOpen(false);
                          }}
                        >
                          <span>{tipo.nombre_tipo_departamento}</span>
                          {isSelected && <i className="bi bi-check2" />}
                        </button>
                      );
                    })
                }
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="ventas-create-modal__results-meta">
        {catalogLoading ? 'Cargando catalogo...' : composer.resultsLabel}
      </div>

      <div className="ventas-create-modal__products">
        {catalogLoading ? (
          <div className="ventas-create-modal__empty">
            <span className="spinner-border spinner-border-sm" aria-hidden="true" />
            <span>Cargando catalogo...</span>
          </div>
        ) : composer.currentCatalogRows.length === 0 ? (
          <div className="ventas-create-modal__empty">
            <i className="bi bi-search" />
            <span>No hay resultados para ese filtro.</span>
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
                className={`vcp-card ${isOutOfStock ? 'is-out-of-stock' : ''}`}
                onClick={() => {
                  if (isOutOfStock) return;
                  composer.addCatalogItem(
                    isProducto ? 'PRODUCTO' : isCombo ? 'COMBO' : 'RECETA',
                    row
                  );
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
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const next = e.currentTarget.nextElementSibling;
                        if (next) next.classList.remove('d-none');
                      }}
                    />
                  ) : null}
                  <div className={`vcp-card__placeholder ${imageSrc ? 'd-none' : ''}`}>
                    <FaImage className="vcp-card__placeholder-icon" />
                  </div>
                </div>

                <div className="vcp-card__body">
                  <h6 className="vcp-card__name" title={itemName}>{itemName}</h6>

                  {isProducto ? (
                    <div className={`vcp-card__stock ${isOutOfStock ? 'is-empty' : ''}`}>
                      {isOutOfStock ? 'Agotado' : `Existencia: ${stockDisponible}`}
                    </div>
                  ) : null}

                  <div className="vcp-card__footer">
                    <span className="vcp-card__price">L. {precio.toFixed(2)}</span>

                    <button
                      type="button"
                      className="vcp-card__add-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isOutOfStock) return;
                        composer.addCatalogItem(
                          isProducto ? 'PRODUCTO' : isCombo ? 'COMBO' : 'RECETA',
                          row
                        );
                      }}
                      aria-label={`Agregar ${itemName}`}
                      disabled={isOutOfStock}
                    >
                      {isOutOfStock ? 'Sin stock' : 'Añadir'}
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
