const currencyFormatter = new Intl.NumberFormat('es-HN', {
  style: 'currency',
  currency: 'HNL',
  maximumFractionDigits: 2
});

const formatLineNote = (value) => String(value || '').trim();

const OrderSummaryPanel = ({
  branchName = '',
  items = [],
  total = 0,
  onIncrease,
  onDecrease,
  onRemove,
  onConfirm,
  confirming = false,
  disabled = false,
  disabledReason = ''
}) => (
  <aside className="pm-order-summary-panel" aria-label="Detalle de orden">
    <header className="pm-order-summary-panel__header">
      <span>Detalle de orden</span>
      <strong>{branchName || 'Sucursal'}</strong>
    </header>

    <div className="pm-order-summary-panel__body">
      {items.length === 0 ? (
        <div className="pm-order-summary-panel__empty">
          <i className="bi bi-bag" aria-hidden="true" />
          <p>Agrega productos para iniciar tu orden.</p>
        </div>
      ) : (
        <ul className="pm-order-summary-panel__list">
          {items.map((item) => (
            <li key={item.line_key || item.id_detalle_menu} className="pm-order-summary-panel__item">
              <div className="pm-order-summary-panel__item-main">
                <strong>{item.nombre}</strong>
                <small>{currencyFormatter.format(item.subtotal || 0)}</small>
                {formatLineNote(item?.nota) ? (
                  <span className="pm-order-summary-panel__line-note">
                    Nota: {formatLineNote(item.nota)}
                  </span>
                ) : null}
              </div>
              <div className="pm-order-summary-panel__item-actions">
                <div className="pm-order-summary-panel__qty">
                  <button type="button" onClick={() => onDecrease?.(item.line_key)} aria-label="Quitar unidad">
                    -
                  </button>
                  <span>{item.cantidad}</span>
                  <button type="button" onClick={() => onIncrease?.(item.line_key)} aria-label="Agregar unidad">
                    +
                  </button>
                </div>
                <button type="button" className="pm-order-summary-panel__remove" onClick={() => onRemove?.(item.line_key)}>
                  Quitar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>

    <footer className="pm-order-summary-panel__footer">
      <div className="pm-order-summary-panel__total">
        <span>Total</span>
        <strong>{currencyFormatter.format(total || 0)}</strong>
      </div>
      <button
        type="button"
        className="pm-order-summary-panel__confirm"
        disabled={items.length === 0 || confirming || disabled}
        onClick={onConfirm}
      >
        {confirming ? 'Enviando...' : (disabled && items.length > 0 ? disabledReason || 'Sucursal cerrada' : 'Continuar')}
      </button>
    </footer>
  </aside>
);

export default OrderSummaryPanel;
