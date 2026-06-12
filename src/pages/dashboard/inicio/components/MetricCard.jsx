import React from 'react';
import { Link } from 'react-router-dom';

const MetricCard = ({
  icon,
  label,
  value,
  hint,
  emptyMessage = '',
  eyebrow = '',
  badge,
  tone = 'default',
  size = 'default',
  progressSegments = [],
  ariaLabel = '',
  to = ''
}) => {
  const isEmpty =
    value === 0
    || value === '0'
    || value === '0/0'
    || value === 'L 0.00';

  const content = (
    <article className={`inicio-kpi-card is-${tone} is-${size} ${isEmpty ? 'is-empty' : ''} ${to ? 'is-clickable' : ''}`}>
      <div className="inicio-kpi-card__header">
        <div className="inicio-kpi-card__icon" aria-hidden="true">
          <i className={`bi ${icon}`} />
        </div>
        {badge ? <span className={`inicio-kpi-card__badge is-${tone}`}>{badge}</span> : null}
      </div>

      <div className="inicio-kpi-card__content">
        {eyebrow ? <span className="inicio-kpi-card__eyebrow">{eyebrow}</span> : null}
        <p className="inicio-kpi-card__label">{label}</p>
        <h3 className="inicio-kpi-card__value">{value}</h3>
        <p className="inicio-kpi-card__hint">{hint}</p>
        {isEmpty && emptyMessage ? <p className="inicio-kpi-card__empty-copy">{emptyMessage}</p> : null}
      </div>

      {progressSegments.length ? (
        <div className="inicio-kpi-card__progress" aria-hidden="true">
          {progressSegments.map((segment) => (
            <span
              key={segment.id}
              className={`inicio-kpi-card__progress-segment is-${segment.tone || 'default'}`}
              style={{ flex: Math.max(1, Number(segment.value) || 0) }}
            />
          ))}
        </div>
      ) : null}
    </article>
  );

  if (!to) return content;

  return (
    <Link
      to={to}
      className="inicio-kpi-card__link"
      title={`Abrir detalle de ${label.toLowerCase()}`}
      aria-label={ariaLabel || `${label}: ${value}. ${hint}`}
    >
      {content}
    </Link>
  );
};

export default MetricCard;
