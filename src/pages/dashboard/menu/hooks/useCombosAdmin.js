import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  resolveComboNombre,
  toNumberOrNull,
  toSafeComboBaseName
} from '../utils/combosAdminUtils';

const MENU_IMAGE_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MENU_IMAGE_MAX_BYTES = 6 * 1024 * 1024;

// Valida imagen local de combo antes de enviar al backend para evitar roundtrips innecesarios.
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

// Convierte File a data URL para cumplir el contrato JSON/base64 de /archivos.
const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'));
    reader.readAsDataURL(file);
  });

const validarFormulario = (form) => {
  if (!String(form.nombre_combo || '').trim()) {
    return 'nombre_combo es obligatorio.';
  }

  const precio = toNumberOrNull(form.precio);
  if (precio === null || precio < 0) {
    return 'precio debe ser mayor o igual a 0.';
  }

  if (toNumberOrNull(form.id_menu) === null) {
    return 'id_menu es obligatorio.';
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

const buildPayloadBase = (form) => {
  const nombreCombo = String(form.nombre_combo || '').trim();
  const descripcion = String(form.descripcion || '').trim();

  return {
    nombre_combo: nombreCombo,
    descripcion: descripcion || nombreCombo,
    precio: Number(form.precio),
    cant_personas: Number(form.cant_personas),
    id_menu: Number(form.id_menu),
    estado: parseBoolean(form.estado),
    detalle: normalizeDetallePayload(form.detalle)
  };
};

/**
 * Registra una URL de imagen en la tabla archivos y retorna su id_archivo.
 * Se usa el mismo flujo ya validado para recetas.
 */
const registrarArchivoDesdeUrl = async ({ form, imageUrl }) => {
  const payloadArchivo = {
    nombre_original: `${toSafeComboBaseName(form.nombre_combo || form.descripcion)}-url`,
    url_publica: imageUrl,
    tipo_archivo: 'image/url',
    tamano_bytes: null
  };

  const archivoResponse = await combosAdminService.registrarArchivoCombo(payloadArchivo);
  const idArchivo = extractArchivoId(archivoResponse);
  if (idArchivo === null) {
    throw new Error('No se pudo obtener id_archivo al registrar la imagen del combo.');
  }
  return idArchivo;
};

const registrarArchivoDesdeFile = async ({ form, file }) => {
  const dataUrl = await fileToDataUrl(file);
  const payloadArchivo = {
    nombre_original: file?.name || `${toSafeComboBaseName(form.nombre_combo || form.descripcion)}.jpg`,
    data_url: dataUrl,
    bucket: 'jonnys-assets'
  };

  const archivoResponse = await combosAdminService.registrarArchivoCombo(payloadArchivo);
  const idArchivo = extractArchivoId(archivoResponse);
  if (idArchivo === null) {
    throw new Error('No se pudo obtener id_archivo al subir la imagen del combo.');
  }
  return idArchivo;
};

const buildPayload = async ({ form, editingId, selectedImageFile = null }) => {
  const imageUrl = String(form.url_imagen_publica || '').trim();
  const originalImageUrl = String(form.url_imagen_original || '').trim();
  const didUserChangeUrl = imageUrl !== originalImageUrl;
  const currentArchivoId = toNumberOrNull(form.id_archivo);

  const payload = buildPayloadBase(form);

  // Si hay archivo local nuevo, siempre reemplaza la referencia previa de imagen.
  if (selectedImageFile) {
    payload.id_archivo = await registrarArchivoDesdeFile({ form, file: selectedImageFile });
    return payload;
  }

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
  const [showInactiveOnly, setShowInactiveOnly] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState('create');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...emptyComboForm });
  const [cardImageErrors, setCardImageErrors] = useState({});
  const [formPreviewError, setFormPreviewError] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [selectedImagePreviewUrl, setSelectedImagePreviewUrl] = useState('');
  const [menusCatalog, setMenusCatalog] = useState([]);
  const recetasCatalogLoadedRef = useRef(false);
  const recetasCatalogPromiseRef = useRef(null);
  // Prefill tecnico para reducir captura manual de id_menu en el MVP.
  const [defaultIds, setDefaultIds] = useState({
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

  const cargarCatalogoRecetas = useCallback(async ({ force = false } = {}) => {
    if (!force && recetasCatalogLoadedRef.current && recetasCatalogo.length > 0) {
      return recetasCatalogo;
    }
    if (!force && recetasCatalogPromiseRef.current) {
      return recetasCatalogPromiseRef.current;
    }

    const request = (async () => {
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
      recetasCatalogLoadedRef.current = mergedRows.length > 0;

      if (mergedRows.length === 0) {
        setError('No se encontraron recetas activas para agregar al combo.');
      }
      return mergedRows;
    } catch (e) {
      setError((prev) => prev || e?.message || 'No se pudo cargar el catalogo de recetas para combos.');
      setRecetasCatalogo([]);
      recetasCatalogLoadedRef.current = false;
      return [];
    } finally {
      setLoadingRecetasCatalogo(false);
      recetasCatalogPromiseRef.current = null;
    }
    })();

    recetasCatalogPromiseRef.current = request;
    return request;
  }, [recetasCatalogo]);

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

  // Libera object URLs temporales al desmontar/cambiar preview para evitar fuga de memoria.
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
        // Mantiene captura manual en caso de error.
      }
    };

    void loadDefaultMenu();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadMenusCatalog = async () => {
      try {
        const menusResponse = await menuPublicacionAdminService.getMenusProgramables();
        if (!isMounted) return;

        const menusRows = (Array.isArray(menusResponse) ? menusResponse : [])
          .map((row, index) => {
            const id = Number(row?.id_menu || row?.id || 0);
            const label = String(row?.nombre_menu || row?.nombre || `Menu ${index + 1}`).trim();
            return id > 0 ? { value: String(id), label: `#${id} - ${label}` } : null;
          })
          .filter(Boolean);

        setMenusCatalog(menusRows);
      } catch {
        if (!isMounted) return;
        setMenusCatalog([]);
      }
    };

    void loadMenusCatalog();

    return () => {
      isMounted = false;
    };
  }, []);

  const combosFiltrados = useMemo(() => {
    const searchTerm = String(search || '').trim().toLowerCase();
    const rows = Array.isArray(combos) ? combos : [];

    return rows.filter((combo) => {
      const isActive = resolveComboActivo(combo);
      if (showInactiveOnly) {
        if (isActive) return false;
      } else if (!isActive) {
        return false;
      }
      if (!searchTerm) return true;
      const nombreCombo = String(resolveComboNombre(combo) || '').toLowerCase();
      const descripcion = String(combo?.descripcion || '').toLowerCase();
      const idText = String(combo?.id_combo || '');
      return nombreCombo.includes(searchTerm) || descripcion.includes(searchTerm) || idText.includes(searchTerm);
    });
  }, [combos, search, showInactiveOnly]);

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
      id_menu: defaultIds.id_menu || emptyComboForm.id_menu
    });
    setDrawerOpen(true);
    setError('');
    setSuccess('');
    setFormPreviewError(false);
    setSelectedImageFile(null);
    setSelectedImagePreviewUrl('');
  }, [defaultIds.id_menu]);

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
      const payload = await buildPayload({ form, editingId, selectedImageFile });

      if (editingId) {
        await combosAdminService.actualizarComboAdmin(editingId, payload);
        setSuccess('Combo actualizado correctamente.');
      } else {
        await combosAdminService.crearComboAdmin(payload);
        setSuccess('Combo creado correctamente.');
      }

      // Reinicia fallback de imagen para que pruebe la URL nueva al volver a pintar cards.
      setCardImageErrors({});

      setForm({
        ...emptyComboForm,
        id_menu: defaultIds.id_menu || emptyComboForm.id_menu
      });
      setEditingId(null);
      setDrawerMode('create');
      setDrawerOpen(false);
      setSelectedImageFile(null);
      setSelectedImagePreviewUrl('');
      await cargarCombos();
    } catch (e) {
      setError(e?.message || 'No se pudo guardar el combo.');
    } finally {
      setSaving(false);
    }
  }, [cargarCombos, defaultIds.id_menu, editingId, form, selectedImageFile]);

  const onEditar = useCallback(async (idCombo) => {
    try {
      setError('');
      setSuccess('');
      await cargarCatalogoRecetas({ force: recetasCatalogo.length === 0 });
      const combo = await combosAdminService.obtenerComboAdmin(idCombo);

      setEditingId(Number(combo?.id_combo || idCombo));
      setForm(normalizeComboForForm(combo));
      setDrawerMode('edit');
      setDrawerOpen(true);
      setFormPreviewError(false);
      setSelectedImageFile(null);
      setSelectedImagePreviewUrl('');
    } catch (e) {
      setError(e?.message || 'No se pudo cargar el combo para edicion.');
    }
  }, [cargarCatalogoRecetas, recetasCatalogo.length]);

  const onCambiarEstado = useCallback(async (combo) => {
    const comboId = Number(combo?.id_combo || 0);
    if (!comboId) return;

    try {
      setTogglingId(comboId);
      setError('');
      setSuccess('');

      await combosAdminService.cambiarEstadoComboAdmin(comboId, {
        estado: !resolveComboActivo(combo)
      });

      setSuccess('Estado de combo actualizado correctamente.');
      await cargarCombos();
    } catch (e) {
      setError(e?.message || 'No se pudo cambiar el estado del combo.');
    } finally {
      setTogglingId(null);
    }
  }, [cargarCombos]);

  const clearFormImage = useCallback(() => {
    setForm((prev) => ({ ...prev, url_imagen_publica: '' }));
    setFormPreviewError(false);
    setSelectedImageFile(null);
    setSelectedImagePreviewUrl('');
  }, []);

  // Selecciona archivo local para subida real a Supabase via /archivos.
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

  // Preview prioriza archivo local; mantiene fallback URL para combos existentes.
  const formPreviewUrl = selectedImagePreviewUrl || normalizeDriveStorageUrl(form.url_imagen_publica);

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
      menusCatalog,
      cardImageErrors,
      formPreviewError,
      selectedImageFileName: String(selectedImageFile?.name || ''),
      loadingRecetasCatalogo,
      showInactiveOnly,
      recetasCatalogo
    },
    derived: {
      combosFiltrados,
      recetasDisponibles,
      formPreviewUrl
    },
    actions: {
      setSearch,
      setShowInactiveOnly,
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
      onPickImageFile,
      setCardImageError,
      resolveComboImageUrl
    }
  };
};

export default useCombosAdmin;





