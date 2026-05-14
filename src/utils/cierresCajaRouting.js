export const CIERRES_CAJA_TABS = Object.freeze([
  'operacion',
  'cierres-historial',
  'asignaciones'
]);

const CIERRES_CAJA_TAB_ALIASES = Object.freeze({
  operacion: 'operacion',
  operaciones: 'operacion',
  operativa: 'operacion',
  historial: 'cierres-historial',
  cierres: 'cierres-historial',
  cierre: 'cierres-historial',
  'cierres-historial': 'cierres-historial',
  asignacion: 'asignaciones',
  asignaciones: 'asignaciones'
});

const normalizeRawTab = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-');

export const normalizeCierresCajaTab = (value) => {
  const normalized = normalizeRawTab(value);
  if (!normalized) return '';
  return CIERRES_CAJA_TAB_ALIASES[normalized] || '';
};

export const resolveCierresCajaTab = (value, fallback = 'operacion') =>
  normalizeCierresCajaTab(value) || fallback;

export const isCierresCajaTabCandidate = (value) => Boolean(normalizeCierresCajaTab(value));
