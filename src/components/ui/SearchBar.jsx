export default function SearchBar({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className = "",
}) {
  return (
    <label className={`inv-ins-search ${className}`.trim()} aria-label={ariaLabel}>
      <i className="bi bi-search" />
      <input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
