const toText = (value, fallback = '') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

export default function SummaryCard({
  iconClass = 'bi-graph-up',
  label = '',
  value = '0',
  accent = 'default',
  isNet = false
}) {
  return (
    <article className={`planillas-summary-card planillas-summary-card--${accent} ${isNet ? 'is-net' : ''}`}>
      <div className="planillas-summary-card__icon" aria-hidden="true">
        <i className={`bi ${iconClass}`} />
      </div>
      <div className="planillas-summary-card__copy">
        <span className="planillas-summary-card__label">
          {toText(label)}
          {isNet ? <small className="planillas-summary-card__badge">Neto</small> : null}
        </span>
        <strong className="planillas-summary-card__value">{toText(value, '0')}</strong>
      </div>
    </article>
  );
}
