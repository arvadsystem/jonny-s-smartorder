import React, { useMemo } from 'react';
import Select from 'react-select';

const buildHeroSelectStyles = (isDark = false) => ({
  control: (base, state) => ({
    ...base,
    minHeight: 44,
    borderRadius: 14,
    borderColor: isDark
      ? state.isFocused
        ? 'rgba(255, 244, 229, 0.56)'
        : 'rgba(255, 234, 214, 0.18)'
      : state.isFocused
        ? '#c58a54'
        : '#e8d8c4',
    background: isDark ? 'rgba(255, 255, 255, 0.12)' : '#fffdfa',
    boxShadow: state.isFocused
      ? isDark
        ? '0 0 0 3px rgba(255, 244, 229, 0.12)'
        : '0 0 0 3px rgba(197, 138, 84, 0.12)'
      : 'none',
    '&:hover': {
      borderColor: isDark ? 'rgba(255, 244, 229, 0.56)' : '#c58a54'
    }
  }),
  valueContainer: (base) => ({
    ...base,
    padding: '2px 12px'
  }),
  singleValue: (base) => ({
    ...base,
    color: isDark ? '#ffffff' : '#493324'
  }),
  placeholder: (base) => ({
    ...base,
    color: isDark ? 'rgba(255, 255, 255, 0.78)' : '#8e7057'
  }),
  input: (base) => ({
    ...base,
    color: isDark ? '#ffffff' : '#493324'
  }),
  indicatorSeparator: () => ({ display: 'none' }),
  dropdownIndicator: (base) => ({
    ...base,
    color: isDark ? '#ffffff' : '#8e7057'
  }),
  menu: (base) => ({
    ...base,
    borderRadius: 16,
    overflow: 'hidden',
    border: '1px solid #ead8c1',
    boxShadow: '0 18px 32px rgba(59, 33, 14, 0.16)',
    zIndex: 30
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 9999
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected ? '#8c522f' : state.isFocused ? '#f7efe4' : '#ffffff',
    color: state.isSelected ? '#ffffff' : '#493324',
    cursor: 'pointer'
  })
});

const VIEW_OPTIONS = [
  { value: 'operativa', label: 'Operativa' },
  { value: 'ejecutiva', label: 'Ejecutiva' }
];

const DashboardHeader = ({
  nombre = 'Usuario',
  updateLabel = 'Sin sincronización',
  dataSourceMode = 'API',
  loading = false,
  onRefresh,
  sucursalValue = 'all',
  onSucursalChange,
  sucursalOptions = [],
  turnoValue = 'all',
  onTurnoChange,
  turnOptions = [],
  filtersSummary = {},
  highlights = [],
  viewMode = 'operativa',
  onViewModeChange
}) => {
  const sucursalSelected = useMemo(
    () => sucursalOptions.find((option) => option.value === sucursalValue) || null,
    [sucursalOptions, sucursalValue]
  );
  const turnoSelected = useMemo(
    () => turnOptions.find((option) => option.value === turnoValue) || null,
    [turnOptions, turnoValue]
  );

  return (
    <section className="inicio-hero">
      <div className="inicio-hero__top">
        <div className="inicio-hero__identity">
          <span className="inicio-hero__badge">
            <i className="bi bi-activity" aria-hidden="true" />
            Panel operativo
          </span>
          <h1>Panel operativo, {nombre}</h1>
          <p>Control rápido de operación, inventario y ventas del turno actual.</p>
        </div>

        <div className="inicio-hero__controls">
          <div className="inicio-hero__meta-bar">
            <span className="inicio-hero__timestamp" aria-live="polite">
              <i className="bi bi-clock-history" aria-hidden="true" />
              Última actualización: {updateLabel}
            </span>
            <span className="inicio-hero__source-pill">
              <i className="bi bi-lightning-charge" aria-hidden="true" />
              {dataSourceMode}
            </span>
            <div className="inicio-hero__view-switch" role="tablist" aria-label="Modo del dashboard">
              {VIEW_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`inicio-hero__view-btn ${viewMode === option.value ? 'is-active' : ''}`}
                  onClick={() => onViewModeChange?.(option.value)}
                  aria-pressed={viewMode === option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="inicio-hero__refresh"
              onClick={onRefresh}
              disabled={loading}
              aria-label="Actualizar métricas"
              title="Actualizar métricas"
            >
              <i className={`bi ${loading ? 'bi-arrow-repeat' : 'bi-arrow-clockwise'}`} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <div className="inicio-hero__filters" aria-label="Filtros del dashboard">
        <label className="inicio-hero__filter">
          <span>Sucursal</span>
          <Select
            classNamePrefix="inicio-rs"
            className="inicio-rs"
            options={sucursalOptions}
            value={sucursalSelected}
            onChange={(option) => onSucursalChange?.(option?.value || 'all')}
            placeholder="Todas las sucursales"
            noOptionsMessage={() => 'No hay sucursales disponibles'}
            isSearchable
            isClearable={false}
            isDisabled={loading}
            styles={buildHeroSelectStyles(true)}
            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
            menuPosition="fixed"
            aria-label="Filtrar por sucursal"
          />
        </label>

        <label className="inicio-hero__filter">
          <span>Turno</span>
          <Select
            classNamePrefix="inicio-rs"
            className="inicio-rs"
            options={turnOptions}
            value={turnoSelected}
            onChange={(option) => onTurnoChange?.(option?.value || 'all')}
            placeholder="Todo el día"
            noOptionsMessage={() => 'No hay turnos disponibles'}
            isSearchable={false}
            isClearable={false}
            isDisabled={loading}
            styles={buildHeroSelectStyles(true)}
            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
            menuPosition="fixed"
            aria-label="Filtrar por turno"
          />
        </label>
      </div>

      <div className="inicio-hero__scope">
        <span className="inicio-hero__scope-pill">
          <i className="bi bi-geo-alt" aria-hidden="true" />
          {filtersSummary.sucursalLabel || 'Todas las sucursales'}
        </span>
        <span className="inicio-hero__scope-pill">
          <i className="bi bi-sunrise" aria-hidden="true" />
          {filtersSummary.turnoLabel || 'Todo el día'}
        </span>
      </div>

      <div className="inicio-hero__highlights">
        {highlights.map((item) => (
          <article
            key={item.id}
            className={`inicio-hero__highlight is-${item.tone || 'neutral'}`}
            aria-label={`${item.label}: ${item.value}`}
          >
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </div>
    </section>
  );
};

export default DashboardHeader;
