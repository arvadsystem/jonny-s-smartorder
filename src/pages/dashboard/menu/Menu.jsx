import { useCallback, useEffect, useState } from 'react';
import {
  FaBeer,
  FaBirthdayCake,
  FaCoffee,
  FaCookieBite,
  FaDrumstickBite,
  FaGlassWhiskey,
  FaHamburger,
  FaHotdog,
  FaIceCream,
  FaPepperHot,
  FaPizzaSlice,
  FaTags,
  FaTint,
  FaUtensils,
} from 'react-icons/fa';
import { GiTacos } from 'react-icons/gi';
import '../../../assets/styles/_menu.scss';
import { apiFetch } from '../../../services/api';
import ProductDetailOverlay from './ProductDetailOverlay';
import ProductoGrid from './ProductoGrid';
import RecetasAdmin from './RecetasAdmin';
import { toDisplayTitle } from './textFormat';

const normalizeCategoriaNombre = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const getCategoriaDisplayName = (nombre) => {
  const n = normalizeCategoriaNombre(nombre);

  if (n.includes('perro caliente') || n.includes('perros calientes')) {
    return 'Hot Dog';
  }

  return toDisplayTitle(nombre || 'Categoria');
};

const getCatalogItemPriority = (item) => {
  if (item?.id_combo) return 3;
  if (item?.id_receta) return 2;
  if (item?.id_producto) return 1;
  return 0;
};

const getCatalogItemIdentity = (item) => {
  if (item?.id_combo) return `combo-${item.id_combo}`;
  if (item?.id_producto) return `producto-${item.id_producto}`;
  if (item?.id_receta) return `receta-${item.id_receta}`;

  return [
    normalizeCategoriaNombre(item?.nombre_producto),
    Number(item?.precio || 0),
    Number(item?.id_tipo_departamento || 0),
  ].join('|');
};

const dedupeCatalogItems = (items) => {
  const map = new Map();

  for (const item of Array.isArray(items) ? items : []) {
    const key = getCatalogItemIdentity(item);
    const current = map.get(key);

    if (!current) {
      map.set(key, item);
      continue;
    }

    const nextPriority = getCatalogItemPriority(item);
    const currentPriority = getCatalogItemPriority(current);

    if (nextPriority > currentPriority) {
      map.set(key, item);
      continue;
    }

    if (nextPriority === currentPriority) {
      const currentHasImage = Boolean(current?.url_imagen);
      const nextHasImage = Boolean(item?.url_imagen);

      if (!currentHasImage && nextHasImage) {
        map.set(key, item);
      }
    }
  }

  return Array.from(map.values());
};

const getCategoriaIcon = (nombre) => {
  const n = normalizeCategoriaNombre(nombre);

  if (!n) return 'default';
  if (n.includes('combo')) return 'combos';
  if (n.includes('hamburgues')) return 'hamburguesas';
  if (n.includes('taco') || n.includes('birria')) return 'tacos-birria';
  if (
    n.includes('hot dog') ||
    n.includes('hotdog') ||
    n.includes('perro caliente') ||
    n.includes('perros calientes')
  ) {
    return 'hot-dogs';
  }
  if (n.includes('alita') || n.includes('tender') || n.includes('boneless')) return 'alitas-tenders';
  if (n.includes('jugo')) return 'jugos-naturales';
  if (n.includes('refresco') || n.includes('bebida') || n.includes('soda')) return 'refrescos-agua';
  if (n.includes('agua')) return 'refrescos-agua';
  if (n.includes('cerveza') || n.includes('beer')) return 'cervezas';
  if (n.includes('salsa')) return 'salsas';
  if (n.includes('snack') || n.includes('nacho') || n.includes('papa') || n.includes('botana')) return 'snacks';
  if (n.includes('sarita') || n.includes('helado') || n.includes('ice cream')) return 'productos-sarita';
  if (n.includes('postre') || n.includes('dessert')) return 'postres';
  if (n.includes('cafe') || n.includes('coffee')) return 'cafe';
  if (n.includes('pizza')) return 'pizza';

  return 'default';
};

