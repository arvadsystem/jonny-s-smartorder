import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../../../services/api';
import { usePermisos } from '../../../context/PermisosContext';
import { PERMISSIONS } from '../../../utils/permissions';
import AppSelect from '../../../components/common/AppSelect';
import MenuActionToast from './components/MenuActionToast';
import MenuConfirmDialog from './components/MenuConfirmDialog';

const createLocalRule = () => ({
  id_local: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  min_unidades: '1',
  max_unidades: '',
  salsas_requeridas: '1'
});

const createSuggestedRule = (existingRules = []) => {
  const previousRule = Array.isArray(existingRules) && existingRules.length > 0
    ? existingRules[existingRules.length - 1]
    : null;
  const previousMin = toPositiveInt(previousRule?.min_unidades);
  const previousMax = toPositiveInt(previousRule?.max_unidades);

  if (!previousMax) return createLocalRule();

  const nextMin = previousMax + 1;
  const previousSize = previousMin && previousMax >= previousMin
    ? previousMax - previousMin
    : null;

  return {
    id_local: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    min_unidades: String(nextMin),
    max_unidades: previousSize === null ? '' : String(nextMin + previousSize),
    salsas_requeridas: String(previousRule?.salsas_requeridas ?? '1')
  };
};

const toPositiveInt = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const toIntOrNull = (value, options = {}) => {
  if (value === null || value === undefined || value === '') return options.allowNull ? null : null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null;
  if (options.min !== undefined && parsed < options.min) return null;
  if (options.max !== undefined && parsed > options.max) return null;
  return parsed;
};

const parseBool = (value) => {
  if (typeof value === 'boolean') return value;
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['1', 'true', 'si', 'activo', 'activa'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'inactivo', 'inactiva'].includes(normalized)) return false;
  return null;
};

const getInsumoConfigStatusLabel = (status) => {
  const normalized = String(status || 'OK').trim().toUpperCase();
  if (normalized === 'OK') return 'Config OK';
  if (normalized === 'SIN_UNIDAD_BASE') return 'Sin unidad base';
  if (normalized === 'MAPEO_AMBIGUO') return 'Mapeo ambiguo';
  if (normalized === 'MAPEO_PENDIENTE') return 'Mapeo pendiente';
  if (normalized === 'MAPEO_REQUIERE_REVISION') return 'Mapeo en revision';
  return normalized.replace(/_/g, ' ');
};

const getInventoryStatusText = (salsa) => {
  if (!isRowActive(salsa?.estado)) return 'No aplica';
  const status = String(salsa?.inventario_estado || '').trim().toUpperCase();
  if (status === 'LISTA') return `Lista · ${salsa?.resumen_consumo || 'consumo configurado'}`;
  return INVENTORY_STATUS_LABELS[status] || 'Sin configurar';
};

const isRowActive = (value) => {
  const parsed = parseBool(value);
  return parsed === null ? true : parsed;
};

const DEFAULT_FORM = Object.freeze({
  nombre: '',
  nivel_picante: '1',
  orden: ''
});

const DEFAULT_INVENTORY_FORM = Object.freeze({
  id_insumo: '',
  cantidad_porcion: '2',
  id_unidad_consumo: ''
});

const DEFAULT_INVENTORY_SUMMARY = Object.freeze({
  activas: 0,
  listas: 0,
  pendientes: 0,
  errores: 0
});

const INVENTORY_STATUS_LABELS = Object.freeze({
  LISTA: 'Lista',
  PENDIENTE: 'Sin configurar',
  INSUMO_INVALIDO: 'Revisar insumo',
  SIN_UNIDAD_BASE: 'Revisar insumo',
  CONVERSION_FALTANTE: 'Revisar conversion',
  CONVERSION_AMBIGUA: 'Revisar conversion'
});

const SPICY_LEVEL_LABELS = {
  0: 'Sin picante',
  1: 'Suave',
  2: 'Medio',
  3: 'Picante',
  4: 'Muy picante',
  5: 'Extra picante'
};

const getSpicyIntensity = (level) => {
  const spicy = Math.max(0, Math.min(5, Number(level || 0)));
  if (spicy <= 1) return { label: 'Suave', className: 'is-suave' };
  if (spicy <= 3) return { label: 'Medio', className: 'is-medio' };
  if (spicy === 4) return { label: 'Fuerte', className: 'is-fuerte' };
  return { label: 'Muy fuerte', className: 'is-muy-fuerte' };
};

const normalizeRecipeConfigState = (sauceIds, ruleRows) => ({
  sauceIds: [...new Set((Array.isArray(sauceIds) ? sauceIds : [])
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0))]
    .sort((left, right) => left - right),
  rules: (Array.isArray(ruleRows) ? ruleRows : [])
    .map((rule) => ({
      min_unidades: String(rule?.min_unidades ?? ''),
      max_unidades: rule?.max_unidades === null || rule?.max_unidades === undefined ? '' : String(rule.max_unidades),
      salsas_requeridas: String(rule?.salsas_requeridas ?? '')
    }))
});

const recipeConfigStatesMatch = (left, right) => JSON.stringify(left) === JSON.stringify(right);

const isSalsaInsumo = (row) => (
  String(row?.codigo_categoria || '').trim().toUpperCase() === 'INS-002'
  && String(row?.categoria || row?.categoria_nombre || '').trim().toUpperCase() === 'SALSAS Y ADEREZOS'
);

const normalizeInsumosPayload = (rows) => ({
  recomendados: (Array.isArray(rows?.recomendados) ? rows.recomendados : []).filter(isSalsaInsumo),
  otros_disponibles: [],
  bloqueados: (Array.isArray(rows?.bloqueados) ? rows.bloqueados : []).filter(isSalsaInsumo)
});

