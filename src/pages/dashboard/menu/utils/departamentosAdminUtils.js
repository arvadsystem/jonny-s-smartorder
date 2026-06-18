export const emptyDepartamentoForm = {
  nombre_departamento: '',
  descripcion: '',
  estado: 'true'
};

export const defaultDepartamentoFilters = {
  estado: 'todos',
  sortBy: 'nombre_asc'
};

export const normalizeRows = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.rows)) return response.rows;
  return [];
};

export const parseBoolean = (value) => {
  if (value === true || value === false) return value;
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'true' || raw === '1' || raw === 'activo') return true;
  if (raw === 'false' || raw === '0' || raw === 'inactivo') return false;
  return false;
};

export const resolveDepartamentoActivo = (departamento) => parseBoolean(departamento?.estado);

export const normalizeDepartamentoCode = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

export const normalizeDepartamentoForForm = (departamento) => ({
  nombre_departamento: String(departamento?.nombre_departamento || '').slice(0, 50),
  descripcion: String(departamento?.descripcion || '').slice(0, 50),
  estado: resolveDepartamentoActivo(departamento) ? 'true' : 'false'
});

export const truncateText = (value, maxLength = 100) => {
  const text = String(value || '').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};

export const toPositiveInteger = (value) => {
  const raw = String(value ?? '').trim();
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed)) return null;
  if (parsed > 2147483647) return null;
  return parsed;
};

export const validateDepartamentoForm = (form) => {
  const nombre = String(form?.nombre_departamento || '').trim();
  const descripcion = String(form?.descripcion || '').trim();

  if (!nombre) return 'nombre_departamento es obligatorio.';
  if (nombre.length > 50) return 'nombre_departamento no puede exceder 50 caracteres.';
  if (descripcion.length > 50) return 'descripcion no puede exceder 50 caracteres.';
  return '';
};

export const buildDepartamentoPayload = (form) => ({
  nombre_departamento: String(form?.nombre_departamento || '').trim(),
  descripcion: String(form?.descripcion || '').trim(),
  estado: parseBoolean(form?.estado)
});

export const countActiveDepartamentoFilters = (filters) => {
  const current = filters || {};
  let total = 0;
  if (String(current.estado || 'todos') !== 'todos') total += 1;
  if (String(current.sortBy || 'nombre_asc') !== 'nombre_asc') total += 1;
  return total;
};

export const sortDepartamentos = (rows, sortBy) => {
  const list = [...rows];
  if (sortBy === 'nombre_asc') {
    return list.sort((a, b) =>
      String(a?.nombre_departamento || '').localeCompare(String(b?.nombre_departamento || ''), 'es')
    );
  }
  if (sortBy === 'nombre_desc') {
    return list.sort((a, b) =>
      String(b?.nombre_departamento || '').localeCompare(String(a?.nombre_departamento || ''), 'es')
    );
  }
  return list.sort((a, b) =>
    String(a?.nombre_departamento || '').localeCompare(String(b?.nombre_departamento || ''), 'es')
  );
};
