import SearchBar from "../../../../components/ui/SearchBar";

export default function PersonasSearchBar({
  value,
  onChange,
  placeholder = "Buscar por nombre, DNI, telefono, correo o direccion...",
  ariaLabel = "Buscar personas",
}) {
  return (
    <SearchBar value={value} onChange={onChange} placeholder={placeholder} ariaLabel={ariaLabel} />
  );
}
