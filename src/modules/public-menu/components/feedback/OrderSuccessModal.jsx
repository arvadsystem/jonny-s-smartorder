const currencyFormatter = new Intl.NumberFormat('es-HN', {
  style: 'currency',
  currency: 'HNL',
  maximumFractionDigits: 2
});

const formatTicket = (order) =>
  String(order?.numero_ticket || order?.id_pedido || '').trim();

const formatTotal = (value) => currencyFormatter.format(Number(value || 0));

// Modal final para que el cliente tenga certeza de que su pedido fue recibido.
const OrderSuccessModal = ({
  open,
  order,
  branchName = '',
  orderTypeLabel = '',
  onClose
}) => {
  if (!open) return null;

  const ticket = formatTicket(order);

  return (
    <div className="pm-order-success__backdrop" role="presentation" onClick={onClose}>
      <section
        className="pm-order-success"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pm-order-success-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="pm-order-success__close"
          onClick={onClose}
          aria-label="Cerrar confirmacion"
        >
          <i className="bi bi-x-lg" aria-hidden="true" />
        </button>

        <div className="pm-order-success__icon" aria-hidden="true">
          <i className="bi bi-check2" />
        </div>

        <span className="pm-order-success__eyebrow">Pedido recibido</span>
        <h2 id="pm-order-success-title">Tu orden fue enviada correctamente</h2>
        <p>
          Ya estamos preparando tu pedido. Puedes guardar este numero para consultarlo con el restaurante.
        </p>

        <dl className="pm-order-success__summary">
          {ticket ? (
            <div>
              <dt>Pedido</dt>
              <dd>{ticket}</dd>
            </div>
          ) : null}
          <div>
            <dt>Sucursal</dt>
            <dd>{branchName || 'Jonny\'s'}</dd>
          </div>
          <div>
            <dt>Tipo</dt>
            <dd>{orderTypeLabel || 'Pedido'}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>{formatTotal(order?.total)}</dd>
          </div>
        </dl>

        <div className="pm-order-success__actions">
          <button type="button" className="pm-order-success__primary" onClick={onClose}>
            Seguir viendo menu
          </button>
        </div>
      </section>
    </div>
  );
};

export default OrderSuccessModal;
