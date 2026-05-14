import { API_URL } from './constants';

export const INVENTARIO_IMAGE_CONTEXT = Object.freeze({
  PRODUCTOS_PUBLICOS: 'PRODUCTOS_PUBLICOS',
  OC_EVIDENCIAS_PRIVADAS: 'OC_EVIDENCIAS_PRIVADAS'
});

const SUPABASE_PUBLIC_BUCKET = 'jonnys-assets';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const INVENTARIO_IMAGE_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);
const INVENTARIO_OC_FILE_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

export const INVENTARIO_IMAGE_MAX_MB_BY_CONTEXT = Object.freeze({
  [INVENTARIO_IMAGE_CONTEXT.PRODUCTOS_PUBLICOS]: 5,
  [INVENTARIO_IMAGE_CONTEXT.OC_EVIDENCIAS_PRIVADAS]: 10
});

export const INVENTARIO_ALLOWED_TYPES_BY_CONTEXT = Object.freeze({
  [INVENTARIO_IMAGE_CONTEXT.PRODUCTOS_PUBLICOS]: new Set(INVENTARIO_IMAGE_TYPES),
  [INVENTARIO_IMAGE_CONTEXT.OC_EVIDENCIAS_PRIVADAS]: new Set(INVENTARIO_OC_FILE_TYPES)
});

export const INVENTARIO_IMAGE_MAX_MB =
  INVENTARIO_IMAGE_MAX_MB_BY_CONTEXT[INVENTARIO_IMAGE_CONTEXT.PRODUCTOS_PUBLICOS];
export const INVENTARIO_IMAGE_MAX_BYTES = INVENTARIO_IMAGE_MAX_MB * 1024 * 1024;
export const INVENTARIO_IMAGE_ALLOWED_TYPES = INVENTARIO_ALLOWED_TYPES_BY_CONTEXT[INVENTARIO_IMAGE_CONTEXT.PRODUCTOS_PUBLICOS];

const INVENTARIO_OPTIMIZATION_BY_CONTEXT = Object.freeze({
  [INVENTARIO_IMAGE_CONTEXT.PRODUCTOS_PUBLICOS]: {
    maxLongSide: 1200,
    quality: 0.78,
    outputMimeType: 'image/webp'
  },
  [INVENTARIO_IMAGE_CONTEXT.OC_EVIDENCIAS_PRIVADAS]: {
    maxLongSide: 1800,
    quality: 0.86,
    outputMimeType: 'preserve'
  }
});

export const buildInventarioImageUploadPayload = async (file) => {
  const dataUrl = await readFileAsDataUrl(file);
  return {
    nombre_original: file?.name || 'imagen-inventario',
    mime_type: file?.type || '',
    data_url: dataUrl
  };
};

const normalizeContextKey = (context) =>
  String(context || INVENTARIO_IMAGE_CONTEXT.PRODUCTOS_PUBLICOS).trim().toUpperCase();

const getAllowedTypesByContext = (context) => {
  const contextKey = normalizeContextKey(context);
  return (
    INVENTARIO_ALLOWED_TYPES_BY_CONTEXT[contextKey] ||
    INVENTARIO_ALLOWED_TYPES_BY_CONTEXT[INVENTARIO_IMAGE_CONTEXT.PRODUCTOS_PUBLICOS]
  );
};

const getMaxImageBytesByContext = (context) => {
  const contextKey = String(context || INVENTARIO_IMAGE_CONTEXT.PRODUCTOS_PUBLICOS).trim().toUpperCase();
  const maxMb =
    INVENTARIO_IMAGE_MAX_MB_BY_CONTEXT[contextKey] ??
    INVENTARIO_IMAGE_MAX_MB_BY_CONTEXT[INVENTARIO_IMAGE_CONTEXT.PRODUCTOS_PUBLICOS];
  return {
    maxMb,
    maxBytes: maxMb * 1024 * 1024
  };
};

export const isInventarioImageMimeType = (mimeType) =>
  INVENTARIO_IMAGE_TYPES.includes(String(mimeType || '').trim().toLowerCase());

export const isInventarioPdfMimeType = (mimeType) =>
  String(mimeType || '').trim().toLowerCase() === 'application/pdf';

