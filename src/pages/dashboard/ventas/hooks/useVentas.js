import { useCallback, useEffect, useRef, useState } from 'react';
import ventasService from '../../../../services/ventasService';
import sucursalesService from '../../../../services/sucursalesService';
import {
  VENTAS_FILTER_ESTADOS_PERMITIDOS,
  createConsumidorFinalCliente,
  createDefaultVentasFilters,
  createDefaultVentasPagination,
  createDefaultVentasScopeInfo,
  createDefaultVentasSummary,
  createDefaultVentasToast
} from '../../../../modules/ventas/constants/ventasDefaults';
import {
  buildCategoriasMap,
  extractApiMessage,
  normalizeCategoriaRecord,
  normalizeClienteOption,
  normalizeProductoRecord,
  normalizeRecetaRecord,
  normalizeVentaDetail,
  normalizeVentaRecord
} from '../utils/ventasHelpers';
import { compareRecipeNamesNaturally } from '../utils/ventasRecipeSort';
import {
  createVentasClientRequestManager,
  isCancelledVentasClientRequest,
  shouldRequestVentasClients
} from '../utils/ventasClientRequestManager';
import { mergeVentasClienteCatalogOption } from '../utils/ventasClientesCatalogUtils';

const isTruthyState = (value) =>
  value === true || value === 'true' || value === 1 || value === '1';

const normalizeDiscountScope = (value) => {
  const normalized = String(value ?? 'FACTURA_COMPLETA')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
  if (normalized === 'PRODUCTOS') return 'PRODUCTO';
  if (normalized === 'RECETAS') return 'RECETA';
  return normalized || 'FACTURA_COMPLETA';
};

