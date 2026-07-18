import { apiFetch } from './api';
import importedQz from 'qz-tray';
import { assertBrowserQzAllowed } from './printModeGuard.js';
import {
  createQzContextKey,
  getQzAuthenticatedContext,
  getQzAuthenticatedIdentityKey,
  resolveQzApiErrorCode,
  subscribeQzAuthenticatedContext,
} from './qzSessionContext.js';

const QZ_LIBRARY_SOURCES = [...new Set([
  '/vendor/qz-tray.js',
  import.meta.env.VITE_QZ_TRAY_SCRIPT_URL,
  'https://cdn.jsdelivr.net/npm/qz-tray@2.2.6/qz-tray.js',
  'https://unpkg.com/qz-tray@2.2.6/qz-tray.js'
].filter(Boolean))];

let qzLoadPromise = null;
let qzSecuritySetupPromise = null;
let qzSecuritySucursalId = null;
let qzSecurityContextKey = null;
let qzConnectionPromise = null;
let qzConnectionSucursalId = null;
let qzConnectionContextKey = null;
let qzActiveContextKey = null;
let qzActiveAuthenticatedIdentityKey = null;
let qzContextGeneration = 0;
let qzOperationQueue = Promise.resolve();

const QZ_DEBUG_ENABLED = String(import.meta.env.DEV || '').trim() === 'true'
  || /qa\.jonnyshn\.com$/i.test(typeof window !== 'undefined' ? window.location.hostname : '');
const QZ_LOCAL_CONNECTION_OPTIONS = {
  usingSecure: true,
  retries: 1,
  delay: 0
};
const QZ_DEFAULT_REMOTE_SECURE_PORT = 8181;

const createQzError = (code, message, cause = null) => {
  const error = new Error(message);
  error.name = 'QzPrintError';
  error.code = code;
  if (cause) error.cause = cause;
  return error;
};

const QZ_API_ERROR_MESSAGES = {
  QZ_SESSION_UNAUTHORIZED: 'La sesion actual no esta autorizada para usar QZ Tray.',
  QZ_CSRF_INVALID: 'La sesion de seguridad cambio. Inicia sesion nuevamente antes de imprimir.',
  QZ_SUCURSAL_FORBIDDEN: 'El usuario actual no tiene acceso para imprimir en esta sucursal.',
  QZ_PERMISSION_FORBIDDEN: 'El usuario actual no tiene permiso para imprimir.',
  QZ_CERTIFICATE_UNAVAILABLE: 'El certificado de QZ Tray no esta disponible para esta sucursal.',
  QZ_CERTIFICATE_ERROR: 'No se pudo obtener el certificado de QZ Tray desde el backend.',
  QZ_SIGNATURE_ERROR: 'No se pudo firmar la solicitud de QZ Tray en el backend.',
};

const toMappedQzApiError = (error, operation) => {
  const code = resolveQzApiErrorCode(error, operation);
  return createQzError(code, QZ_API_ERROR_MESSAGES[code], error);
};

const normalizeQzResetReason = (value) =>
  String(value || 'manual')
    .trim()
    .replace(/[^a-z0-9:_-]+/gi, '-')
    .slice(0, 80) || 'manual';

const requireQzSucursalId = (value) => {
  const parsed = typeof value === 'number'
    ? value
    : Number(String(value ?? '').trim());
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw createQzError(
      'QZ_SUCURSAL_REQUIRED',
      'idSucursal es obligatorio para usar QZ Tray.'
    );
  }
  return parsed;
};

const requireQzAuthenticatedUser = () => {
  const authenticatedContext = getQzAuthenticatedContext();
  const idUsuario = Number(authenticatedContext.idUsuario);

  if (!Number.isSafeInteger(idUsuario) || idUsuario <= 0) {
    throw createQzError(
      'QZ_SESSION_UNAUTHORIZED',
      'Debes iniciar sesion antes de usar QZ Tray.'
    );
  }

  return {
    idUsuario,
    authenticatedIdentityKey: getQzAuthenticatedIdentityKey(authenticatedContext),
  };
};

