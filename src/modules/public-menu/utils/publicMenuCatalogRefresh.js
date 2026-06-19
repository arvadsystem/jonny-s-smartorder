export const PUBLIC_MENU_CATALOG_SNAPSHOT_PREFIX = 'pm_catalog_snapshot::';
export const PUBLIC_MENU_CATALOG_REFRESH_EVENT = 'jonnys:public-menu-catalog-refresh';
export const PUBLIC_MENU_CATALOG_REFRESH_STORAGE_KEY = 'pm_catalog_refresh_signal';

const toBranchId = (value) => Number(value) || 0;

const forEachBrowserStorage = (callback) => {
  if (typeof window === 'undefined') return;
  [window.sessionStorage, window.localStorage].forEach((storage) => {
    if (!storage) return;
    callback(storage);
  });
};

export const buildCatalogSnapshotKey = ({ branchId, orderType }) =>
  `${PUBLIC_MENU_CATALOG_SNAPSHOT_PREFIX}${toBranchId(branchId)}::${String(orderType || 'na').trim().toLowerCase()}`;

export const clearPublicMenuCatalogSnapshots = ({ branchId } = {}) => {
  const normalizedBranchId = toBranchId(branchId);
  const prefix = normalizedBranchId
    ? `${PUBLIC_MENU_CATALOG_SNAPSHOT_PREFIX}${normalizedBranchId}::`
    : PUBLIC_MENU_CATALOG_SNAPSHOT_PREFIX;

  try {
    forEachBrowserStorage((storage) => {
      const keys = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key && key.startsWith(prefix)) keys.push(key);
      }
      keys.forEach((key) => storage.removeItem(key));
    });
  } catch {
    // La limpieza de cache no debe bloquear el guardado ni la lectura del menu publico.
  }
};

export const notifyPublicMenuCatalogChanged = ({ branchId } = {}) => {
  if (typeof window === 'undefined') return;

  const payload = {
    branchId: toBranchId(branchId),
    changedAt: Date.now()
  };

  clearPublicMenuCatalogSnapshots(payload);
  window.dispatchEvent(new CustomEvent(PUBLIC_MENU_CATALOG_REFRESH_EVENT, { detail: payload }));

  try {
    window.localStorage.setItem(PUBLIC_MENU_CATALOG_REFRESH_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Si localStorage no esta disponible, el evento de la pestana actual sigue funcionando.
  }
};
