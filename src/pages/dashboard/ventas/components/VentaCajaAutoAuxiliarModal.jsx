import AppSelect from '../../../../components/common/AppSelect';

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

  const sessionOptions = sessions.map((row) => ({
    value: String(row.id_sesion_caja),
    label: `${row.nombre_caja} (${row.codigo_caja}) - ${row.nombre_sucursal}`
  }));

  return (
    <div className="ventas-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="ventas-modal ventas-caja-autoaux-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ventas-caja-autoaux-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ventas-modal__header">
          <div className="ventas-modal__title-wrap">
            <span className="ventas-modal__icon" aria-hidden="true">
              <i className="bi bi-safe2" />
            </span>
            <div>
              <h3 id="ventas-caja-autoaux-title">Asignación temporal de caja</h3>
              <p>Regístrate como auxiliar para operar una sesión abierta.</p>
            </div>
          </div>
        </header>
        <div className="ventas-modal__body">
          <p className="ventas-caja-autoaux-modal__intro">
            No tienes una caja asignada para procesar esta venta. Selecciona una caja activa para continuar.
          </p>
          <AppSelect
            label="Caja con sesión abierta"
            placeholder={loading ? 'Cargando sesiones...' : 'Selecciona una caja'}
            value={selectedSessionId}
            options={sessionOptions}
            onChange={onSelectSession}
            disabled={loading || assigning}
            error={errorMessage}
          />
        </div>
        <footer className="ventas-caja-autoaux-modal__footer">
          <div className="ventas-caja-autoaux-modal__actions">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={assigning}>
              Cancelar
            </button>
            <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={!selectedSessionId || assigning}>
              {assigning ? 'Registrando...' : 'Registrarme como auxiliar'}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
