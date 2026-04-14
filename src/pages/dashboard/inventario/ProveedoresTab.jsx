import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { inventarioService } from '../../../services/inventarioService';
import SinPermiso from '../../../components/common/SinPermiso';
import { usePermisos } from '../../../context/PermisosContext';
import { PERMISSIONS } from '../../../utils/permissions';
import CompactHeaderSwitch from './CompactHeaderSwitch.jsx';

const CUENTA_TIPOS = ['AHORRO', 'CHEQUES', 'OTRA'];
const CUENTA_MONEDAS = ['HNL', 'USD'];
const PROVEEDORES_CONCURRENCY_CONFLICT_MESSAGE =
  'El proveedor fue modificado por otro usuario. Recarga la informacion antes de guardar.';
const PROVEEDORES_ACCOUNT_REMOVAL_HINT =
  'Las cuentas removidas durante esta edicion se inactivaran al guardar el proveedor.';
const PROVEEDORES_SCOPE_BLOCKED_MESSAGE =
  'No tienes acceso al recurso solicitado dentro de tu alcance de sucursal.';
const PROVEEDORES_SCOPE_NOT_FOUND_MESSAGE =
  'El proveedor solicitado no esta disponible en tu alcance actual o no existe.';
const PROVEEDORES_LIFECYCLE_INFO_MESSAGE =
  'Los proveedores no se eliminan fisicamente; se inactivan para preservar la trazabilidad.';

const resolveProveedoresRequestMessage = (error, fallbackMessage) => {
  const status = Number(error?.status ?? 0);
  const code = String(error?.code ?? error?.data?.code ?? '').trim().toUpperCase();
  const apiMessage = String(error?.message ?? '').trim();

  if (status === 403 || code === 'FORBIDDEN') {
    return apiMessage || PROVEEDORES_SCOPE_BLOCKED_MESSAGE;
  }
  if (status === 404 && /proveedor no encontrado/i.test(apiMessage)) {
    return PROVEEDORES_SCOPE_NOT_FOUND_MESSAGE;
  }
  return apiMessage || fallbackMessage;
};

const createCuentaDraft = () => ({
  _tmp_id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  id_cuenta_bancaria: null,
  banco: '',
  tipo_cuenta: 'AHORRO',
  numero_cuenta: '',
  nombre_titular: '',
  identificacion_titular: '',
  moneda: 'HNL',
  es_principal: false,
  estado: true,
  observacion: ''
});

const PROVEEDOR_FORM_INITIAL = {
  nombre_proveedor: '',
  contacto_principal: '',
  correo_electronico: '',
  telefono_principal: '',
  telefono_secundario: '',
  ciudad: '',
  direccion: '',
  rtn: '',
  plazo_pago_dias: '0',
  observaciones: '',
  cuentas_bancarias: [createCuentaDraft()]
};

const parseEstado = (value) => {
  if (value === true || value === 1 || value === '1') return true;
  if (value === false || value === 0 || value === '0') return false;
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return Boolean(value);
};

const cleanText = (value) => {
  const raw = String(value ?? '').trim();
  return raw ? raw : null;
};

const normalizeReasonList = (value) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const normalized = [];
  for (const rawReason of value) {
    const reason = String(rawReason ?? '').trim();
    if (!reason || seen.has(reason)) continue;
    seen.add(reason);
    normalized.push(reason);
  }
  return normalized;
};

const resolveBooleanFlag = (...values) => {
  for (const value of values) {
    if (typeof value === 'boolean') return value;
  }
  return null;
};

const firstReason = (reasons, fallback) => {
  const normalized = normalizeReasonList(reasons);
  if (normalized.length > 0) return normalized[0];
  return fallback;
};

const formatMetricValue = (value) => {
  if (value === undefined || value === null || value === '') return 'N/D';
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return String(numeric);
  return String(value);
};

const formatDateTime = (value) => {
  if (!value) return 'N/D';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('es-HN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const normalizeCuenta = (raw) => {
  const cuenta = raw && typeof raw === 'object' ? raw : {};
  return {
    _tmp_id: `${cuenta.id_cuenta_bancaria ?? Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    id_cuenta_bancaria: Number(cuenta.id_cuenta_bancaria ?? 0) || null,
    banco: String(cuenta.banco ?? '').trim(),
    tipo_cuenta: String(cuenta.tipo_cuenta ?? 'AHORRO').trim().toUpperCase(),
    numero_cuenta: String(cuenta.numero_cuenta ?? '').trim(),
    nombre_titular: String(cuenta.nombre_titular ?? '').trim(),
    identificacion_titular: String(cuenta.identificacion_titular ?? '').trim(),
    moneda: String(cuenta.moneda ?? 'HNL').trim().toUpperCase(),
    es_principal: parseEstado(cuenta.es_principal),
    estado: parseEstado(cuenta.estado),
    observacion: String(cuenta.observacion ?? '').trim(),
    fecha_registro: cuenta.fecha_registro ?? null
  };
};

const normalizeProveedor = (row) => {
  const proveedor = row && typeof row === 'object' ? row : {};
  const cuentasRaw = Array.isArray(proveedor.cuentas_bancarias) ? proveedor.cuentas_bancarias : [];
  const comprasCount = Number(proveedor.compras_count ?? 0);
  const cuentasBancariasCount = Number(
    proveedor.cuentas_bancarias_count ?? (Array.isArray(cuentasRaw) ? cuentasRaw.length : 0)
  );
  const ordenesHistorialCount = Number(proveedor.ordenes_historial_count ?? 0);
  const ordenesActivasCount = Number(proveedor.ordenes_activas_count ?? 0);
  const hasOperationalHistoryResolved = resolveBooleanFlag(
    proveedor.has_operational_history,
    proveedor.hasOperationalHistory
  );
  const hasActiveProcessesResolved = resolveBooleanFlag(
    proveedor.has_active_processes,
    proveedor.hasActiveProcesses
  );
  const canDeleteResolved = resolveBooleanFlag(proveedor.can_delete, proveedor.canDelete);
  const canDeactivateResolved = resolveBooleanFlag(proveedor.can_deactivate, proveedor.canDeactivate);

  const hasOperationalHistory =
    hasOperationalHistoryResolved !== null
      ? hasOperationalHistoryResolved
      : comprasCount > 0 || ordenesHistorialCount > 0;
  const hasActiveProcesses =
    hasActiveProcessesResolved !== null ? hasActiveProcessesResolved : ordenesActivasCount > 0;
  const canDelete = canDeleteResolved !== null ? canDeleteResolved : !hasOperationalHistory;
  const canDeactivate = canDeactivateResolved !== null ? canDeactivateResolved : !hasActiveProcesses;
  const deleteBlockingReasons = normalizeReasonList(
    proveedor.delete_blocking_reasons ?? proveedor.deleteBlockingReasons
  );
  const deactivateBlockingReasons = normalizeReasonList(
    proveedor.deactivate_blocking_reasons ?? proveedor.deactivateBlockingReasons
  );
  const blockingReasons = normalizeReasonList(
    proveedor.blocking_reasons ?? proveedor.blockingReasons ?? [...deleteBlockingReasons, ...deactivateBlockingReasons]
  );

  return {
    id_proveedor: Number(proveedor.id_proveedor ?? 0),
    concurrency_token: String(
      proveedor.concurrency_token ?? proveedor.row_version ?? proveedor.xmin ?? ''
    ).trim(),
    nombre_proveedor: String(proveedor.nombre_proveedor ?? '').trim(),
    contacto_principal: cleanText(proveedor.contacto_principal),
    correo_electronico: cleanText(proveedor.correo_electronico),
    telefono_principal: cleanText(proveedor.telefono_principal),
    telefono_secundario: cleanText(proveedor.telefono_secundario),
    ciudad: cleanText(proveedor.ciudad),
    direccion: cleanText(proveedor.direccion),
    rtn: cleanText(proveedor.rtn),
    plazo_pago_dias:
      Number.isFinite(Number(proveedor.plazo_pago_dias)) && Number(proveedor.plazo_pago_dias) >= 0
        ? Number(proveedor.plazo_pago_dias)
        : 0,
    observaciones: cleanText(proveedor.observaciones),
    estado: parseEstado(proveedor.estado),
    fecha_registro: proveedor.fecha_registro ?? null,
    compras_count: comprasCount,
    cuentas_bancarias_count: cuentasBancariasCount,
    ordenes_historial_count: ordenesHistorialCount,
    ordenes_activas_count: ordenesActivasCount,
    has_operational_history: hasOperationalHistory,
    has_active_processes: hasActiveProcesses,
    can_delete: canDelete,
    can_deactivate: canDeactivate,
    blocking_reasons: blockingReasons,
    delete_blocking_reasons: deleteBlockingReasons,
    deactivate_blocking_reasons: deactivateBlockingReasons,
    cuentas_bancarias: cuentasRaw.map(normalizeCuenta)
  };
};

const getProveedorStatusMeta = (proveedor) =>
  parseEstado(proveedor?.estado)
    ? { label: 'ACTIVO', className: 'is-active', hint: 'Proveedor disponible para compras' }
    : { label: 'INACTIVO', className: 'is-inactive', hint: 'Proveedor fuera de operacion activa' };

const getProveedorActionMeta = (proveedor) => {
  const isActivo = parseEstado(proveedor?.estado);
  const canDeactivateResolved = resolveBooleanFlag(proveedor?.can_deactivate, proveedor?.canDeactivate);
  const canDeactivate =
    canDeactivateResolved !== null ? canDeactivateResolved : Number(proveedor?.ordenes_activas_count ?? 0) === 0;
  const deactivateBlockedReason = firstReason(
    proveedor?.deactivate_blocking_reasons ?? proveedor?.deactivateBlockingReasons ?? proveedor?.blocking_reasons,
    'Este proveedor no puede inactivarse porque mantiene ordenes de compra activas.'
  );

  if (!isActivo) {
    return {
      action: 'reactivar',
      label: 'Reactivar',
      icon: 'bi bi-arrow-clockwise',
      buttonClass: 'btn inv-prod-btn-subtle inv-warehouse-card__action',
      title: 'Reactivar proveedor',
      disabled: false,
      disabledReason: ''
    };
  }

  return {
    action: 'inactivar',
    label: 'Inactivar',
    icon: 'bi bi-slash-circle',
    buttonClass: 'btn inv-prod-btn-subtle inv-warehouse-card__action',
    title: canDeactivate ? 'Inactivar proveedor' : deactivateBlockedReason,
    disabled: !canDeactivate,
    disabledReason: canDeactivate ? '' : deactivateBlockedReason
  };
};

const getConfirmCopyByAction = (action) => {
  if (action === 'reactivar') {
    return {
      title: 'Confirmar reactivacion',
      subtitle: 'El proveedor volvera a estar disponible para conversion de compras.',
      note: 'Puedes volver a inactivarlo desde esta misma pantalla.',
      question: 'Deseas reactivar este proveedor?',
      actionLabel: 'Reactivar',
      actionBusyLabel: 'Reactivando...',
      actionIcon: 'bi-arrow-clockwise'
    };
  }

  return {
    title: 'Confirmar inactivacion',
    subtitle: 'El proveedor no aparecera en listas operativas activas.',
    note: PROVEEDORES_LIFECYCLE_INFO_MESSAGE,
    question: 'Deseas inactivar este proveedor?',
    actionLabel: 'Inactivar',
    actionBusyLabel: 'Inactivando...',
    actionIcon: 'bi-slash-circle'
  };
};

const validateCuenta = (cuenta, index) => {
  const errors = {};
  const banco = String(cuenta?.banco ?? '').trim();
  const tipo = String(cuenta?.tipo_cuenta ?? '').trim().toUpperCase();
  const numero = String(cuenta?.numero_cuenta ?? '').trim();
  const moneda = String(cuenta?.moneda ?? '').trim().toUpperCase();
  const titular = String(cuenta?.nombre_titular ?? '').trim();
  const ident = String(cuenta?.identificacion_titular ?? '').trim();
  const obs = String(cuenta?.observacion ?? '').trim();

  if (!banco) errors.banco = `Cuenta #${index + 1}: banco es obligatorio.`;
  else if (banco.length > 120) errors.banco = `Cuenta #${index + 1}: banco maximo 120.`;

  if (!tipo || !CUENTA_TIPOS.includes(tipo)) {
    errors.tipo_cuenta = `Cuenta #${index + 1}: tipo_cuenta invalido.`;
  }

  if (!numero) errors.numero_cuenta = `Cuenta #${index + 1}: numero_cuenta es obligatorio.`;
  else if (numero.length > 80) errors.numero_cuenta = `Cuenta #${index + 1}: numero_cuenta maximo 80.`;

  if (!CUENTA_MONEDAS.includes(moneda)) {
    errors.moneda = `Cuenta #${index + 1}: moneda invalida.`;
  }

  if (titular.length > 120) errors.nombre_titular = `Cuenta #${index + 1}: nombre_titular maximo 120.`;
  if (ident.length > 60) errors.identificacion_titular = `Cuenta #${index + 1}: identificacion maximo 60.`;
  if (obs.length > 255) errors.observacion = `Cuenta #${index + 1}: observacion maximo 255.`;

  return errors;
};

const validateProveedorForm = (form) => {
  const errors = {};
  const nombre = String(form?.nombre_proveedor ?? '').trim();
  const correo = String(form?.correo_electronico ?? '').trim();
  const tel1 = String(form?.telefono_principal ?? '').trim();
  const tel2 = String(form?.telefono_secundario ?? '').trim();
  const contacto = String(form?.contacto_principal ?? '').trim();
  const direccion = String(form?.direccion ?? '').trim();
  const ciudad = String(form?.ciudad ?? '').trim();
  const rtn = String(form?.rtn ?? '').trim();
  const observaciones = String(form?.observaciones ?? '').trim();
  const plazo = Number(form?.plazo_pago_dias ?? 0);

  if (nombre.length < 2) errors.nombre_proveedor = 'MINIMO 2 CARACTERES';
  else if (nombre.length > 120) errors.nombre_proveedor = 'MAXIMO 120 CARACTERES';

  if (correo) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(correo)) errors.correo_electronico = 'CORREO INVALIDO';
    else if (correo.length > 160) errors.correo_electronico = 'MAXIMO 160 CARACTERES';
  }

  if (tel1.length > 30) errors.telefono_principal = 'MAXIMO 30 CARACTERES';
  if (tel2.length > 30) errors.telefono_secundario = 'MAXIMO 30 CARACTERES';
  if (contacto.length > 120) errors.contacto_principal = 'MAXIMO 120 CARACTERES';
  if (direccion.length > 240) errors.direccion = 'MAXIMO 240 CARACTERES';
  if (ciudad.length > 120) errors.ciudad = 'MAXIMO 120 CARACTERES';
  if (rtn.length > 30) errors.rtn = 'MAXIMO 30 CARACTERES';
  if (observaciones.length > 500) errors.observaciones = 'MAXIMO 500 CARACTERES';
  if (!Number.isInteger(plazo) || plazo < 0) errors.plazo_pago_dias = 'DEBE SER ENTERO >= 0';
  else if (plazo > 3650) errors.plazo_pago_dias = 'MAXIMO 3650';

  const cuentas = Array.isArray(form?.cuentas_bancarias) ? form.cuentas_bancarias : [];
  const cuentasErrors = {};
  const seenCuenta = new Set();
  let principalCount = 0;

  cuentas.forEach((cuenta, index) => {
    const cuentaErrors = validateCuenta(cuenta, index);
    const numero = String(cuenta?.numero_cuenta ?? '').trim().toUpperCase();
    if (numero) {
      if (seenCuenta.has(numero)) {
        cuentaErrors.numero_cuenta = `Cuenta #${index + 1}: numero_cuenta duplicado.`;
      }
      seenCuenta.add(numero);
    }

    if (parseEstado(cuenta?.es_principal)) principalCount += 1;
    if (Object.keys(cuentaErrors).length > 0) cuentasErrors[index] = cuentaErrors;
  });

  if (principalCount > 1) errors.cuentas_bancarias = 'Solo una cuenta puede ser principal.';
  if (Object.keys(cuentasErrors).length > 0) errors.cuentas_bancarias_detalle = cuentasErrors;

  return errors;
};

