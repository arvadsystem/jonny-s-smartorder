export default function VentaCajaAperturaDecisionModal({
  open,
  onCancel,
  onAccept
}) {
  if (!open) return null;

  return (
    <div className="ventas-modal-backdrop" role="presentation" onClick={onCancel}>
      <section
        className="ventas-modal-card ventas-caja-decision-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ventas-caja-apertura-decision-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ventas-modal-header">
          <h5 id="ventas-caja-apertura-decision-title">&iquest;Desea aperturar sesi&oacute;n de caja?</h5>
        </header>
        <div className="ventas-modal-body">
          <p>Tienes una caja asignada y no hay una sesion activa para operar en Caja.</p>
        </div>
        <footer className="ventas-modal-footer d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={onAccept}>
            Aceptar
          </button>
        </footer>
      </section>
    </div>
  );
}
