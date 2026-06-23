import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../../../hooks/useAuth';
import { usePermisos } from '../../../../../context/PermisosContext';
import sucursalesService from '../../../../../services/sucursalesService';
import cajasService from '../../../../../services/cajasService';
import { normalizeRoles, PERMISSIONS } from '../../../../../utils/permissions';
import VentasToast from '../VentasToast';
import { useCierresCaja } from '../../hooks/useCierresCaja';
import { matchesCajaSession } from '../../utils/cajasHelpers';
import CierresCajaOverview from './CierresCajaOverview';
import CierresCajaList from './CierresCajaList';
import { getPaginatedRows } from './CierresCajaPagination';
import CierreCajaDetalleModal from './CierreCajaDetalleModal';
import CierreCajaAbrirModal from './CierreCajaAbrirModal';
import CierreCajaArqueoModal from './CierreCajaArqueoModal';
import CierreCajaCerrarModal from './CierreCajaCerrarModal';
import CierreCajaMovimientoManualModal from './CierreCajaMovimientoManualModal';
import '../../../fidelizacion/styles/fidelizacion.css';
import '../../styles/cierres-caja.css';

const buildScopeQuery = (value) => {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? { id_sucursal: parsed } : {};
};

const isTruthyState = (value) =>
  value === true || value === 'true' || value === 1 || value === '1';

const CIERRES_CAJA_PAGE_SIZE = 6;

const toPositiveId = (value) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeMiCajaSession = (row) => {
  const idSesion = toPositiveId(row?.id_sesion_caja);
  if (!idSesion) return null;
  return {
    id_sesion_caja: idSesion,
    estado_codigo: String(row?.estado_codigo || 'ABIERTA').trim().toUpperCase(),
    fecha_apertura: row?.fecha_apertura || null,
    monto_apertura: Number(row?.monto_apertura ?? 0) || 0
  };
};

const normalizeMiCajaAsignacion = (row) => {
  const idCaja = toPositiveId(row?.id_caja);
  if (!idCaja) return null;
  const estadoOperativo = String(row?.estado_operativo || '').trim().toUpperCase();
  return {
    id_caja: idCaja,
    codigo_caja: String(row?.codigo_caja || '').trim(),
    nombre_caja: String(row?.nombre_caja || '').trim(),
    id_sucursal: toPositiveId(row?.id_sucursal),
    nombre_sucursal: String(row?.nombre_sucursal || '').trim(),
    puede_abrir: row?.puede_abrir !== false,
    puede_operar: row?.puede_operar !== false,
    estado_operativo: estadoOperativo,
    caja_abierta_por_otro_responsable:
      Boolean(row?.caja_abierta_por_otro_responsable) ||
      estadoOperativo === 'ABIERTA_POR_OTRO_RESPONSABLE',
    sesion_abierta: normalizeMiCajaSession(row?.sesion_abierta),
    sesion_activa: normalizeMiCajaSession(row)
  };
};

const isCajaAsignacionNotFound = (error) => {
  const code = String(error?.code || error?.data?.code || '').trim().toUpperCase();
  return Number(error?.status || 0) === 404 && code === 'CAJA_ASIGNACION_NO_ENCONTRADA';
};

const resolveMiCajaError = (error, fallback = 'No se pudo consultar tu caja asignada.') => {
  const status = Number(error?.status || 0);
  const code = String(error?.code || error?.data?.code || '').trim().toUpperCase();
  const message = String(error?.message || '').trim();
  if (code === 'CAJA_ASIGNACION_NO_ENCONTRADA') {
    return 'No tienes una caja asignada activa. Solicita asignación a un administrador.';
  }
  if (code === 'CAJA_SESION_ABIERTA_POR_OTRO_RESPONSABLE') {
    return 'La caja asignada ya tiene una sesión abierta por otro responsable.';
  }
  if (status === 403) return 'No tienes permiso para operar esta caja.';
  if (status >= 500) return 'No se pudo consultar tu caja asignada por un error del servidor.';
  return message || fallback;
};

const extractUserRoleNames = (user) => {
  const roleRows = Array.isArray(user?.roles) ? user.roles : [];
  const candidates = [
    user?.rol,
    user?.role,
    user?.rol_codigo,
    user?.codigo_rol,
    user?.rol_nombre,
    user?.nombre_rol,
    ...roleRows.flatMap((role) => {
      if (!role || typeof role !== 'object') return [role];
      return [
        role.codigo,
        role.codigo_rol,
        role.rol,
        role.role,
        role.nombre,
        role.nombre_rol,
        role.name
      ];
    })
  ];

  return normalizeRoles(candidates.filter(Boolean));
};

