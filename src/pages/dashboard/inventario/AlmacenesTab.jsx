import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { inventarioService } from '../../../services/inventarioService';
import sucursalesService from '../../../services/sucursalesService';
import SinPermiso from '../../../components/common/SinPermiso';
import { usePermisos } from '../../../context/PermisosContext';
import { PERMISSIONS } from '../../../utils/permissions';
import { useAuth } from '../../../hooks/useAuth';
import MovimientosTab from './MovimientosTab.jsx';
import CompactHeaderSwitch from './CompactHeaderSwitch.jsx';
import ProveedoresTab from './ProveedoresTab.jsx';

// NEW: normaliza el estado de sucursal para soportar booleans, strings y numericos.
// WHY: `sucursales` y `almacenes` pueden traer el estado en distintos formatos segun el origen.
// IMPACT: solo afecta labels/filtros; no modifica payloads ni persistencia.
const parseBooleanEstado = (value) => {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return Boolean(value);
};

const parseSucursalEstado = (value) => parseBooleanEstado(value);
const parseAlmacenEstado = (value) => parseBooleanEstado(value);
const ALMACENES_NO_DELETE_MESSAGE =
  'Los almacenes no se eliminan; se inactivan para preservar la trazabilidad del inventario.';
const ALMACENES_INACTIVATION_POLICY_MESSAGE =
  'La inactivacion solo es posible cuando no compromete stock ni operacion.';
const ALMACENES_SUCURSAL_CHANGE_CONFLICT_MESSAGE =
  'No se puede cambiar la sucursal de este almacen porque ya tiene historial operativo. Para preservar la trazabilidad, crea un nuevo almacen en la sucursal correcta.';
const ALMACENES_SUCURSAL_CHANGE_POLICY_MESSAGE =
  'La sucursal solo puede cambiarse cuando el almacen no tiene historial operativo.';
const ALMACENES_CONCURRENCY_CONFLICT_MESSAGE =
  'El almacen fue modificado por otro usuario. Recarga la informacion antes de guardar.';
const ALMACENES_SCOPE_BLOCKED_MESSAGE =
  'No tienes acceso al recurso solicitado dentro de tu alcance de sucursal.';
const ALMACENES_SCOPE_NOT_FOUND_MESSAGE =
  'El almacen solicitado no esta disponible en tu alcance actual o no existe.';

const resolveAlmacenesRequestMessage = (error, fallbackMessage) => {
  const status = Number(error?.status ?? 0);
  const code = String(error?.code ?? error?.data?.code ?? '').trim().toUpperCase();
  const apiMessage = String(error?.message ?? '').trim();

  if (status === 403 || code === 'FORBIDDEN') {
    return apiMessage || ALMACENES_SCOPE_BLOCKED_MESSAGE;
  }

  if (status === 404 && /almacen no encontrado/i.test(apiMessage)) {
    return ALMACENES_SCOPE_NOT_FOUND_MESSAGE;
  }

  return apiMessage || fallbackMessage;
};

const formatSucursalOptionLabel = (sucursal, id) => {
  const safeId = String(id ?? sucursal?.id_sucursal ?? '').trim();
  if (!safeId) return 'Sucursal sin ID';
  if (!sucursal) return `Sucursal ${safeId}`;

  const nombre = String(sucursal?.nombre_sucursal ?? '').trim() || `Sucursal ${safeId}`;
  return `${nombre}${parseSucursalEstado(sucursal?.estado) ? '' : ' (Inactiva)'}`;
};

const formatSucursalDisplayLabel = (sucursal, id) => {
  const safeId = String(id ?? '').trim();
  if (!safeId) return 'Sucursal sin ID';
  if (!sucursal) return `Sucursal ${safeId}`;

  const nombre = String(sucursal?.nombre_sucursal ?? '').trim() || `Sucursal ${safeId}`;
  return `${nombre}${parseSucursalEstado(sucursal?.estado) ? '' : ' (Inactiva)'}`;
};

const buildSucursalSelectOptions = ({ activeSucursales, sucursalesMap, selectedId }) => {
  const options = new Map();

  for (const sucursal of Array.isArray(activeSucursales) ? activeSucursales : []) {
    const id = String(sucursal?.id_sucursal ?? '').trim();
    if (!id) continue;

    options.set(id, {
      id,
      label: formatSucursalOptionLabel(sucursal, id),
      disabled: false
    });
  }

  const selectedKey = String(selectedId ?? '').trim();
  if (selectedKey && !options.has(selectedKey)) {
    options.set(selectedKey, {
      id: selectedKey,
      label: formatSucursalOptionLabel(sucursalesMap.get(selectedKey), selectedKey),
      disabled: true
    });
  }

  return Array.from(options.values()).sort((left, right) => Number(left.id) - Number(right.id));
};

// NEW: define el badge visible de estado usando el dato real disponible mas cercano (`sucursales.estado`).
// WHY: `almacenes` no tiene columna propia de estado y la UI requiere una senal operativa sin inventar campos.
// IMPACT: solo presentacion; el dato persistido sigue siendo `sucursal_estado`.
const getAlmacenStatusMeta = (almacen) => {
  const hasAlmacenState = almacen?.estado !== undefined && almacen?.estado !== null;
  if (hasAlmacenState) {
    return parseAlmacenEstado(almacen?.estado)
      ? { label: 'ACTIVO', className: 'is-active', hint: 'Estado propio del almacen' }
      : { label: 'INACTIVO', className: 'is-inactive', hint: 'INACTIVO - no disponible para operaciones' };
  }

  const hasSucursalState = almacen?.sucursal_estado !== undefined && almacen?.sucursal_estado !== null;
  if (!hasSucursalState) {
    return { label: 'N/D', className: 'is-unknown', hint: 'Sin estado relacionado en BD' };
  }

  return parseSucursalEstado(almacen?.sucursal_estado)
    ? { label: 'ACTIVO', className: 'is-active', hint: 'Basado en la sucursal relacionada' }
    : { label: 'INACTIVO', className: 'is-inactive', hint: 'Basado en la sucursal relacionada' };
};

const formatMetricValue = (value) => {
  if (value === undefined || value === null || value === '') return 'N/D';
  const numeric = Number(value);
  return Number.isFinite(numeric) ? String(numeric) : String(value);
};

const getAlmacenActionMeta = (almacen) => {
  const isActivo = parseAlmacenEstado(almacen?.estado);

  if (!isActivo) {
    return {
      action: 'reactivar',
      label: 'Reactivar',
      icon: 'bi bi-arrow-clockwise',
      buttonClass: 'btn inv-prod-btn-subtle inv-warehouse-card__action',
      title: 'Reactivar almacen'
    };
  }

  return {
    action: 'inactivar',
    label: 'Inactivar',
    icon: 'bi bi-slash-circle',
    buttonClass: 'btn inv-prod-btn-subtle inv-warehouse-card__action',
    title: 'Inactivar'
  };
};

const getConfirmCopyByAction = (action) => {
  if (action === 'inactivar') {
    return {
      title: 'Confirmar inactivacion',
      subtitle: 'El almacen dejara de estar disponible en listas activas.',
      note: `${ALMACENES_NO_DELETE_MESSAGE} ${ALMACENES_INACTIVATION_POLICY_MESSAGE}`,
      question: 'Deseas inactivar este almacen?',
      actionLabel: 'Inactivar',
      actionBusyLabel: 'Inactivando...',
      actionIcon: 'bi-slash-circle'
    };
  }

  if (action === 'reactivar') {
    return {
      title: 'Confirmar reactivacion',
      subtitle: 'El almacen volvera a estar disponible para operaciones.',
      note: 'Puedes volver a ocultarlo inactivandolo nuevamente cuando sea necesario.',
      question: 'Deseas reactivar este almacen?',
      actionLabel: 'Reactivar',
      actionBusyLabel: 'Reactivando...',
      actionIcon: 'bi-arrow-clockwise'
    };
  }

  return {
    title: 'Confirmar inactivacion',
    subtitle: 'El almacen dejara de estar disponible en listas activas.',
    note: `${ALMACENES_NO_DELETE_MESSAGE} ${ALMACENES_INACTIVATION_POLICY_MESSAGE}`,
    question: 'Deseas inactivar este almacen?',
    actionLabel: 'Inactivar',
    actionBusyLabel: 'Inactivando...',
    actionIcon: 'bi-slash-circle'
  };
};

const toFiniteNonNegativeNumber = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return numeric;
};

