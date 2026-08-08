import { apiFetch } from './api';
import { API_URL } from '../utils/constants';
import { createFinancialOperationManager } from '../pages/dashboard/ventas/utils/financialOperationManager';
import { parsePositiveIntegerId } from '../pages/dashboard/ventas/utils/authenticatedUserScope';

const financialOperationManager = createFinancialOperationManager();

const buildQuery = (params = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (typeof value === 'string' && value.trim() === '') return;
    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

const buildVentasListQuery = (params = {}) => buildQuery({
  ...params,
  includeSummary: params.includeSummary === false ? 'false' : params.includeSummary,
  includePaginationTotals: params.includePaginationTotals === false
    ? 'false'
    : params.includePaginationTotals
});
const parseTimeoutMs = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const VENTAS_CREATE_TIMEOUT_MS = parseTimeoutMs(import.meta.env.VITE_VENTAS_CREATE_TIMEOUT_MS, 90000);
const VENTAS_CREATE_RECOVERY_TIMEOUT_MS = parseTimeoutMs(
  import.meta.env.VITE_VENTAS_CREATE_RECOVERY_TIMEOUT_MS,
  20000
);
const VENTAS_CREATE_RECOVERY_RETRIES = parseTimeoutMs(
  import.meta.env.VITE_VENTAS_CREATE_RECOVERY_RETRIES,
  3
);
const VENTAS_CREATE_RECOVERY_DELAY_MS = parseTimeoutMs(
  import.meta.env.VITE_VENTAS_CREATE_RECOVERY_DELAY_MS,
  1500
);
const CAJA_BOOTSTRAP_CACHE_TTL_MS = 5000;
const cajaBootstrapInFlight = new Map();
const cajaBootstrapCache = new Map();
const PEDIDO_PENDIENTE_LEGACY_STORAGE_KEY = 'ventas_pedido_pendiente_operation_v2';
const PEDIDO_PENDIENTE_RECOVERY_STORAGE_PREFIX = 'ventas_pedido_pendiente_recovery_v3:';
const PEDIDO_PENDIENTE_SHARED_STORAGE_PREFIX = 'ventas_pedido_pendiente_shared_v2:';
const PEDIDO_PENDIENTE_CHANNEL_NAME = 'ventas-pedido-pendiente-operations-v2';
const PEDIDO_PENDIENTE_SCHEMA_VERSION = 1;
const PEDIDO_PENDIENTE_LEASE_MS = 15000;
const PEDIDO_PENDIENTE_LEASE_RENEW_MS = 5000;
const PEDIDO_PENDIENTE_CONFIRMED_RETENTION_MS = 24 * 60 * 60 * 1000;
const PEDIDO_PENDIENTE_STORAGE_RESULT = Object.freeze({
  OK: 'OK',
  NOT_FOUND: 'NOT_FOUND',
  UNAVAILABLE: 'UNAVAILABLE',
  INVALID: 'INVALID'
});
const PEDIDO_PENDIENTE_OPERATION_STATUS = Object.freeze({
  NEW: 'NUEVA',
  SENDING: 'ENVIANDO',
  UNKNOWN: 'RESULTADO_DESCONOCIDO',
  CONFIRMED: 'CONFIRMADA',
  ABANDONED: 'ABANDONADA',
  REJECTED: 'RECHAZADA'
});
const pedidoPendienteInFlight = new Map();
const pedidoPendienteSharedMemory = new Map();
const pedidoPendienteSubscribers = new Set();
let pedidoPendienteOperationMemory = null;
let pedidoPendienteChannel = null;
let pedidoPendienteStorageState = {
  persistenceDegraded: false,
  invalidRecord: false,
  scopeMismatch: false,
  lastStatus: PEDIDO_PENDIENTE_STORAGE_RESULT.OK
};

const createIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `idem_${Date.now()}_${Math.random().toString(36).slice(2)}`;
};

const withIdempotencyKey = (config = {}, providedKey = null) => ({
  ...config,
  headers: {
    ...(config.headers || {}),
    'Idempotency-Key': String(providedKey || createIdempotencyKey()).trim()
  }
});

const delay = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const isVentaCreateTimeoutError = (error) =>
  Number(error?.status || 0) === 408 || String(error?.code || error?.data?.code || '').trim().toUpperCase() === 'REQUEST_TIMEOUT';

const isVentaCreateInProgressError = (error) =>
  Number(error?.status || 0) === 409 && String(error?.code || error?.data?.code || '').trim().toUpperCase() === 'REQUEST_ALREADY_IN_PROGRESS';

const stableStringify = (value) => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
};

const hashPedidoPendienteFingerprintValue = (value) => {
  const text = String(value || '');
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193) >>> 0;
    second = Math.imul(second ^ code, 0x85ebca6b) >>> 0;
  }
  return `fp1:${first.toString(16).padStart(8, '0')}${second.toString(16).padStart(8, '0')}`;
};

const safeStorageResult = (status, extra = {}) => ({ status, ...extra });

const getBrowserStorage = (storageName) => {
  if (typeof window === 'undefined') return null;
  try {
    const storage = window?.[storageName];
    if (!storage || typeof storage.getItem !== 'function') return null;
    return storage;
  } catch {
    return null;
  }
};

const safeGetStoredValue = (storageName, key) => {
  const storage = getBrowserStorage(storageName);
  if (!storage) return safeStorageResult(PEDIDO_PENDIENTE_STORAGE_RESULT.UNAVAILABLE);
  try {
    const value = storage.getItem(key);
    return value === null
      ? safeStorageResult(PEDIDO_PENDIENTE_STORAGE_RESULT.NOT_FOUND)
      : safeStorageResult(PEDIDO_PENDIENTE_STORAGE_RESULT.OK, { value });
  } catch (error) {
    return safeStorageResult(PEDIDO_PENDIENTE_STORAGE_RESULT.UNAVAILABLE, { errorName: String(error?.name || '') });
  }
};

const safeSaveStoredValue = (storageName, key, value) => {
  const storage = getBrowserStorage(storageName);
  if (!storage) return safeStorageResult(PEDIDO_PENDIENTE_STORAGE_RESULT.UNAVAILABLE);
  try {
    storage.setItem(key, value);
    return safeStorageResult(PEDIDO_PENDIENTE_STORAGE_RESULT.OK);
  } catch (error) {
    return safeStorageResult(PEDIDO_PENDIENTE_STORAGE_RESULT.UNAVAILABLE, { errorName: String(error?.name || '') });
  }
};

const safeRemoveStoredValue = (storageName, key) => {
  const storage = getBrowserStorage(storageName);
  if (!storage) return safeStorageResult(PEDIDO_PENDIENTE_STORAGE_RESULT.UNAVAILABLE);
  try {
    storage.removeItem(key);
    return safeStorageResult(PEDIDO_PENDIENTE_STORAGE_RESULT.OK);
  } catch (error) {
    return safeStorageResult(PEDIDO_PENDIENTE_STORAGE_RESULT.UNAVAILABLE, { errorName: String(error?.name || '') });
  }
};

const safeListStoredValues = (storageName, prefix) => {
  const storage = getBrowserStorage(storageName);
  if (!storage) return safeStorageResult(PEDIDO_PENDIENTE_STORAGE_RESULT.UNAVAILABLE, { entries: [] });
  try {
    const entries = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key?.startsWith(prefix)) continue;
      const value = storage.getItem(key);
      if (value !== null) entries.push({ key, value });
    }
    return safeStorageResult(PEDIDO_PENDIENTE_STORAGE_RESULT.OK, { entries });
  } catch (error) {
    return safeStorageResult(PEDIDO_PENDIENTE_STORAGE_RESULT.UNAVAILABLE, {
      entries: [],
      errorName: String(error?.name || '')
    });
  }
};

const safeParseJson = (rawValue) => {
  if (typeof rawValue !== 'string' || !rawValue.trim()) {
    return safeStorageResult(PEDIDO_PENDIENTE_STORAGE_RESULT.INVALID);
  }
  try {
    return safeStorageResult(PEDIDO_PENDIENTE_STORAGE_RESULT.OK, { value: JSON.parse(rawValue) });
  } catch {
    return safeStorageResult(PEDIDO_PENDIENTE_STORAGE_RESULT.INVALID);
  }
};

const markPedidoPendienteStorageState = (patch) => {
  pedidoPendienteStorageState = { ...pedidoPendienteStorageState, ...patch };
};

const getPedidoPendienteStorageState = () => ({ ...pedidoPendienteStorageState });

const resetPedidoPendienteStorageInspection = () => {
  pedidoPendienteStorageState = {
    persistenceDegraded: false,
    invalidRecord: false,
    scopeMismatch: false,
    lastStatus: PEDIDO_PENDIENTE_STORAGE_RESULT.OK
  };
};

const createPedidoPendienteOperationId = () => `pedido-pendiente:${createIdempotencyKey()}`;

const clonePedidoPendienteValue = (value) => JSON.parse(JSON.stringify(value ?? null));