export default function CierresCajaView() {
  const { user } = useAuth();
  const { canAny, isSuperAdmin } = usePermisos();
  const {
    catalogos,
    sesionActiva,
    sesiones,
    stats,
    loadingCatalogos,
    loadingSesiones,
    detailLoading,
    saving,
    error,
    toast,
    openToast,
    closeToast,
    loadCatalogos,
    loadSesionActiva,
    loadSesiones,
    getSesionDetalle,
    openSesion,
    createCajaCatalogo,
    closeSesion,
    validateCloseSesion,
    createMiSesionMovimientoManual,
    createArqueo,
    resolveCloseDifference,
    listUsuariosOperativos,
    listCajaCatalogo
  } = useCierresCaja();

  const [selectedSucursalId, setSelectedSucursalId] = useState('');
  const [scopeInitialized, setScopeInitialized] = useState(false);
  const [sucursales, setSucursales] = useState([]);
  const [loadingSucursales, setLoadingSucursales] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    id_estado_sesion_caja: '',
    fecha_desde: '',
    fecha_hasta: ''
  });
  const [selectedSesion, setSelectedSesion] = useState(null);
  const [selectedDetalle, setSelectedDetalle] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [openCajaOpen, setOpenCajaOpen] = useState(false);
  const [openCajaMode, setOpenCajaMode] = useState('existente');
  const [arqueoOpen, setArqueoOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [movimientoManualOpen, setMovimientoManualOpen] = useState(false);
  const [movimientoManualContext, setMovimientoManualContext] = useState(null);
  const [movimientoManualTipoInicial, setMovimientoManualTipoInicial] = useState('INGRESO');
  const [sessionsPage, setSessionsPage] = useState(1);
  const [cierreMovementInvalidationKey, setCierreMovementInvalidationKey] = useState(0);
  const [cierreMovementInvalidationMessage, setCierreMovementInvalidationMessage] = useState('');
  const [usuariosOperativos, setUsuariosOperativos] = useState([]);
  const [loadingUsuariosOperativos, setLoadingUsuariosOperativos] = useState(false);
  const [cajasOperativas, setCajasOperativas] = useState([]);
  const [loadingCajasOperativas, setLoadingCajasOperativas] = useState(false);
  const [miAsignacionCaja, setMiAsignacionCaja] = useState(null);
  const [loadingMiAsignacionCaja, setLoadingMiAsignacionCaja] = useState(false);
  const [miAsignacionCajaMissing, setMiAsignacionCajaMissing] = useState(false);
  const [miAsignacionCajaError, setMiAsignacionCajaError] = useState('');
  const [cajeroOpenSaving, setCajeroOpenSaving] = useState(false);
  const usuariosRequestIdRef = useRef(0);
  const cajasRequestIdRef = useRef(0);
  const miAsignacionRequestIdRef = useRef(0);
  const usuariosBySucursalRef = useRef(new Map());
  const cajasBySucursalRef = useRef(new Map());

  const userSucursalId = Number.parseInt(String(user?.id_sucursal ?? ''), 10);
  const roleSet = useMemo(() => new Set(extractUserRoleNames(user)), [user]);
  const isCajero = roleSet.has('CAJERO');
  const isAdminRole = roleSet.has('ADMIN') || roleSet.has('ADMINISTRADOR') || roleSet.has('SUPER_ADMIN');
  const hasCajaAdminPermissions = canAny([
    PERMISSIONS.VENTAS_CAJAS_MULTISUCURSAL_VER,
    PERMISSIONS.VENTAS_CAJAS_PARTICIPANTES_GESTIONAR,
    PERMISSIONS.VENTAS_CAJAS_DIFERENCIA_RESOLVER
  ]);
  const isRestrictedCajero = isCajero && !isSuperAdmin && !isAdminRole;
  const isCashierOnly = isRestrictedCajero && !hasCajaAdminPermissions;
  const canViewCajaTheoreticalAmounts = !isCashierOnly;

  const canSelectSucursal =
    isSuperAdmin || canAny([PERMISSIONS.VENTAS_CAJAS_MULTISUCURSAL_VER]);
  const canViewDetail = canAny([
    PERMISSIONS.VENTAS_CAJAS_DETALLE_VER,
    PERMISSIONS.VENTAS_CAJAS_REPORTE_VER
  ]);
  const canCloseSession = canAny([PERMISSIONS.VENTAS_CAJAS_SESION_CERRAR]);
  const canRegisterArqueo = canAny([PERMISSIONS.VENTAS_CAJAS_ARQUEO_REGISTRAR]);
  const hasMovimientoPermission = canAny([PERMISSIONS.VENTAS_CAJAS_MOVIMIENTO_MANUAL_REGISTRAR]);
  const hasActiveCajaSession = Boolean(sesionActiva?.id_sesion_caja);
  const canAccessMovimientoManual = hasMovimientoPermission || isCashierOnly;
  const canRegisterMovimientoManual = hasActiveCajaSession && canAccessMovimientoManual;
  const canOpenSession = canAny([PERMISSIONS.VENTAS_CAJAS_SESION_ABRIR]);
  const canResolveDifference =
    (isSuperAdmin || isAdminRole) && canAny([PERMISSIONS.VENTAS_CAJAS_DIFERENCIA_RESOLVER]);
  const canUseCloseFlow = canCloseSession;
  const canListSesiones = canAny([
    PERMISSIONS.VENTAS_CAJAS_LISTADO_VER,
    PERMISSIONS.VENTAS_CAJAS_DETALLE_VER,
    PERMISSIONS.VENTAS_CAJAS_REPORTE_VER
  ]);

  const deferredSearch = useDeferredValue(filters.search);
  const scopeQuery = useMemo(
    () => (canSelectSucursal ? buildScopeQuery(selectedSucursalId) : {}),
    [canSelectSucursal, selectedSucursalId]
  );

  const visibleSesiones = useMemo(
    () => sesiones.filter((session) => matchesCajaSession(session, deferredSearch)),
    [deferredSearch, sesiones]
  );
  const sessionsPageData = useMemo(
    () => getPaginatedRows(visibleSesiones, sessionsPage, CIERRES_CAJA_PAGE_SIZE),
    [sessionsPage, visibleSesiones]
  );

  useEffect(() => {
    setSessionsPage(1);
  }, [
    deferredSearch,
    filters.fecha_desde,
    filters.fecha_hasta,
    filters.id_estado_sesion_caja,
    selectedSucursalId
  ]);

  useEffect(() => {
    if (scopeInitialized) return;
    if (Number.isInteger(userSucursalId) && userSucursalId > 0) {
      setSelectedSucursalId(String(userSucursalId));
      setScopeInitialized(true);
      return;
    }
    setScopeInitialized(true);
  }, [scopeInitialized, userSucursalId]);

  useEffect(() => {
    if (!canSelectSucursal) return undefined;

    let ignore = false;
    const loadBranchCatalog = async () => {
      setLoadingSucursales(true);
      try {
        const response = await sucursalesService.getAll();
        if (ignore) return;
        const rows = (Array.isArray(response) ? response : [])
          .filter((row) => isTruthyState(row?.estado))
          .map((row) => ({
            id_sucursal: Number(row?.id_sucursal ?? 0) || null,
            nombre_sucursal: String(row?.nombre_sucursal ?? '').trim()
          }))
          .filter((row) => row.id_sucursal && row.nombre_sucursal)
          .sort((a, b) =>
            a.nombre_sucursal.localeCompare(b.nombre_sucursal, 'es', { sensitivity: 'base' })
          );
        setSucursales(rows);
      } catch {
        if (!ignore) {
          // El hook principal ya cubre toasts de negocio; esta carga solo afecta filtros.
        }
      } finally {
        if (!ignore) setLoadingSucursales(false);
      }
    };

    void loadBranchCatalog();
    return () => {
      ignore = true;
    };
  }, [canSelectSucursal]);

  useEffect(() => {
    const hasOverlay = detailOpen || openCajaOpen || arqueoOpen || closeOpen || movimientoManualOpen;
    if (!hasOverlay) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [arqueoOpen, closeOpen, detailOpen, movimientoManualOpen, openCajaOpen]);

  useEffect(() => {
    if (!scopeInitialized) return;

    void Promise.all([loadCatalogos(scopeQuery), loadSesionActiva(scopeQuery)]);
  }, [loadCatalogos, loadSesionActiva, scopeInitialized, scopeQuery]);

  useEffect(() => {
    if (!scopeInitialized || !canListSesiones) return;

    const query = {
      ...scopeQuery,
      ...(filters.id_estado_sesion_caja ? { id_estado_sesion_caja: filters.id_estado_sesion_caja } : {}),
      ...(filters.fecha_desde ? { fecha_desde: filters.fecha_desde } : {}),
      ...(filters.fecha_hasta ? { fecha_hasta: filters.fecha_hasta } : {})
    };

    void loadSesiones(query);
  }, [
    filters.fecha_desde,
    filters.fecha_hasta,
    filters.id_estado_sesion_caja,
    canListSesiones,
    loadSesiones,
    scopeInitialized,
    scopeQuery
  ]);

  const isOpenCajaSession = (sesion) =>
    String(sesion?.estado_codigo || '').trim().toUpperCase() === 'ABIERTA';

  const ensureDetalle = async (sesion, options = {}) => {
    const targetSession = sesion || selectedSesion;
    if (!targetSession?.id_sesion_caja) return null;
    const detail = await getSesionDetalle(targetSession.id_sesion_caja, options);
    setSelectedDetalle(detail);
    return detail;
  };

  const refreshCurrentScope = async () => {
    const query = {
      ...scopeQuery,
      ...(filters.id_estado_sesion_caja ? { id_estado_sesion_caja: filters.id_estado_sesion_caja } : {}),
      ...(filters.fecha_desde ? { fecha_desde: filters.fecha_desde } : {}),
      ...(filters.fecha_hasta ? { fecha_hasta: filters.fecha_hasta } : {})
    };

    await Promise.all([
      loadSesionActiva(scopeQuery),
      loadSesiones(query)
    ]);
  };

  const handleResolveDifference = async (payload) => {
    const idCierreCaja = selectedDetalle?.cierre?.id_cierre_caja;
    if (!idCierreCaja) return null;
    const response = await resolveCloseDifference(idCierreCaja, payload);
    await refreshCurrentScope();
    await ensureDetalle(selectedSesion || selectedDetalle?.sesion, { contexto: 'DETALLE' });
    return response;
  };

  const loadMiAsignacionCaja = useCallback(async () => {
    const requestId = miAsignacionRequestIdRef.current + 1;
    miAsignacionRequestIdRef.current = requestId;
    setLoadingMiAsignacionCaja(true);
    setMiAsignacionCajaError('');
    setMiAsignacionCajaMissing(false);

    try {
      const response = await cajasService.getMiAsignacionActiva();
      if (miAsignacionRequestIdRef.current !== requestId) return;
      setMiAsignacionCaja(normalizeMiCajaAsignacion(response));
      setMiAsignacionCajaMissing(false);
      setMiAsignacionCajaError('');
    } catch (errorResponse) {
      if (miAsignacionRequestIdRef.current !== requestId) return;
      setMiAsignacionCaja(null);
      if (isCajaAsignacionNotFound(errorResponse)) {
        setMiAsignacionCajaMissing(true);
        setMiAsignacionCajaError('');
      } else {
        setMiAsignacionCajaMissing(false);
        setMiAsignacionCajaError(resolveMiCajaError(errorResponse));
      }
    } finally {
      if (miAsignacionRequestIdRef.current === requestId) {
        setLoadingMiAsignacionCaja(false);
      }
    }
  }, []);

  const openDetalle = async (sesion) => {
    if (isRestrictedCajero && isOpenCajaSession(sesion)) {
      openToast(
        'DETALLE NO DISPONIBLE',
        'El detalle estará disponible cuando la caja esté cerrada.',
        'warning'
      );
      return;
    }

    setSelectedSesion(sesion);
    setSelectedDetalle(null);
    setDetailOpen(true);

    try {
      await ensureDetalle(sesion, { contexto: 'DETALLE' });
    } catch {
      setDetailOpen(false);
      setSelectedSesion(null);
      setSelectedDetalle(null);
    }
  };

  const openArqueo = async (sesion) => {
    setSelectedSesion(sesion);
    setArqueoOpen(true);

    if (!selectedDetalle || selectedDetalle?.sesion?.id_sesion_caja !== sesion?.id_sesion_caja) {
      try {
        await ensureDetalle(sesion, { contexto: 'ARQUEO' });
      } catch {
        setArqueoOpen(false);
      }
    }
  };

  const openCerrar = async (sesion) => {
    setSelectedSesion(sesion);
    setCloseOpen(true);

    if (!selectedDetalle || selectedDetalle?.sesion?.id_sesion_caja !== sesion?.id_sesion_caja) {
      try {
        await ensureDetalle(sesion, { contexto: 'CIERRE' });
      } catch {
        setCloseOpen(false);
      }
    }
  };

  const handleOpenAbrirSesion = async () => {
    setOpenCajaMode('existente');

    if (!isRestrictedCajero) {
      setOpenCajaOpen(true);
      return;
    }

    const requestId = miAsignacionRequestIdRef.current + 1;
    miAsignacionRequestIdRef.current = requestId;
    setLoadingMiAsignacionCaja(true);
    setMiAsignacionCaja(null);
    setMiAsignacionCajaMissing(false);
    setMiAsignacionCajaError('');

    try {
      const response = await cajasService.getMiAsignacionActiva();
      if (miAsignacionRequestIdRef.current !== requestId) return;
      const assignedCaja = normalizeMiCajaAsignacion(response);
      if (!assignedCaja?.id_caja) {
        setMiAsignacionCajaMissing(true);
        openToast(
          'CAJA NO ASIGNADA',
          'No tienes una caja asignada. Solicita a un administrador que te asigne una caja antes de abrir sesión.',
          'warning'
        );
        return;
      }
      setMiAsignacionCaja(assignedCaja);
      setOpenCajaOpen(true);
    } catch (errorResponse) {
      if (miAsignacionRequestIdRef.current !== requestId) return;
      setMiAsignacionCaja(null);
      if (isCajaAsignacionNotFound(errorResponse)) {
        setMiAsignacionCajaMissing(true);
        openToast(
          'CAJA NO ASIGNADA',
          'No tienes una caja asignada. Solicita a un administrador que te asigne una caja antes de abrir sesión.',
          'warning'
        );
        return;
      }
      const message = resolveMiCajaError(errorResponse, 'No se pudo consultar tu caja asignada.');
      setMiAsignacionCajaError(message);
      openToast('ERROR', message, 'danger');
    } finally {
      if (miAsignacionRequestIdRef.current === requestId) {
        setLoadingMiAsignacionCaja(false);
      }
    }
  };

  const handleSubmitArqueo = async (payload) => {
    if (!selectedSesion?.id_sesion_caja) return;
    await createArqueo(selectedSesion.id_sesion_caja, payload);
    const [, detail] = await Promise.all([
      refreshCurrentScope(),
      ensureDetalle(selectedSesion, { contexto: 'ARQUEO' })
    ]);
    setArqueoOpen(false);

    const selectedType = (catalogos.tipos_arqueo || []).find(
      (item) => Number(item?.id_tipo_arqueo_caja) === Number(payload?.id_tipo_arqueo_caja)
    );
    const isClosingArqueo = String(selectedType?.codigo || '').trim().toUpperCase() === 'CIERRE';
    if (isClosingArqueo) {
      setSelectedDetalle(detail || selectedDetalle);
      setCloseOpen(true);
    }
  };

  const handleSubmitClose = async (payload) => {
    if (!selectedSesion?.id_sesion_caja) return;
    await closeSesion(selectedSesion.id_sesion_caja, payload, { silent: true });
    const [, detail] = await Promise.all([
      refreshCurrentScope(),
      ensureDetalle(selectedSesion, { contexto: 'CIERRE', force: true })
    ]);
    if (detail?.sesion) setSelectedSesion(detail.sesion);
    setCloseOpen(false);
  };

  const openMovimientoManual = (context = {}) => {
    if (!hasActiveCajaSession) {
      openToast(
        'SESIÓN REQUERIDA',
        'Debes tener una sesión activa para registrar movimientos manuales. Abre una sesión de caja asignada antes de registrar ingresos o egresos.',
        'warning'
      );
      return;
    }
    setMovimientoManualContext({
      ...context,
      sesion: context?.sesion || selectedSesion || sesionActiva
    });
    setMovimientoManualTipoInicial(context?.tipoInicial === 'EGRESO' ? 'EGRESO' : 'INGRESO');
    setMovimientoManualOpen(true);
  };

  const handleSubmitMovimientoManual = async ({ tipo, monto, observacion, referencia }) => {
    const normalizedTipo = tipo === 'EGRESO' ? 'EGRESO' : 'INGRESO';
    const source = movimientoManualContext?.source;
    await createMiSesionMovimientoManual(
      normalizedTipo,
      { monto, observacion, referencia },
      { silent: Boolean(source === 'cierre') }
    );
    await refreshCurrentScope();
    if (selectedSesion?.id_sesion_caja) {
      await ensureDetalle(selectedSesion, { contexto: source === 'cierre' ? 'CIERRE' : 'OPERACION' });
    }
    setMovimientoManualOpen(false);
    setMovimientoManualContext(null);
    setCierreMovementInvalidationKey((current) => current + 1);
    setCierreMovementInvalidationMessage('Movimiento registrado. Revisa diferencias nuevamente.');
    if (source === 'cierre') {
      openToast('MOVIMIENTO REGISTRADO', 'Movimiento registrado. Revisa diferencias nuevamente.', 'success');
    } else {
      openToast(
        normalizedTipo === 'EGRESO' ? 'EGRESO REGISTRADO' : 'INGRESO REGISTRADO',
        normalizedTipo === 'EGRESO' ? 'Egreso registrado correctamente.' : 'Ingreso registrado correctamente.',
        'success'
      );
    }
  };

  const handleSubmitOpenSession = async (payload) => {
    if (isRestrictedCajero) {
      setCajeroOpenSaving(true);
      try {
        const response = await cajasService.abrirMiSesion({
          monto_apertura: Number(payload?.monto_apertura ?? 0),
          observacion_apertura: payload?.observacion_apertura || null
        });
        openToast(
          'SESIÓN ABIERTA',
          response?.message || 'Sesión de caja abierta correctamente.',
          'success'
        );
        await refreshCurrentScope();
        setOpenCajaOpen(false);
      } catch (errorResponse) {
        openToast('ERROR', resolveMiCajaError(errorResponse, 'No se pudo abrir la sesión de caja.'), 'danger');
      } finally {
        setCajeroOpenSaving(false);
      }
      return;
    }

    try {
      await openSesion(payload);
      await refreshCurrentScope();
      setOpenCajaOpen(false);
    } catch {
      // El hook muestra toast; evitamos uncaught promise en el modal.
    }
  };

  const handleSubmitCreateCaja = async (payload) => {
    try {
      await createCajaCatalogo(payload);
      await Promise.all([
        loadCatalogos(scopeQuery),
        refreshCurrentScope()
      ]);
      setOpenCajaOpen(false);
    } catch {
      // El hook muestra toast; evitamos uncaught promise en el modal.
    }
  };

  const handleRequestUsuarios = useCallback(async (idSucursal, rolOperativo = 'AUXILIAR') => {
    const idSucursalParsed = Number.parseInt(String(idSucursal || ''), 10);
    const rolOperativoNormalized = String(rolOperativo || 'AUXILIAR').trim().toUpperCase() || 'AUXILIAR';
    if (!Number.isInteger(idSucursalParsed) || idSucursalParsed <= 0) {
      setUsuariosOperativos([]);
      setLoadingUsuariosOperativos(false);
      return;
    }

    const cacheKey = `${idSucursalParsed}:${rolOperativoNormalized}`;
    const cached = usuariosBySucursalRef.current.get(cacheKey);
    if (cached) {
      setUsuariosOperativos(cached);
      setLoadingUsuariosOperativos(false);
      return;
    }

    const requestId = usuariosRequestIdRef.current + 1;
    usuariosRequestIdRef.current = requestId;
    setLoadingUsuariosOperativos(true);
    try {
      const response = await listUsuariosOperativos({
        id_sucursal: idSucursalParsed,
        rol_operativo: rolOperativoNormalized
      });
      if (usuariosRequestIdRef.current !== requestId) return;
      const rows = Array.isArray(response) ? response : [];
      usuariosBySucursalRef.current.set(cacheKey, rows);
      setUsuariosOperativos(rows);
    } catch {
      if (usuariosRequestIdRef.current !== requestId) return;
      setUsuariosOperativos([]);
    } finally {
      if (usuariosRequestIdRef.current === requestId) {
        setLoadingUsuariosOperativos(false);
      }
    }
  }, [listUsuariosOperativos]);

  const handleRequestCajas = useCallback(async (idSucursal) => {
    const idSucursalParsed = Number.parseInt(String(idSucursal || ''), 10);
    if (!Number.isInteger(idSucursalParsed) || idSucursalParsed <= 0) {
      setCajasOperativas([]);
      setLoadingCajasOperativas(false);
      return;
    }

    const cached = cajasBySucursalRef.current.get(idSucursalParsed);
    if (cached) {
      setCajasOperativas(cached);
      setLoadingCajasOperativas(false);
      return;
    }

    const requestId = cajasRequestIdRef.current + 1;
    cajasRequestIdRef.current = requestId;
    setLoadingCajasOperativas(true);
    try {
      const response = await listCajaCatalogo({ id_sucursal: idSucursalParsed });
      if (cajasRequestIdRef.current !== requestId) return;
      const rows = (Array.isArray(response) ? response : []).filter(
        (row) => row && row.id_caja && row.estado !== false
      );
      cajasBySucursalRef.current.set(idSucursalParsed, rows);
      setCajasOperativas(rows);
    } catch {
      if (cajasRequestIdRef.current !== requestId) return;
      setCajasOperativas([]);
    } finally {
      if (cajasRequestIdRef.current === requestId) {
        setLoadingCajasOperativas(false);
      }
    }
  }, [listCajaCatalogo]);

  useEffect(() => {
    if (openCajaOpen) return;
    usuariosRequestIdRef.current += 1;
    cajasRequestIdRef.current += 1;
    miAsignacionRequestIdRef.current += 1;
    setLoadingUsuariosOperativos(false);
    setLoadingCajasOperativas(false);
    setLoadingMiAsignacionCaja(false);
    setUsuariosOperativos([]);
    setCajasOperativas([]);
    setMiAsignacionCaja(null);
    setMiAsignacionCajaMissing(false);
    setMiAsignacionCajaError('');
    setCajeroOpenSaving(false);
  }, [openCajaOpen]);

  useEffect(() => {
    if (!openCajaOpen || openCajaMode !== 'existente' || !isRestrictedCajero) return;
    if (loadingMiAsignacionCaja || miAsignacionCaja || miAsignacionCajaMissing || miAsignacionCajaError) return;
    void loadMiAsignacionCaja();
  }, [
    isRestrictedCajero,
    loadMiAsignacionCaja,
    loadingMiAsignacionCaja,
    miAsignacionCaja,
    miAsignacionCajaError,
    miAsignacionCajaMissing,
    openCajaMode,
    openCajaOpen
  ]);

  return (
    <>
      <div className="cierres-caja-page ventas-page d-flex flex-column gap-3 h-100 min-h-0">
        <CierresCajaOverview
          stats={stats}
          loading={loadingCatalogos || loadingSesiones}
          hideKpis={false}
          canViewCajaTheoreticalAmounts={canViewCajaTheoreticalAmounts}
          canSelectSucursal={canSelectSucursal}
          selectedSucursalId={selectedSucursalId}
          sucursales={sucursales}
          loadingSucursales={loadingSucursales}
          estadosSesion={catalogos.estados_sesion}
          filters={filters}
          onFiltersChange={setFilters}
          onSucursalChange={setSelectedSucursalId}
          onRefresh={refreshCurrentScope}
          canOpenSession={canOpenSession}
          canRegisterMovimientoManual={canRegisterMovimientoManual}
          canAccessMovimientoManual={canAccessMovimientoManual}
          hasActiveCajaSession={hasActiveCajaSession}
          supportsCajaCatalogCreate={false}
          onOpenAbrirSesion={handleOpenAbrirSesion}
          onOpenMovimientoManual={() => openMovimientoManual({ source: 'toolbar', tipoInicial: 'INGRESO' })}
          onOpenNuevaCaja={() => {}}
        />

        <CierresCajaList
          sesiones={sessionsPageData.rows}
          loading={loadingSesiones}
          error={error}
          totalSesiones={sessionsPageData.total}
          currentPage={sessionsPageData.page}
          pageSize={sessionsPageData.pageSize}
          totalPages={sessionsPageData.totalPages}
          onPageChange={setSessionsPage}
          canViewDetail={canViewDetail}
          canCloseSession={canCloseSession}
          canRegisterArqueo={canRegisterArqueo}
          canUseCloseFlow={canUseCloseFlow}
          canViewCajaTheoreticalAmounts={canViewCajaTheoreticalAmounts}
          onOpenDetalle={openDetalle}
          onOpenArqueo={openArqueo}
          onOpenCerrar={openCerrar}
        />
      </div>

      <CierreCajaDetalleModal
        open={detailOpen}
        detalle={selectedDetalle}
        loading={detailLoading}
        canRegisterArqueo={canRegisterArqueo}
        canCloseSession={canCloseSession}
        canUseCloseFlow={canUseCloseFlow}
        canViewCajaTheoreticalAmounts={canViewCajaTheoreticalAmounts}
        canResolveDifference={canResolveDifference}
        saving={saving}
        onClose={() => {
          setDetailOpen(false);
          setSelectedSesion(null);
          setSelectedDetalle(null);
        }}
        onOpenArqueo={openArqueo}
        onOpenCerrar={openCerrar}
        onResolveDifference={handleResolveDifference}
      />

      <CierreCajaAbrirModal
        key={openCajaOpen ? 'abrir-caja-open' : 'abrir-caja-closed'}
        open={openCajaOpen}
        mode={openCajaMode}
        cajasDisponibles={cajasOperativas}
        loadingCajas={loadingCajasOperativas}
        saving={saving || cajeroOpenSaving}
        canSelectSucursal={canSelectSucursal}
        selectedSucursalId={selectedSucursalId}
        sucursales={sucursales}
        usuariosDisponibles={usuariosOperativos}
        loadingUsuarios={loadingUsuariosOperativos}
        isSuperAdmin={isSuperAdmin}
        currentUser={user}
        useAssignedCajaOnly={isRestrictedCajero}
        assignedCaja={miAsignacionCaja}
        loadingAssignedCaja={loadingMiAsignacionCaja}
        assignedCajaMissing={miAsignacionCajaMissing}
        assignedCajaError={miAsignacionCajaError}
        assignedCajaSessionActive={Boolean(miAsignacionCaja?.id_sesion_caja || miAsignacionCaja?.sesion_activa?.id_sesion_caja)}
        onRequestCajas={handleRequestCajas}
        onRequestUsuarios={handleRequestUsuarios}
        onClose={() => setOpenCajaOpen(false)}
        onSubmitOpenSesion={handleSubmitOpenSession}
        onSubmitCreateCaja={handleSubmitCreateCaja}
      />

      <CierreCajaArqueoModal
        key={arqueoOpen ? `arqueo-${selectedSesion?.id_sesion_caja || 'none'}` : 'arqueo-closed'}
        open={arqueoOpen}
        sesion={selectedSesion}
        detalle={selectedDetalle}
        tiposArqueo={catalogos.tipos_arqueo}
        saving={saving}
        canViewCajaTheoreticalAmounts={canViewCajaTheoreticalAmounts}
        onClose={() => setArqueoOpen(false)}
        onSubmit={handleSubmitArqueo}
      />

      <CierreCajaCerrarModal
        key={closeOpen ? `cierre-${selectedSesion?.id_sesion_caja || 'none'}` : 'cierre-closed'}
        open={closeOpen}
        sesion={selectedSesion}
        currentUser={user}
        detalle={selectedDetalle}
        resoluciones={catalogos.resoluciones_cierre}
        saving={saving}
        canResolveDifference={canResolveDifference}
        canViewCajaTheoreticalAmounts={canViewCajaTheoreticalAmounts}
        onClose={() => setCloseOpen(false)}
        onSubmit={handleSubmitClose}
        onValidate={async (payload, options) => {
          if (!selectedSesion?.id_sesion_caja) return null;
          return validateCloseSesion(selectedSesion.id_sesion_caja, payload, options);
        }}
        onOpenMovimientoManual={(context) => openMovimientoManual(context)}
        externalInvalidationKey={cierreMovementInvalidationKey}
        externalInvalidationMessage={cierreMovementInvalidationMessage}
      />

      <CierreCajaMovimientoManualModal
        key={movimientoManualOpen ? `movimiento-${movimientoManualTipoInicial}` : 'movimiento-closed'}
        open={movimientoManualOpen}
        saving={saving}
        sesion={movimientoManualContext?.sesion || selectedSesion || sesionActiva}
        tipoInicial={movimientoManualTipoInicial}
        onClose={() => {
          if (saving) return;
          setMovimientoManualOpen(false);
          setMovimientoManualContext(null);
        }}
        onSubmit={handleSubmitMovimientoManual}
      />

      <VentasToast toast={toast} onClose={closeToast} />
    </>
  );
}
