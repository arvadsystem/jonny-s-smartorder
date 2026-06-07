import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { CATALOG_TABS, PAYMENT_OPTIONS } from '../../../../modules/ventas/constants/ventasOptions';
import {
  buildCartKey,
  clampExtrasToQuantity,
  filterBySearch,
  findLineIndex,
  getComboDepartmentIds,
  getExtrasCount,
  getExtrasSubtotal,
  getResultsLabel,
  normalizeComplementIds,
  normalizeExtras,
  toNormalizedId
} from '../../../../modules/ventas/utils/ventasCartUtils';
import {
  computeDiscountAmount,
  isDiscountActiveAtDate,
  isDiscountAllowedForSucursal,
  isDiscountApplicableToLine,
  normalizeDiscountScope,
  resolveBestDiscountForLine
} from '../../../../modules/ventas/utils/ventasDiscountUtils';
import {
  buildPaidSalePayload as buildPaidSaleRequestPayload,
  buildPedidoPendientePayload as buildPedidoPendienteRequestPayload
} from '../../../../modules/ventas/utils/ventasPayloadBuilders';
import { formatCurrency, roundMoney } from '../../../../modules/ventas/utils/ventasMoneyUtils';
import ventasService from '../../../../services/ventasService';

export { CATALOG_TABS, PAYMENT_OPTIONS } from '../../../../modules/ventas/constants/ventasOptions';
export { getComboDepartmentIds } from '../../../../modules/ventas/utils/ventasCartUtils';

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
  submitError: '',
  incompleteComplementCartKey: ''
});

const inferSauceUnitsBaseFromText = (...sources) => {
  const text = sources
    .filter(Boolean)
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (!text) return 1;
  if (!/(alitas?|tenders?)/i.test(text)) return 1;
  const match =
    text.match(/\b(\d{1,3})\s*(?:alitas?|tenders?)\b/i) ||
    text.match(/\b(\d{1,3})\s*(?:uds?|unidades?|pzas?|piezas?)\b/i) ||
    text.match(/\((\d{1,3})\s*(?:uds?|unidades?|pzas?|piezas?)\)/i);
  const units = Number(match?.[1] || 0);
  return Number.isFinite(units) && units > 0 ? Math.max(1, Math.floor(units)) : 1;
};

const getQuantityAwareComplementLimit = (line, limit) => {
  const baseLimit = Math.max(0, Number(limit || 0));
  const quantity = Math.max(1, Number(line?.cantidad || 1));
  if (baseLimit <= 0 || quantity <= 1) return baseLimit;

  const wingUnitsBase = inferSauceUnitsBaseFromText(line?.nombre_item, line?.descripcion_item);
  const fallbackBaseLimit = wingUnitsBase > 1 ? Math.ceil(wingUnitsBase / 6) : 0;
  if (fallbackBaseLimit > 0 && fallbackBaseLimit === baseLimit) {
    return Math.ceil((wingUnitsBase * quantity) / 6);
  }

  return baseLimit * quantity;
};

const getLineComplementRequirement = (line) => {
  const selectedCount = normalizeComplementIds(line?.complementos).length;
  const required = getQuantityAwareComplementLimit(line, line?.minimo_complementos);
  const rawMax = getQuantityAwareComplementLimit(line, line?.maximo_complementos);
  const max = rawMax > 0 ? Math.max(required, rawMax) : 0;
  return {
    required,
    max,
    selectedCount,
    authorizedIncomplete: Boolean(line?.complementos_incompletos_autorizados)
  };
};

