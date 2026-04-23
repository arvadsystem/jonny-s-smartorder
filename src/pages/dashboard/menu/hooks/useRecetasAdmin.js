import { useCallback, useEffect, useMemo, useState } from 'react';
import recetasAdminService from '../../../../services/recetasAdminService';
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
    return 'id_nivel_picante es obligatorio para alitas/tenders.';
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
  }, [defaultIds.id_menu]);

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

    try {
      setSaving(true);
      const payload = await buildPayload({ form, editingId, selectedImageFile });

      if (editingId) {
        await recetasAdminService.actualizarRecetaAdmin(editingId, payload);
        setSuccess('Receta actualizada correctamente.');
      } else {
        await recetasAdminService.crearRecetaAdmin(payload);
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
      await cargarRecetas();
    } catch (e) {
      setError(e?.message || 'No se pudo guardar la receta.');
    } finally {
      setSaving(false);
    }
  }, [cargarRecetas, defaultIds.id_menu, editingId, form, selectedImageFile]);

  // Carga receta puntual para abrir drawer en modo edicion.
  const onEditar = useCallback(async (idReceta) => {
    try {
      setError('');
      setSuccess('');
      const receta = await recetasAdminService.obtenerRecetaAdmin(idReceta);

      setEditingId(Number(receta?.id_receta || idReceta));
      setForm(normalizeRecetaForForm(receta));
      setDrawerMode('edit');
      setFiltersOpen(false);
      setDrawerOpen(true);
      setFormPreviewError(false);
      setSelectedImageFile(null);
      setSelectedImagePreviewUrl('');
    } catch (e) {
      setError(e?.message || 'No se pudo cargar la receta para edicion.');
    }
  }, []);

  // Cambia estado activo/inactivo usando el endpoint PATCH del backend.
  const onCambiarEstado = useCallback(async (receta) => {
    const recetaId = Number(receta?.id_receta || 0);
    if (!recetaId) return;

    try {
      setTogglingId(recetaId);
      setError('');
      setSuccess('');

      await recetasAdminService.cambiarEstadoRecetaAdmin(recetaId, {
        estado: !resolveRecetaActiva(receta)
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
      clearFormImage,
      onPickImageFile,
      setCardImageError
    }
  };
};

export default useRecetasAdmin;