const CategoryIcon = ({ nombre, className }) => {
  const icon = getCategoriaIcon(nombre);

  if (icon === 'combos') return <FaTags className={className} aria-hidden="true" />;
  if (icon === 'hamburguesas') return <FaHamburger className={className} aria-hidden="true" />;
  if (icon === 'jugos-naturales') return <FaGlassWhiskey className={className} aria-hidden="true" />;
  if (icon === 'alitas-tenders') return <FaDrumstickBite className={className} aria-hidden="true" />;
  if (icon === 'tacos-birria') return <GiTacos className={className} aria-hidden="true" />;
  if (icon === 'hot-dogs') return <FaHotdog className={className} aria-hidden="true" />;
  if (icon === 'cervezas') return <FaBeer className={className} aria-hidden="true" />;
  if (icon === 'snacks') return <FaCookieBite className={className} aria-hidden="true" />;
  if (icon === 'refrescos-agua') return <FaTint className={className} aria-hidden="true" />;
  if (icon === 'productos-sarita') return <FaIceCream className={className} aria-hidden="true" />;
  if (icon === 'postres') return <FaBirthdayCake className={className} aria-hidden="true" />;
  if (icon === 'cafe') return <FaCoffee className={className} aria-hidden="true" />;
  if (icon === 'pizza') return <FaPizzaSlice className={className} aria-hidden="true" />;
  if (icon === 'salsas') return <FaPepperHot className={className} aria-hidden="true" />;

  return <FaUtensils className={className} aria-hidden="true" />;
};

const CategorySelector = ({ categorias, selected, onSelect }) => (
  <div className="menu-pos-cat-strip" aria-label="Categorias del menu POS">
    {categorias.map((categoria) => {
      const isActive =
        Number(selected?.id_tipo_departamento) === Number(categoria?.id_tipo_departamento);
      const label = getCategoriaDisplayName(categoria?.nombre_departamento);

      return (
        <button
          key={categoria.id_tipo_departamento}
          type="button"
          aria-pressed={isActive}
          className={`inv-prod-toolbar-btn menu-pos-cat-chip ${isActive ? 'is-on' : ''}`}
          onClick={() => onSelect(isActive ? null : categoria)}
          title={label}
        >
          <CategoryIcon
            nombre={categoria?.nombre_departamento}
            className="menu-pos-cat-icon fs-5 me-2"
          />
          <span className="menu-pos-cat-label text-truncate">{label}</span>
        </button>
      );
    })}
  </div>
);

