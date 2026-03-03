import {
  buildCocinaSeries,
  buildSparklinePoints
} from '../utils/cocinaHelpers';

function KpiCard({ label, value, className = '', points }) {
  return (
    <div className={`inv-prod-kpi ${className}`.trim()}>
      {points ? (
        <svg className="inv-prod-kpi-spark" viewBox="0 0 120 44" preserveAspectRatio="none" aria-hidden="true">
          <polyline points={points} />
        </svg>
      ) : null}
      <div className="inv-prod-kpi-content">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

export default function CocinaStats({ stats }) {
  const series = buildCocinaSeries(stats);

  return (
    <div className="inv-prod-kpis inv-cat-v2__kpis" aria-label="Resumen del tablero de cocina">
      <KpiCard label="Pendientes" value={stats.pendientes} points={buildSparklinePoints(series.pendientes)} />
      <KpiCard
        label="En preparacion"
        value={stats.enPreparacion}
        className="is-low"
        points={buildSparklinePoints(series.enPreparacion)}
      />
      <KpiCard label="Listos" value={stats.listos} className="is-ok" points={buildSparklinePoints(series.listos)} />
    </div>
  );
}
