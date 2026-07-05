/* eslint-disable react-hooks/set-state-in-effect, react-hooks/preserve-manual-memoization, react-hooks/exhaustive-deps */
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { CATALOG_TABS, PAYMENT_OPTIONS } from '../../../../modules/ventas/constants/ventasOptions';
import {
  buildCartKey,
  createCartLineId,
  filterBySearch,
  findLineIndex,
  getExtrasCount,
  getLineExtrasSubtotal,
  getExtrasSubtotal,
  getResultsLabel,
  isCustomizableVentaLineKind,
  mergeEquivalentVentaLines,
  normalizeComplementIds,
  normalizeValidComplementIds,
  normalizeExtras,
  parseVentaLineQuantity,
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
import { resolveInventarioImageUrl } from '../../../../utils/inventarioImagenes';
import { buildCajaSucursalStorageKey } from '../utils/ventasCajaSucursalStorage';

export { CATALOG_TABS, PAYMENT_OPTIONS } from '../../../../modules/ventas/constants/ventasOptions';

const DEFAULT_CATALOG_KEY = 'RECETAS';
const DEFAULT_DEPARTMENT_NAME = 'ALITAS';
const DEFAULT_DEPARTMENT_ID = '5';

const readPersistedCajaSucursal = (storageKey) => {
  if (typeof window === 'undefined') return '';
  try {
    return String(window.sessionStorage.getItem(storageKey) || '').trim();
  } catch {
    return '';
  }
};

const persistCajaSucursal = (storageKey, value) => {
  if (typeof window === 'undefined') return;
  try {
    const normalized = String(value || '').trim();
    if (normalized) window.sessionStorage.setItem(storageKey, normalized);
    else window.sessionStorage.removeItem(storageKey);
  } catch {
    // Session storage puede estar deshabilitado.
  }
};

const clearPersistedCajaSucursal = (storageKey) => persistCajaSucursal(storageKey, '');

const isQuantityManagedVentaLineKind = (kind) => ['PRODUCTO', 'ITEM', 'RECETA'].includes(String(kind || '').toUpperCase());

const resolveStandaloneExtraAvailableUnits = (entry) => {
  const stock = Number(entry?.stock_disponible);
  const consumoBase = Number(entry?.cantidad_consumo_base);
  if (!Number.isFinite(stock) || stock <= 0) return null;
  if (!Number.isFinite(consumoBase) || consumoBase <= 0) return null;
  return Math.max(0, Math.floor(stock / consumoBase));
};

const isStockOnlyExtraUnavailable = (entry) =>
  String(entry?.codigo_no_disponible || '').trim().toUpperCase() === 'EXTRA_STOCK_INSUFICIENTE';

const isBlockingExtraUnavailable = (entry) =>
  entry?.disponible === false && !isStockOnlyExtraUnavailable(entry);

const normalizeGlobalExtraOption = (entry) => ({
  id_extra: Number(entry.id_extra),
  codigo: String(entry.codigo || '').trim(),
  nombre: String(entry.nombre || 'Extra').trim(),
  precio: roundMoney(entry.precio ?? entry.precio_adicional),
  descripcion: String(entry.nombre || 'Extra').trim(),
  id_insumo: Number(entry.id_insumo || 0) || null,
  id_insumo_maestro: Number(entry.id_insumo_maestro || 0) || null,
  stock_disponible: entry.stock_disponible ?? null,
  cantidad_consumo_base: entry.cantidad_consumo_base ?? entry.cantidad_consumo ?? null,
  id_unidad_base: Number(entry.id_unidad_base || entry.id_unidad_medida || 0) || null,
  disponible: entry.disponible !== false,
  inventario_configurado: entry.inventario_configurado !== false,
  motivo_no_disponible: String(entry.motivo_no_disponible || '').trim() || null,
  codigo_no_disponible: String(entry.codigo_no_disponible || '').trim() || null
});

const normalizeFilterText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

const resolveDefaultDepartmentId = (tiposDepartamento = []) => {
  const defaultDepartment = (Array.isArray(tiposDepartamento) ? tiposDepartamento : []).find(
    (tipo) => normalizeFilterText(tipo?.nombre_tipo_departamento) === DEFAULT_DEPARTMENT_NAME
  );
  return defaultDepartment?.id_tipo_departamento ? String(defaultDepartment.id_tipo_departamento) : 'all';
};

const buildInitialState = ({ isSuperAdmin = false, defaultSucursalId = null } = {}) => ({
  activeCatalog: DEFAULT_CATALOG_KEY,
  search: '',
  activeCategory: DEFAULT_DEPARTMENT_ID,
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
  cartNotice: '',
  submitError: '',
  incompleteComplementCartKey: ''
});

const resolveCatalogImageUrl = (row) => {
  const rawUrl = row?.imagen_principal_url || row?.url_imagen || null;
  return rawUrl ? resolveInventarioImageUrl(rawUrl) : null;
};

const getLineComplementRequirement = (line) => {
  const selectedCount = normalizeComplementIds(line?.complementos).length;
  const required = Math.max(0, Number(line?.minimo_complementos || 0));
  const rawMax = Math.max(0, Number(line?.maximo_complementos || 0));
  const max = rawMax > 0 ? Math.max(required, rawMax) : 0;
  return {
    required,
    max,
    selectedCount,
    authorizedIncomplete: Boolean(line?.complementos_incompletos_autorizados)
  };
};

const getLineComplementSelectionIssue = (line) => {
  if (!line) return null;
  const name = String(line.nombre_item || line.nombre || line.descripcion_item || 'Item').trim();
  const rawComplementos = Array.isArray(line.complementos) ? line.complementos : [];
  const rawIds = rawComplementos
    .map((entry) => Number(entry?.id_complemento ?? entry))
    .filter((id) => Number.isInteger(id) && id > 0);
  const normalizedIds = normalizeComplementIds(rawComplementos);
  const validIds = normalizeValidComplementIds(line);
  const permitsComplementos = (Array.isArray(line.complementos_disponibles)
    ? line.complementos_disponibles
    : []).some((entry) => entry?.disponible !== false);
  const requirement = getLineComplementRequirement(line);
  const invalidSelection =
    rawComplementos.length !== rawIds.length
    || rawIds.length !== normalizedIds.length
    || normalizedIds.length !== validIds.length
    || (line.kind === 'PRODUCTO' && rawComplementos.length > 0)
    || (!line.complementos_requiere && !permitsComplementos && normalizedIds.length > 0);
  if (invalidSelection) {
    return {
      type: 'invalid',
      line,
      cartKey: line.cartKey,
      name,
      ...requirement,
      message: `Revisa los complementos de ${name}. Hay una seleccion que ya no es valida.`
    };
  }
  if (requirement.required > 0 && requirement.selectedCount < requirement.required && !requirement.authorizedIncomplete) {
    return {
      type: 'missing',
      line,
      cartKey: line.cartKey,
      name,
      ...requirement,
      message: `Revisa los complementos de ${name}. Faltan complementos por seleccionar.`
    };
  }
  if (requirement.max > 0 && requirement.selectedCount > requirement.max) {
    return {
      type: 'too_many',
      line,
      cartKey: line.cartKey,
      name,
      ...requirement,
      message: `La cantidad de complementos de ${name} supera el maximo permitido. Seleccionados ${requirement.selectedCount}/${requirement.max}.`
    };
  }
  return null;
};

const buildCatalogLine = (kind, row, selectedComplementos = [], options = {}) => {
  const normalizedKind = String(kind || '').toUpperCase();
  const lineId = isCustomizableVentaLineKind(normalizedKind)
    ? String(options?.lineId || createCartLineId())
    : null;
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
      lineId,
      kind,
      entityId: row.id_producto,
      id_producto: row.id_producto,
      id_receta: null,
      nombre_item: row.nombre_producto,
      categoria_label: row.categoria_label || 'Productos',
      descripcion_item: row.descripcion_producto || row.categoria_label || 'Producto',
      precio_unitario: row.precio,
      cantidad: 1,
      stock_disponible: Number(row.cantidad ?? 0) || 0,
      observacion: '',
      imagen_principal_url: resolveCatalogImageUrl(row),
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

  if (kind === 'ITEM') {
    return {
      cartKey: buildCartKey(kind, row.id_extra),
      lineId,
      kind,
      entityId: row.id_extra,
      id_producto: null,
      id_receta: null,
      id_extra: row.id_extra,
      nombre_item: row.nombre,
      categoria_label: 'Extras',
      descripcion_item: row.descripcion || row.nombre || 'Extra',
      precio_unitario: row.precio,
      cantidad: 1,
      stock_disponible: row.stock_disponible ?? null,
      available_units: resolveStandaloneExtraAvailableUnits(row),
      observacion: '',
      imagen_principal_url: null,
      complementos: [],
      extras: [],
      complementos_disponibles: [],
      complementos_requiere: false,
      minimo_complementos: 0,
      maximo_complementos: 0,
      complementos_incompletos_autorizados: false,
      tipo_complemento: null,
      inventario_configurado: row.inventario_configurado !== false,
      disponible: row.disponible !== false,
      motivo_no_disponible: row.motivo_no_disponible || null,
      codigo_no_disponible: row.codigo_no_disponible || null,
      cantidad_consumo_base: row.cantidad_consumo_base ?? null,
      id_unidad_base: row.id_unidad_base ?? null
    };
  }

  return {
    cartKey: buildCartKey(kind, row.id_receta, complementosSeleccionados, [], lineId),
    lineId,
    kind,
    entityId: row.id_receta,
    id_producto: null,
    id_receta: row.id_receta,
    nombre_item: row.nombre_receta,
    categoria_label: 'Recetas',
    descripcion_item: row.nombre_producto_base || row.nombre_receta || 'Receta',
    precio_unitario: row.precio,
    cantidad: 1,
    stock_disponible: null,
    observacion: '',
    imagen_principal_url: resolveCatalogImageUrl(row),
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
  allowSucursalAutoSelection = true,
  onDepartmentDemand,
  catalogsEnabled = true,
  clientes,
  recetas,
  descuentosCatalogo,
  onSubmit,
  suppressSubmitErrorToast = false,
  onRequireAutoAuxiliar,
  resetKey,
  canApplyDiscount = false,
  userId = null
}) => {
  const cajaSucursalStorageKey = useMemo(
    () => buildCajaSucursalStorageKey(userId),
    [userId]
  );
  const [state, setState] = useState(() => {
    const initialState = buildInitialState({ isSuperAdmin, defaultSucursalId });
    if (!isSuperAdmin) return initialState;
    const persisted = readPersistedCajaSucursal(buildCajaSucursalStorageKey(userId));
    return persisted ? { ...initialState, selectedSucursal: persisted } : initialState;
  });
  const cajaSucursalStorageKeyRef = useRef(cajaSucursalStorageKey);
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
  const [globalExtrasCatalog, setGlobalExtrasCatalog] = useState({
    options: [],
    loading: false,
    error: '',
    sucursalId: null,
    status: 'idle'
  });
  const globalExtrasCacheRef = useRef(new Map());
  const globalExtrasAbortRef = useRef(null);
  const globalExtrasRequestIdRef = useRef(0);
  const [globalExtrasRetryToken, setGlobalExtrasRetryToken] = useState(0);
  const deferredSearch = useDeferredValue(state.search);

  useEffect(() => {
    if (cajaSucursalStorageKeyRef.current === cajaSucursalStorageKey) return;
    cajaSucursalStorageKeyRef.current = cajaSucursalStorageKey;
    setState(() => {
      const nextState = buildInitialState({ isSuperAdmin, defaultSucursalId });
      if (!isSuperAdmin) return nextState;
      const persisted = readPersistedCajaSucursal(cajaSucursalStorageKey);
      return persisted ? { ...nextState, selectedSucursal: persisted } : nextState;
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
  }, [cajaSucursalStorageKey, defaultSucursalId, isSuperAdmin]);

  useEffect(() => {
    if (resetKey === undefined) return;
    setState(() => {
      const nextState = buildInitialState({ isSuperAdmin, defaultSucursalId });
      if (!isSuperAdmin) return nextState;
      const persisted = readPersistedCajaSucursal(cajaSucursalStorageKey);
      return persisted ? { ...nextState, selectedSucursal: persisted } : nextState;
    });
  }, [cajaSucursalStorageKey, defaultSucursalId, isSuperAdmin, resetKey]);

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
  const selectedSucursalCacheKey = selectedSucursalId ? `${cajaSucursalStorageKey}:${selectedSucursalId}` : '';

  useEffect(() => {
    globalExtrasAbortRef.current?.abort();
    globalExtrasCacheRef.current.clear();
    setGlobalExtrasCatalog({
      options: [],
      loading: false,
      error: '',
      sucursalId: null,
      status: 'idle'
    });
  }, [cajaSucursalStorageKey]);

  useEffect(() => {
    const shouldLoadExtras = catalogsEnabled && (state.activeCatalog === 'EXTRAS' || extrasModal.open);
    if (!selectedSucursalId) {
      globalExtrasAbortRef.current?.abort();
      setGlobalExtrasCatalog({
        options: [],
        loading: false,
        error: '',
        sucursalId: null,
        status: 'idle'
      });
      return;
    }
    if (!shouldLoadExtras) {
      globalExtrasAbortRef.current?.abort();
      const cached = globalExtrasCacheRef.current.get(selectedSucursalCacheKey);
      setGlobalExtrasCatalog({
        options: cached?.options || [],
        loading: false,
        error: cached?.error || '',
        sucursalId: selectedSucursalId,
        status: cached?.status || 'idle'
      });
      return;
    }

    const cached = globalExtrasCacheRef.current.get(selectedSucursalCacheKey);
    if (cached?.status === 'success') {
      setGlobalExtrasCatalog({ ...cached, loading: false, sucursalId: selectedSucursalId });
      return;
    }

    globalExtrasAbortRef.current?.abort();
    const controller = new AbortController();
    globalExtrasAbortRef.current = controller;
    const requestId = globalExtrasRequestIdRef.current + 1;
    globalExtrasRequestIdRef.current = requestId;
    const requestUserKey = cajaSucursalStorageKey;
    const requestSucursalId = selectedSucursalId;
    const isCurrentGlobalExtrasRequest = () => (
      globalExtrasRequestIdRef.current === requestId
      && globalExtrasAbortRef.current === controller
      && requestUserKey === cajaSucursalStorageKey
      && requestSucursalId === selectedSucursalId
      && !controller.signal.aborted
    );
    setGlobalExtrasCatalog((current) => ({
      options: current.sucursalId === selectedSucursalId ? current.options : [],
      loading: true,
      error: '',
      sucursalId: selectedSucursalId,
      status: 'loading'
    }));

    void ventasService.getExtrasPermitidos(
      { id_sucursal: selectedSucursalId },
      { signal: controller.signal }
    )
      .then((response) => {
        if (!isCurrentGlobalExtrasRequest()) return;
        const options = (Array.isArray(response) ? response : [])
          .filter((entry) => entry?.estado !== false)
          .map(normalizeGlobalExtraOption)
          .filter((entry) => Number.isInteger(entry.id_extra) && entry.id_extra > 0);
        const entry = {
          options,
          loading: false,
          error: '',
          sucursalId: selectedSucursalId,
          status: 'success'
        };
        globalExtrasCacheRef.current.set(selectedSucursalCacheKey, entry);
        setGlobalExtrasCatalog(entry);
      })
      .catch((error) => {
        if (controller.signal.aborted || globalExtrasRequestIdRef.current !== requestId) {
          if (globalExtrasAbortRef.current === controller && globalExtrasRequestIdRef.current === requestId) {
            setGlobalExtrasCatalog({ options: [], loading: false, error: '', sucursalId: selectedSucursalId, status: 'idle' });
          }
          return;
        }
        if (!isCurrentGlobalExtrasRequest()) return;
        const entry = {
          options: [],
          loading: false,
          error: error?.message || 'No se pudieron cargar los extras globales.',
          sucursalId: selectedSucursalId,
          status: 'error'
        };
        globalExtrasCacheRef.current.set(selectedSucursalCacheKey, entry);
        setGlobalExtrasCatalog(entry);
      });

    return () => {
      controller.abort();
    };
  }, [cajaSucursalStorageKey, catalogsEnabled, extrasModal.open, globalExtrasRetryToken, selectedSucursalCacheKey, selectedSucursalId, state.activeCatalog]);

  useEffect(() => {
    setExtrasModal((current) => {
      if (!current.open) return current;
      return {
        ...current,
        options: globalExtrasCatalog.options,
        loading: globalExtrasCatalog.loading,
        error: globalExtrasCatalog.error
      };
    });
  }, [globalExtrasCatalog]);

  useEffect(() => {
    setState((current) => {
      let changed = false;
      const nextCart = current.cart.map((line) => {
        if (line.kind === 'PRODUCTO') {
          if (!Array.isArray(line.complementos) || line.complementos.length === 0) return line;
          changed = true;
          return {
            ...line,
            complementos: [],
            complementos_disponibles: [],
            cartKey: buildCartKey(line.kind, line.entityId, [], line.extras)
          };
        }

        const catalogRow = (Array.isArray(recetas) ? recetas : [])
          .find((row) => Number(row?.id_receta) === Number(line.id_receta));
        if (!catalogRow) return line;

        const disponibles = (Array.isArray(catalogRow.complementos_disponibles) ? catalogRow.complementos_disponibles : [])
          .map((entry) => ({
            id_complemento: Number(entry?.id_complemento ?? 0) || null,
            nombre: String(entry?.nombre ?? 'Complemento').trim(),
            disponible: entry?.disponible !== false
          }))
          .filter((entry) => entry.id_complemento);
        const allowedIds = new Set(
          disponibles.filter((entry) => entry.disponible).map((entry) => entry.id_complemento)
        );
        const complementos = normalizeComplementIds(line.complementos).filter((id) => allowedIds.has(id));
        const minimo = Number(catalogRow.minimo_complementos ?? 0) || 0;
        const maximo = Number(catalogRow.maximo_complementos ?? 0) || 0;
        const requiere = Boolean(catalogRow.requiere_complementos) || minimo > 0;
        const lineId = line.lineId || createCartLineId();
        const nextCartKey = buildCartKey(line.kind, line.entityId, complementos, line.extras, lineId);
        const lineChanged =
          !line.lineId
          || nextCartKey !== line.cartKey
          || complementos.length !== normalizeComplementIds(line.complementos).length
          || JSON.stringify(disponibles) !== JSON.stringify(line.complementos_disponibles || [])
          || minimo !== Number(line.minimo_complementos || 0)
          || maximo !== Number(line.maximo_complementos || 0)
          || requiere !== Boolean(line.complementos_requiere);
        if (!lineChanged) return line;
        changed = true;
        return {
          ...line,
          lineId,
          complementos,
          complementos_disponibles: disponibles,
          complementos_requiere: requiere,
          minimo_complementos: minimo,
          maximo_complementos: maximo,
          tipo_complemento: catalogRow.tipo_complemento || line.tipo_complemento,
          complementos_incompletos_autorizados: complementos.length < minimo
            ? Boolean(line.complementos_incompletos_autorizados)
            : false,
          cartKey: nextCartKey
        };
      });
      return changed ? { ...current, cart: nextCart } : current;
    });
  }, [recetas]);

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
    if (!allowSucursalAutoSelection) return;
    if (!normalizedSucursales.length) return;
    setState((current) => {
      const validIds = new Set(normalizedSucursales.map((row) => String(row.id_sucursal)));
      const sessionSelection = String(defaultSucursalId || '').trim();
      const currentSelection = String(current.selectedSucursal || '').trim();
      const persistedSelection = readPersistedCajaSucursal(cajaSucursalStorageKey);
      if (currentSelection && !validIds.has(currentSelection)) {
        clearPersistedCajaSucursal(cajaSucursalStorageKey);
        return {
          ...current,
          selectedSucursal: '',
          activeCatalog: DEFAULT_CATALOG_KEY,
          activeCategory: resolveDefaultDepartmentId(tiposDepartamento),
          search: ''
        };
      }
      if (persistedSelection && !validIds.has(persistedSelection)) {
        clearPersistedCajaSucursal(cajaSucursalStorageKey);
      }
      const nextSelection = validIds.has(currentSelection)
          ? currentSelection
          : validIds.has(persistedSelection)
            ? persistedSelection
            : validIds.has(sessionSelection)
              ? sessionSelection
              : '';
      if (currentSelection === nextSelection) return current;
      return {
        ...current,
        selectedSucursal: nextSelection,
        activeCatalog: DEFAULT_CATALOG_KEY,
        activeCategory: resolveDefaultDepartmentId(tiposDepartamento),
        search: ''
      };
    });
  }, [allowSucursalAutoSelection, cajaSucursalStorageKey, defaultSucursalId, isSuperAdmin, normalizedSucursales, tiposDepartamento]);

  useEffect(() => {
    if (isSuperAdmin) return;
    setState((current) => {
      const nextSucursal = String(defaultSucursalId || '');
      if (String(current.selectedSucursal || '') === nextSucursal) return current;
      return {
        ...current,
        selectedSucursal: nextSucursal
      };
    });
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

  const filteredGlobalExtras = useMemo(
    () => filterBySearch(globalExtrasCatalog.options, deferredSearch, ['nombre', 'codigo', 'descripcion']),
    [deferredSearch, globalExtrasCatalog.options]
  );

  const currentCatalogRows = useMemo(() => {
    if (state.activeCatalog === 'EXTRAS') return filteredGlobalExtras;
    if (state.activeCatalog === 'RECETAS') return filteredRecetas;
    return filteredProducts;
  }, [filteredGlobalExtras, filteredProducts, filteredRecetas, state.activeCatalog]);

  const discountCatalogRows = useMemo(() => {
    if (!canApplyDiscount) return [];

    const discountProducts = filterBySearch(Array.isArray(productos) ? productos : [], deferredSearch, [
      'nombre_producto',
      'descripcion_producto',
      'categoria_label'
    ]);
    const discountRecetas = filterBySearch(Array.isArray(recetas) ? recetas : [], deferredSearch, [
      'nombre_receta',
      'nombre_producto_base'
    ]);
    const candidates = [
      ...discountProducts.map((row) => ({ kind: 'PRODUCTO', row })),
      ...discountRecetas.map((row) => ({ kind: 'RECETA', row }))
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
            precio_unitario: Number(entry.row?.precio ?? 0) || 0,
            cantidad: 1
          }
        });
        return discount ? { ...entry, discount } : null;
      })
      .filter(Boolean);
  }, [
    canApplyDiscount,
    deferredSearch,
    normalizedDescuentosCatalogo,
    productos,
    recetas,
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
    () => roundMoney(state.cart.reduce((total, line) => total + getLineExtrasSubtotal(line), 0)),
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

  const change = state.paymentMethod === 'efectivo'
    ? roundMoney(Math.max(cashValue - total, 0))
    : 0;
  const canContinue = hasSelectedSucursal && state.cart.length > 0;
  const canSubmit = hasSelectedSucursal
    && state.cart.length > 0
    && (
      (state.paymentMethod === 'efectivo' && cashValue >= total) ||
      (state.paymentMethod !== 'efectivo' && state.referenciaPago && state.referenciaPago.trim() !== '')
    );
  const resultsLabel = getResultsLabel(state.activeCatalog, currentCatalogRows.length);

  const getCurrentQuantityInCartByKind = (kind, entityId, cart) =>
    (Array.isArray(cart) ? cart : []).reduce((acc, line) => {
      if (String(line.kind || '').toUpperCase() !== String(kind || '').toUpperCase()) return acc;
      if (Number(line.entityId ?? line.id_producto ?? line.id_extra ?? 0) !== Number(entityId)) return acc;
      return acc + Number(line.cantidad ?? 0);
    }, 0);

  const requiresComplementSelection = (kind, row) => {
    if (kind === 'PRODUCTO' || kind === 'ITEM') return false;
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

        const alreadyInCart = getCurrentQuantityInCartByKind('PRODUCTO', row.id_producto, nextCart);
        if (alreadyInCart >= stockDisponible) {
          return {
            ...current,
            submitError: `Stock maximo alcanzado para ${row.nombre_producto || 'producto'}.`
          };
        }
      }

      if (kind === 'ITEM') {
        if (isBlockingExtraUnavailable(row)) {
          return {
            ...current,
            submitError: row.motivo_no_disponible || `${row.nombre || 'Extra'} no esta disponible.`
          };
        }

        const availableUnits = isStockOnlyExtraUnavailable(row) ? null : resolveStandaloneExtraAvailableUnits(row);
        const alreadyInCart = getCurrentQuantityInCartByKind('ITEM', row.id_extra, nextCart);
        if (availableUnits !== null && alreadyInCart >= availableUnits) {
          return {
            ...current,
            submitError: `Stock maximo alcanzado para ${row.nombre || 'este extra'}.`
          };
        }
      }

      const index = isQuantityManagedVentaLineKind(kind) ? findLineIndex(nextCart, catalogLine.cartKey) : -1;
      if (index >= 0) {
        const currentLine = nextCart[index];
        const nextQty = Number(currentLine.cantidad ?? 0) + 1;
        if (kind === 'PRODUCTO' && nextQty > Number(currentLine.stock_disponible ?? 0)) {
          return {
            ...current,
            submitError: `Stock maximo alcanzado para ${row.nombre_producto || 'producto'}.`
          };
        }
        if (kind === 'ITEM') {
          const maxAvailable = Number(currentLine.available_units ?? 0);
          if (maxAvailable > 0 && nextQty > maxAvailable) {
            return {
              ...current,
              submitError: `Stock maximo alcanzado para ${row.nombre || 'este extra'}.`
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
          cantidad: nextQty,
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
      const mergedResult = mergeEquivalentVentaLines(nextCart);

      return {
        ...current,
        cart: mergedResult.cart,
        incompleteComplementCartKey: '',
        submitError: '',
        cartNotice: mergedResult.merged ? 'Se combinaron lineas identicas del carrito.' : current.cartNotice
      };
    });
  };

  const openComplementModalForLine = (cartKey) => {
    const line = state.cart.find((row) => row.cartKey === cartKey);
    if (!line) return;
    if (line.kind === 'PRODUCTO' || line.kind === 'ITEM') return;

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
      const lineId = editedLine.lineId || createCartLineId();
      const rebuilt = buildCatalogLine(editedLine.kind, baseRow, ids, {
        ...complementOptions,
        lineId
      });
      rebuilt.extras = normalizeExtras(editedLine.extras);
      setState((current) => {
        const cartKey = editedLine.lineId ? (editedLine.cartKey || rebuilt.cartKey) : rebuilt.cartKey;
        const nextCart = current.cart.map((line) =>
          line.cartKey === complementModal.cartKey
            ? {
              ...line,
              lineId,
              cartKey,
              complementos: rebuilt.complementos,
              complementos_incompletos_autorizados: rebuilt.complementos_incompletos_autorizados
            }
            : line
        );
        const mergedResult = mergeEquivalentVentaLines(nextCart);
        return {
          ...current,
          cart: mergedResult.cart,
          incompleteComplementCartKey: '',
          submitError: '',
          cartNotice: mergedResult.merged ? 'Se combinaron lineas identicas del carrito.' : current.cartNotice
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

  const updateLine = (cartKey, updater, options = {}) => {
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

          if (candidate.kind === 'ITEM') {
            const requested = Number(candidate.cantidad ?? 0);
            const maxAvailable = Number(candidate.available_units ?? 0);
            if (maxAvailable > 0 && requested > maxAvailable) {
              return {
                ...candidate,
                cantidad: maxAvailable
              };
            }
          }

          const adjustedExtras = normalizeExtras(candidate.extras);
          const isCustomLine = isCustomizableVentaLineKind(candidate.kind);
          const lineId = isCustomLine ? String(candidate.lineId || createCartLineId()) : null;
          const rawQuantity = Number(candidate.cantidad ?? 0);
          const quantity = rawQuantity <= 0 ? 0 : (parseVentaLineQuantity(candidate.cantidad) || 1);
          return {
            ...candidate,
            lineId,
            cantidad: quantity,
            extras: adjustedExtras,
            cartKey: isCustomLine
              ? (candidate.lineId ? candidate.cartKey : buildCartKey(candidate.kind, candidate.entityId, candidate.complementos, adjustedExtras, lineId))
              : buildCartKey(candidate.kind, candidate.entityId, candidate.complementos, adjustedExtras)
          };
        })
        .filter((line) => Number(line.cantidad ?? 0) > 0);
      if (options?.merge === false) {
        return {
          ...current,
          cart: nextCart,
          incompleteComplementCartKey: '',
          submitError: ''
        };
      }
      const mergedResult = mergeEquivalentVentaLines(nextCart);

      return {
        ...current,
        cart: mergedResult.cart,
        incompleteComplementCartKey: '',
        submitError: '',
        cartNotice: mergedResult.merged ? 'Se combinaron lineas identicas del carrito.' : current.cartNotice
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
    if (!line || line.kind === 'PRODUCTO' || line.kind === 'ITEM') return;

    setExtrasModal({
      open: true,
      cartKey,
      row: line,
      options: globalExtrasCatalog.options,
      selected: normalizeExtras(line.extras),
      loading: globalExtrasCatalog.loading,
      error: globalExtrasCatalog.error
    });
  };

  const closeExtrasModal = () => {
    setExtrasModal((current) => ({ ...current, open: false, loading: false, error: '' }));
  };

  const confirmExtrasModal = (selectedExtras) => {
    const optionsById = new Map(
      extrasModal.options.map((option) => [Number(option.id_extra), option])
    );
    const unavailableSelection = normalizeExtras(selectedExtras).find((entry) => {
      const option = optionsById.get(Number(entry.id_extra));
      return !option || isBlockingExtraUnavailable(option);
    });
    if (unavailableSelection) {
      const option = optionsById.get(Number(unavailableSelection.id_extra));
      setExtrasModal((current) => ({
        ...current,
        error: option?.motivo_no_disponible || 'Uno de los extras seleccionados ya no esta disponible.'
      }));
      return;
    }

    const nextExtras = normalizeExtras(selectedExtras);
    setState((current) => {
      const currentLine = current.cart.find((line) => line.cartKey === extrasModal.cartKey);
      if (!currentLine) return current;
      const lineId = currentLine.lineId || createCartLineId();
      const nextCartKey = currentLine.lineId
        ? currentLine.cartKey
        : buildCartKey(currentLine.kind, currentLine.entityId, currentLine.complementos, nextExtras, lineId);
      const nextCart = current.cart.map((line) =>
        line.cartKey === extrasModal.cartKey
          ? {
            ...line,
            lineId,
            extras: nextExtras,
            cartKey: nextCartKey
          }
          : line
      );
      const mergedResult = mergeEquivalentVentaLines(nextCart);
      return {
        ...current,
        cart: mergedResult.cart,
        incompleteComplementCartKey: '',
        submitError: '',
        cartNotice: mergedResult.merged ? 'Se combinaron lineas identicas del carrito.' : current.cartNotice
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

    if (state.activeCatalog === 'EXTRAS') {
      addCatalogItem('ITEM', currentCatalogRows[0]);
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

  const buildPaidSalePayload = ({ contacto, contexto, cuentaDividida } = {}) =>
    buildPaidSaleRequestPayload({
      state,
      selectedSucursalId,
      cashValue,
      canApplyDiscount,
      contacto,
      contexto,
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

  const submitPaidSale = async ({ contacto, contexto, cuentaDividida } = {}) => {
    if (!validatePaidSale()) return null;
    if (!validateComplementosForPending()) return null;

    try {
      const response = await onSubmit(
        buildPaidSalePayload({ contacto, contexto, cuentaDividida }),
        { suppressErrorToast: suppressSubmitErrorToast, origin: 'CAJA' }
      );

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

  const resetPaymentDraft = () => {
    setState((current) => ({
      ...current,
      paymentMethod: 'efectivo',
      cashReceived: '',
      referenciaPago: '',
      submitError: ''
    }));
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
    cartNotice: state.cartNotice,
    submitError: state.submitError,
    incompleteComplementCartKey: state.incompleteComplementCartKey,
    currentCatalogRows,
    currentCatalogLoading: state.activeCatalog === 'EXTRAS' ? globalExtrasCatalog.loading : false,
    currentCatalogError: state.activeCatalog === 'EXTRAS' ? globalExtrasCatalog.error : '',
    currentCatalogStatus: state.activeCatalog === 'EXTRAS' ? globalExtrasCatalog.status : null,
    retryGlobalExtras: () => {
      if (!selectedSucursalId) return;
      globalExtrasCacheRef.current.delete(selectedSucursalCacheKey);
      setGlobalExtrasRetryToken((current) => current + 1);
    },
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
      setState((current) => {
        const nextKey = String(key || '').trim().toUpperCase();
        return {
          ...current,
          activeCatalog: nextKey,
          search: '',
          activeCategory: ['PRODUCTOS', 'EXTRAS'].includes(nextKey)
            ? 'all'
            : (['PRODUCTOS', 'EXTRAS'].includes(current.activeCatalog)
                ? resolveDefaultDepartmentId(tiposDepartamento)
                : current.activeCategory)
        };
      }),
    setSearch: (value) => setPartialState({ search: value }),
    setActiveCategory: (value) => {
      const nextDepartment = String(value || 'all');
      setPartialState({ activeCategory: nextDepartment });
      if (state.activeCatalog === 'RECETAS' && selectedSucursalId) {
        void onDepartmentDemand?.({
          idSucursal: selectedSucursalId,
          idTipoDepartamento: nextDepartment === 'all' ? null : Number(nextDepartment)
        });
      }
    },
    paymentPickerOpen: state.paymentPickerOpen,
    setPaymentPickerOpen: (value) => setPartialState({ paymentPickerOpen: value }),
    setDescuentoPickerOpen: (value) => setPartialState({ descuentoPickerOpen: value }),
    setClientPickerOpen: (value) => setPartialState({ clientPickerOpen: value }),
    sucursalPickerOpen: state.sucursalPickerOpen,
    setSucursalPickerOpen: (value) => setPartialState({ sucursalPickerOpen: value }),
    setSelectedSucursal: (value) => {
      const nextSucursal = String(value || '');
      persistCajaSucursal(cajaSucursalStorageKey, nextSucursal);
      setState((current) => {
        const changed = String(current.selectedSucursal || '') !== nextSucursal;
        return {
          ...current,
          selectedSucursal: nextSucursal,
          activeCatalog: changed ? DEFAULT_CATALOG_KEY : current.activeCatalog,
          activeCategory: changed ? resolveDefaultDepartmentId(tiposDepartamento) : current.activeCategory,
          search: changed ? '' : current.search,
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
      setState((current) => ({
        ...current,
        paymentMethod: value,
        cashReceived: value === 'efectivo' ? current.cashReceived : '',
        referenciaPago: value === 'efectivo' ? '' : current.referenciaPago,
        submitError: ''
      })),
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
          precio_unitario: Number(row?.precio ?? 0) || 0,
          cantidad: 1
        }
      }),
    setLineDiscount: (cartKey, discountId) => {
      if (!canApplyDiscount) {
        setState((current) => {
          const mergedResult = mergeEquivalentVentaLines(current.cart.map((line) =>
            line.cartKey === cartKey
              ? { ...line, id_descuento_catalogo_linea: '' }
              : line
          ));
          return {
            ...current,
            selectedDiscountId: '',
            cart: mergedResult.cart,
            submitError: '',
            cartNotice: mergedResult.merged ? 'Se combinaron lineas identicas del carrito.' : current.cartNotice
          };
        });
        return;
      }
      setState((current) => {
        const mergedResult = mergeEquivalentVentaLines(current.cart.map((line) =>
          line.cartKey === cartKey
            ? { ...line, id_descuento_catalogo_linea: discountId || '' }
            : line
        ));
        return {
          ...current,
          cart: mergedResult.cart,
          submitError: '',
          cartNotice: mergedResult.merged ? 'Se combinaron lineas identicas del carrito.' : current.cartNotice
        };
      });
    },
    setCashReceived: (value) => setPartialState({ cashReceived: value }),
    setReferenciaPago: (value) => setPartialState({ referenciaPago: value }),
    resetPaymentDraft,
    addCatalogItem,
    openComplementModalForLine,
    closeComplementModal,
    confirmComplementModal,
    openExtrasModalForLine,
    closeExtrasModal,
    confirmExtrasModal,
    getExtrasSubtotal,
    getLineExtrasSubtotal,
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
