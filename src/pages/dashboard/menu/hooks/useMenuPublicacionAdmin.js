import { useCallback, useEffect, useMemo, useState } from 'react';
import menuPublicacionAdminService from '../services/menuPublicacionAdminService';
import { useRef } from 'react';
import { buildPublicMenuUrlByBranch } from '../utils/publicMenuBranchUrl';

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

const parseDraftVisible = (value) => {
  if (value === true || value === 1 || value === '1') return true;
  if (value === false || value === 0 || value === '0') return false;

  const normalized = String(value ?? '').trim().toLowerCase();
  if (['true', 't', 'yes', 'y', 'si', 'sí'].includes(normalized)) return true;
  if (['false', 'f', 'no', 'n'].includes(normalized)) return false;

  return Boolean(value);
};

const normalizePublicationWarning = (warning) => {
  const text = String(warning || '').trim();
  if (/publicaciones cruzadas/i.test(text) && /limpia detalle_menu/i.test(text)) {
    return 'Se detectaron publicaciones que requieren auditoría posterior. No se realizará ninguna limpieza automática.';
  }
  return text;
};

const normalizePublicationWarnings = (warnings) =>
  (Array.isArray(warnings) ? warnings : [])
    .map(normalizePublicationWarning)
    .filter(Boolean);

const normalizeOptionalInput = (value) =>
  value === null || value === undefined ? '' : String(value).trim();

const normalizeDraftRow = (row, index) => {
  const visible = row?.estado_item ? parseDraftVisible(row?.visible) : false;
  const savedPublicPriceInput = normalizeOptionalInput(row?.precio_publico);
  const basePrice = Number(row?.precio_base);
  const publicPrice = Number(savedPublicPriceInput);
  const usesRedundantOverride =
    savedPublicPriceInput !== '' &&
    Number.isFinite(basePrice) &&
    Number.isFinite(publicPrice) &&
    publicPrice === basePrice;
  const priceInput = usesRedundantOverride ? '' : savedPublicPriceInput;
  const orderInput = row?.orden === null || row?.orden === undefined
    ? String(index + 1)
    : String(row.orden);

  return {
    ...row,
    visible,
    precio_publico_input: priceInput,
    orden_input: orderInput,
    saved_visible: visible,
    saved_precio_publico_input: savedPublicPriceInput,
    saved_orden_input: orderInput
  };
};

const hasDraftChanges = (row) =>
  Boolean(row?.visible) !== Boolean(row?.saved_visible) ||
  normalizeOptionalInput(row?.precio_publico_input) !== normalizeOptionalInput(row?.saved_precio_publico_input) ||
  normalizeOptionalInput(row?.orden_input) !== normalizeOptionalInput(row?.saved_orden_input);

