import { useCallback, useEffect, useMemo, useState } from 'react';
import recetasAdminService from '../../../../services/recetasAdminService';
import { inventarioService } from '../../../../services/inventarioService';
import menuPublicacionAdminService from '../services/menuPublicacionAdminService';
import { normalizePositiveIdList } from '../utils/warehouseAssignmentUtils';
import {
  calculateCantidadBasePresentacion,
  buildRecetaDetallePayloadItem,
  countActiveRecetaFilters,
  defaultFilters,
  deriveCantidadPorciones,
  emptyForm,
  normalizeRecetaForForm,
  parseRecipeQuantity,
  normalizeRows,
  parseBoolean,
  resolveRecetaActiva,
  sortRecetas,
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
  return '';
};

const validarDetalleReceta = (rows, insumosCatalog = []) => {
  const quantityMessage = 'La cantidad debe ser mayor o igual a 0.0001 y usar como máximo 4 decimales.';
  const detalleInput = (Array.isArray(rows) ? rows : []).filter((row) => (
    String(row?.id_insumo || '').trim() ||
    String(row?.id_unidad_medida || '').trim() ||
    String(row?.cant || '').trim() ||
    String(row?.id_presentacion_insumo || '').trim() ||
    String(row?.cantidad_porciones || '').trim()
  ));
  if (detalleInput.length === 0) {
    return { ok: false, message: 'Agrega al menos un insumo al detalle de receta.' };
  }

  const seen = new Set();
  const detalle = [];
  for (let index = 0; index < detalleInput.length; index += 1) {
    const row = detalleInput[index];
    const idInsumo = toNumberOrNull(row?.id_insumo);
    if (idInsumo === null) {
      return { ok: false, message: `Selecciona un insumo en la linea ${index + 1}.` };
    }
    if (seen.has(idInsumo)) {
      return { ok: false, message: 'Este insumo ya fue agregado a la receta.' };
    }

    const selectedInsumo = (Array.isArray(insumosCatalog) ? insumosCatalog : []).find(
      (insumo) => Number(insumo?.id_insumo) === Number(idInsumo)
    );
    const idUnidadBase = toNumberOrNull(selectedInsumo?.id_unidad_medida);
    if (idUnidadBase === null) {
      return { ok: false, message: 'Configura primero la unidad base en Inventario > Insumos.' };
    }

    if (String(row?.modo_unidad) === 'presentacion') {
      const idPresentacion = toNumberOrNull(row?.id_presentacion_insumo);
      const cantidadPorciones = parseRecipeQuantity(row?.cantidad_porciones);
      if (idPresentacion === null) {
        return { ok: false, message: `Selecciona una presentacion en la linea ${index + 1}.` };
      }
      if (cantidadPorciones === null) {
        return { ok: false, message: quantityMessage };
      }
      const availablePresentation = getPresentacionesReceta(selectedInsumo).find(
        (presentacion) => Number(presentacion.id_presentacion) === Number(idPresentacion)
      );
      if (!availablePresentation) {
        return {
          ok: false,
          message: 'Esta presentación no está disponible para recetas.'
        };
      }
      const cantidadBase = calculateCantidadBasePresentacion(cantidadPorciones, availablePresentation);
      if (cantidadBase === null) {
        return { ok: false, message: quantityMessage };
      }
      detalle.push(buildRecetaDetallePayloadItem({
        idInsumo,
        idUnidadMedida: idUnidadBase,
        cant: cantidadBase
      }));
      seen.add(idInsumo);
      continue;
    }

    const idUnidadMedida = toNumberOrNull(row?.id_unidad_medida);
    const cantidadBase = parseRecipeQuantity(row?.cant);
    if (idUnidadMedida === null) {
      return { ok: false, message: `Selecciona unidad de medida en la linea ${index + 1}.` };
    }
    if (cantidadBase === null) {
      return { ok: false, message: quantityMessage };
    }
    detalle.push(buildRecetaDetallePayloadItem({
      idInsumo,
      idUnidadMedida: idUnidadBase,
      cant: cantidadBase
    }));
    seen.add(idInsumo);
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

const roundDecimal = (value, decimals) => {
  const factor = 10 ** decimals;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
};

const normalizePresentacionCatalog = (presentacion) => ({
  id_presentacion: Number(presentacion?.id_presentacion || 0),
  nombre_presentacion: String(presentacion?.nombre_presentacion || '').trim(),
  cantidad_presentacion: Number(presentacion?.cantidad_presentacion || 0),
  id_unidad_presentacion: String(presentacion?.id_unidad_presentacion ?? ''),
  unidad_presentacion_nombre: String(presentacion?.unidad_presentacion_nombre || '').trim(),
  unidad_presentacion_simbolo: String(presentacion?.unidad_presentacion_simbolo || '').trim(),
  cantidad_base: Number(presentacion?.cantidad_base || 0),
  id_unidad_base: String(presentacion?.id_unidad_base ?? ''),
  unidad_base_nombre: String(presentacion?.unidad_base_nombre || '').trim(),
  unidad_base_simbolo: String(presentacion?.unidad_base_simbolo || '').trim(),
  es_predeterminada_receta: parseBoolean(presentacion?.es_predeterminada_receta)
});

const createEmptyDetalleRow = () => ({
  id_categoria_insumo: '',
  id_insumo: '',
  modo_unidad: 'base',
  id_unidad_medida: '',
  cant: '',
  id_presentacion_insumo: '',
  cantidad_porciones: '',
  cantidad_porciones_pendiente_derivar: false,
  cantidad_presentacion: '',
  id_unidad_presentacion: '',
  factor_conversion_usado: ''
});

const getPresentacionesReceta = (insumo) =>
  (Array.isArray(insumo?.presentaciones_receta) ? insumo.presentaciones_receta : [])
    .filter((presentacion) => Number(presentacion?.id_presentacion || 0) > 0);

const getPreferredPresentacion = (insumo) => {
  const presentaciones = getPresentacionesReceta(insumo);
  return presentaciones.find((presentacion) => presentacion.es_predeterminada_receta === true)
    || presentaciones[0]
    || null;
};

const resolveDefaultDetalleForInsumo = (selected, previous = {}) => {
  const base = {
    ...previous,
    id_categoria_insumo: selected?.id_categoria_insumo || previous?.id_categoria_insumo || '',
    id_insumo: selected?.id_insumo ? String(selected.id_insumo) : '',
    modo_unidad: 'base',
    id_unidad_medida: selected?.id_unidad_medida || '',
    cant: '',
    id_presentacion_insumo: '',
    cantidad_porciones: '',
    cantidad_porciones_pendiente_derivar: false,
    cantidad_presentacion: '',
    id_unidad_presentacion: '',
    factor_conversion_usado: ''
  };
  const defaultPresentacion = getPresentacionesReceta(selected).find(
    (presentacion) => presentacion.es_predeterminada_receta === true
  );
  if (!defaultPresentacion) return base;

  return {
    ...base,
    modo_unidad: 'presentacion',
    id_presentacion_insumo: String(defaultPresentacion.id_presentacion),
    cantidad_porciones: '1',
    cantidad_porciones_pendiente_derivar: false,
    cantidad_presentacion: String(defaultPresentacion.cantidad_presentacion),
    id_unidad_presentacion: String(defaultPresentacion.id_unidad_presentacion || ''),
    factor_conversion_usado: roundDecimal(
      Number(defaultPresentacion.cantidad_base || 0) / Number(defaultPresentacion.cantidad_presentacion || 1),
      6
    )
  };
};

const normalizeInsumoCatalog = (response) => normalizeRows(response).map((row) => ({
  id_insumo: Number(row?.id_insumo || 0),
  nombre_insumo: String(row?.nombre_insumo || ''),
  id_categoria_insumo:
    row?.id_categoria_insumo === null || row?.id_categoria_insumo === undefined
      ? ''
      : String(row.id_categoria_insumo),
  nombre_categoria: String(row?.nombre_categoria || '').trim(),
  id_almacen:
    row?.id_almacen === null || row?.id_almacen === undefined
      ? ''
      : String(row.id_almacen),
  nombre_almacen: String(row?.nombre_almacen || '').trim(),
  id_unidad_medida:
    row?.id_unidad_medida === null || row?.id_unidad_medida === undefined
      ? ''
      : String(row.id_unidad_medida),
  unidad_nombre: String(row?.unidad_nombre || ''),
  unidad_simbolo: String(row?.unidad_simbolo || row?.unidad_abreviatura || '').trim(),
  presentaciones_receta: (Array.isArray(row?.presentaciones_receta) ? row.presentaciones_receta : [])
    .map(normalizePresentacionCatalog)
    .filter((presentacion) => presentacion.id_presentacion > 0)
})).filter((row) => row.id_insumo > 0);

const normalizeUnidadesMedidaCatalog = (response) =>
  normalizeRows(response)
    .map((row) => {
      const id = Number(row?.id_unidad_medida || row?.id || 0);
      const nombre = String(row?.nombre || row?.unidad_nombre || '').trim();
      const simbolo = String(row?.simbolo || row?.unidad_simbolo || '').trim();
      const label = simbolo && nombre ? `${simbolo} - ${nombre}` : (simbolo || nombre || `Unidad ${id}`);
      return id > 0 ? { value: String(id), label } : null;
    })
    .filter(Boolean);

const normalizeDetalleFromApi = (response, insumosCatalog = []) => normalizeRows(response).map((row) => {
  const idPresentacion = String(row?.id_presentacion_insumo ?? '').trim();
  const selectedInsumo = insumosCatalog.find(
    (insumo) => String(insumo.id_insumo) === String(row?.id_insumo)
  );
  const selectedPresentacion = getPresentacionesReceta(selectedInsumo).find(
    (presentacion) => String(presentacion.id_presentacion) === idPresentacion
  );
  const cantidadPorciones = selectedPresentacion
    ? deriveCantidadPorciones(row?.cantidad_presentacion, selectedPresentacion)
    : null;
  return {
    id_categoria_insumo: '',
    id_insumo: String(row?.id_insumo ?? ''),
    modo_unidad: idPresentacion ? 'presentacion' : 'base',
    id_unidad_medida: String(row?.id_unidad_medida ?? ''),
    cant: String(row?.cant ?? ''),
    id_presentacion_insumo: idPresentacion,
    cantidad_porciones: cantidadPorciones === null
      ? String(row?.cantidad_presentacion ?? '')
      : String(cantidadPorciones),
    cantidad_porciones_pendiente_derivar: Boolean(idPresentacion) && !selectedPresentacion,
    cantidad_presentacion: String(row?.cantidad_presentacion ?? ''),
    id_unidad_presentacion: String(row?.id_unidad_presentacion ?? ''),
    factor_conversion_usado: String(row?.factor_conversion_usado ?? ''),
    nombre_presentacion: String(row?.nombre_presentacion || '').trim(),
    unidad_presentacion_nombre: String(row?.unidad_presentacion_nombre || '').trim(),
    unidad_presentacion_simbolo: String(row?.unidad_presentacion_simbolo || '').trim(),
    presentacion_estado: row?.presentacion_estado,
    presentacion_uso_receta: row?.presentacion_uso_receta
  };
});

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

  const payload = buildPayloadBase(form);
  let uploadedArchivoId = null;

  // Prioriza archivo local cuando el usuario selecciona nueva imagen desde el modal.
  if (selectedImageFile) {
    uploadedArchivoId = await registrarArchivoDesdeFile({ form, file: selectedImageFile });
    payload.id_archivo = uploadedArchivoId;
    return { payload, uploadedArchivoId };
  }

  // Conserva imagen existente solo si sigue asociada al mismo archivo.
  if (imageUrl && currentArchivoId !== null && imageUrl === originalImageUrl) {
    payload.id_archivo = currentArchivoId;
    return { payload, uploadedArchivoId };
  }

  if (imageUrl) {
    throw new Error('Recetas ya no permite guardar URL externa como imagen final. Sube un archivo JPG, PNG o WEBP.');
  }

  if (editingId && currentArchivoId !== null && originalImageUrl) {
    // Si en edicion se borra la URL, se limpia la referencia.
    payload.id_archivo = null;
  }

  return { payload, uploadedArchivoId };
};

const useRecetasAdmin = () => {
  const [recetas, setRecetas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resultModal, setResultModal] = useState({ open: false, variant: 'success', message: '' });

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
  const [unidadesMedidaCatalog, setUnidadesMedidaCatalog] = useState([]);
  const [menusCatalog, setMenusCatalog] = useState([]);
  const [departamentosCatalog, setDepartamentosCatalog] = useState([]);
  const [almacenes, setAlmacenes] = useState([]);
  const [loadingAlmacenes, setLoadingAlmacenes] = useState(false);
  const [almacenSearch, setAlmacenSearch] = useState('');
  const [almacenError, setAlmacenError] = useState('');
  const [loadingDetalleCatalog, setLoadingDetalleCatalog] = useState(false);
  // Prefill tecnico para reducir captura manual de id_menu en el MVP.
  const [defaultIds, setDefaultIds] = useState({
    id_menu: ''
  });

  const isAnyDrawerOpen = drawerOpen || filtersOpen;
  const showSaveResult = useCallback((variant, message) => {
    const safeMessage = String(message || '').trim();
    if (variant === 'success') {
      setSuccess(safeMessage);
      setResultModal((current) => ({ ...current, open: false }));
      return;
    }
    setResultModal({ open: true, variant, message: safeMessage });
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadAlmacenes = async () => {
      try {
        setLoadingAlmacenes(true);
        const response = await recetasAdminService.listarAlmacenesRecetas();
        if (!isMounted) return;
        setAlmacenes(normalizeRows(response));
      } catch {
        if (!isMounted) return;
        setAlmacenes([]);
      } finally {
        if (isMounted) setLoadingAlmacenes(false);
      }
    };

    void loadAlmacenes();

    return () => {
      isMounted = false;
    };
  }, []);
  const closeResultModal = useCallback(() => {
    setResultModal((current) => ({ ...current, open: false }));
  }, []);

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
        const [menusResponse, departamentosResponse, unidadesResponse] = await Promise.all([
          menuPublicacionAdminService.getMenusProgramables(),
          inventarioService.getTipoDepartamentos(),
          inventarioService.getUnidadesMedida()
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
        setUnidadesMedidaCatalog(normalizeUnidadesMedidaCatalog(unidadesResponse));
      } catch {
        if (!isMounted) return;
        setMenusCatalog([]);
        setDepartamentosCatalog([]);
        setUnidadesMedidaCatalog([]);
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
      const recetaMenuId = String(receta?.id_menu ?? '').trim();
      const recetaDepartamentoId = String(receta?.id_tipo_departamento ?? '').trim();
      const precio = Number(receta?.precio);
      const precioMin = toNumberOrNull(filters.precio_min);
      const precioMax = toNumberOrNull(filters.precio_max);
      const hasImage =
        toNumberOrNull(receta?.id_archivo) !== null ||
        String(receta?.url_imagen_publica || '').trim().length > 0;
      const totalDetalle = Number(receta?.total_detalle || 0);

      if (String(filters.id_menu || '').trim() && recetaMenuId !== String(filters.id_menu).trim()) return false;
      if (
        String(filters.id_tipo_departamento || '').trim() &&
        recetaDepartamentoId !== String(filters.id_tipo_departamento).trim()
      ) return false;
      if (filters.estado === 'activos' && !resolveRecetaActiva(receta)) return false;
      if (filters.estado === 'inactivos' && resolveRecetaActiva(receta)) return false;
      if (precioMin !== null && (!Number.isFinite(precio) || precio < precioMin)) return false;
      if (precioMax !== null && (!Number.isFinite(precio) || precio > precioMax)) return false;
      if (filters.imagen === 'con_imagen' && !hasImage) return false;
      if (filters.imagen === 'sin_imagen' && hasImage) return false;
      if (filters.detalle === 'con_detalle' && totalDetalle <= 0) return false;
      if (filters.detalle === 'sin_detalle' && totalDetalle > 0) return false;

      if (!searchTerm) return true;
      return nombre.includes(searchTerm) || descripcion.includes(searchTerm) || idText.includes(searchTerm);
    });

    return sortRecetas(filtered, filters.sortBy);
  }, [
    filters.detalle,
    filters.estado,
    filters.id_menu,
    filters.id_tipo_departamento,
    filters.imagen,
    filters.precio_max,
    filters.precio_min,
    filters.sortBy,
    recetas,
    search
  ]);

  const activeFiltersCount = useMemo(() => countActiveRecetaFilters(filters), [filters]);
  const hasActiveFilters = activeFiltersCount > 0;
  const insumoCategoriasOptions = useMemo(() => Array.from(
    new Map(
      (Array.isArray(insumosDetalleCatalog) ? insumosDetalleCatalog : [])
        .filter((item) => String(item?.id_categoria_insumo || '').trim())
        .map((item) => {
          const value = String(item.id_categoria_insumo);
          const label = String(item.nombre_categoria || `Categoria ${value}`).trim();
          return [value, { value, label }];
        })
    ).values()
  ), [insumosDetalleCatalog]);
  const menuLabelsById = useMemo(() => menusCatalog.reduce((acc, option) => {
    const key = String(option?.value || '').trim();
    if (key) acc[key] = String(option?.label || '').trim();
    return acc;
  }, {}), [menusCatalog]);
  const departamentoLabelsById = useMemo(() => departamentosCatalog.reduce((acc, option) => {
    const key = String(option?.value || '').trim();
    if (key) acc[key] = String(option?.label || '').trim();
    return acc;
  }, {}), [departamentosCatalog]);

  const onChangeField = useCallback((event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  const onChangeSelectField = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: String(value || '') }));
  }, []);

  const updateAlmacenes = useCallback((ids) => {
    const normalized = normalizePositiveIdList(ids);
    setAlmacenError('');
    setForm((prev) => ({
      ...prev,
      id_almacenes: normalized,
      id_almacen: normalized.length > 0 ? String(normalized[0]) : ''
    }));
  }, []);

  const cargarCatalogoDetalle = useCallback(async (force = false) => {
    if (!force && Array.isArray(insumosDetalleCatalog) && insumosDetalleCatalog.length > 0) return;
    try {
      setLoadingDetalleCatalog(true);
      const response = await recetasAdminService.listarInsumosDetalleReceta();
      const nextCatalog = normalizeInsumoCatalog(response);
      setInsumosDetalleCatalog(nextCatalog);
      return nextCatalog;
    } catch (e) {
      setError(e?.message || 'No se pudo cargar el catalogo de insumos para detalle receta.');
      setInsumosDetalleCatalog([]);
      return [];
    } finally {
      setLoadingDetalleCatalog(false);
    }
  }, [insumosDetalleCatalog]);

  useEffect(() => {
    void cargarCatalogoDetalle(false);
  }, [cargarCatalogoDetalle]);

  useEffect(() => {
    setDetalleReceta((prev) => {
      let changed = false;

      const next = prev.map((row) => {
        const selected = insumosDetalleCatalog.find(
          (item) => String(item.id_insumo) === String(row.id_insumo)
        );
        if (!selected?.id_unidad_medida) {
          return row;
        }

        if (String(row.modo_unidad) === 'presentacion' && row.cantidad_porciones_pendiente_derivar) {
          const presentacion = getPresentacionesReceta(selected).find(
            (item) => String(item.id_presentacion) === String(row.id_presentacion_insumo)
          );
          const cantidadPorciones = deriveCantidadPorciones(row.cantidad_presentacion, presentacion);
          if (cantidadPorciones !== null) {
            changed = true;
            return {
              ...row,
              id_unidad_medida: String(selected.id_unidad_medida),
              cantidad_porciones: String(cantidadPorciones),
              cantidad_porciones_pendiente_derivar: false
            };
          }
        }

        const resolvedUnidadId = String(selected.id_unidad_medida);
        if (String(row.id_unidad_medida) === resolvedUnidadId) {
          return row;
        }

        changed = true;
        return {
          ...row,
          id_unidad_medida: resolvedUnidadId
        };
      });

      return changed ? next : prev;
    });
  }, [insumosDetalleCatalog]);

  const addDetalleRow = useCallback(() => {
    setDetalleReceta((prev) => [
      ...prev,
      createEmptyDetalleRow()
    ]);
  }, []);

  const removeDetalleRow = useCallback((index) => {
    setDetalleReceta((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
  }, []);

  const updateDetalleRow = useCallback((index, field, value) => {
    setDetalleReceta((prev) => prev.map((row, rowIndex) => {
      if (rowIndex !== index) return row;

      const next = { ...row, [field]: value };
      if (field === 'id_categoria_insumo') {
        const selected = insumosDetalleCatalog.find(
          (item) => String(item.id_insumo) === String(row.id_insumo)
        );
        if (selected && String(selected.id_categoria_insumo) !== String(value)) {
          return { ...createEmptyDetalleRow(), id_categoria_insumo: value };
        }
      }
      if (field === 'id_insumo') {
        const selected = insumosDetalleCatalog.find((item) => String(item.id_insumo) === String(value));
        return resolveDefaultDetalleForInsumo(selected, next);
      }
      if (field === 'modo_unidad') {
        const selected = insumosDetalleCatalog.find((item) => String(item.id_insumo) === String(row.id_insumo));
        if (value === 'presentacion') {
          const firstPresentacion = getPreferredPresentacion(selected);
          return {
            ...next,
            modo_unidad: 'presentacion',
            id_unidad_medida: selected?.id_unidad_medida || '',
            cant: '',
            id_presentacion_insumo: firstPresentacion ? String(firstPresentacion.id_presentacion) : '',
            cantidad_porciones: firstPresentacion ? '1' : '',
            cantidad_porciones_pendiente_derivar: false,
            cantidad_presentacion: firstPresentacion ? String(firstPresentacion.cantidad_presentacion) : '',
            id_unidad_presentacion: firstPresentacion ? String(firstPresentacion.id_unidad_presentacion || '') : '',
            factor_conversion_usado: firstPresentacion
              ? String(roundDecimal(
                Number(firstPresentacion.cantidad_base || 0) / Number(firstPresentacion.cantidad_presentacion || 1),
                6
              ))
              : ''
          };
        }
        return {
          ...next,
          modo_unidad: 'base',
          id_unidad_medida: selected?.id_unidad_medida || next.id_unidad_medida || '',
          cant: '',
          id_presentacion_insumo: '',
          cantidad_porciones: '',
          cantidad_porciones_pendiente_derivar: false,
          cantidad_presentacion: '',
          id_unidad_presentacion: '',
          factor_conversion_usado: ''
        };
      }
      if (field === 'id_presentacion_insumo') {
        const selected = insumosDetalleCatalog.find((item) => String(item.id_insumo) === String(row.id_insumo));
        const presentacion = getPresentacionesReceta(selected).find(
          (item) => String(item.id_presentacion) === String(value)
        );
        return {
          ...next,
          modo_unidad: 'presentacion',
          id_presentacion_insumo: value,
          cantidad_porciones: presentacion ? '1' : '',
          cantidad_porciones_pendiente_derivar: false,
          cantidad_presentacion: presentacion ? String(presentacion.cantidad_presentacion) : '',
          id_unidad_presentacion: presentacion ? String(presentacion.id_unidad_presentacion || '') : '',
          factor_conversion_usado: presentacion
            ? String(roundDecimal(
              Number(presentacion.cantidad_base || 0) / Number(presentacion.cantidad_presentacion || 1),
              6
            ))
            : ''
        };
      }
      if (field === 'cantidad_porciones') return { ...next, cantidad_porciones_pendiente_derivar: false };
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
    setAlmacenError('');
    setAlmacenSearch('');
    closeResultModal();
    setFormPreviewError(false);
    setSelectedImageFile(null);
    setSelectedImagePreviewUrl('');
    setDetalleReceta([createEmptyDetalleRow()]);
    void cargarCatalogoDetalle(true);
  }, [cargarCatalogoDetalle, closeResultModal, defaultIds.id_menu]);

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

  // Guarda receta en create/update usando el mismo drawer.
  const onSubmit = useCallback(async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const validationMessage = validarFormulario(form);
    if (validationMessage) {
      showSaveResult('error', validationMessage);
      return;
    }
    if ((Array.isArray(almacenes) ? almacenes : []).length === 0) {
      const message = 'No hay almacenes activos disponibles para asignar.';
      setAlmacenError(message);
      showSaveResult('error', message);
      return;
    }
    const selectedWarehouses = normalizePositiveIdList(form.id_almacenes);
    if (selectedWarehouses.length === 0) {
      const message = 'Selecciona al menos una sucursal donde estará disponible esta receta.';
      setAlmacenError(message);
      showSaveResult('error', message);
      return;
    }
    const detalleValidation = validarDetalleReceta(detalleReceta, insumosDetalleCatalog);
    if (!detalleValidation.ok) {
      showSaveResult('error', detalleValidation.message);
      return;
    }

    let payload = null;
    let uploadedArchivoId = null;

    try {
      setSaving(true);
      const buildResult = await buildPayload({ form, editingId, selectedImageFile });
      payload = buildResult.payload;
      uploadedArchivoId = buildResult.uploadedArchivoId;

      if (editingId) {
        const response = await recetasAdminService.actualizarRecetaAdmin(editingId, {
          ...payload,
          id_almacenes: selectedWarehouses,
          detalle_receta: detalleValidation.detalle
        });
        showSaveResult('success', response?.message || 'Receta actualizada correctamente.');
      } else {
        const response = await recetasAdminService.crearRecetaAdmin({
          ...payload,
          id_almacenes: selectedWarehouses,
          detalle_receta: detalleValidation.detalle
        });
        const createdId = extractRecetaId(response);
        if (!createdId) {
          throw new Error('La receta se creo, pero no se pudo confirmar su id.');
        }
        showSaveResult('success', response?.message || 'Receta creada correctamente.');
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
      const cleanupArchivoId = toNumberOrNull(payload?.id_archivo);
      if (cleanupArchivoId !== null && cleanupArchivoId === uploadedArchivoId) {
        try {
          await recetasAdminService.eliminarArchivoReceta(cleanupArchivoId);
        } catch {
          console.warn('[recetas] cleanup temporal de imagen fallido.');
        }
      }
      const message = String(e?.message || '').trim() || 'No se pudo guardar la receta.';
      showSaveResult('error', message);
    } finally {
      setSaving(false);
    }
  }, [almacenes, cargarRecetas, defaultIds.id_menu, detalleReceta, editingId, form, insumosDetalleCatalog, selectedImageFile, showSaveResult]);

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
      let detalleCatalog = insumosDetalleCatalog;

      try {
        const contexto = await recetasAdminService.obtenerContextoEdicionReceta(idReceta);
        receta = contexto?.receta || null;
        detalleResponse = contexto?.detalle_receta || [];

        const catalogoInsumos = contexto?.catalogos?.insumos;
        if (Array.isArray(catalogoInsumos) && catalogoInsumos.length > 0) {
          detalleCatalog = normalizeInsumoCatalog(catalogoInsumos);
          setInsumosDetalleCatalog(detalleCatalog);
        } else {
          detalleCatalog = await cargarCatalogoDetalle(true);
        }
      } catch {
        const [recetaFallback, detalleFallback, catalogoFallback] = await Promise.all([
          recetasAdminService.obtenerRecetaAdmin(idReceta),
          recetasAdminService.obtenerDetalleReceta(idReceta),
          cargarCatalogoDetalle(true)
        ]);
        receta = recetaFallback;
        detalleResponse = detalleFallback;
        detalleCatalog = catalogoFallback;
      }

      setEditingId(Number(receta?.id_receta || idReceta));
      setForm(normalizeRecetaForForm(receta || {}));
      setAlmacenError('');
      setAlmacenSearch('');
      const detalleRows = normalizeDetalleFromApi(detalleResponse, detalleCatalog);
      setDetalleReceta(
        detalleRows.length > 0
          ? detalleRows
          : [createEmptyDetalleRow()]
      );
      setDrawerOpen(true);
    } catch (e) {
      setError(e?.message || 'No se pudo cargar la receta para edicion.');
    }
  }, [cargarCatalogoDetalle, insumosDetalleCatalog]);

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
  const formPreviewUrl = selectedImagePreviewUrl || String(form.url_imagen_publica || '').trim();

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
      almacenes,
      insumosDetalleCatalog,
      unidadesMedidaCatalog,
      loadingDetalleCatalog,
      loadingAlmacenes,
      almacenSearch,
      almacenError,
      menusCatalog,
      departamentosCatalog,
      filtersOpen,
      filters,
      filtersDraft,
      viewMode,
      cardImageErrors,
      formPreviewError,
      selectedImageFileName: String(selectedImageFile?.name || ''),
      resultModal,
      isAnyDrawerOpen
    },
    derived: {
      recetasFiltradas,
      activeFiltersCount,
      hasActiveFilters,
      formPreviewUrl,
      insumoCategoriasOptions,
      menuLabelsById,
      departamentoLabelsById
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
      updateAlmacenes,
      setAlmacenSearch,
      addDetalleRow,
      removeDetalleRow,
      updateDetalleRow,
      openCreateDrawer,
      closeCreateDrawer,
      openFiltersDrawer,
      closeFiltersDrawer,
      onSubmit,
      onEditar,
      onCambiarEstado,
      applyFilters,
      clearFilters,
      setShowInactiveOnly,
      clearFormImage,
      onPickImageFile,
      setCardImageError,
      closeResultModal
    }
  };
};

export default useRecetasAdmin;

