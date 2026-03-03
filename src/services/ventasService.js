import { apiFetch } from './api';
import { createVentaNative } from './ventasNativeService';

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

const ventasService = {
  list: (params = {}) => apiFetch(`/ventas${buildQuery(params)}`, 'GET'),
  getById: (id) => apiFetch(`/ventas/${id}`, 'GET'),
  create: (payload) => createVentaNative(payload),
  getClientesCatalog: () => apiFetch('/ventas/catalogos/clientes', 'GET'),
  getCombosCatalog: () => apiFetch('/ventas/catalogos/combos', 'GET'),
  getRecetasCatalog: () => apiFetch('/ventas/catalogos/recetas', 'GET'),
  getProductosCatalog: () => apiFetch('/productos', 'GET'),
  getCategoriasCatalog: () => apiFetch('/tipo_departamento', 'GET')
};

export default ventasService;
