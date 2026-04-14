export default function ToolbarSucursalSelect({
  value,
  onChange,
  options = [],
  loading = false,
  disabled = false,
  className = '',
  label = 'Sucursal visible',
  emptyLabel = 'Resumen multisucursal'
}) {
  const normalizedOptions = Array.isArray(options) ? options : [];
  const selectedSucursal = normalizedOptions.find(
    (row) => String(row?.id_sucursal ?? '') === String(value ?? '')
  );
  const selectedTitle = selectedSucursal?.nombre_sucursal || emptyLabel;

  return (
    <div className={`toolbar-scope-inline ${className}`.trim()} aria-label={label}>
      <i className="bi bi-shop" aria-hidden="true" />
      <span className="toolbar-scope-inline__label">{label}</span>
      <select
        className="form-select toolbar-scope-inline__select"
        value={value}
        title={selectedTitle}
        aria-label={label}
        disabled={loading || disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{loading ? 'Cargando sucursales...' : emptyLabel}</option>
        {normalizedOptions.map((sucursal) => (
          <option key={sucursal.id_sucursal} value={sucursal.id_sucursal}>
            {sucursal.nombre_sucursal}
          </option>
        ))}
      </select>
    </div>
  );
}
