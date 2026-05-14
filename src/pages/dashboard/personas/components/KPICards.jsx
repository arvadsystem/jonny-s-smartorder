import { buildKpiSeries, buildSparklinePoints } from "../../sucursales/utils/sucursalHelpers";

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

export default function KPICards({ stats }) {
  const series = buildKpiSeries(stats);
  const femeninoSeries = buildSparklinePoints([
    Math.max(0, Number(stats?.femenino ?? 0) - 1),
    Math.max(0, Number(stats?.femenino ?? 0)),
    Math.max(0, Number(stats?.femenino ?? 0) + 1),
    Math.max(0, Number(stats?.femenino ?? 0)),
    Math.max(0, Number(stats?.femenino ?? 0)),
  ]);
  const masculinoSeries = buildSparklinePoints([
    Math.max(0, Number(stats?.masculino ?? 0) - 1),
    Math.max(0, Number(stats?.masculino ?? 0)),
    Math.max(0, Number(stats?.masculino ?? 0) + 1),
    Math.max(0, Number(stats?.masculino ?? 0)),
    Math.max(0, Number(stats?.masculino ?? 0)),
  ]);

  return (
    <div className="inv-prod-kpis inv-cat-v2__kpis" aria-label="Resumen de personas">
      <KpiCard label="Total de personas" value={stats.total} points={buildSparklinePoints(series.total)} />
      <KpiCard label="Activas" value={stats.activas} className="is-ok" points={buildSparklinePoints(series.activas)} />
      <KpiCard
        label="Inactivas"
        value={stats.inactivas}
        className="is-empty"
        points={buildSparklinePoints(series.inactivas)}
      />
      <KpiCard label="Femenino" value={stats.femenino ?? 0} points={femeninoSeries} />
      <KpiCard label="Masculino" value={stats.masculino ?? 0} points={masculinoSeries} />
    </div>
  );
}
