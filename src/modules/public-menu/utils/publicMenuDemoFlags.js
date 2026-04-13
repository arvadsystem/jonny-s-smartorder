// Flag temporal de demo visual:
// cuando esta activo, el frontend deja de pintar items como "Agotado".
const FORCE_AVAILABLE_STORAGE_KEY = 'pm_force_available_demo';

export const isPublicMenuForceAvailableDemoEnabled = () => {
  if (typeof window === 'undefined') return false;

  try {
    return String(window.localStorage.getItem(FORCE_AVAILABLE_STORAGE_KEY) || '') === '1';
  } catch {
    return false;
  }
};

export const PUBLIC_MENU_DEMO_FLAGS = Object.freeze({
  FORCE_AVAILABLE_STORAGE_KEY
});
