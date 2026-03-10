import { API_URL } from '../../../../../utils/constants';

const DATA_IMAGE_RE = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/i;
const HTTP_URL_RE = /^https?:\/\//i;
const UPLOADS_PATH_RE = /^\/uploads(?:\/|$)/i;
const ABSOLUTE_UPLOADS_PATH_RE = /^\/uploads(?:\/|$)/i;

const normalizeText = (value) => String(value ?? '').trim();

export const isUsuarioDataImageUrl = (value) => DATA_IMAGE_RE.test(normalizeText(value));

export const isAbsoluteUrl = (value) => HTTP_URL_RE.test(normalizeText(value));

export const isUploadsPath = (value) => UPLOADS_PATH_RE.test(normalizeText(value));

export const isUsuarioUploadsImageUrl = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) return false;
  if (isUploadsPath(normalized)) return true;
  if (!isAbsoluteUrl(normalized)) return false;

  try {
    const parsed = new URL(normalized);
    return ABSOLUTE_UPLOADS_PATH_RE.test(parsed.pathname || '');
  } catch {
    return false;
  }
};

const resolveAgainstApiBase = (rawPath) => {
  try {
    return new URL(rawPath, API_URL).toString();
  } catch {
    return rawPath;
  }
};

export const resolveUserImageSrc = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) return '';
  if (isAbsoluteUrl(normalized)) return normalized;
  if (isUsuarioDataImageUrl(normalized)) return normalized;
  if (isUploadsPath(normalized)) return resolveAgainstApiBase(normalized);
  return '';
};

export const isUsuarioRenderableImageValue = (value) => Boolean(resolveUserImageSrc(value));
