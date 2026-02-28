// =====================================================
// HU 65 - Tarjeta de producto (POS)
// Muestra nombre + precio + botón rápido
// =====================================================
const ProductoCard = ({ producto, onAgregar }) => {
  const nombre = producto?.nombre_producto || producto?.descripcion || 'Producto sin nombre';
  const precio = Number(producto?.precio || 0);
  const imageSrc = String(producto?.url_imagen || '').trim();
  const descripcion = producto?.descripcion_producto || producto?.descripcion || '';

  return (
    <div className="card h-100 shadow-sm menu-pos-product-card">
      <div className="menu-pos-product-media">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={nombre}
            className="menu-pos-product-image"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const next = e.currentTarget.nextElementSibling;
              if (next) next.classList.remove('d-none');
            }}
          />
        ) : null}
        <div className={`menu-pos-product-placeholder ${imageSrc ? 'd-none' : ''}`}>
          <i className="bi bi-image fs-4" />
          <span>Sin imagen</span>
        </div>
      </div>

      <div className="card-body d-flex flex-column menu-pos-product-body">
        <div className="menu-pos-product-copy">
          <h6 className="card-title mb-0 menu-pos-product-name">{nombre}</h6>
          <div className="text-muted small">{descripcion || 'Disponible en menu POS'}</div>
        </div>

        <div className="menu-pos-product-footer">
          <div className="menu-pos-product-price">
            L {precio.toFixed(2)}
          </div>

          <button
            type="button"
            className="btn btn-primary btn-sm w-100 menu-pos-add-btn"
            onClick={() => onAgregar(producto)}
          >
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductoCard;
