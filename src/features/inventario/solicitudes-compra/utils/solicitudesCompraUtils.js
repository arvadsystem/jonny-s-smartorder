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
  const pattern = String(type).toLowerCase() === 'producto' ? /^[1-9]\d*$/ : /^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/;
  if (!pattern.test(text) || Number(text) <= 0) return null;
  return Number(text);
};

export const getDraftLineKey = (line) => [
  String(line?.tipo_item || '').toLowerCase(),
  Number(line?.id_item || 0),
  line?.id_presentacion_insumo ? Number(line.id_presentacion_insumo) : 'base'
].join(':');

const DECIMAL_SCALE = 10_000n;

const decimalToScaled4 = (value) => {
  const text = String(value ?? '').trim();
  if (!/^\d+(?:\.\d{1,4})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  return BigInt(whole) * DECIMAL_SCALE + BigInt(fraction.padEnd(4, '0') || '0');
};

const scaled4ToCanonical = (scaled) => {
  const integer = scaled / DECIMAL_SCALE;
  const fraction = String(scaled % DECIMAL_SCALE).padStart(4, '0').replace(/0+$/, '');
  return fraction ? `${integer}.${fraction}` : String(integer);
};

export const addDecimalQuantities = (left, right) => {
  const leftScaled = decimalToScaled4(left);
  const rightScaled = decimalToScaled4(right);
  if (leftScaled === null || rightScaled === null) return null;
  return scaled4ToCanonical(leftScaled + rightScaled);
};

const multiplyVisualQuantity = (quantity, factor) => {
  const quantityScaled = decimalToScaled4(quantity);
  const factorScaled = decimalToScaled4(factor);
  if (quantityScaled === null || factorScaled === null) return null;
  const raw = quantityScaled * factorScaled;
  const roundedScaled = (raw + DECIMAL_SCALE / 2n) / DECIMAL_SCALE;
  return scaled4ToCanonical(roundedScaled);
};

const formatVisualNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 4, useGrouping: true }).format(parsed)
    : String(value);
};

export const buildVisualEquivalence = (line) => {
  if (!line?.id_presentacion_insumo || !line?.factor_conversion_visual) return null;
  const baseQuantity = multiplyVisualQuantity(line.cantidad, line.factor_conversion_visual);
  if (baseQuantity === null) return null;
  const presentation = String(line.nombre_presentacion_visual || line.presentacion || 'Presentación');
  const baseUnit = String(line.unidad_base_visual || 'Unidad base');
  return `${formatVisualNumber(line.cantidad)} ${presentation} ≈ ${formatVisualNumber(baseQuantity)} ${baseUnit}`;
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
      cantidad: Number(line.cantidad)
    };
    if (detail.tipo_item === 'insumo' && line.id_presentacion_insumo) {
      detail.id_presentacion_insumo = Number(line.id_presentacion_insumo);
    }
    return detail;
  })
});

export const mapSolicitudError = (error) => {
  if (error?.status === 403) return 'No tienes permiso para realizar esta acción.';
  if (error?.status === 404) return 'La solicitud ya no está disponible.';
  if (error?.status === 409) return 'La solicitud o el inventario cambió. Actualiza la información.';
  if (error?.status >= 500) return 'No fue posible completar la operación.';
  return error?.message || 'No fue posible completar la operación.';
};

export const formatDateTime = (value) => value
  ? new Intl.DateTimeFormat('es-HN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '—';
