import { memo } from "react";
import StatCard from "./StatCard";

const StatsCardsRow = memo(function StatsCardsRow({ cards = [], className = "", ariaLabel }) {
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
});

export default StatsCardsRow;
