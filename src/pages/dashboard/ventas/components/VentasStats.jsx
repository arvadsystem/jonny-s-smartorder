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

export default function VentasStats({ stats, visibleKeys = [] }) {
  const cards = [
    { key: 'totalVentas', icon: 'bi-receipt-cutoff', label: 'Ventas', value: stats.totalVentas, accent: 'default' },
    { key: 'totalFacturado', icon: 'bi-cash-stack', label: 'Total vendido', value: formatCurrency(stats.totalFacturado), accent: 'accent' },
    { key: 'ticketPromedio', icon: 'bi-currency-dollar', label: 'Ticket promedio', value: formatCurrency(stats.ticketPromedio), accent: 'info' },
    { key: 'completadas', icon: 'bi-check-circle', label: 'Completadas', value: stats.completadas, accent: 'success' },
    { key: 'pendientes', icon: 'bi-clock-history', label: 'Pendientes', value: stats.pendientes, accent: 'warning' }
  ];

  const visibleSet = new Set(Array.isArray(visibleKeys) ? visibleKeys : []);
  const visibleCards = visibleSet.size > 0 ? cards.filter((card) => visibleSet.has(card.key)) : cards;

  return (
    <div className="inv-prod-kpis ventas-page__stats" aria-label="Resumen de ventas">
      {visibleCards.map((card) => (
        <StatCard
          key={card.key}
          icon={card.icon}
          label={card.label}
          value={card.value}
          accent={card.accent}
        />
      ))}
    </div>
  );
}
