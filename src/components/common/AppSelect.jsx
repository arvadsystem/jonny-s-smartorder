import { useEffect, useId, useMemo, useRef, useState } from 'react';

const normalizeOption = (option) => {
  if (option && typeof option === 'object') {
    return {
      value: String(option.value ?? ''),
      label: String(option.label ?? option.value ?? ''),
      disabled: Boolean(option.disabled),
      helperText: option.helperText ? String(option.helperText) : ''
    };
  }

  return {
    value: String(option ?? ''),
    label: String(option ?? ''),
    disabled: false,
    helperText: ''
  };
};

export default function AppSelect({
  label,
  placeholder = 'Selecciona una opción',
  value,
  options = [],
  onChange,
  disabled = false,
  error = '',
  helperText = '',
  className = ''
}) {
  const id = useId();
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const optionRefs = useRef([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const normalizedOptions = useMemo(() => options.map(normalizeOption), [options]);
  const selectedValue = value === null || value === undefined ? '' : String(value);
  const selectedIndex = normalizedOptions.findIndex((option) => option.value === selectedValue);
  const selectedOption = selectedIndex >= 0 ? normalizedOptions[selectedIndex] : null;
  const listboxId = `${id}-listbox`;
  const helperId = helperText || error ? `${id}-helper` : undefined;

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const getNextEnabledIndex = (startIndex, direction) => {
    if (normalizedOptions.length === 0) return -1;
    for (let offset = 0; offset < normalizedOptions.length; offset += 1) {
      const index = (startIndex + direction * offset + normalizedOptions.length) % normalizedOptions.length;
      if (!normalizedOptions[index]?.disabled) return index;
    }
    return -1;
  };

  const openList = () => {
    if (disabled) return;
    const preferredIndex = selectedIndex >= 0 ? selectedIndex : 0;
    setActiveIndex(getNextEnabledIndex(preferredIndex, 1));
    setOpen(true);
  };

  const closeList = () => {
    setOpen(false);
    setActiveIndex(-1);
  };

  const selectOption = (option) => {
    if (!option || option.disabled) return;
    onChange?.(option.value);
    closeList();
    buttonRef.current?.focus();
  };

  const handleButtonKeyDown = (event) => {
    if (disabled) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const start = activeIndex >= 0 ? activeIndex + direction : selectedIndex >= 0 ? selectedIndex + direction : 0;
      setActiveIndex(getNextEnabledIndex(start, direction));
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      selectOption(normalizedOptions[activeIndex]);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeList();
    }
  };

  return (
    <div
      ref={rootRef}
      className={[
        'app-select',
        open ? 'is-open' : '',
        disabled ? 'is-disabled' : '',
        error ? 'has-error' : '',
        className
      ].filter(Boolean).join(' ')}
    >
      {label ? (
        <label className="app-select__label" id={`${id}-label`}>
          {label}
        </label>
      ) : null}
      <button
        ref={buttonRef}
        type="button"
        className="app-select__trigger"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-labelledby={label ? `${id}-label` : undefined}
        aria-describedby={helperId}
        disabled={disabled}
        onClick={() => (open ? closeList() : openList())}
        onKeyDown={handleButtonKeyDown}
      >
        <span className={selectedOption ? 'app-select__value' : 'app-select__placeholder'}>
          {selectedOption?.label || placeholder}
        </span>
        <i className="bi bi-chevron-down app-select__chevron" aria-hidden="true" />
      </button>

      {open ? (
        <div className="app-select__menu" role="presentation">
          <div id={listboxId} className="app-select__list" role="listbox" aria-labelledby={label ? `${id}-label` : undefined}>
            <button type="button" className="app-select__option app-select__option--placeholder" disabled>
              {placeholder}
            </button>
            {normalizedOptions.map((option, index) => {
              const selected = option.value === selectedValue;
              const active = index === activeIndex;
              return (
                <button
                  key={`${option.value}-${index}`}
                  ref={(node) => {
                    optionRefs.current[index] = node;
                  }}
                  type="button"
                  className={[
                    'app-select__option',
                    selected ? 'is-selected' : '',
                    active ? 'is-active' : ''
                  ].filter(Boolean).join(' ')}
                  role="option"
                  aria-selected={selected}
                  disabled={option.disabled}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectOption(option)}
                >
                  <span className="app-select__option-text">
                    <span>{option.label}</span>
                    {option.helperText ? <small>{option.helperText}</small> : null}
                  </span>
                  {selected ? <i className="bi bi-check-lg app-select__check" aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {error || helperText ? (
        <div id={helperId} className={error ? 'app-select__error' : 'app-select__helper'}>
          {error || helperText}
        </div>
      ) : null}
    </div>
  );
}
