import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { formatCurrency, roundMoney } from '../utils/ventasHelpers';
import ventasService from '../../../../services/ventasService';

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

const normalizeExtras = (value) =>
  (Array.isArray(value) ? value : [])
    .map((entry) => ({
      id_extra: Number(entry?.id_extra ?? 0),
      cantidad: Number(entry?.cantidad ?? 0),
      codigo: String(entry?.codigo || '').trim(),
      nombre: String(entry?.nombre || 'Extra').trim(),
      precio: roundMoney(entry?.precio ?? entry?.precio_unitario ?? 0),
      id_insumo: Number(entry?.id_insumo ?? 0) || null,
      stock_disponible: entry?.stock_disponible ?? null
    }))
    .filter((entry) => Number.isInteger(entry.id_extra) && entry.id_extra > 0 && Number.isInteger(entry.cantidad) && entry.cantidad > 0)
    .sort((left, right) => left.id_extra - right.id_extra);

const buildExtrasSignature = (value) => {
  const extras = normalizeExtras(value);
  if (extras.length === 0) return 'noextras';
  return extras.map((entry) => `${entry.id_extra}x${entry.cantidad}`).join('-');
};

const getExtrasSubtotal = (value) =>
  roundMoney(normalizeExtras(value).reduce((sum, entry) => sum + Number(entry.precio || 0) * Number(entry.cantidad || 0), 0));

const getExtrasCount = (value) =>
  normalizeExtras(value).reduce((sum, entry) => sum + Number(entry.cantidad || 0), 0);

const clampExtrasToQuantity = (extras, quantity) => {
  const max = Math.max(0, Number(quantity || 0));
  return normalizeExtras(extras)
    .map((entry) => ({ ...entry, cantidad: Math.min(Number(entry.cantidad || 0), max) }))
    .filter((entry) => entry.cantidad > 0);
};

const buildCartKey = (kind, entityId, complementos = [], extras = []) =>
  `${kind}:${entityId}:${buildComplementSignature(complementos)}:${buildExtrasSignature(extras)}`;

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

const appendDiscountTargetIds = (ids, value, legacyKey) => {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((entry) => appendDiscountTargetIds(ids, entry, legacyKey));
    return;
  }
  if (typeof value === 'string' && value.includes(',')) {
    value.split(',').forEach((entry) => appendDiscountTargetIds(ids, entry, legacyKey));
    return;
  }
  if (typeof value === 'object') {
    appendDiscountTargetIds(
      ids,
      value[legacyKey] ?? value.id ?? value.value ?? value.id_producto ?? value.id_receta ?? value.id_combo,
      legacyKey
    );
    return;
  }
  const id = toNormalizedId(value);
  if (id) ids.add(id);
};

const addComboDepartmentId = (ids, value) => {
  const id = toNormalizedId(value);
  if (id) ids.add(id);
};

const addComboDepartmentArrayIds = (ids, value) => {
  if (!Array.isArray(value)) return;
  value.forEach((entry) => {
    if (entry && typeof entry === 'object') {
      addComboDepartmentId(
        ids,
        entry.id_tipo_departamento ?? entry.id_departamento ?? entry.id ?? entry.value
      );
      return;
    }
    addComboDepartmentId(ids, entry);
  });
};

