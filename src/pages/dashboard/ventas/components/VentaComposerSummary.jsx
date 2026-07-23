import { useEffect, useState } from 'react';
import {
  VENTA_BULK_QUANTITY_CONFIRM_THRESHOLD,
  VENTA_LINE_MAX_QUANTITY,
  buildVentaQuantityCommitResult,
  canIncreaseStandaloneExtraQuantity,
  clampVentaLineQuantity,
  normalizeExtras
} from '../../../../modules/ventas/utils/ventasCartUtils';

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
  const [quantityDrafts, setQuantityDrafts] = useState({});
  const [quantityValidationMessage, setQuantityValidationMessage] = useState('');
  const [pendingQuantityConfirm, setPendingQuantityConfirm] = useState(null);
  const isStandaloneExtraLine = (line) => String(line?.kind || '').toUpperCase() === 'ITEM';
  const hasPreparations = (Array.isArray(composer.cart) ? composer.cart : [])
    .some((line) => ['RECETA', 'ITEM'].includes(String(line?.kind || '').toUpperCase()));
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
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- drafts mirror cart identity/quantity after merges, removals and cartKey changes.
    setQuantityDrafts(() => Object.fromEntries(
      (Array.isArray(composer.cart) ? composer.cart : []).map((line) => [
        String(line.cartKey),
        String(line.cantidad || 1)
      ])
    ));
  }, [composer.cart]);
  const commitQuantity = (line, rawValue, { manual = false } = {}) => {
    const result = buildVentaQuantityCommitResult(rawValue, line.cantidad, { manual });
    if (!result.ok) {
      setQuantityDrafts((current) => ({ ...current, [line.cartKey]: result.draft }));
      setQuantityValidationMessage(result.message);
      return;
    }
    setQuantityValidationMessage('');
    if (result.shouldConfirm) {
      setPendingQuantityConfirm({ line, cantidad: result.quantity });
      return;
    }
    composer.updateLine(line.cartKey, (current) => ({ ...current, cantidad: result.quantity }));
    setQuantityDrafts((current) => ({ ...current, [line.cartKey]: result.draft }));
  };
  const describeLineConfig = (line) => {
    const parts = [line?.nombre_item || 'Item'];
    if (Array.isArray(line?.complementos) && line.complementos.length > 0) {
      parts.push(`Salsa: ${line.complementos.map((entry) => entry?.nombre || 'Complemento').join(', ')}`);
    }
    normalizeExtras(line?.extras).forEach((extra) => {
      parts.push(`Extra: ${extra.nombre} x ${extra.cantidad} por orden`);
    });
    return parts;
  };

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
              const quantity = clampVentaLineQuantity(line.cantidad || 1);
              const extrasPerOrderSubtotal = typeof composer.getExtrasSubtotal === 'function' ? composer.getExtrasSubtotal(line.extras) : 0;
              const extrasSubtotal = typeof composer.getLineExtrasSubtotal === 'function'
                ? composer.getLineExtrasSubtotal(line)
                : extrasPerOrderSubtotal * quantity;
              const lineTotal = composer.formatCurrency((line.precio_unitario * quantity) + extrasSubtotal);
              const discountDetail = lineDiscountDetailsByKey.get(String(line.cartKey)) || null;
              const thumb = line.imagen_principal_url || null;
              const isSimpleProduct = line.kind === 'PRODUCTO';
              const isStandaloneExtra = isStandaloneExtraLine(line);
              const isRecipe = String(line.kind || '').toUpperCase() === 'RECETA';
              const isQuantityManaged = isSimpleProduct || isStandaloneExtra || isRecipe;
              const standaloneExtraMax = Number(line.available_units ?? 0);
              const canIncrease =
                isSimpleProduct
                  ? Number(line.cantidad ?? 0) < Math.min(VENTA_LINE_MAX_QUANTITY, Number(line.stock_disponible ?? 0))
                  : isStandaloneExtra
                    ? canIncreaseStandaloneExtraQuantity(line)
                    : Number(line.cantidad ?? 0) < VENTA_LINE_MAX_QUANTITY;
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
                  data-testid="ventas-cart-item"
                  data-cart-kind={line.kind}
                  data-cart-key={line.cartKey}
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
                    {isSimpleProduct || isStandaloneExtra ? (
                      <small className="ventas-cart__stock">
                        {isStandaloneExtra && standaloneExtraMax <= 0
                          ? 'Stock bajo'
                          : `Disponible: ${Number(isStandaloneExtra ? standaloneExtraMax : (line.stock_disponible ?? 0))}`}
                      </small>
                    ) : isRecipe ? (
                      <small className="ventas-cart__stock">
                        {line.complementos_requiere ? buildComplementSummaryLabel(line, composer) : 'Preparacion en cocina'}
                      </small>
                    ) : (
                      <small className="ventas-cart__stock">
                        {line.complementos_requiere ? buildComplementSummaryLabel(line, composer) : 'Cocina'}
                      </small>
                    )}

                    {isSimpleProduct && hasPreparations ? (
                      <label className="ventas-cart__delivery-timing">
                        <input
                          type="checkbox"
                          checked={line.entregar_con_pedido !== false}
                          onChange={(event) => {
                            const entregarConPedido = event.target.checked;
                            composer.updateLine(
                              line.cartKey,
                              (current) => ({ ...current, entregar_con_pedido: entregarConPedido }),
                              { merge: false }
                            );
                          }}
                        />
                        <span>Entregar junto con la comida</span>
                      </label>
                    ) : null}

                    <div className="ventas-cart__item-row">
                      {isQuantityManaged ? (
                        <div className="ventas-create-modal__qty-control" data-testid="ventas-cart-product-qty">
                          <button
                            type="button"
                            aria-label={`Disminuir cantidad de ${line.nombre_item}`}
                            onClick={() => {
                              const nextQuantity = Number(line.cantidad ?? 0) - 1;
                              setQuantityDrafts((current) => ({ ...current, [line.cartKey]: String(Math.max(nextQuantity, 0)) }));
                              setQuantityValidationMessage('');
                              composer.updateLine(line.cartKey, (current) => ({
                                ...current,
                                cantidad: Number(current.cantidad ?? 0) - 1
                              }));
                            }}
                          >
                            <i className="bi bi-dash" />
                          </button>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            aria-label={`Cantidad de ${line.nombre_item}`}
                            value={quantityDrafts[line.cartKey] ?? String(line.cantidad || 1)}
                            onChange={(event) => {
                              setQuantityDrafts((current) => ({ ...current, [line.cartKey]: event.target.value }));
                              setQuantityValidationMessage('');
                            }}
                            onBlur={(event) => commitQuantity(line, event.target.value, { manual: true })}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                commitQuantity(line, event.currentTarget.value, { manual: true });
                              }
                            }}
                          />
                          <button
                            type="button"
                            aria-label={`Aumentar cantidad de ${line.nombre_item}`}
                            disabled={!canIncrease}
                            onClick={() => {
                              const nextQuantity = Number(line.cantidad ?? 0) + 1;
                              setQuantityDrafts((current) => ({ ...current, [line.cartKey]: String(nextQuantity) }));
                              setQuantityValidationMessage('');
                              composer.updateLine(line.cartKey, (current) => ({
                                ...current,
                                cantidad: Number(current.cantidad ?? 0) + 1
                              }));
                            }}
                          >
                            <i className="bi bi-plus-lg" />
                          </button>
                        </div>
                      ) : null}
                      <strong className="ventas-create-modal__line-total">{lineTotal}</strong>
                      <button
                        type="button"
                        className="ventas-create-modal__remove-btn"
                        onClick={() => {
                          const lineQuantity = Number(line.cantidad || 1);
                          if (
                            lineQuantity >= VENTA_BULK_QUANTITY_CONFIRM_THRESHOLD &&
                            !window.confirm(`Eliminar las ${lineQuantity} ordenes de ${line.nombre_item}?`)
                          ) {
                            return;
                          }
                          composer.removeLine(line.cartKey);
                        }}
                        title="Eliminar item"
                        aria-label={`Eliminar ${line.nombre_item}`}
                      >
                        <i className="bi bi-trash" />
                      </button>
                    </div>

                    {!isSimpleProduct ? (
                      <div className={`ventas-cart__kitchen-note ${noteExpanded ? 'is-expanded' : 'is-collapsed'}`}>
                        <div className="ventas-cart__line-actions-row">
                          {!isStandaloneExtra && line.complementos_requiere ? (
                            <button
                              type="button"
                              className={`ventas-cart__action-btn ${isComplementIncomplete ? 'is-attention' : ''}`}
                              data-testid="ventas-cart-complementos"
                              onClick={() => composer.openComplementModalForLine(line.cartKey)}
                            >
                              <i className="bi bi-ui-checks-grid" aria-hidden="true" />
                              <span>Complementos</span>
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className={`ventas-cart__action-btn ${extrasCount > 0 ? 'is-active' : ''} ${isStandaloneExtra ? 'd-none' : ''}`}
                            data-testid="ventas-cart-extras"
                            onClick={() => composer.openExtrasModalForLine(line.cartKey)}
                            disabled={isStandaloneExtra}
                          >
                            <i className="bi bi-plus-square-dotted" aria-hidden="true" />
                            <span>Extra +{extrasCount > 0 ? ` · ${extrasCount}` : ''}</span>
                          </button>
                          <button
                            type="button"
                            className="ventas-cart__kitchen-note-toggle"
                            data-testid="ventas-cart-observacion-toggle"
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
                            data-testid="ventas-cart-observacion"
                            onChange={(event) =>
                              composer.updateLine(line.cartKey, (current) => ({
                                ...current,
                                observacion: event.target.value
                              }), { merge: false })
                            }
                            onBlur={() => composer.updateLine(line.cartKey, (current) => ({ ...current }))}
                            placeholder={Number(line.cantidad || 1) > 1 ? `Observacion para las ${line.cantidad} ordenes` : 'Detalle para cocina'}
                          />
                        ) : null}
                        {extrasCount > 0 ? (
                          <div className="ventas-cart__extras-summary">
                            {normalizeExtras(line.extras).map((extra) => (
                              <small key={extra.id_extra}>
                                {extra.nombre}: {extra.cantidad} por orden - {extra.cantidad * quantity} en total
                              </small>
                            ))}
                            <small>Extras por orden: {composer.formatCurrency(extrasPerOrderSubtotal)}</small>
                          </div>
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
        {quantityValidationMessage ? <div className="ventas-create-modal__error">{quantityValidationMessage}</div> : null}
        {composer.cartNotice ? <div className="ventas-create-modal__hint">{composer.cartNotice}</div> : null}

        <button
          type="button"
          className="ventas-create-modal__submit"
          data-testid="ventas-cart-continuar"
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
      {pendingQuantityConfirm ? (
        <div className="ventas-modal-backdrop ventas-bulk-quantity-modal-backdrop" role="presentation">
          <section
            className="ventas-modal ventas-bulk-quantity-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="ventas-bulk-qty-title"
          >
            <header className="ventas-modal__header">
              <div className="ventas-modal__title-wrap">
                <span className="ventas-modal__icon"><i className="bi bi-exclamation-triangle" /></span>
                <div>
                  <h3 id="ventas-bulk-qty-title">Confirmar cantidad</h3>
                  <p>Estas agregando {pendingQuantityConfirm.cantidad} ordenes de:</p>
                </div>
              </div>
            </header>
            <div className="ventas-modal__body ventas-bulk-quantity-modal__body">
              <div className="ventas-bulk-quantity-modal__summary">
                {describeLineConfig(pendingQuantityConfirm.line).map((entry) => (
                  <p className="ventas-bulk-quantity-modal__line" key={entry}>{entry}</p>
                ))}
                <p className="ventas-bulk-quantity-modal__line">
                  <strong>Cantidad:</strong>
                  <span>{pendingQuantityConfirm.cantidad}</span>
                </p>
                {normalizeExtras(pendingQuantityConfirm.line.extras).map((extra) => (
                  <p className="ventas-bulk-quantity-modal__line" key={extra.id_extra}>
                    <strong>Extra {extra.nombre} total:</strong>
                    <span>{extra.cantidad * pendingQuantityConfirm.cantidad}</span>
                  </p>
                ))}
                <p className="ventas-bulk-quantity-modal__total">
                  <strong>Subtotal estimado antes de descuentos:</strong>{' '}
                  <span>
                    {composer.formatCurrency(
                      (Number(pendingQuantityConfirm.line.precio_unitario || 0) + composer.getExtrasSubtotal(pendingQuantityConfirm.line.extras)) *
                      pendingQuantityConfirm.cantidad
                    )}
                  </span>
                </p>
              </div>
            </div>
            <footer className="ventas-detail-modal__footer ventas-bulk-quantity-modal__footer">
              <div className="ventas-detail-modal__footer-actions ventas-bulk-quantity-modal__actions">
                <button
                  type="button"
                  className="btn btn-outline-secondary ventas-bulk-quantity-modal__button"
                  onClick={() => {
                    const { line } = pendingQuantityConfirm;
                    setQuantityDrafts((current) => ({ ...current, [line.cartKey]: String(line.cantidad || 1) }));
                    setPendingQuantityConfirm(null);
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-warning ventas-bulk-quantity-modal__button ventas-bulk-quantity-modal__button--primary"
                  onClick={() => {
                    const { line, cantidad } = pendingQuantityConfirm;
                    composer.updateLine(line.cartKey, (current) => ({ ...current, cantidad }));
                    setQuantityDrafts((current) => ({ ...current, [line.cartKey]: String(cantidad) }));
                    setQuantityValidationMessage('');
                    setPendingQuantityConfirm(null);
                  }}
                >
                  Aplicar {pendingQuantityConfirm.cantidad} ordenes
                </button>
              </div>
            </footer>
          </section>
        </div>
      ) : null}
    </aside>
  );
}
