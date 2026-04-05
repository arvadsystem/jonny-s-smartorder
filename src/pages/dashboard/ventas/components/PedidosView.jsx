import { useDeferredValue, useMemo, useState, useEffect, useCallback } from 'react';
import PedidosEmptyState from './PedidosEmptyState';
import ventasService from '../../../../services/ventasService';

export default function PedidosView() {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadPedidos = useCallback(async () => {
    try {
      setLoading(true);
      const data = await ventasService.getPedidosMenu();
      setPedidos(data);
    } catch (err) {
      console.error('Error fetching pedidos-menu:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPedidos();
    // Optional: add interval polling
    // const intId = setInterval(loadPedidos, 30000);
    // return () => clearInterval(intId);
  }, [loadPedidos]);

  const handleStateChange = async (id, newStateId) => {
    try {
      await ventasService.updatePedidoEstado(id, newStateId);
      loadPedidos(); // refetch or locally update
    } catch (err) {
      console.error('Error updating state:', err);
    }
  };

  const filteredPedidos = useMemo(() => {
    if (!deferredSearch) return pedidos;
    const q = deferredSearch.toLowerCase();
    return pedidos.filter(p => 
      String(p.id_pedido).includes(q) || 
      (p.nombres_cliente || '').toLowerCase().includes(q) ||
      (p.descripcion_pedido || '').toLowerCase().includes(q)
    );
  }, [deferredSearch, pedidos]);

  const pendientes = useMemo(() => filteredPedidos.filter(p => Number(p.id_estado_pedido) === 1), [filteredPedidos]);
  const enCocina = useMemo(() => filteredPedidos.filter(p => Number(p.id_estado_pedido) === 2), [filteredPedidos]);
  const listos = useMemo(() => filteredPedidos.filter(p => Number(p.id_estado_pedido) === 3), [filteredPedidos]);

  return (
    <div className="ventas-page ventas-pedidos-page">
      <div className="inv-catpro-card inv-prod-card mb-3">
        <div className="inv-prod-header ventas-page__toolbar">
          <div className="inv-prod-title-wrap">
            <div className="inv-prod-title-row">
              <i className="bi bi-journal-richtext inv-prod-title-icon" />
              <span className="inv-prod-title">Pedidos / Cocina</span>
            </div>
            <div className="inv-prod-subtitle">
              Gestión de pedidos desde el menú cliente y seguimiento de cocina.
            </div>
          </div>

          <div className="inv-prod-header-actions inv-ins-header-actions ventas-page__toolbar-actions">
            <label className="inv-ins-search" aria-label="Buscar pedidos">
              <i className="bi bi-search" />
              <input
                type="search"
                placeholder="Buscar por ticket o cliente..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <button className="ventas-modal__ghost-btn ms-2" onClick={loadPedidos} title="Actualizar">
              <i className="bi bi-arrow-clockwise" />
            </button>
          </div>
        </div>

        <div className="inv-catpro-body inv-prod-body p-3">
          <div className="ventas-pedidos__meta mb-3">
            <span>{filteredPedidos.length} pedidos visibles</span>
            {loading && <span className="ms-3 text-muted"><i className="bi bi-hourglass-split" /> Cargando...</span>}
          </div>

          <div className="ventas-pedidos__grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            {/* PENDIENTES */}
            <section className="ventas-pedidos__lane">
              <header className="ventas-pedidos__lane-head">
                <div>
                  <span className="ventas-pedidos__lane-dot" style={{ background: '#f59e0b' }} />
                  <strong>Pendientes / Por pagar</strong>
                </div>
                <span className="ventas-pedidos__lane-count">{pendientes.length}</span>
              </header>
              <div className="ventas-pedidos__lane-body mt-2">
                {pendientes.length === 0 ? <PedidosEmptyState title="Sin pendientes" /> : pendientes.map(p => (
                  <PedidoCard key={p.id_pedido} pedido={p} onNext={() => handleStateChange(p.id_pedido, 2)} nextLabel="Mandar a Cocina" />
                ))}
              </div>
            </section>

            {/* EN COCINA */}
            <section className="ventas-pedidos__lane">
              <header className="ventas-pedidos__lane-head">
                <div>
                  <span className="ventas-pedidos__lane-dot" style={{ background: '#3b82f6' }} />
                  <strong>En Cocina</strong>
                </div>
                <span className="ventas-pedidos__lane-count">{enCocina.length}</span>
              </header>
              <div className="ventas-pedidos__lane-body mt-2">
                {enCocina.length === 0 ? <PedidosEmptyState title="Sin pedidos en cocina" /> : enCocina.map(p => (
                  <PedidoCard key={p.id_pedido} pedido={p} onNext={() => handleStateChange(p.id_pedido, 3)} nextLabel="Listo para Entrega" />
                ))}
              </div>
            </section>

            {/* LISTO PARA ENTREGA */}
            <section className="ventas-pedidos__lane">
              <header className="ventas-pedidos__lane-head">
                <div>
                  <span className="ventas-pedidos__lane-dot" style={{ background: '#10b981' }} />
                  <strong>Listo para Entrega</strong>
                </div>
                <span className="ventas-pedidos__lane-count">{listos.length}</span>
              </header>
              <div className="ventas-pedidos__lane-body mt-2">
                {listos.length === 0 ? <PedidosEmptyState title="Sin pedidos listos" /> : listos.map(p => (
                  <PedidoCard key={p.id_pedido} pedido={p} onNext={() => handleStateChange(p.id_pedido, 4)} nextLabel="Completar y Entregar" />
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function PedidoCard({ pedido, onNext, nextLabel }) {
  const clienteName = pedido.nombres_cliente ? `${pedido.nombres_cliente} ${pedido.apellidos_cliente || ''}` : 'Consumidor Final';
  const isMenu = pedido.origen_pedido === 'MENU';
  const isCaja = pedido.origen_pedido === 'CAJA';

  return (
    <div className="ventas-create-modal__cart-item mb-2">
      <div className="ventas-create-modal__cart-item-head">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            {isCaja && (
              <span className="badge" style={{ background: '#3b82f6', fontSize: '0.65rem', fontWeight: 'bold' }}>
                <i className="bi bi-shop me-1" /> CAJA
              </span>
            )}
            {isMenu && (
              <span className="badge" style={{ background: '#f59e0b', fontSize: '0.65rem', fontWeight: 'bold' }}>
                <i className="bi bi-phone me-1" /> MENÚ
              </span>
            )}
            {!isCaja && !isMenu && (
              <span className="badge bg-secondary" style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>
                PEDIDO
              </span>
            )}
          </div>
          <strong className="d-flex align-items-center gap-2">
             <span>#{pedido.id_pedido} - {clienteName}</span>
          </strong>
          <small className="text-muted"><i className="bi bi-clock" /> {new Date(pedido.fecha_hora_pedido).toLocaleTimeString()}</small>
        </div>
        <div className="ventas-create-modal__line-total" style={{ fontSize: '1.1rem' }}>
          L {Number(pedido.total || 0).toFixed(2)}
        </div>
      </div>
      {pedido.descripcion_pedido && (
        <div className="ventas-create-modal__cart-item-meta" style={{ fontSize: '0.85rem' }}>
          <em>{pedido.descripcion_pedido}</em>
        </div>
      )}
      <div className="ventas-create-modal__cart-item-actions mt-2 justify-content-end">
        <button 
          className="ventas-create-modal__payment-btn is-active w-100 py-2 d-flex align-items-center justify-content-center gap-2" 
          onClick={onNext}
          style={{ minHeight: '36px', fontSize: '0.85rem' }}
        >
          {nextLabel} <i className="bi bi-arrow-right" />
        </button>
      </div>
    </div>
  );
}
