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
  normalizeComboRecord,
  normalizeProductoRecord,
  normalizeRecetaRecord,
  normalizeVentaDetail,
  normalizeVentaRecord
} from '../utils/ventasHelpers';
import { compareRecipeNamesNaturally } from '../utils/ventasRecipeSort';

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
  if (normalized === 'COMBOS') return 'COMBO';
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

const normalizeVentasSummaryPayload = (summary = {}) => ({
  ...createDefaultVentasSummary(),
  totalVentas: Number.parseInt(String(summary?.ventas ?? summary?.totalVentas ?? 0), 10) || 0,
  totalFacturado: Number(summary?.totalVendido ?? summary?.totalFacturado ?? 0) || 0,
  ticketPromedio: Number(summary?.ticketPromedio ?? 0) || 0,
  completadas: Number.parseInt(String(summary?.completadas ?? 0), 10) || 0,
  pendientes: Number.parseInt(String(summary?.pendientes ?? 0), 10) || 0
});

export const useVentas = ({ activeTab = '', initialSucursalId = null, isSuperAdmin = false } = {}) => {
  const [ventas, setVentas] = useState([]);
  const [summary, setSummary] = useState(() => createDefaultVentasSummary());
  const [pagination, setPagination] = useState(() => createDefaultVentasPagination());
  const [scopeInfo, setScopeInfo] = useState(() => createDefaultVentasScopeInfo());
  const [ventasFilters, setVentasFilters] = useState(() => createDefaultVentasFilters());
  const [sucursales, setSucursales] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos] = useState([]);
  const [combos, setCombos] = useState([]);
  const [recetas, setRecetas] = useState([]);
  const [descuentosCatalogo, setDescuentosCatalogo] = useState([]);
  const [tiposDescuento, setTiposDescuento] = useState([]);
  const [tiposDepartamento, setTiposDepartamento] = useState([]);
  const [clientes, setClientes] = useState(() => [createConsumidorFinalCliente()]);
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [bootstrapLoading, setBootstrapLoading] = useState(false);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [combosLoading, setCombosLoading] = useState(false);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [discountsLoading, setDiscountsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [catalogErrors, setCatalogErrors] = useState({});
  const [toast, setToast] = useState(() => createDefaultVentasToast());
  const catalogRequestRef = useRef(0);
  const cajaBootstrapAbortRef = useRef(null);
  const cajaCatalogAbortRef = useRef(new Map());
  const clientesAbortRef = useRef(null);
  const cajaCatalogLoadedRef = useRef(new Set());
  const cajaCatalogInFlightRef = useRef(new Map());
  const activeCajaSucursalRef = useRef(null);
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

  const loadCajaBootstrap = useCallback(async ({ id_sucursal: idSucursalRaw, force = false } = {}) => {
    const idSucursal = parsePositiveId(idSucursalRaw);
    if (!idSucursal) return null;
    if (activeCajaSucursalRef.current && activeCajaSucursalRef.current !== idSucursal) {
      cajaBootstrapAbortRef.current?.abort();
      for (const controller of cajaCatalogAbortRef.current.values()) controller.abort();
      cajaCatalogAbortRef.current.clear();
      setProductos([]);
      setCombos([]);
      setRecetas([]);
      setDescuentosCatalogo([]);
      setClientes([createConsumidorFinalCliente()]);
      for (const key of [...cajaCatalogLoadedRef.current]) {
        if (key.endsWith(`:${idSucursal}`)) cajaCatalogLoadedRef.current.delete(key);
      }
    }
    activeCajaSucursalRef.current = idSucursal;
    const cacheKey = `bootstrap:${idSucursal}`;
    if (!force && cajaCatalogLoadedRef.current.has(cacheKey)) return null;
    const currentInFlight = cajaCatalogInFlightRef.current.get(cacheKey);
    if (currentInFlight) return currentInFlight;

    cajaBootstrapAbortRef.current?.abort();
    const controller = new AbortController();
    cajaBootstrapAbortRef.current = controller;
    setBootstrapLoading(true);
    setRecipesLoading(true);
    setCatalogErrors((current) => ({ ...current, recetas: undefined }));

    const promise = ventasService.getCajaBootstrap(
      { id_sucursal: idSucursal },
      { signal: controller.signal }
    ).then((response) => {
      if (controller.signal.aborted) return null;
      const data = response?.data || {};
      if (Number(data.id_sucursal) !== idSucursal) return null;
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
      setScopeInfo((current) => ({
        ...current,
        canSelectSucursal: isSuperAdmin,
        selectedSucursalId: idSucursal,
        userSucursalId: parsePositiveId(initialSucursalId)
      }));
      cajaCatalogLoadedRef.current.add(cacheKey);
      return { recetas: normalizedRecetas, tiposDepartamento: normalizedTiposDepartamento, meta: response?.meta || {} };
    }).catch((error) => {
      if (controller.signal.aborted) return null;
      const message = extractApiMessage(error, 'No se pudo cargar el catalogo inicial de Caja.');
      setCatalogErrors((current) => ({
        ...current,
        recetas: { endpoint: '/ventas/caja/bootstrap', status: Number(error?.status || 0) || null, message }
      }));
      openToast('ERROR CATALOGO', message, 'danger');
      throw error;
    }).finally(() => {
      cajaCatalogInFlightRef.current.delete(cacheKey);
      if (cajaBootstrapAbortRef.current === controller) {
        cajaBootstrapAbortRef.current = null;
        setBootstrapLoading(false);
        setRecipesLoading(false);
        setCatalogLoading(false);
      }
    });
    cajaCatalogInFlightRef.current.set(cacheKey, promise);
    return promise;
  }, [initialSucursalId, isSuperAdmin, openToast]);

  const loadCajaCatalog = useCallback(async (catalogKeyRaw, { id_sucursal: idSucursalRaw } = {}) => {
    const catalogKey = String(catalogKeyRaw || '').trim().toUpperCase();
    const idSucursal = parsePositiveId(idSucursalRaw);
    if (!idSucursal) return null;
    if (catalogKey === 'RECETAS') return loadCajaBootstrap({ id_sucursal: idSucursal });
    if (!['PRODUCTOS', 'COMBOS', 'DESCUENTOS'].includes(catalogKey)) return null;
    const cacheKey = `${catalogKey}:${idSucursal}`;
    if (cajaCatalogLoadedRef.current.has(cacheKey)) return null;
    const currentInFlight = cajaCatalogInFlightRef.current.get(cacheKey);
    if (currentInFlight) return currentInFlight;

    const controller = new AbortController();
    cajaCatalogAbortRef.current.set(cacheKey, controller);
    const setLoadingState = catalogKey === 'PRODUCTOS'
      ? setProductsLoading
      : catalogKey === 'COMBOS'
        ? setCombosLoading
        : setDiscountsLoading;
    setLoadingState(true);

    const promise = (async () => {
      if (catalogKey === 'PRODUCTOS') {
        const [categoriasResponse, productosResponse] = await Promise.all([
          ventasService.getCategoriasCatalog({ signal: controller.signal }),
          ventasService.getProductosCatalog({ id_sucursal: idSucursal }, { signal: controller.signal })
        ]);
        if (controller.signal.aborted) return null;
        const normalizedCategorias = (Array.isArray(categoriasResponse) ? categoriasResponse : [])
          .map(normalizeCategoriaRecord)
          .filter((row) => row.estado);
        const categoriasMap = buildCategoriasMap(normalizedCategorias);
        setCategorias(normalizedCategorias);
        setProductos((Array.isArray(productosResponse) ? productosResponse : [])
          .map((row) => normalizeProductoRecord(row, categoriasMap))
          .filter((row) => row.estado)
          .sort((a, b) => a.nombre_producto.localeCompare(b.nombre_producto, 'es', { sensitivity: 'base' })));
      } else if (catalogKey === 'COMBOS') {
        const response = await ventasService.getCombosCatalog({ id_sucursal: idSucursal }, { signal: controller.signal });
        if (controller.signal.aborted) return null;
        setCombos((Array.isArray(response) ? response : [])
          .map(normalizeComboRecord)
          .filter((row) => row.estado)
          .sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es', { sensitivity: 'base' })));
      } else {
        const [descuentosResponse, tiposResponse] = await Promise.all([
          ventasService.getDescuentosCatalog({ id_sucursal: idSucursal }, { signal: controller.signal }),
          ventasService.getTiposDescuentoCatalog({ signal: controller.signal })
        ]);
        if (controller.signal.aborted) return null;
        setTiposDescuento((Array.isArray(tiposResponse) ? tiposResponse : [])
          .filter((row) => isTruthyState(row?.estado))
          .map((row) => ({
            id_tipo_descuento: Number(row.id_tipo_descuento || 0) || null,
            nombre_tipo_descuento: String(row.nombre_tipo_descuento || '')
          })));
        setDescuentosCatalogo((Array.isArray(descuentosResponse) ? descuentosResponse : [])
          .map((row) => ({
            ...row,
            id_descuento_catalogo: Number(row.id_descuento_catalogo || 0) || null,
            valor_descuento: Number(row.valor_descuento || 0),
            alcance: normalizeDiscountScope(row.alcance),
            id_sucursal: Number(row.id_sucursal || 0) || null,
            estado: isTruthyState(row.estado ?? true)
          }))
          .filter((row) => row.id_descuento_catalogo && row.valor_descuento > 0 && row.estado));
      }
      cajaCatalogLoadedRef.current.add(cacheKey);
      setCatalogErrors((current) => ({ ...current, [catalogKey.toLowerCase()]: undefined }));
      return true;
    })().catch((error) => {
      if (controller.signal.aborted) return null;
      const key = catalogKey.toLowerCase();
      setCatalogErrors((current) => ({
        ...current,
        [key]: { endpoint: catalogKey, status: Number(error?.status || 0) || null, message: extractApiMessage(error, `No se pudo cargar ${catalogKey}.`) }
      }));
      return null;
    }).finally(() => {
      cajaCatalogInFlightRef.current.delete(cacheKey);
      cajaCatalogAbortRef.current.delete(cacheKey);
      setLoadingState(false);
    });
    cajaCatalogInFlightRef.current.set(cacheKey, promise);
    return promise;
  }, [loadCajaBootstrap]);

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
        { key: 'combos', label: '/ventas/catalogos/combos', request: () => ventasService.getCombosCatalog(scopedCatalogParams) },
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
      const combosResponse = responsesByKey.combos;
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

      const normalizedCombos = (Array.isArray(combosResponse) ? combosResponse : [])
        .map(normalizeComboRecord)
        .filter((combo) => combo.estado)
        .sort((a, b) =>
          a.descripcion.localeCompare(b.descripcion, 'es', {
            sensitivity: 'base'
          })
        );

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
          id_combo: Number(row.id_combo ?? 0) || null,
          objetivos: {
            productos: Array.isArray(row.objetivos?.productos) ? row.objetivos.productos : [],
            recetas: Array.isArray(row.objetivos?.recetas) ? row.objetivos.recetas : [],
            combos: Array.isArray(row.objetivos?.combos) ? row.objetivos.combos : []
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
      setCombos(normalizedCombos);
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
        if (!idSucursal && isSuperAdmin) {
          const response = await sucursalesService.getAll().catch(() => []);
          if (!active) return;
          const normalized = (Array.isArray(response) ? response : [])
            .filter((row) => isTruthyState(row?.estado))
            .map((row) => ({
              id_sucursal: Number(row?.id_sucursal || 0) || null,
              nombre_sucursal: String(row?.nombre_sucursal || '').trim()
            }))
            .filter((row) => row.id_sucursal && row.nombre_sucursal);
          setSucursales(normalized);
          idSucursal = normalized[0]?.id_sucursal || null;
        }
        if (idSucursal) await loadCajaBootstrap({ id_sucursal: idSucursal });
        else setCatalogLoading(false);
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
    clientesAbortRef.current?.abort();
    const controller = new AbortController();
    clientesAbortRef.current = controller;
    setClientsLoading(true);
    try {
      const clientesResponse = await ventasService.getClientesCatalog(
        { search, limit: Math.min(50, Math.max(1, Number(options?.limit || 20))) },
        { signal: controller.signal }
      );
      if (controller.signal.aborted) return null;
      const normalizedClientes = [
        createConsumidorFinalCliente(),
        ...(Array.isArray(clientesResponse) ? clientesResponse : [])
          .map(normalizeClienteOption)
          .sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }))
      ];
      setClientes(normalizedClientes);
      return normalizedClientes;
    } finally {
      if (clientesAbortRef.current === controller) {
        clientesAbortRef.current = null;
        setClientsLoading(false);
      }
    }
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
    async (payload, { suppressErrorToast = false } = {}) => {
      setSaving(true);
      setError('');

      try {
        const response = await ventasService.create(payload);
        openToast(
          'VENTA CREADA',
          `${response?.numero_venta || response?.codigo_venta || 'La venta'} se registro correctamente.`,
          'success'
        );
        void refreshVentas({ suppressErrors: true }).catch(() => undefined);
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
    combos,
    recetas,
    descuentosCatalogo,
    tiposDescuento,
    clientes,
    loading,
    catalogLoading,
    bootstrapLoading,
    recipesLoading,
    productsLoading,
    combosLoading,
    clientsLoading,
    discountsLoading,
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
    refreshClientesCatalog,
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

