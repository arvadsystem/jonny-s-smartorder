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

const cocinaService = {
  listPedidos: (params = {}) => apiFetch(`/cocina/pedidos${buildQuery(params)}`, 'GET'),
  updatePedidoEstado: (idPedido, payload) =>
    apiFetch(`/cocina/pedidos/${idPedido}/estado`, 'PUT', payload)
};

export default cocinaService;
