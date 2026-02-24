import { useEffect, useState } from 'react';
import { apiFetch } from '../../../services/api';
import ProductoGrid from './ProductoGrid';

const normalizeCategoriaNombre = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const getCategoriaDisplayName = (nombre) => {
  const n = normalizeCategoriaNombre(nombre);

  if (n.includes('perro caliente') || n.includes('perros calientes')) {
    return 'Hot dog';
  }

  return nombre || 'Categoria';
};

const getCategoriaEmoji = (nombre) => {
  const n = normalizeCategoriaNombre(nombre);

  if (!n) return '\u{1F37D}\uFE0F'; // 🍽️
  if (n.includes('hamburgues')) return '\u{1F354}'; // 🍔
  if (n.includes('taco') || n.includes('birria')) return '\u{1F32E}'; // 🌮
  if (
    n.includes('hot dog') ||
    n.includes('hotdog') ||
    n.includes('perro caliente') ||
    n.includes('perros calientes')
  ) {
    return '\u{1F32D}'; // 🌭
  }
  if (n.includes('alita') || n.includes('tender') || n.includes('boneless')) return '\u{1F357}'; // 🍗
  if (n.includes('jugo')) return '\u{1F9C3}'; // 🧃
  if (n.includes('refresco') || n.includes('bebida') || n.includes('soda')) return '\u{1F964}'; // 🥤
  if (n.includes('agua')) return '\u{1F4A7}'; // 💧
  if (n.includes('cerveza') || n.includes('beer')) return '\u{1F37A}'; // 🍺
  if (n.includes('salsa')) return '\u{1F336}\uFE0F'; // 🌶️
  if (n.includes('snack') || n.includes('nacho') || n.includes('papa') || n.includes('botana')) return '\u{1F35F}'; // 🍟
  if (n.includes('sarita') || n.includes('helado') || n.includes('ice cream')) return '\u{1F366}'; // 🍦
  if (n.includes('postre') || n.includes('dessert')) return '\u{1F370}'; // 🍰
  if (n.includes('cafe') || n.includes('coffee')) return '\u{2615}'; // ☕
  if (n.includes('pizza')) return '\u{1F355}'; // 🍕

  return '\u{1F37D}\uFE0F'; // 🍽️
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
        const label = getCategoriaDisplayName(categoria?.nombre_departamento);

        return (
          <button
            key={categoria.id_tipo_departamento}
            type="button"
            aria-pressed={isActive}
            className={`inv-prod-toolbar-btn menu-pos-cat-chip ${isActive ? 'is-on' : ''}`}
            onClick={() => onSelect(categoria)}
            title={label}
          >
            <CategoryIcon
              nombre={categoria?.nombre_departamento}
              className="menu-pos-cat-icon"
            />
            <span className="menu-pos-cat-label text-truncate">{label}</span>
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

  const selectedLabel = getCategoriaDisplayName(selected?.nombre_departamento);

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
              <span className="inv-prod-active-filter-pill">{categorias.length} categorias</span>
            ) : null}
          </div>
        </div>

        <div className="card-body">
          {error && <div className="alert alert-danger mb-3">{error}</div>}

          {!loading && !error && (
            <CategorySelector
              categorias={categorias}
              selected={selected}
              onSelect={setSelected}
            />
          )}

          {!loading && selected && (
            <div className="alert alert-secondary mt-3 mb-0">
              Categoria seleccionada: <b>{selectedLabel}</b>
            </div>
          )}
        </div>
      </div>

      {!loading && !error && selected && (
        <div className="mt-3">
          {errorProductos && <div className="alert alert-danger">{errorProductos}</div>}

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