const pickAllowedFields = (source, allowedKeys) => {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
  return Object.fromEntries(allowedKeys
    .filter((key) => Object.prototype.hasOwnProperty.call(source, key))
    .map((key) => [key, clonePedidoPendienteValue(source[key])]));
};

const serializePedidoPendienteRecoveryPayload = (payload) => {
  const topLevel = pickAllowedFields(payload, [
    'id_cliente',
    'id_sucursal',
    'id_sesion_caja',
    'id_descuento_catalogo',
    'items',
    'contacto',
    'contexto',
    'pago_pendiente',
    'delivery',
    'cuenta_dividida'
  ]) || {};
  topLevel.items = (Array.isArray(payload?.items) ? payload.items : []).map((item) => {
    const serialized = pickAllowedFields(item, [
      'cart_key',
      'line_id',
      'id_producto',
      'id_receta',
      'id_extra',
      'cantidad',
      'id_descuento_catalogo',
      'observacion',
      'entregar_con_pedido',
      'complementos_incompletos_autorizados',
      'complementos',
      'extras'
    ]) || {};
    if (Array.isArray(item?.complementos)) {
      serialized.complementos = item.complementos.map((entry) => pickAllowedFields(entry, ['id_complemento']) || {});
    }
    if (Array.isArray(item?.extras)) {
      serialized.extras = item.extras.map((entry) => pickAllowedFields(entry, ['id_extra', 'cantidad']) || {});
    }
    return serialized;
  });
  if (payload?.contacto !== undefined) {
    topLevel.contacto = pickAllowedFields(payload.contacto, [
      'nombre_contacto', 'telefono_contacto', 'dni', 'rtn', 'correo'
    ]);
  }
  if (payload?.contexto !== undefined) {
    topLevel.contexto = pickAllowedFields(payload.contexto, ['canal', 'modalidad', 'observacion_contexto']);
  }
  if (payload?.pago_pendiente !== undefined) {
    topLevel.pago_pendiente = pickAllowedFields(payload.pago_pendiente, ['motivo', 'observacion_pago']);
  }
  if (payload?.delivery !== undefined) {
    topLevel.delivery = payload.delivery === null ? null : pickAllowedFields(payload.delivery, [
      'costo_envio',
      'nombre_receptor',
      'telefono_receptor',
      'direccion_entrega',
      'referencia_entrega',
      'observacion_delivery'
    ]);
  }
  return clonePedidoPendienteValue(topLevel);
};

const normalizePedidoPendienteOperationScope = (scope = null) => {
  if (scope && typeof scope === 'object' && !Array.isArray(scope)) {
    const userId = parsePositiveIntegerId(scope.userId ?? scope.id_usuario);
    const sucursalId = parsePositiveIntegerId(scope.sucursalId ?? scope.id_sucursal);
    const cashSessionId = parsePositiveIntegerId(scope.cashSessionId ?? scope.id_sesion_caja);
    return {
      userId: userId ? String(userId) : '',
      sucursalId: sucursalId ? String(sucursalId) : '',
      cashSessionId: cashSessionId ? String(cashSessionId) : '',
      origin: String(scope.origin ?? scope.origen ?? 'SMARTORDER_POS').trim().toUpperCase()
    };
  }
  const userId = parsePositiveIntegerId(scope);
  return {
    userId: userId ? String(userId) : '',
    sucursalId: '',
    cashSessionId: '',
    origin: 'SMARTORDER_POS'
  };
};

const isCompletePedidoPendienteScope = (scope) => {
  const normalized = normalizePedidoPendienteOperationScope(scope);
  return Boolean(normalized.userId && normalized.sucursalId && normalized.cashSessionId && normalized.origin);
};

const buildPedidoPendienteScopeKey = (scope) => stableStringify(normalizePedidoPendienteOperationScope(scope));

const isSamePedidoPendienteScope = (left, right) => (
  isCompletePedidoPendienteScope(left)
  && isCompletePedidoPendienteScope(right)
  && buildPedidoPendienteScopeKey(left) === buildPedidoPendienteScopeKey(right)
);

const buildPedidoPendienteFingerprint = (payload, operationScope = null) => hashPedidoPendienteFingerprintValue(
  stableStringify({
    scope: normalizePedidoPendienteOperationScope(operationScope),
    payload: serializePedidoPendienteRecoveryPayload(payload)
  })
);

const createPedidoPendienteTabId = () => `tab:${createIdempotencyKey()}`;
const pedidoPendienteTabId = createPedidoPendienteTabId();

const validateStoredPedidoPendienteOperation = (rawRecord, { coordination = false } = {}) => {
  if (!rawRecord || typeof rawRecord !== 'object' || Array.isArray(rawRecord)) return false;
  if (rawRecord.schemaVersion !== PEDIDO_PENDIENTE_SCHEMA_VERSION) return false;
  const operationId = String(rawRecord?.operationId || '').trim();
  const fingerprint = String(rawRecord?.fingerprint || '');
  const idempotencyKey = String(rawRecord?.idempotencyKey || '').trim();
  const status = String(rawRecord?.status || '').trim().toUpperCase();
  const createdAt = Number(rawRecord?.createdAt);
  const updatedAt = Number(rawRecord?.updatedAt);
  const scope = normalizePedidoPendienteOperationScope(rawRecord.scope);
  const ownerId = String(rawRecord?.owner?.ownerId || '').trim();
  const leaseUntil = Number(rawRecord?.lease?.until);
  if (
    !operationId
    || !fingerprint
    || !idempotencyKey
    || idempotencyKey.length > 200
    || !Object.values(PEDIDO_PENDIENTE_OPERATION_STATUS).includes(status)
    || !Number.isFinite(createdAt)
    || !Number.isFinite(updatedAt)
    || !isCompletePedidoPendienteScope(scope)
    || !ownerId
    || !Number.isFinite(leaseUntil)
    || typeof rawRecord?.lease?.token !== 'string'
  ) return false;
  if (!coordination) {
    if (rawRecord.recordKind !== 'recovery') return false;
    if (!rawRecord.payload || typeof rawRecord.payload !== 'object' || !Array.isArray(rawRecord.payload.items)) return false;
  } else if (rawRecord.recordKind !== 'coordination' || Object.prototype.hasOwnProperty.call(rawRecord, 'payload')) {
    return false;
  }
  return true;
};

const normalizePedidoPendienteOperation = (rawRecord, { coordination = false } = {}) => {
  if (!validateStoredPedidoPendienteOperation(rawRecord, { coordination })) return null;
  const operationScope = normalizePedidoPendienteOperationScope(rawRecord.scope);
  const normalized = {
    schemaVersion: rawRecord.schemaVersion,
    operationId: String(rawRecord.operationId).trim(),
    fingerprint: String(rawRecord.fingerprint),
    idempotencyKey: String(rawRecord.idempotencyKey).trim(),
    status: String(rawRecord.status).trim().toUpperCase(),
    operationScope,
    scopeKey: buildPedidoPendienteScopeKey(operationScope),
    payload: coordination ? null : clonePedidoPendienteValue(rawRecord.payload),
    ownerTabId: String(rawRecord.owner.ownerId).trim(),
    leaseToken: String(rawRecord.lease.token),
    leaseExpiresAt: Number(rawRecord.lease.until),
    hasBeenSent: Boolean(rawRecord.hasBeenSent),
    createdAt: Number(rawRecord.createdAt),
    updatedAt: Number(rawRecord.updatedAt),
    confirmedPedidoId: Number(rawRecord.confirmedPedidoId || 0) || null,
    confirmedAt: Number(rawRecord.confirmedAt || 0) || null,
    lastErrorCode: String(rawRecord.lastErrorCode || ''),
    hasRecoveryPayload: !coordination
  };
  if (
    (
      normalized.status === PEDIDO_PENDIENTE_OPERATION_STATUS.SENDING
      || normalized.status === PEDIDO_PENDIENTE_OPERATION_STATUS.UNKNOWN
    )
    && normalized.leaseExpiresAt > 0
    && normalized.leaseExpiresAt <= Date.now()
  ) {
    // Sin esto, un registro que ya paso de SENDING a UNKNOWN nunca recalculaba
    // leaseExpired en lecturas posteriores (refresh, poll entre pestañas), por lo
    // que quedaba bloqueado indefinidamente aunque el lease llevara minutos vencido.
    return {
      ...normalized,
      status: PEDIDO_PENDIENTE_OPERATION_STATUS.UNKNOWN,
      leaseExpired: true
    };
  }
  return normalized;
};

