const MAX_COMMENT_LENGTH = 1000;

export const normalizeRevisionComment = (value) => {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
  return normalized || null;
};

const positiveInteger = (value) => {
  const text = String(value ?? '').trim();
  return /^[1-9]\d*$/.test(text) ? Number(text) : null;
};

export const parseApprovedQuantity = (value, type) => {
  const text = String(value ?? '').trim();
  const product = String(type || '').toUpperCase() === 'PRODUCTO';
  const pattern = product ? /^(?:[1-9]\d*)(?:\.0{1,6})?$/ : /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/;
  if (!pattern.test(text) || BigInt(text.replace('.', '')) === 0n) return null;
  if (product) {
    const integer = Number(text.split('.')[0]);
    return Number.isSafeInteger(integer) ? integer : null;
  }
  const [whole, fraction = ''] = text.split('.');
  const normalizedFraction = fraction.replace(/0+$/, '');
  return normalizedFraction ? `${whole}.${normalizedFraction}` : whole;
};

export const createApprovalDraft = (details) => (Array.isArray(details) ? details : []).map((detail) => {
  const type = String(detail?.tipo_item || '').toUpperCase();
  const initialQuantity = detail?.cantidad_aprobada ?? detail?.cantidad_solicitada ?? '';
  const parsedInitial = parseApprovedQuantity(initialQuantity, type);
  return {
  id_solicitud_detalle: positiveInteger(detail?.id_solicitud_detalle),
  _line_key: `persisted-${positiveInteger(detail?.id_solicitud_detalle)}`,
  origen_linea: detail?.origen_linea || 'SUCURSAL',
  id_item: positiveInteger(detail?.id_item),
  id_presentacion_insumo: positiveInteger(detail?.id_presentacion_insumo),
  tipo_item: type,
  nombre: detail?.nombre || '',
  categoria: detail?.categoria || '',
  presentacion_snapshot: detail?.presentacion_snapshot || '',
  factor_conversion_snapshot: String(detail?.factor_conversion_snapshot ?? '1'),
  cantidad_solicitada: detail?.cantidad_solicitada,
  cantidad_base_solicitada: detail?.cantidad_base_solicitada,
  unidad_base: detail?.unidad_base || (String(detail?.tipo_item).toUpperCase() === 'PRODUCTO' ? 'Unidades' : ''),
  stock_actual: detail?.stock_actual,
  stock_minimo: detail?.stock_minimo,
  estado_stock: detail?.estado_stock || '',
  cantidad_aprobada: parsedInitial === null ? String(initialQuantity) : String(parsedInitial),
  id_proveedor: detail?.proveedor?.id_proveedor ? String(detail.proveedor.id_proveedor) : ''
  };
});

export const updateApprovalDraftLine = (lines, idDetalle, patch) => {
  const key = String(idDetalle ?? '');
  if (!key) return Array.isArray(lines) ? lines : [];
  return (Array.isArray(lines) ? lines : []).map((line) => (
    String(line._line_key || line.id_solicitud_detalle) === key || String(line.id_solicitud_detalle) === key ? { ...line, ...patch } : line
  ));
};

export const administrativeLineKey = (line) => `${String(line?.tipo_item || '').toUpperCase()}:${positiveInteger(line?.id_item) || 0}:${positiveInteger(line?.id_presentacion_insumo) || 'base'}`;

export const createAdministrativeApprovalLine = (line) => ({
  id_solicitud_detalle: null,
  _line_key: `admin-${administrativeLineKey(line)}`,
  origen_linea: 'ADMINISTRACION',
  tipo_item: String(line?.tipo_item || '').toUpperCase(),
  id_item: positiveInteger(line?.id_item),
  id_presentacion_insumo: positiveInteger(line?.id_presentacion_insumo),
  nombre: line?.nombre || '',
  categoria: line?.categoria || '',
  presentacion_snapshot: line?.presentacion || line?.nombre_presentacion_visual || line?.unidad_base_visual || 'Unidad',
  factor_conversion_snapshot: String(line?.factor_conversion_visual ?? '1'),
  unidad_base: line?.unidad_base_visual || (String(line?.tipo_item).toUpperCase() === 'PRODUCTO' ? 'Unidades' : ''),
  cantidad_solicitada: line?.cantidad,
  cantidad_base_solicitada: null,
  cantidad_aprobada: String(line?.cantidad ?? ''),
  id_proveedor: ''
});

