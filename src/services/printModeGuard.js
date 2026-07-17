import { getPrintMode, normalizePrintMode, PRINT_MODE_BUILD_MARKER } from './printModeService.js';

export const assertBrowserQzAllowed = (mode = getPrintMode()) => {
  if (normalizePrintMode(mode) !== 'agent') return true;
  const error = new Error(`QZ Tray esta deshabilitado en el navegador (${PRINT_MODE_BUILD_MARKER}).`);
  error.name = 'QzPrintError';
  error.code = 'QZ_DISABLED_IN_AGENT_MODE';
  throw error;
};
