import { useState } from 'react';
import VentasList from './VentasList';
import VentasStats from './VentasStats';
import VentasToolbar from './VentasToolbar';

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
  onSucursalChange,
  onOpenDetail,
  onGoToCaja,
  canCreate = true,
  onOpenReversion,
  canReversion = false
}) {
  const [view, setView] = useState('grid');
  const [pageSizeLocal, setPageSizeLocal] = useState(ventasFilters?.pageSize || 30);

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
        <VentasToolbar
          search={ventasFilters?.search || ''}
          selectedSucursalId={ventasFilters?.idSucursal || null}
          canSelectSucursal={Boolean(scopeInfo?.canSelectSucursal)}
          sucursales={Array.isArray(sucursales) ? sucursales : []}
          allowedSucursalIds={Array.isArray(scopeInfo?.allowedSucursalIds) ? scopeInfo.allowedSucursalIds : []}
          onSucursalChange={onSucursalChange}
          onSearchChange={onSearchChange}
          onOpenCreate={onGoToCaja}
          canCreate={canCreate}
          onOpenReversion={onOpenReversion}
          canReversion={canReversion}
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
            hasActiveFilters={Boolean((ventasFilters?.search || '').trim())}
            view={view}
            currentPage={pagination?.page || 1}
            pageSize={pagination?.pageSize || pageSizeLocal || 30}
            totalPages={pagination?.totalPages || 1}
            onPageChange={onPageChange}
            onPageSizeChange={(next) => {
              setPageSizeLocal(next);
              onPageSizeChange?.(next);
            }}
            limitedToLast72Hours={Boolean(scopeInfo?.limitedToLast72Hours)}
            onClearFilters={() => {
              onSearchChange?.('');
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
