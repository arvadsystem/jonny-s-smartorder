export const MAX_RECEPTION_OBSERVATION_LENGTH = 1000;
export const MAX_INVOICE_SIZE = 6 * 1024 * 1024;
export const ALLOWED_INVOICE_MIME_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);

const DECIMAL_SCALE = 10_000n;

const positiveInteger = (value) => {
  const text = String(value ?? '').trim();
  return /^[1-9]\d*$/.test(text) ? Number(text) : null;
};

const decimalToScaled4 = (value) => {
  const text = String(value ?? '').trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  return BigInt(whole) * DECIMAL_SCALE + BigInt(fraction.padEnd(4, '0'));
};

export const parseReceivedQuantity = (value, type) => {
  const text = String(value ?? '').trim();
  const isProduct = String(type || '').toUpperCase() === 'PRODUCTO';
  const pattern = isProduct ? /^[1-9]\d*$/ : /^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/;
  const parsed = Number(text);
  if (!pattern.test(text) || !Number.isFinite(parsed) || parsed <= 0 || (isProduct && !Number.isSafeInteger(parsed))) return null;
  return parsed;
};

export const normalizeReceptionObservation = (value) => {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
  return normalized || null;
};

export const compareDecimalQuantities = (left, right) => {
  const leftScaled = decimalToScaled4(left);
  const rightScaled = decimalToScaled4(right);
  if (leftScaled === null || rightScaled === null) return null;
  if (leftScaled === rightScaled) return 0;
  return leftScaled < rightScaled ? -1 : 1;
};

export const createReceptionDraft = (details) => (Array.isArray(details) ? details : []).map((detail) => ({
  id_solicitud_detalle: positiveInteger(detail?.id_solicitud_detalle),
  tipo_item: String(detail?.tipo_item || '').toUpperCase(),
  nombre: detail?.nombre || '',
  categoria: detail?.categoria || '',
  presentacion_snapshot: detail?.presentacion_snapshot || '',
  cantidad_aprobada: detail?.cantidad_aprobada,
  cantidad_base_aprobada: detail?.cantidad_base_aprobada,
  proveedor: detail?.proveedor || null,
  unidad_base: detail?.unidad_base || '',
  stock_actual: detail?.stock_actual,
  stock_minimo: detail?.stock_minimo,
  cantidad_recibida: String(detail?.cantidad_recibida ?? detail?.cantidad_aprobada ?? '')
}));

export const updateReceptionDraftLine = (lines, idDetalle, cantidad) => {
  const id = positiveInteger(idDetalle);
  if (!id) return Array.isArray(lines) ? lines : [];
  return (Array.isArray(lines) ? lines : []).map((line) => (
    line.id_solicitud_detalle === id
      ? { ...line, cantidad_recibida: cantidad, id_solicitud_detalle: id }
      : line
  ));
};

export const validateReceptionDraft = (lines) => {
  const rows = Array.isArray(lines) ? lines : [];
  const errors = {};
  const general = [];
  const seen = new Set();
  if (!rows.length) general.push('La solicitud no contiene líneas para recibir.');

  rows.forEach((line) => {
    const id = positiveInteger(line?.id_solicitud_detalle);
    if (!id) {
      general.push(`La línea ${line?.nombre || 'sin nombre'} no tiene un id_solicitud_detalle válido.`);
      return;
    }
    const key = String(id);
    const lineErrors = {};
    if (seen.has(id)) {
      lineErrors.id = 'El identificador de detalle está duplicado.';
      general.push(`El id_solicitud_detalle ${id} está duplicado.`);
    }
    seen.add(id);
    const integrityErrors = [];
    if (parseReceivedQuantity(line?.cantidad_recibida, line?.tipo_item) === null) {
      lineErrors.cantidad = String(line?.tipo_item).toUpperCase() === 'PRODUCTO'
        ? 'Ingresa una cantidad entera positiva.'
        : 'Ingresa una cantidad positiva con hasta cuatro decimales.';
    }
    if (parseReceivedQuantity(line?.cantidad_aprobada, line?.tipo_item) === null) {
      integrityErrors.push('La cantidad aprobada no es válida.');
    }
    const baseApproved = decimalToScaled4(line?.cantidad_base_aprobada);
    if (baseApproved === null || baseApproved <= 0n) {
      integrityErrors.push('La cantidad base aprobada no es válida.');
    }
    if (!positiveInteger(line?.proveedor?.id_proveedor)) {
      integrityErrors.push('La línea no tiene un proveedor asignado.');
    }
    if (integrityErrors.length) lineErrors.integridad = integrityErrors.join(' ');
    if (Object.keys(lineErrors).length) errors[key] = lineErrors;
  });

  return { valid: general.length === 0 && Object.keys(errors).length === 0, errors, general };
};

