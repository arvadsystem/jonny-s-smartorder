import { useCallback, useEffect, useRef, useState } from 'react';
import VentaComposerCatalog from './VentaComposerCatalog';
import VentaComposerSummary from './VentaComposerSummary';
import { useVentaComposer } from '../hooks/useVentaComposer';
import cajasService from '../../../../services/cajasService';
import VentaCajaAbrirSesionModal from './VentaCajaAbrirSesionModal';
import VentaCajaAperturaDecisionModal from './VentaCajaAperturaDecisionModal';
import VentaCajaAutoAuxiliarModal from './VentaCajaAutoAuxiliarModal';
import VentaComplementosModal from './VentaComplementosModal';
import VentaFinalizarOperacionModal from './VentaFinalizarOperacionModal';
import VentaRegistrarPagoPedidoModal from './VentaRegistrarPagoPedidoModal';
import ventasService from '../../../../services/ventasService';
import { useAuth } from '../../../../hooks/useAuth';
import AppSelect from '../../../../components/common/AppSelect';

const resolvePendientesErrorMessage = (error) => {
  const status = Number(error?.status || 0);
  const message = String(error?.message || '').trim();
  if (status === 403) return 'No tienes permiso para ver pendientes de esta sucursal.';
  if (status === 404 || (status === 400 && /id de venta invalido/i.test(message))) {
    return 'Endpoint de pendientes no disponible.';
  }
  if (status >= 500) return 'No se pudieron cargar los pendientes por un error del servidor.';
  return message ? `No se pudieron cargar los pendientes: ${message}` : 'No se pudieron cargar los pendientes.';
};

const CAJA_APERTURA_DISMISS_PREFIX = 'jonny:ventas:caja-apertura-decision-dismissed';
const CAJA_ASIGNACION_CACHE_MS = 30000;
const CAJA_SESIONES_ABIERTAS_CACHE_MS = 15000;

const toPositiveId = (value) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const buildCajaUserKey = (user) => {
  const idUsuario = toPositiveId(user?.id_usuario);
  if (idUsuario) return `id:${idUsuario}`;

  const nombreUsuario = String(
    user?.nombre_usuario || user?.usuario || user?.username || user?.correo || user?.email || ''
  ).trim();
  return nombreUsuario ? `usuario:${nombreUsuario.toLowerCase()}` : 'anon';
};

const isTimedCacheFresh = (entry, key, ttlMs) =>
  Boolean(entry && entry.key === key && Date.now() - Number(entry.at || 0) < ttlMs);

const formatDateTime = (value) => {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-HN', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
};

const buildCajaDismissKey = (assignment, userKey) => {
  const idCaja = toPositiveId(assignment?.id_caja);
  const scopedUserKey = String(userKey || 'anon').trim() || 'anon';
  return idCaja
    ? `${CAJA_APERTURA_DISMISS_PREFIX}:${scopedUserKey}:${idCaja}`
    : `${CAJA_APERTURA_DISMISS_PREFIX}:${scopedUserKey}`;
};

const isCajaDecisionDismissed = (assignment, userKey) => {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(buildCajaDismissKey(assignment, userKey)) === '1';
  } catch {
    return false;
  }
};

const markCajaDecisionDismissed = (assignment, userKey) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(buildCajaDismissKey(assignment, userKey), '1');
  } catch {
    // Session storage puede estar deshabilitado.
  }
};

const clearCajaDecisionDismissed = (assignment, userKey) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(buildCajaDismissKey(assignment, userKey));
  } catch {
    // Session storage puede estar deshabilitado.
  }
};

const normalizeCajaSession = (row) => {
  const idSesion = toPositiveId(row?.id_sesion_caja);
  if (!idSesion) return null;
  return {
    id_sesion_caja: idSesion,
    id_caja: toPositiveId(row?.id_caja),
    id_sucursal: toPositiveId(row?.id_sucursal),
    codigo_caja: String(row?.codigo_caja || '').trim(),
    nombre_caja: String(row?.nombre_caja || '').trim(),
    nombre_sucursal: String(row?.nombre_sucursal || '').trim(),
    rol_codigo: String(row?.rol_codigo || row?.rol_participacion || '').trim().toUpperCase(),
    rol_participacion: String(row?.rol_participacion || row?.rol_codigo || '').trim().toUpperCase(),
    id_usuario_responsable: toPositiveId(row?.id_usuario_responsable),
    responsable_usuario: String(row?.responsable_usuario || '').trim(),
    responsable_nombre: String(row?.responsable_nombre || '').trim(),
    estado_codigo: String(row?.estado_codigo || 'ABIERTA').trim().toUpperCase(),
    fecha_apertura: row?.fecha_apertura || null,
    monto_apertura: Number(row?.monto_apertura ?? 0) || 0
  };
};

const normalizeCajaAssignment = (row) => {
  const idCaja = toPositiveId(row?.id_caja);
  if (!idCaja) return null;
  const session = normalizeCajaSession(row);
  const sessionAbierta = normalizeCajaSession(row?.sesion_abierta);
  const estadoOperativo = String(row?.estado_operativo || '').trim().toUpperCase();
  return {
    id_caja: idCaja,
    codigo_caja: String(row?.codigo_caja || '').trim(),
    nombre_caja: String(row?.nombre_caja || '').trim(),
    id_sucursal: toPositiveId(row?.id_sucursal),
    nombre_sucursal: String(row?.nombre_sucursal || '').trim(),
    puede_responsable: Boolean(row?.puede_responsable),
    puede_auxiliar: Boolean(row?.puede_auxiliar),
    puede_abrir: row?.puede_abrir !== false,
    puede_operar: row?.puede_operar !== false,
    rol_participacion: String(row?.rol_participacion || '').trim().toUpperCase(),
    id_participacion_caja: toPositiveId(row?.id_participacion_caja),
    estado_operativo: estadoOperativo,
    caja_abierta_por_otro_responsable:
      Boolean(row?.caja_abierta_por_otro_responsable) ||
      estadoOperativo === 'ABIERTA_POR_OTRO_RESPONSABLE',
    sesion_abierta: sessionAbierta,
    ...(session || {})
  };
};

