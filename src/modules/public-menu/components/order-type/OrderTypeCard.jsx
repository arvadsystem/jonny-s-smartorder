// Presentational card for order type choice.
const OrderTypeCard = ({ option, selected, onSelect }) => (
  <button
    type="button"
    className={`pm-option-card pm-order-type-card ${selected ? 'is-selected' : ''}`}
    onClick={() => onSelect?.(option.id)}
    aria-pressed={selected}
  >
    <div className="pm-option-card__top">
      <h3 className="pm-option-card__title">{option.title}</h3>
      {selected ? <span className="pm-selected-badge">Seleccionado</span> : null}
    </div>

    <p className="pm-option-card__description">{option.description}</p>
    <small className="pm-option-card__meta">{option.paymentCopy}</small>
  </button>
);

export default OrderTypeCard;

