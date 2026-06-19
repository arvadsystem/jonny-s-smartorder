import { useEffect, useMemo, useState } from 'react';
import { formatCurrency, formatPoints } from '../utils/fidelizacionHelpers';

const buildEmptyStateMessage = (backendMessage, saldoDisponible) => {
  if (backendMessage) return backendMessage;
  if (Number(saldoDisponible || 0) <= 0) return 'Debe acumular mas puntos para realizar un canje.';
  return 'No hay productos canjeables disponibles en la sucursal operativa.';
};

export default function GenerarCanjeModal({
  open,
  onClose,
  cliente,
  canjeablesData,
  saving,
  onSubmit
}) {
  const [carrito, setCarrito] = useState([]);
  const [observacion, setObservacion] = useState('');

  const canjeables = Array.isArray(canjeablesData?.items) ? canjeablesData.items : [];
  const saldoDisponible = Number(canjeablesData?.saldoCliente?.puntos_disponibles ?? cliente?.puntos_disponibles ?? 0);

  useEffect(() => {
    if (!open) return;
    setCarrito([]);
    setObservacion('');
  }, [open, cliente?.id_cliente]);

  useEffect(() => {
    if (!open || saving) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, open, saving]);

  const carritoMap = useMemo(
    () => new Map(carrito.map((item) => [item.id_producto, item])),
    [carrito]
  );

  const puntosTotalesCanje = useMemo(
    () => carrito.reduce((sum, item) => sum + Number(item.puntos_requeridos || 0) * Number(item.cantidad || 0), 0),
    [carrito]
  );

  const puntosRestantes = saldoDisponible - puntosTotalesCanje;
  const saldoInsuficiente = puntosRestantes < 0;

  const handleAgregar = (producto) => {
    const maxStock = Number(producto.stock_disponible || 0) || Infinity;
    setCarrito((prev) => {
      const current = prev.find((item) => item.id_producto === producto.id_producto);
      if (current) {
        const nextCantidad = Math.min(current.cantidad + 1, maxStock);
        if (nextCantidad === current.cantidad) return prev;
        return prev.map((item) =>
          item.id_producto === producto.id_producto ? { ...item, cantidad: nextCantidad } : item
        );
      }

      if (maxStock <= 0) return prev;
      return [...prev, { ...producto, cantidad: 1 }];
    });
  };

  const handleQuitar = (idProducto) => {
    setCarrito((prev) => {
      const current = prev.find((item) => item.id_producto === idProducto);
      if (!current) return prev;
      if (current.cantidad <= 1) {
        return prev.filter((item) => item.id_producto !== idProducto);
      }
      return prev.map((item) =>
        item.id_producto === idProducto ? { ...item, cantidad: item.cantidad - 1 } : item
      );
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving || carrito.length === 0 || saldoInsuficiente) return;

    await onSubmit(
      carrito.map((item) => ({
        id_producto: item.id_producto,
        cantidad: item.cantidad
      })),
      observacion.trim()
    );
  };

  if (!open) return null;

  return (
    <div className="ventas-modal-backdrop" role="presentation" onClick={saving ? undefined : onClose}>
      <section
        className="ventas-modal fidelizacion-canje-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fidelizacion-canje-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ventas-modal__header">
          <div className="ventas-modal__title-wrap">
            <span className="ventas-modal__icon" aria-hidden="true">
              <i className="bi bi-gift-fill" />
            </span>
            <div>
              <h3 id="fidelizacion-canje-title">Canje presencial</h3>
              <p>{cliente?.nombre || 'Cliente seleccionado'}</p>
            </div>
          </div>

          <div className="ventas-modal__header-actions">
            <button type="button" className="ventas-modal__close-btn" onClick={onClose} aria-label="Cerrar" disabled={saving}>
              <i className="bi bi-x-lg" />
            </button>
          </div>
        </header>

        <form className="ventas-modal__body ventas-create-modal__body fidelizacion-canje-modal__body" onSubmit={handleSubmit}>
          <div className="ventas-create-modal__catalog">
            <div className="ventas-create-modal__catalog-hint">
              El backend decide sucursal operativa, stock real y puntos finales del canje.
            </div>

            {canjeables.length === 0 ? (
              <div className="ventas-create-modal__empty fidelizacion-canje-modal__empty">
                <div className="ventas-create-modal__cart-empty-icon">
                  <i className="bi bi-stars" />
                </div>
                <span>{buildEmptyStateMessage(canjeablesData?.message, saldoDisponible)}</span>
              </div>
            ) : (
              <div className="fidelizacion-canje-modal__products">
                {canjeables.map((producto) => {
                  const selected = carritoMap.get(producto.id_producto);
                  return (
                    <article
                      key={producto.id_producto}
                      className={`vcp-card canjeable-card ${selected ? 'selected' : ''}`}
                      onClick={() => handleAgregar(producto)}
                    >
                      <div className="vcp-card__media">
                        <span className="fidelizacion-canje-modal__points-badge">
                          {formatPoints(producto.puntos_requeridos)} pts
                        </span>
                      </div>
                      <div className="vcp-card__body">
                        <div className="vcp-card__name">{producto.nombre_producto}</div>
                        <div className="vcp-card__meta">
                          <span>L. {formatCurrency(producto.precio)}</span>
                          <span>Stock visible: {formatPoints(producto.stock_disponible)}</span>
                        </div>
                        <div className="d-flex justify-content-between align-items-center mt-auto pt-2">
                          <small className="text-muted">
                            {selected ? `Seleccionado: ${selected.cantidad}` : 'Disponible para canje'}
                          </small>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger px-3 rounded-pill"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleAgregar(producto);
                            }}
                          >
                            <i className="bi bi-plus-lg" />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <aside className="fidelizacion-canje-modal__aside">
            <div className="fidelizacion-canje-modal__summary-card">
              <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
                <h6 className="fw-bold text-dark mb-0">{cliente?.nombre || 'Cliente'}</h6>
                <span className="badge bg-primary rounded-pill px-3 py-2 fw-medium">
                  ID: {cliente?.id_cliente || '-'}
                </span>
              </div>

              <div className="d-flex justify-content-between text-muted small fw-medium mb-1">
                <span>Puntos disponibles</span>
                <span>{formatPoints(saldoDisponible)} pts</span>
              </div>
              <div className="d-flex justify-content-between text-danger small fw-medium mb-1">
                <span>Total del canje</span>
                <span>- {formatPoints(puntosTotalesCanje)} pts</span>
              </div>
              <hr className="my-2" />
              <div className="d-flex justify-content-between fw-bold">
                <span>Saldo restante</span>
                <span className={saldoInsuficiente ? 'text-danger fw-bolder' : 'text-success'}>
                  {formatPoints(puntosRestantes)} pts
                </span>
              </div>
              {saldoInsuficiente ? (
                <div className="alert alert-danger mt-3 mb-0 py-2 small border-0 fw-medium">
                  <i className="bi bi-exclamation-triangle-fill me-2" />
                  El backend rechazara el canje si el saldo no alcanza.
                </div>
              ) : null}
            </div>

            <div className="fidelizacion-canje-modal__cart">
              <div className="ventas-detail-modal__section-title mb-3">Items a canjear</div>
              {carrito.length === 0 ? (
                <div className="ventas-detail-modal__empty">Selecciona al menos un producto para canjear.</div>
              ) : (
                <div className="ventas-detail-modal__table-wrap">
                  <table className="table ventas-detail-modal__table">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th className="text-center">Cantidad</th>
                        <th className="text-end">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {carrito.map((item) => (
                        <tr key={item.id_producto}>
                          <td>
                            <div className="fidelizacion-canje-modal__cart-product">
                              <strong>{item.nombre_producto}</strong>
                              <small>Stock visible: {formatPoints(item.stock_disponible)}</small>
                            </div>
                          </td>
                          <td className="text-center">
                            <div className="btn-group btn-group-sm fidelizacion-canje-modal__qty">
                              <button type="button" className="btn btn-outline-secondary" onClick={() => handleQuitar(item.id_producto)}>
                                -
                              </button>
                              <button type="button" className="btn btn-light text-dark fw-bold px-3 border-secondary border-opacity-25" disabled>
                                {item.cantidad}
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={() => handleAgregar(item)}
                                disabled={Number(item.stock_disponible || 0) > 0 && item.cantidad >= Number(item.stock_disponible)}
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className="text-end fw-semibold">{formatPoints(item.puntos_requeridos * item.cantidad)} pts</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold small text-muted">Observacion (opcional)</label>
              <textarea
                className="form-control rounded-3 border-light shadow-sm"
                rows="3"
                placeholder="Anotacion del cajero..."
                maxLength="200"
                value={observacion}
                onChange={(event) => setObservacion(event.target.value)}
                disabled={saving}
              />
            </div>

            <div className="d-flex justify-content-end gap-2">
              <button type="button" className="btn btn-outline-secondary rounded-3 px-4 fw-medium" onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || carrito.length === 0 || saldoInsuficiente}
                className="btn btn-danger rounded-3 px-5 fw-bold shadow-sm"
              >
                {saving ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Procesando...
                  </>
                ) : 'Confirmar canje'}
              </button>
            </div>
          </aside>
        </form>
      </section>
    </div>
  );
}
