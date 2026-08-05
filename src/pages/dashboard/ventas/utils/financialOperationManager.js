export const FINANCIAL_OPERATION_STATUS = Object.freeze({
  NEW: 'NUEVA',
  SENDING: 'ENVIANDO',
  UNKNOWN: 'RESULTADO_DESCONOCIDO',
  CONFIRMED: 'CONFIRMADA',
  REJECTED: 'RECHAZADA',
  ABANDONED: 'ABANDONADA'
});

const TERMINAL = new Set([FINANCIAL_OPERATION_STATUS.CONFIRMED, FINANCIAL_OPERATION_STATUS.ABANDONED]);
const TRANSITIONS = Object.freeze({
  [FINANCIAL_OPERATION_STATUS.NEW]: [FINANCIAL_OPERATION_STATUS.SENDING],
  [FINANCIAL_OPERATION_STATUS.SENDING]: [FINANCIAL_OPERATION_STATUS.CONFIRMED, FINANCIAL_OPERATION_STATUS.UNKNOWN, FINANCIAL_OPERATION_STATUS.REJECTED],
  [FINANCIAL_OPERATION_STATUS.UNKNOWN]: [FINANCIAL_OPERATION_STATUS.SENDING, FINANCIAL_OPERATION_STATUS.ABANDONED],
  [FINANCIAL_OPERATION_STATUS.REJECTED]: [FINANCIAL_OPERATION_STATUS.ABANDONED]
});

const stableStringify = (value) => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
};

const opaqueHash = (value) => {
  const text = stableStringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193) >>> 0;
  return hash.toString(16).padStart(8, '0');
};

