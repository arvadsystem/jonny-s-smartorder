export default function VentaCajaAperturaDecisionModal({
  open,
  assignment,
  onCancel,
  onAccept
}) {
  if (!open || !assignment) return null;

  const cajaLabel = assignment.nombre_caja || assignment.codigo_caja || `Caja #${assignment.id_caja}`;

  return (
    <div className="ventas-modal-backdrop ventas-caja-apertura-backdrop" role="presentation">
      <section
        className="ventas-modal-card ventas-caja-decision-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ventas-caja-apertura-decision-title"
      >
        <header className="ventas-modal-header">
          <h5 id="ventas-caja-apertura-decision-title">&iquest;Desea aperturar sesi&oacute;n de caja?</h5>
        </header>
        <div className="ventas-modal-body">
          <p>Tienes asignada la caja <strong>{cajaLabel}</strong>.</p>
          <p>No hay una sesión activa para operar en Caja.</p>
        </div>
        <footer className="ventas-modal-footer d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={onAccept} autoFocus>
            Abrir sesión
          </button>
        </footer>
      </section>
    </div>
  );
}