const buildCuentaPayload = (cuenta) => {
  const payload = {
    banco: String(cuenta?.banco ?? '').trim(),
    tipo_cuenta: String(cuenta?.tipo_cuenta ?? 'AHORRO').trim().toUpperCase(),
    numero_cuenta: String(cuenta?.numero_cuenta ?? '').trim(),
    nombre_titular: cleanText(cuenta?.nombre_titular),
    identificacion_titular: cleanText(cuenta?.identificacion_titular),
    moneda: String(cuenta?.moneda ?? 'HNL').trim().toUpperCase(),
    es_principal: parseEstado(cuenta?.es_principal),
    estado: parseEstado(cuenta?.estado),
    observacion: cleanText(cuenta?.observacion)
  };

  const idCuenta = Number(cuenta?.id_cuenta_bancaria ?? 0);
  if (idCuenta > 0) {
    payload.id_cuenta_bancaria = idCuenta;
  }

  return payload;
};

const buildProveedorPayload = (form) => {
  const payload = {
    nombre_proveedor: String(form?.nombre_proveedor ?? '').trim(),
    contacto_principal: cleanText(form?.contacto_principal),
    correo_electronico: cleanText(form?.correo_electronico),
    telefono_principal: cleanText(form?.telefono_principal),
    telefono_secundario: cleanText(form?.telefono_secundario),
    ciudad: cleanText(form?.ciudad),
    direccion: cleanText(form?.direccion),
    rtn: cleanText(form?.rtn),
    plazo_pago_dias: Number.parseInt(String(form?.plazo_pago_dias ?? '0'), 10),
    observaciones: cleanText(form?.observaciones),
    cuentas_bancarias: (Array.isArray(form?.cuentas_bancarias) ? form.cuentas_bancarias : []).map(buildCuentaPayload)
  };

  const concurrencyToken = String(form?.concurrency_token ?? '').trim();
  if (concurrencyToken) {
    payload.concurrency_token = concurrencyToken;
  }

  return payload;
};

