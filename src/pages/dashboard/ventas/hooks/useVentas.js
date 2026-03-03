import { useCallback, useEffect, useState } from 'react';
import ventasService from '../../../../services/ventasService';
import {
  buildCategoriasMap,
  extractApiMessage,
  normalizeCategoriaRecord,
  normalizeClienteOption,
  normalizeComboRecord,
  normalizeProductoRecord,
  normalizeRecetaRecord,
  normalizeVentaDetail,
  normalizeVentaRecord
} from '../utils/ventasHelpers';

const initialToast = {
  show: false,
  title: '',
  message: '',
  variant: 'success'
};

export const useVentas = () => {
  const [ventas, setVentas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos] = useState([]);
  const [combos, setCombos] = useState([]);
  const [recetas, setRecetas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(initialToast);

  const openToast = useCallback((title, message, variant = 'success') => {
    setToast({
      show: true,
      title: String(title || ''),
      message: String(message || ''),
      variant
    });
  }, []);

  const closeToast = useCallback(() => {
    setToast((prev) => ({ ...prev, show: false }));
  }, []);

  useEffect(() => {
    if (!toast.show) return undefined;
    const timer = setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 3200);
    return () => clearTimeout(timer);
  }, [toast.show]);

  const loadVentas = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await ventasService.list();
      const rows = Array.isArray(response) ? response.map(normalizeVentaRecord) : [];
      setVentas(rows);
      return rows;
    } catch (error) {
      const message = extractApiMessage(error, 'No se pudieron cargar las ventas.');
      setError(message);
      openToast('ERROR', message, 'danger');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [openToast]);

  const loadCatalogs = useCallback(async () => {
    setCatalogLoading(true);

    try {
      const [
        categoriasResponse,
        productosResponse,
        clientesResponse,
        combosResponse,
        recetasResponse
      ] = await Promise.all([
        ventasService.getCategoriasCatalog(),
        ventasService.getProductosCatalog(),
        ventasService.getClientesCatalog(),
        ventasService.getCombosCatalog(),
        ventasService.getRecetasCatalog()
      ]);

      const normalizedCategorias = (Array.isArray(categoriasResponse) ? categoriasResponse : [])
        .map(normalizeCategoriaRecord)
        .filter((categoria) => categoria.estado)
        .sort((a, b) =>
          a.nombre_departamento.localeCompare(b.nombre_departamento, 'es', {
            sensitivity: 'base'
          })
        );

      const categoriasMap = buildCategoriasMap(normalizedCategorias);

      const normalizedProductos = (Array.isArray(productosResponse) ? productosResponse : [])
        .map((producto) => normalizeProductoRecord(producto, categoriasMap))
        .filter((producto) => producto.estado)
        .sort((a, b) =>
          a.nombre_producto.localeCompare(b.nombre_producto, 'es', {
            sensitivity: 'base'
          })
        );

      const normalizedClientes = [
        {
          id_cliente: null,
          value: 'cf',
          label: 'Consumidor final',
          nombre_cliente: 'Consumidor final',
          es_consumidor_final: true
        },
        ...(Array.isArray(clientesResponse) ? clientesResponse : [])
          .map(normalizeClienteOption)
          .sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }))
      ];

      const normalizedCombos = (Array.isArray(combosResponse) ? combosResponse : [])
        .map(normalizeComboRecord)
        .filter((combo) => combo.estado)
        .sort((a, b) =>
          a.descripcion.localeCompare(b.descripcion, 'es', {
            sensitivity: 'base'
          })
        );

      const normalizedRecetas = (Array.isArray(recetasResponse) ? recetasResponse : [])
        .map(normalizeRecetaRecord)
        .filter((receta) => receta.estado)
        .sort((a, b) =>
          a.nombre_receta.localeCompare(b.nombre_receta, 'es', {
            sensitivity: 'base'
          })
        );

      setCategorias(normalizedCategorias);
      setProductos(normalizedProductos);
      setCombos(normalizedCombos);
      setRecetas(normalizedRecetas);
      setClientes(normalizedClientes);
    } catch (error) {
      const message = extractApiMessage(error, 'No se pudieron cargar los catalogos de ventas.');
      openToast('ERROR', message, 'danger');
      throw error;
    } finally {
      setCatalogLoading(false);
    }
  }, [openToast]);

  useEffect(() => {
    Promise.allSettled([loadVentas(), loadCatalogs()]);
  }, [loadCatalogs, loadVentas]);

  const getVentaDetail = useCallback(async (idFactura) => {
    setDetailLoading(true);

    try {
      const response = await ventasService.getById(idFactura);
      return normalizeVentaDetail(response);
    } catch (error) {
      const message = extractApiMessage(error, 'No se pudo cargar el detalle de la venta.');
      openToast('ERROR', message, 'danger');
      throw error;
    } finally {
      setDetailLoading(false);
    }
  }, [openToast]);

  const createVenta = useCallback(
    async (payload) => {
      setSaving(true);
      setError('');

      try {
        const response = await ventasService.create(payload);
        await loadVentas();
        openToast(
          'VENTA CREADA',
          `${response?.numero_venta || 'La venta'} se registro correctamente.`,
          'success'
        );
        return response;
      } catch (error) {
        const message = extractApiMessage(error, 'No se pudo registrar la venta.');
        setError(message);
        openToast('ERROR', message, 'danger');
        throw error;
      } finally {
        setSaving(false);
      }
    },
    [loadVentas, openToast]
  );

  return {
    ventas,
    categorias,
    productos,
    combos,
    recetas,
    clientes,
    loading,
    catalogLoading,
    saving,
    detailLoading,
    error,
    toast,
    closeToast,
    refreshVentas: loadVentas,
    refreshCatalogs: loadCatalogs,
    getVentaDetail,
    createVenta
  };
};
