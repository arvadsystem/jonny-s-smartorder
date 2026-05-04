import { FaMotorcycle } from 'react-icons/fa6';

const ORDER_TYPE_ICON_BY_ID = Object.freeze({
  // Iconos de trazo para una apariencia mas elegante y limpia.
  'dine-in': 'bi-shop',
  pickup: 'bi-bag-check',
  delivery: null
});

// Presentational card for order type choice.
const OrderTypeCard = ({ option, selected, onSelect }) => (
  <button
    type="button"
    className={`pm-option-card pm-order-type-card ${selected ? 'is-selected' : ''}`}
    onClick={() => onSelect?.(option.id)}
    aria-pressed={selected}
    data-order-type={option.id}
  >
    <div className="pm-order-type-card__hero">
      <span className="pm-order-type-card__icon-wrap" aria-hidden="true">
        <span className="pm-order-type-card__icon">
          {/* Delivery usa icono de motocicleta real; los demas mantienen bootstrap icons. */}
          {option.id === 'delivery' ? (
            <FaMotorcycle />
          ) : (
            <i className={`bi ${ORDER_TYPE_ICON_BY_ID[option.id] || 'bi-ui-checks'}`} />
          )}
        </span>
      </span>

      <div className="pm-order-type-card__copy">
        <div className="pm-option-card__top">
          <h3 className="pm-option-card__title">{option.title}</h3>
          {selected ? (
            <span className="pm-order-type-card__check" aria-label="Seleccionado">
              <i className="bi bi-check-circle-fill" />
            </span>
          ) : null}
        </div>

        <p className="pm-option-card__description">{option.description}</p>
        <small className="pm-option-card__meta">{option.paymentCopy}</small>
      </div>
    </div>
  </button>
);

export default OrderTypeCard;
