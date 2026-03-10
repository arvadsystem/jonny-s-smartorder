import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import VentasList from './VentasList';
import VentasStats from './VentasStats';
import VentasToolbar from './VentasToolbar';
import { buildVentaStats, matchesVenta } from '../utils/ventasHelpers';

export default function VentaOverviewView({
  ventas,
  loading,
  error,
  onOpenDetail,
  onGoToCaja,
  canCreate = true
}) {
  const [search, setSearch] = useState('');
  const [view, setView] = useState('grid');
  const [currentPage, setCurrentPage] = useState(0);

  const deferredSearch = useDeferredValue(search);
  const stats = useMemo(() => buildVentaStats(ventas), [ventas]);

  const filteredVentas = useMemo(() => {
    const rows = [...(Array.isArray(ventas) ? ventas : [])];
    rows.sort((a, b) => Number(b?.id_factura ?? 0) - Number(a?.id_factura ?? 0));

    return rows.filter((venta) => matchesVenta(venta, deferredSearch));
  }, [deferredSearch, ventas]);

  const pageSize = view === 'list' ? 5 : 6;
  const totalPages = Math.max(1, Math.ceil(filteredVentas.length / pageSize));
  const pagedVentas = filteredVentas.slice(currentPage * pageSize, currentPage * pageSize + pageSize);
  const hasActiveFilters = search.trim() !== '';

  useEffect(() => {
    setCurrentPage(0);
  }, [deferredSearch, view]);

  useEffect(() => {
    if (currentPage <= totalPages - 1) return;
    setCurrentPage(Math.max(totalPages - 1, 0));
  }, [currentPage, totalPages]);

  return (
    <div className="ventas-page">
      <div className="ventas-page__top-controls">
        <div className="ventas-page__view-toggle" role="tablist" aria-label="Cambiar vista">
          <button
            type="button"
            className={`ventas-page__view-btn ${view === 'grid' ? 'is-active' : ''}`}
            onClick={() => setView('grid')}
            aria-pressed={view === 'grid'}
            title="Vista en tarjetas"
          >
            <i className="bi bi-grid-3x3-gap-fill" />
          </button>
          <button
            type="button"
            className={`ventas-page__view-btn ${view === 'list' ? 'is-active' : ''}`}
            onClick={() => setView('list')}
            aria-pressed={view === 'list'}
            title="Vista en lista"
          >
            <i className="bi bi-list-ul" />
          </button>
        </div>
      </div>

      <div className="inv-catpro-card inv-prod-card mb-3">
        <VentasToolbar search={search} onSearchChange={setSearch} onOpenCreate={onGoToCaja} canCreate={canCreate} />

        <VentasStats stats={stats} />

        <div className="inv-catpro-body inv-prod-body p-3">
          {error ? (
            <div className="alert alert-danger mb-3" role="alert">
              {error}
            </div>
          ) : null}

          <VentasList
            loading={loading}
            ventas={pagedVentas}
            totalVentas={filteredVentas.length}
            hasActiveFilters={hasActiveFilters}
            view={view}
            currentPage={currentPage}
            totalPages={totalPages}
            onPrevPage={() => setCurrentPage((page) => Math.max(page - 1, 0))}
            onNextPage={() => setCurrentPage((page) => Math.min(page + 1, totalPages - 1))}
            onClearFilters={() => {
              setSearch('');
            }}
            onOpenCreate={onGoToCaja}
            onOpenDetail={onOpenDetail}
            canCreate={canCreate}
          />
        </div>
      </div>
    </div>
  );
}
