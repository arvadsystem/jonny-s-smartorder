import { useMemo, useState } from 'react';
import AppSelect from '../../../../components/common/AppSelect';
import {
  createDefaultVentasTemporalFilters,
  getTegucigalpaToday,
  getVentasCashierMinDate,
  validateVentasTemporalFilters
} from '../../../../modules/ventas/utils/ventasTemporalFilters';
import VentasList from './VentasList';
import VentasStats from './VentasStats';
import VentasToolbar from './VentasToolbar';

const ESTADO_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'VENTA_DIRECTA', label: 'Venta directa' },
  { value: 'EN_COCINA', label: 'En cocina' },
  { value: 'LISTO', label: 'Listo' },
  { value: 'COMPLETADA', label: 'Completadas' },
  { value: 'PENDIENTE', label: 'Pendientes' }
];

const countActiveFilters = (filters = {}, today = '') => {
  const regularFilters = [
    filters.search,
    filters.idSucursal,
    filters.estado
  ].filter((value) => String(value || '').trim()).length;
  const hasCustomTemporalRange = filters.fechaDesde !== today ||
    filters.fechaHasta !== today ||
    Boolean(filters.horaDesde || filters.horaHasta);
  return regularFilters + (hasCustomTemporalRange ? 1 : 0);
};

