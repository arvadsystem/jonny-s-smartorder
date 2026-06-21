import { formatDateTimeLabel } from '../utils/cocinaHelpers';

const formatNumericValue = (value) => {
  if (value === null || value === undefined || value === '') return 'N/D';
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return number.toLocaleString('es-HN', {
    minimumFractionDigits: Number.isInteger(number) ? 0 : 2,
    maximumFractionDigits: 4
  });
};

const resolveResourceLabel = (alerta) => {
  const type = String(alerta?.tipo_recurso || '').trim();
  const id =
    alerta?.id_producto ||
    alerta?.id_insumo ||
    alerta?.id_receta ||
    alerta?.id_extra ||
    alerta?.id_recurso;
  if (!type && !id) return 'Recurso no especificado';
  return `${type || 'recurso'}${id ? ` #${id}` : ''}`;
};

export default function CocinaInventoryAlertsModal({
  open,
  pedido,
  alertas,
  loading,
  error,
  onClose
}) {
  if (!open) return null;

  const safeAlertas = Array.isArray(alertas) ? alertas : [];

  return (
    <div className="kds-backdrop" role="presentation" onClick={onClose}>
      <section
        className="kds-alerts-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kds-alerts-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="kds-alerts-modal__head">
          <div>
            <span className="kds-alerts-modal__eyebrow">Inventario</span>
            <h2 id="kds-alerts-title">Alertas del pedido #{pedido?.id_pedido || '-'}</h2>
          </div>
          <button type="button" className="kds-modal__close" onClick={onClose} aria-label="Cerrar alertas">
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </header>

        {loading ? (
          <div className="kds-alerts-state">
            <div className="kds-spinner" aria-hidden="true" />
            <span>Cargando alertas...</span>
          </div>
        ) : error ? (
          <div className="kds-alerts-state is-error">
            <i className="bi bi-exclamation-triangle" aria-hidden="true" />
            <span>No se pudieron cargar las alertas.</span>
          </div>
        ) : safeAlertas.length === 0 ? (
          <div className="kds-alerts-state">
            <i className="bi bi-check-circle" aria-hidden="true" />
            <span>Este pedido no tiene alertas de inventario.</span>
          </div>
        ) : (
          <div className="kds-alerts-list">
            {safeAlertas.map((alerta) => (
              <article key={alerta.id_alerta || `${alerta.motivo}-${alerta.id_recurso}`} className="kds-alert-card">
                <div className="kds-alert-card__top">
                  <span className="kds-alert-card__motivo">{alerta.motivo || alerta.tipo_alerta || 'ALERTA'}</span>
                  <span className="kds-alert-card__estado">{alerta.estado || 'PENDIENTE'}</span>
                </div>
                <p className="kds-alert-card__message">{alerta.mensaje || 'Sin mensaje registrado.'}</p>
                <dl className="kds-alert-card__grid">
                  <div>
                    <dt>Recurso</dt>
                    <dd>{resolveResourceLabel(alerta)}</dd>
                  </div>
                  <div>
                    <dt>Requerido</dt>
                    <dd>{formatNumericValue(alerta.cantidad_requerida)}</dd>
                  </div>
                  <div>
                    <dt>Disponible</dt>
                    <dd>{formatNumericValue(alerta.stock_disponible)}</dd>
                  </div>
                  <div>
                    <dt>Deficit</dt>
                    <dd>{formatNumericValue(alerta.deficit)}</dd>
                  </div>
                  <div>
                    <dt>Fecha</dt>
                    <dd>{formatDateTimeLabel(alerta.created_at)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
