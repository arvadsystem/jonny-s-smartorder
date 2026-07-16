import qzPrintService from './qzPrintService';
import ventasService from './ventasService';
import { isAgentPrintMode } from './printModeService';

const STORAGE_PREFIX = 'jonny_printer_detection';
const SUCCESS_STATUSES = new Set(['CONFIGURADO', 'YA_CONFIGURADO', 'REQUIERE_CONFIGURACION_ADMIN']);
const RETRYABLE_STATUSES = new Set(['NO_DETECTADO', 'ERROR']);
const RETRY_COOLDOWN_MS = 60 * 1000;

const toPositiveInt = (value) => {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizePrinterToken = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9]+/g, '');

const buildStorageKey = (idSucursal, idCaja) =>
  `${STORAGE_PREFIX}:${idSucursal}:${idCaja}`;

const readStorage = (key) => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const writeStorage = (key, payload) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // localStorage puede estar deshabilitado.
  }
};

const shouldRetryStoredDetection = (stored, idSesionCaja) => {
  if (!stored || Number(stored.id_sesion_caja || 0) !== Number(idSesionCaja || 0)) return true;
  if (SUCCESS_STATUSES.has(String(stored.status || '').trim().toUpperCase())) return false;
  if (!RETRYABLE_STATUSES.has(String(stored.status || '').trim().toUpperCase())) return true;
  const attemptedAt = Date.parse(String(stored.attempted_at || ''));
  if (!Number.isFinite(attemptedAt)) return true;
  return Date.now() - attemptedAt >= RETRY_COOLDOWN_MS;
};

const resolvePrinterByType = (runtime, type) =>
  (Array.isArray(runtime?.impresoras) ? runtime.impresoras : [])
    .find((item) => String(item?.tipo_impresora || '').trim().toUpperCase() === String(type || '').trim().toUpperCase()) || null;

const hasSpecificPrinterConfig = (printerConfig, idCaja) =>
  Boolean(
    printerConfig
    && printerConfig.activa !== false
    && Number(printerConfig.id_caja || 0) === Number(idCaja || 0)
    && String(printerConfig.nombre_impresora_sistema || '').trim()
  );

const hasGlobalPrinterConfig = (printerConfig) =>
  Boolean(
    printerConfig
    && printerConfig.activa !== false
    && !printerConfig.id_caja
    && String(printerConfig.nombre_impresora_sistema || '').trim()
  );

const needsDetectionFromRuntime = (runtime, idCaja) => {
  const factura = resolvePrinterByType(runtime, 'FACTURA');
  const cocina = resolvePrinterByType(runtime, 'COCINA');
  const facturaSpecific = hasSpecificPrinterConfig(factura, idCaja);
  const cocinaSpecific = hasSpecificPrinterConfig(cocina, idCaja);
  const cocinaRequired = hasGlobalPrinterConfig(cocina) || cocinaSpecific;

  return {
    needed: !facturaSpecific || (cocinaRequired && !cocinaSpecific),
    facturaSpecific,
    cocinaSpecific,
    cocinaRequired
  };
};

const buildStoredPayload = ({
  idSucursal,
  idCaja,
  idSesionCaja,
  printers,
  status,
  runtime = null
}) => ({
  detected: SUCCESS_STATUSES.has(String(status || '').trim().toUpperCase()),
  attempted_at: new Date().toISOString(),
  id_sucursal: idSucursal,
  id_caja: idCaja,
  id_sesion_caja: idSesionCaja,
  printers,
  status,
  runtime
});

const buildUserMessage = (status) => {
  switch (String(status || '').trim().toUpperCase()) {
    case 'CONFIGURADO':
    case 'YA_CONFIGURADO':
      return 'Impresoras validadas para esta caja.';
    case 'REQUIERE_CONFIGURACION_ADMIN':
      return 'Se detectaron impresoras, pero requieren asignación por administrador.';
    case 'NO_DETECTADO':
      return 'No se pudo validar la impresora automática. Puedes continuar, pero revisa que QZ Tray esté abierto.';
    default:
      return '';
  }
};

