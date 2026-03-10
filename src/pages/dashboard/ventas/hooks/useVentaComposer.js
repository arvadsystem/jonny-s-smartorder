import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { formatCurrency, roundMoney } from '../utils/ventasHelpers';

export const PAYMENT_OPTIONS = [
  { key: 'efectivo', label: 'Efectivo', icon: 'bi bi-cash' },
  { key: 'tarjeta', label: 'Tarjeta', icon: 'bi bi-credit-card' },
  { key: 'transferencia', label: 'Transfer.', icon: 'bi bi-arrow-left-right' }
];

export const CATALOG_TABS = [
  { key: 'PRODUCTOS', label: 'Productos', icon: 'bi bi-bag' },
  { key: 'COMBOS', label: 'Combos', icon: 'bi bi-collection' },
  { key: 'RECETAS', label: 'Recetas', icon: 'bi bi-journal-richtext' }
];

const buildInitialState = () => ({
  activeCatalog: 'PRODUCTOS',
  search: '',
  activeCategory: 'all',
  selectedClient: 'cf',
  clientPickerOpen: false,
  paymentMethod: 'efectivo',
  discount: '0',
  cashReceived: '',
  cart: [],
  submitError: ''
});

const buildCartKey = (kind, entityId) => `${kind}:${entityId}`;

const findLineIndex = (cart, cartKey) =>
  cart.findIndex((line) => String(line.cartKey) === String(cartKey));

const buildCatalogLine = (kind, row) => {
  if (kind === 'PRODUCTO') {
    return {
      cartKey: buildCartKey(kind, row.id_producto),
      kind,
      entityId: row.id_producto,
      id_producto: row.id_producto,
      id_combo: null,
      id_receta: null,
      nombre_item: row.nombre_producto,
      categoria_label: row.categoria_label || 'Productos',
      descripcion_item: row.descripcion_producto || row.categoria_label || 'Producto',
      precio_unitario: row.precio,
      cantidad: 1,
      observacion: ''
    };
  }

  if (kind === 'COMBO') {
    return {
      cartKey: buildCartKey(kind, row.id_combo),
      kind,
      entityId: row.id_combo,
      id_producto: null,
      id_combo: row.id_combo,
      id_receta: null,
      nombre_item: row.descripcion,
      categoria_label: 'Combos',
      descripcion_item: row.descripcion || 'Combo',
      precio_unitario: row.precio,
      cantidad: 1,
      observacion: ''
    };
  }

  return {
    cartKey: buildCartKey(kind, row.id_receta),
    kind,
    entityId: row.id_receta,
    id_producto: null,
    id_combo: null,
    id_receta: row.id_receta,
    nombre_item: row.nombre_receta,
    categoria_label: 'Recetas',
    descripcion_item: row.nombre_producto_base || row.nombre_receta || 'Receta',
    precio_unitario: row.precio,
    cantidad: 1,
    observacion: ''
  };
};

const filterBySearch = (rows, search, fields) => {
  const needle = String(search || '').trim().toLowerCase();
  if (!needle) return rows;

  return rows.filter((row) =>
    fields
      .map((field) => row?.[field])
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(needle)
  );
};

const getResultsLabel = (catalogKey, count) => {
  if (catalogKey === 'COMBOS') {
    return `${count} ${count === 1 ? 'combo' : 'combos'}`;
  }

  if (catalogKey === 'RECETAS') {
    return `${count} ${count === 1 ? 'receta' : 'recetas'}`;
  }

  return `${count} ${count === 1 ? 'producto' : 'productos'}`;
};

