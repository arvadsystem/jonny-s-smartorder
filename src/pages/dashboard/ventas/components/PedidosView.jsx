import { useDeferredValue, useMemo, useState } from 'react';
import PedidosEmptyState from './PedidosEmptyState';

export default function PedidosView() {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const filteredCount = useMemo(() => 0, [deferredSearch]);

  return (
    <div className="ventas-page ventas-pedidos-page">
      <div className="inv-catpro-card inv-prod-card mb-3">
        <div className="inv-prod-header ventas-page__toolbar">
          <div className="inv-prod-title-wrap">
            <div className="inv-prod-title-row">
              <i className="bi bi-journal-richtext inv-prod-title-icon" />
              <span className="inv-prod-title">Pedidos</span>
            </div>
            <div className="inv-prod-subtitle">
              Pedidos pendientes que luego llegaran desde el menu para su confirmacion de pago.
            </div>
          </div>

          <div className="inv-prod-header-actions inv-ins-header-actions ventas-page__toolbar-actions">
            <label className="inv-ins-search" aria-label="Buscar pedidos">
              <i className="bi bi-search" />
              <input
                type="search"
                placeholder="Buscar por ticket, cliente o item..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="inv-catpro-body inv-prod-body p-3">
          <div className="ventas-pedidos__meta">
            <span>{filteredCount} pedidos visibles</span>
            <span>Integracion del flujo cliente pendiente</span>
          </div>

          <div className="ventas-pedidos__grid">
            <section className="ventas-pedidos__lane">
              <header className="ventas-pedidos__lane-head">
                <div>
                  <span className="ventas-pedidos__lane-dot" />
                  <strong>Pendientes de pago</strong>
                </div>
                <span className="ventas-pedidos__lane-count">0</span>
              </header>

              <PedidosEmptyState />
            </section>

            <aside className="ventas-pedidos__future-card">
              <div className="ventas-pedidos__future-eyebrow">Siguiente fase</div>
              <h3>Recepcion desde el menu del cliente</h3>
              <p>
                Aqui se mostraran los pedidos registrados desde el menu antes de confirmar el pago.
                La vista ya esta preparada para convertirse despues en el tablero operativo de caja.
              </p>
              <div className="ventas-pedidos__future-list">
                <span className="ventas-pedidos__future-pill">
                  <i className="bi bi-clock-history" /> Estado inicial: PENDIENTE
                </span>
                <span className="ventas-pedidos__future-pill">
                  <i className="bi bi-cash-coin" /> Cobro inline diferido
                </span>
                <span className="ventas-pedidos__future-pill">
                  <i className="bi bi-box-seam" /> Productos, combos y recetas
                </span>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
