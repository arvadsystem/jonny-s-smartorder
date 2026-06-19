// API base URL — vacio para usar el proxy de Vite en desarrollo.
// En produccion, setear VITE_API_URL a la URL real del backend.
const normalizeBaseUrl = (value) => String(value || '').trim().replace(/\/+$/, '');
export const API_URL = normalizeBaseUrl(import.meta.env.VITE_API_URL || '');
