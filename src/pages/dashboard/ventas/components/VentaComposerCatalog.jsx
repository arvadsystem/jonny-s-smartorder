import { useRef, useState } from 'react';
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

  return (
    <div className="ventas-create-modal__catalog">
      {/* Tabs + buscador colapsable en la misma fila */}
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

        {/* Buscador colapsable */}
        <div className={`ventas-catalog__search-wrap ${searchOpen ? 'is-open' : ''}`}>
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
            aria-label={searchOpen ? 'Cerrar buscador' : 'Abrir buscador'}
            title={searchOpen ? 'Cerrar' : 'Buscar'}
          >
            <i className={searchOpen ? 'bi bi-x-lg' : 'bi bi-search'} />
          </button>
        </div>
      </div>

      {/* Chips de categorías o hint */}
      {composer.activeCatalog === 'PRODUCTOS' ? (
        <div className="ventas-create-modal__chips" aria-label="Categorias">
          <button
            type="button"
            className={`ventas-create-modal__chip ${composer.activeCategory === 'all' ? 'is-active' : ''}`}
            onClick={() => composer.setActiveCategory('all')}
          >
            Todos
          </button>
          {composer.categorias.map((categoria) => (
            <button
              key={categoria.id_categoria_producto}
              type="button"
              className={`ventas-create-modal__chip ${String(composer.activeCategory) === String(categoria.id_categoria_producto) ? 'is-active' : ''}`}
              onClick={() => composer.setActiveCategory(String(categoria.id_categoria_producto))}
            >
              {categoria.nombre_categoria}
            </button>
          ))}
        </div>
      ) : (
        <div className="ventas-create-modal__catalog-hint">
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
            const itemDesc = isProducto
              ? row.descripcion_producto || row.categoria_label
              : isCombo
                ? row.descripcion
                : row.nombre_producto_base || row.nombre_receta;

            return (
              <button
                key={`${composer.activeCatalog}-${itemId}`}
                type="button"
                className="ventas-create-modal__product-card"
                onClick={() =>
                  composer.addCatalogItem(
                    isProducto ? 'PRODUCTO' : isCombo ? 'COMBO' : 'RECETA',
                    row
                  )
                }
              >
                <div className="ventas-create-modal__product-image">
                  {row.imagen_principal_url ? (
                    <img src={row.imagen_principal_url} alt={itemName} loading="lazy" />
                  ) : (
                    <div className="ventas-create-modal__product-image-placeholder" />
                  )}
                </div>
                <div className="ventas-create-modal__product-info">
                  <div className="ventas-create-modal__product-title">
                    <strong>{itemName}</strong> {isProducto && itemDesc && <span>{itemDesc}</span>}
                  </div>
                  <div className="ventas-create-modal__product-action-row">
                    <span className="ventas-create-modal__product-price">
                      {composer.formatCurrency(row.precio)}
                    </span>
                    <span className="ventas-create-modal__product-add-btn">Añadir</span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
