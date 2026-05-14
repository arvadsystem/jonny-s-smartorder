import { formatCurrency } from '../utils/ventasHelpers';

const getMetodoPagoLabel = (value) => {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized === 'tarjeta') return 'Tarjeta';
  if (normalized.startsWith('trans')) return 'Transferencia';
  return 'Efectivo';
};

export default function VentaCard({ venta, view = 'grid', index = 0, onOpenDetail }) {
  const isCompleted = venta?.statusKey === 'completed';
  const badgeClass = isCompleted ? 'is-ok' : 'is-low';
  const dotClass = isCompleted ? 'ok' : 'off';
  const metodoPagoLabel = getMetodoPagoLabel(venta?.metodo_pago);

  return (
    <article
      className={`inv-catpro-item inv-cat-card inv-anim-in ventas-page__sale-card ${view === 'list' ? 'is-list' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetail(venta)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpenDetail(venta);
        }
      }}
      style={{ animationDelay: `${Math.min(index * 40, 240)}ms` }}
    >
      <div className="inv-cat-card__halo" aria-hidden="true">
        <i className="bi bi-receipt-cutoff" />
      </div>

      <div className="inv-catpro-item-top">
        <div className="inv-cat-card__title-wrap">
          <span className="inv-cat-card__icon" aria-hidden="true">
            <i className="bi bi-cart-check" />
          </span>
          <div>
            <div className="fw-bold">{venta?.numero_venta}</div>
            <div className="text-muted small">{venta?.cliente_nombre}</div>
          </div>
        </div>

        <span className={`inv-ins-card__badge ${badgeClass}`}>{venta?.statusLabel}</span>
      </div>

      <div className="ventas-page__card-details">
        <div className="ventas-page__card-row ventas-page__card-row--total">
          <div className="ventas-page__card-row-copy">
            <i className="bi bi-cash-stack" />
            <span>Total</span>
          </div>
          <strong>{formatCurrency(venta?.total)}</strong>
        </div>

        <div className="ventas-page__card-row">
          <i className="bi bi-shop-window" />
          <span>{venta?.nombre_sucursal}</span>
        </div>
        <div className="ventas-page__card-row">
          <i className="bi bi-calendar-event" />
          <span>{venta?.fecha_hora_label}</span>
        </div>
        <div className="ventas-page__card-row">
          <i className="bi bi-box-seam" />
          <span>{venta?.total_items} items</span>
        </div>
        <div className="ventas-page__card-row">
          <i className="bi bi-person-badge" />
          <span>{venta?.nombre_usuario}</span>
        </div>
      </div>

      <div className="inv-catpro-meta inv-catpro-item-footer">
        <div className="inv-catpro-code-wrap">
          <span className={`inv-catpro-state-dot ${dotClass}`} />
          <span className="inv-catpro-code">{metodoPagoLabel}</span>
        </div>

        <div className="inv-catpro-meta-actions inv-catpro-action-bar inv-cat-card__actions">
          <button
            type="button"
            className="inv-catpro-action edit inv-catpro-action-compact"
            onClick={(event) => {
              event.stopPropagation();
              onOpenDetail(venta);
            }}
            onKeyDown={(event) => event.stopPropagation()}
            title="Ver detalle"
          >
            <i className="bi bi-eye" />
            <span className="inv-catpro-action-label">Detalle</span>
          </button>
        </div>
      </div>
    </article>
  );
}
