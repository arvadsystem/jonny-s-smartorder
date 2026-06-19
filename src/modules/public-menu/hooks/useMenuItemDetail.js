import { useCallback, useState } from 'react';
import { publicMenuBootstrapService } from '../services/publicMenuBootstrapService';

// Hook de detalle de item para HU-133 (sin carrito todavia).
export const useMenuItemDetail = ({ branchId }) => {
  const [itemDetail, setItemDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Carga detalle real usando id_detalle_menu + sucursal activa.
  const loadItemDetail = useCallback(
    async (idDetalleMenu) => {
      if (!branchId || !idDetalleMenu) return;

      try {
        setLoading(true);
        setError('');

        const response = await publicMenuBootstrapService.getCatalogItemDetail({
          idSucursal: branchId,
          idDetalleMenu
        });

        setItemDetail(response?.item || null);
      } catch (err) {
        setItemDetail(null);
        setError(err?.message || 'No pudimos cargar el detalle del item.');
      } finally {
        setLoading(false);
      }
    },
    [branchId]
  );

  // Limpia estado al cerrar modal/sheet.
  const clearItemDetail = useCallback(() => {
    setItemDetail(null);
    setError('');
    setLoading(false);
  }, []);

  return {
    itemDetail,
    loading,
    error,
    loadItemDetail,
    clearItemDetail
  };
};
