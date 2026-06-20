export default function EnviarComandaCocinaModal({
  open,
  venta,
  loading = false,
  error = '',
  mode = 'post-sale',
  onAccept,
  onCancel
}) {
  if (!open) return null;

  const totalProductos = Array.isArray(venta?.items)
    ? venta.items.reduce((sum, item) => sum + (Number(item?.cantidad ?? 0) || 0), 0)
    : Number(venta?.total_productos || 0) || 0;
  const isReprint = mode === 'reprint';
  const title = isReprint ? 'Reimprimir comanda de cocina' : 'Enviar comanda a cocina';
  const message = isReprint
    ? 'La factura ya se abrio para impresion. ¿Deseas imprimir tambien la comanda de cocina?'
    : '¿Deseas enviar la comanda de este pedido a cocina?';
  const acceptLabel = loading
    ? (isReprint ? 'Imprimiendo...' : 'Enviando...')
    : (isReprint ? 'Imprimir comanda' : 'Aceptar');
  const cancelLabel = isReprint ? 'Solo factura' : 'Cancelar';

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
          <h5 id="ventas-enviar-comanda-title">{title}</h5>
          <p>{message}</p>
          <p className="ventas-finalizar-error-modal__detail">
            Pedido: <strong>{venta?.numero_venta || venta?.codigo_venta || 'Sin numero'}</strong>
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
            {cancelLabel}
          </button>
          <button type="button" className="btn btn-primary" onClick={onAccept} disabled={loading}>
            {acceptLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
