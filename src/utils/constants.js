// API base URL — vacío para usar el proxy de Vite en desarrollo
// En producción, setear VITE_API_URL a la URL real del backend.
const DEV_BACKEND_FALLBACK = import.meta.env.VITE_DEV_DIRECT_API_URL || 'http://localhost:3001';
export const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? DEV_BACKEND_FALLBACK : '');
