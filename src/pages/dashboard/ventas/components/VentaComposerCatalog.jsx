import { useRef, useState } from 'react';
import { FaImage } from 'react-icons/fa';
import { CATALOG_TABS } from '../hooks/useVentaComposer';

export default function VentaComposerCatalog({ composer, catalogLoading }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef(null);

  const handleSearchToggle = () => {
    setSearchOpen((prev) => {
      const next = !prev;
      if (next) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      } else {
        composer.setSearch('');
      }
      return next;
    });
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

        <div className="ventas-catalog__search-wrap" style={{ position: 'relative' }}>
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
            aria-label={searchOpen ? 'Limpiar filtros' : 'Abrir buscador'}
            title={searchOpen ? 'Limpiar filtros y cerrar' : 'Buscar y filtrar'}
          >
            <i className={searchOpen ? 'bi bi-x-lg' : 'bi bi-search'} />
          </button>

          {searchOpen && composer.activeCatalog === 'PRODUCTOS' && (
            <div className="ventas-catalog__search-popup" style={{ right: 0, left: 'auto' }}>
              <div className="ventas-catalog__categories-list">
                <div className="ventas-catalog__categories-label">Filtrar por categoría:</div>
                <button
                  type="button"
                  className={`ventas-catalog__category-item ${composer.activeCategory === 'all' ? 'is-selected' : ''}`}
                  onClick={() => composer.setActiveCategory('all')}
                >
                  <span>Todos los productos</span>
                  {composer.activeCategory === 'all' && <i className="bi bi-check2" />}
                </button>

                {composer.categorias.map((categoria) => {
                  const isSelected = String(composer.activeCategory) === String(categoria.id_categoria_producto);
                  return (
                    <button
                      key={categoria.id_categoria_producto}
                      type="button"
                      className={`ventas-catalog__category-item ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => composer.setActiveCategory(String(categoria.id_categoria_producto))}
                    >
                      <span>{categoria.nombre_categoria}</span>
                      {isSelected && <i className="bi bi-check2" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {composer.activeCatalog !== 'PRODUCTOS' && (
        <div className="ventas-create-modal__catalog-hint" style={{ marginTop: '10px' }}>
          {composer.activeCatalog === 'COMBOS'
            ? 'Los combos y recetas generan pedido para cocina.'
            : 'Las notas por item solo se guardan para cocina.'}
        </div>
      )}

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
            const itemId = isProducto ? row.id_producto : isCombo ? row.id_combo : row.id_receta;
            const itemName = isProducto ? row.nombre_producto : isCombo ? row.descripcion : row.nombre_receta;
            const imageSrc = resolveImageUrl(row);
            const precio = Number(row.precio || 0);
            const stockDisponible = isProducto ? Number(row.cantidad ?? 0) : null;
            const isOutOfStock = isProducto ? stockDisponible <= 0 : false;

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
