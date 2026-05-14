const toText = (value, fallback = '') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const buildPills = ({ search, sucursal, cargo, salarioMin, salarioMax }, sucursalOptions = []) => {
  const pills = [];
  if (toText(search)) pills.push({ key: 'search', label: `Busqueda: ${search}` });

  if (toText(sucursal)) {
    const option = sucursalOptions.find((item) => String(item.value) === String(sucursal));
    pills.push({ key: 'sucursal', label: `Sucursal: ${option?.label || sucursal}` });
  }

  if (toText(cargo)) pills.push({ key: 'cargo', label: `Cargo: ${cargo}` });
  if (toText(salarioMin)) pills.push({ key: 'salarioMin', label: `Salario min: L ${salarioMin}` });
  if (toText(salarioMax)) pills.push({ key: 'salarioMax', label: `Salario max: L ${salarioMax}` });

  return pills;
};

export default function PayrollFilters({
  values,
  onChange,
  onClear,
  sucursalOptions = []
}) {
  const safeValues = {
    search: values?.search ?? '',
    sucursal: values?.sucursal ?? '',
    cargo: values?.cargo ?? '',
    salarioMin: values?.salarioMin ?? '',
    salarioMax: values?.salarioMax ?? '',
    _expanded: Boolean(values?._expanded)
  };

  const pills = buildPills(safeValues, sucursalOptions);
  const hasAdvancedFilters = Boolean(
    toText(safeValues.sucursal) ||
      toText(safeValues.cargo) ||
      toText(safeValues.salarioMin) ||
      toText(safeValues.salarioMax)
  );
  const filtersCount = pills.length;

  const updateField = (field, value) => {
    onChange?.({ ...safeValues, [field]: value });
  };

  return (
    <section className="planillas-filters" aria-label="Filtros avanzados de planilla">
      <div className="planillas-filters__bar">
        <div className="planillas-filters__search">
          <i className="bi bi-search" aria-hidden="true" />
          <input
            type="search"
            className="form-control planillas-filters__input"
            value={safeValues.search}
            onChange={(event) => updateField('search', event.target.value)}
            placeholder="Buscar por nombre, DNI o cargo"
          />
        </div>

        <div className="planillas-filters__actions">
          <button
            type="button"
            className="btn planillas-filters__btn planillas-filters__btn--toggle"
            onClick={() => updateField('_expanded', !safeValues._expanded)}
          >
            <i className={`bi ${safeValues._expanded ? 'bi-chevron-up' : 'bi-sliders'}`} />
            <span>{safeValues._expanded ? 'Ocultar' : 'Filtros'}</span>
            {filtersCount > 0 ? <small>{filtersCount}</small> : null}
          </button>

          <button type="button" className="btn planillas-filters__btn planillas-filters__btn--clear" onClick={onClear}>
            <i className="bi bi-eraser me-1" />
            Limpiar
          </button>
        </div>
      </div>

      {safeValues._expanded ? (
        <div className="planillas-filters__advanced">
          <div className="planillas-filters__group">
            <label className="form-label">Sucursal</label>
            <select
              className="form-select planillas-filters__select"
              value={safeValues.sucursal}
              onChange={(event) => updateField('sucursal', event.target.value)}
            >
              <option value="">Todas</option>
              {sucursalOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="planillas-filters__group">
            <label className="form-label">Cargo</label>
            <input
              type="text"
              className="form-control planillas-filters__input"
              value={safeValues.cargo}
              onChange={(event) => updateField('cargo', event.target.value)}
              placeholder="Filtrar por cargo"
            />
          </div>

          <div className="planillas-filters__group">
            <label className="form-label">Salario minimo</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="form-control planillas-filters__input"
              value={safeValues.salarioMin}
              onChange={(event) => updateField('salarioMin', event.target.value)}
              placeholder="Ej. 5000"
            />
          </div>

          <div className="planillas-filters__group">
            <label className="form-label">Salario maximo</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="form-control planillas-filters__input"
              value={safeValues.salarioMax}
              onChange={(event) => updateField('salarioMax', event.target.value)}
              placeholder="Ej. 12000"
            />
          </div>
        </div>
      ) : null}

      {pills.length > 0 ? (
        <div className="planillas-filters__pills" aria-live="polite">
          <span className="planillas-filters__pills-label">Filtros activos:</span>
          {pills.map((pill) => (
            <span key={pill.key} className="planillas-filters__pill">
              {pill.label}
            </span>
          ))}
          <button type="button" className="btn planillas-filters__clear-link" onClick={onClear}>
            Limpiar filtros
          </button>
        </div>
      ) : !hasAdvancedFilters && !toText(safeValues.search) ? (
        <p className="planillas-filters__hint mb-0">Aplica filtros para acotar el detalle de planilla.</p>
      ) : null}
    </section>
  );
}
