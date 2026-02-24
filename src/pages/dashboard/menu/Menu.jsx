import { useEffect, useState } from 'react';
import { apiFetch } from '../../../services/api';
import ProductoGrid from './ProductoGrid';

const normalizeCategoriaNombre = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const getCategoriaEmoji = (nombre) => {
  const n = normalizeCategoriaNombre(nombre);

  if (!n) return '🍽️';
  if (n.includes('hamburgues')) return '🍔';
  if (n.includes('taco') || n.includes('birria')) return '🌮';
  if (n.includes('hot dog') || n.includes('hotdog')) return '🌭';
  if (n.includes('alita') || n.includes('tender') || n.includes('boneless')) return '🍗';
  if (n.includes('jugo')) return '🧃';
  if (n.includes('refresco') || n.includes('bebida') || n.includes('soda')) return '🥤';
  if (n.includes('agua')) return '💧';
  if (n.includes('cerveza') || n.includes('beer')) return '🍺';
  if (n.includes('salsa')) return '🌶️';
  if (n.includes('snack') || n.includes('nacho') || n.includes('papa')) return '🍟';
  if (n.includes('sarita') || n.includes('helado') || n.includes('ice cream')) return '🍦';
  if (n.includes('postre') || n.includes('dessert')) return '🍰';
  if (n.includes('cafe') || n.includes('coffee')) return '☕';
  if (n.includes('pizza')) return '🍕';

  return '🍽️';
};

const CategoryIcon = ({ nombre, className }) => (
  <span className={className} aria-hidden="true">
    {getCategoriaEmoji(nombre)}
  </span>
);

const CategorySelector = ({ categorias, selected, onSelect }) => {
  return (
    <div className="menu-pos-cat-strip" aria-label="Categorias del menu POS">
      {categorias.map((categoria) => {
        const isActive =
          Number(selected?.id_tipo_departamento) ===
          Number(categoria?.id_tipo_departamento);

        return (
          <button
            key={categoria.id_tipo_departamento}
            type="button"
            aria-pressed={isActive}
            className={`inv-prod-toolbar-btn menu-pos-cat-chip ${isActive ? 'is-on' : ''}`}
            onClick={() => onSelect(categoria)}
            title={categoria?.nombre_departamento || 'Categoria'}
          >
            <CategoryIcon
              nombre={categoria?.nombre_departamento}
              className="menu-pos-cat-icon"
            />
            <span className="menu-pos-cat-label text-truncate">
              {categoria?.nombre_departamento || 'Categoria'}
            </span>
          </button>
        );
      })}
    </div>
  );
};

const Menu = () => {
  const [categorias, setCategorias] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [productos, setProductos] = useState([]);
  const [loadingProductos, setLoadingProductos] = useState(false);
  const [errorProductos, setErrorProductos] = useState('');

  useEffect(() => {
    const cargarCategorias = async () => {
      try {
        setLoading(true);
        setError('');

        const data = await apiFetch('/tipo_departamento', 'GET');
        const lista = Array.isArray(data) ? data : [];
        const activas = lista
          .filter((d) => d.estado === true || d.estado === 'true' || d.estado === 1)
          .filter(
            (d) =>
              String(d?.nombre_departamento || '')
                .trim()
                .toUpperCase() !== 'QA POST'
          );

        setCategorias(activas);
        setSelected(activas[0] || null);
      } catch (e) {
        setError(e?.message || 'Error al cargar categorias');
      } finally {
        setLoading(false);
      }
    };

    cargarCategorias();
  }, []);

  const cargarProductos = async (idTipoDepartamento) => {
    try {
      setLoadingProductos(true);
      setErrorProductos('');

      const resp = await apiFetch(`/menu-pos/productos/${idTipoDepartamento}`, 'GET');
      const lista = Array.isArray(resp)
        ? resp
        : Array.isArray(resp?.data)
          ? resp.data
          : [];

      setProductos(lista);
    } catch (e) {
      setErrorProductos(e?.message || 'Error al cargar productos');
      setProductos([]);
    } finally {
      setLoadingProductos(false);
    }
  };

  useEffect(() => {
    if (selected?.id_tipo_departamento) {
      cargarProductos(selected.id_tipo_departamento);
      return;
    }

    setProductos([]);
    setErrorProductos('');
  }, [selected]);

  const onAgregarProducto = (producto) => {
    console.log('Agregar al carrito (HU-66):', producto);
  };

  return (
    <div className="container-fluid p-3">
      <div className="card shadow-sm mb-3 inv-prod-card menu-pos-shell">
        <div className="card-header inv-prod-header">
          <div className="inv-prod-title-wrap">
            <div className="inv-prod-title-row">
              <i className="bi bi-shop inv-prod-title-icon" />
              <span className="inv-prod-title">Menu POS</span>
            </div>
            <div className="inv-prod-subtitle">
              Seleccion de categorias y productos para venta rapida
            </div>
          </div>

          <div className="inv-prod-header-actions">
            {!loading ? (
              <span className="inv-prod-active-filter-pill">
                {categorias.length} categorias
              </span>
            ) : null}
          </div>
        </div>

        <div className="card-body">
          {/* Error categorías */}
          {error && <div className="alert alert-danger mb-3">{error}</div>}

          {/* Categorías */}
          {!loading && !error && (
            <CategorySelector
              categorias={categorias}
              selected={selected}
              onSelect={setSelected}
            />
          )}

          {/* Info categoría seleccionada */}
          {!loading && selected && (
            <div className="alert alert-secondary mt-3 mb-0">
              Categoría seleccionada: <b>{selected.nombre_departamento}</b>
            </div>
          )}
        </div>
      </div>

      {/* HU-65: Productos */}
      {!loading && !error && selected && (
        <div className="mt-3">
          {errorProductos && (
            <div className="alert alert-danger">{errorProductos}</div>
          )}

          <ProductoGrid
            productos={productos}
            loading={loadingProductos}
            onAgregar={onAgregarProducto}
          />
        </div>
      )}
    </div>
  );
};

export default Menu;
