import { useEffect, useRef } from 'react';
import { PAYMENT_OPTIONS } from '../hooks/useVentaComposer';

export default function VentaComposerSummary({ composer, saving }) {
  const clientPickerRef = useRef(null);
  const paymentPickerRef = useRef(null);

  // Cerrar cliente picker al hacer clic fuera
  useEffect(() => {
    if (!composer.clientPickerOpen) return undefined;

    const handlePointerDown = (event) => {
      if (clientPickerRef.current && !clientPickerRef.current.contains(event.target)) {
        composer.setClientPickerOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [composer]);

  // Cerrar payment picker al hacer clic fuera
  useEffect(() => {
    if (!composer.paymentPickerOpen) return undefined;

    const handlePointerDown = (event) => {
      if (paymentPickerRef.current && !paymentPickerRef.current.contains(event.target)) {
        composer.setPaymentPickerOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [composer]);

  const selectedPayment = PAYMENT_OPTIONS.find((o) => o.key === composer.paymentMethod) || PAYMENT_OPTIONS[0];

  return (
    <aside className="ventas-create-modal__summary">

      {/* Fila superior: Cliente + Método de pago en una sola línea */}
      <div className="ventas-summary__top-row">
        {/* Cliente */}
        <div className="ventas-summary__client-wrap" ref={clientPickerRef}>
          <button
            type="button"
            className="ventas-summary__client-btn"
            onClick={() => composer.setClientPickerOpen(!composer.clientPickerOpen)}
            title="Seleccionar cliente"
          >
            <i className="bi bi-person" />
            <span className="ventas-summary__client-name">{composer.selectedClientLabel}</span>
            <i className="bi bi-chevron-down ventas-summary__chevron" />
          </button>

          {composer.clientPickerOpen ? (
            <div className="ventas-summary__dropdown" role="listbox" aria-label="Seleccionar cliente">
              {composer.clientes.map((cliente) => {
                const optionValue = cliente.value || 'cf';
                const isSelected = optionValue === composer.selectedClient;
                return (
                  <button
                    key={optionValue}
                    type="button"
                    className={`ventas-create-modal__client-option ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => {
                      composer.setSelectedClient(optionValue);
                      composer.setClientPickerOpen(false);
                    }}
                  >
                    <span>{cliente.label}</span>
                    {isSelected ? <i className="bi bi-check2" aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* Método de pago como dropdown */}
        <div className="ventas-summary__payment-wrap" ref={paymentPickerRef}>
          <button
            type="button"
            className="ventas-summary__payment-btn"
            onClick={() => composer.setPaymentPickerOpen(!composer.paymentPickerOpen)}
            title="Método de pago"
          >
            <i className={selectedPayment.icon} />
            <span>{selectedPayment.label}</span>
            <i className="bi bi-chevron-down ventas-summary__chevron" />
          </button>

          {composer.paymentPickerOpen ? (
            <div className="ventas-summary__dropdown ventas-summary__dropdown--right" role="listbox" aria-label="Método de pago">
              {PAYMENT_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={`ventas-create-modal__client-option ${composer.paymentMethod === option.key ? 'is-selected' : ''}`}
                  onClick={() => {
                    composer.setPaymentMethod(option.key);
                    composer.setPaymentPickerOpen(false);
                  }}
                >
                  <i className={option.icon} />
                  <span>{option.label}</span>
                  {composer.paymentMethod === option.key ? <i className="bi bi-check2" aria-hidden="true" /> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Descuento + Efectivo en una sola fila */}
      <div className="ventas-create-modal__form-row ventas-summary__fields-row">
        <label className="ventas-create-modal__field">
          <span>
            <i className="bi bi-tag" /> Descuento
          </span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={composer.discount}
            onChange={(event) => composer.setDiscount(event.target.value)}
          />
        </label>

        <label className="ventas-create-modal__field">
          <span>
            <i className="bi bi-cash-coin" /> Efectivo
          </span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={composer.cashReceived}
            placeholder={String(composer.total.toFixed(2))}
            onChange={(event) => composer.setCashReceived(event.target.value)}
          />
        </label>
      </div>

      {/* Carrito con scroll */}
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
              const supportsNotes = line.kind !== 'PRODUCTO';
              const thumb = line.imagen_principal_url || null;

              return (
                <div key={line.cartKey} className="ventas-cart__item">
                  {/* Miniatura */}
                  <div className="ventas-cart__item-thumb">
                    {thumb
                      ? <img src={thumb} alt={line.nombre_item} />
                      : <div className="ventas-cart__item-thumb-placeholder" />
                    }
                  </div>

                  {/* Info + controles */}
                  <div className="ventas-cart__item-body">
                    <div className="ventas-cart__item-name">{line.nombre_item}</div>
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

                    {supportsNotes ? (
                      <input
                        type="text"
                        className="ventas-create-modal__note-input"
                        placeholder='Nota para cocina...'
                        value={line.observacion}
                        maxLength={200}
                        onChange={(event) =>
                          composer.updateLine(line.cartKey, (current) => ({
                            ...current,
                            observacion: event.target.value
                          }))
                        }
                      />
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Totales fijos al fondo */}
      <footer className="ventas-create-modal__totals">
        <div>
          <span>Subtotal</span>
          <strong>{composer.formatCurrency(composer.subtotal)}</strong>
        </div>
        <div>
          <span>Descuento</span>
          <strong>{composer.formatCurrency(composer.discountValue)}</strong>
        </div>
        <div>
          <span>ISV (15%)</span>
          <strong>{composer.formatCurrency(composer.isv)}</strong>
        </div>
        <div className="is-total">
          <span>Total</span>
          <strong>{composer.formatCurrency(composer.total)}</strong>
        </div>
        <div>
          <span>Cambio</span>
          <strong>{composer.formatCurrency(composer.change)}</strong>
        </div>

        {composer.submitError ? <div className="ventas-create-modal__error">{composer.submitError}</div> : null}

        <button type="submit" className="ventas-create-modal__submit" disabled={!composer.canSubmit || saving}>
          {saving ? (
            <>
              <span className="spinner-border spinner-border-sm" aria-hidden="true" /> Guardando...
            </>
          ) : composer.cart.length === 0 ? (
            'Agrega items para continuar'
          ) : (
            <>
              <i className="bi bi-cart-check" /> Completar Venta
            </>
          )}
        </button>
      </footer>
    </aside>
  );
}
