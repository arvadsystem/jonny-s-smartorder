import { useCallback, useEffect, useMemo, useState } from 'react';
import recetasAdminService from '../../../../services/recetasAdminService';
import {
  defaultFilters,
  emptyForm,
  isPublicHttpUrl,
  normalizeRecetaForForm,
  normalizeRows,
  parseBoolean,
  resolveRecetaActiva,
  sortRecetas,
  toComparableImageKey,
  toDrivePreviewUrl,
  toNumberOrNull
} from '../utils/recetasAdminUtils';

const validarFormulario = (form) => {
  if (!String(form.nombre_receta || '').trim()) {
    return 'nombre_receta es obligatorio.';
  }
  if (toNumberOrNull(form.id_menu) === null) {
    return 'id_menu es obligatorio.';
  }
  if (toNumberOrNull(form.id_tipo_departamento) === null) {
    return 'id_tipo_departamento es obligatorio.';
  }
  if (toNumberOrNull(form.id_usuario) === null) {
    return 'id_usuario es obligatorio.';
  }
  const precio = toNumberOrNull(form.precio);
  if (precio === null || precio < 0) {
    return 'precio debe ser mayor o igual a 0.';
  }
  const imageUrl = String(form.url_imagen_publica || '').trim();
  if (imageUrl && !isPublicHttpUrl(imageUrl)) {
    return 'url_imagen_publica debe iniciar con http:// o https://.';
  }
  return '';
};

const buildPayloadBase = (form) => ({
  nombre_receta: String(form.nombre_receta || '').trim(),
  descripcion: String(form.descripcion || '').trim(),
  precio: Number(form.precio),
  id_menu: Number(form.id_menu),
  id_nivel_picante:
    String(form.id_nivel_picante || '').trim() === '' ? null : Number(form.id_nivel_picante),
  id_usuario: Number(form.id_usuario),
  estado: parseBoolean(form.estado),
  id_tipo_departamento: Number(form.id_tipo_departamento)
});

const toSafeFileBaseName = (value) => {
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
  const idUsuario = toNumberOrNull(form.id_usuario);
  const nombreBase = toSafeFileBaseName(form.nombre_receta);

  const payloadArchivo = {
    nombre_original: `${nombreBase}-url`,
    url_publica: imageUrl,
    tipo_archivo: 'image/url',
    tamano_bytes: null,
    id_usuario: idUsuario
  };

  const archivoResponse = await recetasAdminService.registrarArchivoReceta(payloadArchivo);
  const idArchivo = extractArchivoId(archivoResponse);

  if (idArchivo === null) {
    throw new Error('No se pudo obtener id_archivo al registrar la imagen.');
  }

  return idArchivo;
};

const buildPayload = async ({ form, editingId }) => {
  const imageUrl = String(form.url_imagen_publica || '').trim();
  const originalImageUrl = String(form.url_imagen_original || '').trim();
  const currentArchivoId = toNumberOrNull(form.id_archivo);
  const normalizedImageUrl = toDrivePreviewUrl(imageUrl);
  const currentImageKey = toComparableImageKey(imageUrl);
  const originalImageKey = toComparableImageKey(originalImageUrl);

  const payload = buildPayloadBase(form);

  // Regla: si la URL no cambia y ya hay archivo asociado, se conserva id_archivo.
  if (imageUrl) {
    if (currentArchivoId !== null && currentImageKey && currentImageKey === originalImageKey) {
      payload.id_archivo = currentArchivoId;
    } else {
      payload.id_archivo = await registrarArchivoDesdeUrl({ form, imageUrl: normalizedImageUrl });
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
    setForm({ ...emptyForm });
    setDrawerOpen(true);
    setError('');
    setSuccess('');
    setFormPreviewError(false);
  }, []);

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
      const payload = await buildPayload({ form, editingId });

      if (editingId) {
        await recetasAdminService.actualizarRecetaAdmin(editingId, payload);
        setSuccess('Receta actualizada correctamente.');
      } else {
        await recetasAdminService.crearRecetaAdmin(payload);
        setSuccess('Receta creada correctamente.');
      }

      setForm({ ...emptyForm });
      setEditingId(null);
      setDrawerMode('create');
      setDrawerOpen(false);
      await cargarRecetas();
    } catch (e) {
      setError(e?.message || 'No se pudo guardar la receta.');
    } finally {
      setSaving(false);
    }
  }, [cargarRecetas, editingId, form]);

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

      const idUsuarioForm = toNumberOrNull(form.id_usuario);
      const idUsuarioRow = toNumberOrNull(receta?.id_usuario);
      const idUsuario = idUsuarioForm ?? idUsuarioRow;

      if (idUsuario === null) {
        setError('Para cambiar estado debes indicar id_usuario en formulario o tenerlo en la fila.');
        return;
      }

      await recetasAdminService.cambiarEstadoRecetaAdmin(recetaId, {
        estado: !resolveRecetaActiva(receta),
        id_usuario: idUsuario
      });

      setSuccess('Estado de receta actualizado correctamente.');
      await cargarRecetas();
    } catch (e) {
      setError(e?.message || 'No se pudo cambiar el estado de la receta.');
    } finally {
      setTogglingId(null);
    }
  }, [cargarRecetas, form.id_usuario]);

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
  }, []);

  const formPreviewUrl = toDrivePreviewUrl(form.url_imagen_publica);

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
      setCardImageError
    }
  };
};

export default useRecetasAdmin;
