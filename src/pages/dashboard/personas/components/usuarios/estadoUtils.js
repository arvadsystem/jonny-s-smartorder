const TRUE_VALUES = new Set(['true', '1', 't', 'si', 'yes', 'activo', 'activa', 'habilitado', 'enabled']);
const FALSE_VALUES = new Set(['false', '0', 'f', 'no', 'inactivo', 'inactiva', 'deshabilitado', 'disabled']);

const parseBooleanPrimitive = (value) => {
  if (value === true || value === false) return value;

  if (typeof value === 'number') {
    if (Number.isNaN(value)) return null;
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (TRUE_VALUES.has(normalized)) return true;
    if (FALSE_VALUES.has(normalized)) return false;
  }

  return null;
};

export const parseEstadoUsuario = (record) => {
  const row = record || {};
  const nestedUsuario = row?.usuario && typeof row.usuario === 'object' ? row.usuario : null;
  const candidates = [
    row.estado,
    row.activo,
    row.habilitado,
    row.estado_usuario,
    row.estado_registro,
    row.estatus,
    nestedUsuario?.estado,
    nestedUsuario?.activo,
    nestedUsuario?.habilitado,
    nestedUsuario?.estado_usuario,
  ];

  for (const candidate of candidates) {
    const parsed = parseBooleanPrimitive(candidate);
    if (parsed !== null) return parsed;
  }

  return true;
};
