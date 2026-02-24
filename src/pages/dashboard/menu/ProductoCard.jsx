// =====================================================
// HU 65 - Tarjeta de producto (POS)
// Muestra nombre + precio + botón rápido
// =====================================================
const ProductoCard = ({ producto, onAgregar }) => {
  const nombre = producto?.nombre_producto || 'Producto sin nombre';
  const precio = Number(producto?.precio || 0);

  return (
    <div className="card h-100 shadow-sm">
      <div className="card-body d-flex flex-column justify-content-between">
        {/* Nombre del producto */}
        <h6 className="card-title mb-2">{producto.nombre_producto}</h6>

        {/* Precio */}
        <div className="fw-bold mb-3">
          L {Number(producto.precio || 0).toFixed(2)}
        </div>

        {/* Acción rápida (HU-66 lo conecta a carrito real) */}
        <button
          type="button"
          className="btn btn-primary btn-sm w-100"
          onClick={() => onAgregar(producto)}
        >
          Agregar
        </button>
      </div>
    </div>
  );
};

export default ProductoCard;