const normalizeAlmacenDependencies = (payload) => {
  const countsRaw = payload?.counts && typeof payload.counts === 'object' ? payload.counts : {};
  const stockRaw = payload?.stock && typeof payload.stock === 'object' ? payload.stock : {};
  const normalizedReasons = Array.isArray(payload?.blockingReasons)
    ? payload.blockingReasons
        .map((reason) => String(reason ?? '').trim())
        .filter(Boolean)
    : [];
  const normalizedSucursalChangeReasons = Array.isArray(payload?.sucursalChangeBlockingReasons)
    ? payload.sucursalChangeBlockingReasons
        .map((reason) => String(reason ?? '').trim())
        .filter(Boolean)
    : [];

  const counts = {
    movimientos: toFiniteNonNegativeNumber(countsRaw.movimientos),
    movimientos_recientes: toFiniteNonNegativeNumber(countsRaw.movimientos_recientes),
    productos: toFiniteNonNegativeNumber(countsRaw.productos),
    productos_activos: toFiniteNonNegativeNumber(countsRaw.productos_activos),
    insumos: toFiniteNonNegativeNumber(countsRaw.insumos),
    insumos_activos: toFiniteNonNegativeNumber(countsRaw.insumos_activos),
    ordenes_compra_abiertas: toFiniteNonNegativeNumber(countsRaw.ordenes_compra_abiertas)
  };

  const stock = {
    productos: toFiniteNonNegativeNumber(stockRaw.productos),
    insumos: toFiniteNonNegativeNumber(stockRaw.insumos)
  };
  stock.total =
    toFiniteNonNegativeNumber(stockRaw.total) || stock.productos + stock.insumos;

  const hasStock = payload?.hasStock === true || stock.total > 0;
  const hasActiveOperationalDependencies =
    payload?.hasActiveOperationalDependencies === true ||
    counts.movimientos_recientes > 0 ||
    counts.productos_activos > 0 ||
    counts.insumos_activos > 0 ||
    counts.ordenes_compra_abiertas > 0;
  const hasOperationalHistory =
    payload?.hasOperationalHistory === true ||
    counts.movimientos > 0 ||
    stock.total > 0 ||
    counts.productos > 0 ||
    counts.insumos > 0 ||
    counts.ordenes_compra_abiertas > 0;

  let canDeactivate;
  if (payload?.canDeactivate === true || payload?.canInactivate === true) {
    canDeactivate = true;
  } else if (payload?.canDeactivate === false || payload?.canInactivate === false) {
    canDeactivate = false;
  } else {
    canDeactivate = !(hasStock || hasActiveOperationalDependencies || normalizedReasons.length > 0);
  }

  const fallbackReason = hasStock
    ? 'No se puede inactivar el almacen porque tiene stock disponible.'
    : counts.movimientos_recientes > 0
    ? 'No se puede inactivar el almacen porque tiene movimientos recientes.'
    : counts.productos_activos > 0 || counts.insumos_activos > 0
    ? 'No se puede inactivar el almacen porque mantiene dependencias operativas activas.'
    : counts.ordenes_compra_abiertas > 0
    ? 'No se puede inactivar el almacen porque tiene ordenes de compra en curso asociadas.'
    : 'No se puede inactivar el almacen porque mantiene dependencias operativas activas.';

  const blockingReasons = normalizedReasons.length
    ? normalizedReasons
    : canDeactivate
    ? []
    : [fallbackReason];

  let canChangeSucursal;
  if (
    payload?.canChangeSucursal === true ||
    payload?.canChangeBranch === true ||
    payload?.canUpdateSucursal === true
  ) {
    canChangeSucursal = true;
  } else if (
    payload?.canChangeSucursal === false ||
    payload?.canChangeBranch === false ||
    payload?.canUpdateSucursal === false
  ) {
    canChangeSucursal = false;
  } else {
    canChangeSucursal = !hasOperationalHistory;
  }

  const fallbackSucursalChangeReason = counts.movimientos > 0
    ? 'No se puede cambiar la sucursal de este almacen porque ya registra movimientos de inventario.'
    : hasStock
    ? 'No se puede cambiar la sucursal de este almacen porque tiene stock disponible.'
    : counts.ordenes_compra_abiertas > 0
    ? 'No se puede cambiar la sucursal de este almacen porque tiene ordenes de compra en curso asociadas.'
    : counts.productos > 0 || counts.insumos > 0
    ? 'No se puede cambiar la sucursal de este almacen porque mantiene productos o insumos vinculados.'
    : ALMACENES_SUCURSAL_CHANGE_CONFLICT_MESSAGE;

  const sucursalChangeBlockingReasons = normalizedSucursalChangeReasons.length
    ? normalizedSucursalChangeReasons
    : canChangeSucursal
    ? []
    : [fallbackSucursalChangeReason];

  return {
    counts,
    stock,
    hasStock,
    hasActiveOperationalDependencies,
    hasOperationalHistory,
    canDeactivate,
    canInactivate: canDeactivate,
    blockingReasons,
    primaryBlockingReason: blockingReasons[0] || '',
    canChangeSucursal,
    canChangeBranch: canChangeSucursal,
    canUpdateSucursal: canChangeSucursal,
    sucursalChangeBlockingReasons,
    sucursalChangePrimaryReason: sucursalChangeBlockingReasons[0] || ''
  };
};

