import { useCallback, useEffect, useMemo, useState } from 'react';
import { getPublicMenuMockCatalog } from '../services/publicMenuCatalogMock';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const isProductAvailable = (product) => !product?.isSoldOut;

// Catalog hook with simulated latency and state control for UI development.
export const useCatalogProductsMock = ({ branchId, orderType }) => {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadCatalog = useCallback(
    async ({ simulateError = false } = {}) => {
      try {
        setLoading(true);
        setError('');
        await wait(450);

        if (simulateError) {
          throw new Error('No pudimos cargar el menu en este momento.');
        }

        const rows = getPublicMenuMockCatalog({ branchId, orderType });
        setProducts(rows);
      } catch (err) {
        setProducts([]);
        setError(err?.message || 'Error cargando catalogo.');
      } finally {
        setLoading(false);
      }
    },
    [branchId, orderType]
  );

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const availableProducts = useMemo(
    () => products.filter((product) => isProductAvailable(product)),
    [products]
  );

  const categories = useMemo(() => {
    const unique = new Set(availableProducts.map((product) => product.category));
    return ['all', ...Array.from(unique)];
  }, [availableProducts]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = normalizeText(searchTerm);
    return availableProducts.filter((product) => {
      const inCategory = selectedCategory === 'all' || product.category === selectedCategory;
      if (!inCategory) return false;

      if (!normalizedSearch) return true;
      const name = normalizeText(product.name);
      const description = normalizeText(product.description);
      return name.includes(normalizedSearch) || description.includes(normalizedSearch);
    });
  }, [availableProducts, searchTerm, selectedCategory]);

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
