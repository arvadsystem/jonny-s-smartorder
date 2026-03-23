import { PUBLIC_MENU_STORAGE_KEY } from '../types/publicMenuTypes';

// Reads the persisted flow state safely to avoid runtime crashes from invalid JSON.
export const loadPublicMenuSnapshot = () => {
  if (typeof window === 'undefined') return null;

  try {
    const rawValue = window.localStorage.getItem(PUBLIC_MENU_STORAGE_KEY);
    if (!rawValue) return null;
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
};

// Persists only serializable data in localStorage.
export const savePublicMenuSnapshot = (snapshot) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(PUBLIC_MENU_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // If persistence fails we continue with in-memory state.
  }
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

