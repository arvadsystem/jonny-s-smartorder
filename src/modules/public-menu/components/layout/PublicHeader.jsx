// Shared top header for the public menu flow.
const PublicHeader = ({ title, subtitle, onBack, branchName, actions }) => (
  <header className="pm-header">
    <div className="pm-header__row">
      {onBack ? (
        <button
          type="button"
          className="pm-header__back-btn"
          onClick={onBack}
          aria-label="Regresar al paso anterior"
        >
          <i className="bi bi-arrow-left-short" aria-hidden="true" />
        </button>
      ) : (
        <span className="pm-header__back-placeholder" aria-hidden="true" />
      )}

      <div className="pm-header__title-wrap">
        <h1 className="pm-header__title">{title}</h1>
        {subtitle ? <p className="pm-header__subtitle">{subtitle}</p> : null}
        {branchName ? <small className="pm-header__meta">{branchName}</small> : null}
      </div>

      {actions ? <div className="pm-header__actions">{actions}</div> : null}
    </div>
  </header>
);

export default PublicHeader;
