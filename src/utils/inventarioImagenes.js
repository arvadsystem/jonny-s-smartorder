import { API_URL } from './constants';

// NEW: limites y MIME permitidos compartidos por Productos e Insumos.
// WHY: mantener la misma validacion frontend que el backend para uploads JSON/base64.
// IMPACT: unifica mensajes y evita duplicar reglas en cada tab del modulo Inventario.
export const INVENTARIO_IMAGE_MAX_MB = 6;
export const INVENTARIO_IMAGE_MAX_BYTES = INVENTARIO_IMAGE_MAX_MB * 1024 * 1024;
export const INVENTARIO_IMAGE_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const buildInventarioImageUploadPayload = async (file) => {
  const dataUrl = await readFileAsDataUrl(file);
  return {
    nombre_original: file?.name || 'imagen-inventario',
    mime_type: file?.type || '',
    data_url: dataUrl
  };
};

export const getInventarioImageFileError = (file) => {
  if (!file) return 'Selecciona una imagen valida (JPG, PNG o WEBP).';

  const fileType = String(file.type || '').trim().toLowerCase();
  if (!INVENTARIO_IMAGE_ALLOWED_TYPES.has(fileType)) {
    return 'Selecciona una imagen valida (JPG, PNG o WEBP).';
  }

  if (Number(file.size || 0) > INVENTARIO_IMAGE_MAX_BYTES) {
    return `La imagen supera ${INVENTARIO_IMAGE_MAX_MB} MB.`;
  }

  return '';
};

export const resolveInventarioImageUrl = (rawUrl) => {
  const normalized = String(rawUrl || '').trim();
  if (!normalized) return '';
  if (/^(https?:)?\/\//i.test(normalized) || normalized.startsWith('blob:') || normalized.startsWith('data:')) {
    return normalized;
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
  reader.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'));
  reader.readAsDataURL(file);
});