const serializePedidoPendienteOperation = (record, { coordination = false } = {}) => {
  const operationScope = normalizePedidoPendienteOperationScope(record?.operationScope ?? record?.scope);
  const serialized = {
    schemaVersion: PEDIDO_PENDIENTE_SCHEMA_VERSION,
    recordKind: coordination ? 'coordination' : 'recovery',
    operationId: String(record?.operationId || '').trim(),
    idempotencyKey: String(record?.idempotencyKey || '').trim(),
    fingerprint: String(record?.fingerprint || ''),
    status: String(record?.status || '').trim().toUpperCase(),
    createdAt: Number(record?.createdAt),
    updatedAt: Number(record?.updatedAt),
    scope: operationScope,
    owner: { ownerId: String(record?.ownerTabId || '').trim() },
    lease: {
      token: String(record?.leaseToken || ''),
      until: Number(record?.leaseExpiresAt || 0)
    },
    hasBeenSent: Boolean(record?.hasBeenSent),
    confirmedPedidoId: Number(record?.confirmedPedidoId || 0) || null,
    confirmedAt: Number(record?.confirmedAt || 0) || null,
    lastErrorCode: String(record?.lastErrorCode || '')
  };
  if (!coordination) serialized.payload = serializePedidoPendienteRecoveryPayload(record?.payload);
  return serialized;
};

const parseStoredPedidoPendienteOperation = (rawValue, options = {}) => {
  const parsed = safeParseJson(rawValue);
  if (parsed.status !== PEDIDO_PENDIENTE_STORAGE_RESULT.OK) return parsed;
  const operation = normalizePedidoPendienteOperation(parsed.value, options);
  return operation
    ? safeStorageResult(PEDIDO_PENDIENTE_STORAGE_RESULT.OK, { operation })
    : safeStorageResult(PEDIDO_PENDIENTE_STORAGE_RESULT.INVALID);
};

const buildPedidoPendienteSharedStorageKey = (scopeKey, operationId) => (
  `${PEDIDO_PENDIENTE_SHARED_STORAGE_PREFIX}${encodeURIComponent(scopeKey)}:${encodeURIComponent(operationId)}`
);

const buildPedidoPendienteRecoveryStorageKey = (scopeKey, operationId) => (
  `${PEDIDO_PENDIENTE_RECOVERY_STORAGE_PREFIX}${encodeURIComponent(scopeKey)}:${encodeURIComponent(operationId)}`
);

const getPedidoPendienteChannel = () => {
  if (pedidoPendienteChannel || typeof window === 'undefined' || typeof window.BroadcastChannel !== 'function') {
    return pedidoPendienteChannel;
  }
  pedidoPendienteChannel = new window.BroadcastChannel(PEDIDO_PENDIENTE_CHANNEL_NAME);
  pedidoPendienteChannel.addEventListener('message', (event) => {
    const message = event?.data;
    if (!message || typeof message !== 'object' || Object.prototype.hasOwnProperty.call(message, 'payload')) return;
    for (const subscriber of pedidoPendienteSubscribers) subscriber.notify(message);
  });
  return pedidoPendienteChannel;
};

const cleanupConfirmedPedidoPendienteOperation = (operation) => {
  const recoveryKey = buildPedidoPendienteRecoveryStorageKey(operation.scopeKey, operation.operationId);
  const sharedKey = buildPedidoPendienteSharedStorageKey(operation.scopeKey, operation.operationId);
  const sessionRemoval = safeRemoveStoredValue('sessionStorage', recoveryKey);
  const sharedRemoval = safeRemoveStoredValue('localStorage', sharedKey);
  if (
    sessionRemoval.status === PEDIDO_PENDIENTE_STORAGE_RESULT.UNAVAILABLE
    || sharedRemoval.status === PEDIDO_PENDIENTE_STORAGE_RESULT.UNAVAILABLE
  ) markPedidoPendienteStorageState({ persistenceDegraded: true, lastStatus: PEDIDO_PENDIENTE_STORAGE_RESULT.UNAVAILABLE });
};

const readPedidoPendienteOperation = (operationScope = null) => {
  const normalizedScope = operationScope ? normalizePedidoPendienteOperationScope(operationScope) : null;
  const memory = pedidoPendienteOperationMemory;
  if (memory && normalizedScope && !isSamePedidoPendienteScope(memory.operationScope, normalizedScope)) {
    markPedidoPendienteStorageState({ scopeMismatch: true });
  }
  if (memory && (!normalizedScope || isSamePedidoPendienteScope(memory.operationScope, normalizedScope))) {
    if (memory.status === PEDIDO_PENDIENTE_OPERATION_STATUS.CONFIRMED) {
      cleanupConfirmedPedidoPendienteOperation(memory);
      pedidoPendienteOperationMemory = null;
      return null;
    }
    return { ...memory, persistenceDegraded: pedidoPendienteStorageState.persistenceDegraded };
  }
  const scopePrefix = normalizedScope
    ? `${PEDIDO_PENDIENTE_RECOVERY_STORAGE_PREFIX}${encodeURIComponent(buildPedidoPendienteScopeKey(normalizedScope))}:`
    : PEDIDO_PENDIENTE_RECOVERY_STORAGE_PREFIX;
  if (normalizedScope) {
    const allRecoveryEntries = safeListStoredValues('sessionStorage', PEDIDO_PENDIENTE_RECOVERY_STORAGE_PREFIX);
    if (allRecoveryEntries.status === PEDIDO_PENDIENTE_STORAGE_RESULT.OK) {
      if (allRecoveryEntries.entries.some(({ key }) => !key.startsWith(scopePrefix))) {
        markPedidoPendienteStorageState({ scopeMismatch: true });
      }
    } else if (allRecoveryEntries.status === PEDIDO_PENDIENTE_STORAGE_RESULT.UNAVAILABLE) {
      markPedidoPendienteStorageState({ persistenceDegraded: true, lastStatus: allRecoveryEntries.status });
    }
  }
  const listed = safeListStoredValues('sessionStorage', scopePrefix);
  if (listed.status === PEDIDO_PENDIENTE_STORAGE_RESULT.UNAVAILABLE) {
    markPedidoPendienteStorageState({ persistenceDegraded: true, lastStatus: listed.status });
    return null;
  }
  const legacy = safeGetStoredValue('sessionStorage', PEDIDO_PENDIENTE_LEGACY_STORAGE_KEY);
  if (legacy.status === PEDIDO_PENDIENTE_STORAGE_RESULT.OK) {
    markPedidoPendienteStorageState({ invalidRecord: true, lastStatus: PEDIDO_PENDIENTE_STORAGE_RESULT.INVALID });
  } else if (legacy.status === PEDIDO_PENDIENTE_STORAGE_RESULT.UNAVAILABLE) {
    markPedidoPendienteStorageState({ persistenceDegraded: true, lastStatus: legacy.status });
  }
  const valid = [];
  for (const entry of listed.entries) {
    const parsed = parseStoredPedidoPendienteOperation(entry.value);
    if (parsed.status !== PEDIDO_PENDIENTE_STORAGE_RESULT.OK) {
      markPedidoPendienteStorageState({ invalidRecord: true, lastStatus: parsed.status });
      continue;
    }
    if (normalizedScope && !isSamePedidoPendienteScope(parsed.operation.operationScope, normalizedScope)) {
      markPedidoPendienteStorageState({ scopeMismatch: true });
      continue;
    }
    if (parsed.operation.status === PEDIDO_PENDIENTE_OPERATION_STATUS.CONFIRMED) {
      cleanupConfirmedPedidoPendienteOperation(parsed.operation);
      continue;
    }
    valid.push(parsed.operation);
  }
  const selected = valid.sort((left, right) => right.updatedAt - left.updatedAt)[0] || null;
  if (selected) pedidoPendienteOperationMemory = selected;
  return selected ? { ...selected, persistenceDegraded: pedidoPendienteStorageState.persistenceDegraded } : null;
};

const listSharedPedidoPendienteOperations = (operationScope = null) => {
  const scopeKey = buildPedidoPendienteScopeKey(operationScope);
  const storagePrefix = `${PEDIDO_PENDIENTE_SHARED_STORAGE_PREFIX}${encodeURIComponent(scopeKey)}:`;
  const records = new Map();
  for (const [key, value] of pedidoPendienteSharedMemory.entries()) {
    if (!key.startsWith(storagePrefix)) continue;
    const normalized = normalizePedidoPendienteOperation(
      serializePedidoPendienteOperation(value, { coordination: true }),
      { coordination: true }
    );
    if (normalized) records.set(normalized.operationId, normalized);
  }
  const listed = safeListStoredValues('localStorage', storagePrefix);
  if (listed.status === PEDIDO_PENDIENTE_STORAGE_RESULT.UNAVAILABLE) {
    markPedidoPendienteStorageState({ persistenceDegraded: true, lastStatus: listed.status });
  } else {
    for (const entry of listed.entries) {
      const parsed = parseStoredPedidoPendienteOperation(entry.value, { coordination: true });
      if (parsed.status !== PEDIDO_PENDIENTE_STORAGE_RESULT.OK) {
        markPedidoPendienteStorageState({ invalidRecord: true, lastStatus: parsed.status });
        continue;
      }
      if (parsed.operation.status === PEDIDO_PENDIENTE_OPERATION_STATUS.CONFIRMED) {
        const confirmedAge = Date.now() - Number(parsed.operation.confirmedAt || parsed.operation.updatedAt);
        if (confirmedAge >= 0 && confirmedAge <= PEDIDO_PENDIENTE_CONFIRMED_RETENTION_MS) {
          safeRemoveStoredValue('localStorage', entry.key);
        } else if (confirmedAge > PEDIDO_PENDIENTE_CONFIRMED_RETENTION_MS) {
          safeRemoveStoredValue('localStorage', entry.key);
        }
        continue;
      }
      records.set(parsed.operation.operationId, parsed.operation);
    }
  }
  return [...records.values()].filter((record) => (
    record.status === PEDIDO_PENDIENTE_OPERATION_STATUS.SENDING
    || record.status === PEDIDO_PENDIENTE_OPERATION_STATUS.UNKNOWN
  ));
};

