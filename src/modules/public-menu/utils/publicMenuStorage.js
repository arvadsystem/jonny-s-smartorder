import { PUBLIC_MENU_STORAGE_KEY } from '../types/publicMenuTypes';

// Reads the persisted flow state safely to avoid runtime crashes from invalid JSON.
export const loadPublicMenuSnapshot = () => {
  // Cache local deshabilitado: el flujo publico siempre debe iniciar fresco.
  return null;
};

// Persists only serializable data in localStorage.
export const savePublicMenuSnapshot = (snapshot) => {
  // Cache local deshabilitado intencionalmente.
  void snapshot;
};

// Removes any stale flow data when the user restarts.
export const clearPublicMenuSnapshot = () => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(PUBLIC_MENU_STORAGE_KEY);
  } catch {
    // Ignore clear errors.
  }
};
