export default function PlanillasModalField({
  id,
  label,
  required = false,
  error = '',
  hint = '',
  children
}) {
  return (
    <div className={`planillas-modal-field ${error ? 'is-error' : ''}`}>
      {label ? (
        <label htmlFor={id} className="planillas-modal-field__label">
          {label}
          {required ? <span aria-hidden="true">*</span> : null}
        </label>
      ) : null}

      <div className="planillas-modal-field__control">{children}</div>

      {error ? <div className="planillas-modal-field__error">{error}</div> : null}
      {!error && hint ? <div className="planillas-modal-field__hint">{hint}</div> : null}
    </div>
  );
}
