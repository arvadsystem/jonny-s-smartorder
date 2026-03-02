import { useEffect } from 'react';
import {
  downloadVentaDetail,
  formatCurrency,
  formatDateLabel,
  formatTimeLabel
} from '../utils/ventasHelpers';

const InfoCard = ({ icon, label, value }) => (
  <div className="ventas-detail-modal__info-card">
    <span className="ventas-detail-modal__info-label">
      <i className={`bi ${icon}`} /> {label}
    </span>
    <strong>{value}</strong>
  </div>
);

export default function VentaDetalleModal({ open, venta, loading, onClose }) {
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const statusLabel = venta?.statusLabel || 'Pendiente';

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
            <span className={`ventas-detail-modal__status ${venta?.statusKey === 'completed' ? 'is-ok' : 'is-pending'}`}>
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
                <InfoCard icon="bi-calendar-event" label="Fecha" value={formatDateLabel(venta?.fecha_hora_pedido)} />
                <InfoCard icon="bi-clock" label="Hora" value={formatTimeLabel(venta?.fecha_hora_pedido)} />
                <InfoCard icon="bi-hash" label="Numero" value={venta?.numero_venta || '--'} />
                <InfoCard icon="bi-person" label="Cliente" value={venta?.cliente_nombre || 'Consumidor final'} />
                <InfoCard icon="bi-geo-alt" label="Sucursal" value={venta?.nombre_sucursal || '--'} />
                <InfoCard icon="bi-credit-card-2-front" label="Metodo de pago" value={venta?.metodo_pago || 'efectivo'} />
              </div>

              <div className="ventas-detail-modal__section">
                <div className="ventas-detail-modal__section-title">Productos</div>

                {venta?.items?.length ? (
                  <div className="ventas-detail-modal__table-wrap">
                    <table className="table ventas-detail-modal__table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Producto</th>
                          <th>Cant.</th>
                          <th>P. Unit.</th>
                          <th>Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {venta.items.map((item, index) => (
                          <tr key={item.id_detalle || `${item.id_producto}-${index}`}>
                            <td>{index + 1}</td>
                            <td>{item.nombre_producto}</td>
                            <td>{item.cantidad}</td>
                            <td>{formatCurrency(item.precio_unitario)}</td>
                            <td>{formatCurrency(item.total_linea || item.sub_total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="ventas-detail-modal__empty">No hay items asociados a esta venta.</div>
                )}
              </div>

              <div className="ventas-detail-modal__totals-card">
                <div>
                  <span>Subtotal</span>
                  <strong>{formatCurrency(venta?.sub_total)}</strong>
                </div>
                <div>
                  <span>ISV (15%)</span>
                  <strong>{formatCurrency(venta?.isv)}</strong>
                </div>
                <div className="is-total">
                  <span>Total</span>
                  <strong>{formatCurrency(venta?.total)}</strong>
                </div>
              </div>

              <footer className="ventas-detail-modal__footer">
                <div className="ventas-detail-modal__served-by">
                  Atendido por: <strong>{venta?.nombre_usuario || 'Sin usuario'}</strong>
                </div>

                <div className="ventas-detail-modal__footer-actions">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => downloadVentaDetail(venta)}
                    disabled={!venta}
                  >
                    <i className="bi bi-download" /> Exportar
                  </button>
                  <button type="button" className="btn btn-primary" onClick={() => window.print()}>
                    <i className="bi bi-printer" /> Imprimir
                  </button>
                </div>
              </footer>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
