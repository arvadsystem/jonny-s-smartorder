import { useCallback, useEffect, useMemo, useState } from 'react';
import { publicMenuBootstrapService } from '../services/publicMenuBootstrapService';

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

    try {
      setLoading(true);
      setError('');

      const response = await publicMenuBootstrapService.getCatalog({
        idSucursal: branchId,
        orderType
      });

      setProducts(Array.isArray(response?.items) ? response.items : []);
      setMenuSummary(response?.menu || null);
    } catch (err) {
      setProducts([]);
      setMenuSummary(null);
      setError(err?.message || 'No pudimos cargar el catalogo.');
    } finally {
      setLoading(false);
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
