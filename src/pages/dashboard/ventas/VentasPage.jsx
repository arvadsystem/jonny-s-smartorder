import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CajaView from './components/CajaView';
import PedidosView from './components/PedidosView';
import VentaDetalleModal from './components/VentaDetalleModal';
import VentaOverviewView from './components/VentaOverviewView';
import VentasToast from './components/VentasToast';
import { useVentas } from './hooks/useVentas';
import './styles/ventas.css';

const VENTAS_TAB_KEYS = ['ventas', 'caja', 'pedidos'];

export default function VentasPage() {
  const {
    ventas,
    categorias,
    productos,
    combos,
    recetas,
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

  const [searchParams, setSearchParams] = useSearchParams();
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedVenta, setSelectedVenta] = useState(null);

  const activeTab = useMemo(() => {
    const tab = String(searchParams.get('tab') || 'ventas').toLowerCase();
    return VENTAS_TAB_KEYS.includes(tab) ? tab : 'ventas';
  }, [searchParams]);

  useEffect(() => {
    const rawTab = String(searchParams.get('tab') || '').toLowerCase();
    if (rawTab && VENTAS_TAB_KEYS.includes(rawTab)) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', 'ventas');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!detailOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [detailOpen]);

  const goToTab = (tabKey) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', tabKey);
    setSearchParams(nextParams);
  };

  const openDetail = async (venta) => {
    if (!venta?.id_factura) return;

    setSelectedVenta(venta);
    setDetailOpen(true);

    try {
      const detail = await getVentaDetail(venta.id_factura);
      setSelectedVenta(detail);
    } catch {
      // El hook ya expone el feedback visual.
    }
  };

  const handleCreateVenta = async (payload) => {
    const response = await createVenta(payload);

    if (response?.id_factura) {
      goToTab('ventas');

      try {
        const detail = await getVentaDetail(response.id_factura);
        setSelectedVenta(detail);
        setDetailOpen(true);
      } catch {
        // El listado ya se refresco aunque falle el detalle.
      }
    }

    return response;
  };

  return (
    <>
      {activeTab === 'ventas' ? (
        <VentaOverviewView
          ventas={ventas}
          loading={loading}
          error={error}
          onOpenDetail={openDetail}
          onGoToCaja={() => goToTab('caja')}
        />
      ) : null}

      {activeTab === 'caja' ? (
        <CajaView
          productos={productos}
          categorias={categorias}
          clientes={clientes}
          combos={combos}
          recetas={recetas}
          catalogLoading={catalogLoading}
          saving={saving}
          onSubmit={handleCreateVenta}
        />
      ) : null}

      {activeTab === 'pedidos' ? <PedidosView /> : null}

      <VentaDetalleModal
        open={detailOpen}
        venta={selectedVenta}
        loading={detailLoading}
        onClose={() => setDetailOpen(false)}
      />

      <VentasToast toast={toast} onClose={closeToast} />
    </>
  );
}