const enqueueQzOperation = (operation) => {
  const queued = qzOperationQueue.then(operation, operation);
  qzOperationQueue = queued.then(
    () => undefined,
    () => undefined
  );
  return queued;
};

const runQzSucursalOperation = (idSucursal, operation) => {
  const normalizedSucursalId = requireQzSucursalId(idSucursal);
  return enqueueQzOperation(() => operation(normalizedSucursalId));
};

export const assertQzDirectMode = () => {
  try { return assertBrowserQzAllowed(); } catch (error) {
    throw createQzError(error.code || 'QZ_DISABLED_IN_AGENT_MODE', error.message, error);
  }
};

const toBrowserQz = () => {
  if (typeof window === 'undefined') return null;
  return window.qz || null;
};

const isUsableQz = (candidate) =>
  Boolean(candidate?.websocket && candidate?.security && candidate?.printers && candidate?.configs);

const toImportedQz = () => {
  const candidate = importedQz?.default || importedQz;
  return isUsableQz(candidate) ? candidate : null;
};

const injectQzScript = (src) => new Promise((resolve, reject) => {
  if (typeof document === 'undefined') {
    reject(createQzError('QZ_NOT_AVAILABLE', 'QZ Tray no esta disponible en este entorno.'));
    return;
  }

  const existing = document.querySelector(`script[data-qz-source="${src}"]`);
  if (existing) {
    existing.addEventListener('load', () => resolve(true), { once: true });
    existing.addEventListener('error', () => reject(new Error(`No se pudo cargar ${src}`)), { once: true });
    return;
  }

  const script = document.createElement('script');
  script.src = src;
  script.async = true;
  script.dataset.qzSource = src;
  script.onload = () => resolve(true);
  script.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
  document.head.appendChild(script);
});

const ensureQzLibrary = async () => {
  assertQzDirectMode();
  const bundled = toImportedQz();
  if (bundled) {
    if (typeof window !== 'undefined' && !window.qz) window.qz = bundled;
    return bundled;
  }

  const existing = toBrowserQz();
  if (isUsableQz(existing)) return existing;

  if (!qzLoadPromise) {
    qzLoadPromise = (async () => {
      let lastError = null;
      for (const source of QZ_LIBRARY_SOURCES) {
        try {
          await injectQzScript(source);
          const qz = toBrowserQz();
          if (isUsableQz(qz)) return qz;
          lastError = createQzError(
            'QZ_LIBRARY_INVALID',
            `La libreria cargada desde ${source} no expone la API requerida.`
          );
        } catch (error) {
          lastError = error;
        }
      }
      throw createQzError(
        'QZ_LIBRARY_LOAD_FAILED',
        'No se pudo cargar la libreria de QZ Tray en el navegador.',
        lastError
      );
    })();
  }

  return qzLoadPromise;
};

const assertQzCallbackContext = ({
  contextKey,
  authenticatedIdentityKey,
  generation,
}) => {
  const currentAuthenticatedIdentityKey = getQzAuthenticatedIdentityKey(
    getQzAuthenticatedContext()
  );

  if (
    qzContextGeneration !== generation
    || qzActiveContextKey !== contextKey
    || currentAuthenticatedIdentityKey !== authenticatedIdentityKey
  ) {
    throw createQzError(
      'QZ_SESSION_UNAUTHORIZED',
      'La sesion de QZ Tray cambio. Vuelve a intentar con la sesion actual.'
    );
  }
};