const notifyPedidoPendienteSubscribers = (event = null) => {
  for (const subscriber of pedidoPendienteSubscribers) subscriber.notify(event);
};

const publishPedidoPendienteOperation = (record) => {
  const serialized = serializePedidoPendienteOperation(record, { coordination: true });
  const normalized = normalizePedidoPendienteOperation(serialized, { coordination: true });
  if (!normalized) return;
  const key = buildPedidoPendienteSharedStorageKey(normalized.scopeKey, normalized.operationId);
  pedidoPendienteSharedMemory.set(key, normalized);
  const saved = safeSaveStoredValue('localStorage', key, JSON.stringify(serialized));
  if (saved.status !== PEDIDO_PENDIENTE_STORAGE_RESULT.OK) {
    markPedidoPendienteStorageState({ persistenceDegraded: true, lastStatus: saved.status });
  }
  getPedidoPendienteChannel()?.postMessage({
    type: 'operation-updated',
    operationId: normalized.operationId,
    status: normalized.status,
    scopeKey: normalized.scopeKey,
    ownerId: normalized.ownerTabId,
    leaseUntil: normalized.leaseExpiresAt,
    updatedAt: normalized.updatedAt
  });
  notifyPedidoPendienteSubscribers();
  return saved;
};

const removeSharedPedidoPendienteOperation = (record) => {
  const normalized = normalizePedidoPendienteOperation(serializePedidoPendienteOperation(record));
  if (!normalized) return;
  const key = buildPedidoPendienteSharedStorageKey(normalized.scopeKey, normalized.operationId);
  pedidoPendienteSharedMemory.delete(key);
  const removed = safeRemoveStoredValue('localStorage', key);
  if (removed.status !== PEDIDO_PENDIENTE_STORAGE_RESULT.OK) {
    markPedidoPendienteStorageState({ persistenceDegraded: true, lastStatus: removed.status });
  }
  const releaseEvent = {
    type: 'operation-released',
    operationId: normalized.operationId,
    status: normalized.status,
    confirmedPedidoId: normalized.confirmedPedidoId || null
  };
  getPedidoPendienteChannel()?.postMessage(releaseEvent);
  notifyPedidoPendienteSubscribers(releaseEvent);
};

const writePedidoPendienteOperation = (record, { publish = false } = {}) => {
  const serialized = serializePedidoPendienteOperation(record);
  const normalized = normalizePedidoPendienteOperation(serialized);
  if (!normalized) return null;
  pedidoPendienteOperationMemory = normalized;
  const key = buildPedidoPendienteRecoveryStorageKey(normalized.scopeKey, normalized.operationId);
  const saved = safeSaveStoredValue('sessionStorage', key, JSON.stringify(serialized));
  if (saved.status !== PEDIDO_PENDIENTE_STORAGE_RESULT.OK) {
    markPedidoPendienteStorageState({ persistenceDegraded: true, lastStatus: saved.status });
  }
  const published = publish ? publishPedidoPendienteOperation(normalized) : null;
  const persistenceDegraded = pedidoPendienteStorageState.persistenceDegraded
    || saved.status !== PEDIDO_PENDIENTE_STORAGE_RESULT.OK
    || (publish && published?.status !== PEDIDO_PENDIENTE_STORAGE_RESULT.OK);
  const result = { ...normalized, persistenceDegraded };
  pedidoPendienteOperationMemory = result;
  return result;
};

const clearPedidoPendienteOperation = (record) => {
  const normalized = normalizePedidoPendienteOperation(serializePedidoPendienteOperation(record));
  if (!normalized) return false;
  const stored = readPedidoPendienteOperation();
  if (stored?.operationId === normalized.operationId) {
    pedidoPendienteOperationMemory = null;
    const recoveryKey = buildPedidoPendienteRecoveryStorageKey(normalized.scopeKey, normalized.operationId);
    const removed = safeRemoveStoredValue('sessionStorage', recoveryKey);
    if (removed.status !== PEDIDO_PENDIENTE_STORAGE_RESULT.OK) {
      markPedidoPendienteStorageState({ persistenceDegraded: true, lastStatus: removed.status });
    }
  }
  removeSharedPedidoPendienteOperation(normalized);
  return true;
};

const findSharedPedidoPendienteOperation = (operationId, operationScope) => (
  listSharedPedidoPendienteOperations(operationScope)
    .find((record) => record.operationId === String(operationId || '').trim()) || null
);

const isPedidoPendienteOperationLocked = (record) => (
  record?.status === PEDIDO_PENDIENTE_OPERATION_STATUS.SENDING
  || record?.status === PEDIDO_PENDIENTE_OPERATION_STATUS.UNKNOWN
);

const createPedidoPendienteOperationLockedError = (record) => {
  const error = new Error(
    'No fue posible confirmar el resultado del pedido. El servidor podria haberlo registrado. Recupera el resultado antes de crear otro pedido.'
  );
  error.status = 409;
  error.code = 'PEDIDO_PENDIENTE_RESULTADO_DESCONOCIDO';
  error.operation = record;
  return error;
};

const createPedidoPendienteStorageError = (code, message) => {
  const error = new Error(message);
  error.status = 409;
  error.code = code;
  return error;
};

const buildPedidoPendienteSafeLogContext = (record) => ({
  operationId: String(record?.operationId || '').trim() || null,
  status: String(record?.status || '').trim().toUpperCase() || null
});

const resetPedidoPendienteOperationRuntimeForTests = () => {
  pedidoPendienteOperationMemory = null;
  pedidoPendienteInFlight.clear();
  pedidoPendienteSharedMemory.clear();
  resetPedidoPendienteStorageInspection();
};

const getPedidoPendienteOperationContext = (operationScope) => {
  resetPedidoPendienteStorageInspection();
  const normalizedScope = normalizePedidoPendienteOperationScope(operationScope);
  const operation = isCompletePedidoPendienteScope(normalizedScope)
    ? readPedidoPendienteOperation(normalizedScope)
    : null;
  if (isCompletePedidoPendienteScope(normalizedScope)) {
    const expectedPrefix = `${PEDIDO_PENDIENTE_SHARED_STORAGE_PREFIX}${encodeURIComponent(buildPedidoPendienteScopeKey(normalizedScope))}:`;
    const allSharedEntries = safeListStoredValues('localStorage', PEDIDO_PENDIENTE_SHARED_STORAGE_PREFIX);
    if (
      allSharedEntries.status === PEDIDO_PENDIENTE_STORAGE_RESULT.OK
      && allSharedEntries.entries.some(({ key }) => !key.startsWith(expectedPrefix))
    ) markPedidoPendienteStorageState({ scopeMismatch: true });
  }
  listSharedPedidoPendienteOperations(normalizedScope);
  return {
    operation,
    ...getPedidoPendienteStorageState()
  };
};

