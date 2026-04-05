export default function PlanillasMoneyInput({
  id,
  value,
  onChange,
  placeholder = '0.00',
  currency = 'L',
  disabled = false,
  min = '0.01',
  step = '0.01',
  error = false
}) {
  return (
    <div className={`planillas-modal-money ${error ? 'is-error' : ''}`}>
      <span aria-hidden="true">{currency}</span>
      <input
        id={id}
        type="number"
        className="planillas-modal-money__input"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        min={min}
        step={step}
        disabled={disabled}
      />
    </div>
  );
}
