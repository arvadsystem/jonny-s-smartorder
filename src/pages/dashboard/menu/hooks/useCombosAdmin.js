import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import combosAdminService from '../../../../services/combosAdminService';
import recetasAdminService from '../../../../services/recetasAdminService';
import menuPublicacionAdminService from '../services/menuPublicacionAdminService';
import {
  emptyComboForm,
  extractArchivoId,
  getDriveFileIdFromComboUrl,
  isPublicHttpUrl,
  normalizeComboForForm,
  normalizeDriveStorageUrl,
  normalizeRows,
  parseBoolean,
  resolveComboActivo,
  resolveComboImageUrl,
  toNumberOrNull,
  toSafeComboBaseName
} from '../utils/combosAdminUtils';

const validarFormulario = (form) => {
  if (!String(form.descripcion || '').trim()) {
    return 'descripcion es obligatoria.';
  }

  const precio = toNumberOrNull(form.precio);
  if (precio === null || precio < 0) {
    return 'precio debe ser mayor o igual a 0.';
  }

  if (toNumberOrNull(form.id_menu) === null) {
    return 'id_menu es obligatorio.';
  }

  if (toNumberOrNull(form.id_usuario) === null) {
    return 'id_usuario es obligatorio.';
  }

  const cantPersonas = toNumberOrNull(form.cant_personas);
  if (cantPersonas === null || cantPersonas <= 0) {
    return 'cant_personas debe ser un entero mayor a 0.';
  }

  const imageUrl = String(form.url_imagen_publica || '').trim();
  if (imageUrl && !isPublicHttpUrl(imageUrl)) {
    return 'url_imagen_publica debe iniciar con http:// o https://.';
  }
  if (imageUrl) {
    const driveId = getDriveFileIdFromComboUrl(imageUrl);
    const isDriveUrl = /drive\.google\.com|drive\.usercontent\.google\.com|lh3\.googleusercontent\.com/i
      .test(imageUrl);
    if (isDriveUrl && !driveId) {
      return 'El enlace de Google Drive no es valido o esta incompleto.';
    }
  }

  if (!Array.isArray(form.detalle) || form.detalle.length === 0) {
    return 'Debes agregar al menos una receta al combo.';
  }

  return '';
};

const normalizeDetallePayload = (detalle) => (
  (Array.isArray(detalle) ? detalle : [])
    .map((item, index) => ({
      id_receta: Number(item?.id_receta || 0),
      cantidad: Math.max(1, Number(item?.cantidad || 1)),
      orden: Math.max(1, Number(item?.orden || index + 1))
    }))
    .filter((item) => Number.isInteger(item.id_receta) && item.id_receta > 0)
);

const resolveRecetaId = (row) => Number(
  row?.id_receta ??
  row?.idReceta ??
  row?.id ??
  row?.id_producto ??
  row?.idProducto ??
  0
);

const resolveRecetaNombre = (row) => String(
  row?.nombre_receta ??
  row?.nombreReceta ??
  row?.nombre ??
  row?.nombre_producto ??
  row?.nombreProducto ??
  ''
).trim();

const buildPayloadBase = (form) => ({
  descripcion: String(form.descripcion || '').trim(),
  precio: Number(form.precio),
  cant_personas: Number(form.cant_personas),
  id_menu: Number(form.id_menu),
  id_usuario: Number(form.id_usuario),
  estado: parseBoolean(form.estado),
  detalle: normalizeDetallePayload(form.detalle)
});

/**
 * Registra una URL de imagen en la tabla archivos y retorna su id_archivo.
 * Se usa el mismo flujo ya validado para recetas.
 */
const registrarArchivoDesdeUrl = async ({ form, imageUrl }) => {
  const payloadArchivo = {
    nombre_original: `${toSafeComboBaseName(form.descripcion)}-url`,
    url_publica: imageUrl,
    tipo_archivo: 'image/url',
    tamano_bytes: null,
    id_usuario: toNumberOrNull(form.id_usuario)
  };

  const archivoResponse = await combosAdminService.registrarArchivoCombo(payloadArchivo);
  const idArchivo = extractArchivoId(archivoResponse);
  if (idArchivo === null) {
    throw new Error('No se pudo obtener id_archivo al registrar la imagen del combo.');
  }
  return idArchivo;
};