const setupQzSecurity = async (qz, {
  idSucursal,
  contextKey,
  authenticatedIdentityKey,
  generation = qzContextGeneration,
} = {}) => {
  const normalizedSucursalId = requireQzSucursalId(idSucursal);
  if (
    qzSecuritySetupPromise
    && qzSecuritySucursalId === normalizedSucursalId
    && qzSecurityContextKey === contextKey
  ) {
    return qzSecuritySetupPromise;
  }
  if (qzSecuritySetupPromise) {
    throw createQzError(
      'QZ_SUCURSAL_SWITCH_IN_PROGRESS',
      'QZ Tray esta cambiando la configuracion de sucursal.'
    );
  }

  const pendingSetup = (async () => {
    const configuredAlgorithm = String(import.meta.env.VITE_QZ_SIGNATURE_ALGORITHM || 'SHA512').trim() || 'SHA512';
    let certificateResponse;

    try {
      certificateResponse = await apiFetch(
        `/ventas/qz/certificate?id_sucursal=${encodeURIComponent(normalizedSucursalId)}`,
        'GET'
      );
    } catch (error) {
      throw toMappedQzApiError(error, 'certificate');
    }

    const certificate = String(
      certificateResponse?.certificate || certificateResponse?.data || certificateResponse || ''
    ).trim();

    if (!certificate) {
      throw createQzError(
        'QZ_CERTIFICATE_ERROR',
        'El backend no devolvio un certificado valido para QZ Tray.'
      );
    }

    const callbackContext = {
      contextKey,
      authenticatedIdentityKey,
      generation,
    };

    qzActiveContextKey = contextKey;
    qzActiveAuthenticatedIdentityKey = authenticatedIdentityKey;
    assertQzCallbackContext(callbackContext);

    qz.security.setCertificatePromise((resolve, reject) => {
      try {
        assertQzCallbackContext(callbackContext);
        resolve(certificate);
      } catch (error) {
        reject(error);
      }
    }, { rejectOnFailure: true });
    qz.security.setSignatureAlgorithm(configuredAlgorithm);
    qz.security.setSignaturePromise((toSign) => async (resolve, reject) => {
      try {
        assertQzCallbackContext(callbackContext);
        const response = await apiFetch('/ventas/qz/sign', 'POST', {
          request: toSign,
          id_sucursal: normalizedSucursalId
        });
        assertQzCallbackContext(callbackContext);
        const signature = String(response?.signature || '').trim();
        if (!signature) {
          reject(createQzError('QZ_SIGNATURE_ERROR', 'El backend devolvio una firma vacia para QZ Tray.'));
          return;
        }
        resolve(signature);
      } catch (error) {
        if (error?.name === 'QzPrintError') {
          reject(error);
          return;
        }
        reject(toMappedQzApiError(error, 'sign'));
      }
    });

    return true;
  })();

  qzSecuritySucursalId = normalizedSucursalId;
  qzSecurityContextKey = contextKey;
  qzSecuritySetupPromise = pendingSetup;
  try {
    return await pendingSetup;
  } catch (error) {
    if (qzSecuritySetupPromise === pendingSetup) {
      qzSecuritySetupPromise = null;
      qzSecuritySucursalId = null;
      qzSecurityContextKey = null;
      qzActiveContextKey = null;
      qzActiveAuthenticatedIdentityKey = null;
    }
    throw error;
  }
};

const isEnvTrue = (value) => String(value || '').trim().toLowerCase() === 'true';

const isAndroidDevice = () => {
  if (typeof navigator === 'undefined') return false;

  if (typeof navigator.userAgentData?.mobile === 'boolean') {
    return navigator.userAgentData.mobile
      && /Android/i.test(navigator.userAgent || '');
  }

  return /Android/i.test(navigator.userAgent || '');
};

const resolveQzRemoteSecurePort = () => {
  const rawPort = String(import.meta.env.VITE_QZ_REMOTE_SECURE_PORT || '').trim();
  if (!rawPort) return QZ_DEFAULT_REMOTE_SECURE_PORT;

  const parsedPort = Number(rawPort);
  if (Number.isInteger(parsedPort) && parsedPort >= 1 && parsedPort <= 65535) {
    return parsedPort;
  }

  return QZ_DEFAULT_REMOTE_SECURE_PORT;
};

const assertSecureQzConnectionOptions = (connectionOptions) => {
  const isHttpsPage = typeof window !== 'undefined' && window.location?.protocol === 'https:';
  const remoteHost = String(connectionOptions?.host || '').trim();
  const hasInsecurePort = Array.isArray(connectionOptions?.port?.insecure)
    && connectionOptions.port.insecure.length > 0;
  const hasInsecureScheme = /^ws:\/\//i.test(remoteHost);

  if (hasInsecureScheme || (isHttpsPage && (connectionOptions?.usingSecure !== true || hasInsecurePort))) {
    throw createQzError(
      'QZ_INSECURE_CONNECTION_BLOCKED',
      'La conexion insegura con QZ Tray fue bloqueada. Configura WSS con un certificado valido.'
    );
  }

  return connectionOptions;
};

