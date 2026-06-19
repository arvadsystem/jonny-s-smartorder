// OrderTypeBadge: badge visual del tipo de pedido activo.
// Props:
// - orderTypeLabel: texto del tipo de pedido ya resuelto por la logica existente.
const OrderTypeBadge = ({ orderTypeLabel = 'Pedido' }) => {
  const normalized = String(orderTypeLabel || '').toLowerCase();
  const iconClass = normalized.includes('delivery')
    ? 'bi bi-scooter'
    : (normalized.includes('retiro') ? 'bi bi-bag-check-fill' : 'bi bi-cup-hot-fill');

  return (
    <span className="pm-premium-context__order-type">
      <i className={iconClass} aria-hidden="true" />
      <span>{orderTypeLabel}</span>
    </span>
  );
};

export default OrderTypeBadge;
