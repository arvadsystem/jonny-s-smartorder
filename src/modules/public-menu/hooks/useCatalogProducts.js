import { useCallback, useEffect, useMemo, useState } from 'react';
import { publicMenuBootstrapService } from '../services/publicMenuBootstrapService';
import { toPublicMenuUiErrorMessage } from '../utils/publicMenuApiError';

const CATALOG_SNAPSHOT_TTL_MS = 10 * 60 * 1000;
const CATALOG_PERSISTENT_SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;

const buildSnapshotKey = ({ branchId, orderType }) =>
  `pm_catalog_snapshot::${Number(branchId) || 0}::${String(orderType || 'na').trim().toLowerCase()}`;

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

const productTextIncludesAny = (product, keywords = []) => {
  const text = normalizeText(
    [
      product?.categoria?.nombre,
      product?.nombre,
      product?.descripcion
    ].filter(Boolean).join(' ')
  );

  return keywords.some((keyword) => text.includes(keyword));
};

const isProductAvailable = (product) => Boolean(product?.disponibilidad?.available);

const matchesCatalogFilters = ({ product, selectedCategory, normalizedSearch }) => {
  const productCategory = toCategoryBucket(product?.categoria?.nombre);
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
  const loadCatalog = useCallback(async () => {
    if (!branchId) {
      setProducts([]);
      setMenuSummary(null);
      setSyncWarning('');
      setLoading(false);
      return;
    }

    const snapshotKey = buildSnapshotKey({ branchId, orderType });
    const snapshot = readCatalogSnapshot(snapshotKey);
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
        orderType
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

  const availableProducts = useMemo(
    () => products.filter((product) => isProductAvailable(product)),
    [products]
  );

  // Categorias dinamicas desde productos disponibles para no dejar pestañas vacias.
  const categories = useMemo(() => {
    const unique = new Set(
      availableProducts.map((product) => toCategoryBucket(product?.categoria?.nombre))
    );
    return ['all', ...Array.from(unique)];
  }, [availableProducts]);

  // Filtrado por categoria y termino libre, ocultando agotados del menu publico.
  const filteredProducts = useMemo(() => {
    const normalizedSearch = normalizeText(searchTerm);

    return availableProducts.filter((product) =>
      matchesCatalogFilters({ product, selectedCategory, normalizedSearch })
    );
  }, [availableProducts, searchTerm, selectedCategory]);

  // Estadisticas de productos visibles; los agotados ya no se muestran al cliente.
  const stats = useMemo(() => {
    return {
      total: filteredProducts.length,
      available: filteredProducts.length,
      soldOut: 0,
      allFilteredSoldOut: false
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