const resolveQzConnectionOptions = () => {
  const remoteEnabled = isEnvTrue(import.meta.env.VITE_QZ_REMOTE_ENABLED);
  const remoteHost = String(import.meta.env.VITE_QZ_REMOTE_HOST || '').trim();
  const androidOnly = isEnvTrue(import.meta.env.VITE_QZ_REMOTE_ANDROID_ONLY);

  if (!remoteEnabled || !remoteHost) return { ...QZ_LOCAL_CONNECTION_OPTIONS };
  if (androidOnly && !isAndroidDevice()) return { ...QZ_LOCAL_CONNECTION_OPTIONS };

  const remoteSecurePort = resolveQzRemoteSecurePort();
  return {
    host: remoteHost,
    usingSecure: true,
    port: {
      secure: [remoteSecurePort]
    },
    retries: 2,
    delay: 1
  };
};

const describeQzConnectionOptions = (connectionOptions) => {
  if (connectionOptions?.host) {
    const port = connectionOptions?.port?.secure?.[0] || QZ_DEFAULT_REMOTE_SECURE_PORT;
    return {
      mode: 'remote',
      host: connectionOptions.host,
      port,
      secure: true,
      debugDetails: {
        mode: 'remote',
        host: connectionOptions.host,
        port,
        secure: true
      },
      errorMessage: `No se pudo conectar con QZ Tray en la computadora puente ${connectionOptions.host}:${port}.`
    };
  }

  return {
    mode: 'local',
    host: 'localhost',
    port: QZ_DEFAULT_REMOTE_SECURE_PORT,
    secure: true,
    debugDetails: { mode: 'local', secure: true },
    errorMessage: 'No se pudo establecer conexion con QZ Tray.'
  };
};

const waitForPendingQzConnection = async () => {
  const pendingConnection = qzConnectionPromise;
  if (!pendingConnection) return;
  try {
    await pendingConnection;
  } catch {
    // El cambio de contexto debe continuar aunque el intento anterior haya fallado.
  }
};

const isQzWebsocketActive = (qz) => {
  try {
    return Boolean(qz?.websocket?.isActive?.());
  } catch {
    return false;
  }
};

const invalidateQzSecurityCallbacks = (qz) => {
  const rejectStaleContext = () => createQzError(
    'QZ_SESSION_UNAUTHORIZED',
    'El contexto anterior de QZ Tray ya no es valido.'
  );

  try {
    qz?.security?.setCertificatePromise?.((_resolve, reject) => {
      reject(rejectStaleContext());
    }, { rejectOnFailure: true });
  } catch {
    // QZ Tray puede estar cerrado durante un logout.
  }

  try {
    qz?.security?.setSignaturePromise?.(() => (_resolve, reject) => {
      reject(rejectStaleContext());
    });
  } catch {
    // QZ Tray puede estar cerrado durante un logout.
  }
};

const clearQzRuntimeState = () => {
  qzContextGeneration += 1;
  qzConnectionPromise = null;
  qzConnectionSucursalId = null;
  qzConnectionContextKey = null;
  qzSecuritySetupPromise = null;
  qzSecuritySucursalId = null;
  qzSecurityContextKey = null;
  qzActiveContextKey = null;
  qzActiveAuthenticatedIdentityKey = null;
};

const resetQzRuntime = async ({
  qz = toImportedQz() || toBrowserQz(),
  reason = 'manual',
  tolerateDisconnectFailure = true,
} = {}) => {
  await waitForPendingQzConnection();

  const pendingSecuritySetup = qzSecuritySetupPromise;
  if (pendingSecuritySetup) {
    try {
      await pendingSecuritySetup;
    } catch {
      // El estado fallido tambien debe invalidarse.
    }
  }

  const wasActive = isQzWebsocketActive(qz);
  if (wasActive) {
    try {
      await qz.websocket.disconnect();
    } catch (error) {
      if (!tolerateDisconnectFailure) {
        throw createQzError(
          'QZ_CONNECTION_FAILED',
          'No se pudo desconectar la conexion anterior de QZ Tray.',
          error
        );
      }
    }
  }

  invalidateQzSecurityCallbacks(qz);
  clearQzRuntimeState();
  debugQz('Sesion reiniciada:', {
    reason: normalizeQzResetReason(reason),
    disconnected: wasActive,
  });
  return wasActive;
};