export const useVentaComposer = ({
  productos,
  categorias,
  clientes,
  combos,
  recetas,
  onSubmit,
  resetKey
}) => {
  const [state, setState] = useState(buildInitialState);
  const deferredSearch = useDeferredValue(state.search);

  useEffect(() => {
    if (resetKey === undefined) return;
    setState(buildInitialState());
  }, [resetKey]);

  const setPartialState = (partial) => {
    setState((current) => ({
      ...current,
      ...partial
    }));
  };

  const resetComposer = () => {
    setState(buildInitialState());
  };

  const selectedClientLabel = useMemo(() => {
    const match = (Array.isArray(clientes) ? clientes : []).find(
      (cliente) => cliente.value === state.selectedClient
    );
    return match?.label || 'Consumidor final';
  }, [clientes, state.selectedClient]);

  const filteredProducts = useMemo(() => {
    const categoryValue = state.activeCategory;
    const categoryFiltered = (Array.isArray(productos) ? productos : []).filter((producto) =>
      categoryValue === 'all'
        ? true
        : Number(producto.id_tipo_departamento ?? 0) === Number(categoryValue)
    );

    return filterBySearch(categoryFiltered, deferredSearch, [
      'nombre_producto',
      'descripcion_producto',
      'categoria_label'
    ]);
  }, [deferredSearch, productos, state.activeCategory]);

  const filteredCombos = useMemo(
    () => filterBySearch(Array.isArray(combos) ? combos : [], deferredSearch, ['descripcion']),
    [combos, deferredSearch]
  );

  const filteredRecetas = useMemo(
    () =>
      filterBySearch(Array.isArray(recetas) ? recetas : [], deferredSearch, [
        'nombre_receta',
        'nombre_producto_base'
      ]),
    [deferredSearch, recetas]
  );

  const currentCatalogRows = useMemo(() => {
    if (state.activeCatalog === 'COMBOS') return filteredCombos;
    if (state.activeCatalog === 'RECETAS') return filteredRecetas;
    return filteredProducts;
  }, [filteredCombos, filteredProducts, filteredRecetas, state.activeCatalog]);

  const cartCount = useMemo(
    () => state.cart.reduce((total, line) => total + Number(line.cantidad ?? 0), 0),
    [state.cart]
  );

  const subtotal = useMemo(
    () =>
      roundMoney(
        state.cart.reduce(
          (total, line) => total + Number(line.precio_unitario ?? 0) * Number(line.cantidad ?? 0),
          0
        )
      ),
    [state.cart]
  );

  const discountValue = useMemo(() => {
    const numeric = Number(state.discount);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    return roundMoney(Math.min(numeric, subtotal));
  }, [state.discount, subtotal]);

  const taxableSubtotal = roundMoney(Math.max(subtotal - discountValue, 0));
  const isv = roundMoney(taxableSubtotal * 0.15);
  const total = roundMoney(taxableSubtotal + isv);

  const cashValue = useMemo(() => {
    if (state.cashReceived === '') return total;
    const numeric = Number(state.cashReceived);
    return Number.isFinite(numeric) && numeric >= 0 ? roundMoney(numeric) : 0;
  }, [state.cashReceived, total]);

  const change = roundMoney(Math.max(cashValue - total, 0));
  const canSubmit = state.cart.length > 0 && state.paymentMethod === 'efectivo' && cashValue >= total;
  const resultsLabel = getResultsLabel(state.activeCatalog, currentCatalogRows.length);

  const addCatalogItem = (kind, row) => {
    const catalogLine = buildCatalogLine(kind, row);

    setState((current) => {
      const nextCart = [...current.cart];
      const index = findLineIndex(nextCart, catalogLine.cartKey);

      if (index >= 0) {
        nextCart[index] = {
          ...nextCart[index],
          cantidad: Number(nextCart[index].cantidad ?? 0) + 1
        };
      } else {
        nextCart.push(catalogLine);
      }

      return {
        ...current,
        cart: nextCart,
        submitError: ''
      };
    });
  };

  const updateLine = (cartKey, updater) => {
    setState((current) => ({
      ...current,
      cart: current.cart
        .map((line) => (line.cartKey === cartKey ? updater(line) : line))
        .filter((line) => Number(line.cantidad ?? 0) > 0)
    }));
  };

  const removeLine = (cartKey) => {
    setState((current) => ({
      ...current,
      cart: current.cart.filter((item) => item.cartKey !== cartKey)
    }));
  };

  const handleSearchKeyDown = (event) => {
    if (event.key !== 'Enter') return;
    if (currentCatalogRows.length === 0) return;

    event.preventDefault();

    if (state.activeCatalog === 'COMBOS') {
      addCatalogItem('COMBO', currentCatalogRows[0]);
      return;
    }

    if (state.activeCatalog === 'RECETAS') {
      addCatalogItem('RECETA', currentCatalogRows[0]);
      return;
    }

    addCatalogItem('PRODUCTO', currentCatalogRows[0]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (state.paymentMethod !== 'efectivo') {
      setPartialState({
        submitError: 'El esquema actual solo soporta ventas en efectivo.'
      });
      return null;
    }

    if (state.cart.length === 0) {
      setPartialState({
        submitError: 'Agrega al menos un item al carrito.'
      });
      return null;
    }

    if (cashValue < total) {
      setPartialState({
        submitError: 'El efectivo entregado no puede ser menor al total.'
      });
      return null;
    }

    try {
      const response = await onSubmit({
        id_cliente: state.selectedClient === 'cf' ? null : Number(state.selectedClient),
        metodo_pago: 'efectivo',
        descuento: discountValue,
        efectivo_entregado: cashValue,
        descripcion_pedido: null,
        items: state.cart.map((line) => ({
          id_producto: line.id_producto,
          id_combo: line.id_combo,
          id_receta: line.id_receta,
          cantidad: Number(line.cantidad),
          observacion:
            line.kind === 'PRODUCTO'
              ? undefined
              : String(line.observacion || '').trim() || null
        }))
      });

      resetComposer();
      return response;
    } catch (error) {
      setPartialState({
        submitError: error?.message || 'No se pudo registrar la venta.'
      });
      return null;
    }
  };

  return {
    activeCatalog: state.activeCatalog,
    activeCategory: state.activeCategory,
    search: state.search,
    selectedClient: state.selectedClient,
    selectedClientLabel,
    clientPickerOpen: state.clientPickerOpen,
    paymentMethod: state.paymentMethod,
    discount: state.discount,
    cashReceived: state.cashReceived,
    cart: state.cart,
    submitError: state.submitError,
    currentCatalogRows,
    resultsLabel,
    cartCount,
    subtotal,
    discountValue,
    isv,
    total,
    cashValue,
    change,
    canSubmit,
    setPartialState,
    resetComposer,
    setActiveCatalog: (key) =>
      setPartialState({
        activeCatalog: key,
        search: ''
      }),
    setSearch: (value) => setPartialState({ search: value }),
    setActiveCategory: (value) => setPartialState({ activeCategory: value }),
    setClientPickerOpen: (value) => setPartialState({ clientPickerOpen: value }),
    setSelectedClient: (value) =>
      setPartialState({
        selectedClient: value,
        clientPickerOpen: false
      }),
    setPaymentMethod: (value) =>
      setPartialState({
        paymentMethod: value,
        submitError: ''
      }),
    setDiscount: (value) => setPartialState({ discount: value }),
    setCashReceived: (value) => setPartialState({ cashReceived: value }),
    addCatalogItem,
    updateLine,
    removeLine,
    handleSearchKeyDown,
    handleSubmit,
    categorias: Array.isArray(categorias) ? categorias : [],
    clientes: Array.isArray(clientes) ? clientes : [],
    formatCurrency
  };
};
