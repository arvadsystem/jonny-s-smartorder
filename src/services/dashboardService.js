import { apiFetch } from './api';

const buildQuery = (params = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (typeof value === 'string' && value.trim() === '') return;
    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

const dashboardService = {
  getResumen: (params = {}, config = {}) =>
    apiFetch(`/dashboard/resumen${buildQuery(params)}`, 'GET', null, config),
  getLegacyResumen: (params = {}, config = {}) =>
    apiFetch(`/ventas/dashboard-resumen${buildQuery(params)}`, 'GET', null, config),
  getLegacyFlujoPedidos: (params = {}, config = {}) =>
    apiFetch(`/ventas/dashboard-flujo-pedidos${buildQuery(params)}`, 'GET', null, config)
};

export default dashboardService;
