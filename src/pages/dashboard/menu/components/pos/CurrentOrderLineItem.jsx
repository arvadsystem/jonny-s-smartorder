import { memo } from 'react';
import { FaMinus, FaPlus, FaTimes } from 'react-icons/fa';
import { formatMoney } from '../../utils/menuPosOrderUtils';
import { toDisplayTitle } from '../../textFormat';

const getExtrasSummary = (item) => (
  (Array.isArray(item?.extras) ? item.extras : [])
    .map((extra) => {
      const extraCantidad = Math.max(1, Number(extra?.cantidad || 1));
      const extraTotal = Number(extra?.precio_adicional || 0) * extraCantidad;
      const suffix = extraCantidad > 1 ? ` x${extraCantidad}` : '';
      return `${toDisplayTitle(extra.nombre)}${suffix} (+${formatMoney(extraTotal)})`;
    })
    .join(', ')
);

const getSauceSummary = (item) => (
  (Array.isArray(item?.salsasPorUnidad) ? item.salsasPorUnidad : [])
    .filter((sauce) => Number(sauce?.cantidad || 0) > 0)
    .map((sauce) => {
      const totalCount = Number(sauce.cantidad || 0) * Math.max(1, Number(item?.cantidad || 1));
      return `${toDisplayTitle(sauce.nombre)} x${totalCount}`;
    })
    .join(', ')
);

const CurrentOrderLineItem = ({ item, onDecrease, onIncrease, onRemove, canEdit = true }) => {
  const extrasSummary = getExtrasSummary(item);
  const sauceSummary = getSauceSummary(item);

  return (
    <article className="menu-order-item">
      <div className="menu-order-item-copy">
        <div className="menu-order-item-name">{toDisplayTitle(item.nombre)}</div>
        <div className="menu-order-item-price">{formatMoney(item.precioUnitario)} c/u</div>

        {extrasSummary ? (
          <div className="small text-muted mt-1">Extras: {extrasSummary}</div>
        ) : null}

        {sauceSummary ? (
          <div className="small text-muted mt-1">Salsas: {sauceSummary}</div>
        ) : null}

        <div className="menu-order-item-subtotal">Subtotal: {formatMoney(item.subtotalLinea)}</div>
      </div>

      <div className="menu-order-item-actions">
        <div className="menu-order-stepper" aria-label={`Cantidad de ${item.nombre}`}>
          <button
            type="button"
            className="btn menu-order-stepper-btn"
            onClick={() => onDecrease(item.lineKey)}
            disabled={!canEdit || item.cantidad <= 1}
            aria-label={`Disminuir ${item.nombre}`}
          >
            <FaMinus />
          </button>
          <span className="menu-order-stepper-value">{item.cantidad}</span>
          <button
            type="button"
            className="btn menu-order-stepper-btn"
            onClick={() => onIncrease(item.lineKey)}
            disabled={!canEdit}
            aria-label={`Aumentar ${item.nombre}`}
          >
            <FaPlus />
          </button>
        </div>

        <button
          type="button"
          className="btn menu-order-remove-btn"
          onClick={() => onRemove(item.lineKey)}
          disabled={!canEdit}
          aria-label={`Quitar ${item.nombre}`}
        >
          <FaTimes />
        </button>
      </div>
    </article>
  );
};

export default memo(CurrentOrderLineItem);
