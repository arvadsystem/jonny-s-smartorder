import { useCallback, useEffect, useMemo, useState } from 'react';
import { getPublicMenuMockCatalog } from '../services/publicMenuCatalogMock';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

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

  const categories = useMemo(() => {
    const unique = new Set(products.map((product) => product.category));
    return ['all', ...Array.from(unique)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = normalizeText(searchTerm);
    return products.filter((product) => {
      const inCategory = selectedCategory === 'all' || product.category === selectedCategory;
      if (!inCategory) return false;

      if (!normalizedSearch) return true;
      const name = normalizeText(product.name);
      const description = normalizeText(product.description);
      return name.includes(normalizedSearch) || description.includes(normalizedSearch);
    });
  }, [products, searchTerm, selectedCategory]);

  const stats = useMemo(() => {
    const available = filteredProducts.filter((product) => !product.isSoldOut).length;
    const soldOut = filteredProducts.length - available;
    return {
      total: filteredProducts.length,
      available,
      soldOut,
      allFilteredSoldOut: filteredProducts.length > 0 && available === 0
    };
  }, [filteredProducts]);

  return {
    products,
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

