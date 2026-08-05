import { useCallback, useEffect, useRef, useState } from 'react';
import VentaComposerCatalog from './VentaComposerCatalog';
import VentaComposerSummary from './VentaComposerSummary';
import { useVentaComposer } from '../hooks/useVentaComposer';
import cajasService from '../../../../services/cajasService';
import VentaCajaAbrirSesionModal from './VentaCajaAbrirSesionModal';
import VentaCajaAperturaDecisionModal from './VentaCajaAperturaDecisionModal';
import VentaCajaAutoAuxiliarModal from './VentaCajaAutoAuxiliarModal';
import VentaComplementosModal from './VentaComplementosModal';
import VentaExtrasModal from './VentaExtrasModal';
import VentaFinalizarOperacionModal from './VentaFinalizarOperacionModal';
import VentaRegistrarPagoPedidoModal from './VentaRegistrarPagoPedidoModal';
import ventasService from '../../../../services/ventasService';
import printerDeviceDetectionService from '../../../../services/printerDeviceDetectionService';
import { useAuth } from '../../../../hooks/useAuth';
import AppSelect from '../../../../components/common/AppSelect';
import { parseCajaUtcTimestamp } from '../utils/cajasHelpers';
import { dispatchPedidoPendientePostCreationTasks } from '../utils/pedidoPendienteCreation';
import {
  buildPedidoPendienteOperationContext,
  createPedidoPendienteContextError,
  parsePositiveIntegerId,
  prepareAndSubmitPedidoPendiente,
  resolveAuthenticatedUserIdentity,
  resolvePedidoPendienteContextState
} from '../utils/authenticatedUserScope';

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
const PEDIDO_CONTEXT_REVALIDATION_TIMEOUT_MS = 5000;
const DEFINITIVE_CAJA_SESSION_ERROR_CODES = new Set([
  'NO_ACTIVE_SESSION',
  'SESSION_NOT_OPEN',
  'SESSION_SCOPE_MISMATCH',
  'SESSION_PARTICIPATION_REQUIRED',
  'SESSION_AUTHORIZATION_REQUIRED',
  'CAJA_NOT_ACTIVE'
]);

