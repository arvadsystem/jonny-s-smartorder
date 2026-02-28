import { buildKpiSeries, buildSparklinePoints } from "../../../sucursales/utils/sucursalHelpers";

function KpiCard({ label, value, className = "", points }) {
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

export default function ModuleKPICards({ stats, totalLabel = "Total" }) {
  const series = buildKpiSeries(stats);

  return (
    <div className="inv-prod-kpis inv-cat-v2__kpis" aria-label={`Resumen de ${totalLabel.toLowerCase()}`}>
      <KpiCard label={totalLabel} value={stats?.total ?? 0} points={buildSparklinePoints(series.total)} />
      <KpiCard
        label="Activos"
        value={stats?.activas ?? 0}
        className="is-ok"
        points={buildSparklinePoints(series.activas)}
      />
      <KpiCard
        label="Inactivos"
        value={stats?.inactivas ?? 0}
        className="is-empty"
        points={buildSparklinePoints(series.inactivas)}
      />
    </div>
  );
}
