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
      {loading ? (
        <div className="inv-catpro-loading" role="status">
          <span className="spinner-border spinner-border-sm" aria-hidden="true" />
          <span>Cargando movimientos...</span>
        </div>
      ) : movimientos.length === 0 ? (
        <div className="inv-catpro-empty planillas-modal-empty">
          <div className="inv-catpro-empty-sub">No hay movimientos registrados para este empleado.</div>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm align-middle planillas-modal-table planillas-movimientos-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Concepto</th>
                <th>Monto</th>
                <th>Observacion</th>
                <th>Fecha</th>
                {canAnular ? <th className="text-end">Acciones</th> : null}
              </tr>
            </thead>
            <tbody>
              {movimientos.map((movimiento, idx) => {
                const tipoRaw = normalizeTipo(movimiento.tipo_movimiento || movimiento.tipo);
                const isBono = tipoRaw.includes('bono');
                const isAdelanto = isAdelantoTipo(tipoRaw) || movimiento.origen_movimiento === 'ADELANTO';
                const isHorasExtra = isHorasExtraTipo(tipoRaw) || movimiento.origen_movimiento === 'HORAS_EXTRA';
                const isAnulable =
                  canAnular &&
                  (movimiento.anulable === true ||
                    (movimiento.anulable !== false && Number.isFinite(Number(movimiento.id_movimiento_planilla))));
                return (
                  <tr key={movimiento.id_movimiento_planilla || movimiento.id_movimiento || idx}>
                    <td>
                      <span
                        className={`planillas-movimientos-table__badge ${
                          isBono
                            ? 'is-bono'
                            : isAdelanto
                              ? 'is-adelanto'
                              : isHorasExtra
                                ? 'is-he'
                                : 'is-deduccion'
                        }`}
                      >
                        {toText(movimiento.tipo_movimiento || movimiento.tipo, '-')}
                      </span>
                    </td>
                    <td>{toText(movimiento.concepto)}</td>
                    <td className="text-end">{formatMovimientoMonto(movimiento)}</td>
                    <td>{toText(movimiento.observacion, '-')}</td>
                    <td>{toText(movimiento.fecha_registro || movimiento.fecha, '-')}</td>
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
                          <span className="planillas-movimientos-table__readonly">Solo lectura</span>
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
    </PlanillasModalLayout>
  );
}
