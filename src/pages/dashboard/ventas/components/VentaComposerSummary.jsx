import { useState } from 'react';

const buildComplementSummaryLabel = (line, composer) => {
  const requirement = typeof composer?.getLineComplementRequirement === 'function'
    ? composer.getLineComplementRequirement(line)
    : null;
  if (requirement?.required > 0) {
    if (requirement.selectedCount < requirement.required) {
      return `Complementos sugeridos ${requirement.selectedCount}/${requirement.required}`;
    }
    return `${requirement.selectedCount}/${requirement.required} complementos`;
  }
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
  onOpenRegistrarPago,
  variant = 'side',
  onClose
}) {
  const [expandedNotes, setExpandedNotes] = useState({});
  const pendingCount = Number(pendingPaymentsSummary?.total ?? 0) || 0;
  const pendingAmount = Number(pendingPaymentsSummary?.monto ?? 0) || 0;
  const pendingLabel = pendingPaymentsSummary?.error
    ? pendingPaymentsSummary.error
    : pendingPaymentsSummary?.loading
      ? 'Cargando pendientes...'
      : `${pendingCount} ${pendingCount === 1 ? 'pedido pendiente' : 'pedidos pendientes'} - ${composer.formatCurrency(pendingAmount)} total pendiente`;
  const lineDiscountDetailsByKey = new Map(
    (Array.isArray(composer.lineDiscountDetails) ? composer.lineDiscountDetails : [])
      .map((entry) => [String(entry?.line?.cartKey || ''), entry])
      .filter(([key]) => key)
  );
  const handleContinue = () => {
    if (typeof onOpenFinalize === 'function') {
      onOpenFinalize();
      return;
    }
    const fakeEvent = { preventDefault: () => {} };
    composer.handleSubmit(fakeEvent);
  };
  const isSheet = variant === 'sheet';
  const extrasSubtotal = Number(composer.extrasSubtotal || 0);
  const baseSubtotal = Number(composer.baseSubtotal ?? Math.max(Number(composer.subtotal || 0) - extrasSubtotal, 0));
  const shouldShowExtrasBreakdown = extrasSubtotal > 0;

  return (
    <aside className={`ventas-create-modal__summary ventas-caja-layout__cart ventas-cart-panel ventas-cart-panel--${variant}`}>
      <section className="ventas-create-modal__section ventas-create-modal__cart">
        <div className="ventas-create-modal__cart-head">
          <div
            className="ventas-create-modal__section-label"
            id={isSheet ? 'ventas-caja-mobile-cart-title' : undefined}
          >
            <i className="bi bi-cart3" /> Carrito de venta
          </div>
          <div className="ventas-cart-panel__header-actions">
            <span className="ventas-create-modal__count-pill">
              {composer.cartCount} {composer.cartCount === 1 ? 'item' : 'items'}
            </span>
            {isSheet ? (
              <button
                type="button"
                className="ventas-cart-panel__close"
                onClick={onClose}
                aria-label="Cerrar carrito"
              >
                <i className="bi bi-x-lg" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="ventas-create-modal__cart-list">
          {composer.cart.length === 0 ? (
            <div className="ventas-create-modal__cart-empty">
              <div className="ventas-create-modal__cart-empty-icon">
                <i className="bi bi-cart-x" />
              </div>
              <strong>Carrito vacio</strong>
              <span>Agrega items desde el catalogo.</span>
            </div>
          ) : (
            composer.cart.map((line) => {
              const extrasCount = typeof composer.getExtrasCount === 'function' ? composer.getExtrasCount(line.extras) : 0;
              const extrasSubtotal = typeof composer.getExtrasSubtotal === 'function' ? composer.getExtrasSubtotal(line.extras) : 0;
              const lineTotal = composer.formatCurrency((line.precio_unitario * line.cantidad) + extrasSubtotal);
              const discountDetail = lineDiscountDetailsByKey.get(String(line.cartKey)) || null;
              const thumb = line.imagen_principal_url || null;
              const canIncrease =
                line.kind !== 'PRODUCTO' || Number(line.cantidad ?? 0) < Number(line.stock_disponible ?? 0);
              const hasKitchenNote = String(line.observacion || '').trim().length > 0;
              const noteExpanded = Boolean(expandedNotes[line.cartKey]);
              const complementIssue = typeof composer.getLineComplementSelectionIssue === 'function'
                ? composer.getLineComplementSelectionIssue(line)
                : null;
              const isComplementIncomplete =
                Boolean(complementIssue) ||
                String(composer.incompleteComplementCartKey || '') === String(line.cartKey);
              const discountPercent = Number(discountDetail?.lineSubtotal || 0) > 0 && Number(discountDetail?.discountAmount || 0) > 0
                ? Math.round((Number(discountDetail.discountAmount || 0) / Number(discountDetail.lineSubtotal || 1)) * 100)
                : 0;

              return (
                <div
                  key={line.cartKey}
                  className={[
                    'ventas-cart__item',
                    isComplementIncomplete ? 'is-complement-incomplete' : ''
                  ].filter(Boolean).join(' ')}
                >
                  <div className="ventas-cart__item-thumb">
                    {thumb
                      ? <img src={thumb} alt={line.nombre_item} />
                      : <div className="ventas-cart__item-thumb-placeholder" />
                    }
                  </div>

                  <div className="ventas-cart__item-body">
                    <div className="ventas-cart__item-title-row">
                      <div className="ventas-cart__item-name">{line.nombre_item}</div>
                      {discountPercent > 0 ? (
                        <span className="ventas-cart__discount-chip">-{discountPercent}%</span>
                      ) : null}
                      {hasKitchenNote ? <span className="ventas-cart__note-badge">Con observacion</span> : null}
                    </div>
                    {line.kind === 'PRODUCTO' ? (
                      <small className="ventas-cart__stock">Disponible: {Number(line.stock_disponible ?? 0)}</small>
                    ) : (
                      <small className="ventas-cart__stock">
                        {line.complementos_requiere ? buildComplementSummaryLabel(line, composer) : 'Cocina'}
                      </small>
                    )}

                    <div className="ventas-cart__item-row">
                      <div className="ventas-create-modal__qty-control">
                        <button
                          type="button"
                          aria-label={`Disminuir cantidad de ${line.nombre_item}`}
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
                          aria-label={`Aumentar cantidad de ${line.nombre_item}`}
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
                        aria-label={`Eliminar ${line.nombre_item}`}
                      >
                        <i className="bi bi-trash" />
                      </button>
                    </div>

                    {line.kind !== 'PRODUCTO' ? (
                      <div className={`ventas-cart__kitchen-note ${noteExpanded ? 'is-expanded' : 'is-collapsed'}`}>
                        <div className="ventas-cart__line-actions-row">
                          {line.complementos_requiere ? (
                            <button
                              type="button"
                              className={`ventas-cart__action-btn ${isComplementIncomplete ? 'is-attention' : ''}`}
                              onClick={() => composer.openComplementModalForLine(line.cartKey)}
                            >
                              <i className="bi bi-ui-checks-grid" aria-hidden="true" />
                              <span>Complementos</span>
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className={`ventas-cart__action-btn ${extrasCount > 0 ? 'is-active' : ''}`}
                            onClick={() => composer.openExtrasModalForLine(line.cartKey)}
                          >
                            <i className="bi bi-plus-square-dotted" aria-hidden="true" />
                            <span>Extra +{extrasCount > 0 ? ` · ${extrasCount}` : ''}</span>
                          </button>
                          <button
                            type="button"
                            className="ventas-cart__kitchen-note-toggle"
                            onClick={() =>
                              setExpandedNotes((current) => ({
                                ...current,
                                [line.cartKey]: !current[line.cartKey]
                              }))
                            }
                            aria-expanded={noteExpanded}
                          >
                            <i className="bi bi-chat-left-text" aria-hidden="true" />
                            <span>Obs</span>
                            <i className={`bi bi-chevron-${noteExpanded ? 'up' : 'down'}`} aria-hidden="true" />
                          </button>
                        </div>
                        {noteExpanded ? (
                          <textarea
                            rows="2"
                            value={line.observacion || ''}
                            onChange={(event) =>
                              composer.updateLine(line.cartKey, (current) => ({
                                ...current,
                                observacion: event.target.value
                              }))
                            }
                            placeholder="Detalle para cocina"
                          />
                        ) : null}
                      </div>
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
          <i className="bi bi-cash-coin" /> Cobrar
        </button>
      </section>

      <footer className="ventas-create-modal__totals">
        {shouldShowExtrasBreakdown ? (
          <>
            <div className="ventas-totals__row ventas-totals__row--detail">
              <span>Base items</span>
              <strong>{composer.formatCurrency(baseSubtotal)}</strong>
            </div>
            <div className="ventas-totals__row ventas-totals__row--detail">
              <span>Extras</span>
              <strong>{composer.formatCurrency(extrasSubtotal)}</strong>
            </div>
          </>
        ) : null}
        <div className="ventas-totals__row ventas-totals__row--subtotal-only">
          <span>Subtotal bruto</span>
          <strong>{composer.formatCurrency(composer.subtotal)}</strong>
        </div>

        {Number(deliveryCost || 0) > 0 ? (
          <div className="ventas-totals__row">
            <span>Envio</span>
            <strong>{composer.formatCurrency(deliveryCost)}</strong>
          </div>
        ) : null}

        <div className="ventas-totals__row is-total">
          <span>Total</span>
          <strong>{composer.formatCurrency(composer.total + Number(deliveryCost || 0))}</strong>
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
