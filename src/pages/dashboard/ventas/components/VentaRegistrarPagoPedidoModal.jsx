import { useEffect, useMemo, useRef, useState } from 'react';
import AppSelect from '../../../../components/common/AppSelect';
import ventasService from '../../../../services/ventasService';
import { PAYMENT_OPTIONS } from '../hooks/useVentaComposer';
import { formatCurrency } from '../utils/ventasHelpers';
import CuentaDivididaDraftBuilder from './CuentaDivididaDraftBuilder';
import {
  resolveActiveDivisionAssignedItemIds,
  computeFinancialSummary,
  resolveEstadoBadges,
  resolvePendingBalanceDisplay,
  shouldAutoActivateOrphanRecovery,
  resolveSplitDraftDivisionOrden,
  resolveCobrarDivisionOrden
} from '../utils/splitPaymentModalHelpers.mjs';

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

const normalizeCuentaDivisionItems = (value) => {
  const rows = Array.isArray(value) ? value : [];
  return rows
    .map((item, index) => ({
      id_cuenta_division_item: toPositiveId(item?.id_cuenta_division_item),
      id_detalle_pedido: toPositiveId(item?.id_detalle_pedido ?? item?.id_detalle),
      nombre_item: String(item?.nombre_item || item?.nombre || `Item ${index + 1}`).trim(),
      total_linea: Number(item?.total_linea ?? item?.total_pedido ?? item?.sub_total ?? 0) || 0
    }))
    .filter((item) => item.id_detalle_pedido);
};

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
      monto_pendiente: Number(division?.monto_pendiente ?? division?.total ?? 0) || 0,
      items: normalizeCuentaDivisionItems(division?.items)
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
      total_linea: Number(item?.total_linea ?? item?.total_pedido ?? item?.sub_total ?? 0) || 0,
      descuento: Number(item?.descuento ?? 0) || 0,
      descuento_linea: Number(item?.descuento_linea ?? item?.descuento ?? 0) || 0,
      descuento_global: Number(item?.descuento_global ?? 0) || 0,
      extras: Array.isArray(item?.extras) ? item.extras : []
    }))
    .filter((item) => item.id_detalle_pedido);
};

// HOTFIX (ronda 2, correccion #2): el campo `items` del backend cambia de
// forma segun el endpoint lo haya cargado con detalle real (arreglo) o
// solo como conteo (numero) -- se conserva el conteo por separado en
// items_count para no perderlo cuando `items` no es un arreglo.
const resolveItemsCount = (row) => {
  if (Array.isArray(row?.items)) return row.items.length;
  const numeric = Number(row?.items);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
};

