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

const buildInitialState = ({ isSuperAdmin = false, defaultSucursalId = null } = {}) => ({
  activeCatalog: 'PRODUCTOS',
  search: '',
  activeCategory: 'all',
  selectedSucursal: isSuperAdmin ? '' : String(defaultSucursalId || ''),
  selectedClient: 'cf',
  clientPickerOpen: false,
  paymentPickerOpen: false,
  descuentoPickerOpen: false,
  paymentMethod: 'efectivo',
  selectedDiscountId: '',
  cashReceived: '',
  cart: [],
  submitError: ''
});

const buildCartKey = (kind, entityId) => `${kind}:${entityId}`;

const findLineIndex = (cart, cartKey) =>
  cart.findIndex((line) => String(line.cartKey) === String(cartKey));

const normalizeDiscountType = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

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
      stock_disponible: Number(row.cantidad ?? 0) || 0,
      observacion: '',
      imagen_principal_url: row.imagen_principal_url || row.url_imagen || null
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
      stock_disponible: null,
      observacion: '',
      imagen_principal_url: row.imagen_principal_url || row.url_imagen || null
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
    stock_disponible: null,
    observacion: '',
    imagen_principal_url: row.imagen_principal_url || row.url_imagen || null
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

const computeDiscountAmount = (subtotal, selectedDiscount) => {
  if (!selectedDiscount) return 0;

  const discountValue = roundMoney(Number(selectedDiscount.valor_descuento ?? 0));
  if (discountValue <= 0 || subtotal <= 0) return 0;

  const discountType = normalizeDiscountType(selectedDiscount.nombre_tipo_descuento);
  if (discountType.includes('PORCENTAJE')) {
    return roundMoney(Math.min(subtotal, (subtotal * discountValue) / 100));
  }

  return roundMoney(Math.min(subtotal, discountValue));
};