const preparePedidoPendienteOperation = (payload, {
  operationId = null,
  operationScope = null
} = {}) => {
  resetPedidoPendienteStorageInspection();
  const normalizedScope = normalizePedidoPendienteOperationScope(operationScope);
  if (!isCompletePedidoPendienteScope(normalizedScope)) {
    throw createPedidoPendienteStorageError(
      'PEDIDO_PENDIENTE_SCOPE_INVALIDO',
      'No se puede proteger la operación porque el usuario, la sucursal o la sesión de caja no están completos.'
    );
  }
  if (
    isPedidoPendienteOperationLocked(pedidoPendienteOperationMemory)
    && !isSamePedidoPendienteScope(pedidoPendienteOperationMemory.operationScope, normalizedScope)
  ) {
    throw createPedidoPendienteStorageError(
      'PEDIDO_PENDIENTE_SCOPE_NO_COINCIDE',
      'Existe una operación pendiente perteneciente a otra sesión o sucursal. No puede sustituirse desde el contexto actual.'
    );
  }
  const scopeKey = buildPedidoPendienteScopeKey(normalizedScope);
  const recoveryPayload = serializePedidoPendienteRecoveryPayload(payload);
  if (!Array.isArray(recoveryPayload.items) || recoveryPayload.items.length === 0) {
    throw createPedidoPendienteStorageError(
      'PEDIDO_PENDIENTE_PAYLOAD_INVALIDO',
      'El pedido no contiene un payload recuperable válido.'
    );
  }
  const fingerprint = buildPedidoPendienteFingerprint(recoveryPayload, normalizedScope);
  const requestedOperationId = String(operationId || '').trim();
  const sessionRecord = readPedidoPendienteOperation(normalizedScope);
  listSharedPedidoPendienteOperations(normalizedScope);
  if (pedidoPendienteStorageState.invalidRecord && !sessionRecord && !requestedOperationId) {
    throw createPedidoPendienteStorageError(
      'PEDIDO_PENDIENTE_REGISTRO_INVALIDO',
      'Se encontró una recuperación de pedido dañada o incompatible. Revisa los pedidos recientes antes de iniciar otro.'
    );
  }
  if (
    isPedidoPendienteOperationLocked(sessionRecord)
    && (
      sessionRecord.scopeKey !== scopeKey
      || (requestedOperationId && requestedOperationId !== sessionRecord.operationId)
    )
  ) {
    throw createPedidoPendienteOperationLockedError(sessionRecord);
  }
  let nextOperationId = requestedOperationId;
  let stored = requestedOperationId
    ? (sessionRecord?.operationId === requestedOperationId
        ? sessionRecord
        : null)
    : sessionRecord;
  if (stored && stored.scopeKey !== scopeKey) stored = null;

  if (stored) {
    if (
      stored.fingerprint === fingerprint
      && stored.status !== PEDIDO_PENDIENTE_OPERATION_STATUS.REJECTED
    ) {
      return writePedidoPendienteOperation(stored, { publish: isPedidoPendienteOperationLocked(stored) });
    }
    if (isPedidoPendienteOperationLocked(stored)) {
      throw createPedidoPendienteOperationLockedError(stored);
    }
    nextOperationId = stored.status === PEDIDO_PENDIENTE_OPERATION_STATUS.NEW && !stored.hasBeenSent
      ? stored.operationId
      : createPedidoPendienteOperationId();
    clearPedidoPendienteOperation(stored);
  } else if (requestedOperationId) {
    // El caller referenciaba una operacion que ya no existe (por ejemplo, fue
    // limpiada de inmediato tras un rechazo definitivo). No reutilizar esa
    // identidad vieja: cada intento realmente nuevo obtiene su propio operationId.
    nextOperationId = null;
  }

  const now = Date.now();
  return writePedidoPendienteOperation({
    operationId: nextOperationId || createPedidoPendienteOperationId(),
    fingerprint,
    idempotencyKey: createIdempotencyKey(),
    payload: recoveryPayload,
    operationScope: normalizedScope,
    scopeKey,
    status: PEDIDO_PENDIENTE_OPERATION_STATUS.NEW,
    ownerTabId: pedidoPendienteTabId,
    leaseToken: '',
    leaseExpiresAt: 0,
    hasBeenSent: false,
    createdAt: now,
    updatedAt: now
  });
};

const transitionPedidoPendienteOperation = (record, status, extra = {}) => writePedidoPendienteOperation({
  ...record,
  ...extra,
  status,
  updatedAt: Date.now()
}, {
  publish: status === PEDIDO_PENDIENTE_OPERATION_STATUS.SENDING
    || status === PEDIDO_PENDIENTE_OPERATION_STATUS.UNKNOWN
    || status === PEDIDO_PENDIENTE_OPERATION_STATUS.CONFIRMED
    || status === PEDIDO_PENDIENTE_OPERATION_STATUS.ABANDONED
});

const readSharedPedidoPendienteOperation = (record) => {
  const key = buildPedidoPendienteSharedStorageKey(record.scopeKey, record.operationId);
  const stored = safeGetStoredValue('localStorage', key);
  if (stored.status !== PEDIDO_PENDIENTE_STORAGE_RESULT.OK) return { result: stored, operation: null };
  const parsed = parseStoredPedidoPendienteOperation(stored.value, { coordination: true });
  return { result: parsed, operation: parsed.operation || null };
};

const acquirePedidoPendienteOperationLease = (record) => {
  if (!record?.operationId || !isCompletePedidoPendienteScope(record.operationScope)) {
    return { acquired: false, reason: 'INVALID_OPERATION', operation: record || null };
  }
  const now = Date.now();
  const currentRead = readSharedPedidoPendienteOperation(record);
  if (currentRead.result.status === PEDIDO_PENDIENTE_STORAGE_RESULT.UNAVAILABLE) {
    markPedidoPendienteStorageState({ persistenceDegraded: true, lastStatus: currentRead.result.status });
    const memoryOwned = {
      ...record,
      ownerTabId: pedidoPendienteTabId,
      leaseToken: createIdempotencyKey(),
      leaseExpiresAt: now + PEDIDO_PENDIENTE_LEASE_MS
    };
    return { acquired: true, degraded: true, operation: writePedidoPendienteOperation(memoryOwned) };
  }
  const current = currentRead.operation;
  if (
    current
    && !isSamePedidoPendienteScope(current.operationScope, record.operationScope)
  ) return { acquired: false, reason: 'SCOPE_MISMATCH', operation: current };
  if (
    current
    && current.leaseExpiresAt > now
    && current.ownerTabId !== pedidoPendienteTabId
  ) return { acquired: false, reason: 'LEASE_OWNED', operation: current };

  const leaseToken = createIdempotencyKey();
  const leaseExpiresAt = now + PEDIDO_PENDIENTE_LEASE_MS;
  const candidate = {
    ...record,
    ownerTabId: pedidoPendienteTabId,
    leaseToken,
    leaseExpiresAt,
    updatedAt: now
  };
  const persisted = publishPedidoPendienteOperation(candidate);
  if (persisted?.status !== PEDIDO_PENDIENTE_STORAGE_RESULT.OK) {
    return {
      acquired: true,
      degraded: true,
      operation: writePedidoPendienteOperation(candidate)
    };
  }
  const verified = readSharedPedidoPendienteOperation(candidate).operation;
  if (
    !verified
    || verified.ownerTabId !== pedidoPendienteTabId
    || verified.leaseToken !== leaseToken
    || verified.leaseExpiresAt !== leaseExpiresAt
    || verified.leaseExpiresAt <= Date.now()
  ) return { acquired: false, reason: 'LEASE_RACE_LOST', operation: verified || current || record };
  return { acquired: true, operation: writePedidoPendienteOperation(candidate) };
};

const renewPedidoPendienteOperationLease = (record) => {
  if (!record?.leaseToken || record.ownerTabId !== pedidoPendienteTabId) return null;
  const sharedRead = readSharedPedidoPendienteOperation(record);
  if (sharedRead.result.status === PEDIDO_PENDIENTE_STORAGE_RESULT.UNAVAILABLE) {
    return writePedidoPendienteOperation({
      ...record,
      leaseExpiresAt: Date.now() + PEDIDO_PENDIENTE_LEASE_MS
    });
  }
  const shared = sharedRead.operation;
  if (
    shared?.operationId !== record.operationId
    || shared.ownerTabId !== pedidoPendienteTabId
    || shared.leaseToken !== record.leaseToken
    || ![PEDIDO_PENDIENTE_OPERATION_STATUS.SENDING, PEDIDO_PENDIENTE_OPERATION_STATUS.UNKNOWN].includes(shared.status)
  ) return null;
  const renewed = {
    ...record,
    status: shared.status,
    leaseExpiresAt: Date.now() + PEDIDO_PENDIENTE_LEASE_MS,
    updatedAt: Date.now()
  };
  const saved = publishPedidoPendienteOperation(renewed);
  if (saved?.status !== PEDIDO_PENDIENTE_STORAGE_RESULT.OK) return writePedidoPendienteOperation(renewed);
  const verified = readSharedPedidoPendienteOperation(renewed).operation;
  if (
    verified?.ownerTabId !== pedidoPendienteTabId
    || verified?.leaseToken !== record.leaseToken
  ) return null;
  return writePedidoPendienteOperation(renewed);
};

const abandonPedidoPendienteOperation = (operationId, {
  explicit = false,
  operationScope = null
} = {}) => {
  const normalizedOperationId = String(operationId || '').trim();
  if (!normalizedOperationId || pedidoPendienteInFlight.has(normalizedOperationId)) return false;
  const normalizedScope = normalizePedidoPendienteOperationScope(operationScope);
  if (!isCompletePedidoPendienteScope(normalizedScope)) return false;
  const sessionRecord = readPedidoPendienteOperation(normalizedScope);
  const record = sessionRecord?.operationId === normalizedOperationId
    ? sessionRecord
    : findSharedPedidoPendienteOperation(normalizedOperationId, operationScope);
  if (!record) return false;
  if (!isSamePedidoPendienteScope(record.operationScope, normalizedScope)) return false;
  // Un registro de coordinacion (otra pestaña) nunca trae payload propio. Antes eso
  // bloqueaba el abandono para siempre, incluso con el lease vencido hace rato -
  // dejando un candado huerfano que ninguna accion del usuario podia liberar. Se
  // permite abandonar explicitamente cuando el lease ya vencio (ninguna pestaña viva
  // puede seguir siendo dueña de la operacion).
  if (!record.hasRecoveryPayload && !(explicit && record.leaseExpired)) return false;
  if (record.status === PEDIDO_PENDIENTE_OPERATION_STATUS.SENDING && !record.leaseExpired) return false;
  if (record.status === PEDIDO_PENDIENTE_OPERATION_STATUS.UNKNOWN && !explicit) return false;
  if (isPedidoPendienteOperationLocked(record) && !explicit) return false;
  const abandoned = transitionPedidoPendienteOperation(record, PEDIDO_PENDIENTE_OPERATION_STATUS.ABANDONED, {
    leaseToken: '',
    leaseExpiresAt: 0
  });
  clearPedidoPendienteOperation(abandoned);
  return true;
};

