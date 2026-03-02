import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import NuevaVentaModal from './components/NuevaVentaModal';
import VentaDetalleModal from './components/VentaDetalleModal';
import VentasList from './components/VentasList';
import VentasStats from './components/VentasStats';
import VentasToast from './components/VentasToast';
import VentasToolbar from './components/VentasToolbar';
import { useVentas } from './hooks/useVentas';
import { buildVentaStats, matchesVenta } from './utils/ventasHelpers';
import './styles/ventas.css';

export default function VentasPage() {
  const {
    ventas,
    categorias,
    productos,
    clientes,
    loading,
    catalogLoading,
    saving,
    detailLoading,
    error,
    toast,
    closeToast,
    createVenta,
    getVentaDetail
  } = useVentas();

  const [search, setSearch] = useState('');
  const [view, setView] = useState('grid');
  const [currentPage, setCurrentPage] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedVenta, setSelectedVenta] = useState(null);

  const deferredSearch = useDeferredValue(search);
  const stats = useMemo(() => buildVentaStats(ventas), [ventas]);

  const filteredVentas = useMemo(() => {
    const rows = [...(Array.isArray(ventas) ? ventas : [])];
    rows.sort((a, b) => Number(b?.id_pedido ?? 0) - Number(a?.id_pedido ?? 0));

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

  useEffect(() => {
    const hasModalOpen = createOpen || detailOpen;
    if (!hasModalOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [createOpen, detailOpen]);

  const openDetail = async (venta) => {
    if (!venta?.id_pedido) return;

    setSelectedVenta(venta);
    setDetailOpen(true);

    try {
      const detail = await getVentaDetail(venta.id_pedido);
      setSelectedVenta(detail);
    } catch {
      // El hook ya gestiona el feedback visual.
    }
  };

  const handleCreateVenta = async (payload) => {
    const response = await createVenta(payload);
    setCreateOpen(false);

    if (response?.id_pedido) {
      try {
        const detail = await getVentaDetail(response.id_pedido);
        setSelectedVenta(detail);
        setDetailOpen(true);
      } catch {
        // La venta ya fue creada; el listado se refresco aunque falle el detalle.
      }
    }
  };

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
          search={search}
          onSearchChange={setSearch}
          createOpen={createOpen}
          onOpenCreate={() => setCreateOpen(true)}
        />

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
            onOpenCreate={() => setCreateOpen(true)}
            onOpenDetail={openDetail}
          />
        </div>
      </div>

      <NuevaVentaModal
        open={createOpen}
        saving={saving}
        catalogLoading={catalogLoading}
        productos={productos}
        categorias={categorias}
        clientes={clientes}
        onClose={() => {
          if (!saving) setCreateOpen(false);
        }}
        onSubmit={handleCreateVenta}
      />

      <VentaDetalleModal
        open={detailOpen}
        venta={selectedVenta}
        loading={detailLoading}
        onClose={() => setDetailOpen(false)}
      />

      <VentasToast toast={toast} onClose={closeToast} />
    </div>
  );
}
