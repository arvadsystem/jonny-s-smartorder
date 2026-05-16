import { useState } from 'react';

const buildComplementSummaryLabel = (line) => {
  const count = Array.isArray(line?.complementos) ? line.complementos.length : 0;
  if (count <= 0) return 'Sin complementos';
  if (count === 1) return '1 complemento';
  return `${count} complementos`;
};

export default function VentaComposerSummary({
  composer,
  saving,
  deliveryCost = 0,
  pendingPaymentsSummary,
  onOpenFinalize,
  onOpenRegistrarPago
}) {
  const [totalsExpanded, setTotalsExpanded] = useState(false);
  const safeDeliveryCost = Number.isFinite(Number(deliveryCost)) && Number(deliveryCost) >= 0
    ? Number(deliveryCost)
    : 0;
  const totalWithDelivery = composer.total + safeDeliveryCost;
  const pendingCount = Number(pendingPaymentsSummary?.total ?? 0) || 0;
  const pendingAmount = Number(pendingPaymentsSummary?.monto ?? 0) || 0;
  const pendingLabel = pendingPaymentsSummary?.error
    ? pendingPaymentsSummary.error
    : pendingPaymentsSummary?.loading
      ? 'Cargando pendientes...'
      : `${pendingCount} ${pendingCount === 1 ? 'pedido pendiente' : 'pedidos pendientes'} · ${composer.formatCurrency(pendingAmount)} total pendiente`;

  const handleContinue = () => {
    if (typeof onOpenFinalize === 'function') {
      onOpenFinalize();
      return;
    }
    const fakeEvent = { preventDefault: () => {} };
    composer.handleSubmit(fakeEvent);
  };

  return (
    <aside className="ventas-create-modal__summary">
      <section className="ventas-create-modal__section ventas-create-modal__cart">
        <div className="ventas-create-modal__cart-head">
          <div className="ventas-create-modal__section-label">
            <i className="bi bi-cart3" /> Carrito
          </div>
          <span className="ventas-create-modal__count-pill">
            {composer.cartCount} {composer.cartCount === 1 ? 'item' : 'items'}
          </span>
        </div>

        <div className="ventas-create-modal__cart-list">
          {composer.cart.length === 0 ? (
            <div className="ventas-create-modal__cart-empty">
              <div className="ventas-create-modal__cart-empty-icon">
                <i className="bi bi-cart-x" />
              </div>
              <strong>Carrito vacio</strong>
              <span>Busca o selecciona items a la izquierda.</span>
            </div>
          ) : (
            composer.cart.map((line) => {
              const lineTotal = composer.formatCurrency(line.precio_unitario * line.cantidad);
              const thumb = line.imagen_principal_url || null;
              const canIncrease =
                line.kind !== 'PRODUCTO' || Number(line.cantidad ?? 0) < Number(line.stock_disponible ?? 0);

              return (
                <div key={line.cartKey} className="ventas-cart__item">
                  <div className="ventas-cart__item-thumb">
                    {thumb
                      ? <img src={thumb} alt={line.nombre_item} />
                      : <div className="ventas-cart__item-thumb-placeholder" />
                    }
                  </div>

                  <div className="ventas-cart__item-body">
                    <div className="ventas-cart__item-name">{line.nombre_item}</div>
                    {line.kind === 'PRODUCTO' ? (
                      <small className="ventas-cart__stock">Disponible: {Number(line.stock_disponible ?? 0)}</small>
                    ) : (
                      <small className="ventas-cart__stock">
                        {line.complementos_requiere ? buildComplementSummaryLabel(line) : 'Cocina'}
                      </small>
                    )}

                    <div className="ventas-cart__item-row">
                      <div className="ventas-create-modal__qty-control">
                        <button
                          type="button"
                          onClick={() =>
                            composer.updateLine(line.cartKey, (current) => ({
                              ...current,
                              cantidad: Number(current.cantidad ?? 0) - 1
                            }))
                          }
                        >
                          <i className="bi bi-dash" />
                        </button>
                        <span>{line.cantidad}</span>
                        <button
                          type="button"
                          disabled={!canIncrease}
                          onClick={() =>
                            composer.updateLine(line.cartKey, (current) => ({
                              ...current,
                              cantidad: Number(current.cantidad ?? 0) + 1
                            }))
                          }
                        >
                          <i className="bi bi-plus-lg" />
                        </button>
                      </div>
                      <strong className="ventas-create-modal__line-total">{lineTotal}</strong>
                      <button
                        type="button"
                        className="ventas-create-modal__remove-btn"
                        onClick={() => composer.removeLine(line.cartKey)}
                        title="Eliminar item"
                      >
                        <i className="bi bi-trash" />
                      </button>
                    </div>

                    {line.complementos_requiere ? (
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0 ventas-cart__compact-link"
                        onClick={() => composer.openComplementModalForLine(line.cartKey)}
                      >
                        Editar complementos
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="ventas-pendientes-compact">
        <div>
          <strong>Pagos pendientes</strong>
          <span>{pendingLabel}</span>
        </div>
        <button type="button" onClick={onOpenRegistrarPago}>
          <i className="bi bi-cash-coin" /> Ver / Cobrar
        </button>
      </section>

      <footer className="ventas-create-modal__totals">
        <button
          type="button"
          className="ventas-totals__toggle-btn"
          onClick={() => setTotalsExpanded(!totalsExpanded)}
          aria-expanded={totalsExpanded}
        >
          <i className={`bi bi-chevron-${totalsExpanded ? 'down' : 'up'}`} />
          {totalsExpanded ? 'Ocultar detalles' : 'Ver detalles'}
        </button>

        {totalsExpanded && (
          <div className="ventas-totals__details">
            <div className="ventas-totals__row">
              <span>Subtotal</span>
              <strong>{composer.formatCurrency(composer.subtotal)}</strong>
            </div>
            {composer.discountValue > 0 ? (
              <div className="ventas-totals__row">
                <span>Descuento</span>
                <strong>{composer.formatCurrency(composer.discountValue)}</strong>
              </div>
            ) : null}
            <div className="ventas-totals__row">
              <span>ISV (15%)</span>
              <strong>{composer.formatCurrency(composer.isv)}</strong>
            </div>
          </div>
        )}

        <div className="ventas-totals__row">
          <span>Subtotal</span>
          <strong>{composer.formatCurrency(composer.total)}</strong>
        </div>
        {safeDeliveryCost > 0 ? (
          <div className="ventas-totals__row">
            <span>Costo delivery</span>
            <strong>{composer.formatCurrency(safeDeliveryCost)}</strong>
          </div>
        ) : null}
        <div className="is-total ventas-totals__row">
          <span>Total</span>
          <strong>{composer.formatCurrency(totalWithDelivery)}</strong>
        </div>

        {composer.submitError ? <div className="ventas-create-modal__error">{composer.submitError}</div> : null}

        <button
          type="button"
          className="ventas-create-modal__submit"
          disabled={!composer.canContinue || saving}
          onClick={handleContinue}
        >
          {saving ? (
            <>
              <span className="spinner-border spinner-border-sm" aria-hidden="true" /> Guardando...
            </>
          ) : composer.cart.length === 0 ? (
            'Agrega items para continuar'
          ) : (
            <>
              <i className="bi bi-arrow-right-circle" /> Continuar
            </>
          )}
        </button>
      </footer>
    </aside>
  );
}
