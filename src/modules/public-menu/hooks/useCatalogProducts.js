import { useCallback, useEffect, useMemo, useState } from 'react';
import { publicMenuBootstrapService } from '../services/publicMenuBootstrapService';

const CATALOG_SNAPSHOT_TTL_MS = 10 * 60 * 1000;

const buildSnapshotKey = ({ branchId, orderType }) =>
  `pm_catalog_snapshot::${Number(branchId) || 0}::${String(orderType || 'na').trim().toLowerCase()}`;

const readCatalogSnapshot = (key) => {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.savedAt || !parsed?.payload) return null;
    if (Date.now() - Number(parsed.savedAt) > CATALOG_SNAPSHOT_TTL_MS) return null;
    return parsed.payload;
  } catch {
    return null;
  }
};

const writeCatalogSnapshot = (key, payload) => {
  try {
    window.sessionStorage.setItem(
      key,
      JSON.stringify({
        savedAt: Date.now(),
        payload
      })
    );
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

  if (
    normalized === 'refrescos/agua' ||
    normalized === 'gaseosas y refrescos' ||
    normalized === 'gaseosas/refrescos' ||
    normalized === 'aguas, isotonicos y energeticas' ||
    normalized === 'aguas isotonicos y energeticas'
  ) {
    return 'Refrescos / Agua';
  }

  return String(rawCategoryName || '').trim() || 'Sin categoria';
};

// Hook real de catalogo publico conectado al backend.
export const useCatalogProducts = ({ branchId, orderType }) => {
  const [products, setProducts] = useState([]);
  const [menuSummary, setMenuSummary] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Carga catalogo real por sucursal y tipo de pedido.
  const loadCatalog = useCallback(async () => {
    if (!branchId) {
      setProducts([]);
      setMenuSummary(null);
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

      const response = await publicMenuBootstrapService.getCatalog({
        idSucursal: branchId,
        orderType
      });

      setProducts(Array.isArray(response?.items) ? response.items : []);
      setMenuSummary(response?.menu || null);
      writeCatalogSnapshot(snapshotKey, response);
    } catch (err) {
      // Si ya mostramos snapshot, evitamos tumbar la pantalla por un error puntual de red.
      if (!hasSnapshot) {
        setProducts([]);
        setMenuSummary(null);
        setError(err?.message || 'No pudimos cargar el catalogo.');
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

  // Categorias dinamicas desde el payload real.
  const categories = useMemo(() => {
    const unique = new Set(
      products.map((product) => toCategoryBucket(product?.categoria?.nombre))
    );
    return ['all', ...Array.from(unique)];
  }, [products]);

  // Filtrado por categoria y termino libre.
  const filteredProducts = useMemo(() => {
    const normalizedSearch = normalizeText(searchTerm);

    return products.filter((product) => {
      const productCategory = toCategoryBucket(product?.categoria?.nombre);
      const inCategory = selectedCategory === 'all' || productCategory === selectedCategory;
      if (!inCategory) return false;

      if (!normalizedSearch) return true;
      const name = normalizeText(product.nombre);
      const description = normalizeText(product.descripcion);
      return name.includes(normalizedSearch) || description.includes(normalizedSearch);
    });
  }, [products, searchTerm, selectedCategory]);

  // Estadisticas de disponibilidad para badges/resumen UI.
  const stats = useMemo(() => {
    const available = filteredProducts.filter((product) => product.disponibilidad.available).length;
    return {
      total: filteredProducts.length,
      available,
      soldOut: filteredProducts.length - available,
      allFilteredSoldOut: filteredProducts.length > 0 && available === 0
    };
  }, [filteredProducts]);

  return {
    products,
    filteredProducts,
    categories,
    menuSummary,
    searchTerm,
    selectedCategory,
    loading,
    error,
    stats,
    setSearchTerm,
    setSelectedCategory,
    reloadCatalog: loadCatalog
  };
};
