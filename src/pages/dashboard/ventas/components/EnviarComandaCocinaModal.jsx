export default function EnviarComandaCocinaModal({
  open,
  venta,
  loading = false,
  error = '',
  onAccept,
  onCancel
}) {
  if (!open) return null;

  const totalProductos = Array.isArray(venta?.items)
    ? venta.items.reduce((sum, item) => sum + (Number(item?.cantidad ?? 0) || 0), 0)
    : Number(venta?.total_productos || 0) || 0;

  return (
    <div className="ventas-finalizar-error-backdrop" role="presentation">
      <section
        className="ventas-modal-card ventas-finalizar-error-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ventas-enviar-comanda-title"
      >
        <button
          type="button"
          className="ventas-modal__close-btn"
          onClick={onCancel}
          disabled={loading}
          aria-label="Cerrar"
        >
          <i className="bi bi-x-lg" />
        </button>
        <div className="ventas-finalizar-error-modal__icon" aria-hidden="true">
          <i className="bi bi-printer" />
        </div>
        <div className="ventas-finalizar-error-modal__copy">
          <h5 id="ventas-enviar-comanda-title">Enviar comanda a cocina</h5>
          <p>¿Deseas enviar la comanda de este pedido a cocina?</p>
          <p className="ventas-finalizar-error-modal__detail">
            Pedido: <strong>{venta?.numero_venta || venta?.codigo_venta || 'Sin número'}</strong>
          </p>
          <p className="ventas-finalizar-error-modal__detail">
            Productos: <strong>{totalProductos}</strong>
          </p>
          <p className="ventas-finalizar-error-modal__detail">
            Sucursal: <strong>{venta?.nombre_sucursal || 'Sin sucursal'}</strong>
          </p>
          {error ? (
            <p className="ventas-finalizar-error-modal__detail">{error}</p>
          ) : null}
        </div>
        <div className="ventas-modal-footer">
          <button type="button" className="btn btn-outline-secondary" onClick={onCancel} disabled={loading}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={onAccept} disabled={loading}>
            {loading ? 'Enviando...' : 'Aceptar'}
          </button>
        </div>
      </section>
    </div>
  );
}