export const isInventarioPdfUrl = (rawUrl) =>
  /\.pdf(?:$|[?#])/i.test(String(rawUrl || '').trim());

export const resolveInventarioEvidenceKind = (mimeType, rawUrl = '') => {
  if (isInventarioPdfMimeType(mimeType) || isInventarioPdfUrl(rawUrl)) return 'pdf';
  if (isInventarioImageMimeType(mimeType)) return 'image';
  return 'unknown';
};

export const getInventarioImageFileError = (
  file,
  context = INVENTARIO_IMAGE_CONTEXT.PRODUCTOS_PUBLICOS
) => {
  const contextKey = normalizeContextKey(context);
  const ocContext = contextKey === INVENTARIO_IMAGE_CONTEXT.OC_EVIDENCIAS_PRIVADAS;
  if (!file) {
    return ocContext
      ? 'Selecciona un archivo valido (JPG, PNG, WEBP o PDF).'
      : 'Selecciona una imagen valida (JPG, PNG o WEBP).';
  }

  const fileType = String(file.type || '').trim().toLowerCase();
  const allowedTypes = getAllowedTypesByContext(contextKey);
  if (!allowedTypes.has(fileType)) {
    return ocContext
      ? 'Selecciona un archivo valido (JPG, PNG, WEBP o PDF).'
      : 'Selecciona una imagen valida (JPG, PNG o WEBP).';
  }

  const { maxBytes, maxMb } = getMaxImageBytesByContext(context);
  if (Number(file.size || 0) > maxBytes) {
    return ocContext ? `El archivo supera ${maxMb} MB.` : `La imagen supera ${maxMb} MB.`;
  }

  return '';
};

const getOptimizationConfigByContext = (context) => {
  const contextKey = normalizeContextKey(context);
  return (
    INVENTARIO_OPTIMIZATION_BY_CONTEXT[contextKey] ||
    INVENTARIO_OPTIMIZATION_BY_CONTEXT[INVENTARIO_IMAGE_CONTEXT.PRODUCTOS_PUBLICOS]
  );
};

const mimeTypeToExtension = (mimeType) => {
  const normalized = String(mimeType || '').trim().toLowerCase();
  if (normalized === 'image/jpeg') return 'jpg';
  if (normalized === 'image/png') return 'png';
  if (normalized === 'image/webp') return 'webp';
  if (normalized === 'application/pdf') return 'pdf';
  return 'bin';
};

const buildOptimizedFileName = (originalName, mimeType) => {
  const baseName = String(originalName || 'archivo').replace(/\.[^.]+$/, '').trim() || 'archivo';
  return `${baseName}.${mimeTypeToExtension(mimeType)}`;
};

const loadImageElementFromFile = async (file) => {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const node = new Image();
      node.onload = () => resolve(node);
      node.onerror = () => reject(new Error('No se pudo procesar la imagen seleccionada.'));
      node.src = objectUrl;
    });
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const canvasToBlob = (canvas, mimeType, quality) => new Promise((resolve, reject) => {
  canvas.toBlob(
    (blob) => {
      if (!blob) {
        reject(new Error('No se pudo optimizar la imagen.'));
        return;
      }
      resolve(blob);
    },
    mimeType,
    quality
  );
});

export const optimizeInventarioImageForUpload = async (
  file,
  context = INVENTARIO_IMAGE_CONTEXT.PRODUCTOS_PUBLICOS
) => {
  if (!file || !isInventarioImageMimeType(file.type)) return file;

  const optimization = getOptimizationConfigByContext(context);
  const image = await loadImageElementFromFile(file);
  const originalWidth = Number(image.naturalWidth || image.width || 0);
  const originalHeight = Number(image.naturalHeight || image.height || 0);
  if (!originalWidth || !originalHeight) {
    throw new Error('No se pudo leer el tamano de la imagen.');
  }

  const maxLongSide = Number(optimization.maxLongSide || 0);
  const scale = maxLongSide > 0 ? Math.min(1, maxLongSide / Math.max(originalWidth, originalHeight)) : 1;
  const targetWidth = Math.max(1, Math.round(originalWidth * scale));
  const targetHeight = Math.max(1, Math.round(originalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context2d = canvas.getContext('2d');
  if (!context2d) throw new Error('No se pudo inicializar el optimizador de imagen.');

  context2d.drawImage(image, 0, 0, targetWidth, targetHeight);

  const outputMimeType =
    optimization.outputMimeType === 'preserve'
      ? String(file.type || '').trim().toLowerCase()
      : String(optimization.outputMimeType || 'image/webp').trim().toLowerCase();
  const quality =
    outputMimeType === 'image/jpeg' || outputMimeType === 'image/webp'
      ? Number(optimization.quality || 0.82)
      : undefined;

  const optimizedBlob = await canvasToBlob(canvas, outputMimeType, quality);
  return new File([optimizedBlob], buildOptimizedFileName(file.name, outputMimeType), {
    type: outputMimeType,
    lastModified: Date.now()
  });
};

export const resolveInventarioImageUrl = (rawUrl) => {
  const normalized = String(rawUrl || '').trim();
  if (!normalized) return '';
  if (/^(https?:)?\/\//i.test(normalized) || normalized.startsWith('blob:') || normalized.startsWith('data:')) {
    return normalized;
  }

  if (normalized.startsWith(`${SUPABASE_PUBLIC_BUCKET}/`) && SUPABASE_URL) {
    return `${SUPABASE_URL.replace(/\/+$/, '')}/storage/v1/object/public/${normalized}`;
  }

  return `${String(API_URL || '').replace(/\/+$/, '')}${normalized.startsWith('/') ? '' : '/'}${normalized}`;
};

export const revokeInventarioObjectUrl = (rawUrl) => {
  if (typeof rawUrl === 'string' && rawUrl.startsWith('blob:')) {
    URL.revokeObjectURL(rawUrl);
  }
};

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado.'));
  reader.readAsDataURL(file);
});
