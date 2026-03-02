export default function SearchBar({
  value,
  onChange,
  placeholder = "Buscar por nombre, DNI, telefono, correo o direccion...",
  ariaLabel = "Buscar personas",
}) {
  return (
    <label className="inv-ins-search" aria-label={ariaLabel}>
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
