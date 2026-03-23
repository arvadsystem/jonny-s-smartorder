import "../personas-search-dropdown.css";

export default function SearchSuggestionsDropdown({
  mounted,
  visible,
  dropdownRef,
  dropdownStyle,
  title,
  isPredictiveSearch,
  recentCount,
  items,
  activeIndex,
  searchValue,
  onApplySuggestion,
  onRemoveRecent,
  onClearRecent,
}) {
  if (!mounted) return null;

  return (
    <div
      className={`personas-search-dropdown ${visible ? "is-open" : "is-closing"}`}
      ref={dropdownRef}
      role="listbox"
      aria-label="Sugerencias de busqueda"
      style={dropdownStyle}
    >
      <div className="personas-search-dropdown__header">
        <div className="personas-search-dropdown__title">
          <span className="personas-search-dropdown__title-icon" aria-hidden="true">
            <i className="bi bi-search" />
          </span>
          <span>{title}</span>
        </div>
        {!isPredictiveSearch && recentCount ? (
          <button
            type="button"
            className="personas-search-dropdown__clear-btn"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClearRecent}
          >
            Limpiar
          </button>
        ) : null}
      </div>

      <div className="personas-search-dropdown__list" role="presentation">
        {items.map((suggestion, idx) => {
          const isActive = idx === activeIndex;
          const detailText = suggestion.detail || (isPredictiveSearch ? "Sugerencia de busqueda" : "Busqueda reciente");
          return (
            <div
              key={suggestion.id ?? `${suggestion.value}-${idx}`}
              className={`personas-search-dropdown__item ${isActive ? "is-active" : ""}`}
              style={{ "--item-delay": `${Math.min(idx * 26, 120)}ms` }}
            >
              <button
                type="button"
                className="personas-search-dropdown__item-main"
                aria-selected={isActive}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onApplySuggestion(suggestion.value)}
              >
                <span className="personas-search-dropdown__item-icon" aria-hidden="true">
                  <i className="bi bi-search" />
                </span>
                <span className="personas-search-dropdown__item-copy">
                  <span className="personas-search-dropdown__item-title">{suggestion.label}</span>
                  <span className="personas-search-dropdown__item-subtitle">{detailText}</span>
                </span>
              </button>

              {!isPredictiveSearch ? (
                <button
                  type="button"
                  className="personas-search-dropdown__item-remove"
                  aria-label={`Eliminar busqueda reciente ${suggestion.label}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemoveRecent(suggestion.value);
                  }}
                >
                  <i className="bi bi-x-lg" />
                </button>
              ) : null}
            </div>
          );
        })}

        {isPredictiveSearch && items.length === 0 ? (
          <div className="personas-search-dropdown__empty">
            Sin sugerencias para "{String(searchValue ?? "").trim()}"
          </div>
        ) : null}
      </div>
    </div>
  );
}