const useMenuPublicacionAdmin = () => {
  const [sucursales, setSucursales] = useState([]);
  const [selectedSucursalId, setSelectedSucursalId] = useState('');
  const [selectedCatalogMenuId, setSelectedCatalogMenuId] = useState('');

  const [menuSummary, setMenuSummary] = useState(null);
  const [capabilities, setCapabilities] = useState({});
  const [items, setItems] = useState([]);

  const [preview, setPreview] = useState(null);
  const [sharedMenuImpact, setSharedMenuImpact] = useState(null);
  const [appliedScope, setAppliedScope] = useState('');

  const [loadingSucursales, setLoadingSucursales] = useState(false);
  const [loadingCatalogo, setLoadingCatalogo] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [success, setSuccess] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);
  const catalogRequestRef = useRef(0);
  const previewRequestRef = useRef(0);

  const selectedSucursal = useMemo(
    () => (Array.isArray(sucursales) ? sucursales : []).find(
      (branch) => Number(branch?.id_sucursal || 0) === Number(selectedSucursalId || 0)
    ) || null,
    [selectedSucursalId, sucursales]
  );

  const openAsClientUrl = useMemo(() => {
    return buildPublicMenuUrlByBranch(selectedSucursal);
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

  const loadCatalogo = useCallback(async (idSucursal, idMenu = null) => {
    const id = Number(idSucursal || 0);
    if (!id) {
      catalogRequestRef.current += 1;
      setMenuSummary(null);
      setCapabilities({});
      setItems([]);
      return;
    }

    const requestId = catalogRequestRef.current + 1;
    catalogRequestRef.current = requestId;

    try {
      setLoadingCatalogo(true);
      setError('');
      const data = await menuPublicacionAdminService.getCatalogoPublicacion(id, idMenu);
      if (requestId !== catalogRequestRef.current) return;
      const nextItems = (Array.isArray(data?.items) ? data.items : []).map(normalizeDraftRow);
      setMenuSummary(data?.menu || null);
      setCapabilities(data?.capabilities || {});
      setItems(nextItems);
      setWarnings(normalizePublicationWarnings(data?.warnings));
      setSharedMenuImpact(data?.shared_menu_impact || null);
      setAppliedScope('');
    } catch (e) {
      if (requestId !== catalogRequestRef.current) return;
      setError(e?.message || 'No se pudo cargar el catalogo de publicacion.');
      setMenuSummary(null);
      setItems([]);
      setWarnings([]);
      setSharedMenuImpact(null);
      setAppliedScope('');
    } finally {
      if (requestId === catalogRequestRef.current) {
        setLoadingCatalogo(false);
      }
    }
  }, []);

  const loadPreview = useCallback(async (idSucursal, idMenu = null) => {
    const id = Number(idSucursal || 0);
    if (!id) {
      previewRequestRef.current += 1;
      setPreview(null);
      return;
    }

    const requestId = previewRequestRef.current + 1;
    previewRequestRef.current = requestId;

    try {
      setLoadingPreview(true);
      setPreviewError('');
      const data = await menuPublicacionAdminService.getPreviewPublico(id, idMenu);
      if (requestId !== previewRequestRef.current) return;
      setPreview(data);
      if (data?.shared_menu_impact) {
        setSharedMenuImpact(data.shared_menu_impact);
      }
    } catch (e) {
      if (requestId !== previewRequestRef.current) return;
      setPreviewError(e?.message || 'No se pudo cargar el preview del menu publico.');
      setPreview(null);
    } finally {
      if (requestId === previewRequestRef.current) {
        setLoadingPreview(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadSucursales();
  }, [loadSucursales]);

  useEffect(() => {
    if (selectedSucursalId) return;
    if (!Array.isArray(sucursales) || sucursales.length === 0) return;

    const preferred = sucursales.find((branch) => Boolean(branch?.estado) && Boolean(branch?.tiene_menu_vigente))
      || sucursales.find((branch) => Boolean(branch?.estado))
      || sucursales[0];

    if (preferred?.id_sucursal) {
      setSelectedSucursalId(String(preferred.id_sucursal));
    }
  }, [selectedSucursalId, sucursales]);

  useEffect(() => {
    // Evita estados huerfanos cuando el ID seleccionado ya no existe en el catalogo cargado.
    if (!selectedSucursalId) return;
    if (!Array.isArray(sucursales) || sucursales.length === 0) return;
    if (selectedSucursal) return;

    const fallback = sucursales.find((branch) => Boolean(branch?.estado) && Boolean(branch?.tiene_menu_vigente))
      || sucursales.find((branch) => Boolean(branch?.estado))
      || null;

    setSelectedSucursalId(fallback?.id_sucursal ? String(fallback.id_sucursal) : '');
  }, [selectedSucursal, selectedSucursalId, sucursales]);

  useEffect(() => {
    if (!selectedSucursalId) {
      setMenuSummary(null);
      setCapabilities({});
      setItems([]);
      setPreview(null);
      setWarnings([]);
      setSharedMenuImpact(null);
      setAppliedScope('');
      return;
    }

    if (!selectedSucursal && Array.isArray(sucursales) && sucursales.length > 0) {
      setMenuSummary(null);
      setCapabilities({});
      setItems([]);
      setPreview(null);
      setWarnings(['La sucursal seleccionada no esta disponible. Selecciona una sucursal valida.']);
      setSharedMenuImpact(null);
      setAppliedScope('');
      return;
    }

    if (selectedSucursal && !selectedSucursal?.estado) {
      setMenuSummary(null);
      setCapabilities({});
      setItems([]);
      setPreview(null);
      setWarnings(['La sucursal seleccionada esta inactiva y no permite publicacion.']);
      setSharedMenuImpact(null);
      setAppliedScope('');
      return;
    }

    void loadCatalogo(selectedSucursalId, selectedCatalogMenuId || null);
    void loadPreview(selectedSucursalId, selectedCatalogMenuId || null);
  }, [loadCatalogo, loadPreview, selectedCatalogMenuId, selectedSucursal, selectedSucursalId, sucursales]);

  const onSelectSucursal = useCallback((nextSucursalId) => {
    setSelectedSucursalId(nextSucursalId);
    setSelectedCatalogMenuId('');
    setError('');
    setSuccess('');
    setValidationErrors([]);
    setWarnings([]);
    setAppliedScope('');
  }, []);

  const onSelectCatalogMenu = useCallback((nextMenuId) => {
    setSelectedCatalogMenuId(String(nextMenuId || ''));
    setError('');
    setSuccess('');
    setValidationErrors([]);
    setWarnings([]);
    setAppliedScope('');
  }, []);

  const onToggleVisible = useCallback((itemKey, nextVisible) => {
    setItems((current) => (Array.isArray(current) ? current : []).map((row, index) => {
      if (String(row?.item_key || '') !== String(itemKey || '')) return row;

      const nextRow = { ...row, visible: !!nextVisible };

      // Autocomplete minimo para reducir errores al publicar un item nuevo.
      if (nextRow.visible && !String(nextRow.orden_input || '').trim()) {
        nextRow.orden_input = String(index + 1);
      }

      return nextRow;
    }));
  }, []);

  const onToggleAllVisible = useCallback((nextVisible) => {
    setItems((current) => (Array.isArray(current) ? current : []).map((row, index) => {
      const shouldBeVisible = Boolean(nextVisible) && Boolean(row?.estado_item);
      const nextRow = { ...row, visible: shouldBeVisible };

      if (nextRow.visible && !String(nextRow.orden_input || '').trim()) {
        nextRow.orden_input = String(index + 1);
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

  const onUseOriginalPriceForAll = useCallback(() => {
    setItems((current) => (Array.isArray(current) ? current : []).map((row) => ({
      ...row,
      precio_publico_input: ''
    })));
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

    const parsedRows = (Array.isArray(rows) ? rows : []).map((row) => {
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
        changed: hasDraftChanges(row),
        tipo_item: row?.tipo_item,
        id_item_origen: Number(row?.id_item_origen || 0),
        id_detalle_menu: Number(row?.id_detalle_menu || 0) || null,
        visible: Boolean(row?.visible),
        precio_publico: Number.isNaN(parsedPublicPrice) ? null : parsedPublicPrice,
        orden: Number.isNaN(parsedOrder) ? null : parsedOrder
      };
    });

    const visibleItemsCount = parsedRows.filter((item) => item.visible).length;
    if (visibleItemsCount === 0) {
      localWarnings.push('La sucursal quedara sin items visibles para el cliente.');
    }

    const payload = parsedRows
      .filter((item) => item.changed)
      .map((item) => ({
        tipo_item: item.tipo_item,
        id_item_origen: item.id_item_origen,
        id_detalle_menu: item.id_detalle_menu,
        visible: item.visible,
        precio_publico: item.precio_publico,
        orden: item.orden
      }));

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

    if (!selectedSucursal) {
      setValidationErrors(['La sucursal seleccionada no existe o no esta disponible.']);
      return;
    }

    if (!selectedSucursal?.estado) {
      setValidationErrors(['La sucursal seleccionada esta inactiva y no permite guardar publicacion.']);
      return;
    }

    const validation = validateAndBuildPayload(items);
    if (validation.errors.length > 0) {
      setValidationErrors(validation.errors);
      setWarnings(validation.warnings);
      return;
    }

    if (validation.payload.length === 0) {
      setSuccess('No hay cambios pendientes por guardar.');
      setWarnings(validation.warnings);
      return;
    }

    try {
      setSaving(true);
      const response = await menuPublicacionAdminService.saveCatalogoPublicacion({
        idSucursal,
        idMenu: selectedCatalogMenuId || null,
        items: validation.payload
      });

      setSuccess(response?.message || 'Publicacion guardada correctamente.');

      // AM: invalida cualquier lectura antigua del catalogo para que no pise
      // el estado visible recien confirmado por el guardado.
      catalogRequestRef.current += 1;
      setLoadingCatalogo(false);

      // Conserva en UI el estado recien guardado para evitar parpadeos/desmarcados
      // visuales inmediatamente despues del guardado.
      const savedByKey = new Map(
        validation.payload.map((entry) => [`${entry.tipo_item}:${entry.id_item_origen}`, entry])
      );
      setItems((current) => (Array.isArray(current) ? current : []).map((row) => {
        const key = String(row?.item_key || '');
        const saved = savedByKey.get(key);
        if (!saved) return row;

        return {
          ...row,
          publicado: Boolean(row?.publicado || saved.visible),
          visible: Boolean(saved.visible),
          precio_publico_input:
            saved.precio_publico === null || saved.precio_publico === undefined
              ? ''
              : String(saved.precio_publico),
          orden_input:
            saved.orden === null || saved.orden === undefined
              ? ''
              : String(saved.orden),
          saved_visible: Boolean(saved.visible),
          saved_precio_publico_input:
            saved.precio_publico === null || saved.precio_publico === undefined
              ? ''
              : String(saved.precio_publico),
          saved_orden_input:
            saved.orden === null || saved.orden === undefined
              ? ''
              : String(saved.orden)
        };
      }));

      const responseWarnings = normalizePublicationWarnings(response?.data?.warnings);
      setWarnings([...validation.warnings, ...responseWarnings]);
      setSharedMenuImpact(response?.data?.shared_menu_impact || null);
      setAppliedScope(String(response?.data?.applied_scope || ''));

      void loadPreview(idSucursal, selectedCatalogMenuId || null);
    } catch (e) {
      setError(e?.message || 'No se pudo guardar la publicacion.');
      const serverErrors = Array.isArray(e?.data?.errors) ? e.data.errors : [];
      setValidationErrors(serverErrors);
    } finally {
      setSaving(false);
    }
  }, [
    items,
    loadPreview,
    selectedCatalogMenuId,
    selectedSucursal,
    selectedSucursalId,
    validateAndBuildPayload
  ]);

  const reloadCurrent = useCallback(async () => {
    const idSucursal = Number(selectedSucursalId || 0);
    if (!idSucursal) return;
    await Promise.all([
      loadCatalogo(idSucursal, selectedCatalogMenuId || null),
      loadPreview(idSucursal, selectedCatalogMenuId || null)
    ]);
  }, [loadCatalogo, loadPreview, selectedCatalogMenuId, selectedSucursalId]);

  return {
    state: {
      sucursales,
      selectedSucursalId,
      selectedCatalogMenuId,
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
      sharedMenuImpact,
      appliedScope,
      validationErrors,
      openAsClientUrl
    },
    actions: {
      onSelectSucursal,
      onSelectCatalogMenu,
      onToggleVisible,
      onToggleAllVisible,
      onChangePrecioPublico,
      onUseOriginalPriceForAll,
      onChangeOrden,
      savePublication,
      reloadCurrent
    }
  };
};

export default useMenuPublicacionAdmin;

