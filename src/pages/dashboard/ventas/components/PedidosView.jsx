import { useDeferredValue, useMemo, useState, useEffect, useCallback, useRef } from 'react';
import PedidosEmptyState from './PedidosEmptyState';
import CollapsibleSearchInput from '../../../../components/common/CollapsibleSearchInput';
import VentasToast from './VentasToast';
import { supabase } from '../../../../lib/supabaseClient';
import ventasService from '../../../../services/ventasService';
import VentaRegistrarPagoPedidoModal from './VentaRegistrarPagoPedidoModal';

const normalizeTextKey = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

const mapPedidoStateCode = (pedido) => {
  const estadoNombre = normalizeTextKey(pedido?.nombre_estado_pedido);
  if (estadoNombre.includes('listo_para_entrega')) return 'LISTO_PARA_ENTREGA';
  if (estadoNombre.includes('en_preparacion')) return 'EN_COCINA';
  if (estadoNombre.includes('en_cocina')) return 'EN_COCINA';
  if (estadoNombre.includes('pendiente')) return 'PENDIENTE';
  return 'PENDIENTE';
};

const cleanPedidoDescription = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.replace(/\s*\|\s*idem:[^\s|]+/i, '').trim();
};

const initialToast = {
  show: false,
  title: '',
  message: '',
  variant: 'success'
};
const initialConfirmDialog = {
  open: false,
  title: '',
  message: '',
  idPedido: null,
  estadoDestino: ''
};

const normalizePaymentCode = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');

const buildPedidoVisibleCode = (pedido) => {
  const idPedido = Number(pedido?.id_pedido ?? 0);
  const paymentCode = normalizePaymentCode(pedido?.estado_pago_control || pedido?.estado_pago);
  if ((paymentCode === 'PENDIENTE_PAGO' || paymentCode === 'PENDIENTE_DE_PAGO') && idPedido) {
    return `PED-${String(idPedido).padStart(5, '0')}`;
  }
  const rawCode = String(pedido?.codigo_pedido || pedido?.codigo_venta || '').trim();
  if (rawCode) return rawCode;
  if (!idPedido) return 'PED-S/N';
  return `PED-${String(idPedido).padStart(5, '0')}`;
};

const isPedidoPendientePago = (pedido) => {
  const code = normalizePaymentCode(pedido?.estado_pago_control || pedido?.estado_pago);
  return code === 'PENDIENTE_PAGO' || code === 'PENDIENTE_DE_PAGO';
};

const normalizePedidoForPagoModal = (pedido) => ({
  id_pedido: Number(pedido?.id_pedido ?? 0) || null,
  codigo_pedido: buildPedidoVisibleCode(pedido),
  fecha_hora_pedido: pedido?.fecha_hora_pedido || null,
  nombre_contacto: String(
    pedido?.nombre_contacto ||
    `${pedido?.nombres_cliente || ''} ${pedido?.apellidos_cliente || ''}`.trim() ||
    'Consumidor final'
  ).trim(),
  telefono_contacto: String(pedido?.telefono_contacto || '').trim(),
  telefono_normalizado: String(pedido?.telefono_normalizado || '').trim(),
  canal: pedido?.canal,
  modalidad: pedido?.modalidad,
  id_sucursal: Number(pedido?.id_sucursal ?? 0) || null,
  estado_pago: pedido?.estado_pago_control || pedido?.estado_pago,
  monto_pendiente: Number(pedido?.monto_pendiente ?? pedido?.total ?? 0) || 0,
  total: Number(pedido?.total ?? 0) || 0
});

