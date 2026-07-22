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

export const upsertDraftLine = (lines, incoming) => {
  const key = getDraftLineKey(incoming);
  const current = Array.isArray(lines) ? lines : [];
  const existingIndex = current.findIndex((line) => getDraftLineKey(line) === key);
  if (existingIndex < 0) return { lines: [...current, incoming], merged: false };
  const next = [...current];
  next[existingIndex] = { ...next[existingIndex], cantidad: Number(next[existingIndex].cantidad) + Number(incoming.cantidad) };
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
