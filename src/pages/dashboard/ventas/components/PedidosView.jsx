import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import AppSelect from '../../../../components/common/AppSelect';
import { supabase } from '../../../../lib/supabaseClient';
import ventasService from '../../../../services/ventasService';
import { createCocinaAudioManager } from '../../cocina/utils/cocinaAudio';
import { formatCurrency, normalizeVentaDetail } from '../utils/ventasHelpers';
import PedidosEmptyState from './PedidosEmptyState';
import VentaRegistrarPagoPedidoModal from './VentaRegistrarPagoPedidoModal';
import VentaDetalleModal from './VentaDetalleModal';
import VentasToast from './VentasToast';

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

const PEDIDOS_ACTIVE_LANE_STORAGE_KEY = 'ventas.pedidos.activeLane';
const PEDIDOS_LANE_KEYS = ['pending', 'kitchen', 'ready'];

const normalizePaymentCode = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');

const buildPedidoVisibleCode = (pedido) => {
  const operativeCode = String(pedido?.codigo_venta_operativo || '').trim();
  if (operativeCode) return operativeCode;
  const ventaCode = String(pedido?.codigo_venta || '').trim();
  if (ventaCode) return ventaCode;
  const idPedido = Number(pedido?.id_pedido ?? 0) || 0;
  return idPedido ? `VTA-${String(idPedido).padStart(5, '0')}` : 'VTA-SIN-CODIGO';
};

const isPedidoKdsVencido = (pedido) => {
  if (pedido?.kds_vencido === true) return true;
  if (String(pedido?.kds_vencido || '').toLowerCase() === 'true') return true;
  return false;
};

const isPedidoPendientePago = (pedido) => {
  const code = normalizePaymentCode(pedido?.estado_pago_control || pedido?.estado_pago);
  return code === 'PENDIENTE_PAGO' || code === 'PENDIENTE_DE_PAGO';
};

const TECHNICAL_MESSAGE_PATTERNS = [
  /cannot read/i,
  /internal server error/i,
  /syntax error/i,
  /relation .* does not exist/i,
  /column .* does not exist/i,
  /sql/i,
  /stack/i
];

const isTechnicalMessage = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return false;
  return TECHNICAL_MESSAGE_PATTERNS.some((pattern) => pattern.test(raw));
};

const extractUiMessage = (error, fallbackMessage = 'No se pudo completar la accion. Intenta nuevamente.') => {
  const backendMessage = String(error?.data?.message || error?.data?.mensaje || '').trim();
  if (backendMessage && !isTechnicalMessage(backendMessage)) return backendMessage;
  const directMessage = String(error?.message || '').trim();
  if (directMessage && !isTechnicalMessage(directMessage)) return directMessage;
  return fallbackMessage;
};

const toPositiveId = (value) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizePedidoForPagoModal = (pedido) => ({
  id_pedido: Number(pedido?.id_pedido ?? 0) || null,
  codigo_venta_operativo: buildPedidoVisibleCode(pedido),
  codigo_venta: buildPedidoVisibleCode(pedido),
  codigo_pedido: buildPedidoVisibleCode(pedido),
  fecha_hora_pedido: pedido?.fecha_hora_pedido || null,
  nombre_contacto: String(
    pedido?.nombre_contacto ||
      `${pedido?.nombres_cliente || ''} ${pedido?.apellidos_cliente || ''}`.trim() ||
      'Consumidor final'
  ).trim(),
  telefono_contacto: String(pedido?.telefono_contacto || '').trim(),
  telefono_normalizado: String(pedido?.telefono_normalizado || '').trim(),
  correo_contacto: String(pedido?.correo_contacto || pedido?.correo || '').trim(),
  canal: pedido?.canal,
  modalidad: pedido?.modalidad,
  id_sucursal: toPositiveId(pedido?.id_sucursal),
  estado_pago: pedido?.estado_pago_control || pedido?.estado_pago,
  monto_pendiente: Number(pedido?.monto_pendiente ?? pedido?.total ?? 0) || 0,
  total: Number(pedido?.total ?? 0) || 0
});

