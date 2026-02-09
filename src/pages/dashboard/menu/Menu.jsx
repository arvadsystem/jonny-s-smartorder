import { useEffect, useState } from 'react'; // Hooks de React
import { apiFetch } from '../../../services/api'; // Servicio API del proyecto
import ProductoGrid from './ProductoGrid'; // Componente: grid de productos (HU-65)

// =====================================================
// HU 64 - Menú POS
// Visualizar categorías del menú (tipo_departamento)
// HU 65 - Menú POS
// Visualizar productos por categoría seleccionada
// =====================================================
const Menu = () => {
  const [categorias, setCategorias] = useState([]); // Categorías
  const [selected, setSelected] = useState(null); // Categoría seleccionada
  const [loading, setLoading] = useState(true); // Cargando categorías
  const [error, setError] = useState(''); // Error categorías

  const [productos, setProductos] = useState([]); // Productos por categoría (HU-65)
  const [loadingProductos, setLoadingProductos] = useState(false); // Cargando productos
  const [errorProductos, setErrorProductos] = useState(''); // Error productos

  useEffect(() => {
    const cargarCategorias = async () => {
      try {
        setLoading(true); // Activa loading categorías
        setError(''); // Limpia error categorías

        // Endpoint existente (HU-64)
        const data = await apiFetch('/tipo_departamento', 'GET'); // Obtiene categorías
        const lista = Array.isArray(data) ? data : []; // Asegura arreglo

        // Solo categorías activas
        const activas = lista.filter(
          (d) => d.estado === true || d.estado === 'true' || d.estado === 1
        ); // Filtra activas

        setCategorias(activas); // Guarda categorías
        setSelected(activas[0] || null); // Selecciona la primera (si existe)
      } catch (e) {
        setError(e?.message || 'Error al cargar categorías'); // Error controlado
      } finally {
        setLoading(false); // Finaliza loading categorías
      }
    };

    cargarCategorias(); // Ejecuta al montar
  }, []);

  // =====================================================
  // HU 65 - Cargar productos por categoría seleccionada
  // Endpoint: GET /menu-pos/productos/:id_tipo_departamento
  // =====================================================
  const cargarProductos = async (idTipoDepartamento) => {
    try {
      setLoadingProductos(true); // Activa loading productos
      setErrorProductos(''); // Limpia error productos

      // Llama al backend HU-65 (tu endpoint funcional)
      const resp = await apiFetch(`/menu-pos/productos/${idTipoDepartamento}`, 'GET'); // Obtiene productos

      // Soporta ambas respuestas:
      // 1) apiFetch devuelve [] directo
      // 2) apiFetch devuelve { ok, total, data: [] }
      const lista = Array.isArray(resp)
        ? resp
        : Array.isArray(resp?.data)
          ? resp.data
          : [];

      setProductos(lista); // Guarda productos
    } catch (e) {
      setErrorProductos(e?.message || 'Error al cargar productos'); // Error controlado
      setProductos([]); // Limpia productos si falla
    } finally {
      setLoadingProductos(false); // Finaliza loading productos
    }
  };

  // =====================================================
  // Cuando cambia la categoría seleccionada, cargamos productos (HU-65)
  // =====================================================
  useEffect(() => {
    if (selected?.id_tipo_departamento) {
      cargarProductos(selected.id_tipo_departamento); // Carga productos de esa categoría
    } else {
      setProductos([]); // Si no hay categoría, limpia productos
    }
  }, [selected]);

  // =====================================================
  // Acción rápida: Agregar al carrito (placeholder HU-66)
  // =====================================================
  const onAgregarProducto = (producto) => {
    // HU-66 lo conectamos con el carrito real
    console.log('Agregar al carrito (HU-66):', producto); // Debug
  };

  return (
    <div className="container-fluid p-3">
      <h4 className="mb-3">Menú</h4>

      {loading && <div className="alert alert-info">Cargando categorías...</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      {!loading && !error && (
        <div className="d-flex flex-wrap gap-2">
          {categorias.map((c) => {
            const active =
              Number(selected?.id_tipo_departamento) === Number(c.id_tipo_departamento);

            return (
              <button
                key={c.id_tipo_departamento}
                className={`btn btn-lg ${active ? 'btn-dark' : 'btn-outline-dark'}`}
                style={{ minWidth: 190, minHeight: 58 }}
                onClick={() => setSelected(c)} // Cambia categoría seleccionada
              >
                {c.nombre_departamento}
              </button>
            );
          })}
        </div>
      )}

      {/* Info categoría seleccionada */}
      {!loading && selected && (
        <div className="alert alert-secondary mt-4">
          Categoría seleccionada: <b>{selected.nombre_departamento}</b>
          <br />
          <small>HU 65: productos por categoría.</small>
        </div>
      )}

      {/* HU-65: Productos */}
      {!loading && !error && selected && (
        <div className="mt-3">
          {errorProductos && <div className="alert alert-danger">{errorProductos}</div>}

          <ProductoGrid
            productos={productos} // Lista de productos
            loading={loadingProductos} // Loading de productos
            onAgregar={onAgregarProducto} // Acción rápida (HU-66 luego)
          />

          {/* Debug temporal: confirma que están llegando productos */}
          <div className="mt-2">
            <small className="text-muted">Debug productos: {productos.length}</small>
          </div>
        </div>
      )}
    </div>
  );
};

export default Menu;