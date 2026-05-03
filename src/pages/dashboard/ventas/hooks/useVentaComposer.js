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
  sucursalPickerOpen: false,
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

const normalizeDiscountScope = (value) => {
  const normalized = String(value || 'FACTURA_COMPLETA')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

  if (normalized === 'PRODUCTOS') return 'PRODUCTO';
  if (normalized === 'RECETAS') return 'RECETA';
  if (normalized === 'COMBOS') return 'COMBO';
  return normalized || 'FACTURA_COMPLETA';
};

const toNormalizedId = (value) => {
  if (value === null || value === undefined) return null;
  const asString = String(value).trim();
  if (!asString || asString.toLowerCase() === 'null' || asString.toLowerCase() === 'undefined') {
    return null;
  }
  const parsed = Number.parseInt(asString, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseDiscountDate = (value) => {
  if (!value) return null;
  const source = String(value).trim();
  if (!source) return null;

  const parsedNative = new Date(source);
  if (Number.isFinite(parsedNative.getTime())) return parsedNative;

  const match = source.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) return null;

  const asLocal = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4] || 0),
    Number(match[5] || 0),
    Number(match[6] || 0)
  );
  return Number.isFinite(asLocal.getTime()) ? asLocal : null;
};

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

const isDiscountActiveAtDate = (discount, now = new Date()) => {
  const start = parseDiscountDate(discount?.fecha_inicio);
  const end = parseDiscountDate(discount?.fecha_fin);
  if (start && Number.isFinite(start.getTime()) && now < start) return false;
  if (end && Number.isFinite(end.getTime()) && now > end) return false;
  return true;
};

const isDiscountAllowedForSucursal = (discount, idSucursal) => {
  const idSucursalDiscount = toNormalizedId(discount?.id_sucursal);
  if (!idSucursalDiscount) return true;
  if (!idSucursal) return false;
  return Number(idSucursalDiscount) === Number(idSucursal);
};

