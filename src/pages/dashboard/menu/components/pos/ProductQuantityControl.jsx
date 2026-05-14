import { memo } from 'react';
import { FaMinus, FaPlus } from 'react-icons/fa';

const ProductQuantityControl = ({ quantity = 1, onDecrease, onIncrease, label = 'Cantidad' }) => (
  <section className="menu-pos-detail-section">
    <div className="menu-pos-detail-section-head">
      <strong>{label}</strong>
    </div>

    <div className="menu-pos-detail-quantity-stepper" aria-label={`Selector de ${label.toLowerCase()}`}>
      <button
        type="button"
        className="btn menu-pos-detail-quantity-btn"
        onClick={onDecrease}
        disabled={quantity <= 1}
        aria-label="Disminuir cantidad"
      >
        <FaMinus />
      </button>
      <span className="menu-pos-detail-quantity-value">{quantity}</span>
      <button
        type="button"
        className="btn menu-pos-detail-quantity-btn"
        onClick={onIncrease}
        aria-label="Aumentar cantidad"
      >
        <FaPlus />
      </button>
    </div>
  </section>
);

export default memo(ProductQuantityControl);

