import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../services/api';

const normalizeText = (value) => (
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
);

const isMenuProductsDepartment = (name) => {
  const normalized = normalizeText(name);
  return (
    normalized.includes('cerveza') ||
    normalized.includes('refresco') ||
    normalized.includes('agua') ||
    normalized.includes('bebida') ||
    normalized.includes('helado') ||
    normalized.includes('snack')
  );
};

const isRowActive = (value) => (
  value === true ||
  value === 1 ||
  value === '1' ||
  String(value ?? '').trim().toLowerCase() === 'true'
);

const formatMoney = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 'L. --';
  return `L. ${parsed.toFixed(2)}`;
};

// Vista administrativa ligera de productos del menu alineada con el catalogo de Ventas.
const MenuProductosAdmin = () => {
  const [categorias, setCategorias] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [items, setItems] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadCategories = async () => {
      try {
        setLoadingCategories(true);
        setError('');

        // Reutiliza la misma fuente que Ventas para evitar desalineaciones.
        const rows = await apiFetch('/ventas/catalogos/tipo-departamento', 'GET');
        const normalizedRows = Array.isArray(rows) ? rows : [];
        const menuProductsRows = normalizedRows.filter((row) =>
          isMenuProductsDepartment(row?.nombre_departamento)
        );
        if (!isMounted) return;

        setCategorias(menuProductsRows);
      } catch (e) {
        if (!isMounted) return;
        setCategorias([]);
        setError(e?.message || 'No se pudieron cargar categorias de productos del menu.');
      } finally {
        if (isMounted) setLoadingCategories(false);
      }
    };

    void loadCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadItems = async () => {
      try {
        setLoadingItems(true);
        setError('');

        // Reutiliza /productos como en Ventas para mostrar el mismo catalogo operativo.
        const rows = await apiFetch('/productos', 'GET');
        const normalizedRows = Array.isArray(rows) ? rows : [];

        const filteredRows = normalizedRows
          .filter((row) => isRowActive(row?.estado))
          .filter((row) => {
            if (!selectedCategoryId) return true;
            return String(row?.id_tipo_departamento ?? '') === String(selectedCategoryId);
          });

        if (!isMounted) return;
        setItems(filteredRows);
      } catch (e) {
        if (!isMounted) return;
        setItems([]);
        setError(e?.message || 'No se pudieron cargar los productos del menu.');
      } finally {
        if (isMounted) setLoadingItems(false);
      }
    };

    void loadItems();

    return () => {
      isMounted = false;
    };
  }, [selectedCategoryId]);

  const categoriasById = useMemo(() => {
    const map = new Map();
    categorias.forEach((category) => {
      const id = Number(category?.id_tipo_departamento ?? 0);
      if (id > 0) map.set(id, category.nombre_departamento);
    });
    return map;
  }, [categorias]);

  const categoriesLabel = useMemo(() => {
    if (loadingCategories) return 'Cargando categorias...';
    return `${categorias.length} categorias de productos`;
  }, [categorias.length, loadingCategories]);

  return (
    <div className="card shadow-sm mb-3 inv-prod-card menu-productos-admin">
      <div className="card-header inv-prod-header">
        <div className="inv-prod-title-wrap">
          <div className="inv-prod-title-row">
            <i className="bi bi-cup-straw inv-prod-title-icon" />
            <span className="inv-prod-title">Productos Del Menu</span>
          </div>
          <div className="inv-prod-subtitle">
            Catalogo de productos del menu para control operativo (cervezas, refrescos, helados y snacks).
          </div>
        </div>

        <div className="inv-prod-header-actions">
          <span className="inv-prod-active-filter-pill">{categoriesLabel}</span>
        </div>
      </div>

      <div className="card-body">
        {error ? <div className="alert alert-danger mb-3">{error}</div> : null}

        <div className="menu-productos-admin__chips mb-3" role="tablist" aria-label="Filtrar por categoria de producto">
          <button
            type="button"
            className={`inv-prod-toolbar-btn ${selectedCategoryId ? '' : 'is-active'}`}
            onClick={() => setSelectedCategoryId('')}
            disabled={loadingCategories || loadingItems}
          >
            Todas
          </button>

          {categorias.map((category) => {
            const id = String(category.id_tipo_departamento);
            return (
              <button
                key={id}
                type="button"
                className={`inv-prod-toolbar-btn ${selectedCategoryId === id ? 'is-active' : ''}`}
                onClick={() => setSelectedCategoryId(id)}
                disabled={loadingCategories || loadingItems}
              >
                {category.nombre_departamento}
              </button>
            );
          })}
        </div>

        {loadingItems ? <div className="text-center py-3">Cargando productos...</div> : null}

        {!loadingItems && items.length === 0 ? (
          <div className="alert alert-warning mb-0">No hay productos disponibles para esta seleccion.</div>
        ) : null}

        {!loadingItems && items.length > 0 ? (
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Producto</th>
                  <th>Categoria</th>
                  <th>Precio</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const active = item?.estado !== false;
                  return (
                    <tr key={`menu-producto-${item.id_producto}`}>
                      <td>#{item.id_producto}</td>
                      <td>{item.nombre_producto || item.nombre || 'Producto'}</td>
                      <td>{categoriasById.get(Number(item?.id_tipo_departamento ?? 0)) || 'Sin categoria'}</td>
                      <td>{formatMoney(item.precio)}</td>
                      <td>
                        <span className={`menu-recetas-admin__estado-badge ${active ? 'is-active' : 'is-inactive'}`}>
                          {active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default MenuProductosAdmin;
