import { useEffect, useMemo, useRef, useState } from 'react';
import AppSelect from '../../../../components/common/AppSelect';
import ventasService from '../../../../services/ventasService';
import { PAYMENT_OPTIONS } from '../hooks/useVentaComposer';
import ClienteQuickCreateModal from './ClienteQuickCreateModal';

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

const normalizePhoneText = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const normalizePhoneDigits = (value) => String(value || '').replace(/\D/g, '');

const cleanMoneyInput = (value) => {
  const cleaned = String(value || '').replace(/[^\d.]/g, '');
  const [integerPart, ...decimalParts] = cleaned.split('.');
  const decimals = decimalParts.join('');
  if (cleaned.startsWith('.') && decimals) return `0.${decimals.slice(0, 2)}`;
  return decimalParts.length
    ? `${integerPart}.${decimals.slice(0, 2)}`
    : integerPart;
};

const isGenericComplementError = (error) => {
  const message = String(error?.message || error?.data?.message || '').toLowerCase();
  return message.includes('complementos requeridos') && message.includes('este item');
};

const resolveSubmitErrorMessage = (error, fallback) => {
  const code = String(error?.code || error?.data?.code || '').trim().toUpperCase();
  const message = String(
    typeof error === 'string' ? error : (error?.message || error?.data?.message || fallback || '')
  ).trim();
  if (code === 'VENTAS_DESCUENTO_ITEM_NO_APLICA' || message.toLowerCase().includes('el descuento no aplica')) {
    return 'El descuento seleccionado ya no aplica a uno de los items. Revisa los descuentos del carrito e intenta nuevamente.';
  }
  return message || fallback;
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
  const [submitDialogError, setSubmitDialogError] = useState('');
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreateSearch, setQuickCreateSearch] = useState('');
  const [phoneSaveDialog, setPhoneSaveDialog] = useState({
    open: false,
    pendingAction: '',
    telefono: '',
    cliente: null,
    saving: false,
    error: ''
  });
  const [paidSubmitting, setPaidSubmitting] = useState(false);
  const [pendingSubmitting, setPendingSubmitting] = useState(false);
  const paidSubmittingRef = useRef(false);
  const pendingSubmittingRef = useRef(false);
  const paidErrorPendingRef = useRef(false);
  const lastAutoPhoneRef = useRef('');
  const phoneSaveAskedRef = useRef(new Set());
  const phoneSaveBypassRef = useRef(false);
  const isSubmitting = saving || paidSubmitting || pendingSubmitting;

  const deliveryCost = useMemo(() => {
    if (!String(delivery.costo_envio || '').trim()) return 0;
    const parsed = Number(delivery.costo_envio);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }, [delivery.costo_envio]);

  useEffect(() => {
    if (!open) return;
    const selectedValue = String(composer.selectedClient || '');
    if (!selectedValue) return;

    const selected = (Array.isArray(composer.clientes) ? composer.clientes : []).find((cliente) => {
      const clienteValue = String(cliente?.value ?? cliente?.id_cliente ?? '');
      return clienteValue === selectedValue;
    });
    if (!selected || selected.es_consumidor_final) return;

    const nextPhone = normalizePhoneText(selected.telefono);
    if (!nextPhone) return;

    setContact((current) => {
      const currentPhone = normalizePhoneText(current.telefono_contacto);
      if (currentPhone && currentPhone !== lastAutoPhoneRef.current) return current;
      lastAutoPhoneRef.current = nextPhone;
      return {
        ...current,
        telefono_contacto: nextPhone
      };
    });
  }, [composer.clientes, composer.selectedClient, open]);

  useEffect(() => {
    if (!open) return;
    onDeliveryCostChange?.(activeTab === 'pendiente' && contact.modalidad === 'DELIVERY' ? deliveryCost : 0);
  }, [activeTab, contact.modalidad, deliveryCost, onDeliveryCostChange, open]);

  useEffect(() => {
    if (!open || activeTab !== 'pagar') return;
  }, [activeTab, open]);

  useEffect(() => {
    if (!open || activeTab !== 'pagar' || contact.modalidad !== 'DELIVERY') return;
    setContact((current) => ({
      ...current,
      modalidad: 'CONSUMO_LOCAL'
    }));
    setDelivery(DELIVERY_INITIAL);
    onDeliveryCostChange?.(0);
  }, [activeTab, contact.modalidad, onDeliveryCostChange, open]);

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
    setSubmitDialogError('');
    paidErrorPendingRef.current = false;
    lastAutoPhoneRef.current = '';
    phoneSaveAskedRef.current = new Set();
    phoneSaveBypassRef.current = false;
    setPhoneSaveDialog({ open: false, pendingAction: '', telefono: '', cliente: null, saving: false, error: '' });
  }, [open]);

  useEffect(() => {
    if (!open || !paidErrorPendingRef.current || !composer.submitError) return;
    paidErrorPendingRef.current = false;
    setSubmitDialogError(resolveSubmitErrorMessage(composer.submitError, 'No se pudo registrar la venta.'));
  }, [composer.submitError, open]);

  if (!open) return null;

  const setContactField = (field, value) => {
    setContact((current) => ({ ...current, [field]: value }));
    setLocalError('');
  };

  const setDeliveryField = (field, value) => {
    setDelivery((current) => ({ ...current, [field]: value }));
    setLocalError('');
  };

  const shouldAskToSaveClientPhone = (pendingAction) => {
    if (phoneSaveBypassRef.current) {
      phoneSaveBypassRef.current = false;
      return false;
    }
    if (!hasRegisteredClient) return false;
    if (normalizePhoneText(selectedCliente?.telefono)) return false;
    const telefono = normalizePhoneText(contact.telefono_contacto);
    const telefonoDigits = normalizePhoneDigits(telefono);
    if (telefonoDigits.length !== 8) return false;
    const key = `${selectedClienteId}:${telefonoDigits}`;
    if (phoneSaveAskedRef.current.has(key)) return false;
    phoneSaveAskedRef.current.add(key);
    setPhoneSaveDialog({
      open: true,
      pendingAction,
      telefono,
      cliente: selectedCliente,
      saving: false,
      error: ''
    });
    return true;
  };

  const continuePhoneSaveAction = (pendingAction) => {
    phoneSaveBypassRef.current = true;
    if (pendingAction === 'pagar') {
      void handlePaidSubmit();
      return;
    }
    void handlePendingSubmit();
  };

  const handlePhoneSaveCancel = () => {
    setPhoneSaveDialog({ open: false, pendingAction: '', telefono: '', cliente: null, saving: false, error: '' });
  };

  const handlePhoneSaveSkip = () => {
    const pendingAction = phoneSaveDialog.pendingAction;
    setPhoneSaveDialog({ open: false, pendingAction: '', telefono: '', cliente: null, saving: false, error: '' });
    continuePhoneSaveAction(pendingAction);
  };

  const handlePhoneSaveConfirm = async () => {
    const pendingAction = phoneSaveDialog.pendingAction;
    const telefono = phoneSaveDialog.telefono;
    try {
      setPhoneSaveDialog((current) => ({ ...current, saving: true, error: '' }));
      await ventasService.guardarTelefonoCliente(selectedClienteId, { telefono });
      await onClientesRefresh?.();
      setPhoneSaveDialog({ open: false, pendingAction: '', telefono: '', cliente: null, saving: false, error: '' });
      continuePhoneSaveAction(pendingAction);
    } catch (error) {
      const status = Number(error?.status ?? error?.data?.status ?? 0);
      const code = String(error?.code || error?.data?.code || '').trim().toUpperCase();
      if (status === 409 && code === 'CLIENTE_TELEFONO_EXISTENTE') {
        await onClientesRefresh?.();
        setPhoneSaveDialog({ open: false, pendingAction: '', telefono: '', cliente: null, saving: false, error: '' });
        continuePhoneSaveAction(pendingAction);
        return;
      }

      const message = resolveSubmitErrorMessage(error, 'No se pudo guardar el telefono del cliente.');
      setPhoneSaveDialog((current) => ({
        ...current,
        saving: false,
        error: status === 403
          ? 'No tienes permiso para actualizar el telefono de este cliente. Puedes continuar sin guardar.'
          : message
      }));
    }
  };

  const validateCommon = () => {
    if (!composer.validateBaseSale()) return false;
    if (
      activeTab === 'pendiente' &&
      typeof composer.validateComplementosForPending === 'function' &&
      !composer.validateComplementosForPending({ openSelector: true })
    ) {
      return false;
    }

    if (requiresPendingContactName && !normalizeOptionalText(contact.nombre_contacto)) {
      setLocalError('Nombre contacto es obligatorio para pedido pendiente sin cliente registrado.');
      return false;
    }

    const phoneRequired =
      activeTab === 'pendiente' ||
      contact.canal === 'TELEFONO' ||
      contact.canal === 'WHATSAPP' ||
      contact.modalidad === 'RECOGER';

    if (phoneRequired && !normalizeOptionalText(contact.telefono_contacto)) {
      setLocalError(activeTab === 'pendiente'
        ? 'Telefono es obligatorio para crear un pedido pendiente.'
        : 'Telefono es obligatorio para este canal o modalidad.');
      return false;
    }

    if (activeTab === 'pendiente' && contact.modalidad === 'DELIVERY') {
      const missing = [
        ['nombre_receptor', 'Nombre receptor'],
        ['telefono_receptor', 'Telefono receptor'],
        ['direccion_entrega', 'Direccion entrega'],
        ['referencia_entrega', 'Referencia entrega']
      ].find(([field]) => !normalizeOptionalText(delivery[field]));

      if (missing) {
        setLocalError(`${missing[1]} es obligatorio para delivery.`);
        return false;
      }

      const hasDeliveryCost = Boolean(String(delivery.costo_envio || '').trim());
      const parsedCost = Number(delivery.costo_envio);
      if (hasDeliveryCost && (!Number.isFinite(parsedCost) || parsedCost < 0)) {
        setLocalError('Costo de envio debe ser numerico y mayor o igual a 0.');
        return false;
      }
    }

    return true;
  };

  const handlePaidSubmit = async () => {
    if (paidSubmittingRef.current || saving) return;
    if (shouldAskToSaveClientPhone('pagar')) return;
    paidSubmittingRef.current = true;
    setPaidSubmitting(true);
    setLocalError('');
    setSubmitDialogError('');
    paidErrorPendingRef.current = true;
    try {
      const response = await composer.submitPaidSale();
      if (response) {
        paidErrorPendingRef.current = false;
        onClose();
      }
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
    setSubmitDialogError('');

    try {
      if (!validateCommon()) return;
      if (shouldAskToSaveClientPhone('pendiente')) return;

      const modalidad = contact.modalidad;
      const canal = contact.canal;
      const resolvedContactName =
        normalizeOptionalText(contact.nombre_contacto) ||
        (hasRegisteredClient ? selectedClienteLabel : null);
      const payload = composer.buildPedidoPendientePayload({
        contacto: {
          nombre_contacto: resolvedContactName,
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
              costo_envio: normalizeOptionalText(delivery.costo_envio) === null ? null : deliveryCost,
              nombre_receptor: normalizeOptionalText(delivery.nombre_receptor),
              telefono_receptor: normalizeOptionalText(delivery.telefono_receptor),
              direccion_entrega: normalizeOptionalText(delivery.direccion_entrega),
              referencia_entrega: normalizeOptionalText(delivery.referencia_entrega),
              observacion_delivery: normalizeOptionalText(delivery.observacion_delivery)
            }
          : null
      });

      await onCreatePedidoPendiente(payload);
      composer.resetComposer({ preserveSucursal: true, preserveSession: true });
      setContact(CONTACT_INITIAL);
      setDelivery(DELIVERY_INITIAL);
      lastAutoPhoneRef.current = '';
      onDeliveryCostChange?.(0);
      onClose();
    } catch (error) {
      if (isGenericComplementError(error) && typeof composer.validateComplementosForPending === 'function') {
        const blockedByComposer = !composer.validateComplementosForPending({ openSelector: true });
        setLocalError(blockedByComposer ? '' : (error?.message || 'No se pudo crear el pedido pendiente.'));
      } else {
        setSubmitDialogError(resolveSubmitErrorMessage(error, 'No se pudo crear el pedido pendiente.'));
      }
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
  const selectedCliente = (Array.isArray(composer.clientes) ? composer.clientes : []).find((cliente) => {
    const clienteValue = String(cliente?.value ?? cliente?.id_cliente ?? '');
    return clienteValue === String(composer.selectedClient || '');
  });
  const selectedClienteId = Number.parseInt(String(selectedCliente?.id_cliente ?? selectedCliente?.value ?? ''), 10);
  const hasRegisteredClient = Boolean(
    selectedCliente &&
    !selectedCliente.es_consumidor_final &&
    Number.isInteger(selectedClienteId) &&
    selectedClienteId > 0
  );
  const selectedClienteLabel = normalizeOptionalText(
    selectedCliente?.label ||
    selectedCliente?.nombre_cliente ||
    [selectedCliente?.nombre, selectedCliente?.apellido].filter(Boolean).join(' ')
  );
  const requiresPendingContactName = activeTab === 'pendiente' && !hasRegisteredClient;
  const canalOptions = [
    { value: 'LOCAL', label: 'LOCAL' },
    { value: 'TELEFONO', label: 'TELEFONO' },
    { value: 'WHATSAPP', label: 'WHATSAPP' }
  ];
  const modalidadOptions = activeTab === 'pendiente'
    ? [
        { value: 'CONSUMO_LOCAL', label: 'CONSUMO_LOCAL' },
        { value: 'RECOGER', label: 'RECOGER' },
        { value: 'DELIVERY', label: 'DELIVERY' }
      ]
    : [
        { value: 'CONSUMO_LOCAL', label: 'CONSUMO_LOCAL' },
        { value: 'RECOGER', label: 'RECOGER' }
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
      handleClienteChange(String(selected.value), refreshedClientes);
    }
    setQuickCreateOpen(false);
  };

  const handleClienteChange = (value, sourceClientes = composer.clientes) => {
    const nextValue = String(value || '');
    composer.setSelectedClient(nextValue);
    const selected = (Array.isArray(sourceClientes) ? sourceClientes : []).find((cliente) => {
      const clienteValue = String(cliente?.value ?? cliente?.id_cliente ?? '');
      return clienteValue === nextValue;
    });
    if (!selected || selected.es_consumidor_final) return;
    const nextPhone = normalizePhoneText(selected.telefono);
    if (!nextPhone) return;

    setContact((current) => {
      const currentPhone = normalizePhoneText(current.telefono_contacto);
      if (currentPhone && currentPhone !== lastAutoPhoneRef.current) return current;
      lastAutoPhoneRef.current = nextPhone;
      return {
        ...current,
        telefono_contacto: nextPhone
      };
    });
  };

  const handleCashReceivedChange = (event) => {
    composer.setCashReceived(cleanMoneyInput(event.target.value));
  };

  return (
    <div
      className="ventas-modal-backdrop ventas-finalizar-modal-backdrop"
      role="presentation"
      style={composer.complementModal.open ? { zIndex: 4100 } : undefined}
    >
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
                onChange={handleClienteChange}
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

              {activeTab === 'pendiente' ? (
                <label className="ventas-create-modal__field">
                  <span>
                    Nombre contacto
                    {requiresPendingContactName ? (
                      <abbr className="ventas-finalizar-modal__required" title="Obligatorio">*</abbr>
                    ) : null}
                  </span>
                  <input
                    type="text"
                    value={contact.nombre_contacto}
                    placeholder="Ej. Angel Perez"
                    onChange={(event) => setContactField('nombre_contacto', event.target.value)}
                    required={requiresPendingContactName}
                    aria-required={requiresPendingContactName}
                  />
                  {requiresPendingContactName ? (
                    <small className="ventas-finalizar-modal__field-hint">
                      Requerido si no seleccionas un cliente registrado.
                    </small>
                  ) : null}
                </label>
              ) : null}

              <label className="ventas-create-modal__field">
                <span>
                  Telefono
                  <abbr className="ventas-finalizar-modal__required" title="Obligatorio">*</abbr>
                </span>
                <input
                  type="text"
                  value={contact.telefono_contacto}
                  onChange={(event) => setContactField('telefono_contacto', event.target.value)}
                  required={activeTab === 'pendiente'}
                  aria-required={activeTab === 'pendiente'}
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
                  <span>Costo envio (opcional)</span>
                  <input type="number" min="0" step="0.01" value={delivery.costo_envio} onChange={(event) => setDeliveryField('costo_envio', event.target.value)} />
                </label>
                <label className="ventas-create-modal__field">
                  <span>Observacion delivery</span>
                  <input type="text" value={delivery.observacion_delivery} onChange={(event) => setDeliveryField('observacion_delivery', event.target.value)} />
                </label>
              </div>
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
                    <div className="ventas-finalizar-modal__money-field">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={composer.cashReceived}
                        placeholder="0.00"
                        onChange={handleCashReceivedChange}
                        className="ventas-finalizar-modal__money-input"
                      />
                    </div>
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

          {localError && !submitDialogError ? (
            <div className="ventas-create-modal__error">{localError}</div>
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
      {phoneSaveDialog.open ? (
        <div className="ventas-finalizar-error-backdrop" role="presentation">
          <section
            className="ventas-modal-card ventas-finalizar-error-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ventas-finalizar-phone-title"
          >
            <div className="ventas-finalizar-error-modal__icon" aria-hidden="true">
              <i className="bi bi-telephone-plus" />
            </div>
            <div className="ventas-finalizar-error-modal__copy">
              <h5 id="ventas-finalizar-phone-title">Guardar telefono del cliente</h5>
              <p>
                {selectedClienteLabel || 'Este cliente'} no tiene telefono registrado.
                ¿Deseas guardar {phoneSaveDialog.telefono} antes de continuar?
              </p>
              {phoneSaveDialog.error ? (
                <p className="ventas-finalizar-error-modal__detail">
                  {phoneSaveDialog.error}
                </p>
              ) : null}
            </div>
            <div className="ventas-modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={handlePhoneSaveCancel} disabled={phoneSaveDialog.saving}>
                Cancelar
              </button>
              <button type="button" className="btn btn-outline-primary" onClick={handlePhoneSaveSkip} disabled={phoneSaveDialog.saving}>
                Continuar sin guardar
              </button>
              <button type="button" className="btn btn-primary" onClick={handlePhoneSaveConfirm} disabled={phoneSaveDialog.saving}>
                {phoneSaveDialog.saving ? 'Guardando...' : 'Guardar y continuar'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {submitDialogError ? (
        <div className="ventas-finalizar-error-backdrop" role="presentation">
          <section
            className="ventas-modal-card ventas-finalizar-error-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="ventas-finalizar-error-title"
          >
            <div className="ventas-finalizar-error-modal__icon" aria-hidden="true">
              <i className="bi bi-exclamation-triangle" />
            </div>
            <div className="ventas-finalizar-error-modal__copy">
              <h5 id="ventas-finalizar-error-title">No se pudo completar</h5>
              <p>{submitDialogError}</p>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => setSubmitDialogError('')} autoFocus>
              Entendido
            </button>
          </section>
        </div>
      ) : null}
    </div>
  );
}
