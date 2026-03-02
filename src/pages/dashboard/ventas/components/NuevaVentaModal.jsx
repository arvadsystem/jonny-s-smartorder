import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { formatCurrency, roundMoney } from '../utils/ventasHelpers';

const PAYMENT_OPTIONS = [
  { key: 'efectivo', label: 'Efectivo', icon: 'bi bi-cash' },
  { key: 'tarjeta', label: 'Tarjeta', icon: 'bi bi-credit-card' },
  { key: 'transferencia', label: 'Transfer.', icon: 'bi bi-arrow-left-right' }
];

const buildInitialState = () => ({
  search: '',
  activeCategory: 'all',
  selectedClient: 'cf',
  clientPickerOpen: false,
  paymentMethod: 'efectivo',
  discount: '0',
  cashReceived: '',
  cart: [],
  submitError: ''
});

const findLineIndex = (cart, productId) =>
  cart.findIndex((line) => Number(line.id_producto) === Number(productId));

export default function NuevaVentaModal({
  open,
  saving,
  catalogLoading,
  productos,
  categorias,
  clientes,
  onClose,
  onSubmit
}) {
  const [state, setState] = useState(buildInitialState);
  const clientPickerRef = useRef(null);
  const deferredSearch = useDeferredValue(state.search);

  useEffect(() => {
    if (!open) return undefined;

    setState(buildInitialState());

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !saving) {
        onClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, open, saving]);

  useEffect(() => {
    if (!state.clientPickerOpen) return undefined;

    const handlePointerDown = (event) => {
      if (clientPickerRef.current && !clientPickerRef.current.contains(event.target)) {
        setPartialState({ clientPickerOpen: false });
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [state.clientPickerOpen]);

  const selectedClientLabel = useMemo(() => {
    const match = (Array.isArray(clientes) ? clientes : []).find(
      (cliente) => cliente.value === state.selectedClient
    );
    return match?.label || 'Consumidor final';
  }, [clientes, state.selectedClient]);

  const filteredProducts = useMemo(() => {
    const needle = String(deferredSearch || '').trim().toLowerCase();
    const categoryValue = state.activeCategory;

    return (Array.isArray(productos) ? productos : []).filter((producto) => {
      const matchesCategory =
        categoryValue === 'all'
          ? true
          : Number(producto.id_tipo_departamento ?? 0) === Number(categoryValue);

      if (!matchesCategory) return false;
      if (!needle) return true;

      const haystack = [
        producto?.nombre_producto,
        producto?.descripcion_producto,
        producto?.categoria_label
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [deferredSearch, productos, state.activeCategory]);

  const cartCount = useMemo(
    () => state.cart.reduce((total, line) => total + Number(line.cantidad ?? 0), 0),
    [state.cart]
  );

  const subtotal = useMemo(
    () =>
      roundMoney(
        state.cart.reduce(
          (total, line) => total + Number(line.precio_unitario ?? 0) * Number(line.cantidad ?? 0),
          0
        )
      ),
    [state.cart]
  );

  const discountValue = useMemo(() => {
    const numeric = Number(state.discount);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    return roundMoney(Math.min(numeric, subtotal));
  }, [state.discount, subtotal]);

  const taxableSubtotal = roundMoney(Math.max(subtotal - discountValue, 0));
  const isv = roundMoney(taxableSubtotal * 0.15);
  const total = roundMoney(taxableSubtotal + isv);

  const cashValue = useMemo(() => {
    if (state.cashReceived === '') return total;
    const numeric = Number(state.cashReceived);
    return Number.isFinite(numeric) && numeric >= 0 ? roundMoney(numeric) : 0;
  }, [state.cashReceived, total]);

  const change = roundMoney(Math.max(cashValue - total, 0));
  const canSubmit = state.cart.length > 0 && state.paymentMethod === 'efectivo' && cashValue >= total;

  const setPartialState = (partial) => {
    setState((current) => ({
      ...current,
      ...partial
    }));
  };

  const addProduct = (producto) => {
    setState((current) => {
      const nextCart = [...current.cart];
      const index = findLineIndex(nextCart, producto.id_producto);

      if (index >= 0) {
        nextCart[index] = {
          ...nextCart[index],
          cantidad: Number(nextCart[index].cantidad ?? 0) + 1
        };
      } else {
        nextCart.push({
          id_producto: producto.id_producto,
          nombre_producto: producto.nombre_producto,
          categoria_label: producto.categoria_label,
          precio_unitario: producto.precio,
          cantidad: 1,
          nota: ''
        });
      }

      return {
        ...current,
        cart: nextCart,
        submitError: ''
      };
    });
  };

  const updateLine = (productId, updater) => {
    setState((current) => ({
      ...current,
      cart: current.cart
        .map((line) => (Number(line.id_producto) === Number(productId) ? updater(line) : line))
        .filter((line) => Number(line.cantidad ?? 0) > 0)
    }));
  };

  const handleSearchKeyDown = (event) => {
    if (event.key !== 'Enter') return;
    if (filteredProducts.length === 0) return;
    event.preventDefault();
    addProduct(filteredProducts[0]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (state.paymentMethod !== 'efectivo') {
      setPartialState({
        submitError: 'El esquema actual solo soporta ventas en efectivo.'
      });
      return;
    }

    if (state.cart.length === 0) {
      setPartialState({
        submitError: 'Agrega al menos un producto al carrito.'
      });
      return;
    }

    if (cashValue < total) {
      setPartialState({
        submitError: 'El efectivo entregado no puede ser menor al total.'
      });
      return;
    }

    const notesSummary = state.cart
      .map((line) => {
        const note = String(line.nota || '').trim();
        return note ? `${line.nombre_producto}: ${note}` : '';
      })
      .filter(Boolean)
      .join(' | ')
      .slice(0, 250);

    try {
      await onSubmit({
        id_cliente: state.selectedClient === 'cf' ? null : Number(state.selectedClient),
        metodo_pago: 'efectivo',
        descuento: discountValue,
        efectivo_entregado: cashValue,
        descripcion_pedido: notesSummary || null,
        items: state.cart.map((line) => ({
          id_producto: Number(line.id_producto),
          cantidad: Number(line.cantidad)
        }))
      });
    } catch (error) {
      setPartialState({
        submitError: error?.message || 'No se pudo registrar la venta.'
      });
    }
  };

  if (!open) return null;

  return (
    <div className="ventas-modal-backdrop" role="presentation" onClick={!saving ? onClose : undefined}>
      <section
        className="ventas-modal ventas-create-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ventas-create-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ventas-modal__header">
          <div className="ventas-modal__title-wrap">
            <span className="ventas-modal__icon" aria-hidden="true">
              <i className="bi bi-cart3" />
            </span>
            <div>
              <h3 id="ventas-create-title">Nueva Venta</h3>
              <p>Punto de venta rapido</p>
            </div>
          </div>

          <div className="ventas-modal__header-actions">
            <button type="button" className="ventas-modal__ghost-btn" title="Atajos">
              <i className="bi bi-keyboard" />
            </button>
            <button type="button" className="ventas-modal__close-btn" onClick={onClose} disabled={saving} aria-label="Cerrar">
              <i className="bi bi-x-lg" />
            </button>
          </div>
        </header>

        <form className="ventas-modal__body ventas-create-modal__body" onSubmit={handleSubmit}>
          <div className="ventas-create-modal__catalog">
            <label className="ventas-create-modal__search" aria-label="Buscar producto">
              <i className="bi bi-search" />
              <input
                type="search"
                placeholder="Buscar producto..."
                value={state.search}
                onChange={(event) => setPartialState({ search: event.target.value })}
                onKeyDown={handleSearchKeyDown}
              />
              <span className="ventas-create-modal__search-hint">/</span>
            </label>

            <div className="ventas-create-modal__chips" aria-label="Categorias">
              <button
                type="button"
                className={`ventas-create-modal__chip ${state.activeCategory === 'all' ? 'is-active' : ''}`}
                onClick={() => setPartialState({ activeCategory: 'all' })}
              >
                Todos
              </button>
              {(Array.isArray(categorias) ? categorias : []).map((categoria) => (
                <button
                  key={categoria.id_tipo_departamento}
                  type="button"
                  className={`ventas-create-modal__chip ${
                    String(state.activeCategory) === String(categoria.id_tipo_departamento) ? 'is-active' : ''
                  }`}
                  onClick={() =>
                    setPartialState({
                      activeCategory: String(categoria.id_tipo_departamento)
                    })
                  }
                >
                  {categoria.nombre_departamento}
                </button>
              ))}
            </div>

            <div className="ventas-create-modal__results-meta">
              {catalogLoading ? 'Cargando catalogo...' : `${filteredProducts.length} productos`}
            </div>

            <div className="ventas-create-modal__products">
              {catalogLoading ? (
                <div className="ventas-create-modal__empty">
                  <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                  <span>Cargando productos...</span>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="ventas-create-modal__empty">
                  <i className="bi bi-search" />
                  <span>No hay productos para ese filtro.</span>
                </div>
              ) : (
                filteredProducts.map((producto) => (
                  <button
                    key={producto.id_producto}
                    type="button"
                    className="ventas-create-modal__product-card"
                    onClick={() => addProduct(producto)}
                  >
                    <span className="ventas-create-modal__product-pill">{producto.categoria_label}</span>
                    <strong>{producto.nombre_producto}</strong>
                    <span className="ventas-create-modal__product-price">{formatCurrency(producto.precio)}</span>
                    <span className="ventas-create-modal__product-desc">
                      {producto.descripcion_producto || producto.categoria_label}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          <aside className="ventas-create-modal__summary">
            <section className="ventas-create-modal__section ventas-create-modal__client-picker" ref={clientPickerRef}>
              <div className="ventas-create-modal__section-label">
                <i className="bi bi-person" /> Cliente
              </div>

              <div className="ventas-create-modal__summary-field">
                <span>{selectedClientLabel}</span>
                <button
                  type="button"
                  className="ventas-create-modal__link-btn"
                  onClick={() => setPartialState({ clientPickerOpen: !state.clientPickerOpen })}
                >
                  Cambiar
                </button>
              </div>

              {state.clientPickerOpen ? (
                <div className="ventas-create-modal__client-menu" role="listbox" aria-label="Seleccionar cliente">
                  {(Array.isArray(clientes) ? clientes : []).map((cliente) => {
                    const optionValue = cliente.value || 'cf';
                    const isSelected = optionValue === state.selectedClient;

                    return (
                      <button
                        key={optionValue}
                        type="button"
                        className={`ventas-create-modal__client-option ${isSelected ? 'is-selected' : ''}`}
                        onClick={() =>
                          setPartialState({
                            selectedClient: optionValue,
                            clientPickerOpen: false
                          })
                        }
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
                      state.paymentMethod === option.key ? 'is-active' : ''
                    }`}
                    onClick={() => setPartialState({ paymentMethod: option.key, submitError: '' })}
                    aria-pressed={state.paymentMethod === option.key}
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
                    value={state.discount}
                    onChange={(event) => setPartialState({ discount: event.target.value })}
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
                    value={state.cashReceived}
                    placeholder={String(total.toFixed(2))}
                    onChange={(event) => setPartialState({ cashReceived: event.target.value })}
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
                  {cartCount} {cartCount === 1 ? 'item' : 'items'}
                </span>
              </div>

              <div className="ventas-create-modal__cart-list">
                {state.cart.length === 0 ? (
                  <div className="ventas-create-modal__cart-empty">
                    <div className="ventas-create-modal__cart-empty-icon">
                      <i className="bi bi-cart-x" />
                    </div>
                    <strong>Carrito vacio</strong>
                    <span>Busca o selecciona productos a la izquierda.</span>
                  </div>
                ) : (
                  state.cart.map((line) => {
                    const lineTotal = roundMoney(line.precio_unitario * line.cantidad);

                    return (
                      <div key={line.id_producto} className="ventas-create-modal__cart-item">
                        <div className="ventas-create-modal__cart-item-head">
                          <div>
                            <strong>{line.nombre_producto}</strong>
                            <span className="ventas-create-modal__product-pill">{line.categoria_label}</span>
                            <small>{formatCurrency(line.precio_unitario)} c/u</small>
                          </div>
                          <strong className="ventas-create-modal__line-total">{formatCurrency(lineTotal)}</strong>
                        </div>

                        <div className="ventas-create-modal__cart-item-actions">
                          <div className="ventas-create-modal__qty-control">
                            <button
                              type="button"
                              onClick={() =>
                                updateLine(line.id_producto, (current) => ({
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
                                updateLine(line.id_producto, (current) => ({
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
                            onClick={() =>
                              setState((current) => ({
                                ...current,
                                cart: current.cart.filter(
                                  (item) => Number(item.id_producto) !== Number(line.id_producto)
                                )
                              }))
                            }
                            title="Eliminar item"
                          >
                            <i className="bi bi-trash" />
                          </button>
                        </div>

                        <input
                          type="text"
                          className="ventas-create-modal__note-input"
                          placeholder='Ej. "sin cebolla", "extra salsa"'
                          value={line.nota}
                          onChange={(event) =>
                            updateLine(line.id_producto, (current) => ({
                              ...current,
                              nota: event.target.value
                            }))
                          }
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            <footer className="ventas-create-modal__totals">
              <div>
                <span>Subtotal</span>
                <strong>{formatCurrency(subtotal)}</strong>
              </div>
              <div>
                <span>Descuento</span>
                <strong>{formatCurrency(discountValue)}</strong>
              </div>
              <div>
                <span>ISV (15%)</span>
                <strong>{formatCurrency(isv)}</strong>
              </div>
              <div className="is-total">
                <span>Total</span>
                <strong>{formatCurrency(total)}</strong>
              </div>
              <div>
                <span>Cambio</span>
                <strong>{formatCurrency(change)}</strong>
              </div>

              {state.submitError ? <div className="ventas-create-modal__error">{state.submitError}</div> : null}

              <button type="submit" className="ventas-create-modal__submit" disabled={!canSubmit || saving}>
                {saving ? (
                  <>
                    <span className="spinner-border spinner-border-sm" aria-hidden="true" /> Guardando...
                  </>
                ) : state.cart.length === 0 ? (
                  'Agrega productos para continuar'
                ) : (
                  <>
                    <i className="bi bi-cart-check" /> Completar Venta
                  </>
                )}
              </button>
            </footer>
          </aside>
        </form>
      </section>
    </div>
  );
}
