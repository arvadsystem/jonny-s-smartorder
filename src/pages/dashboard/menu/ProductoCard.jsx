// HU-65 - Tarjeta de producto (POS)
const ProductoCard = ({ producto, onAgregar }) => {
  return (
    <div className="card h-100 shadow-sm">
      <div className="card-body d-flex flex-column justify-content-between">
        {/* Nombre */}
        <h6 className="card-title mb-2">
          {producto.nombre_producto}
        </h6>

        {/* Precio */}
        <div className="fw-bold mb-3">
          L {Number(producto.precio).toFixed(2)}
        </div>

        {/* Acción rápida (HU-66 después) */}
        <button
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