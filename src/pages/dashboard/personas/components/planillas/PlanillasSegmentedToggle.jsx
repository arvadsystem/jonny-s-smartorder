export default function PlanillasSegmentedToggle({ options = [], value, onChange, disabled = false }) {
  return (
    <div className="planillas-segmented-toggle" role="group" aria-label="Seleccion de tipo">
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            className={`planillas-segmented-toggle__btn ${isActive ? 'is-active' : ''} ${
              option.tone ? `is-${option.tone}` : ''
            }`}
            onClick={() => onChange?.(option.value)}
            disabled={disabled}
          >
            {option.iconClass ? <i className={option.iconClass} /> : null}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
