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
  FaTint,
  FaUtensils,
} from 'react-icons/fa';
import { GiTacos } from 'react-icons/gi';
import '../../../assets/styles/_menu.scss';
import { apiFetch } from '../../../services/api';
import CurrentOrderPanel from './CurrentOrderPanel';
import ProductDetailOverlay from './ProductDetailOverlay';
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

const isComboCategoria = (nombre) => normalizeCategoriaNombre(nombre).includes('combo');

const getMenuItemKey = (producto) =>
  producto?.id_producto ? `producto-${producto.id_producto}` : `combo-${producto?.id_combo}`;

const getMenuItemName = (producto) =>
  producto?.nombre_producto || producto?.descripcion || 'Producto sin nombre';

const getCategoriaIcon = (nombre) => {
  const n = normalizeCategoriaNombre(nombre);

  if (!n) return 'default';
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
          onClick={() => onSelect(categoria)}
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
  const [orderItems, setOrderItems] = useState([]);

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

  const cargarProductos = useCallback(async (idTipoDepartamento, nombreDepartamento) => {
    try {
      setLoadingProductos(true);
      setErrorProductos('');

      const resp = await apiFetch(`/menu-pos/catalogo-imagenes/${idTipoDepartamento}`, 'GET');
      const listaProductos = Array.isArray(resp?.productos) ? resp.productos : [];
      const listaCombos = Array.isArray(resp?.combos)
        ? resp.combos.map((combo) => ({
            ...combo,
            id_producto: null,
            nombre_producto: combo?.descripcion || `Combo #${combo?.id_combo || ''}`,
            descripcion_producto: combo?.descripcion || '',
            cantidad: combo?.cant_personas,
            es_combo: true,
          }))
        : [];

      const lista = isComboCategoria(nombreDepartamento) ? listaCombos : listaProductos;

      setProductos(lista);
    } catch (e) {
      setErrorProductos(e?.message || 'Error al cargar productos');
      setProductos([]);
    } finally {
      setLoadingProductos(false);
    }
  }, []);

  useEffect(() => {
    if (selected?.id_tipo_departamento) {
      cargarProductos(selected.id_tipo_departamento, selected?.nombre_departamento);
      return;
    }

    setProductos([]);
    setErrorProductos('');
  }, [cargarProductos, selected]);

  const onAgregarProducto = useCallback((producto) => {
    setOrderItems((current) => {
      const itemKey = getMenuItemKey(producto);
      const existingIndex = current.findIndex((item) => item.itemKey === itemKey);

      if (existingIndex === -1) {
        return [
          ...current,
          {
            itemKey,
            id_producto: producto?.id_producto ?? null,
            id_combo: producto?.id_combo ?? null,
            nombre: getMenuItemName(producto),
            precio: Number(producto?.precio || 0),
            cantidad: 1,
          },
        ];
      }

      return current.map((item, index) =>
        index === existingIndex
          ? { ...item, cantidad: item.cantidad + 1 }
          : item
      );
    });
  }, []);

  const onIncreaseItem = useCallback((itemKey) => {
    setOrderItems((current) =>
      current.map((item) =>
        item.itemKey === itemKey ? { ...item, cantidad: item.cantidad + 1 } : item
      )
    );
  }, []);

  const onDecreaseItem = useCallback((itemKey) => {
    setOrderItems((current) =>
      current.map((item) =>
        item.itemKey === itemKey
          ? { ...item, cantidad: Math.max(1, item.cantidad - 1) }
          : item
      )
    );
  }, []);

  const onRemoveItem = useCallback((itemKey) => {
    setOrderItems((current) => current.filter((item) => item.itemKey !== itemKey));
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

  const selectedLabel = getCategoriaDisplayName(selected?.nombre_departamento);
  const totalItems = orderItems.reduce((acc, item) => acc + item.cantidad, 0);
  const totalAmount = orderItems.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);

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

          <CurrentOrderPanel
            items={orderItems}
            totalAmount={totalAmount}
            totalItems={totalItems}
            onDecrease={onDecreaseItem}
            onIncrease={onIncreaseItem}
            onRemove={onRemoveItem}
          />
        </div>
      )}

      <ProductDetailOverlay
        isOpen={isDetailOpen}
        product={selectedProduct}
        onAdd={onAgregarProducto}
        onClose={onCloseDetail}
        onExited={onDetailExited}
      />
    </div>
  );
};

export default Menu;
