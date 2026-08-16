import {
  buildConversionPreview,
  formatConversionQuantity,
  isBaseOnlyLine,
  normalizeConversionDecimal,
  resolvePresentationLabel
} from './solicitudesCompraConversionUtils.js';

export const SOLICITUD_ESTADOS = Object.freeze({
  PENDIENTE: { label: 'Pendiente', message: 'Administración revisará la solicitud.' },
  APROBADA: { label: 'Aprobada', message: 'La solicitud fue aprobada y está pendiente de recepción.' },
  RECHAZADA: { label: 'Rechazada', message: 'La solicitud no fue aprobada.' },
  RECIBIDA: { label: 'Recibida', message: 'La compra fue recibida y aplicada al inventario.' },
  CANCELADA: { label: 'Cancelada', message: 'La solicitud fue cancelada.' }
});

export const getEstadoInfo = (estado) => SOLICITUD_ESTADOS[String(estado || '').toUpperCase()] || { label: 'Sin estado', message: '' };

export const normalizeObservation = (value) => {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  return normalized || null;
};

export const parseRequestedQuantity = (value, type) => {
  const text = String(value ?? '').trim();
  const product = String(type).toLowerCase() === 'producto';
  const pattern = product ? /^[1-9]\d*$/ : /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/;
  if (!pattern.test(text) || BigInt(text.replace('.', '')) === 0n) return null;
  return product ? Number(text) : normalizeConversionDecimal(text);
};

export const getDraftLineKey = (line) => [
  String(line?.tipo_item || '').toLowerCase(),
  Number(line?.id_item || 0),
  line?.id_presentacion_insumo ? Number(line.id_presentacion_insumo) : 'base'
].join(':');

const DECIMAL_SCALE = 1_000_000n;

const decimalToScaled6 = (value) => {
  const text = String(value ?? '').trim();
  if (!/^\d+(?:\.\d{1,6})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  return BigInt(whole) * DECIMAL_SCALE + BigInt(fraction.padEnd(6, '0') || '0');
};

const scaled6ToCanonical = (scaled) => {
  const integer = scaled / DECIMAL_SCALE;
  const fraction = String(scaled % DECIMAL_SCALE).padStart(6, '0').replace(/0+$/, '');
  return fraction ? `${integer}.${fraction}` : String(integer);
};

export const addDecimalQuantities = (left, right) => {
  const leftScaled = decimalToScaled6(left);
  const rightScaled = decimalToScaled6(right);
  if (leftScaled === null || rightScaled === null) return null;
  return scaled6ToCanonical(leftScaled + rightScaled);
};

export const buildVisualEquivalence = (line) => {
  if (!line?.id_presentacion_insumo) return null;
  const preview = buildConversionPreview({
    quantity: line?.cantidad,
    presentationLabel: resolvePresentationLabel(line),
    baseUnit: line?.unidad_base_visual || line?.unidad_base,
    factor: line?.factor_conversion_visual || '1',
    baseOnly: isBaseOnlyLine(line)
  });
  return preview.valid && !preview.baseOnly
    ? `${formatConversionQuantity(preview.quantity)} ${preview.presentationLabel} ≈ ${formatConversionQuantity(preview.baseQuantity)} ${preview.baseUnit}`
    : null;
};

export const createEmptyCatalogState = (warehouseId = null, loading = false) => ({
  items: [],
  pagination: { page: 1, total_pages: 1 },
  loading,
  error: '',
  requestedWarehouseId: warehouseId === null || warehouseId === undefined ? null : String(warehouseId)
});

export const createCatalogRequestCoordinator = () => {
  let currentRequestId = 0;
  return {
    begin(warehouseId) {
      currentRequestId += 1;
      return { requestId: currentRequestId, warehouseId: String(warehouseId ?? '') };
    },
    invalidate() { currentRequestId += 1; },
    isCurrent(token, warehouseId) {
      return Boolean(token)
        && token.requestId === currentRequestId
        && token.warehouseId === String(warehouseId ?? '');
    }
  };
};

export const upsertDraftLine = (lines, incoming) => {
  const key = getDraftLineKey(incoming);
  const current = Array.isArray(lines) ? lines : [];
  const existingIndex = current.findIndex((line) => getDraftLineKey(line) === key);
  if (existingIndex < 0) return { lines: [...current, incoming], merged: false };
  const next = [...current];
  const combinedQuantity = addDecimalQuantities(next[existingIndex].cantidad, incoming.cantidad);
  if (combinedQuantity === null) return { lines: current, merged: false };
  next[existingIndex] = { ...next[existingIndex], cantidad: combinedQuantity };
  return { lines: next, merged: true };
};

export const buildSolicitudPayload = ({ idAlmacen, observacion, detalles }) => ({
  id_almacen: Number(idAlmacen),
  observacion: normalizeObservation(observacion),
  detalles: (Array.isArray(detalles) ? detalles : []).map((line) => {
    const detail = {
      tipo_item: String(line.tipo_item).toLowerCase(),
      id_item: Number(line.id_item),
      cantidad: String(line.tipo_item).toLowerCase() === 'insumo'
        ? parseRequestedQuantity(line.cantidad, 'insumo')
        : parseRequestedQuantity(line.cantidad, 'producto')
    };
    if (detail.tipo_item === 'insumo' && line.id_presentacion_insumo) {
      detail.id_presentacion_insumo = Number(line.id_presentacion_insumo);
    }
    return detail;
  })
});

const SAFE_SOLICITUD_CONFLICT_CODES = new Set([
  'INSUMO_SIN_UNIDAD_BASE',
  'PRESENTACION_UNIDAD_BASE_INCOMPATIBLE',
  'SCOPE_AMBIGUOUS'
]);

const TECHNICAL_ERROR_PATTERN = /(?:duplicate\s+key|violates|constraint|sqlstate|postgres|stack\s*trace|relation\s+[^\s]+\s+does\s+not\s+exist|\bpublic\.|\bselect\b|\binsert\b|\bupdate\b|\bdelete\b)/i;

const getSafeSolicitudConflictMessage = (error) => {
  const code = String(error?.code ?? error?.data?.code ?? '').trim().toUpperCase();
  const message = String(error?.message ?? error?.data?.message ?? '').replace(/\s+/g, ' ').trim();
  if (!SAFE_SOLICITUD_CONFLICT_CODES.has(code) || !message || TECHNICAL_ERROR_PATTERN.test(message)) return null;
  return message;
};

export const mapSolicitudError = (error) => {
  if (error?.status === 403) return 'No tienes permiso para realizar esta acción.';
  if (error?.status === 404) return 'La solicitud ya no está disponible.';
  if (error?.status === 409) {
    return getSafeSolicitudConflictMessage(error)
      || 'La solicitud o el inventario cambió. Actualiza la información y vuelve a intentar.';
  }
  if (error?.status >= 500) return 'No fue posible completar la operación.';
  return error?.message || 'No fue posible completar la operación.';
};

export const formatDateTime = (value) => value
  ? new Intl.DateTimeFormat('es-HN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '—';