const getLineComplementSelectionIssue = (line) => {
  if (!line || line.kind === 'PRODUCTO') return null;
  const name = String(line.nombre_item || line.nombre || line.descripcion_item || 'Item').trim();
  const requirement = getLineComplementRequirement(line);
  if (requirement.max > 0 && requirement.selectedCount > requirement.max) {
    const quantity = Math.max(1, Number(line.cantidad || 1));
    return {
      type: 'too_many',
      line,
      cartKey: line.cartKey,
      name,
      ...requirement,
      message: `La cantidad de complementos de ${name} (cantidad ${quantity}) supera el maximo permitido. Seleccionados ${requirement.selectedCount}/${requirement.max}.`
    };
  }
  return null;
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

  const resetComposer = ({ preserveSucursal = false, preserveSession = false } = {}) => {
    setState((current) => {
      const nextState = buildInitialState({ isSuperAdmin, defaultSucursalId });
      return {
        ...nextState,
        selectedSucursal: preserveSucursal ? current.selectedSucursal : nextState.selectedSucursal,
        temporarySessionId: preserveSession ? current.temporarySessionId : nextState.temporarySessionId
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
    if (state.cashReceived === '') return 0;
    const numeric = Number(state.cashReceived);
    return Number.isFinite(numeric) && numeric >= 0 ? roundMoney(numeric) : 0;
  }, [state.cashReceived]);

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
          incompleteComplementCartKey: '',
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
        incompleteComplementCartKey: '',
        submitError: ''
      };
    });
  };

  const openComplementModalForLine = (cartKey) => {
    const line = state.cart.find((row) => row.cartKey === cartKey);
    if (!line) return;
    if (!line.complementos_requiere) return;

    const requirement = getLineComplementRequirement(line);
    setComplementModal({
      open: true,
      mode: 'EDIT',
      kind: line.kind,
      row: {
        ...line,
        minimo_complementos_original: line.minimo_complementos,
        maximo_complementos_original: line.maximo_complementos,
        minimo_complementos: requirement.required,
        maximo_complementos: requirement.max
      },
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
        minimo_complementos: editedLine.minimo_complementos_original ?? editedLine.minimo_complementos,
        maximo_complementos: editedLine.maximo_complementos_original ?? editedLine.maximo_complementos,
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
            incompleteComplementCartKey: '',
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
          incompleteComplementCartKey: '',
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
        incompleteComplementCartKey: '',
        submitError: ''
      };
    });
  };

  const removeLine = (cartKey) => {
    setState((current) => ({
      ...current,
      cart: current.cart.filter((item) => item.cartKey !== cartKey),
      incompleteComplementCartKey: '',
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
          incompleteComplementCartKey: '',
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
        incompleteComplementCartKey: '',
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

  const validateComplementosForPending = ({ openSelector = true } = {}) => {
    if (!validateBaseSale()) return false;

    const issue = state.cart.map(getLineComplementSelectionIssue).find(Boolean);
    if (!issue) {
      setPartialState({
        incompleteComplementCartKey: '',
        submitError: ''
      });
      return true;
    }

    setPartialState({
      incompleteComplementCartKey: issue.cartKey,
      submitError: issue.message
    });
    if (openSelector) {
      openComplementModalForLine(issue.cartKey);
    }
    return false;
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

  const buildPaidSalePayload = ({ cuentaDividida } = {}) =>
    buildPaidSaleRequestPayload({
      state,
      selectedSucursalId,
      cashValue,
      canApplyDiscount,
      cuentaDividida
    });

  const buildPedidoPendientePayload = ({ contacto, contexto, pagoPendiente, delivery, cuentaDividida }) =>
    buildPedidoPendienteRequestPayload({
      state,
      selectedSucursalId,
      canApplyDiscount,
      contacto,
      contexto,
      pagoPendiente,
      delivery,
      cuentaDividida
    });

  const submitPaidSale = async (cuentaDividida) => {
    if (!validatePaidSale()) return null;

    try {
      const response = await onSubmit(buildPaidSalePayload({ cuentaDividida }));

      resetComposer({ preserveSucursal: true, preserveSession: true });
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
    incompleteComplementCartKey: state.incompleteComplementCartKey,
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
    validateComplementosForPending,
    getLineComplementRequirement,
    getLineComplementSelectionIssue,
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
