import { useMemo, useState } from 'react';
import {
  formatCajaCurrency,
  resolveDifferenceBadge
} from '../../utils/cajasHelpers';
import CierresCajaFiltersDrawer from '../../../cierres-caja/components/CierresCajaFiltersDrawer';

const countActiveFilters = ({ estado = '', desde = '', hasta = '' }) =>
  [estado, desde, hasta].filter((value) => String(value || '').trim() !== '').length;

export default function CierresCajaOverview({
  stats,
  sesionActiva,
  loading,
  canSelectSucursal,
  selectedSucursalId,
  sucursales,
  loadingSucursales,
  estadosSesion,
  filters,
  onFiltersChange,
  onSucursalChange,
  onRefresh,
  canOpenSession,
  supportsCajaCatalogCreate,
  onOpenNuevaCaja
}) {
  const [searchTerm, setSearchTerm] = useState(() => filters.search || '');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersDraft, setFiltersDraft] = useState({
    estado: filters.id_estado_sesion_caja || '',
    desde: filters.fecha_desde || '',
    hasta: filters.fecha_hasta || ''
  });

  const diferenciaBadge = resolveDifferenceBadge(stats?.diferenciaAcumulada ?? null);
  const activeFilters = useMemo(
    () =>
      countActiveFilters({
        estado: filters.id_estado_sesion_caja,
        desde: filters.fecha_desde,
        hasta: filters.fecha_hasta
      }),
    [filters.fecha_desde, filters.fecha_hasta, filters.id_estado_sesion_caja]
  );

  const handleSearch = (event) => {
    event.preventDefault();
    onFiltersChange((current) => ({
      ...current,
      search: searchTerm.trim()
    }));
  };

  const openFiltersDrawer = () => {
    setFiltersDraft({
      estado: filters.id_estado_sesion_caja || '',
      desde: filters.fecha_desde || '',
      hasta: filters.fecha_hasta || ''
    });
    setFiltersOpen(true);
  };

  const clearFiltersDrawer = () => {
    setFiltersDraft({
      estado: '',
      desde: '',
      hasta: ''
    });
  };

  const applyFiltersDrawer = () => {
    onFiltersChange((current) => ({
      ...current,
      id_estado_sesion_caja: filtersDraft.estado,
      fecha_desde: filtersDraft.desde,
      fecha_hasta: filtersDraft.hasta
    }));
    setFiltersOpen(false);
  };

  return (
    <>
      <section className="inv-catpro-card inv-prod-card border-0 bg-transparent shadow-none">
        <div
          className="inv-prod-header ventas-page__toolbar align-items-center bg-transparent px-0 pb-3"
          style={{ borderBottom: 'none' }}
        >
          <div className="inv-prod-title-wrap">
            <div className="inv-prod-title-row">
              <i
                className="bi bi-safe2-fill text-danger inv-prod-title-icon"
                style={{ background: 'rgba(220,53,69,0.1)' }}
              />
              <span className="inv-prod-title">Operacion de cajas</span>
            </div>
            <div className="inv-prod-subtitle">
              Seguimiento operativo de sesiones activas, arqueos y cierres por sucursal.
            </div>
          </div>

          <div className="inv-prod-header-actions inv-ins-header-actions ventas-page__toolbar-actions fidelizacion-toolbar cierres-caja-toolbar">
            <form onSubmit={handleSearch} className="inv-ins-search fidelizacion-toolbar__search cierres-caja-toolbar__search">
              <i className="bi bi-search" />
              <input
                type="search"
                placeholder="Buscar por sesion, caja, responsable o sucursal..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </form>

            {canSelectSucursal ? (
              <div className="cierres-caja-toolbar__scope-inline" aria-label="Sucursal visible">
                <i className="bi bi-shop" aria-hidden="true" />
                <span className="cierres-caja-toolbar__scope-inline-label">Sucursal visible</span>
                <select
                  className="form-select cierres-caja-toolbar__scope-inline-select"
                  value={selectedSucursalId}
                  onChange={(event) => onSucursalChange(event.target.value)}
                  disabled={loadingSucursales}
                >
                  <option value="">
                    {loadingSucursales ? 'Cargando sucursales...' : 'Resumen multisucursal'}
                  </option>
                  {sucursales.map((sucursal) => (
                    <option key={sucursal.id_sucursal} value={sucursal.id_sucursal}>
                      {sucursal.nombre_sucursal}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <button
              type="button"
              className="inv-prod-toolbar-btn bg-white border fidelizacion-toolbar__filter-btn"
              onClick={openFiltersDrawer}
            >
              <i className="bi bi-funnel" />
              <span>Filtros</span>
              {activeFilters > 0 ? (
                <strong className="fidelizacion-toolbar__filter-count">{activeFilters}</strong>
              ) : null}
            </button>

            <button
              type="button"
              className="inv-prod-toolbar-btn bg-white border"
              onClick={onRefresh}
              disabled={loading}
              style={{ color: 'rgba(82, 44, 34, 0.86)' }}
            >
              <i className="bi bi-arrow-clockwise" />
              <span>Refrescar</span>
            </button>

            {canOpenSession ? (
              <button
                type="button"
                className="inv-prod-toolbar-btn bg-white border cierres-caja-toolbar__cta"
                onClick={onOpenNuevaCaja}
                title={
                  supportsCajaCatalogCreate
                    ? 'Crear y abrir caja'
                    : 'Abre una sesion sobre una caja ya existente'
                }
                style={{ color: 'rgba(154, 83, 25, 0.9)' }}
              >
                <i className="bi bi-plus-circle" />
                <span>Nueva caja</span>
              </button>
            ) : null}
          </div>
        </div>

        <div className="inv-prod-kpis ventas-page__stats mb-2" aria-label="Resumen de cierres de caja">
          <div className="inv-prod-kpi ventas-page__stat-card">
            <div className="ventas-page__stat-icon text-primary border-0 bg-white">
              <i className="bi bi-safe2" />
            </div>
            <div className="inv-prod-kpi-content">
              <span>Sesiones visibles</span>
              <strong>{loading ? <div className="spinner-border spinner-border-sm" /> : stats.totalSesiones}</strong>
            </div>
          </div>

          <div className="inv-prod-kpi ventas-page__stat-card is-success">
            <div className="ventas-page__stat-icon text-success border-0 bg-white">
              <i className="bi bi-unlock-fill" />
            </div>
            <div className="inv-prod-kpi-content">
              <span>Sesiones abiertas</span>
              <strong>{loading ? <div className="spinner-border spinner-border-sm" /> : stats.abiertas}</strong>
              <small className="fidelizacion-kpi__helper">
                {sesionActiva?.id_sesion_caja
                  ? `Sesion activa #${sesionActiva.id_sesion_caja}`
                  : 'No hay sesion activa para el usuario.'}
              </small>
            </div>
          </div>

          <div className="inv-prod-kpi ventas-page__stat-card is-warning">
            <div className="ventas-page__stat-icon text-warning border-0 bg-white">
              <i className="bi bi-cash-stack" />
            </div>
            <div className="inv-prod-kpi-content">
              <span>Efectivo teorico visible</span>
              <strong>
                {loading ? <div className="spinner-border spinner-border-sm" /> : `L. ${formatCajaCurrency(stats.efectivoTeoricoVisible)}`}
              </strong>
            </div>
          </div>

          <div className="inv-prod-kpi ventas-page__stat-card is-accent">
            <div className="ventas-page__stat-icon text-danger border-0 bg-white">
              <i className="bi bi-activity" />
            </div>
            <div className="inv-prod-kpi-content">
              <span>Diferencia acumulada</span>
              <strong>
                {loading ? <div className="spinner-border spinner-border-sm" /> : `L. ${formatCajaCurrency(stats.diferenciaAcumulada)}`}
              </strong>
              <small className="fidelizacion-kpi__helper">
                <span className={`ventas-page__table-pill ${diferenciaBadge.className}`}>
                  {diferenciaBadge.label}
                </span>
              </small>
            </div>
          </div>
        </div>
      </section>

      <CierresCajaFiltersDrawer
        open={filtersOpen}
        title="Refina la operacion de cajas"
        subtitle="Aplica filtros avanzados sin recargar la cabecera principal."
        activeFilters={activeFilters}
        onClose={() => setFiltersOpen(false)}
        onClear={clearFiltersDrawer}
        onApply={applyFiltersDrawer}
      >
        <div className="inv-prod-drawer-section inv-cat-filter-card">
          <div className="inv-prod-drawer-section-title">Estado de sesion</div>
          <select
            className="form-select"
            value={filtersDraft.estado}
            onChange={(event) =>
              setFiltersDraft((current) => ({ ...current, estado: event.target.value }))
            }
          >
            <option value="">Todos los estados</option>
            {estadosSesion.map((estado) => (
              <option key={estado.id_estado_sesion_caja} value={estado.id_estado_sesion_caja}>
                {estado.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="inv-prod-drawer-section inv-cat-filter-card">
          <div className="inv-prod-drawer-section-title">Desde</div>
          <input
            type="date"
            className="form-control"
            value={filtersDraft.desde}
            onChange={(event) =>
              setFiltersDraft((current) => ({ ...current, desde: event.target.value }))
            }
          />
        </div>

        <div className="inv-prod-drawer-section inv-cat-filter-card">
          <div className="inv-prod-drawer-section-title">Hasta</div>
          <input
            type="date"
            className="form-control"
            value={filtersDraft.hasta}
            onChange={(event) =>
              setFiltersDraft((current) => ({ ...current, hasta: event.target.value }))
            }
          />
        </div>
      </CierresCajaFiltersDrawer>
    </>
  );
}
