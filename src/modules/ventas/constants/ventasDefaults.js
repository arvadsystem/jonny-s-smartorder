export const VENTAS_FILTER_ESTADOS = Object.freeze([
  '',
  'VENTA_DIRECTA',
  'EN_COCINA',
  'LISTO',
  'COMPLETADA',
  'PENDIENTE'
]);

export const VENTAS_FILTER_ESTADOS_PERMITIDOS = new Set(VENTAS_FILTER_ESTADOS);

export const createDefaultVentasToast = () => ({
  show: false,
  title: '',
  message: '',
  variant: 'success'
});

export const createDefaultVentasSummary = () => ({
  totalVentas: 0,
  totalFacturado: 0,
  ticketPromedio: 0,
  completadas: 0,
  pendientes: 0
});

export const createDefaultVentasPagination = () => ({
  page: 1,
  pageSize: 6,
  total: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false
});

export const createDefaultVentasScopeInfo = () => ({
  canSelectSucursal: false,
  selectedSucursalId: null,
  userSucursalId: null,
  limitedByRole: false,
  limitedToLast72Hours: false,
  allowedSucursalIds: []
});

export const createDefaultVentasFilters = () => ({
  search: '',
  idSucursal: null,
  estado: '',
  fechaDesde: '',
  fechaHasta: '',
  page: 1,
  pageSize: 6
});

export const createConsumidorFinalCliente = () => ({
  id_cliente: null,
  value: 'cf',
  label: 'Consumidor final',
  nombre_cliente: 'Consumidor final',
  rtn: '',
  es_consumidor_final: true
});