const ProveedoresTab = ({ openToast, onScopeChange }) => {
  const { can, canAny, loading: permisosLoading } = usePermisos();
  const canVerProveedores = can(PERMISSIONS.INVENTARIO_PROVEEDORES_VER);
  const canCrearProveedores = can(PERMISSIONS.INVENTARIO_PROVEEDORES_CREAR);
  const canEditarProveedores = can(PERMISSIONS.INVENTARIO_PROVEEDORES_EDITAR);
  const canCambiarEstadoProveedores = can(PERMISSIONS.INVENTARIO_PROVEEDORES_ESTADO_CAMBIAR);
  const canAccessProveedoresTab = canAny([
    PERMISSIONS.INVENTARIO_PROVEEDORES_VER,
    PERMISSIONS.INVENTARIO_PROVEEDORES_CREAR,
    PERMISSIONS.INVENTARIO_PROVEEDORES_EDITAR,
    PERMISSIONS.INVENTARIO_PROVEEDORES_ELIMINAR,
    PERMISSIONS.INVENTARIO_PROVEEDORES_ESTADO_CAMBIAR
  ]);

  const canRunProveedorAction = (action) => {
    if (action === 'inactivar' || action === 'reactivar') {
      return canCambiarEstadoProveedores;
    }
    return false;
  };

  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showInactivos, setShowInactivos] = useState(false);
  const [selectedProveedorId, setSelectedProveedorId] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState(PROVEEDOR_FORM_INITIAL);
  const [createErrors, setCreateErrors] = useState({});
  const [savingCreate, setSavingCreate] = useState(false);

  const [detailId, setDetailId] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState(null);

  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editErrors, setEditErrors] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [editRemovedCuentas, setEditRemovedCuentas] = useState([]);

  const [confirmModal, setConfirmModal] = useState({
    show: false,
    idToDelete: null,
    nombre: '',
    action: 'inactivar',
    counts: null,
    canDelete: null,
    canDeactivate: null,
    blockingReasons: []
  });
  const [deletingConfirm, setDeletingConfirm] = useState(false);
  const [resolvingActionId, setResolvingActionId] = useState(null);
  const [confirmDeleteError, setConfirmDeleteError] = useState('');

  const proveedoresRequestIdRef = useRef(0);
  const detailRequestIdRef = useRef(0);
  const editRequestIdRef = useRef(0);
  const dependenciasRequestIdRef = useRef(0);
  const confirmActionRequestIdRef = useRef(0);
  const modalPortalTarget = typeof document !== 'undefined' ? document.body : null;
  const showEditModal = Boolean(editForm && editId !== null);

  const safeToast = (title, message, variant = 'success') => {
    if (typeof openToast === 'function') openToast(title, message, variant);
  };

  const cargarProveedores = async ({ silent = false } = {}) => {
    if (!canVerProveedores) {
      proveedoresRequestIdRef.current += 1;
      setProveedores([]);
      setLoading(false);
      setError('');
      return;
    }
    const requestId = ++proveedoresRequestIdRef.current;
    if (!silent) setLoading(true);
    setError('');
    try {
      const response = await inventarioService.getProveedores({ include_inactivos: showInactivos });
      if (requestId !== proveedoresRequestIdRef.current) return;
      const rows = Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : [];
      const normalized = rows.map(normalizeProveedor).filter((row) => Number(row.id_proveedor) > 0);
      setProveedores(normalized);
    } catch (fetchError) {
      if (requestId !== proveedoresRequestIdRef.current) return;
      setError(resolveProveedoresRequestMessage(fetchError, 'No se pudo cargar el listado de proveedores.'));
      if (!silent) setProveedores([]);
    } finally {
      if (requestId === proveedoresRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!canVerProveedores) {
      proveedoresRequestIdRef.current += 1;
      detailRequestIdRef.current += 1;
      editRequestIdRef.current += 1;
      dependenciasRequestIdRef.current += 1;
      confirmActionRequestIdRef.current += 1;
      setProveedores([]);
      setLoading(false);
      setShowCreateModal(false);
      setDetailId(null);
      setDetailLoading(false);
      setDetailData(null);
      setEditId(null);
      setEditForm(null);
      setEditRemovedCuentas([]);
      setConfirmModal({
        show: false,
        idToDelete: null,
        nombre: '',
        action: 'inactivar',
        counts: null,
        canDelete: null,
        canDeactivate: null,
        blockingReasons: []
      });
      setDeletingConfirm(false);
      setConfirmDeleteError('');
      setError('');
      setResolvingActionId(null);
      return;
    }
    cargarProveedores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canVerProveedores, showInactivos]);

  useEffect(() => () => {
    proveedoresRequestIdRef.current += 1;
    detailRequestIdRef.current += 1;
    editRequestIdRef.current += 1;
    dependenciasRequestIdRef.current += 1;
    confirmActionRequestIdRef.current += 1;
  }, []);

  useEffect(() => {
    if (!proveedores.length) {
      setSelectedProveedorId('');
      return;
    }

    const selectedId = Number(selectedProveedorId);
    const existsSelected = proveedores.some((row) => Number(row.id_proveedor) === selectedId);
    if (!existsSelected) setSelectedProveedorId(String(proveedores[0].id_proveedor));
  }, [proveedores, selectedProveedorId]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    if (!showCreateModal && !showEditModal) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showCreateModal, showEditModal]);

  const proveedoresFiltrados = useMemo(() => {
    const raw = String(search ?? '').trim().toLowerCase();
    if (!raw) return proveedores;

    return proveedores.filter((proveedor) => {
      const stack = [
        proveedor.nombre_proveedor,
        proveedor.contacto_principal,
        proveedor.correo_electronico,
        proveedor.telefono_principal,
        proveedor.telefono_secundario,
        proveedor.ciudad,
        proveedor.rtn
      ];
      return stack.some((value) => String(value ?? '').toLowerCase().includes(raw));
    });
  }, [proveedores, search]);

  const selectedProveedor = useMemo(() => {
    const safeId = Number(selectedProveedorId ?? 0);
    if (!safeId) return null;
    return proveedores.find((row) => Number(row.id_proveedor) === safeId) || null;
  }, [proveedores, selectedProveedorId]);

  const confirmProveedor = useMemo(() => {
    const safeId = Number(confirmModal.idToDelete ?? 0);
    if (!safeId) return null;
    return proveedores.find((row) => Number(row.id_proveedor) === safeId) || null;
  }, [proveedores, confirmModal.idToDelete]);

  const confirmCopy = useMemo(() => getConfirmCopyByAction(confirmModal.action), [confirmModal.action]);

  const detailProveedor = useMemo(() => normalizeProveedor(detailData || {}), [detailData]);
  const detailStatusMeta = useMemo(() => getProveedorStatusMeta(detailProveedor), [detailProveedor]);
  const detailActionMeta = useMemo(
    () => (detailData ? getProveedorActionMeta(detailProveedor) : null),
    [detailData, detailProveedor]
  );

  const detailMetrics = useMemo(() => {
    if (!detailData) return [];
    return [
      { key: 'contacto', label: 'Contacto principal', icon: 'bi bi-person-badge', value: detailProveedor.contacto_principal || 'N/D' },
      { key: 'correo', label: 'Correo electronico', icon: 'bi bi-envelope', value: detailProveedor.correo_electronico || 'N/D' },
      { key: 'tel1', label: 'Telefono principal', icon: 'bi bi-telephone', value: detailProveedor.telefono_principal || 'N/D' },
      { key: 'tel2', label: 'Telefono secundario', icon: 'bi bi-phone', value: detailProveedor.telefono_secundario || 'N/D' },
      { key: 'ciudad', label: 'Ciudad', icon: 'bi bi-geo-alt', value: detailProveedor.ciudad || 'N/D' },
      { key: 'direccion', label: 'Direccion', icon: 'bi bi-signpost', value: detailProveedor.direccion || 'N/D' },
      { key: 'rtn', label: 'RTN', icon: 'bi bi-file-earmark-text', value: detailProveedor.rtn || 'N/D' },
      { key: 'plazo', label: 'Plazo pago', icon: 'bi bi-calendar2-week', value: `${formatMetricValue(detailProveedor.plazo_pago_dias)} dias` },
      { key: 'compras', label: 'Compras asociadas', icon: 'bi bi-cart-check', value: formatMetricValue(detailProveedor.compras_count) },
      {
        key: 'cuentas_count',
        label: 'Cuentas bancarias',
        icon: 'bi bi-bank',
        value: formatMetricValue(detailProveedor.cuentas_bancarias_count)
      },
      { key: 'registro', label: 'Fecha registro', icon: 'bi bi-clock-history', value: formatDateTime(detailProveedor.fecha_registro) },
      { key: 'obs', label: 'Observaciones', icon: 'bi bi-chat-left-text', value: detailProveedor.observaciones || 'N/D' }
    ];
  }, [detailData, detailProveedor]);

  const normalizarProveedorAFormulario = (proveedor) => ({
    concurrency_token: String(proveedor.concurrency_token ?? '').trim(),
    nombre_proveedor: proveedor.nombre_proveedor || '',
    contacto_principal: proveedor.contacto_principal || '',
    correo_electronico: proveedor.correo_electronico || '',
    telefono_principal: proveedor.telefono_principal || '',
    telefono_secundario: proveedor.telefono_secundario || '',
    ciudad: proveedor.ciudad || '',
    direccion: proveedor.direccion || '',
    rtn: proveedor.rtn || '',
    plazo_pago_dias: String(proveedor.plazo_pago_dias ?? 0),
    observaciones: proveedor.observaciones || '',
    cuentas_bancarias:
      Array.isArray(proveedor.cuentas_bancarias) && proveedor.cuentas_bancarias.length > 0
        ? proveedor.cuentas_bancarias.map(normalizeCuenta)
        : [createCuentaDraft()]
  });

  const cargarDetalleProveedor = async (idProveedor) => {
    const safeId = Number(idProveedor);
    if (!safeId) return null;

    const response = await inventarioService.getProveedorById(safeId);
    const payload = response?.data ? response.data : response;
    if (!payload || typeof payload !== 'object') return null;
    return normalizeProveedor(payload);
  };

  const openDetail = async (idProveedor) => {
    if (!canVerProveedores) {
      safeToast('SIN PERMISO', 'No tienes permiso para ver proveedores.', 'warning');
      return;
    }
    const safeId = Number(idProveedor);
    if (!safeId) return;
    const requestId = ++detailRequestIdRef.current;

    setShowCreateModal(false);
    editRequestIdRef.current += 1;
    setEditId(null);
    setEditForm(null);
    setEditRemovedCuentas([]);
    setDetailId(safeId);
    setDetailLoading(true);
    setDetailData(null);

    try {
      const proveedor = await cargarDetalleProveedor(safeId);
      if (requestId !== detailRequestIdRef.current) return;
      if (!proveedor) {
        safeToast('PROVEEDORES', 'No se encontro detalle del proveedor.', 'warning');
        setDetailId(null);
        return;
      }
      setDetailData(proveedor);
    } catch (detailError) {
      if (requestId !== detailRequestIdRef.current) return;
      safeToast(
        'ERROR',
        resolveProveedoresRequestMessage(detailError, 'No se pudo cargar el detalle del proveedor.'),
        'danger'
      );
      setDetailId(null);
    } finally {
      if (requestId === detailRequestIdRef.current) {
        setDetailLoading(false);
      }
    }
  };

  const closeDetail = () => {
    detailRequestIdRef.current += 1;
    setDetailId(null);
    setDetailLoading(false);
    setDetailData(null);
  };

  const resetCreateForm = () => {
    setForm(PROVEEDOR_FORM_INITIAL);
    setCreateErrors({});
  };

  const openCreate = () => {
    if (!canCrearProveedores) {
      safeToast('SIN PERMISO', 'No tienes permiso para crear proveedores.', 'warning');
      return;
    }
    closeDetail();
    editRequestIdRef.current += 1;
    setEditId(null);
    setEditForm(null);
    setEditRemovedCuentas([]);
    resetCreateForm();
    setShowCreateModal(true);
  };

  const closeCreate = () => {
    if (savingCreate) return;
    setShowCreateModal(false);
    resetCreateForm();
  };

  const updateCuentaList = (setter, index, patch) => {
    setter((current) => {
      const cuentas = Array.isArray(current.cuentas_bancarias) ? [...current.cuentas_bancarias] : [];
      if (!cuentas[index]) return current;
      const merged = { ...cuentas[index], ...patch };

      if (patch?.es_principal === true) {
        for (let i = 0; i < cuentas.length; i += 1) {
          cuentas[i] = i === index ? merged : { ...cuentas[i], es_principal: false };
        }
      } else {
        cuentas[index] = merged;
      }

      return { ...current, cuentas_bancarias: cuentas };
    });
  };

  const addCuentaRow = (setter) => {
    setter((current) => ({
      ...current,
      cuentas_bancarias: [...(Array.isArray(current.cuentas_bancarias) ? current.cuentas_bancarias : []), createCuentaDraft()]
    }));
  };

  const removeCuentaRow = (setter, index) => {
    setter((current) => {
      const cuentas = Array.isArray(current.cuentas_bancarias) ? [...current.cuentas_bancarias] : [];
      if (!cuentas[index]) return current;
      const next = cuentas.filter((_, idx) => idx !== index);
      return { ...current, cuentas_bancarias: next };
    });
  };

  const registerRemovedCuentaForEdit = (cuenta) => {
    const idCuenta = Number(cuenta?.id_cuenta_bancaria ?? 0);
    if (!idCuenta) return;
    setEditRemovedCuentas((current) => {
      if (current.some((item) => Number(item?.id_cuenta_bancaria ?? 0) === idCuenta)) {
        return current;
      }
      return [
        ...current,
        {
          ...normalizeCuenta(cuenta),
          id_cuenta_bancaria: idCuenta
        }
      ];
    });
  };

  const removeCuentaRowFromEdit = (index) => {
    const cuentas = Array.isArray(editForm?.cuentas_bancarias) ? editForm.cuentas_bancarias : [];
    const cuenta = cuentas[index] || null;
    removeCuentaRow(setEditForm, index);
    if (cuenta && Number(cuenta?.id_cuenta_bancaria ?? 0) > 0) {
      registerRemovedCuentaForEdit(cuenta);
    }
  };

  const restoreRemovedCuentaForEdit = (idCuentaBancaria) => {
    const safeId = Number(idCuentaBancaria ?? 0);
    if (!safeId) return;

    let cuentaToRestore = null;
    setEditRemovedCuentas((current) => {
      cuentaToRestore =
        current.find((cuenta) => Number(cuenta?.id_cuenta_bancaria ?? 0) === safeId) || null;
      return current.filter((cuenta) => Number(cuenta?.id_cuenta_bancaria ?? 0) !== safeId);
    });

    if (!cuentaToRestore) return;
    setEditForm((current) => {
      if (!current) return current;
      const cuentas = Array.isArray(current.cuentas_bancarias) ? [...current.cuentas_bancarias] : [];
      const alreadyExists = cuentas.some(
        (cuenta) => Number(cuenta?.id_cuenta_bancaria ?? 0) === Number(cuentaToRestore?.id_cuenta_bancaria ?? 0)
      );
      if (alreadyExists) return current;
      return {
        ...current,
        cuentas_bancarias: [...cuentas, cuentaToRestore]
      };
    });
  };

  const onCrear = async (event) => {
    event.preventDefault();
    if (!canCrearProveedores) {
      safeToast('SIN PERMISO', 'No tienes permiso para crear proveedores.', 'warning');
      return;
    }
    if (savingCreate) return;

    const validationErrors = validateProveedorForm(form);
    setCreateErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      safeToast('VALIDACION', 'Revisa los campos y cuentas bancarias del proveedor.', 'warning');
      return;
    }

    setSavingCreate(true);
    try {
      const payload = buildProveedorPayload(form);
      await inventarioService.crearProveedor(payload);
      safeToast('PROVEEDORES', 'Proveedor creado correctamente.', 'success');
      closeCreate();
      await cargarProveedores({ silent: true });
    } catch (saveError) {
      safeToast('ERROR', resolveProveedoresRequestMessage(saveError, 'No se pudo crear el proveedor.'), 'danger');
    } finally {
      setSavingCreate(false);
    }
  };

  const iniciarEdicion = async (proveedor) => {
    if (!canEditarProveedores) {
      safeToast('SIN PERMISO', 'No tienes permiso para editar proveedores.', 'warning');
      return;
    }
    const idProveedor = Number(proveedor?.id_proveedor ?? proveedor ?? 0);
    if (!idProveedor) return;
    const requestId = ++editRequestIdRef.current;

    closeDetail();
    setShowCreateModal(false);
    setEditErrors({});
    setSavingEdit(false);
    setEditId(idProveedor);
    setEditForm(null);
    setEditRemovedCuentas([]);

    try {
      const detalle = await cargarDetalleProveedor(idProveedor);
      if (requestId !== editRequestIdRef.current) return;
      if (!detalle) {
        safeToast('PROVEEDORES', 'No se pudo cargar el proveedor para edicion.', 'warning');
        setEditId(null);
        setEditRemovedCuentas([]);
        return;
      }
      setEditForm(normalizarProveedorAFormulario(detalle));
    } catch (editError) {
      if (requestId !== editRequestIdRef.current) return;
      safeToast('ERROR', resolveProveedoresRequestMessage(editError, 'No se pudo abrir la edicion.'), 'danger');
      setEditId(null);
      setEditForm(null);
      setEditRemovedCuentas([]);
    }
  };

  const cancelarEdicion = () => {
    if (savingEdit) return;
    editRequestIdRef.current += 1;
    setEditId(null);
    setEditForm(null);
    setEditErrors({});
    setEditRemovedCuentas([]);
  };

  const guardarEdicion = async (event) => {
    event.preventDefault();
    if (!canEditarProveedores) {
      safeToast('SIN PERMISO', 'No tienes permiso para editar proveedores.', 'warning');
      return;
    }
    if (!editForm || !editId || savingEdit) return;

    const validationErrors = validateProveedorForm(editForm);
    setEditErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      safeToast('VALIDACION', 'Hay campos invalidos en la edicion del proveedor.', 'warning');
      return;
    }
    const concurrencyToken = String(editForm?.concurrency_token ?? '').trim();
    if (!concurrencyToken) {
      const message =
        'No se pudo validar la version actual del proveedor. Recarga la informacion e intenta nuevamente.';
      setEditErrors((current) => ({ ...current, _concurrency: message }));
      safeToast('PROVEEDORES', message, 'warning');
      return;
    }

    setSavingEdit(true);
    try {
      const payload = buildProveedorPayload(editForm);
      await inventarioService.actualizarProveedor(editId, payload);
      safeToast('PROVEEDORES', 'Proveedor actualizado correctamente.', 'success');
      cancelarEdicion();
      await cargarProveedores({ silent: true });
    } catch (updateError) {
      const isConcurrencyConflict =
        updateError?.status === 409 &&
        String(updateError?.data?.conflict_type || '').toUpperCase() === 'CONCURRENCY';
      if (isConcurrencyConflict) {
        const message = updateError?.message || PROVEEDORES_CONCURRENCY_CONFLICT_MESSAGE;
        setEditErrors((current) => ({ ...current, _concurrency: message }));
        safeToast('CONFLICTO DE EDICION', message, 'warning');
        return;
      }

      safeToast(
        'ERROR',
        resolveProveedoresRequestMessage(updateError, 'No se pudo actualizar el proveedor.'),
        'danger'
      );
    } finally {
      setSavingEdit(false);
    }
  };

  const openConfirmDelete = (proveedor, forceAction = null) => {
    if (!proveedor?.id_proveedor) return;
    const actionMeta = getProveedorActionMeta(proveedor);
    const requestedAction = String(forceAction || actionMeta.action || '')
      .trim()
      .toLowerCase();
    const action = requestedAction === 'reactivar' ? 'reactivar' : 'inactivar';
    if (actionMeta.disabled) {
      safeToast('PROVEEDORES', actionMeta.disabledReason || 'Esta accion no esta disponible para este proveedor.', 'warning');
      return;
    }
    if (!canRunProveedorAction(action)) {
      safeToast('SIN PERMISO', 'No tienes permiso para realizar esta accion sobre proveedores.', 'warning');
      return;
    }
    setConfirmDeleteError('');
    setConfirmModal({
      show: true,
      idToDelete: Number(proveedor.id_proveedor),
      nombre: proveedor.nombre_proveedor || `Proveedor ${proveedor.id_proveedor}`,
      action,
      counts: {
        compras: Number(proveedor.compras_count ?? 0),
        cuentas_bancarias: Number(proveedor.cuentas_bancarias_count ?? 0),
        ordenes_historial: Number(proveedor.ordenes_historial_count ?? 0),
        ordenes_activas: Number(proveedor.ordenes_activas_count ?? 0)
      },
      canDelete: resolveBooleanFlag(proveedor.can_delete, proveedor.canDelete),
      canDeactivate: resolveBooleanFlag(proveedor.can_deactivate, proveedor.canDeactivate),
      blockingReasons: normalizeReasonList(proveedor.blocking_reasons ?? proveedor.blockingReasons)
    });
  };

  const closeConfirmDelete = () => {
    dependenciasRequestIdRef.current += 1;
    setDeletingConfirm(false);
    setResolvingActionId(null);
    setConfirmDeleteError('');
    setConfirmModal({
      show: false,
      idToDelete: null,
      nombre: '',
      action: 'inactivar',
      counts: null,
      canDelete: null,
      canDeactivate: null,
      blockingReasons: []
    });
  };

  const eliminarConfirmado = async () => {
    const id = Number(confirmModal.idToDelete ?? 0);
    const action = String(confirmModal.action ?? '').trim().toLowerCase();
    let effectiveAction = action;
    if (!id || deletingConfirm) return;
    if (!canRunProveedorAction(action)) {
      safeToast('SIN PERMISO', 'No tienes permiso para realizar esta accion sobre proveedores.', 'warning');
      return;
    }

    setDeletingConfirm(true);
    setResolvingActionId(id);
    setConfirmDeleteError('');
    const requestId = ++confirmActionRequestIdRef.current;

    try {
      const dependencies = await inventarioService.getProveedorDependencias(id);
      if (requestId !== confirmActionRequestIdRef.current) {
        return;
      }

      const countsRaw = dependencies?.counts || {
        compras: Number(confirmProveedor?.compras_count ?? 0),
        cuentas_bancarias: Number(confirmProveedor?.cuentas_bancarias_count ?? 0),
        ordenes_historial: Number(confirmProveedor?.ordenes_historial_count ?? 0),
        ordenes_activas: Number(confirmProveedor?.ordenes_activas_count ?? 0)
      };
      const counts = {
        compras: Number(countsRaw?.compras ?? 0),
        cuentas_bancarias: Number(countsRaw?.cuentas_bancarias ?? 0),
        ordenes_historial: Number(countsRaw?.ordenes_historial ?? 0),
        ordenes_activas: Number(countsRaw?.ordenes_activas ?? 0)
      };

      const canDeleteResolved = resolveBooleanFlag(dependencies?.canDelete, dependencies?.can_delete);
      const canDelete =
        canDeleteResolved !== null ? canDeleteResolved : Number(counts.compras ?? 0) === 0 && Number(counts.ordenes_historial ?? 0) === 0;
      const canDeactivateResolved = resolveBooleanFlag(dependencies?.canDeactivate, dependencies?.can_deactivate);
      const canDeactivate =
        canDeactivateResolved !== null ? canDeactivateResolved : Number(counts.ordenes_activas ?? 0) === 0;
      const deleteBlockingReasons = normalizeReasonList(
        dependencies?.deleteBlockingReasons ?? dependencies?.delete_blocking_reasons
      );
      const deactivateBlockingReasons = normalizeReasonList(
        dependencies?.deactivateBlockingReasons ?? dependencies?.deactivate_blocking_reasons
      );
      const blockingReasons = normalizeReasonList(
        dependencies?.blockingReasons ??
          dependencies?.blocking_reasons ??
          [...deleteBlockingReasons, ...deactivateBlockingReasons]
      );
      const deactivateReason = firstReason(
        deactivateBlockingReasons.length > 0 ? deactivateBlockingReasons : blockingReasons,
        'El proveedor no puede inactivarse porque mantiene ordenes de compra activas.'
      );

      if (effectiveAction === 'inactivar' && !canDeactivate) {
        setConfirmModal((current) => ({
          ...current,
          counts,
          canDelete,
          canDeactivate,
          blockingReasons
        }));
        setConfirmDeleteError(deactivateReason);
        return;
      }

      if (effectiveAction === 'inactivar') {
        await inventarioService.inactivarProveedor(id, '');
      } else {
        effectiveAction = 'reactivar';
        await inventarioService.reactivarProveedor(id);
      }

      const successLabel =
        effectiveAction === 'inactivar'
          ? 'Proveedor inactivado correctamente.'
          : 'Proveedor reactivado correctamente.';

      if (Number(detailId ?? 0) === id) closeDetail();
      if (Number(editId ?? 0) === id) cancelarEdicion();
      closeConfirmDelete();
      safeToast('PROVEEDORES', successLabel, 'success');

      try {
        await cargarProveedores({ silent: true });
      } catch (reloadError) {
        safeToast(
          'AVISO',
          resolveProveedoresRequestMessage(
            reloadError,
            'La accion se aplico, pero no se pudo refrescar el listado de proveedores.'
          ),
          'warning'
        );
      }
    } catch (deleteError) {
      if (requestId !== confirmActionRequestIdRef.current) return;
      setConfirmDeleteError(
        resolveProveedoresRequestMessage(deleteError, 'No se pudo completar la accion seleccionada.')
      );
    } finally {
      if (requestId === confirmActionRequestIdRef.current) {
        setDeletingConfirm(false);
        setResolvingActionId(null);
      }
    }
  };

  const renderCuentaRows = ({
    values,
    errors,
    onChange,
    onRemove,
    onAdd,
    disabled,
    removedItems = [],
    onRestoreRemoved = null
  }) => {
    const cuentas = Array.isArray(values) ? values : [];
    const cuentasError = errors?.cuentas_bancarias;
    const cuentasDetalleError = errors?.cuentas_bancarias_detalle || {};
    const removedCuentas = Array.isArray(removedItems) ? removedItems : [];

    return (
      <section className="inv-prod-pmodal__section mt-2">
        <div className="inv-prod-pmodal__section-head">
          <div className="inv-prod-pmodal__section-title">Cuentas bancarias</div>
          <div className="inv-prod-pmodal__section-sub">
            Registra cuentas en renglones lineales (existentes, nuevas y removidas).
          </div>
        </div>

        {cuentasError ? (
          <div className="alert alert-warning py-2 mb-3" role="alert">
            {cuentasError}
          </div>
        ) : null}

        {removedCuentas.length > 0 ? (
          <div className="alert alert-secondary py-2 mb-3" role="status">
            <div className="fw-semibold small mb-1">Cuentas removidas en esta edicion</div>
            <div className="small mb-2">{PROVEEDORES_ACCOUNT_REMOVAL_HINT}</div>
            <div className="d-flex flex-column gap-2">
              {removedCuentas.map((cuenta) => {
                const accountId = Number(cuenta?.id_cuenta_bancaria ?? 0);
                const labelBanco = String(cuenta?.banco ?? '').trim() || 'Banco no definido';
                const labelNumero = String(cuenta?.numero_cuenta ?? '').trim() || 'N/D';
                return (
                  <div
                    key={accountId || cuenta?._tmp_id || labelNumero}
                    className="d-flex align-items-center justify-content-between gap-2"
                  >
                    <span className="small">
                      <span className="badge text-bg-light border me-2">Removida</span>
                      {`${labelBanco} - ${labelNumero}`}
                    </span>
                    {typeof onRestoreRemoved === 'function' && accountId > 0 ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => onRestoreRemoved(accountId)}
                        disabled={disabled}
                      >
                        Restaurar
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="d-flex flex-column gap-3">
          {cuentas.length === 0 ? (
            <div className="text-muted small">No hay cuentas bancarias en el formulario.</div>
          ) : null}
          {cuentas.map((cuenta, index) => {
            const rowErrors = cuentasDetalleError[index] || {};
            const isExistingAccount = Number(cuenta?.id_cuenta_bancaria ?? 0) > 0;
            return (
              <div key={cuenta._tmp_id || `${index}`} className="border rounded-3 p-3 bg-light-subtle">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <div className="d-flex align-items-center gap-2">
                    <strong>Cuenta #{index + 1}</strong>
                    <span className={`badge ${isExistingAccount ? 'text-bg-light border' : 'text-bg-primary'}`}>
                      {isExistingAccount ? 'Existente' : 'Nueva'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    disabled={disabled}
                    onClick={() => onRemove(index)}
                  >
                    <i className="bi bi-trash me-1" />Quitar
                  </button>
                </div>

                <div className="row g-2">
                  <div className="col-12">
                    <label className="form-label mb-1">Banco</label>
                    <input
                      className={`form-control ${rowErrors.banco ? 'is-invalid' : ''}`}
                      value={cuenta.banco}
                      onChange={(event) => onChange(index, { banco: event.target.value })}
                      disabled={disabled}
                    />
                    {rowErrors.banco ? <div className="invalid-feedback">{rowErrors.banco}</div> : null}
                  </div>

                  <div className="col-12">
                    <label className="form-label mb-1">Tipo de cuenta</label>
                    <select
                      className={`form-select ${rowErrors.tipo_cuenta ? 'is-invalid' : ''}`}
                      value={cuenta.tipo_cuenta}
                      onChange={(event) => onChange(index, { tipo_cuenta: event.target.value })}
                      disabled={disabled}
                    >
                      {CUENTA_TIPOS.map((tipo) => (
                        <option key={tipo} value={tipo}>
                          {tipo}
                        </option>
                      ))}
                    </select>
                    {rowErrors.tipo_cuenta ? <div className="invalid-feedback">{rowErrors.tipo_cuenta}</div> : null}
                  </div>

                  <div className="col-12">
                    <label className="form-label mb-1">Numero de cuenta</label>
                    <input
                      className={`form-control ${rowErrors.numero_cuenta ? 'is-invalid' : ''}`}
                      value={cuenta.numero_cuenta}
                      onChange={(event) => onChange(index, { numero_cuenta: event.target.value })}
                      disabled={disabled}
                    />
                    {rowErrors.numero_cuenta ? <div className="invalid-feedback">{rowErrors.numero_cuenta}</div> : null}
                  </div>

                  <div className="col-12">
                    <label className="form-label mb-1">Nombre titular</label>
                    <input
                      className={`form-control ${rowErrors.nombre_titular ? 'is-invalid' : ''}`}
                      value={cuenta.nombre_titular}
                      onChange={(event) => onChange(index, { nombre_titular: event.target.value })}
                      disabled={disabled}
                    />
                    {rowErrors.nombre_titular ? <div className="invalid-feedback">{rowErrors.nombre_titular}</div> : null}
                  </div>

                  <div className="col-12">
                    <label className="form-label mb-1">Identificacion titular</label>
                    <input
                      className={`form-control ${rowErrors.identificacion_titular ? 'is-invalid' : ''}`}
                      value={cuenta.identificacion_titular}
                      onChange={(event) => onChange(index, { identificacion_titular: event.target.value })}
                      disabled={disabled}
                    />
                    {rowErrors.identificacion_titular ? (
                      <div className="invalid-feedback">{rowErrors.identificacion_titular}</div>
                    ) : null}
                  </div>

                  <div className="col-12">
                    <label className="form-label mb-1">Moneda</label>
                    <select
                      className={`form-select ${rowErrors.moneda ? 'is-invalid' : ''}`}
                      value={cuenta.moneda}
                      onChange={(event) => onChange(index, { moneda: event.target.value })}
                      disabled={disabled}
                    >
                      {CUENTA_MONEDAS.map((moneda) => (
                        <option key={moneda} value={moneda}>
                          {moneda}
                        </option>
                      ))}
                    </select>
                    {rowErrors.moneda ? <div className="invalid-feedback">{rowErrors.moneda}</div> : null}
                  </div>

                  <div className="col-12">
                    <label className="form-label mb-1">Observacion de cuenta</label>
                    <textarea
                      className={`form-control ${rowErrors.observacion ? 'is-invalid' : ''}`}
                      rows="2"
                      value={cuenta.observacion}
                      onChange={(event) => onChange(index, { observacion: event.target.value })}
                      disabled={disabled}
                    />
                    {rowErrors.observacion ? <div className="invalid-feedback">{rowErrors.observacion}</div> : null}
                  </div>

                  <div className="col-12 d-flex flex-wrap gap-3 pt-1">
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={parseEstado(cuenta.es_principal)}
                        onChange={(event) => onChange(index, { es_principal: event.target.checked })}
                        disabled={disabled}
                      />
                      <label className="form-check-label">Cuenta principal</label>
                    </div>

                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={parseEstado(cuenta.estado)}
                        onChange={(event) => onChange(index, { estado: event.target.checked })}
                        disabled={disabled}
                      />
                      <label className="form-check-label">Cuenta activa</label>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3">
          <button type="button" className="btn btn-outline-primary btn-sm" onClick={onAdd} disabled={disabled}>
            <i className="bi bi-plus-circle me-1" />Agregar cuenta bancaria
          </button>
        </div>
      </section>
    );
  };

  const cardsContent = loading ? (
    <div className="inv-warehouse-grid is-centered">
      {[1, 2, 3].map((skeleton) => (
        <div key={skeleton} className="inv-warehouse-card inv-warehouse-card--skeleton" aria-hidden="true" />
      ))}
    </div>
  ) : proveedoresFiltrados.length === 0 ? (
    <div className="inv-warehouse-empty">
      <i className="bi bi-inbox" aria-hidden="true" />
      <div className="mt-2">No hay proveedores para la busqueda actual.</div>
    </div>
  ) : (
    <div className={`inv-warehouse-grid ${proveedoresFiltrados.length < 3 ? 'is-centered' : ''}`.trim()}>
      {proveedoresFiltrados.map((proveedor, index) => {
        const statusMeta = getProveedorStatusMeta(proveedor);
        const actionMeta = getProveedorActionMeta(proveedor);
        const isInactivo = !parseEstado(proveedor.estado);
        const isResolvingAction = Number(resolvingActionId ?? 0) === Number(proveedor?.id_proveedor ?? 0);
        const isSelected = String(selectedProveedorId ?? '') === String(proveedor?.id_proveedor ?? '');
        const isActivo = parseEstado(proveedor.estado);
        const hasAlert = isActivo && (!proveedor.can_delete || !proveedor.can_deactivate);
        const showHistoryHint = isActivo && !proveedor.can_delete && proveedor.can_deactivate;
        const showDeactivateBlockedHint = isActivo && !proveedor.can_deactivate;
        const deactivateBlockedReason = firstReason(
          proveedor.deactivate_blocking_reasons ?? proveedor.blocking_reasons,
          'No se puede inactivar porque mantiene ordenes de compra activas.'
        );

        return (
          <article
            key={proveedor.id_proveedor}
            className={`inv-warehouse-card inv-anim-in ${isSelected ? 'is-selected' : ''} ${
              hasAlert ? 'has-alerts' : ''
            } ${isInactivo ? 'opacity-75 border border-secondary-subtle' : ''}`.trim()}
            role="button"
            tabIndex={0}
            style={{ animationDelay: `${Math.min(index * 40, 240)}ms` }}
            onClick={() => setSelectedProveedorId(String(proveedor.id_proveedor))}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setSelectedProveedorId(String(proveedor.id_proveedor));
              }
            }}
          >
            <div className="inv-warehouse-card__halo" aria-hidden="true">
              <i className="bi bi-truck" />
            </div>

            <div className="inv-warehouse-card__header">
              <div className="inv-warehouse-card__title-wrap">
                <span className="inv-warehouse-card__icon" aria-hidden="true">
                  <i className="bi bi-person-lines-fill" />
                </span>
                <div>
                  <div className="inv-warehouse-card__name">
                    {proveedor.nombre_proveedor || `Proveedor ${proveedor.id_proveedor}`}
                  </div>
                  <div className="inv-warehouse-card__branch">
                    <i className="bi bi-geo-alt" aria-hidden="true" />
                    <span>{proveedor.ciudad || 'Ciudad no definida'}</span>
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
                  INACTIVO - no disponible para conversion de compras
                </div>
              ) : null}

              {showHistoryHint ? (
                <div className="alert alert-info py-2 mb-3" role="status">
                  {PROVEEDORES_LIFECYCLE_INFO_MESSAGE}
                </div>
              ) : null}

              {showDeactivateBlockedHint ? (
                <div className="alert alert-warning py-2 mb-3" role="alert">
                  {deactivateBlockedReason}
                </div>
              ) : null}

              <div className="inv-warehouse-card__fact">
                <span className="inv-warehouse-card__fact-icon" aria-hidden="true">
                  <i className="bi bi-cart-check" />
                </span>
                <div className="inv-warehouse-card__fact-copy">
                  <span>Compras</span>
                  <strong>{formatMetricValue(proveedor.compras_count)}</strong>
                </div>
              </div>

              <div className="inv-warehouse-card__fact">
                <span className="inv-warehouse-card__fact-icon" aria-hidden="true">
                  <i className="bi bi-bank" />
                </span>
                <div className="inv-warehouse-card__fact-copy">
                  <span>Cuentas bancarias</span>
                  <strong>{formatMetricValue(proveedor.cuentas_bancarias_count)}</strong>
                </div>
              </div>

              <div className="inv-warehouse-card__fact">
                <span className="inv-warehouse-card__fact-icon" aria-hidden="true">
                  <i className="bi bi-calendar2-week" />
                </span>
                <div className="inv-warehouse-card__fact-copy">
                  <span>Plazo pago</span>
                  <strong>{formatMetricValue(proveedor.plazo_pago_dias)} dias</strong>
                </div>
              </div>
            </div>

            <div className="inv-warehouse-card__meta">
              <span className="inv-warehouse-card__meta-pill">
                <i className="bi bi-envelope" aria-hidden="true" />
                <span>Correo</span>
                <strong>{proveedor.correo_electronico || 'N/D'}</strong>
              </span>
              <span className="inv-warehouse-card__meta-pill">
                <i className="bi bi-telephone" aria-hidden="true" />
                <span>Telefono</span>
                <strong>{proveedor.telefono_principal || 'N/D'}</strong>
              </span>
              <span className="inv-warehouse-card__meta-pill">
                <i className="bi bi-file-earmark-text" aria-hidden="true" />
                <span>RTN</span>
                <strong>{proveedor.rtn || 'N/D'}</strong>
              </span>
            </div>

            <div className="inv-warehouse-card__footer">
              <div className="inv-warehouse-card__actions">
                <button
                  type="button"
                  className="btn inv-prod-btn-outline inv-warehouse-card__action"
                  onClick={(event) => {
                    event.stopPropagation();
                    openDetail(proveedor.id_proveedor);
                  }}
                >
                  <i className="bi bi-eye" />
                  <span>Detalle</span>
                </button>

                {canEditarProveedores ? (
                  <button
                    type="button"
                    className="btn inv-prod-btn-subtle inv-warehouse-card__action"
                    onClick={(event) => {
                      event.stopPropagation();
                      iniciarEdicion(proveedor);
                    }}
                  >
                    <i className="bi bi-pencil-square" />
                    <span>Editar</span>
                  </button>
                ) : null}

                {canRunProveedorAction(actionMeta.action) ? (
                  <button
                    type="button"
                    className={actionMeta.buttonClass}
                    title={actionMeta.title}
                    onClick={(event) => {
                      event.stopPropagation();
                      openConfirmDelete(proveedor, actionMeta.action);
                    }}
                    disabled={deletingConfirm || isResolvingAction || actionMeta.disabled}
                  >
                    <i className={`bi ${isResolvingAction ? 'bi-hourglass-split' : actionMeta.icon}`} />
                    <span>{isResolvingAction ? 'Validando...' : actionMeta.label}</span>
                  </button>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );

  const createModal =
    canCrearProveedores && modalPortalTarget && showCreateModal
      ? createPortal(
          <div className="inv-prod-pmodal inv-prod-pmodal--create show" aria-hidden={!showCreateModal}>
            <div className="inv-prod-pmodal__overlay" onClick={closeCreate} />
            <div className="inv-prod-pmodal__viewport">
              <div
                className="inv-prod-pmodal__panel inv-prod-pmodal__panel--create"
                role="dialog"
                aria-modal="true"
                aria-labelledby="inv-provider-create-title"
                onClick={(event) => event.stopPropagation()}
              >
                <form onSubmit={onCrear} className="inv-prod-pmodal__form-shell inv-prod-pmodal__form-shell--create">
                  <div className="inv-prod-pmodal__body">
                    <div className="inv-ins-create-hero is-create">
                      <button
                        type="button"
                        className="inv-prod-drawer-close inv-ins-create-hero__close"
                        onClick={closeCreate}
                        aria-label="Cerrar alta de proveedor"
                        disabled={savingCreate}
                      >
                        <i className="bi bi-x-lg" aria-hidden="true" />
                      </button>

                      <div className="inv-ins-create-hero__icon">
                        <i className="bi bi-truck" aria-hidden="true" />
                      </div>

                      <div className="inv-ins-create-hero__copy">
                        <div className="inv-ins-create-hero__kicker">Nuevo Registro</div>
                        <div id="inv-provider-create-title" className="inv-ins-create-hero__title">
                          Alta de proveedor
                        </div>
                        <div className="inv-ins-create-hero__text">
                          Formulario lineal y compacto con cuentas bancarias.
                        </div>
                      </div>
                    </div>

                    <div className="inv-prod-pmodal__sections">
                      <section className="inv-prod-pmodal__section">
                        <div className="inv-prod-pmodal__section-head">
                          <div className="inv-prod-pmodal__section-title">Datos generales</div>
                        </div>

                        <div className="row g-2">
                          <div className="col-12">
                            <label className="form-label mb-1">Nombre proveedor</label>
                            <input
                              className={`form-control ${createErrors.nombre_proveedor ? 'is-invalid' : ''}`}
                              value={form.nombre_proveedor}
                              onChange={(event) =>
                                setForm((current) => ({ ...current, nombre_proveedor: event.target.value }))
                              }
                              disabled={savingCreate}
                            />
                            {createErrors.nombre_proveedor ? (
                              <div className="invalid-feedback">{createErrors.nombre_proveedor}</div>
                            ) : null}
                          </div>

                          <div className="col-12">
                            <label className="form-label mb-1">Contacto principal</label>
                            <input
                              className={`form-control ${createErrors.contacto_principal ? 'is-invalid' : ''}`}
                              value={form.contacto_principal}
                              onChange={(event) =>
                                setForm((current) => ({ ...current, contacto_principal: event.target.value }))
                              }
                              disabled={savingCreate}
                            />
                            {createErrors.contacto_principal ? (
                              <div className="invalid-feedback">{createErrors.contacto_principal}</div>
                            ) : null}
                          </div>

                          <div className="col-12">
                            <label className="form-label mb-1">Correo electronico</label>
                            <input
                              className={`form-control ${createErrors.correo_electronico ? 'is-invalid' : ''}`}
                              value={form.correo_electronico}
                              onChange={(event) =>
                                setForm((current) => ({ ...current, correo_electronico: event.target.value }))
                              }
                              disabled={savingCreate}
                            />
                            {createErrors.correo_electronico ? (
                              <div className="invalid-feedback">{createErrors.correo_electronico}</div>
                            ) : null}
                          </div>

                          <div className="col-12">
                            <label className="form-label mb-1">Telefono principal</label>
                            <input
                              className={`form-control ${createErrors.telefono_principal ? 'is-invalid' : ''}`}
                              value={form.telefono_principal}
                              onChange={(event) =>
                                setForm((current) => ({ ...current, telefono_principal: event.target.value }))
                              }
                              disabled={savingCreate}
                            />
                            {createErrors.telefono_principal ? (
                              <div className="invalid-feedback">{createErrors.telefono_principal}</div>
                            ) : null}
                          </div>

                          <div className="col-12">
                            <label className="form-label mb-1">Telefono secundario</label>
                            <input
                              className={`form-control ${createErrors.telefono_secundario ? 'is-invalid' : ''}`}
                              value={form.telefono_secundario}
                              onChange={(event) =>
                                setForm((current) => ({ ...current, telefono_secundario: event.target.value }))
                              }
                              disabled={savingCreate}
                            />
                            {createErrors.telefono_secundario ? (
                              <div className="invalid-feedback">{createErrors.telefono_secundario}</div>
                            ) : null}
                          </div>

                          <div className="col-12">
                            <label className="form-label mb-1">Ciudad</label>
                            <input
                              className={`form-control ${createErrors.ciudad ? 'is-invalid' : ''}`}
                              value={form.ciudad}
                              onChange={(event) => setForm((current) => ({ ...current, ciudad: event.target.value }))}
                              disabled={savingCreate}
                            />
                            {createErrors.ciudad ? <div className="invalid-feedback">{createErrors.ciudad}</div> : null}
                          </div>

                          <div className="col-12">
                            <label className="form-label mb-1">Direccion</label>
                            <input
                              className={`form-control ${createErrors.direccion ? 'is-invalid' : ''}`}
                              value={form.direccion}
                              onChange={(event) =>
                                setForm((current) => ({ ...current, direccion: event.target.value }))
                              }
                              disabled={savingCreate}
                            />
                            {createErrors.direccion ? (
                              <div className="invalid-feedback">{createErrors.direccion}</div>
                            ) : null}
                          </div>

                          <div className="col-12">
                            <label className="form-label mb-1">RTN</label>
                            <input
                              className={`form-control ${createErrors.rtn ? 'is-invalid' : ''}`}
                              value={form.rtn}
                              onChange={(event) => setForm((current) => ({ ...current, rtn: event.target.value }))}
                              disabled={savingCreate}
                            />
                            {createErrors.rtn ? <div className="invalid-feedback">{createErrors.rtn}</div> : null}
                          </div>

                          <div className="col-12">
                            <label className="form-label mb-1">Plazo pago (dias)</label>
                            <input
                              type="number"
                              min="0"
                              className={`form-control ${createErrors.plazo_pago_dias ? 'is-invalid' : ''}`}
                              value={form.plazo_pago_dias}
                              onChange={(event) =>
                                setForm((current) => ({ ...current, plazo_pago_dias: event.target.value }))
                              }
                              disabled={savingCreate}
                            />
                            {createErrors.plazo_pago_dias ? (
                              <div className="invalid-feedback">{createErrors.plazo_pago_dias}</div>
                            ) : null}
                          </div>

                          <div className="col-12">
                            <label className="form-label mb-1">Observaciones</label>
                            <textarea
                              className={`form-control ${createErrors.observaciones ? 'is-invalid' : ''}`}
                              rows="3"
                              value={form.observaciones}
                              onChange={(event) =>
                                setForm((current) => ({ ...current, observaciones: event.target.value }))
                              }
                              disabled={savingCreate}
                            />
                            {createErrors.observaciones ? (
                              <div className="invalid-feedback">{createErrors.observaciones}</div>
                            ) : null}
                          </div>
                        </div>
                      </section>

                      {renderCuentaRows({
                        values: form.cuentas_bancarias,
                        errors: createErrors,
                        onChange: (index, patch) => updateCuentaList(setForm, index, patch),
                        onRemove: (index) => removeCuentaRow(setForm, index),
                        onAdd: () => addCuentaRow(setForm),
                        disabled: savingCreate
                      })}
                    </div>
                  </div>

                  <div className="inv-prod-pmodal__footer inv-prod-pmodal__footer--create">
                    <button
                      type="button"
                      className="btn inv-prod-btn-subtle"
                      onClick={resetCreateForm}
                      disabled={savingCreate}
                    >
                      Limpiar
                    </button>
                    <button
                      type="button"
                      className="btn inv-prod-btn-outline"
                      onClick={closeCreate}
                      disabled={savingCreate}
                    >
                      Cancelar
                    </button>
                    <button type="submit" className="btn inv-prod-btn-primary" disabled={savingCreate}>
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

  const detailModal = detailId ? (
    <div
      className="modal fade show"
      style={{ display: 'block', backgroundColor: 'rgba(17, 8, 10, 0.55)', zIndex: 2600 }}
      role="dialog"
      aria-modal="true"
      onClick={closeDetail}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg" onClick={(event) => event.stopPropagation()}>
        <div className="modal-content shadow inv-warehouse-detail-modal__body">
          <div className="modal-body">
            {detailLoading ? (
              <div className="text-center py-5 text-muted">Cargando detalle...</div>
            ) : (
              <>
                <div className="inv-warehouse-detail-modal__hero">
                  <div className="inv-warehouse-detail-modal__hero-main">
                    <p className="inv-warehouse-detail-modal__eyebrow">Detalle de proveedor</p>
                    <strong>{detailProveedor.nombre_proveedor || `Proveedor ${detailProveedor.id_proveedor}`}</strong>
                    <p>{detailProveedor.contacto_principal || detailProveedor.correo_electronico || 'Sin contacto definido'}</p>
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

                <div className="mt-3 border rounded-3 p-3 bg-light-subtle">
                  <div className="fw-semibold mb-2">Cuentas bancarias registradas</div>
                  {!detailProveedor.cuentas_bancarias?.length ? (
                    <div className="text-muted">Sin cuentas bancarias registradas.</div>
                  ) : (
                    <div className="d-flex flex-column gap-2">
                      {detailProveedor.cuentas_bancarias.map((cuenta, index) => (
                        <div key={cuenta._tmp_id || `${index}`} className="border rounded-3 p-2 bg-white">
                          <div className="d-flex flex-wrap gap-2 align-items-center mb-1">
                            <strong>{cuenta.banco || 'Banco no definido'}</strong>
                            <span className="badge text-bg-light border">{cuenta.tipo_cuenta}</span>
                            <span className="badge text-bg-light border">{cuenta.moneda}</span>
                            {cuenta.es_principal ? <span className="badge text-bg-success">Principal</span> : null}
                            {!parseEstado(cuenta.estado) ? <span className="badge text-bg-secondary">Inactiva</span> : null}
                          </div>
                          <div className="small">
                            <div>
                              <strong>Cuenta:</strong> {cuenta.numero_cuenta || 'N/D'}
                            </div>
                            <div>
                              <strong>Titular:</strong> {cuenta.nombre_titular || 'N/D'}
                            </div>
                            <div>
                              <strong>Identificacion:</strong> {cuenta.identificacion_titular || 'N/D'}
                            </div>
                            <div>
                              <strong>Observacion:</strong> {cuenta.observacion || 'N/D'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {detailActionMeta?.action === 'inactivar' && detailActionMeta?.disabled ? (
                  <div className="alert alert-warning mt-3 mb-0" role="alert">
                    {detailActionMeta.disabledReason}
                  </div>
                ) : null}

                {parseEstado(detailProveedor.estado) &&
                !detailProveedor.can_delete &&
                detailProveedor.can_deactivate ? (
                  <div className="alert alert-info mt-3 mb-0" role="status">
                    {PROVEEDORES_LIFECYCLE_INFO_MESSAGE}
                  </div>
                ) : null}
              </>
            )}
          </div>

          <div className="modal-footer inv-warehouse-detail-modal__footer">
            {canEditarProveedores ? (
              <button type="button" className="btn btn-light" onClick={() => iniciarEdicion(detailProveedor)}>
                Editar
              </button>
            ) : null}
            {detailActionMeta && canRunProveedorAction(detailActionMeta.action) ? (
              <button
                type="button"
                className={`btn ${
                  detailActionMeta.action === 'inactivar'
                    ? 'btn-outline-secondary'
                    : 'btn-outline-success'
                }`}
                title={detailActionMeta.title}
                onClick={() => openConfirmDelete(detailProveedor, detailActionMeta.action)}
                disabled={
                  Number(resolvingActionId ?? 0) === Number(detailProveedor?.id_proveedor ?? 0) ||
                  detailLoading ||
                  detailActionMeta.disabled
                }
              >
                {Number(resolvingActionId ?? 0) === Number(detailProveedor?.id_proveedor ?? 0)
                  ? 'Validando...'
                  : detailActionMeta.label}
              </button>
            ) : null}
            <button type="button" className="btn btn-primary" onClick={closeDetail}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  const editModal =
    canEditarProveedores && modalPortalTarget && showEditModal
      ? createPortal(
          <div className="inv-prod-pmodal inv-prod-pmodal--create show" aria-hidden={!showEditModal}>
            <div className="inv-prod-pmodal__overlay" onClick={cancelarEdicion} />
            <div className="inv-prod-pmodal__viewport">
              <div
                className="inv-prod-pmodal__panel inv-prod-pmodal__panel--create"
                role="dialog"
                aria-modal="true"
                aria-labelledby="inv-provider-edit-title"
                onClick={(event) => event.stopPropagation()}
              >
                {!editForm ? (
                  <div className="p-4 text-center text-muted">Cargando proveedor...</div>
                ) : (
                  <form onSubmit={guardarEdicion} className="inv-prod-pmodal__form-shell inv-prod-pmodal__form-shell--create">
                    <div className="inv-prod-pmodal__body">
                      <div className="inv-ins-create-hero is-edit">
                        <button
                          type="button"
                          className="inv-prod-drawer-close inv-ins-create-hero__close"
                          onClick={cancelarEdicion}
                          aria-label="Cerrar edicion"
                          disabled={savingEdit}
                        >
                          <i className="bi bi-x-lg" aria-hidden="true" />
                        </button>
                        <div className="inv-ins-create-hero__icon">
                          <i className="bi bi-truck-flatbed" aria-hidden="true" />
                        </div>
                        <div className="inv-ins-create-hero__copy">
                          <div className="inv-ins-create-hero__kicker">Edicion activa</div>
                          <div id="inv-provider-edit-title" className="inv-ins-create-hero__title">
                            Editar proveedor
                          </div>
                          <div className="inv-ins-create-hero__text">
                            Campos lineales y compactos con cuentas bancarias.
                          </div>
                        </div>
                      </div>

                      <div className="inv-prod-pmodal__sections">
                        <section className="inv-prod-pmodal__section">
                          <div className="inv-prod-pmodal__section-head">
                            <div className="inv-prod-pmodal__section-title">Datos generales</div>
                          </div>
                          {editErrors._concurrency ? (
                            <div className="alert alert-warning py-2 mb-3" role="alert">
                              {editErrors._concurrency}
                            </div>
                          ) : null}

                          <div className="row g-2">
                            <div className="col-12">
                              <label className="form-label mb-1">Nombre proveedor</label>
                              <input
                                className={`form-control ${editErrors.nombre_proveedor ? 'is-invalid' : ''}`}
                                value={editForm.nombre_proveedor}
                                onChange={(event) =>
                                  setEditForm((current) => ({ ...current, nombre_proveedor: event.target.value }))
                                }
                                disabled={savingEdit}
                              />
                              {editErrors.nombre_proveedor ? (
                                <div className="invalid-feedback">{editErrors.nombre_proveedor}</div>
                              ) : null}
                            </div>
                            <div className="col-12">
                              <label className="form-label mb-1">Contacto principal</label>
                              <input
                                className={`form-control ${editErrors.contacto_principal ? 'is-invalid' : ''}`}
                                value={editForm.contacto_principal}
                                onChange={(event) =>
                                  setEditForm((current) => ({ ...current, contacto_principal: event.target.value }))
                                }
                                disabled={savingEdit}
                              />
                              {editErrors.contacto_principal ? (
                                <div className="invalid-feedback">{editErrors.contacto_principal}</div>
                              ) : null}
                            </div>
                            <div className="col-12">
                              <label className="form-label mb-1">Correo electronico</label>
                              <input
                                className={`form-control ${editErrors.correo_electronico ? 'is-invalid' : ''}`}
                                value={editForm.correo_electronico}
                                onChange={(event) =>
                                  setEditForm((current) => ({ ...current, correo_electronico: event.target.value }))
                                }
                                disabled={savingEdit}
                              />
                              {editErrors.correo_electronico ? (
                                <div className="invalid-feedback">{editErrors.correo_electronico}</div>
                              ) : null}
                            </div>
                            <div className="col-12">
                              <label className="form-label mb-1">Telefono principal</label>
                              <input
                                className={`form-control ${editErrors.telefono_principal ? 'is-invalid' : ''}`}
                                value={editForm.telefono_principal}
                                onChange={(event) =>
                                  setEditForm((current) => ({ ...current, telefono_principal: event.target.value }))
                                }
                                disabled={savingEdit}
                              />
                              {editErrors.telefono_principal ? (
                                <div className="invalid-feedback">{editErrors.telefono_principal}</div>
                              ) : null}
                            </div>
                            <div className="col-12">
                              <label className="form-label mb-1">Telefono secundario</label>
                              <input
                                className={`form-control ${editErrors.telefono_secundario ? 'is-invalid' : ''}`}
                                value={editForm.telefono_secundario}
                                onChange={(event) =>
                                  setEditForm((current) => ({ ...current, telefono_secundario: event.target.value }))
                                }
                                disabled={savingEdit}
                              />
                              {editErrors.telefono_secundario ? (
                                <div className="invalid-feedback">{editErrors.telefono_secundario}</div>
                              ) : null}
                            </div>
                            <div className="col-12">
                              <label className="form-label mb-1">Ciudad</label>
                              <input
                                className={`form-control ${editErrors.ciudad ? 'is-invalid' : ''}`}
                                value={editForm.ciudad}
                                onChange={(event) => setEditForm((current) => ({ ...current, ciudad: event.target.value }))}
                                disabled={savingEdit}
                              />
                              {editErrors.ciudad ? <div className="invalid-feedback">{editErrors.ciudad}</div> : null}
                            </div>
                            <div className="col-12">
                              <label className="form-label mb-1">Direccion</label>
                              <input
                                className={`form-control ${editErrors.direccion ? 'is-invalid' : ''}`}
                                value={editForm.direccion}
                                onChange={(event) =>
                                  setEditForm((current) => ({ ...current, direccion: event.target.value }))
                                }
                                disabled={savingEdit}
                              />
                              {editErrors.direccion ? (
                                <div className="invalid-feedback">{editErrors.direccion}</div>
                              ) : null}
                            </div>
                            <div className="col-12">
                              <label className="form-label mb-1">RTN</label>
                              <input
                                className={`form-control ${editErrors.rtn ? 'is-invalid' : ''}`}
                                value={editForm.rtn}
                                onChange={(event) => setEditForm((current) => ({ ...current, rtn: event.target.value }))}
                                disabled={savingEdit}
                              />
                              {editErrors.rtn ? <div className="invalid-feedback">{editErrors.rtn}</div> : null}
                            </div>
                            <div className="col-12">
                              <label className="form-label mb-1">Plazo pago (dias)</label>
                              <input
                                type="number"
                                min="0"
                                className={`form-control ${editErrors.plazo_pago_dias ? 'is-invalid' : ''}`}
                                value={editForm.plazo_pago_dias}
                                onChange={(event) =>
                                  setEditForm((current) => ({ ...current, plazo_pago_dias: event.target.value }))
                                }
                                disabled={savingEdit}
                              />
                              {editErrors.plazo_pago_dias ? (
                                <div className="invalid-feedback">{editErrors.plazo_pago_dias}</div>
                              ) : null}
                            </div>
                            <div className="col-12">
                              <label className="form-label mb-1">Observaciones</label>
                              <textarea
                                className={`form-control ${editErrors.observaciones ? 'is-invalid' : ''}`}
                                rows="3"
                                value={editForm.observaciones}
                                onChange={(event) =>
                                  setEditForm((current) => ({ ...current, observaciones: event.target.value }))
                                }
                                disabled={savingEdit}
                              />
                              {editErrors.observaciones ? (
                                <div className="invalid-feedback">{editErrors.observaciones}</div>
                              ) : null}
                            </div>
                          </div>
                        </section>

                        {renderCuentaRows({
                          values: editForm.cuentas_bancarias,
                          errors: editErrors,
                          onChange: (index, patch) => updateCuentaList(setEditForm, index, patch),
                          onRemove: removeCuentaRowFromEdit,
                          onAdd: () => addCuentaRow(setEditForm),
                          disabled: savingEdit,
                          removedItems: editRemovedCuentas,
                          onRestoreRemoved: restoreRemovedCuentaForEdit
                        })}
                      </div>
                    </div>

                    <div className="inv-prod-pmodal__footer inv-prod-pmodal__footer--create">
                      <button
                        type="button"
                        className="btn inv-prod-btn-outline"
                        onClick={cancelarEdicion}
                        disabled={savingEdit}
                      >
                        Cancelar
                      </button>
                      <button type="submit" className="btn inv-prod-btn-primary" disabled={savingEdit}>
                        {savingEdit ? 'Guardando...' : 'Guardar cambios'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>,
          modalPortalTarget
        )
      : null;

  const confirmDeleteModal = confirmModal.show && canRunProveedorAction(confirmModal.action) ? (
    <div className="inv-pro-confirm-backdrop" role="dialog" aria-modal="true" onClick={closeConfirmDelete}>
      <div className="inv-pro-confirm-panel" onClick={(event) => event.stopPropagation()}>
        <div className="inv-pro-confirm-glow" aria-hidden="true" />

        <div className="inv-pro-confirm-head">
          <div className="inv-pro-confirm-head-main">
            <div className="inv-pro-confirm-head-icon">
              <i className={`bi ${confirmCopy.actionIcon}`} aria-hidden="true" />
            </div>
            <div className="inv-pro-confirm-head-copy">
              <div className="inv-pro-confirm-kicker">Proveedores</div>
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
              {`Dependencias: compras ${confirmModal.counts.compras ?? 0}, ordenes referenciadas ${
                confirmModal.counts.ordenes_historial ?? 0
              }, ordenes activas ${confirmModal.counts.ordenes_activas ?? 0}, cuentas bancarias ${
                confirmModal.counts.cuentas_bancarias ?? 0
              }`}
            </div>
          ) : null}

          {Array.isArray(confirmModal.blockingReasons) && confirmModal.blockingReasons.length > 0 ? (
            <div className="small text-muted mb-2">
              {`Motivos de bloqueo: ${confirmModal.blockingReasons.join(' | ')}`}
            </div>
          ) : null}

          <div className="inv-pro-confirm-question">{confirmCopy.question}</div>
          <div className="inv-pro-confirm-name">
            <div className="inv-pro-confirm-name-label">Registro seleccionado</div>
            <div className="inv-pro-confirm-name-value">
              <i className="bi bi-truck" aria-hidden="true" />
              <span>{confirmModal.nombre || confirmProveedor?.nombre_proveedor || 'Proveedor seleccionado'}</span>
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
              confirmModal.action === 'reactivar'
                ? 'btn-success'
                : 'btn-warning'
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

  if (permisosLoading) return null;

  if (!canAccessProveedoresTab || !canVerProveedores) {
    return <SinPermiso permiso={PERMISSIONS.INVENTARIO_PROVEEDORES_VER} />;
  }

  return (
    <>
      <div className="card shadow-sm mb-3 inv-prod-card inv-ins-module inv-has-sticky-header inv-warehouse-module">
        <div className="card-header inv-prod-header inv-cat-v3__header">
          <div className="inv-cat-v3__layout">
            <div className="inv-cat-v3__title">
              <div className="inv-prod-title-wrap">
                <div className="inv-prod-title-row">
                  <i className="bi bi-truck inv-prod-title-icon" aria-hidden="true" />
                  <span className="inv-prod-title">Proveedores</span>
                </div>
                <div className="inv-prod-subtitle">Gestion visual de proveedores para compras e inventario</div>
              </div>
            </div>

            <div className="inv-cat-v3__switch-slot">
              <CompactHeaderSwitch
                value="proveedores"
                onChange={(nextScope) => {
                  if (typeof onScopeChange === 'function') onScopeChange(nextScope);
                }}
                leftValue="almacenes"
                rightValue="proveedores"
                leftLabel="ALMACENES"
                rightLabel="PROVEEDORES"
                ariaLabel="Cambiar vista de almacenes y proveedores"
              />
            </div>

            <label className="inv-ins-search inv-prod-header-search inv-cat-v3__search" aria-label="Buscar proveedores">
              <i className="bi bi-search" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar proveedor..."
              />
            </label>

            <div className="inv-prod-header-actions inv-ins-header-actions inv-cat-v3__actions-stack">
              <div className="form-check form-switch m-0 d-flex align-items-center justify-content-center gap-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="inv-provider-show-inactive"
                  checked={showInactivos}
                  onChange={(event) => setShowInactivos(event.target.checked)}
                  disabled={loading}
                />
                <label className="form-check-label small mb-0" htmlFor="inv-provider-show-inactive">
                  Mostrar inactivos
                </label>
              </div>
              {canCrearProveedores ? (
                <button type="button" className="inv-prod-toolbar-btn inv-cat-v3__new-btn" onClick={openCreate}>
                  <i className="bi bi-plus-circle" aria-hidden="true" />
                  <span>Nuevo proveedor</span>
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

          <div className="inv-warehouse-results-meta">
            Total Proveedores: <strong>{proveedores.length}</strong>
          </div>

          {cardsContent}

          <div className="inv-warehouse-moves mt-3">
            <div className="inv-warehouse-moves__header">
              <div className="inv-warehouse-moves__header-top">
                <div className="inv-warehouse-moves__title-wrap">
                  <div className="inv-warehouse-moves__title-row">
                    <i className="bi bi-activity" aria-hidden="true" />
                    <h3 className="inv-warehouse-moves__title">Actividad del proveedor seleccionado</h3>
                  </div>
                </div>
              </div>
            </div>

            {selectedProveedor ? (
              <>
                <div className="inv-warehouse-moves__summary-grid">
                  <article className="inv-warehouse-summary-card inv-invstat-card is-entry">
                    <span className="inv-warehouse-summary-card__icon">
                      <i className="bi bi-cart-check" aria-hidden="true" />
                    </span>
                    <div className="inv-warehouse-summary-card__copy">
                      <span>Compras asociadas</span>
                      <strong>{formatMetricValue(selectedProveedor.compras_count)}</strong>
                    </div>
                  </article>
                  <article className="inv-warehouse-summary-card inv-invstat-card is-adjust">
                    <span className="inv-warehouse-summary-card__icon">
                      <i className="bi bi-bank" aria-hidden="true" />
                    </span>
                    <div className="inv-warehouse-summary-card__copy">
                      <span>Cuentas bancarias</span>
                      <strong>{formatMetricValue(selectedProveedor.cuentas_bancarias_count)}</strong>
                    </div>
                  </article>
                  <article className="inv-warehouse-summary-card inv-invstat-card is-exit">
                    <span className="inv-warehouse-summary-card__icon">
                      <i className="bi bi-calendar2-week" aria-hidden="true" />
                    </span>
                    <div className="inv-warehouse-summary-card__copy">
                      <span>Plazo de pago</span>
                      <strong>{formatMetricValue(selectedProveedor.plazo_pago_dias)} dias</strong>
                    </div>
                  </article>
                </div>

                <div className="inv-warehouse-moves__filters-shell">
                  <div className="inv-warehouse-moves__filters-main">
                    <div className="inv-warehouse-moves__field">
                      <label>Proveedor</label>
                      <div className="form-control bg-light">
                        {selectedProveedor.nombre_proveedor || `Proveedor ${selectedProveedor.id_proveedor}`}
                      </div>
                    </div>
                    <div className="inv-warehouse-moves__field">
                      <label>Contacto</label>
                      <div className="form-control bg-light">{selectedProveedor.contacto_principal || 'N/D'}</div>
                    </div>
                    <div className="inv-warehouse-moves__field">
                      <label>Estado</label>
                      <div className="form-control bg-light">{getProveedorStatusMeta(selectedProveedor).label}</div>
                    </div>
                    <div className="inv-warehouse-moves__field">
                      <label>Correo</label>
                      <div className="form-control bg-light">{selectedProveedor.correo_electronico || 'N/D'}</div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="inv-warehouse-moves__empty">
                <i className="bi bi-info-circle" aria-hidden="true" />
                <div>Selecciona un proveedor para ver su actividad.</div>
              </div>
            )}
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

export default ProveedoresTab;
