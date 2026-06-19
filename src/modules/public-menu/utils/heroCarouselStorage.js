const HERO_CAROUSEL_STORAGE_KEY = 'pm_admin_hero_carousel_v1';
const GLOBAL_BRANCH_KEY = '0';

const parseConfig = (rawValue) => {
  if (!rawValue) return { byBranch: {}, customByBranch: {} };

  try {
    const parsed = JSON.parse(rawValue);
    const byBranch = parsed && typeof parsed === 'object' && parsed.byBranch && typeof parsed.byBranch === 'object'
      ? parsed.byBranch
      : {};
    const customByBranch =
      parsed && typeof parsed === 'object' && parsed.customByBranch && typeof parsed.customByBranch === 'object'
        ? parsed.customByBranch
        : {};
    return { byBranch, customByBranch };
  } catch {
    return { byBranch: {}, customByBranch: {} };
  }
};

const toBranchKey = (branchId) => String(Number(branchId || 0) || 0);

// Lee configuracion del carrusel guardada por admin para una sucursal especifica.
export const getHeroCarouselSelectionByBranch = (branchId) => {
  if (typeof window === 'undefined') return [];
  const config = parseConfig(window.localStorage.getItem(HERO_CAROUSEL_STORAGE_KEY));
  const branchKey = toBranchKey(branchId);
  const ids = config.byBranch?.[branchKey] ?? config.byBranch?.[GLOBAL_BRANCH_KEY];
  return Array.isArray(ids) ? ids.map((value) => Number(value || 0)).filter((value) => value > 0) : [];
};

// Guarda la lista ordenada de id_detalle_menu que deben aparecer en el hero para una sucursal.
export const saveHeroCarouselSelectionByBranch = (branchId, ids = []) => {
  if (typeof window === 'undefined') return;
  const config = parseConfig(window.localStorage.getItem(HERO_CAROUSEL_STORAGE_KEY));
  const branchKey = toBranchKey(branchId);
  const normalizedIds = Array.isArray(ids)
    ? ids.map((value) => Number(value || 0)).filter((value) => value > 0)
    : [];

  const next = {
    byBranch: {
      ...(config.byBranch || {}),
      [branchKey]: normalizedIds
    },
    customByBranch: {
      ...(config.customByBranch || {})
    },
  };

  window.localStorage.setItem(HERO_CAROUSEL_STORAGE_KEY, JSON.stringify(next));
};

// Lee imagenes personalizadas (subidas manualmente) del carrusel por sucursal.
export const getHeroCarouselCustomImagesByBranch = (branchId) => {
  if (typeof window === 'undefined') return [];
  const config = parseConfig(window.localStorage.getItem(HERO_CAROUSEL_STORAGE_KEY));
  const branchKey = toBranchKey(branchId);
  const rows = config.customByBranch?.[branchKey] ?? config.customByBranch?.[GLOBAL_BRANCH_KEY];
  return Array.isArray(rows)
    ? rows
      .map((row, index) => ({
        id: String(row?.id || `custom-${index}`),
        imageUrl: String(row?.imageUrl || '').trim(),
        title: String(row?.title || '').trim(),
      }))
      .filter((row) => Boolean(row.imageUrl))
    : [];
};

// Guarda imagenes personalizadas del carrusel por sucursal.
export const saveHeroCarouselCustomImagesByBranch = (branchId, rows = []) => {
  if (typeof window === 'undefined') return;
  const config = parseConfig(window.localStorage.getItem(HERO_CAROUSEL_STORAGE_KEY));
  const branchKey = toBranchKey(branchId);
  const normalizedRows = Array.isArray(rows)
    ? rows
      .map((row, index) => ({
        id: String(row?.id || `custom-${Date.now()}-${index}`),
        imageUrl: String(row?.imageUrl || '').trim(),
        title: String(row?.title || '').trim(),
      }))
      .filter((row) => Boolean(row.imageUrl))
    : [];

  const next = {
    byBranch: {
      ...(config.byBranch || {})
    },
    customByBranch: {
      ...(config.customByBranch || {}),
      [branchKey]: normalizedRows
    },
  };

  window.localStorage.setItem(HERO_CAROUSEL_STORAGE_KEY, JSON.stringify(next));
};

// Modo global: una sola configuracion del landing para todas las sucursales.
export const getGlobalHeroCarouselSelection = () => getHeroCarouselSelectionByBranch(0);
export const saveGlobalHeroCarouselSelection = (ids = []) => saveHeroCarouselSelectionByBranch(0, ids);
export const getGlobalHeroCarouselCustomImages = () => getHeroCarouselCustomImagesByBranch(0);
export const saveGlobalHeroCarouselCustomImages = (rows = []) => saveHeroCarouselCustomImagesByBranch(0, rows);
