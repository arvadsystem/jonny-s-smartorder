const currencyFormatter = new Intl.NumberFormat('es-HN', {
  style: 'currency',
  currency: 'HNL',
  maximumFractionDigits: 2
});

const formatExtras = (extras = []) =>
  (Array.isArray(extras) ? extras : [])
    .map((extra) => String(extra?.nombre || '').trim())
    .filter(Boolean)
    .join(', ');

const formatSauces = (sauces = []) =>
  (Array.isArray(sauces) ? sauces : [])
    .map((sauce) => {
      const qty = Number(sauce?.cantidad || 0);
      const name = String(sauce?.nombre || '').trim();
      const id = Number(sauce?.id_salsa || 0);
      if (!qty || (!name && !id)) return null;
      return `${qty}x ${name || `salsa #${id}`}`;
    })
    .filter(Boolean)
    .join(', ');

const CartSheet = ({
  open,
  branchName,
  items = [],
  total = 0,
  onClose,
  onIncrease,
  onDecrease,
  onRemove,
  onConfirm,
  confirming = false,
  disabled = false,
  disabledReason = ''
}) => {
  if (!open) return null;

  return (
    <div className="pm-cart-sheet__backdrop" role="presentation" onClick={onClose}>
      <section
        className="pm-cart-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pm-cart-sheet-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="pm-cart-sheet__header">
          <div>
            <h2 id="pm-cart-sheet-title" className="pm-cart-sheet__title">
              Tu pedido
            </h2>
            <p className="pm-cart-sheet__branch">Sucursal: {branchName || 'No definida'}</p>
          </div>

          <button
            type="button"
            className="pm-cart-sheet__close"
            onClick={onClose}
            aria-label="Cerrar carrito"
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </header>

        <div className="pm-cart-sheet__body">
          {items.length === 0 ? (
            <p className="pm-cart-sheet__empty">Tu carrito esta vacio.</p>
          ) : (
            <ul className="pm-cart-sheet__list">
              {items.map((item) => (
                <li key={item.line_key || item.id_detalle_menu} className="pm-cart-sheet__item">
                  <div className="pm-cart-sheet__item-main">
                    <strong>{item.nombre}</strong>
                    {formatExtras(item.extras) ? (
                      <small className="pm-cart-sheet__line-meta">Extras: {formatExtras(item.extras)}</small>
                    ) : null}
                    {formatSauces(item.salsas_por_unidad) ? (
                      <small className="pm-cart-sheet__line-meta">
                        Salsas: {formatSauces(item.salsas_por_unidad)}
                      </small>
                    ) : null}
                    {String(item?.nota || '').trim() ? (
                      <small className="pm-cart-sheet__line-meta">
                        Nota: {String(item.nota).trim()}
                      </small>
                    ) : null}
                  </div>

                  <div className="pm-cart-sheet__item-side">
                    <span>{currencyFormatter.format(item.subtotal || 0)}</span>
                    <div className="pm-cart-sheet__qty">
                      <button type="button" onClick={() => onDecrease?.(item.line_key)}>
                        -
                      </button>
                      <span>{item.cantidad}</span>
                      <button type="button" onClick={() => onIncrease?.(item.line_key)}>
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      className="pm-cart-sheet__remove"
                      onClick={() => onRemove?.(item.line_key)}
                    >
                      Quitar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="pm-cart-sheet__footer">
          <div className="pm-cart-sheet__total-row">
            <span>Total</span>
            <strong>{currencyFormatter.format(total || 0)}</strong>
          </div>

          <button
            type="button"
            className="btn btn-dark pm-cart-sheet__confirm"
            disabled={items.length === 0 || confirming || disabled}
            onClick={onConfirm}
          >
            {confirming ? 'Enviando pedido...' : (disabled && items.length > 0 ? disabledReason || 'Sucursal cerrada' : 'Confirmar pedido')}
          </button>
        </footer>
      </section>
    </div>
  );
};

export default CartSheet;
