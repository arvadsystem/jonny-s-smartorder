import { useEffect, useRef, useState } from 'react';

export default function CollapsibleSearchInput({
  value,
  onValueChange,
  onSubmit,
  placeholder = 'Buscar...',
  ariaLabel = 'Buscar',
  className = '',
  disabled = false
}) {
  const toggleRef = useRef(null);
  const inputRef = useRef(null);
  const rawValue = String(value ?? '');
  const [expanded, setExpanded] = useState(() => rawValue.trim().length > 0);
  const isExpanded = expanded || rawValue.trim().length > 0;

  useEffect(() => {
    if (!expanded) return;
    const raf = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange?.(rawValue.length, rawValue.length);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [expanded, rawValue.length]);

  const collapseIfEmpty = () => {
    if (rawValue.trim().length > 0) return;
    setExpanded(false);
    toggleRef.current?.focus();
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (typeof onSubmit === 'function') onSubmit(rawValue);
  };

  return (
    <form
      className={`collapsible-search ${isExpanded ? 'is-expanded' : ''} ${className}`.trim()}
      onSubmit={handleSubmit}
      role="search"
      aria-label={ariaLabel}
    >
      <button
        ref={toggleRef}
        type="button"
        className="collapsible-search__toggle"
        aria-label={isExpanded ? 'Ocultar busqueda' : 'Mostrar busqueda'}
        aria-expanded={isExpanded}
        disabled={disabled}
        onClick={() => setExpanded(true)}
      >
        <i className="bi bi-search" aria-hidden="true" />
      </button>

      <div className="collapsible-search__field">
        <input
          ref={inputRef}
          type="search"
          className="form-control collapsible-search__input"
          value={rawValue}
          placeholder={placeholder}
          aria-label={ariaLabel}
          disabled={disabled}
          onChange={(event) => onValueChange(event.target.value)}
          onBlur={collapseIfEmpty}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && rawValue.trim().length === 0) {
              event.preventDefault();
              collapseIfEmpty();
            }
          }}
        />
      </div>
    </form>
  );
}
