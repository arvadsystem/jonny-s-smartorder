import { memo } from 'react';
import ProductoCard from './ProductoCard';

const ProductoGrid = ({ productos, loading, onAgregar, onOpenDetail, canAdd = true, canViewDetail = true }) => {
  if (loading) {
    return (
      <div className="inv-catpro-loading" role="status" aria-live="polite">
        <span className="spinner-border spinner-border-sm" aria-hidden="true" />
        <span>Cargando productos...</span>
      </div>
    );
  }

  if (!productos || productos.length === 0) {
    return (
      <div className="inv-catpro-empty">
        <div className="inv-catpro-empty-icon">
          <i className="bi bi-grid-3x3-gap-fill" />
        </div>
        <div className="inv-catpro-empty-title">No hay productos en esta categoria</div>
        <div className="inv-catpro-empty-sub">
          Selecciona otra categoria o verifica la configuracion del menu.
        </div>
      </div>
    );
  }

  return (
    <div className="row row-cols-2 row-cols-md-3 row-cols-lg-4 row-cols-xl-5 g-3">
      {productos.map((producto) => (
        <div
          className="col d-flex"
          key={
            producto.id_combo
              ? `combo-${producto.id_combo}`
              : producto.id_receta
                ? `receta-${producto.id_receta}`
                : `producto-${producto.id_producto}`
          }
        >
          <ProductoCard
            producto={producto}
            onAgregar={onAgregar}
            onOpenDetail={onOpenDetail}
            canAdd={canAdd}
            canViewDetail={canViewDetail}
          />
        </div>
      ))}
    </div>
  );
};

export default memo(ProductoGrid);