const prepareQzSecurityForContext = async (qz, context) => {
  const hasDifferentSecurityContext = Boolean(qzSecurityContextKey)
    && qzSecurityContextKey !== context.contextKey;
  const hasDifferentActiveContext = Boolean(qzActiveContextKey)
    && qzActiveContextKey !== context.contextKey;
  const hasUnboundActiveConnection = isQzWebsocketActive(qz) && !qzActiveContextKey;

  if (hasDifferentSecurityContext || hasDifferentActiveContext || hasUnboundActiveConnection) {
    await resetQzRuntime({
      qz,
      reason: 'connection-context-changed',
      tolerateDisconnectFailure: false,
    });
  }

  const callbackContext = {
    ...context,
    generation: qzContextGeneration,
  };

  await setupQzSecurity(qz, callbackContext);
  return callbackContext;
};

const ensureConnectedQz = async (idSucursal) => {
  const { idUsuario, authenticatedIdentityKey } = requireQzAuthenticatedUser();
  const connectionOptions = assertSecureQzConnectionOptions(resolveQzConnectionOptions());
  const connectionContext = describeQzConnectionOptions(connectionOptions);
  const contextKey = createQzContextKey({
    idUsuario,
    idSucursal,
    host: connectionContext.host,
    port: connectionContext.port,
  });
  const qz = await ensureQzLibrary();
  const callbackContext = await prepareQzSecurityForContext(qz, {
    idUsuario,
    idSucursal,
    contextKey,
    authenticatedIdentityKey,
  });

  if (isQzWebsocketActive(qz)) {
    assertQzCallbackContext(callbackContext);
    return qz;
  }

  if (
    qzConnectionPromise
    && (qzConnectionSucursalId !== idSucursal || qzConnectionContextKey !== contextKey)
  ) {
    throw createQzError(
      'QZ_SUCURSAL_SWITCH_IN_PROGRESS',
      'QZ Tray ya esta conectando otro contexto autenticado.'
    );
  }

  if (!qzConnectionPromise) {
    qzConnectionSucursalId = idSucursal;
    qzConnectionContextKey = contextKey;
    qzConnectionPromise = (async () => {
      if (isQzWebsocketActive(qz)) return qz;

      debugQz(connectionContext.debugDetails);

      try {
        await qz.websocket.connect(connectionOptions);
        assertQzCallbackContext(callbackContext);
      } catch (error) {
        if (error?.name === 'QzPrintError') throw error;
        throw createQzError(
          'QZ_CONNECTION_FAILED',
          connectionContext.errorMessage,
          error
        );
      }

      return qz;
    })();
  }

  const pendingConnection = qzConnectionPromise;
  try {
    return await pendingConnection;
  } finally {
    if (qzConnectionPromise === pendingConnection) {
      qzConnectionPromise = null;
      qzConnectionSucursalId = null;
      qzConnectionContextKey = null;
    }
  }
};

const normalizePrinterName = (value) => String(value || '').trim();

const normalizePrinterToken = (value) =>
  normalizePrinterName(value)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9]+/g, '');

const debugQz = (...args) => {
  if (!QZ_DEBUG_ENABLED || typeof console === 'undefined' || typeof console.info !== 'function') return;
  console.info('[QZ]', ...args);
};

const listPrintersFromQz = async (qz) => {
  const printers = await qz.printers.find();
  const normalized = Array.isArray(printers)
    ? printers.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  debugQz('Impresoras detectadas:', normalized);
  return normalized;
};