const MenuViewSwitch = ({ value = 'recetas', onChange }) => {
  const safeValue = value === 'pos' ? 'pos' : 'recetas';

  const setView = (nextView) => {
    if (nextView === safeValue) return;
    if (typeof onChange === 'function') onChange(nextView);
  };

  // Mantiene el mismo patron de accesibilidad por teclado usado en los switches del sistema.
  const onOptionKeyDown = (event, targetView) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setView(targetView);
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setView('recetas');
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setView('pos');
    }
  };

  return (
    <div
      className={`inv-cat-compact-switch menu-module-switch ${safeValue === 'pos' ? 'is-productos' : 'is-insumos'}`}
      role="tablist"
      aria-label="Cambiar vista de menu"
    >
      <span className="inv-cat-compact-switch__thumb" aria-hidden="true" />
      <button
        type="button"
        role="tab"
        aria-selected={safeValue === 'recetas'}
        className={`inv-cat-compact-switch__option ${safeValue === 'recetas' ? 'is-active' : ''}`}
        onClick={() => setView('recetas')}
        onKeyDown={(event) => onOptionKeyDown(event, 'recetas')}
      >
        RECETAS
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={safeValue === 'pos'}
        className={`inv-cat-compact-switch__option ${safeValue === 'pos' ? 'is-active' : ''}`}
        onClick={() => setView('pos')}
        onKeyDown={(event) => onOptionKeyDown(event, 'pos')}
      >
        MENU POS
      </button>
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
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  // Permite alternar entre POS y CRUD de recetas en la misma ruta /dashboard/menu.
  const [vistaActiva, setVistaActiva] = useState('recetas');

  useEffect(() => {
    if (vistaActiva !== 'pos') return undefined;

    const cargarCategorias = async () => {
      try {
        setLoading(true);
        setError('');

        const resp = await apiFetch('/menu-pos/categorias', 'GET');
        const lista = Array.isArray(resp?.data) ? resp.data : [];

        setCategorias(lista);
        setSelected(null);
      } catch (e) {
        setError(e?.message || 'Error al cargar categorias');
      } finally {
        setLoading(false);
      }
    };

    cargarCategorias();
  }, [vistaActiva]);

  const cargarProductos = useCallback(async (idTipoDepartamento = null) => {
    try {
      setLoadingProductos(true);
      setErrorProductos('');

      const params = new URLSearchParams();

      if (idTipoDepartamento) {
        params.set('id_tipo_departamento', String(idTipoDepartamento));
      }

      const resp = await apiFetch(`/menu-pos/catalogo-imagenes?${params.toString()}`, 'GET');
      const lista = Array.isArray(resp?.data) ? resp.data : [];

      setProductos(dedupeCatalogItems(lista));
    } catch (e) {
      setErrorProductos(e?.message || 'Error al cargar productos');
      setProductos([]);
    } finally {
      setLoadingProductos(false);
    }
  }, []);

  useEffect(() => {
    if (vistaActiva !== 'pos') return;
    cargarProductos(selected?.id_tipo_departamento ?? null);
  }, [cargarProductos, selected, vistaActiva]);

  const onAgregarProducto = useCallback(() => {
    // FASE 2: se mantiene callback solo por compatibilidad temporal del boton "+"
    // y del overlay, mientras no exista aun el flujo real de pedido/venta.
  }, []);

  const onOpenDetail = useCallback((producto) => {
    setSelectedProduct(producto);
    setIsDetailOpen(true);
  }, []);

  const onCloseDetail = useCallback(() => {
    setIsDetailOpen(false);
  }, []);

  const onDetailExited = useCallback(() => {
    setSelectedProduct(null);
  }, []);

  return (
    <div className="container-fluid p-3">
      <div className="card shadow-sm mb-3 inv-prod-card menu-module-head">
        <div className="card-header inv-prod-header">
          <div className="inv-prod-title-wrap">
            <div className="inv-prod-title-row">
              <i className="bi bi-grid-1x2-fill inv-prod-title-icon" />
              <span className="inv-prod-title">Menu</span>
            </div>
            <div className="inv-prod-subtitle">Administracion de recetas y vista POS en la misma pantalla</div>
          </div>
          <div className="inv-prod-header-actions">
            <MenuViewSwitch value={vistaActiva} onChange={setVistaActiva} />
          </div>
        </div>
      </div>
      {vistaActiva === 'recetas' ? (
        <RecetasAdmin />
      ) : (
        <>
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

            </div>
          </div>

          {!loading && !error && (
            <div className="menu-pos-main-layout mt-3">
              <section className="menu-pos-catalog-column">
                {errorProductos && <div className="alert alert-danger">{errorProductos}</div>}

                <ProductoGrid
                  productos={productos}
                  loading={loadingProductos}
                  onAgregar={onAgregarProducto}
                  onOpenDetail={onOpenDetail}
                />
              </section>
            </div>
          )}

          <ProductDetailOverlay
            isOpen={isDetailOpen}
            product={selectedProduct}
            onAdd={onAgregarProducto}
            onClose={onCloseDetail}
            onExited={onDetailExited}
          />
        </>
      )}
    </div>
  );
};

export default Menu;
