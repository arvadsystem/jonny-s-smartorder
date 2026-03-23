import { useCallback, useEffect, useMemo, useState } from 'react';
import menuPublicacionAdminService from '../services/menuPublicacionAdminService';

// Hook centralizado de estado/validacion para publicacion admin por sucursal.

const parseDraftPrice = (value) => {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return NaN;
  return Number(parsed.toFixed(2));
};

const parseDraftOrder = (value) => {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const parsed = Number.parseInt(String(value).trim(), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return NaN;
  return parsed;
};

const normalizeDraftRow = (row, index) => ({
  ...row,
  visible: Boolean(row?.visible),
  precio_publico_input:
    row?.precio_publico === null || row?.precio_publico === undefined ? '' : String(row.precio_publico),
  orden_input: row?.orden === null || row?.orden === undefined ? String(index + 1) : String(row.orden)
});

const resolvePublicBranchSlug = (branch) => {
  const idSucursal = Number(branch?.id_sucursal || 0);
  if (idSucursal === 1) return '21-octubre';
  if (idSucursal === 2) return 'el-carmen';

  const name = String(branch?.nombre_sucursal || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (name.includes('21') || name.includes('octubre')) return '21-octubre';
  if (name.includes('carmen')) return 'el-carmen';
  return '';
};

const useMenuPublicacionAdmin = () => {
  const [sucursales, setSucursales] = useState([]);
  const [selectedSucursalId, setSelectedSucursalId] = useState('');

  const [menuSummary, setMenuSummary] = useState(null);
  const [capabilities, setCapabilities] = useState({});
  const [items, setItems] = useState([]);

  const [preview, setPreview] = useState(null);

  const [loadingSucursales, setLoadingSucursales] = useState(false);
  const [loadingCatalogo, setLoadingCatalogo] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [success, setSuccess] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);

  const selectedSucursal = useMemo(
    () => (Array.isArray(sucursales) ? sucursales : []).find(
      (branch) => Number(branch?.id_sucursal || 0) === Number(selectedSucursalId || 0)
    ) || null,
    [selectedSucursalId, sucursales]
  );

  const openAsClientUrl = useMemo(() => {
    const slug = resolvePublicBranchSlug(selectedSucursal);
    if (!slug) return '/menu-publico/sucursal';
    return `/menu-publico/sucursal?sucursal=${encodeURIComponent(slug)}`;
  }, [selectedSucursal]);

  const loadSucursales = useCallback(async () => {
    try {
      setLoadingSucursales(true);
      setError('');
      const rows = await menuPublicacionAdminService.getSucursales();
      setSucursales(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setError(e?.message || 'No se pudieron cargar las sucursales.');
      setSucursales([]);
    } finally {
      setLoadingSucursales(false);
    }
  }, []);

  const loadCatalogo = useCallback(async (idSucursal) => {
    const id = Number(idSucursal || 0);
    if (!id) {
      setMenuSummary(null);
      setCapabilities({});
      setItems([]);
      return;
    }

    try {
      setLoadingCatalogo(true);
      setError('');
      const data = await menuPublicacionAdminService.getCatalogoPublicacion(id);
      const nextItems = (Array.isArray(data?.items) ? data.items : []).map(normalizeDraftRow);
      setMenuSummary(data?.menu || null);
      setCapabilities(data?.capabilities || {});
      setItems(nextItems);
      setWarnings(Array.isArray(data?.warnings) ? data.warnings : []);
    } catch (e) {
      setError(e?.message || 'No se pudo cargar el catalogo de publicacion.');
      setMenuSummary(null);
      setItems([]);
      setWarnings([]);
    } finally {
      setLoadingCatalogo(false);
    }
  }, []);

  const loadPreview = useCallback(async (idSucursal) => {
    const id = Number(idSucursal || 0);
    if (!id) {
      setPreview(null);
      return;
    }

    try {
      setLoadingPreview(true);
      setPreviewError('');
      const data = await menuPublicacionAdminService.getPreviewPublico(id);
      setPreview(data);
    } catch (e) {
      setPreviewError(e?.message || 'No se pudo cargar el preview del menu publico.');
      setPreview(null);
    } finally {
      setLoadingPreview(false);
    }
  }, []);

  useEffect(() => {
    void loadSucursales();
  }, [loadSucursales]);

  useEffect(() => {
    if (!selectedSucursalId) {
      setMenuSummary(null);
      setCapabilities({});
      setItems([]);
      setPreview(null);
      setWarnings([]);
      return;
    }

    void loadCatalogo(selectedSucursalId);
    void loadPreview(selectedSucursalId);
  }, [loadCatalogo, loadPreview, selectedSucursalId]);

  const onSelectSucursal = useCallback((nextSucursalId) => {
    setSelectedSucursalId(nextSucursalId);
    setError('');
    setSuccess('');
    setValidationErrors([]);
    setWarnings([]);
  }, []);

  const onToggleVisible = useCallback((itemKey, nextVisible) => {
    setItems((current) => (Array.isArray(current) ? current : []).map((row, index) => {
      if (String(row?.item_key || '') !== String(itemKey || '')) return row;

      const nextRow = { ...row, visible: !!nextVisible };

      // Autocomplete minimo para reducir errores al publicar un item nuevo.
      if (nextRow.visible && !String(nextRow.orden_input || '').trim()) {
        nextRow.orden_input = String(index + 1);
      }

      if (nextRow.visible && !String(nextRow.precio_publico_input || '').trim()) {
        if (Number.isFinite(Number(nextRow.precio_base))) {
          nextRow.precio_publico_input = String(nextRow.precio_base);
        }
      }

      return nextRow;
    }));
  }, []);

  const onChangePrecioPublico = useCallback((itemKey, value) => {
    setItems((current) => (Array.isArray(current) ? current : []).map((row) => {
      if (String(row?.item_key || '') !== String(itemKey || '')) return row;
      return { ...row, precio_publico_input: value };
    }));
  }, []);

  const onChangeOrden = useCallback((itemKey, value) => {
    setItems((current) => (Array.isArray(current) ? current : []).map((row) => {
      if (String(row?.item_key || '') !== String(itemKey || '')) return row;
      return { ...row, orden_input: value };
    }));
  }, []);

  const validateAndBuildPayload = useCallback((rows) => {
    const errors = [];
    const localWarnings = [];
    const seenKeys = new Set();

    const payload = (Array.isArray(rows) ? rows : []).map((row) => {
      const key = String(row?.item_key || '');
      const parsedPublicPrice = parseDraftPrice(row?.precio_publico_input);
      const parsedOrder = parseDraftOrder(row?.orden_input);
      const basePrice = Number(row?.precio_base);
      const finalPrice = parsedPublicPrice ?? (Number.isFinite(basePrice) ? basePrice : null);

      if (!key) errors.push('Se encontro un item sin item_key.');
      if (seenKeys.has(key)) errors.push(`Item duplicado en tabla: ${key}.`);
      if (key) seenKeys.add(key);

      if (row?.visible && !row?.estado_item) {
        errors.push(`No puedes dejar visible ${row?.tipo_item} #${row?.id_item_origen} porque esta inactivo.`);
      }

      if (row?.visible && (!Number.isFinite(finalPrice) || finalPrice < 0)) {
        errors.push(`Precio invalido para ${row?.tipo_item} #${row?.id_item_origen}.`);
      }

      if (row?.visible && (!Number.isInteger(parsedOrder) || parsedOrder <= 0)) {
        errors.push(`Orden invalido para ${row?.tipo_item} #${row?.id_item_origen}. Debe ser entero positivo.`);
      }

      return {
        tipo_item: row?.tipo_item,
        id_item_origen: Number(row?.id_item_origen || 0),
        id_detalle_menu: Number(row?.id_detalle_menu || 0) || null,
        visible: Boolean(row?.visible),
        precio_publico: Number.isNaN(parsedPublicPrice) ? null : parsedPublicPrice,
        orden: Number.isNaN(parsedOrder) ? null : parsedOrder
      };
    });

    const visibleItemsCount = payload.filter((item) => item.visible).length;
    if (visibleItemsCount === 0) {
      localWarnings.push('La sucursal quedara sin items visibles para el cliente.');
    }

    return { errors, warnings: localWarnings, payload };
  }, []);

  const savePublication = useCallback(async () => {
    setError('');
    setSuccess('');
    setValidationErrors([]);

    const idSucursal = Number(selectedSucursalId || 0);
    if (!idSucursal) {
      setValidationErrors(['Selecciona una sucursal antes de guardar la publicacion.']);
      return;
    }

    const validation = validateAndBuildPayload(items);
    if (validation.errors.length > 0) {
      setValidationErrors(validation.errors);
      setWarnings(validation.warnings);
      return;
    }

    try {
      setSaving(true);
      const response = await menuPublicacionAdminService.saveCatalogoPublicacion({
        idSucursal,
        items: validation.payload
      });

      setSuccess(response?.message || 'Publicacion guardada correctamente.');

      const responseWarnings = Array.isArray(response?.data?.warnings) ? response.data.warnings : [];
      setWarnings([...validation.warnings, ...responseWarnings]);

      await Promise.all([
        loadCatalogo(idSucursal),
        loadPreview(idSucursal)
      ]);
    } catch (e) {
      setError(e?.message || 'No se pudo guardar la publicacion.');
      const serverErrors = Array.isArray(e?.data?.errors) ? e.data.errors : [];
      setValidationErrors(serverErrors);
    } finally {
      setSaving(false);
    }
  }, [items, loadCatalogo, loadPreview, selectedSucursalId, validateAndBuildPayload]);

  const reloadCurrent = useCallback(async () => {
    const idSucursal = Number(selectedSucursalId || 0);
    if (!idSucursal) return;
    await Promise.all([
      loadCatalogo(idSucursal),
      loadPreview(idSucursal)
    ]);
  }, [loadCatalogo, loadPreview, selectedSucursalId]);

  return {
    state: {
      sucursales,
      selectedSucursalId,
      selectedSucursal,
      menuSummary,
      capabilities,
      items,
      preview,
      loadingSucursales,
      loadingCatalogo,
      loadingPreview,
      saving,
      error,
      previewError,
      success,
      warnings,
      validationErrors,
      openAsClientUrl
    },
    actions: {
      onSelectSucursal,
      onToggleVisible,
      onChangePrecioPublico,
      onChangeOrden,
      savePublication,
      reloadCurrent
    }
  };
};

export default useMenuPublicacionAdmin;
