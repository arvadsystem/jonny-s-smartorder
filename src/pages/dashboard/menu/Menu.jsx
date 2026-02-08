import { useEffect, useState } from 'react'; // Hooks de React
import { apiFetch } from '../../../services/api'; // Servicio API del proyecto

// =====================================================
// HU 64 - Menú POS
// Visualizar categorías del menú (tipo_departamento)
// =====================================================
const Menu = () => {
  const [categorias, setCategorias] = useState([]); // Categorías
  const [selected, setSelected] = useState(null); // Categoría seleccionada
  const [loading, setLoading] = useState(true); // Cargando
  const [error, setError] = useState(''); // Error

  useEffect(() => {
    const cargarCategorias = async () => {
      try {
        setLoading(true);
        setError('');

        // Endpoint existente
        const data = await apiFetch('/tipo_departamento', 'GET');

        const lista = Array.isArray(data) ? data : [];

        // Solo categorías activas
        const activas = lista.filter(
          (d) => d.estado === true || d.estado === 'true' || d.estado === 1
        );

        setCategorias(activas);
        setSelected(activas[0] || null);
      } catch (e) {
        setError(e?.message || 'Error al cargar categorías');
      } finally {
        setLoading(false);
      }
    };

    cargarCategorias();
  }, []);

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
                onClick={() => setSelected(c)}
              >
                {c.nombre_departamento}
              </button>
            );
          })}
        </div>
      )}

      {!loading && selected && (
        <div className="alert alert-secondary mt-4">
          Categoría seleccionada: <b>{selected.nombre_departamento}</b>
          <br />
          <small>Próximo paso: productos por categoría (HU 65).</small>
        </div>
      )}
    </div>
  );
};

export default Menu;