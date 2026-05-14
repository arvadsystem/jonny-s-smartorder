const EXCLUDED_FIELD_TOKENS = [
  'email',
  'correo',
  'password',
  'contrasena',
  'url',
  'link',
  'token',
  'secret',
  'sku',
  'barcode',
  'barra',
  'codigo_barra',
  'codigo_barras'
];

const normalizeMeta = (meta) => {
  if (typeof meta === 'string') {
    return { name: meta, id: '', type: '' };
  }
  if (!meta || typeof meta !== 'object') {
    return { name: '', id: '', type: '' };
  }
  return {
    name: String(meta.name ?? ''),
    id: String(meta.id ?? ''),
    type: String(meta.type ?? '')
  };
};

const shouldSkipUppercase = (meta, value) => {
  const normalized = normalizeMeta(meta);
  const joinedMeta = `${normalized.name} ${normalized.id} ${normalized.type}`.toLowerCase();
  const text = String(value ?? '');

  if (joinedMeta && EXCLUDED_FIELD_TOKENS.some((token) => joinedMeta.includes(token))) return true;
  if (normalized.type === 'email' || normalized.type === 'password' || normalized.type === 'url') return true;
  if (text.includes('@')) return true;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) return true;

  return false;
};

// NEW: utilitaria segura para convertir texto a mayúsculas con exclusiones de campos sensibles.
// WHY: centralizar la normalización de UX sin afectar emails, passwords, URLs ni formatos especiales.
// IMPACT: solo transforma strings elegibles en frontend; no cambia endpoints, contratos ni validaciones backend.
export const toUpperSafe = (value, fieldMeta) => {
  if (value === null || value === undefined) return value;
  const text = String(value);
  if (shouldSkipUppercase(fieldMeta, text)) return text;
  return text.toUpperCase();
};

export default toUpperSafe;
