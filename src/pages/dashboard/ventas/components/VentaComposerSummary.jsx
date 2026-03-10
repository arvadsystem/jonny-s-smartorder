import { useEffect, useRef } from 'react';
import { PAYMENT_OPTIONS } from '../hooks/useVentaComposer';

export default function VentaComposerSummary({ composer, saving }) {
  const clientPickerRef = useRef(null);

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

  return (
    <aside className="ventas-create-modal__summary">
      <section className="ventas-create-modal__section ventas-create-modal__client-picker" ref={clientPickerRef}>
        <div className="ventas-create-modal__section-label">
          <i className="bi bi-person" /> Cliente
        </div>

        <div className="ventas-create-modal__summary-field">
          <span>{composer.selectedClientLabel}</span>
          <button
            type="button"
            className="ventas-create-modal__link-btn"
            onClick={() => composer.setClientPickerOpen(!composer.clientPickerOpen)}
          >
            Cambiar
          </button>
        </div>

        {composer.clientPickerOpen ? (
          <div className="ventas-create-modal__client-menu" role="listbox" aria-label="Seleccionar cliente">
            {composer.clientes.map((cliente) => {
              const optionValue = cliente.value || 'cf';
              const isSelected = optionValue === composer.selectedClient;

              return (
                <button
                  key={optionValue}
                  type="button"
                  className={`ventas-create-modal__client-option ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => composer.setSelectedClient(optionValue)}
                >
                  <span>{cliente.label}</span>
                  {isSelected ? <i className="bi bi-check2" aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </section>

      <section className="ventas-create-modal__section">
        <div className="ventas-create-modal__section-label">
          <i className="bi bi-credit-card-2-front" /> Metodo de pago
        </div>

        <div className="ventas-create-modal__payment-group">
          {PAYMENT_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`ventas-create-modal__payment-btn ${
                composer.paymentMethod === option.key ? 'is-active' : ''
              }`}
              onClick={() => composer.setPaymentMethod(option.key)}
              aria-pressed={composer.paymentMethod === option.key}
            >
              <i className={option.icon} /> {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="ventas-create-modal__section">
        <div className="ventas-create-modal__form-row">
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
      </section>

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

              return (
                <div key={line.cartKey} className="ventas-create-modal__cart-item">
                  <div className="ventas-create-modal__cart-item-head">
                    <div>
                      <strong>{line.nombre_item}</strong>
                      <div className="ventas-create-modal__cart-item-meta">
                        <span className="ventas-create-modal__product-pill">{line.categoria_label}</span>
                        <small>{composer.formatCurrency(line.precio_unitario)} c/u</small>
                      </div>
                    </div>
                    <strong className="ventas-create-modal__line-total">{lineTotal}</strong>
                  </div>

                  <div className="ventas-create-modal__cart-item-actions">
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
                    <div className="ventas-create-modal__note-wrap">
                      <div className="ventas-create-modal__note-label">
                        <i className="bi bi-journal-text" /> Nota para cocina
                      </div>
                      <input
                        type="text"
                        className="ventas-create-modal__note-input"
                        placeholder='Ej. "sin cebolla", "extra salsa"'
                        value={line.observacion}
                        maxLength={200}
                        onChange={(event) =>
                          composer.updateLine(line.cartKey, (current) => ({
                            ...current,
                            observacion: event.target.value
                          }))
                        }
                      />
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </section>

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