const MenuSalsasAdmin = () => {
  const { canAny } = usePermisos();
  const [loading, setLoading] = useState(false);
  const [loadingRecipeConfig, setLoadingRecipeConfig] = useState(false);
  const [savingSalsa, setSavingSalsa] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [estadoConfirm, setEstadoConfirm] = useState(null);
  const [recipeDiscardConfirm, setRecipeDiscardConfirm] = useState(null);
  const [detailSalsa, setDetailSalsa] = useState(null);

  const [salsas, setSalsas] = useState([]);
  const [recipeSalsasCatalog, setRecipeSalsasCatalog] = useState([]);
  const [recetas, setRecetas] = useState([]);
  const [insumos, setInsumos] = useState([]);

  const [form, setForm] = useState(DEFAULT_FORM);
  const [editingSalsaId, setEditingSalsaId] = useState(null);
  const [inventoryForm, setInventoryForm] = useState(DEFAULT_INVENTORY_FORM);
  const [inventorySalsa, setInventorySalsa] = useState(null);
  const [inventoryFieldErrors, setInventoryFieldErrors] = useState({});
  const [inventoryUseCustomUnit, setInventoryUseCustomUnit] = useState(false);
  const [publicationSalsa, setPublicationSalsa] = useState(null);
  const [publicationRows, setPublicationRows] = useState([]);
  const [publicationModalOpen, setPublicationModalOpen] = useState(false);
  const [loadingPublication, setLoadingPublication] = useState(false);
  const [savingPublication, setSavingPublication] = useState(false);

  const [selectedRecetaId, setSelectedRecetaId] = useState('');
  const [selectedSauceIds, setSelectedSauceIds] = useState([]);
  const [recipeSauceSearch, setRecipeSauceSearch] = useState('');
  const [rules, setRules] = useState([]);
  const [recipeConfigSnapshot, setRecipeConfigSnapshot] = useState(() => normalizeRecipeConfigState([], []));
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrderDirection, setSortOrderDirection] = useState('asc');
  const [showInactiveOnly, setShowInactiveOnly] = useState(false);
  const [estadoFiltro, setEstadoFiltro] = useState('activos');
  const [nivelPicanteFiltro, setNivelPicanteFiltro] = useState('todos');
  const [publicacionFiltro, setPublicacionFiltro] = useState('todas_las');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [inventorySummary, setInventorySummary] = useState(DEFAULT_INVENTORY_SUMMARY);
  const [nextOperationalOrder, setNextOperationalOrder] = useState(1);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [inventoryModalOpen, setInventoryModalOpen] = useState(false);
  const [recipeConfigModalOpen, setRecipeConfigModalOpen] = useState(false);
  const createNombreInputRef = useRef(null);
  const mobileSalsaCarouselRef = useRef(null);
  const pageSize = 10;
  const canCreateSalsa = canAny([PERMISSIONS.MENU_SALSAS_CREAR, PERMISSIONS.MENU_VER]);
  const canEditSalsa = canAny([PERMISSIONS.MENU_SALSAS_EDITAR, PERMISSIONS.MENU_VER]);
  const canToggleSalsaEstado = canAny([PERMISSIONS.MENU_SALSAS_ESTADO_CAMBIAR, PERMISSIONS.MENU_VER]);

  const activeSalsas = useMemo(
    () => recipeSalsasCatalog.filter((row) => isRowActive(row?.estado)),
    [recipeSalsasCatalog]
  );
  const inventoryStats = useMemo(() => {
    return {
      active: Number(inventorySummary.activas || 0),
      ready: Number(inventorySummary.listas || 0),
      pending: Number(inventorySummary.pendientes || 0),
      errors: Number(inventorySummary.errores || 0)
    };
  }, [inventorySummary]);
  const recetaOptions = useMemo(
    () => recetas.map((receta) => ({
      value: String(receta.id_receta),
      label: `#${receta.id_receta} - ${receta.nombre_receta}`,
      searchText: `${receta.id_receta} ${receta.nombre_receta}`
    })),
    [recetas]
  );
  const flatInsumos = useMemo(() => {
    return [
      ...(Array.isArray(insumos?.recomendados) ? insumos.recomendados.map((row) => ({ ...row, grupo: 'Recomendados' })) : []),
      ...(Array.isArray(insumos?.bloqueados) ? insumos.bloqueados.map((row) => ({ ...row, grupo: 'Bloqueados' })) : [])
    ];
  }, [insumos]);
  const blockedInsumos = useMemo(
    () => flatInsumos.filter((insumo) => insumo?.seleccionable === false),
    [flatInsumos]
  );
  const insumoOptions = useMemo(() => {
    const rows = Array.isArray(flatInsumos)
      ? flatInsumos.filter((insumo) => insumo?.seleccionable !== false)
      : [];
    rows.sort((left, right) => {
      const leftPreferred = String(left?.categoria || left?.categoria_nombre || '').trim().toUpperCase() === 'SALSAS Y ADEREZOS' ? 0 : 1;
      const rightPreferred = String(right?.categoria || right?.categoria_nombre || '').trim().toUpperCase() === 'SALSAS Y ADEREZOS' ? 0 : 1;
      if (leftPreferred !== rightPreferred) return leftPreferred - rightPreferred;
      return String(left?.nombre || '').localeCompare(String(right?.nombre || ''), 'es', { sensitivity: 'base' });
    });
    return rows.map((insumo) => {
      const unidadLabel = String(insumo.unidad_base?.etiqueta || insumo.unidad_simbolo || insumo.unidad_nombre || '').trim();
      const configStatus = String(insumo.estado_configuracion || 'OK').trim();
      const disabled = !insumo.id_unidad_medida;
      return {
        value: String(insumo.id_insumo),
        label: `#${insumo.id_insumo} · ${insumo.nombre}`,
        helperText: `Unidad base: ${unidadLabel || 'sin unidad'}`,
        disabled,
        searchText: `${insumo.id_insumo} ${insumo.nombre || ''} ${insumo.categoria || insumo.categoria_nombre || ''} ${unidadLabel}`,
        unidadId: insumo.id_unidad_medida ? String(insumo.id_unidad_medida) : '',
        unidadLabel,
        configStatus,
        motivoBloqueo: insumo.motivo_bloqueo || '',
        conversiones: Array.isArray(insumo.conversiones_disponibles) ? insumo.conversiones_disponibles : [],
        nombre: insumo.nombre || '',
        categoria: insumo.categoria || insumo.categoria_nombre || ''
      };
    });
  }, [flatInsumos]);
  const selectedInsumoOption = useMemo(
    () => insumoOptions.find((option) => String(option.value) === String(inventoryForm.id_insumo)) || null,
    [inventoryForm.id_insumo, insumoOptions]
  );
  const unidadOptions = useMemo(() => {
    if (!selectedInsumoOption?.unidadId) return [];
    const baseOption = {
      value: selectedInsumoOption.unidadId,
      label: selectedInsumoOption.unidadLabel || `Unidad ${selectedInsumoOption.unidadId}`,
      searchText: selectedInsumoOption.unidadLabel || ''
    };
    if (!inventoryUseCustomUnit) return [baseOption];
    const map = new Map([[baseOption.value, baseOption]]);
    for (const conversion of selectedInsumoOption.conversiones || []) {
      const idUnidad = String(conversion?.id_unidad_consumo || '').trim();
      if (!idUnidad || map.has(idUnidad)) continue;
      const label = String(conversion?.unidad_simbolo || conversion?.unidad_nombre || `Unidad ${idUnidad}`).trim();
      map.set(idUnidad, { value: idUnidad, label, searchText: label });
    }
    return [...map.values()].sort((left, right) => left.label.localeCompare(right.label, 'es', { sensitivity: 'base' }));
  }, [inventoryUseCustomUnit, selectedInsumoOption]);
  const inventoryWarning = useMemo(() => {
    if (!inventoryForm.id_insumo) return '';
    if (!selectedInsumoOption?.unidadId) return 'El insumo seleccionado no tiene unidad base configurada.';
    if (selectedInsumoOption?.disabled) {
      return selectedInsumoOption.motivoBloqueo || `El insumo seleccionado no puede usarse: ${getInsumoConfigStatusLabel(selectedInsumoOption.configStatus)}.`;
    }
    if (!inventoryForm.id_unidad_consumo) return 'Selecciona la unidad de consumo para validar conversion en backend.';
    if (selectedInsumoOption.unidadId !== String(inventoryForm.id_unidad_consumo)) {
      return 'Si la unidad no coincide con la base, debe existir una conversion activa en presentaciones.';
    }
    return '';
  }, [inventoryForm.id_insumo, inventoryForm.id_unidad_consumo, selectedInsumoOption]);
  const filteredAssignableSalsas = useMemo(() => {
    const search = String(recipeSauceSearch || '').trim().toLowerCase();
    if (!search) return activeSalsas;
    return activeSalsas.filter((salsa) => String(salsa?.nombre || '').toLowerCase().includes(search));
  }, [activeSalsas, recipeSauceSearch]);

  const visibleSalsas = useMemo(() => {
    return salsas;
  }, [salsas]);

  const currentSpicyLevel = Math.max(0, Math.min(5, Number(form.nivel_picante || 0)));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), Math.max(1, totalPages));
  const visiblePageNumbers = useMemo(() => {
    const max = 5;
    if (totalPages <= max) return Array.from({ length: totalPages }, (_, idx) => idx + 1);
    const half = Math.floor(max / 2);
    let start = Math.max(1, safeCurrentPage - half);
    let end = start + max - 1;
    if (end > totalPages) {
      end = totalPages;
      start = end - max + 1;
    }
    return Array.from({ length: end - start + 1 }, (_, idx) => start + idx);
  }, [safeCurrentPage, totalPages]);
  const paginatedSalsas = useMemo(() => visibleSalsas, [visibleSalsas]);
  const mobileSalsaSlides = useMemo(() => {
    const slides = [];
    for (let index = 0; index < paginatedSalsas.length; index += 2) {
      slides.push(paginatedSalsas.slice(index, index + 2));
    }
    return slides;
  }, [paginatedSalsas]);
  const currentRecipeConfigState = useMemo(
    () => normalizeRecipeConfigState(selectedSauceIds, rules),
    [rules, selectedSauceIds]
  );
  const hasUnsavedRecipeConfig = useMemo(
    () => !recipeConfigStatesMatch(currentRecipeConfigState, recipeConfigSnapshot),
    [currentRecipeConfigState, recipeConfigSnapshot]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortOrderDirection, showInactiveOnly, estadoFiltro, nivelPicanteFiltro]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const refreshInsumosCatalog = useCallback(async () => {
    const rows = await apiFetch('/api/admin/salsas/catalogos/insumos', 'GET', null, { noCache: true });
    const normalized = normalizeInsumosPayload(rows);
    setInsumos(normalized);
    return normalized;
  }, []);

  const loadBase = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams();
      params.set('page', String(currentPage));
      params.set('limit', String(pageSize));
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      params.set('sort_by', 'orden');
      params.set('sort_dir', sortOrderDirection);
      if (showInactiveOnly || estadoFiltro === 'inactivos') {
        params.set('include_inactive', '1');
        params.set('only_inactive', '1');
      } else if (estadoFiltro === 'todos') {
        params.set('include_inactive', '1');
      }
      if (nivelPicanteFiltro !== 'todos') {
        params.set('nivel_picante', String(nivelPicanteFiltro));
      }
      if (publicacionFiltro !== 'todas_las') params.set('publicacion', publicacionFiltro);

      const [salsasRows, recetasRows, insumosRows] = await Promise.all([
        apiFetch(`/api/admin/salsas?${params.toString()}`, 'GET', null, { noCache: true }),
        apiFetch('/api/admin/salsas/catalogos/recetas', 'GET', null, { noCache: true }),
        apiFetch('/api/admin/salsas/catalogos/insumos', 'GET', null, { noCache: true })
      ]);

      const normalizedSalsas = Array.isArray(salsasRows)
        ? salsasRows
        : Array.isArray(salsasRows?.data)
          ? salsasRows.data
          : Array.isArray(salsasRows?.items)
            ? salsasRows.items
            : [];
      const normalizedRecetas = Array.isArray(recetasRows) ? recetasRows : [];
      const normalizedInsumos = normalizeInsumosPayload(insumosRows);
      const apiPagination = Array.isArray(salsasRows) ? null : (salsasRows?.pagination || salsasRows?.meta || null);
      const apiSummary = Array.isArray(salsasRows) ? null : (salsasRows?.summary || null);
      const safeTotalItems = Number(
        apiPagination?.total
        ?? apiPagination?.totalItems
        ?? apiPagination?.count
        ?? normalizedSalsas.length
      ) || 0;
      const safeTotalPages = Math.max(
        1,
        Number(
          apiPagination?.totalPages
          ?? apiPagination?.total_pages
          ?? Math.ceil(safeTotalItems / pageSize)
        ) || 1
      );

      setSalsas(normalizedSalsas);
      setRecetas(normalizedRecetas);
      setInsumos(normalizedInsumos);
      setTotalItems(safeTotalItems);
      setTotalPages(safeTotalPages);
      setInventorySummary({
        activas: Number(apiSummary?.activas || 0),
        listas: Number(apiSummary?.listas || 0),
        pendientes: Number(apiSummary?.pendientes || 0),
        errores: Number(apiSummary?.errores || 0)
      });
      setNextOperationalOrder(Math.max(1, Number(salsasRows?.next_order || 1)));

      setSelectedRecetaId((current) => {
        if (normalizedRecetas.some((row) => String(row?.id_receta) === String(current))) {
          return current;
        }
        return normalizedRecetas[0]?.id_receta ? String(normalizedRecetas[0].id_receta) : '';
      });
    } catch (e) {
      setError(e?.message || 'No se pudo cargar el modulo de salsas.');
      setSalsas([]);
      setRecipeSalsasCatalog([]);
      setRecetas([]);
      setInsumos([]);
      setTotalItems(0);
      setTotalPages(1);
      setInventorySummary(DEFAULT_INVENTORY_SUMMARY);
      setNextOperationalOrder(1);
      setSelectedRecetaId('');
    } finally {
      setLoading(false);
    }
  }, [currentPage, estadoFiltro, nivelPicanteFiltro, pageSize, publicacionFiltro, searchTerm, showInactiveOnly, sortOrderDirection]);

  const loadRecipeConfig = useCallback(async (idReceta) => {
    const id = toPositiveInt(idReceta);
    if (!id) {
      setSelectedSauceIds([]);
      setRecipeSalsasCatalog([]);
      setRules([]);
      setRecipeConfigSnapshot(normalizeRecipeConfigState([], []));
      return;
    }

    try {
      setError('');
      setLoadingRecipeConfig(true);
      const response = await apiFetch(`/api/admin/salsas/recetas/${id}/config`, 'GET', null, { noCache: true });
      const assigned = Array.isArray(response?.salsas_asignadas)
        ? response.salsas_asignadas.map((row) => Number(row)).filter((row) => Number.isInteger(row) && row > 0)
        : [];
      const incomingRules = Array.isArray(response?.reglas) ? response.reglas : [];
      const incomingCatalog = Array.isArray(response?.salsas_catalogo) ? response.salsas_catalogo : [];
      const normalizedRules = incomingRules.map((rule) => ({
        id_local: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        min_unidades: String(rule?.min_unidades ?? 1),
        max_unidades: rule?.max_unidades === null || rule?.max_unidades === undefined ? '' : String(rule.max_unidades),
        salsas_requeridas: String(rule?.salsas_requeridas ?? 0)
      }));

      setRecipeSalsasCatalog(incomingCatalog);
      setSelectedSauceIds(assigned);
      setRules(normalizedRules);
      setRecipeConfigSnapshot(normalizeRecipeConfigState(assigned, normalizedRules));
    } catch (e) {
      setError(e?.message || 'No se pudo cargar la configuracion de salsas por receta.');
      setRecipeSalsasCatalog([]);
      setSelectedSauceIds([]);
      setRules([]);
      setRecipeConfigSnapshot(normalizeRecipeConfigState([], []));
    } finally {
      setLoadingRecipeConfig(false);
    }
  }, []);

  useEffect(() => {
    void loadBase();
  }, [loadBase]);

  useEffect(() => {
    if (!selectedRecetaId) return;
    void loadRecipeConfig(selectedRecetaId);
  }, [loadRecipeConfig, selectedRecetaId]);

  useEffect(() => {
    if (!success) return;
    setToastMessage(success);
  }, [success]);

  useEffect(() => {
    if (!createModalOpen) return;

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeCreateSalsaModal();
      }
    };

    document.addEventListener('keydown', handleEscape);
    const timer = setTimeout(() => {
      if (createNombreInputRef.current) createNombreInputRef.current.focus();
    }, 30);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      clearTimeout(timer);
    };
  }, [createModalOpen, savingSalsa]);

  const closeEstadoConfirm = () => {
    if (savingSalsa) return;
    setEstadoConfirm(null);
  };

  const confirmToggleSalsaEstado = async () => {
    if (!estadoConfirm) return;
    await onToggleSalsaEstado(estadoConfirm);
    setEstadoConfirm(null);
  };

  const estadoConfirmActivo = estadoConfirm ? isRowActive(estadoConfirm?.estado) : false;
  const estadoConfirmNombre = String(estadoConfirm?.nombre || 'Salsa seleccionada');

  const resetForm = useCallback(() => {
    setForm(DEFAULT_FORM);
    setEditingSalsaId(null);
  }, []);

  const closeInventoryModal = (force = false) => {
    if (savingSalsa && !force) return;
    setInventoryModalOpen(false);
    setInventorySalsa(null);
    setInventoryForm(DEFAULT_INVENTORY_FORM);
    setInventoryFieldErrors({});
    setInventoryUseCustomUnit(false);
  };

  const openInventoryModal = (salsa) => {
    const idSalsa = toPositiveInt(salsa?.id_salsa);
    if (!idSalsa) return;
    const idUnidadBase = salsa?.id_unidad_base ? String(salsa.id_unidad_base) : '';
    const idUnidadConsumo = salsa?.id_unidad_consumo ? String(salsa.id_unidad_consumo) : idUnidadBase;
    setInventorySalsa(salsa);
    setInventoryForm({
      id_insumo: salsa?.id_insumo ? String(salsa.id_insumo) : '',
      cantidad_porcion: salsa?.cantidad_porcion ? String(salsa.cantidad_porcion) : '2',
      id_unidad_consumo: idUnidadConsumo || ''
    });
    setInventoryUseCustomUnit(Boolean(idUnidadBase && idUnidadConsumo && idUnidadBase !== idUnidadConsumo));
    setInventoryFieldErrors({});
    setError('');
    setSuccess('');
    setInventoryModalOpen(true);
    void refreshInsumosCatalog().catch((catalogError) => {
      setError(catalogError?.message || 'No se pudo actualizar el catalogo de insumos.');
    });
  };

  const closePublicationModal = () => {
    if (savingPublication) return;
    setPublicationModalOpen(false);
    setPublicationSalsa(null);
    setPublicationRows([]);
  };

  const openPublicationModal = async (salsa) => {
    const idSalsa = toPositiveInt(salsa?.id_salsa);
    if (!idSalsa) return;
    setPublicationSalsa(salsa);
    setPublicationModalOpen(true);
    setLoadingPublication(true);
    setError('');
    try {
      const response = await apiFetch(`/api/admin/salsas/${idSalsa}/sucursales`, 'GET', null, { noCache: true });
      setPublicationRows(Array.isArray(response?.sucursales) ? response.sucursales : []);
    } catch (e) {
      setError(e?.message || 'No se pudo cargar la publicacion por sucursal.');
    } finally {
      setLoadingPublication(false);
    }
  };

  const onTogglePublication = (idSucursal) => {
    setPublicationRows((current) => current.map((row) => (
      Number(row.id_sucursal) === Number(idSucursal)
        ? { ...row, publicada: !row.publicada }
        : row
    )));
  };

  const onSavePublication = async () => {
    const idSalsa = toPositiveInt(publicationSalsa?.id_salsa);
    if (!idSalsa) return;
    try {
      setSavingPublication(true);
      setError('');
      await apiFetch(`/api/admin/salsas/${idSalsa}/sucursales`, 'PUT', {
        sucursales: publicationRows.map((row) => ({
          id_sucursal: Number(row.id_sucursal),
          publicada: Boolean(row.publicada)
        }))
      });
      setSuccess('Publicacion por sucursal actualizada correctamente.');
      setPublicationModalOpen(false);
      setPublicationSalsa(null);
      setPublicationRows([]);
      await loadBase();
      if (selectedRecetaId) await loadRecipeConfig(selectedRecetaId);
    } catch (e) {
      setError(e?.message || 'No se pudo guardar la publicacion por sucursal.');
    } finally {
      setSavingPublication(false);
    }
  };

  const onCreateSalsa = () => {
    setError('');
    setSuccess('');
    setEditingSalsaId(null);
    setForm({
      ...DEFAULT_FORM,
      orden: String(nextOperationalOrder)
    });
    setCreateModalOpen(true);
  };

  const closeCreateSalsaModal = () => {
    if (savingSalsa) return;
    setCreateModalOpen(false);
    resetForm();
  };

  function restoreRecipeConfigFromSnapshot() {
    setSelectedSauceIds(recipeConfigSnapshot.sauceIds);
    setRules(recipeConfigSnapshot.rules.map((rule) => ({
      ...rule,
      id_local: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
    })));
  }

  function openRecipeConfigModal() {
    setError('');
    setSuccess('');
    setRecipeSauceSearch('');
    setRecipeConfigModalOpen(true);
  }

  function requestCloseRecipeConfigModal(action = 'close') {
    if (savingConfig) return;
    if (hasUnsavedRecipeConfig) {
      setRecipeDiscardConfirm({ type: action });
      return;
    }
    setRecipeConfigModalOpen(false);
  }

  function requestRecipeChange(nextRecetaId) {
    if (String(nextRecetaId || '') === String(selectedRecetaId || '')) return;
    if (hasUnsavedRecipeConfig) {
      setRecipeDiscardConfirm({ type: 'change-recipe', nextRecetaId: String(nextRecetaId || '') });
      return;
    }
    setSelectedRecetaId(String(nextRecetaId || ''));
  }

  function closeRecipeDiscardConfirm() {
    if (savingConfig) return;
    setRecipeDiscardConfirm(null);
  }

  function confirmDiscardRecipeChanges() {
    if (!recipeDiscardConfirm) return;
    const pending = recipeDiscardConfirm;
    setRecipeDiscardConfirm(null);

    if (pending.type === 'change-recipe') {
      setSelectedRecetaId(pending.nextRecetaId || '');
      return;
    }

    restoreRecipeConfigFromSnapshot();
    setRecipeConfigModalOpen(false);
  }

  const recipeDiscardConfirmLabel = recipeDiscardConfirm?.type === 'change-recipe'
    ? 'Cambiar receta'
    : 'Cerrar configuracion';

  useEffect(() => {
    if (!recipeConfigModalOpen) return;

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        requestCloseRecipeConfigModal('close');
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [recipeConfigModalOpen, savingConfig, hasUnsavedRecipeConfig]);

  const onChangeForm = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value
    }));
  };

  const changeNumericFormField = (field, delta, options = {}) => {
    const min = options.min ?? 0;
    const max = options.max ?? 9999;
    setForm((current) => {
      const rawValue = Number(current?.[field] ?? 0);
      const safeValue = Number.isFinite(rawValue) ? rawValue : min;
      const nextValue = Math.max(min, Math.min(max, safeValue + delta));
      return { ...current, [field]: String(nextValue) };
    });
  };

  const persistSalsa = async (mode = 'create') => {
    const resolvedOrden = mode === 'create'
      ? null
      : toIntOrNull(form.orden, { min: 0, max: 9999, allowNull: true });

    const payload = {
      nombre: String(form.nombre || '').trim(),
      nivel_picante: toIntOrNull(form.nivel_picante, { min: 0, max: 5 })
    };
    if (mode === 'edit') payload.orden = resolvedOrden;

    if (!payload.nombre) {
      setError('Nombre de salsa es obligatorio.');
      return;
    }
    if (payload.nivel_picante === null) {
      setError('Nivel picante debe ser entero entre 0 y 5.');
      return;
    }
    if (mode === 'edit' && form.orden !== '' && payload.orden === null) {
      setError('Orden debe ser entero positivo o 0.');
      return;
    }
    try {
      setSavingSalsa(true);
      setError('');

      if (mode === 'edit' && editingSalsaId) {
        await apiFetch(`/api/admin/salsas/${editingSalsaId}`, 'PUT', payload);
        setSuccess('Salsa actualizada correctamente.');
      } else {
        await apiFetch('/api/admin/salsas', 'POST', payload);
        setSuccess('Salsa creada correctamente.');
      }

      resetForm();
      setCreateModalOpen(false);
      await loadBase();
    } catch (e) {
      setError(e?.message || 'No se pudo guardar la salsa.');
    } finally {
      setSavingSalsa(false);
    }
  };

  const onSubmitCreateSalsa = async (event) => {
    event.preventDefault();
    await persistSalsa(editingSalsaId ? 'edit' : 'create');
  };
  const onEditSalsa = (salsa) => {
    setEditingSalsaId(Number(salsa?.id_salsa || 0) || null);
    setForm({
      nombre: String(salsa?.nombre || ''),
      nivel_picante: String(Number(salsa?.nivel_picante || 0)),
      orden: salsa?.orden === null || salsa?.orden === undefined ? '' : String(salsa.orden)
    });
    setError('');
    setSuccess('');
    setCreateModalOpen(true);
  };

  const validateInventoryForm = () => {
    const errors = {};
    const idInsumo = toPositiveInt(inventoryForm.id_insumo);
    const cantidad = Number(inventoryForm.cantidad_porcion || 0);
    const idUnidad = toPositiveInt(inventoryForm.id_unidad_consumo);
    if (!idInsumo) errors.id_insumo = 'Selecciona un insumo.';
    if (idInsumo && !selectedInsumoOption) {
      const blocked = blockedInsumos.find((insumo) => Number(insumo?.id_insumo) === idInsumo);
      errors.id_insumo = blocked?.motivo_bloqueo || 'El insumo ya no esta disponible para configurar esta salsa.';
    }
    if (selectedInsumoOption?.disabled) errors.id_insumo = selectedInsumoOption.motivoBloqueo || 'Este insumo no puede seleccionarse.';
    if (!Number.isFinite(cantidad) || cantidad <= 0) errors.cantidad_porcion = 'Indica una cantidad mayor a 0.';
    if (!idUnidad) errors.id_unidad_consumo = 'Selecciona una unidad.';
    if (inventoryUseCustomUnit && selectedInsumoOption?.unidadId !== String(idUnidad)) {
      const hasConversion = (selectedInsumoOption?.conversiones || [])
        .some((conversion) => String(conversion?.id_unidad_consumo) === String(idUnidad));
      if (!hasConversion) errors.id_unidad_consumo = 'No hay conversion activa para esa unidad.';
    }
    return errors;
  };

  const inventorySaveDisabled = !inventorySalsa || savingSalsa || Object.keys(validateInventoryForm()).length > 0;
  const liveInventoryErrors = inventoryModalOpen ? validateInventoryForm() : {};
  const displayedInventoryErrors = { ...liveInventoryErrors, ...inventoryFieldErrors };

  const onSaveSalsaInventory = async () => {
    const idSalsa = toPositiveInt(inventorySalsa?.id_salsa);
    if (!idSalsa) return;
    const errors = validateInventoryForm();
    setInventoryFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      setSavingSalsa(true);
      setError('');
      await apiFetch(`/api/admin/salsas/${idSalsa}/inventario`, 'PUT', {
        id_insumo: toPositiveInt(inventoryForm.id_insumo),
        cantidad_porcion: Number(inventoryForm.cantidad_porcion || 0),
        id_unidad_consumo: toPositiveInt(inventoryForm.id_unidad_consumo)
      });
      setSuccess('Consumo de salsa configurado correctamente.');
      closeInventoryModal(true);
      await loadBase();
      if (selectedRecetaId) await loadRecipeConfig(selectedRecetaId);
    } catch (e) {
      setError(e?.message || 'No se pudo configurar el consumo de la salsa.');
    } finally {
      setSavingSalsa(false);
    }
  };

  const onClearSalsaInventory = async () => {
    const idSalsa = toPositiveInt(inventorySalsa?.id_salsa);
    if (!idSalsa) return;
    try {
      setSavingSalsa(true);
      setError('');
      await apiFetch(`/api/admin/salsas/${idSalsa}/inventario`, 'PUT', {
        id_insumo: null,
        id_unidad_consumo: null
      });
      setSuccess('Configuracion de consumo retirada correctamente.');
      closeInventoryModal(true);
      await loadBase();
      if (selectedRecetaId) await loadRecipeConfig(selectedRecetaId);
    } catch (e) {
      setError(e?.message || 'No se pudo retirar la configuracion de consumo.');
    } finally {
      setSavingSalsa(false);
    }
  };

  const onToggleSalsaEstado = async (salsa) => {
    const idSalsa = toPositiveInt(salsa?.id_salsa);
    if (!idSalsa) return;

    try {
      setError('');
      const nextEstado = !isRowActive(salsa?.estado);
      await apiFetch(`/api/admin/salsas/${idSalsa}/estado`, 'PATCH', { estado: nextEstado });
      setSuccess(nextEstado ? 'Salsa activada correctamente.' : 'Salsa inactivada correctamente.');
      await loadBase();
    } catch (e) {
      setError(e?.message || 'No se pudo cambiar estado de la salsa.');
    }
  };

  const onToggleAssignedSauce = (idSalsa) => {
    const parsedId = toPositiveInt(idSalsa);
    if (!parsedId) return;
    const salsa = activeSalsas.find((row) => Number(row?.id_salsa) === parsedId);
    const alreadySelected = selectedSauceIds.includes(parsedId);
    if (!alreadySelected && salsa?.puede_asignarse_receta !== true) {
      setError(`${salsa?.nombre || 'La salsa'} no puede agregarse hasta configurar inventario.`);
      return;
    }

    setSelectedSauceIds((current) => (
      current.includes(parsedId)
        ? current.filter((value) => value !== parsedId)
        : [...current, parsedId]
    ));
  };

  const onChangeRule = (idLocal, field, value) => {
    setRules((current) => current.map((rule) => (
      rule.id_local === idLocal
        ? { ...rule, [field]: value }
        : rule
    )));
  };

  const onAddRule = () => {
    setRules((current) => [...current, createSuggestedRule(current)]);
  };

  const onRemoveRule = (idLocal) => {
    setRules((current) => {
      const next = current.filter((rule) => rule.id_local !== idLocal);
      return next;
    });
  };

  const normalizeRulesForSave = () => {
    const output = [];
    for (let index = 0; index < rules.length; index += 1) {
      const row = rules[index];
      const min = toIntOrNull(row.min_unidades, { min: 1, max: 9999 });
      const max = row.max_unidades === '' || row.max_unidades === null || row.max_unidades === undefined
        ? null
        : toIntOrNull(row.max_unidades, { min: 1, max: 9999, allowNull: true });
      const required = toIntOrNull(row.salsas_requeridas, { min: 0, max: 99 });

      if (min === null) {
        return { ok: false, message: `Regla #${index + 1}: min_unidades debe ser entero >= 1.` };
      }
      if (row.max_unidades !== '' && max === null) {
        return { ok: false, message: `Regla #${index + 1}: max_unidades debe ser entero >= 1 o vacio.` };
      }
      if (max !== null && max < min) {
        return { ok: false, message: `Regla #${index + 1}: max_unidades no puede ser menor a min_unidades.` };
      }
      if (required === null) {
        return { ok: false, message: `Regla #${index + 1}: salsas_requeridas debe ser entero >= 0.` };
      }

      output.push({
        min_unidades: min,
        max_unidades: max,
        salsas_requeridas: required
      });
    }

    return { ok: true, data: output };
  };

  const validateRulesConsistency = (normalizedRules) => {
    if (!Array.isArray(normalizedRules) || normalizedRules.length === 0) return { ok: true };
    if (selectedSauceIds.length <= 0) {
      return { ok: false, message: 'Selecciona al menos una salsa permitida antes de guardar reglas para esta receta.' };
    }

    const sortedRules = [...normalizedRules]
      .map((rule) => ({
        min_unidades: Number(rule.min_unidades),
        max_unidades: rule.max_unidades === null ? null : Number(rule.max_unidades),
        salsas_requeridas: Number(rule.salsas_requeridas)
      }))
      .sort((left, right) => left.min_unidades - right.min_unidades);

    for (let index = 0; index < sortedRules.length; index += 1) {
      const currentRule = sortedRules[index];
      if (currentRule.salsas_requeridas > selectedSauceIds.length) {
        return {
          ok: false,
          message: `Regla #${index + 1}: salsas requeridas no puede exceder las ${selectedSauceIds.length} salsas seleccionadas.`
        };
      }

      if (index === 0) continue;

      const previousRule = sortedRules[index - 1];
      const previousMax = previousRule.max_unidades === null ? Number.POSITIVE_INFINITY : previousRule.max_unidades;
      if (currentRule.min_unidades <= previousMax) {
        return {
          ok: false,
          message: 'No se permiten rangos traslapados. Usa rangos inclusivos sin repetir unidades, por ejemplo: 1-6, 7-12, 13-18.'
        };
      }
    }

    return { ok: true };
  };

  const onSaveRecipeConfig = async () => {
    const idReceta = toPositiveInt(selectedRecetaId);
    if (!idReceta) {
      setError('Selecciona una receta para guardar configuracion de salsas.');
      return;
    }

    const normalizedRules = normalizeRulesForSave();
    if (!normalizedRules.ok) {
      setError(normalizedRules.message);
      return;
    }
    const rulesConsistency = validateRulesConsistency(normalizedRules.data);
    if (!rulesConsistency.ok) {
      setError(rulesConsistency.message);
      return;
    }
    const invalidSelected = selectedSauceIds
      .map((idSalsa) => activeSalsas.find((row) => Number(row?.id_salsa) === Number(idSalsa)))
      .find((row) => row && row.puede_asignarse_receta !== true);
    if (invalidSelected) {
      setError(`${invalidSelected.nombre} no puede guardarse en receta hasta configurar inventario.`);
      return;
    }

    try {
      setSavingConfig(true);
      setError('');
      await apiFetch(`/api/admin/salsas/recetas/${idReceta}/config`, 'PUT', {
        salsas_asignadas: [...new Set(selectedSauceIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))],
        reglas: normalizedRules.data
      });

      setSuccess('Configuracion de salsas guardada correctamente.');
      await loadRecipeConfig(idReceta);
    } catch (e) {
      setError(e?.message || 'No se pudo guardar configuracion de salsas por receta.');
    } finally {
      setSavingConfig(false);
    }
  };

  const scrollMobileSalsas = (direction) => {
    const node = mobileSalsaCarouselRef.current;
    if (!node) return;
    const delta = Math.max(260, node.clientWidth || 0) * direction;
    node.scrollBy({ left: delta, behavior: 'smooth' });
  };

  return (
    <div className="menu-salsas-admin">
      <div className="card shadow-sm mb-3 inv-prod-card menu-salsas-admin__card">
        <div className="card-header inv-prod-header menu-salsas-admin__header">
          <div className="inv-prod-title-wrap">
            <div className="inv-prod-title-row">
              <i className="bi bi-droplet inv-prod-title-icon" />
              <span className="inv-prod-title">Salsas</span>
            </div>
            <div className="inv-prod-subtitle">
              Crea y administra salsas del menu, con nivel picante y orden operativo.
            </div>
          </div>
          <div className="inv-prod-header-actions menu-salsas-admin__header-actions">
            <span className="inv-prod-active-filter-pill">Total de Salsas creadas: {totalItems}</span>
            <button
              type="button"
              className="btn inv-prod-btn-subtle menu-salsas-admin__config-btn"
              onClick={openRecipeConfigModal}
              disabled={loading || savingSalsa || savingConfig || !canEditSalsa}
            >
              <i className="bi bi-sliders" aria-hidden="true" />
              Configurar salsas por receta
            </button>
            <button
              type="button"
              className="btn inv-prod-toolbar-btn menu-salsas-admin__reload-btn"
              onClick={onCreateSalsa}
              disabled={savingSalsa || savingConfig || !canCreateSalsa}
            >
              <i className="bi bi-plus-lg" aria-hidden="true" />
              Nueva salsa
            </button>
          </div>
        </div>

        <div className="card-body">
          {error ? <div className="alert alert-danger mb-3">{error}</div> : null}
          <div className="d-flex flex-wrap gap-2 mb-3">
            <span className="badge text-bg-light border">Activas: {inventoryStats.active}</span>
            <span className="badge text-bg-success">Listas: {inventoryStats.ready}</span>
            <span className="badge text-bg-warning">Pendientes: {inventoryStats.pending}</span>
            <span className="badge text-bg-danger">Con errores: {inventoryStats.errors}</span>
          </div>

          <div className="row g-3 menu-salsas-admin__layout-row">
            <div className="col-12 menu-salsas-admin__table-col">
              <div className="table-responsive border rounded-3 menu-salsas-admin__table-wrap">
                <div className="menu-salsas-admin__table-toolbar">
                  <div className="menu-salsas-admin__search-wrap">
                    <input
                      type="search"
                      className="form-control menu-salsas-admin__search-input"
                      placeholder="Buscar salsa..."
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                    />
                    <span className="menu-salsas-admin__search-icon">
                      <i className="bi bi-search" aria-hidden="true" />
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn menu-salsas-admin__filter-btn"
                    onClick={() => setSearchTerm('')}
                    title="Limpiar busqueda"
                    aria-label="Limpiar busqueda"
                  >
                    <i className="bi bi-funnel" aria-hidden="true" />
                  </button>
                  <select
                    className="form-select menu-salsas-admin__toolbar-select"
                    value={estadoFiltro}
                    onChange={(event) => setEstadoFiltro(event.target.value)}
                    disabled={loading}
                    aria-label="Filtrar por estado"
                  >
                    <option value="todos">Todos</option>
                    <option value="activos">Activas</option>
                    <option value="inactivos">Inactivas</option>
                  </select>
                  <select
                    className="form-select menu-salsas-admin__toolbar-select"
                    value={nivelPicanteFiltro}
                    onChange={(event) => setNivelPicanteFiltro(event.target.value)}
                    disabled={loading}
                    aria-label="Filtrar por nivel picante"
                  >
                    <option value="todos">Todos los niveles</option>
                    {[0, 1, 2, 3, 4, 5].map((level) => (
                      <option key={`filtro-picante-${level}`} value={String(level)}>
                        Picante {level}
                      </option>
                    ))}
                  </select>
                  <select
                    className="form-select menu-salsas-admin__toolbar-select"
                    value={publicacionFiltro}
                    onChange={(event) => setPublicacionFiltro(event.target.value)}
                    disabled={loading}
                    aria-label="Filtrar por publicacion"
                  >
                    <option value="todas_las">Toda publicacion</option>
                    <option value="todas">Todas las sucursales</option>
                    <option value="parcial">Publicacion parcial</option>
                    <option value="ninguna">Sin publicar</option>
                  </select>
                  <button
                    type="button"
                    className="btn menu-salsas-admin__order-btn"
                    onClick={() => setSortOrderDirection((current) => (current === 'asc' ? 'desc' : 'asc'))}
                    aria-label="Cambiar orden"
                  >
                    Orden: {sortOrderDirection === 'asc' ? 'Ascendente' : 'Descendente'}
                    <i className={`bi ${sortOrderDirection === 'asc' ? 'bi-chevron-down' : 'bi-chevron-up'}`} aria-hidden="true" />
                  </button>
                  <label className="form-check form-switch mb-0 personas-page__inactive-toggle inv-catpro-inline-toggle">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      role="switch"
                      checked={showInactiveOnly}
                      onChange={(event) => setShowInactiveOnly(event.target.checked)}
                      aria-label="Ver inactivos"
                    />
                    <span className="form-check-label">Ver inactivos</span>
                  </label>
                </div>
                <table className="table table-sm align-middle mb-0 menu-salsas-admin__table">
                  <thead>
                    <tr>
                      <th>Orden</th>
                      <th>Salsa</th>
                      <th>Estado</th>
                      <th>Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedSalsas.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-3">
                          {loading ? 'Cargando salsas...' : 'No hay salsas registradas.'}
                        </td>
                      </tr>
                    ) : (
                      paginatedSalsas.map((row) => {
                        const isActive = isRowActive(row?.estado);
                        return (
                          <tr key={`salsa-${row.id_salsa}`} className="menu-salsas-admin__table-row">
                            <td>{Number(row?.orden || 0)}</td>
                            <td>
                              <div className="menu-salsas-admin__salsa-cell">
                                <span className="menu-salsas-admin__salsa-avatar">
                                  <i className="bi bi-droplet-fill" aria-hidden="true" />
                                </span>
                                <span>{row.nombre}</span>
                              </div>
                            </td>
                            <td>
                              <span className={`menu-recetas-admin__estado-badge ${isActive ? 'is-active' : 'is-inactive'}`}>
                                {isActive ? 'Activa' : 'Inactiva'}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn menu-salsas-admin__detail-btn"
                                onClick={() => setDetailSalsa(row)}
                                aria-label={`Ver detalle de ${row.nombre}`}
                              >
                                <i className="bi bi-eye" aria-hidden="true" />
                                Ver detalle
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
                <div className="menu-salsas-admin__mobile-carousel-shell" aria-label="Listado movil de salsas">
                  <div className="menu-salsas-admin__mobile-carousel-head">
                    <span>{loading ? 'Cargando salsas...' : `${paginatedSalsas.length} salsas en esta pagina`}</span>
                    <div className="menu-salsas-admin__mobile-carousel-controls">
                      <button
                        type="button"
                        className="menu-salsas-admin__mobile-nav"
                        onClick={() => scrollMobileSalsas(-1)}
                        disabled={loading || mobileSalsaSlides.length <= 1}
                        aria-label="Ver salsas anteriores"
                      >
                        <i className="bi bi-chevron-left" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="menu-salsas-admin__mobile-nav"
                        onClick={() => scrollMobileSalsas(1)}
                        disabled={loading || mobileSalsaSlides.length <= 1}
                        aria-label="Ver mas salsas"
                      >
                        <i className="bi bi-chevron-right" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {paginatedSalsas.length === 0 ? (
                    <div className="menu-salsas-admin__mobile-empty">
                      {loading ? 'Cargando salsas...' : 'No hay salsas registradas.'}
                    </div>
                  ) : (
                    <div className="menu-salsas-admin__mobile-carousel" ref={mobileSalsaCarouselRef}>
                      {mobileSalsaSlides.map((slide, slideIndex) => (
                        <div className="menu-salsas-admin__mobile-slide" key={`salsa-slide-${slideIndex}`}>
                          {slide.map((row) => {
                            const isActive = isRowActive(row?.estado);
                            const spicyLevel = Math.max(0, Math.min(5, Number(row?.nivel_picante || 0)));
                            return (
                              <article className="menu-salsas-admin__mobile-card" key={`mobile-salsa-${row.id_salsa}`}>
                                <div className="menu-salsas-admin__mobile-card-head">
                                  <span className="menu-salsas-admin__salsa-avatar">
                                    <i className="bi bi-droplet-fill" aria-hidden="true" />
                                  </span>
                                  <div>
                                    <small>Orden {Number(row?.orden || 0)}</small>
                                    <strong>{row.nombre}</strong>
                                  </div>
                                </div>
                                <div className="menu-salsas-admin__mobile-card-body">
                                  <div className="menu-salsas-admin__mobile-meta">
                                    <span>Picante</span>
                                    <strong>{Number(row?.nivel_picante || 0)}</strong>
                                  </div>
                                  <span className="menu-salsas-admin__spicy-dots" aria-hidden="true">
                                    {[0, 1, 2, 3, 4].map((index) => (
                                      <span
                                        key={`mobile-spicy-${row.id_salsa}-${index}`}
                                        className={`menu-salsas-admin__spicy-dot ${index < spicyLevel ? 'is-on' : ''}`}
                                      />
                                    ))}
                                  </span>
                                  <span className={`menu-recetas-admin__estado-badge ${isActive ? 'is-active' : 'is-inactive'}`}>
                                    {isActive ? 'Activa' : 'Inactiva'}
                                  </span>
                                  <div className="menu-salsas-admin__mobile-meta">
                                    <span>Inventario</span>
                                    <strong>{getInventoryStatusText(row)}</strong>
                                  </div>
                                  <div className="menu-salsas-admin__mobile-meta">
                                    <span>Publicacion</span>
                                    <strong>{Number(row?.sucursales_publicadas || 0)} de {Number(row?.sucursales_activas || 0)}</strong>
                                  </div>
                                </div>
                                <div className="menu-salsas-admin__mobile-actions">
                                  <button
                                    type="button"
                                    className="btn menu-salsas-admin__detail-btn menu-salsas-admin__detail-btn--mobile"
                                    onClick={() => setDetailSalsa(row)}
                                    aria-label={`Ver detalle de ${row.nombre}`}
                                  >
                                    <i className="bi bi-eye" aria-hidden="true" />
                                    <span>Ver detalle</span>
                                  </button>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="menu-salsas-admin__table-footer">
                  <div className="inv-warehouse-moves__pagination inv-ins-pagination">
                    <div className="inv-warehouse-moves__pagination-meta inv-ins-pagination__page">
                      Mostrando {totalItems === 0 ? 0 : ((safeCurrentPage - 1) * pageSize) + 1}
                      -{Math.min(safeCurrentPage * pageSize, totalItems)} de {totalItems}
                    </div>
                    <div className="inv-warehouse-moves__pagination-controls">
                      <button
                        type="button"
                        className="inv-prod-toolbar-btn inv-warehouse-moves__page-btn"
                        onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                        disabled={loading || safeCurrentPage <= 1}
                        aria-label="Pagina anterior"
                      >
                        <i className="bi bi-chevron-left" aria-hidden="true" />
                        Anterior
                      </button>
                      <div className="inv-warehouse-moves__pagination-pages">
                        {visiblePageNumbers.map((pageNumber) => (
                          <button
                            key={pageNumber}
                            type="button"
                            className={`inv-warehouse-moves__page-number ${pageNumber === safeCurrentPage ? 'is-active' : ''}`.trim()}
                            onClick={() => setCurrentPage(pageNumber)}
                            aria-label={`Ir a la pagina ${pageNumber}`}
                            aria-current={pageNumber === safeCurrentPage ? 'page' : undefined}
                          >
                            {pageNumber}
                          </button>
                        ))}
                      </div>
                      <div className="inv-warehouse-moves__pagination-status inv-ins-pagination__page">
                        Pagina {safeCurrentPage} de {totalPages}
                      </div>
                      <button
                        type="button"
                        className="inv-prod-toolbar-btn inv-warehouse-moves__page-btn"
                        onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                        disabled={loading || safeCurrentPage >= totalPages}
                        aria-label="Pagina siguiente"
                      >
                        Siguiente
                        <i className="bi bi-chevron-right" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {detailSalsa ? (
        <div className="inv-prod-pmodal inv-prod-pmodal--create show">
          <div className="inv-prod-pmodal__overlay" onClick={() => setDetailSalsa(null)} />
          <div className="inv-prod-pmodal__viewport">
            <section
              className="inv-prod-pmodal__panel inv-prod-pmodal__panel--create menu-salsas-detail"
              role="dialog"
              aria-modal="true"
              aria-labelledby="menu-salsa-detail-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="inv-prod-pmodal__form-shell inv-prod-pmodal__form-shell--create">
                <div className="inv-prod-pmodal__body">
                  <div className="inv-ins-create-hero is-edit">
                    <button
                      type="button"
                      className="inv-prod-drawer-close inv-ins-create-hero__close"
                      onClick={() => setDetailSalsa(null)}
                      aria-label="Cerrar detalle de salsa"
                    >
                      <i className="bi bi-x-lg" aria-hidden="true" />
                    </button>
                    <div className="inv-ins-create-hero__icon"><i className="bi bi-droplet-fill" aria-hidden="true" /></div>
                    <div className="inv-ins-create-hero__copy">
                      <div className="inv-ins-create-hero__kicker">Detalle de salsa</div>
                      <div id="menu-salsa-detail-title" className="inv-ins-create-hero__title">
                        {detailSalsa.nombre || `Salsa #${detailSalsa.id_salsa}`}
                      </div>
                    </div>
                  </div>

                  <div className="menu-salsas-detail__grid">
                    <div className="menu-salsas-detail__item">
                      <span>Orden operativo</span>
                      <strong>{Number(detailSalsa?.orden || 0)}</strong>
                    </div>
                    <div className="menu-salsas-detail__item">
                      <span>Estado</span>
                      <span className={`menu-recetas-admin__estado-badge ${isRowActive(detailSalsa?.estado) ? 'is-active' : 'is-inactive'}`}>
                        {isRowActive(detailSalsa?.estado) ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>
                    <div className="menu-salsas-detail__item">
                      <span>Nivel picante</span>
                      <div className="menu-salsas-admin__spicy-cell">
                        <i className="bi bi-droplet menu-salsas-admin__spicy-icon" aria-hidden="true" />
                        <strong>{Number(detailSalsa?.nivel_picante || 0)} · {SPICY_LEVEL_LABELS[Number(detailSalsa?.nivel_picante || 0)] || 'Sin definir'}</strong>
                        <span className="menu-salsas-admin__spicy-dots" aria-hidden="true">
                          {[0, 1, 2, 3, 4].map((index) => (
                            <span
                              key={`detail-spicy-${detailSalsa.id_salsa}-${index}`}
                              className={`menu-salsas-admin__spicy-dot ${index < Math.max(0, Math.min(5, Number(detailSalsa?.nivel_picante || 0))) ? 'is-on' : ''}`}
                            />
                          ))}
                        </span>
                      </div>
                    </div>
                    <div className="menu-salsas-detail__item">
                      <span>Publicacion</span>
                      <strong>{Number(detailSalsa?.sucursales_publicadas || 0)} de {Number(detailSalsa?.sucursales_activas || 0)} sucursales</strong>
                      <small>Solo las sucursales publicadas muestran esta salsa en Caja y menu publico.</small>
                    </div>
                    <div className="menu-salsas-detail__item menu-salsas-detail__item--wide">
                      <span>Inventario</span>
                      <strong>{getInventoryStatusText(detailSalsa)}</strong>
                      <small>{detailSalsa?.inventario_mensaje || 'Sin observaciones adicionales.'}</small>
                    </div>
                  </div>
                </div>
                <div className="inv-prod-pmodal__footer inv-prod-pmodal__footer--create menu-salsas-detail__footer">
                  <button
                    type="button"
                    className="btn inv-prod-btn-subtle"
                    onClick={() => {
                      const salsa = detailSalsa;
                      setDetailSalsa(null);
                      onEditSalsa(salsa);
                    }}
                    disabled={!canEditSalsa}
                  >
                    <i className="bi bi-pencil-square" aria-hidden="true" /> Editar
                  </button>
                  <button
                    type="button"
                    className="btn inv-prod-btn-subtle"
                    onClick={() => {
                      const salsa = detailSalsa;
                      setDetailSalsa(null);
                      openInventoryModal(salsa);
                    }}
                    disabled={!canEditSalsa}
                  >
                    <i className="bi bi-box-seam" aria-hidden="true" /> Configurar consumo
                  </button>
                  <button
                    type="button"
                    className="btn inv-prod-btn-primary"
                    onClick={() => {
                      const salsa = detailSalsa;
                      setDetailSalsa(null);
                      void openPublicationModal(salsa);
                    }}
                    disabled={!canEditSalsa}
                  >
                    <i className="bi bi-shop" aria-hidden="true" /> Publicar por sucursal
                  </button>
                  <button
                    type="button"
                    className={`btn ${isRowActive(detailSalsa?.estado) ? 'btn-outline-danger' : 'btn-outline-success'}`}
                    onClick={() => {
                      const salsa = detailSalsa;
                      setDetailSalsa(null);
                      setEstadoConfirm(salsa);
                    }}
                    disabled={!canToggleSalsaEstado}
                  >
                    <i className={`bi ${isRowActive(detailSalsa?.estado) ? 'bi-slash-circle' : 'bi-check-circle'}`} aria-hidden="true" />
                    {isRowActive(detailSalsa?.estado) ? ' Inactivar' : ' Activar'}
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {recipeConfigModalOpen ? (
        <div className="inv-prod-pmodal inv-prod-pmodal--recipe-config show">
          <div className="inv-prod-pmodal__overlay" onClick={() => requestCloseRecipeConfigModal('close')} />
          <div className="inv-prod-pmodal__viewport">
            <section
              className="inv-prod-pmodal__panel inv-prod-pmodal__panel--recipe-config menu-salsas-receta-admin"
              role="dialog"
              aria-modal="true"
              aria-labelledby="menu-salsas-receta-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="menu-salsas-receta-admin__header">
                <div className="menu-salsas-receta-admin__title-wrap">
                  <span className="menu-salsas-receta-admin__icon-box"><i className="bi bi-sliders" /></span>
                  <div>
                    <div id="menu-salsas-receta-title" className="inv-prod-title">Configurar salsas por receta</div>
                    <div className="inv-prod-subtitle">Define salsas permitidas y reglas según la cantidad de unidades del pedido.</div>
                  </div>
                </div>
                <div className="menu-salsas-receta-admin__header-actions">
                  <span className="inv-prod-active-filter-pill">{activeSalsas.length} salsas</span>
                  {hasUnsavedRecipeConfig ? <span className="menu-salsas-receta-admin__dirty-badge">Cambios sin guardar</span> : null}
                  <button
                    type="button"
                    className="inv-prod-drawer-close"
                    onClick={() => requestCloseRecipeConfigModal('close')}
                    aria-label="Cerrar configuracion de salsas por receta"
                    disabled={savingConfig}
                  >
                    <i className="bi bi-x-lg" />
                  </button>
                </div>
              </div>
              <div className="inv-prod-pmodal__body menu-salsas-receta-admin__body">
          <div className="menu-salsas-receta-admin__tip">
            <i className="bi bi-lightbulb" />
            Ejemplo: de 1 a 6 unidades requiere 1 salsa; de 7 a 12 unidades requiere 2 salsas.
          </div>

          {loadingRecipeConfig ? <div className="alert alert-info mb-3">Cargando configuracion de receta...</div> : null}
          {error ? <div className="alert alert-danger mb-3">{error}</div> : null}
          {success ? <div className="alert alert-success mb-3">{success}</div> : null}

          <div className="menu-salsas-receta-admin__content">
            <section className="menu-salsas-receta-admin__left">
              <div className="menu-salsas-receta-admin__section-title"><i className="bi bi-pin-angle" />Seleccionar receta</div>
              <AppSelect
                className="menu-salsas-receta-admin__recipe-select app-select--compact app-select--warm"
                value={selectedRecetaId}
                options={recetaOptions}
                onChange={requestRecipeChange}
                placeholder="Selecciona receta"
                searchable
                searchPlaceholder="Buscar receta..."
                emptyText="No hay recetas para mostrar."
                disabled={loading || loadingRecipeConfig || recetas.length === 0}
              />

              <div className="menu-salsas-receta-admin__divider" />
              <div className="menu-salsas-receta-admin__section-title">Salsas permitidas</div>

              <div className="menu-salsas-receta-admin__search">
                <i className="bi bi-search" />
                <input
                  type="search"
                  className="form-control"
                  placeholder="Buscar salsa..."
                  value={recipeSauceSearch}
                  onChange={(event) => setRecipeSauceSearch(event.target.value)}
                />
              </div>

              <div className="menu-salsas-receta-admin__count">
                Salsas seleccionadas: {selectedSauceIds.length} de {activeSalsas.length}
              </div>

              <div className="menu-salsas-receta-admin__sauces-list">
                {filteredAssignableSalsas.length === 0 ? (
                  <div className="menu-salsas-receta-admin__empty">No hay salsas para mostrar.</div>
                ) : (
                  filteredAssignableSalsas.map((salsa) => {
                    const idSalsa = Number(salsa.id_salsa);
                    const checked = selectedSauceIds.includes(idSalsa);
                    const spicy = Number(salsa?.nivel_picante || 0);
                    const intensity = getSpicyIntensity(spicy);
                    const blockedForNewSelection = !checked && salsa?.puede_asignarse_receta !== true;
                    return (
                      <label
                        key={`assign-${idSalsa}`}
                        className={`menu-salsas-receta-admin__sauce-item ${checked ? 'is-selected' : ''} ${blockedForNewSelection ? 'is-disabled' : ''}`}
                        htmlFor={`assign_salsa_${idSalsa}`}
                      >
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`assign_salsa_${idSalsa}`}
                          checked={checked}
                          onChange={() => onToggleAssignedSauce(idSalsa)}
                          disabled={loadingRecipeConfig || !canEditSalsa || blockedForNewSelection}
                        />
                        <span className="menu-salsas-receta-admin__sauce-avatar"><i className="bi bi-droplet-fill" /></span>
                        <span className="menu-salsas-receta-admin__sauce-copy">
                          <strong>{salsa.nombre}</strong>
                          <small>Picante {spicy}</small>
                          <small>{getInventoryStatusText(salsa)}</small>
                          <span className="menu-salsas-receta-admin__dots">
                            {Array.from({ length: 5 }).map((_, index) => (
                              <span key={`${idSalsa}-dot-${index}`} className={`menu-salsas-receta-admin__dot ${index < spicy ? 'is-on' : ''}`} />
                            ))}
                          </span>
                        </span>
                        <span className={`menu-salsas-receta-admin__intensity ${intensity.className}`}>{intensity.label}</span>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={(event) => {
                            event.preventDefault();
                            openInventoryModal(salsa);
                          }}
                          disabled={!canEditSalsa}
                        >
                          Configurar
                        </button>
                      </label>
                    );
                  })
                )}
              </div>
            </section>

            <section className="menu-salsas-receta-admin__right">
              <div className="menu-salsas-receta-admin__right-head">
                <div className="menu-salsas-receta-admin__section-title"><i className="bi bi-sliders" />Reglas de salsas por unidades</div>
                <button type="button" className="btn btn-outline-danger" onClick={onAddRule} disabled={loadingRecipeConfig || !canEditSalsa}>+ Agregar regla</button>
              </div>

              <div className="table-responsive menu-salsas-receta-admin__rules-table">
                <table className="table table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Desde</th>
                      <th>Hasta</th>
                      <th>Salsas requeridas</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="menu-salsas-receta-admin__empty">No hay reglas configuradas.</td>
                      </tr>
                    ) : (
                      rules.map((rule) => (
                        <tr key={rule.id_local}>
                          <td>
                            <input type="number" className="form-control form-control-sm" min={1} value={rule.min_unidades} onChange={(event) => onChangeRule(rule.id_local, 'min_unidades', event.target.value)} disabled={loadingRecipeConfig || !canEditSalsa} />
                            <small>unidad</small>
                          </td>
                          <td>
                            <input type="number" className="form-control form-control-sm" min={1} placeholder="Sin maximo" value={rule.max_unidades} onChange={(event) => onChangeRule(rule.id_local, 'max_unidades', event.target.value)} disabled={loadingRecipeConfig || !canEditSalsa} />
                            <small>{rule.max_unidades === '' ? 'Sin máximo' : 'unidad'}</small>
                          </td>
                          <td>
                            <input type="number" className="form-control form-control-sm" min={0} value={rule.salsas_requeridas} onChange={(event) => onChangeRule(rule.id_local, 'salsas_requeridas', event.target.value)} disabled={loadingRecipeConfig || !canEditSalsa} />
                            <small>salsa</small>
                          </td>
                          <td>
                            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onRemoveRule(rule.id_local)} aria-label="Eliminar regla" disabled={loadingRecipeConfig || !canEditSalsa}>
                              <i className="bi bi-trash" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

            </section>
          </div>
              </div>
              <div className="inv-prod-pmodal__footer inv-prod-pmodal__footer--recipe-config menu-salsas-receta-admin__footer">
                <button
                  type="button"
                  className="btn inv-prod-btn-subtle"
                  onClick={() => requestCloseRecipeConfigModal('cancel')}
                  disabled={savingConfig}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn inv-prod-btn-primary"
                  onClick={() => void onSaveRecipeConfig()}
                  disabled={savingConfig || loadingRecipeConfig || !selectedRecetaId || !canEditSalsa}
                >
                  <i className="bi bi-floppy" /> {savingConfig ? 'Guardando...' : 'Guardar configuración'}
                </button>
              </div>
            </section>
          </div>
        </div>
      ) : null}

      <MenuActionToast
        title="OK"
        message={toastMessage}
        onClose={() => setToastMessage('')}
      />

      {publicationModalOpen ? (
        <div className="inv-prod-pmodal inv-prod-pmodal--create show">
          <div className="inv-prod-pmodal__overlay" onClick={closePublicationModal} />
          <div className="inv-prod-pmodal__viewport">
            <section
              className="inv-prod-pmodal__panel inv-prod-pmodal__panel--create"
              role="dialog"
              aria-modal="true"
              aria-labelledby="menu-salsa-publication-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="inv-prod-pmodal__form-shell inv-prod-pmodal__form-shell--create">
                <div className="inv-prod-pmodal__body">
                  <div className="inv-ins-create-hero is-edit">
                    <button
                      type="button"
                      className="inv-prod-drawer-close inv-ins-create-hero__close"
                      onClick={closePublicationModal}
                      aria-label="Cerrar publicacion por sucursal"
                      disabled={savingPublication}
                    >
                      <i className="bi bi-x-lg" />
                    </button>
                    <div className="inv-ins-create-hero__icon"><i className="bi bi-shop" /></div>
                    <div className="inv-ins-create-hero__copy">
                      <div className="inv-ins-create-hero__kicker">Disponibilidad</div>
                      <div id="menu-salsa-publication-title" className="inv-ins-create-hero__title">
                        Publicar {publicationSalsa?.nombre || 'salsa'}
                      </div>
                    </div>
                  </div>

                  {error ? <div className="alert alert-danger mt-3 mb-0">{error}</div> : null}
                  <div className="inv-prod-pmodal__sections mt-3">
                    <section className="inv-prod-pmodal__section">
                      <div className="inv-prod-pmodal__section-head">
                        <div className="inv-prod-pmodal__section-title">Sucursales activas</div>
                        <div className="inv-prod-pmodal__section-sub">La publicacion requiere inventario valido y stock para una porcion.</div>
                      </div>
                      {loadingPublication ? <div className="py-3 text-muted">Cargando sucursales...</div> : null}
                      {!loadingPublication && publicationRows.length === 0 ? <div className="py-3 text-muted">No hay sucursales activas.</div> : null}
                      <div className="d-grid gap-2">
                        {publicationRows.map((row) => {
                          const blocked = !row.publicada && !row.puede_publicarse;
                          return (
                            <div key={`publication-${row.id_sucursal}`} className="border rounded p-3">
                              <div className="d-flex align-items-start justify-content-between gap-3">
                                <div>
                                  <div className="fw-semibold">{row.nombre_sucursal}</div>
                                  <div className="small text-muted">
                                    Inventario: {row.inventario_configurado ? 'configurado' : 'pendiente'} · Stock: {row.stock_disponible ?? 'no disponible'}
                                  </div>
                                  {row.motivo_bloqueo ? <div className="small text-danger mt-1">{row.motivo_bloqueo}</div> : null}
                                </div>
                                <div className="form-check form-switch">
                                  <input
                                    className="form-check-input"
                                    type="checkbox"
                                    role="switch"
                                    checked={Boolean(row.publicada)}
                                    onChange={() => onTogglePublication(row.id_sucursal)}
                                    disabled={savingPublication || blocked}
                                    aria-label={`Publicar en ${row.nombre_sucursal}`}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  </div>
                </div>
                <div className="inv-prod-pmodal__footer inv-prod-pmodal__footer--create">
                  <button className="btn inv-prod-btn-subtle" type="button" onClick={closePublicationModal} disabled={savingPublication}>Cancelar</button>
                  <button className="btn inv-prod-btn-primary" type="button" onClick={() => void onSavePublication()} disabled={loadingPublication || savingPublication}>
                    <i className="bi bi-check-circle" aria-hidden="true" />
                    {savingPublication ? 'Guardando...' : 'Guardar publicacion'}
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {inventoryModalOpen ? (
        <div className="inv-prod-pmodal inv-prod-pmodal--create show">
          <div className="inv-prod-pmodal__overlay" onClick={closeInventoryModal} />
          <div className="inv-prod-pmodal__viewport">
            <section
              className="inv-prod-pmodal__panel inv-prod-pmodal__panel--create"
              role="dialog"
              aria-modal="true"
              aria-labelledby="menu-salsa-inventory-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="inv-prod-pmodal__form-shell inv-prod-pmodal__form-shell--create">
                <div className="inv-prod-pmodal__body">
                  <div className="inv-ins-create-hero is-edit">
                    <button
                      type="button"
                      className="inv-prod-drawer-close inv-ins-create-hero__close"
                      onClick={closeInventoryModal}
                      aria-label="Cerrar configuracion de consumo"
                      disabled={savingSalsa}
                    >
                      <i className="bi bi-x-lg" />
                    </button>
                    <div className="inv-ins-create-hero__icon">
                      <i className="bi bi-box-seam" aria-hidden="true" />
                    </div>
                    <div className="inv-ins-create-hero__copy">
                      <div className="inv-ins-create-hero__kicker">Inventario</div>
                      <div id="menu-salsa-inventory-title" className="inv-ins-create-hero__title">
                        Configurar consumo de {inventorySalsa?.nombre || 'salsa'}
                      </div>
                    </div>
                  </div>

                  {error ? <div className="alert alert-danger mt-3 mb-0">{error}</div> : null}

                  <div className="inv-prod-pmodal__sections mt-3">
                    <section className="inv-prod-pmodal__section">
                      <div className="inv-prod-pmodal__section-head">
                        <div className="inv-prod-pmodal__section-title">Consumo por seleccion</div>
                        <div className="inv-prod-pmodal__section-sub">Define que insumo se descuenta cada vez que el cliente elige esta salsa.</div>
                      </div>

                      <div className="mb-2">
                        <label className="form-label" htmlFor="menu_salsa_inventory_insumo">Insumo que se descontara</label>
                        <AppSelect
                          inputId="menu_salsa_inventory_insumo"
                          className="menu-salsas-receta-admin__recipe-select app-select--compact"
                          value={inventoryForm.id_insumo}
                          options={insumoOptions}
                          onChange={(value) => {
                            const option = insumoOptions.find((entry) => String(entry.value) === String(value));
                            setInventoryForm((current) => ({
                              ...current,
                              id_insumo: String(value || ''),
                              cantidad_porcion: /(^|\s)(onza|oz)(\s|$)/i.test(String(option?.unidadLabel || ''))
                                ? '2'
                                : current.cantidad_porcion,
                              id_unidad_consumo: option?.unidadId ? String(option.unidadId) : ''
                            }));
                            setInventoryUseCustomUnit(false);
                            setInventoryFieldErrors((current) => ({ ...current, id_insumo: '', id_unidad_consumo: '' }));
                          }}
                          placeholder="Selecciona insumo..."
                          searchable
                          searchPlaceholder="Buscar insumo..."
                          emptyText="No hay insumos disponibles."
                          disabled={savingSalsa}
                        />
                        {displayedInventoryErrors.id_insumo ? <div className="text-danger small mt-1">{displayedInventoryErrors.id_insumo}</div> : null}
                        {selectedInsumoOption ? (
                          <div className="mt-2 small">
                            <div className="fw-semibold">#{selectedInsumoOption.value} · {selectedInsumoOption.nombre}</div>
                            <div className="text-muted">Unidad base: {selectedInsumoOption.unidadLabel || 'Sin unidad'}</div>
                            <div className="text-success">Disponible</div>
                          </div>
                        ) : null}
                      </div>

                      <div className="row g-2">
                        <div className="col-sm-6">
                          <label className="form-label" htmlFor="menu_salsa_inventory_cantidad">Cantidad por seleccion</label>
                          <input
                            id="menu_salsa_inventory_cantidad"
                            type="number"
                            className="form-control"
                            value={inventoryForm.cantidad_porcion}
                            min="0.0001"
                            step="0.0001"
                            onChange={(event) => {
                              setInventoryForm((current) => ({ ...current, cantidad_porcion: event.target.value }));
                              setInventoryFieldErrors((current) => ({ ...current, cantidad_porcion: '' }));
                            }}
                            disabled={savingSalsa}
                          />
                          {displayedInventoryErrors.cantidad_porcion ? <div className="text-danger small mt-1">{displayedInventoryErrors.cantidad_porcion}</div> : null}
                        </div>
                        <div className="col-sm-6">
                          <label className="form-label" htmlFor="menu_salsa_inventory_unidad">Unidad</label>
                          <AppSelect
                            inputId="menu_salsa_inventory_unidad"
                            className="menu-salsas-receta-admin__recipe-select app-select--compact"
                            value={inventoryForm.id_unidad_consumo}
                            options={unidadOptions}
                            onChange={(value) => {
                              setInventoryForm((current) => ({ ...current, id_unidad_consumo: String(value || '') }));
                              setInventoryFieldErrors((current) => ({ ...current, id_unidad_consumo: '' }));
                            }}
                            placeholder="Unidad..."
                            searchable={inventoryUseCustomUnit}
                            searchPlaceholder="Buscar unidad..."
                            emptyText="No hay conversiones disponibles."
                            disabled={savingSalsa || !inventoryForm.id_insumo || !inventoryUseCustomUnit}
                          />
                          {displayedInventoryErrors.id_unidad_consumo ? <div className="text-danger small mt-1">{displayedInventoryErrors.id_unidad_consumo}</div> : null}
                        </div>
                      </div>

                      <div className="form-check form-switch mt-3">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="menu_salsa_inventory_custom_unit"
                          checked={inventoryUseCustomUnit}
                          onChange={(event) => {
                            const enabled = event.target.checked;
                            setInventoryUseCustomUnit(enabled);
                            setInventoryForm((current) => ({
                              ...current,
                              id_unidad_consumo: enabled ? current.id_unidad_consumo : (selectedInsumoOption?.unidadId || '')
                            }));
                          }}
                          disabled={savingSalsa || !selectedInsumoOption}
                        />
                        <label className="form-check-label" htmlFor="menu_salsa_inventory_custom_unit">Usar otra unidad</label>
                      </div>

                      {inventoryWarning ? <div className="alert alert-warning py-2 mt-2 mb-0">{inventoryWarning}</div> : null}

                      {selectedInsumoOption && inventoryForm.cantidad_porcion && inventoryForm.id_unidad_consumo ? (
                        <div className="alert alert-info py-2 mt-3 mb-0">
                          Cada vez que el cliente elija {inventorySalsa?.nombre || 'esta salsa'} se descontaran {Number(inventoryForm.cantidad_porcion || 0)} {unidadOptions.find((unit) => String(unit.value) === String(inventoryForm.id_unidad_consumo))?.label || 'unidad'} de {selectedInsumoOption.nombre || selectedInsumoOption.label}.
                        </div>
                      ) : null}
                    </section>

                    {blockedInsumos.length > 0 ? (
                      <section className="inv-prod-pmodal__section">
                        <div className="inv-prod-pmodal__section-head">
                          <div className="inv-prod-pmodal__section-title">Insumos no disponibles</div>
                        </div>
                        <div className="d-grid gap-2">
                          {blockedInsumos.map((insumo) => (
                            <div key={`blocked-insumo-${insumo.id_insumo}`} className="border-top pt-2 small">
                              <div className="fw-semibold">#{insumo.id_insumo} · {insumo.nombre}</div>
                              <div className="text-muted">Unidad base: {insumo.unidad_base?.etiqueta || insumo.unidad_base?.nombre || 'Sin unidad'}</div>
                              <div className="text-danger">{insumo.motivo_bloqueo || 'Configuracion incompleta.'}</div>
                            </div>
                          ))}
                        </div>
                      </section>
                    ) : null}
                  </div>
                </div>

                <div className="inv-prod-pmodal__footer inv-prod-pmodal__footer--create">
                  <button className="btn inv-prod-btn-subtle" type="button" onClick={onClearSalsaInventory} disabled={savingSalsa || !inventorySalsa?.id_insumo}>
                    Retirar configuracion
                  </button>
                  <button className="btn inv-prod-btn-subtle" type="button" onClick={closeInventoryModal} disabled={savingSalsa}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn inv-prod-btn-primary menu-salsas-admin__submit-btn"
                    disabled={inventorySaveDisabled}
                    onClick={() => void onSaveSalsaInventory()}
                  >
                    <i className="bi bi-check-circle" aria-hidden="true" />
                    {savingSalsa ? 'Guardando...' : 'Guardar consumo'}
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {createModalOpen ? (
        <div className="inv-prod-pmodal inv-prod-pmodal--create show">
          <div className="inv-prod-pmodal__overlay" onClick={closeCreateSalsaModal} />
          <div className="inv-prod-pmodal__viewport">
            <section
              className="inv-prod-pmodal__panel inv-prod-pmodal__panel--create"
              role="dialog"
              aria-modal="true"
              aria-labelledby="menu-salsa-create-title"
              onClick={(event) => event.stopPropagation()}
            >
              <form onSubmit={onSubmitCreateSalsa} className="inv-prod-pmodal__form-shell inv-prod-pmodal__form-shell--create">
              <div className="inv-prod-pmodal__body">
                <div className={`inv-ins-create-hero ${editingSalsaId ? 'is-edit' : 'is-create'}`}>
                  <button
                    type="button"
                    className="inv-prod-drawer-close inv-ins-create-hero__close"
                    onClick={closeCreateSalsaModal}
                    aria-label="Cerrar modal de salsa"
                    disabled={savingSalsa}
                  >
                    <i className="bi bi-x-lg" />
                  </button>
                  <div className="inv-ins-create-hero__icon">
                    <i className="bi bi-droplet" aria-hidden="true" />
                  </div>
                  <div className="inv-ins-create-hero__copy">
                    <div className="inv-ins-create-hero__kicker">{editingSalsaId ? 'Edicion Activa' : 'Nuevo Registro'}</div>
                    <div id="menu-salsa-create-title" className="inv-ins-create-hero__title">
                      {editingSalsaId ? `Editar salsa #${editingSalsaId}` : 'Nueva salsa'}
                    </div>
                  </div>
                  <div className="inv-ins-create-hero__chips">
                    <span className="inv-ins-create-hero__chip">
                      <i className="bi bi-collection" aria-hidden="true" />
                      Menu
                    </span>
                    <span className="inv-ins-create-hero__chip">
                      <i className="bi bi-fire" aria-hidden="true" />
                      Nivel 0 a 5
                    </span>
                  </div>
                </div>

                {error ? <div className="alert alert-danger mt-3 mb-0">{error}</div> : null}

                <div className="inv-prod-pmodal__sections mt-3">
                  <section className="inv-prod-pmodal__section">
                    <div className="inv-prod-pmodal__section-head">
                      <div className="inv-prod-pmodal__section-title">Datos principales</div>
                      <div className="inv-prod-pmodal__section-sub">Configura nombre, picante y prioridad operativa.</div>
                    </div>

                    <div className="menu-salsas-admin__edit-head">
                      <span className="menu-salsas-admin__edit-head-icon">
                        <i className="bi bi-basket2" aria-hidden="true" />
                      </span>
                      <h6 className="mb-0 menu-salsas-admin__form-title">
                        {editingSalsaId ? `Editar salsa #${editingSalsaId}` : 'Nueva salsa'}
                      </h6>
                    </div>

                    <div className="mb-2">
                      <label className="form-label" htmlFor="menu_salsa_modal_nombre">Nombre de la salsa</label>
                      <div className="menu-salsas-admin__input-icon-wrap">
                        <span className="menu-salsas-admin__input-icon">
                          <i className="bi bi-list-ul" aria-hidden="true" />
                        </span>
                        <input
                          id="menu_salsa_modal_nombre"
                          ref={createNombreInputRef}
                          type="text"
                          className="form-control"
                          name="nombre"
                          value={form.nombre}
                          onChange={onChangeForm}
                          placeholder="Ej: Buffalo"
                          maxLength={120}
                          required
                        />
                      </div>
                    </div>

                    <div className="row g-2 menu-salsas-admin__form-grid">
                      <div className="col-sm-12">
                        <label className="form-label" htmlFor="menu_salsa_modal_picante">Nivel picante</label>
                        <div className="menu-salsas-admin__stepper">
                          <button type="button" className="menu-salsas-admin__stepper-btn" onClick={() => changeNumericFormField('nivel_picante', -1, { min: 0, max: 5 })}>
                            <i className="bi bi-droplet" />
                          </button>
                          <input
                            id="menu_salsa_modal_picante"
                            type="number"
                            className="form-control menu-salsas-admin__stepper-input"
                            name="nivel_picante"
                            value={form.nivel_picante}
                            onChange={onChangeForm}
                            min={0}
                            max={5}
                            required
                          />
                          <button type="button" className="menu-salsas-admin__stepper-btn" onClick={() => changeNumericFormField('nivel_picante', 1, { min: 0, max: 5 })}>
                            <i className="bi bi-plus-lg" />
                          </button>
                        </div>
                        <div className="menu-salsas-admin__hint-meter">
                          <div
                            className="menu-salsas-admin__hint-meter-fill"
                            style={{ width: `${(currentSpicyLevel / 5) * 100}%` }}
                            data-level={currentSpicyLevel}
                          />
                        </div>
                        <div className="menu-salsas-admin__hint-text">{SPICY_LEVEL_LABELS[currentSpicyLevel] || 'Suave'}</div>
                      </div>
                    </div>

                    <div className="menu-salsas-admin__quick-view">
                      <span className="menu-salsas-admin__quick-icon">
                        <i className="bi bi-star-fill" aria-hidden="true" />
                      </span>
                      <div>
                        <div className="menu-salsas-admin__quick-title">Vista rápida</div>
                        <div className="menu-salsas-admin__quick-copy">Esta salsa será la #{Math.max(1, Number(form.orden || 1))} en el orden de preparación.</div>
                      </div>
                    </div>

                  </section>
                </div>
              </div>

                <div className="inv-prod-pmodal__footer inv-prod-pmodal__footer--create">
                  <button className="btn inv-prod-btn-subtle" type="button" onClick={resetForm} disabled={savingSalsa}>
                    Limpiar
                  </button>
                  <button className="btn inv-prod-btn-subtle" type="button" onClick={closeCreateSalsaModal} disabled={savingSalsa}>
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn inv-prod-btn-primary menu-salsas-admin__submit-btn"
                    disabled={savingSalsa}
                  >
                    <i className="bi bi-check-circle" aria-hidden="true" />
                    {savingSalsa ? 'Guardando...' : editingSalsaId ? 'Actualizar salsa' : 'Crear salsa'}
                  </button>
                </div>
              </form>
            </section>
          </div>
        </div>
      ) : null}

      <MenuConfirmDialog
        open={Boolean(recipeDiscardConfirm)}
        title="Descartar cambios"
        subtitle="La configuracion actual tiene cambios sin guardar"
        question="Deseas descartar los cambios de salsas por receta?"
        description="El guardado reemplaza toda la configuracion de la receta seleccionada. Esta accion conserva la ultima configuracion guardada."
        itemLabel={recipeDiscardConfirmLabel}
        itemIcon="bi-exclamation-triangle-fill"
        confirmLabel="Descartar cambios"
        confirmingLabel="Descartando..."
        loading={savingConfig}
        onClose={closeRecipeDiscardConfirm}
        onConfirm={confirmDiscardRecipeChanges}
      />

      <MenuConfirmDialog
        open={Boolean(estadoConfirm)}
        title={estadoConfirmActivo ? 'Confirmar inactivacion' : 'Confirmar activacion'}
        subtitle={estadoConfirmActivo ? 'La salsa dejara de estar disponible' : 'La salsa volvera a estar disponible'}
        question={estadoConfirmActivo ? 'Deseas inactivar esta salsa?' : 'Deseas activar esta salsa?'}
        description="El cambio afecta las opciones disponibles para recetas configuradas."
        itemLabel={estadoConfirmNombre}
        itemIcon={estadoConfirmActivo ? 'bi-slash-circle' : 'bi-check-circle'}
        confirmLabel={estadoConfirmActivo ? 'Inactivar' : 'Activar'}
        confirmingLabel="Procesando..."
        loading={savingSalsa}
        onClose={closeEstadoConfirm}
        onConfirm={confirmToggleSalsaEstado}
      />
    </div>
  );
};

export default MenuSalsasAdmin;