const resolveBestDiscountForLine = ({ discounts, line, selectedSucursalId }) => {
  const lineSubtotal = roundMoney(Number(line?.precio_unitario ?? 0) * Number(line?.cantidad ?? 0));
  if (lineSubtotal <= 0) return null;

  let best = null;
  for (const discount of discounts) {
    const scope = normalizeDiscountScope(discount.alcance);
    if (scope === 'FACTURA_COMPLETA') continue;
    if (scope !== String(line.kind || '').toUpperCase()) continue;
    if (!isDiscountAllowedForSucursal(discount, selectedSucursalId)) continue;
    if (scope === 'PRODUCTO' && toNormalizedId(discount.id_producto) !== toNormalizedId(line.id_producto)) continue;
    if (scope === 'RECETA' && toNormalizedId(discount.id_receta) !== toNormalizedId(line.id_receta)) continue;
    if (scope === 'COMBO' && toNormalizedId(discount.id_combo) !== toNormalizedId(line.id_combo)) continue;

    const benefit = computeDiscountAmount(lineSubtotal, discount);
    if (benefit <= 0) continue;

    if (!best || benefit > best.benefit) {
      best = { discount, benefit };
    }
  }

  return best?.discount || null;
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
  resetKey,
  canApplyDiscount = false
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
    () =>
      (Array.isArray(descuentosCatalogo) ? descuentosCatalogo : []).filter(
        (row) => row?.estado !== false && isDiscountActiveAtDate(row)
      ),
    [descuentosCatalogo]
  );

  const selectedSucursalId = toNormalizedId(state.selectedSucursal);
  const hasSelectedSucursal = Boolean(selectedSucursalId);

  const descuentoGlobalOptions = useMemo(
    () =>
      normalizedDescuentosCatalogo.filter((discount) => {
        const scope = normalizeDiscountScope(discount.alcance);
        if (scope !== 'FACTURA_COMPLETA') return false;
        return isDiscountAllowedForSucursal(discount, selectedSucursalId);
      }),
    [normalizedDescuentosCatalogo, selectedSucursalId]
  );

  const selectedDiscount = useMemo(
    () => descuentoGlobalOptions.find(
      (discount) => String(discount.id_descuento_catalogo) === String(state.selectedDiscountId)
    ) || null,
    [descuentoGlobalOptions, state.selectedDiscountId]
  );

  useEffect(() => {
    if (!state.selectedDiscountId) return;
    if (selectedDiscount) return;
    setState((current) => ({ ...current, selectedDiscountId: '' }));
  }, [selectedDiscount, state.selectedDiscountId]);

  const normalizedSucursales = useMemo(
    () => (Array.isArray(sucursales) ? sucursales : []),
    [sucursales]
  );

  useEffect(() => {
    if (!isSuperAdmin) return;
    if (!normalizedSucursales.length) return;
    setState((current) => {
      if (String(current.selectedSucursal || '').trim()) return current;
      return {
        ...current,
        selectedSucursal: String(normalizedSucursales[0].id_sucursal)
      };
    });
  }, [isSuperAdmin, normalizedSucursales]);

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
    () => (canApplyDiscount ? computeDiscountAmount(subtotal, selectedDiscount) : 0),
    [canApplyDiscount, selectedDiscount, subtotal]
  );

  const lineDiscountValue = useMemo(() => {
    if (!canApplyDiscount) return 0;
    return roundMoney(
      state.cart.reduce((acc, line) => {
        const discount = normalizedDescuentosCatalogo.find(
          (row) => String(row.id_descuento_catalogo) === String(line.id_descuento_catalogo_linea || '')
        );
        if (!discount) return acc;
        const scope = normalizeDiscountScope(discount.alcance);
        if (
          (scope === 'PRODUCTO' && line.kind !== 'PRODUCTO') ||
          (scope === 'RECETA' && line.kind !== 'RECETA') ||
          (scope === 'COMBO' && line.kind !== 'COMBO')
        ) return acc;
        const lineSubtotal = roundMoney(Number(line.precio_unitario ?? 0) * Number(line.cantidad ?? 0));
        return acc + computeDiscountAmount(lineSubtotal, discount);
      }, 0)
    );
  }, [canApplyDiscount, normalizedDescuentosCatalogo, state.cart]);

  const usesLineDiscount = useMemo(
    () => state.cart.some((line) => Number(line.id_descuento_catalogo_linea || 0) > 0),
    [state.cart]
  );
  const usesGlobalDiscount = Boolean(state.selectedDiscountId);
  const totalDiscount = usesLineDiscount ? lineDiscountValue : discountValue;

  const taxableSubtotal = roundMoney(Math.max(subtotal - totalDiscount, 0));
  const isv = roundMoney(taxableSubtotal * 0.15);
  const total = roundMoney(taxableSubtotal + isv);

  const cashValue = useMemo(() => {
    if (state.cashReceived === '') return total;
    const numeric = Number(state.cashReceived);
    return Number.isFinite(numeric) && numeric >= 0 ? roundMoney(numeric) : 0;
  }, [state.cashReceived, total]);

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
        const shouldAutoApplyLineDiscount = canApplyDiscount && !current.selectedDiscountId;
        const autoDiscount = shouldAutoApplyLineDiscount
          ? resolveBestDiscountForLine({
            discounts: normalizedDescuentosCatalogo,
            line: catalogLine,
            selectedSucursalId
          })
          : null;

        nextCart.push({
          ...catalogLine,
          id_descuento_catalogo_linea: autoDiscount ? String(autoDiscount.id_descuento_catalogo) : ''
        });
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
        id_descuento_catalogo:
          canApplyDiscount && !usesLineDiscount && state.selectedDiscountId
            ? Number(state.selectedDiscountId)
            : null,
        descuento: canApplyDiscount && !usesLineDiscount && !state.selectedDiscountId ? discountValue : 0,
        efectivo_entregado: cashValue,
        descripcion_pedido: null,
        items: state.cart.map((line) => ({
          id_producto: line.id_producto,
          id_combo: line.id_combo,
          id_receta: line.id_receta,
          cantidad: Number(line.cantidad),
          id_descuento_catalogo:
            canApplyDiscount && !usesGlobalDiscount && line.id_descuento_catalogo_linea
              ? Number(line.id_descuento_catalogo_linea)
              : null,
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
    canApplyDiscount,
    descuentosCatalogo: normalizedDescuentosCatalogo,
    descuentoGlobalOptions,
    descuentoPickerOpen: state.descuentoPickerOpen,
    cashReceived: state.cashReceived,
    cart: state.cart,
    submitError: state.submitError,
    currentCatalogRows,
    resultsLabel,
    cartCount,
    subtotal,
    discountValue: totalDiscount,
    globalDiscountValue: discountValue,
    lineDiscountValue,
    usesGlobalDiscount,
    usesLineDiscount,
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
    sucursalPickerOpen: state.sucursalPickerOpen,
    setSucursalPickerOpen: (value) => setPartialState({ sucursalPickerOpen: value }),
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
      setPartialState(
        state.cart.some((line) => Number(line.id_descuento_catalogo_linea || 0) > 0)
          ? {
              descuentoPickerOpen: false,
              submitError: 'No se puede combinar descuento global con descuentos por producto/receta/combo.'
            }
          : {
              selectedDiscountId: value,
              descuentoPickerOpen: false,
              submitError: ''
            }
      ),
    getAvailableLineDiscounts: (line) =>
      normalizedDescuentosCatalogo.filter((discount) => {
        const scope = normalizeDiscountScope(discount.alcance);
        if (scope === 'FACTURA_COMPLETA') return false;
        if (scope !== String(line.kind || '').toUpperCase()) return false;
        if (!isDiscountAllowedForSucursal(discount, selectedSucursalId)) return false;
        if (state.selectedDiscountId) return false;
        if (scope === 'PRODUCTO' && toNormalizedId(discount.id_producto) !== toNormalizedId(line.id_producto)) return false;
        if (scope === 'RECETA' && toNormalizedId(discount.id_receta) !== toNormalizedId(line.id_receta)) return false;
        if (scope === 'COMBO' && toNormalizedId(discount.id_combo) !== toNormalizedId(line.id_combo)) return false;
        return true;
      }),
    getBestCatalogDiscount: (kind, row) =>
      resolveBestDiscountForLine({
        discounts: normalizedDescuentosCatalogo,
        selectedSucursalId,
        line: {
          kind,
          id_producto: row?.id_producto ?? null,
          id_receta: row?.id_receta ?? null,
          id_combo: row?.id_combo ?? null,
          precio_unitario: Number(row?.precio ?? 0) || 0,
          cantidad: 1
        }
      }),
    setLineDiscount: (cartKey, discountId) =>
      setState((current) => ({
        ...current,
        selectedDiscountId: discountId ? '' : current.selectedDiscountId,
        cart: current.cart.map((line) =>
          line.cartKey === cartKey
            ? { ...line, id_descuento_catalogo_linea: discountId || '' }
            : line
        ),
        submitError:
          current.selectedDiscountId && discountId
            ? 'No se puede combinar descuento global con descuentos por producto/receta/combo.'
            : ''
      })),
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
