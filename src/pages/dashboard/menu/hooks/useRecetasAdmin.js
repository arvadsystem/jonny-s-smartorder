import { useCallback, useEffect, useMemo, useState } from 'react';
import recetasAdminService from '../../../../services/recetasAdminService';
import { inventarioService } from '../../../../services/inventarioService';
import menuPublicacionAdminService from '../services/menuPublicacionAdminService';
import {
  defaultFilters,
  emptyForm,
  getDriveFileIdFromUrl,
  isPublicHttpUrl,
  normalizeRecetaForForm,
  normalizeRows,
  parseBoolean,
  resolveRecetaActiva,
  sortRecetas,
  toDrivePreviewUrl,
  toNumberOrNull,
  DEFAULT_NIVEL_PICANTE_ID,
  shouldRequireSpiceLevel
} from '../utils/recetasAdminUtils';

const MENU_IMAGE_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MENU_IMAGE_MAX_BYTES = 6 * 1024 * 1024;

// Valida archivo local antes de intentar subida para mantener feedback inmediato en el drawer.
const validateMenuImageFile = (file) => {
  if (!file) return 'Selecciona una imagen.';
  if (!MENU_IMAGE_ALLOWED_TYPES.has(String(file.type || '').toLowerCase())) {
    return 'Solo se permiten imagenes JPG, PNG o WEBP.';
  }
  if (Number(file.size || 0) <= 0) {
    return 'La imagen seleccionada no tiene contenido valido.';
  }
  if (Number(file.size || 0) > MENU_IMAGE_MAX_BYTES) {
    return 'La imagen supera 6 MB.';
  }
  return '';
};

// Convierte el archivo a data URL para enviarlo al endpoint /archivos (contrato JSON/base64).
const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'));
    reader.readAsDataURL(file);
  });

const validarFormulario = (form) => {
  if (!String(form.nombre_receta || '').trim()) {
    return 'nombre_receta es obligatorio.';
  }
  if (toNumberOrNull(form.id_menu) === null) {
    return 'id_menu es obligatorio.';
  }
  const requiresSpiceLevel = shouldRequireSpiceLevel(form.nombre_receta);
  if (requiresSpiceLevel && toNumberOrNull(form.id_nivel_picante) === null) {
    return 'id_nivel_picante es obligatorio para alitas/Tenders.';
  }
  if (toNumberOrNull(form.id_tipo_departamento) === null) {
    return 'id_tipo_departamento es obligatorio.';
  }
  const precio = toNumberOrNull(form.precio);
  if (precio === null || precio < 0) {
    return 'precio debe ser mayor o igual a 0.';
  }
  const imageUrl = String(form.url_imagen_publica || '').trim();
  if (imageUrl && !isPublicHttpUrl(imageUrl)) {
    return 'url_imagen_publica debe iniciar con http:// o https://.';
  }
  if (imageUrl) {
    const isDriveUrl = /drive\.google\.com|drive\.usercontent\.google\.com|lh3\.googleusercontent\.com/i
      .test(imageUrl);
    if (isDriveUrl && !getDriveFileIdFromUrl(imageUrl)) {
      return 'El enlace de Google Drive no es valido o esta incompleto.';
    }
  }
  return '';
};

const normalizeDetalleRows = (rows) =>
  (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      id_insumo: toNumberOrNull(row?.id_insumo),
      id_unidad_medida: toNumberOrNull(row?.id_unidad_medida),
      cant: toNumberOrNull(row?.cant)
    }))
    .filter((row) => row.id_insumo !== null || row.id_unidad_medida !== null || row.cant !== null);

const validarDetalleReceta = (rows) => {
  const detalle = normalizeDetalleRows(rows);
  if (detalle.length === 0) {
    return { ok: false, message: 'Agrega al menos un insumo al detalle de receta.' };
  }

  const seen = new Set();
  for (let index = 0; index < detalle.length; index += 1) {
    const row = detalle[index];
    if (row.id_insumo === null) {
      return { ok: false, message: `Selecciona un insumo en la linea ${index + 1}.` };
    }
    if (row.id_unidad_medida === null) {
      return { ok: false, message: `Selecciona unidad de medida en la linea ${index + 1}.` };
    }
    if (row.cant === null || row.cant <= 0) {
      return { ok: false, message: `La cantidad de la linea ${index + 1} debe ser mayor a 0.` };
    }
    if (seen.has(row.id_insumo)) {
      return { ok: false, message: 'No repitas el mismo insumo en el detalle de receta.' };
    }
    seen.add(row.id_insumo);
  }

  return { ok: true, detalle };
};

