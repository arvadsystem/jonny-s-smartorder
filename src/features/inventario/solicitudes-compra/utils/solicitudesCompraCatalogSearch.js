export const createCatalogSearchController = ({
  getWarehouseId,
  loadCatalog,
  delay = 300,
  scheduleTimer = setTimeout,
  cancelTimer = clearTimeout
}) => {
  const filters = { search: '', type: '', scope: 'all' };
  let pendingTimer = null;
  let resolveWarehouseId = getWarehouseId;
  let executeLoad = loadCatalog;

  const cancelPending = () => {
    if (pendingTimer !== null) cancelTimer(pendingTimer);
    pendingTimer = null;
  };

  const options = (page = 1) => ({
    id_almacen: resolveWarehouseId(),
    buscar: filters.search.trim(),
    tipo: filters.type,
    ...(filters.scope === 'low' ? { solo_stock_bajo: 'true' } : {}),
    page
  });

  const request = (page = 1) => {
    cancelPending();
    return executeLoad(options(page));
  };

  return {
    changeSearch(value) {
      filters.search = String(value ?? '');
      cancelPending();
      pendingTimer = scheduleTimer(() => {
        pendingTimer = null;
        void executeLoad(options(1));
      }, delay);
    },
    submit: () => request(1),
    escape() {
      filters.search = '';
      return request(1);
    },
    changeType(value) {
      filters.type = String(value ?? '');
      return request(1);
    },
    changeScope(value) {
      filters.scope = value === 'low' ? 'low' : 'all';
      return request(1);
    },
    clear() {
      filters.search = '';
      filters.type = '';
      filters.scope = 'all';
      return request(1);
    },
    page: (page) => request(page),
    setContext(next) {
      if (typeof next?.getWarehouseId === 'function') resolveWarehouseId = next.getWarehouseId;
      if (typeof next?.loadCatalog === 'function') executeLoad = next.loadCatalog;
    },
    dispose: cancelPending,
    snapshot: () => ({ ...filters })
  };
};
