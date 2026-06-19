import { memo } from "react";

const StatCard = memo(function StatCard({ iconClass, label, value, accent = "default" }) {
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
});

export default StatCard;
