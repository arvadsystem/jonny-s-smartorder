const VALID_MODES = new Set(['agent', 'direct']);

export const normalizePrintMode = (value) => {
  const mode = String(value || '').trim().toLowerCase();
  return VALID_MODES.has(mode) ? mode : 'direct';
};

export const getPrintMode = () => normalizePrintMode(import.meta.env.VITE_PRINT_MODE);
export const isAgentPrintMode = () => getPrintMode() === 'agent';
export const isDirectPrintMode = () => getPrintMode() === 'direct';