const createId = () => globalThis.crypto?.randomUUID?.() || `op_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const clone = (value) => JSON.parse(JSON.stringify(value));
const inFlight = new Map();
const ownerId = createId();

const normalizeScope = (scope = {}) => ({
  userId: Number(scope.userId) || null,
  sucursalId: Number(scope.sucursalId) || null,
  cashSessionId: Number(scope.cashSessionId) || null,
  origin: String(scope.origin || '').trim().toUpperCase()
});

const isCompleteScope = (scope) => Boolean(scope.userId && scope.sucursalId && scope.cashSessionId && scope.origin);
const storageKey = (kind, scope) => `ventas_financial_operation_v1:${kind}:${opaqueHash(scope)}`;
const readRecord = (key, storage) => {
  try {
    const parsed = JSON.parse(storage?.getItem(key) || 'null');
    if (!parsed || parsed.schemaVersion !== 1 || !parsed.operationId || !parsed.idempotencyKey) return null;
    if (parsed.status === FINANCIAL_OPERATION_STATUS.SENDING && Number(parsed.leaseUntil || 0) <= Date.now()) {
      parsed.status = FINANCIAL_OPERATION_STATUS.UNKNOWN;
      parsed.revision = Number(parsed.revision || 0) + 1;
      parsed.leaseUntil = 0;
      storage?.setItem(key, JSON.stringify(parsed));
    }
    return parsed;
  } catch {
    return null;
  }
};

const writeRecord = (key, record, storage) => {
  try { storage?.setItem(key, JSON.stringify(record)); } catch { /* in-memory execution still protects this tab */ }
  return record;
};

const toSharedRecord = (record) => {
  const { payload: _payload, response: _response, ...technical } = record;
  return { ...technical, sharedMetadata: true };
};

const transition = (record, next, patch = {}) => {
  if (TERMINAL.has(record.status) || !TRANSITIONS[record.status]?.includes(next)) return record;
  return { ...record, ...patch, status: next, revision: Number(record.revision || 0) + 1, updatedAt: Date.now() };
};

const isAmbiguousError = (error) => {
  const status = Number(error?.status || 0);
  const code = String(error?.code || '').trim().toUpperCase();
  return status === 0 || [408, 425, 429, 500, 502, 503, 504].includes(status)
    || ['FETCH_ERROR', 'REQUEST_TIMEOUT', 'REQUEST_ALREADY_IN_PROGRESS', 'VENTA_EN_PROCESO', 'FINANCIAL_SUCCESS_RESPONSE_INVALID'].includes(code);
};

const invalidSuccessError = () => {
  const error = new Error('El servidor pudo completar la operacion, pero no devolvio un identificador verificable.');
  error.code = 'FINANCIAL_SUCCESS_RESPONSE_INVALID';
  error.status = 0;
  return error;
};

export const createFinancialOperationManager = ({
  storage = globalThis.sessionStorage,
  sharedStorage = globalThis.localStorage,
  now = () => Date.now()
} = {}) => {
  const persist = (key, record) => {
    writeRecord(key, record, storage);
    writeRecord(key, toSharedRecord(record), sharedStorage);
    return record;
  };
  const read = (key) => readRecord(key, storage) || readRecord(key, sharedStorage);
  const clear = (key) => {
    try { storage?.removeItem(key); } catch { /* terminal tombstone is safe */ }
    try { sharedStorage?.removeItem(key); } catch { /* terminal tombstone is safe */ }
  };
  return ({
  prepare({ kind, endpoint, payload, scope, successId }) {
    const normalizedScope = normalizeScope(scope);
    if (!isCompleteScope(normalizedScope)) {
      const error = new Error('Selecciona una sucursal y una sesion de caja activa antes de continuar.');
      error.code = 'FINANCIAL_OPERATION_SCOPE_INCOMPLETE';
      throw error;
    }
    const key = storageKey(kind, normalizedScope);
    const fingerprint = opaqueHash({ endpoint, payload });
    const existing = read(key);
    if (existing && [FINANCIAL_OPERATION_STATUS.SENDING, FINANCIAL_OPERATION_STATUS.UNKNOWN].includes(existing.status)) {
      if (existing.fingerprint !== fingerprint) {
        const error = new Error('Existe una operacion con resultado pendiente. Recuperala antes de editar o cobrar de nuevo.');
        error.code = 'FINANCIAL_OPERATION_BLOCKED';
        throw error;
      }
      return { key, record: existing };
    }
    const record = {
      schemaVersion: 1,
      operationId: createId(),
      idempotencyKey: createId(),
      kind,
      endpoint,
      fingerprint,
      scope: normalizedScope,
      payload: clone(payload),
      successId,
      status: FINANCIAL_OPERATION_STATUS.NEW,
      revision: 1,
      ownerId,
      leaseUntil: 0,
      createdAt: now(),
      updatedAt: now()
    };
    return { key, record: persist(key, record) };
  },

  async execute(config, request) {
    const prepared = this.prepare(config);
    if (inFlight.has(prepared.record.operationId)) return inFlight.get(prepared.record.operationId);
    const promise = (async () => {
      if (prepared.record.sharedMetadata && !prepared.record.payload) {
        if (typeof config.recover !== 'function') throw invalidSuccessError();
        const recovered = await config.recover(prepared.record.idempotencyKey, prepared.record.scope);
        if (String(recovered?.status || '').toUpperCase() === 'SUCCESS') {
          const recoveredResponse = recovered.response_body || recovered;
          if (!config.validateSuccess(recoveredResponse)) throw invalidSuccessError();
          clear(prepared.key);
          return recoveredResponse;
        }
        const error = new Error('La operacion sigue pendiente de confirmacion en el servidor.');
        error.code = 'FINANCIAL_OPERATION_RESULT_UNKNOWN';
        error.status = 0;
        throw error;
      }
      let record = transition(prepared.record, FINANCIAL_OPERATION_STATUS.SENDING, {
        ownerId,
        leaseUntil: now() + 15000
      });
      persist(prepared.key, record);
      try {
        const response = await request(clone(record.payload), record.idempotencyKey);
        const successValue = config.validateSuccess(response);
        if (!successValue) throw invalidSuccessError();
        record = transition(record, FINANCIAL_OPERATION_STATUS.CONFIRMED, {
          successValue,
          response: clone(response),
          leaseUntil: 0
        });
        persist(prepared.key, record);
        clear(prepared.key);
        return response;
      } catch (error) {
        record = transition(record, isAmbiguousError(error) ? FINANCIAL_OPERATION_STATUS.UNKNOWN : FINANCIAL_OPERATION_STATUS.REJECTED, {
          errorCode: String(error?.code || 'FINANCIAL_OPERATION_FAILED').slice(0, 80),
          leaseUntil: 0
        });
        persist(prepared.key, record);
        if (record.status === FINANCIAL_OPERATION_STATUS.UNKNOWN) error.code = error.code || 'FINANCIAL_OPERATION_RESULT_UNKNOWN';
        throw error;
      } finally {
        inFlight.delete(prepared.record.operationId);
      }
    })();
    inFlight.set(prepared.record.operationId, promise);
    return promise;
  },

  read({ kind, scope }) {
    const normalizedScope = normalizeScope(scope);
    return read(storageKey(kind, normalizedScope));
  },

  async recover({ kind, scope, validateSuccess }, requestResult) {
    const normalizedScope = normalizeScope(scope);
    const key = storageKey(kind, normalizedScope);
    const record = read(key);
    if (!record || ![FINANCIAL_OPERATION_STATUS.SENDING, FINANCIAL_OPERATION_STATUS.UNKNOWN].includes(record.status)) return null;
    const result = await requestResult(record.idempotencyKey, normalizedScope);
    if (String(result?.status || '').toUpperCase() !== 'SUCCESS') return result;
    const response = result.response_body || result;
    if (!validateSuccess(response)) throw invalidSuccessError();
    const sending = record.status === FINANCIAL_OPERATION_STATUS.UNKNOWN
      ? transition(record, FINANCIAL_OPERATION_STATUS.SENDING)
      : record;
    persist(key, transition(sending, FINANCIAL_OPERATION_STATUS.CONFIRMED, {
      successValue: validateSuccess(response),
      response: clone(response),
      leaseUntil: 0
    }));
    clear(key);
    return response;
  }
  });
};
