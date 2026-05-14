export default function SucursalDeleteConfirm({
  open,
  sucursal,
  deleting = false,
  onClose,
  onConfirm
}) {
  if (!open) return null;

  return (
    <div className="inv-pro-confirm-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="inv-pro-confirm-panel" onClick={(e) => e.stopPropagation()}>
        <div className="inv-pro-confirm-head">
          <div className="inv-pro-confirm-head-icon">
            <i className="bi bi-exclamation-triangle-fill" />
          </div>
          <div>
            <div className="inv-pro-confirm-title">Confirmar eliminacion</div>
            <div className="inv-pro-confirm-sub">Esta accion es permanente</div>
          </div>
          <button type="button" className="inv-pro-confirm-close" onClick={onClose} aria-label="Cerrar">
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="inv-pro-confirm-body">
          <div className="inv-pro-confirm-question">Deseas eliminar esta sucursal?</div>
          <div className="inv-pro-confirm-name">
            <i className="bi bi-shop" />
            <span>{sucursal?.nombre_sucursal || 'Sucursal seleccionada'}</span>
          </div>
        </div>

        <div className="inv-pro-confirm-footer">
          <button type="button" className="btn inv-pro-btn-cancel" onClick={onClose} disabled={deleting}>
            Cancelar
          </button>
          <button type="button" className="btn inv-pro-btn-danger" onClick={onConfirm} disabled={deleting}>
            <i className="bi bi-trash3" />
            <span>{deleting ? 'Eliminando...' : 'Eliminar'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

