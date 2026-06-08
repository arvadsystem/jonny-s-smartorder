const PUBLIC_MENU_AUTH_CODES = new Set([
  'UNAUTHORIZED',
  'FORBIDDEN',
  'PUBLIC_MENU_UNAUTHORIZED',
  'PUBLIC_MENU_FORBIDDEN'
]);

const normalizeText = (value) => String(value || '').trim();

const toUpperCode = (value) => normalizeText(value).toUpperCase();

export const extractPublicMenuRequestId = (error) => {
  const data = error?.data;
  if (!data || typeof data !== 'object') return '';

  const candidates = [
    data.request_id,
    data.requestId,
    data['request-id'],
    data['x-request-id']
  ];

  for (const candidate of candidates) {
    const safe = normalizeText(candidate);
    if (safe) return safe;
  }

  return '';
};

export const isPublicMenuAuthError = (error) => {
  const status = Number(error?.status || 0);
  const code = toUpperCode(error?.code || error?.data?.code);
  if (code === 'CSRF') return false;
  if (status === 401) return true;
  if (status === 403 && PUBLIC_MENU_AUTH_CODES.has(code)) return true;
  if (PUBLIC_MENU_AUTH_CODES.has(code)) return true;

  const message = normalizeText(error?.message).toLowerCase();
  if (status === 403 && message.includes('csrf')) return false;
  return message.includes('no autorizado') || message.includes('sesion');
};

export const toPublicMenuUiErrorMessage = (error, fallbackMessage) => {
  const baseMessage = normalizeText(error?.message) || normalizeText(fallbackMessage);
  const safeBase = baseMessage || 'No se pudo completar la solicitud.';
  const requestId = extractPublicMenuRequestId(error);
  if (!requestId) return safeBase;
  return `${safeBase} (Ref: ${requestId})`;
};
