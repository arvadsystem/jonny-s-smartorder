import { useEffect, useMemo, useRef, useState } from 'react';
import { PAYMENT_OPTIONS } from '../hooks/useVentaComposer';

const CONTACT_INITIAL = {
  nombre_contacto: '',
  telefono_contacto: '',
  canal: 'LOCAL',
  modalidad: 'CONSUMO_LOCAL',
  observacion_contexto: '',
  observacion_pago: ''
};

const DELIVERY_INITIAL = {
  nombre_receptor: '',
  telefono_receptor: '',
  direccion_entrega: '',
  referencia_entrega: '',
  costo_envio: '',
  observacion_delivery: ''
};

const buildDiscountLabel = (discount) => {
  if (!discount) return 'Sin descuento';
  const type = String(discount.nombre_tipo_descuento || '').toUpperCase();
  const value = Number(discount.valor_descuento ?? 0);
  if (type.includes('PORCENTAJE')) return `${discount.nombre_descuento} (${value.toFixed(2)}%)`;
  return `${discount.nombre_descuento} (L ${value.toFixed(2)})`;
};

const resolveMotivoPagoPendiente = ({ canal, modalidad }) => {
  if (modalidad === 'DELIVERY') return 'DELIVERY_PAGO_PENDIENTE';
  if (canal === 'TELEFONO') return 'PEDIDO_POR_LLAMADA';
  if (canal === 'WHATSAPP') return 'PEDIDO_POR_WHATSAPP';
  if (modalidad === 'RECOGER') return 'CLIENTE_PAGARA_AL_RETIRAR';
  if (modalidad === 'CONSUMO_LOCAL') return 'CLIENTE_EN_LOCAL';
  return 'AUTORIZADO_POR_CAJERO';
};

const normalizeOptionalText = (value) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text || null;
};

