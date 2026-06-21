import ventasService from '../../../../services/ventasService';
import qzPrintService from '../../../../services/qzPrintService';
import buildComandaCocinaHtml from './buildComandaCocinaHtml';

const PRINT_WINDOW_FEATURES = 'width=420,height=760,resizable=yes,scrollbars=yes';
const PRINT_FALLBACK_DELAY_MS = 320;
const PRINT_CLOSE_DELAY_MS = 180;
const PRINT_CLOSE_ON_FOCUS_DELAY_MS = 700;
const PRINT_PDF_BOOT_DELAY_MS = 450;

const buildPrintWindowLoadingHtml = (title = 'Preparando documento') => `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Arial, sans-serif;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #f7f3ee;
        color: #3b2a22;
      }
      .print-loading {
        width: min(320px, calc(100vw - 32px));
        padding: 24px;
        border-radius: 16px;
        background: #fff;
        box-shadow: 0 12px 30px rgba(59, 42, 34, 0.12);
        text-align: center;
      }
      .print-loading strong {
        display: block;
        margin-bottom: 8px;
        font-size: 16px;
      }
      .print-loading span {
        color: #7b6659;
        font-size: 14px;
      }
    </style>
  </head>
  <body>
    <div class="print-loading">
      <strong>${title}</strong>
      <span>Preparando vista previa...</span>
    </div>
  </body>
</html>`;

const writeWindowDocument = (targetWindow, html) => {
  targetWindow.document.open();
  targetWindow.document.write(html);
  targetWindow.document.close();
};

const schedulePrintWindowClose = (printWindow, delayMs = PRINT_CLOSE_DELAY_MS) => {
  if (!printWindow || printWindow.closed || typeof window === 'undefined') return;
  window.setTimeout(() => {
    try {
      if (!printWindow.closed) printWindow.close();
    } catch {
      // Ignorar errores de cierre del navegador.
    }
  }, delayMs);
};

const attachPrintWindowAutoClose = (printWindow) => {
  if (!printWindow) return () => {};

  let closeRequested = false;

  const requestClose = () => {
    if (closeRequested) return;
    closeRequested = true;
    schedulePrintWindowClose(printWindow);
  };

  const handleAfterPrint = () => requestClose();
  const handleFocus = () => {
    if (!closeRequested) {
      schedulePrintWindowClose(printWindow, PRINT_CLOSE_ON_FOCUS_DELAY_MS);
    }
  };

  try {
    if (typeof printWindow.addEventListener === 'function') {
      printWindow.addEventListener('afterprint', handleAfterPrint, { once: true });
      printWindow.addEventListener('focus', handleFocus, { once: true });
    }
  } catch {
    // Fallback a onafterprint abajo.
  }

  try {
    printWindow.onafterprint = handleAfterPrint;
  } catch {
    // Algunos navegadores restringen la asignacion directa.
  }

  return () => {
    try {
      if (typeof printWindow.removeEventListener === 'function') {
        printWindow.removeEventListener('afterprint', handleAfterPrint);
        printWindow.removeEventListener('focus', handleFocus);
      }
    } catch {
      // noop
    }
  };
};

const buildPdfPrintShellHtml = (url, title = 'Factura') => `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      html, body {
        margin: 0;
        height: 100%;
        background: #2d2d2d;
      }
      iframe {
        width: 100%;
        height: 100%;
        border: 0;
        background: #fff;
      }
    </style>
  </head>
  <body>
    <iframe id="ticket-pdf-frame" title="${title}" src="${url}#toolbar=0&navpanes=0&scrollbar=0"></iframe>
    <script>
      (function () {
        var printed = false;
        var closeTimer = null;
        var closeWindow = function () {
          if (closeTimer) return;
          closeTimer = window.setTimeout(function () {
            try { window.close(); } catch (error) {}
          }, ${PRINT_CLOSE_DELAY_MS});
        };
        var printFrame = function () {
          if (printed) return;
          printed = true;
          var frame = document.getElementById('ticket-pdf-frame');
          try {
            if (frame && frame.contentWindow) {
              frame.contentWindow.focus();
              frame.contentWindow.print();
              return;
            }
          } catch (error) {}
          try {
            window.focus();
            window.print();
          } catch (error) {}
        };
        window.addEventListener('afterprint', closeWindow, { once: true });
        window.addEventListener('focus', function () {
          if (printed) {
            window.setTimeout(closeWindow, ${PRINT_CLOSE_ON_FOCUS_DELAY_MS});
          }
        }, { once: true });
        var frame = document.getElementById('ticket-pdf-frame');
        if (frame) {
          frame.addEventListener('load', function () {
            window.setTimeout(printFrame, ${PRINT_PDF_BOOT_DELAY_MS});
          }, { once: true });
        } else {
          window.setTimeout(printFrame, ${PRINT_PDF_BOOT_DELAY_MS});
        }
      })();
    </script>
  </body>
</html>`;

