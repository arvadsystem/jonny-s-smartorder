import { useCallback, useEffect, useMemo, useState } from 'react';
import { publicMenuBootstrapService } from '../services/publicMenuBootstrapService';
import { toPublicMenuUiErrorMessage } from '../utils/publicMenuApiError';
import {
  buildCatalogSnapshotKey,
  clearPublicMenuCatalogSnapshots,
  PUBLIC_MENU_CATALOG_REFRESH_EVENT,
  PUBLIC_MENU_CATALOG_REFRESH_STORAGE_KEY
} from '../utils/publicMenuCatalogRefresh';

const CATALOG_SNAPSHOT_TTL_MS = 10 * 60 * 1000;
const CATALOG_PERSISTENT_SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;

const readStorageSnapshot = (storage, key, ttlMs) => {
  if (!storage) return null;
  const raw = storage.getItem(key);
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  if (!parsed?.savedAt || !parsed?.payload) return null;
  if (Date.now() - Number(parsed.savedAt) > ttlMs) return null;
  return parsed.payload;
};

const readCatalogSnapshot = (key) => {
  if (typeof window === 'undefined') return null;
  try {
    return (
      readStorageSnapshot(window.sessionStorage, key, CATALOG_SNAPSHOT_TTL_MS) ||
      readStorageSnapshot(window.localStorage, key, CATALOG_PERSISTENT_SNAPSHOT_TTL_MS)
    );
  } catch {
    return null;
  }
};

const writeCatalogSnapshot = (key, payload) => {
  if (typeof window === 'undefined') return;
  try {
    const value = JSON.stringify({
      savedAt: Date.now(),
      payload
    });
    window.sessionStorage.setItem(key, value);
    window.localStorage.setItem(key, value);
  } catch {
    // Si sessionStorage falla (quota/politicas), no bloqueamos el flujo de menu.
  }
};

// Normaliza texto para comparaciones de busqueda sin acentos.
const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

// Unifica etiquetas largas/equivalentes para el carrusel de categorias.
const toCategoryBucket = (rawCategoryName) => {
  const normalized = normalizeText(rawCategoryName).replace(/\s*\/\s*/g, '/');

  if (normalized.includes('snack')) {
    return 'Snacks';
  }

  if (normalized.includes('helado')) {
    return 'Helados';
  }

  if (normalized.includes('cerveza')) {
    return 'Cervezas';
  }

  if (
    normalized === 'refrescos/agua' ||
    normalized === 'gaseosas y refrescos' ||
    normalized === 'gaseosas/refrescos' ||
    normalized === 'aguas, isotonicos y energeticas' ||
    normalized === 'aguas isotonicos y energeticas' ||
    normalized.includes('refresco') ||
    normalized.includes('gaseosa') ||
    normalized.includes('isotonico') ||
    normalized.includes('energetica') ||
    normalized.startsWith('agua')
  ) {
    return 'Refrescos / Agua';
  }

  return String(rawCategoryName || '').trim() || 'Sin categoria';
};

const getProductCategoryBucket = (product) => {
  const productCategory = product?.categoria?.nombre_producto;
  const productBucket = toCategoryBucket(productCategory);

  if (productBucket === 'Snacks' || productBucket === 'Helados') {
    return productBucket;
  }

  return toCategoryBucket(product?.categoria?.nombre);
};

const productTextIncludesAny = (product, keywords = []) => {
  const text = normalizeText(
    [
      product?.categoria?.nombre,
      product?.categoria?.nombre_producto,
      product?.nombre,
      product?.descripcion
    ].filter(Boolean).join(' ')
  );

  return keywords.some((keyword) => text.includes(keyword));
};

const isProductAvailable = (product) => Boolean(product?.disponibilidad?.available);

const matchesCatalogFilters = ({ product, selectedCategory, normalizedSearch }) => {
  const productCategory = getProductCategoryBucket(product);
  const selectedBucket = toCategoryBucket(selectedCategory);
  const sameCategory =
    productCategory === selectedBucket ||
    normalizeText(productCategory).replace(/\s*\/\s*/g, '/') ===
      normalizeText(selectedBucket).replace(/\s*\/\s*/g, '/');

  const inCategory =
    selectedCategory === 'all' ||
    sameCategory ||
    (
      selectedBucket === 'Cervezas' &&
      productTextIncludesAny(product, ['cerveza', 'barena', 'coors', 'corona', 'gallo', 'imperial'])
    ) ||
    (
      selectedBucket === 'Refrescos / Agua' &&
      productTextIncludesAny(product, [
        'refresco',
        'gaseosa',
        'agua',
        'isotonico',
        'energetica',
        'banana',
        'pepsi',
        'coca',
        'mirinda',
        'fresca'
      ])
    ) ||
    (
      selectedBucket === 'Snacks' &&
      productTextIncludesAny(product, ['snack', 'snacks'])
    ) ||
    (
      selectedBucket === 'Helados' &&
      productTextIncludesAny(product, ['helado', 'helados'])
    );
  if (!inCategory) return false;

  if (!normalizedSearch) return true;
  const name = normalizeText(product.nombre);
  const description = normalizeText(product.descripcion);
  return name.includes(normalizedSearch) || description.includes(normalizedSearch);
};

