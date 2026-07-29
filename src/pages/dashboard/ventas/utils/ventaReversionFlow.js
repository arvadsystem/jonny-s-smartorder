const FINAL_PRINT_STATES = new Set([
  'IMPRESO',
  'PRINTED',
  'COMPLETADO',
  'COMPLETED',
  'FALLIDO',
  'FAILED',
  'ERROR',
  'CANCELADO',
  'CANCELLED'
]);

export const createReversionIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `reversion_${Date.now()}_${Math.random().toString(36).slice(2)}`;
};

export const stableReversionPayload = (payload = {}) => JSON.stringify({
  tipo_reversion: String(payload.tipo_reversion || '').trim().toUpperCase(),
  motivo: String(payload.motivo || '').trim().toUpperCase(),
  observacion: String(payload.observacion || '').trim(),
  lineas: (Array.isArray(payload.lineas) ? payload.lineas : [])
    .map((linea) => ({
      id_detalle_factura: Number(linea.id_detalle_factura),
      cantidad: Number(linea.cantidad)
    }))
    .sort((a, b) => a.id_detalle_factura - b.id_detalle_factura)
});

export const resolveReversionIntent = (current, payload) => {
  const signature = stableReversionPayload(payload);
  if (current?.signature === signature && current?.key) return current;
  return { signature, key: createReversionIdempotencyKey() };
};

export const buildReversionPayload = ({ tipo, motivo, observacion, cantidades, items }) => {
  const payload = {
    tipo_reversion: String(tipo || '').trim().toUpperCase(),
    motivo: String(motivo || '').trim().toUpperCase(),
    observacion: String(observacion || '').trim()
  };
  if (payload.tipo_reversion !== 'PARCIAL') return payload;
  payload.lineas = (Array.isArray(items) ? items : [])
    .map((item) => {
      const id = Number(item.id_detalle_factura);
      const cantidad = Number(cantidades?.[id]);
      return Number.isSafeInteger(id) && id > 0
        && Number.isSafeInteger(cantidad) && cantidad > 0
        && cantidad <= Number(item.cantidad_disponible)
        ? { id_detalle_factura: id, cantidad }
        : null;
    })
    .filter(Boolean);
  return payload;
};

export const isValidReversionPayload = (payload) =>
  payload?.tipo_reversion === 'TOTAL'
  || (payload?.tipo_reversion === 'PARCIAL' && Array.isArray(payload.lineas) && payload.lineas.length > 0);

export const normalizePrintState = (value) => String(value || 'PENDIENTE').trim().toUpperCase();

export const isFinalPrintState = (value) => FINAL_PRINT_STATES.has(normalizePrintState(value));

export const getPrintStateLabel = (value) => {
  const state = normalizePrintState(value);
  if (['IMPRESO', 'PRINTED', 'COMPLETADO', 'COMPLETED'].includes(state)) return 'Impreso';
  if (['FALLIDO', 'FAILED', 'ERROR', 'CANCELADO', 'CANCELLED'].includes(state)) return 'Fallido';
  if ([
    'PROCESANDO',
    'PROCESSING',
    'TOMADO',
    'CLAIMED',
    'EN_PROCESO',
    'ASIGNADO',
    'IMPRIMIENDO',
    'CONFIRMACION_PENDIENTE'
  ].includes(state)) return 'Procesando';
  if (state === 'DESHABILITADA') return 'Deshabilitada';
  return 'Pendiente';
};
