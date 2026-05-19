import { useCallback, useEffect, useState } from 'react';
import VentaComposerCatalog from './VentaComposerCatalog';
import VentaComposerSummary from './VentaComposerSummary';
import { useVentaComposer } from '../hooks/useVentaComposer';
import cajasService from '../../../../services/cajasService';
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
          selectedSessionId={composer.temporarySessionId}
        />
      ) : null}
    </div>
  );
}