const buildPayloadBase = (form) => {
  const requiresSpiceLevel = shouldRequireSpiceLevel(form.nombre_receta);
  const resolvedSpiceLevelId = requiresSpiceLevel
    ? Number(form.id_nivel_picante)
    : DEFAULT_NIVEL_PICANTE_ID;

  return {
    nombre_receta: String(form.nombre_receta || '').trim(),
    descripcion: String(form.descripcion || '').trim(),
    precio: Number(form.precio),
    id_menu: Number(form.id_menu),
    // Para no alitas/tenders se envia un nivel por defecto de No aplica.
    id_nivel_picante: resolvedSpiceLevelId,
    estado: parseBoolean(form.estado),
    id_tipo_departamento: Number(form.id_tipo_departamento)
  };
};

const toSafeRecetaBaseName = (value) => {
  const sanitized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return sanitized || 'receta';
};

const extractArchivoId = (response) => {
  const rawId = response?.id_archivo ?? response?.data?.id_archivo ?? null;
  const parsed = Number(rawId);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const extractRecetaId = (response) => {
  const rawId = response?.id_receta ?? response?.data?.id_receta ?? null;
  const parsed = Number(rawId);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeInsumoCatalog = (response) => normalizeRows(response).map((row) => ({
  id_insumo: Number(row?.id_insumo || 0),
  nombre_insumo: String(row?.nombre_insumo || ''),
  id_unidad_medida:
    row?.id_unidad_medida === null || row?.id_unidad_medida === undefined
      ? ''
      : String(row.id_unidad_medida),
  unidad_nombre: String(row?.unidad_nombre || ''),
  unidad_simbolo: String(row?.unidad_simbolo || '').trim()
})).filter((row) => row.id_insumo > 0);

const normalizeDetalleFromApi = (response) => normalizeRows(response).map((row) => ({
  id_insumo: String(row?.id_insumo ?? ''),
  id_unidad_medida: String(row?.id_unidad_medida ?? ''),
  cant: String(row?.cant ?? '')
}));

const registrarArchivoDesdeUrl = async ({ form, imageUrl }) => {
  const payloadArchivo = {
    nombre_original: `${toSafeRecetaBaseName(form.nombre_receta)}-url`,
    url_publica: toDrivePreviewUrl(imageUrl),
    tipo_archivo: 'image/url',
    tamano_bytes: null
  };

  const archivoResponse = await recetasAdminService.registrarArchivoReceta(payloadArchivo);
  const idArchivo = extractArchivoId(archivoResponse);
  if (idArchivo === null) {
    throw new Error('No se pudo obtener id_archivo al registrar la imagen de la receta.');
  }
  return idArchivo;
};

const registrarArchivoDesdeFile = async ({ form, file }) => {
  const dataUrl = await fileToDataUrl(file);
  const payloadArchivo = {
    nombre_original: file?.name || `${toSafeRecetaBaseName(form.nombre_receta)}.jpg`,
    data_url: dataUrl,
    bucket: 'jonnys-assets'
  };

  const archivoResponse = await recetasAdminService.registrarArchivoReceta(payloadArchivo);
  const idArchivo = extractArchivoId(archivoResponse);
  if (idArchivo === null) {
    throw new Error('No se pudo obtener id_archivo al subir la imagen de la receta.');
  }
  return idArchivo;
};

const buildPayload = async ({ form, editingId, selectedImageFile = null }) => {
  const imageUrl = String(form.url_imagen_publica || '').trim();
  const originalImageUrl = String(form.url_imagen_original || '').trim();
  const currentArchivoId = toNumberOrNull(form.id_archivo);
  const didUserChangeUrl = imageUrl !== originalImageUrl;

  const payload = buildPayloadBase(form);

  // Prioriza archivo local cuando el usuario selecciona nueva imagen desde el modal.
  if (selectedImageFile) {
    payload.id_archivo = await registrarArchivoDesdeFile({ form, file: selectedImageFile });
    return payload;
  }

  // Regla: si la URL no cambia y ya hay archivo asociado, se conserva id_archivo.
  // Si cambia, primero se registra en /archivos y se envia solo id_archivo a recetas.
  if (imageUrl) {
    if (currentArchivoId !== null && !didUserChangeUrl) {
      payload.id_archivo = currentArchivoId;
    } else {
      payload.id_archivo = await registrarArchivoDesdeUrl({ form, imageUrl });
    }
  } else if (editingId && currentArchivoId !== null && originalImageUrl) {
    // Si en edicion se borra la URL, se limpia la referencia.
    payload.id_archivo = null;
  }

  return payload;
};

const useRecetasAdmin = () => {
  const [recetas, setRecetas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Estado de UI alineado al patron de modulos.
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState('create');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({ ...defaultFilters });
  const [filtersDraft, setFiltersDraft] = useState({ ...defaultFilters });
  const [viewMode, setViewMode] = useState('cards');
  const [cardImageErrors, setCardImageErrors] = useState({});
  const [formPreviewError, setFormPreviewError] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [selectedImagePreviewUrl, setSelectedImagePreviewUrl] = useState('');
  const [detalleReceta, setDetalleReceta] = useState([]);
  const [insumosDetalleCatalog, setInsumosDetalleCatalog] = useState([]);
  const [menusCatalog, setMenusCatalog] = useState([]);
  const [departamentosCatalog, setDepartamentosCatalog] = useState([]);
  const [loadingDetalleCatalog, setLoadingDetalleCatalog] = useState(false);
  // Prefill tecnico para reducir captura manual de id_menu en el MVP.
  const [defaultIds, setDefaultIds] = useState({
    id_menu: ''
  });

  const isAnyDrawerOpen = drawerOpen || filtersOpen;

  // Carga principal del listado.
  const cargarRecetas = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await recetasAdminService.listarRecetasAdmin();
      setRecetas(normalizeRows(response));
    } catch (e) {
      setError(e?.message || 'No se pudo cargar el listado de recetas.');
      setRecetas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargarRecetas();
  }, [cargarRecetas]);

  useEffect(() => {
    setCardImageErrors({});
  }, [recetas]);

  useEffect(() => {
    setFormPreviewError(false);
  }, [form.url_imagen_publica]);

  // Libera Object URLs temporales para evitar fugas de memoria al reemplazar previews locales.
  useEffect(() => {
    return () => {
      if (selectedImagePreviewUrl && selectedImagePreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(selectedImagePreviewUrl);
      }
    };
  }, [selectedImagePreviewUrl]);

  useEffect(() => {
    let isMounted = true;

    const loadDefaultMenu = async () => {
      try {
        const sucursales = await menuPublicacionAdminService.getSucursales();
        const withMenu = (Array.isArray(sucursales) ? sucursales : []).find(
          (branch) => Boolean(branch?.estado) && Number(branch?.id_menu || 0) > 0
        );

        if (!isMounted || !withMenu) return;
        setDefaultIds((current) => ({
          ...current,
          id_menu: String(withMenu.id_menu)
        }));
      } catch {
        // Sin bloqueo: si falla este preload se mantiene captura manual.
      }
    };

    void loadDefaultMenu();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadCatalogosBase = async () => {
      try {
        const [menusResponse, departamentosResponse] = await Promise.all([
          menuPublicacionAdminService.getMenusProgramables(),
          inventarioService.getTipoDepartamentos()
        ]);

        if (!isMounted) return;

        const menusRows = (Array.isArray(menusResponse) ? menusResponse : [])
          .map((row, index) => {
            const id = Number(row?.id_menu || row?.id || 0);
            const label = String(row?.nombre_menu || row?.nombre || `Menu ${index + 1}`).trim();
            return id > 0 ? { value: String(id), label: `#${id} - ${label}` } : null;
          })
          .filter(Boolean);

        const departamentosRows = normalizeRows(departamentosResponse)
          .map((row, index) => {
            const id = Number(row?.id_tipo_departamento || row?.id || 0);
            const label = String(
              row?.nombre_departamento ||
              row?.nombre_tipo_departamento ||
              row?.tipo_departamento ||
              row?.nombre ||
              `Departamento ${index + 1}`
            ).trim();
            const orden = Number(row?.orden_menu || 0);
            return id > 0 ? { value: String(id), label, orden } : null;
          })
          .filter(Boolean)
          .sort((a, b) => {
            const ao = Number(a?.orden || 0);
            const bo = Number(b?.orden || 0);
            if (ao > 0 && bo > 0) return ao - bo;
            return String(a?.label || '').localeCompare(String(b?.label || ''), 'es');
          });

        setMenusCatalog(menusRows);
        setDepartamentosCatalog(departamentosRows);
      } catch {
        if (!isMounted) return;
        setMenusCatalog([]);
        setDepartamentosCatalog([]);
      }
    };

    void loadCatalogosBase();

    return () => {
      isMounted = false;
    };
  }, []);
  const recetasFiltradas = useMemo(() => {
    const searchTerm = String(search || '').trim().toLowerCase();

    const filtered = (Array.isArray(recetas) ? recetas : []).filter((receta) => {
      const nombre = String(receta?.nombre_receta || '').toLowerCase();
      const descripcion = String(receta?.descripcion || '').toLowerCase();
      const idText = String(receta?.id_receta || '');

      if (filters.estado === 'activos' && !resolveRecetaActiva(receta)) return false;
      if (filters.estado === 'inactivos' && resolveRecetaActiva(receta)) return false;

      if (!searchTerm) return true;
      return nombre.includes(searchTerm) || descripcion.includes(searchTerm) || idText.includes(searchTerm);
    });

    return sortRecetas(filtered, filters.sortBy);
  }, [filters.estado, filters.sortBy, recetas, search]);

  const hasActiveFilters =
    filters.estado !== defaultFilters.estado || filters.sortBy !== defaultFilters.sortBy;

  const onChangeField = useCallback((event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  const onChangeSelectField = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: String(value || '') }));
  }, []);

  const cargarCatalogoDetalle = useCallback(async (force = false) => {
    if (!force && Array.isArray(insumosDetalleCatalog) && insumosDetalleCatalog.length > 0) return;
    try {
      setLoadingDetalleCatalog(true);
      const response = await recetasAdminService.listarInsumosDetalleReceta();
      setInsumosDetalleCatalog(normalizeInsumoCatalog(response));
    } catch (e) {
      setError(e?.message || 'No se pudo cargar el catalogo de insumos para detalle receta.');
      setInsumosDetalleCatalog([]);
    } finally {
      setLoadingDetalleCatalog(false);
    }
  }, [insumosDetalleCatalog]);

  useEffect(() => {
    void cargarCatalogoDetalle(false);
  }, [cargarCatalogoDetalle]);

  const addDetalleRow = useCallback(() => {
    setDetalleReceta((prev) => [...prev, { id_insumo: '', id_unidad_medida: '', cant: '' }]);
  }, []);

  const removeDetalleRow = useCallback((index) => {
    setDetalleReceta((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
  }, []);

  const updateDetalleRow = useCallback((index, field, value) => {
    setDetalleReceta((prev) => prev.map((row, rowIndex) => {
      if (rowIndex !== index) return row;

      const next = { ...row, [field]: value };
      if (field === 'id_insumo') {
        const selected = insumosDetalleCatalog.find((item) => String(item.id_insumo) === String(value));
        next.id_unidad_medida = selected?.id_unidad_medida || '';
      }
      return next;
    }));
  }, [insumosDetalleCatalog]);

  const openCreateDrawer = useCallback(() => {
    setFiltersOpen(false);
    setDrawerMode('create');
    setEditingId(null);
    setForm({
      ...emptyForm,
      id_menu: defaultIds.id_menu || emptyForm.id_menu
    });
    setDrawerOpen(true);
    setError('');
    setSuccess('');
    setFormPreviewError(false);
    setSelectedImageFile(null);
    setSelectedImagePreviewUrl('');
    setDetalleReceta([{ id_insumo: '', id_unidad_medida: '', cant: '' }]);
    void cargarCatalogoDetalle(false);
  }, [cargarCatalogoDetalle, defaultIds.id_menu]);

  const closeCreateDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  const openFiltersDrawer = useCallback(() => {
    setDrawerOpen(false);
    setFiltersDraft({ ...filters });
    setFiltersOpen(true);
  }, [filters]);

  const closeFiltersDrawer = useCallback(() => {
    setFiltersOpen(false);
  }, []);

  const closeAnyDrawer = useCallback(() => {
    setDrawerOpen(false);
    setFiltersOpen(false);
  }, []);

  // Guarda receta en create/update usando el mismo drawer.
  const onSubmit = useCallback(async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const validationMessage = validarFormulario(form);
    if (validationMessage) {
      setError(validationMessage);
      return;
    }
    const detalleValidation = validarDetalleReceta(detalleReceta);
    if (!detalleValidation.ok) {
      setError(detalleValidation.message);
      return;
    }

    try {
      setSaving(true);
      const payload = await buildPayload({ form, editingId, selectedImageFile });

      if (editingId) {
        await recetasAdminService.actualizarRecetaAdmin(editingId, {
          ...payload,
          detalle_receta: detalleValidation.detalle
        });
        setSuccess('Receta actualizada correctamente.');
      } else {
        const response = await recetasAdminService.crearRecetaAdmin({
          ...payload,
          detalle_receta: detalleValidation.detalle
        });
        const createdId = extractRecetaId(response);
        if (!createdId) {
          throw new Error('La receta se creo, pero no se pudo confirmar su id.');
        }
        setSuccess('Receta creada correctamente.');
      }

      setForm({
        ...emptyForm,
        id_menu: defaultIds.id_menu || emptyForm.id_menu
      });
      setEditingId(null);
      setDrawerMode('create');
      setDrawerOpen(false);
      setCardImageErrors({});
      setSelectedImageFile(null);
      setSelectedImagePreviewUrl('');
      setDetalleReceta([]);
      await cargarRecetas();
    } catch (e) {
      setError(e?.message || 'No se pudo guardar la receta.');
    } finally {
      setSaving(false);
    }
  }, [cargarRecetas, defaultIds.id_menu, detalleReceta, editingId, form, selectedImageFile]);

  // Carga receta puntual para abrir drawer en modo edicion.
  const onEditar = useCallback(async (idReceta) => {
    setDrawerMode('edit');
    setFiltersOpen(false);
    setFormPreviewError(false);
    setSelectedImageFile(null);
    setSelectedImagePreviewUrl('');

    try {
      setError('');
      setSuccess('');
      let receta = null;
      let detalleResponse = [];

      try {
        const contexto = await recetasAdminService.obtenerContextoEdicionReceta(idReceta);
        receta = contexto?.receta || null;
        detalleResponse = contexto?.detalle_receta || [];

        const catalogoInsumos = contexto?.catalogos?.insumos;
        if (Array.isArray(catalogoInsumos) && catalogoInsumos.length > 0) {
          setInsumosDetalleCatalog(normalizeInsumoCatalog(catalogoInsumos));
        } else {
          await cargarCatalogoDetalle(false);
        }
      } catch {
        const [recetaFallback, detalleFallback] = await Promise.all([
          recetasAdminService.obtenerRecetaAdmin(idReceta),
          recetasAdminService.obtenerDetalleReceta(idReceta),
          cargarCatalogoDetalle(false)
        ]);
        receta = recetaFallback;
        detalleResponse = detalleFallback;
      }

      setEditingId(Number(receta?.id_receta || idReceta));
      setForm(normalizeRecetaForForm(receta || {}));
      const detalleRows = normalizeDetalleFromApi(detalleResponse);
      setDetalleReceta(detalleRows.length > 0 ? detalleRows : [{ id_insumo: '', id_unidad_medida: '', cant: '' }]);
      setDrawerOpen(true);
    } catch (e) {
      setError(e?.message || 'No se pudo cargar la receta para edicion.');
    }
  }, [cargarCatalogoDetalle]);

  // Cambia estado activo/inactivo usando el endpoint PATCH del backend.
  const onCambiarEstado = useCallback(async (receta, nextEstado = null) => {
    const recetaId = Number(receta?.id_receta || 0);
    if (!recetaId) return;
    const estadoObjetivo =
      typeof nextEstado === 'boolean'
        ? nextEstado
        : !resolveRecetaActiva(receta);

    try {
      setTogglingId(recetaId);
      setError('');
      setSuccess('');

      await recetasAdminService.cambiarEstadoRecetaAdmin(recetaId, {
        estado: estadoObjetivo
      });

      setSuccess('Estado de receta actualizado correctamente.');
      await cargarRecetas();
    } catch (e) {
      setError(e?.message || 'No se pudo cambiar el estado de la receta.');
    } finally {
      setTogglingId(null);
    }
  }, [cargarRecetas]);

  const applyFilters = useCallback(() => {
    setFilters({ ...filtersDraft });
    setFiltersOpen(false);
  }, [filtersDraft]);

  const clearFilters = useCallback(() => {
    setFilters({ ...defaultFilters });
    setFiltersDraft({ ...defaultFilters });
    setFiltersOpen(false);
  }, []);

  const setShowInactiveOnly = useCallback((enabled) => {
    const nextEstado = enabled ? 'inactivos' : 'activos';
    setFilters((state) => ({ ...state, estado: nextEstado }));
    setFiltersDraft((state) => ({ ...state, estado: nextEstado }));
  }, []);

  const clearFormImage = useCallback(() => {
    setForm((prev) => ({ ...prev, url_imagen_publica: '' }));
    setFormPreviewError(false);
    setSelectedImageFile(null);
    setSelectedImagePreviewUrl('');
  }, []);

  // Maneja seleccion de archivo local para el flujo real de subida a Supabase.
  const onPickImageFile = useCallback((file) => {
    const validationMessage = validateMenuImageFile(file);
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setError('');
    setFormPreviewError(false);
    setSelectedImageFile(file);
    setForm((prev) => ({ ...prev, url_imagen_publica: '' }));

    if (selectedImagePreviewUrl && selectedImagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(selectedImagePreviewUrl);
    }
    setSelectedImagePreviewUrl(URL.createObjectURL(file));
  }, [selectedImagePreviewUrl]);

  // Preview: usa archivo local seleccionado; si no hay, usa URL remota existente.
  const formPreviewUrl = selectedImagePreviewUrl || toDrivePreviewUrl(form.url_imagen_publica);

  const setCardImageError = useCallback((idReceta) => {
    setCardImageErrors((prev) => ({
      ...prev,
      [idReceta]: Number(prev?.[idReceta] || 0) + 1
    }));
  }, []);

  return {
    state: {
      loading,
      saving,
      togglingId,
      error,
      success,
      search,
      drawerOpen,
      drawerMode,
      editingId,
      form,
      detalleReceta,
      insumosDetalleCatalog,
      loadingDetalleCatalog,
      menusCatalog,
      departamentosCatalog,
      filtersOpen,
      filters,
      filtersDraft,
      viewMode,
      cardImageErrors,
      formPreviewError,
      selectedImageFileName: String(selectedImageFile?.name || ''),
      isAnyDrawerOpen
    },
    derived: {
      recetasFiltradas,
      hasActiveFilters,
      formPreviewUrl
    },
    actions: {
      setError,
      setSuccess,
      setSearch,
      setViewMode,
      setFiltersDraft,
      setFormPreviewError,
      onChangeField,
      onChangeSelectField,
      addDetalleRow,
      removeDetalleRow,
      updateDetalleRow,
      openCreateDrawer,
      closeCreateDrawer,
      openFiltersDrawer,
      closeFiltersDrawer,
      closeAnyDrawer,
      onSubmit,
      onEditar,
      onCambiarEstado,
      applyFilters,
      clearFilters,
      setShowInactiveOnly,
      clearFormImage,
      onPickImageFile,
      setCardImageError
    }
  };
};

export default useRecetasAdmin;

