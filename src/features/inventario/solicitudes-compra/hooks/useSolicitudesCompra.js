import { useCallback, useEffect, useRef, useState } from 'react';
import { inventarioService } from '../../../../services/inventarioService';
import { solicitudesCompraService } from '../../../../services/solicitudesCompraService';
import {
  createCatalogRequestCoordinator,
  createEmptyCatalogState,
  mapSolicitudError
} from '../utils/solicitudesCompraUtils';

const INITIAL_LIST = { solicitudes: [], pagination: { page: 1, total_pages: 1, total: 0 } };

export default function useSolicitudesCompra({ canView, openToast }) {
  const [view, setView] = useState('listado');
  const [listState, setListState] = useState({ ...INITIAL_LIST, loading: false, error: '' });
  const [filter, setFilterState] = useState('');
  const [detailState, setDetailState] = useState({ id: null, data: null, loading: false, error: '' });
  const [warehouses, setWarehouses] = useState([]);
  const [warehousesLoading, setWarehousesLoading] = useState(false);
  const [catalogState, setCatalogState] = useState(() => createEmptyCatalogState());
  const listRequest = useRef(0);
  const catalogRequest = useRef(createCatalogRequestCoordinator());
  const submitLock = useRef(false);

  const loadList = useCallback(async ({ page = 1, estado = '' } = {}) => {
    if (!canView) return;
    const requestId = ++listRequest.current;
    setListState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const payload = await solicitudesCompraService.getSolicitudes({ estado, page, limit: 10 });
      if (requestId !== listRequest.current) return;
      setListState({
        solicitudes: Array.isArray(payload?.solicitudes) ? payload.solicitudes : [],
        pagination: payload?.pagination || { page, total_pages: 1, total: 0 }, loading: false, error: ''
      });
    } catch (error) {
      if (requestId === listRequest.current) setListState((current) => ({ ...current, loading: false, error: mapSolicitudError(error) }));
    }
  }, [canView]);

  useEffect(() => { void loadList({ page: 1, estado: '' }); }, [loadList]);

  const setFilter = useCallback((estado) => {
    setFilterState(estado);
    void loadList({ page: 1, estado });
  }, [loadList]);

  const openCreate = useCallback(async () => {
    setView('nueva');
    setWarehousesLoading(true);
    try {
      const rows = await inventarioService.getAlmacenes();
      setWarehouses((Array.isArray(rows) ? rows : []).filter((row) => row?.estado !== false));
    } catch (error) {
      openToast('ERROR', mapSolicitudError(error), 'danger');
    } finally { setWarehousesLoading(false); }
  }, [openToast]);

  const openDetail = useCallback(async (id) => {
    setView('detalle');
    setDetailState({ id, data: null, loading: true, error: '' });
    try {
      const data = await solicitudesCompraService.getSolicitudById(id);
      setDetailState({ id, data, loading: false, error: '' });
    } catch (error) {
      setDetailState({ id, data: null, loading: false, error: mapSolicitudError(error) });
    }
  }, []);

  const loadCatalog = useCallback(async (options) => {
    const warehouseId = String(options?.id_almacen ?? '');
    const requestToken = catalogRequest.current.begin(warehouseId);
    setCatalogState(createEmptyCatalogState(warehouseId, true));
    try {
      const payload = await solicitudesCompraService.getCatalogo({ ...options, limit: 12 });
      if (!catalogRequest.current.isCurrent(requestToken, warehouseId)) return;
      setCatalogState({
        items: Array.isArray(payload?.items) ? payload.items : Array.isArray(payload?.catalogo) ? payload.catalogo : [],
        pagination: payload?.pagination || { page: options?.page || 1, total_pages: 1 },
        loading: false, error: '', requestedWarehouseId: warehouseId
      });
    } catch (error) {
      if (!catalogRequest.current.isCurrent(requestToken, warehouseId)) return;
      setCatalogState({ ...createEmptyCatalogState(warehouseId), error: mapSolicitudError(error) });
    }
  }, []);

  const submit = useCallback(async (payload) => {
    if (submitLock.current) return null;
    submitLock.current = true;
    try {
      const result = await solicitudesCompraService.crearSolicitud(payload);
      openToast('SOLICITUD ENVIADA', 'La solicitud fue enviada a Administración.', 'success');
      setFilterState('PENDIENTE');
      setView('listado');
      await loadList({ page: 1, estado: 'PENDIENTE' });
      return result;
    } catch (error) {
      openToast('NO SE PUDO ENVIAR', mapSolicitudError(error), 'danger');
      throw error;
    } finally { submitLock.current = false; }
  }, [loadList, openToast]);

  return {
    view, setView, listState, filter, setFilter, loadList, openCreate, openDetail,
    detailState, warehouses, warehousesLoading, catalogState, loadCatalog, submit
  };
}
