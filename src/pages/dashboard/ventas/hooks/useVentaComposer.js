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
  temporarySessionId: '',
  selectedDiscountId: '',
  cashReceived: '',
  referenciaPago: '',
  cart: [],
  submitError: ''
});

const normalizeComplementIds = (value) =>
  [...new Set(
    (Array.isArray(value) ? value : [])
      .map((entry) => Number(entry?.id_complemento ?? entry))
      .filter((id) => Number.isInteger(id) && id > 0)
  )].sort((a, b) => a - b);

const buildComplementSignature = (value) => {
  const ids = normalizeComplementIds(value);
  if (ids.length === 0) return 'none';
  return ids.join('-');
};

const buildCartKey = (kind, entityId, complementos = []) =>
  `${kind}:${entityId}:${buildComplementSignature(complementos)}`;

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

const buildCatalogLine = (kind, row, selectedComplementos = []) => {
  const complementosDisponibles = (Array.isArray(row?.complementos_disponibles) ? row.complementos_disponibles : [])
    .map((entry) => ({
      id_complemento: Number(entry?.id_complemento ?? 0) || null,
      nombre: String(entry?.nombre ?? 'Complemento').trim(),
      disponible: entry?.disponible !== false
    }))
    .filter((entry) => entry.id_complemento);
  const complementosSeleccionadosIds = normalizeComplementIds(selectedComplementos);
  const complementosSeleccionados = complementosSeleccionadosIds
    .map((id) => complementosDisponibles.find((entry) => Number(entry.id_complemento) === Number(id)))
    .filter(Boolean)
    .map((entry) => ({
      id_complemento: Number(entry.id_complemento),
      nombre: entry.nombre
    }));
  const complementosMinimo = Number(row?.minimo_complementos ?? 0) || 0;
  const complementosMaximo = Number(row?.maximo_complementos ?? 0) || 0;
  const requiereComplementos = Boolean(row?.requiere_complementos) || complementosMinimo > 0;

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
      imagen_principal_url: row.imagen_principal_url || row.url_imagen || null,
      complementos: [],
      complementos_disponibles: [],
      complementos_requiere: false,
      minimo_complementos: 0,
      maximo_complementos: 0,
      tipo_complemento: null
    };
  }

  if (kind === 'COMBO') {
    return {
      cartKey: buildCartKey(kind, row.id_combo, complementosSeleccionados),
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
      imagen_principal_url: row.imagen_principal_url || row.url_imagen || null,
      complementos: complementosSeleccionados,
      complementos_disponibles: complementosDisponibles,
      complementos_requiere: requiereComplementos,
      minimo_complementos: complementosMinimo,
      maximo_complementos: complementosMaximo,
      tipo_complemento: row?.tipo_complemento || 'SALSAS'
    };
  }

  return {
    cartKey: buildCartKey(kind, row.id_receta, complementosSeleccionados),
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
    imagen_principal_url: row.imagen_principal_url || row.url_imagen || null,
    complementos: complementosSeleccionados,
    complementos_disponibles: complementosDisponibles,
    complementos_requiere: requiereComplementos,
    minimo_complementos: complementosMinimo,
    maximo_complementos: complementosMaximo,
    tipo_complemento: row?.tipo_complemento || 'SALSAS'
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
  onRequireAutoAuxiliar,
  resetKey,
  canApplyDiscount = false
}) => {
  const [state, setState] = useState(() => buildInitialState({ isSuperAdmin, defaultSucursalId }));
  const [complementModal, setComplementModal] = useState({
    open: false,
    mode: 'ADD',
    kind: null,
    row: null,
    cartKey: '',
    selected: [],
    error: ''
  });
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
    setComplementModal({
      open: false,
      mode: 'ADD',
      kind: null,
      row: null,
      cartKey: '',
      selected: [],
      error: ''
    });
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
  const canContinue = hasSelectedSucursal && state.cart.length > 0;
  const canSubmit = hasSelectedSucursal
    && state.cart.length > 0
    && (
      (state.paymentMethod === 'efectivo' && cashValue >= total) ||
      (state.paymentMethod !== 'efectivo' && state.referenciaPago && state.referenciaPago.trim() !== '')
    );
  const resultsLabel = getResultsLabel(state.activeCatalog, currentCatalogRows.length);

  const getCurrentProductoQuantityInCart = (idProducto, cart) =>
    (Array.isArray(cart) ? cart : []).reduce((acc, line) => {
      if (line.kind !== 'PRODUCTO') return acc;
      if (Number(line.id_producto) !== Number(idProducto)) return acc;
      return acc + Number(line.cantidad ?? 0);
    }, 0);

  const requiresComplementSelection = (kind, row) => {
    if (kind === 'PRODUCTO') return false;
    const min = Number(row?.minimo_complementos ?? 0) || 0;
    return Boolean(row?.requiere_complementos) || min > 0;
  };

  const openComplementModalForCatalogItem = (kind, row) => {
    setComplementModal({
      open: true,
      mode: 'ADD',
      kind,
      row,
      cartKey: '',
      selected: [],
      error: ''
    });
  };

  const addCatalogItem = (kind, row, selectedComplementos = []) => {
    if (requiresComplementSelection(kind, row) && selectedComplementos.length === 0) {
      openComplementModalForCatalogItem(kind, row);
      return;
    }

    const catalogLine = buildCatalogLine(kind, row, selectedComplementos);

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
        const currentLine = nextCart[index];
        if (kind === 'PRODUCTO') {
          const stockDisponible = Number(currentLine.stock_disponible ?? 0);
          const nextQty = Number(currentLine.cantidad ?? 0) + 1;
          if (nextQty > stockDisponible) {
            return {
              ...current,
              submitError: `Stock maximo alcanzado para ${row.nombre_producto || 'producto'}.`
            };
          }
        }

        nextCart[index] = {
          ...currentLine,
          cantidad: Number(currentLine.cantidad ?? 0) + 1
        };
        return {
          ...current,
          cart: nextCart,
          submitError: ''
        };
      }

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

      return {
        ...current,
        cart: nextCart,
        submitError: ''
      };
    });
  };

  const openComplementModalForLine = (cartKey) => {
    const line = state.cart.find((row) => row.cartKey === cartKey);
    if (!line) return;
    if (!line.complementos_requiere) return;

    setComplementModal({
      open: true,
      mode: 'EDIT',
      kind: line.kind,
      row: line,
      cartKey,
      selected: normalizeComplementIds(line.complementos),
      error: ''
    });
  };

  const closeComplementModal = () => {
    setComplementModal((current) => ({
      ...current,
      open: false,
      error: ''
    }));
  };

  const confirmComplementModal = (selectedComplementos) => {
    const ids = normalizeComplementIds(selectedComplementos);
    const min = Number(complementModal?.row?.minimo_complementos ?? 0) || 0;
    const max = Number(complementModal?.row?.maximo_complementos ?? 0) || 0;

    if (min > 0 && ids.length < min) {
      setComplementModal((current) => ({
        ...current,
        error: 'Selecciona al menos 1 complemento.'
      }));
      return false;
    }

    if (max > 0 && ids.length > max) {
      setComplementModal((current) => ({
        ...current,
        error: `No puedes seleccionar más de ${max} complemento(s).`
      }));
      return false;
    }

    if (complementModal.mode === 'EDIT') {
      const editedLine = complementModal.row;
      const baseRow = {
        ...editedLine,
        minimo_complementos: editedLine.minimo_complementos,
        maximo_complementos: editedLine.maximo_complementos,
        complementos_disponibles: editedLine.complementos_disponibles
      };
      const rebuilt = buildCatalogLine(editedLine.kind, baseRow, ids);
      setState((current) => {
        const duplicateIndex = current.cart.findIndex(
          (line) =>
            line.cartKey === rebuilt.cartKey &&
            line.cartKey !== complementModal.cartKey
        );

        if (duplicateIndex >= 0) {
          return {
            ...current,
            cart: current.cart
              .filter((line) => line.cartKey !== complementModal.cartKey)
              .map((line) =>
                line.cartKey === rebuilt.cartKey
                  ? { ...line, cantidad: Number(line.cantidad ?? 0) + Number(editedLine.cantidad ?? 0) }
                  : line
              ),
            submitError: ''
          };
        }

        return {
          ...current,
          cart: current.cart.map((line) =>
            line.cartKey === complementModal.cartKey
              ? {
                ...line,
                cartKey: rebuilt.cartKey,
                complementos: rebuilt.complementos
              }
              : line
          ),
          submitError: ''
        };
      });
    } else {
      addCatalogItem(complementModal.kind, complementModal.row, ids);
    }

    setComplementModal({
      open: false,
      mode: 'ADD',
      kind: null,
      row: null,
      cartKey: '',
      selected: [],
      error: ''
    });
    return true;
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

  const buildItemsPayload = () =>
    state.cart.map((line) => ({
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
          : String(line.observacion || '').trim() || null,
      complementos: normalizeComplementIds(line.complementos).length > 0
        ? normalizeComplementIds(line.complementos).map((id) => ({ id_complemento: id }))
        : undefined
    }));

  const buildDescuentosLineaPayload = () =>
    state.cart.map((line) => ({
      cart_key: line.cartKey,
      id_descuento_catalogo:
        canApplyDiscount && !usesGlobalDiscount && line.id_descuento_catalogo_linea
          ? Number(line.id_descuento_catalogo_linea)
          : null
    }));

  const validateBaseSale = () => {
    if (!hasSelectedSucursal) {
      setPartialState({
        submitError: isSuperAdmin
          ? 'Selecciona una sucursal para registrar la venta.'
          : 'No tienes sucursal operativa asignada para registrar ventas.'
      });
      return false;
    }

    if (state.cart.length === 0) {
      setPartialState({
        submitError: 'Agrega al menos un item al carrito.'
      });
      return false;
    }

    return true;
  };

  const validatePaidSale = () => {
    if (!validateBaseSale()) return false;

    if (state.paymentMethod !== 'efectivo' && !state.referenciaPago.trim()) {
      setPartialState({
        submitError: 'La referencia de pago es obligatoria para este metodo.'
      });
      return false;
    }

    if (state.paymentMethod === 'efectivo' && cashValue < total) {
      setPartialState({
        submitError: 'El efectivo entregado no puede ser menor al total.'
      });
      return false;
    }

    return true;
  };

  const buildPaidSalePayload = () => ({
    id_cliente: state.selectedClient === 'cf' ? null : Number(state.selectedClient),
    id_sucursal: selectedSucursalId,
    metodo_pago: state.paymentMethod,
    referencia_pago: state.paymentMethod !== 'efectivo' ? state.referenciaPago.trim() : null,
    id_descuento_catalogo:
      canApplyDiscount && !usesLineDiscount && state.selectedDiscountId
        ? Number(state.selectedDiscountId)
        : null,
    descuento: canApplyDiscount && !usesLineDiscount && !state.selectedDiscountId ? discountValue : 0,
    efectivo_entregado: cashValue,
    id_sesion_caja: toNormalizedId(state.temporarySessionId),
    descripcion_pedido: null,
    items: buildItemsPayload()
  });

  const buildPedidoPendientePayload = ({ contacto, contexto, pagoPendiente, delivery }) => ({
    id_cliente: state.selectedClient === 'cf' ? null : Number(state.selectedClient),
    id_sucursal: selectedSucursalId,
    items: buildItemsPayload(),
    descuentos_linea: buildDescuentosLineaPayload(),
    id_descuento_catalogo:
      canApplyDiscount && !usesLineDiscount && state.selectedDiscountId
        ? Number(state.selectedDiscountId)
        : null,
    descuento: canApplyDiscount && !usesLineDiscount && !state.selectedDiscountId ? discountValue : 0,
    id_sesion_caja: toNormalizedId(state.temporarySessionId),
    contacto,
    contexto,
    pago_pendiente: pagoPendiente,
    delivery
  });

  const submitPaidSale = async () => {
    if (!validatePaidSale()) return null;

    try {
      const response = await onSubmit(buildPaidSalePayload());

      resetComposer();
      return response;
    } catch (error) {
      const errorCode = String(error?.data?.code || '').trim().toUpperCase();
      const errorMessage = String(error?.message || '').toLowerCase();
      const sessionMessageMatch =
        errorMessage.includes('sesion de caja activa') ||
        errorMessage.includes('sesión de caja activa') ||
        errorMessage.includes('caja activa permitida');
      if (
        isSuperAdmin
        && hasSelectedSucursal
        && state.cart.length > 0
        && (
          ['NO_ACTIVE_SESSION', 'SESSION_PARTICIPATION_REQUIRED', 'SESSION_AUTHORIZATION_REQUIRED', 'SESSION_NOT_OPEN', 'SESSION_SCOPE_MISMATCH'].includes(errorCode)
          || (Number(error?.status || 0) === 403 && sessionMessageMatch)
        )
      ) {
        Promise.resolve(onRequireAutoAuxiliar?.({ idSucursal: selectedSucursalId })).catch(() => null);
      }
      setPartialState({
        submitError: error?.message || 'No se pudo registrar la venta.'
      });
      return null;
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    return submitPaidSale();
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
    referenciaPago: state.referenciaPago,
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
    canContinue,
    complementModal,
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
        temporarySessionId: '',
        submitError: ''
      }),
    temporarySessionId: state.temporarySessionId,
    setTemporarySessionId: (value) => setPartialState({ temporarySessionId: String(value || ''), submitError: '' }),
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
    setReferenciaPago: (value) => setPartialState({ referenciaPago: value }),
    addCatalogItem,
    openComplementModalForLine,
    closeComplementModal,
    confirmComplementModal,
    updateLine,
    removeLine,
    handleSearchKeyDown,
    handleSubmit,
    submitPaidSale,
    validateBaseSale,
    buildPedidoPendientePayload,
    buildPaidSalePayload,
    selectedSucursalId,
    sucursales: normalizedSucursales,
    categorias: Array.isArray(categorias) ? categorias : [],
    tiposDepartamento: Array.isArray(tiposDepartamento) ? tiposDepartamento : [],
    clientes: Array.isArray(clientes) ? clientes : [],
    formatCurrency
  };
};
