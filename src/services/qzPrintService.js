import { apiFetch } from './api';

const QZ_LIBRARY_SOURCES = [
  import.meta.env.VITE_QZ_TRAY_SCRIPT_URL,
  '/vendor/qz-tray.js',
  'https://cdn.jsdelivr.net/npm/qz-tray@2.2.6/qz-tray.js',
  'https://unpkg.com/qz-tray@2.2.6/qz-tray.js'
].filter(Boolean);

let qzLoadPromise = null;
let qzSecuritySetupPromise = null;

const createQzError = (code, message, cause = null) => {
  const error = new Error(message);
  error.name = 'QzPrintError';
  error.code = code;
  if (cause) error.cause = cause;
  return error;
};

const toBrowserQz = () => {
  if (typeof window === 'undefined') return null;
  return window.qz || null;
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
  const existing = toBrowserQz();
  if (existing) return existing;

  if (!qzLoadPromise) {
    qzLoadPromise = (async () => {
      let lastError = null;
      for (const source of QZ_LIBRARY_SOURCES) {
        try {
          await injectQzScript(source);
          const qz = toBrowserQz();
          if (qz) return qz;
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

const setupQzSecurity = async (qz) => {
  if (qzSecuritySetupPromise) return qzSecuritySetupPromise;

  qzSecuritySetupPromise = (async () => {
    try {
      const certificateResponse = await apiFetch('/ventas/qz/certificate', 'GET');
      const certificate = String(certificateResponse?.certificate || '').trim();
      if (!certificate) return false;

      qz.security.setCertificatePromise((resolve) => resolve(certificate));
      qz.security.setSignatureAlgorithm('SHA512');
      qz.security.setSignaturePromise((toSign) => async (resolve, reject) => {
        try {
          const response = await apiFetch('/ventas/qz/sign', 'POST', { request: toSign });
          const signature = String(response?.signature || '').trim();
          if (!signature) {
            reject(new Error('Firma vacia para QZ Tray.'));
            return;
          }
          resolve(signature);
        } catch (error) {
          reject(error);
        }
      });
      return true;
    } catch (error) {
      if (Number(error?.status || 0) !== 503 && Number(error?.status || 0) !== 404) {
        console.warn('[QZ] No se pudo configurar la firma segura.', error);
      }
      return false;
    }
  })();

  return qzSecuritySetupPromise;
};

const ensureConnectedQz = async () => {
  const qz = await ensureQzLibrary();
  await setupQzSecurity(qz);
  if (qz.websocket.isActive()) return qz;

  try {
    await qz.websocket.connect({
      retries: 1,
      delay: 0,
      usingSecure: true
    });
  } catch (error) {
    throw createQzError(
      'QZ_NOT_CONNECTED',
      'No se pudo establecer conexion con QZ Tray.',
      error
    );
  }

  return qz;
};

const normalizePrinterName = (value) => String(value || '').trim();

const buildPixelConfig = (qz, printerName, options = {}) =>
  qz.configs.create(printerName, {
    copies: Math.max(1, Number(options.copies || 1)),
    jobName: String(options.jobName || 'Jonny SmartOrder').trim() || 'Jonny SmartOrder',
    margins: 0,
    scaleContent: false,
    units: 'mm'
  });

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
    return Boolean(qz.websocket.isActive());
  } catch {
    return false;
  }
};

export const connectQz = async () => ensureConnectedQz();

export const disconnectQz = async () => {
  const qz = toBrowserQz();
  if (!qz?.websocket?.isActive?.()) return false;
  await qz.websocket.disconnect();
  return true;
};

export const getPrinters = async () => {
  const qz = await ensureConnectedQz();
  const printers = await qz.printers.find();
  return Array.isArray(printers)
    ? printers.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
};

export const findPrinter = async (printerName) => {
  const exactName = normalizePrinterName(printerName);
  if (!exactName) {
    throw createQzError('PRINTER_NOT_FOUND', 'No se configuro un nombre de impresora.');
  }

  const printers = await getPrinters();
  const exactMatch = printers.find((item) => item.toLowerCase() === exactName.toLowerCase());
  if (!exactMatch) {
    throw createQzError('PRINTER_NOT_FOUND', `No se encontro la impresora "${exactName}".`);
  }
  return exactMatch;
};

export const findPrinterByContains = async (text) => {
  const query = normalizePrinterName(text).toLowerCase();
  if (!query) return null;
  const printers = await getPrinters();
  return printers.find((item) => item.toLowerCase().includes(query)) || null;
};

export const testQzConnection = async () => {
  const qz = await ensureConnectedQz();
  return {
    connected: Boolean(qz.websocket.isActive()),
    info: typeof qz.websocket.getConnectionInfo === 'function'
      ? qz.websocket.getConnectionInfo()
      : null,
    printers: await getPrinters()
  };
};

export const printHtmlToPrinter = async ({
  printerName,
  html,
  copies = 1,
  widthMm = 80,
  jobName = 'Jonny SmartOrder'
}) => {
  const qz = await ensureConnectedQz();
  const resolvedPrinter = await findPrinter(printerName);
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
    throw createQzError('PRINT_FAILED', 'No se pudo imprimir el HTML con QZ Tray.', error);
  }
};

export const printPdfBlobToPrinter = async ({
  printerName,
  blob,
  copies = 1,
  jobName = 'Jonny SmartOrder'
}) => {
  const qz = await ensureConnectedQz();
  const resolvedPrinter = await findPrinter(printerName);
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
    throw createQzError('PRINT_FAILED', 'No se pudo imprimir el PDF con QZ Tray.', error);
  }
};

export const printRawEscPos = async ({
  printerName,
  commands,
  copies = 1,
  jobName = 'Jonny SmartOrder'
}) => {
  const qz = await ensureConnectedQz();
  const resolvedPrinter = await findPrinter(printerName);
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
    throw createQzError('PRINT_FAILED', 'No se pudo imprimir en modo RAW con QZ Tray.', error);
  }
};

const qzPrintService = {
  connectQz,
  disconnectQz,
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