const buildPayload = async ({ form, editingId }) => {
  const imageUrl = String(form.url_imagen_publica || '').trim();
  const originalImageUrl = String(form.url_imagen_original || '').trim();
  const didUserChangeUrl = imageUrl !== originalImageUrl;
  const currentArchivoId = toNumberOrNull(form.id_archivo);

  const payload = buildPayloadBase(form);

  if (imageUrl) {
    // Si el usuario NO cambio la URL textual en edicion, se conserva el archivo actual.
    // Si la cambio (aunque apunte al mismo Drive ID), se registra un nuevo archivo y se reemplaza id_archivo.
    if (currentArchivoId !== null && !didUserChangeUrl) {
      payload.id_archivo = currentArchivoId;
    } else {
      payload.id_archivo = await registrarArchivoDesdeUrl({
        form,
        // Se guarda URL canonica de Drive para que backend/cards usen una URL de imagen real.
        imageUrl: normalizeDriveStorageUrl(imageUrl)
      });
    }
  } else if (editingId && currentArchivoId !== null && originalImageUrl) {
    payload.id_archivo = null;
  }

  return payload;
};

const useCombosAdmin = () => {
  const [combos, setCombos] = useState([]);
  const [recetasCatalogo, setRecetasCatalogo] = useState([]);
  const [loadingRecetasCatalogo, setLoadingRecetasCatalogo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState('create');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...emptyComboForm });
  const [cardImageErrors, setCardImageErrors] = useState({});
  const [formPreviewError, setFormPreviewError] = useState(false);
  const { user } = useAuth();
  // Prefill tecnico para reducir captura manual de id_usuario/id_menu en el MVP.
  const [defaultIds, setDefaultIds] = useState({
    id_usuario: '',
    id_menu: ''
  });

  const cargarCombos = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await combosAdminService.listarCombosAdmin();
      setCombos(normalizeRows(response));
    } catch (e) {
      setError(e?.message || 'No se pudo cargar el listado de combos.');
      setCombos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const cargarCatalogoRecetas = useCallback(async () => {
    try {
      setError('');
      setLoadingRecetasCatalogo(true);

      let fromCombos = [];
      try {
        fromCombos = normalizeRows(await combosAdminService.listarRecetasCatalogoCombos());
      } catch {
        fromCombos = [];
      }

      let fromRecetas = [];
      if (fromCombos.length === 0) {
        try {
          fromRecetas = normalizeRows(await recetasAdminService.listarRecetasAdmin());
        } catch {
          fromRecetas = [];
        }
      }

      const sourceRows = fromCombos.length > 0 ? fromCombos : fromRecetas;

      const mergedByRecetaId = new Map();
      for (const row of sourceRows) {
        const idReceta = resolveRecetaId(row);
        if (!Number.isInteger(idReceta) || idReceta <= 0) continue;
        if (!mergedByRecetaId.has(idReceta)) {
          mergedByRecetaId.set(idReceta, {
            ...row,
            id_receta: idReceta,
            nombre_receta: resolveRecetaNombre(row)
          });
        }
      }

      const mergedRows = Array.from(mergedByRecetaId.values()).sort((a, b) => (
        resolveRecetaNombre(a).localeCompare(resolveRecetaNombre(b), 'es', {
          sensitivity: 'base'
        })
      ));

      setRecetasCatalogo(mergedRows);

      if (mergedRows.length === 0) {
        setError('No se encontraron recetas activas para agregar al combo.');
      }
    } catch (e) {
      setError((prev) => prev || e?.message || 'No se pudo cargar el catalogo de recetas para combos.');
      setRecetasCatalogo([]);
    } finally {
      setLoadingRecetasCatalogo(false);
    }
  }, []);

  useEffect(() => {
    void cargarCombos();
  }, [cargarCombos]);

  // Precarga recetas para que el selector del drawer tenga datos desde la primera apertura.
  useEffect(() => {
    void cargarCatalogoRecetas();
  }, [cargarCatalogoRecetas]);

  useEffect(() => {
    if (!drawerOpen) return;
    if (recetasCatalogo.length > 0) return;
    void cargarCatalogoRecetas();
  }, [cargarCatalogoRecetas, drawerOpen, recetasCatalogo.length]);

  useEffect(() => {
    setCardImageErrors({});
  }, [combos]);

  useEffect(() => {
    setFormPreviewError(false);
  }, [form.url_imagen_publica]);
  useEffect(() => {
    const idUsuario = Number(user?.id_usuario || 0);
    if (!idUsuario) return;

    setDefaultIds((current) => ({
      ...current,
      id_usuario: String(idUsuario)
    }));
  }, [user?.id_usuario]);

  useEffect(() => {
    let isMounted = true;

    const loadDefaultMenu = async () => {
      try {
        const sucursales = await menuPublicacionAdminService.getSucursales();
        const withMenu = (Array.isArray(sucursales) ? sucursales : []).find(
          (branch) => Number(branch?.id_menu || 0) > 0
        );

        if (!isMounted || !withMenu) return;
        setDefaultIds((current) => ({
          ...current,
          id_menu: String(withMenu.id_menu)
        }));
      } catch {
        // Mantiene captura manual en caso de error.
      }
    };

    void loadDefaultMenu();

    return () => {
      isMounted = false;
    };
  }, []);

  const combosFiltrados = useMemo(() => {
    const searchTerm = String(search || '').trim().toLowerCase();
    const rows = Array.isArray(combos) ? combos : [];

    if (!searchTerm) return rows;

    return rows.filter((combo) => {
      const descripcion = String(combo?.descripcion || '').toLowerCase();
      const idText = String(combo?.id_combo || '');
      return descripcion.includes(searchTerm) || idText.includes(searchTerm);
    });
  }, [combos, search]);

  const recetasDisponibles = useMemo(() => {
    const selectedIds = new Set(
      (Array.isArray(form.detalle) ? form.detalle : []).map((item) => Number(item.id_receta || 0))
    );

    const rows = Array.isArray(recetasCatalogo) ? recetasCatalogo : [];

    return rows
      .map((row) => ({
        ...row,
        id_receta: resolveRecetaId(row),
        nombre_receta: resolveRecetaNombre(row)
      }))
      .filter((row) => row.id_receta > 0 && !selectedIds.has(row.id_receta))
      .sort((a, b) => (
        String(a?.nombre_receta || '').localeCompare(String(b?.nombre_receta || ''), 'es', {
          sensitivity: 'base'
        })
      ));
  }, [form.detalle, recetasCatalogo]);

  const onChangeField = useCallback((event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  const openCreateDrawer = useCallback(() => {
    setDrawerMode('create');
    setEditingId(null);
    setForm({
      ...emptyComboForm,
      id_usuario: defaultIds.id_usuario || emptyComboForm.id_usuario,
      id_menu: defaultIds.id_menu || emptyComboForm.id_menu
    });
    setDrawerOpen(true);
    setError('');
    setSuccess('');
    setFormPreviewError(false);
    // Refresca el catalogo al abrir para tomar recetas nuevas sin recargar pagina.
    void cargarCatalogoRecetas();
  }, [cargarCatalogoRecetas, defaultIds.id_menu, defaultIds.id_usuario]);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  const onAgregarRecetaDetalle = useCallback((idRecetaRaw) => {
    const idReceta = Number(idRecetaRaw);
    if (!Number.isInteger(idReceta) || idReceta <= 0) return;

    setForm((prev) => {
      const detalle = Array.isArray(prev.detalle) ? prev.detalle : [];
      if (detalle.some((item) => Number(item.id_receta) === idReceta)) return prev;

      const receta = (Array.isArray(recetasCatalogo) ? recetasCatalogo : [])
        .find((row) => resolveRecetaId(row) === idReceta);

      return {
        ...prev,
        detalle: [
          ...detalle,
          {
            id_receta: idReceta,
            cantidad: 1,
            orden: detalle.length + 1,
            nombre_receta: String(receta?.nombre_receta || '')
          }
        ]
      };
    });
  }, [recetasCatalogo]);

  const onActualizarDetalleReceta = useCallback((idReceta, campo, valor) => {
    setForm((prev) => ({
      ...prev,
      detalle: (Array.isArray(prev.detalle) ? prev.detalle : []).map((item) => {
        if (Number(item.id_receta) !== Number(idReceta)) return item;
        const numeric = Number(valor);
        if (!Number.isFinite(numeric)) return item;
        return {
          ...item,
          [campo]: Math.max(1, Math.trunc(numeric))
        };
      })
    }));
  }, []);

  const onQuitarRecetaDetalle = useCallback((idReceta) => {
    setForm((prev) => ({
      ...prev,
      detalle: (Array.isArray(prev.detalle) ? prev.detalle : [])
        .filter((item) => Number(item.id_receta) !== Number(idReceta))
        .map((item, index) => ({ ...item, orden: index + 1 }))
    }));
  }, []);

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
      let comboGuardado = null;

      if (editingId) {
        const response = await combosAdminService.actualizarComboAdmin(editingId, payload);
        comboGuardado = response?.data || null;
        setSuccess('Combo actualizado correctamente.');
      } else {
        const response = await combosAdminService.crearComboAdmin(payload);
        comboGuardado = response?.data || null;
        setSuccess('Combo creado correctamente.');
      }

      // Refleja de inmediato la imagen/estado del combo guardado antes del refetch.
      if (comboGuardado && Number(comboGuardado?.id_combo || 0) > 0) {
        const idCombo = Number(comboGuardado.id_combo);
        setCombos((current) => (Array.isArray(current) ? current : []).map((item) => (
          Number(item?.id_combo || 0) === idCombo
            ? {
              ...item,
              ...comboGuardado,
              total_detalle: Array.isArray(comboGuardado?.detalle)
                ? comboGuardado.detalle.filter((detalle) => parseBoolean(detalle?.estado ?? true)).length
                : Number(item?.total_detalle || 0)
            }
            : item
        )));
      }

      // Reinicia fallback de imagen para que pruebe la URL nueva al volver a pintar cards.
      setCardImageErrors({});

      setForm({
        ...emptyComboForm,
        id_usuario: defaultIds.id_usuario || emptyComboForm.id_usuario,
        id_menu: defaultIds.id_menu || emptyComboForm.id_menu
      });
      setEditingId(null);
      setDrawerMode('create');
      setDrawerOpen(false);
      await cargarCombos();
    } catch (e) {
      setError(e?.message || 'No se pudo guardar el combo.');
    } finally {
      setSaving(false);
    }
  }, [cargarCombos, defaultIds.id_menu, defaultIds.id_usuario, editingId, form]);

  const onEditar = useCallback(async (idCombo) => {
    try {
      setError('');
      setSuccess('');
      await cargarCatalogoRecetas();
      const combo = await combosAdminService.obtenerComboAdmin(idCombo);

      setEditingId(Number(combo?.id_combo || idCombo));
      setForm(normalizeComboForForm(combo));
      setDrawerMode('edit');
      setDrawerOpen(true);
      setFormPreviewError(false);
    } catch (e) {
      setError(e?.message || 'No se pudo cargar el combo para edicion.');
    }
  }, [cargarCatalogoRecetas]);

  const onCambiarEstado = useCallback(async (combo) => {
    const comboId = Number(combo?.id_combo || 0);
    if (!comboId) return;

    try {
      setTogglingId(comboId);
      setError('');
      setSuccess('');

      const idUsuarioForm = toNumberOrNull(form.id_usuario);
      const idUsuarioRow = toNumberOrNull(combo?.id_usuario);
      const idUsuario = idUsuarioForm ?? idUsuarioRow;

      if (idUsuario === null) {
        setError('Para cambiar estado debes indicar id_usuario en formulario o tenerlo en la fila.');
        return;
      }

      await combosAdminService.cambiarEstadoComboAdmin(comboId, {
        estado: !resolveComboActivo(combo),
        id_usuario: idUsuario
      });

      setSuccess('Estado de combo actualizado correctamente.');
      await cargarCombos();
    } catch (e) {
      setError(e?.message || 'No se pudo cambiar el estado del combo.');
    } finally {
      setTogglingId(null);
    }
  }, [cargarCombos, form.id_usuario]);

  const clearFormImage = useCallback(() => {
    setForm((prev) => ({ ...prev, url_imagen_publica: '' }));
    setFormPreviewError(false);
  }, []);

  // Preview con URL canonica para evitar que el drawer intente renderizar pages HTML de Drive.
  const formPreviewUrl = normalizeDriveStorageUrl(form.url_imagen_publica);

  const setCardImageError = useCallback((idCombo) => {
    setCardImageErrors((prev) => ({
      ...prev,
      [idCombo]: Number(prev?.[idCombo] || 0) + 1
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
      cardImageErrors,
      formPreviewError,
      loadingRecetasCatalogo,
      recetasCatalogo
    },
    derived: {
      combosFiltrados,
      recetasDisponibles,
      formPreviewUrl
    },
    actions: {
      setSearch,
      setFormPreviewError,
      onChangeField,
      openCreateDrawer,
      closeDrawer,
      onAgregarRecetaDetalle,
      onActualizarDetalleReceta,
      onQuitarRecetaDetalle,
      onSubmit,
      onEditar,
      onCambiarEstado,
      clearFormImage,
      setCardImageError,
      resolveComboImageUrl
    }
  };
};

export default useCombosAdmin;
