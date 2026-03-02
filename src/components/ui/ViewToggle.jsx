export default function ViewToggle({ value, onChange, className = "" }) {
  return (
    <div className={`personas-page__view-toggle ${className}`.trim()} role="tablist" aria-label="Cambiar vista">
      <button
        type="button"
        className={`personas-page__view-btn ${value === "cards" ? "is-active" : ""}`}
        onClick={() => onChange("cards")}
        aria-pressed={value === "cards"}
        title="Vista en tarjetas"
      >
        <i className="bi bi-grid-3x3-gap-fill" />
      </button>
      <button
        type="button"
        className={`personas-page__view-btn ${value === "table" ? "is-active" : ""}`}
        onClick={() => onChange("table")}
        aria-pressed={value === "table"}
        title="Vista en tabla"
      >
        <i className="bi bi-list-ul" />
      </button>
    </div>
  );
}
