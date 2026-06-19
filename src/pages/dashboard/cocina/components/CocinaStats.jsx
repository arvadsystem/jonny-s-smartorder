/**
 * CocinaStats — KPIs del tablero KDS
 * Muestra contadores de pedidos por columna con iconos y colores semánticos.
 */
export default function CocinaStats({ stats }) {
  return (
    <div className="kds-stats" aria-label="Resumen de pedidos">
      <div className="kds-kpi is-pending">
        <div className="kds-kpi__icon" aria-hidden="true">
          <i className="bi bi-hourglass-split" />
        </div>
        <div>
          <div className="kds-kpi__label">Pendientes</div>
          <div className="kds-kpi__value">{stats.pendientes}</div>
        </div>
      </div>

      <div className="kds-kpi is-cooking">
        <div className="kds-kpi__icon" aria-hidden="true">
          <i className="bi bi-fire" />
        </div>
        <div>
          <div className="kds-kpi__label">En preparación</div>
          <div className="kds-kpi__value">{stats.enPreparacion}</div>
        </div>
      </div>

      <div className="kds-kpi is-ready">
        <div className="kds-kpi__icon" aria-hidden="true">
          <i className="bi bi-check2-circle" />
        </div>
        <div>
          <div className="kds-kpi__label">Listos</div>
          <div className="kds-kpi__value">{stats.listos}</div>
        </div>
      </div>
    </div>
  );
}