const formatPedidoTime = (value) => {
  if (!value) return 'Sin hora';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Sin hora';
  return new Intl.DateTimeFormat('es-HN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

const buildSucursalOptions = (sucursales = []) =>
  sucursales
    .map((sucursal) => ({
      value: String(sucursal.id_sucursal),
      label: sucursal.nombre_sucursal || `Sucursal ${sucursal.id_sucursal}`
    }))
    .filter((option) => toPositiveId(option.value));

const normalizePedidoVentaDetail = (pedido) => {
  const clienteNombre = pedido?.nombres_cliente
    ? `${pedido.nombres_cliente} ${pedido.apellidos_cliente || ''}`.trim()
    : String(pedido?.nombre_contacto || 'Consumidor final').trim();

  return normalizeVentaDetail({
    ...pedido,
    id_factura: toPositiveId(pedido?.id_factura),
    codigo_venta: buildPedidoVisibleCode(pedido),
    codigo_venta_operativo: buildPedidoVisibleCode(pedido),
    numero_venta: buildPedidoVisibleCode(pedido),
    cliente_nombre: clienteNombre || 'Consumidor final',
    estado_pedido: pedido?.nombre_estado_pedido,
    metodo_pago: pedido?.metodo_pago || (isPedidoPendientePago(pedido) ? 'Pago pendiente' : null),
    descuento_total: Number(pedido?.descuento_total ?? 0) || 0,
    items: Array.isArray(pedido?.items) ? pedido.items : []
  });
};

export default function PedidosView({
  isSuperAdmin = false,
  sucursales = [],
  defaultSucursalId = null,
  scopeInfo = null,
  selectedSessionId = null
}) {
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
  const [ventaDetailModal, setVentaDetailModal] = useState({ open: false, venta: null });
  const [ventaDetailLoading, setVentaDetailLoading] = useState(false);
  const [selectedSucursalId, setSelectedSucursalId] = useState(null);
  const [activeLaneKey, setActiveLaneKey] = useState(() => {
    if (typeof window === 'undefined') return 'pending';
    const stored = window.localStorage.getItem(PEDIDOS_ACTIVE_LANE_STORAGE_KEY);
    return PEDIDOS_LANE_KEYS.includes(stored) ? stored : 'pending';
  });
  const notifiedReadyIdsRef = useRef(new Set());
  const audioManagerRef = useRef(null);
  const inFlightKeyRef = useRef('');
  const actionBusyRef = useRef(null);
  const lastActionRefreshAtRef = useRef(0);
  const requestIdRef = useRef(0);
  const forbiddenErrorKeyRef = useRef('');

  const sucursalOptions = useMemo(() => buildSucursalOptions(sucursales), [sucursales]);
  const selectedSucursalIsValid = useMemo(
    () => Boolean(
      toPositiveId(selectedSucursalId) &&
      sucursalOptions.some((option) => toPositiveId(option.value) === toPositiveId(selectedSucursalId))
    ),
    [selectedSucursalId, sucursalOptions]
  );
  const effectiveSucursalId = useMemo(() => {
    if (isSuperAdmin) {
      return selectedSucursalIsValid ? toPositiveId(selectedSucursalId) : null;
    }
    return (
      toPositiveId(scopeInfo?.selectedSucursalId) ||
      toPositiveId(scopeInfo?.userSucursalId) ||
      toPositiveId(defaultSucursalId)
    );
  }, [
    defaultSucursalId,
    isSuperAdmin,
    scopeInfo?.selectedSucursalId,
    scopeInfo?.userSucursalId,
    selectedSucursalId,
    selectedSucursalIsValid
  ]);

  useEffect(() => {
    if (!isSuperAdmin) {
      setSelectedSucursalId(null);
      return;
    }
    if (selectedSucursalIsValid) return;
    const fallback = toPositiveId(sucursalOptions[0]?.value);
    if (fallback) setSelectedSucursalId(fallback);
  }, [isSuperAdmin, selectedSucursalIsValid, sucursalOptions]);

  useEffect(() => {
    audioManagerRef.current = createCocinaAudioManager();
    return () => {
      audioManagerRef.current?.dispose?.();
      audioManagerRef.current = null;
    };
  }, []);

  useEffect(() => {
    actionBusyRef.current = actionBusyId;
  }, [actionBusyId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(PEDIDOS_ACTIVE_LANE_STORAGE_KEY, activeLaneKey);
  }, [activeLaneKey]);

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

  const loadPedidos = useCallback(
    async ({ silent = false, source = 'manual' } = {}) => {
      if (source !== 'action' && actionBusyRef.current !== null) return;
      if (isSuperAdmin && !effectiveSucursalId) {
        setPedidos([]);
        setLoading(false);
        return;
      }

      const requestSucursalId = effectiveSucursalId;
      const requestKey = requestSucursalId ? `sucursal:${requestSucursalId}` : 'scope';
      const canRetryForbidden = source === 'manual' || source === 'action' || source === 'initial';
      if (!canRetryForbidden && forbiddenErrorKeyRef.current === requestKey) return;
      if (inFlightKeyRef.current === requestKey) return;

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      inFlightKeyRef.current = requestKey;
      try {
        if (!silent) setLoading(true);
        setErrorMessage('');
        const params = requestSucursalId
          ? { id_sucursal: requestSucursalId }
          : {};
        const data = await ventasService.getPedidosMenu(params);
        if (requestId !== requestIdRef.current) return;
        forbiddenErrorKeyRef.current = '';
        const nextPedidos = Array.isArray(data) ? data : [];

        setPedidos((prevPedidos) => {
          if (source !== 'initial' && source !== 'manual' && source !== 'action') {
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
              void audioManagerRef.current?.playPedidoListo?.();
              openToast('PEDIDO LISTO', `Pedido ${buildPedidoVisibleCode(pedido)} listo para entrega.`, 'success');
            });
          }
          return nextPedidos;
        });
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        const status = Number(err?.status || err?.data?.status || 0);
        const message = extractUiMessage(err, 'No se pudo cargar el tablero de pedidos.');
        if (status === 403) {
          forbiddenErrorKeyRef.current = requestKey;
        }
        setErrorMessage((current) => (current === message ? current : message));
        setPedidos([]);
      } finally {
        if (inFlightKeyRef.current === requestKey) {
          inFlightKeyRef.current = '';
        }
        if (requestId === requestIdRef.current && !silent) setLoading(false);
      }
    },
    [effectiveSucursalId, isSuperAdmin, openToast]
  );

  useEffect(() => {
    if (isSuperAdmin && !effectiveSucursalId) {
      setLoading(false);
      return;
    }
    void loadPedidos({ source: 'initial' });
  }, [effectiveSucursalId, isSuperAdmin, loadPedidos]);

  useEffect(() => {
    if (isSuperAdmin && !effectiveSucursalId) return undefined;
    const intervalId = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void loadPedidos({ silent: true, source: 'poll' });
    }, 8000);

    return () => window.clearInterval(intervalId);
  }, [effectiveSucursalId, isSuperAdmin, loadPedidos]);

  useEffect(() => {
    if (isSuperAdmin && !effectiveSucursalId) return undefined;
    const channel = supabase
      .channel(`ventas-pedidos-realtime-${effectiveSucursalId || 'scope'}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos' }, () => {
        if (forbiddenErrorKeyRef.current === (effectiveSucursalId ? `sucursal:${effectiveSucursalId}` : 'scope')) return;
        if (Date.now() - lastActionRefreshAtRef.current < 1200) return;
        void loadPedidos({ silent: true, source: 'realtime' });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [effectiveSucursalId, isSuperAdmin, loadPedidos]);

  const runPedidoAction = useCallback(
    async (idPedido, action) => {
      try {
        setActionBusyId(idPedido);
        setErrorMessage('');
        const response = await action();
        await loadPedidos({ source: 'action' });
        lastActionRefreshAtRef.current = Date.now();
        if (response?.message) {
          openToast('PEDIDO ACTUALIZADO', response.message, 'success');
        }
      } catch (err) {
        const message = extractUiMessage(err);
        setErrorMessage(message);
        openToast('ERROR', message, 'danger');
      } finally {
        setActionBusyId(null);
      }
    },
    [loadPedidos, openToast]
  );

  const handleStateChange = useCallback(
    (idPedido, estadoDestino) =>
      runPedidoAction(idPedido, () => ventasService.updatePedidoEstado(idPedido, estadoDestino)),
    [runPedidoAction]
  );

  const handleCompletePedido = useCallback((pedido) => {
    const idPedido = Number(pedido?.id_pedido ?? 0);
    if (!idPedido) return;
    setConfirmDialog({
      open: true,
      title: 'Confirmar entrega',
      message: 'Confirma que este pedido fue entregado al cliente.',
      idPedido,
      estadoDestino: 'COMPLETADO'
    });
  }, []);

  const handleNoEntregadoPedido = useCallback((pedido) => {
    const idPedido = Number(pedido?.id_pedido ?? 0);
    if (!idPedido) return;
    setConfirmDialog({
      open: true,
      title: 'Marcar no entregado',
      message: 'Este pedido quedara registrado como no entregado.',
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

  const openPedidoDetail = useCallback(async (pedido) => {
    if (!pedido) return;
    const fallbackDetail = normalizePedidoVentaDetail(pedido);
    const idFactura = toPositiveId(pedido?.id_factura);

    setVentaDetailModal({ open: true, venta: fallbackDetail });
    if (!idFactura) return;

    try {
      setVentaDetailLoading(true);
      const response = await ventasService.getById(idFactura);
      setVentaDetailModal({ open: true, venta: normalizeVentaDetail(response) });
    } catch (error) {
      const message = extractUiMessage(error, 'No se pudo cargar el detalle de la venta.');
      setErrorMessage(message);
      openToast('ERROR', message, 'danger');
    } finally {
      setVentaDetailLoading(false);
    }
  }, [openToast]);

  const closePedidoDetail = useCallback(() => {
    setVentaDetailModal({ open: false, venta: null });
    setVentaDetailLoading(false);
  }, []);

  const handleRegistrarPagoPedido = useCallback(
    async (idPedido, payload) => {
      try {
        setPagoPedidoSaving(true);
        setErrorMessage('');
        const response = await ventasService.registrarPagoPedido(idPedido, payload);
        lastActionRefreshAtRef.current = Date.now();
        openToast('PAGO REGISTRADO', 'Pago registrado correctamente.', 'success');
        void loadPedidos({ source: 'action' }).catch(() => undefined);
        return response;
      } catch (error) {
        const message = extractUiMessage(error, 'No se pudo registrar el pago del pedido.');
        setErrorMessage(message);
        openToast('ERROR', message, 'danger');
        throw error;
      } finally {
        setPagoPedidoSaving(false);
      }
    },
    [loadPedidos, openToast]
  );

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
    const q = deferredSearch.trim().toLowerCase();
    if (!q) return pedidos;
    return pedidos.filter(
      (pedido) =>
        String(pedido?.id_pedido || '').includes(q) ||
        String(pedido?.codigo_venta_operativo || '').toLowerCase().includes(q) ||
        String(pedido?.codigo_pedido || '').toLowerCase().includes(q) ||
        String(pedido?.codigo_venta || '').toLowerCase().includes(q) ||
        String(pedido?.nombre_contacto || '').toLowerCase().includes(q) ||
        String(pedido?.telefono_contacto || '').toLowerCase().includes(q) ||
        String(pedido?.telefono_normalizado || '').toLowerCase().includes(q) ||
        String(pedido?.correo_contacto || '').toLowerCase().includes(q) ||
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

  const selectedSucursalName = useMemo(() => {
    const match = sucursales.find((sucursal) => Number(sucursal.id_sucursal) === Number(effectiveSucursalId));
    return match?.nombre_sucursal || '';
  }, [effectiveSucursalId, sucursales]);

  const effectivePagoSucursalId = toPositiveId(pagoPedidoModal.pedido?.id_sucursal) || effectiveSucursalId;
  const lanes = useMemo(() => ([
    {
      key: 'pending',
      tone: 'pending',
      title: 'Pendientes / Validacion',
      tabLabel: 'Pendientes',
      count: pendientes.length,
      emptyTitle: 'Sin pendientes',
      emptyDescription: 'No hay pagos por validar.',
      pedidos: pendientes,
      renderPedido: (pedido) => (
        <PedidoCard
          key={pedido.id_pedido}
          pedido={pedido}
          busy={actionBusyId === pedido.id_pedido}
          onSendKitchen={() => handleStateChange(pedido.id_pedido, 'EN_COCINA')}
          onCobrar={() => openPagoPedidoModal(pedido)}
          onViewDetail={() => openPedidoDetail(pedido)}
        />
      )
    },
    {
      key: 'kitchen',
      tone: 'kitchen',
      title: 'En Cocina',
      tabLabel: 'En cocina',
      count: enCocina.length,
      emptyTitle: 'Sin cocina',
      emptyDescription: 'No hay pedidos en preparacion.',
      pedidos: enCocina,
      renderPedido: (pedido) => (
        <PedidoCard
          key={pedido.id_pedido}
          pedido={pedido}
          busy={actionBusyId === pedido.id_pedido}
          onCobrar={() => openPagoPedidoModal(pedido)}
          onViewDetail={() => openPedidoDetail(pedido)}
        />
      )
    },
    {
      key: 'ready',
      tone: 'ready',
      title: 'Listo para Entrega',
      tabLabel: 'Listos',
      count: listos.length,
      emptyTitle: 'Sin listos',
      emptyDescription: 'Nada pendiente de entregar.',
      pedidos: listos,
      renderPedido: (pedido) => (
        <PedidoCard
          key={pedido.id_pedido}
          pedido={pedido}
          busy={actionBusyId === pedido.id_pedido}
          onComplete={() => handleCompletePedido(pedido)}
          onNoEntregado={() => handleNoEntregadoPedido(pedido)}
          onCobrar={() => openPagoPedidoModal(pedido)}
          onViewDetail={() => openPedidoDetail(pedido)}
        />
      )
    }
  ]), [
    actionBusyId,
    enCocina,
    handleCompletePedido,
    handleNoEntregadoPedido,
    handleStateChange,
    listos,
    openPagoPedidoModal,
    openPedidoDetail,
    pendientes
  ]);

  return (
    <div className="ventas-page ventas-pedidos-page">
      <section className="ventas-pedidos-board">
        <header className="ventas-pedidos-header">
          <div className="ventas-pedidos-header__title">
            <span className="ventas-pedidos-header__icon">
              <i className="bi bi-journal-check" />
            </span>
            <div>
              <h2>Pedidos</h2>
              <p>Validacion de pago, cocina y entrega</p>
            </div>
          </div>

          <div className="ventas-pedidos-header__actions">
            <label className="ventas-pedidos-search">
              <i className="bi bi-search" aria-hidden="true" />
              <input
                type="search"
                value={search}
                placeholder="Buscar ticket, cliente o telefono"
                onChange={(event) => setSearch(event.target.value)}
                disabled={loading}
              />
            </label>

            {isSuperAdmin ? (
              <AppSelect
                value={selectedSucursalId ? String(selectedSucursalId) : ''}
                options={sucursalOptions}
                onChange={(value) => {
                  const nextId = toPositiveId(value);
                  requestIdRef.current += 1;
                  forbiddenErrorKeyRef.current = '';
                  inFlightKeyRef.current = '';
                  setErrorMessage('');
                  setPedidos([]);
                  setSelectedSucursalId(nextId);
                }}
                placeholder="Selecciona sucursal"
                className="app-select--warm app-select--compact ventas-pedidos-sucursal-select"
                disabled={sucursalOptions.length === 0}
              />
            ) : selectedSucursalName ? (
              <span className="ventas-pedidos-scope">
                <i className="bi bi-shop" />
                {selectedSucursalName}
              </span>
            ) : null}

            <button
              className="ventas-pedidos-refresh"
              onClick={() => void loadPedidos()}
              title="Actualizar pedidos"
              disabled={loading}
              type="button"
            >
              <i className={`bi ${loading ? 'bi-arrow-repeat spin' : 'bi-arrow-clockwise'}`} />
              <span>Actualizar</span>
            </button>
          </div>
        </header>

        <div className="ventas-pedidos-summary">
          <span><strong>{filteredPedidos.length}</strong> pedidos visibles</span>
          {selectedSucursalName ? <span>{selectedSucursalName}</span> : null}
          {loading ? <span><i className="bi bi-hourglass-split" /> Cargando...</span> : null}
        </div>

        {errorMessage ? (
          <div className="ventas-pedidos-alert" role="alert">
            <i className="bi bi-exclamation-triangle" />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        <div className="ventas-pedidos-lane-tabs" role="tablist" aria-label="Columnas de pedidos">
          {lanes.map((lane) => (
            <button
              key={lane.key}
              type="button"
              role="tab"
              aria-selected={activeLaneKey === lane.key}
              className={`ventas-pedidos-lane-tabs__item ventas-pedidos-lane-tabs__item--${lane.tone}${activeLaneKey === lane.key ? ' is-active' : ''}`}
              onClick={() => setActiveLaneKey(lane.key)}
            >
              <span className="ventas-pedidos-lane-tabs__dot" />
              <span>{lane.tabLabel}</span>
              <strong>{lane.count}</strong>
            </button>
          ))}
        </div>

        <div className="ventas-pedidos__grid">
          {lanes.map((lane) => (
            <PedidoLane
              key={lane.key}
              tone={lane.tone}
              title={lane.title}
              count={lane.count}
              emptyTitle={lane.emptyTitle}
              emptyDescription={lane.emptyDescription}
              pedidos={lane.pedidos}
              active={activeLaneKey === lane.key}
              renderPedido={lane.renderPedido}
            />
          ))}
        </div>
      </section>

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
        selectedSucursalId={effectivePagoSucursalId}
        selectedSessionId={selectedSessionId}
      />

      <VentaDetalleModal
        open={ventaDetailModal.open}
        venta={ventaDetailModal.venta}
        loading={ventaDetailLoading}
        onClose={closePedidoDetail}
        canReversion={false}
        canExport={false}
        canPrint={false}
      />

      <VentasToast toast={toast} onClose={closeToast} />
    </div>
  );
}

function PedidoLane({ tone, title, count, emptyTitle, emptyDescription, pedidos, active = false, renderPedido }) {
  return (
    <section className={`ventas-pedidos__lane ventas-pedidos__lane--${tone}${active ? ' is-active' : ''}`}>
      <header className="ventas-pedidos__lane-head">
        <div>
          <span className="ventas-pedidos__lane-dot" />
          <strong>{title}</strong>
        </div>
        <span className="ventas-pedidos__lane-count">{count}</span>
      </header>
      <div className="ventas-pedidos__lane-body">
        {pedidos.length === 0 ? (
          <PedidosEmptyState title={emptyTitle} description={emptyDescription} />
        ) : (
          pedidos.map(renderPedido)
        )}
      </div>
    </section>
  );
}

function PedidoCard({ pedido, busy = false, onSendKitchen, onComplete, onNoEntregado, onCobrar, onViewDetail }) {
  const clienteName = pedido?.nombres_cliente
    ? `${pedido.nombres_cliente} ${pedido.apellidos_cliente || ''}`.trim()
    : String(pedido?.nombre_contacto || 'Consumidor final').trim();

  const cleanDescription = cleanPedidoDescription(pedido?.descripcion_pedido);
  const correoContacto = String(pedido?.correo_contacto || '').trim();
  const telefonoContacto = String(pedido?.telefono_contacto || pedido?.telefono_normalizado || '').trim();
  const laneCode = mapPedidoStateCode(pedido);
  const visibleCode = buildPedidoVisibleCode(pedido);
  const pendingPago = isPedidoPendientePago(pedido);
  const kdsVencido = isPedidoKdsVencido(pedido);
  const total = Number(pedido?.total || 0);
  const hasCuentaDividida = Boolean(
    Number(pedido?.cuenta_dividida_divisiones || 0) > 0 ||
    pedido?.cuenta_dividida_activa ||
    pedido?.cuenta_dividida?.activa ||
    (Array.isArray(pedido?.cuenta_dividida?.divisiones) && pedido.cuenta_dividida.divisiones.length > 0)
  );

  return (
    <article className={`ventas-pedidos-card ventas-pedidos-card--${laneCode.toLowerCase()} ${hasCuentaDividida ? 'is-split-account' : ''}`}>
      <header className="ventas-pedidos-card__header ventas-pedidos-card__head">
        <div>
          <div className="ventas-pedidos-card__badges">
            <span className="ventas-pedidos-card__code">{visibleCode}</span>
            {hasCuentaDividida ? <span className="ventas-pedidos-card__badge is-split">Cuenta dividida</span> : null}
            {pendingPago ? <span className="ventas-pedidos-card__badge is-payment">Pago pendiente</span> : null}
            {kdsVencido ? <span className="ventas-pedidos-card__badge is-overdue">Retrasado</span> : null}
          </div>
          <strong className="ventas-pedidos-card__client">{clienteName}</strong>
          <span className="ventas-pedidos-card__meta ventas-pedidos-card__time">
            <i className="bi bi-clock" />
            {formatPedidoTime(pedido?.fecha_hora_pedido)}
          </span>
          {telefonoContacto ? (
            <span className="ventas-pedidos-card__meta">
              <i className="bi bi-telephone" />
              {telefonoContacto}
            </span>
          ) : null}
          {correoContacto ? (
            <span className="ventas-pedidos-card__meta">
              <i className="bi bi-envelope" />
              {correoContacto}
            </span>
          ) : null}
        </div>
        <div className="ventas-pedidos-card__total">
          <span>Total</span>
          <strong>{formatCurrency(total)}</strong>
        </div>
      </header>

      {cleanDescription ? (
        <p className="ventas-pedidos-card__description">{cleanDescription}</p>
      ) : null}

      <div className="ventas-pedidos-card__actions">
        <button
          className="ventas-pedidos-card__action ventas-pedidos-card__action--secondary ventas-pedidos-card__btn is-secondary"
          onClick={onViewDetail}
          disabled={busy}
          type="button"
        >
          <i className="bi bi-eye" />
          Ver detalle
        </button>

        {pendingPago ? (
          <button
            className="ventas-pedidos-card__action ventas-pedidos-card__action--primary ventas-pedidos-card__btn is-primary"
            onClick={onCobrar}
            disabled={busy}
            type="button"
          >
            <i className="bi bi-cash-coin" />
            {busy ? 'Procesando...' : 'Cobrar'}
          </button>
        ) : null}

        {laneCode === 'PENDIENTE' ? (
          <button
            className="ventas-pedidos-card__action ventas-pedidos-card__action--primary ventas-pedidos-card__btn is-primary"
            onClick={onSendKitchen}
            disabled={busy}
            type="button"
          >
            <i className="bi bi-arrow-right" />
            {busy ? 'Procesando...' : 'Mandar a cocina'}
          </button>
        ) : null}

        {!pendingPago && laneCode === 'LISTO_PARA_ENTREGA' ? (
          <>
            <button
              className="ventas-pedidos-card__action ventas-pedidos-card__action--primary ventas-pedidos-card__btn is-primary"
              onClick={onComplete}
              disabled={busy}
              type="button"
            >
              <i className="bi bi-check2-circle" />
              {busy ? 'Procesando...' : 'Completar'}
            </button>
            <button
              className="ventas-pedidos-card__action ventas-pedidos-card__action--danger ventas-pedidos-card__btn is-danger"
              onClick={onNoEntregado}
              disabled={busy}
              type="button"
            >
              <i className="bi bi-x-circle" />
              {busy ? 'Procesando...' : 'No entregado'}
            </button>
          </>
        ) : null}
      </div>
    </article>
  );
}

function ConfirmActionModal({ open, title, message, busy = false, onCancel, onConfirm }) {
  if (!open) return null;

  return (
    <div className="ventas-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="ventas-confirm-title">
      <div className="ventas-modal-card ventas-pedidos-confirm">
        <div className="ventas-modal-header">
          <h5 id="ventas-confirm-title">{title}</h5>
        </div>
        <div className="ventas-modal-body">
          <p>{message}</p>
        </div>
        <div className="ventas-modal-footer ventas-pedidos-confirm__footer">
          <button type="button" className="btn btn-outline-secondary" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={busy}>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