export const useVentaComposer = ({
  productos,
  categorias,
  tiposDepartamento,
  sucursales,
  isSuperAdmin = false,
  defaultSucursalId = null,
  clientes,
  combos,
  recetas,
  descuentosCatalogo,
  onSubmit,
  resetKey
}) => {
  const [state, setState] = useState(() => buildInitialState({ isSuperAdmin, defaultSucursalId }));
  const deferredSearch = useDeferredValue(state.search);

  useEffect(() => {
    if (resetKey === undefined) return;
    setState(buildInitialState({ isSuperAdmin, defaultSucursalId }));
  }, [defaultSucursalId, isSuperAdmin, resetKey]);

  const setPartialState = (partial) => {
    setState((current) => ({
      ...current,
      ...partial
    }));
  };

  const resetComposer = () => {
    setState(buildInitialState({ isSuperAdmin, defaultSucursalId }));
  };

  const selectedClientLabel = useMemo(() => {
    const match = (Array.isArray(clientes) ? clientes : []).find(
      (cliente) => cliente.value === state.selectedClient
    );
    return match?.label || 'Consumidor final';
  }, [clientes, state.selectedClient]);

  const normalizedDescuentosCatalogo = useMemo(
    () => (Array.isArray(descuentosCatalogo) ? descuentosCatalogo : []),
    [descuentosCatalogo]
  );

  const selectedDiscount = useMemo(
    () => normalizedDescuentosCatalogo.find(
      (discount) => String(discount.id_descuento_catalogo) === String(state.selectedDiscountId)
    ) || null,
    [normalizedDescuentosCatalogo, state.selectedDiscountId]
  );

  const normalizedSucursales = useMemo(
    () => (Array.isArray(sucursales) ? sucursales : []),
    [sucursales]
  );

  useEffect(() => {
    if (isSuperAdmin) return;
    setState((current) => ({
      ...current,
      selectedSucursal: String(defaultSucursalId || '')
    }));
  }, [defaultSucursalId, isSuperAdmin]);

  const selectedSucursalLabel = useMemo(() => {
    const selectedId = Number.parseInt(String(state.selectedSucursal || ''), 10);
    if (!Number.isInteger(selectedId) || selectedId <= 0) return 'Sin sucursal';
    const match = normalizedSucursales.find(
      (row) => Number(row?.id_sucursal) === selectedId
    );
    return match?.nombre_sucursal || `Sucursal #${selectedId}`;
  }, [normalizedSucursales, state.selectedSucursal]);

  const filteredProducts = useMemo(() => {
    const categoryValue = state.activeCategory;
    const categoryFiltered = (Array.isArray(productos) ? productos : []).filter((producto) =>
      categoryValue === 'all'
        ? true
        : Number(producto.id_categoria_producto ?? 0) === Number(categoryValue)
    );

    return filterBySearch(categoryFiltered, deferredSearch, [
      'nombre_producto',
      'descripcion_producto',
      'categoria_label'
    ]);
  }, [deferredSearch, productos, state.activeCategory]);

  const filteredCombos = useMemo(() => {
    const categoryValue = state.activeCategory;
    const categoryFiltered = (Array.isArray(combos) ? combos : []).filter((combo) =>
      categoryValue === 'all'
        ? true
        : Number(combo.id_tipo_departamento ?? 0) === Number(categoryValue)
    );

    return filterBySearch(categoryFiltered, deferredSearch, ['descripcion']);
  }, [combos, deferredSearch, state.activeCategory]);

  const filteredRecetas = useMemo(() => {
    const categoryValue = state.activeCategory;
    const categoryFiltered = (Array.isArray(recetas) ? recetas : []).filter((receta) =>
      categoryValue === 'all'
        ? true
        : Number(receta.id_tipo_departamento ?? 0) === Number(categoryValue)
    );

    return filterBySearch(categoryFiltered, deferredSearch, [
      'nombre_receta',
      'nombre_producto_base'
    ]);
  }, [deferredSearch, recetas, state.activeCategory]);

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

  const discountValue = useMemo(
    () => computeDiscountAmount(subtotal, selectedDiscount),
    [selectedDiscount, subtotal]
  );

  const taxableSubtotal = roundMoney(Math.max(subtotal - discountValue, 0));
  const isv = roundMoney(taxableSubtotal * 0.15);
  const total = roundMoney(taxableSubtotal + isv);

  const cashValue = useMemo(() => {
    if (state.cashReceived === '') return total;
    const numeric = Number(state.cashReceived);
    return Number.isFinite(numeric) && numeric >= 0 ? roundMoney(numeric) : 0;
  }, [state.cashReceived, total]);

  const selectedSucursalId = Number.parseInt(String(state.selectedSucursal || ''), 10);
  const hasSelectedSucursal = Number.isInteger(selectedSucursalId) && selectedSucursalId > 0;
  const change = roundMoney(Math.max(cashValue - total, 0));
  const canSubmit = hasSelectedSucursal
    && state.cart.length > 0
    && (state.paymentMethod !== 'efectivo' || cashValue >= total);
  const resultsLabel = getResultsLabel(state.activeCatalog, currentCatalogRows.length);

  const getCurrentProductoQuantityInCart = (idProducto, cart) =>
    (Array.isArray(cart) ? cart : []).reduce((acc, line) => {
      if (line.kind !== 'PRODUCTO') return acc;
      if (Number(line.id_producto) !== Number(idProducto)) return acc;
      return acc + Number(line.cantidad ?? 0);
    }, 0);

  const addCatalogItem = (kind, row) => {
    const catalogLine = buildCatalogLine(kind, row);

    setState((current) => {
      const nextCart = [...current.cart];

      if (kind === 'PRODUCTO') {
        const stockDisponible = Number(row.cantidad ?? 0);
        if (stockDisponible <= 0) {
          return {
            ...current,
            submitError: `${row.nombre_producto || 'Producto'} agotado.`
          };
        }

        const alreadyInCart = getCurrentProductoQuantityInCart(row.id_producto, nextCart);
        if (alreadyInCart >= stockDisponible) {
          return {
            ...current,
            submitError: `Stock maximo alcanzado para ${row.nombre_producto || 'producto'}.`
          };
        }
      }

      const index = findLineIndex(nextCart, catalogLine.cartKey);

      if (index >= 0) {
        return current; // Ya esta en carrito, forzar uso del boton '+'
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
    setState((current) => {
      const nextCart = current.cart
        .map((line) => {
          if (line.cartKey !== cartKey) return line;
          const candidate = updater(line);

          if (candidate.kind === 'PRODUCTO') {
            const requested = Number(candidate.cantidad ?? 0);
            const maxStock = Number(candidate.stock_disponible ?? 0);
            if (requested > maxStock) {
              return {
                ...candidate,
                cantidad: maxStock
              };
            }
          }

          return candidate;
        })
        .filter((line) => Number(line.cantidad ?? 0) > 0);

      return {
        ...current,
        cart: nextCart,
        submitError: ''
      };
    });
  };

  const removeLine = (cartKey) => {
    setState((current) => ({
      ...current,
      cart: current.cart.filter((item) => item.cartKey !== cartKey),
      submitError: ''
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

    if (!hasSelectedSucursal) {
      setPartialState({
        submitError: isSuperAdmin
          ? 'Selecciona una sucursal para registrar la venta.'
          : 'No tienes sucursal operativa asignada para registrar ventas.'
      });
      return null;
    }

    if (state.cart.length === 0) {
      setPartialState({
        submitError: 'Agrega al menos un item al carrito.'
      });
      return null;
    }

    if (state.paymentMethod === 'efectivo' && cashValue < total) {
      setPartialState({
        submitError: 'El efectivo entregado no puede ser menor al total.'
      });
      return null;
    }

    try {
      const response = await onSubmit({
        id_cliente: state.selectedClient === 'cf' ? null : Number(state.selectedClient),
        id_sucursal: selectedSucursalId,
        metodo_pago: 'efectivo',
        id_descuento_catalogo: state.selectedDiscountId ? Number(state.selectedDiscountId) : null,
        descuento: state.selectedDiscountId ? 0 : discountValue,
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
    isSuperAdmin,
    sucursalLocked: !isSuperAdmin,
    selectedSucursal: state.selectedSucursal,
    selectedSucursalLabel,
    selectedClient: state.selectedClient,
    selectedClientLabel,
    clientPickerOpen: state.clientPickerOpen,
    paymentMethod: state.paymentMethod,
    selectedDiscountId: state.selectedDiscountId,
    selectedDiscount,
    descuentosCatalogo: normalizedDescuentosCatalogo,
    descuentoPickerOpen: state.descuentoPickerOpen,
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
    paymentPickerOpen: state.paymentPickerOpen,
    setPaymentPickerOpen: (value) => setPartialState({ paymentPickerOpen: value }),
    setDescuentoPickerOpen: (value) => setPartialState({ descuentoPickerOpen: value }),
    setClientPickerOpen: (value) => setPartialState({ clientPickerOpen: value }),
    setSelectedSucursal: (value) =>
      setPartialState({
        selectedSucursal: value,
        submitError: ''
      }),
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
    setSelectedDiscountId: (value) =>
      setPartialState({
        selectedDiscountId: value,
        descuentoPickerOpen: false,
        submitError: ''
      }),
    setCashReceived: (value) => setPartialState({ cashReceived: value }),
    addCatalogItem,
    updateLine,
    removeLine,
    handleSearchKeyDown,
    handleSubmit,
    sucursales: normalizedSucursales,
    categorias: Array.isArray(categorias) ? categorias : [],
    tiposDepartamento: Array.isArray(tiposDepartamento) ? tiposDepartamento : [],
    clientes: Array.isArray(clientes) ? clientes : [],
    formatCurrency
  };
};