const subscribePedidoPendienteOperations = (operationScope, callback) => {
  if (typeof callback !== 'function') return () => undefined;
  const subscriber = {
    scope: normalizePedidoPendienteOperationScope(operationScope),
    notify: (event = null) => {
      if (
        event?.type === 'operation-released'
        && [PEDIDO_PENDIENTE_OPERATION_STATUS.CONFIRMED, PEDIDO_PENDIENTE_OPERATION_STATUS.ABANDONED].includes(event.status)
      ) {
        const stored = readPedidoPendienteOperation();
        if (stored?.operationId === event.operationId) {
          pedidoPendienteOperationMemory = null;
          const recoveryKey = buildPedidoPendienteRecoveryStorageKey(stored.scopeKey, stored.operationId);
          safeRemoveStoredValue('sessionStorage', recoveryKey);
        }
      }
      callback(listSharedPedidoPendienteOperations(operationScope), event);
    }
  };
  pedidoPendienteSubscribers.add(subscriber);
  const handleStorage = (event) => {
    if (!event?.key?.startsWith(PEDIDO_PENDIENTE_SHARED_STORAGE_PREFIX)) return;
    let releaseEvent = null;
    if (event.newValue) {
      try {
        const parsed = parseStoredPedidoPendienteOperation(event.newValue, { coordination: true });
        const updated = parsed.operation;
        if (updated) pedidoPendienteSharedMemory.set(event.key, updated);
      } catch {
        // Se conserva el ultimo registro valido conocido.
      }
    } else {
      pedidoPendienteSharedMemory.delete(event.key);
    }
    if (!event.newValue && event.oldValue) {
      try {
        const released = parseStoredPedidoPendienteOperation(event.oldValue, { coordination: true }).operation;
        if (released) {
          releaseEvent = {
            type: 'operation-released',
            operationId: released.operationId,
            status: released.status,
            confirmedPedidoId: released.confirmedPedidoId || null
          };
        }
      } catch {
        releaseEvent = null;
      }
    }
    subscriber.notify(releaseEvent);
  };
  if (typeof window !== 'undefined') window.addEventListener?.('storage', handleStorage);
  getPedidoPendienteChannel();
  const leaseCheckTimer = setInterval(subscriber.notify, PEDIDO_PENDIENTE_LEASE_RENEW_MS);
  const leaseRenewTimer = setInterval(() => {
    const current = readPedidoPendienteOperation(operationScope);
    if (
      current
      && isPedidoPendienteOperationLocked(current)
      && current.ownerTabId === pedidoPendienteTabId
      && current.leaseToken
    ) renewPedidoPendienteOperationLease(current);
  }, PEDIDO_PENDIENTE_LEASE_RENEW_MS);
  subscriber.notify();
  return () => {
    clearInterval(leaseCheckTimer);
    clearInterval(leaseRenewTimer);
    pedidoPendienteSubscribers.delete(subscriber);
    if (typeof window !== 'undefined') window.removeEventListener?.('storage', handleStorage);
  };
};

const isPedidoPendienteTemporaryError = (error) => {
  const status = Number(error?.status || error?.data?.status || 0);
  const code = String(error?.code || error?.data?.code || '').trim().toUpperCase();
  return status === 0
    || status === 408
    || [425, 429, 500, 502, 503, 504].includes(status)
    || ['FETCH_ERROR', 'REQUEST_TIMEOUT', 'REQUEST_ALREADY_IN_PROGRESS', 'IDEMPOTENCY_IN_PROGRESS', 'POS_RPC_IDEMPOTENCY_IN_PROGRESS'].includes(code);
};

const createVentaRequest = (payload, { idempotencyKey, timeoutMs }) =>
  apiFetch(
    '/ventas',
    'POST',
    payload,
    withIdempotencyKey({ timeoutMs }, idempotencyKey)
  );

const recoverFinancialOperationResult = ({ idempotencyKey, operation, scope }) => apiFetch(
  `/ventas/idempotency-result${buildQuery({
    operation,
    id_sucursal: scope?.sucursalId,
    id_sesion_caja: scope?.cashSessionId
  })}`,
  'GET',
  null,
  withIdempotencyKey({}, idempotencyKey)
);

const createVentaRequestWithRetries = async (payload, options = {}) => {
  const idempotencyKey = String(options?.idempotencyKey || createIdempotencyKey()).trim();
  const initialTimeoutMs = parseTimeoutMs(options?.timeoutMs, VENTAS_CREATE_TIMEOUT_MS);

  try {
    return await createVentaRequest(payload, { idempotencyKey, timeoutMs: initialTimeoutMs });
  } catch (error) {
    if (!isVentaCreateTimeoutError(error) && !isVentaCreateInProgressError(error)) {
      throw error;
    }

    let lastError = error;
    for (let attempt = 1; attempt <= VENTAS_CREATE_RECOVERY_RETRIES; attempt += 1) {
      await delay(VENTAS_CREATE_RECOVERY_DELAY_MS * attempt);
      try {
        return await createVentaRequest(payload, {
          idempotencyKey,
          timeoutMs: VENTAS_CREATE_RECOVERY_TIMEOUT_MS
        });
      } catch (recoveryError) {
        lastError = recoveryError;
        if (isVentaCreateTimeoutError(recoveryError) || isVentaCreateInProgressError(recoveryError)) {
          continue;
        }
        throw recoveryError;
      }
    }

    if (isVentaCreateInProgressError(lastError) || isVentaCreateTimeoutError(lastError)) {
      const fallbackError = new Error(
        'La venta sigue procesandose en el servidor. Espera unos segundos, revisa el historial de ventas y evita reenviar el cobro inmediatamente.'
      );
      fallbackError.status = Number(lastError?.status || 0) || 409;
      fallbackError.code = 'VENTA_EN_PROCESO';
      fallbackError.data = lastError?.data || null;
      throw fallbackError;
    }

    throw lastError;
  }
};

const readBlobError = async (response) => {
  const text = await response.text().catch(() => '');
  if (!text) return `No se pudo descargar el PDF (HTTP ${response.status}).`;
  try {
    const payload = JSON.parse(text);
    return payload?.message || payload?.mensaje || `No se pudo descargar el PDF (HTTP ${response.status}).`;
  } catch {
    return text;
  }
};

const fetchPdfBlob = async (endpoint) => {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/pdf'
    }
  });

  if (response.status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth:logout'));
  }

  if (!response.ok) {
    throw new Error(await readBlobError(response));
  }

  return response.blob();
};

const createVentaWithRecovery = (payload, options = {}) => financialOperationManager.execute(
  {
    kind: 'VENTA_DIRECTA',
    endpoint: '/ventas',
    payload,
    scope: options.operationScope || {},
    successId: 'id_factura',
    validateSuccess: (response) => Number(response?.id_factura) > 0 && Number(response?.id_pedido) > 0,
    recover: (idempotencyKey, scope) => recoverFinancialOperationResult({
      idempotencyKey,
      operation: 'POST /ventas',
      scope
    })
  },
  (frozenPayload, idempotencyKey) => createVentaRequestWithRetries(frozenPayload, {
    ...options,
    idempotencyKey
  })
);

const registrarPagoPedidoWithRecovery = (idPedido, payload, options = {}) => financialOperationManager.execute(
  {
    kind: `PAGO_PEDIDO_${Number(idPedido)}`,
    endpoint: `/ventas/pedidos/${idPedido}/registrar-pago`,
    payload,
    scope: options.operationScope || {},
    successId: 'id_factura',
    validateSuccess: (response) => Number(response?.id_factura) > 0 && Number(response?.id_pedido) === Number(idPedido),
    recover: (idempotencyKey, scope) => recoverFinancialOperationResult({
      idempotencyKey,
      operation: 'POST /ventas/pedidos/:id/registrar-pago',
      scope
    })
  },
  (frozenPayload, idempotencyKey) => apiFetch(
    `/ventas/pedidos/${idPedido}/registrar-pago`,
    'POST',
    frozenPayload,
    withIdempotencyKey({}, idempotencyKey)
  )
);

