export default function EnviarComandaCocinaModal({
  open,
  venta,
  loading = false,
  error = '',
  sourceType = 'factura',
  action = 'initial',
  origin = 'post-sale',
  onAccept,
  onCancel
}) {
  if (!open) return null;

  const totalProductos = Array.isArray(venta?.items)
    ? venta.items.reduce((sum, item) => sum + (Number(item?.cantidad ?? 0) || 0), 0)
    : Number(venta?.total_productos || 0) || 0;
  const isReprint = action === 'reprint';
  const isPendingOrder = sourceType === 'pedido';
  const title = isReprint ? 'Reimprimir comanda de cocina' : 'Enviar comanda a cocina';
  const message = isPendingOrder && isReprint
    ? '¿Deseas reimprimir la comanda de este pedido en cocina?'
    : isPendingOrder
      ? '¿Deseas imprimir la comanda de este pedido en cocina?'
    : isReprint
      ? '¿Deseas reimprimir la comanda de cocina?'
      : '¿Deseas enviar la comanda de este pedido a cocina?';
  const acceptLabel = loading
    ? (isReprint || isPendingOrder ? 'Imprimiendo...' : 'Enviando...')
    : (isReprint || isPendingOrder ? 'Imprimir comanda' : 'Aceptar');
  const cancelLabel = origin === 'pending-order' && !isReprint ? 'Ahora no' : 'Cancelar';

  return (
    <div className="ventas-finalizar-error-backdrop ventas-comanda-cocina-backdrop" role="presentation">
      <section
        className="ventas-modal-card ventas-finalizar-error-modal ventas-comanda-cocina-modal"
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
            Pedido: <strong>{venta?.numero_pedido || venta?.numero_venta || venta?.codigo_venta || 'Sin numero'}</strong>
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
