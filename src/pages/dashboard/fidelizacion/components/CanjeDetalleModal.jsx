import { useEffect } from 'react';
import { formatCurrency, formatFechaHora, formatPoints } from '../utils/fidelizacionHelpers';

export default function CanjeDetalleModal({ open, loading, canje, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="ventas-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="ventas-modal ventas-detail-modal fidelizacion-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fidelizacion-canje-detalle-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ventas-modal__header">
          <div className="ventas-modal__title-wrap">
            <span className="ventas-modal__icon" aria-hidden="true">
              <i className="bi bi-gift" />
            </span>
            <div>
              <h3 id="fidelizacion-canje-detalle-title">Detalle del canje</h3>
              <p>{canje?.id_canje ? `CAN-${String(canje.id_canje).padStart(5, '0')}` : 'Consultando detalle...'}</p>
            </div>
          </div>

          <div className="ventas-modal__header-actions">
            <button type="button" className="ventas-modal__close-btn" onClick={onClose} aria-label="Cerrar">
              <i className="bi bi-x-lg" />
            </button>
          </div>
        </header>

        <div className="ventas-modal__body ventas-detail-modal__body">
          {loading ? (
            <div className="ventas-detail-modal__loading">
              <span className="spinner-border spinner-border-sm" aria-hidden="true" />
              <span>Cargando detalle del canje...</span>
            </div>
          ) : canje ? (
            <>
              <div className="ventas-detail-modal__info-grid">
                <div className="ventas-detail-modal__info-card">
                  <span className="ventas-detail-modal__info-label">
                    <i className="bi bi-person" /> Cliente
                  </span>
                  <strong>{canje.cliente_nombre || '-'}</strong>
                </div>
                <div className="ventas-detail-modal__info-card">
                  <span className="ventas-detail-modal__info-label">
                    <i className="bi bi-shop" /> Sucursal
                  </span>
                  <strong>{canje.nombre_sucursal || 'N/D'}</strong>
                </div>
                <div className="ventas-detail-modal__info-card">
                  <span className="ventas-detail-modal__info-label">
                    <i className="bi bi-shield-check" /> Estado
                  </span>
                  <strong>{canje.estado_nombre || canje.estado_codigo || '-'}</strong>
                </div>
                <div className="ventas-detail-modal__info-card">
                  <span className="ventas-detail-modal__info-label">
                    <i className="bi bi-star" /> Total puntos
                  </span>
                  <strong>{formatPoints(canje.total_puntos)}</strong>
                </div>
                <div className="ventas-detail-modal__info-card">
                  <span className="ventas-detail-modal__info-label">
                    <i className="bi bi-clock-history" /> Fecha
                  </span>
                  <strong>{formatFechaHora(canje.fecha_creacion)}</strong>
                </div>
                <div className="ventas-detail-modal__info-card">
                  <span className="ventas-detail-modal__info-label">
                    <i className="bi bi-person-badge" /> Ejecutor
                  </span>
                  <strong>{canje.usuario_ejecutor || '-'}</strong>
                </div>
              </div>

              <div className="ventas-detail-modal__section">
                <div className="ventas-detail-modal__section-title">Items del canje</div>
                {canje.items?.length ? (
                  <div className="ventas-detail-modal__table-wrap">
                    <table className="table ventas-detail-modal__table">
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th>Cant.</th>
                          <th>Puntos u.</th>
                          <th>Subtotal</th>
                          <th>Precio ref.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {canje.items.map((item) => (
                          <tr key={item.id_detalle_canje || `${item.id_producto}-${item.nombre_producto}`}>
                            <td>{item.nombre_producto}</td>
                            <td>{formatPoints(item.cantidad)}</td>
                            <td>{formatPoints(item.puntos_unitarios)}</td>
                            <td>{formatPoints(item.subtotal_puntos)}</td>
                            <td>L. {formatCurrency(item.precio_referencia)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="ventas-detail-modal__empty">No se encontraron items para este canje.</div>
                )}
              </div>

              {canje.observacion ? (
                <div className="ventas-detail-modal__section">
                  <div className="ventas-detail-modal__section-title">Observacion</div>
                  <div className="fidelizacion-detail__note">{canje.observacion}</div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="ventas-detail-modal__empty">No se pudo cargar el detalle del canje.</div>
          )}
        </div>
      </section>
    </div>
  );
}
