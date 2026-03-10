import { memo } from 'react';
import CurrentOrderLineItem from './components/pos/CurrentOrderLineItem';
import { formatMoney } from './utils/menuPosOrderUtils';

const CurrentOrderPanel = ({
  items,
  totalAmount,
  totalItems,
  onDecrease,
  onIncrease,
  onRemove,
  onConfirmOrder,
  isSubmitting = false,
  submitError = '',
  submitSuccess = ''
}) => {
  const itemLabel = totalItems === 1 ? 'item' : 'items';
  const canConfirm = items.length > 0 && !isSubmitting;

  return (
    <aside className="menu-order-panel card shadow-sm inv-prod-card">
      <div className="menu-order-panel-header">
        <h2 className="menu-order-panel-title mb-0">Orden Actual</h2>
        <span className="menu-order-panel-badge">{`${totalItems} ${itemLabel}`}</span>
      </div>

      <div className="menu-order-panel-body">
        {items.length === 0 ? (
          <div className="menu-order-empty">
            <div className="menu-order-empty-title">Aun no hay productos agregados</div>
            <div className="menu-order-empty-copy">
              Toca el boton <strong>+</strong> en el catalogo para empezar a armar la orden.
            </div>
          </div>
        ) : (
          <div className="menu-order-list">
            {items.map((item) => (
              <CurrentOrderLineItem
                key={item.lineKey}
                item={item}
                onDecrease={onDecrease}
                onIncrease={onIncrease}
                onRemove={onRemove}
              />
            ))}
          </div>
        )}
      </div>

      <div className="menu-order-panel-footer">
        <div className="menu-order-total-row">
          <span className="menu-order-total-label">Total a pagar</span>
          <strong className="menu-order-total-value">{formatMoney(totalAmount)}</strong>
        </div>

        {submitError ? <div className="alert alert-danger py-2 px-3 mb-0">{submitError}</div> : null}
        {submitSuccess ? <div className="alert alert-success py-2 px-3 mb-0">{submitSuccess}</div> : null}

        <button
          type="button"
          className="btn btn-primary btn-lg menu-order-confirm-btn"
          onClick={onConfirmOrder}
          disabled={!canConfirm}
        >
          {isSubmitting ? (
            <>
              <span className="spinner-border spinner-border-sm" aria-hidden="true" />
              <span>Enviando...</span>
            </>
          ) : (
            'Confirmar pedido'
          )}
        </button>
      </div>
    </aside>
  );
};

export default memo(CurrentOrderPanel);
