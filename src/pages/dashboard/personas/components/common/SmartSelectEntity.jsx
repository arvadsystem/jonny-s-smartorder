import "./smart-select-entity.css";

export default function SmartSelectEntity({
  label,
  showToggle = false,
  isInlineCreate = false,
  onToggleInline,
  toggleCreateLabel = "+ Crear nuevo",
  toggleExistingLabel = "Usar existente",
  toggleDisabled = false,
  toggleVariant = "single",
  selector,
  error,
  helperText,
  inlineContent = null,
  metaContent = null,
  className = "",
}) {
  const handleToggle = (nextInlineCreate) => {
    if (typeof onToggleInline !== "function") return;
    if (Boolean(nextInlineCreate) === Boolean(isInlineCreate)) return;
    onToggleInline();
  };

  return (
    <div className={`smart-select-entity ${className}`.trim()}>
      <div className="smart-select-entity__head d-flex align-items-center justify-content-between gap-2 mb-1">
        <label className="smart-select-entity__label form-label text-light text-opacity-75 m-0">{label}</label>
        {showToggle ? (
          toggleVariant === "dual" ? (
            <div className="smart-select-entity__toggle-group" role="group" aria-label={`Opciones de ${label}`}>
              <button
                type="button"
                className={`btn btn-sm smart-select-entity__toggle smart-select-entity__toggle-option ${
                  isInlineCreate ? "" : "is-active"
                }`}
                onClick={() => handleToggle(false)}
                disabled={toggleDisabled || !isInlineCreate}
              >
                {toggleExistingLabel}
              </button>
              <button
                type="button"
                className={`btn btn-sm smart-select-entity__toggle smart-select-entity__toggle-option ${
                  isInlineCreate ? "is-active is-create" : ""
                }`}
                onClick={() => handleToggle(true)}
                disabled={toggleDisabled || isInlineCreate}
              >
                {toggleCreateLabel}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary smart-select-entity__toggle"
              onClick={onToggleInline}
              disabled={toggleDisabled}
            >
              {isInlineCreate ? toggleExistingLabel : toggleCreateLabel}
            </button>
          )
        ) : null}
      </div>

      {selector}

      {error ? <div className="invalid-feedback d-block">{error}</div> : null}
      {helperText ? <small className="smart-select-entity__helper">{helperText}</small> : null}
      {isInlineCreate && inlineContent ? <div className="smart-select-entity__inline">{inlineContent}</div> : null}
      {metaContent}
    </div>
  );
}
