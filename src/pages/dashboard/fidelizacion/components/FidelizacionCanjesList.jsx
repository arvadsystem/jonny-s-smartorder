import { useEffect, useMemo, useState } from 'react';
import { formatFechaHora, formatPoints } from '../utils/fidelizacionHelpers';

const Pagination = ({ meta, loading, onPageChange }) => {
  const totalPages = Math.max(1, Math.ceil((meta?.total || 0) / (meta?.limit || 20)));
  const currentPage = meta?.page || 1;

  return (
    <div className="ventas-page__pagination">
      <span>
        Mostrando {meta?.total || 0} canjes
      </span>
      <div className="d-flex align-items-center gap-2">
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={loading || currentPage <= 1}
        >
          Anterior
        </button>
        <span className="small text-muted fw-semibold">
          Pagina {currentPage} de {totalPages}
        </span>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={loading || currentPage >= totalPages}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
};

const countActiveFilters = ({ estado = '', desde = '', hasta = '', sucursal = '' }) =>
  [estado, desde, hasta, sucursal].filter((value) => String(value || '').trim() !== '').length;

export default function FidelizacionCanjesList({
  canjes,
  canjesMeta,
  loading,
  canSelectSucursal,
  selectedSucursalId,
  sucursales,
  loadingSucursales,
  filters,
  onFiltersChange,
  onSucursalChange,
  onRefresh,
  onOpenDetalle
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersDraft, setFiltersDraft] = useState({
    sucursal: selectedSucursalId || '',
    desde: filters.desde || '',
    hasta: filters.hasta || '',
    estado: filters.estado || ''
  });

  useEffect(() => {
    if (!filtersOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setFiltersOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [filtersOpen]);

  const estadoOptions = useMemo(() => {
    const seen = new Map();
    canjes.forEach((canje) => {
      if (canje.id_estado_canje && !seen.has(canje.id_estado_canje)) {
        seen.set(
          canje.id_estado_canje,
          canje.estado_nombre || canje.estado_codigo || `Estado ${canje.id_estado_canje}`
        );
      }
    });
    return [...seen.entries()].map(([id, label]) => ({ id, label }));
  }, [canjes]);

  const activeFilters = useMemo(
    () =>
      countActiveFilters({
        estado: filters.estado,
        desde: filters.desde,
        hasta: filters.hasta,
        sucursal: canSelectSucursal ? selectedSucursalId : ''
      }),
    [canSelectSucursal, filters.desde, filters.estado, filters.hasta, selectedSucursalId]
  );

  const visibleCanjes = useMemo(() => {
    const raw = String(searchTerm || '').trim().toLowerCase();
    if (!raw) return canjes;
    return canjes.filter((canje) => {
      const stack = [
        canje.cliente_nombre,
        canje.usuario_ejecutor,
        canje.estado_nombre,
        canje.estado_codigo,
        canje.nombre_sucursal,
        canje.observacion,
        `CAN-${String(canje.id_canje || '').padStart(5, '0')}`
      ];
      return stack.some((value) => String(value ?? '').toLowerCase().includes(raw));
    });
  }, [canjes, searchTerm]);

  const openFiltersDrawer = () => {
    setFiltersDraft({
      sucursal: selectedSucursalId || '',
      desde: filters.desde || '',
      hasta: filters.hasta || '',
      estado: filters.estado || ''
    });
    setFiltersOpen(true);
  };

  const applyFiltersDrawer = () => {
    onFiltersChange((current) => ({
      ...current,
      page: 1,
      desde: filtersDraft.desde,
      hasta: filtersDraft.hasta,
      estado: filtersDraft.estado
    }));
    if (canSelectSucursal) {
      onSucursalChange(filtersDraft.sucursal);
    }
    setFiltersOpen(false);
  };

  const clearFiltersDrawer = () => {
    setFiltersDraft({
      sucursal: '',
      desde: '',
      hasta: '',
      estado: ''
    });
  };

  return (
    <div className="fidelizacion-page d-flex flex-column h-100 gap-3">
      <div className="inv-catpro-card inv-prod-card flex-grow-1 d-flex flex-column border-0 bg-transparent shadow-none" style={{ minHeight: 0 }}>
        <div className="inv-prod-header ventas-page__toolbar bg-transparent border-0 px-0 pb-3" style={{ borderBottom: 'none' }}>
          <div className="inv-prod-title-wrap">
            <div className="inv-prod-title-row">
              <i className="bi bi-gift-fill text-danger inv-prod-title-icon" style={{ background: 'rgba(220,53,69,0.1)' }} />
              <span className="inv-prod-title">Historial de canjes</span>
            </div>
            <div className="inv-prod-subtitle">Consulta operativa de canjes registrados en fidelizacion.</div>
          </div>

          <div className="inv-prod-header-actions inv-ins-header-actions ventas-page__toolbar-actions fidelizacion-toolbar">
            <input
              type="search"
              className="form-control fidelizacion-toolbar__search-input"
              placeholder="Filtrar en pantalla..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />

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
          </div>
        </div>

        <div className="ventas-page__table-card flex-grow-1 d-flex flex-column min-h-0">
          <div className="ventas-page__table-wrap flex-grow-1 fidelizacion-table-desktop">
            <table className="table ventas-page__table">
              <thead>
                <tr>
                  <th>ID canje</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Sucursal</th>
                  <th className="text-end">Puntos redimidos</th>
                  <th className="text-center">Estado</th>
                  <th>Ejecutor</th>
                  <th className="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" className="text-center py-5">
                      <div className="spinner-border text-danger" role="status" />
                    </td>
                  </tr>
                ) : visibleCanjes.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-5">
                      <div className="ventas-create-modal__empty shadow-none border-0 bg-transparent">
                        <div className="ventas-create-modal__cart-empty-icon">
                          <i className="bi bi-inbox text-secondary" />
                        </div>
                        <span>No hay canjes registrados para los filtros aplicados.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  visibleCanjes.map((canje) => (
                    <tr key={canje.id_canje} className="ventas-page__table-row" onClick={() => onOpenDetalle(canje)}>
                      <td className="align-middle">
                        <div className="ventas-page__table-sale fw-bold text-dark">
                          <strong>CAN-{String(canje.id_canje).padStart(5, '0')}</strong>
                        </div>
                      </td>
                      <td className="align-middle text-muted small fw-semibold">
                        {formatFechaHora(canje.fecha_creacion)}
                      </td>
                      <td className="align-middle fw-bold text-dark">{canje.cliente_nombre}</td>
                      <td className="align-middle text-muted small">{canje.nombre_sucursal || 'N/D'}</td>
                      <td className="align-middle text-end">
                        <span className="ventas-page__table-pill border-danger text-danger bg-white">
                          -{formatPoints(canje.total_puntos)} pts
                        </span>
                      </td>
                      <td className="align-middle text-center">
                        <span className={`ventas-page__table-pill text-white ${canje.estado_codigo === 'REGISTRADO' ? 'bg-success border-success' : 'bg-secondary border-secondary'}`}>
                          {canje.estado_nombre || canje.estado_codigo}
                        </span>
                      </td>
                      <td className="align-middle text-muted small fw-semibold">{canje.usuario_ejecutor || '-'}</td>
                      <td className="align-middle text-end" onClick={(event) => event.stopPropagation()}>
                        <button
                          type="button"
                          className="ventas-page__table-detail-btn"
                          title="Ver detalle del canje"
                          onClick={() => onOpenDetalle(canje)}
                        >
                          <i className="bi bi-eye" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="fidelizacion-mobile-list">
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-danger" role="status" />
              </div>
            ) : visibleCanjes.length === 0 ? (
              <div className="text-center py-4">
                <div className="ventas-create-modal__empty shadow-none border-0 bg-transparent">
                  <div className="ventas-create-modal__cart-empty-icon">
                    <i className="bi bi-inbox text-secondary" />
                  </div>
                  <span>No hay canjes registrados para los filtros aplicados.</span>
                </div>
              </div>
            ) : (
              visibleCanjes.map((canje) => (
                <article key={canje.id_canje} className="fidelizacion-mobile-card">
                  <div className="fidelizacion-mobile-card__head">
                    <div>
                      <strong>CAN-{String(canje.id_canje).padStart(5, '0')}</strong>
                      <small>{formatFechaHora(canje.fecha_creacion)}</small>
                    </div>
                    <span
                      className={`ventas-page__table-pill text-white ${
                        canje.estado_codigo === 'REGISTRADO'
                          ? 'bg-success border-success'
                          : 'bg-secondary border-secondary'
                      }`}
                    >
                      {canje.estado_nombre || canje.estado_codigo}
                    </span>
                  </div>

                  <div className="fidelizacion-mobile-card__body">
                    <div>
                      <span>Cliente</span>
                      <strong>{canje.cliente_nombre}</strong>
                    </div>
                    <div>
                      <span>Sucursal</span>
                      <strong>{canje.nombre_sucursal || 'N/D'}</strong>
                    </div>
                    <div>
                      <span>Puntos redimidos</span>
                      <strong>-{formatPoints(canje.total_puntos)} pts</strong>
                    </div>
                    <div>
                      <span>Ejecutor</span>
                      <strong>{canje.usuario_ejecutor || '-'}</strong>
                    </div>
                  </div>

                  <div className="fidelizacion-mobile-card__actions">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => onOpenDetalle(canje)}
                    >
                      Ver detalle
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        <Pagination
          meta={canjesMeta}
          loading={loading}
          onPageChange={(page) => onFiltersChange((current) => ({ ...current, page }))}
        />
      </div>

      <div
        className={`inv-prod-drawer-backdrop inv-cat-v2__drawer-backdrop ${filtersOpen ? 'show' : ''}`}
        onClick={() => setFiltersOpen(false)}
        aria-hidden={!filtersOpen}
      />

      <aside
        className={`inv-prod-drawer inv-cat-v2__drawer inv-cat-v2__drawer--filters ${filtersOpen ? 'show' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!filtersOpen}
      >
        <div className="inv-prod-drawer-body inv-cat-v2__drawer-body">
          <div className="inv-cat-create-hero inv-cat-filter-hero">
            <button
              type="button"
              className="inv-prod-drawer-close inv-cat-create-hero__close"
              onClick={() => setFiltersOpen(false)}
              title="Cerrar"
            >
              <i className="bi bi-x-lg" />
            </button>
            <div className="inv-cat-create-hero__icon">
              <i className="bi bi-funnel" aria-hidden="true" />
            </div>
            <div className="inv-cat-create-hero__copy">
              <div className="inv-cat-create-hero__kicker">Vista De Filtros</div>
              <div className="inv-cat-create-hero__title">Ajusta el historial de canjes</div>
            </div>
            <div className="inv-cat-create-hero__chips">
              <span className="inv-cat-create-hero__chip">
                <i className="bi bi-sliders2" aria-hidden="true" />
                {activeFilters > 0 ? `${activeFilters} filtros activos` : 'Sin filtros activos'}
              </span>
            </div>
          </div>

          <div className="inv-cat-filter-grid">
            {canSelectSucursal ? (
              <div className="inv-prod-drawer-section inv-cat-filter-card">
                <div className="inv-prod-drawer-section-title">Sucursal visible</div>
                <select
                  className="form-select"
                  value={filtersDraft.sucursal}
                  onChange={(event) => setFiltersDraft((current) => ({ ...current, sucursal: event.target.value }))}
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

            <div className="inv-prod-drawer-section inv-cat-filter-card">
              <div className="inv-prod-drawer-section-title">Estado</div>
              <select
                className="form-select"
                value={filtersDraft.estado}
                onChange={(event) => setFiltersDraft((current) => ({ ...current, estado: event.target.value }))}
              >
                <option value="">Todos los estados</option>
                {estadoOptions.map((estado) => (
                  <option key={estado.id} value={estado.id}>
                    {estado.label}
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
                onChange={(event) => setFiltersDraft((current) => ({ ...current, desde: event.target.value }))}
              />
            </div>

            <div className="inv-prod-drawer-section inv-cat-filter-card">
              <div className="inv-prod-drawer-section-title">Hasta</div>
              <input
                type="date"
                className="form-control"
                value={filtersDraft.hasta}
                onChange={(event) => setFiltersDraft((current) => ({ ...current, hasta: event.target.value }))}
              />
            </div>
          </div>

          <div className="inv-prod-drawer-actions inv-cat-v2__drawer-actions inv-cat-filter-actions">
            <button type="button" className="btn inv-prod-btn-subtle" onClick={clearFiltersDrawer}>
              Limpiar
            </button>
            <button type="button" className="btn inv-prod-btn-outline" onClick={() => setFiltersOpen(false)}>
              Cancelar
            </button>
            <button type="button" className="btn inv-prod-btn-primary" onClick={applyFiltersDrawer}>
              Aplicar
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
