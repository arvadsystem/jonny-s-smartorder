import { useDeferredValue, useMemo, useState, useEffect, useCallback } from 'react';
import PedidosEmptyState from './PedidosEmptyState';
import CollapsibleSearchInput from '../../../../components/common/CollapsibleSearchInput';
import ventasService from '../../../../services/ventasService';

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

export default function PedidosView() {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionBusyId, setActionBusyId] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const loadPedidos = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      const data = await ventasService.getPedidosMenu();
      setPedidos(Array.isArray(data) ? data : []);
    } catch (err) {
      setErrorMessage(String(err?.message || 'No se pudo cargar el tablero de pedidos.'));
      setPedidos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPedidos();
  }, [loadPedidos]);

  const runPedidoAction = useCallback(async (idPedido, action) => {
    try {
      setActionBusyId(idPedido);
      setErrorMessage('');
      await action();
      await loadPedidos();
    } catch (err) {
      setErrorMessage(String(err?.message || 'No se pudo completar la accion del pedido.'));
    } finally {
      setActionBusyId(null);
    }
  }, [loadPedidos]);

  const handleConfirmarPago = useCallback((idPedido) => (
    runPedidoAction(idPedido, () => ventasService.confirmarPagoPedido(idPedido))
  ), [runPedidoAction]);

  const handleStateChange = useCallback((idPedido, estadoDestino) => (
    runPedidoAction(idPedido, () => ventasService.updatePedidoEstado(idPedido, estadoDestino))
  ), [runPedidoAction]);

  const filteredPedidos = useMemo(() => {
    if (!deferredSearch) return pedidos;
    const q = deferredSearch.toLowerCase();
    return pedidos.filter((pedido) =>
      String(pedido?.id_pedido || '').includes(q) ||
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
                      onConfirmarPago={() => handleConfirmarPago(pedido.id_pedido)}
                      onSendKitchen={() => handleStateChange(pedido.id_pedido, 'EN_COCINA')}
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
                      onComplete={() => handleStateChange(pedido.id_pedido, 'COMPLETADO')}
                    />
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function PedidoCard({
  pedido,
  busy = false,
  onConfirmarPago,
  onSendKitchen,
  onSendReady,
  onComplete
}) {
  const clienteName = pedido?.nombres_cliente
    ? `${pedido.nombres_cliente} ${pedido.apellidos_cliente || ''}`
    : 'Consumidor final';
  const isMenu = String(pedido?.origen_pedido || '').toUpperCase() === 'MENU';
  const isCaja = String(pedido?.origen_pedido || '').toUpperCase() === 'CAJA';
  const pagoValidado = Boolean(pedido?.pago_validado);
  const pagoExpirado = Boolean(pedido?.pago_expirado);
  const minutosRestantesPago = Number.isFinite(Number(pedido?.minutos_restantes_pago))
    ? Number(pedido.minutos_restantes_pago)
    : null;
  const laneCode = mapPedidoStateCode(pedido);

  return (
    <div className="ventas-create-modal__cart-item mb-2">
      <div className="ventas-create-modal__cart-item-head">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
            {isCaja ? (
              <span className="badge" style={{ background: '#3b82f6', fontSize: '0.65rem', fontWeight: 'bold' }}>
                <i className="bi bi-shop me-1" /> CAJA
              </span>
            ) : null}
            {isMenu ? (
              <span className="badge" style={{ background: '#f59e0b', fontSize: '0.65rem', fontWeight: 'bold' }}>
                <i className="bi bi-phone me-1" /> MENU WEB
              </span>
            ) : null}
            {!isCaja && !isMenu ? (
              <span className="badge bg-secondary" style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>
                PEDIDO
              </span>
            ) : null}
            {isMenu ? (
              pagoExpirado ? (
                <span className="badge bg-danger-subtle text-danger-emphasis" style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>
                  PAGO EXPIRADO
                </span>
              ) : pagoValidado ? (
                <span className="badge bg-success-subtle text-success-emphasis" style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>
                  PAGO CONFIRMADO
                </span>
              ) : (
                <span className="badge bg-warning-subtle text-warning-emphasis" style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>
                  PAGO PENDIENTE
                </span>
              )
            ) : null}
          </div>
          <strong className="d-flex align-items-center gap-2">
            <span>#{pedido.id_pedido} - {clienteName}</span>
          </strong>
          <small className="text-muted">
            <i className="bi bi-clock" /> {new Date(pedido.fecha_hora_pedido).toLocaleTimeString()}
            {isMenu && !pagoValidado && !pagoExpirado && minutosRestantesPago !== null ? (
              <span className="ms-2">• vence en {minutosRestantesPago} min</span>
            ) : null}
          </small>
        </div>
        <div className="ventas-create-modal__line-total" style={{ fontSize: '1.1rem' }}>
          L {Number(pedido.total || 0).toFixed(2)}
        </div>
      </div>

      {pedido.descripcion_pedido ? (
        <div className="ventas-create-modal__cart-item-meta" style={{ fontSize: '0.85rem' }}>
          <em>{pedido.descripcion_pedido}</em>
        </div>
      ) : null}

      <div className="ventas-create-modal__cart-item-actions mt-2 justify-content-end">
        {laneCode === 'PENDIENTE' ? (
          <div className="d-grid w-100 gap-2">
            {isMenu && !pagoValidado && !pagoExpirado ? (
              <button
                className="ventas-create-modal__payment-btn w-100 py-2 d-flex align-items-center justify-content-center gap-2"
                onClick={onConfirmarPago}
                disabled={busy}
                type="button"
                style={{ minHeight: '36px', fontSize: '0.85rem' }}
              >
                {busy ? 'Procesando...' : 'Confirmar pago'}
              </button>
            ) : null}
            <button
              className="ventas-create-modal__payment-btn is-active w-100 py-2 d-flex align-items-center justify-content-center gap-2"
              onClick={onSendKitchen}
              disabled={busy || (isMenu && !pagoValidado)}
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
          <button
            className="ventas-create-modal__payment-btn is-active w-100 py-2 d-flex align-items-center justify-content-center gap-2"
            onClick={onComplete}
            disabled={busy}
            type="button"
            style={{ minHeight: '36px', fontSize: '0.85rem' }}
          >
            {busy ? 'Procesando...' : 'Completar y entregar'} <i className="bi bi-check2-circle" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