const findPrinterFromQz = async (qz, printerName) => {
  const exactName = normalizePrinterName(printerName);
  if (!exactName) {
    throw createQzError('QZ_PRINTER_NOT_FOUND', 'No se configuro un nombre de impresora.');
  }

  const printers = await listPrintersFromQz(qz);
  debugQz('Impresora configurada:', exactName);
  const exactMatch = printers.find((item) => item.toLowerCase() === exactName.toLowerCase());
  if (exactMatch) return exactMatch;

  const normalizedTarget = normalizePrinterToken(exactName);
  const normalizedMatch = printers.find((item) => normalizePrinterToken(item) === normalizedTarget);
  if (normalizedMatch) return normalizedMatch;

  const containsMatch = printers.find((item) => {
    const normalizedCandidate = normalizePrinterToken(item);
    return normalizedCandidate.includes(normalizedTarget) || normalizedTarget.includes(normalizedCandidate);
  });
  if (containsMatch) return containsMatch;

  throw createQzError(
    'QZ_PRINTER_NOT_FOUND',
    `No se encontro la impresora "${exactName}". Detectadas: ${printers.join(', ') || 'ninguna'}.`
  );
};

const buildPixelConfig = (qz, printerName, options = {}) =>
  qz.configs.create(printerName, {
    copies: Math.max(1, Number(options.copies || 1)),
    jobName: String(options.jobName || 'Jonny SmartOrder').trim() || 'Jonny SmartOrder',
    margins: 0,
    scaleContent: false,
    units: 'mm'
  });

const rethrowQzErrorOrPrintFailure = (error, message) => {
  if (error?.name === 'QzPrintError' || String(error?.code || '').startsWith('QZ_')) {
    throw error;
  }
  throw createQzError('PRINT_FAILED', message, error);
};

const arrayBufferToBase64 = (buffer) => {
  const globalBuffer = typeof globalThis !== 'undefined' ? globalThis.Buffer : undefined;
  if (globalBuffer && typeof globalBuffer.from === 'function') {
    return globalBuffer.from(buffer).toString('base64');
  }

  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

export const isQzAvailable = async () => {
  try {
    await ensureQzLibrary();
    return true;
  } catch {
    return false;
  }
};

export const isQzConnected = async () => {
  try {
    const qz = await ensureQzLibrary();
    const currentIdentityKey = getQzAuthenticatedIdentityKey(getQzAuthenticatedContext());
    return isQzWebsocketActive(qz)
      && Boolean(qzActiveContextKey)
      && qzActiveAuthenticatedIdentityKey === currentIdentityKey;
  } catch {
    return false;
  }
};

export const connectQz = async ({ idSucursal } = {}) =>
  runQzSucursalOperation(idSucursal, (normalizedSucursalId) =>
    ensureConnectedQz(normalizedSucursalId));

export const resetQzSession = ({ reason = 'manual' } = {}) =>
  enqueueQzOperation(() => resetQzRuntime({ reason }));

export const disconnectQz = async () => {
  assertQzDirectMode();
  return resetQzSession({ reason: 'manual-disconnect' });
};

subscribeQzAuthenticatedContext(({ reason }) =>
  resetQzSession({ reason: `auth:${normalizeQzResetReason(reason)}` }));

export const getPrinters = async ({ idSucursal } = {}) =>
  runQzSucursalOperation(idSucursal, async (normalizedSucursalId) => {
    const qz = await ensureConnectedQz(normalizedSucursalId);
    return listPrintersFromQz(qz);
  });

export const findPrinter = async (printerName, { idSucursal } = {}) =>
  runQzSucursalOperation(idSucursal, async (normalizedSucursalId) => {
    const qz = await ensureConnectedQz(normalizedSucursalId);
    return findPrinterFromQz(qz, printerName);
  });

export const findPrinterByContains = async (text, { idSucursal } = {}) =>
  runQzSucursalOperation(idSucursal, async (normalizedSucursalId) => {
    const query = normalizePrinterName(text).toLowerCase();
    if (!query) return null;
    const qz = await ensureConnectedQz(normalizedSucursalId);
    const printers = await listPrintersFromQz(qz);
    return printers.find((item) => item.toLowerCase().includes(query)) || null;
  });

export const testQzConnection = async ({ idSucursal } = {}) =>
  runQzSucursalOperation(idSucursal, async (normalizedSucursalId) => {
    const qz = await ensureConnectedQz(normalizedSucursalId);
    return {
      connected: Boolean(qz.websocket.isActive()),
      info: typeof qz.websocket.getConnectionInfo === 'function'
        ? qz.websocket.getConnectionInfo()
        : null,
      printers: await listPrintersFromQz(qz)
    };
  });

export const printHtmlToPrinter = async ({
  idSucursal,
  printerName,
  html,
  copies = 1,
  widthMm = 80,
  jobName = 'Jonny SmartOrder'
} = {}) => runQzSucursalOperation(idSucursal, async (normalizedSucursalId) => {
  const qz = await ensureConnectedQz(normalizedSucursalId);
  const resolvedPrinter = await findPrinterFromQz(qz, printerName);
  const safeHtml = String(html || '').trim();
  if (!safeHtml) {
    throw createQzError('PRINT_FAILED', 'No se pudo generar el HTML para imprimir.');
  }

  try {
    const config = buildPixelConfig(qz, resolvedPrinter, { copies, jobName });
    await qz.print(config, [{
      type: 'pixel',
      format: 'html',
      flavor: 'plain',
      data: safeHtml,
      options: {
        pageWidth: Number(widthMm) === 58 ? 58 : 80
      }
    }]);
    return {
      ok: true,
      printerName: resolvedPrinter,
      mode: 'QZ_HTML'
    };
  } catch (error) {
    rethrowQzErrorOrPrintFailure(error, 'No se pudo imprimir el HTML con QZ Tray.');
  }
});

export const printPdfBlobToPrinter = async ({
  idSucursal,
  printerName,
  blob,
  copies = 1,
  jobName = 'Jonny SmartOrder'
} = {}) => runQzSucursalOperation(idSucursal, async (normalizedSucursalId) => {
  const qz = await ensureConnectedQz(normalizedSucursalId);
  const resolvedPrinter = await findPrinterFromQz(qz, printerName);
  if (!(blob instanceof Blob)) {
    throw createQzError('PRINT_FAILED', 'No se recibio un PDF valido para imprimir.');
  }

  try {
    const buffer = await blob.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);
    const config = buildPixelConfig(qz, resolvedPrinter, { copies, jobName });
    await qz.print(config, [{
      type: 'pixel',
      format: 'pdf',
      flavor: 'base64',
      data: base64,
      options: {
        altFontRendering: true,
        ignoreTransparency: true
      }
    }]);
    return {
      ok: true,
      printerName: resolvedPrinter,
      mode: 'QZ_PDF'
    };
  } catch (error) {
    rethrowQzErrorOrPrintFailure(error, 'No se pudo imprimir el PDF con QZ Tray.');
  }
});

