export default function CocinaSucursalTabs({
  sucursales,
  selectedSucursalId,
  onSelectSucursal
}) {
  return (
    <div className="cocina-tabs" role="tablist" aria-label="Filtrar por sucursal">
      <button
        type="button"
        className={`cocina-tab ${selectedSucursalId === null ? 'is-active' : ''}`}
        onClick={() => onSelectSucursal(null)}
      >
        Todas
      </button>

      {(Array.isArray(sucursales) ? sucursales : []).map((sucursal) => (
        <button
          key={sucursal.id_sucursal}
          type="button"
          className={`cocina-tab ${
            Number(selectedSucursalId ?? 0) === Number(sucursal.id_sucursal) ? 'is-active' : ''
          }`}
          onClick={() => onSelectSucursal(Number(sucursal.id_sucursal))}
        >
          {sucursal.nombre_sucursal}
        </button>
      ))}
    </div>
  );
}
