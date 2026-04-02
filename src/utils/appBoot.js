const APP_STORAGE_SCHEMA_KEY = 'smartorder_storage_schema_version';
const APP_STORAGE_SCHEMA_VERSION = '2026-03-25.1';

const STALE_KEYS_ON_SCHEMA_CHANGE = Object.freeze([
  'smartorder_auth_session_hint',
  'smartorder_auth_bootstrap_state',
  'smartorder_auth_bootstrap_error'
]);

export const bootstrapClientStorage = () => {
  if (typeof window === 'undefined') return;

  try {
    const currentVersion = window.localStorage.getItem(APP_STORAGE_SCHEMA_KEY);
    if (currentVersion === APP_STORAGE_SCHEMA_VERSION) return;

    STALE_KEYS_ON_SCHEMA_CHANGE.forEach((key) => {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // No-op: no bloquear boot por storage inaccesible.
      }
    });

    window.localStorage.setItem(APP_STORAGE_SCHEMA_KEY, APP_STORAGE_SCHEMA_VERSION);
  } catch {
    // No-op: en modo privado/blocked storage no detenemos la app.
  }
};
