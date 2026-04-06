export default function PlanillasHorasExtraInsight({
  totalPendientesLabel = '0h',
  empleadosConHoras = 0,
  hasPlanillaSeleccionada = false,
  canRegistrar = false,
  onOpenDetalle,
  onOpenRegistro
}) {
  return (
    <section className="planillas-insight planillas-insight--horas">
      <div className="planillas-insight__head">
        <div className="planillas-insight__title-wrap">
          <span className="planillas-insight__icon" aria-hidden="true">
            <i className="bi bi-clock-history" />
          </span>
          <div>
            <h4>Horas Extra - Sistema Tiempo x Tiempo</h4>
            <p>
              En esta empresa, las <strong>horas extra NO se pagan en dinero.</strong> Se compensan con{' '}
              <strong>tiempo libre equivalente.</strong>
            </p>
          </div>
        </div>
        <div className="planillas-insight__head-actions">
          <button
            type="button"
            className="planillas-insight__primary"
            onClick={onOpenRegistro}
            disabled={!hasPlanillaSeleccionada || !canRegistrar}
          >
            <i className="bi bi-plus-circle me-1" />
            Registrar hora extra
          </button>
          <button
            type="button"
            className="planillas-insight__ghost"
            onClick={onOpenDetalle}
            disabled={!hasPlanillaSeleccionada}
          >
            Ver detalle
          </button>
        </div>
      </div>

      <div className="planillas-insight__stats">
        <article>
          <span>Total Horas Pendientes</span>
          <strong>{totalPendientesLabel}</strong>
        </article>
        <article>
          <span>Empleados con H.E.</span>
          <strong>{empleadosConHoras}</strong>
        </article>
        <article>
          <span>Estado</span>
          <strong className="planillas-insight__state-chip">NO AFECTA NETO A PAGAR</strong>
        </article>
      </div>

      <div className="planillas-insight__note">
        <i className="bi bi-lightbulb" />
        <span>
          <strong>Importante:</strong> Las horas extra se registran en la columna "H.E. Tiempo" para control interno.
          No suman ni restan del calculo monetario de la planilla.
        </span>
      </div>
    </section>
  );
}
