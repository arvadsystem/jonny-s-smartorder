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

const toPositiveId = (value) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const formatDateTime = (value) => {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-HN', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
};

const buildCajaDismissKey = (assignment) => {
  const idCaja = toPositiveId(assignment?.id_caja);
  return idCaja ? `${CAJA_APERTURA_DISMISS_PREFIX}:${idCaja}` : CAJA_APERTURA_DISMISS_PREFIX;
};

const isCajaDecisionDismissed = (assignment) => {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(buildCajaDismissKey(assignment)) === '1';
  } catch {
    return false;
  }
};

const markCajaDecisionDismissed = (assignment) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(buildCajaDismissKey(assignment), '1');
  } catch {
    // Session storage puede estar deshabilitado.
  }
};

const clearCajaDecisionDismissed = (assignment) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(buildCajaDismissKey(assignment));
  } catch {
    // Session storage puede estar deshabilitado.
  }
};

const normalizeCajaSession = (row) => {
  const idSesion = toPositiveId(row?.id_sesion_caja);
  if (!idSesion) return null;
  return {
    id_sesion_caja: idSesion,
    estado_codigo: String(row?.estado_codigo || 'ABIERTA').trim().toUpperCase(),
    fecha_apertura: row?.fecha_apertura || null,
    monto_apertura: Number(row?.monto_apertura ?? 0) || 0
  };
};

const normalizeCajaAssignment = (row) => {
  const idCaja = toPositiveId(row?.id_caja);
  if (!idCaja) return null;
  const session = normalizeCajaSession(row);
  return {
    id_caja: idCaja,
    codigo_caja: String(row?.codigo_caja || '').trim(),
    nombre_caja: String(row?.nombre_caja || 'Caja asignada').trim(),
    id_sucursal: toPositiveId(row?.id_sucursal),
    nombre_sucursal: String(row?.nombre_sucursal || 'Sucursal asignada').trim(),
    puede_responsable: Boolean(row?.puede_responsable),
    puede_auxiliar: Boolean(row?.puede_auxiliar),
    ...(session || {})
  };
};

const isCajaAssignmentNotFound = (error) => {
  const code = String(error?.code || error?.data?.code || '').trim().toUpperCase();
  return Number(error?.status || 0) === 404 && code === 'CAJA_ASIGNACION_NO_ENCONTRADA';
};

