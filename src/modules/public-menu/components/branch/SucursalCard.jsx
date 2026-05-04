const getBranchCode = (branch) => {
  const slug = String(branch?.slug || '').trim().toUpperCase();
  if (slug === '21-OCTUBRE') return '21 OCT';
  if (slug === 'EL-CARMEN') return 'EL CARMEN';
  if (slug) return slug.replace(/-/g, ' ');
  return 'SUCURSAL';
};

// Presentational card for branch selection.
const SucursalCard = ({ branch, selected, onSelect }) => (
  <button
    type="button"
    className={`pm-option-card pm-branch-card ${selected ? 'is-selected' : ''}`}
    onClick={() => onSelect?.(branch)}
    aria-pressed={selected}
  >
    <div className={`pm-branch-card__media ${branch.imageUrl ? '' : 'is-empty'}`}>
      {branch.imageUrl ? (
        <img src={branch.imageUrl} alt={branch.displayName || branch.name} className="pm-branch-card__image" />
      ) : null}
      <div className="pm-branch-card__media-overlay" />
      <div className="pm-branch-card__media-content">
        <span className="pm-branch-card__code">{getBranchCode(branch)}</span>
        <small className="pm-branch-card__hint">Toca para seleccionar</small>
      </div>
    </div>

    <div className="pm-option-card__top">
      <h3 className="pm-option-card__title">{branch.displayName || branch.name}</h3>
      <span className={`pm-status-pill ${branch.isOpen ? 'is-open' : 'is-closed'}`}>
        {branch.statusLabel || (branch.isOpen ? 'Abierto ahora' : 'Cerrado')}
      </span>
    </div>

    <p className="pm-option-card__description">
      <i className="bi bi-geo-alt-fill" aria-hidden="true" /> {branch.address}
    </p>
    <small className="pm-option-card__meta">
      <i className="bi bi-clock-history" aria-hidden="true" /> {branch.schedule}
    </small>
    {!branch.isOpen && branch.closedReason ? (
      <small className="pm-option-card__meta pm-option-card__meta--warning">
        <i className="bi bi-info-circle" aria-hidden="true" /> {branch.closedReason}
      </small>
    ) : null}
    <small className="pm-option-card__meta">
      <i className="bi bi-bicycle" aria-hidden="true" /> Tiempo estimado: {branch.etaMinutes}
    </small>

    <div className="pm-branch-card__cta">
      <span>Ver menú</span>
      <i className="bi bi-arrow-right-short" aria-hidden="true" />
    </div>
  </button>
);

export default SucursalCard;
