import { apiFetch } from './api';

const buildQuery = (filters = {}) => {
  const params = new URLSearchParams();

  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    const normalized = String(value).trim();
    if (!normalized) return;
    params.set(key, normalized);
  });

  const query = params.toString();
  return query ? `?${query}` : '';
};

const getReport = (path, filters = {}) => apiFetch(`${path}${buildQuery(filters)}`);

export const reportesService = {
  getVentasResumen: (filters = {}) => getReport('/reportes/ventas/resumen', filters),
  getVentasMetodosPago: (filters = {}) => getReport('/reportes/ventas/metodos-pago', filters),
  getCajaCierres: (filters = {}) => getReport('/reportes/caja/cierres', filters),
  getCajaDiferencias: (filters = {}) => getReport('/reportes/caja/diferencias', filters),
  getInventarioStockCritico: (filters = {}) => getReport('/reportes/inventario/stock-critico', filters),
  getInventarioKardex: (filters = {}) => getReport('/reportes/inventario/kardex', filters),
  getVentasDescuentos: (filters = {}) => getReport('/reportes/ventas/descuentos', filters),
  getVentasItems: (filters = {}) => getReport('/reportes/ventas/items', filters)
};

export default reportesService;
