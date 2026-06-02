import { useEffect, useMemo, useRef, useState } from 'react';
import AppSelect from '../../../../components/common/AppSelect';
import { PAYMENT_OPTIONS } from '../hooks/useVentaComposer';
import ClienteQuickCreateModal from './ClienteQuickCreateModal';

const CONTACT_INITIAL = {
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

const normalizeOptionSearchText = (cliente) => [
  cliente.label,
  cliente.nombre_cliente,
  cliente.nombre,
  cliente.apellido,
  cliente.telefono,
  cliente.id_telefono,
  cliente.dni,
  cliente.rtn,
  cliente.correo,
  cliente.id_correo
].filter(Boolean).join(' ');

const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const getLineTotal = (line) => {
  const base = Number(line?.precio_unitario || 0) * Number(line?.cantidad || 0);
  const extras = Array.isArray(line?.extras)
    ? line.extras.reduce((sum, extra) => sum + Number(extra?.subtotal || (Number(extra?.precio || 0) * Number(extra?.cantidad || 0)) || 0), 0)
    : 0;
  return roundMoney(base + extras);
};

const buildInitialSplitDivisions = () => ([
  { id: 'persona-1', etiqueta: 'Persona 1', lineKeys: [] },
  { id: 'persona-2', etiqueta: 'Persona 2', lineKeys: [] }
]);

export default function VentaFinalizarOperacionModal({
  open,
  composer,
  saving,
  onClose,
  onCreatePedidoPendiente,
  onDeliveryCostChange,
  onClientesRefresh
}) {
  const [activeTab, setActiveTab] = useState('pagar');
  const [contact, setContact] = useState(CONTACT_INITIAL);
  const [delivery, setDelivery] = useState(DELIVERY_INITIAL);
  const [localError, setLocalError] = useState('');
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreateSearch, setQuickCreateSearch] = useState('');
  const [paidSubmitting, setPaidSubmitting] = useState(false);
  const [pendingSubmitting, setPendingSubmitting] = useState(false);
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [splitDivisions, setSplitDivisions] = useState(buildInitialSplitDivisions);
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
    if (!open || activeTab !== 'pagar') return;
    setSplitEnabled(false);
    setSplitDivisions(buildInitialSplitDivisions());
  }, [activeTab, open]);

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
    setSplitEnabled(false);
    setSplitDivisions(buildInitialSplitDivisions());
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
    if (activeTab === 'pendiente' && splitEnabled && !buildCuentaDivididaPayload()) return false;
    const phoneRequired =
      contact.canal === 'TELEFONO' ||
      contact.canal === 'WHATSAPP' ||
      contact.modalidad === 'RECOGER';

    if (phoneRequired && !normalizeOptionalText(contact.telefono_contacto)) {
      setLocalError('Telefono es obligatorio para este canal o modalidad.');
      return false;
    }

    if (activeTab === 'pendiente' && contact.modalidad === 'DELIVERY') {
      const missing = [
        ['nombre_receptor', 'Nombre receptor'],
        ['telefono_receptor', 'Telefono receptor'],
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

  const cartLines = Array.isArray(composer.cart) ? composer.cart : [];
  const assignedLineKeys = splitDivisions.flatMap((division) => division.lineKeys);
  const pendingAssignCount = cartLines.filter((line) => !assignedLineKeys.includes(line.cartKey)).length;
  const buildCuentaDivididaPayload = () => {
    if (!splitEnabled) return null;
    if (cartLines.length === 0) {
      setLocalError('Agrega items antes de dividir la cuenta.');
      return null;
    }
    if (pendingAssignCount > 0) {
      setLocalError('Asigna todas las lineas antes de pagar.');
      return null;
    }
    const used = new Set();
    const payload = splitDivisions.map((division, index) => {
      const lineKeys = Array.isArray(division.lineKeys) ? division.lineKeys : [];
      if (!lineKeys.length) {
        setLocalError('No se permiten personas sin lineas asignadas.');
        return null;
      }
      const items = lineKeys.map((cartKey) => {
        if (used.has(cartKey)) {
          setLocalError('Una linea no puede estar en dos personas.');
          return null;
        }
        used.add(cartKey);
        const lineIndex = cartLines.findIndex((line) => line.cartKey === cartKey);
        if (lineIndex < 0) {
          setLocalError('Una linea asignada ya no existe en el carrito.');
          return null;
        }
        return { cart_key: cartKey, line_index: lineIndex };
      });
      if (items.some((item) => !item)) return null;
      return {
        etiqueta: normalizeOptionalText(division.etiqueta) || `Persona ${index + 1}`,
        orden: index + 1,
        items
      };
    });
    if (payload.some((division) => !division)) return null;
    return payload;
  };

  const addSplitDivision = () => {
    setSplitDivisions((current) => [
      ...current,
      { id: `persona-${Date.now()}`, etiqueta: `Persona ${current.length + 1}`, lineKeys: [] }
    ]);
    setLocalError('');
  };

  const updateSplitDivisionLabel = (id, etiqueta) => {
    setSplitDivisions((current) => current.map((division) => (
      division.id === id ? { ...division, etiqueta } : division
    )));
    setLocalError('');
  };

  const assignLineToDivision = (cartKey, divisionId) => {
    setSplitDivisions((current) => current.map((division) => {
      const withoutLine = (division.lineKeys || []).filter((key) => key !== cartKey);
      if (division.id !== divisionId) return { ...division, lineKeys: withoutLine };
      return { ...division, lineKeys: [...withoutLine, cartKey] };
    }));
    setLocalError('');
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
          nombre_contacto: null,
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
          : null,
        cuentaDividida: buildCuentaDivididaPayload() || undefined
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
  const lineDiscountValue = Number(composer.lineDiscountValue || 0);
  const globalDiscountValue = Number(composer.globalDiscountValue || 0);
  const totalDiscountValue = Number(composer.totalDiscountValue ?? composer.discountValue ?? 0);
  const extrasSubtotal = Number(composer.extrasSubtotal || 0);
  const baseSubtotal = Number(composer.baseSubtotal ?? Math.max(Number(composer.subtotal || 0) - extrasSubtotal, 0));
  const shouldShowExtrasBreakdown = extrasSubtotal > 0;
  const shouldShowDiscountBreakdown = lineDiscountValue > 0 || globalDiscountValue > 0 || totalDiscountValue > 0;
  const cartCount = Number(composer.cartCount ?? composer.cart?.length ?? 0) || 0;
  const clienteOptions = (Array.isArray(composer.clientes) ? composer.clientes : []).map((cliente) => ({
    value: String(cliente.value ?? cliente.id_cliente ?? ''),
    label: String(cliente.label ?? cliente.nombre_cliente ?? 'Cliente'),
    helperText: cliente.es_consumidor_final ? 'Venta sin cliente registrado' : '',
    searchText: normalizeOptionSearchText(cliente)
  }));
  const canalOptions = [
    { value: 'LOCAL', label: 'LOCAL' },
    { value: 'TELEFONO', label: 'TELEFONO' },
    { value: 'WHATSAPP', label: 'WHATSAPP' }
  ];
  const modalidadOptions = [
    { value: 'CONSUMO_LOCAL', label: 'CONSUMO_LOCAL' },
    { value: 'RECOGER', label: 'RECOGER' },
    { value: 'DELIVERY', label: 'DELIVERY' }
  ];
  const paymentOptions = PAYMENT_OPTIONS.map((option) => ({
    value: option.key,
    label: option.label
  }));
  const discountOptions = [
    { value: '', label: 'Sin descuento' },
    ...composer.descuentoGlobalOptions.map((discount) => ({
      value: String(discount.id_descuento_catalogo),
      label: buildDiscountLabel(discount)
    }))
  ];

  const handleClienteCreated = async ({ id_cliente: idCliente, label }) => {
    const refreshedClientes = await onClientesRefresh?.();
    const selected = (Array.isArray(refreshedClientes) ? refreshedClientes : []).find((cliente) => {
      if (idCliente && Number(cliente.id_cliente) === Number(idCliente)) return true;
      return label && String(cliente.label || '').trim().toLowerCase() === String(label).trim().toLowerCase();
    });
    if (selected?.value) {
      composer.setSelectedClient(String(selected.value));
    }
    setQuickCreateOpen(false);
  };

  return (
    <div className="ventas-modal-backdrop ventas-finalizar-modal-backdrop" role="presentation">
      <section
        className="ventas-modal-card ventas-finalizar-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ventas-finalizar-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ventas-modal-header ventas-finalizar-modal__header">
          <div className="ventas-finalizar-modal__header-copy">
            <h5 id="ventas-finalizar-title">Finalizar operacion</h5>
            <p>Selecciona si el pedido se paga ahora o queda pendiente.</p>
            <div className="ventas-finalizar-modal__summary" aria-label="Resumen de venta">
              <span>{cartCount} {cartCount === 1 ? 'item' : 'items'}</span>
              <strong>{composer.formatCurrency(totalWithDelivery)}</strong>
            </div>
          </div>
          <button type="button" className="ventas-modal__close-btn" onClick={onClose} disabled={isSubmitting} aria-label="Cerrar">
            <i className="bi bi-x-lg" />
          </button>
        </header>

        <div className="ventas-finalizar-modal__tabs" role="tablist" aria-label="Tipo de operacion">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'pagar'}
            className={activeTab === 'pagar' ? 'is-active' : ''}
            onClick={() => setActiveTab('pagar')}
          >
            <i className="bi bi-credit-card" /> Pagar ahora
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'pendiente'}
            className={activeTab === 'pendiente' ? 'is-active' : ''}
            onClick={() => setActiveTab('pendiente')}
          >
            <i className="bi bi-clock-history" /> Pago pendiente
          </button>
        </div>

        <div className="ventas-modal-body ventas-finalizar-modal__body">
          <section className="ventas-finalizar-modal__section">
            <strong>Datos del cliente y pedido</strong>
            <div className="ventas-finalizar-modal__grid">
              <AppSelect
                label="Cliente"
                value={composer.selectedClient}
                options={clienteOptions}
                onChange={composer.setSelectedClient}
                placeholder="Selecciona cliente"
                searchable
                searchPlaceholder="Buscar cliente..."
                emptyText="No se encontro ese cliente."
                createActionLabel={(query) => (query ? `Crear cliente "${query}"` : 'Crear cliente')}
                onCreateAction={(query) => {
                  setQuickCreateSearch(query);
                  setQuickCreateOpen(true);
                }}
                className="app-select--compact app-select--warm ventas-finalizar-modal__field-wide"
              />

              <label className="ventas-create-modal__field">
                <span>Telefono</span>
                <input
                  type="text"
                  value={contact.telefono_contacto}
                  onChange={(event) => setContactField('telefono_contacto', event.target.value)}
                />
              </label>

              <AppSelect
                label="Canal"
                value={contact.canal}
                options={canalOptions}
                onChange={(value) => setContactField('canal', value)}
                className="app-select--compact app-select--warm"
              />

              <AppSelect
                label="Modalidad"
                value={contact.modalidad}
                options={modalidadOptions}
                onChange={(value) => setContactField('modalidad', value)}
                className="app-select--compact app-select--warm"
              />

              <label className="ventas-create-modal__field ventas-finalizar-modal__field-wide">
                <span>Observacion</span>
                <input
                  type="text"
                  value={contact.observacion_contexto}
                  onChange={(event) => setContactField('observacion_contexto', event.target.value)}
                />
              </label>
            </div>
          </section>

          {activeTab === 'pendiente' && contact.modalidad === 'DELIVERY' ? (
            <section className="ventas-finalizar-modal__section">
              <strong>Delivery</strong>
              <div className="ventas-finalizar-modal__grid">
                <label className="ventas-create-modal__field">
                  <span>Nombre receptor</span>
                  <input type="text" value={delivery.nombre_receptor} onChange={(event) => setDeliveryField('nombre_receptor', event.target.value)} />
                </label>
                <label className="ventas-create-modal__field">
                  <span>Telefono receptor</span>
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
                  <span>Observacion delivery</span>
                  <input type="text" value={delivery.observacion_delivery} onChange={(event) => setDeliveryField('observacion_delivery', event.target.value)} />
                </label>
              </div>
            </section>
          ) : null}

          {activeTab === 'pendiente' ? (
          <section className="ventas-finalizar-modal__section ventas-cuenta-dividida">
            <label className="ventas-cuenta-dividida__toggle">
              <input
                type="checkbox"
                checked={splitEnabled}
                onChange={(event) => {
                  setSplitEnabled(event.target.checked);
                  setLocalError('');
                }}
              />
              <span>Dividir cuenta</span>
            </label>

            {splitEnabled ? (
              <>
                <div className="ventas-cuenta-dividida__toolbar">
                  <span>Asignado: {cartLines.length - pendingAssignCount}/{cartLines.length}</span>
                  <strong>Pendiente: {pendingAssignCount}</strong>
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={addSplitDivision}>
                    <i className="bi bi-person-plus" /> Agregar persona
                  </button>
                </div>

                <div className="ventas-cuenta-dividida__grid">
                  {splitDivisions.map((division, divisionIndex) => {
                    const selectedLines = cartLines.filter((line) => (division.lineKeys || []).includes(line.cartKey));
                    const divisionTotal = selectedLines.reduce((sum, line) => sum + getLineTotal(line), 0);
                    return (
                      <article className="ventas-cuenta-dividida__person" key={division.id}>
                        <label className="ventas-create-modal__field">
                          <span>Persona</span>
                          <input
                            type="text"
                            value={division.etiqueta}
                            placeholder={`Persona ${divisionIndex + 1}`}
                            onChange={(event) => updateSplitDivisionLabel(division.id, event.target.value)}
                          />
                        </label>
                        <div className="ventas-cuenta-dividida__lines">
                          {cartLines.map((line, lineIndex) => {
                            const checked = (division.lineKeys || []).includes(line.cartKey);
                            return (
                              <label key={`${division.id}-${line.cartKey}`} className="ventas-cuenta-dividida__line">
                                <input
                                  type="radio"
                                  name={`cuenta-line-${line.cartKey}`}
                                  checked={checked}
                                  onChange={() => assignLineToDivision(line.cartKey, division.id)}
                                />
                                <span>{lineIndex + 1}. {line.nombre || line.nombre_item || line.nombre_producto || 'Item'}</span>
                                <strong>{composer.formatCurrency(getLineTotal(line))}</strong>
                              </label>
                            );
                          })}
                        </div>
                        <div className="ventas-cuenta-dividida__person-total">
                          <span>Total persona</span>
                          <strong>{composer.formatCurrency(divisionTotal)}</strong>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
            ) : null}
          </section>
          ) : null}

          {activeTab === 'pagar' ? (
            <section className="ventas-finalizar-modal__section">
              <strong>Pago</strong>
              <div className="ventas-finalizar-modal__grid">
                <AppSelect
                  label="Metodo de pago"
                  value={composer.paymentMethod}
                  options={paymentOptions}
                  onChange={composer.setPaymentMethod}
                  className="app-select--compact app-select--warm"
                />

                {composer.canApplyDiscount ? (
                  <AppSelect
                    label="Descuento"
                    value={composer.selectedDiscountId}
                    options={discountOptions}
                    onChange={composer.setSelectedDiscountId}
                    className="app-select--compact app-select--warm"
                  />
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
                <span>Observacion pago</span>
                <input
                  type="text"
                  value={contact.observacion_pago}
                  placeholder="Pagara despues"
                  onChange={(event) => setContactField('observacion_pago', event.target.value)}
                />
              </label>
            </section>
          )}

          <div className="ventas-finalizar-modal__total ventas-finalizar-modal__totals-breakdown" aria-live="polite">
            {shouldShowExtrasBreakdown ? (
              <>
                <div>
                  <span>Base items</span>
                  <strong>{composer.formatCurrency(baseSubtotal)}</strong>
                </div>
                <div>
                  <span>Extras</span>
                  <strong>{composer.formatCurrency(extrasSubtotal)}</strong>
                </div>
              </>
            ) : null}
            <div>
              <span>Subtotal bruto</span>
              <strong>{composer.formatCurrency(composer.subtotal)}</strong>
            </div>
            {shouldShowDiscountBreakdown ? (
              <>
                <div>
                  <span>Descuentos por linea</span>
                  <strong>-{composer.formatCurrency(lineDiscountValue)}</strong>
                </div>
                <div>
                  <span>Descuento global</span>
                  <strong>-{composer.formatCurrency(globalDiscountValue)}</strong>
                </div>
                <div>
                  <span>Descuento total</span>
                  <strong>-{composer.formatCurrency(totalDiscountValue)}</strong>
                </div>
              </>
            ) : null}
            {activeTab === 'pendiente' && contact.modalidad === 'DELIVERY' && deliveryCost > 0 ? (
              <div>
                <span>Envio</span>
                <strong>{composer.formatCurrency(deliveryCost)}</strong>
              </div>
            ) : null}
            <div className="is-total">
              <span>Total</span>
              <strong>{composer.formatCurrency(totalWithDelivery)}</strong>
            </div>
          </div>

          {(localError || composer.submitError) ? (
            <div className="ventas-create-modal__error">{localError || composer.submitError}</div>
          ) : null}
        </div>

        <footer className="ventas-modal-footer">
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
      <ClienteQuickCreateModal
        open={quickCreateOpen}
        initialSearch={quickCreateSearch}
        idSucursal={composer.selectedSucursalId}
        onClose={() => setQuickCreateOpen(false)}
        onCreated={handleClienteCreated}
      />
    </div>
  );
}
