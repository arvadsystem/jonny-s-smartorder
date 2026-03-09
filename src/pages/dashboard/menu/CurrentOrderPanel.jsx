import { memo } from 'react';
import { FaMinus, FaPlus, FaTimes } from 'react-icons/fa';
import { toDisplayTitle } from './textFormat';

const formatMoney = (value) => `L. ${Number(value || 0).toFixed(2)}`;

const getSauceSummary = (item) => (
  (Array.isArray(item?.salsasPorUnidad) ? item.salsasPorUnidad : [])
    .filter((sauce) => Number(sauce?.cantidad || 0) > 0)
    .map((sauce) => {
      const totalCount = Number(sauce.cantidad || 0) * Math.max(1, Number(item?.cantidad || 1));
      return `${toDisplayTitle(sauce.nombre)} x${totalCount}`;
    })
    .join(', ')
);

const OrderLineItem = memo(({ item, onDecrease, onIncrease, onRemove, canEdit }) => (
  <article className="menu-order-item">
    <div className="menu-order-item-copy">
      <div className="menu-order-item-name">{toDisplayTitle(item.nombre)}</div>
      <div className="menu-order-item-price">{formatMoney(item.precio)} c/u</div>
      {getSauceSummary(item) ? (
        <div className="small text-muted mt-1">Salsas: {getSauceSummary(item)}</div>
      ) : null}
    </div>

    <div className="menu-order-item-actions">
      <div className="menu-order-stepper" aria-label={`Cantidad de ${item.nombre}`}>
        <button
          type="button"
          className="btn menu-order-stepper-btn"
          onClick={() => onDecrease(item.itemKey)}
          disabled={!canEdit || item.cantidad <= 1}
          aria-label={`Disminuir ${item.nombre}`}
        >
          <FaMinus />
        </button>
        <span className="menu-order-stepper-value">{item.cantidad}</span>
        <button
          type="button"
          className="btn menu-order-stepper-btn"
          onClick={() => onIncrease(item.itemKey)}
          disabled={!canEdit}
          aria-label={`Aumentar ${item.nombre}`}
        >
          <FaPlus />
        </button>
      </div>

      <button
        type="button"
        className="btn menu-order-remove-btn"
        onClick={() => onRemove(item.itemKey)}
        disabled={!canEdit}
        aria-label={`Quitar ${item.nombre}`}
      >
        <FaTimes />
      </button>
    </div>
  </article>
));

const CurrentOrderPanel = ({
  items,
  totalAmount,
  totalItems,
  onDecrease,
  onIncrease,
  onRemove,
  canEdit = true,
  canConfirm = true
}) => {
  const itemLabel = totalItems === 1 ? 'item' : 'items';

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
              <OrderLineItem
                key={item.itemKey}
                item={item}
                onDecrease={onDecrease}
                onIncrease={onIncrease}
                onRemove={onRemove}
                canEdit={canEdit}
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

        {canConfirm ? (
          <button type="button" className="btn btn-primary btn-lg menu-order-confirm-btn">
            Confirmar Pedido
          </button>
        ) : null}
      </div>
    </aside>
  );
};

export default memo(CurrentOrderPanel);
