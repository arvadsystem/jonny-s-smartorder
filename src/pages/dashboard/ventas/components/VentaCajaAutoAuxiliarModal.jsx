export default function VentaCajaAutoAuxiliarModal({
  open,
  loading,
  sessions,
  selectedSessionId,
  assigning,
  errorMessage,
  onSelectSession,
  onConfirm,
  onClose
}) {
  if (!open) return null;

  return (
    <div className="ventas-modal-backdrop" role="presentation" onClick={onClose}>
      <section className="ventas-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <header className="ventas-modal__header">
          <div className="ventas-modal__title-wrap">
            <span className="ventas-modal__icon" aria-hidden="true"><i className="bi bi-safe2" /></span>
            <h3>Asignación temporal de caja</h3>
          </div>
        </header>
        <div className="ventas-modal__body">
          <p>No tienes una caja asignada para procesar esta venta. ¿Deseas registrarte como auxiliar de una caja activa?</p>
          <label className="ventas-create-modal__field">
            <span>Caja con sesión abierta</span>
            <select
              className="ventas-create-modal__select"
              value={selectedSessionId}
              onChange={(event) => onSelectSession(event.target.value)}
              disabled={loading || assigning}
            >
              <option value="">{loading ? 'Cargando sesiones...' : 'Selecciona una caja'}</option>
              {sessions.map((row) => (
                <option key={row.id_sesion_caja} value={row.id_sesion_caja}>
                  {row.nombre_caja} ({row.codigo_caja}) - {row.nombre_sucursal}
                </option>
              ))}
            </select>
          </label>
          {errorMessage ? <div className="ventas-create-modal__error">{errorMessage}</div> : null}
        </div>
        <footer className="ventas-detail-modal__footer">
          <div className="ventas-detail-modal__footer-actions">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={assigning}>Cancelar</button>
            <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={!selectedSessionId || assigning}>
              {assigning ? 'Registrando...' : 'Registrarme como auxiliar'}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
