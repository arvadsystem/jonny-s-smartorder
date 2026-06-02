import { useEffect, useMemo, useRef, useState } from 'react';
import AppSelect from '../../../../components/common/AppSelect';
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

const normalizeDivisionEstado = (value) => String(value || 'PENDIENTE').trim().toUpperCase();
const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const buildInitialSplitDivisions = () => ([
  { id: 'persona-1', etiqueta: 'Persona 1', itemIds: [] },
  { id: 'persona-2', etiqueta: 'Persona 2', itemIds: [] }
]);

const normalizeCuentaDividida = (value) => {
  const rawDivisiones = Array.isArray(value)
    ? value
    : Array.isArray(value?.divisiones)
      ? value.divisiones
      : [];
  const divisiones = rawDivisiones
    .map((division, index) => ({
      id_cuenta_division: toPositiveId(division?.id_cuenta_division),
      id_factura: toPositiveId(division?.id_factura),
      etiqueta: String(division?.etiqueta || `Persona ${index + 1}`).trim(),
      estado: normalizeDivisionEstado(division?.estado),
      total: Number(division?.total ?? 0) || 0,
      monto_pagado: Number(division?.monto_pagado ?? 0) || 0,
      monto_pendiente: Number(division?.monto_pendiente ?? division?.total ?? 0) || 0
    }))
    .filter((division) => division.id_cuenta_division);

  return {
    activa: Boolean(value?.activa) || divisiones.length > 0,
    divisiones
  };
};