const resolveCajaOpenErrorMessage = (error, fallback = 'No se pudo abrir la sesion de caja.') => {
  const status = Number(error?.status || 0);
  const code = String(error?.code || error?.data?.code || '').trim().toUpperCase();
  const message = String(error?.message || '').trim();

  if (status === 403) return 'No tienes permiso para abrir esta caja asignada.';
  if (code === 'CAJA_ASIGNACION_NO_ENCONTRADA') return 'No tienes una caja activa asignada.';
  if (code === 'CAJA_SESION_USUARIO_YA_ABIERTA') return 'Ya tienes una sesion de caja abierta.';
  if (code === 'CAJA_SESION_ABIERTA_POR_OTRO_RESPONSABLE') return 'La caja asignada ya tiene una sesion abierta por otro responsable.';
  if (status >= 500) return 'No se pudo abrir la sesion por un error del servidor.';
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
  onRegistrarPagoPedido
}) {
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
  const [cajaStatus, setCajaStatus] = useState({ loading: false, error: '' });
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [abrirSesionOpen, setAbrirSesionOpen] = useState(false);
  const [abrirSesionSaving, setAbrirSesionSaving] = useState(false);
  const [abrirSesionError, setAbrirSesionError] = useState('');
  const composerRef = useRef(null);

  const openAutoAuxiliarForSucursal = async ({ idSucursal }) => {
    if (!isSuperAdmin) return;
    setAutoModalError('');
    setAutoModalLoading(true);
    setAutoModalOpen(true);
    try {
      const rows = normalizeOpenSessions(
        await cajasService.listSesionesAbiertasSafe({ id_sucursal: idSucursal })
      );

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

  const syncComposerSession = useCallback((session) => {
    const idSesionCaja = toPositiveId(session?.id_sesion_caja);
    composerRef.current?.setTemporarySessionId(idSesionCaja ? String(idSesionCaja) : '');
  }, []);

  const loadCajaAsignada = useCallback(async () => {
    setCajaStatus({ loading: true, error: '' });
    try {
      const response = await cajasService.getMiAsignacionActiva();
      const assignment = normalizeCajaAssignment(response);
      const session = normalizeCajaSession(response);
      setCajaAsignacion(assignment);
      setCajaSesionActiva(session);
      syncComposerSession(session);
      setCajaStatus({ loading: false, error: '' });

      if (assignment && !session && !isCajaDecisionDismissed(assignment)) {
        setDecisionOpen(true);
      } else {
        setDecisionOpen(false);
      }
    } catch (error) {
      if (isCajaAssignmentNotFound(error)) {
        setCajaAsignacion(null);
        setCajaSesionActiva(null);
        syncComposerSession(null);
        setCajaStatus({ loading: false, error: '' });
        setDecisionOpen(false);
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
        error: resolveCajaAssignmentErrorMessage(error)
      });
      setDecisionOpen(false);
    }
  }, [syncComposerSession]);

  useEffect(() => {
    void loadCajaAsignada();
  }, [loadCajaAsignada]);

  const isCajaSessionError = (error) => {
    const code = String(error?.code || error?.data?.code || '').trim().toUpperCase();
    const message = String(error?.message || '').toLowerCase();
    return ['NO_ACTIVE_SESSION', 'SESSION_PARTICIPATION_REQUIRED', 'SESSION_AUTHORIZATION_REQUIRED', 'SESSION_NOT_OPEN', 'SESSION_SCOPE_MISMATCH'].includes(code)
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

  const handleCreatePedidoPendiente = async (payload) => {
    try {
      const response = await onCreatePedidoPendiente(payload);
      await loadPendientesSummary();
      return response;
    } catch (error) {
      if (isSuperAdmin && composer.selectedSucursalId && isCajaSessionError(error)) {
        await openAutoAuxiliarForSucursal({ idSucursal: composer.selectedSucursalId });
      }
      throw error;
    }
  };

  const handleRegistrarPagoPedido = async (idPedido, payload) => {
    const response = await onRegistrarPagoPedido(idPedido, payload);
    await loadPendientesSummary();
    return response;
  };

  const handleCancelDecision = () => {
    markCajaDecisionDismissed(cajaAsignacion);
    setDecisionOpen(false);
  };

  const handleAcceptDecision = () => {
    setDecisionOpen(false);
    setAbrirSesionError('');
    setAbrirSesionOpen(true);
  };

  const handleCloseAbrirSesion = () => {
    if (abrirSesionSaving) return;
    markCajaDecisionDismissed(cajaAsignacion);
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
      clearCajaDecisionDismissed(assignment);
      setDecisionOpen(false);
      setAbrirSesionOpen(false);
      setCajaStatus({ loading: false, error: '' });
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
      await cajasService.autoAsignarAuxiliarSesionSafe(idSesionCaja, { id_sucursal: idSucursal });
      composer.setTemporarySessionId(String(idSesionCaja));
      composer.setPartialState({ submitError: '' });
      setAutoModalOpen(false);
    } catch (error) {
      setAutoModalError(toSafeMessage(error, 'No se pudo registrar la autoasignación temporal.'));
    } finally {
      setAutoModalAssigning(false);
    }
  };

  return (
    <div className="ventas-page ventas-caja-page">
      <div className="inv-catpro-card inv-prod-card ventas-caja-card">
        <div className="ventas-caja__operacion-bar">
          <div>
            <strong>Caja</strong>
            <span>Selecciona items y finaliza la operacion desde el modal.</span>
          </div>
          {composer.isSuperAdmin ? (
            <label className="ventas-caja__sucursal-select">
              <i className="bi bi-shop" />
              <select
                value={composer.selectedSucursal}
                onChange={(event) => composer.setSelectedSucursal(event.target.value)}
              >
                {composer.sucursales.map((sucursal) => (
                  <option key={sucursal.id_sucursal} value={String(sucursal.id_sucursal)}>
                    {sucursal.nombre_sucursal}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="ventas-caja__sucursal-pill">
              <i className="bi bi-shop" /> {composer.selectedSucursalLabel || 'Sucursal'}
            </span>
          )}
        </div>
        <section className={`ventas-caja__session-panel ${cajaSesionActiva ? 'is-active' : ''}`}>
          <div className="ventas-caja__session-main">
            <span className="ventas-caja__session-chip">
              <i className={`bi ${cajaSesionActiva ? 'bi-check-circle-fill' : 'bi-info-circle'}`} />
              {cajaSesionActiva ? 'Caja activa' : 'No hay sesion de caja activa'}
            </span>
            <strong>{cajaAsignacion?.nombre_caja || 'Caja asignada no disponible'}</strong>
            <span>
              {cajaAsignacion
                ? `${cajaAsignacion.codigo_caja || `Caja #${cajaAsignacion.id_caja}`} - ${cajaAsignacion.nombre_sucursal || 'Sucursal'}`
                : 'Solicita al administrador una asignacion activa para operar caja.'}
            </span>
            {cajaStatus.loading ? <small>Consultando caja asignada...</small> : null}
            {cajaStatus.error ? <small className="is-error">{cajaStatus.error}</small> : null}
          </div>
          <div className="ventas-caja__session-metrics">
            <div>
              <span>Caja asignada</span>
              <strong>{cajaAsignacion?.codigo_caja || 'Sin asignacion'}</strong>
            </div>
            <div>
              <span>Sesion activa</span>
              <strong>
                {cajaSesionActiva?.id_sesion_caja
                  ? `SES-${String(cajaSesionActiva.id_sesion_caja).padStart(5, '0')}`
                  : 'Sin sesion'}
              </strong>
            </div>
            <div>
              <span>Monto apertura</span>
              <strong>{composer.formatCurrency(cajaSesionActiva?.monto_apertura || 0)}</strong>
            </div>
            <div>
              <span>Fecha apertura</span>
              <strong>{formatDateTime(cajaSesionActiva?.fecha_apertura)}</strong>
            </div>
          </div>
        </section>
        <form className="ventas-create-modal__body ventas-caja__body" onSubmit={composer.handleSubmit}>
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
            onOpenFinalize={() => {
              if (!composer.validateBaseSale()) return;
              setFinalizarOpen(true);
            }}
            onOpenRegistrarPago={() => setRegistrarPagoOpen(true)}
          />
        </form>
      </div>
      <VentaCajaAperturaDecisionModal
        open={decisionOpen}
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
          saving={saving}
          onClose={() => {
            setFinalizarOpen(false);
            setDeliveryCostPreview(0);
          }}
          onCreatePedidoPendiente={handleCreatePedidoPendiente}
          onDeliveryCostChange={setDeliveryCostPreview}
        />
      ) : null}
      {registrarPagoOpen ? (
        <VentaRegistrarPagoPedidoModal
          open={registrarPagoOpen}
          saving={saving}
          onClose={() => setRegistrarPagoOpen(false)}
          onRegistrarPago={handleRegistrarPagoPedido}
          selectedSucursalId={composer.selectedSucursalId}
          selectedSessionId={cajaSesionActiva?.id_sesion_caja || composer.temporarySessionId}
        />
      ) : null}
    </div>
  );
}