export const validateApprovalDraft = (lines) => {
  const rows = Array.isArray(lines) ? lines : [];
  const errors = {};
  const general = [];
  const seen = new Set();
  if (!rows.length) general.push('La solicitud no contiene líneas para aprobar.');

  rows.forEach((line) => {
    const id = positiveInteger(line?.id_solicitud_detalle);
    const administrative = !id && line?.origen_linea === 'ADMINISTRACION';
    const key = String(id || line?._line_key || 'invalid');
    const lineErrors = {};
    if (!id && !administrative) general.push(`La línea ${line?.nombre || 'sin nombre'} no tiene un id_solicitud_detalle válido.`);
    if (administrative && (!['PRODUCTO', 'INSUMO'].includes(String(line?.tipo_item).toUpperCase()) || !positiveInteger(line?.id_item))) general.push(`La línea administrativa ${line?.nombre || 'sin nombre'} no conserva un artículo válido.`);
    if (seen.has(key)) {
      lineErrors.id = 'El identificador de detalle está duplicado.';
      general.push(`La línea ${line?.nombre || key} está duplicada.`);
    }
    seen.add(key);
    if (parseApprovedQuantity(line?.cantidad_aprobada, line?.tipo_item) === null) {
      lineErrors.cantidad = String(line?.tipo_item).toUpperCase() === 'PRODUCTO'
        ? 'Ingresa una cantidad entera positiva.'
        : 'Ingresa una cantidad positiva con hasta seis decimales.';
    }
    if (!positiveInteger(line?.id_proveedor)) lineErrors.proveedor = 'Selecciona un proveedor.';
    if (Object.keys(lineErrors).length) errors[key] = lineErrors;
  });

  return { valid: general.length === 0 && Object.keys(errors).length === 0, errors, general };
};

export const buildApprovalPayload = ({ comentario, detalles }) => {
  const validation = validateApprovalDraft(detalles);
  if (!validation.valid) throw new Error('El borrador de aprobación contiene datos inválidos.');
  const normalizedComment = normalizeRevisionComment(comentario);
  if (normalizedComment && normalizedComment.length > MAX_COMMENT_LENGTH) throw new Error('El comentario no puede exceder 1,000 caracteres.');
  return {
    comentario_revision: normalizedComment,
    detalles: detalles.map((line) => positiveInteger(line.id_solicitud_detalle) ? ({
      id_solicitud_detalle: positiveInteger(line.id_solicitud_detalle),
      cantidad_aprobada: parseApprovedQuantity(line.cantidad_aprobada, line.tipo_item),
      id_proveedor: positiveInteger(line.id_proveedor)
    }) : ({
      tipo_item: String(line.tipo_item).toLowerCase(),
      id_item: positiveInteger(line.id_item),
      ...(positiveInteger(line.id_presentacion_insumo) ? { id_presentacion_insumo: positiveInteger(line.id_presentacion_insumo) } : {}),
      cantidad_aprobada: parseApprovedQuantity(line.cantidad_aprobada, line.tipo_item),
      id_proveedor: positiveInteger(line.id_proveedor)
    }))
  };
};

export const buildRejectionPayload = (comentario) => {
  const normalized = normalizeRevisionComment(comentario);
  if (!normalized) throw new Error('El comentario es obligatorio para rechazar la solicitud.');
  if (normalized.length > MAX_COMMENT_LENGTH) throw new Error('El comentario no puede exceder 1,000 caracteres.');
  return { comentario_revision: normalized };
};

export const getRevisionCommentError = (comentario, required = false) => {
  const raw = String(comentario ?? '');
  if (raw.length > MAX_COMMENT_LENGTH) return 'El comentario no puede exceder 1,000 caracteres.';
  if (required && !normalizeRevisionComment(raw)) return 'El comentario es obligatorio para rechazar la solicitud.';
  return '';
};

export const canQuickReject = (solicitud, canReject) => canReject === true
  && solicitud?.acciones?.puede_rechazar === true
  && String(solicitud?.estado || '').toUpperCase() === 'PENDIENTE';

export const mapRevisionError = (error, action = 'review') => {
  if (error?.status === 403) return action === 'reject'
    ? 'No tienes permiso para rechazar esta solicitud.'
    : 'No tienes permiso para revisar esta solicitud.';
  if (error?.status === 404) return 'La solicitud ya no está disponible.';
  if (error?.status === 409) return action === 'reject'
    ? 'La solicitud cambió y ya no puede rechazarse.'
    : 'La solicitud cambió y debe actualizarse.';
  if (error?.status >= 500) return 'No fue posible completar la revisión.';
  return error?.message || 'No fue posible completar la revisión.';
};