const parsePositiveId = (value) => {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const buildVentasTotalsCacheKey = (filters = {}) => JSON.stringify({
  search: String(filters.search || '').trim(),
  idSucursal: parsePositiveId(filters.idSucursal),
  estado: String(filters.estado || '').trim().toUpperCase(),
  fechaDesde: String(filters.fechaDesde || '').trim(),
  fechaHasta: String(filters.fechaHasta || '').trim(),
  pageSize: Number.parseInt(String(filters.pageSize ?? 6), 10) || 6
});

const buildCajaUserScopeKey = (userKey, idSucursal) =>
  `usuario:${userKey}:sucursal:${idSucursal || 'auto'}`;

const normalizeVentasSummaryPayload = (summary = {}) => ({
  ...createDefaultVentasSummary(),
  totalVentas: Number.parseInt(String(summary?.ventas ?? summary?.totalVentas ?? 0), 10) || 0,
  totalFacturado: Number(summary?.totalVendido ?? summary?.totalFacturado ?? 0) || 0,
  ticketPromedio: Number(summary?.ticketPromedio ?? 0) || 0,
  completadas: Number.parseInt(String(summary?.completadas ?? 0), 10) || 0,
  pendientes: Number.parseInt(String(summary?.pendientes ?? 0), 10) || 0
});

export const useVentas = ({ activeTab = '', initialSucursalId = null, isSuperAdmin = false, userId = null } = {}) => {
  const cajaUserKey = String(parsePositiveId(userId) || 'anon');
  const [ventas, setVentas] = useState([]);
  const [summary, setSummary] = useState(() => createDefaultVentasSummary());
  const [pagination, setPagination] = useState(() => createDefaultVentasPagination());
  const [scopeInfo, setScopeInfo] = useState(() => createDefaultVentasScopeInfo());
  const [ventasFilters, setVentasFilters] = useState(() => createDefaultVentasFilters());
  const [sucursales, setSucursales] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos] = useState([]);
  const [recetas, setRecetas] = useState([]);
  const [descuentosCatalogo, setDescuentosCatalogo] = useState([]);
  const [tiposDescuento, setTiposDescuento] = useState([]);
  const [tiposDepartamento, setTiposDepartamento] = useState([]);
  const [clientes, setClientes] = useState(() => [createConsumidorFinalCliente()]);
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [bootstrapLoading, setBootstrapLoading] = useState(() => String(activeTab).toLowerCase() === 'caja');
  const [recipesLoading, setRecipesLoading] = useState(() => String(activeTab).toLowerCase() === 'caja');
  const [productsLoading, setProductsLoading] = useState(false);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientesMeta, setClientesMeta] = useState({ limit: 100, has_more: false });
  const [discountsLoading, setDiscountsLoading] = useState(false);
  const [catalogStatuses, setCatalogStatuses] = useState({
    recetas: String(activeTab).toLowerCase() === 'caja' ? 'loading' : 'idle',
    productos: 'idle',
    clientes: 'idle',
    descuentos: 'idle'
  });
  const [cajaBootstrapData, setCajaBootstrapData] = useState(null);
  const [recipeCatalogState, setRecipeCatalogState] = useState({ byScope: {}, activeKey: null });
  const [saving, setSaving] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [catalogErrors, setCatalogErrors] = useState({});
  const [toast, setToast] = useState(() => createDefaultVentasToast());
  const catalogRequestRef = useRef(0);
  const cajaBootstrapAbortRef = useRef(null);
  const cajaCatalogAbortRef = useRef(new Map());
  const clientesRequestManagerRef = useRef(null);
  if (!clientesRequestManagerRef.current) {
    clientesRequestManagerRef.current = createVentasClientRequestManager();
  }
  const cajaCatalogLoadedRef = useRef(new Set());
  const cajaCatalogInFlightRef = useRef(new Map());
  const cajaBootstrapRequestIdRef = useRef(0);
  const cajaRecipeRequestIdRef = useRef(0);
  const cajaCatalogRequestIdRef = useRef(0);
  const cajaBootstrapDataCacheRef = useRef(new Map());
  const cajaCatalogDataCacheRef = useRef(new Map());
  const recipeCatalogAbortRef = useRef(new Map());
  const recipeCatalogCacheRef = useRef(new Map());
  const activeRecipeScopeRef = useRef(null);
  const activeCajaSucursalRef = useRef(null);
  const activeCajaUserKeyRef = useRef(cajaUserKey);
  const ventasTotalsCacheRef = useRef({ key: '', summary: null, pagination: null });
  const ventasLastFiltersRef = useRef(null);

  const invalidateVentasTotalsCache = useCallback(() => {
    ventasTotalsCacheRef.current = { key: '', summary: null, pagination: null };
    ventasLastFiltersRef.current = null;
  }, []);

  const openToast = useCallback((title, message, variant = 'success') => {
    setToast({
      show: true,
      title: String(title || ''),
      message: String(message || ''),
      variant
    });
  }, []);

  const closeToast = useCallback(() => {
    setToast((prev) => ({ ...prev, show: false }));
  }, []);

  useEffect(() => {
    if (!toast.show) return undefined;
    const timer = setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 3200);
    return () => clearTimeout(timer);
  }, [toast.show]);

  useEffect(() => {
    if (activeCajaUserKeyRef.current === cajaUserKey) return;
    activeCajaUserKeyRef.current = cajaUserKey;
    cajaBootstrapAbortRef.current?.abort();
    for (const controller of cajaCatalogAbortRef.current.values()) controller.abort();
    cajaCatalogAbortRef.current.clear();
    for (const controller of recipeCatalogAbortRef.current.values()) controller.abort();
    recipeCatalogAbortRef.current.clear();
    cajaCatalogInFlightRef.current.clear();
    cajaBootstrapRequestIdRef.current += 1;
    cajaRecipeRequestIdRef.current += 1;
    cajaCatalogRequestIdRef.current += 1;
    cajaCatalogLoadedRef.current.clear();
    cajaBootstrapDataCacheRef.current.clear();
    cajaCatalogDataCacheRef.current.clear();
    recipeCatalogCacheRef.current.clear();
    activeCajaSucursalRef.current = null;
    activeRecipeScopeRef.current = null;
    setCajaBootstrapData(null);
    setRecipeCatalogState({ byScope: {}, activeKey: null });
    setProductos([]);
    setRecetas([]);
    setDescuentosCatalogo([]);
    setClientes([createConsumidorFinalCliente()]);
    setCatalogErrors({});
    setCatalogStatuses({
      recetas: String(activeTab).toLowerCase() === 'caja' ? 'loading' : 'idle',
      productos: 'idle',
      clientes: 'idle',
      descuentos: 'idle'
    });
  }, [activeTab, cajaUserKey]);

  const loadVentas = useCallback(async (options = {}) => {
    const suppressErrors = Boolean(options?.suppressErrors);
    const totalsKey = buildVentasTotalsCacheKey(ventasFilters);
    const lastFilters = ventasLastFiltersRef.current;
    const lastTotalsKey = lastFilters ? buildVentasTotalsCacheKey(lastFilters) : '';
    const currentPage = Number.parseInt(String(ventasFilters.page ?? 1), 10) || 1;
    const lastPage = Number.parseInt(String(lastFilters?.page ?? 1), 10) || 1;
    const cachedTotals = ventasTotalsCacheRef.current?.key === totalsKey
      ? ventasTotalsCacheRef.current
      : null;
    const reuseTotals = Boolean(
      !options?.refreshTotals &&
      cachedTotals?.summary &&
      cachedTotals?.pagination &&
      lastTotalsKey === totalsKey &&
      currentPage !== lastPage
    );
    setLoading(true);
    setError('');

    try {
      const response = await ventasService.list({
        page: ventasFilters.page,
        pageSize: ventasFilters.pageSize,
        search: ventasFilters.search,
        idSucursal: ventasFilters.idSucursal,
        estado: ventasFilters.estado,
        fechaDesde: ventasFilters.fechaDesde,
        fechaHasta: ventasFilters.fechaHasta,
        includeSummary: reuseTotals ? false : undefined,
        includePaginationTotals: reuseTotals ? false : undefined
      });

      const rowsPayload = Array.isArray(response)
        ? response
        : (Array.isArray(response?.data) ? response.data : []);
      const rows = rowsPayload.map(normalizeVentaRecord);

      const serverPagination = response?.pagination || {};
      const resolvedPage = Number.parseInt(String(serverPagination.page ?? ventasFilters.page), 10) || 1;
      const resolvedPageSize = Number.parseInt(String(serverPagination.pageSize ?? ventasFilters.pageSize), 10) || 6;
      const resolvedTotal = Number.parseInt(
        String(serverPagination.total ?? cachedTotals?.pagination?.total ?? rows.length),
        10
      ) || 0;
      const resolvedTotalPages = Number.parseInt(
        String(serverPagination.totalPages ?? cachedTotals?.pagination?.totalPages ?? 1),
        10
      ) || 1;
      const backendSummary = response?.summary && typeof response.summary === 'object'
        ? response.summary
        : null;
      const normalizedSummary = backendSummary
        ? normalizeVentasSummaryPayload(backendSummary)
        : (cachedTotals?.summary || createDefaultVentasSummary());
      const hasBackendTotals = serverPagination.total !== undefined &&
        serverPagination.total !== null &&
        serverPagination.totalPages !== undefined &&
        serverPagination.totalPages !== null;
      const normalizedPagination = {
        page: resolvedPage,
        pageSize: resolvedPageSize,
        total: resolvedTotal,
        totalPages: Math.max(1, resolvedTotalPages),
        hasNextPage: Boolean(serverPagination.hasNextPage ?? (resolvedPage < resolvedTotalPages)),
        hasPreviousPage: Boolean(serverPagination.hasPreviousPage ?? (resolvedPage > 1))
      };

      setVentas(rows);
      setPagination(normalizedPagination);
      const responseScope = response?.filters?.scope || {};
      const canSelectSucursal = Boolean(responseScope.canSelectSucursal);
      const selectedSucursalId = parsePositiveId(responseScope.selectedSucursalId);
      const userSucursalId = parsePositiveId(responseScope.userSucursalId);
      setScopeInfo({
        canSelectSucursal,
        selectedSucursalId,
        userSucursalId,
        limitedByRole: Boolean(responseScope.limitedByRole),
        limitedToLast72Hours: Boolean(responseScope.limitedToLast72Hours),
        allowedSucursalIds: Array.isArray(responseScope.allowedSucursalIds)
          ? responseScope.allowedSucursalIds
          : []
      });
      setSummary(normalizedSummary);
      if (backendSummary || hasBackendTotals) {
        ventasTotalsCacheRef.current = {
          key: totalsKey,
          summary: backendSummary ? normalizedSummary : cachedTotals?.summary,
          pagination: hasBackendTotals
            ? { total: normalizedPagination.total, totalPages: normalizedPagination.totalPages }
            : cachedTotals?.pagination
        };
      }
      ventasLastFiltersRef.current = { ...ventasFilters };
      return {
        rows,
        canSelectSucursal,
        catalogSucursalId: selectedSucursalId || userSucursalId
      };
    } catch (error) {
      const message = extractApiMessage(error, 'No se pudieron cargar las ventas.');
      if (!suppressErrors) {
        setError(message);
        openToast('ERROR', message, 'danger');
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }, [openToast, ventasFilters]);

  const refreshVentas = useCallback((options = {}) => {
    invalidateVentasTotalsCache();
    return loadVentas({ ...options, refreshTotals: true });
  }, [invalidateVentasTotalsCache, loadVentas]);

  const hydrateCajaBootstrapData = useCallback((data = {}, { requestedSucursalId = null, meta = {} } = {}) => {
    const sesionesDisponibles = Array.isArray(data.sesiones_disponibles) ? data.sesiones_disponibles : [];
    const sucursalesDisponibles = Array.isArray(data.sucursales_disponibles) ? data.sucursales_disponibles : [];
    const sucursalSources = sucursalesDisponibles.length > 0 ? sucursalesDisponibles : sesionesDisponibles;
    if (sucursalSources.length > 0) {
      const branchesById = new Map(sucursalSources.map((row) => [
        Number(row.id_sucursal),
        {
          id_sucursal: Number(row.id_sucursal),
          nombre_sucursal: String(row.nombre_sucursal || `Sucursal #${row.id_sucursal}`).trim()
        }
      ]).filter(([id, row]) => Number.isInteger(id) && id > 0 && row.nombre_sucursal));
      setSucursales([...branchesById.values()]);
    }
    const responseSucursalId = parsePositiveId(data.id_sucursal);
    if (requestedSucursalId && responseSucursalId !== requestedSucursalId) return null;
    setCajaBootstrapData(data);
    if (!responseSucursalId) {
      setRecetas([]);
      setTiposDepartamento([]);
      activeRecipeScopeRef.current = null;
      setRecipeCatalogState((current) => ({ ...current, activeKey: null }));
      setCatalogStatuses((current) => ({ ...current, recetas: 'idle' }));
      setCatalogLoading(false);
      return { recetas: [], tiposDepartamento: [], data, meta };
    }
    activeCajaSucursalRef.current = responseSucursalId;
    const normalizedTiposDepartamento = (Array.isArray(data.departamentos) ? data.departamentos : [])
      .map((row) => ({
        id_tipo_departamento: Number(row?.id_tipo_departamento ?? 0) || null,
        nombre_tipo_departamento: String(row?.nombre_departamento ?? row?.nombre_tipo_departamento ?? '')
      }))
      .filter((row) => row.id_tipo_departamento && row.nombre_tipo_departamento);
    const normalizedRecetas = (Array.isArray(data.recetas) ? data.recetas : [])
      .map(normalizeRecetaRecord)
      .filter((receta) => receta.estado)
      .sort(compareRecipeNamesNaturally);
    setTiposDepartamento(normalizedTiposDepartamento);
    setRecetas(normalizedRecetas);
    const activeDepartmentId = parsePositiveId(data.departamento_activo?.id_tipo_departamento);
    const recipeScopeKey = `${buildCajaUserScopeKey(cajaUserKey, responseSucursalId)}:departamento:${activeDepartmentId || 'ALL'}`;
    const recipeEntry = {
      status: data.sesion_caja ? 'success' : 'idle',
      rows: normalizedRecetas,
      error: null
    };
    recipeCatalogCacheRef.current.set(recipeScopeKey, recipeEntry);
    activeRecipeScopeRef.current = recipeScopeKey;
    setRecipeCatalogState((current) => ({
      activeKey: recipeScopeKey,
      byScope: {
        ...current.byScope,
        [recipeScopeKey]: recipeEntry
      }
    }));
    setScopeInfo((current) => ({
      ...current,
      canSelectSucursal: isSuperAdmin,
      selectedSucursalId: responseSucursalId,
      userSucursalId: parsePositiveId(initialSucursalId)
    }));
    setCatalogStatuses((current) => ({
      ...current,
      recetas: data.sesion_caja ? 'success' : 'idle'
    }));
    return { recetas: normalizedRecetas, tiposDepartamento: normalizedTiposDepartamento, data, meta };
  }, [cajaUserKey, initialSucursalId, isSuperAdmin]);

  const loadCajaBootstrap = useCallback(async ({ id_sucursal: idSucursalRaw, force = false } = {}) => {
    const idSucursal = parsePositiveId(idSucursalRaw);
    if (activeCajaSucursalRef.current && activeCajaSucursalRef.current !== idSucursal) {
      cajaBootstrapAbortRef.current?.abort();
      for (const controller of cajaCatalogAbortRef.current.values()) controller.abort();
      cajaCatalogAbortRef.current.clear();
      for (const controller of recipeCatalogAbortRef.current.values()) controller.abort();
      recipeCatalogAbortRef.current.clear();
      setProductos([]);
      setRecetas([]);
      setDescuentosCatalogo([]);
      setClientes([createConsumidorFinalCliente()]);
      setCajaBootstrapData(null);
      activeRecipeScopeRef.current = null;
      setRecipeCatalogState((current) => ({ ...current, activeKey: null }));
      setCatalogStatuses({
        recetas: 'idle',
        productos: 'idle',
        clientes: 'idle',
        descuentos: 'idle'
      });
      setCatalogErrors({});
    }
    if (idSucursal) activeCajaSucursalRef.current = idSucursal;
    const scopeKey = buildCajaUserScopeKey(cajaUserKey, idSucursal);
    const cacheKey = `bootstrap:${scopeKey}`;
    if (force) cajaBootstrapDataCacheRef.current.delete(cacheKey);
    const cachedBootstrap = cajaBootstrapDataCacheRef.current.get(cacheKey);
    if (!force && cachedBootstrap?.status === 'success') {
      cajaBootstrapAbortRef.current?.abort();
      cajaBootstrapAbortRef.current = null;
      setBootstrapLoading(false);
      setRecipesLoading(false);
      setCatalogLoading(false);
      return hydrateCajaBootstrapData(cachedBootstrap.data, {
        requestedSucursalId: idSucursal,
        meta: cachedBootstrap.meta || {}
      });
    }
    const currentInFlight = cajaCatalogInFlightRef.current.get(cacheKey);
    if (!force && currentInFlight?.promise && !currentInFlight.controller?.signal?.aborted) {
      return currentInFlight.promise;
    }

    cajaBootstrapAbortRef.current?.abort();
    const controller = new AbortController();
    cajaBootstrapAbortRef.current = controller;
    const requestId = cajaBootstrapRequestIdRef.current + 1;
    cajaBootstrapRequestIdRef.current = requestId;
    const requestUserKey = cajaUserKey;
    const requestSucursalId = idSucursal;
    const isCurrentBootstrapRequest = () => (
      cajaBootstrapRequestIdRef.current === requestId
      && activeCajaUserKeyRef.current === requestUserKey
      && cajaBootstrapAbortRef.current === controller
      && !controller.signal.aborted
      && (requestSucursalId ? activeCajaSucursalRef.current === requestSucursalId : true)
    );
    setBootstrapLoading(true);
    setRecipesLoading(true);
    setCatalogStatuses((current) => ({ ...current, recetas: 'loading' }));
    setCatalogErrors((current) => ({ ...current, recetas: undefined }));

    const promise = ventasService.getCajaBootstrap(
      idSucursal ? { id_sucursal: idSucursal } : {},
      { signal: controller.signal }
    ).then((response) => {
      if (!isCurrentBootstrapRequest()) return null;
      const data = response?.data || {};
      const result = hydrateCajaBootstrapData(data, { requestedSucursalId: idSucursal, meta: response?.meta || {} });
      if (!result) return null;
      cajaCatalogLoadedRef.current.add(cacheKey);
      const responseSucursalId = parsePositiveId(data.id_sucursal);
      if (responseSucursalId) cajaCatalogLoadedRef.current.add(`bootstrap:${buildCajaUserScopeKey(cajaUserKey, responseSucursalId)}`);
      cajaBootstrapDataCacheRef.current.set(cacheKey, {
        status: 'success',
        data,
        meta: response?.meta || {}
      });
      if (responseSucursalId) {
        cajaBootstrapDataCacheRef.current.set(`bootstrap:${buildCajaUserScopeKey(cajaUserKey, responseSucursalId)}`, {
          status: 'success',
          data,
          meta: response?.meta || {}
        });
      }
      return result;
    }).catch((error) => {
      if (controller.signal.aborted) {
        if (isCurrentBootstrapRequest()) setCatalogStatuses((current) => ({ ...current, recetas: 'idle' }));
        return null;
      }
      if (!isCurrentBootstrapRequest()) return null;
      const message = extractApiMessage(error, 'No se pudo cargar el catalogo inicial de Caja.');
      setCatalogErrors((current) => ({
        ...current,
        recetas: { endpoint: '/ventas/caja/bootstrap', status: Number(error?.status || 0) || null, message }
      }));
      setCatalogStatuses((current) => ({ ...current, recetas: 'error' }));
      openToast('ERROR CATALOGO', message, 'danger');
      throw error;
    }).finally(() => {
      const current = cajaCatalogInFlightRef.current.get(cacheKey);
      if (current?.controller === controller && current.requestId === requestId) {
        cajaCatalogInFlightRef.current.delete(cacheKey);
      }
      if (cajaBootstrapAbortRef.current === controller && cajaBootstrapRequestIdRef.current === requestId) {
        cajaBootstrapAbortRef.current = null;
        setBootstrapLoading(false);
        setRecipesLoading(false);
        setCatalogLoading(false);
      }
    });
    cajaCatalogInFlightRef.current.set(cacheKey, {
      promise,
      controller,
      requestId,
      userKey: requestUserKey,
      sucursalId: requestSucursalId
    });
    return promise;
  }, [cajaUserKey, hydrateCajaBootstrapData, openToast]);

  const loadCajaRecipesDepartment = useCallback(async ({
    id_sucursal: idSucursalRaw,
    id_tipo_departamento: idTipoDepartamentoRaw = null,
    force = false
  } = {}) => {
    const idSucursal = parsePositiveId(idSucursalRaw);
    const idTipoDepartamento = parsePositiveId(idTipoDepartamentoRaw);
    if (!idSucursal) return null;

    const scopeKey = `${buildCajaUserScopeKey(cajaUserKey, idSucursal)}:departamento:${idTipoDepartamento || 'ALL'}`;
    activeRecipeScopeRef.current = scopeKey;
    setRecipeCatalogState((current) => ({ ...current, activeKey: scopeKey }));
    const cached = recipeCatalogCacheRef.current.get(scopeKey);
    if (!force && cached?.status === 'success') {
      setRecetas(cached.rows || []);
      setCatalogStatuses((current) => ({ ...current, recetas: 'success' }));
      setCatalogErrors((current) => ({ ...current, recetas: undefined }));
      return cached.rows || [];
    }

    const requestKey = `RECETAS:${scopeKey}`;
    const currentInFlight = cajaCatalogInFlightRef.current.get(requestKey);
    if (!force && currentInFlight?.promise && !currentInFlight.controller?.signal?.aborted) {
      return currentInFlight.promise;
    }

    recipeCatalogAbortRef.current.get(requestKey)?.abort();
    const controller = new AbortController();
    recipeCatalogAbortRef.current.set(requestKey, controller);
    const requestId = cajaRecipeRequestIdRef.current + 1;
    cajaRecipeRequestIdRef.current = requestId;
    const requestUserKey = cajaUserKey;
    const isCurrentRequest = () => (
      cajaRecipeRequestIdRef.current === requestId
      && activeCajaUserKeyRef.current === requestUserKey
      && activeCajaSucursalRef.current === idSucursal
      && recipeCatalogAbortRef.current.get(requestKey) === controller
      && !controller.signal.aborted
    );
    setRecetas([]);
    setRecipesLoading(true);
    setCatalogStatuses((current) => ({ ...current, recetas: 'loading' }));
    setCatalogErrors((current) => ({ ...current, recetas: undefined }));
    recipeCatalogCacheRef.current.set(scopeKey, { status: 'loading', rows: cached?.rows || [], error: null });
    setRecipeCatalogState((current) => ({
      activeKey: scopeKey,
      byScope: {
        ...current.byScope,
        [scopeKey]: { status: 'loading', rows: cached?.rows || [], error: null }
      }
    }));

    const promise = ventasService.getRecetasCatalog(
      {
        id_sucursal: idSucursal,
        ...(idTipoDepartamento ? { id_tipo_departamento: idTipoDepartamento } : {})
      },
      { signal: controller.signal }
    ).then((response) => {
      if (controller.signal.aborted || !isCurrentRequest()) return null;
      const rows = (Array.isArray(response) ? response : [])
        .map(normalizeRecetaRecord)
        .filter((receta) => receta.estado)
        .sort(compareRecipeNamesNaturally);
      const entry = { status: 'success', rows, error: null };
      recipeCatalogCacheRef.current.set(scopeKey, entry);
      setRecipeCatalogState((current) => ({
        activeKey: current.activeKey,
        byScope: { ...current.byScope, [scopeKey]: entry }
      }));
      if (activeRecipeScopeRef.current === scopeKey && activeCajaSucursalRef.current === idSucursal) {
        setRecetas(rows);
        setCatalogStatuses((current) => ({ ...current, recetas: 'success' }));
      }
      return rows;
    }).catch((error) => {
      if (controller.signal.aborted) {
        if (!isCurrentRequest()) return null;
        const entry = { status: 'idle', rows: [], error: null };
        recipeCatalogCacheRef.current.set(scopeKey, entry);
        setRecipeCatalogState((current) => ({
          activeKey: current.activeKey,
          byScope: { ...current.byScope, [scopeKey]: entry }
        }));
        if (activeRecipeScopeRef.current === scopeKey) {
          setCatalogStatuses((current) => ({ ...current, recetas: 'idle' }));
        }
        return null;
      }
      const message = extractApiMessage(error, 'No se pudieron cargar las recetas del departamento.');
      const entry = { status: 'error', rows: [], error: message };
      recipeCatalogCacheRef.current.set(scopeKey, entry);
      setRecipeCatalogState((current) => ({
        activeKey: current.activeKey,
        byScope: { ...current.byScope, [scopeKey]: entry }
      }));
      if (activeRecipeScopeRef.current === scopeKey) {
        setCatalogStatuses((current) => ({ ...current, recetas: 'error' }));
        setCatalogErrors((current) => ({
          ...current,
          recetas: { endpoint: '/ventas/catalogos/recetas', status: Number(error?.status || 0) || null, message }
        }));
      }
      return null;
    }).finally(() => {
      if (recipeCatalogAbortRef.current.get(requestKey) === controller) {
        const current = cajaCatalogInFlightRef.current.get(requestKey);
        if (current?.controller === controller && current.requestId === requestId) {
          cajaCatalogInFlightRef.current.delete(requestKey);
        }
        recipeCatalogAbortRef.current.delete(requestKey);
        if (activeRecipeScopeRef.current === scopeKey) setRecipesLoading(false);
      }
    });
    cajaCatalogInFlightRef.current.set(requestKey, {
      promise,
      controller,
      requestId,
      userKey: requestUserKey,
      sucursalId: idSucursal
    });
    return promise;
  }, [cajaUserKey]);

  const loadCajaCatalog = useCallback(async (catalogKeyRaw, { id_sucursal: idSucursalRaw, force = false } = {}) => {
    const catalogKey = String(catalogKeyRaw || '').trim().toUpperCase();
    const idSucursal = parsePositiveId(idSucursalRaw);
    if (!idSucursal) return null;
    if (catalogKey === 'RECETAS') return null;
    if (!['PRODUCTOS', 'DESCUENTOS'].includes(catalogKey)) return null;
    const cacheKey = `${catalogKey}:${buildCajaUserScopeKey(cajaUserKey, idSucursal)}`;
    const cachedData = cajaCatalogDataCacheRef.current.get(cacheKey);
    if (!force && cachedData?.status === 'success') {
      if (catalogKey === 'PRODUCTOS') {
        setCategorias(cachedData.categorias || []);
        setProductos(cachedData.rows || []);
      } else {
        setDescuentosCatalogo(cachedData.rows || []);
        setTiposDescuento(cachedData.tipos || []);
        if (Array.isArray(cachedData.categorias)) setCategorias(cachedData.categorias);
        if (Array.isArray(cachedData.productos)) setProductos(cachedData.productos);
        if (Array.isArray(cachedData.recetas)) setRecetas(cachedData.recetas);
      }
      setCatalogStatuses((current) => ({ ...current, [catalogKey.toLowerCase()]: 'success' }));
      return cachedData.rows || [];
    }
    if (!force && cajaCatalogLoadedRef.current.has(cacheKey)) return null;
    const currentInFlight = cajaCatalogInFlightRef.current.get(cacheKey);
    if (!force && currentInFlight?.promise && !currentInFlight.controller?.signal?.aborted) {
      return currentInFlight.promise;
    }

    cajaCatalogAbortRef.current.get(cacheKey)?.abort();
    cajaCatalogLoadedRef.current.delete(cacheKey);

    const controller = new AbortController();
    cajaCatalogAbortRef.current.set(cacheKey, controller);
    const requestId = cajaCatalogRequestIdRef.current + 1;
    cajaCatalogRequestIdRef.current = requestId;
    const requestUserKey = cajaUserKey;
    const isCurrentRequest = () => (
      cajaCatalogRequestIdRef.current === requestId
      && activeCajaUserKeyRef.current === requestUserKey
      && activeCajaSucursalRef.current === idSucursal
      && cajaCatalogAbortRef.current.get(cacheKey) === controller
      && !controller.signal.aborted
    );
    const setLoadingState = catalogKey === 'PRODUCTOS' ? setProductsLoading : setDiscountsLoading;
    setLoadingState(true);
    const statusKey = catalogKey.toLowerCase();
    setCatalogStatuses((current) => ({ ...current, [statusKey]: 'loading' }));

    const promise = (async () => {
      if (catalogKey === 'PRODUCTOS') {
        const [categoriasResponse, productosResponse] = await Promise.all([
          ventasService.getCategoriasCatalog({ signal: controller.signal }),
          ventasService.getProductosCatalog({ id_sucursal: idSucursal }, { signal: controller.signal })
        ]);
        if (!isCurrentRequest()) return null;
        const normalizedCategorias = (Array.isArray(categoriasResponse) ? categoriasResponse : [])
          .map(normalizeCategoriaRecord)
          .filter((row) => row.estado);
        const categoriasMap = buildCategoriasMap(normalizedCategorias);
        const normalizedProductos = (Array.isArray(productosResponse) ? productosResponse : [])
          .map((row) => normalizeProductoRecord(row, categoriasMap))
          .filter((row) => row.estado)
          .sort((a, b) => a.nombre_producto.localeCompare(b.nombre_producto, 'es', { sensitivity: 'base' }));
        setCategorias(normalizedCategorias);
        setProductos(normalizedProductos);
        cajaCatalogDataCacheRef.current.set(cacheKey, {
          status: 'success',
          categorias: normalizedCategorias,
          rows: normalizedProductos
        });
      } else {
        const [descuentosResponse, tiposResponse] = await Promise.all([
          ventasService.getDescuentosCatalog({ id_sucursal: idSucursal }, { signal: controller.signal }),
          ventasService.getTiposDescuentoCatalog({ signal: controller.signal })
        ]);
        if (controller.signal.aborted || !isCurrentRequest()) return null;
        const normalizedTipos = (Array.isArray(tiposResponse) ? tiposResponse : [])
          .filter((row) => isTruthyState(row?.estado))
          .map((row) => ({
            id_tipo_descuento: Number(row.id_tipo_descuento || 0) || null,
            nombre_tipo_descuento: String(row.nombre_tipo_descuento || '')
          }));
        const normalizedDescuentos = (Array.isArray(descuentosResponse) ? descuentosResponse : [])
          .map((row) => ({
            ...row,
            id_descuento_catalogo: Number(row.id_descuento_catalogo || 0) || null,
            valor_descuento: Number(row.valor_descuento || 0),
            alcance: normalizeDiscountScope(row.alcance),
            id_sucursal: Number(row.id_sucursal || 0) || null,
            estado: isTruthyState(row.estado ?? true)
          }))
          .filter((row) => row.id_descuento_catalogo && row.valor_descuento > 0 && row.estado);
        const scopes = new Set(normalizedDescuentos.map((row) => normalizeDiscountScope(row.alcance)));
        let discountCategorias = null;
        let discountProductos = null;
        let discountRecetas = null;
        if (scopes.has('PRODUCTO')) {
          const productCacheKey = `PRODUCTOS:${buildCajaUserScopeKey(cajaUserKey, idSucursal)}`;
          const productCache = cajaCatalogDataCacheRef.current.get(productCacheKey);
          if (productCache?.status === 'success') {
            discountCategorias = productCache.categorias || [];
            discountProductos = productCache.rows || [];
          } else {
            const [categoriasResponse, productosResponse] = await Promise.all([
              ventasService.getCategoriasCatalog({ signal: controller.signal }),
              ventasService.getProductosCatalog({ id_sucursal: idSucursal }, { signal: controller.signal })
            ]);
            if (controller.signal.aborted || !isCurrentRequest()) return null;
            discountCategorias = (Array.isArray(categoriasResponse) ? categoriasResponse : [])
              .map(normalizeCategoriaRecord)
              .filter((row) => row.estado);
            const categoriasMap = buildCategoriasMap(discountCategorias);
            discountProductos = (Array.isArray(productosResponse) ? productosResponse : [])
              .map((row) => normalizeProductoRecord(row, categoriasMap))
              .filter((row) => row.estado)
              .sort((a, b) => a.nombre_producto.localeCompare(b.nombre_producto, 'es', { sensitivity: 'base' }));
            cajaCatalogDataCacheRef.current.set(productCacheKey, {
              status: 'success',
              categorias: discountCategorias,
              rows: discountProductos
            });
          }
          setCategorias(discountCategorias || []);
          setProductos(discountProductos || []);
        }
        if (scopes.has('RECETA')) {
          const recipeScopeKey = `${buildCajaUserScopeKey(cajaUserKey, idSucursal)}:departamento:ALL`;
          const recipeCache = recipeCatalogCacheRef.current.get(recipeScopeKey);
          if (recipeCache?.status === 'success') {
            discountRecetas = recipeCache.rows || [];
          } else {
            const recetasResponse = await ventasService.getRecetasCatalog({ id_sucursal: idSucursal }, { signal: controller.signal });
            if (controller.signal.aborted || !isCurrentRequest()) return null;
            discountRecetas = (Array.isArray(recetasResponse) ? recetasResponse : [])
              .map(normalizeRecetaRecord)
              .filter((row) => row.estado)
              .sort(compareRecipeNamesNaturally);
            recipeCatalogCacheRef.current.set(recipeScopeKey, {
              status: 'success',
              rows: discountRecetas,
              error: null
            });
          }
          setRecetas(discountRecetas || []);
        }
        setTiposDescuento(normalizedTipos);
        setDescuentosCatalogo(normalizedDescuentos);
        cajaCatalogDataCacheRef.current.set(cacheKey, {
          status: 'success',
          tipos: normalizedTipos,
          rows: normalizedDescuentos,
          ...(discountCategorias ? { categorias: discountCategorias } : {}),
          ...(discountProductos ? { productos: discountProductos } : {}),
          ...(discountRecetas ? { recetas: discountRecetas } : {})
        });
      }
      cajaCatalogLoadedRef.current.add(cacheKey);
      setCatalogErrors((current) => ({ ...current, [catalogKey.toLowerCase()]: undefined }));
      setCatalogStatuses((current) => ({ ...current, [statusKey]: 'success' }));
      return true;
    })().catch((error) => {
      if (controller.signal.aborted) {
        if (isCurrentRequest()) {
          setCatalogStatuses((current) => ({ ...current, [statusKey]: 'idle' }));
        }
        return null;
      }
      if (!isCurrentRequest()) return null;
      const key = catalogKey.toLowerCase();
      setCatalogErrors((current) => ({
        ...current,
        [key]: { endpoint: catalogKey, status: Number(error?.status || 0) || null, message: extractApiMessage(error, `No se pudo cargar ${catalogKey}.`) }
      }));
      setCatalogStatuses((current) => ({ ...current, [statusKey]: 'error' }));
      return null;
    }).finally(() => {
      if (cajaCatalogAbortRef.current.get(cacheKey) === controller) {
        const current = cajaCatalogInFlightRef.current.get(cacheKey);
        if (current?.controller === controller && current.requestId === requestId) {
          cajaCatalogInFlightRef.current.delete(cacheKey);
        }
        cajaCatalogAbortRef.current.delete(cacheKey);
        if (activeCajaSucursalRef.current === idSucursal) setLoadingState(false);
      }
    });
    cajaCatalogInFlightRef.current.set(cacheKey, {
      promise,
      controller,
      requestId,
      userKey: requestUserKey,
      sucursalId: idSucursal
    });
    return promise;
  }, [cajaUserKey]);

  const loadCatalogs = useCallback(async (options = {}) => {
    const requestId = catalogRequestRef.current + 1;
    catalogRequestRef.current = requestId;
    const isCurrentRequest = () => catalogRequestRef.current === requestId;
    const catalogSucursalId = parsePositiveId(options.id_sucursal ?? options.idSucursal);
    const scopedCatalogParams = catalogSucursalId ? { id_sucursal: catalogSucursalId } : {};

    setCatalogLoading(true);
    setCatalogErrors({});

    const endpointRequests = [
      { key: 'categorias', label: '/ventas/catalogos/categorias', request: () => ventasService.getCategoriasCatalog() },
      { key: 'productos', label: '/ventas/catalogos/productos', request: () => ventasService.getProductosCatalog(scopedCatalogParams) },
      { key: 'clientes', label: '/ventas/catalogos/clientes', request: () => ventasService.getClientesCatalog() },
      { key: 'descuentos', label: '/ventas/catalogos/descuentos', request: () => ventasService.getDescuentosCatalog(scopedCatalogParams) },
      { key: 'tiposDescuento', label: '/ventas/catalogos/tipos-descuento', request: () => ventasService.getTiposDescuentoCatalog() },
      { key: 'tiposDepartamento', label: '/ventas/catalogos/tipo-departamento', request: () => ventasService.getTipoDepartamentos() }
    ];
    if (catalogSucursalId) {
      endpointRequests.push(
        { key: 'recetas', label: '/ventas/catalogos/recetas', request: () => ventasService.getRecetasCatalog(scopedCatalogParams) }
      );
    }
    if (options?.includeSucursales) {
      endpointRequests.push({ key: 'sucursales', label: '/sucursales', request: () => sucursalesService.getAll() });
    }

    try {
      const settledResponses = await Promise.allSettled(
        endpointRequests.map((entry) => entry.request())
      );
      if (!isCurrentRequest()) return;

      const responsesByKey = {};
      const nextCatalogErrors = {};

      settledResponses.forEach((result, index) => {
        const endpoint = endpointRequests[index];
        if (result.status === 'fulfilled') {
          responsesByKey[endpoint.key] = result.value;
          return;
        }

        const reason = result.reason;
        const isOptionalSucursalesForbidden =
          endpoint.key === 'sucursales' && Number(reason?.status ?? 0) === 403;
        if (isOptionalSucursalesForbidden) {
          responsesByKey[endpoint.key] = [];
          return;
        }

        nextCatalogErrors[endpoint.key] = {
          endpoint: endpoint.label,
          status: Number(reason?.status ?? 0) || null,
          message: extractApiMessage(
            reason,
            `No se pudo cargar ${endpoint.label}.`
          )
        };
      });

      if (Object.keys(nextCatalogErrors).length > 0) {
        setCatalogErrors(nextCatalogErrors);
        const firstError = Object.entries(nextCatalogErrors)
          .find(([key]) => key !== 'descuentos')?.[1];
        if (isCurrentRequest()) {
          if (firstError) {
            openToast(
              'ERROR CATALOGO',
              `${firstError.endpoint}: ${firstError.message}`,
              'danger'
            );
          }
        }
      }

      const categoriasResponse = responsesByKey.categorias;
      const productosResponse = responsesByKey.productos;
      const clientesResponse = responsesByKey.clientes;
      const recetasResponse = responsesByKey.recetas;
      const descuentosResponse = responsesByKey.descuentos;
      const tiposDescuentoResponse = responsesByKey.tiposDescuento;
      const tiposDepartamentoResponse = responsesByKey.tiposDepartamento;
      const sucursalesResponse = responsesByKey.sucursales;

      const normalizedCategorias = (Array.isArray(categoriasResponse) ? categoriasResponse : [])
        .map(normalizeCategoriaRecord)
        .filter((categoria) => categoria.estado)
        .sort((a, b) =>
          a.nombre_categoria.localeCompare(b.nombre_categoria, 'es', {
            sensitivity: 'base'
          })
        );

      const categoriasMap = buildCategoriasMap(normalizedCategorias);

      const normalizedProductos = (Array.isArray(productosResponse) ? productosResponse : [])
        .map((producto) => normalizeProductoRecord(producto, categoriasMap))
        .filter((producto) => producto.estado)
        .sort((a, b) =>
          a.nombre_producto.localeCompare(b.nombre_producto, 'es', {
            sensitivity: 'base'
          })
        );

      const normalizedClientes = [
        createConsumidorFinalCliente(),
        ...(Array.isArray(clientesResponse) ? clientesResponse : [])
          .map(normalizeClienteOption)
          .sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }))
      ];

      const normalizedRecetas = (Array.isArray(recetasResponse) ? recetasResponse : [])
        .map(normalizeRecetaRecord)
        .filter((receta) => receta.estado)
        .sort((a, b) =>
          a.nombre_receta.localeCompare(b.nombre_receta, 'es', {
            sensitivity: 'base'
          })
        );

      const normalizedTiposDescuento = (Array.isArray(tiposDescuentoResponse) ? tiposDescuentoResponse : [])
        .filter((row) => row && (row.estado === true || row.estado === 'true' || row.estado === 1 || row.estado === '1'))
        .map((row) => ({
          id_tipo_descuento: Number(row.id_tipo_descuento ?? 0) || null,
          nombre_tipo_descuento: String(row.nombre_tipo_descuento ?? '')
        }))
        .filter((row) => row.id_tipo_descuento && row.nombre_tipo_descuento);

      const normalizedDescuentosCatalogo = (Array.isArray(descuentosResponse) ? descuentosResponse : [])
        .map((row) => ({
          id_descuento_catalogo: Number(row.id_descuento_catalogo ?? 0) || null,
          nombre_descuento: String(row.nombre_descuento ?? 'Descuento'),
          descripcion: String(row.descripcion ?? ''),
          valor_descuento: Number(row.valor_descuento ?? 0) || 0,
          alcance: normalizeDiscountScope(row.alcance),
          id_producto: Number(row.id_producto ?? 0) || null,
          id_receta: Number(row.id_receta ?? 0) || null,
          objetivos: {
            productos: Array.isArray(row.objetivos?.productos) ? row.objetivos.productos : [],
            recetas: Array.isArray(row.objetivos?.recetas) ? row.objetivos.recetas : []
          },
          objetivos_count: row.objetivos_count || null,
          id_sucursal: Number(row.id_sucursal ?? 0) || null,
          fecha_inicio: row.fecha_inicio ?? null,
          fecha_fin: row.fecha_fin ?? null,
          id_tipo_descuento: Number(row.id_tipo_descuento ?? 0) || null,
          nombre_tipo_descuento: String(row.nombre_tipo_descuento ?? ''),
          estado: isTruthyState(row.estado ?? true)
        }))
        .filter((row) => row.id_descuento_catalogo && row.valor_descuento > 0 && row.estado);

      // El SQL ya filtra estado=true, por lo que todos los registros que
      // lleguen aqui son departamentos activos – omitimos el filtro de estado
      // para evitar problemas de tipo (bool/string/number) entre el driver y JS.
      const normalizedTiposDepartamento = (Array.isArray(tiposDepartamentoResponse) ? tiposDepartamentoResponse : [])
        .map((row) => ({
          id_tipo_departamento: Number(row?.id_tipo_departamento ?? 0) || null,
          nombre_tipo_departamento: String(row?.nombre_departamento ?? row?.nombre_tipo_departamento ?? '')
        }))
        .filter((row) => row.id_tipo_departamento && row.nombre_tipo_departamento);

      const normalizedSucursales = (Array.isArray(sucursalesResponse) ? sucursalesResponse : [])
        .filter((row) => isTruthyState(row?.estado))
        .map((row) => ({
          id_sucursal: Number(row?.id_sucursal ?? 0) || null,
          nombre_sucursal: String(row?.nombre_sucursal ?? '').trim()
        }))
        .filter((row) => row.id_sucursal && row.nombre_sucursal)
        .sort((a, b) =>
          a.nombre_sucursal.localeCompare(b.nombre_sucursal, 'es', { sensitivity: 'base' })
        );

      setCategorias(normalizedCategorias);
      setProductos(normalizedProductos);
      setRecetas(normalizedRecetas);
      setDescuentosCatalogo(normalizedDescuentosCatalogo);
      setTiposDescuento(normalizedTiposDescuento);
      setTiposDepartamento(normalizedTiposDepartamento);
      setClientes(normalizedClientes);
      setSucursales(normalizedSucursales);
    } finally {
      if (isCurrentRequest()) {
        setCatalogLoading(false);
      }
    }
  }, [openToast]);

  useEffect(() => {
    let active = true;
    const catalogAbortControllers = cajaCatalogAbortRef.current;
    void (async () => {
      if (String(activeTab || '').toLowerCase() === 'caja') {
        let idSucursal = parsePositiveId(initialSucursalId);
        await loadCajaBootstrap(idSucursal ? { id_sucursal: idSucursal } : {});
        return;
      }

      const ventasResult = await loadVentas().catch(() => null);
      if (!active) return;
      if (String(activeTab || '').toLowerCase() === 'descuentos') {
        await loadCatalogs({
          includeSucursales: Boolean(ventasResult?.canSelectSucursal),
          id_sucursal: ventasResult?.catalogSucursalId
        });
      } else {
        setCatalogLoading(false);
      }
    })();
    return () => {
      active = false;
      cajaBootstrapAbortRef.current?.abort();
      clientesRequestManagerRef.current?.abort();
      for (const controller of catalogAbortControllers.values()) controller.abort();
      catalogAbortControllers.clear();
    };
  }, [activeTab, initialSucursalId, isSuperAdmin, loadCajaBootstrap, loadCatalogs, loadVentas]);

  const refreshCatalogs = useCallback(
    (options = {}) => loadCatalogs({
      includeSucursales: Boolean(scopeInfo?.canSelectSucursal),
      ...options
    }),
    [loadCatalogs, scopeInfo?.canSelectSucursal]
  );

  const refreshClientesCatalog = useCallback(async (options = {}) => {
    const search = String(options?.search ?? '').trim();
    const manager = clientesRequestManagerRef.current;
    if (!shouldRequestVentasClients(search)) {
      manager.abort();
      const emptyClientes = [createConsumidorFinalCliente()];
      setClientes(emptyClientes);
      setClientsLoading(false);
      setClientesMeta({ limit: 100, has_more: false });
      setCatalogStatuses((current) => ({ ...current, clientes: 'idle' }));
      setCatalogErrors((current) => ({ ...current, clientes: '' }));
      return emptyClientes;
    }
    const request = manager.start(search);
    setClientsLoading(true);
    setClientesMeta({ limit: 100, has_more: false });
    setCatalogStatuses((current) => ({ ...current, clientes: 'loading' }));
    setCatalogErrors((current) => ({ ...current, clientes: '' }));
    try {
      const clientesResponse = await ventasService.getClientesCatalog(
        {
          search,
          limit: Math.min(100, Math.max(1, Number(options?.limit || 100)))
        },
        { signal: request.controller.signal, noCache: true, timeoutMs: 10_000 }
      );
      if (!manager.isCurrent(request)) return null;
      const clientesData = Array.isArray(clientesResponse)
        ? clientesResponse
        : Array.isArray(clientesResponse?.data) ? clientesResponse.data : [];
      const normalizedClientes = [
        createConsumidorFinalCliente(),
        ...clientesData
          .map(normalizeClienteOption)
      ];
      setClientes(normalizedClientes);
      setClientesMeta({
        limit: Math.min(100, Math.max(1, Number(clientesResponse?.meta?.limit || 100))),
        has_more: Boolean(clientesResponse?.meta?.has_more)
      });
      setCatalogStatuses((current) => ({ ...current, clientes: 'success' }));
      return normalizedClientes;
    } catch (error) {
      if (isCancelledVentasClientRequest(error, request.controller.signal) || !manager.isCurrent(request)) {
        return null;
      }
      setCatalogStatuses((current) => ({
        ...current,
        clientes: 'error'
      }));
      setCatalogErrors((current) => ({
        ...current,
        clientes: extractApiMessage(error, 'No se pudieron cargar los clientes.')
      }));
      throw error;
    } finally {
      if (manager.finish(request)) {
        setClientsLoading(false);
      }
    }
  }, []);

  const upsertClienteCatalog = useCallback((rawCliente) => {
    const normalized = normalizeClienteOption(rawCliente);
    if (!normalized?.value || normalized.es_consumidor_final) return null;
    setClientes((current) => {
      const merged = mergeVentasClienteCatalogOption(current, rawCliente);
      return merged.clientes;
    });
    setCatalogStatuses((current) => ({ ...current, clientes: 'success' }));
    setCatalogErrors((current) => ({ ...current, clientes: '' }));
    return normalized;
  }, []);

  const setVentasSearch = useCallback((search) => {
    setVentasFilters((prev) => ({
      ...prev,
      search: String(search || '').slice(0, 120),
      page: 1
    }));
  }, []);

  const setVentasPage = useCallback((page) => {
    const parsed = Number.parseInt(String(page ?? ''), 10);
    setVentasFilters((prev) => ({
      ...prev,
      page: Number.isInteger(parsed) && parsed > 0 ? parsed : 1
    }));
  }, []);

  const setVentasPageSize = useCallback((pageSize) => {
    const parsed = Number.parseInt(String(pageSize ?? ''), 10);
    setVentasFilters((prev) => ({
      ...prev,
      pageSize: Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 6) : 6,
      page: 1
    }));
  }, []);

  const setVentasSucursal = useCallback((idSucursal) => {
    const parsed = Number.parseInt(String(idSucursal ?? ''), 10);
    setVentasFilters((prev) => ({
      ...prev,
      idSucursal: Number.isInteger(parsed) && parsed > 0 ? parsed : null,
      page: 1
    }));
  }, []);

  const setVentasFilterPatch = useCallback((patch = {}) => {
    setVentasFilters((prev) => {
      const next = { ...prev };

      if (Object.prototype.hasOwnProperty.call(patch, 'search')) {
        next.search = String(patch.search || '').trim().slice(0, 120);
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'idSucursal')) {
        const parsed = Number.parseInt(String(patch.idSucursal ?? ''), 10);
        next.idSucursal = Number.isInteger(parsed) && parsed > 0 ? parsed : null;
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'estado')) {
        const value = String(patch.estado || '').trim().toUpperCase().slice(0, 40);
        next.estado = VENTAS_FILTER_ESTADOS_PERMITIDOS.has(value) ? value : '';
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'fechaDesde')) {
        const value = String(patch.fechaDesde || '').trim();
        next.fechaDesde = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'fechaHasta')) {
        const value = String(patch.fechaHasta || '').trim();
        next.fechaHasta = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
      }

      next.page = 1;
      return next;
    });
  }, []);

  const clearVentasFilters = useCallback(() => {
    setVentasFilters((prev) => ({
      ...prev,
      search: '',
      idSucursal: null,
      estado: '',
      fechaDesde: '',
      fechaHasta: '',
      page: 1
    }));
  }, []);

  const getVentaDetail = useCallback(async (idFactura) => {
    setDetailLoading(true);

    try {
      const response = await ventasService.getById(idFactura);
      return normalizeVentaDetail(response);
    } catch (error) {
      const message = extractApiMessage(error, 'No se pudo cargar el detalle de la venta.');
      openToast('ERROR', message, 'danger');
      throw error;
    } finally {
      setDetailLoading(false);
    }
  }, [openToast]);

  const createVenta = useCallback(
    async (payload, { suppressErrorToast = false, ...serviceOptions } = {}) => {
      setSaving(true);
      setError('');

      try {
        const origin = String(serviceOptions?.origin || '').trim().toUpperCase();
        const shouldRefreshAfterCreate = origin !== 'CAJA';
        const requestOptions = { ...serviceOptions };
        delete requestOptions.origin;
        const response = await ventasService.create(payload, requestOptions);
        openToast(
          'VENTA CREADA',
          `${response?.numero_venta || response?.codigo_venta || 'La venta'} se registro correctamente.`,
          'success'
        );
        if (shouldRefreshAfterCreate) {
          void refreshVentas({ suppressErrors: true }).catch(() => undefined);
        }
        return response;
      } catch (error) {
        const message = extractApiMessage(error, 'No se pudo registrar la venta.');
        setError(message);
        if (!suppressErrorToast) openToast('ERROR', message, 'danger');
        throw error;
      } finally {
        setSaving(false);
      }
    },
    [openToast, refreshVentas]
  );

  const createPedidoPendiente = useCallback(
    async (payload) => {
      setSaving(true);
      setError('');

      try {
        const response = await ventasService.createPedidoPendiente(payload);
        openToast(
          'PEDIDO PENDIENTE',
          'Pedido pendiente creado y enviado a cocina.',
          'success'
        );
        void refreshVentas({ suppressErrors: true }).catch(() => undefined);
        return response;
      } catch (error) {
        const message = extractApiMessage(error, 'No se pudo crear el pedido pendiente.');
        setError(message);
        openToast('ERROR', message, 'danger');
        throw error;
      } finally {
        setSaving(false);
      }
    },
    [openToast, refreshVentas]
  );

  const registrarPagoPedido = useCallback(
    async (idPedido, payload) => {
      setSaving(true);
      setError('');

      try {
        const response = await ventasService.registrarPagoPedido(idPedido, payload);
        openToast('PAGO REGISTRADO', 'Pago registrado correctamente.', 'success');
        void refreshVentas({ suppressErrors: true }).catch(() => undefined);
        return response;
      } catch (error) {
        const message = extractApiMessage(error, 'No se pudo registrar el pago del pedido.');
        setError(message);
        openToast('ERROR', message, 'danger');
        throw error;
      } finally {
        setSaving(false);
      }
    },
    [openToast, refreshVentas]
  );

  return {
    ventas,
    summary,
    pagination,
    scopeInfo,
    ventasFilters,
    sucursales,
    categorias,
    tiposDepartamento,
    productos,
    recetas,
    descuentosCatalogo,
    tiposDescuento,
    clientes,
    clientesMeta,
    loading,
    catalogLoading,
    bootstrapLoading,
    recipesLoading,
    productsLoading,
    clientsLoading,
    discountsLoading,
    catalogStatuses,
    cajaBootstrapData,
    recipeCatalogState,
    saving,
    detailLoading,
    error,
    catalogErrors,
    toast,
    openToast,
    closeToast,
    refreshVentas,
    refreshCatalogs,
    loadCajaBootstrap,
    loadCajaCatalog,
    loadCajaRecipesDepartment,
    refreshClientesCatalog,
    upsertClienteCatalog,
    setVentasSearch,
    setVentasPage,
    setVentasPageSize,
    setVentasSucursal,
    setVentasFilterPatch,
    clearVentasFilters,
    getVentaDetail,
    createVenta,
    createPedidoPendiente,
    registrarPagoPedido
  };
};