export default function VentaOverviewView({
  ventas,
  summary,
  pagination,
  scopeInfo,
  ventasFilters,
  sucursales,
  loading,
  error,
  statsVisibility,
  onSearchChange,
  onPageChange,
  onPageSizeChange,
  onFiltersChange,
  onClearFilters,
  onOpenDetail,
  onGoToCaja,
  canCreate = true,
  onOpenReversion,
  canReversion = false
}) {
  const [view, setView] = useState('grid');
  const [pageSizeLocal, setPageSizeLocal] = useState(ventasFilters?.pageSize || 6);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterError, setFilterError] = useState('');
  const [filtersDraft, setFiltersDraft] = useState(() => ({
    search: ventasFilters?.search || '',
    idSucursal: ventasFilters?.idSucursal || '',
    estado: ventasFilters?.estado || '',
    fechaDesde: ventasFilters?.fechaDesde || '',
    fechaHasta: ventasFilters?.fechaHasta || '',
    horaDesde: ventasFilters?.horaDesde || '',
    horaHasta: ventasFilters?.horaHasta || ''
  }));
  const today = getTegucigalpaToday();
  const cashierMinDate = scopeInfo?.limitedToLast72Hours ? getVentasCashierMinDate() : undefined;
  const isSingleDay = Boolean(
    filtersDraft.fechaDesde &&
    filtersDraft.fechaHasta &&
    filtersDraft.fechaDesde === filtersDraft.fechaHasta
  );
  const activeFilters = useMemo(() => countActiveFilters(ventasFilters, today), [today, ventasFilters]);
  const sucursalOptions = useMemo(() => {
    const allowed = Array.isArray(scopeInfo?.allowedSucursalIds)
      ? scopeInfo.allowedSucursalIds.map(Number).filter((value) => Number.isInteger(value) && value > 0)
      : [];
    const allowedSet = new Set(allowed);
    const rows = (Array.isArray(sucursales) ? sucursales : [])
      .filter((sucursal) => {
        if (!allowedSet.size) return true;
        return allowedSet.has(Number(sucursal?.id_sucursal));
      })
      .map((sucursal) => ({
        value: String(sucursal.id_sucursal),
        label: sucursal.nombre_sucursal
      }));

    return [
      { value: '', label: 'Todas las sucursales permitidas' },
      ...rows
    ];
  }, [scopeInfo, sucursales]);

  const openFiltersDrawer = () => {
    setFiltersDraft({
      search: ventasFilters?.search || '',
      idSucursal: ventasFilters?.idSucursal || '',
      estado: ventasFilters?.estado || '',
      fechaDesde: ventasFilters?.fechaDesde || '',
      fechaHasta: ventasFilters?.fechaHasta || '',
      horaDesde: ventasFilters?.horaDesde || '',
      horaHasta: ventasFilters?.horaHasta || ''
    });
    setFilterError('');
    setFiltersOpen(true);
  };

  const clearFilters = () => {
    const temporalDefaults = createDefaultVentasTemporalFilters();
    setFiltersDraft({
      search: '',
      idSucursal: '',
      estado: '',
      ...temporalDefaults
    });
    setFilterError('');
    onClearFilters?.();
  };

  const applyFilters = () => {
    const validation = validateVentasTemporalFilters(filtersDraft, {
      limitedToLast72Hours: Boolean(scopeInfo?.limitedToLast72Hours)
    });
    if (!validation.ok) {
      setFilterError(validation.message);
      return;
    }
    setFilterError('');
    onFiltersChange?.(filtersDraft);
    setFiltersOpen(false);
  };

  const updateDraftDate = (field, value) => {
    setFiltersDraft((current) => {
      const next = { ...current, [field]: value };
      if (next.fechaDesde !== next.fechaHasta) {
        next.horaDesde = '';
        next.horaHasta = '';
      }
      return next;
    });
    setFilterError('');
  };

  return (
    <div className="ventas-page">
      <div className="inv-catpro-card inv-prod-card mb-3">
        <VentasToolbar
          search={ventasFilters?.search || ''}
          onSearchChange={onSearchChange}
          activeFilters={activeFilters}
          onOpenFilters={openFiltersDrawer}
          onOpenCreate={onGoToCaja}
          canCreate={canCreate}
          onOpenReversion={onOpenReversion}
          canReversion={canReversion}
          view={view}
          onViewChange={setView}
        />

        <VentasStats stats={summary} visibleKeys={statsVisibility} />

        <div className="inv-catpro-body inv-prod-body p-3">
          {error ? (
            <div className="alert alert-danger mb-3" role="alert">
              {error}
            </div>
          ) : null}

          <VentasList
            loading={loading}
            ventas={ventas}
            totalVentas={pagination?.total || 0}
            hasActiveFilters={activeFilters > 0}
            view={view}
            currentPage={pagination?.page || 1}
            pageSize={pagination?.pageSize || pageSizeLocal || 6}
            totalPages={pagination?.totalPages || 1}
            onPageChange={onPageChange}
            onPageSizeChange={(next) => {
              setPageSizeLocal(next);
              onPageSizeChange?.(next);
            }}
            limitedToLast72Hours={Boolean(scopeInfo?.limitedToLast72Hours)}
            onClearFilters={() => {
              clearFilters();
            }}
            onOpenCreate={onGoToCaja}
            onOpenDetail={onOpenDetail}
            canCreate={canCreate}
          />
        </div>
      </div>

      {filtersOpen ? (
        <div className="ventas-filter-drawer" role="dialog" aria-modal="true" aria-labelledby="ventas-filter-title">
          <button
            type="button"
            className="ventas-filter-drawer__backdrop"
            aria-label="Cerrar filtros"
            onClick={() => setFiltersOpen(false)}
          />
          <aside className="ventas-filter-drawer__panel">
            <header className="ventas-filter-drawer__header">
              <div className="ventas-filter-drawer__icon">
                <i className="bi bi-funnel" />
              </div>
              <button
                type="button"
                className="ventas-filter-drawer__close"
                onClick={() => setFiltersOpen(false)}
                aria-label="Cerrar filtros"
              >
                <i className="bi bi-x-lg" />
              </button>
            </header>

            <div className="ventas-filter-drawer__title">
              <span>Vista de filtros</span>
              <h3 id="ventas-filter-title">Ajusta la consulta de ventas</h3>
              <p>Filtra por sucursal, fecha y estado sin cambiar el alcance de seguridad del usuario.</p>
            </div>

            <div className="ventas-filter-drawer__content">
              <section className="ventas-filter-section">
                <h4>Busqueda</h4>
                <label className="ventas-filter-field">
                  <span>Cliente, numero, sucursal o usuario</span>
                  <input
                    type="search"
                    maxLength={120}
                    value={filtersDraft.search}
                    onChange={(event) => setFiltersDraft((current) => ({ ...current, search: event.target.value.slice(0, 120) }))}
                    placeholder="Ej. VTA-00007, Ana Lopez..."
                  />
                </label>
              </section>

              <section className="ventas-filter-section">
                <h4>Sucursal</h4>
                <div className="ventas-filter-field">
                  <span>Sucursal operativa</span>
                  <AppSelect
                    value={filtersDraft.idSucursal ? String(filtersDraft.idSucursal) : ''}
                    options={sucursalOptions}
                    onChange={(value) => setFiltersDraft((current) => ({ ...current, idSucursal: value }))}
                    disabled={!scopeInfo?.canSelectSucursal}
                    placeholder="Todas las sucursales permitidas"
                    searchable={sucursalOptions.length > 8}
                    searchPlaceholder="Buscar sucursal..."
                    emptyText="No hay sucursales disponibles."
                    className="ventas-filter-app-select"
                  />
                </div>
              </section>

              <section className="ventas-filter-section">
                <h4>Rango de fecha y hora</h4>
                <div className="ventas-filter-date-grid">
                  <label className="ventas-filter-field">
                    <span>Fecha inicial</span>
                    <input
                      type="date"
                      value={filtersDraft.fechaDesde}
                      min={cashierMinDate}
                      max={filtersDraft.fechaHasta && filtersDraft.fechaHasta < today ? filtersDraft.fechaHasta : today}
                      onChange={(event) => updateDraftDate('fechaDesde', event.target.value)}
                    />
                  </label>
                  <label className="ventas-filter-field">
                    <span>Fecha final</span>
                    <input
                      type="date"
                      value={filtersDraft.fechaHasta}
                      min={filtersDraft.fechaDesde || cashierMinDate}
                      max={today}
                      onChange={(event) => updateDraftDate('fechaHasta', event.target.value)}
                    />
                  </label>
                  <label className="ventas-filter-field">
                    <span>Hora inicial</span>
                    <input
                      type="time"
                      value={filtersDraft.horaDesde}
                      max={filtersDraft.horaHasta || undefined}
                      disabled={!isSingleDay}
                      onChange={(event) => {
                        setFiltersDraft((current) => ({ ...current, horaDesde: event.target.value }));
                        setFilterError('');
                      }}
                    />
                  </label>
                  <label className="ventas-filter-field">
                    <span>Hora final</span>
                    <input
                      type="time"
                      value={filtersDraft.horaHasta}
                      min={filtersDraft.horaDesde || undefined}
                      disabled={!isSingleDay}
                      onChange={(event) => {
                        setFiltersDraft((current) => ({ ...current, horaHasta: event.target.value }));
                        setFilterError('');
                      }}
                    />
                  </label>
                </div>
                {!isSingleDay ? (
                  <p className="ventas-filter-section__hint mb-0">Las horas solo estan disponibles cuando ambas fechas son iguales.</p>
                ) : null}
                {scopeInfo?.limitedToLast72Hours ? (
                  <p className="ventas-filter-section__hint mb-0">Como cajero, puedes consultar unicamente las ultimas 72 horas.</p>
                ) : null}
              </section>

              <section className="ventas-filter-section">
                <h4>Estado</h4>
                <div className="ventas-filter-field">
                  <span>Estado de venta</span>
                  <AppSelect
                    value={filtersDraft.estado || ''}
                    options={ESTADO_OPTIONS}
                    onChange={(value) => setFiltersDraft((current) => ({ ...current, estado: value }))}
                    placeholder="Todos los estados"
                    className="ventas-filter-app-select"
                  />
                </div>
              </section>
            </div>

            {filterError ? (
              <div className="alert alert-danger mx-3 mb-0" role="alert">
                {filterError}
              </div>
            ) : null}

            <footer className="ventas-filter-drawer__footer">
              <button type="button" className="ventas-filter-drawer__clear" onClick={clearFilters}>
                Limpiar
              </button>
              <button type="button" className="ventas-filter-drawer__apply" onClick={applyFilters}>
                Aplicar
              </button>
            </footer>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
