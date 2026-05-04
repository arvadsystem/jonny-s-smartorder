import {
  getDriveFileIdFromUrl,
  getImageUrlCandidates,
  toComparableImageKey,
  toDrivePreviewUrl
} from './recetasAdminUtils';

export const emptyComboForm = {
  nombre_combo: '',
  descripcion: '',
  precio: '',
  cant_personas: '1',
  id_menu: '',
  estado: 'true',
  url_imagen_publica: '',
  url_imagen_original: '',
  id_archivo: '',
  detalle: []
};

export const parseBoolean = (value) => {
  if (value === true || value === false) return value;
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return false;
};

export const toNumberOrNull = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

export const normalizeRows = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.rows)) return response.rows;
  if (response && typeof response === 'object') {
    const values = Object.values(response).filter(
      (item) => item && typeof item === 'object' && !Array.isArray(item)
    );
    if (values.length > 0) return values;
  }
  return [];
};

export const isPublicHttpUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return true;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export const resolveComboActivo = (combo) => parseBoolean(combo?.estado);

export const resolveComboNombre = (combo) => String(
  combo?.nombre_combo ||
  combo?.descripcion ||
  ''
).trim();

export const resolveComboImageCandidates = (combo) => {
  const raw = String(combo?.url_imagen_publica || combo?.url_imagen || '').trim();
  return getImageUrlCandidates(raw);
};

export const resolveComboImageUrl = (combo) => resolveComboImageCandidates(combo)[0] || '';

export const normalizeComboForForm = (combo) => {
  // En formulario se conserva la URL cruda guardada en DB para comparar cambios reales.
  // El preview visual usa helper de normalizacion aparte.
  const imageUrl = String(combo?.url_imagen_publica || combo?.url_imagen || '').trim();
  const detalle = Array.isArray(combo?.detalle) ? combo.detalle : [];

  return {
    nombre_combo: resolveComboNombre(combo),
    descripcion: String(combo?.descripcion || resolveComboNombre(combo) || ''),
    precio: String(combo?.precio ?? ''),
    cant_personas:
      combo?.cant_personas === null || combo?.cant_personas === undefined
        ? '1'
        : String(combo.cant_personas),
    id_menu: String(combo?.id_menu ?? ''),
    estado: parseBoolean(combo?.estado) ? 'true' : 'false',
    url_imagen_publica: imageUrl,
    url_imagen_original: imageUrl,
    id_archivo:
      combo?.id_archivo === null || combo?.id_archivo === undefined
        ? ''
        : String(combo.id_archivo),
    detalle: detalle.map((item, index) => ({
      id_receta: Number(item?.id_receta || 0),
      cantidad: Number(item?.cantidad || 1),
      orden: Number(item?.orden || index + 1),
      nombre_receta: String(item?.nombre_receta || ''),
      id_detalle_combo: item?.id_detalle_combo ?? null
    }))
  };
};

export const formatMoney = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'L. 0.00';
  return `L. ${n.toFixed(2)}`;
};

export const toSafeComboBaseName = (value) => {
  const sanitized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return sanitized || 'combo';
};

export const extractArchivoId = (response) => {
  const rawId = response?.id_archivo ?? response?.data?.id_archivo ?? null;
  const parsed = Number(rawId);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const getDriveFileIdFromComboUrl = (rawUrl) => getDriveFileIdFromUrl(rawUrl);

export const normalizeDriveStorageUrl = (rawUrl) => {
  const safeUrl = String(rawUrl || '').trim();
  if (!safeUrl) return '';

  const driveId = getDriveFileIdFromUrl(safeUrl);
  if (driveId) {
    // Canonico para persistencia/render de imagenes de Drive en <img>.
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveId)}&sz=w1200`;
  }

  return toDrivePreviewUrl(safeUrl);
};

export const getComparableImageKey = (rawUrl) => toComparableImageKey(rawUrl);