const createPedidoPendienteRequest = (payload, { idempotencyKey, timeoutMs }) => apiFetch(
  '/ventas/pedidos-pendientes',
  'POST',
  payload,
  withIdempotencyKey({ timeoutMs }, idempotencyKey)
);

const createPedidoPendienteWithRecovery = async (payload, options = {}) => {
  let operation = preparePedidoPendienteOperation(payload, options);
  const existingRequest = pedidoPendienteInFlight.get(operation.operationId);
  if (existingRequest) return existingRequest;

  const request = (async () => {
    const initialTimeoutMs = parseTimeoutMs(options?.timeoutMs, VENTAS_CREATE_TIMEOUT_MS);
    let lastError = null;
    const leaseAcquisition = acquirePedidoPendienteOperationLease(operation);
    if (!leaseAcquisition.acquired) {
      const leaseError = new Error('Otra pestaña adquirió la operación. Esta pestaña no enviará el pedido.');
      leaseError.status = 409;
      leaseError.code = 'PEDIDO_PENDIENTE_LEASE_NO_ADQUIRIDO';
      leaseError.operation = leaseAcquisition.operation || operation;
      throw leaseError;
    }
    operation = leaseAcquisition.operation;
    operation = transitionPedidoPendienteOperation(operation, PEDIDO_PENDIENTE_OPERATION_STATUS.SENDING, {
      hasBeenSent: true
    });
    const leaseTimer = setInterval(() => {
      operation = renewPedidoPendienteOperationLease(operation) || operation;
    }, PEDIDO_PENDIENTE_LEASE_RENEW_MS);

    try {
      for (let attempt = 0; attempt <= VENTAS_CREATE_RECOVERY_RETRIES; attempt += 1) {
        if (attempt > 0) await delay(VENTAS_CREATE_RECOVERY_DELAY_MS * attempt);
        try {
          if (!leaseAcquisition.degraded) {
            const owned = readSharedPedidoPendienteOperation(operation).operation;
            if (
              owned?.ownerTabId !== pedidoPendienteTabId
              || owned?.leaseToken !== operation.leaseToken
              || owned?.leaseExpiresAt <= Date.now()
            ) {
              const lostLeaseError = new Error('La pestaña perdió el control de la operación antes del reintento.');
              lostLeaseError.status = 409;
              lostLeaseError.code = 'PEDIDO_PENDIENTE_LEASE_PERDIDO';
              throw lostLeaseError;
            }
          }
          const response = await createPedidoPendienteRequest(operation.payload, {
            idempotencyKey: operation.idempotencyKey,
            timeoutMs: attempt === 0 ? initialTimeoutMs : VENTAS_CREATE_RECOVERY_TIMEOUT_MS
          });
          const idPedido = Number.parseInt(String(response?.id_pedido ?? ''), 10);
          if (!Number.isSafeInteger(idPedido) || idPedido <= 0) {
            const invalidResponseError = new Error('El servidor no confirmo el identificador del pedido creado.');
            invalidResponseError.code = 'PEDIDO_PENDIENTE_RESPUESTA_INVALIDA';
            invalidResponseError.status = 502;
            throw invalidResponseError;
          }
          const confirmed = transitionPedidoPendienteOperation(operation, PEDIDO_PENDIENTE_OPERATION_STATUS.CONFIRMED, {
            leaseToken: '',
            leaseExpiresAt: 0,
            confirmedPedidoId: idPedido,
            confirmedAt: Date.now()
          });
          clearPedidoPendienteOperation(confirmed);
          return response;
        } catch (error) {
          lastError = error;
          if (String(error?.code || '') === 'PEDIDO_PENDIENTE_LEASE_PERDIDO') break;
          if (!isPedidoPendienteTemporaryError(error)) {
            operation = transitionPedidoPendienteOperation(operation, PEDIDO_PENDIENTE_OPERATION_STATUS.REJECTED, {
              leaseToken: '',
              leaseExpiresAt: 0,
              lastErrorCode: String(error?.code || error?.data?.code || '').trim().toUpperCase()
            });
            // Rechazo definitivo (4xx o 22001 mapeado a 422): el servidor no creo el
            // pedido, asi que no debe quedar ningun candado - ni el registro privado de
            // recuperacion (sessionStorage) ni el puntero de coordinacion (localStorage).
            clearPedidoPendienteOperation(operation);
            throw error;
          }
        }
      }

      const lostLease = String(lastError?.code || '') === 'PEDIDO_PENDIENTE_LEASE_PERDIDO';
      const unknownPatch = {
        ...operation,
        status: PEDIDO_PENDIENTE_OPERATION_STATUS.UNKNOWN,
        leaseToken: lostLease ? '' : operation.leaseToken,
        leaseExpiresAt: lostLease ? 0 : Date.now() + PEDIDO_PENDIENTE_LEASE_MS,
        lastErrorCode: String(lastError?.code || lastError?.data?.code || '').trim().toUpperCase(),
        updatedAt: Date.now()
      };
      operation = lostLease
        ? writePedidoPendienteOperation(unknownPatch)
        : transitionPedidoPendienteOperation(operation, PEDIDO_PENDIENTE_OPERATION_STATUS.UNKNOWN, unknownPatch);
      const pendingError = createPedidoPendienteOperationLockedError(operation);
      pendingError.status = Number(lastError?.status || 0) || 409;
      pendingError.data = lastError?.data || null;
      throw pendingError;
    } finally {
      clearInterval(leaseTimer);
    }
  })();

  pedidoPendienteInFlight.set(operation.operationId, request);
  try {
    return await request;
  } finally {
    if (pedidoPendienteInFlight.get(operation.operationId) === request) {
      pedidoPendienteInFlight.delete(operation.operationId);
    }
  }
};

const recoverPedidoPendienteOperation = async (operationId, {
  operationScope = null,
  timeoutMs
} = {}) => {
  const normalizedOperationId = String(operationId || '').trim();
  const normalizedScope = normalizePedidoPendienteOperationScope(operationScope);
  if (!isCompletePedidoPendienteScope(normalizedScope)) {
    throw createPedidoPendienteStorageError(
      'PEDIDO_PENDIENTE_SCOPE_INVALIDO',
      'No se puede recuperar el pedido desde un contexto incompleto.'
    );
  }
  const sessionRecord = readPedidoPendienteOperation(normalizedScope);
  const operation = sessionRecord?.operationId === normalizedOperationId
    ? sessionRecord
    : findSharedPedidoPendienteOperation(normalizedOperationId, operationScope);
  if (operation && !isSamePedidoPendienteScope(operation.operationScope, normalizedScope)) {
    throw createPedidoPendienteStorageError(
      'PEDIDO_PENDIENTE_SCOPE_NO_COINCIDE',
      'Existe una operación pendiente perteneciente a otra sesión o sucursal. No puede recuperarse desde el contexto actual.'
    );
  }
  if (!operation?.payload) {
    const error = new Error(
      operation
        ? 'La recuperación pertenece a otra pestaña y su payload privado no se comparte. Revisa los pedidos recientes antes de continuar.'
        : 'No se encontró la operación pendiente para recuperarla.'
    );
    error.code = operation
      ? 'PEDIDO_PENDIENTE_PAYLOAD_NO_DISPONIBLE_EN_ESTA_PESTANA'
      : 'PEDIDO_PENDIENTE_OPERACION_NO_ENCONTRADA';
    throw error;
  }
  if (
    operation.status === PEDIDO_PENDIENTE_OPERATION_STATUS.SENDING
    && operation.ownerTabId !== pedidoPendienteTabId
    && !operation.leaseExpired
  ) {
    const error = new Error('La operacion sigue activa en otra pestaña. Espera a que termine antes de recuperarla.');
    error.code = 'PEDIDO_PENDIENTE_ACTIVO_EN_OTRA_PESTANA';
    error.operation = operation;
    throw error;
  }
  return createPedidoPendienteWithRecovery(operation.payload, {
    operationId: operation.operationId,
    operationScope: operation.operationScope,
    timeoutMs
  });
};

const clonePayload = (value) => {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return value == null ? value : JSON.parse(JSON.stringify(value));
};

const buildCajaBootstrapRequestKey = (params = {}, config = {}) => JSON.stringify({
  user: String(config.coalesceUserKey || config.userKey || 'anon'),
  sucursal: params.id_sucursal ?? null,
  departamento: params.id_tipo_departamento ?? null
});

const getCajaBootstrapCoalesced = async (params = {}, config = {}) => {
  const key = buildCajaBootstrapRequestKey(params, config);
  const cached = cajaBootstrapCache.get(key);
  if (!config.force && cached && Date.now() - cached.at < CAJA_BOOTSTRAP_CACHE_TTL_MS) {
    return clonePayload(cached.value);
  }
  if (config.force) cajaBootstrapCache.delete(key);

  const inFlight = cajaBootstrapInFlight.get(key);
  if (inFlight) return clonePayload(await inFlight);

  const sharedConfig = { ...config };
  delete sharedConfig.signal;
  delete sharedConfig.coalesceUserKey;
  delete sharedConfig.userKey;
  delete sharedConfig.force;

  const promise = apiFetch(`/ventas/caja/bootstrap${buildQuery(params)}`, 'GET', null, sharedConfig);
  cajaBootstrapInFlight.set(key, promise);
  try {
    const value = await promise;
    cajaBootstrapCache.set(key, { at: Date.now(), value: clonePayload(value) });
    return clonePayload(value);
  } finally {
    if (cajaBootstrapInFlight.get(key) === promise) {
      cajaBootstrapInFlight.delete(key);
    }
  }
};

