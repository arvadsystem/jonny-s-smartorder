import { buildKpiSeries, buildSparklinePoints } from '../utils/sucursalHelpers';

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

export default function SucursalesStats({ stats }) {
  const series = buildKpiSeries(stats);

  return (
    <div className="inv-prod-kpis inv-cat-v2__kpis" aria-label="Resumen de sucursales">
      <KpiCard label="Total" value={stats.total} points={buildSparklinePoints(series.total)} />
      <KpiCard label="Activas" value={stats.activas} className="is-ok" points={buildSparklinePoints(series.activas)} />
      <KpiCard label="Inactivas" value={stats.inactivas} className="is-empty" points={buildSparklinePoints(series.inactivas)} />
    </div>
  );
}

