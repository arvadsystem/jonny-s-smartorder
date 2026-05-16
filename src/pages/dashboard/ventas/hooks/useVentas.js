import { useCallback, useEffect, useState } from 'react';
import ventasService from '../../../../services/ventasService';
import sucursalesService from '../../../../services/sucursalesService';
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

const initialToast = {
  show: false,
  title: '',
  message: '',
  variant: 'success'
};

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

export const useVentas = () => {
  const [ventas, setVentas] = useState([]);
  const [summary, setSummary] = useState({
    totalVentas: 0,
    totalFacturado: 0,
    ticketPromedio: 0,
    completadas: 0,
    pendientes: 0
  });
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 30,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false
  });
  const [scopeInfo, setScopeInfo] = useState({
    canSelectSucursal: false,
    selectedSucursalId: null,
    userSucursalId: null,
    limitedByRole: false,
    limitedToLast72Hours: false,
    allowedSucursalIds: []
  });
  const [ventasFilters, setVentasFilters] = useState({
    search: '',
    idSucursal: null,
    fechaDesde: '',
    fechaHasta: '',
    page: 1,
    pageSize: 30
  });
  const [sucursales, setSucursales] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos] = useState([]);
  const [combos, setCombos] = useState([]);
  const [recetas, setRecetas] = useState([]);
  const [descuentosCatalogo, setDescuentosCatalogo] = useState([]);
  const [tiposDescuento, setTiposDescuento] = useState([]);
  const [tiposDepartamento, setTiposDepartamento] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [catalogErrors, setCatalogErrors] = useState({});
  const [toast, setToast] = useState(initialToast);

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

  const loadVentas = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await ventasService.list({
        page: ventasFilters.page,
        pageSize: ventasFilters.pageSize,
        search: ventasFilters.search,
        idSucursal: ventasFilters.idSucursal,
        fechaDesde: ventasFilters.fechaDesde,
        fechaHasta: ventasFilters.fechaHasta
      });

      const rowsPayload = Array.isArray(response)
        ? response
        : (Array.isArray(response?.data) ? response.data : []);
      const rows = rowsPayload.map(normalizeVentaRecord);

      const serverPagination = response?.pagination || {};
      const resolvedPage = Number.parseInt(String(serverPagination.page ?? ventasFilters.page), 10) || 1;
      const resolvedPageSize = Number.parseInt(String(serverPagination.pageSize ?? ventasFilters.pageSize), 10) || 30;
      const resolvedTotal = Number.parseInt(String(serverPagination.total ?? rows.length), 10) || 0;
      const resolvedTotalPages = Number.parseInt(String(serverPagination.totalPages ?? 1), 10) || 1;
      const backendSummary = response?.summary || {};

      setVentas(rows);
      setPagination({
        page: resolvedPage,
        pageSize: resolvedPageSize,
        total: resolvedTotal,
        totalPages: Math.max(1, resolvedTotalPages),
        hasNextPage: Boolean(serverPagination.hasNextPage ?? (resolvedPage < resolvedTotalPages)),
        hasPreviousPage: Boolean(serverPagination.hasPreviousPage ?? (resolvedPage > 1))
      });
      const canSelectSucursal = Boolean(response?.filters?.scope?.canSelectSucursal);
      setScopeInfo({
        canSelectSucursal,
        selectedSucursalId: response?.filters?.scope?.selectedSucursalId ?? null,
        userSucursalId: response?.filters?.scope?.userSucursalId ?? null,
        limitedByRole: Boolean(response?.filters?.scope?.limitedByRole),
        limitedToLast72Hours: Boolean(response?.filters?.scope?.limitedToLast72Hours),
        allowedSucursalIds: Array.isArray(response?.filters?.scope?.allowedSucursalIds)
          ? response.filters.scope.allowedSucursalIds
          : []
      });
      setSummary({
        totalVentas: Number.parseInt(String(backendSummary?.ventas ?? 0), 10) || 0,
        totalFacturado: Number(backendSummary?.totalVendido ?? 0) || 0,
        ticketPromedio: Number(backendSummary?.ticketPromedio ?? 0) || 0,
        completadas: Number.parseInt(String(backendSummary?.completadas ?? 0), 10) || 0,
        pendientes: Number.parseInt(String(backendSummary?.pendientes ?? 0), 10) || 0
      });
      return { rows, canSelectSucursal };
    } catch (error) {
      const message = extractApiMessage(error, 'No se pudieron cargar las ventas.');
      setError(message);
      openToast('ERROR', message, 'danger');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [openToast, ventasFilters]);

  const loadCatalogs = useCallback(async (options = {}) => {
    setCatalogLoading(true);
    setCatalogErrors({});

    const endpointRequests = [
      { key: 'categorias', label: '/ventas/catalogos/categorias', request: () => ventasService.getCategoriasCatalog() },
      { key: 'productos', label: '/ventas/catalogos/productos', request: () => ventasService.getProductosCatalog() },
      { key: 'clientes', label: '/ventas/catalogos/clientes', request: () => ventasService.getClientesCatalog() },
      { key: 'combos', label: '/ventas/catalogos/combos', request: () => ventasService.getCombosCatalog() },
      { key: 'recetas', label: '/ventas/catalogos/recetas', request: () => ventasService.getRecetasCatalog() },
      { key: 'descuentos', label: '/ventas/catalogos/descuentos', request: () => ventasService.getDescuentosCatalog() },
      { key: 'tiposDescuento', label: '/ventas/catalogos/tipos-descuento', request: () => ventasService.getTiposDescuentoCatalog() },
      { key: 'tiposDepartamento', label: '/ventas/catalogos/tipo-departamento', request: () => ventasService.getTipoDepartamentos() }
    ];
    if (options?.includeSucursales) {
      endpointRequests.push({ key: 'sucursales', label: '/sucursales', request: () => sucursalesService.getAll() });
    }

    try {
      const settledResponses = await Promise.allSettled(
        endpointRequests.map((entry) => entry.request())
      );
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
        const firstError = Object.values(nextCatalogErrors)[0];
        openToast(
          'ERROR CATALOGO',
          `${firstError.endpoint}: ${firstError.message}`,
          'danger'
        );
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
        {
          id_cliente: null,
          value: 'cf',
          label: 'Consumidor final',
          nombre_cliente: 'Consumidor final',
          es_consumidor_final: true
        },
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
      setCatalogLoading(false);
    }
  }, [openToast]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const ventasResult = await loadVentas().catch(() => null);
      if (!active) return;
      const includeSucursales = Boolean(ventasResult?.canSelectSucursal);
      await loadCatalogs({ includeSucursales });
    })();
    return () => {
      active = false;
    };
  }, [loadCatalogs, loadVentas]);

  const refreshCatalogs = useCallback(
    () => loadCatalogs({ includeSucursales: Boolean(scopeInfo?.canSelectSucursal) }),
    [loadCatalogs, scopeInfo?.canSelectSucursal]
  );

  const setVentasSearch = useCallback((search) => {
    setVentasFilters((prev) => ({
      ...prev,
      search: String(search || ''),
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
      pageSize: Number.isInteger(parsed) && parsed > 0 ? parsed : prev.pageSize,
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
    async (payload) => {
      setSaving(true);
      setError('');

      try {
        const response = await ventasService.create(payload);
        await loadVentas();
        openToast(
          'VENTA CREADA',
          `${response?.numero_venta || 'La venta'} se registro correctamente.`,
          'success'
        );
        return response;
      } catch (error) {
        const message = extractApiMessage(error, 'No se pudo registrar la venta.');
        setError(message);
        openToast('ERROR', message, 'danger');
        throw error;
      } finally {
        setSaving(false);
      }
    },
    [loadVentas, openToast]
  );

  const createPedidoPendiente = useCallback(
    async (payload) => {
      setSaving(true);
      setError('');

      try {
        const response = await ventasService.createPedidoPendiente(payload);
        await loadVentas();
        openToast(
          'PEDIDO PENDIENTE',
          'Pedido pendiente creado y enviado a cocina.',
          'success'
        );
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
    [loadVentas, openToast]
  );

  const registrarPagoPedido = useCallback(
    async (idPedido, payload) => {
      setSaving(true);
      setError('');

      try {
        const response = await ventasService.registrarPagoPedido(idPedido, payload);
        await loadVentas();
        openToast('PAGO REGISTRADO', 'Pago registrado correctamente.', 'success');
        return response;
      } catch (error) {
        const isConflict = Number(error?.status || 0) === 409;
        const message = isConflict
          ? 'Este pedido ya fue pagado o no esta pendiente de pago.'
          : extractApiMessage(error, 'No se pudo registrar el pago del pedido.');
        setError(message);
        openToast('ERROR', message, 'danger');
        throw error;
      } finally {
        setSaving(false);
      }
    },
    [loadVentas, openToast]
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
    saving,
    detailLoading,
    error,
    catalogErrors,
    toast,
    closeToast,
    refreshVentas: loadVentas,
    refreshCatalogs,
    setVentasSearch,
    setVentasPage,
    setVentasPageSize,
    setVentasSucursal,
    getVentaDetail,
    createVenta,
    createPedidoPendiente,
    registrarPagoPedido
  };
};