const toPositiveId = (value) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const buildCajaUserKey = (idUsuario, user) => {
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
  const date = new Date(parseCajaUtcTimestamp(value));
  if (!Number.isFinite(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-HN', {
    timeZone: 'America/Tegucigalpa',
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
  userId,
  authLoading = false,
  defaultSucursalId,
  productos,
  categorias,
  tiposDepartamento,
  clientes,
  clientesMeta,
  recetas,
  descuentosCatalogo,
  canApplyDiscount,
  catalogLoading,
  catalogLoadingStates = {},
  catalogStatuses = {},
  cajaBootstrapData = null,
  recipeCatalogState = { byScope: {}, activeKey: null },
  catalogErrors,
  saving,
  onSubmit,
  onCreatePedidoPendiente,
  onRegistrarPagoPedido,
  onPedidoPendienteCreated,
  onSuccessfulPendingOrderPaymentPrint,
  onCatalogSucursalChange,
  onCatalogDemand,
  onRecipesDepartmentDemand,
  onClientesRefresh,
  onClienteCatalogUpsert,
  onNotify
}) {
  const { user } = useAuth();
  const userIdentity = resolveAuthenticatedUserIdentity(user);
  const providedUserId = parsePositiveIntegerId(userId);
  const userIdMismatch = Boolean(userIdentity.id && providedUserId && userIdentity.id !== providedUserId);
  const authenticatedUserId = userIdentity.status === 'valid' && !userIdMismatch
    ? userIdentity.id
    : null;
  const userIdentityStatus = userIdMismatch ? 'conflict' : userIdentity.status;
  const cajaUserKey = buildCajaUserKey(authenticatedUserId, user);
  const hasCajaUser = Boolean(authenticatedUserId);

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
  const pendientesSummaryRequestRef = useRef({ key: '', promise: null, requestId: 0 });
  const pendientesSummaryAbortRef = useRef(null);
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
  const [revalidatingPedidoContext, setRevalidatingPedidoContext] = useState(false);
  const [pedidoContextStale, setPedidoContextStale] = useState(false);
  const [pedidoPendienteOperation, setPedidoPendienteOperation] = useState(null);
  const [sharedPedidoPendienteOperations, setSharedPedidoPendienteOperations] = useState([]);
  const [pedidoPendienteStorageContext, setPedidoPendienteStorageContext] = useState({
    persistenceDegraded: false,
    invalidRecord: false,
    scopeMismatch: false
  });
  const [registrandoPagoPedido, setRegistrandoPagoPedido] = useState(false);
  const [statusExpanded, setStatusExpanded] = useState(false);
  const [cartSheetOpen, setCartSheetOpen] = useState(false);
  const composerRef = useRef(null);
  const cajaAsignacionRequestRef = useRef(0);
  const cajaAsignacionCacheRef = useRef({ key: '', at: 0, status: 'idle' });
  const cajaAsignacionInFlightRef = useRef(null);
  const sesionesAbiertasCacheRef = useRef({ key: '', at: 0, rows: [] });
  const sesionesAbiertasInFlightRef = useRef(null);
  const sesionesAbiertasAbortRef = useRef(null);
  const sesionesAbiertasRequestIdRef = useRef(0);
  const cajaUserKeyRef = useRef(cajaUserKey);
  const creatingPedidoPendienteRef = useRef(false);
  const pedidoContextRevalidationRef = useRef({ key: '', promise: null, controller: null, requestId: 0 });
  const pedidoPendienteOperationRef = useRef(null);
  const registrandoPagoPedidoRef = useRef(false);
  const lastDetectionSessionRef = useRef('');
  const pedidoPendienteOperationLocked = ventasService.isPedidoPendienteOperationLocked(pedidoPendienteOperation);
  const pedidoPendienteComposerGuarded = pedidoPendienteOperationLocked || pedidoPendienteStorageContext.invalidRecord;

  const catalogSucursalRequestRef = useRef('');
  const catalogSucursalRequestIdRef = useRef(0);
  const bootstrapSesionCaja = normalizeCajaSession(cajaBootstrapData?.sesion_caja);
  const hasCajaSession = Boolean(cajaSesionActiva?.id_sesion_caja || bootstrapSesionCaja?.id_sesion_caja);
  const lockedSucursalId = toPositiveId(cajaSesionActiva?.id_sucursal || cajaAsignacion?.id_sucursal || defaultSucursalId);

  useEffect(() => {
    if (cajaUserKeyRef.current === cajaUserKey) return;
    cajaUserKeyRef.current = cajaUserKey;
    cajaAsignacionRequestRef.current += 1;
    cajaAsignacionCacheRef.current = { key: '', at: 0, status: 'idle' };
    cajaAsignacionInFlightRef.current = null;
    sesionesAbiertasCacheRef.current = { key: '', at: 0, rows: [] };
    sesionesAbiertasAbortRef.current?.abort();
    sesionesAbiertasAbortRef.current = null;
    sesionesAbiertasRequestIdRef.current += 1;
    sesionesAbiertasInFlightRef.current = null;
    pendientesSummaryAbortRef.current?.abort();
    pendientesSummaryAbortRef.current = null;
    pendientesSummaryRequestRef.current = { key: '', promise: null, requestId: pendientesSummaryRequestRef.current.requestId + 1, controller: null };
    catalogSucursalRequestRef.current = '';
    catalogSucursalRequestIdRef.current += 1;
    pedidoContextRevalidationRef.current.controller?.abort();
    pedidoContextRevalidationRef.current = {
      key: '',
      promise: null,
      controller: null,
      requestId: pedidoContextRevalidationRef.current.requestId + 1
    };
    pedidoPendienteOperationRef.current = null;
    setPedidoPendienteOperation(null);
    setSharedPedidoPendienteOperations([]);
    setPedidoPendienteStorageContext({ persistenceDegraded: false, invalidRecord: false, scopeMismatch: false });
    setPendientesSummary({ loading: false, error: '', total: 0, monto: 0 });
    setCajaAsignacion(null);
    setCajaSesionActiva(null);
    setCajaStatus({ loading: false, error: '', assignmentMissing: false });
  }, [cajaUserKey]);

  useEffect(() => () => {
    pedidoContextRevalidationRef.current.controller?.abort();
  }, []);

  const openAutoAuxiliarForSucursal = async ({ idSucursal, force = false }) => {
    if (!isSuperAdmin) return;
    const normalizedSucursalId = toPositiveId(idSucursal);
    if (!normalizedSucursalId) return;

    const cacheKey = `usuario:${cajaUserKey}:sucursal:${normalizedSucursalId}`;
    const selectedSucursalId = () => toPositiveId(composerRef.current?.selectedSucursalId || composerRef.current?.selectedSucursal);
    setAutoModalError('');
    setAutoModalOpen(true);

    const cached = sesionesAbiertasCacheRef.current;
    if (!force && isTimedCacheFresh(cached, cacheKey, CAJA_SESIONES_ABIERTAS_CACHE_MS)) {
      const rows = (cached.rows || []).filter((row) => Number(row.id_sucursal) === Number(normalizedSucursalId));
      setSesionesAbiertas(rows);
      setSelectedSesion(rows.length > 0 ? String(rows[0].id_sesion_caja) : '');
      if (rows.length === 0) {
        setAutoModalError('No hay cajas activas con sesión abierta para la sucursal seleccionada.');
      }
      return;
    }

    const activeInFlight = sesionesAbiertasInFlightRef.current;
    if (
      !force &&
      activeInFlight?.key === cacheKey &&
      activeInFlight.promise &&
      !activeInFlight.controller?.signal?.aborted
    ) {
      return activeInFlight.promise;
    }

    sesionesAbiertasAbortRef.current?.abort();
    const controller = new AbortController();
    sesionesAbiertasAbortRef.current = controller;
    const requestId = sesionesAbiertasRequestIdRef.current + 1;
    sesionesAbiertasRequestIdRef.current = requestId;
    const requestUserKey = cajaUserKey;
    const requestSucursalId = normalizedSucursalId;
    const isCurrentAutoAuxRequest = () => {
      const current = sesionesAbiertasInFlightRef.current;
      return current?.key === cacheKey &&
        current.requestId === requestId &&
        current.controller === controller &&
        current.userKey === requestUserKey &&
        current.sucursalId === requestSucursalId &&
        cajaUserKeyRef.current === requestUserKey &&
        selectedSucursalId() === requestSucursalId &&
        !controller.signal.aborted;
    };

    setAutoModalLoading(true);
    const promise = cajasService
      .listSesionesAbiertasSafe(
        { id_sucursal: normalizedSucursalId },
        { signal: controller.signal }
      )
      .then((response) => {
        const rows = normalizeOpenSessions(response)
          .filter((row) => Number(row.id_sucursal) === Number(normalizedSucursalId));
        if (!isCurrentAutoAuxRequest()) return null;

        sesionesAbiertasCacheRef.current = { key: cacheKey, at: Date.now(), rows };
        setSesionesAbiertas(rows);
        setSelectedSesion(rows.length > 0 ? String(rows[0].id_sesion_caja) : '');
        if (rows.length === 0) {
          setAutoModalError('No hay cajas activas con sesión abierta para la sucursal seleccionada.');
        }
        return rows;
      })
      .catch((error) => {
        if (controller.signal.aborted || !isCurrentAutoAuxRequest()) return null;
        setSesionesAbiertas([]);
        setSelectedSesion('');
        setAutoModalError(toSafeMessage(error, 'No se pudieron cargar sesiones abiertas.'));
        return null;
      })
      .finally(() => {
        const current = sesionesAbiertasInFlightRef.current;
        if (current?.key === cacheKey && current.requestId === requestId && current.controller === controller) {
          sesionesAbiertasInFlightRef.current = null;
          if (sesionesAbiertasAbortRef.current === controller) {
            sesionesAbiertasAbortRef.current = null;
          }
          setAutoModalLoading(false);
        }
      });

    sesionesAbiertasInFlightRef.current = {
      key: cacheKey,
      promise,
      controller,
      requestId,
      userKey: requestUserKey,
      sucursalId: requestSucursalId
    };
    return promise;
  };

  const composer = useVentaComposer({
    productos,
    categorias,
    tiposDepartamento,
    clientes,
    recetas,
    descuentosCatalogo,
    canApplyDiscount,
    sucursales,
    isSuperAdmin,
    defaultSucursalId: isSuperAdmin ? defaultSucursalId : lockedSucursalId,
    allowSucursalAutoSelection: !catalogLoadingStates.bootstrapLoading,
    catalogsEnabled: hasCajaSession,
    onDepartmentDemand: ({ idSucursal, idTipoDepartamento }) => onRecipesDepartmentDemand?.({
      id_sucursal: idSucursal,
      id_tipo_departamento: idTipoDepartamento
    }),
    onSubmit,
    suppressSubmitErrorToast: true,
    onRequireAutoAuxiliar: openAutoAuxiliarForSucursal,
    onReset: () => {
      const operationId = pedidoPendienteOperationRef.current?.operationId || null;
      if (!operationId) return true;
      const abandoned = ventasService.abandonPedidoPendienteOperation(operationId);
      if (!abandoned) return false;
      pedidoPendienteOperationRef.current = null;
      setPedidoPendienteOperation(null);
      return true;
    },
    mutationBlocked: pedidoPendienteComposerGuarded,
    onMutationBlocked: () => onNotify?.(
      'RESULTADO PENDIENTE',
      'Recupera o abandona conscientemente la operación anterior antes de modificar el pedido.',
      'warning'
    ),
    userId: authenticatedUserId
  });
  composerRef.current = composer;
  const pedidoOperationUserId = String(authenticatedUserId || '').trim();
  const pedidoOperationSucursalId = String(
    toPositiveId(composer.selectedSucursalId || composer.selectedSucursal || cajaBootstrapData?.id_sucursal) || ''
  );
  const pedidoOperationSessionId = String(
    toPositiveId(cajaSesionActiva?.id_sesion_caja || composer.temporarySessionId || bootstrapSesionCaja?.id_sesion_caja) || ''
  );

  useEffect(() => {
    const operationScope = {
      userId: pedidoOperationUserId,
      sucursalId: pedidoOperationSucursalId,
      cashSessionId: pedidoOperationSessionId,
      origin: 'SMARTORDER_POS'
    };
    const storageContext = ventasService.getPedidoPendienteOperationContext(operationScope);
    setPedidoPendienteStorageContext(storageContext);
    const stored = storageContext.operation;
    if (stored) {
      pedidoPendienteOperationRef.current = stored;
      setPedidoPendienteOperation(stored);
    } else {
      pedidoPendienteOperationRef.current = null;
      setPedidoPendienteOperation(null);
    }
    return ventasService.subscribePedidoPendienteOperations(operationScope, (operations, event) => {
      setSharedPedidoPendienteOperations(operations);
      setPedidoPendienteStorageContext((current) => ({
        ...current,
        ...ventasService.getPedidoPendienteStorageState()
      }));
      setPedidoPendienteOperation((current) => {
        if (!current?.operationId) return current;
        if (
          event?.type === 'operation-released'
          && event.operationId === current.operationId
          && [
            ventasService.PEDIDO_PENDIENTE_OPERATION_STATUS.CONFIRMED,
            ventasService.PEDIDO_PENDIENTE_OPERATION_STATUS.ABANDONED
          ].includes(event.status)
        ) {
          pedidoPendienteOperationRef.current = null;
          return null;
        }
        const updated = operations.find((operation) => operation.operationId === current.operationId);
        if (!updated) return current;
        pedidoPendienteOperationRef.current = updated;
        return updated;
      });
    });
  }, [pedidoOperationSessionId, pedidoOperationSucursalId, pedidoOperationUserId]);

  const resolvedCajaSucursalId = toPositiveId(
    composer.selectedSucursalId || composer.selectedSucursal || cajaBootstrapData?.id_sucursal
  );
  const activeCatalogLoading = composer.activeCatalog === 'PRODUCTOS'
    ? Boolean(catalogLoadingStates.productsLoading)
    : composer.activeCatalog === 'EXTRAS'
        ? Boolean(composer.currentCatalogLoading)
      : Boolean(catalogLoadingStates.bootstrapLoading || catalogLoadingStates.recipesLoading || catalogLoading);
  const activeCatalogStatus = composer.activeCatalog === 'PRODUCTOS'
    ? catalogStatuses.productos || 'idle'
    : composer.activeCatalog === 'EXTRAS'
        ? !hasCajaSession
          ? 'idle'
          : composer.currentCatalogStatus || 'idle'
      : composer.activeCatalog === 'DESCUENTOS'
        ? catalogStatuses.descuentos || 'idle'
        : catalogStatuses.recetas || 'idle';

  const retryActiveCatalog = useCallback(() => {
    const idSucursal = toPositiveId(composer.selectedSucursalId || composer.selectedSucursal);
    if (!idSucursal) return;
    if (composer.activeCatalog === 'EXTRAS') {
      composer.retryGlobalExtras();
      return;
    }
    if (composer.activeCatalog === 'RECETAS') {
      void onRecipesDepartmentDemand?.({
        id_sucursal: idSucursal,
        id_tipo_departamento: composer.activeCategory === 'all' ? null : toPositiveId(composer.activeCategory),
        force: true
      });
      return;
    }
    void onCatalogDemand?.(composer.activeCatalog, { id_sucursal: idSucursal, force: true });
  }, [
    composer.activeCatalog,
    composer.activeCategory,
    composer.selectedSucursal,
    composer.selectedSucursalId,
    composer.retryGlobalExtras,
    onCatalogDemand,
    onRecipesDepartmentDemand
  ]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const selectedSucursalId = toPositiveId(composer.selectedSucursalId || composer.selectedSucursal);
    if (!selectedSucursalId) return;

    const key = `usuario:${cajaUserKey}:sucursal:${selectedSucursalId}`;
    if (catalogSucursalRequestRef.current === key) return;
    catalogSucursalRequestRef.current = key;
    const requestId = catalogSucursalRequestIdRef.current + 1;
    catalogSucursalRequestIdRef.current = requestId;

    void onCatalogSucursalChange?.({ id_sucursal: selectedSucursalId, requestId });
  }, [
    composer.selectedSucursal,
    composer.selectedSucursalId,
    cajaUserKey,
    isSuperAdmin,
    onCatalogSucursalChange
  ]);

  useEffect(() => {
    const selectedSucursalId = resolvedCajaSucursalId;
    if (!selectedSucursalId || !hasCajaSession) return;
    if (composer.activeCatalog === 'RECETAS') {
      const bootstrapDepartmentId = toPositiveId(cajaBootstrapData?.departamento_activo?.id_tipo_departamento);
      if (composer.activeCategory === 'all' && bootstrapDepartmentId) return;
      void onRecipesDepartmentDemand?.({
        id_sucursal: selectedSucursalId,
        id_tipo_departamento: composer.activeCategory === 'all' ? null : toPositiveId(composer.activeCategory)
      });
      return;
    }
    void onCatalogDemand?.(composer.activeCatalog, { id_sucursal: selectedSucursalId });
  }, [
    hasCajaSession,
    resolvedCajaSucursalId,
    cajaBootstrapData?.departamento_activo?.id_tipo_departamento,
    composer.activeCatalog,
    composer.activeCategory,
    onCatalogDemand,
    onRecipesDepartmentDemand
  ]);

  useEffect(() => {
    if (!canApplyDiscount || !composer.descuentoPickerOpen) return;
    const selectedSucursalId = toPositiveId(composer.selectedSucursalId || composer.selectedSucursal);
    if (!selectedSucursalId) return;
    void onCatalogDemand?.('DESCUENTOS', { id_sucursal: selectedSucursalId });
  }, [canApplyDiscount, composer.descuentoPickerOpen, composer.selectedSucursal, composer.selectedSucursalId, onCatalogDemand]);

  const syncComposerSession = useCallback((session) => {
    const idSesionCaja = toPositiveId(session?.id_sesion_caja);
    composerRef.current?.setTemporarySessionId(idSesionCaja ? String(idSesionCaja) : '');
  }, []);

  useEffect(() => {
    const bootstrapSucursalId = toPositiveId(cajaBootstrapData?.id_sucursal);
    const selectedSucursalId = toPositiveId(composer.selectedSucursalId || composer.selectedSucursal);
    if (!bootstrapSucursalId) return;
    if (selectedSucursalId && bootstrapSucursalId !== selectedSucursalId) return;

    const session = normalizeCajaSession(cajaBootstrapData?.sesion_caja);
    const assignment = session
      ? buildCajaAssignmentFromSession(session)
      : normalizeCajaAssignment(cajaBootstrapData?.caja_activa);
    setCajaAsignacion(assignment);
    setCajaSesionActiva(session);
    syncComposerSession(session);
    setCajaStatus({
      loading: false,
      error: '',
      assignmentMissing: !assignment
    });
    setDecisionOpen(Boolean(assignment && !session && assignment.puede_abrir));
  }, [
    cajaBootstrapData,
    composer.selectedSucursal,
    composer.selectedSucursalId,
    syncComposerSession
  ]);

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

    if (isSuperAdmin || catalogLoadingStates.bootstrapLoading) return undefined;

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
  }, [cajaUserKey, catalogLoadingStates.bootstrapLoading, hasCajaUser, isSuperAdmin, loadCajaAsignada, syncComposerSession]);

  useEffect(() => {
    if (!hasCajaUser || !isSuperAdmin || catalogLoadingStates.bootstrapLoading) return undefined;

    const selectedSucursalId = toPositiveId(composer.selectedSucursalId || composer.selectedSucursal);
    const bootstrapSucursalId = toPositiveId(cajaBootstrapData?.id_sucursal);
    if (selectedSucursalId && bootstrapSucursalId === selectedSucursalId) return undefined;
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
    cajaBootstrapData?.id_sucursal,
    catalogLoadingStates.bootstrapLoading,
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

  const isDefinitiveCajaSessionError = (error) => {
    const code = String(error?.code || error?.data?.code || '').trim().toUpperCase();
    return DEFINITIVE_CAJA_SESSION_ERROR_CODES.has(code);
  };

  const loadPendientesSummary = useCallback(async () => {
    const selectedSucursalId = toPositiveId(composer.selectedSucursalId);
    if (!selectedSucursalId) {
      setPendientesSummary({ loading: false, error: '', total: 0, monto: 0 });
      return;
    }

    const requestKey = `usuario:${cajaUserKey}:sucursal:${selectedSucursalId}`;
    const currentInFlight = pendientesSummaryRequestRef.current;
    if (
      currentInFlight?.key === requestKey
      && currentInFlight.promise
      && !currentInFlight.controller?.signal?.aborted
    ) {
      return currentInFlight.promise;
    }

    pendientesSummaryAbortRef.current?.abort();
    const controller = new AbortController();
    pendientesSummaryAbortRef.current = controller;
    const requestId = currentInFlight.requestId + 1;
    const requestUserKey = cajaUserKey;
    const requestSucursalId = selectedSucursalId;
    const isCurrentPendingRequest = () => {
      const current = pendientesSummaryRequestRef.current;
      return current.key === requestKey
        && current.requestId === requestId
        && current.controller === controller
        && requestUserKey === cajaUserKey
        && requestSucursalId === toPositiveId(composerRef.current?.selectedSucursalId)
        && !controller.signal.aborted;
    };
    setPendientesSummary((current) => ({ ...current, loading: true, error: '' }));
    const requestPromise = (async () => {
      const response = await ventasService.listPedidosPendientesPago({
        id_sucursal: selectedSucursalId,
        page: 1,
        page_size: 1
      }, {
        signal: controller.signal
      });
      if (!isCurrentPendingRequest()) return null;
      setPendientesSummary({
        loading: false,
        error: '',
        total: Number(response?.summary?.total_pedidos_pendientes ?? 0) || 0,
        monto: Number(response?.summary?.monto_total_pendiente ?? 0) || 0
      });
      return response;
    })();
    pendientesSummaryRequestRef.current = { key: requestKey, promise: requestPromise, requestId, controller };

    try {
      return await requestPromise;
    } catch (error) {
      if (controller.signal.aborted) return null;
      if (!isCurrentPendingRequest()) return null;
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
      return null;
    } finally {
      const current = pendientesSummaryRequestRef.current;
      if (current.key === requestKey && current.requestId === requestId && current.controller === controller) {
        pendientesSummaryRequestRef.current = { key: '', promise: null, requestId, controller: null };
        if (pendientesSummaryAbortRef.current === controller) {
          pendientesSummaryAbortRef.current = null;
        }
      }
    }
  }, [cajaUserKey, composer.selectedSucursalId]);

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

  const localPedidoSession = cajaSesionActiva || bootstrapSesionCaja;
  const localPedidoSessionSucursalId = parsePositiveIntegerId(localPedidoSession?.id_sucursal);
  const selectedPedidoSucursalId = parsePositiveIntegerId(pedidoOperationSucursalId);
  const localPedidoSessionIsCoherent = Boolean(
    parsePositiveIntegerId(localPedidoSession?.id_sesion_caja)
    && String(localPedidoSession?.estado_codigo || 'ABIERTA').trim().toUpperCase() === 'ABIERTA'
    && localPedidoSessionSucursalId
    && localPedidoSessionSucursalId === selectedPedidoSucursalId
    && !pedidoContextStale
  );
  const localPedidoContextState = resolvePedidoPendienteContextState({
    userId: authenticatedUserId,
    sucursalId: pedidoOperationSucursalId,
    cashSessionId: localPedidoSessionIsCoherent ? localPedidoSession?.id_sesion_caja : null,
    loading: Boolean(authLoading),
    userIdentityStatus
  });
  const pendingOrderContextState = localPedidoContextState.ready
    ? localPedidoContextState
    : resolvePedidoPendienteContextState({
        userId: authenticatedUserId,
        sucursalId: pedidoOperationSucursalId,
        cashSessionId: pedidoOperationSessionId,
        loading: Boolean(
          authLoading
          || cajaStatus.loading
          || revalidatingPedidoContext
        ),
        userIdentityStatus
      });

  const revalidatePedidoPendienteContext = async (payload = {}) => {
    const initialState = resolvePedidoPendienteContextState({
      userId: authenticatedUserId,
      sucursalId: payload?.id_sucursal || pedidoOperationSucursalId,
      cashSessionId: payload?.id_sesion_caja || pedidoOperationSessionId,
      loading: Boolean(authLoading),
      userIdentityStatus
    });
    if (initialState.loading || !authenticatedUserId || !parsePositiveIntegerId(payload?.id_sucursal || pedidoOperationSucursalId)) {
      throw createPedidoPendienteContextError(initialState);
    }

    const selectedSucursalId = parsePositiveIntegerId(payload?.id_sucursal || pedidoOperationSucursalId);
    const requestKey = `usuario:${cajaUserKey}:sucursal:${selectedSucursalId}`;
    const activeRequest = pedidoContextRevalidationRef.current;
    if (activeRequest.key === requestKey && activeRequest.promise && !activeRequest.controller?.signal.aborted) {
      return activeRequest.promise;
    }
    activeRequest.controller?.abort();
    const controller = new AbortController();
    const requestId = activeRequest.requestId + 1;
    const requestUserKey = cajaUserKey;
    const isCurrentRequest = () => {
      const current = pedidoContextRevalidationRef.current;
      const currentSucursalId = parsePositiveIntegerId(
        composerRef.current?.selectedSucursalId || composerRef.current?.selectedSucursal
      );
      return current.key === requestKey
        && current.requestId === requestId
        && current.controller === controller
        && cajaUserKeyRef.current === requestUserKey
        && currentSucursalId === selectedSucursalId
        && !controller.signal.aborted;
    };

    setRevalidatingPedidoContext(true);
    const requestPromise = (async () => {
      try {
        const requestConfig = { signal: controller.signal, timeoutMs: PEDIDO_CONTEXT_REVALIDATION_TIMEOUT_MS };
        const response = isSuperAdmin
          ? await cajasService.getMiSesionActiva({ id_sucursal: selectedSucursalId }, requestConfig)
          : await cajasService.getMiAsignacionActiva(requestConfig);
        if (!isCurrentRequest()) {
          const staleError = new Error('La sucursal o el usuario cambió durante la validación de caja.');
          staleError.code = 'PEDIDO_PENDIENTE_CONTEXT_REVALIDATION_STALE';
          throw staleError;
        }
        const session = normalizeCajaSession(isSuperAdmin ? response?.session : response);
        const sessionSucursalId = parsePositiveIntegerId(session?.id_sucursal);
        const sessionMatchesSucursal = Boolean(
          session?.id_sesion_caja
          && sessionSucursalId
          && sessionSucursalId === selectedSucursalId
        );
        const activeSession = sessionMatchesSucursal ? session : null;
        const assignment = activeSession
          ? buildCajaAssignmentFromSession(activeSession)
          : normalizeCajaAssignment(isSuperAdmin ? null : response);

        setCajaAsignacion(assignment);
        setCajaSesionActiva(activeSession);
        syncComposerSession(activeSession);
        setCajaStatus({
          loading: false,
          error: session && !sessionMatchesSucursal
            ? 'La sesión de caja activa pertenece a otra sucursal.'
            : '',
          assignmentMissing: !assignment
        });
        setPedidoContextStale(!activeSession);

        if (session && !sessionMatchesSucursal) {
          const mismatchError = new Error('La sesión de caja activa no corresponde a la sucursal seleccionada. Actualiza Caja e inténtalo de nuevo.');
          mismatchError.code = 'PEDIDO_PENDIENTE_SUCURSAL_SESION_INCOMPATIBLE';
          throw mismatchError;
        }

        const refreshedState = resolvePedidoPendienteContextState({
          userId: authenticatedUserId,
          sucursalId: selectedSucursalId,
          cashSessionId: activeSession?.id_sesion_caja,
          userIdentityStatus
        });
        if (!refreshedState.ready) throw createPedidoPendienteContextError(refreshedState);
        return buildPedidoPendienteOperationContext(refreshedState.context);
      } catch (error) {
        if (
          error?.code === 'PEDIDO_PENDIENTE_SUCURSAL_SESION_INCOMPATIBLE'
          || String(error?.code || '').startsWith('PEDIDO_PENDIENTE_')
        ) {
          throw error;
        }

        const contextError = isCajaAssignmentNotFound(error)
          ? createPedidoPendienteContextError(resolvePedidoPendienteContextState({
              userId: authenticatedUserId,
              sucursalId: selectedSucursalId,
              cashSessionId: null,
              userIdentityStatus
            }))
          : new Error('No se pudo validar la sesión de caja. El carrito se conserva; revisa la conexión y vuelve a intentar.');
        if (!contextError.code) contextError.code = 'PEDIDO_PENDIENTE_CONTEXT_REVALIDATION_FAILED';
        contextError.cause = error;
        throw contextError;
      } finally {
        const current = pedidoContextRevalidationRef.current;
        if (current.key === requestKey && current.requestId === requestId && current.controller === controller) {
          pedidoContextRevalidationRef.current = { key: '', promise: null, controller: null, requestId };
          setRevalidatingPedidoContext(false);
        }
      }
    })();
    pedidoContextRevalidationRef.current = { key: requestKey, promise: requestPromise, controller, requestId };
    return requestPromise;
  };

  const finalizePedidoPendienteCreation = async (response) => {
    const idPedido = toPositiveId(response?.id_pedido);
    if (!idPedido) {
      const invalidResponseError = new Error('El servidor no confirmó el identificador del pedido creado.');
      invalidResponseError.code = 'PEDIDO_PENDIENTE_RESPUESTA_INVALIDA';
      throw invalidResponseError;
    }

    pedidoPendienteOperationRef.current = null;
    setPedidoPendienteOperation(null);
    try {
      composer.resetComposer({ preserveSucursal: true, preserveSession: true, force: true });
    } catch {
      // El pedido confirmado no vuelve a error por una limpieza local del formulario.
    }
    setFinalizarOpen(false);
    setDeliveryCostPreview(0);
    dispatchPedidoPendientePostCreationTasks([
      { name: 'summary', run: () => loadPendientesSummary() }
    ]);
    try {
      // La API comercial ya hizo COMMIT. En modo agente, este await garantiza
      // que la comanda idempotente quede en cola antes de devolver exito a Caja.
      await onPedidoPendienteCreated?.(response);
    } catch {
      onNotify?.(
        'COMANDA COCINA',
        `El pedido ${response?.numero_pedido || `#${idPedido}`} fue creado, pero no se pudo abrir la impresión de comanda`,
        'warning'
      );
    }
    return response;
  };

  const handleCreatePedidoPendiente = async (payload) => {
    if (creatingPedidoPendienteRef.current) {
      const error = new Error('El pedido pendiente ya se está creando.');
      error.code = 'VENTA_PENDING_SUBMIT_IN_PROGRESS';
      throw error;
    }
    if (pedidoPendienteStorageContext.invalidRecord) {
      const error = new Error(
        'Se encontró una recuperación de pedido dañada o incompatible. Revisa los pedidos recientes antes de iniciar otro.'
      );
      error.code = 'PEDIDO_PENDIENTE_REGISTRO_INVALIDO';
      throw error;
    }
    if (ventasService.isPedidoPendienteOperationLocked(pedidoPendienteOperationRef.current)) {
      const error = new Error(
        'No fue posible confirmar el resultado del pedido. El servidor podría haberlo registrado. Recupera el resultado antes de crear otro pedido.'
      );
      error.code = 'PEDIDO_PENDIENTE_RESULTADO_DESCONOCIDO';
      error.operation = pedidoPendienteOperationRef.current;
      throw error;
    }
    creatingPedidoPendienteRef.current = true;
    setCreatingPedidoPendiente(true);
    let didRevalidateContext = false;
    try {
      const { response } = await prepareAndSubmitPedidoPendiente({
        payload,
        operationId: pedidoPendienteOperationRef.current?.operationId || null,
        localContext: localPedidoContextState.ready ? localPedidoContextState.context : null,
        revalidateContext: async (currentPayload) => {
          didRevalidateContext = true;
          return revalidatePedidoPendienteContext(currentPayload);
        },
        prepareOperation: ventasService.preparePedidoPendienteOperation,
        submitOperation: onCreatePedidoPendiente,
        onPrepared: (operation) => {
          pedidoPendienteOperationRef.current = operation;
          setPedidoPendienteOperation(operation);
          if (operation.persistenceDegraded) {
            setPedidoPendienteStorageContext((current) => ({ ...current, persistenceDegraded: true }));
            onNotify?.(
              'RECUPERACIÓN LIMITADA',
              'El navegador no permite conservar de forma segura la recuperación del pedido. No cierres ni recargues esta pestaña hasta confirmar el resultado.',
              'warning'
            );
          }
        }
      });
      return finalizePedidoPendienteCreation(response);
    } catch (error) {
      const currentOperation = error?.operation || ventasService.getPedidoPendienteOperation();
      const activeOperationId = pedidoPendienteOperationRef.current?.operationId;
      if (activeOperationId && currentOperation?.operationId === activeOperationId) {
        pedidoPendienteOperationRef.current = currentOperation;
        setPedidoPendienteOperation(currentOperation);
        if (ventasService.isPedidoPendienteOperationLocked(currentOperation)) {
          setFinalizarOpen(false);
        }
      }
      if (isDefinitiveCajaSessionError(error)) {
        setPedidoContextStale(true);
        if (!didRevalidateContext) {
          try {
            await revalidatePedidoPendienteContext(payload);
          } catch {
            // El rechazo definitivo se conserva; no se reenvía automáticamente la operación.
          }
        }
      }
      throw error;
    } finally {
      creatingPedidoPendienteRef.current = false;
      setCreatingPedidoPendiente(false);
    }
  };

  const handleRecoverPedidoPendiente = async () => {
    const target = pedidoPendienteOperationLocked
      ? pedidoPendienteOperation
      : sharedPedidoPendienteOperations.find((operation) => (
          operation.status === ventasService.PEDIDO_PENDIENTE_OPERATION_STATUS.UNKNOWN
          || operation.leaseExpired
        ));
    if (!target || creatingPedidoPendienteRef.current) return;

    pedidoPendienteOperationRef.current = target;
    setPedidoPendienteOperation(target);
    creatingPedidoPendienteRef.current = true;
    setCreatingPedidoPendiente(true);
    try {
      const response = await ventasService.recoverPedidoPendienteOperation(target.operationId, {
        operationScope: target.operationScope
      });
      onNotify?.('PEDIDO RECUPERADO', 'Se confirmó el resultado del pedido pendiente.', 'success');
      await finalizePedidoPendienteCreation(response);
    } catch (error) {
      const currentOperation = error?.operation || ventasService.getPedidoPendienteOperation() || target;
      pedidoPendienteOperationRef.current = currentOperation;
      setPedidoPendienteOperation(currentOperation);
      onNotify?.(
        'RESULTADO PENDIENTE',
        String(error?.message || 'No fue posible recuperar todavía el resultado del pedido.'),
        'warning'
      );
    } finally {
      creatingPedidoPendienteRef.current = false;
      setCreatingPedidoPendiente(false);
    }
  };

  const handleAbandonPedidoPendiente = () => {
    const target = pedidoPendienteOperationLocked
      ? pedidoPendienteOperation
      : sharedPedidoPendienteOperations.find((operation) => operation.status === ventasService.PEDIDO_PENDIENTE_OPERATION_STATUS.UNKNOWN);
    if (!target || typeof window === 'undefined') return;
    const confirmed = window.confirm(
      'No se pudo confirmar si el pedido fue registrado. Si abandonas esta operación y creas otro pedido, podrías generar un duplicado. Primero revisa o recupera el pedido. ¿Deseas abandonar conscientemente esta operación?'
    );
    if (!confirmed) return;
    const abandoned = ventasService.abandonPedidoPendienteOperation(target.operationId, {
      explicit: true,
      operationScope: target.operationScope
    });
    if (!abandoned) {
      onNotify?.('OPERACIÓN ACTIVA', 'No se puede abandonar mientras exista una solicitud activa.', 'warning');
      return;
    }
    console.info('[Ventas] Operación de pedido pendiente abandonada explícitamente.', {
      ...ventasService.buildPedidoPendienteSafeLogContext(target)
    });
    pedidoPendienteOperationRef.current = null;
    setPedidoPendienteOperation(null);
    composer.resetComposer({ preserveSucursal: true, preserveSession: true, force: true });
    setFinalizarOpen(false);
    setDeliveryCostPreview(0);
    onNotify?.('OPERACIÓN ABANDONADA', 'La operación local fue liberada. Revisa pedidos antes de crear otro.', 'warning');
  };

  const visiblePedidoPendienteOperation = pedidoPendienteOperationLocked
    ? pedidoPendienteOperation
    : sharedPedidoPendienteOperations[0] || null;
  const canRecoverPedidoPendiente = Boolean(visiblePedidoPendienteOperation) && (
    visiblePedidoPendienteOperation.status === ventasService.PEDIDO_PENDIENTE_OPERATION_STATUS.UNKNOWN
    || visiblePedidoPendienteOperation.leaseExpired
  ) && visiblePedidoPendienteOperation.hasRecoveryPayload !== false;

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
      const pendingAmount = Number(response?.monto_pendiente ?? 0) || 0;
      const paymentState = String(response?.estado_pago || response?.estado_pago_control || '').trim().toUpperCase();
      const stillPending = pendingAmount > 0.009 || paymentState === 'PENDIENTE_PAGO' || paymentState === 'PENDIENTE_DE_PAGO';
      if (!stillPending) {
        try {
          await onSuccessfulPendingOrderPaymentPrint?.(response, {
            payload,
            origin: 'CAJA_PENDING_ORDER_PAYMENT'
          });
        } catch {
          onNotify?.(
            'IMPRESION FACTURA',
            'El pago se registró correctamente, pero la factura no pudo imprimirse',
            'warning'
          );
        }
      }
      void loadPendientesSummary().catch(() => undefined);
      return response;
    } finally {
      registrandoPagoPedidoRef.current = false;
      setRegistrandoPagoPedido(false);
    }
  };

  const triggerCajaPrinterDetection = useCallback(async ({
    session,
    origen,
    notifyOnResult = false
  } = {}) => {
    const sessionId = toPositiveId(session?.id_sesion_caja);
    const cajaId = toPositiveId(session?.id_caja);
    const sucursalId = toPositiveId(session?.id_sucursal || composer.selectedSucursalId || composer.selectedSucursal);
    if (!sessionId || !cajaId || !sucursalId) return null;

    try {
      const result = await printerDeviceDetectionService.detectPrintersForCaja({
        idSucursal: sucursalId,
        idCaja: cajaId,
        idSesionCaja: sessionId,
        origen
      });
      if (notifyOnResult && result?.message && !result?.skipped) {
        onNotify?.(
          'IMPRESORAS',
          result.message,
          result.status === 'CONFIGURADO' || result.status === 'YA_CONFIGURADO' ? 'success' : 'warning'
        );
      }
      return result;
    } catch {
      if (notifyOnResult) {
        onNotify?.(
          'IMPRESORAS',
          'No se pudo validar la impresora automática. Puedes continuar, pero revisa que QZ Tray esté abierto.',
          'warning'
        );
      }
      return null;
    }
  }, [composer.selectedSucursal, composer.selectedSucursalId, onNotify]);

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
      await onCatalogSucursalChange?.({ id_sucursal: session?.id_sucursal, force: true });
      await triggerCajaPrinterDetection({
        session,
        origen: 'APERTURA_CAJA',
        notifyOnResult: true
      });
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

  useEffect(() => {
    const session = cajaSesionActiva || bootstrapSesionCaja;
    const sessionId = toPositiveId(session?.id_sesion_caja);
    const cajaId = toPositiveId(session?.id_caja);
    const sucursalId = toPositiveId(session?.id_sucursal || composer.selectedSucursalId || composer.selectedSucursal);
    const detectionKey = sessionId && cajaId && sucursalId
      ? `${sucursalId}:${cajaId}:${sessionId}`
      : '';
    if (!detectionKey || lastDetectionSessionRef.current === detectionKey) return;
    lastDetectionSessionRef.current = detectionKey;
    void triggerCajaPrinterDetection({
      session: {
        id_sesion_caja: sessionId,
        id_caja: cajaId,
        id_sucursal: sucursalId
      },
      origen: 'CARGA_CAJA',
      notifyOnResult: false
    });
  }, [
    bootstrapSesionCaja,
    cajaSesionActiva,
    composer.selectedSucursal,
    composer.selectedSucursalId,
    triggerCajaPrinterDetection
  ]);

  const closeAutoModal = () => {
    if (autoModalAssigning) return;
    setAutoModalOpen(false);
  };

  const confirmAutoAsignacion = async () => {
    const idSesionCaja = Number.parseInt(String(selectedSesion || ''), 10);
    const idSucursal = toPositiveId(composer.selectedSucursalId || composer.selectedSucursal);
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
      await onCatalogSucursalChange?.({ id_sucursal: idSucursal, force: true });
      await triggerCajaPrinterDetection({
        session,
        origen: 'CARGA_CAJA',
        notifyOnResult: false
      });
      onNotify?.('CAJA ACTIVA', 'Te registraste como auxiliar de caja para esta sesión.', 'success');
    } catch (error) {
      const code = String(error?.code || error?.data?.code || '').trim().toUpperCase();
      if (isSuperAdmin && code === 'VENTAS_CAJAS_USER_ALREADY_IN_OPEN_SESSION') {
        setAutoModalError('No se pudo registrar esta sesión. Intenta recargar las sesiones de la sucursal seleccionada.');
      } else {
        setAutoModalError(toSafeMessage(error, 'No se pudo registrar la autoasignación temporal.'));
      }
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
            catalogLoading={activeCatalogLoading}
            catalogStatus={activeCatalogStatus}
            catalogStatuses={catalogStatuses}
            recipeCatalogState={recipeCatalogState}
            catalogErrors={catalogErrors}
            onRetry={retryActiveCatalog}
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
        key={`${composer.complementModal.mode}:${composer.complementModal.cartKey || composer.complementModal.row?.entityId || composer.complementModal.row?.id_receta || ''}:${composer.complementModal.open ? '1' : '0'}`}
        open={composer.complementModal.open}
        mode={composer.complementModal.mode}
        row={composer.complementModal.row}
        selected={composer.complementModal.selected}
        error={composer.complementModal.error}
        onCancel={composer.closeComplementModal}
        onConfirm={composer.confirmComplementModal}
      />
      <VentaExtrasModal
        open={composer.extrasModal.open}
        row={composer.extrasModal.row}
        options={composer.extrasModal.options}
        selected={composer.extrasModal.selected}
        loading={composer.extrasModal.loading}
        error={composer.extrasModal.error}
        formatCurrency={composer.formatCurrency}
        onCancel={composer.closeExtrasModal}
        onConfirm={composer.confirmExtrasModal}
      />
      {pedidoPendienteStorageContext.persistenceDegraded ? (
        <div className="alert alert-danger mt-3" role="alert" data-testid="pedido-pendiente-storage-degraded-alert">
          El navegador no permite conservar de forma segura la recuperación del pedido. No cierres ni recargues esta pestaña hasta confirmar el resultado.
        </div>
      ) : null}
      {pedidoPendienteStorageContext.invalidRecord ? (
        <div className="alert alert-danger mt-3" role="alert" data-testid="pedido-pendiente-storage-invalid-alert">
          Se encontró una recuperación de pedido dañada o incompatible. Revisa los pedidos recientes antes de iniciar otro.
        </div>
      ) : null}
      {pedidoPendienteStorageContext.scopeMismatch ? (
        <div className="alert alert-warning mt-3" role="alert" data-testid="pedido-pendiente-scope-mismatch-alert">
          Existe una operación pendiente perteneciente a otra sesión o sucursal. No puede recuperarse desde el contexto actual.
        </div>
      ) : null}
      {visiblePedidoPendienteOperation ? (
        <div className="alert alert-warning mt-3" role="alert" data-testid="pedido-pendiente-recovery-alert">
          <div className="fw-semibold">Resultado de pedido pendiente por confirmar</div>
          <div className="small mt-1">
            {canRecoverPedidoPendiente
              ? 'El servidor podría haber registrado el pedido. Recupera el resultado con la misma clave antes de crear o modificar otro pedido.'
              : visiblePedidoPendienteOperation.hasRecoveryPayload === false
                ? 'Existe una operación en otra pestaña. Su payload privado no se comparte; vuelve a la pestaña original o revisa los pedidos recientes.'
                : 'Existe una operación activa en esta u otra pestaña. Espera a que termine antes de intentar recuperarla.'}
          </div>
          <div className="d-flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              className="btn btn-sm btn-warning"
              onClick={handleRecoverPedidoPendiente}
              disabled={!canRecoverPedidoPendiente || creatingPedidoPendiente}
            >
              {creatingPedidoPendiente ? 'Recuperando...' : 'Recuperar pedido'}
            </button>
            {canRecoverPedidoPendiente ? (
              <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                onClick={handleAbandonPedidoPendiente}
                disabled={creatingPedidoPendiente}
              >
                Abandonar operación
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {finalizarOpen ? (
        <div inert={pedidoPendienteComposerGuarded ? true : undefined}>
          <VentaFinalizarOperacionModal
            open={finalizarOpen}
            composer={composer}
            saving={saving || creatingPedidoPendiente || pedidoPendienteComposerGuarded}
            onClose={() => {
              setFinalizarOpen(false);
              setDeliveryCostPreview(0);
            }}
            onCreatePedidoPendiente={handleCreatePedidoPendiente}
            onDeliveryCostChange={pedidoPendienteComposerGuarded ? undefined : setDeliveryCostPreview}
            onClientesRefresh={onClientesRefresh}
            onClienteCatalogUpsert={onClienteCatalogUpsert}
            clientesMeta={clientesMeta}
            clientsLoading={Boolean(catalogLoadingStates.clientsLoading)}
            clientsStatus={catalogStatuses.clientes || 'idle'}
            clientsError={catalogErrors.clientes || ''}
            pendingContextLoading={pendingOrderContextState.loading}
            pendingContextMessage={pendingOrderContextState.message}
            onNotify={onNotify}
          />
        </div>
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
