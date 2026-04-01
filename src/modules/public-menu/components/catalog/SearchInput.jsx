// Reusable search field for product filtering.
const SearchInput = ({ value, onChange, onClear, placeholder = 'Buscar producto' }) => (
  <div className="pm-search-input">
    <i className="bi bi-search pm-search-input__icon" aria-hidden="true" />
    <input
      type="search"
      className="pm-search-input__field"
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      aria-label="Buscar en catalogo"
    />

    {value ? (
      <button
        type="button"
        className="pm-search-input__clear"
        onClick={onClear}
        aria-label="Limpiar busqueda"
      >
        <i className="bi bi-x-lg" aria-hidden="true" />
      </button>
    ) : null}
  </div>
);

export default SearchInput;

