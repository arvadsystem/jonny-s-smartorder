import { useEffect, useRef, useState } from 'react';
import { PAYMENT_OPTIONS } from '../hooks/useVentaComposer';

const buildDiscountLabel = (discount) => {
  if (!discount) return 'Sin descuento';
  const type = String(discount.nombre_tipo_descuento || '').toUpperCase();
  const value = Number(discount.valor_descuento ?? 0);
  if (type.includes('PORCENTAJE')) {
    return `${discount.nombre_descuento} (${value.toFixed(2)}%)`;
  }
  return `${discount.nombre_descuento} (L ${value.toFixed(2)})`;
};

export default function VentaComposerSummary({ composer, saving }) {
  const clientPickerRef = useRef(null);
  const paymentPickerRef = useRef(null);
  const sucursalPickerRef = useRef(null);
  const discountPickerRef = useRef(null);
  const [totalsExpanded, setTotalsExpanded] = useState(false);

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

  useEffect(() => {
    if (!composer.descuentoPickerOpen) return undefined;

    const handlePointerDown = (event) => {
      if (discountPickerRef.current && !discountPickerRef.current.contains(event.target)) {
        composer.setDescuentoPickerOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [composer]);

  useEffect(() => {
    if (!composer.sucursalPickerOpen) return undefined;

    const handlePointerDown = (event) => {
      if (sucursalPickerRef.current && !sucursalPickerRef.current.contains(event.target)) {
        composer.setSucursalPickerOpen(false);
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
  const selectedDiscountLabel = buildDiscountLabel(composer.selectedDiscount);

  return (
    <aside className="ventas-create-modal__summary">
      <div className="ventas-summary__top-row">
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

      <div className="ventas-create-modal__form-row ventas-summary__fields-row">
        <label className="ventas-create-modal__field ventas-create-modal__field--inline">
          <span title="Sucursal operativa">
            <i className="bi bi-shop" /> Sucursal
          </span>
          <div className="ventas-summary__sucursal-wrap" ref={sucursalPickerRef}>
            {composer.isSuperAdmin ? (
              <>
                <button
                  type="button"
                  className="ventas-summary__sucursal-btn"
                  onClick={() => composer.setSucursalPickerOpen(!composer.sucursalPickerOpen)}
                  title="Cambiar sucursal"
                >
                  <span className="ventas-summary__sucursal-name">
                    {composer.selectedSucursalLabel}
                  </span>
                  <i className="bi bi-chevron-down ventas-summary__chevron" />
                </button>

                {composer.sucursalPickerOpen && (
                  <div className="ventas-summary__dropdown" role="listbox" aria-label="Seleccionar sucursal">
                    {composer.sucursales.map((sucursal) => {
                      const val = String(sucursal.id_sucursal);
                      const isSelected = val === String(composer.selectedSucursal);
                      return (
                        <button
                          key={val}
                          type="button"
                          className={`ventas-create-modal__client-option ${isSelected ? 'is-selected' : ''}`}
                          onClick={() => {
                            composer.setSelectedSucursal(val);
                            composer.setSucursalPickerOpen(false);
                          }}
                        >
                          <span>{sucursal.nombre_sucursal}</span>
                          {isSelected ? <i className="bi bi-check2" aria-hidden="true" /> : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="ventas-summary__static-field">
                {composer.selectedSucursalLabel || 'Cargando...'}
              </div>
            )}
          </div>
        </label>

        <div className="ventas-summary__discount-wrap" ref={discountPickerRef}>
          <button
            type="button"
            className="ventas-summary__discount-btn"
            onClick={() => composer.setDescuentoPickerOpen(!composer.descuentoPickerOpen)}
            title="Seleccionar descuento"
          >
            <span className="ventas-summary__discount-label">
              <i className="bi bi-tag" /> {selectedDiscountLabel}
            </span>
            <i className="bi bi-chevron-down ventas-summary__chevron" />
          </button>

          {composer.descuentoPickerOpen ? (
            <div className="ventas-summary__dropdown" role="listbox" aria-label="Seleccionar descuento">
              <button
                type="button"
                className={`ventas-create-modal__client-option ${composer.selectedDiscountId ? '' : 'is-selected'}`}
                onClick={() => composer.setSelectedDiscountId('')}
              >
                <span>Sin descuento</span>
                {!composer.selectedDiscountId ? <i className="bi bi-check2" aria-hidden="true" /> : null}
              </button>

              {composer.descuentosCatalogo.map((discount) => {
                const key = String(discount.id_descuento_catalogo);
                const isSelected = key === String(composer.selectedDiscountId);
                return (
                  <button
                    key={key}
                    type="button"
                    className={`ventas-create-modal__client-option ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => composer.setSelectedDiscountId(key)}
                  >
                    <span>{buildDiscountLabel(discount)}</span>
                    {isSelected ? <i className="bi bi-check2" aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <label className="ventas-create-modal__field ventas-create-modal__field--inline">
          <span title="Efectivo">
            <i className="bi bi-cash-coin" /> Efectivo
          </span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={composer.cashReceived}
            placeholder={String(composer.total.toFixed(2))}
            onChange={(event) => composer.setCashReceived(event.target.value)}
            disabled={composer.paymentMethod !== 'efectivo'}
            readOnly={composer.paymentMethod !== 'efectivo'}
          />
        </label>
      </div>

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
                    ) : null}
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

                    {supportsNotes ? (
                      <input
                        type="text"
                        className="ventas-create-modal__note-input"
                        placeholder="Nota para cocina..."
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
            <div className="ventas-totals__row">
              <span>Descuento</span>
              <strong>{composer.formatCurrency(composer.discountValue)}</strong>
            </div>
            <div className="ventas-totals__row">
              <span>ISV (15%)</span>
              <strong>{composer.formatCurrency(composer.isv)}</strong>
            </div>
          </div>
        )}

        <div className="is-total ventas-totals__row">
          <span>Total</span>
          <strong>{composer.formatCurrency(composer.total)}</strong>
        </div>
        <div className="ventas-totals__row">
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
