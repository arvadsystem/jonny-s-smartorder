import ProductoCard from './ProductoCard'; // Tarjeta individual

// =====================================================
// HU 65 - Grid de productos (POS)
// Renderiza tarjetas en layout tipo POS
// =====================================================
const ProductoGrid = ({ productos, loading, onAgregar }) => {
  // Cargando productos
  if (loading) {
    return <div className="alert alert-info">Cargando productos...</div>;
  }

  // Sin productos
  if (!productos || productos.length === 0) {
    return <div className="alert alert-warning">No hay productos en esta categoría.</div>;
  }

  // Grid de tarjetas
  return (
    <div className="row g-3">
      {productos.map((p) => (
        <div className="col-6 col-md-4 col-lg-3" key={p.id_producto}>
          <ProductoCard producto={p} onAgregar={onAgregar} />
        </div>
      ))}
    </div>
  );
};

export default ProductoGrid;