const normalizePendingOrder = (row) => ({
  id_pedido: Number(row?.id_pedido ?? 0) || null,
  codigo_venta_operativo: String(row?.codigo_venta_operativo || row?.codigo_venta || '').trim(),
  codigo_venta: String(row?.codigo_venta || row?.codigo_venta_operativo || '').trim(),
  codigo_pedido: String(
    row?.codigo_venta_operativo ||
      row?.codigo_venta ||
      row?.codigo_pedido ||
      (row?.id_pedido ? `VTA-${String(row.id_pedido).padStart(5, '0')}` : '')
  ).trim(),
  fecha_hora_pedido: row?.fecha_hora_pedido || null,
  nombre_contacto: String(row?.nombre_contacto || 'Consumidor final').trim(),
  telefono_contacto: String(row?.telefono_contacto || '').trim(),
  telefono_normalizado: String(row?.telefono_normalizado || '').trim(),
  canal: String(row?.canal || 'LOCAL').trim().toUpperCase(),
  modalidad: String(row?.modalidad || 'CONSUMO_LOCAL').trim().toUpperCase(),
  id_sucursal: toPositiveId(row?.id_sucursal),
  estado_pedido: String(row?.estado_pedido || '').trim().toUpperCase(),
  estado_pago: String(row?.estado_pago || row?.estado_pago_control || '').trim().toUpperCase(),
  monto_total: Number(row?.monto_total ?? row?.total ?? 0) || 0,
  monto_pagado: Number(row?.monto_pagado ?? 0) || 0,
  monto_pendiente: Number(row?.monto_pendiente ?? row?.total ?? 0) || 0,
  puede_cobrar: row?.puede_cobrar === undefined ? undefined : Boolean(row.puede_cobrar),
  items_count: resolveItemsCount(row),
  items_asignados: Number(row?.items_asignados ?? 0) || 0,
  items_sin_asignar: Number(
    row?.items_sin_asignar ?? Math.max(resolveItemsCount(row) - Number(row?.items_asignados ?? 0), 0)
  ) || 0,
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

const isPagoPedidoStillPending = (response) => {
  const pending = Number(response?.monto_pendiente ?? 0) || 0;
  const estadoPago = String(response?.estado_pago || response?.estado_pago_control || '').trim().toUpperCase();
  return pending > 0.009 || estadoPago === 'PENDIENTE_PAGO' || estadoPago === 'PENDIENTE_DE_PAGO';
};

const findNextPendingDivision = (pedido) => {
  const divisiones = Array.isArray(pedido?.cuenta_dividida?.divisiones)
    ? pedido.cuenta_dividida.divisiones
    : [];
  return divisiones.find((division) => division.estado === 'PENDIENTE') || null;
};

// HOTFIX (ronda 2, correccion #4): decide si el modo "agregar persona"
// debe activarse solo, sin que el cajero tenga que descubrir el boton
// "Agregar otra persona" -- cubre exactamente el pedido 2265 (Persona 1
// pagada, 2 lineas huerfanas, saldo>0, ninguna division PENDIENTE).
const resolveAutoActivateSplitDraft = (detailed) => {
  const divisiones = Array.isArray(detailed?.cuenta_dividida?.divisiones) ? detailed.cuenta_dividida.divisiones : [];
  const hasCuentaDivididaDetailed = Boolean(detailed?.cuenta_dividida?.activa || divisiones.length > 0);
  const assignedIds = resolveActiveDivisionAssignedItemIds(divisiones);
  const items = Array.isArray(detailed?.items) ? detailed.items : [];
  const unassignedCount = items.filter((item) => !assignedIds.has(item.id_detalle_pedido)).length;
  return shouldAutoActivateOrphanRecovery({
    hasCuentaDividida: hasCuentaDivididaDetailed,
    divisiones,
    unassignedLineCount: unassignedCount,
    montoPendiente: Number(detailed?.monto_pendiente || 0)
  });
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
  const [localNotice, setLocalNotice] = useState('');
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
  // HOTFIX (saldo dividido oculto): antes de cobrar, si quedan lineas del
  // pedido sin asignar a ninguna persona del borrador, se pide confirmar
  // una asignacion automatica en vez de enviar un cuenta_dividida que las
  // omite en silencio (esas lineas nunca quedaban representadas en ninguna
  // division, y el saldo restante desaparecia del cobro).
  const [pendingAutoAssignConfirm, setPendingAutoAssignConfirm] = useState(false);
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
      setLocalNotice('');
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
      const nextPendingDivision = findNextPendingDivision(normalized);
      setSelectedPedido(normalized);
      setSelectedDivisionId(nextPendingDivision ? String(nextPendingDivision.id_cuenta_division) : '');
      // HOTFIX (ronda 2, correccion #4): auto-activa "agregar persona" si
      // ya se cargaron items y no hay division PENDIENTE (pedido 2265).
      setSplitDraftEnabled(!nextPendingDivision && resolveAutoActivateSplitDraft(normalized));
      setSplitDraftDivisions(buildInitialSplitDivisions());
      setSelectedDraftDivisionId('persona-1');
      setForm((current) => ({
        ...current,
        monto_recibido: nextPendingDivision
          ? String(nextPendingDivision.monto_pendiente || nextPendingDivision.total || '')
          : normalized.cuenta_dividida?.activa
            ? ''
            : (current.monto_recibido || String(normalized.monto_pendiente || ''))
      }));
    }
    setLocalError('');
    setLocalNotice('');
    setPedidosError('');
  }, [initialPedido, initialPedidoId, open]);

  useEffect(() => {
    if (!open) return undefined;

    let active = true;
    const requestDelay = initialPedidoId && search ? 0 : 250;
    const timer = window.setTimeout(async () => {
      setLoadingPedidos(true);
      setPedidosError('');
      try {
        const response = await ventasService.listPedidosPendientesPago({
          search,
          id_sucursal: effectiveSucursalId || undefined,
          page: 1,
          page_size: 10,
          include_items: initialPedidoId ? 1 : undefined
        });
        if (!active) return;
        const rows = (Array.isArray(response?.items) ? response.items : [])
          .map(normalizePendingOrder)
          .filter((row) => row.id_pedido);
        setPedidos(rows);
        if (initialPedidoId) {
          const matched = rows.find((row) => row.id_pedido === initialPedidoId);
          if (matched) {
            const nextPendingDivision = findNextPendingDivision(matched);
            setSelectedPedido(matched);
            setSelectedDivisionId(nextPendingDivision ? String(nextPendingDivision.id_cuenta_division) : '');
            // HOTFIX (ronda 2, correccion #4): idem -- este request si
            // incluye items reales (include_items=1 cuando hay initialPedidoId).
            setSplitDraftEnabled(!nextPendingDivision && resolveAutoActivateSplitDraft(matched));
            setSplitDraftDivisions(buildInitialSplitDivisions());
            setSelectedDraftDivisionId('persona-1');
            setForm((current) => ({
              ...current,
              monto_recibido: nextPendingDivision
                ? String(nextPendingDivision.monto_pendiente || nextPendingDivision.total || '')
                : matched.cuenta_dividida?.activa
                  ? ''
                  : (current.monto_recibido || String(matched.monto_pendiente || ''))
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
    }, requestDelay);

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
  // HOTFIX (ronda 2, correccion #6): una division ANULADA no reserva sus
  // lineas -- vuelven a estar disponibles para asignarlas a una persona
  // nueva. resolveActiveDivisionAssignedItemIds excluye ANULADA.
  const cuentaDivisionAssignedItemIdSet = resolveActiveDivisionAssignedItemIds(cuentaDivisiones);
  const cuentaDivisionAssignedItemIds = [...cuentaDivisionAssignedItemIdSet];
  const splitDraftItems = hasCuentaDividida
    ? pedidoItems.filter((item) => !cuentaDivisionAssignedItemIdSet.has(item.id_detalle_pedido))
    : pedidoItems;
  const assignedDraftItemIds = splitDraftDivisions.flatMap((division) => division.itemIds || []);
  const pendingDraftItemCount = splitDraftItems.filter((item) => !assignedDraftItemIds.includes(item.id_detalle_pedido)).length;
  const selectedDraftDivision = splitDraftDivisions.find((division) => division.id === selectedDraftDivisionId) || null;
  const splitDraftLabelOffset = hasCuentaDividida ? cuentaDivisiones.length : 0;
  const getSplitDraftDivisionLabel = (divisionId) => {
    const index = splitDraftDivisions.findIndex((division) => division.id === divisionId);
    return index >= 0 ? `Persona ${splitDraftLabelOffset + index + 1}` : 'persona';
  };
  const selectedDraftDivisionTotal = selectedDraftDivision
    ? selectedDraftDivision.itemIds.reduce((sum, idDetallePedido) => {
        const item = splitDraftItems.find((row) => row.id_detalle_pedido === idDetallePedido);
        return roundMoney(sum + Number(item?.total_linea || 0));
      }, 0)
    : 0;
  const hasSplitDraft = Boolean(selectedPedido && splitDraftEnabled && (!hasCuentaDividida || splitDraftItems.length > 0));
  const selectedDivision = cuentaDivisiones.find((division) => String(division.id_cuenta_division) === String(selectedDivisionId)) || null;
  const selectedDivisionPendiente = selectedDivision && selectedDivision.estado === 'PENDIENTE' ? selectedDivision : null;
  const montoPendiente = hasSplitDraft
      ? Number(selectedDraftDivisionTotal || 0) || 0
    : hasCuentaDividida
      ? Number(selectedDivisionPendiente?.monto_pendiente ?? selectedDivisionPendiente?.total ?? 0) || 0
    : Number(selectedPedido?.monto_pendiente ?? 0) || 0;
  // HOTFIX (ronda 2, correccion #2): valor puramente informativo para el
  // rotulo "Total pendiente ..." -- nunca "L 0.00" cuando hay cuenta
  // dividida sin persona seleccionada o un borrador sin lineas todavia.
  // No sustituye a montoPendiente (que sigue siendo el monto REAL que se
  // va a cobrar y valida el monto recibido/cambio).
  const pendingBalanceDisplay = resolvePendingBalanceDisplay({
    hasSplitDraft,
    hasCuentaDividida,
    selectedDivisionPendiente,
    selectedDraftDivisionTotal,
    selectedDraftDivisionHasItems: Boolean(selectedDraftDivision?.itemIds?.length),
    montoPendienteGlobal: selectedPedido?.monto_pendiente ?? 0
  });
  const financialSummary = selectedPedido ? computeFinancialSummary(selectedPedido) : null;
  const estadoBadges = selectedPedido ? resolveEstadoBadges(selectedPedido) : { operational: null, financial: null };
  const montoRecibidoValue = Number(form.monto_recibido);
  const cambioEstimado = isCash && Number.isFinite(montoRecibidoValue)
    ? Math.max(montoRecibidoValue - montoPendiente, 0)
    : 0;
  const submitLabel = isSubmitting
    ? 'Guardando...'
    : hasSplitDraft && selectedDraftDivision
        ? `Cobrar ${getSplitDraftDivisionLabel(selectedDraftDivision.id)}`
      : hasCuentaDividida && selectedDivisionPendiente
        ? `Cobrar ${selectedDivisionPendiente.etiqueta}`
      : 'Confirmar pago';

  useEffect(() => {
    if (!open || !isCash || !selectedPedido) return;
    if (hasSplitDraft) {
      setForm((current) => ({
        ...current,
        monto_recibido: selectedDraftDivision ? String(selectedDraftDivisionTotal || '') : ''
      }));
      return;
    }
    if (hasCuentaDividida) {
      setForm((current) => ({
        ...current,
        monto_recibido: selectedDivisionPendiente
          ? String(selectedDivisionPendiente.monto_pendiente || selectedDivisionPendiente.total || '')
          : ''
      }));
      return;
    }
    setForm((current) => ({
      ...current,
      monto_recibido: current.monto_recibido || String(selectedPedido.monto_pendiente || '')
    }));
  }, [hasCuentaDividida, hasSplitDraft, isCash, open, selectedDivisionId, selectedDivisionPendiente, selectedDraftDivision, selectedDraftDivisionTotal, selectedPedido]);

  // HOTFIX (saldo dividido oculto): cualquier cambio de pedido, division
  // seleccionada o asignacion de lineas invalida una confirmacion de
  // auto-asignacion pendiente -- nunca se debe "arrastrar" un
  // pendingAutoAssignConfirm=true hacia un estado distinto al que el
  // usuario vio cuando se le pidio confirmar.
  useEffect(() => {
    setPendingAutoAssignConfirm(false);
  }, [selectedPedido?.id_pedido, splitDraftEnabled, splitDraftDivisions]);

  if (!open) return null;

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setLocalError('');
    setLocalNotice('');
  };

  const loadPedidoItems = async (pedido, { force = false } = {}) => {
    if (!pedido?.id_pedido || (!force && pedido.items?.length)) return pedido;
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
    const nextPendingDivision = findNextPendingDivision(pedido);
    setSelectedDivisionId(nextPendingDivision ? String(nextPendingDivision.id_cuenta_division) : '');
    setSplitDraftEnabled(false);
    setSplitDraftDivisions(buildInitialSplitDivisions());
    setSelectedDraftDivisionId('persona-1');
    setLocalError('');
    setLocalNotice('');
    setForm((current) => ({
      ...current,
      monto_recibido: nextPendingDivision
        ? String(nextPendingDivision.monto_pendiente || nextPendingDivision.total || '')
        : isDividido
          ? ''
          : String(pedido.monto_pendiente || '')
    }));
    if (!pedido.items?.length || isDividido) {
      const detailed = await loadPedidoItems(pedido, { force: isDividido });
      const detailedNextPendingDivision = findNextPendingDivision(detailed);
      setSelectedPedido((current) => (
        current?.id_pedido === pedido.id_pedido ? { ...current, ...detailed } : current
      ));
      setSelectedDivisionId(detailedNextPendingDivision ? String(detailedNextPendingDivision.id_cuenta_division) : '');
      if (!detailedNextPendingDivision && resolveAutoActivateSplitDraft(detailed)) {
        setSplitDraftEnabled(true);
      }
    }
  };

  const toggleSplitDraft = async (enabled) => {
    setSplitDraftEnabled(enabled);
    setSplitDraftDivisions(buildInitialSplitDivisions());
    setSelectedDraftDivisionId('persona-1');
    if (enabled) setSelectedDivisionId('');
    setLocalError('');
    setLocalNotice('');
    const needsSplitContext = !selectedPedido?.items?.length || (hasCuentaDividida && cuentaDivisionAssignedItemIds.length === 0);
    if (enabled && selectedPedido && needsSplitContext) {
      const detailed = await loadPedidoItems(selectedPedido, { force: hasCuentaDividida });
      setSelectedPedido((current) => (
        current?.id_pedido === selectedPedido.id_pedido ? { ...current, ...detailed } : current
      ));
    }
  };

  const addSplitDraftDivision = () => {
    setSplitDraftDivisions((current) => {
      const next = {
        id: `persona-${Date.now()}`,
        etiqueta: `Persona ${cuentaDivisiones.length + current.length + 1}`,
        itemIds: []
      };
      setSelectedDraftDivisionId(next.id);
      return [...current, next];
    });
    setLocalError('');
    setLocalNotice('');
  };

  const updateSplitDraftDivisionLabel = (id, etiqueta) => {
    setSplitDraftDivisions((current) => current.map((division) => (
      division.id === id ? { ...division, etiqueta } : division
    )));
    setLocalError('');
    setLocalNotice('');
  };

  const selectSplitDraftDivision = (divisionId) => {
    const division = splitDraftDivisions.find((row) => row.id === divisionId);
    const divisionTotal = division
      ? (division.itemIds || []).reduce((sum, idDetallePedido) => {
          const item = splitDraftItems.find((row) => row.id_detalle_pedido === idDetallePedido);
          return roundMoney(sum + Number(item?.total_linea || 0));
        }, 0)
      : 0;
    setSelectedDraftDivisionId(divisionId);
    if (isCash) {
      setForm((current) => ({ ...current, monto_recibido: String(divisionTotal || '') }));
    }
    setLocalError('');
    setLocalNotice('');
  };

  const assignItemToSplitDraftDivision = (idDetallePedido, divisionId) => {
    setSplitDraftDivisions((current) => current.map((division) => {
      const withoutItem = (division.itemIds || []).filter((id) => id !== idDetallePedido);
      if (division.id !== divisionId) return { ...division, itemIds: withoutItem };
      return { ...division, itemIds: [...withoutItem, idDetallePedido] };
    }));
    setLocalError('');
    setLocalNotice('');
  };

  const unassignItemFromSplitDraftDivision = (idDetallePedido) => {
    setSplitDraftDivisions((current) => current.map((division) => ({
      ...division,
      itemIds: (division.itemIds || []).filter((id) => id !== idDetallePedido)
    })));
    setLocalError('');
    setLocalNotice('');
  };

  // HOTFIX (saldo dividido oculto): reparte las lineas todavia sin asignar
  // entre las personas pendientes existentes (round-robin, para no
  // acumular todo en una sola persona); si no hay ninguna persona
  // pendiente todavia, crea una nueva. Nunca inventa un total: cada linea
  // conserva su id_detalle_pedido real, el monto lo sigue calculando el
  // backend a partir de detalle_pedido.
  const autoAssignRemainingDraftItems = () => {
    const assignedIds = new Set(splitDraftDivisions.flatMap((division) => division.itemIds || []));
    const remaining = splitDraftItems
      .map((item) => item.id_detalle_pedido)
      .filter((id) => id && !assignedIds.has(id));
    if (!remaining.length) return;
    setSplitDraftDivisions((current) => {
      const next = current.map((division) => ({ ...division, itemIds: [...(division.itemIds || [])] }));
      let cursor = 0;
      remaining.forEach((idDetallePedido) => {
        if (!next.length) {
          next.push({ id: `persona-${next.length + 1}`, etiqueta: `Persona ${next.length + 1}`, itemIds: [] });
        }
        next[cursor % next.length].itemIds.push(idDetallePedido);
        cursor += 1;
      });
      return next;
    });
    setPendingAutoAssignConfirm(false);
    setLocalError('');
    setLocalNotice('');
  };

  const resetPaymentModal = () => {
    setForm(INITIAL_FORM);
    setSelectedPedido(null);
    setSelectedDivisionId('');
    setSplitDraftEnabled(false);
    setSplitDraftDivisions(buildInitialSplitDivisions());
    setSelectedDraftDivisionId('persona-1');
    setLocalNotice('');
  };

  const refreshSelectedPedidoAfterPayment = async (pedidoId) => {
    const response = await ventasService.listPedidosPendientesPago({
      search: String(pedidoId || ''),
      id_sucursal: effectiveSucursalId || undefined,
      page: 1,
      page_size: 10,
      include_items: 1
    });
    const rows = (Array.isArray(response?.items) ? response.items : [])
      .map(normalizePendingOrder)
      .filter((row) => row.id_pedido);
    const detailed = rows.find((row) => Number(row.id_pedido) === Number(pedidoId));
    setPedidos((current) => {
      const mergedRows = rows.length ? rows : current;
      if (!detailed) return mergedRows;
      const withoutDetailed = mergedRows.filter((row) => Number(row.id_pedido) !== Number(detailed.id_pedido));
      return [detailed, ...withoutDetailed];
    });
    if (!detailed) return null;

    const nextPendingDivision = (detailed.cuenta_dividida?.divisiones || [])
      .find((division) => division.estado === 'PENDIENTE');
    setSelectedPedido(detailed);
    setSelectedDivisionId(nextPendingDivision ? String(nextPendingDivision.id_cuenta_division) : '');
    // HOTFIX (ronda 2, correccion #4): tras cobrar una persona, si quedan
    // lineas huerfanas sin division PENDIENTE, reactiva "agregar persona"
    // en vez de dejar el saldo restante oculto de nuevo.
    setSplitDraftEnabled(!nextPendingDivision && resolveAutoActivateSplitDraft(detailed));
    setSplitDraftDivisions(buildInitialSplitDivisions());
    setSelectedDraftDivisionId('persona-1');
    setForm((current) => ({
      ...current,
      monto_recibido: isCash && nextPendingDivision
        ? String(nextPendingDivision.monto_pendiente || nextPendingDivision.total || '')
        : '',
      referencia_pago: '',
      observacion_pago: ''
    }));
    return detailed;
  };

  const buildSplitDraftPayload = () => {
    if (!hasSplitDraft) return null;
    if (!splitDraftItems.length) {
      setLocalError('No se pudieron cargar las lineas reales del pedido.');
      return null;
    }
    const used = new Set();
    const selectedDraftHasItems = splitDraftDivisions.some((division) => (
      division.id === selectedDraftDivisionId && Array.isArray(division.itemIds) && division.itemIds.length > 0
    ));
    if (!selectedDraftHasItems) {
      setLocalError('Selecciona la persona que vas a cobrar y asignale al menos una linea.');
      return null;
    }
    const divisionsWithItems = splitDraftDivisions.filter((division) => (
      Array.isArray(division.itemIds) && division.itemIds.length > 0
    ));
    const cuentaDividida = divisionsWithItems.map((division, index) => {
      const itemIds = Array.isArray(division.itemIds) ? division.itemIds : [];
      const items = itemIds.map((idDetallePedido) => {
        if (used.has(idDetallePedido)) {
          setLocalError('Una linea no puede estar en dos personas.');
          return null;
        }
        used.add(idDetallePedido);
        const exists = splitDraftItems.some((item) => item.id_detalle_pedido === idDetallePedido);
        if (!exists) {
          setLocalError('Una linea asignada ya no existe en el pedido.');
          return null;
        }
        return { id_detalle_pedido: idDetallePedido };
      });
      if (items.some((item) => !item)) return null;
      return {
        etiqueta: `Persona ${splitDraftLabelOffset + index + 1}`,
        // HOTFIX (ronda 2, correccion #1): orden es solo informativo -- el
        // backend NUNCA lo confia, siempre lo recalcula desde el maximo
        // orden existente (resolveNextOrdenSequence). Se envia consistente
        // con la etiqueta visual para no confundir a un consumidor legacy.
        orden: resolveSplitDraftDivisionOrden({ splitDraftLabelOffset, index }),
        items
      };
    });
    if (cuentaDividida.some((division) => !division)) return null;
    const selectedIndex = divisionsWithItems.findIndex((division) => division.id === selectedDraftDivisionId);
    // HOTFIX (ronda 2, correccion #1): cobrar_division_orden es la
    // POSICION (1-based) de la division seleccionada DENTRO de este envio
    // -- el backend la resuelve por posicion (selectNewDivisionToCharge),
    // nunca por el valor de orden. Jamas debe llevar splitDraftLabelOffset
    // sumado (ver resolveCobrarDivisionOrden).
    const cobrarDivisionOrden = resolveCobrarDivisionOrden({ selectedIndex });
    return {
      cuenta_dividida: cuentaDividida,
      cobrar_division_orden: cobrarDivisionOrden
    };
  };

  const handleSubmit = async () => {
    if (submitRef.current || saving) return;
    submitRef.current = true;
    setLocalSaving(true);
    setLocalError('');
    setLocalNotice('');

    if (!selectedPedido?.id_pedido) {
      setLocalError('Selecciona un pedido pendiente para cobrar.');
      submitRef.current = false;
      setLocalSaving(false);
      return;
    }

    // HOTFIX (saldo dividido oculto): nunca enviar un cuenta_dividida que
    // omite en silencio lineas del pedido sin asignar a nadie. Se pide
    // confirmar la asignacion automatica de esas lineas ANTES de cobrar,
    // en vez de dejar que buildSplitDraftPayload() las excluya.
    if (hasSplitDraft && pendingDraftItemCount > 0 && !pendingAutoAssignConfirm) {
      setPendingAutoAssignConfirm(true);
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
    if (hasCuentaDividida && !hasSplitDraft && !selectedDivisionPendiente) {
      setLocalError('Selecciona una persona pendiente para cobrar.');
      submitRef.current = false;
      setLocalSaving(false);
      return;
    }
    if (!hasSplitDraft && selectedDivision && selectedDivision.estado !== 'PENDIENTE') {
      setLocalError('Selecciona una persona pendiente para cobrar.');
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
      const pendingDivisionsBeforeSubmit = cuentaDivisiones.filter((division) => division.estado === 'PENDIENTE').length;
      const shouldExpectMoreSplitPayments =
        (hasCuentaDividida && pendingDivisionsBeforeSubmit > 1) ||
        (hasSplitDraft && ((splitDraftPayload?.cuenta_dividida?.length || 0) > 1 || pendingDraftItemCount > 0));
      const response = await onRegistrarPago(selectedPedido.id_pedido, {
        metodo_pago: form.metodo_pago.toUpperCase(),
        monto_recibido: isCash ? montoRecibido : undefined,
        referencia_pago: isCash ? null : normalizeOptionalText(form.referencia_pago),
        observacion_pago: normalizeOptionalText(form.observacion_pago),
        id_sesion_caja: toPositiveId(selectedSessionId),
        id_cuenta_division: !hasSplitDraft && selectedDivisionPendiente ? Number(selectedDivisionPendiente.id_cuenta_division) : undefined,
        ...(splitDraftPayload || {})
      });

      if (isPagoPedidoStillPending(response) || shouldExpectMoreSplitPayments) {
        try {
          const refreshed = await refreshSelectedPedidoAfterPayment(selectedPedido.id_pedido);
          if (refreshed) {
            setLocalNotice('Pago registrado. Quedan personas pendientes en este pedido.');
            return;
          }
          setSelectedPedido(null);
          setSelectedDivisionId('');
          setSplitDraftEnabled(false);
          setSplitDraftDivisions(buildInitialSplitDivisions());
          setSelectedDraftDivisionId('persona-1');
          setLocalNotice('Pago registrado. Busca el pedido para continuar con el saldo restante.');
          return;
        } catch (refreshError) {
          setSelectedPedido(null);
          setSelectedDivisionId('');
          setSplitDraftEnabled(false);
          setSplitDraftDivisions(buildInitialSplitDivisions());
          setSelectedDraftDivisionId('persona-1');
          setLocalError(refreshError?.message || 'Pago registrado, pero no se pudo refrescar el saldo restante automaticamente.');
          if (Number(refreshError?.status || 0) >= 500) {
            console.error('[Ventas] Error refrescando pedido pendiente despues del pago', refreshError);
          }
          return;
        }
      }

      resetPaymentModal();
      onClose();
    } catch (error) {
      setLocalError(error?.message || 'No se pudo registrar el pago del pedido.');
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
        className={`ventas-modal-card ventas-registrar-pago-modal ${hasSplitDraft ? 'is-splitting-account' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ventas-registrar-pago-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ventas-modal-header ventas-finalizar-modal__header ventas-registrar-pago-modal__header">
          <div>
            <h5 id="ventas-registrar-pago-title">Registrar pago</h5>
            <p>Busca un pedido pendiente real y cobra usando su código VTA.</p>
          </div>
          <button type="button" className="ventas-modal__close-btn" onClick={onClose} disabled={isSubmitting} aria-label="Cerrar">
            <i className="bi bi-x-lg" />
          </button>
        </header>

        <div className={`ventas-modal-body ventas-finalizar-modal__body ventas-registrar-pago-modal__body ${hasSplitDraft ? 'is-splitting-account' : ''}`}>
          <section className="ventas-registrar-pago-modal__search-panel">
            <label className="ventas-create-modal__field">
              <span>Buscar pedido pendiente</span>
              <input
                type="search"
                value={search}
                placeholder="Buscar por VTA, teléfono o cliente"
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
                pedidos.map((pedido) => {
                  const isPedidoDividido = Boolean(
                    pedido?.cuenta_dividida?.activa ||
                    (Array.isArray(pedido?.cuenta_dividida?.divisiones) && pedido.cuenta_dividida.divisiones.length > 0)
                  );
                  return (
                    <article
                      key={pedido.id_pedido}
                      className={`ventas-registrar-pago-modal__pedido ${selectedPedido?.id_pedido === pedido.id_pedido ? 'is-selected' : ''} ${isPedidoDividido ? 'is-split-account' : ''}`}
                    >
                      <div className="ventas-registrar-pago-modal__pedido-main">
                        <div>
                          <strong>{pedido.codigo_pedido}</strong>
                          <span>{pedido.nombre_contacto}</span>
                        </div>
                        <div className="ventas-registrar-pago-modal__pedido-badges">
                          {isPedidoDividido ? <span className="ventas-registrar-pago-modal__badge is-split">Cuenta dividida</span> : null}
                          <span className="ventas-registrar-pago-modal__badge">Pendiente de pago</span>
                        </div>
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
                  );
                })
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
                {/* HOTFIX (ronda 2, correccion #3): estado operativo y
                    estado financiero SIEMPRE se muestran por separado --
                    un pedido COMPLETADO con pago pendiente jamas oculta
                    el saldo. */}
                {(estadoBadges.operational || estadoBadges.financial) ? (
                  <div className="ventas-registrar-pago-modal__pedido-badges">
                    {estadoBadges.operational ? (
                      <span className="ventas-registrar-pago-modal__badge">{estadoBadges.operational.label}</span>
                    ) : null}
                    {estadoBadges.financial ? (
                      <span className="ventas-registrar-pago-modal__badge is-split">{estadoBadges.financial.label}</span>
                    ) : null}
                  </div>
                ) : null}
                {/* HOTFIX (ronda 2, correccion #2): resumen financiero
                    completo (total/pagado/pendiente), siempre visible. */}
                {financialSummary ? (
                  <div className="ventas-registrar-pago-modal__financial-summary d-grid gap-1">
                    <div className="d-flex justify-content-between">
                      <span>Total</span>
                      <strong>{formatCurrency(financialSummary.montoTotal)}</strong>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span>Pagado</span>
                      <strong>{formatCurrency(financialSummary.montoPagado)}</strong>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span>Pendiente</span>
                      <strong>{formatCurrency(financialSummary.montoPendiente)}</strong>
                    </div>
                  </div>
                ) : null}
                <div className="ventas-registrar-pago-modal__selected-total">
                  <span>{pendingBalanceDisplay.label}</span>
                  <strong>{formatCurrency(pendingBalanceDisplay.amount)}</strong>
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
                              setSplitDraftEnabled(false);
                              setSplitDraftDivisions(buildInitialSplitDivisions());
                              setSelectedDraftDivisionId('persona-1');
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
                    <CuentaDivididaDraftBuilder
                      enabled={splitDraftEnabled}
                      onEnabledChange={toggleSplitDraft}
                      divisions={splitDraftDivisions}
                      items={splitDraftItems}
                      selectedDivisionId={selectedDraftDivisionId}
                      onSelectedDivisionChange={selectSplitDraftDivision}
                      onAddDivision={addSplitDraftDivision}
                      onUpdateDivisionLabel={updateSplitDraftDivisionLabel}
                      onAssignItem={assignItemToSplitDraftDivision}
                      onUnassignItem={unassignItemFromSplitDraftDivision}
                      loadingItems={loadingPedidoItems}
                      disabled={isSubmitting}
                      formatCurrency={formatCurrency}
                      toggleLabel="Agregar otra persona"
                      labelOffset={splitDraftLabelOffset}
                    />
                  </>
                ) : (
                  <CuentaDivididaDraftBuilder
                    enabled={splitDraftEnabled}
                    onEnabledChange={toggleSplitDraft}
                    divisions={splitDraftDivisions}
                    items={splitDraftItems}
                    selectedDivisionId={selectedDraftDivisionId}
                    onSelectedDivisionChange={selectSplitDraftDivision}
                    onAddDivision={addSplitDraftDivision}
                    onUpdateDivisionLabel={updateSplitDraftDivisionLabel}
                    onAssignItem={assignItemToSplitDraftDivision}
                    onUnassignItem={unassignItemFromSplitDraftDivision}
                    loadingItems={loadingPedidoItems}
                    disabled={isSubmitting}
                    formatCurrency={formatCurrency}
                    labelOffset={splitDraftLabelOffset}
                  />
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

            {pendingAutoAssignConfirm ? (
              <div className="ventas-create-modal__notice ventas-registrar-pago-modal__auto-assign-confirm">
                <p>
                  Quedan {pendingDraftItemCount} producto{pendingDraftItemCount === 1 ? '' : 's'} sin asignar.
                  <br />
                  Se asignarán automáticamente a las personas pendientes para evitar que el saldo quede oculto.
                </p>
                <div className="ventas-registrar-pago-modal__auto-assign-confirm-actions">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setPendingAutoAssignConfirm(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={autoAssignRemainingDraftItems}
                  >
                    Asignar y continuar
                  </button>
                </div>
              </div>
            ) : null}

            {localNotice ? <div className="ventas-create-modal__notice">{localNotice}</div> : null}
            {localError ? <div className="ventas-create-modal__error">{localError}</div> : null}
          </section>
        </div>

        <footer className="ventas-modal-footer ventas-registrar-pago-modal__footer">
          <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={isSubmitting || !selectedPedido}>
            {pendingAutoAssignConfirm ? 'Cobrar' : submitLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}
