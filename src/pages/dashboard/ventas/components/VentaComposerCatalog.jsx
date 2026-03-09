import { CATALOG_TABS } from '../hooks/useVentaComposer';

export default function VentaComposerCatalog({ composer, catalogLoading }) {
  return (
    <div className="ventas-create-modal__catalog">
      <div className="ventas-create-modal__catalog-tabs" role="tablist" aria-label="Tipos de venta">
        {CATALOG_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`ventas-create-modal__catalog-tab ${
              composer.activeCatalog === tab.key ? 'is-active' : ''
            }`}
            aria-pressed={composer.activeCatalog === tab.key}
            onClick={() => composer.setActiveCatalog(tab.key)}
          >
            <i className={tab.icon} /> {tab.label}
          </button>
        ))}
      </div>

      <label
        className="ventas-create-modal__search"
        aria-label={
          composer.activeCatalog === 'PRODUCTOS'
            ? 'Buscar producto'
            : composer.activeCatalog === 'COMBOS'
              ? 'Buscar combo'
              : 'Buscar receta'
        }
      >
        <i className="bi bi-search" />
        <input
          type="search"
          placeholder={
            composer.activeCatalog === 'PRODUCTOS'
              ? 'Buscar producto...'
              : composer.activeCatalog === 'COMBOS'
                ? 'Buscar combo...'
                : 'Buscar receta...'
          }
          value={composer.search}
          onChange={(event) => composer.setSearch(event.target.value)}
          onKeyDown={composer.handleSearchKeyDown}
        />
        <span className="ventas-create-modal__search-hint">/</span>
      </label>

      {composer.activeCatalog === 'PRODUCTOS' ? (
        <div className="ventas-create-modal__chips" aria-label="Categorias">
          <button
            type="button"
            className={`ventas-create-modal__chip ${
              composer.activeCategory === 'all' ? 'is-active' : ''
            }`}
            onClick={() => composer.setActiveCategory('all')}
          >
            Todos
          </button>
          {composer.categorias.map((categoria) => (
            <button
              key={categoria.id_tipo_departamento}
              type="button"
              className={`ventas-create-modal__chip ${
                String(composer.activeCategory) === String(categoria.id_tipo_departamento)
                  ? 'is-active'
                  : ''
              }`}
              onClick={() => composer.setActiveCategory(String(categoria.id_tipo_departamento))}
            >
              {categoria.nombre_departamento}
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
            const itemLabel = isProducto
              ? row.categoria_label
              : isCombo
                ? 'Combos'
                : row.nombre_producto_base || 'Recetas';

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
                <span className="ventas-create-modal__product-pill">{itemLabel}</span>
                <strong>{itemName}</strong>
                <span className="ventas-create-modal__product-price">
                  {composer.formatCurrency(row.precio)}
                </span>
                <span className="ventas-create-modal__product-desc">{itemDesc}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
