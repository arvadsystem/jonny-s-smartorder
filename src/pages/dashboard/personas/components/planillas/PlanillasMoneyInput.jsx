const sanitizeMoneyInputValue = (value, { allowThousandsSeparators = false } = {}) => {
  const raw = String(value ?? '');
  if (!raw) return '';

  if (allowThousandsSeparators) {
    const normalized = raw.replace(/[^\d,.]/g, '');
    if (!normalized) return '';

    const firstDotIndex = normalized.indexOf('.');
    const compact =
      firstDotIndex >= 0
        ? `${normalized.slice(0, firstDotIndex + 1)}${normalized.slice(firstDotIndex + 1).replace(/\./g, '')}`
        : normalized;

    const dotIndex = compact.indexOf('.');
    if (dotIndex < 0) return compact.replace(/[^\d,]/g, '');

    const integerPart = compact.slice(0, dotIndex).replace(/[^\d,]/g, '');
    const decimalPart = compact
      .slice(dotIndex + 1)
      .replace(/[^\d]/g, '')
      .slice(0, 2);
    return `${integerPart}.${decimalPart}`;
  }

  const normalized = raw.replace(/[^\d.]/g, '');
  if (!normalized) return '';
  const firstDotIndex = normalized.indexOf('.');
  if (firstDotIndex < 0) return normalized;
  const integerPart = normalized.slice(0, firstDotIndex);
  const decimalPart = normalized
    .slice(firstDotIndex + 1)
    .replace(/\./g, '')
    .slice(0, 2);
  return `${integerPart}.${decimalPart}`;
};

export default function PlanillasMoneyInput({
  id,
  value,
  onChange,
  placeholder = '0.00',
  currency = 'L',
  disabled = false,
  min = '0.01',
  step = '0.01',
  error = false,
  allowThousandsSeparators = false
}) {
  const handleChange = (event) => {
    const nextValue = sanitizeMoneyInputValue(event?.target?.value, { allowThousandsSeparators });
    onChange?.({
      ...event,
      target: {
        ...event.target,
        value: nextValue
      }
    });
  };

  return (
    <div className={`planillas-modal-money ${error ? 'is-error' : ''}`}>
      <span aria-hidden="true">{currency}</span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        pattern={allowThousandsSeparators ? '^[0-9,]*(\\.[0-9]{0,2})?$' : '^\\d*(\\.\\d{0,2})?$'}
        className="planillas-modal-money__input"
        value={value}
        onKeyDown={(event) => {
          if (['e', 'E', '+', '-'].includes(event.key)) {
            event.preventDefault();
          }
        }}
        onChange={handleChange}
        placeholder={placeholder}
        min={min}
        step={step}
        disabled={disabled}
      />
    </div>
  );
}
