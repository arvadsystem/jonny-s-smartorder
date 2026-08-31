export const OC_PENDING_STORAGE_KEY = 'smartorder_oc_pending_create_v1';
export const OC_PENDING_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const OC_RECONCILE_DELAYS_MS = [0, 1500, 3000, 5000, 8000, 12000];

export const createUuidV4 = (cryptoApi = globalThis.crypto) => {
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();
  if (typeof cryptoApi?.getRandomValues !== 'function') throw new Error('El navegador no puede generar un identificador seguro.');
  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const createPendingOcSubmission = (payload, now = Date.now()) => {
  const clientRequestId = createUuidV4();
  const snapshot = structuredClone(payload);
  const immutablePayload = Object.freeze({ ...snapshot,
    detalles: Object.freeze((snapshot.detalles || []).map((line) => Object.freeze({ ...line }))),
    client_request_id: clientRequestId });
  return Object.freeze({ version: 1, client_request_id: clientRequestId, payload: immutablePayload, created_at: now });
};

export const savePendingOcSubmission = (pending, storage = globalThis.sessionStorage) => {
  storage?.setItem(OC_PENDING_STORAGE_KEY, JSON.stringify(pending));
};

export const clearPendingOcSubmission = (storage = globalThis.sessionStorage) => storage?.removeItem(OC_PENDING_STORAGE_KEY);

export const loadPendingOcSubmission = (storage = globalThis.sessionStorage, now = Date.now()) => {
  try {
    const parsed = JSON.parse(storage?.getItem(OC_PENDING_STORAGE_KEY) || 'null');
    const valid = parsed?.version === 1 && typeof parsed.client_request_id === 'string'
      && parsed.payload?.client_request_id === parsed.client_request_id
      && Number.isFinite(parsed.created_at) && now - parsed.created_at <= OC_PENDING_MAX_AGE_MS && now >= parsed.created_at;
    if (!valid) { clearPendingOcSubmission(storage); return null; }
    return parsed;
  } catch { clearPendingOcSubmission(storage); return null; }
};

export const isAmbiguousCreateError = (error) => ['REQUEST_TIMEOUT', 'FETCH_ERROR'].includes(error?.code)
  || [502, 503, 504].includes(Number(error?.status));

export const pollOcReconciliation = async ({ clientRequestId, reconcile, signal, delays = OC_RECONCILE_DELAYS_MS, wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) => {
  for (const delay of delays) {
    if (signal?.aborted) return { found: false, cancelled: true };
    if (delay > 0) await wait(delay);
    if (signal?.aborted) return { found: false, cancelled: true };
    try {
      const result = await reconcile(clientRequestId);
      if (result?.found) return result;
    } catch (error) {
      if (!isAmbiguousCreateError(error)) throw error;
    }
  }
  return { ok: true, found: false };
};