const AlmacenesTab = ({ openToast }) => {
  const { user } = useAuth();
  const { can, canAny, loading: permisosLoading } = usePermisos();
  const canVerAlmacenes = can(PERMISSIONS.INVENTARIO_ALMACENES_VER);
  const canCrearAlmacenes = can(PERMISSIONS.INVENTARIO_ALMACENES_CREAR);
  const canEditarAlmacenes = can(PERMISSIONS.INVENTARIO_ALMACENES_EDITAR);
  const canCambiarEstadoAlmacenes = can(PERMISSIONS.INVENTARIO_ALMACENES_ESTADO_CAMBIAR);
  const canVerProveedores = can(PERMISSIONS.INVENTARIO_PROVEEDORES_VER);
  const canAccessAlmacenesTab = canAny([
    PERMISSIONS.INVENTARIO_ALMACENES_VER,
    PERMISSIONS.INVENTARIO_ALMACENES_CREAR,
    PERMISSIONS.INVENTARIO_ALMACENES_EDITAR,
    PERMISSIONS.INVENTARIO_ALMACENES_ELIMINAR,
    PERMISSIONS.INVENTARIO_ALMACENES_ESTADO_CAMBIAR,
    PERMISSIONS.INVENTARIO_PROVEEDORES_VER,
    PERMISSIONS.INVENTARIO_PROVEEDORES_CREAR,
    PERMISSIONS.INVENTARIO_PROVEEDORES_EDITAR,
    PERMISSIONS.INVENTARIO_PROVEEDORES_ELIMINAR,
    PERMISSIONS.INVENTARIO_PROVEEDORES_ESTADO_CAMBIAR,
    PERMISSIONS.INVENTARIO_MOVIMIENTOS_VER,
    PERMISSIONS.INVENTARIO_MOVIMIENTOS_CREAR,
    PERMISSIONS.INVENTARIO_MOVIMIENTOS_EDITAR,
    PERMISSIONS.INVENTARIO_MOVIMIENTOS_ELIMINAR
  ]);

  const canRunAlmacenAction = (action) => {
    if (action === 'inactivar' || action === 'reactivar') return canCambiarEstadoAlmacenes;
    return false;
  };

  const resolveDefaultScope = () => {
    if (canVerAlmacenes) return 'almacenes';
    if (canVerProveedores) return 'proveedores';
    return 'almacenes';
  };

  // AM: switch principal del submodulo para alternar entre Almacenes y Proveedores.
  const [catalogScope, setCatalogScope] = useState(resolveDefaultScope);
  const [almacenes, setAlmacenes] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingSucursales, setLoadingSucursales] = useState(false);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [showInactivos, setShowInactivos] = useState(false);
  const [selectedAlmacenId, setSelectedAlmacenId] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState({ nombre: '', id_sucursal: '' });
  const [createErrors, setCreateErrors] = useState({});
  const [savingCreate, setSavingCreate] = useState(false);

  const [detailId, setDetailId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editErrors, setEditErrors] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  const [confirmModal, setConfirmModal] = useState({
    show: false,
    idToDelete: null,
    nombre: '',
    action: 'inactivar',
    counts: null,
    dependency: null
  });
  const [deletingConfirm, setDeletingConfirm] = useState(false);
  const [resolvingActionId, setResolvingActionId] = useState(null);
  const [confirmDeleteError, setConfirmDeleteError] = useState('');
  const [inactivationRulesByAlmacenId, setInactivationRulesByAlmacenId] = useState({});
  const [loadingEditDependencies, setLoadingEditDependencies] = useState(false);

  const movimientosRef = useRef(null);
  const catalogRequestIdRef = useRef(0);
  const almacenesRequestIdRef = useRef(0);
  const dependenciasRequestIdRef = useRef(0);
  const editDependenciasRequestIdRef = useRef(0);
  const modalPortalTarget = typeof document !== 'undefined' ? document.body : null;
  const showEditModal = Boolean(editForm && editId !== null);

  const safeToast = (title, message, variant = 'success') => {
    if (typeof openToast === 'function') openToast(title, message, variant);
  };

  const isSuperAdminUser = useMemo(
    () =>
      Array.isArray(user?.roles) &&
      user.roles.some((role) => String(role ?? '').trim().toUpperCase().replace(/\s+/g, '_') === 'SUPER_ADMIN'),
    [user?.roles]
  );

  const userSucursalId = useMemo(() => {
    const parsed = Number.parseInt(String(user?.id_sucursal ?? '').trim(), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, [user?.id_sucursal]);

  const sucursalesVisibles = useMemo(() => {
    const source = Array.isArray(sucursales) ? sucursales : [];
    if (isSuperAdminUser) return source;

    const allowedIds = new Set();
    for (const almacen of Array.isArray(almacenes) ? almacenes : []) {
      const idSucursal = String(almacen?.id_sucursal ?? '').trim();
      if (idSucursal) allowedIds.add(idSucursal);
    }
    if (userSucursalId) {
      allowedIds.add(String(userSucursalId));
    }

    if (allowedIds.size === 0) return [];
    return source.filter((sucursal) => allowedIds.has(String(sucursal?.id_sucursal ?? '').trim()));
  }, [almacenes, isSuperAdminUser, sucursales, userSucursalId]);

  const rememberInactivationRule = (idAlmacen, dependencyPayload) => {
    const id = Number(idAlmacen ?? 0);
    if (!id) return null;

    const normalized = normalizeAlmacenDependencies(dependencyPayload);
    setInactivationRulesByAlmacenId((current) => ({
      ...current,
      [String(id)]: normalized
    }));
    return normalized;
  };

  const loadEditDependencyRule = async (idAlmacen, { notifyError = false } = {}) => {
    const id = Number(idAlmacen ?? 0);
    if (!id) return null;

    const cachedRule = inactivationRulesByAlmacenId[String(id)];
    if (cachedRule) return cachedRule;

    const requestId = ++editDependenciasRequestIdRef.current;
    setLoadingEditDependencies(true);

    try {
      const deps = await inventarioService.getAlmacenDependencias(id);
      if (requestId !== editDependenciasRequestIdRef.current) return null;
      return rememberInactivationRule(id, deps);
    } catch (requestError) {
      if (requestId !== editDependenciasRequestIdRef.current) return null;
      if (notifyError) {
        const message = resolveAlmacenesRequestMessage(
          requestError,
          'No se pudieron consultar las dependencias operativas del almacen.'
        );
        safeToast('AVISO', message, 'warning');
      }
      return null;
    } finally {
      if (requestId === editDependenciasRequestIdRef.current) {
        setLoadingEditDependencies(false);
      }
    }
  };

  const sucursalesMap = useMemo(() => {
    const map = new Map();
    for (const sucursal of Array.isArray(sucursalesVisibles) ? sucursalesVisibles : []) {
      const key = String(sucursal?.id_sucursal ?? '').trim();
      if (!key) continue;
      map.set(key, sucursal);
    }
    return map;
  }, [sucursalesVisibles]);

  const sucursalesActivas = useMemo(() => {
    return (Array.isArray(sucursalesVisibles) ? [...sucursalesVisibles] : [])
      .filter((sucursal) => parseSucursalEstado(sucursal?.estado))
      .sort((left, right) => Number(left?.id_sucursal ?? 0) - Number(right?.id_sucursal ?? 0));
  }, [sucursalesVisibles]);

  const createSucursalOptions = useMemo(
    () =>
      buildSucursalSelectOptions({
        activeSucursales: sucursalesActivas,
        sucursalesMap,
        selectedId: form.id_sucursal
      }),
    [form.id_sucursal, sucursalesActivas, sucursalesMap]
  );

  const editSucursalOptions = useMemo(
    () =>
      buildSucursalSelectOptions({
        activeSucursales: sucursalesActivas,
        sucursalesMap,
        selectedId: editForm?.id_sucursal
      }),
    [editForm?.id_sucursal, sucursalesActivas, sucursalesMap]
  );

  const canCreateWithCatalog = createSucursalOptions.length > 0 || loadingSucursales;
  const canEditWithCatalog = editSucursalOptions.length > 0 || loadingSucursales;

  const editHasLegacySelected =
    !!editForm &&
    !loadingSucursales &&
    editSucursalOptions.some(
      (option) => option.id === String(editForm?.id_sucursal ?? '').trim() && option.disabled === true
    );

  const validarAlmacen = (data, { allowLegacyId = null } = {}) => {
    const errors = {};
    const nombre = String(data?.nombre ?? '').trim();
    const sucRaw = String(data?.id_sucursal ?? '').trim();
    const id_sucursal = Number.parseInt(sucRaw, 10);

    if (nombre.length < 2) errors.nombre = 'MINIMO 2 CARACTERES';
    else if (nombre.length > 80) errors.nombre = 'MAXIMO 80 CARACTERES';

    if (!sucRaw) {
      errors.id_sucursal = 'LA SUCURSAL ES OBLIGATORIA';
    } else if (!/^\d+$/.test(sucRaw)) {
      errors.id_sucursal = 'SELECCIONA UNA SUCURSAL VALIDA';
    } else if (Number.isNaN(id_sucursal) || id_sucursal <= 0) {
      errors.id_sucursal = 'SELECCIONA UNA SUCURSAL VALIDA';
    } else {
      const selectedKey = String(id_sucursal);
      const legacyKey = String(allowLegacyId ?? '').trim();
      const sucursal = sucursalesMap.get(selectedKey);
      const legacyAllowed = legacyKey !== '' && legacyKey === selectedKey;

      if (!sucursal && !legacyAllowed) {
        errors.id_sucursal = 'LA SUCURSAL SELECCIONADA NO EXISTE EN EL CATALOGO';
      } else if (sucursal && !parseSucursalEstado(sucursal?.estado) && !legacyAllowed) {
        errors.id_sucursal = 'LA SUCURSAL SELECCIONADA ESTA INACTIVA';
      }
    }

    return {
      ok: Object.keys(errors).length === 0,
      errors,
      cleaned: { nombre, id_sucursal }
    };
  };

  const cargarCatalogos = async (includeInactivos = showInactivos) => {
    const requestId = ++catalogRequestIdRef.current;
    setLoading(true);
    setLoadingSucursales(true);
    setError('');

    try {
      const [almacenesData, sucursalesData] = await Promise.all([
        inventarioService.getAlmacenes({ include_inactivos: includeInactivos }),
        sucursalesService.getAll()
      ]);

      if (requestId !== catalogRequestIdRef.current) return;
      setAlmacenes(Array.isArray(almacenesData) ? almacenesData : []);
      setSucursales(Array.isArray(sucursalesData) ? sucursalesData : []);
    } catch (fetchError) {
      if (requestId !== catalogRequestIdRef.current) return;
      const message = resolveAlmacenesRequestMessage(fetchError, 'ERROR CARGANDO ALMACENES');
      setError(message);
      safeToast('ERROR', message, 'danger');
    } finally {
      if (requestId === catalogRequestIdRef.current) {
        setLoading(false);
        setLoadingSucursales(false);
      }
    }
  };

  const cargarAlmacenes = async (includeInactivos = showInactivos) => {
    const requestId = ++almacenesRequestIdRef.current;
    setLoading(true);
    setError('');

    try {
      const data = await inventarioService.getAlmacenes({ include_inactivos: includeInactivos });
      if (requestId !== almacenesRequestIdRef.current) return;
      setAlmacenes(Array.isArray(data) ? data : []);
    } catch (fetchError) {
      if (requestId !== almacenesRequestIdRef.current) return;
      const message = resolveAlmacenesRequestMessage(fetchError, 'ERROR CARGANDO ALMACENES');
      setError(message);
      safeToast('ERROR', message, 'danger');
    } finally {
      if (requestId === almacenesRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (permisosLoading) return;

    if (catalogScope === 'proveedores' && !canVerProveedores) {
      setCatalogScope('almacenes');
      return;
    }

    if (catalogScope === 'almacenes' && !canVerAlmacenes && canVerProveedores) {
      setCatalogScope('proveedores');
    }
  }, [canVerAlmacenes, canVerProveedores, catalogScope, permisosLoading]);

  useEffect(() => {
    if (!canVerAlmacenes) {
      catalogRequestIdRef.current += 1;
      almacenesRequestIdRef.current += 1;
      dependenciasRequestIdRef.current += 1;
      editDependenciasRequestIdRef.current += 1;
      setAlmacenes([]);
      setSucursales([]);
      setLoading(false);
      setLoadingSucursales(false);
      setLoadingEditDependencies(false);
      setShowCreateModal(false);
      setDetailId(null);
      setEditId(null);
      setEditForm(null);
      setConfirmModal({
        show: false,
        idToDelete: null,
        nombre: '',
        action: 'inactivar',
        counts: null,
        dependency: null
      });
      setDeletingConfirm(false);
      setConfirmDeleteError('');
      setResolvingActionId(null);
      return;
    }

    cargarCatalogos(showInactivos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canVerAlmacenes, showInactivos]);

  useEffect(() => () => {
    catalogRequestIdRef.current += 1;
    almacenesRequestIdRef.current += 1;
    dependenciasRequestIdRef.current += 1;
    editDependenciasRequestIdRef.current += 1;
  }, []);

  useEffect(() => {
    // NEW: bloquea el scroll del body mientras un modal premium de Almacenes esta abierto.
    // WHY: el shell overlay de Inventario necesita aislar la interaccion y evitar scroll del fondo.
    // IMPACT: solo UX temporal; no altera formularios ni requests.
    if (typeof document === 'undefined') return undefined;
    if (!showCreateModal && !showEditModal) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showCreateModal, showEditModal]);

  const resetCreateForm = () => {
    // AJUSTE: el alta debe obligar a elegir la sucursal manualmente.
    // IMPACT: solo cambia el valor inicial del select; validacion y persistencia siguen iguales.
    setForm({ nombre: '', id_sucursal: '' });
    setCreateErrors({});
  };

  const openCreate = () => {
    if (!canCrearAlmacenes) {
      safeToast('SIN PERMISO', 'No tienes permiso para crear almacenes.', 'warning');
      return;
    }
    resetCreateForm();
    setShowCreateModal(true);
  };

  const closeCreate = (force = false) => {
    if (savingCreate && !force) return;
    setShowCreateModal(false);
    resetCreateForm();
  };

  const onCrear = async (event) => {
    event.preventDefault();
    if (!canCrearAlmacenes) {
      safeToast('SIN PERMISO', 'No tienes permiso para crear almacenes.', 'warning');
      return;
    }
    if (savingCreate) return;
    setError('');

    const validation = validarAlmacen(form);
    setCreateErrors(validation.errors);
    if (!validation.ok) return;

    setSavingCreate(true);
    try {
      await inventarioService.crearAlmacen({
        nombre: validation.cleaned.nombre,
        id_sucursal: validation.cleaned.id_sucursal
      });

      closeCreate(true);
      await cargarAlmacenes();
      safeToast('CREADO', 'EL ALMACEN SE CREO CORRECTAMENTE.', 'success');
    } catch (requestError) {
      const message = resolveAlmacenesRequestMessage(requestError, 'ERROR CREANDO ALMACEN');
      setError(message);
      safeToast('ERROR', message, 'danger');
    } finally {
      setSavingCreate(false);
    }
  };

  const iniciarEdicion = (almacen) => {
    if (!canEditarAlmacenes) {
      safeToast('SIN PERMISO', 'No tienes permiso para editar almacenes.', 'warning');
      return;
    }
    const idAlmacen = Number(almacen?.id_almacen ?? 0);
    editDependenciasRequestIdRef.current += 1;
    setLoadingEditDependencies(false);
    setDetailId(null);
    setEditErrors({});
    setEditId(idAlmacen || null);
    setEditForm({
      nombre: almacen?.nombre ?? '',
      id_sucursal: String(almacen?.id_sucursal ?? ''),
      concurrency_token: String(almacen?.concurrency_token ?? '')
    });
    if (idAlmacen) {
      void loadEditDependencyRule(idAlmacen);
    }
  };

  const cancelarEdicion = (force = false) => {
    if (savingEdit && !force) return;
    editDependenciasRequestIdRef.current += 1;
    setLoadingEditDependencies(false);
    setEditId(null);
    setEditForm(null);
    setEditErrors({});
  };

  const guardarEdicion = async (event) => {
    event.preventDefault();
    if (!canEditarAlmacenes) {
      safeToast('SIN PERMISO', 'No tienes permiso para editar almacenes.', 'warning');
      return;
    }
    if (savingEdit || editId === null || !editForm) return;

    const actual = almacenes.find((item) => Number(item?.id_almacen ?? 0) === Number(editId ?? 0));
    if (!actual) {
      safeToast('ERROR', 'NO SE ENCONTRO EL ALMACEN A EDITAR.', 'danger');
      cancelarEdicion();
      return;
    }

    const validation = validarAlmacen(editForm, { allowLegacyId: actual?.id_sucursal });
    setEditErrors(validation.errors);
    if (!validation.ok) return;
    const concurrencyToken = String(
      editForm?.concurrency_token ?? actual?.concurrency_token ?? ''
    ).trim();
    if (!concurrencyToken) {
      const message = 'No se pudo validar la version actual del almacen. Recarga la informacion e intenta nuevamente.';
      setEditErrors((current) => ({ ...current, _concurrency: message }));
      safeToast('ALMACENES', message, 'warning');
      return;
    }

    try {
      const payload = {};
      const nombreActual = String(actual?.nombre ?? '').trim();
      const sucursalActual = Number.parseInt(String(actual?.id_sucursal ?? ''), 10);

      if (validation.cleaned.nombre !== nombreActual) payload.nombre = validation.cleaned.nombre;
      if (!Number.isNaN(validation.cleaned.id_sucursal) && validation.cleaned.id_sucursal !== sucursalActual) {
        payload.id_sucursal = validation.cleaned.id_sucursal;
      }

      if (Object.prototype.hasOwnProperty.call(payload, 'id_sucursal')) {
        const dependencyRule =
          inactivationRulesByAlmacenId[String(editId)] || (await loadEditDependencyRule(editId));
        if (dependencyRule?.canChangeSucursal === false) {
          const message =
            dependencyRule?.sucursalChangePrimaryReason || ALMACENES_SUCURSAL_CHANGE_CONFLICT_MESSAGE;
          setEditErrors((current) => ({ ...current, id_sucursal: message }));
          safeToast('CAMBIO BLOQUEADO', message, 'warning');
          return;
        }
      }

      if (!Object.keys(payload).length) {
        safeToast('SIN CAMBIOS', 'NO HAY CAMBIOS PARA GUARDAR.', 'info');
        cancelarEdicion();
        return;
      }
      payload.concurrency_token = concurrencyToken;

      // FIX IMPORTANTE: usa actualizacion atomica para evitar estados parciales por multiples PUT.
      setSavingEdit(true);
      await inventarioService.actualizarAlmacen(editId, payload);

      cancelarEdicion(true);
      await cargarAlmacenes();
      safeToast('ACTUALIZADO', 'EL ALMACEN SE ACTUALIZO CORRECTAMENTE.', 'success');
    } catch (requestError) {
      const isConcurrencyConflict =
        requestError?.status === 409 &&
        String(requestError?.data?.conflict_type || '').toUpperCase() === 'CONCURRENCY';
      if (isConcurrencyConflict) {
        const message = requestError?.message || ALMACENES_CONCURRENCY_CONFLICT_MESSAGE;
        setEditErrors((current) => ({ ...current, _concurrency: message }));
        setError(message);
        safeToast('CONFLICTO DE EDICION', message, 'warning');
        return;
      }

      const normalizedConflict =
        requestError?.status === 409
          ? rememberInactivationRule(editId, requestError?.data || {})
          : null;
      const message =
        normalizedConflict?.sucursalChangePrimaryReason ||
        resolveAlmacenesRequestMessage(requestError, 'ERROR ACTUALIZANDO ALMACEN');
      if (requestError?.status === 409) {
        setEditErrors((current) => ({ ...current, id_sucursal: message }));
      }
      setError(message);
      safeToast('ERROR', message, 'danger');
    } finally {
      setSavingEdit(false);
    }
  };

  const openConfirmDelete = async (almacen, preferredAction = 'auto') => {
    const id = Number(almacen?.id_almacen ?? 0);
    if (!id || deletingConfirm) return;
    if (!canVerAlmacenes) {
      safeToast('SIN PERMISO', 'No tienes permiso para consultar almacenes.', 'warning');
      return;
    }

    setConfirmDeleteError('');
    const wasDeleteRequest = preferredAction === 'eliminar';
    const isActivo = parseAlmacenEstado(almacen?.estado);
    let action =
      preferredAction === 'auto'
        ? isActivo
          ? 'inactivar'
          : 'reactivar'
        : preferredAction;

    if (action === 'eliminar') {
      action = isActivo ? 'inactivar' : 'reactivar';
    }

    if (wasDeleteRequest) {
      safeToast(
        'AVISO',
        ALMACENES_NO_DELETE_MESSAGE,
        'info'
      );
    }

    if (!canRunAlmacenAction(action)) {
      safeToast('SIN PERMISO', 'No tienes permiso para realizar esta accion sobre almacenes.', 'warning');
      return;
    }

    if (action === 'reactivar') {
      setConfirmModal({
        show: true,
        idToDelete: id,
        nombre: almacen?.nombre || '',
        action,
        counts: null,
        dependency: null
      });
      return;
    }

    const requestId = ++dependenciasRequestIdRef.current;
    setResolvingActionId(id);
    try {
      const deps = await inventarioService.getAlmacenDependencias(id);
      if (requestId !== dependenciasRequestIdRef.current) return;
      const normalizedDeps = rememberInactivationRule(id, deps);
      const counts = normalizedDeps?.counts || { movimientos: 0, productos: 0, insumos: 0 };

      if (!normalizedDeps?.canDeactivate) {
        safeToast(
          'INACTIVACION BLOQUEADA',
          normalizedDeps.primaryBlockingReason || 'No se puede inactivar el almacen por dependencias operativas.',
          'warning'
        );
        return;
      }

      setConfirmModal({
        show: true,
        idToDelete: id,
        nombre: almacen?.nombre || '',
        action: 'inactivar',
        counts,
        dependency: normalizedDeps
      });
    } catch (requestError) {
      if (requestId !== dependenciasRequestIdRef.current) return;
      const message = resolveAlmacenesRequestMessage(
        requestError,
        'ERROR VALIDANDO DEPENDENCIAS DEL ALMACEN'
      );
      setError(message);
      safeToast('ERROR', message, 'danger');
    } finally {
      if (requestId === dependenciasRequestIdRef.current) {
        setResolvingActionId(null);
      }
    }
  };

  const closeConfirmDelete = () => {
    if (deletingConfirm) return;
    setConfirmDeleteError('');
    setConfirmModal({
      show: false,
      idToDelete: null,
      nombre: '',
      action: 'inactivar',
      counts: null,
      dependency: null
    });
  };

  const eliminarConfirmado = async () => {
    const id = confirmModal.idToDelete;
    if (!id || deletingConfirm) return;

    if (!canRunAlmacenAction(confirmModal.action)) {
      safeToast('SIN PERMISO', 'No tienes permiso para realizar esta accion sobre almacenes.', 'warning');
      return;
    }

    setDeletingConfirm(true);
    setConfirmDeleteError('');

    try {
      if (confirmModal.action === 'reactivar') {
        await inventarioService.reactivarAlmacen(id);
      } else {
        await inventarioService.inactivarAlmacen(id);
      }

      if (Number(detailId ?? 0) === Number(id)) setDetailId(null);
      if (Number(editId ?? 0) === Number(id)) cancelarEdicion();
      await cargarAlmacenes();
      setDeletingConfirm(false);
      setConfirmModal({
        show: false,
        idToDelete: null,
        nombre: '',
        action: 'inactivar',
        counts: null,
        dependency: null
      });

      if (confirmModal.action === 'reactivar') {
        safeToast('REACTIVADO', 'EL ALMACEN SE REACTIVO CORRECTAMENTE.', 'success');
      } else {
        safeToast('INACTIVADO', 'EL ALMACEN SE INACTIVO CORRECTAMENTE.', 'success');
      }
    } catch (requestError) {
      const fallbackMessage =
        confirmModal.action === 'reactivar'
          ? 'ERROR REACTIVANDO ALMACEN'
          : 'ERROR INACTIVANDO ALMACEN';
      const normalizedConflict =
        confirmModal.action === 'inactivar' && requestError?.status === 409
          ? rememberInactivationRule(id, requestError?.data || {})
          : null;
      const message =
        normalizedConflict?.primaryBlockingReason ||
        resolveAlmacenesRequestMessage(requestError, fallbackMessage);
      setDeletingConfirm(false);
      setConfirmDeleteError(message);
      setError(message);
      safeToast('ERROR', message, 'danger');
    }
  };

  const scrollToMovimientos = () => {
    movimientosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const selectAlmacenCard = (almacen) => {
    if (!almacen?.id_almacen) return;
    setSelectedAlmacenId(String(almacen.id_almacen));
  };

  const handleMovimientoCreado = async () => {
    await cargarAlmacenes();
  };

  const almacenesFiltrados = useMemo(() => {
    const safeSearch = search.trim().toLowerCase();

    // NEW: las cards superiores muestran todos los almacenes existentes y solo respetan la busqueda textual.
    // WHY: la seleccion del almacen ahora se hace desde la card y ese estado gobierna el resumen/listado inferior.
    // IMPACT: el filtro por sucursal se conserva para movimientos, pero deja de ocultar almacenes en la cabecera visual.
    return (Array.isArray(almacenes) ? [...almacenes] : [])
      .sort((left, right) => Number(left?.id_almacen ?? 0) - Number(right?.id_almacen ?? 0))
      .filter((almacen) => {
        const texto = `${almacen?.nombre ?? ''} ${formatSucursalDisplayLabel(
          sucursalesMap.get(String(almacen?.id_sucursal ?? '').trim()),
          almacen?.id_sucursal
        )}`.toLowerCase();

        return safeSearch ? texto.includes(safeSearch) : true;
      });
  }, [almacenes, search, sucursalesMap]);

  useEffect(() => {
    if (!almacenesFiltrados.length) {
      setSelectedAlmacenId('');
      return;
    }

    if (!selectedAlmacenId) {
      setSelectedAlmacenId(String(almacenesFiltrados[0].id_almacen));
      return;
    }

    if (
      !almacenesFiltrados.some((almacen) => String(almacen?.id_almacen ?? '') === String(selectedAlmacenId))
    ) {
      setSelectedAlmacenId(String(almacenesFiltrados[0].id_almacen));
    }
  }, [almacenesFiltrados, selectedAlmacenId]);

  const detailAlmacen = useMemo(() => {
    const safeId = Number(detailId ?? 0);
    if (!safeId) return null;
    return almacenes.find((almacen) => Number(almacen?.id_almacen ?? 0) === safeId) || null;
  }, [almacenes, detailId]);

  const confirmAlmacen = useMemo(() => {
    const safeId = Number(confirmModal.idToDelete ?? 0);
    if (!safeId) return null;
    return almacenes.find((almacen) => Number(almacen?.id_almacen ?? 0) === safeId) || null;
  }, [almacenes, confirmModal.idToDelete]);
  const confirmCopy = useMemo(
    () => getConfirmCopyByAction(confirmModal.action),
    [confirmModal.action]
  );

  const detailStatusMeta = useMemo(() => getAlmacenStatusMeta(detailAlmacen), [detailAlmacen]);
  const detailActionMeta = useMemo(
    () => (detailAlmacen ? getAlmacenActionMeta(detailAlmacen) : null),
    [detailAlmacen]
  );
  const detailInactivationRule = useMemo(() => {
    const id = Number(detailAlmacen?.id_almacen ?? 0);
    if (!id) return null;
    return inactivationRulesByAlmacenId[String(id)] || null;
  }, [detailAlmacen, inactivationRulesByAlmacenId]);
  const detailInactivationBlocked =
    detailActionMeta?.action === 'inactivar' && detailInactivationRule?.canDeactivate === false;
  const editDependencyRule = useMemo(() => {
    const id = Number(editId ?? 0);
    if (!id) return null;
    return inactivationRulesByAlmacenId[String(id)] || null;
  }, [editId, inactivationRulesByAlmacenId]);
  const editSucursalLockedByHistory =
    editDependencyRule?.canChangeSucursal === false;
  const editSucursalBlockingReason =
    editDependencyRule?.sucursalChangePrimaryReason || ALMACENES_SUCURSAL_CHANGE_CONFLICT_MESSAGE;

  const detailMetrics = useMemo(() => {
    if (!detailAlmacen) return [];

    return [
      {
        key: 'sucursal',
        label: 'Sucursal',
        icon: 'bi bi-shop',
        value: formatSucursalDisplayLabel(
          sucursalesMap.get(String(detailAlmacen?.id_sucursal ?? '').trim()),
          detailAlmacen?.id_sucursal
        )
      },
      { key: 'estado', label: 'Estado', icon: 'bi bi-shield-check', value: detailStatusMeta.label },
      { key: 'total', label: 'Total items', icon: 'bi bi-box-seam', value: formatMetricValue(detailAlmacen?.total_items) },
      { key: 'alertas', label: 'Alertas stock', icon: 'bi bi-exclamation-triangle', value: formatMetricValue(detailAlmacen?.alertas_stock) },
      { key: 'movs', label: 'Movimientos hoy', icon: 'bi bi-arrow-left-right', value: formatMetricValue(detailAlmacen?.movimientos_hoy) },
      { key: 'entradas', label: 'Entradas hoy', icon: 'bi bi-arrow-down-left', value: formatMetricValue(detailAlmacen?.entradas_hoy) },
      { key: 'salidas', label: 'Salidas hoy', icon: 'bi bi-arrow-up-right', value: formatMetricValue(detailAlmacen?.salidas_hoy) },
      { key: 'ajustes', label: 'Ajustes hoy', icon: 'bi bi-sliders', value: formatMetricValue(detailAlmacen?.ajustes_hoy) }
    ];
  }, [detailAlmacen, detailStatusMeta.label, sucursalesMap]);

  const createHeroSucursalLabel = useMemo(() => {
    if (!form.id_sucursal) return 'Selecciona una sucursal';
    return formatSucursalOptionLabel(sucursalesMap.get(String(form.id_sucursal).trim()), form.id_sucursal);
  }, [form.id_sucursal, sucursalesMap]);

  const editHeroSucursalLabel = useMemo(() => {
    if (!editForm?.id_sucursal) return 'Selecciona una sucursal';
    return formatSucursalOptionLabel(sucursalesMap.get(String(editForm.id_sucursal).trim()), editForm.id_sucursal);
  }, [editForm?.id_sucursal, sucursalesMap]);

  const centeredGridClass =
    !loading && almacenesFiltrados.length > 0 && almacenesFiltrados.length < 3 ? 'is-centered' : '';

  const cardsContent = !canVerAlmacenes ? (
    <div className="alert alert-info mb-0">No tienes permiso para ver almacenes.</div>
  ) : loading ? (
    <div className={`inv-warehouse-grid ${centeredGridClass}`.trim()}>
      {[1, 2, 3].map((skeleton) => (
        <div key={skeleton} className="inv-warehouse-card inv-warehouse-card--skeleton" aria-hidden="true" />
      ))}
    </div>
  ) : almacenesFiltrados.length === 0 ? (
    <div className="inv-warehouse-empty">
      <i className="bi bi-inbox" aria-hidden="true" />
      <div className="mt-2">No hay almacenes para la busqueda actual.</div>
    </div>
  ) : (
    <div className={`inv-warehouse-grid ${centeredGridClass}`.trim()}>
      {almacenesFiltrados.map((almacen, index) => {
        const statusMeta = getAlmacenStatusMeta(almacen);
        const actionMeta = getAlmacenActionMeta(almacen);
        const isInactivo = !parseAlmacenEstado(almacen?.estado);
        const isResolvingAction = Number(resolvingActionId ?? 0) === Number(almacen?.id_almacen ?? 0);
        const isSelected = String(selectedAlmacenId ?? '') === String(almacen?.id_almacen ?? '');
        const knownInactivationRule =
          inactivationRulesByAlmacenId[String(almacen?.id_almacen ?? '')] || null;
        const isInactivationBlocked =
          actionMeta.action === 'inactivar' && knownInactivationRule?.canDeactivate === false;
        const actionLabel = isInactivationBlocked ? 'Bloqueada' : actionMeta.label;
        const actionTitle = isInactivationBlocked
          ? knownInactivationRule?.primaryBlockingReason || 'Inactivacion bloqueada por dependencias operativas.'
          : actionMeta.title;
        const highlights = [
          {
            key: 'items',
            label: 'Total items',
            icon: 'bi bi-box-seam',
            value: formatMetricValue(almacen?.total_items),
            tone: ''
          },
          {
            key: 'alertas',
            label: 'Alertas stock',
            icon: 'bi bi-exclamation-diamond',
            value: formatMetricValue(almacen?.alertas_stock),
            tone: Number(almacen?.alertas_stock ?? 0) > 0 ? 'is-alert' : ''
          },
          {
            key: 'movs',
            label: 'Movs. hoy',
            icon: 'bi bi-arrow-left-right',
            value: formatMetricValue(almacen?.movimientos_hoy),
            tone: ''
          }
        ];

        return (
          <article
            key={almacen.id_almacen}
            className={`inv-warehouse-card inv-anim-in ${isSelected ? 'is-selected' : ''} ${
              Number(almacen?.alertas_stock ?? 0) > 0 ? 'has-alerts' : ''
            } ${isInactivo ? 'opacity-75 border border-secondary-subtle' : ''}`.trim()}
            role="button"
            tabIndex={0}
            style={{ animationDelay: `${Math.min(index * 40, 240)}ms` }}
            onClick={() => selectAlmacenCard(almacen)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                selectAlmacenCard(almacen);
              }
            }}
          >
            <div className="inv-warehouse-card__halo" aria-hidden="true">
              <i className="bi bi-building" />
            </div>

            <div className="inv-warehouse-card__header">
              <div className="inv-warehouse-card__title-wrap">
                <span className="inv-warehouse-card__icon" aria-hidden="true">
                  <i className="bi bi-building-fill" />
                </span>
                <div>
                  <div className="inv-warehouse-card__name">{almacen.nombre || `Almacen ${almacen.id_almacen}`}</div>
                  <div className="inv-warehouse-card__branch">
                    <i className="bi bi-shop" aria-hidden="true" />
                    <span>
                      {formatSucursalDisplayLabel(
                        sucursalesMap.get(String(almacen?.id_sucursal ?? '').trim()),
                        almacen?.id_sucursal
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <span className={`inv-warehouse-card__status ${statusMeta.className}`} title={statusMeta.hint}>
                {statusMeta.label}
              </span>
            </div>

            <div className="inv-warehouse-card__body">
              {isInactivo ? (
                <div className="alert alert-warning py-2 mb-3" role="status">
                  INACTIVO - no disponible para operaciones
                </div>
              ) : null}
              {highlights.map((item) => (
                <div key={item.key} className={`inv-warehouse-card__fact ${item.tone}`.trim()}>
                  <span className="inv-warehouse-card__fact-icon" aria-hidden="true">
                    <i className={item.icon} />
                  </span>
                  <div className="inv-warehouse-card__fact-copy">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                </div>
              ))}
            </div>

            <div className="inv-warehouse-card__meta">
              <span className="inv-warehouse-card__meta-pill">
                <i className="bi bi-arrow-down-left" aria-hidden="true" />
                <span>Entradas</span>
                <strong>{formatMetricValue(almacen?.entradas_hoy)}</strong>
              </span>
              <span className="inv-warehouse-card__meta-pill">
                <i className="bi bi-sliders" aria-hidden="true" />
                <span>Ajustes</span>
                <strong>{formatMetricValue(almacen?.ajustes_hoy)}</strong>
              </span>
              <span className="inv-warehouse-card__meta-pill">
                <i className="bi bi-arrow-up-right" aria-hidden="true" />
                <span>Salidas</span>
                <strong>{formatMetricValue(almacen?.salidas_hoy)}</strong>
              </span>
            </div>

            <div className="inv-warehouse-card__footer">
              <div className="inv-warehouse-card__actions">
                {canEditarAlmacenes ? (
                  <button
                    type="button"
                    className="btn inv-prod-btn-subtle inv-warehouse-card__action"
                    onClick={(event) => {
                      event.stopPropagation();
                      iniciarEdicion(almacen);
                    }}
                    title="Editar"
                    disabled={deletingConfirm}
                  >
                    <i className="bi bi-pencil-square" />
                    <span>Editar</span>
                  </button>
                ) : null}

                {canRunAlmacenAction(actionMeta.action) ? (
                  <button
                    type="button"
                    className={actionMeta.buttonClass}
                    onClick={(event) => {
                      event.stopPropagation();
                      openConfirmDelete(almacen, actionMeta.action);
                    }}
                    title={actionTitle}
                    disabled={deletingConfirm || isResolvingAction || isInactivationBlocked}
                  >
                    <i className={`bi ${isResolvingAction ? 'bi-hourglass-split' : actionMeta.icon}`} />
                    <span>{isResolvingAction ? 'Validando...' : actionLabel}</span>
                  </button>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );

  if (permisosLoading) return null;

  if (!canAccessAlmacenesTab) {
    return <SinPermiso permiso={PERMISSIONS.INVENTARIO_ALMACENES_VER} />;
  }

  if (catalogScope === 'proveedores') {
    if (!canVerProveedores) {
      return <SinPermiso permiso={PERMISSIONS.INVENTARIO_PROVEEDORES_VER} />;
    }
    return <ProveedoresTab openToast={openToast} onScopeChange={setCatalogScope} />;
  }

  const createModal =
    canCrearAlmacenes && modalPortalTarget && showCreateModal
      ? createPortal(
          <div className="inv-prod-pmodal inv-prod-pmodal--create show" aria-hidden={!showCreateModal}>
            <div className="inv-prod-pmodal__overlay" onClick={closeCreate} />
            <div className="inv-prod-pmodal__viewport">
              <div
                className="inv-prod-pmodal__panel inv-prod-pmodal__panel--create"
                role="dialog"
                aria-modal="true"
                aria-labelledby="inv-warehouse-create-title"
                onClick={(event) => event.stopPropagation()}
              >
                <form onSubmit={onCrear} className="inv-prod-pmodal__form-shell inv-prod-pmodal__form-shell--create">
                  <div className="inv-prod-pmodal__body">
                    <div className="inv-ins-create-hero is-create">
                      <button
                        type="button"
                        className="inv-prod-drawer-close inv-ins-create-hero__close"
                        onClick={closeCreate}
                        aria-label="Cerrar alta de almacen"
                        disabled={savingCreate}
                      >
                        <i className="bi bi-x-lg" aria-hidden="true" />
                      </button>

                      <div className="inv-ins-create-hero__icon">
                        <i className="bi bi-building-add" aria-hidden="true" />
                      </div>

                      <div className="inv-ins-create-hero__copy">
                        <div className="inv-ins-create-hero__kicker">Nuevo Registro</div>
                        <div id="inv-warehouse-create-title" className="inv-ins-create-hero__title">
                          Alta rapida de almacen
                        </div>
                        <div className="inv-ins-create-hero__text">
                          Registra la ubicacion base y dejala lista para recibir movimientos desde el mismo modulo.
                        </div>
                      </div>

                      <div className="inv-ins-create-hero__chips">
                        <span className="inv-ins-create-hero__chip">
                          <i className="bi bi-shop" aria-hidden="true" /> {createHeroSucursalLabel}
                        </span>
                        <span className="inv-ins-create-hero__chip">
                          <i className="bi bi-box-seam" aria-hidden="true" /> Kardex habilitado
                        </span>
                      </div>
                    </div>

                    <div className="inv-prod-pmodal__sections">
                      <section className="inv-prod-pmodal__section">
                        <div className="inv-prod-pmodal__section-head">
                          <div className="inv-prod-pmodal__section-title">Datos principales</div>
                          <div className="inv-prod-pmodal__section-sub">
                            Nombre y sucursal real del almacen segun el catalogo activo.
                          </div>
                        </div>

                        <div className="row g-3">
                          <div className="col-12">
                            <label className="form-label mb-1" htmlFor="inv-warehouse-create-nombre">
                              Nombre del almacen
                            </label>
                            <input
                              id="inv-warehouse-create-nombre"
                              className={`form-control ${createErrors.nombre ? 'is-invalid' : ''}`}
                              value={form.nombre}
                              onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))}
                              placeholder="Ej: Bodega Norte"
                              disabled={savingCreate}
                            />
                            {createErrors.nombre ? <div className="invalid-feedback">{createErrors.nombre}</div> : null}
                          </div>

                          <div className="col-12">
                            <label className="form-label mb-1" htmlFor="inv-warehouse-create-sucursal">
                              Sucursal
                            </label>
                            <select
                              id="inv-warehouse-create-sucursal"
                              className={`form-select ${createErrors.id_sucursal ? 'is-invalid' : ''}`}
                              value={form.id_sucursal}
                              onChange={(event) =>
                                setForm((current) => ({ ...current, id_sucursal: event.target.value }))
                              }
                              disabled={!canCreateWithCatalog || savingCreate}
                            >
                              <option value="">{loadingSucursales ? 'Cargando sucursales...' : 'Seleccione una sucursal'}</option>
                              {createSucursalOptions.map((option) => (
                                <option key={option.id} value={option.id} disabled={option.disabled}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            {createErrors.id_sucursal ? (
                              <div className="invalid-feedback">{createErrors.id_sucursal}</div>
                            ) : null}
                          </div>
                        </div>
                      </section>
                    </div>
                  </div>

                  <div className="inv-prod-pmodal__footer inv-prod-pmodal__footer--create">
                    <button type="button" className="btn inv-prod-btn-subtle" onClick={resetCreateForm} disabled={savingCreate}>
                      Limpiar
                    </button>
                    <button type="button" className="btn inv-prod-btn-outline" onClick={closeCreate} disabled={savingCreate}>
                      Cancelar
                    </button>
                    <button type="submit" className="btn inv-prod-btn-primary" disabled={!canCreateWithCatalog || savingCreate}>
                      {savingCreate ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>,
          modalPortalTarget
        )
      : null;

  const detailModal = canVerAlmacenes && detailAlmacen ? (
    <div
      className="modal fade show"
      style={{ display: 'block', backgroundColor: 'rgba(17, 8, 10, 0.55)', zIndex: 2600 }}
      role="dialog"
      aria-modal="true"
      onClick={() => setDetailId(null)}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg" onClick={(event) => event.stopPropagation()}>
        <div className="modal-content shadow inv-warehouse-detail-modal__body">
          <div className="modal-body">
            <div className="inv-warehouse-detail-modal__hero">
              <div className="inv-warehouse-detail-modal__hero-main">
                <p className="inv-warehouse-detail-modal__eyebrow">Detalle de almacen</p>
                <strong>{detailAlmacen.nombre || `Almacen ${detailAlmacen.id_almacen}`}</strong>
                <p>
                  {formatSucursalDisplayLabel(
                    sucursalesMap.get(String(detailAlmacen?.id_sucursal ?? '').trim()),
                    detailAlmacen?.id_sucursal
                  )}
                </p>
              </div>
              <span className={`inv-warehouse-card__status ${detailStatusMeta.className}`}>{detailStatusMeta.label}</span>
            </div>

            <div className="inv-warehouse-detail-modal__grid mt-3">
              {detailMetrics.map((metric) => (
                <div key={metric.key} className="inv-warehouse-detail-modal__card">
                  <div className="inv-warehouse-detail-modal__card-head">
                    <i className={metric.icon} aria-hidden="true" />
                    <span>{metric.label}</span>
                  </div>
                  <strong>{metric.value}</strong>
                </div>
              ))}
            </div>
            {detailInactivationBlocked ? (
              <div className="alert alert-warning mt-3 mb-0" role="status">
                {detailInactivationRule?.primaryBlockingReason ||
                  'No se puede inactivar este almacen por dependencias operativas.'}
              </div>
            ) : null}
          </div>

          <div className="modal-footer inv-warehouse-detail-modal__footer">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => {
                if (!detailAlmacen?.id_almacen) return;
                setSelectedAlmacenId(String(detailAlmacen.id_almacen));
                window.setTimeout(scrollToMovimientos, 80);
              }}
            >
              Ver Kardex
            </button>
            {canEditarAlmacenes ? (
              <button type="button" className="btn btn-light" onClick={() => iniciarEdicion(detailAlmacen)}>
                Editar
              </button>
            ) : null}
            {detailActionMeta && canRunAlmacenAction(detailActionMeta.action) ? (
              <button
                type="button"
                className={`btn ${
                  detailActionMeta.action === 'inactivar' ? 'btn-outline-secondary' : 'btn-outline-success'
                }`}
                onClick={() => openConfirmDelete(detailAlmacen, detailActionMeta.action)}
                disabled={
                  Number(resolvingActionId ?? 0) === Number(detailAlmacen?.id_almacen ?? 0) ||
                  detailInactivationBlocked
                }
                title={
                  detailInactivationBlocked
                    ? detailInactivationRule?.primaryBlockingReason ||
                      'Inactivacion bloqueada por dependencias operativas.'
                    : detailActionMeta.title
                }
              >
                {Number(resolvingActionId ?? 0) === Number(detailAlmacen?.id_almacen ?? 0)
                  ? 'Validando...'
                  : detailInactivationBlocked
                  ? 'Inactivacion bloqueada'
                  : detailActionMeta.label}
              </button>
            ) : null}
            <button type="button" className="btn btn-primary" onClick={() => setDetailId(null)}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  const editModal =
    canEditarAlmacenes && modalPortalTarget && showEditModal
      ? createPortal(
          <div className="inv-prod-pmodal inv-prod-pmodal--create show" aria-hidden={!showEditModal}>
            <div className="inv-prod-pmodal__overlay" onClick={cancelarEdicion} />
            <div className="inv-prod-pmodal__viewport">
              <div
                className="inv-prod-pmodal__panel inv-prod-pmodal__panel--create"
                role="dialog"
                aria-modal="true"
                aria-labelledby="inv-warehouse-edit-title"
                onClick={(event) => event.stopPropagation()}
              >
                <form onSubmit={guardarEdicion} className="inv-prod-pmodal__form-shell inv-prod-pmodal__form-shell--create">
                  <div className="inv-prod-pmodal__body">
                    <div className="inv-ins-create-hero is-edit">
                      <button
                        type="button"
                        className="inv-prod-drawer-close inv-ins-create-hero__close"
                        onClick={cancelarEdicion}
                        aria-label="Cerrar edicion de almacen"
                        disabled={savingEdit}
                      >
                        <i className="bi bi-x-lg" aria-hidden="true" />
                      </button>

                      <div className="inv-ins-create-hero__icon">
                        <i className="bi bi-building-gear" aria-hidden="true" />
                      </div>

                      <div className="inv-ins-create-hero__copy">
                        <div className="inv-ins-create-hero__kicker">Edicion Activa</div>
                        <div id="inv-warehouse-edit-title" className="inv-ins-create-hero__title">
                          Actualiza Tu Almacen
                        </div>
                      </div>

                      <div className="inv-ins-create-hero__chips">
                        <span className="inv-ins-create-hero__chip">
                          <i className="bi bi-shop" aria-hidden="true" /> {editHeroSucursalLabel}
                        </span>
                        <span className="inv-ins-create-hero__chip">
                          <i className="bi bi-shield-check" aria-hidden="true" /> Kardex operativo
                        </span>
                      </div>
                    </div>

                    <div className="inv-prod-pmodal__sections">
                      <section className="inv-prod-pmodal__section">
                        <div className="inv-prod-pmodal__section-head">
                          <div className="inv-prod-pmodal__section-title">Datos principales</div>
                          <div className="inv-prod-pmodal__section-sub">
                            {editSucursalLockedByHistory
                              ? 'Este almacen tiene historial operativo: puedes editar el nombre, pero no cambiar su sucursal.'
                              : 'Ajusta nombre y sucursal respetando el catalogo operativo actual.'}
                          </div>
                        </div>
                        {editErrors._concurrency ? (
                          <div className="alert alert-warning py-2 mb-3" role="alert">
                            {editErrors._concurrency}
                          </div>
                        ) : null}

                        <div className="row g-3">
                          <div className="col-12">
                            <label className="form-label mb-1" htmlFor="inv-warehouse-edit-nombre">
                              Nombre del almacen
                            </label>
                            <input
                              id="inv-warehouse-edit-nombre"
                              className={`form-control ${editErrors.nombre ? 'is-invalid' : ''}`}
                              value={editForm.nombre}
                              onChange={(event) => setEditForm((current) => ({ ...current, nombre: event.target.value }))}
                              placeholder="Ej: Bodega Norte"
                              disabled={savingEdit}
                            />
                            {editErrors.nombre ? <div className="invalid-feedback">{editErrors.nombre}</div> : null}
                          </div>

                          <div className="col-12">
                            <label className="form-label mb-1" htmlFor="inv-warehouse-edit-sucursal">
                              Sucursal
                            </label>
                            <select
                              id="inv-warehouse-edit-sucursal"
                              className={`form-select ${editErrors.id_sucursal ? 'is-invalid' : ''}`}
                              value={editForm.id_sucursal}
                              onChange={(event) =>
                                setEditForm((current) => ({ ...current, id_sucursal: event.target.value }))
                              }
                              disabled={!canEditWithCatalog || savingEdit || loadingEditDependencies || editSucursalLockedByHistory}
                            >
                              <option value="">
                                {loadingSucursales ? 'Cargando sucursales...' : 'Seleccione una sucursal'}
                              </option>
                              {editSucursalOptions.map((option) => (
                                <option key={option.id} value={option.id} disabled={option.disabled}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            {editErrors.id_sucursal ? <div className="invalid-feedback">{editErrors.id_sucursal}</div> : null}
                            {loadingEditDependencies ? (
                              <div className="form-text">Validando dependencias operativas del almacen...</div>
                            ) : null}
                            {editSucursalLockedByHistory ? (
                              <div className="form-text text-warning">
                                {`${editSucursalBlockingReason} ${ALMACENES_SUCURSAL_CHANGE_POLICY_MESSAGE}`}
                              </div>
                            ) : null}
                            {editHasLegacySelected ? (
                              <div className="form-text">
                                La sucursal actual esta fuera del catalogo activo, pero puede conservarse.
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </section>
                    </div>
                  </div>

                  <div className="inv-prod-pmodal__footer inv-prod-pmodal__footer--create">
                    <button type="button" className="btn inv-prod-btn-outline" onClick={cancelarEdicion} disabled={savingEdit}>
                      Cancelar
                    </button>
                    <button type="submit" className="btn inv-prod-btn-primary" disabled={savingEdit}>
                      {savingEdit ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>,
          modalPortalTarget
        )
      : null;

  const confirmDeleteModal = confirmModal.show && canRunAlmacenAction(confirmModal.action) ? (
    <div className="inv-pro-confirm-backdrop" role="dialog" aria-modal="true" onClick={closeConfirmDelete}>
      <div className="inv-pro-confirm-panel" onClick={(event) => event.stopPropagation()}>
        <div className="inv-pro-confirm-glow" aria-hidden="true" />

        <div className="inv-pro-confirm-head">
          <div className="inv-pro-confirm-head-main">
            <div className="inv-pro-confirm-head-icon">
              <i className={`bi ${confirmCopy.actionIcon}`} aria-hidden="true" />
            </div>
            <div className="inv-pro-confirm-head-copy">
              <div className="inv-pro-confirm-kicker">Almacenes</div>
              <div className="inv-pro-confirm-title">{confirmCopy.title}</div>
              <div className="inv-pro-confirm-sub">{confirmCopy.subtitle}</div>
            </div>
          </div>
          <button
            type="button"
            className="inv-pro-confirm-close"
            onClick={closeConfirmDelete}
            aria-label="Cerrar"
            disabled={deletingConfirm}
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="inv-pro-confirm-body">
          <div className="inv-pro-confirm-note">
            <i className="bi bi-shield-exclamation" aria-hidden="true" />
            <span>{confirmCopy.note}</span>
          </div>

          {confirmModal.counts ? (
            <div className="small text-muted mb-2">
              {`Dependencias: movimientos ${confirmModal.counts.movimientos}, productos ${confirmModal.counts.productos}, insumos ${confirmModal.counts.insumos}`}
            </div>
          ) : null}

          <div className="inv-pro-confirm-question">{confirmCopy.question}</div>

          <div className="inv-pro-confirm-name">
            <div className="inv-pro-confirm-name-label">Registro seleccionado</div>
            <div className="inv-pro-confirm-name-value">
              <i className="bi bi-building-fill-gear" aria-hidden="true" />
              <span>{confirmModal.nombre || confirmAlmacen?.nombre || 'Almacen seleccionado'}</span>
            </div>
          </div>

          {confirmDeleteError ? (
            <div className="alert alert-danger inv-pro-confirm-error mb-0" role="alert">
              {confirmDeleteError}
            </div>
          ) : null}
        </div>

        <div className="inv-pro-confirm-footer">
          <button type="button" className="btn inv-pro-btn-cancel" onClick={closeConfirmDelete} disabled={deletingConfirm}>
            Cancelar
          </button>
          <button
            type="button"
            className={`btn ${
              confirmModal.action === 'reactivar' ? 'btn-success' : 'btn-warning'
            }`}
            onClick={eliminarConfirmado}
            disabled={deletingConfirm}
          >
            <i className={`bi ${deletingConfirm ? 'bi-hourglass-split' : confirmCopy.actionIcon}`} aria-hidden="true" />
            <span>{deletingConfirm ? confirmCopy.actionBusyLabel : confirmCopy.actionLabel}</span>
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div className="card shadow-sm mb-3 inv-prod-card inv-ins-module inv-has-sticky-header inv-warehouse-module">
        <div className="card-header inv-prod-header inv-cat-v3__header">
          <div className="inv-cat-v3__layout">
            <div className="inv-cat-v3__title">
              <div className="inv-prod-title-wrap">
                <div className="inv-prod-title-row">
                  <i className="bi bi-building inv-prod-title-icon" aria-hidden="true" />
                  <span className="inv-prod-title">Almacenes</span>
                </div>
                <div className="inv-prod-subtitle">Gestion visual de almacenes y kardex por sucursal</div>
              </div>
            </div>

            <div className="inv-cat-v3__switch-slot">
              <CompactHeaderSwitch
                value={catalogScope}
                onChange={(nextScope) => {
                  if (nextScope === 'proveedores' && !canVerProveedores) {
                    safeToast('SIN PERMISO', 'No tienes permiso para ver proveedores.', 'warning');
                    return;
                  }
                  setCatalogScope(nextScope);
                }}
                leftValue="almacenes"
                rightValue="proveedores"
                leftLabel="ALMACENES"
                rightLabel="PROVEEDORES"
                ariaLabel="Cambiar vista de almacenes y proveedores"
              />
            </div>

            <label className="inv-ins-search inv-prod-header-search inv-cat-v3__search" aria-label="Buscar almacenes">
              <i className="bi bi-search" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar almacen..."
              />
            </label>

            <div className="inv-prod-header-actions inv-ins-header-actions inv-cat-v3__actions-stack">
              <div className="form-check form-switch m-0 d-flex align-items-center justify-content-center gap-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="inv-warehouse-show-inactive"
                  checked={showInactivos}
                  onChange={(event) => setShowInactivos(event.target.checked)}
                  disabled={loading}
                />
                <label className="form-check-label small mb-0" htmlFor="inv-warehouse-show-inactive">
                  Mostrar inactivos
                </label>
              </div>
              {canCrearAlmacenes ? (
                <button
                  type="button"
                  className="inv-prod-toolbar-btn inv-cat-v3__new-btn"
                  onClick={openCreate}
                  disabled={!canCreateWithCatalog}
                >
                  <i className="bi bi-plus-circle" aria-hidden="true" />
                  <span>Nuevo almacen</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="card-body inv-warehouse-body">
          {error ? (
            <div className="alert alert-danger mb-0">
              <i className="bi bi-exclamation-triangle-fill me-2" aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="alert alert-info mt-3 mb-2" role="note">
            {`${ALMACENES_NO_DELETE_MESSAGE} ${ALMACENES_INACTIVATION_POLICY_MESSAGE} ${ALMACENES_SUCURSAL_CHANGE_POLICY_MESSAGE}`}
          </div>

          <div className="inv-warehouse-results-meta">
            Total Almacenes: <strong>{almacenes.length}</strong>
          </div>

          {cardsContent}

          <div ref={movimientosRef}>
            <MovimientosTab
              openToast={openToast}
              embedded
              almacenes={almacenes}
              sucursales={sucursales}
              selectedAlmacenId={selectedAlmacenId}
              onSelectAlmacen={setSelectedAlmacenId}
              onMovimientoCreado={handleMovimientoCreado}
            />
          </div>
        </div>
      </div>

      {createModal}
      {detailModal}
      {editModal}
      {confirmDeleteModal}
    </>
  );
};

export default AlmacenesTab;