const ensurePrintWindow = (printWindow, title) => {
  if (!printWindow || printWindow.closed) {
    throw new Error('La ventana de impresion no esta disponible. Revisa las ventanas emergentes e intenta nuevamente.');
  }

  try {
    writeWindowDocument(printWindow, buildPrintWindowLoadingHtml(title));
    printWindow.focus();
  } catch {
    // Algunos navegadores permiten reutilizar la ventana pero restringen el acceso inicial al documento.
  }

  return printWindow;
};

export const openPrintWindow = (title = 'Preparando documento') => {
  if (typeof window === 'undefined') return null;
  const printWindow = window.open('', '_blank', PRINT_WINDOW_FEATURES);
  if (!printWindow) return null;
  return ensurePrintWindow(printWindow, title);
};

export const printVentaTicketPdf = async (idFactura, printWindow = openPrintWindow('Preparando factura')) => {
  if (!idFactura) return false;

  try {
    if (printWindow) ensurePrintWindow(printWindow, 'Preparando factura');
    const blob = await ventasService.getTicketPdf(idFactura);
    const url = URL.createObjectURL(blob);

    if (printWindow && !printWindow.closed) {
      try {
        writeWindowDocument(printWindow, buildPdfPrintShellHtml(url, 'Factura de venta'));
        printWindow.focus();
      } catch {
        window.open(url, '_blank');
      }
    } else if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }

    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    return true;
  } catch (error) {
    if (printWindow && !printWindow.closed) printWindow.close();
    throw error;
  }
};

export const printHtmlDocument = async (html, options = {}) => {
  const title = String(options.title || 'Documento para imprimir').trim() || 'Documento para imprimir';
  const printWindow = options.printWindow || openPrintWindow(title);

  if (!printWindow) {
    throw new Error('El navegador bloqueo la ventana de impresion. Permite ventanas emergentes para continuar.');
  }

  const safeHtml = String(html || '').trim();
  if (!safeHtml) {
    printWindow.close();
    throw new Error('No se pudo generar el documento imprimible de la comanda.');
  }

  ensurePrintWindow(printWindow, title);

  return new Promise((resolve, reject) => {
    let finished = false;
    let printInvoked = false;
    const detachAutoClose = attachPrintWindowAutoClose(printWindow);

    const finalize = (callback) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(fallbackTimer);
      callback();
    };

    const triggerPrint = () => {
      if (finished || printInvoked) return;
      printInvoked = true;

      try {
        printWindow.document.title = title;
        printWindow.focus();
        if (typeof printWindow.print !== 'function') {
          throw new Error('La impresion no esta disponible en este navegador.');
        }
        printWindow.print();
        finalize(() => resolve(true));
      } catch (error) {
        detachAutoClose();
        finalize(() => reject(error));
      }
    };

    const fallbackTimer = window.setTimeout(triggerPrint, PRINT_FALLBACK_DELAY_MS);

    try {
      printWindow.onload = triggerPrint;
      writeWindowDocument(printWindow, safeHtml);
    } catch (error) {
      detachAutoClose();
      finalize(() => reject(error));
    }
  });
};

export const printComandaCocina = async (comanda) => printComandaCocinaInWindow(comanda, openPrintWindow('Preparando comanda'));

export const printComandaCocinaInWindow = async (comanda, printWindow) => {
  const html = buildComandaCocinaHtml(comanda);
  return printHtmlDocument(html, {
    title: 'Comanda cocina',
    printWindow
  });
};

const resolveWidthMm = (value, fallback = 80) => Number(value) === 58 ? 58 : fallback;

export const printVentaTicketWithQz = async (idFactura, printerConfig = {}) => {
  const printerName = String(printerConfig?.nombre_impresora_sistema || '').trim();
  if (!printerName) {
    throw new Error('No hay una impresora FACTURA configurada para QZ Tray.');
  }

  const pdfBlob = await ventasService.getTicketPdf(idFactura);
  return qzPrintService.printPdfBlobToPrinter({
    printerName,
    blob: pdfBlob,
    copies: 1,
    jobName: `Factura ${idFactura}`
  });
};

export const printComandaCocinaWithQz = async (comanda, printerConfig = {}) => {
  const printerName = String(printerConfig?.nombre_impresora_sistema || '').trim();
  if (!printerName) {
    throw new Error('No hay una impresora COCINA configurada para QZ Tray.');
  }

  const html = buildComandaCocinaHtml(comanda);
  const widthMm = resolveWidthMm(printerConfig?.ancho_mm, 80);
  const mode = String(printerConfig?.modo_impresion || 'QZ_HTML').trim().toUpperCase();

  if (mode === 'QZ_RAW') {
    throw new Error('QZ_RAW para comanda aun no esta habilitado en este flujo.');
  }

  return qzPrintService.printHtmlToPrinter({
    printerName,
    html,
    widthMm,
    copies: 1,
    jobName: `Comanda ${comanda?.numero_pedido || comanda?.numero_venta || comanda?.id_pedido || ''}`.trim()
  });
};