const buildCajaAssignmentFromSession = (session) => {
  if (!session?.id_sesion_caja || !session?.id_caja) return null;
  const role = String(session.rol_participacion || '').trim().toUpperCase();
  return normalizeCajaAssignment({
    ...session,
    estado_operativo: 'SESION_ACTIVA_USUARIO',
    puede_operar: true,
    puede_abrir: false,
    puede_responsable: role === 'RESPONSABLE',
    puede_auxiliar: role !== 'RESPONSABLE'
  });
};

const resolveCajaAssignmentLabel = (assignment) => {
  if (!assignment) return '';
  return assignment.nombre_caja || assignment.codigo_caja || `Caja #${assignment.id_caja}`;
};

const resolveCajaRoleLabel = (session) => {
  const role = String(session?.rol_codigo || session?.rol_participacion || '').trim().toUpperCase();
  if (role === 'RESPONSABLE') return 'Responsable';
  if (role === 'AUXILIAR') return 'Auxiliar';
  return 'Operador';
};

const isCajaAssignmentNotFound = (error) => {
  const code = String(error?.code || error?.data?.code || '').trim().toUpperCase();
  return Number(error?.status || 0) === 404 && code === 'CAJA_ASIGNACION_NO_ENCONTRADA';
};

const resolveCajaOpenErrorMessage = (error, fallback = 'No se pudo abrir la sesión de caja.') => {
  const status = Number(error?.status || 0);
  const code = String(error?.code || error?.data?.code || '').trim().toUpperCase();
  const message = String(error?.message || '').trim();

  if (status === 403) return 'No tienes permiso para abrir esta caja asignada.';
  if (code === 'CAJA_ASIGNACION_NO_ENCONTRADA') return 'No tienes una caja activa asignada.';
  if (code === 'CAJA_SESION_USUARIO_YA_ABIERTA') return 'Ya tienes una sesión de caja abierta.';
  if (code === 'CAJA_SESION_ABIERTA_POR_OTRO_RESPONSABLE') return 'La caja asignada ya tiene una sesión abierta por otro responsable.';
  if (status >= 500) return 'No se pudo abrir la sesión por un error del servidor.';
  return message || fallback;
};

const resolveCajaAssignmentErrorMessage = (error) => {
  const status = Number(error?.status || 0);
  const message = String(error?.message || '').trim();

  if (status === 403) return 'No tienes permiso para consultar tu caja asignada.';
  if (status >= 500) return 'No se pudo consultar tu caja asignada por un error del servidor.';
  return message || 'No se pudo consultar tu caja asignada.';
};

