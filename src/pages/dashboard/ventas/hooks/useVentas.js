import { useCallback, useEffect, useState } from 'react';
import ventasService from '../../../../services/ventasService';
import sucursalesService from '../../../../services/sucursalesService';
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

const isTruthyState = (value) =>
  value === true || value === 'true' || value === 1 || value === '1';

export const useVentas = () => {
  const [ventas, setVentas] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos] = useState([]);
  const [combos, setCombos] = useState([]);
  const [recetas, setRecetas] = useState([]);
  const [descuentosCatalogo, setDescuentosCatalogo] = useState([]);
  const [tiposDescuento, setTiposDescuento] = useState([]);
  const [tiposDepartamento, setTiposDepartamento] = useState([]);
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
        recetasResponse,
        descuentosResponse,
        tiposDescuentoResponse,
        tiposDepartamentoResponse,
        sucursalesResponse
      ] = await Promise.all([
        ventasService.getCategoriasCatalog(),
        ventasService.getProductosCatalog(),
        ventasService.getClientesCatalog(),
        ventasService.getCombosCatalog(),
        ventasService.getRecetasCatalog(),
        ventasService.getDescuentosCatalog(),
        ventasService.getTiposDescuentoCatalog(),
        ventasService.getTipoDepartamentos(),
        sucursalesService.getAll()
      ]);

      console.log('DEBUG: loadCatalogs Raw Responses:', {
        categorias: Array.isArray(categoriasResponse) ? categoriasResponse.length : 'not an array',
        productos: Array.isArray(productosResponse) ? productosResponse.length : 'not an array',
        combos: Array.isArray(combosResponse) ? combosResponse.length : 'not an array',
        recetas: Array.isArray(recetasResponse) ? recetasResponse.length : 'not an array',
      });

      const normalizedCategorias = (Array.isArray(categoriasResponse) ? categoriasResponse : [])
        .map(normalizeCategoriaRecord)
        .filter((categoria) => categoria.estado)
        .sort((a, b) =>
          a.nombre_categoria.localeCompare(b.nombre_categoria, 'es', {
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

      const normalizedTiposDescuento = (Array.isArray(tiposDescuentoResponse) ? tiposDescuentoResponse : [])
        .filter((row) => row && (row.estado === true || row.estado === 'true' || row.estado === 1 || row.estado === '1'))
        .map((row) => ({
          id_tipo_descuento: Number(row.id_tipo_descuento ?? 0) || null,
          nombre_tipo_descuento: String(row.nombre_tipo_descuento ?? '')
        }))
        .filter((row) => row.id_tipo_descuento && row.nombre_tipo_descuento);

      const normalizedDescuentosCatalogo = (Array.isArray(descuentosResponse) ? descuentosResponse : [])
        .map((row) => ({
          id_descuento_catalogo: Number(row.id_descuento_catalogo ?? 0) || null,
          nombre_descuento: String(row.nombre_descuento ?? 'Descuento'),
          descripcion: String(row.descripcion ?? ''),
          valor_descuento: Number(row.valor_descuento ?? 0) || 0,
          id_tipo_descuento: Number(row.id_tipo_descuento ?? 0) || null,
          nombre_tipo_descuento: String(row.nombre_tipo_descuento ?? ''),
          estado: true
        }))
        .filter((row) => row.id_descuento_catalogo && row.valor_descuento > 0);

      // El SQL ya filtra estado=true, por lo que todos los registros que
      // lleguen aqui son departamentos activos – omitimos el filtro de estado
      // para evitar problemas de tipo (bool/string/number) entre el driver y JS.
      const normalizedTiposDepartamento = (Array.isArray(tiposDepartamentoResponse) ? tiposDepartamentoResponse : [])
        .map((row) => ({
          id_tipo_departamento: Number(row?.id_tipo_departamento ?? 0) || null,
          nombre_tipo_departamento: String(row?.nombre_departamento ?? row?.nombre_tipo_departamento ?? '')
        }))
        .filter((row) => row.id_tipo_departamento && row.nombre_tipo_departamento);

      const normalizedSucursales = (Array.isArray(sucursalesResponse) ? sucursalesResponse : [])
        .filter((row) => isTruthyState(row?.estado))
        .map((row) => ({
          id_sucursal: Number(row?.id_sucursal ?? 0) || null,
          nombre_sucursal: String(row?.nombre_sucursal ?? '').trim()
        }))
        .filter((row) => row.id_sucursal && row.nombre_sucursal)
        .sort((a, b) =>
          a.nombre_sucursal.localeCompare(b.nombre_sucursal, 'es', { sensitivity: 'base' })
        );

      setCategorias(normalizedCategorias);
      setProductos(normalizedProductos);
      setCombos(normalizedCombos);
      setRecetas(normalizedRecetas);
      setDescuentosCatalogo(normalizedDescuentosCatalogo);
      setTiposDescuento(normalizedTiposDescuento);
      setTiposDepartamento(normalizedTiposDepartamento);
      setClientes(normalizedClientes);
      setSucursales(normalizedSucursales);
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
    sucursales,
    categorias,
    tiposDepartamento,
    productos,
    combos,
    recetas,
    descuentosCatalogo,
    tiposDescuento,
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

