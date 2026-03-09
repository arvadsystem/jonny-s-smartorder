export const emptyForm = {
  nombre_receta: '',
  descripcion: '',
  precio: '',
  id_menu: '',
  id_nivel_picante: '',
  id_usuario: '',
  estado: 'true',
  id_tipo_departamento: '',
  url_imagen_publica: '',
  url_imagen_original: '',
  id_archivo: ''
};

export const defaultFilters = {
  estado: 'todos',
  sortBy: 'recientes'
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
  return [];
};

export const resolveRecetaActiva = (receta) => parseBoolean(receta?.estado);

const getDriveFileId = (parsedUrl) => {
  const path = String(parsedUrl?.pathname || '');
  const fileByPath =
    path.match(/\/file\/d\/([^/?#]+)/i)?.[1] ||
    path.match(/\/d\/([^/?#]+)/i)?.[1];
  const fileByQuery = parsedUrl?.searchParams?.get('id');
  return fileByPath || fileByQuery || '';
};

export const getDriveFileIdFromUrl = (rawUrl) => {
  const safeUrl = String(rawUrl || '').trim();
  if (!safeUrl) return '';

  try {
    const parsed = new URL(safeUrl);
    const host = String(parsed.hostname || '').toLowerCase();
    if (!host.includes('drive.google.com') && !host.includes('drive.usercontent.google.com')) {
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
    if (!host.includes('drive.google.com')) return [safeUrl];

    const fileId = getDriveFileId(parsed);
    if (!fileId) return [safeUrl];

    const encodedId = encodeURIComponent(fileId);
    return uniqueNonEmpty([
      safeUrl,
      `https://drive.google.com/thumbnail?id=${encodedId}&sz=w1000`,
      `https://drive.google.com/uc?export=view&id=${encodedId}`,
      `https://drive.usercontent.google.com/download?id=${encodedId}&export=view`
    ]);
  } catch {
    return [safeUrl];
  }
};

// Mantiene compatibilidad donde se espera una sola URL.
export const toDrivePreviewUrl = (rawUrl) => {
  const safeUrl = String(rawUrl || '').trim();
  if (!safeUrl) return '';

  const driveFileId = getDriveFileIdFromUrl(safeUrl);
  if (driveFileId) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveFileId)}&sz=w1000`;
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
  const imageUrl = resolveRecetaImageUrl(receta);
  return {
    nombre_receta: String(receta?.nombre_receta || ''),
    descripcion: String(receta?.descripcion || ''),
    precio: String(receta?.precio ?? ''),
    id_menu: String(receta?.id_menu ?? ''),
    id_nivel_picante:
      receta?.id_nivel_picante === null || receta?.id_nivel_picante === undefined
        ? ''
        : String(receta.id_nivel_picante),
    id_usuario: String(receta?.id_usuario ?? ''),
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
