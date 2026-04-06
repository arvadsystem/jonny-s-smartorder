import "./smart-select-entity.css";

export default function SmartSelectEntity({
  label,
  showToggle = false,
  isInlineCreate = false,
  onToggleInline,
  toggleCreateLabel = "+ Crear nuevo",
  toggleExistingLabel = "Usar existente",
  toggleDisabled = false,
  selector,
  error,
  helperText,
  inlineContent = null,
  metaContent = null,
  className = "",
}) {
  return (
    <div className={`smart-select-entity ${className}`.trim()}>
      <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
        <label className="form-label text-light text-opacity-75 m-0">{label}</label>
        {showToggle ? (
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary smart-select-entity__toggle"
            onClick={onToggleInline}
            disabled={toggleDisabled}
          >
            {isInlineCreate ? toggleExistingLabel : toggleCreateLabel}
          </button>
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
