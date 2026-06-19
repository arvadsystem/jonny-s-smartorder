import PlanillasModalActions from './PlanillasModalActions';
import PlanillasModalLayout from './PlanillasModalLayout';

const formatMoney = (value) => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 'L 0.00';
  return `L ${amount.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const toText = (value, fallback = 'Sin dato') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return toText(value, '-');
  return new Intl.DateTimeFormat('es-HN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

const normalizeTipo = (value) => toText(value, '').toLowerCase();
const isHorasExtraTipo = (tipoRaw = '') =>
  tipoRaw.includes('hora') || tipoRaw.includes('h.e') || tipoRaw.includes('tiempo');

const isAdelantoTipo = (tipoRaw = '') => tipoRaw.includes('adelanto');

const formatHours = (value) => {
  const hours = Number(value ?? 0);
  if (!Number.isFinite(hours)) return '0h';
  const hasDecimals = Math.abs(hours % 1) > 0.001;
  return `${hours.toLocaleString('es-HN', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2
  })}h`;
};

const formatMovimientoMonto = (movimiento = {}) => {
  const tipoRaw = normalizeTipo(movimiento.tipo_movimiento || movimiento.tipo);
  if (
    movimiento.es_monetario === false ||
    movimiento.origen_movimiento === 'HORAS_EXTRA' ||
    isHorasExtraTipo(tipoRaw)
  ) {
    return formatHours(movimiento.monto_horas ?? movimiento.horas ?? movimiento.monto);
  }
  return formatMoney(movimiento.monto);
};

const buildMovimientoKind = (movimiento = {}) => {
  const tipoRaw = normalizeTipo(movimiento.tipo_movimiento || movimiento.tipo);
  const isBono = tipoRaw.includes('bono');
  const isAdelanto = isAdelantoTipo(tipoRaw) || movimiento.origen_movimiento === 'ADELANTO';
  const isHorasExtra = isHorasExtraTipo(tipoRaw) || movimiento.origen_movimiento === 'HORAS_EXTRA';
  return isBono ? 'bono' : isAdelanto ? 'adelanto' : isHorasExtra ? 'he' : 'deduccion';
};

const buildResumen = (rows = []) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  return safeRows.reduce(
    (acc, row) => {
      const kind = buildMovimientoKind(row);
      acc.total += 1;
      if (kind === 'bono') acc.bonos += 1;
      if (kind === 'deduccion') acc.deducciones += 1;
      if (kind === 'adelanto') acc.adelantos += 1;
      if (kind === 'he') acc.he += 1;
      return acc;
    },
    { total: 0, bonos: 0, deducciones: 0, adelantos: 0, he: 0 }
  );
};

export default function PlanillaMovimientosModal({
  open,
  item,
  loading = false,
  movimientos = [],
  onClose,
  onAnular,
  canAnular = false
}) {
  if (!open || !item) return null;

  const resumen = buildResumen(movimientos);

  return (
    <PlanillasModalLayout
      open={open}
      onClose={onClose}
      title="Movimientos del empleado"
      subtitle={toText(item.nombre_completo || item.empleado_nombre || item.nombre_empleado, 'Empleado')}
      size="lg"
      className="planillas-modal-shell--movimientos"
      actions={<PlanillasModalActions onCancel={onClose} cancelLabel="Cerrar" hidePrimary />}
    >
      <div className="planillas-movimientos-modal">
        {!loading && movimientos.length > 0 ? (
          <section className="planillas-movimientos-modal__summary" aria-label="Resumen de movimientos">
            <article className="planillas-movimientos-modal__summary-card">
              <span>Total</span>
              <strong>{resumen.total}</strong>
            </article>
            <article className="planillas-movimientos-modal__summary-card is-bono">
              <span>Bonos</span>
              <strong>{resumen.bonos}</strong>
            </article>
            <article className="planillas-movimientos-modal__summary-card is-deduccion">
              <span>Deducciones</span>
              <strong>{resumen.deducciones}</strong>
            </article>
            <article className="planillas-movimientos-modal__summary-card is-adelanto">
              <span>Adelantos</span>
              <strong>{resumen.adelantos}</strong>
            </article>
            <article className="planillas-movimientos-modal__summary-card is-he">
              <span>H.E. tiempo</span>
              <strong>{resumen.he}</strong>
            </article>
          </section>
        ) : null}

      {loading ? (
        <div className="inv-catpro-loading planillas-movimientos-modal__loading" role="status">
          <span className="spinner-border spinner-border-sm" aria-hidden="true" />
          <span>Cargando movimientos...</span>
        </div>
      ) : movimientos.length === 0 ? (
        <div className="inv-catpro-empty planillas-modal-empty planillas-movimientos-modal__empty">
          <div className="inv-catpro-empty-sub">No hay movimientos registrados para este empleado.</div>
        </div>
      ) : (
        <div className="table-responsive planillas-movimientos-modal__table-wrap">
          <table className="table table-sm align-middle planillas-modal-table planillas-movimientos-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Concepto</th>
                <th className="text-end">Monto</th>
                <th>Observacion</th>
                <th>Fecha</th>
                {canAnular ? <th className="text-end">Acciones</th> : null}
              </tr>
            </thead>
            <tbody>
              {movimientos.map((movimiento, idx) => {
                const kind = buildMovimientoKind(movimiento);
                const isAnulable =
                  canAnular &&
                  (movimiento.anulable === true ||
                    (movimiento.anulable !== false && Number.isFinite(Number(movimiento.id_movimiento_planilla))));
                return (
                  <tr key={movimiento.id_movimiento_planilla || movimiento.id_movimiento || idx}>
                    <td>
                      <span className={`planillas-movimientos-table__badge is-${kind}`}>
                        {toText(movimiento.tipo_movimiento || movimiento.tipo, '-')}
                      </span>
                    </td>
                    <td className="planillas-movimientos-table__concept">{toText(movimiento.concepto)}</td>
                    <td className="text-end planillas-movimientos-table__monto">{formatMovimientoMonto(movimiento)}</td>
                    <td className="planillas-movimientos-table__obs">{toText(movimiento.observacion, '-')}</td>
                    <td className="planillas-movimientos-table__fecha">
                      {formatDateTime(movimiento.fecha_registro || movimiento.fecha)}
                    </td>
                    {canAnular ? (
                      <td className="text-end">
                        {isAnulable ? (
                          <button
                            type="button"
                            className="btn btn-sm planillas-movimientos-table__anular"
                            onClick={() => onAnular?.(movimiento)}
                          >
                            <i className="bi bi-trash3 me-1" />
                            Anular
                          </button>
                        ) : (
                          <span className="planillas-movimientos-table__readonly">
                            <i className="bi bi-lock-fill" />
                            Solo lectura
                          </span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </PlanillasModalLayout>
  );
}