export const getReceptionDifferences = (lines) => (Array.isArray(lines) ? lines : []).filter((line) => (
  compareDecimalQuantities(line?.cantidad_recibida, line?.cantidad_aprobada) !== 0
));

export const hasReceptionDifferences = (lines) => getReceptionDifferences(lines).length > 0;

export const getReceptionObservationError = (observation, differences = false) => {
  const raw = String(observation ?? '');
  if (raw.length > MAX_RECEPTION_OBSERVATION_LENGTH) return 'La observación no puede exceder 1,000 caracteres.';
  if (differences && !normalizeReceptionObservation(raw)) return 'Explica el motivo de las diferencias para continuar.';
  return '';
};

export const validateInvoiceMetadata = (file) => {
  if (!file) return { valid: false, error: 'Selecciona una fotografía de la factura.' };
  if (!ALLOWED_INVOICE_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: 'El archivo debe ser una imagen JPEG, PNG o WEBP válida.' };
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { valid: false, error: 'La fotografía está vacía.' };
  }
  if (file.size > MAX_INVOICE_SIZE) {
    return { valid: false, error: 'La fotografía no puede exceder 6 MB.' };
  }
  if (!String(file.name || '').trim()) return { valid: false, error: 'La fotografía no tiene un nombre válido.' };
  return { valid: true, error: '' };
};

export const detectImageMimeFromBytes = (input) => {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input || []);
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)) return 'image/png';
  if (bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
};

export const validateInvoiceBytes = (file, bytes) => {
  const metadata = validateInvoiceMetadata(file);
  if (!metadata.valid) return metadata;
  const detectedMime = detectImageMimeFromBytes(bytes);
  if (!detectedMime || detectedMime !== file.type) {
    return { valid: false, error: 'El contenido de la imagen no coincide con su tipo JPEG, PNG o WEBP.' };
  }
  return { valid: true, error: '', detectedMime };
};

export const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  if (!file) {
    reject(new Error('No hay una fotografía para leer.'));
    return;
  }
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('No fue posible leer la fotografía.'));
  reader.onload = () => {
    const result = typeof reader.result === 'string' ? reader.result : '';
    if (!result.startsWith('data:image/') || !result.includes(';base64,')) {
      reject(new Error('La lectura de la fotografía está vacía o no es válida.'));
      return;
    }
    resolve(result);
  };
  reader.readAsDataURL(file);
});

export const buildReceptionPayload = ({ observacion, detalles, factura }) => {
  const validation = validateReceptionDraft(detalles);
  if (!validation.valid) throw new Error('El borrador de recepción contiene datos inválidos.');
  const differences = hasReceptionDifferences(detalles);
  const observationError = getReceptionObservationError(observacion, differences);
  if (observationError) throw new Error(observationError);
  if (!factura || !String(factura.nombre_original || '').trim() || !ALLOWED_INVOICE_MIME_TYPES.includes(factura.mime_type) || !String(factura.data_url || '').startsWith(`data:${factura.mime_type};base64,`)) {
    throw new Error('La fotografía de la factura no es válida.');
  }
  return {
    observacion_recepcion: normalizeReceptionObservation(observacion),
    factura: {
      nombre_original: String(factura.nombre_original || ''),
      mime_type: factura.mime_type,
      data_url: factura.data_url
    },
    detalles: detalles.map((line) => ({
      id_solicitud_detalle: positiveInteger(line.id_solicitud_detalle),
      cantidad_recibida: parseReceivedQuantity(line.cantidad_recibida, line.tipo_item)
    }))
  };
};

export const formatFileSize = (bytes) => {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size < 0) return 'Tamaño no disponible';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

export const mapReceptionError = (error) => {
  const backendMessage = String(error?.message || '').trim();
  const safeMessage = backendMessage && !/(stack|sql|postgres|service[_ -]?role|bucket|object_path|data:image|base64|token|storage\.)/i.test(backendMessage)
    ? backendMessage.slice(0, 500)
    : '';
  if (error?.status === 400) return safeMessage || 'Los datos de recepción no son válidos.';
  if (error?.status === 403) return 'No tienes permiso para registrar esta recepción.';
  if (error?.status === 409) return 'La solicitud cambió y debe actualizarse.';
  if (error?.status === 413) return 'La fotografía no puede exceder 6 MB.';
  if (error?.status === 415) return 'El archivo debe ser una imagen JPEG, PNG o WEBP válida.';
  if (error?.status === 502) return 'No fue posible guardar o consultar la factura. Intenta nuevamente.';
  if (error?.status >= 500) return 'No fue posible completar la recepción.';
  return safeMessage || 'No fue posible completar la recepción.';
};
