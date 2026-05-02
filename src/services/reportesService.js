import { apiFetch } from './api';
import { API_URL } from '../utils/constants';

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

const extractFilenameFromDisposition = (value) => {
  const text = String(value || '');
  const utf8Match = text.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }
  const plainMatch = text.match(/filename="?([^";]+)"?/i);
  return plainMatch?.[1] || null;
};

const exportExcel = async ({ reporte, filters = {} }) => {
  const params = new URLSearchParams();
  params.set('reporte', String(reporte || ''));

  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    const normalized = String(value).trim();
    if (!normalized) return;
    params.set(key, normalized);
  });

  const response = await fetch(`${API_URL}/reportes/exportar/excel?${params.toString()}`, {
    method: 'GET',
    credentials: 'include'
  });

  if (!response.ok) {
    let message = 'No se pudo exportar el reporte.';
    try {
      const payload = await response.json();
      message = payload?.message || message;
    } catch {
      // mantener mensaje seguro por defecto
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition');
  const filename = extractFilenameFromDisposition(disposition) || `reporte_${new Date().toISOString().slice(0, 10)}.csv`;
  return { blob, filename };
};

const exportPdf = async ({ reporte, filters = {} }) => {
  const params = new URLSearchParams();
  params.set('reporte', String(reporte || ''));

  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    const normalized = String(value).trim();
    if (!normalized) return;
    params.set(key, normalized);
  });

  const response = await fetch(`${API_URL}/reportes/exportar/pdf?${params.toString()}`, {
    method: 'GET',
    credentials: 'include'
  });

  if (!response.ok) {
    let message = 'No se pudo exportar el reporte.';
    try {
      const payload = await response.json();
      message = payload?.message || message;
    } catch {
      // mantener mensaje seguro por defecto
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition');
  const filename = extractFilenameFromDisposition(disposition) || `reporte_${new Date().toISOString().slice(0, 10)}.pdf`;
  return { blob, filename };
};

export const reportesService = {
  getVentasResumen: (filters = {}) => getReport('/reportes/ventas/resumen', filters),
  getVentasMetodosPago: (filters = {}) => getReport('/reportes/ventas/metodos-pago', filters),
  getCajaCierres: (filters = {}) => getReport('/reportes/caja/cierres', filters),
  getCajaDiferencias: (filters = {}) => getReport('/reportes/caja/diferencias', filters),
  getInventarioStockCritico: (filters = {}) => getReport('/reportes/inventario/stock-critico', filters),
  getInventarioKardex: (filters = {}) => getReport('/reportes/inventario/kardex', filters),
  getVentasDescuentos: (filters = {}) => getReport('/reportes/ventas/descuentos', filters),
  getVentasItems: (filters = {}) => getReport('/reportes/ventas/items', filters),
  exportExcel,
  exportPdf
};

export default reportesService;