export default function VentaFinalizarOperacionModal({
  open,
  composer,
  saving,
  onClose,
  onCreatePedidoPendiente,
  onDeliveryCostChange
}) {
  const [activeTab, setActiveTab] = useState('pagar');
  const [contact, setContact] = useState(CONTACT_INITIAL);
  const [delivery, setDelivery] = useState(DELIVERY_INITIAL);
  const [localError, setLocalError] = useState('');
  const [paidSubmitting, setPaidSubmitting] = useState(false);
  const [pendingSubmitting, setPendingSubmitting] = useState(false);
  const paidSubmittingRef = useRef(false);
  const pendingSubmittingRef = useRef(false);
  const isSubmitting = saving || paidSubmitting || pendingSubmitting;

  const deliveryCost = useMemo(() => {
    const parsed = Number(delivery.costo_envio);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }, [delivery.costo_envio]);

  useEffect(() => {
    if (!open) return;
    onDeliveryCostChange?.(activeTab === 'pendiente' && contact.modalidad === 'DELIVERY' ? deliveryCost : 0);
  }, [activeTab, contact.modalidad, deliveryCost, onDeliveryCostChange, open]);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !isSubmitting) onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isSubmitting, onClose, open]);

  useEffect(() => {
    if (open) return;
    paidSubmittingRef.current = false;
    pendingSubmittingRef.current = false;
    setPaidSubmitting(false);
    setPendingSubmitting(false);
  }, [open]);

  if (!open) return null;

  const setContactField = (field, value) => {
    setContact((current) => ({ ...current, [field]: value }));
    setLocalError('');
  };

  const setDeliveryField = (field, value) => {
    setDelivery((current) => ({ ...current, [field]: value }));
    setLocalError('');
  };

  const validateCommon = () => {
    if (!composer.validateBaseSale()) return false;
    const needsContactName = composer.selectedClient === 'cf';
    const phoneRequired =
      contact.canal === 'TELEFONO' ||
      contact.canal === 'WHATSAPP' ||
      contact.modalidad === 'RECOGER';

    if (needsContactName && !normalizeOptionalText(contact.nombre_contacto)) {
      setLocalError('Nombre de contacto es obligatorio cuando no hay cliente seleccionado.');
      return false;
    }

    if (phoneRequired && !normalizeOptionalText(contact.telefono_contacto)) {
      setLocalError('Teléfono es obligatorio para este canal o modalidad.');
      return false;
    }

    if (activeTab === 'pendiente' && contact.modalidad === 'DELIVERY') {
      const missing = [
        ['nombre_receptor', 'Nombre receptor'],
        ['telefono_receptor', 'Teléfono receptor'],
        ['direccion_entrega', 'Direccion entrega'],
        ['referencia_entrega', 'Referencia entrega'],
        ['costo_envio', 'Costo envio']
      ].find(([field]) => !normalizeOptionalText(delivery[field]));

      if (missing) {
        setLocalError(`${missing[1]} es obligatorio para delivery.`);
        return false;
      }

      const parsedCost = Number(delivery.costo_envio);
      if (!Number.isFinite(parsedCost) || parsedCost < 0) {
        setLocalError('Costo de envio debe ser numerico y mayor o igual a 0.');
        return false;
      }
    }

    return true;
  };

  const handlePaidSubmit = async () => {
    if (paidSubmittingRef.current || saving) return;
    paidSubmittingRef.current = true;
    setPaidSubmitting(true);
    setLocalError('');
    try {
      const response = await composer.submitPaidSale();
      if (response) onClose();
    } finally {
      paidSubmittingRef.current = false;
      setPaidSubmitting(false);
    }
  };

  const handlePendingSubmit = async () => {
    if (pendingSubmittingRef.current || saving) return;
    pendingSubmittingRef.current = true;
    setPendingSubmitting(true);
    setLocalError('');

    try {
      if (!validateCommon()) return;

      const modalidad = contact.modalidad;
      const canal = contact.canal;
      const payload = composer.buildPedidoPendientePayload({
        contacto: {
          nombre_contacto: normalizeOptionalText(contact.nombre_contacto),
          telefono_contacto: normalizeOptionalText(contact.telefono_contacto),
          dni: null,
          rtn: null,
          correo: null
        },
        contexto: {
          canal,
          modalidad,
          observacion_contexto: normalizeOptionalText(contact.observacion_contexto)
        },
        pagoPendiente: {
          motivo: resolveMotivoPagoPendiente({ canal, modalidad }),
          observacion_pago: normalizeOptionalText(contact.observacion_pago)
        },
        delivery: modalidad === 'DELIVERY'
          ? {
              costo_envio: deliveryCost,
              nombre_receptor: normalizeOptionalText(delivery.nombre_receptor),
              telefono_receptor: normalizeOptionalText(delivery.telefono_receptor),
              direccion_entrega: normalizeOptionalText(delivery.direccion_entrega),
              referencia_entrega: normalizeOptionalText(delivery.referencia_entrega),
              observacion_delivery: normalizeOptionalText(delivery.observacion_delivery)
            }
          : null
      });

      await onCreatePedidoPendiente(payload);
      composer.resetComposer();
      setContact(CONTACT_INITIAL);
      setDelivery(DELIVERY_INITIAL);
      onDeliveryCostChange?.(0);
      onClose();
    } catch (error) {
      setLocalError(error?.message || 'No se pudo crear el pedido pendiente.');
    } finally {
      pendingSubmittingRef.current = false;
      setPendingSubmitting(false);
    }
  };

  const selectedPayment = PAYMENT_OPTIONS.find((option) => option.key === composer.paymentMethod) || PAYMENT_OPTIONS[0];
  const totalWithDelivery = composer.total + (activeTab === 'pendiente' && contact.modalidad === 'DELIVERY' ? deliveryCost : 0);

  return (
    <div className="ventas-modal-backdrop" role="presentation">
      <section
        className="ventas-modal-card ventas-finalizar-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ventas-finalizar-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ventas-modal-header ventas-finalizar-modal__header">
          <div>
            <h5 id="ventas-finalizar-title">Finalizar operación</h5>
            <p>Selecciona si el pedido se paga ahora o queda pendiente.</p>
          </div>
          <button type="button" className="ventas-modal__close-btn" onClick={onClose} disabled={isSubmitting} aria-label="Cerrar">
            <i className="bi bi-x-lg" />
          </button>
        </header>

        <div className="ventas-finalizar-modal__tabs" role="tablist" aria-label="Tipo de operación">
          <button
            type="button"
            className={activeTab === 'pagar' ? 'is-active' : ''}
            onClick={() => setActiveTab('pagar')}
          >
            <i className="bi bi-credit-card" /> Pagar ahora
          </button>
          <button
            type="button"
            className={activeTab === 'pendiente' ? 'is-active' : ''}
            onClick={() => setActiveTab('pendiente')}
          >
            <i className="bi bi-clock-history" /> Pago pendiente
          </button>
        </div>

        <div className="ventas-modal-body ventas-finalizar-modal__body">
          <div className="ventas-finalizar-modal__grid">
            <label className="ventas-create-modal__field">
              <span>Cliente</span>
              <select value={composer.selectedClient} onChange={(event) => composer.setSelectedClient(event.target.value)}>
                {composer.clientes.map((cliente) => (
                  <option key={cliente.value || 'cf'} value={cliente.value || 'cf'}>
                    {cliente.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="ventas-create-modal__field">
              <span>Nombre contacto</span>
              <input
                type="text"
                value={contact.nombre_contacto}
                onChange={(event) => setContactField('nombre_contacto', event.target.value)}
                required={composer.selectedClient === 'cf'}
              />
            </label>

            <label className="ventas-create-modal__field">
              <span>Teléfono</span>
              <input
                type="text"
                value={contact.telefono_contacto}
                onChange={(event) => setContactField('telefono_contacto', event.target.value)}
              />
            </label>

            <label className="ventas-create-modal__field">
              <span>Canal</span>
              <select value={contact.canal} onChange={(event) => setContactField('canal', event.target.value)}>
                <option value="LOCAL">LOCAL</option>
                <option value="TELEFONO">TELEFONO</option>
                <option value="WHATSAPP">WHATSAPP</option>
              </select>
            </label>

            <label className="ventas-create-modal__field">
              <span>Modalidad</span>
              <select value={contact.modalidad} onChange={(event) => setContactField('modalidad', event.target.value)}>
                <option value="CONSUMO_LOCAL">CONSUMO_LOCAL</option>
                <option value="RECOGER">RECOGER</option>
                <option value="DELIVERY">DELIVERY</option>
              </select>
            </label>

            <label className="ventas-create-modal__field">
              <span>Observación</span>
              <input
                type="text"
                value={contact.observacion_contexto}
                onChange={(event) => setContactField('observacion_contexto', event.target.value)}
              />
            </label>
          </div>

          {activeTab === 'pendiente' && contact.modalidad === 'DELIVERY' ? (
            <section className="ventas-finalizar-modal__section">
              <strong>Delivery</strong>
              <div className="ventas-finalizar-modal__grid">
                <label className="ventas-create-modal__field">
                  <span>Nombre receptor</span>
                  <input type="text" value={delivery.nombre_receptor} onChange={(event) => setDeliveryField('nombre_receptor', event.target.value)} />
                </label>
                <label className="ventas-create-modal__field">
                  <span>Teléfono receptor</span>
                  <input type="text" value={delivery.telefono_receptor} onChange={(event) => setDeliveryField('telefono_receptor', event.target.value)} />
                </label>
                <label className="ventas-create-modal__field ventas-finalizar-modal__field-wide">
                  <span>Direccion entrega</span>
                  <input type="text" value={delivery.direccion_entrega} onChange={(event) => setDeliveryField('direccion_entrega', event.target.value)} />
                </label>
                <label className="ventas-create-modal__field ventas-finalizar-modal__field-wide">
                  <span>Referencia entrega</span>
                  <input type="text" value={delivery.referencia_entrega} onChange={(event) => setDeliveryField('referencia_entrega', event.target.value)} />
                </label>
                <label className="ventas-create-modal__field">
                  <span>Costo envio</span>
                  <input type="number" min="0" step="0.01" value={delivery.costo_envio} onChange={(event) => setDeliveryField('costo_envio', event.target.value)} />
                </label>
                <label className="ventas-create-modal__field">
                  <span>Observación delivery</span>
                  <input type="text" value={delivery.observacion_delivery} onChange={(event) => setDeliveryField('observacion_delivery', event.target.value)} />
                </label>
              </div>
            </section>
          ) : null}

          {activeTab === 'pagar' ? (
            <section className="ventas-finalizar-modal__section">
              <strong>Pago</strong>
              <div className="ventas-finalizar-modal__grid">
                <label className="ventas-create-modal__field">
                  <span>Método de pago</span>
                  <select value={composer.paymentMethod} onChange={(event) => composer.setPaymentMethod(event.target.value)}>
                    {PAYMENT_OPTIONS.map((option) => (
                      <option key={option.key} value={option.key}>{option.label}</option>
                    ))}
                  </select>
                </label>

                {composer.canApplyDiscount ? (
                  <label className="ventas-create-modal__field">
                    <span>Descuento</span>
                    <select value={composer.selectedDiscountId} onChange={(event) => composer.setSelectedDiscountId(event.target.value)}>
                      <option value="">Sin descuento</option>
                      {composer.descuentoGlobalOptions.map((discount) => (
                        <option key={discount.id_descuento_catalogo} value={String(discount.id_descuento_catalogo)}>
                          {buildDiscountLabel(discount)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {composer.paymentMethod === 'efectivo' ? (
                  <label className="ventas-create-modal__field">
                    <span>Monto recibido</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={composer.cashReceived}
                      placeholder={String(composer.total.toFixed(2))}
                      onChange={(event) => composer.setCashReceived(event.target.value)}
                    />
                  </label>
                ) : (
                  <label className="ventas-create-modal__field">
                    <span>Referencia</span>
                    <input
                      type="text"
                      value={composer.referenciaPago}
                      onChange={(event) => composer.setReferenciaPago(event.target.value)}
                      required
                    />
                  </label>
                )}

                <div className="ventas-finalizar-modal__payment-summary">
                  <span><i className={selectedPayment.icon} /> {selectedPayment.label}</span>
                  <strong>Cambio: {composer.formatCurrency(composer.change)}</strong>
                </div>
              </div>
            </section>
          ) : (
            <section className="ventas-finalizar-modal__section">
              <strong>Pago pendiente</strong>
              <label className="ventas-create-modal__field">
                <span>Observación pago</span>
                <input
                  type="text"
                  value={contact.observacion_pago}
                  placeholder="Pagara despues"
                  onChange={(event) => setContactField('observacion_pago', event.target.value)}
                />
              </label>
            </section>
          )}

          <div className="ventas-finalizar-modal__total">
            <span>Total</span>
            <strong>{composer.formatCurrency(totalWithDelivery)}</strong>
          </div>

          {(localError || composer.submitError) ? (
            <div className="ventas-create-modal__error">{localError || composer.submitError}</div>
          ) : null}
        </div>

        <footer className="ventas-modal-footer d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </button>
          {activeTab === 'pagar' ? (
            <button type="button" className="btn btn-primary" onClick={handlePaidSubmit} disabled={!composer.canSubmit || isSubmitting}>
              {paidSubmitting || saving ? 'Guardando...' : 'Confirmar pago y enviar pedido'}
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={handlePendingSubmit} disabled={isSubmitting}>
              {pendingSubmitting || saving ? 'Creando...' : 'Crear pedido pendiente'}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
