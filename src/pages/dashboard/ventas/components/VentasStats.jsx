import { formatCurrency } from '../utils/ventasHelpers';

function StatCard({ icon, label, value, accent = 'default' }) {
  return (
    <div className={`inv-prod-kpi ventas-page__stat-card is-${accent}`}>
      <div className="ventas-page__stat-icon" aria-hidden="true">
        <i className={`bi ${icon}`} />
      </div>
      <div className="inv-prod-kpi-content">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

export default function VentasStats({ stats }) {
  return (
    <div className="inv-prod-kpis ventas-page__stats" aria-label="Resumen de ventas">
      <StatCard icon="bi-receipt-cutoff" label="Ventas" value={stats.totalVentas} />
      <StatCard icon="bi-cash-stack" label="Total vendido" value={formatCurrency(stats.totalFacturado)} accent="accent" />
      <StatCard icon="bi-currency-dollar" label="Ticket promedio" value={formatCurrency(stats.ticketPromedio)} accent="info" />
      <StatCard icon="bi-check-circle" label="Completadas" value={stats.completadas} accent="success" />
      <StatCard icon="bi-clock-history" label="Pendientes" value={stats.pendientes} accent="warning" />
    </div>
  );
}
