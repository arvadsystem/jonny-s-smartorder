export const emptyForm = {
  nombre_receta: '',
  descripcion: '',
  precio: '',
  id_menu: '',
  id_nivel_picante: '1',
  estado: 'true',
  id_tipo_departamento: '',
  url_imagen_publica: '',
  url_imagen_original: '',
  id_archivo: ''
};

// Nivel picante por defecto para recetas donde no aplica (no alitas/tenders).
export const DEFAULT_NIVEL_PICANTE_ID = 1;

const SPICE_KEYWORDS_REGEX = /\b(alitas?|tenders?)\b/i;

// Regla MVP: solo pedir nivel picante cuando el nombre menciona alitas o tenders.
export const shouldRequireSpiceLevel = (nombreReceta) =>
  SPICE_KEYWORDS_REGEX.test(String(nombreReceta || '').trim());

export const defaultFilters = {
  id_menu: '',
  id_tipo_departamento: '',
  precio_min: '',
  precio_max: '',
  imagen: 'todas',
  detalle: 'todas',
  estado: 'todos',
  sortBy: 'recientes'
};

export const countActiveRecetaFilters = (filters) => {
  const current = filters || {};
  let total = 0;

  if (String(current.id_menu || '').trim()) total += 1;
  if (String(current.id_tipo_departamento || '').trim()) total += 1;
  if (String(current.precio_min || '').trim()) total += 1;
  if (String(current.precio_max || '').trim()) total += 1;
  if (String(current.imagen || 'todas') !== 'todas') total += 1;
  if (String(current.detalle || 'todas') !== 'todas') total += 1;
  if (String(current.estado || 'todos') !== 'todos') total += 1;
  if (String(current.sortBy || 'recientes') !== 'recientes') total += 1;

  return total;
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

export const sanitizeRecipeQuantityInput = (value) => {
  const raw = String(value ?? '');
  if (raw === '') return '';
  if (/\s|[eE+-]/.test(raw)) return null;

  const normalized = raw.replace(',', '.');
  if ((normalized.match(/\./g) || []).length > 1) return null;
  if (!/^\d+(?:\.\d{0,4})?$/.test(normalized)) return null;
  return normalized;
};

export const countRecipeQuantityDecimals = (value) => {
  const normalized = sanitizeRecipeQuantityInput(value);
  if (normalized === null || normalized === '') return 0;
  return normalized.includes('.') ? normalized.split('.')[1].length : 0;
};

export const normalizeRecipeQuantity = (value) => {
  const isNumericValue = typeof value === 'number';
  const normalizedInput = isNumericValue ? value : sanitizeRecipeQuantityInput(value);
  if (normalizedInput === null || normalizedInput === '' || String(normalizedInput).endsWith('.')) return null;
  const parsed = Number(normalizedInput);
  if (!Number.isFinite(parsed)) return null;
  return Number(parsed.toFixed(4));
};

export const parseRecipeQuantity = (value) => {
  if (countRecipeQuantityDecimals(value) > 4) return null;
  const normalized = normalizeRecipeQuantity(value);
  return normalized !== null && normalized >= 0.0001 ? normalized : null;
};

export const calculateCantidadPresentacionApi = (cantidadPorciones, presentacion) => {
  const porciones = parseRecipeQuantity(cantidadPorciones);
  const contenidoPresentacion = toNumberOrNull(presentacion?.cantidad_presentacion);
  if (porciones === null || contenidoPresentacion === null || contenidoPresentacion <= 0) {
    return null;
  }
  return normalizeRecipeQuantity(porciones * contenidoPresentacion);
};

export const calculateCantidadBasePresentacion = (cantidadPorciones, presentacion) => {
  const porciones = parseRecipeQuantity(cantidadPorciones);
  const cantidadBase = toNumberOrNull(presentacion?.cantidad_base);
  if (porciones === null || cantidadBase === null || cantidadBase <= 0) {
    return null;
  }
  const normalized = normalizeRecipeQuantity(porciones * cantidadBase);
  return normalized !== null && normalized >= 0.0001 ? normalized : null;
};

export const buildRecetaDetallePayloadItem = ({ idInsumo, idUnidadMedida, cant }) => ({
  id_insumo: Number(idInsumo),
  id_unidad_medida: Number(idUnidadMedida),
  cant: normalizeRecipeQuantity(cant)
});

export const deriveCantidadPorciones = (cantidadPresentacionApi, presentacion) => {
  const cantidadApi = toNumberOrNull(cantidadPresentacionApi);
  const contenidoPresentacion = toNumberOrNull(presentacion?.cantidad_presentacion);
  if (cantidadApi === null || contenidoPresentacion === null || contenidoPresentacion <= 0) {
    return null;
  }
  return normalizeRecipeQuantity(cantidadApi / contenidoPresentacion);
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

export const resolveRecetaActiva = (receta) => parseBoolean(receta?.estado);

const sanitizeDriveFileId = (value) => String(value || '').trim().split('=')[0];

const getDriveFileId = (parsedUrl) => {
  const path = String(parsedUrl?.pathname || '');
  const fileByPath =
    path.match(/\/file\/d\/([^/?#]+)/i)?.[1] ||
    path.match(/\/d\/([^/?#]+)/i)?.[1];
  const fileByQuery = parsedUrl?.searchParams?.get('id');
  return sanitizeDriveFileId(fileByPath || fileByQuery || '');
};

const getDriveResourceKey = (parsedUrl) => {
  const resourceKey = parsedUrl?.searchParams?.get('resourcekey');
  return sanitizeDriveFileId(resourceKey || '');
};

export const getDriveFileIdFromUrl = (rawUrl) => {
  const safeUrl = String(rawUrl || '').trim();
  if (!safeUrl) return '';

  try {
    const parsed = new URL(safeUrl);
    const host = String(parsed.hostname || '').toLowerCase();
    if (
      !host.includes('drive.google.com') &&
      !host.includes('drive.usercontent.google.com') &&
      !host.includes('lh3.googleusercontent.com')
    ) {
      return '';
    }
    return getDriveFileId(parsed);
  } catch {
    return '';
  }
};

const uniqueNonEmpty = (values) => {
  const seen = new Set();
  const list = [];
  for (const value of values) {
    const item = String(value || '').trim();
    if (!item || seen.has(item)) continue;
    seen.add(item);
    list.push(item);
  }
  return list;
};

// Devuelve candidatos de URL para imagen, con fallback para Google Drive.
export const getImageUrlCandidates = (rawUrl) => {
  const safeUrl = String(rawUrl || '').trim();
  if (!safeUrl) return [];

  try {
    const parsed = new URL(safeUrl);
    const host = String(parsed.hostname || '').toLowerCase();
    const isGoogleDriveUrl =
      host.includes('drive.google.com') ||
      host.includes('drive.usercontent.google.com') ||
      host.includes('lh3.googleusercontent.com');
    if (!isGoogleDriveUrl) return [safeUrl];

    const fileId = getDriveFileId(parsed);
    if (!fileId) return [safeUrl];

    const encodedId = encodeURIComponent(fileId);
    const resourceKey = getDriveResourceKey(parsed);
    const encodedResourceKey = resourceKey ? encodeURIComponent(resourceKey) : '';
    const resourceKeySuffix = resourceKey ? `&resourcekey=${encodedResourceKey}` : '';

    // Prioriza la URL guardada en BD para no romper configuraciones ya operativas.
    return uniqueNonEmpty([
      safeUrl,
      `https://drive.google.com/thumbnail?id=${encodedId}&sz=w1000${resourceKeySuffix}`,
      `https://drive.google.com/uc?export=view&id=${encodedId}${resourceKeySuffix}`,
      `https://drive.google.com/uc?id=${encodedId}${resourceKeySuffix}`,
      `https://drive.usercontent.google.com/uc?id=${encodedId}&export=download${resourceKeySuffix}`,
      `https://drive.usercontent.google.com/download?id=${encodedId}&export=view${resourceKeySuffix}`,
      `https://drive.google.com/uc?export=download&id=${encodedId}${resourceKeySuffix}`,
      `https://lh3.googleusercontent.com/d/${encodedId}=w1200`
    ]);
  } catch {
    return [safeUrl];
  }
};

// Mantiene compatibilidad donde se espera una sola URL.
export const toDrivePreviewUrl = (rawUrl) => {
  const safeUrl = String(rawUrl || '').trim();
  if (!safeUrl) return '';

  try {
    const parsed = new URL(safeUrl);
    const host = String(parsed.hostname || '').toLowerCase();
    const isGoogleDriveUrl =
      host.includes('drive.google.com') ||
      host.includes('drive.usercontent.google.com') ||
      host.includes('lh3.googleusercontent.com');

    if (isGoogleDriveUrl) {
      const driveFileId = getDriveFileId(parsed);
      if (driveFileId) {
        const resourceKey = getDriveResourceKey(parsed);
        const resourceKeySuffix = resourceKey
          ? `&resourcekey=${encodeURIComponent(resourceKey)}`
          : '';

        return `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveFileId)}&sz=w1000${resourceKeySuffix}`;
      }
    }
  } catch {
    // fallback abajo
  }

  return getImageUrlCandidates(safeUrl)[0] || '';
};

export const toComparableImageKey = (rawUrl) => {
  const safeUrl = String(rawUrl || '').trim();
  if (!safeUrl) return '';

  const driveFileId = getDriveFileIdFromUrl(safeUrl);
  if (driveFileId) return `drive:${driveFileId}`;

  return safeUrl;
};

export const resolveRecetaImageCandidates = (receta) => {
  const rawUrl = String(
    receta?.url_imagen_publica || receta?.imagen_principal_url || receta?.url_imagen || ''
  ).trim();
  return getImageUrlCandidates(rawUrl);
};

export const resolveRecetaImageUrl = (receta) => {
  return resolveRecetaImageCandidates(receta)[0] || '';
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

export const normalizeRecetaForForm = (receta) => {
  // Se conserva la URL cruda de backend para detectar cambios reales al editar.
  const imageUrl = String(
    receta?.url_imagen_publica || receta?.imagen_principal_url || receta?.url_imagen || ''
  ).trim();
  return {
    nombre_receta: String(receta?.nombre_receta || ''),
    descripcion: String(receta?.descripcion || ''),
    precio: String(receta?.precio ?? ''),
    id_menu: String(receta?.id_menu ?? ''),
    id_nivel_picante:
      receta?.id_nivel_picante === null || receta?.id_nivel_picante === undefined
        ? ''
        : String(receta.id_nivel_picante),
    estado: parseBoolean(receta?.estado) ? 'true' : 'false',
    id_tipo_departamento: String(receta?.id_tipo_departamento ?? ''),
    url_imagen_publica: imageUrl,
    url_imagen_original: imageUrl,
    id_archivo:
      receta?.id_archivo === null || receta?.id_archivo === undefined
        ? ''
        : String(receta.id_archivo)
  };
};

export const sortRecetas = (rows, sortBy) => {
  const list = [...rows];
  if (sortBy === 'nombre_asc') {
    return list.sort((a, b) => String(a?.nombre_receta || '').localeCompare(String(b?.nombre_receta || ''), 'es'));
  }
  if (sortBy === 'nombre_desc') {
    return list.sort((a, b) => String(b?.nombre_receta || '').localeCompare(String(a?.nombre_receta || ''), 'es'));
  }
  if (sortBy === 'precio_asc') {
    return list.sort((a, b) => Number(a?.precio || 0) - Number(b?.precio || 0));
  }
  if (sortBy === 'precio_desc') {
    return list.sort((a, b) => Number(b?.precio || 0) - Number(a?.precio || 0));
  }
  return list.sort((a, b) => Number(b?.id_receta || 0) - Number(a?.id_receta || 0));
};

export const formatMoney = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'L. 0.00';
  return `L. ${n.toFixed(2)}`;
};

export const truncateText = (value, maxLength = 100) => {
  const text = String(value || '').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};