export const detectPrintersForCaja = async ({
  idSucursal,
  idCaja,
  idSesionCaja,
  origen = 'CARGA_CAJA',
  force = false
}) => {
  if (isAgentPrintMode()) {
    return { ok: true, skipped: true, status: 'AGENT_MODE', message: '' };
  }
  const sucursalId = toPositiveInt(idSucursal);
  const cajaId = toPositiveInt(idCaja);
  const sesionId = toPositiveInt(idSesionCaja);
  if (!sucursalId || !cajaId || !sesionId) {
    return {
      ok: false,
      skipped: true,
      status: 'INVALID_CONTEXT',
      message: ''
    };
  }

  const storageKey = buildStorageKey(sucursalId, cajaId);
  const stored = readStorage(storageKey);
  if (!force && stored && !shouldRetryStoredDetection(stored, sesionId)) {
    return {
      ok: true,
      skipped: true,
      status: stored.status || 'YA_CONFIGURADO',
      message: buildUserMessage(stored.status),
      stored
    };
  }

  const runtime = await ventasService.getPrintRuntimeConfig({
    id_sucursal: sucursalId,
    id_caja: cajaId
  }).catch(() => null);
  const runtimeDecision = needsDetectionFromRuntime(runtime, cajaId);
  if (!force && stored && SUCCESS_STATUSES.has(String(stored.status || '').trim().toUpperCase()) && !runtimeDecision.needed) {
    return {
      ok: true,
      skipped: true,
      status: stored.status,
      message: buildUserMessage(stored.status),
      stored
    };
  }
  if (!force && !runtimeDecision.needed) {
    const payload = buildStoredPayload({
      idSucursal: sucursalId,
      idCaja: cajaId,
      idSesionCaja: sesionId,
      printers: [],
      status: 'YA_CONFIGURADO',
      runtime
    });
    writeStorage(storageKey, payload);
    return {
      ok: true,
      skipped: true,
      status: 'YA_CONFIGURADO',
      message: buildUserMessage('YA_CONFIGURADO'),
      runtime
    };
  }

  const qzAvailable = await qzPrintService.isQzAvailable().catch(() => false);
  if (!qzAvailable) {
    const payload = buildStoredPayload({
      idSucursal: sucursalId,
      idCaja: cajaId,
      idSesionCaja: sesionId,
      printers: [],
      status: 'NO_DETECTADO',
      runtime
    });
    writeStorage(storageKey, payload);
    return {
      ok: false,
      skipped: false,
      status: 'NO_DETECTADO',
      message: buildUserMessage('NO_DETECTADO'),
      runtime
    };
  }

  let printers = [];
  try {
    printers = await qzPrintService.getPrinters();
  } catch {
    const payload = buildStoredPayload({
      idSucursal: sucursalId,
      idCaja: cajaId,
      idSesionCaja: sesionId,
      printers: [],
      status: 'NO_DETECTADO',
      runtime
    });
    writeStorage(storageKey, payload);
    return {
      ok: false,
      skipped: false,
      status: 'NO_DETECTADO',
      message: buildUserMessage('NO_DETECTADO'),
      runtime
    };
  }

  const normalizedPrinters = [...new Map(
    (Array.isArray(printers) ? printers : [])
      .map((printer) => [normalizePrinterToken(printer), String(printer || '').trim()])
      .filter(([token, value]) => token && value)
  ).values()];

  if (normalizedPrinters.length === 0) {
    const payload = buildStoredPayload({
      idSucursal: sucursalId,
      idCaja: cajaId,
      idSesionCaja: sesionId,
      printers: [],
      status: 'NO_DETECTADO',
      runtime
    });
    writeStorage(storageKey, payload);
    return {
      ok: false,
      skipped: false,
      status: 'NO_DETECTADO',
      message: buildUserMessage('NO_DETECTADO'),
      runtime
    };
  }

  const response = await ventasService.detectPrinterDevice({
    id_sucursal: sucursalId,
    id_caja: cajaId,
    id_sesion_caja: sesionId,
    impresoras_detectadas: normalizedPrinters,
    origen
  });

  const status = String(response?.status || '').trim().toUpperCase() || 'NO_DETECTADO';
  const payload = buildStoredPayload({
    idSucursal: sucursalId,
    idCaja: cajaId,
    idSesionCaja: sesionId,
    printers: normalizedPrinters,
    status,
    runtime: response?.runtime || null
  });
  writeStorage(storageKey, payload);

  return {
    ok: true,
    skipped: false,
    status,
    message: buildUserMessage(status),
    response
  };
};

export const printerDeviceDetectionService = Object.freeze({
  detectPrintersForCaja
});

export default printerDeviceDetectionService;