export const getComboDepartmentIds = (combo) => {
  const ids = new Set();
  addComboDepartmentId(ids, combo?.id_tipo_departamento);
  addComboDepartmentId(ids, combo?.id_tipo_departamento_principal);
  addComboDepartmentArrayIds(ids, combo?.departamentos_ids);
  addComboDepartmentArrayIds(ids, combo?.departamentos);
  addComboDepartmentArrayIds(ids, combo?.departamentos_derivados);
  return [...ids];
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

const buildCatalogLine = (kind, row, selectedComplementos = [], options = {}) => {
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
  const complementosIncompletosAutorizados = Boolean(options?.complementos_incompletos_autorizados);

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
      extras: [],
      complementos_disponibles: [],
      complementos_requiere: false,
      minimo_complementos: 0,
      maximo_complementos: 0,
      complementos_incompletos_autorizados: false,
      tipo_complemento: null
    };
  }

  if (kind === 'COMBO') {
    return {
      cartKey: buildCartKey(kind, row.id_combo, complementosSeleccionados, []),
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
      extras: [],
      complementos_disponibles: complementosDisponibles,
      complementos_requiere: requiereComplementos,
      minimo_complementos: complementosMinimo,
      maximo_complementos: complementosMaximo,
      complementos_incompletos_autorizados: complementosIncompletosAutorizados,
      tipo_complemento: row?.tipo_complemento || 'SALSAS'
    };
  }

  return {
    cartKey: buildCartKey(kind, row.id_receta, complementosSeleccionados, []),
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
    extras: [],
    complementos_disponibles: complementosDisponibles,
    complementos_requiere: requiereComplementos,
    minimo_complementos: complementosMinimo,
    maximo_complementos: complementosMaximo,
    complementos_incompletos_autorizados: complementosIncompletosAutorizados,
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

const normalizeDiscountTargetIds = (discount, key, legacyKey) => {
  const objetivos = discount?.objetivos && typeof discount.objetivos === 'object' ? discount.objetivos : {};
  const ids = new Set();
  appendDiscountTargetIds(ids, objetivos[key], legacyKey);
  appendDiscountTargetIds(ids, discount?.[key], legacyKey);
  appendDiscountTargetIds(ids, discount?.[`${key}_ids`], legacyKey);
  appendDiscountTargetIds(ids, discount?.[legacyKey], legacyKey);
  return [...ids].map(Number);
};

const isDiscountApplicableToLine = (discount, line, selectedSucursalId) => {
  const scope = normalizeDiscountScope(discount.alcance);
  if (scope === 'FACTURA_COMPLETA') return false;
  if (scope !== String(line.kind || '').toUpperCase()) return false;
  if (!isDiscountAllowedForSucursal(discount, selectedSucursalId)) return false;
  if (scope === 'PRODUCTO') {
    return normalizeDiscountTargetIds(discount, 'productos', 'id_producto').includes(Number(line.id_producto || 0));
  }
  if (scope === 'RECETA') {
    return normalizeDiscountTargetIds(discount, 'recetas', 'id_receta').includes(Number(line.id_receta || 0));
  }
  if (scope === 'COMBO') {
    return normalizeDiscountTargetIds(discount, 'combos', 'id_combo').includes(Number(line.id_combo || 0));
  }
  return false;
};

const resolveBestDiscountForLine = ({ discounts, line, selectedSucursalId }) => {
  const lineSubtotal = roundMoney(Number(line?.precio_unitario ?? 0) * Number(line?.cantidad ?? 0));
  if (lineSubtotal <= 0) return null;

  let best = null;
  for (const discount of discounts) {
    if (!isDiscountApplicableToLine(discount, line, selectedSucursalId)) continue;

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
    options: {},
    error: ''
  });
  const [extrasModal, setExtrasModal] = useState({
    open: false,
    cartKey: '',
    row: null,
    options: [],
    selected: [],
    loading: false,
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
      options: {},
      error: ''
    });
    setExtrasModal({
      open: false,
      cartKey: '',
      row: null,
      options: [],
      selected: [],
      loading: false,
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
    const categoryId = toNormalizedId(categoryValue);
    const categoryFiltered = (Array.isArray(combos) ? combos : []).filter((combo) =>
      categoryValue === 'all'
        ? true
        : getComboDepartmentIds(combo).some((id) => Number(id) === Number(categoryId))
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

  const discountCatalogRows = useMemo(() => {
    if (!canApplyDiscount) return [];

    const candidates = [
      ...filteredProducts.map((row) => ({ kind: 'PRODUCTO', row })),
      ...filteredCombos.map((row) => ({ kind: 'COMBO', row })),
      ...filteredRecetas.map((row) => ({ kind: 'RECETA', row }))
    ];

    return candidates
      .map((entry) => {
        const discount = resolveBestDiscountForLine({
          discounts: normalizedDescuentosCatalogo,
          selectedSucursalId,
          line: {
            kind: entry.kind,
            id_producto: entry.row?.id_producto ?? null,
            id_receta: entry.row?.id_receta ?? null,
            id_combo: entry.row?.id_combo ?? null,
            precio_unitario: Number(entry.row?.precio ?? 0) || 0,
            cantidad: 1
          }
        });
        return discount ? { ...entry, discount } : null;
      })
      .filter(Boolean);
  }, [
    canApplyDiscount,
    filteredCombos,
    filteredProducts,
    filteredRecetas,
    normalizedDescuentosCatalogo,
    selectedSucursalId
  ]);

  const cartCount = useMemo(
    () => state.cart.reduce((total, line) => total + Number(line.cantidad ?? 0), 0),
    [state.cart]
  );

  const baseSubtotal = useMemo(
    () =>
      roundMoney(
        state.cart.reduce(
          (total, line) => total + Number(line.precio_unitario ?? 0) * Number(line.cantidad ?? 0),
          0
        )
    ),
    [state.cart]
  );
  const extrasSubtotal = useMemo(
    () => roundMoney(state.cart.reduce((total, line) => total + getExtrasSubtotal(line.extras), 0)),
    [state.cart]
  );
  const subtotal = roundMoney(baseSubtotal + extrasSubtotal);

  const getApplicableLineDiscounts = (line) => {
    if (!canApplyDiscount) return [];
    return normalizedDescuentosCatalogo.filter((discount) => {
      return isDiscountApplicableToLine(discount, line, selectedSucursalId);
    });
  };

  const lineDiscountDetails = useMemo(() => {
    if (!canApplyDiscount) return [];
    return state.cart.map((line) => {
      const availableDiscounts = getApplicableLineDiscounts(line);
      const selectedLineDiscount = availableDiscounts.find(
        (row) => String(row.id_descuento_catalogo) === String(line.id_descuento_catalogo_linea || '')
      ) || null;
      const lineSubtotal = roundMoney(Number(line.precio_unitario ?? 0) * Number(line.cantidad ?? 0));
      const discountAmount = computeDiscountAmount(lineSubtotal, selectedLineDiscount);
      return {
        line,
        availableDiscounts,
        selectedDiscount: selectedLineDiscount,
        lineSubtotal,
        discountAmount
      };
    });
  }, [canApplyDiscount, normalizedDescuentosCatalogo, selectedSucursalId, state.cart]);

  const lineDiscountValue = useMemo(
    () => roundMoney(lineDiscountDetails.reduce((acc, row) => acc + Number(row.discountAmount || 0), 0)),
    [lineDiscountDetails]
  );

  const usesLineDiscount = useMemo(
    () => canApplyDiscount && state.cart.some((line) => Number(line.id_descuento_catalogo_linea || 0) > 0),
    [canApplyDiscount, state.cart]
  );
  const usesGlobalDiscount = canApplyDiscount && Boolean(state.selectedDiscountId);
  const subtotalAfterLineDiscount = roundMoney(Math.max(baseSubtotal - lineDiscountValue, 0));
  const discountValue = useMemo(
    () => (canApplyDiscount ? computeDiscountAmount(subtotalAfterLineDiscount, selectedDiscount) : 0),
    [canApplyDiscount, selectedDiscount, subtotalAfterLineDiscount]
  );
  const totalDiscount = roundMoney(lineDiscountValue + discountValue);

  const taxableSubtotal = roundMoney(Math.max(baseSubtotal - totalDiscount, 0) + extrasSubtotal);
  // Impuestos desactivados temporalmente; la configuracion por sucursal se conectara en una fase posterior.
  const isv = 0;
  const total = taxableSubtotal;

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

  const openComplementModalForCatalogItem = (kind, row, options = {}) => {
    setComplementModal({
      open: true,
      mode: 'ADD',
      kind,
      row,
      cartKey: '',
      selected: [],
      options,
      error: ''
    });
  };

  const addCatalogItem = (kind, row, selectedComplementos = [], options = {}) => {
    const allowEmptyComplementos = Boolean(options?.allowEmptyComplementos);
    if (requiresComplementSelection(kind, row) && selectedComplementos.length === 0 && !allowEmptyComplementos) {
      openComplementModalForCatalogItem(kind, row, options);
      return;
    }

    const catalogLine = buildCatalogLine(kind, row, selectedComplementos, options);
    const requestedDiscountId = toNormalizedId(
      options?.id_descuento_catalogo ?? options?.discountId ?? options?.discount?.id_descuento_catalogo
    );
    const requestedDiscount = requestedDiscountId
      ? normalizedDescuentosCatalogo.find((discount) =>
        Number(discount?.id_descuento_catalogo) === requestedDiscountId &&
        isDiscountApplicableToLine(discount, catalogLine, selectedSucursalId)
      )
      : null;

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

        const autoDiscount = canApplyDiscount && !currentLine.id_descuento_catalogo_linea
          ? requestedDiscount || resolveBestDiscountForLine({
            discounts: normalizedDescuentosCatalogo,
            line: catalogLine,
            selectedSucursalId
          })
          : null;

        nextCart[index] = {
          ...currentLine,
          cantidad: Number(currentLine.cantidad ?? 0) + 1,
          id_descuento_catalogo_linea: currentLine.id_descuento_catalogo_linea || (autoDiscount ? String(autoDiscount.id_descuento_catalogo) : '')
        };
        return {
          ...current,
          cart: nextCart,
          submitError: ''
        };
      }

      const shouldAutoApplyLineDiscount = canApplyDiscount;
      const autoDiscount = shouldAutoApplyLineDiscount
        ? requestedDiscount || resolveBestDiscountForLine({
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
      options: {},
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

  const confirmComplementModal = (selectedComplementos, complementOptions = {}) => {
    const ids = normalizeComplementIds(selectedComplementos);
    const max = Number(complementModal?.row?.maximo_complementos ?? 0) || 0;

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
      const rebuilt = buildCatalogLine(editedLine.kind, baseRow, ids, complementOptions);
      rebuilt.extras = normalizeExtras(editedLine.extras);
      rebuilt.cartKey = buildCartKey(editedLine.kind, editedLine.entityId, rebuilt.complementos, rebuilt.extras);
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
                  ? {
                    ...line,
                    cantidad: Number(line.cantidad ?? 0) + Number(editedLine.cantidad ?? 0),
                    observacion: line.observacion || editedLine.observacion || '',
                    complementos_incompletos_autorizados: Boolean(
                      line.complementos_incompletos_autorizados || rebuilt.complementos_incompletos_autorizados
                    )
                  }
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
                complementos: rebuilt.complementos,
                complementos_incompletos_autorizados: rebuilt.complementos_incompletos_autorizados
              }
              : line
          ),
          submitError: ''
        };
      });
    } else {
      addCatalogItem(complementModal.kind, complementModal.row, ids, {
        ...(complementModal.options || {}),
        ...complementOptions,
        allowEmptyComplementos: true
      });
    }

    setComplementModal({
      open: false,
      mode: 'ADD',
      kind: null,
      row: null,
      cartKey: '',
      selected: [],
      options: {},
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

          const adjustedExtras = clampExtrasToQuantity(candidate.extras, candidate.cantidad);
          return {
            ...candidate,
            extras: adjustedExtras,
            cartKey: buildCartKey(candidate.kind, candidate.entityId, candidate.complementos, adjustedExtras)
          };
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

  const openExtrasModalForLine = async (cartKey) => {
    const line = state.cart.find((row) => row.cartKey === cartKey);
    if (!line || line.kind === 'PRODUCTO') return;

    setExtrasModal({
      open: true,
      cartKey,
      row: line,
      options: [],
      selected: normalizeExtras(line.extras),
      loading: true,
      error: ''
    });

    try {
      const response = await ventasService.getExtrasPermitidos({
        tipo: line.kind,
        id_item: line.entityId,
        id_sucursal: selectedSucursalId
      });
      const options = (Array.isArray(response) ? response : [])
        .filter((entry) => entry?.estado !== false)
        .map((entry) => ({
          id_extra: Number(entry.id_extra),
          codigo: String(entry.codigo || '').trim(),
          nombre: String(entry.nombre || 'Extra').trim(),
          precio: roundMoney(entry.precio),
          id_insumo: Number(entry.id_insumo || 0) || null,
          stock_disponible: entry.stock_disponible ?? null
        }))
        .filter((entry) => Number.isInteger(entry.id_extra) && entry.id_extra > 0);
      setExtrasModal((current) => ({
        ...current,
        options,
        loading: false,
        error: ''
      }));
    } catch (error) {
      setExtrasModal((current) => ({
        ...current,
        loading: false,
        error: error?.message || 'No se pudieron cargar los extras.'
      }));
    }
  };

  const closeExtrasModal = () => {
    setExtrasModal((current) => ({ ...current, open: false, loading: false, error: '' }));
  };

  const confirmExtrasModal = (selectedExtras) => {
    const nextExtras = clampExtrasToQuantity(selectedExtras, extrasModal.row?.cantidad);
    setState((current) => {
      const currentLine = current.cart.find((line) => line.cartKey === extrasModal.cartKey);
      if (!currentLine) return current;
      const nextCartKey = buildCartKey(currentLine.kind, currentLine.entityId, currentLine.complementos, nextExtras);
      const duplicate = current.cart.find((line) => line.cartKey === nextCartKey && line.cartKey !== extrasModal.cartKey);
      if (duplicate) {
        const mergedQty = Number(duplicate.cantidad || 0) + Number(currentLine.cantidad || 0);
        return {
          ...current,
          cart: current.cart
            .filter((line) => line.cartKey !== extrasModal.cartKey)
            .map((line) =>
              line.cartKey === nextCartKey
                ? {
                  ...line,
                  cantidad: mergedQty,
                  extras: clampExtrasToQuantity(nextExtras, mergedQty),
                  observacion: line.observacion || currentLine.observacion || ''
                }
                : line
            ),
          submitError: ''
        };
      }
      return {
        ...current,
        cart: current.cart.map((line) =>
          line.cartKey === extrasModal.cartKey
            ? {
              ...line,
              extras: nextExtras,
              cartKey: nextCartKey
            }
            : line
        ),
        submitError: ''
      };
    });
    setExtrasModal({
      open: false,
      cartKey: '',
      row: null,
      options: [],
      selected: [],
      loading: false,
      error: ''
    });
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
    state.cart.map((line) => {
      const payload = {
        cart_key: line.cartKey,
        id_producto: line.id_producto,
        id_combo: line.id_combo,
        id_receta: line.id_receta,
        cantidad: Number(line.cantidad)
      };
      const lineDiscountId = Number(line.id_descuento_catalogo_linea || 0);
      if (canApplyDiscount && lineDiscountId > 0) {
        payload.id_descuento_catalogo = lineDiscountId;
      }
      if (line.kind !== 'PRODUCTO') {
        payload.observacion = String(line.observacion || '').trim() || null;
      }
      const complementos = normalizeComplementIds(line.complementos);
      if (complementos.length > 0) {
        payload.complementos = complementos.map((id) => ({ id_complemento: id }));
      }
      if (line.kind !== 'PRODUCTO' && line.complementos_incompletos_autorizados) {
        payload.complementos_incompletos_autorizados = true;
      }
      const extras = normalizeExtras(line.extras);
      if (extras.length > 0) {
        payload.extras = extras.map((entry) => ({
          id_extra: entry.id_extra,
          cantidad: entry.cantidad
        }));
      }
      return payload;
    });

  const buildDescuentosLineaPayload = () => {
    if (!canApplyDiscount) return [];
    return state.cart
      .map((line) => ({
        cart_key: line.cartKey,
        id_descuento_catalogo: Number(line.id_descuento_catalogo_linea || 0)
      }))
      .filter((line) => line.id_descuento_catalogo > 0);
  };

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

  const applyDiscountPayloadFields = (payload) => {
    if (!canApplyDiscount) return payload;
    if (state.selectedDiscountId) {
      return {
        ...payload,
        id_descuento_catalogo: Number(state.selectedDiscountId)
      };
    }
    return payload;
  };

  const buildPaidSalePayload = ({ cuentaDividida } = {}) =>
    applyDiscountPayloadFields({
      id_cliente: state.selectedClient === 'cf' ? null : Number(state.selectedClient),
      id_sucursal: selectedSucursalId,
      metodo_pago: state.paymentMethod,
      referencia_pago: state.paymentMethod !== 'efectivo' ? state.referenciaPago.trim() : null,
      efectivo_entregado: cashValue,
      id_sesion_caja: toNormalizedId(state.temporarySessionId),
      descripcion_pedido: null,
      items: buildItemsPayload(),
      ...(Array.isArray(cuentaDividida) ? { cuenta_dividida: cuentaDividida } : {})
    });

  const buildPedidoPendientePayload = ({ contacto, contexto, pagoPendiente, delivery, cuentaDividida }) => {
    const descuentosLinea = buildDescuentosLineaPayload();
    const payload = applyDiscountPayloadFields({
      id_cliente: state.selectedClient === 'cf' ? null : Number(state.selectedClient),
      id_sucursal: selectedSucursalId,
      items: buildItemsPayload(),
      id_sesion_caja: toNormalizedId(state.temporarySessionId),
      contacto,
      contexto,
      pago_pendiente: pagoPendiente,
      delivery,
      ...(Array.isArray(cuentaDividida) ? { cuenta_dividida: cuentaDividida } : {})
    });
    if (descuentosLinea.length > 0) {
      payload.descuentos_linea = descuentosLinea;
    }
    return payload;
  };

  const submitPaidSale = async (cuentaDividida) => {
    if (!validatePaidSale()) return null;

    try {
      const response = await onSubmit(buildPaidSalePayload({ cuentaDividida }));

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
          ['NO_ACTIVE_SESSION', 'SESSION_PARTICIPATION_REQUIRED', 'SESSION_AUTHORIZATION_REQUIRED', 'SESSION_NOT_OPEN', 'SESSION_SCOPE_MISMATCH', 'CAJA_NOT_ACTIVE'].includes(errorCode)
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
    discountCatalogRows,
    resultsLabel,
    cartCount,
    baseSubtotal,
    extrasSubtotal,
    subtotal,
    discountValue: totalDiscount,
    globalDiscountValue: discountValue,
    lineDiscountValue,
    totalDiscountValue: totalDiscount,
    subtotalAfterLineDiscount,
    taxableSubtotal,
    lineDiscountDetails,
    usesGlobalDiscount,
    usesLineDiscount,
    isv,
    total,
    cashValue,
    change,
    canSubmit,
    canContinue,
    complementModal,
    extrasModal,
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
    setSelectedSucursal: (value) => {
      const nextSucursal = String(value || '');
      setState((current) => {
        const changed = String(current.selectedSucursal || '') !== nextSucursal;
        return {
          ...current,
          selectedSucursal: nextSucursal,
          temporarySessionId: '',
          selectedDiscountId: '',
          cashReceived: '',
          referenciaPago: '',
          cart: changed ? [] : current.cart,
          submitError: ''
        };
      });
      setComplementModal({
        open: false,
        mode: 'ADD',
        kind: null,
        row: null,
        cartKey: '',
        selected: [],
        options: {},
        error: ''
      });
      setExtrasModal({
        open: false,
        cartKey: '',
        row: null,
        options: [],
        selected: [],
        loading: false,
        error: ''
      });
    },
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
    setSelectedDiscountId: (value) => {
      if (!canApplyDiscount) {
        setPartialState({
          selectedDiscountId: '',
          descuentoPickerOpen: false,
          submitError: ''
        });
        return;
      }
      setPartialState({
        selectedDiscountId: value,
        descuentoPickerOpen: false,
        submitError: ''
      });
    },
    getAvailableLineDiscounts: getApplicableLineDiscounts,
    getBestCatalogDiscount: (kind, row) =>
      !canApplyDiscount ? null : resolveBestDiscountForLine({
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
    setLineDiscount: (cartKey, discountId) => {
      if (!canApplyDiscount) {
        setState((current) => ({
          ...current,
          selectedDiscountId: '',
          cart: current.cart.map((line) =>
            line.cartKey === cartKey
              ? { ...line, id_descuento_catalogo_linea: '' }
              : line
          ),
          submitError: ''
        }));
        return;
      }
      setState((current) => ({
        ...current,
        cart: current.cart.map((line) =>
          line.cartKey === cartKey
            ? { ...line, id_descuento_catalogo_linea: discountId || '' }
            : line
        ),
        submitError: ''
      }));
    },
    setCashReceived: (value) => setPartialState({ cashReceived: value }),
    setReferenciaPago: (value) => setPartialState({ referenciaPago: value }),
    addCatalogItem,
    openComplementModalForLine,
    closeComplementModal,
    confirmComplementModal,
    openExtrasModalForLine,
    closeExtrasModal,
    confirmExtrasModal,
    getExtrasSubtotal,
    getExtrasCount,
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