export default function PedidosView() {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionBusyId, setActionBusyId] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [toast, setToast] = useState(initialToast);
  const [confirmDialog, setConfirmDialog] = useState(initialConfirmDialog);
  const [pagoPedidoModal, setPagoPedidoModal] = useState({ open: false, pedido: null });
  const [pagoPedidoSaving, setPagoPedidoSaving] = useState(false);
  const notifiedReadyIdsRef = useRef(new Set());
  const readyAudioRef = useRef(null);

  useEffect(() => {
    const { data } = supabase.storage
      .from('notificacion')
      .getPublicUrl('cocina-nuevo-pedido.mp3');
    const audioUrl = String(data?.publicUrl || '').trim();
    if (!audioUrl) {
      readyAudioRef.current = null;
      return undefined;
    }
    const audio = new Audio(audioUrl);
    audio.preload = 'auto';
    readyAudioRef.current = audio;
    return () => {
      if (!readyAudioRef.current) return;
      try {
        readyAudioRef.current.pause();
        readyAudioRef.current.currentTime = 0;
      } catch {
        // AM: no interrumpir flujo si el navegador restringe APIs de audio.
      }
      readyAudioRef.current = null;
    };
  }, []);

  const openToast = useCallback((title, message, variant = 'success') => {
    setToast({
      show: true,
      title: String(title || ''),
      message: String(message || ''),
      variant
    });
  }, []);

  const closeToast = useCallback(() => {
    setToast((prev) => ({ ...prev, show: false }));
  }, []);

  useEffect(() => {
    if (!toast.show) return undefined;
    const timer = window.setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 3200);
    return () => window.clearTimeout(timer);
  }, [toast.show]);

  const loadPedidos = useCallback(async ({ silent = false, source = 'manual' } = {}) => {
    try {
      if (!silent) setLoading(true);
      setErrorMessage('');
      const data = await ventasService.getPedidosMenu();
      const nextPedidos = Array.isArray(data) ? data : [];
      setPedidos((prevPedidos) => {
        if (source !== 'initial' && source !== 'manual') {
          const prevReadyIds = new Set(
            (Array.isArray(prevPedidos) ? prevPedidos : [])
              .filter((pedido) => mapPedidoStateCode(pedido) === 'LISTO_PARA_ENTREGA')
              .map((pedido) => Number(pedido?.id_pedido ?? 0))
              .filter(Boolean)
          );
          const nextReadyPedidos = nextPedidos.filter(
            (pedido) => mapPedidoStateCode(pedido) === 'LISTO_PARA_ENTREGA'
          );
          const nextReadyIds = new Set(
            nextReadyPedidos
              .map((pedido) => Number(pedido?.id_pedido ?? 0))
              .filter(Boolean)
          );
          notifiedReadyIdsRef.current.forEach((idPedido) => {
            if (nextReadyIds.has(idPedido)) return;
            notifiedReadyIdsRef.current.delete(idPedido);
          });
          nextReadyPedidos.forEach((pedido) => {
            const idPedido = Number(pedido?.id_pedido ?? 0);
            if (!idPedido) return;
            if (prevReadyIds.has(idPedido)) return;
            if (notifiedReadyIdsRef.current.has(idPedido)) return;
            notifiedReadyIdsRef.current.add(idPedido);
            const readyAudio = readyAudioRef.current;
            if (readyAudio) {
              try {
                readyAudio.currentTime = 0;
                void readyAudio.play().catch(() => {});
              } catch {
                // AM: autoplay bloqueado no debe romper Ventas/Pedidos.
              }
            }
            openToast('PEDIDO LISTO', `Pedido ${buildPedidoVisibleCode(pedido)} listo para entrega.`, 'success');
          });
        }
        return nextPedidos;
      });
    } catch (err) {
      setErrorMessage(String(err?.message || 'No se pudo cargar el tablero de pedidos.'));
      setPedidos([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [openToast]);

  useEffect(() => {
    void loadPedidos({ source: 'initial' });
  }, [loadPedidos]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (actionBusyId !== null) return;
      loadPedidos({ silent: true, source: 'poll' }).catch(() => {});
    }, 8000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [actionBusyId, loadPedidos]);

  useEffect(() => {
    const channel = supabase
      .channel('ventas-pedidos-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pedidos' },
        () => {
          if (actionBusyId !== null) return;
          loadPedidos({ silent: true, source: 'realtime' }).catch(() => {});
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [actionBusyId, loadPedidos]);

  const runPedidoAction = useCallback(async (idPedido, action) => {
    try {
      setActionBusyId(idPedido);
      setErrorMessage('');
      const response = await action();
      await loadPedidos();
      if (response?.message) {
        openToast('PEDIDO ACTUALIZADO', response.message, 'success');
      }
    } catch {
      setErrorMessage('No se pudo actualizar el pedido. Intenta nuevamente.');
      openToast('ERROR', 'No se pudo actualizar el pedido. Intenta nuevamente.', 'danger');
    } finally {
      setActionBusyId(null);
    }
  }, [loadPedidos, openToast]);

  const handleStateChange = useCallback((idPedido, estadoDestino) => (
    runPedidoAction(idPedido, () => ventasService.updatePedidoEstado(idPedido, estadoDestino))
  ), [runPedidoAction]);

  const handleCompletePedido = useCallback((pedido) => {
    const idPedido = Number(pedido?.id_pedido ?? 0);
    if (!idPedido) return;
    setConfirmDialog({
      open: true,
      title: 'Confirmar entrega',
      message: '¿Confirmas que este pedido fue entregado al cliente?',
      idPedido,
      estadoDestino: 'COMPLETADO'
    });
  }, []);

  const handleNoEntregadoPedido = useCallback((pedido) => {
    const idPedido = Number(pedido?.id_pedido ?? 0);
    if (!idPedido) return;
    setConfirmDialog({
      open: true,
      title: 'Confirmar no entregado',
      message: '¿Confirmas marcar este pedido como no entregado? Esta acción quedará registrada como dato histórico.',
      idPedido,
      estadoDestino: 'no_entregado'
    });
  }, []);

  const openPagoPedidoModal = useCallback((pedido) => {
    const normalized = normalizePedidoForPagoModal(pedido);
    if (!normalized.id_pedido) return;
    setPagoPedidoModal({ open: true, pedido: normalized });
  }, []);

  const closePagoPedidoModal = useCallback(() => {
    if (pagoPedidoSaving) return;
    setPagoPedidoModal({ open: false, pedido: null });
  }, [pagoPedidoSaving]);

  const handleRegistrarPagoPedido = useCallback(async (idPedido, payload) => {
    try {
      setPagoPedidoSaving(true);
      setErrorMessage('');
      const response = await ventasService.registrarPagoPedido(idPedido, payload);
      await loadPedidos();
      openToast('PAGO REGISTRADO', 'Pago registrado correctamente.', 'success');
      return response;
    } catch (error) {
      const message = String(error?.message || 'No se pudo registrar el pago del pedido.');
      setErrorMessage(message);
      openToast('ERROR', message, 'danger');
      throw error;
    } finally {
      setPagoPedidoSaving(false);
    }
  }, [loadPedidos, openToast]);

  const closeConfirmDialog = useCallback(() => {
    if (actionBusyId !== null) return;
    setConfirmDialog(initialConfirmDialog);
  }, [actionBusyId]);

  const confirmStateChange = useCallback(() => {
    if (!confirmDialog.idPedido || !confirmDialog.estadoDestino) {
      setConfirmDialog(initialConfirmDialog);
      return;
    }
    const idPedido = Number(confirmDialog.idPedido);
    const estadoDestino = String(confirmDialog.estadoDestino);
    setConfirmDialog(initialConfirmDialog);
    handleStateChange(idPedido, estadoDestino);
  }, [confirmDialog, handleStateChange]);

  const filteredPedidos = useMemo(() => {
    if (!deferredSearch) return pedidos;
    const q = deferredSearch.toLowerCase();
    return pedidos.filter((pedido) =>
      String(pedido?.id_pedido || '').includes(q) ||
      String(pedido?.codigo_pedido || '').toLowerCase().includes(q) ||
      String(pedido?.nombre_contacto || '').toLowerCase().includes(q) ||
      String(pedido?.telefono_contacto || '').toLowerCase().includes(q) ||
      `${pedido?.nombres_cliente || ''} ${pedido?.apellidos_cliente || ''}`.toLowerCase().includes(q) ||
      String(pedido?.descripcion_pedido || '').toLowerCase().includes(q)
    );
  }, [deferredSearch, pedidos]);

  const pendientes = useMemo(
    () => filteredPedidos.filter((pedido) => mapPedidoStateCode(pedido) === 'PENDIENTE'),
    [filteredPedidos]
  );
  const enCocina = useMemo(
    () => filteredPedidos.filter((pedido) => mapPedidoStateCode(pedido) === 'EN_COCINA'),
    [filteredPedidos]
  );
  const listos = useMemo(
    () => filteredPedidos.filter((pedido) => mapPedidoStateCode(pedido) === 'LISTO_PARA_ENTREGA'),
    [filteredPedidos]
  );

  return (
    <div className="ventas-page ventas-pedidos-page">
      <div className="inv-catpro-card inv-prod-card mb-3">
        <div className="inv-prod-header ventas-page__toolbar">
          <div className="inv-prod-title-wrap">
            <div className="inv-prod-title-row">
              <i className="bi bi-journal-richtext inv-prod-title-icon" />
              <span className="inv-prod-title">Pedidos / Validacion de pago</span>
            </div>
            <div className="inv-prod-subtitle">
              Flujo operativo: validar pago, enviar a cocina, marcar listo y entregar.
            </div>
          </div>

          <div className="inv-prod-header-actions inv-ins-header-actions ventas-page__toolbar-actions">
            <CollapsibleSearchInput
              value={search}
              onValueChange={setSearch}
              onSubmit={() => {}}
              placeholder="Buscar por ticket o cliente..."
              ariaLabel="Buscar pedidos"
              className="ventas-pedidos__search"
              disabled={loading}
            />
            <button
              className="ventas-modal__ghost-btn ms-2"
              onClick={() => void loadPedidos()}
              title="Actualizar"
              disabled={loading}
              type="button"
            >
              <i className={`bi ${loading ? 'bi-arrow-repeat spin' : 'bi-arrow-clockwise'}`} />
            </button>
          </div>
        </div>

        <div className="inv-catpro-body inv-prod-body p-3">
          <div className="ventas-pedidos__meta mb-3">
            <span>{filteredPedidos.length} pedidos visibles</span>
            {loading ? <span className="ms-3 text-muted"><i className="bi bi-hourglass-split" /> Cargando...</span> : null}
          </div>

          {errorMessage ? (
            <div className="alert alert-warning mb-3" role="alert">
              {errorMessage}
            </div>
          ) : null}

          <div className="ventas-pedidos__grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            <section className="ventas-pedidos__lane">
              <header className="ventas-pedidos__lane-head">
                <div>
                  <span className="ventas-pedidos__lane-dot" style={{ background: '#f59e0b' }} />
                  <strong>Pendientes / Validacion de pago</strong>
                </div>
                <span className="ventas-pedidos__lane-count">{pendientes.length}</span>
              </header>
              <div className="ventas-pedidos__lane-body mt-2">
                {pendientes.length === 0 ? (
                  <PedidosEmptyState title="Sin pendientes" />
                ) : (
                  pendientes.map((pedido) => (
                    <PedidoCard
                      key={pedido.id_pedido}
                      pedido={pedido}
                      busy={actionBusyId === pedido.id_pedido}
                      onSendKitchen={() => handleStateChange(pedido.id_pedido, 'EN_COCINA')}
                      onCobrar={() => openPagoPedidoModal(pedido)}
                    />
                  ))
                )}
              </div>
            </section>

            <section className="ventas-pedidos__lane">
              <header className="ventas-pedidos__lane-head">
                <div>
                  <span className="ventas-pedidos__lane-dot" style={{ background: '#3b82f6' }} />
                  <strong>En Cocina</strong>
                </div>
                <span className="ventas-pedidos__lane-count">{enCocina.length}</span>
              </header>
              <div className="ventas-pedidos__lane-body mt-2">
                {enCocina.length === 0 ? (
                  <PedidosEmptyState title="Sin pedidos en cocina" />
                ) : (
                  enCocina.map((pedido) => (
                    <PedidoCard
                      key={pedido.id_pedido}
                      pedido={pedido}
                      busy={actionBusyId === pedido.id_pedido}
                      onSendReady={() => handleStateChange(pedido.id_pedido, 'LISTO_PARA_ENTREGA')}
                      onCobrar={() => openPagoPedidoModal(pedido)}
                    />
                  ))
                )}
              </div>
            </section>

            <section className="ventas-pedidos__lane">
              <header className="ventas-pedidos__lane-head">
                <div>
                  <span className="ventas-pedidos__lane-dot" style={{ background: '#10b981' }} />
                  <strong>Listo para Entrega</strong>
                </div>
                <span className="ventas-pedidos__lane-count">{listos.length}</span>
              </header>
              <div className="ventas-pedidos__lane-body mt-2">
                {listos.length === 0 ? (
                  <PedidosEmptyState title="Sin pedidos listos" />
                ) : (
                  listos.map((pedido) => (
                    <PedidoCard
                      key={pedido.id_pedido}
                      pedido={pedido}
                      busy={actionBusyId === pedido.id_pedido}
                      onComplete={() => handleCompletePedido(pedido)}
                      onNoEntregado={() => handleNoEntregadoPedido(pedido)}
                      onCobrar={() => openPagoPedidoModal(pedido)}
                    />
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
      <ConfirmActionModal
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        busy={actionBusyId !== null}
        onCancel={closeConfirmDialog}
        onConfirm={confirmStateChange}
      />
      <VentaRegistrarPagoPedidoModal
        open={pagoPedidoModal.open}
        saving={pagoPedidoSaving}
        onClose={closePagoPedidoModal}
        onRegistrarPago={handleRegistrarPagoPedido}
        initialPedido={pagoPedidoModal.pedido}
      />
      <VentasToast toast={toast} onClose={closeToast} />
    </div>
  );
}

function PedidoCard({
  pedido,
  busy = false,
  onSendKitchen,
  onSendReady,
  onComplete,
  onNoEntregado,
  onCobrar
}) {
  const clienteName = pedido?.nombres_cliente
    ? `${pedido.nombres_cliente} ${pedido.apellidos_cliente || ''}`
    : String(pedido?.nombre_contacto || 'Consumidor final').trim();
  const cleanDescription = cleanPedidoDescription(pedido?.descripcion_pedido);
  const laneCode = mapPedidoStateCode(pedido);
  const codigoPedido = buildPedidoVisibleCode(pedido);
  const pendientePago = isPedidoPendientePago(pedido);

  return (
    <div className="ventas-create-modal__cart-item mb-2">
      <div className="ventas-create-modal__cart-item-head">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
            <span className="badge bg-secondary" style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>
              {codigoPedido}
            </span>
            {pendientePago ? (
              <span className="badge bg-warning text-dark" style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>
                Pendiente de pago
              </span>
            ) : null}
          </div>
          <strong className="d-flex align-items-center gap-2">
            <span>{codigoPedido} - {clienteName}</span>
          </strong>
          <small className="text-muted">
            <i className="bi bi-clock" /> {new Date(pedido.fecha_hora_pedido).toLocaleTimeString()}
          </small>
        </div>
        <div className="ventas-create-modal__line-total" style={{ fontSize: '1.1rem' }}>
          L {Number(pedido.total || 0).toFixed(2)}
        </div>
      </div>

      {cleanDescription ? (
        <div className="ventas-create-modal__cart-item-meta" style={{ fontSize: '0.85rem' }}>
          <em>{cleanDescription}</em>
        </div>
      ) : null}

      <div className="ventas-create-modal__cart-item-actions mt-2 justify-content-end">
        {pendientePago ? (
          <button
            className="ventas-create-modal__payment-btn is-active w-100 py-2 d-flex align-items-center justify-content-center gap-2"
            onClick={onCobrar}
            disabled={busy}
            type="button"
            style={{ minHeight: '36px', fontSize: '0.85rem' }}
          >
            {busy ? 'Procesando...' : 'Cobrar'} <i className="bi bi-cash-coin" />
          </button>
        ) : null}

        {laneCode === 'PENDIENTE' ? (
          <div className="d-grid w-100">
            <button
              className="ventas-create-modal__payment-btn is-active w-100 py-2 d-flex align-items-center justify-content-center gap-2"
              onClick={onSendKitchen}
              disabled={busy}
              type="button"
              style={{ minHeight: '36px', fontSize: '0.85rem' }}
            >
              {busy ? 'Procesando...' : 'Mandar a cocina'} <i className="bi bi-arrow-right" />
            </button>
          </div>
        ) : null}

        {laneCode === 'EN_COCINA' ? (
          <button
            className="ventas-create-modal__payment-btn is-active w-100 py-2 d-flex align-items-center justify-content-center gap-2"
            onClick={onSendReady}
            disabled={busy}
            type="button"
            style={{ minHeight: '36px', fontSize: '0.85rem' }}
          >
            {busy ? 'Procesando...' : 'Listo para entrega'} <i className="bi bi-arrow-right" />
          </button>
        ) : null}

        {laneCode === 'LISTO_PARA_ENTREGA' ? (
          <div className="d-grid w-100 gap-2">
            <button
              className="ventas-create-modal__payment-btn is-active w-100 py-2 d-flex align-items-center justify-content-center gap-2"
              onClick={onComplete}
              disabled={busy}
              type="button"
              style={{ minHeight: '36px', fontSize: '0.85rem' }}
            >
              {busy ? 'Procesando...' : 'Completar'} <i className="bi bi-check2-circle" />
            </button>
            <button
              className="w-100 py-2 d-flex align-items-center justify-content-center gap-2"
              onClick={onNoEntregado}
              disabled={busy}
              type="button"
              style={{
                minHeight: '36px',
                fontSize: '0.85rem',
                borderRadius: '10px',
                border: '1px solid #f59e0b',
                background: '#fff7ed',
                color: '#9a3412',
                fontWeight: 600
              }}
            >
              {busy ? 'Procesando...' : 'No entregado'} <i className="bi bi-x-circle" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ConfirmActionModal({ open, title, message, busy = false, onCancel, onConfirm }) {
  if (!open) return null;

  return (
    <div className="ventas-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="ventas-confirm-title">
      <div className="ventas-modal-card" style={{ maxWidth: '480px', width: '100%' }}>
        <div className="ventas-modal-header">
          <h5 className="mb-0" id="ventas-confirm-title">{title}</h5>
        </div>
        <div className="ventas-modal-body">
          <p className="mb-0">{message}</p>
        </div>
        <div className="ventas-modal-footer d-flex justify-content-end gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={onCancel}
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={busy}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
