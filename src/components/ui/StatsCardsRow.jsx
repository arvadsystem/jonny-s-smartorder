function StatCard({ iconClass, label, value, accent = "default" }) {
  return (
    <div className={`inv-prod-kpi personas-page__stat-card is-${accent}`}>
      <div className="personas-page__stat-icon" aria-hidden="true">
        <i className={`bi ${iconClass}`} />
      </div>
      <div className="inv-prod-kpi-content">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

export default function StatsCardsRow({ cards = [], className = "", ariaLabel }) {
  return (
    <div className={`inv-prod-kpis personas-page__stats ${className}`.trim()} aria-label={ariaLabel}>
      {cards.map((card) => (
        <StatCard
          key={card.key || card.label}
          iconClass={card.iconClass}
          label={card.label}
          value={card.value}
          accent={card.accent}
        />
      ))}
    </div>
  );
}