export const printRawEscPos = async ({
  idSucursal,
  printerName,
  commands,
  copies = 1,
  jobName = 'Jonny SmartOrder'
} = {}) => runQzSucursalOperation(idSucursal, async (normalizedSucursalId) => {
  const qz = await ensureConnectedQz(normalizedSucursalId);
  const resolvedPrinter = await findPrinterFromQz(qz, printerName);
  const data = Array.isArray(commands) ? commands.filter(Boolean) : [];
  if (data.length === 0) {
    throw createQzError('PRINT_FAILED', 'No se recibieron comandos ESC/POS para imprimir.');
  }

  try {
    const config = qz.configs.create(resolvedPrinter, {
      copies: Math.max(1, Number(copies || 1)),
      jobName: String(jobName || 'Jonny SmartOrder').trim() || 'Jonny SmartOrder',
      encoding: 'UTF-8'
    });
    await qz.print(config, data);
    return {
      ok: true,
      printerName: resolvedPrinter,
      mode: 'QZ_RAW'
    };
  } catch (error) {
    rethrowQzErrorOrPrintFailure(error, 'No se pudo imprimir en modo RAW con QZ Tray.');
  }
});

const qzPrintService = {
  connectQz,
  disconnectQz,
  resetQzSession,
  isQzAvailable,
  isQzConnected,
  getPrinters,
  findPrinter,
  findPrinterByContains,
  testQzConnection,
  printHtmlToPrinter,
  printPdfBlobToPrinter,
  printRawEscPos
};

export default qzPrintService;