// Hook real de catalogo publico conectado al backend.
export const useCatalogProducts = ({ branchId, orderType }) => {
  const [products, setProducts] = useState([]);
  const [menuSummary, setMenuSummary] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncWarning, setSyncWarning] = useState('');

  // Carga catalogo real por sucursal y tipo de pedido.
  const loadCatalog = useCallback(async ({ forceRefresh = false } = {}) => {
    if (!branchId) {
      setProducts([]);
      setMenuSummary(null);
      setSyncWarning('');
      setLoading(false);
      return;
    }

    if (forceRefresh) clearPublicMenuCatalogSnapshots({ branchId });

    const snapshotKey = buildCatalogSnapshotKey({ branchId, orderType });
    const snapshot = forceRefresh ? null : readCatalogSnapshot(snapshotKey);
    const hasSnapshot = Boolean(snapshot && Array.isArray(snapshot.items));

    try {
      // Si hay snapshot reciente, lo pintamos al instante para evitar espera percibida.
      if (hasSnapshot) {
        setProducts(snapshot.items || []);
        setMenuSummary(snapshot.menu || null);
        setLoading(false);
      } else {
        setLoading(true);
      }
      setError('');
      setSyncWarning('');

      const response = await publicMenuBootstrapService.getCatalog({
        idSucursal: branchId,
        orderType,
        forceRefresh
      });

      setProducts(Array.isArray(response?.items) ? response.items : []);
      setMenuSummary(response?.menu || null);
      writeCatalogSnapshot(snapshotKey, response);
    } catch (err) {
      const offline = typeof window !== 'undefined' && window.navigator?.onLine === false;
      const fallbackMessage = offline
        ? 'No hay conexion a internet. Verifica tu red e intenta nuevamente.'
        : 'No pudimos cargar el catalogo.';

      // Si ya mostramos snapshot, evitamos tumbar la pantalla por un error puntual de red.
      if (hasSnapshot) {
        setSyncWarning(
          offline
            ? 'Estas viendo una version guardada del menu por falta de conexion.'
            : 'Mostramos una version reciente del menu mientras se restablece la conexion.'
        );
      } else {
        setProducts([]);
        setMenuSummary(null);
        setError(toPublicMenuUiErrorMessage(err, fallbackMessage));
      }
    } finally {
      // Si hubo snapshot, la UI ya se mantenia visible; evitamos overlay de carga tardio.
      if (!hasSnapshot) setLoading(false);
    }
  }, [branchId, orderType]);

  // Re-carga cuando cambia contexto base (sucursal/tipo pedido).
  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (!branchId) return undefined;

    const shouldRefresh = (payload) => {
      const changedBranchId = Number(payload?.branchId || 0);
      return !changedBranchId || changedBranchId === Number(branchId);
    };

    const handleCatalogRefresh = (event) => {
      if (!shouldRefresh(event?.detail)) return;
      void loadCatalog({ forceRefresh: true });
    };

    const handleStorage = (event) => {
      if (event.key !== PUBLIC_MENU_CATALOG_REFRESH_STORAGE_KEY || !event.newValue) return;
      try {
        const payload = JSON.parse(event.newValue);
        if (!shouldRefresh(payload)) return;
        void loadCatalog({ forceRefresh: true });
      } catch {
        void loadCatalog({ forceRefresh: true });
      }
    };

    window.addEventListener(PUBLIC_MENU_CATALOG_REFRESH_EVENT, handleCatalogRefresh);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(PUBLIC_MENU_CATALOG_REFRESH_EVENT, handleCatalogRefresh);
      window.removeEventListener('storage', handleStorage);
    };
  }, [branchId, loadCatalog]);

  const availableProducts = useMemo(
    () => products.filter((product) => isProductAvailable(product)),
    [products]
  );

  // Categorias dinamicas desde productos disponibles para no dejar pestañas vacias.
  const categories = useMemo(() => {
    const unique = new Set(
      products.map((product) => getProductCategoryBucket(product))
    );
    return ['all', ...Array.from(unique)];
  }, [products]);

  // Filtrado por categoria y termino libre, ocultando agotados del menu publico.
  const filteredProducts = useMemo(() => {
    const normalizedSearch = normalizeText(searchTerm);

    return products
      .map((product, index) => ({ product, index }))
      .filter(({ product }) =>
        matchesCatalogFilters({ product, selectedCategory, normalizedSearch })
      )
      .sort((left, right) => {
        const leftAvailable = isProductAvailable(left.product);
        const rightAvailable = isProductAvailable(right.product);
        if (leftAvailable !== rightAvailable) return leftAvailable ? -1 : 1;
        return left.index - right.index;
      })
      .map(({ product }) => product);
  }, [products, searchTerm, selectedCategory]);

  // Estadisticas de productos visibles; los agotados ya no se muestran al cliente.
  const stats = useMemo(() => {
    const availableCount = filteredProducts.filter((product) => isProductAvailable(product)).length;
    const soldOutCount = filteredProducts.length - availableCount;
    return {
      total: filteredProducts.length,
      available: availableCount,
      soldOut: soldOutCount,
      allFilteredSoldOut: filteredProducts.length > 0 && availableCount === 0
    };
  }, [filteredProducts]);

  return {
    products,
    availableProducts,
    filteredProducts,
    categories,
    menuSummary,
    searchTerm,
    selectedCategory,
    loading,
    error,
    syncWarning,
    stats,
    setSearchTerm,
    setSelectedCategory,
    reloadCatalog: loadCatalog
  };
};
