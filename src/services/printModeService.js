const VALID_MODES = new Set(['agent', 'direct']);

export const normalizePrintMode = (value) => {
  const mode = String(value || '').trim().toLowerCase();
  return VALID_MODES.has(mode) ? mode : 'direct';
};

const BUILD_PRINT_MODE = normalizePrintMode(import.meta.env?.VITE_PRINT_MODE);

export const PRINT_MODE_BUILD_MARKER = `JONNYS_PRINT_MODE_${BUILD_PRINT_MODE.toUpperCase()}`;
export const getPrintMode = () => BUILD_PRINT_MODE;
export const isAgentPrintMode = () => getPrintMode() === 'agent';
export const isDirectPrintMode = () => getPrintMode() === 'direct';
