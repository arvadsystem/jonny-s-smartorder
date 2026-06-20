import ventasService from '../../../../services/ventasService';
import buildComandaCocinaHtml from './buildComandaCocinaHtml';

const PRINT_WINDOW_FEATURES = 'width=420,height=760,resizable=yes,scrollbars=yes';
const PRINT_FALLBACK_DELAY_MS = 320;

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
        printWindow.location.replace(url);
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
        finalize(() => reject(error));
      }
    };

    const fallbackTimer = window.setTimeout(triggerPrint, PRINT_FALLBACK_DELAY_MS);

    try {
      printWindow.onload = triggerPrint;
      writeWindowDocument(printWindow, safeHtml);
    } catch (error) {
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
