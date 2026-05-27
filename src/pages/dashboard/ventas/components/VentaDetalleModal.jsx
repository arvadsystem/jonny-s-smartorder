import { useEffect, useRef, useState } from 'react';
import {
  downloadVentaDetail,
  formatDiscountPercent,
  formatCurrency,
  formatDateLabel,
  formatTimeLabel,
  getLineDiscountPercent,
  resolveVentaReversionBlockReason
} from '../utils/ventasHelpers';
import VentaTicketPrint from './VentaTicketPrint';
import './VentaTicketPrint.css';

const DEFAULT_TICKET_WIDTH_MM = 80;

const InfoCard = ({ icon, label, value }) => (
  <div className="ventas-detail-modal__info-card">
    <span className="ventas-detail-modal__info-label">
      <i className={`bi ${icon}`} /> {label}
    </span>
    <strong>{value}</strong>
  </div>
);

export default function VentaDetalleModal({
  open,
  venta,
  loading,
  onClose,
  onOpenReversion,
  canReversion = false,
  canExport = true,
  canPrint = true
}) {
  const [ticketWidthMm, setTicketWidthMm] = useState(DEFAULT_TICKET_WIDTH_MM);
  const printInProgressRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    const widthFromFacturacion = Number(venta?.facturacion?.ticket?.ancho_ticket_mm);
    const widthFromLegacy = Number(venta?.ancho_ticket_mm);
    const resolvedWidth = widthFromFacturacion === 58 || widthFromLegacy === 58 ? 58 : 80;
    setTicketWidthMm(resolvedWidth);
  }, [open, venta]);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const statusLabel = venta?.displayStatusLabel || venta?.statusLabel || 'Pendiente';
  const ticketDateTime = venta?.fecha_hora_facturacion || venta?.fecha_hora_pedido;
  const detailItems = Array.isArray(venta?.items) ? venta.items : [];
  const reversiones = Array.isArray(venta?.reversiones) ? venta.reversiones : [];
  const hasReversiones = reversiones.length > 0;
  const montoReversadoTotal = Number(venta?.monto_reversado_total || 0);
  const hasExplicitDiscountSplit = detailItems.some(
    (item) => Number(item?.descuento_linea || 0) > 0 || Number(item?.descuento_global || 0) > 0
  );
  const lineDiscountTotal = detailItems.reduce((sum, item) => {
    const explicitLineDiscount = Number(item?.descuento_linea || 0);
    const fallbackDiscount = hasExplicitDiscountSplit ? 0 : Number(item?.descuento || 0);
    return sum + (Number.isFinite(explicitLineDiscount) ? explicitLineDiscount : 0) + fallbackDiscount;
  }, 0);
  const globalDiscountFromItems = detailItems.reduce((sum, item) => sum + Number(item?.descuento_global || 0), 0);
  const discountTotal = Number(venta?.descuento_total ?? venta?.descuento ?? 0) || 0;
  const globalDiscountTotal = hasExplicitDiscountSplit
    ? globalDiscountFromItems
    : Math.max(discountTotal - lineDiscountTotal, 0);
  const resolvedDiscountTotal = Math.max(discountTotal, lineDiscountTotal + globalDiscountTotal);
  const grossSubtotalFromItems = detailItems.reduce(
    (sum, item) => sum + (Number(item?.precio_unitario || 0) * Number(item?.cantidad || 0)),
    0
  );
  const grossSubtotal = grossSubtotalFromItems > 0
    ? grossSubtotalFromItems
    : Number(venta?.subtotal_bruto ?? 0) || (Number(venta?.sub_total || 0) + resolvedDiscountTotal);
  const shouldShowItemDiscount = detailItems.some((item) => getLineDiscountPercent(item) !== null);
  const reversionBlockReason = resolveVentaReversionBlockReason(venta);

  const handlePrintTicket = () => {
    if (typeof window === 'undefined' || !venta || printInProgressRef.current) return;
    printInProgressRef.current = true;

    document.body.classList.add('venta-ticket-printing');
    const cleanup = () => {
      document.body.classList.remove('venta-ticket-printing');
      window.removeEventListener('afterprint', cleanup);
      printInProgressRef.current = false;
    };

    window.addEventListener('afterprint', cleanup);
    window.requestAnimationFrame(() => {
      window.print();
      window.setTimeout(cleanup, 1500);
    });
  };

  return (
    <div className="ventas-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="ventas-modal ventas-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ventas-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ventas-modal__header">
          <div className="ventas-modal__title-wrap">
            <span className="ventas-modal__icon" aria-hidden="true">
              <i className="bi bi-receipt" />
            </span>
            <div>
              <h3 id="ventas-detail-title">Detalle de Venta</h3>
              <p>{venta?.numero_venta || 'Sin numero'}</p>
            </div>
          </div>

          <div className="ventas-modal__header-actions">
            <span className={`ventas-detail-modal__status ${venta?.displayStatusKey === 'completed' ? 'is-ok' : 'is-pending'}`}>
              {statusLabel}
            </span>
            <button type="button" className="ventas-modal__close-btn" onClick={onClose} aria-label="Cerrar">
              <i className="bi bi-x-lg" />
            </button>
          </div>
        </header>

        <div className="ventas-modal__body ventas-detail-modal__body">
          {loading ? (
            <div className="ventas-detail-modal__loading">
              <span className="spinner-border spinner-border-sm" aria-hidden="true" />
              <span>Cargando detalle...</span>
            </div>
          ) : (
            <>
              <div className="ventas-detail-modal__info-grid">
                <InfoCard icon="bi-calendar-event" label="Fecha" value={formatDateLabel(ticketDateTime)} />
                <InfoCard icon="bi-clock" label="Hora" value={formatTimeLabel(ticketDateTime)} />
                <InfoCard icon="bi-hash" label="Numero" value={venta?.numero_venta || '--'} />
                <InfoCard icon="bi-person" label="Cliente" value={venta?.cliente_nombre || 'Consumidor final'} />
                <InfoCard icon="bi-geo-alt" label="Sucursal" value={venta?.nombre_sucursal || '--'} />
                <InfoCard icon="bi-credit-card-2-front" label="Metodo de pago" value={venta?.metodo_pago || 'efectivo'} />
              </div>

              <div className="ventas-detail-modal__section">
                <div className="ventas-detail-modal__section-title">Items</div>

                {detailItems.length ? (
                  <>
                    <div className="ventas-detail-modal__table-wrap">
                      <table className="table ventas-detail-modal__table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Item</th>
                            <th>Tipo</th>
                            <th>Cant.</th>
                            <th>P. Unit.</th>
                            {shouldShowItemDiscount ? <th>Desc. %</th> : null}
                            <th>Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailItems.map((item, index) => (
                            <tr
                              key={
                                item.id_detalle ||
                                item.id_producto ||
                                item.id_combo ||
                                item.id_receta ||
                                `${item.tipo_item}-${index}`
                              }
                            >
                              <td>{index + 1}</td>
                              <td>
                                <div className="ventas-detail-modal__item-name">
                                  <span>{item.nombre_item || item.nombre_producto}</span>
                                  {Number(item.cantidad_revertida || 0) > 0 ? (
                                    <small className="ventas-detail-modal__reversed-note">
                                      Revertido: {item.cantidad_revertida} de {item.cantidad}
                                    </small>
                                  ) : null}
                                  {item.observacion ? (
                                    <small className="ventas-detail-modal__item-note">{item.observacion}</small>
                                  ) : null}
                                </div>
                              </td>
                              <td>{item.tipo_item}</td>
                              <td>{item.cantidad}</td>
                              <td>{formatCurrency(item.precio_unitario)}</td>
                              {shouldShowItemDiscount ? (
                                <td>
                                  {getLineDiscountPercent(item) !== null ? (
                                    <div className="ventas-detail-modal__discount-cell">
                                      <strong>{formatDiscountPercent(getLineDiscountPercent(item))}</strong>
                                    </div>
                                  ) : '--'}
                                </td>
                              ) : null}
                              <td>{formatCurrency(item.total_linea || item.sub_total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="ventas-detail-modal__item-cards">
                      {detailItems.map((item, index) => (
                        <article
                          className="ventas-detail-modal__item-card"
                          key={`mobile-${item.id_detalle || item.id_producto || item.id_combo || item.id_receta || index}`}
                        >
                          <div>
                            <strong>{item.nombre_item || item.nombre_producto}</strong>
                            <span>{item.tipo_item}</span>
                          </div>
                          <dl>
                            <div><dt>Cant.</dt><dd>{item.cantidad}</dd></div>
                            <div><dt>P. unit.</dt><dd>{formatCurrency(item.precio_unitario)}</dd></div>
                            {Number(item.cantidad_revertida || 0) > 0 ? (
                              <div><dt>Revertido</dt><dd>{item.cantidad_revertida} de {item.cantidad}</dd></div>
                            ) : null}
                            {getLineDiscountPercent(item) !== null ? (
                              <div><dt>Desc. %</dt><dd>{formatDiscountPercent(getLineDiscountPercent(item))}</dd></div>
                            ) : null}
                            <div><dt>Subtotal</dt><dd>{formatCurrency(item.total_linea || item.sub_total)}</dd></div>
                          </dl>
                        </article>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="ventas-detail-modal__empty">No hay items asociados a esta venta.</div>
                )}
              </div>

              {hasReversiones ? (
                <div className="ventas-detail-modal__section">
                  <div className="ventas-detail-modal__section-title">Reversiones registradas</div>
                  <div className="ventas-detail-modal__reversions">
                    {reversiones.map((reversion) => (
                      <article className="ventas-detail-modal__reversion-card" key={reversion.id_reversion || reversion.codigo_reversion}>
                        <div className="ventas-detail-modal__reversion-head">
                          <div>
                            <strong>{reversion.codigo_reversion || 'REV'}</strong>
                            <span>{reversion.tipo_reversion || 'Reversion'} - {reversion.motivo || 'Sin motivo'}</span>
                          </div>
                          <strong className="ventas-detail-modal__reversion-amount">
                            -{formatCurrency(reversion.monto_reversado)}
                          </strong>
                        </div>
                        {reversion.observacion ? (
                          <p className="ventas-detail-modal__reversion-note">{reversion.observacion}</p>
                        ) : null}
                        <div className="ventas-detail-modal__reversion-lines">
                          {(Array.isArray(reversion.lineas) ? reversion.lineas : []).map((linea, index) => (
                            <div key={`${reversion.id_reversion}-${linea.id_detalle_factura || index}`}>
                              <span>{linea.nombre_item || 'Item'}</span>
                              <strong>{linea.cantidad_revertida} x {formatCurrency(linea.precio_unitario_original)}</strong>
                            </div>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="ventas-detail-modal__totals-card">
                <div>
                  <span>Subtotal bruto</span>
                  <strong>{formatCurrency(grossSubtotal)}</strong>
                </div>
                {resolvedDiscountTotal > 0 ? (
                  <>
                    <div>
                      <span>Descuentos por linea</span>
                      <strong>-{formatCurrency(lineDiscountTotal)}</strong>
                    </div>
                    <div>
                      <span>Descuento global</span>
                      <strong>-{formatCurrency(globalDiscountTotal)}</strong>
                    </div>
                    <div>
                      <span>Descuento total</span>
                      <strong>-{formatCurrency(resolvedDiscountTotal)}</strong>
                    </div>
                  </>
                ) : null}
                <div className="is-total">
                  <span>Total</span>
                  <strong>{formatCurrency(venta?.total)}</strong>
                </div>
                {montoReversadoTotal > 0 ? (
                  <div className="is-reversed">
                    <span>Total reversado</span>
                    <strong>-{formatCurrency(montoReversadoTotal)}</strong>
                  </div>
                ) : null}
              </div>

              <footer className="ventas-detail-modal__footer">
                <div className="ventas-detail-modal__served-by">
                  Atendido por: <strong>{venta?.nombre_usuario || 'Sin usuario'}</strong>
                </div>

                <div className="ventas-detail-modal__footer-actions">
                  {canReversion ? (
                    <button
                      type="button"
                      className="btn btn-outline-danger"
                      onClick={() => onOpenReversion?.(venta)}
                      disabled={!venta?.id_factura || Boolean(reversionBlockReason)}
                      title={reversionBlockReason || 'Registrar reversión'}
                    >
                      <i className="bi bi-arrow-counterclockwise" /> Registrar reversión
                    </button>
                  ) : null}
                  {canExport ? (
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => downloadVentaDetail(venta)}
                      disabled={!venta}
                    >
                      <i className="bi bi-download" /> Exportar
                    </button>
                  ) : null}
                  {canPrint ? (
                    <>
                      <select
                        className="form-select form-select-sm"
                        value={ticketWidthMm}
                        onChange={(event) => setTicketWidthMm(Number(event.target.value) === 58 ? 58 : 80)}
                        aria-label="Ancho de ticket"
                        style={{ maxWidth: 94 }}
                      >
                        <option value={80}>80mm</option>
                        <option value={58}>58mm</option>
                      </select>
                      <button type="button" className="btn btn-primary" onClick={handlePrintTicket}>
                        <i className="bi bi-printer" /> Imprimir ticket
                      </button>
                    </>
                  ) : null}
                </div>
              </footer>
            </>
          )}
        </div>
        {canPrint ? (
          <VentaTicketPrint
            venta={venta}
            paperWidth={ticketWidthMm}
            showLogo
            businessName={venta?.nombre_emisor || "JONNY'S WINGS"}
          />
        ) : null}
      </section>
    </div>
  );
}
