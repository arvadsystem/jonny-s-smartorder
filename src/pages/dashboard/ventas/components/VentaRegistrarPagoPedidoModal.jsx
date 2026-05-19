import { useEffect, useMemo, useRef, useState } from 'react';
import ventasService from '../../../../services/ventasService';
import { PAYMENT_OPTIONS } from '../hooks/useVentaComposer';
import { formatCurrency } from '../utils/ventasHelpers';

const INITIAL_FORM = {
  metodo_pago: 'efectivo',
  monto_recibido: '',
  referencia_pago: '',
  observacion_pago: ''
};

const normalizeOptionalText = (value) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text || null;
};

const toPositiveId = (value) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizePendingOrder = (row) => ({
  id_pedido: Number(row?.id_pedido ?? 0) || null,
  codigo_pedido: String(row?.codigo_pedido || `PED-${String(row?.id_pedido || '').padStart(5, '0')}`).trim(),
  fecha_hora_pedido: row?.fecha_hora_pedido || null,
  nombre_contacto: String(row?.nombre_contacto || 'Consumidor final').trim(),
  telefono_contacto: String(row?.telefono_contacto || '').trim(),
  telefono_normalizado: String(row?.telefono_normalizado || '').trim(),
  canal: String(row?.canal || 'LOCAL').trim().toUpperCase(),
  modalidad: String(row?.modalidad || 'CONSUMO_LOCAL').trim().toUpperCase(),
  id_sucursal: toPositiveId(row?.id_sucursal),
  estado_pago: String(row?.estado_pago || row?.estado_pago_control || '').trim().toUpperCase(),
  monto_pendiente: Number(row?.monto_pendiente ?? row?.total ?? 0) || 0
});