export default function CajaView({
  sucursales,
  isSuperAdmin,
  defaultSucursalId,
  productos,
  categorias,
  tiposDepartamento,
  clientes,
  combos,
  recetas,
  descuentosCatalogo,
  canApplyDiscount,
  catalogLoading,
  catalogErrors,
  saving,
  onSubmit,
  onCreatePedidoPendiente,
  onRegistrarPagoPedido,
  onCatalogSucursalChange,
  onClientesRefresh,
  onNotify
}) {
  const { user } = useAuth();
  const cajaUserKey = buildCajaUserKey(user);
  const hasCajaUser = Boolean(user);

  const toSafeMessage = (error, fallback) => {
    if (String(error?.code || '').trim().toUpperCase() === 'AUTO_AUXILIAR_ENDPOINT_UNAVAILABLE') {
      return 'No se pudo registrar porque esta función aún no está habilitada en el backend en ejecución. Reinicia el backend actualizado.';
    }
    const raw = String(error?.message || '').trim();
    if (!raw) return fallback;
    if (raw.includes('<!DOCTYPE html') || raw.includes('<html')) return fallback;
    return raw;
  };

  const normalizeOpenSessions = (rows) =>
    (Array.isArray(rows) ? rows : []).map((row) => ({
      id_sesion_caja: row.id_sesion_caja,
      id_caja: row.id_caja,
      id_sucursal: row.id_sucursal,
      codigo_caja: row.codigo_caja,
      nombre_caja: row.nombre_caja,
      nombre_sucursal: row.nombre_sucursal,
      estado_codigo: row.estado_codigo || 'ABIERTA',
      rol_participacion: row.rol_participacion,
      responsable_nombre: row.responsable_nombre,
      fecha_apertura: row.fecha_apertura
    }));

  const [autoModalOpen, setAutoModalOpen] = useState(false);
  const [autoModalLoading, setAutoModalLoading] = useState(false);
  const [autoModalAssigning, setAutoModalAssigning] = useState(false);
  const [autoModalError, setAutoModalError] = useState('');
  const [sesionesAbiertas, setSesionesAbiertas] = useState([]);
  const [selectedSesion, setSelectedSesion] = useState('');
  const [finalizarOpen, setFinalizarOpen] = useState(false);
  const [registrarPagoOpen, setRegistrarPagoOpen] = useState(false);
  const [deliveryCostPreview, setDeliveryCostPreview] = useState(0);
  const [pendientesSummary, setPendientesSummary] = useState({
    loading: false,
    error: '',
    total: 0,
    monto: 0
  });
  const [cajaAsignacion, setCajaAsignacion] = useState(null);
  const [cajaSesionActiva, setCajaSesionActiva] = useState(null);
  const [cajaStatus, setCajaStatus] = useState({
    loading: false,
    error: '',
    assignmentMissing: false
  });
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [abrirSesionOpen, setAbrirSesionOpen] = useState(false);
  const [abrirSesionSaving, setAbrirSesionSaving] = useState(false);
  const [abrirSesionError, setAbrirSesionError] = useState('');
  const [creatingPedidoPendiente, setCreatingPedidoPendiente] = useState(false);
  const [registrandoPagoPedido, setRegistrandoPagoPedido] = useState(false);
  const [statusExpanded, setStatusExpanded] = useState(false);
  const [cartSheetOpen, setCartSheetOpen] = useState(false);
  const composerRef = useRef(null);
  const cajaAsignacionRequestRef = useRef(0);
  const cajaAsignacionCacheRef = useRef({ key: '', at: 0, status: 'idle' });
  const cajaAsignacionInFlightRef = useRef(null);
  const sesionesAbiertasCacheRef = useRef({ key: '', at: 0, rows: [] });
  const sesionesAbiertasInFlightRef = useRef(null);
  const creatingPedidoPendienteRef = useRef(false);
  const registrandoPagoPedidoRef = useRef(false);
  const catalogSucursalRequestRef = useRef('');

  const openAutoAuxiliarForSucursal = async ({ idSucursal, force = false }) => {
    if (!isSuperAdmin) return;
    const normalizedSucursalId = toPositiveId(idSucursal);
    if (!normalizedSucursalId) return;

    const cacheKey = `sucursal:${normalizedSucursalId}`;
    setAutoModalError('');
    setAutoModalOpen(true);

    const cached = sesionesAbiertasCacheRef.current;
    if (!force && isTimedCacheFresh(cached, cacheKey, CAJA_SESIONES_ABIERTAS_CACHE_MS)) {
      const rows = cached.rows || [];
      setSesionesAbiertas(rows);
      setSelectedSesion(rows.length > 0 ? String(rows[0].id_sesion_caja) : '');
      if (rows.length === 0) {
        setAutoModalError('No hay cajas activas con sesión abierta para la sucursal seleccionada.');
      }
      return;
    }

    setAutoModalLoading(true);
    try {
      let rows;
      const inFlight = sesionesAbiertasInFlightRef.current;
      if (inFlight?.key === cacheKey) {
        rows = await inFlight.promise;
      } else {
        const promise = cajasService
          .listSesionesAbiertasSafe({ id_sucursal: normalizedSucursalId })
          .then((response) => normalizeOpenSessions(response));
        sesionesAbiertasInFlightRef.current = { key: cacheKey, promise };
        rows = await promise;
      }

      sesionesAbiertasCacheRef.current = { key: cacheKey, at: Date.now(), rows };

      setSesionesAbiertas(rows);
      setSelectedSesion(rows.length > 0 ? String(rows[0].id_sesion_caja) : '');
      if (rows.length === 0) {
        setAutoModalError('No hay cajas activas con sesión abierta para la sucursal seleccionada.');
      }
    } catch (error) {
      setSesionesAbiertas([]);
      setSelectedSesion('');
      setAutoModalError(toSafeMessage(error, 'No se pudieron cargar sesiones abiertas.'));
    } finally {
      if (sesionesAbiertasInFlightRef.current?.key === cacheKey) {
        sesionesAbiertasInFlightRef.current = null;
      }
      setAutoModalLoading(false);
    }
  };

  const composer = useVentaComposer({
    productos,
    categorias,
    tiposDepartamento,
    clientes,
    combos,
    recetas,
    descuentosCatalogo,
    canApplyDiscount,
    sucursales,
    isSuperAdmin,
    defaultSucursalId,
    onSubmit,
    onRequireAutoAuxiliar: openAutoAuxiliarForSucursal
  });
  composerRef.current = composer;

  useEffect(() => {
    if (!isSuperAdmin) return;
    const selectedSucursalId = toPositiveId(composer.selectedSucursalId || composer.selectedSucursal);
    if (!selectedSucursalId) return;

    const key = `sucursal:${selectedSucursalId}`;
    if (catalogSucursalRequestRef.current === key) return;
    catalogSucursalRequestRef.current = key;

    void onCatalogSucursalChange?.({ id_sucursal: selectedSucursalId });
  }, [
    composer.selectedSucursal,
    composer.selectedSucursalId,
    isSuperAdmin,
    onCatalogSucursalChange
  ]);

  const syncComposerSession = useCallback((session) => {
    const idSesionCaja = toPositiveId(session?.id_sesion_caja);
    composerRef.current?.setTemporarySessionId(idSesionCaja ? String(idSesionCaja) : '');
  }, []);

  const loadCajaAsignada = useCallback(async () => {
    const cacheKey = `asignacion:${cajaUserKey}`;
    const cached = cajaAsignacionCacheRef.current;
    if (isTimedCacheFresh(cached, cacheKey, CAJA_ASIGNACION_CACHE_MS)) {
      const cachedAssignment = cached.assignment || null;
      const cachedSession = cached.session || null;
      setCajaAsignacion(cachedAssignment);
      setCajaSesionActiva(cachedSession);
      syncComposerSession(cachedSession);
      setCajaStatus({
        loading: false,
        error: cached.error || '',
        assignmentMissing: cached.status === 'missing'
      });
      setDecisionOpen(false);
      return;
    }

    const currentInFlight = cajaAsignacionInFlightRef.current;
    if (currentInFlight?.key === cacheKey && currentInFlight.requestId === cajaAsignacionRequestRef.current) {
      try {
        await currentInFlight.promise;
      } catch {
        // La primera llamada es la responsable de reflejar el error controlado en pantalla.
      }
      return;
    }

    const requestId = cajaAsignacionRequestRef.current + 1;
    cajaAsignacionRequestRef.current = requestId;
    const isCurrentRequest = () => cajaAsignacionRequestRef.current === requestId;

    setCajaStatus({ loading: true, error: '', assignmentMissing: false });

    const requestPromise = (async () => {
      const response = await cajasService.getMiAsignacionActiva();
      const assignment = normalizeCajaAssignment(response);
      const session = normalizeCajaSession(response);
      if (!isCurrentRequest()) return;

      setCajaAsignacion(assignment);
      setCajaSesionActiva(session);
      syncComposerSession(session);
      const blockedByOther = Boolean(assignment?.caja_abierta_por_otro_responsable);
      const blockedCannotOpen = assignment && !session && assignment.puede_abrir === false && !blockedByOther;
      const statusError = blockedByOther
        ? 'La caja asignada ya tiene una sesión abierta por otro responsable.'
        : blockedCannotOpen
          ? 'Tu caja asignada no permite apertura en este momento.'
          : '';
      cajaAsignacionCacheRef.current = {
        key: cacheKey,
        at: Date.now(),
        status: 'active',
        assignment,
        session,
        error: statusError
      };
      setCajaStatus({ loading: false, error: statusError, assignmentMissing: false });

      if (assignment && !session && !blockedByOther && !blockedCannotOpen) {
        setDecisionOpen(true);
      } else {
        setDecisionOpen(false);
      }
    })();

    cajaAsignacionInFlightRef.current = { key: cacheKey, requestId, promise: requestPromise };

    try {
      await requestPromise;
    } catch (error) {
      if (!isCurrentRequest()) return;

      if (isCajaAssignmentNotFound(error)) {
        cajaAsignacionCacheRef.current = {
          key: cacheKey,
          at: Date.now(),
          status: 'missing',
          assignment: null,
          session: null,
          error: ''
        };
        setCajaAsignacion(null);
        setCajaSesionActiva(null);
        syncComposerSession(null);
        setCajaStatus({ loading: false, error: '', assignmentMissing: true });
        setDecisionOpen(false);
        setAbrirSesionOpen(false);
        setAbrirSesionError('');
        return;
      }

      if (import.meta.env.DEV) {
        console.warn('[Ventas] No se pudo consultar la caja asignada activa', {
          status: error?.status,
          code: error?.code,
          message: error?.message
        });
      }
      setCajaAsignacion(null);
      setCajaSesionActiva(null);
      syncComposerSession(null);
      setCajaStatus({
        loading: false,
        error: resolveCajaAssignmentErrorMessage(error),
        assignmentMissing: false
      });
      setDecisionOpen(false);
      setAbrirSesionOpen(false);
      setAbrirSesionError('');
    } finally {
      const inFlight = cajaAsignacionInFlightRef.current;
      if (inFlight?.key === cacheKey && inFlight.requestId === requestId) {
        cajaAsignacionInFlightRef.current = null;
      }
    }
  }, [cajaUserKey, syncComposerSession]);

  const loadCajaSesionOperativa = useCallback(async (idSucursal) => {
    const normalizedSucursalId = toPositiveId(idSucursal);
    if (!normalizedSucursalId) {
      setCajaAsignacion(null);
      setCajaSesionActiva(null);
      syncComposerSession(null);
      setCajaStatus({ loading: false, error: '', assignmentMissing: true });
      setDecisionOpen(false);
      setAbrirSesionOpen(false);
      setAbrirSesionError('');
      return;
    }

    const cacheKey = `sesion:${cajaUserKey}:sucursal:${normalizedSucursalId}`;
    const cached = cajaAsignacionCacheRef.current;
    if (isTimedCacheFresh(cached, cacheKey, CAJA_ASIGNACION_CACHE_MS)) {
      const cachedAssignment = cached.assignment || null;
      const cachedSession = cached.session || null;
      setCajaAsignacion(cachedAssignment);
      setCajaSesionActiva(cachedSession);
      syncComposerSession(cachedSession);
      setCajaStatus({
        loading: false,
        error: cached.error || '',
        assignmentMissing: cached.status === 'missing'
      });
      setDecisionOpen(false);
      setAbrirSesionOpen(false);
      setAbrirSesionError('');
      return;
    }

    const currentInFlight = cajaAsignacionInFlightRef.current;
    if (currentInFlight?.key === cacheKey && currentInFlight.requestId === cajaAsignacionRequestRef.current) {
      try {
        await currentInFlight.promise;
      } catch {
        // La llamada activa ya refleja el resultado en pantalla.
      }
      return;
    }

    const requestId = cajaAsignacionRequestRef.current + 1;
    cajaAsignacionRequestRef.current = requestId;
    const isCurrentRequest = () => cajaAsignacionRequestRef.current === requestId;

    setCajaStatus({ loading: true, error: '', assignmentMissing: false });

    const requestPromise = (async () => {
      const response = await cajasService.getMiSesionActiva({ id_sucursal: normalizedSucursalId });
      const session = normalizeCajaSession(response?.session);
      const belongsToSelectedSucursal = !session || Number(session.id_sucursal) === Number(normalizedSucursalId);
      if (!isCurrentRequest()) return;

      if (response?.activa && session && belongsToSelectedSucursal) {
        const assignment = buildCajaAssignmentFromSession(session);
        cajaAsignacionCacheRef.current = {
          key: cacheKey,
          at: Date.now(),
          status: 'active',
          assignment,
          session,
          error: ''
        };
        setCajaAsignacion(assignment);
        setCajaSesionActiva(session);
        syncComposerSession(session);
        setCajaStatus({ loading: false, error: '', assignmentMissing: false });
        setDecisionOpen(false);
        setAbrirSesionOpen(false);
        setAbrirSesionError('');
        return;
      }

      cajaAsignacionCacheRef.current = {
        key: cacheKey,
        at: Date.now(),
        status: 'missing',
        assignment: null,
        session: null,
        error: ''
      };
      setCajaAsignacion(null);
      setCajaSesionActiva(null);
      syncComposerSession(null);
      setCajaStatus({ loading: false, error: '', assignmentMissing: true });
      setDecisionOpen(false);
      setAbrirSesionOpen(false);
      setAbrirSesionError('');
    })();

    cajaAsignacionInFlightRef.current = { key: cacheKey, requestId, promise: requestPromise };

    try {
      await requestPromise;
    } catch (error) {
      if (!isCurrentRequest()) return;

      if (import.meta.env.DEV) {
        console.warn('[Ventas] No se pudo consultar la sesion operativa de caja', {
          status: error?.status,
          code: error?.code,
          message: error?.message
        });
      }
      setCajaAsignacion(null);
      setCajaSesionActiva(null);
      syncComposerSession(null);
      setCajaStatus({
        loading: false,
        error: resolveCajaAssignmentErrorMessage(error),
        assignmentMissing: false
      });
      setDecisionOpen(false);
      setAbrirSesionOpen(false);
      setAbrirSesionError('');
    } finally {
      const inFlight = cajaAsignacionInFlightRef.current;
      if (inFlight?.key === cacheKey && inFlight.requestId === requestId) {
        cajaAsignacionInFlightRef.current = null;
      }
    }
  }, [cajaUserKey, syncComposerSession]);

  useEffect(() => {
    if (!hasCajaUser) {
      cajaAsignacionRequestRef.current += 1;
      setCajaAsignacion(null);
      setCajaSesionActiva(null);
      syncComposerSession(null);
      setCajaStatus({ loading: false, error: '', assignmentMissing: false });
      setDecisionOpen(false);
      setAbrirSesionOpen(false);
      setAbrirSesionError('');
      return undefined;
    }

    if (isSuperAdmin) return undefined;

    setCajaAsignacion(null);
    setCajaSesionActiva(null);
    syncComposerSession(null);
    setDecisionOpen(false);
    setAbrirSesionOpen(false);
    setAbrirSesionError('');
    void loadCajaAsignada();
    return () => {
      cajaAsignacionRequestRef.current += 1;
    };
  }, [cajaUserKey, hasCajaUser, isSuperAdmin, loadCajaAsignada, syncComposerSession]);

  useEffect(() => {
    if (!hasCajaUser || !isSuperAdmin) return undefined;

    const selectedSucursalId = toPositiveId(composer.selectedSucursalId || composer.selectedSucursal);
    cajaAsignacionRequestRef.current += 1;
    setCajaAsignacion(null);
    setCajaSesionActiva(null);
    syncComposerSession(null);
    setDecisionOpen(false);
    setAbrirSesionOpen(false);
    setAbrirSesionError('');

    void loadCajaSesionOperativa(selectedSucursalId);

    return () => {
      cajaAsignacionRequestRef.current += 1;
    };
  }, [
    cajaUserKey,
    composer.selectedSucursal,
    composer.selectedSucursalId,
    hasCajaUser,
    isSuperAdmin,
    loadCajaSesionOperativa,
    syncComposerSession
  ]);

  useEffect(() => {
    if (!isSuperAdmin || !cajaSesionActiva?.id_sesion_caja) return;
    const selectedSucursalId = toPositiveId(composer.selectedSucursalId || composer.selectedSucursal);
    const sessionSucursalId = toPositiveId(cajaSesionActiva.id_sucursal);
    if (!selectedSucursalId || !sessionSucursalId || selectedSucursalId === sessionSucursalId) return;

    setCajaAsignacion(null);
    setCajaSesionActiva(null);
    syncComposerSession(null);
    setCajaStatus({ loading: false, error: '', assignmentMissing: true });
  }, [
    cajaSesionActiva?.id_sesion_caja,
    cajaSesionActiva?.id_sucursal,
    composer.selectedSucursal,
    composer.selectedSucursalId,
    isSuperAdmin,
    syncComposerSession
  ]);

  useEffect(() => {
    const hasBlockingModal = decisionOpen || abrirSesionOpen || finalizarOpen || registrarPagoOpen || autoModalOpen || cartSheetOpen;
    if (!hasBlockingModal || typeof document === 'undefined') return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [abrirSesionOpen, autoModalOpen, cartSheetOpen, decisionOpen, finalizarOpen, registrarPagoOpen]);

  useEffect(() => {
    if (!cartSheetOpen || typeof window === 'undefined') return undefined;
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const closeOnDesktop = (event) => {
      if (event.matches) setCartSheetOpen(false);
    };

    if (mediaQuery.matches) {
      setCartSheetOpen(false);
      return undefined;
    }

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', closeOnDesktop);
      return () => mediaQuery.removeEventListener('change', closeOnDesktop);
    }

    mediaQuery.addListener(closeOnDesktop);
    return () => mediaQuery.removeListener(closeOnDesktop);
  }, [cartSheetOpen]);

  const isCajaSessionError = (error) => {
    const code = String(error?.code || error?.data?.code || '').trim().toUpperCase();
    const message = String(error?.message || '').toLowerCase();
    return ['NO_ACTIVE_SESSION', 'SESSION_PARTICIPATION_REQUIRED', 'SESSION_AUTHORIZATION_REQUIRED', 'SESSION_NOT_OPEN', 'SESSION_SCOPE_MISMATCH', 'CAJA_NOT_ACTIVE'].includes(code)
      || message.includes('sesion de caja activa')
      || message.includes('sesión de caja activa')
      || message.includes('caja activa');
  };

  const loadPendientesSummary = useCallback(async () => {
    if (!composer.selectedSucursalId) {
      setPendientesSummary({ loading: false, error: '', total: 0, monto: 0 });
      return;
    }

    setPendientesSummary((current) => ({ ...current, loading: true, error: '' }));
    try {
      const response = await ventasService.listPedidosPendientesPago({
        id_sucursal: composer.selectedSucursalId,
        page: 1,
        page_size: 1
      });
      setPendientesSummary({
        loading: false,
        error: '',
        total: Number(response?.summary?.total_pedidos_pendientes ?? 0) || 0,
        monto: Number(response?.summary?.monto_total_pendiente ?? 0) || 0
      });
    } catch (error) {
      if (Number(error?.status || 0) >= 500) {
        console.error('[Ventas] Error cargando resumen de pedidos pendientes', error);
      } else if (import.meta.env.DEV) {
        console.warn('[Ventas] No se pudo cargar resumen de pedidos pendientes', {
          status: error?.status,
          code: error?.code,
          message: error?.message
        });
      }
      setPendientesSummary((current) => ({
        ...current,
        loading: false,
        error: resolvePendientesErrorMessage(error)
      }));
    }
  }, [composer.selectedSucursalId]);

  useEffect(() => {
    void loadPendientesSummary();
  }, [loadPendientesSummary]);

  useEffect(() => {
    if (cajaStatus.loading) {
      setStatusExpanded(false);
      return;
    }

    const shouldCollapse = Boolean(cajaSesionActiva)
      && !cajaStatus.loading
      && !cajaStatus.error
      && !cajaStatus.assignmentMissing;
    setStatusExpanded(!shouldCollapse);
  }, [
    cajaSesionActiva?.id_sesion_caja,
    cajaStatus.assignmentMissing,
    cajaStatus.error,
    cajaStatus.loading
  ]);

  const handleCreatePedidoPendiente = async (payload) => {
    if (creatingPedidoPendienteRef.current) {
      const error = new Error('El pedido pendiente ya se está creando.');
      error.code = 'VENTA_PENDING_SUBMIT_IN_PROGRESS';
      throw error;
    }

    creatingPedidoPendienteRef.current = true;
    setCreatingPedidoPendiente(true);
    try {
      const response = await onCreatePedidoPendiente(payload);
      await loadPendientesSummary();
      setFinalizarOpen(false);
      setDeliveryCostPreview(0);
      return response;
    } catch (error) {
      if (isSuperAdmin && composer.selectedSucursalId && isCajaSessionError(error)) {
        await openAutoAuxiliarForSucursal({ idSucursal: composer.selectedSucursalId });
      }
      throw error;
    } finally {
      creatingPedidoPendienteRef.current = false;
      setCreatingPedidoPendiente(false);
    }
  };

  const handleRegistrarPagoPedido = async (idPedido, payload) => {
    if (registrandoPagoPedidoRef.current) {
      const error = new Error('El pago ya se está registrando.');
      error.code = 'VENTA_PAYMENT_SUBMIT_IN_PROGRESS';
      throw error;
    }

    registrandoPagoPedidoRef.current = true;
    setRegistrandoPagoPedido(true);
    try {
      const response = await onRegistrarPagoPedido(idPedido, payload);
      await loadPendientesSummary();
      setRegistrarPagoOpen(false);
      return response;
    } finally {
      registrandoPagoPedidoRef.current = false;
      setRegistrandoPagoPedido(false);
    }
  };

  const handleCancelDecision = () => {
    markCajaDecisionDismissed(cajaAsignacion, cajaUserKey);
    setDecisionOpen(false);
  };

  const handleAcceptDecision = () => {
    setDecisionOpen(false);
    setAbrirSesionError('');
    setAbrirSesionOpen(true);
  };

  const handleCloseAbrirSesion = () => {
    if (abrirSesionSaving) return;
    markCajaDecisionDismissed(cajaAsignacion, cajaUserKey);
    setAbrirSesionOpen(false);
    setAbrirSesionError('');
  };

  const handleAbrirMiSesion = async (payload) => {
    setAbrirSesionSaving(true);
    setAbrirSesionError('');
    try {
      const response = await cajasService.abrirMiSesion(payload);
      const assignment = normalizeCajaAssignment({
        ...cajaAsignacion,
        ...response,
        estado_codigo: response?.estado_codigo || 'ABIERTA',
        puede_responsable: cajaAsignacion?.puede_responsable ?? true,
        puede_auxiliar: cajaAsignacion?.puede_auxiliar ?? false
      });
      const session = normalizeCajaSession({
        ...response,
        estado_codigo: response?.estado_codigo || 'ABIERTA'
      });
      setCajaAsignacion(assignment);
      setCajaSesionActiva(session);
      syncComposerSession(session);
      clearCajaDecisionDismissed(assignment, cajaUserKey);
      setDecisionOpen(false);
      setAbrirSesionOpen(false);
      setCajaStatus({ loading: false, error: '', assignmentMissing: false });
      onNotify?.('SESIÓN ABIERTA', 'Sesión de caja abierta correctamente.', 'success');
    } catch (error) {
      if (Number(error?.status || 0) >= 500) {
        console.error('[Ventas] Error abriendo caja asignada', error);
      } else if (import.meta.env.DEV) {
        console.warn('[Ventas] No se pudo abrir caja asignada', {
          status: error?.status,
          code: error?.code,
          message: error?.message
        });
      }
      setAbrirSesionError(resolveCajaOpenErrorMessage(error));
    } finally {
      setAbrirSesionSaving(false);
    }
  };

  const cajaAssignmentLabel = resolveCajaAssignmentLabel(cajaAsignacion);
  const cajaPanelTitle = cajaStatus.loading
    ? 'Buscando caja activa'
    : cajaStatus.assignmentMissing
    ? isSuperAdmin
      ? 'Selecciona una caja activa'
      : 'No tienes una caja asignada activa'
    : cajaAssignmentLabel || 'Caja asignada no disponible';
  const cajaPanelDescription = cajaStatus.loading
    ? 'Consultando la sesión de caja para la sucursal seleccionada.'
    : cajaStatus.assignmentMissing
    ? isSuperAdmin
      ? 'Regístrate como auxiliar en una sesión abierta antes de vender.'
      : 'No tienes una caja asignada activa. Solicita asignación a un administrador.'
    : cajaAsignacion
      ? `${cajaAsignacion.codigo_caja || `Caja #${cajaAsignacion.id_caja}`} - ${cajaAsignacion.nombre_sucursal || 'Sucursal'}`
      : 'Solicita al administrador una asignación activa para operar caja.';
  const cajaSessionChipText = cajaSesionActiva
    ? 'Caja activa'
    : cajaStatus.loading
      ? 'Consultando sesión...'
    : cajaStatus.assignmentMissing
      ? isSuperAdmin
        ? 'Selecciona una caja activa'
        : 'Sin caja asignada'
      : 'No hay sesión de caja activa';
  const showCajaDetails = statusExpanded && !cajaStatus.loading;
  const ventaTotalPreview = composer.total + (Number(deliveryCostPreview) > 0 ? Number(deliveryCostPreview) : 0);
  const openFinalizeModal = () => {
    if (!composer.validateBaseSale()) return;
    setCartSheetOpen(false);
    setFinalizarOpen(true);
  };
  const openRegistrarPagoModal = () => {
    setCartSheetOpen(false);
    setRegistrarPagoOpen(true);
  };

  const closeAutoModal = () => {
    if (autoModalAssigning) return;
    setAutoModalOpen(false);
  };

  const confirmAutoAsignacion = async () => {
    const idSesionCaja = Number.parseInt(String(selectedSesion || ''), 10);
    const idSucursal = Number.parseInt(String(composer.selectedSucursal || ''), 10);
    if (!idSesionCaja || !idSucursal) return;
    setAutoModalAssigning(true);
    setAutoModalError('');
    try {
      const response = await cajasService.autoAsignarAuxiliarSesionSafe(idSesionCaja, { id_sucursal: idSucursal });
      const selectedSession = sesionesAbiertas.find(
        (session) => Number(session.id_sesion_caja) === Number(idSesionCaja)
      ) || {};
      const sessionSource = {
        ...selectedSession,
        ...response,
        id_sesion_caja: response?.id_sesion_caja || idSesionCaja,
        id_caja: response?.id_caja || selectedSession.id_caja,
        id_sucursal: response?.id_sucursal || selectedSession.id_sucursal || idSucursal,
        codigo_caja: response?.codigo_caja || selectedSession.codigo_caja,
        nombre_caja: response?.nombre_caja || selectedSession.nombre_caja,
        nombre_sucursal: response?.nombre_sucursal || selectedSession.nombre_sucursal,
        estado_codigo: response?.estado_codigo || selectedSession.estado_codigo || 'ABIERTA',
        rol_participacion: response?.rol_participacion || 'AUXILIAR',
        puede_auxiliar: true,
        puede_operar: true
      };
      const session = normalizeCajaSession(sessionSource);
      const assignment = normalizeCajaAssignment(sessionSource);
      setCajaAsignacion(assignment);
      setCajaSesionActiva(session);
      const cacheKey = isSuperAdmin
        ? `sesion:${cajaUserKey}:sucursal:${idSucursal}`
        : `asignacion:${cajaUserKey}`;
      cajaAsignacionCacheRef.current = {
        key: cacheKey,
        at: Date.now(),
        status: 'active',
        assignment,
        session,
        error: ''
      };
      composer.setTemporarySessionId(String(idSesionCaja));
      composer.setPartialState({ submitError: '' });
      setCajaStatus({ loading: false, error: '', assignmentMissing: false });
      clearCajaDecisionDismissed(assignment, cajaUserKey);
      setAutoModalOpen(false);
      onNotify?.('CAJA ACTIVA', 'Te registraste como auxiliar de caja para esta sesión.', 'success');
    } catch (error) {
      setAutoModalError(toSafeMessage(error, 'No se pudo registrar la autoasignación temporal.'));
    } finally {
      setAutoModalAssigning(false);
    }
  };

  return (
    <div className="ventas-page ventas-caja-page ventas-caja-shell">
      <div className="inv-catpro-card inv-prod-card ventas-caja-card">
        {composer.isSuperAdmin ? (
          <div className="ventas-caja__operacion-bar ventas-caja__operacion-bar--admin">
            <div className="ventas-caja__sucursal-select ventas-caja__sucursal-app-select">
              <i className="bi bi-shop" aria-hidden="true" />
              <AppSelect
                value={composer.selectedSucursal}
                options={composer.sucursales.map((sucursal) => ({
                  value: String(sucursal.id_sucursal),
                  label: sucursal.nombre_sucursal
                }))}
                onChange={composer.setSelectedSucursal}
                placeholder="Selecciona sucursal"
                className="app-select--compact app-select--warm"
              />
            </div>
          </div>
        ) : null}
        <section className={`ventas-caja__session-panel ventas-caja-statusbar ventas-caja-status-compact ${cajaSesionActiva ? 'is-active' : ''} ${cajaStatus.assignmentMissing ? 'is-missing' : ''} ${cajaStatus.loading ? 'is-loading' : ''} ${showCajaDetails ? 'is-expanded' : 'is-collapsed'}`}>
          <button
            type="button"
            className="ventas-caja-status-compact__toggle"
            onClick={() => {
              if (cajaStatus.loading) return;
              setStatusExpanded((current) => !current);
            }}
            aria-expanded={showCajaDetails}
            aria-label={showCajaDetails ? 'Contraer detalle de caja activa' : 'Expandir detalle de caja activa'}
            disabled={cajaStatus.loading}
          >
            <strong>{cajaSesionActiva ? 'Caja activa' : cajaPanelTitle}</strong>
            {!cajaSesionActiva ? (
              <span className="ventas-caja-status-compact__state">
                {cajaStatus.loading ? (
                  <span className="ventas-caja-status-compact__loader" aria-hidden="true" />
                ) : null}
                <small>{cajaSessionChipText}</small>
                {!cajaStatus.loading ? (
                  <i className={`bi bi-chevron-${showCajaDetails ? 'up' : 'down'}`} aria-hidden="true" />
                ) : null}
              </span>
            ) : (
              <i
                className={`ventas-caja-status-compact__chevron bi bi-chevron-${showCajaDetails ? 'up' : 'down'}`}
                aria-hidden="true"
              />
            )}
          </button>

          <div className="ventas-caja-status-compact__details" hidden={!showCajaDetails}>
            {cajaSesionActiva ? (
              <div className="ventas-caja__session-metrics ventas-caja__session-metrics--compact">
                <div>
                  <span>Caja</span>
                  <strong>{cajaSesionActiva?.nombre_caja || cajaSesionActiva?.codigo_caja || `Caja #${cajaSesionActiva?.id_caja}`}</strong>
                </div>
                <div>
                  <span>Sesión</span>
                  <strong>SES-{String(cajaSesionActiva?.id_sesion_caja || '').padStart(5, '0')}</strong>
                </div>
                <div>
                  <span>Rol en caja</span>
                  <strong>{resolveCajaRoleLabel(cajaSesionActiva)}</strong>
                </div>
                <div>
                  <span>Responsable</span>
                  <strong>{cajaSesionActiva?.responsable_nombre || cajaSesionActiva?.responsable_usuario || 'No disponible'}</strong>
                </div>
                <div>
                  <span>Sucursal</span>
                  <strong>{cajaSesionActiva?.nombre_sucursal || cajaAsignacion?.nombre_sucursal || composer.selectedSucursalLabel || 'Sucursal'}</strong>
                </div>
                <div>
                  <span>Fecha apertura</span>
                  <strong>{formatDateTime(cajaSesionActiva?.fecha_apertura)}</strong>
                </div>
                <div>
                  <span>Monto apertura</span>
                  <strong>{composer.formatCurrency(cajaSesionActiva?.monto_apertura || 0)}</strong>
                </div>
              </div>
            ) : (
              <div className="ventas-caja__session-main">
                <strong>{cajaPanelTitle}</strong>
                <span>{cajaPanelDescription}</span>
                {cajaStatus.error ? <small className="is-error">{cajaStatus.error}</small> : null}
                {isSuperAdmin && cajaStatus.assignmentMissing ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger align-self-start"
                    onClick={() => openAutoAuxiliarForSucursal({
                      idSucursal: composer.selectedSucursalId || composer.selectedSucursal,
                      force: true
                    })}
                    disabled={autoModalLoading || autoModalAssigning}
                  >
                    Elegir sesión abierta
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </section>
        <form className="ventas-create-modal__body ventas-caja__body ventas-caja-layout" onSubmit={composer.handleSubmit}>
          <VentaComposerCatalog
            composer={composer}
            catalogLoading={catalogLoading}
            catalogErrors={catalogErrors}
          />
          <VentaComposerSummary
            composer={composer}
            saving={saving}
            deliveryCost={deliveryCostPreview}
            pendingPaymentsSummary={pendientesSummary}
            onOpenFinalize={openFinalizeModal}
            onOpenRegistrarPago={openRegistrarPagoModal}
            variant="side"
          />
        </form>
        <button
          type="button"
          className={`ventas-caja-mobile-cart-bar ${composer.cart.length > 0 ? 'has-items' : 'is-empty'}`}
          onClick={() => setCartSheetOpen(true)}
          aria-label="Abrir carrito de venta"
        >
          <span className="ventas-caja-mobile-cart-bar__icon">
            <i className="bi bi-cart3" />
          </span>
          <span className="ventas-caja-mobile-cart-bar__label">
            <strong>{composer.cart.length > 0 ? 'Carrito de venta' : 'Carrito vacío'}</strong>
            <small>{composer.cartCount} {composer.cartCount === 1 ? 'item' : 'items'}</small>
          </span>
          <strong className="ventas-caja-mobile-cart-bar__total">
            {composer.formatCurrency(ventaTotalPreview)}
          </strong>
          <i className="bi bi-chevron-up" aria-hidden="true" />
        </button>
      </div>
      {cartSheetOpen ? (
        <div className="ventas-caja-mobile-cart-sheet">
          <button
            type="button"
            className="ventas-caja-mobile-cart-sheet__backdrop"
            onClick={() => setCartSheetOpen(false)}
            aria-label="Cerrar carrito"
          />
          <div
            className="ventas-caja-mobile-cart-sheet__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ventas-caja-mobile-cart-title"
          >
            <div className="ventas-caja-mobile-cart-sheet__handle" aria-hidden="true" />
            <VentaComposerSummary
              composer={composer}
              saving={saving}
              deliveryCost={deliveryCostPreview}
              pendingPaymentsSummary={pendientesSummary}
              onOpenFinalize={openFinalizeModal}
              onOpenRegistrarPago={openRegistrarPagoModal}
              variant="sheet"
              onClose={() => setCartSheetOpen(false)}
            />
          </div>
        </div>
      ) : null}
      <VentaCajaAperturaDecisionModal
        open={decisionOpen}
        assignment={cajaAsignacion}
        onCancel={handleCancelDecision}
        onAccept={handleAcceptDecision}
      />
      <VentaCajaAbrirSesionModal
        open={abrirSesionOpen}
        assignment={cajaAsignacion}
        saving={abrirSesionSaving}
        errorMessage={abrirSesionError}
        onClose={handleCloseAbrirSesion}
        onSubmit={handleAbrirMiSesion}
      />
      <VentaCajaAutoAuxiliarModal
        open={autoModalOpen}
        loading={autoModalLoading}
        sessions={sesionesAbiertas}
        selectedSessionId={selectedSesion}
        assigning={autoModalAssigning}
        errorMessage={autoModalError}
        onSelectSession={setSelectedSesion}
        onConfirm={confirmAutoAsignacion}
        onClose={closeAutoModal}
      />
      <VentaComplementosModal
        key={`${composer.complementModal.mode}:${composer.complementModal.cartKey || composer.complementModal.row?.entityId || composer.complementModal.row?.id_combo || composer.complementModal.row?.id_receta || ''}:${composer.complementModal.open ? '1' : '0'}`}
        open={composer.complementModal.open}
        mode={composer.complementModal.mode}
        row={composer.complementModal.row}
        selected={composer.complementModal.selected}
        error={composer.complementModal.error}
        onCancel={composer.closeComplementModal}
        onConfirm={composer.confirmComplementModal}
      />
      {finalizarOpen ? (
        <VentaFinalizarOperacionModal
          open={finalizarOpen}
          composer={composer}
          saving={saving || creatingPedidoPendiente}
          onClose={() => {
            setFinalizarOpen(false);
            setDeliveryCostPreview(0);
          }}
          onCreatePedidoPendiente={handleCreatePedidoPendiente}
          onDeliveryCostChange={setDeliveryCostPreview}
          onClientesRefresh={onClientesRefresh}
        />
      ) : null}
      {registrarPagoOpen ? (
        <VentaRegistrarPagoPedidoModal
          open={registrarPagoOpen}
          saving={saving || registrandoPagoPedido}
          onClose={() => setRegistrarPagoOpen(false)}
          onRegistrarPago={handleRegistrarPagoPedido}
          selectedSucursalId={composer.selectedSucursalId}
          selectedSessionId={cajaSesionActiva?.id_sesion_caja || composer.temporarySessionId}
        />
      ) : null}
    </div>
  );
}