const normalizePedidoItems = (value) => {
  const rows = Array.isArray(value) ? value : [];
  return rows
    .map((item, index) => ({
      id_detalle_pedido: toPositiveId(item?.id_detalle_pedido ?? item?.id_detalle),
      nombre_item: String(item?.nombre_item || item?.nombre || `Item ${index + 1}`).trim(),
      cantidad: Number(item?.cantidad ?? 1) || 1,
      precio_unitario: Number(item?.precio_unitario ?? 0) || 0,
      sub_total: Number(item?.sub_total ?? item?.subtotal_linea ?? item?.sub_total_pedido ?? 0) || 0,
      total_linea: Number(item?.total_linea ?? item?.total_pedido ?? item?.sub_total ?? 0) || 0
    }))
    .filter((item) => item.id_detalle_pedido);
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
  monto_pendiente: Number(row?.monto_pendiente ?? row?.total ?? 0) || 0,
  cuenta_dividida: normalizeCuentaDividida(row?.cuenta_dividida),
  items: normalizePedidoItems(row?.items)
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
  const [selectedDivisionId, setSelectedDivisionId] = useState('');
  const [splitDraftEnabled, setSplitDraftEnabled] = useState(false);
  const [splitDraftDivisions, setSplitDraftDivisions] = useState(buildInitialSplitDivisions);
  const [selectedDraftDivisionId, setSelectedDraftDivisionId] = useState('persona-1');
  const [loadingPedidoItems, setLoadingPedidoItems] = useState(false);
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
      setSelectedDivisionId('');
      setSplitDraftEnabled(false);
      setSplitDraftDivisions(buildInitialSplitDivisions());
      setSelectedDraftDivisionId('persona-1');
      setLoadingPedidoItems(false);
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
      setSelectedDivisionId('');
      setSplitDraftEnabled(false);
      setSplitDraftDivisions(buildInitialSplitDivisions());
      setSelectedDraftDivisionId('persona-1');
      setForm((current) => ({
        ...current,
        monto_recibido: normalized.cuenta_dividida?.activa ? '' : (current.monto_recibido || String(normalized.monto_pendiente || ''))
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
            setSelectedDivisionId('');
            setSplitDraftEnabled(false);
            setSplitDraftDivisions(buildInitialSplitDivisions());
            setSelectedDraftDivisionId('persona-1');
            setForm((current) => ({
              ...current,
              monto_recibido: matched.cuenta_dividida?.activa ? '' : (current.monto_recibido || String(matched.monto_pendiente || ''))
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
  const paymentSelectOptions = useMemo(
    () => PAYMENT_OPTIONS.map((option) => ({
      value: option.key,
      label: option.label
    })),
    []
  );
  const isCash = form.metodo_pago === 'efectivo';
  const cuentaDivisiones = Array.isArray(selectedPedido?.cuenta_dividida?.divisiones)
    ? selectedPedido.cuenta_dividida.divisiones
    : [];
  const hasCuentaDividida = Boolean(selectedPedido?.cuenta_dividida?.activa || cuentaDivisiones.length > 0);
  const pedidoItems = Array.isArray(selectedPedido?.items) ? selectedPedido.items : [];
  const assignedDraftItemIds = splitDraftDivisions.flatMap((division) => division.itemIds || []);
  const pendingDraftItemCount = pedidoItems.filter((item) => !assignedDraftItemIds.includes(item.id_detalle_pedido)).length;
  const selectedDraftDivision = splitDraftDivisions.find((division) => division.id === selectedDraftDivisionId) || null;
  const selectedDraftDivisionTotal = selectedDraftDivision
    ? selectedDraftDivision.itemIds.reduce((sum, idDetallePedido) => {
        const item = pedidoItems.find((row) => row.id_detalle_pedido === idDetallePedido);
        return roundMoney(sum + Number(item?.total_linea || 0));
      }, 0)
    : 0;
  const hasSplitDraft = Boolean(selectedPedido && !hasCuentaDividida && splitDraftEnabled);
  const selectedDivision = cuentaDivisiones.find((division) => String(division.id_cuenta_division) === String(selectedDivisionId)) || null;
  const selectedDivisionPendiente = selectedDivision && selectedDivision.estado === 'PENDIENTE' ? selectedDivision : null;
  const montoPendiente = hasCuentaDividida
    ? Number(selectedDivisionPendiente?.monto_pendiente ?? selectedDivisionPendiente?.total ?? 0) || 0
    : hasSplitDraft
      ? Number(selectedDraftDivisionTotal || 0) || 0
    : Number(selectedPedido?.monto_pendiente ?? 0) || 0;
  const montoRecibidoValue = Number(form.monto_recibido);
  const cambioEstimado = isCash && Number.isFinite(montoRecibidoValue)
    ? Math.max(montoRecibidoValue - montoPendiente, 0)
    : 0;
  const submitLabel = isSubmitting
    ? 'Guardando...'
    : hasCuentaDividida && selectedDivisionPendiente
      ? `Cobrar ${selectedDivisionPendiente.etiqueta}`
      : hasSplitDraft && selectedDraftDivision
        ? `Cobrar ${selectedDraftDivision.etiqueta || 'persona'}`
      : 'Confirmar pago';

  useEffect(() => {
    if (!open || !isCash || !selectedPedido) return;
    if (hasCuentaDividida) {
      setForm((current) => ({
        ...current,
        monto_recibido: selectedDivisionPendiente
          ? String(selectedDivisionPendiente.monto_pendiente || selectedDivisionPendiente.total || '')
          : ''
      }));
      return;
    }
    if (hasSplitDraft) {
      setForm((current) => ({
        ...current,
        monto_recibido: selectedDraftDivision ? String(selectedDraftDivisionTotal || '') : ''
      }));
      return;
    }
    setForm((current) => ({
      ...current,
      monto_recibido: current.monto_recibido || String(selectedPedido.monto_pendiente || '')
    }));
  }, [hasCuentaDividida, hasSplitDraft, isCash, open, selectedDivisionId, selectedDivisionPendiente, selectedDraftDivision, selectedDraftDivisionTotal, selectedPedido]);

  if (!open) return null;

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setLocalError('');
  };

  const loadPedidoItems = async (pedido) => {
    if (!pedido?.id_pedido || pedido.items?.length) return pedido;
    setLoadingPedidoItems(true);
    try {
      const response = await ventasService.listPedidosPendientesPago({
        search: pedido.codigo_pedido || String(pedido.id_pedido),
        id_sucursal: effectiveSucursalId || undefined,
        page: 1,
        page_size: 1,
        include_items: 1
      });
      const detailed = (Array.isArray(response?.items) ? response.items : [])
        .map(normalizePendingOrder)
        .find((row) => row.id_pedido === pedido.id_pedido);
      return detailed || pedido;
    } catch (error) {
      setLocalError(error?.message || 'No se pudieron cargar las lineas del pedido.');
      return pedido;
    } finally {
      setLoadingPedidoItems(false);
    }
  };

  const selectPedido = async (pedido) => {
    setSelectedPedido(pedido);
    const isDividido = Boolean(pedido.cuenta_dividida?.activa || (pedido.cuenta_dividida?.divisiones || []).length > 0);
    setSelectedDivisionId('');
    setSplitDraftEnabled(false);
    setSplitDraftDivisions(buildInitialSplitDivisions());
    setSelectedDraftDivisionId('persona-1');
    setLocalError('');
    setForm((current) => ({
      ...current,
      monto_recibido: isDividido ? '' : String(pedido.monto_pendiente || '')
    }));
    if (!isDividido) {
      const detailed = await loadPedidoItems(pedido);
      setSelectedPedido((current) => (
        current?.id_pedido === pedido.id_pedido ? { ...current, ...detailed } : current
      ));
    }
  };

  const toggleSplitDraft = async (enabled) => {
    setSplitDraftEnabled(enabled);
    setSplitDraftDivisions(buildInitialSplitDivisions());
    setSelectedDraftDivisionId('persona-1');
    setLocalError('');
    if (enabled && selectedPedido && !selectedPedido.items?.length) {
      const detailed = await loadPedidoItems(selectedPedido);
      setSelectedPedido((current) => (
        current?.id_pedido === selectedPedido.id_pedido ? { ...current, ...detailed } : current
      ));
    }
  };

  const addSplitDraftDivision = () => {
    setSplitDraftDivisions((current) => {
      const next = {
        id: `persona-${Date.now()}`,
        etiqueta: `Persona ${current.length + 1}`,
        itemIds: []
      };
      setSelectedDraftDivisionId(next.id);
      return [...current, next];
    });
    setLocalError('');
  };

  const updateSplitDraftDivisionLabel = (id, etiqueta) => {
    setSplitDraftDivisions((current) => current.map((division) => (
      division.id === id ? { ...division, etiqueta } : division
    )));
    setLocalError('');
  };

  const assignItemToSplitDraftDivision = (idDetallePedido, divisionId) => {
    setSplitDraftDivisions((current) => current.map((division) => {
      const withoutItem = (division.itemIds || []).filter((id) => id !== idDetallePedido);
      if (division.id !== divisionId) return { ...division, itemIds: withoutItem };
      return { ...division, itemIds: [...withoutItem, idDetallePedido] };
    }));
    setLocalError('');
  };

  const buildSplitDraftPayload = () => {
    if (!hasSplitDraft) return null;
    if (!pedidoItems.length) {
      setLocalError('No se pudieron cargar las lineas reales del pedido.');
      return null;
    }
    if (pendingDraftItemCount > 0) {
      setLocalError('Asigna todas las lineas antes de cobrar.');
      return null;
    }
    const used = new Set();
    const cuentaDividida = splitDraftDivisions.map((division, index) => {
      const itemIds = Array.isArray(division.itemIds) ? division.itemIds : [];
      if (!itemIds.length) {
        setLocalError('No se permiten personas sin lineas asignadas.');
        return null;
      }
      const items = itemIds.map((idDetallePedido) => {
        if (used.has(idDetallePedido)) {
          setLocalError('Una linea no puede estar en dos personas.');
          return null;
        }
        used.add(idDetallePedido);
        const exists = pedidoItems.some((item) => item.id_detalle_pedido === idDetallePedido);
        if (!exists) {
          setLocalError('Una linea asignada ya no existe en el pedido.');
          return null;
        }
        return { id_detalle_pedido: idDetallePedido };
      });
      if (items.some((item) => !item)) return null;
      return {
        etiqueta: normalizeOptionalText(division.etiqueta) || `Persona ${index + 1}`,
        orden: index + 1,
        items
      };
    });
    if (cuentaDividida.some((division) => !division)) return null;
    const selectedIndex = splitDraftDivisions.findIndex((division) => division.id === selectedDraftDivisionId);
    if (selectedIndex < 0 || !splitDraftDivisions[selectedIndex]?.itemIds?.length) {
      setLocalError('Selecciona la persona que vas a cobrar primero.');
      return null;
    }
    return {
      cuenta_dividida: cuentaDividida,
      cobrar_division_orden: selectedIndex + 1
    };
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
    if (hasCuentaDividida && !selectedDivisionPendiente) {
      setLocalError('Selecciona una persona pendiente para cobrar.');
      submitRef.current = false;
      setLocalSaving(false);
      return;
    }
    if (selectedDivision && selectedDivision.estado !== 'PENDIENTE') {
      setLocalError('Selecciona una persona pendiente para cobrar.');
      submitRef.current = false;
      setLocalSaving(false);
      return;
    }
    const splitDraftPayload = hasSplitDraft ? buildSplitDraftPayload() : null;
    if (hasSplitDraft && !splitDraftPayload) {
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
        id_sesion_caja: toPositiveId(selectedSessionId),
        id_cuenta_division: selectedDivisionPendiente ? Number(selectedDivisionPendiente.id_cuenta_division) : undefined,
        ...(splitDraftPayload || {})
      });
      setForm(INITIAL_FORM);
      setSelectedPedido(null);
      setSelectedDivisionId('');
      setSplitDraftEnabled(false);
      setSplitDraftDivisions(buildInitialSplitDivisions());
      setSelectedDraftDivisionId('persona-1');
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
    <div
      className="ventas-modal-backdrop ventas-registrar-pago-backdrop"
      role="presentation"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <section
        className="ventas-modal-card ventas-registrar-pago-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ventas-registrar-pago-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ventas-modal-header ventas-finalizar-modal__header ventas-registrar-pago-modal__header">
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
                  <span>{hasCuentaDividida || hasSplitDraft ? 'Total pendiente persona' : 'Total pendiente'}</span>
                  <strong>{formatCurrency(montoPendiente)}</strong>
                </div>
                {hasCuentaDividida ? (
                  <>
                    <div>
                      <span>Persona/subcuenta seleccionada</span>
                      <strong>{selectedDivisionPendiente ? selectedDivisionPendiente.etiqueta : 'Sin seleccionar'}</strong>
                    </div>
                    <div className="ventas-registrar-pago-modal__division-list d-grid gap-2">
                      <span>Cuenta dividida</span>
                      {cuentaDivisiones.map((division) => {
                        const isPending = division.estado === 'PENDIENTE';
                        const isSelected = String(selectedDivisionId) === String(division.id_cuenta_division);
                        return (
                          <button
                            key={division.id_cuenta_division}
                            type="button"
                            className={`btn ${isSelected ? 'btn-primary' : 'btn-outline-secondary'} ventas-registrar-pago-modal__division d-flex align-items-center justify-content-between gap-2 text-start ${!isPending ? 'opacity-75' : ''}`}
                            onClick={() => {
                              if (!isPending) return;
                              setSelectedDivisionId(String(division.id_cuenta_division));
                              if (isCash) {
                                setForm((current) => ({
                                  ...current,
                                  monto_recibido: String(division.monto_pendiente || division.total || '')
                                }));
                              }
                              setLocalError('');
                            }}
                            disabled={!isPending || isSubmitting}
                            aria-pressed={isSelected}
                          >
                            <span className="d-grid gap-1">
                              <strong>{division.etiqueta}</strong>
                              <small>{division.estado}</small>
                            </span>
                            <span className="d-grid gap-1 text-end">
                              <small>Total {formatCurrency(division.total)}</small>
                              <small>Pendiente {formatCurrency(division.monto_pendiente)}</small>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="ventas-registrar-pago-modal__split-draft ventas-cuenta-dividida">
                    <label className="ventas-cuenta-dividida__toggle">
                      <input
                        type="checkbox"
                        checked={splitDraftEnabled}
                        onChange={(event) => toggleSplitDraft(event.target.checked)}
                        disabled={loadingPedidoItems || isSubmitting}
                      />
                      <span>Dividir cuenta</span>
                    </label>

                    {splitDraftEnabled ? (
                      <>
                        <div className="ventas-cuenta-dividida__toolbar">
                          <span>Asignado: {pedidoItems.length - pendingDraftItemCount}/{pedidoItems.length}</span>
                          <strong>{loadingPedidoItems ? 'Cargando lineas...' : `Pendiente: ${pendingDraftItemCount}`}</strong>
                          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={addSplitDraftDivision} disabled={isSubmitting}>
                            <i className="bi bi-person-plus" /> Agregar persona
                          </button>
                        </div>

                        <div className="ventas-cuenta-dividida__grid">
                          {splitDraftDivisions.map((division, divisionIndex) => {
                            const selectedItems = pedidoItems.filter((item) => (division.itemIds || []).includes(item.id_detalle_pedido));
                            const divisionTotal = selectedItems.reduce((sum, item) => roundMoney(sum + Number(item.total_linea || 0)), 0);
                            const selectedForCharge = selectedDraftDivisionId === division.id;
                            return (
                              <article className="ventas-cuenta-dividida__person" key={division.id}>
                                <div className="ventas-registrar-pago-modal__split-person-head">
                                  <label className="ventas-create-modal__field">
                                    <span>Persona</span>
                                    <input
                                      type="text"
                                      value={division.etiqueta}
                                      placeholder={`Persona ${divisionIndex + 1}`}
                                      onChange={(event) => updateSplitDraftDivisionLabel(division.id, event.target.value)}
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    className={`btn btn-sm ${selectedForCharge ? 'btn-primary' : 'btn-outline-secondary'}`}
                                    onClick={() => {
                                      setSelectedDraftDivisionId(division.id);
                                      if (isCash) setForm((current) => ({ ...current, monto_recibido: String(divisionTotal || '') }));
                                      setLocalError('');
                                    }}
                                    disabled={isSubmitting}
                                  >
                                    Cobrar primero
                                  </button>
                                </div>
                                <div className="ventas-cuenta-dividida__lines">
                                  {pedidoItems.map((item, itemIndex) => {
                                    const checked = (division.itemIds || []).includes(item.id_detalle_pedido);
                                    return (
                                      <label key={`${division.id}-${item.id_detalle_pedido}`} className="ventas-cuenta-dividida__line">
                                        <input
                                          type="radio"
                                          name={`pedido-line-${item.id_detalle_pedido}`}
                                          checked={checked}
                                          onChange={() => assignItemToSplitDraftDivision(item.id_detalle_pedido, division.id)}
                                        />
                                        <span>{itemIndex + 1}. {item.nombre_item}</span>
                                        <strong>{formatCurrency(item.total_linea)}</strong>
                                      </label>
                                    );
                                  })}
                                </div>
                                <div className="ventas-cuenta-dividida__person-total">
                                  <span>Total persona</span>
                                  <strong>{formatCurrency(divisionTotal)}</strong>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            ) : (
              <div className="ventas-registrar-pago-modal__empty">Selecciona un pedido para habilitar el cobro.</div>
            )}

            <div className="ventas-finalizar-modal__grid">
              <div className="ventas-create-modal__field">
                <span>Método de pago</span>
                <AppSelect
                  value={form.metodo_pago}
                  options={paymentSelectOptions}
                  onChange={(value) => setField('metodo_pago', value)}
                  placeholder="Selecciona metodo"
                  className="app-select--warm ventas-registrar-pago-modal__select"
                />
              </div>

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
              {selectedPedido && isCash ? (
                <small>Cambio estimado: {formatCurrency(cambioEstimado)}</small>
              ) : null}
            </div>

            {localError ? <div className="ventas-create-modal__error">{localError}</div> : null}
          </section>
        </div>

        <footer className="ventas-modal-footer ventas-registrar-pago-modal__footer">
          <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={isSubmitting || !selectedPedido}>
            {submitLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}
