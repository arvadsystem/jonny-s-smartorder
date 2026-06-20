import { renderToStaticMarkup } from 'react-dom/server';
import ventasService from '../../../../services/ventasService';
import ComandaCocina80mm, { COMANDA_COCINA_PRINT_CSS } from '../components/ComandaCocina80mm';

export const openPrintWindow = () => {
  if (typeof window === 'undefined') return null;
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.opener = null;
  }
  return printWindow;
};

export const printVentaTicketPdf = async (idFactura, printWindow = openPrintWindow()) => {
  if (!idFactura) return false;
  try {
    const blob = await ventasService.getTicketPdf(idFactura);
    const url = URL.createObjectURL(blob);
    if (printWindow) {
      printWindow.location.href = url;
    } else if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    return true;
  } catch (error) {
    if (printWindow) printWindow.close();
    throw error;
  }
};

export const printComandaCocina = async (comanda) => {
  return printComandaCocinaInWindow(comanda, openPrintWindow());
};

export const printComandaCocinaInWindow = async (comanda, printWindow) => {
  if (!printWindow) {
    throw new Error('El navegador bloqueó la ventana de impresión de la comanda.');
  }

  const html = renderToStaticMarkup(<ComandaCocina80mm comanda={comanda} />);
  printWindow.document.open();
  printWindow.document.write(`
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>Comanda cocina</title>
        <style>${COMANDA_COCINA_PRINT_CSS}</style>
      </head>
      <body>${html}</body>
    </html>
  `);
  printWindow.document.close();

  await new Promise((resolve) => {
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
      resolve();
    };
    window.setTimeout(resolve, 700);
  });

  return true;
};