const ventasService = {
  list: (params = {}, config = {}) => apiFetch(`/ventas${buildVentasListQuery(params)}`, 'GET', null, config),
  buscarVenta: (params = {}) => apiFetch(`/ventas/buscar${buildQuery(params)}`, 'GET'),
  getById: (id) => apiFetch(`/ventas/${id}`, 'GET'),
  getTicketById: (id) => apiFetch(`/ventas/${id}/ticket`, 'GET'),
  getTicketPdf: (id) => fetchPdfBlob(`/ventas/${id}/ticket.pdf`),
  getComandaById: (id) => apiFetch(`/ventas/${id}/comanda`, 'GET'),
  getPedidoComanda: (id) => apiFetch(`/ventas/pedidos/${id}/comanda`, 'GET'),
  getPrintRuntimeConfig: (params = {}) => apiFetch(`/ventas/impresoras-config${buildQuery(params)}`, 'GET'),
  detectPrinterDevice: (payload) => apiFetch('/ventas/impresoras/dispositivo-deteccion', 'POST', payload),
  getQzCertificate: (idSucursal) => apiFetch(
    `/ventas/qz/certificate?id_sucursal=${encodeURIComponent(idSucursal)}`,
    'GET'
  ),
  signQzRequest: (request, idSucursal) => apiFetch('/ventas/qz/sign', 'POST', {
    request,
    id_sucursal: idSucursal
  }),
  registerPrintEvent: (id, payload) => apiFetch(`/ventas/${id}/impresiones`, 'POST', payload),
  enqueuePrintJob: (id, payload, idempotencyKey) => apiFetch(
    `/ventas/${id}/print-jobs`,
    'POST',
    payload,
    withIdempotencyKey({}, idempotencyKey)
  ),
  enqueuePedidoPrintJob: (idPedido, payload, idempotencyKey) => apiFetch(
    `/ventas/pedidos/${idPedido}/print-jobs`,
    'POST',
    payload,
    withIdempotencyKey({}, idempotencyKey)
  ),
  getPrintJob: (id) => apiFetch(`/ventas/print-jobs/${id}`, 'GET'),
  getReversionContext: (id, config = {}) =>
    apiFetch(`/ventas/${id}/reversion-context`, 'GET', null, config),
  previewReversion: (id, payload, config = {}) =>
    apiFetch(`/ventas/${id}/reversion-preview`, 'POST', payload, config),
  createReversion: (id, payload, options = {}) => {
    const { idempotencyKey, ...config } = options;
    return apiFetch(
      `/ventas/${id}/reversiones`,
      'POST',
      payload,
      withIdempotencyKey(config, idempotencyKey)
    );
  },
  reprintReversion: (idReversion) =>
    apiFetch(`/ventas/reversiones/${idReversion}/print-jobs`, 'POST', {}),
  listReversiones: (id) => apiFetch(`/ventas/${id}/reversiones`, 'GET'),
  create: (payload, options = {}) => createVentaWithRecovery(payload, options),
  PEDIDO_PENDIENTE_OPERATION_STATUS,
  PEDIDO_PENDIENTE_STORAGE_RESULT,
  PEDIDO_PENDIENTE_SCHEMA_VERSION,
  getPedidoPendienteOperation: readPedidoPendienteOperation,
  getPedidoPendienteOperationContext,
  getPedidoPendienteStorageState,
  listSharedPedidoPendienteOperations,
  isPedidoPendienteOperationLocked,
  subscribePedidoPendienteOperations,
  preparePedidoPendienteOperation,
  serializePedidoPendienteRecoveryPayload,
  buildPedidoPendienteSafeLogContext,
  validateStoredPedidoPendienteOperation,
  acquirePedidoPendienteOperationLease,
  renewPedidoPendienteOperationLease,
  abandonPedidoPendienteOperation,
  recoverPedidoPendienteOperation,
  createPedidoPendiente: (payload, options = {}) => createPedidoPendienteWithRecovery(payload, options),
  ...(import.meta.env.SSR ? {
    __resetPedidoPendienteOperationRuntimeForTests: resetPedidoPendienteOperationRuntimeForTests
  } : {}),
  listPedidosPendientesPago: (params = {}, options = {}) =>
    apiFetch(`/ventas/pedidos-pendientes${buildQuery(params)}`, 'GET', null, options),
  registrarPagoPedido: (idPedido, payload, options = {}) =>
    registrarPagoPedidoWithRecovery(idPedido, payload, options),
  getFinancialIdempotencyResult: ({ idempotencyKey, operation, idSucursal, idSesionCaja }) => apiFetch(
    `/ventas/idempotency-result${buildQuery({ operation, id_sucursal: idSucursal, id_sesion_caja: idSesionCaja })}`,
    'GET',
    null,
    withIdempotencyKey({}, idempotencyKey)
  ),
  guardarTelefonoCliente: (idCliente, payload) =>
    apiFetch(`/ventas/clientes/${idCliente}/telefono`, 'PATCH', payload),
  getCajaBootstrap: (params = {}, config = {}) =>
    getCajaBootstrapCoalesced(params, config),
  getClientesCatalog: (params = {}, config = {}) =>
    apiFetch(`/ventas/catalogos/clientes${buildQuery(params)}`, 'GET', null, config),
  getRecetasCatalog: (params = {}, config = {}) => apiFetch(`/ventas/catalogos/recetas${buildQuery(params)}`, 'GET', null, config),
  getExtrasPermitidos: (params = {}, config = {}) => apiFetch(`/ventas/catalogos/extras-permitidos${buildQuery(params)}`, 'GET', null, config),
  getDescuentosCatalog: (params = {}, config = {}) => apiFetch(`/ventas/catalogos/descuentos${buildQuery(params)}`, 'GET', null, config),
  getTiposDescuentoCatalog: (config = {}) => apiFetch('/ventas/catalogos/tipos-descuento', 'GET', null, config),
  getProductosCatalog: (params = {}, config = {}) => apiFetch(`/ventas/catalogos/productos${buildQuery(params)}`, 'GET', null, config),
  // FIX: usar endpoint propio de ventas para categorias; /categorias_productos exige
  // INVENTARIO_CATEGORIAS_VER que el cajero no tiene, causando 403 y caja sin productos.
  getCategoriasCatalog: (config = {}) => apiFetch('/ventas/catalogos/categorias', 'GET', null, config),
  getTipoDepartamentos: (config = {}) => apiFetch('/ventas/catalogos/tipo-departamento', 'GET', null, config),
  listDescuentosCatalogosAdmin: (params = {}) =>
    apiFetch(`/ventas/descuentos-catalogos${buildQuery(params)}`, 'GET'),
  getDescuentoCatalogoById: (id) => apiFetch(`/ventas/descuentos-catalogos/${id}`, 'GET'),
  createDescuentoCatalogo: (payload) => apiFetch('/ventas/descuentos-catalogos', 'POST', payload),
  updateDescuentoCatalogo: (id, payload) =>
    apiFetch(`/ventas/descuentos-catalogos/${id}`, 'PUT', payload),
  toggleDescuentoCatalogoEstado: (id, estado) =>
    apiFetch(`/ventas/descuentos-catalogos/${id}/estado`, 'PATCH', { estado }),
  getDashboardResumen: (params = {}) => apiFetch(`/ventas/dashboard-resumen${buildQuery(params)}`, 'GET'),
  getDashboardFlujoPedidos: (params = {}) =>
    apiFetch(`/ventas/dashboard-flujo-pedidos${buildQuery(params)}`, 'GET'),
  // Pedidos menÃƒÂº pÃƒÂºblico
  getPedidosMenu: (params = {}, config = {}) => apiFetch(`/ventas/pedidos-menu${buildQuery(params)}`, 'GET', null, config),
  confirmarPagoPedido: (id) =>
    apiFetch(`/ventas/pedidos-menu/${id}/confirmar-pago`, 'POST', {}),
  updatePedidoEstado: (id, estadoDestinoOrId) => {
    const numericState = Number.parseInt(String(estadoDestinoOrId ?? ''), 10);
    if (Number.isInteger(numericState) && numericState > 0) {
      return apiFetch(`/ventas/pedidos-menu/${id}/estado`, 'PUT', { id_estado_pedido: numericState });
    }
    return apiFetch(`/ventas/pedidos-menu/${id}/estado`, 'PUT', { estado_destino: estadoDestinoOrId });
  }
};

export default ventasService;