const resolvePendingOrdersErrorMessage = (error) => {
  const status = Number(error?.status || 0);
  const message = String(error?.message || '').trim();

  if (status === 403) return 'No tienes permiso para ver pendientes de esta sucursal.';
  if (status === 404 || (status === 400 && /id de venta invalido/i.test(message))) {
    return 'Endpoint de pendientes no disponible.';
  }
  if (status >= 500) return 'No se pudieron cargar los pendientes por un error del servidor.';
  if (message) return `No se pudieron cargar los pendientes: ${message}`;
  return 'No se pudieron cargar los pendientes.';
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

export default function VentaRegistrarPagoPedidoModal({
  open,
  saving,
  onClose,
  onRegistrarPago,
  selectedSucursalId,
  selectedSessionId,
  initialPedido
}) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [localError, setLocalError] = useState('');
  const [search, setSearch] = useState('');
  const [loadingPedidos, setLoadingPedidos] = useState(false);
  const [pedidosError, setPedidosError] = useState('');
  const [pedidos, setPedidos] = useState([]);
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [localSaving, setLocalSaving] = useState(false);
  const submitRef = useRef(false);
  const initialPedidoId = toPositiveId(initialPedido?.id_pedido);
  const effectiveSucursalId = toPositiveId(selectedSucursalId) || toPositiveId(initialPedido?.id_sucursal);
  const isSubmitting = saving || localSaving;

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !isSubmitting) onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isSubmitting, onClose, open]);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setPedidos([]);
      setSelectedPedido(null);
      setForm(INITIAL_FORM);
      setLocalError('');
      setPedidosError('');
      setLocalSaving(false);
      submitRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!open || !initialPedidoId) return;

    const normalized = normalizePendingOrder(initialPedido);
    setSearch(normalized.codigo_pedido || String(initialPedidoId));
    if (normalized.id_pedido) {
      setSelectedPedido(normalized);
      setForm((current) => ({
        ...current,
        monto_recibido: current.monto_recibido || String(normalized.monto_pendiente || '')
      }));
    }
    setLocalError('');
    setPedidosError('');
  }, [initialPedido, initialPedidoId, open]);

  useEffect(() => {
    if (!open) return undefined;

    let active = true;
    const timer = window.setTimeout(async () => {
      setLoadingPedidos(true);
      setPedidosError('');
      try {
        const response = await ventasService.listPedidosPendientesPago({
          search,
          id_sucursal: effectiveSucursalId || undefined,
          page: 1,
          page_size: 10
        });
        if (!active) return;
        const rows = (Array.isArray(response?.items) ? response.items : [])
          .map(normalizePendingOrder)
          .filter((row) => row.id_pedido);
        setPedidos(rows);
        if (initialPedidoId) {
          const matched = rows.find((row) => row.id_pedido === initialPedidoId);
          if (matched) {
            setSelectedPedido(matched);
            setForm((current) => ({
              ...current,
              monto_recibido: current.monto_recibido || String(matched.monto_pendiente || '')
            }));
          }
        }
      } catch (error) {
        if (!active) return;
        setPedidos([]);
        setPedidosError(resolvePendingOrdersErrorMessage(error));
        if (Number(error?.status || 0) >= 500) {
          console.error('[Ventas] Error cargando pedidos pendientes de pago', error);
        } else if (import.meta.env.DEV) {
          console.warn('[Ventas] No se pudieron cargar pedidos pendientes de pago', {
            status: error?.status,
            code: error?.code,
            message: error?.message
          });
        }
      } finally {
        if (active) setLoadingPedidos(false);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [effectiveSucursalId, initialPedidoId, open, search]);

  const selectedPayment = useMemo(
    () => PAYMENT_OPTIONS.find((option) => option.key === form.metodo_pago) || PAYMENT_OPTIONS[0],
    [form.metodo_pago]
  );
  const isCash = form.metodo_pago === 'efectivo';
  const montoPendiente = Number(selectedPedido?.monto_pendiente ?? 0) || 0;

  if (!open) return null;

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setLocalError('');
  };

  const selectPedido = (pedido) => {
    setSelectedPedido(pedido);
    setLocalError('');
    setForm((current) => ({
      ...current,
      monto_recibido: current.monto_recibido || String(pedido.monto_pendiente || '')
    }));
  };

  const handleSubmit = async () => {
    if (submitRef.current || saving) return;
    submitRef.current = true;
    setLocalSaving(true);
    setLocalError('');

    if (!selectedPedido?.id_pedido) {
      setLocalError('Selecciona un pedido pendiente para cobrar.');
      submitRef.current = false;
      setLocalSaving(false);
      return;
    }

    const montoRecibido = Number(form.monto_recibido);
    if (isCash && (!Number.isFinite(montoRecibido) || montoRecibido < montoPendiente)) {
      setLocalError('Monto recibido debe cubrir el total pendiente.');
      submitRef.current = false;
      setLocalSaving(false);
      return;
    }

    if (!isCash && !normalizeOptionalText(form.referencia_pago)) {
      setLocalError('Referencia es obligatoria para tarjeta o transferencia.');
      submitRef.current = false;
      setLocalSaving(false);
      return;
    }

    try {
      await onRegistrarPago(selectedPedido.id_pedido, {
        metodo_pago: form.metodo_pago.toUpperCase(),
        monto_recibido: isCash ? montoRecibido : undefined,
        referencia_pago: isCash ? null : normalizeOptionalText(form.referencia_pago),
        observacion_pago: normalizeOptionalText(form.observacion_pago),
        id_sesion_caja: toPositiveId(selectedSessionId)
      });
      setForm(INITIAL_FORM);
      setSelectedPedido(null);
      onClose();
    } catch (error) {
      setLocalError(
        Number(error?.status || 0) === 409
          ? 'Este pedido ya fue pagado o no está pendiente de pago.'
          : (error?.message || 'No se pudo registrar el pago del pedido.')
      );
    } finally {
      submitRef.current = false;
      setLocalSaving(false);
    }
  };

  return (
    <div className="ventas-modal-backdrop" role="presentation">
      <section
        className="ventas-modal-card ventas-registrar-pago-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ventas-registrar-pago-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ventas-modal-header ventas-finalizar-modal__header">
          <div>
            <h5 id="ventas-registrar-pago-title">Registrar pago</h5>
            <p>Busca un pedido pendiente real y cobra usando su código PED.</p>
          </div>
          <button type="button" className="ventas-modal__close-btn" onClick={onClose} disabled={isSubmitting} aria-label="Cerrar">
            <i className="bi bi-x-lg" />
          </button>
        </header>

        <div className="ventas-modal-body ventas-finalizar-modal__body ventas-registrar-pago-modal__body">
          <section className="ventas-registrar-pago-modal__search-panel">
            <label className="ventas-create-modal__field">
              <span>Buscar pedido pendiente</span>
              <input
                type="search"
                value={search}
                placeholder="Buscar por PED, teléfono o cliente"
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <div className="ventas-registrar-pago-modal__results" aria-live="polite">
              {loadingPedidos ? (
                <div className="ventas-registrar-pago-modal__empty">
                  <span className="spinner-border spinner-border-sm" aria-hidden="true" /> Cargando pendientes...
                </div>
              ) : pedidosError ? (
                <div className="ventas-create-modal__error">{pedidosError}</div>
              ) : pedidos.length === 0 ? (
                <div className="ventas-registrar-pago-modal__empty">No hay pedidos pendientes de pago.</div>
              ) : (
                pedidos.map((pedido) => (
                  <article
                    key={pedido.id_pedido}
                    className={`ventas-registrar-pago-modal__pedido ${selectedPedido?.id_pedido === pedido.id_pedido ? 'is-selected' : ''}`}
                  >
                    <div className="ventas-registrar-pago-modal__pedido-main">
                      <div>
                        <strong>{pedido.codigo_pedido}</strong>
                        <span>{pedido.nombre_contacto}</span>
                      </div>
                      <span className="ventas-registrar-pago-modal__badge">Pendiente de pago</span>
                    </div>
                    <div className="ventas-registrar-pago-modal__pedido-meta">
                      <span><i className="bi bi-telephone" /> {pedido.telefono_contacto || pedido.telefono_normalizado || 'Sin teléfono'}</span>
                      <span>{pedido.modalidad}</span>
                      <span>{pedido.canal}</span>
                      <span>{formatDateTime(pedido.fecha_hora_pedido)}</span>
                    </div>
                    <div className="ventas-registrar-pago-modal__pedido-actions">
                      <strong>{formatCurrency(pedido.monto_pendiente)}</strong>
                      <button type="button" onClick={() => selectPedido(pedido)}>
                        {selectedPedido?.id_pedido === pedido.id_pedido ? 'Seleccionado' : 'Cobrar'}
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="ventas-registrar-pago-modal__payment-panel">
            {selectedPedido ? (
              <div className="ventas-registrar-pago-modal__selected">
                <div>
                  <span>Pedido seleccionado</span>
                  <strong>{selectedPedido.codigo_pedido}</strong>
                </div>
                <div>
                  <span>Contacto</span>
                  <strong>{selectedPedido.nombre_contacto}</strong>
                </div>
                <div>
                  <span>Teléfono</span>
                  <strong>{selectedPedido.telefono_contacto || selectedPedido.telefono_normalizado || 'Sin teléfono'}</strong>
                </div>
                <div>
                  <span>Modalidad / canal</span>
                  <strong>{selectedPedido.modalidad} / {selectedPedido.canal}</strong>
                </div>
                <div className="ventas-registrar-pago-modal__selected-total">
                  <span>Total pendiente</span>
                  <strong>{formatCurrency(montoPendiente)}</strong>
                </div>
              </div>
            ) : (
              <div className="ventas-registrar-pago-modal__empty">Selecciona un pedido para habilitar el cobro.</div>
            )}

            <div className="ventas-finalizar-modal__grid">
              <label className="ventas-create-modal__field">
                <span>Método de pago</span>
                <select value={form.metodo_pago} onChange={(event) => setField('metodo_pago', event.target.value)}>
                  {PAYMENT_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>{option.label}</option>
                  ))}
                </select>
              </label>

              {isCash ? (
                <label className="ventas-create-modal__field">
                  <span>Monto recibido</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.monto_recibido}
                    onChange={(event) => setField('monto_recibido', event.target.value)}
                  />
                </label>
              ) : (
                <label className="ventas-create-modal__field">
                  <span>Referencia</span>
                  <input
                    type="text"
                    value={form.referencia_pago}
                    onChange={(event) => setField('referencia_pago', event.target.value)}
                  />
                </label>
              )}

              <label className="ventas-create-modal__field ventas-finalizar-modal__field-wide">
                <span>Observación</span>
                <input
                  type="text"
                  value={form.observacion_pago}
                  placeholder="Pago recibido en caja"
                  onChange={(event) => setField('observacion_pago', event.target.value)}
                />
              </label>
            </div>

            <div className="ventas-finalizar-modal__payment-summary">
              <span><i className={selectedPayment.icon} /> {selectedPayment.label}</span>
              <strong>{selectedPedido ? formatCurrency(montoPendiente) : 'Selecciona un pedido'}</strong>
            </div>

            {localError ? <div className="ventas-create-modal__error">{localError}</div> : null}
          </section>
        </div>

        <footer className="ventas-modal-footer d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={isSubmitting || !selectedPedido}>
            {isSubmitting ? 'Guardando...' : 'Confirmar pago'}
          </button>
        </footer>
      </section>
    </div>
  );
}
