import { useCallback, useEffect, useRef, useState } from 'react';
import { inventarioService } from '../../../../services/inventarioService';
import { solicitudesCompraService } from '../../../../services/solicitudesCompraService';
import {
  createCatalogRequestCoordinator,
  createEmptyCatalogState,
  mapSolicitudError
} from '../utils/solicitudesCompraUtils';
import {
  clearPendingOcSubmission,
  createPendingOcSubmission,
  isAmbiguousCreateError,
  loadPendingOcSubmission,
  pollOcReconciliation,
  savePendingOcSubmission
} from '../utils/solicitudesCompraCreateRecovery';

const INITIAL_LIST = { solicitudes: [], pagination: { page: 1, total_pages: 1, total: 0 } };

export default function useSolicitudesCompra({ canView, openToast }) {
  const [view, setView] = useState('listado');
  const [listState, setListState] = useState({ ...INITIAL_LIST, loading: false, error: '' });
  const [filter, setFilterState] = useState('');
  const [search, setSearchState] = useState('');
  const [detailState, setDetailState] = useState({ id: null, data: null, loading: false, error: '' });
  const [warehouses, setWarehouses] = useState([]);
  const [warehousesLoading, setWarehousesLoading] = useState(false);
  const [catalogState, setCatalogState] = useState(() => createEmptyCatalogState());
  const [createPhase, setCreatePhase] = useState('IDLE');
  const listRequest = useRef(0);
  const catalogRequest = useRef(createCatalogRequestCoordinator());
  const submitLock = useRef(false);
  const mounted = useRef(true);
  const debounceRef = useRef(null);
  const pendingSubmission = useRef(loadPendingOcSubmission());
  const reconciliationController = useRef(null);

  const loadList = useCallback(async ({ page = 1, estado = '', buscar = '' } = {}) => {
    if (!canView) return;
    const requestId = ++listRequest.current;
    setListState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const payload = await solicitudesCompraService.getSolicitudes({ estado, buscar, page, limit: 10 });
      if (!mounted.current || requestId !== listRequest.current) return;
      setListState({
        solicitudes: Array.isArray(payload?.solicitudes) ? payload.solicitudes : [],
        pagination: payload?.pagination || { page, total_pages: 1, total: 0 }, loading: false, error: ''
      });
    } catch (error) {
      if (mounted.current && requestId === listRequest.current) setListState((current) => ({ ...current, loading: false, error: mapSolicitudError(error) }));
    }
  }, [canView]);

  useEffect(() => { void loadList({ page: 1, estado: '' }); }, [loadList]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      reconciliationController.current?.abort();
      listRequest.current += 1;
    };
  }, []);

  const setFilter = useCallback((estado) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setFilterState(estado);
    void loadList({ page: 1, estado, buscar: search });
  }, [loadList, search]);

  const setSearch = useCallback((value, { immediate = false } = {}) => {
    setSearchState(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const execute = () => void loadList({ page: 1, estado: filter, buscar: value });
    if (immediate) execute();
    else debounceRef.current = setTimeout(execute, 300);
  }, [filter, loadList]);

  const clearSearch = useCallback(() => setSearch('', { immediate: true }), [setSearch]);

  const openCreate = useCallback(async () => {
    setView('nueva');
    const pending = loadPendingOcSubmission();
    pendingSubmission.current = pending;
    if (pending) {
      setCreatePhase('RECONCILING');
      reconciliationController.current?.abort();
      reconciliationController.current = new AbortController();
      try {
        const recovered = await pollOcReconciliation({ clientRequestId: pending.client_request_id,
          reconcile: solicitudesCompraService.reconciliarEnvio, signal: reconciliationController.current.signal });
        if (recovered?.found) {
          clearPendingOcSubmission(); pendingSubmission.current = null; setCreatePhase('IDLE');
          openToast('SOLICITUD CONFIRMADA', `La solicitud #${recovered.solicitud.id_solicitud_compra} ya había sido recibida por Administración. No se creó un duplicado.`, 'success');
          setView('listado');
          await loadList({ page: 1, estado: 'PENDIENTE' });
          return;
        }
        if (!recovered?.cancelled) setCreatePhase('AWAITING_RETRY');
      } catch (error) {
        setCreatePhase('AWAITING_RETRY');
        openToast('NO PUDIMOS CONFIRMAR TODAVÍA', mapSolicitudError(error), 'warning');
      }
    } else setCreatePhase('IDLE');
    setWarehousesLoading(true);
    try {
      const rows = await inventarioService.getAlmacenes();
      setWarehouses((Array.isArray(rows) ? rows : []).filter((row) => row?.estado !== false));
    } catch (error) {
      openToast('ERROR', mapSolicitudError(error), 'danger');
    } finally { setWarehousesLoading(false); }
  }, [loadList, openToast]);

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
    const pending = pendingSubmission.current || createPendingOcSubmission(payload);
    pendingSubmission.current = pending;
    savePendingOcSubmission(pending);
    setCreatePhase('SENDING');
    try {
      const result = await solicitudesCompraService.crearSolicitud(pending.payload);
      clearPendingOcSubmission(); pendingSubmission.current = null; setCreatePhase('IDLE');
      openToast('SOLICITUD ENVIADA', 'La solicitud fue enviada a Administración.', 'success');
      setFilterState('PENDIENTE');
      setSearchState('');
      setView('listado');
      await loadList({ page: 1, estado: 'PENDIENTE' });
      return result;
    } catch (error) {
      if (isAmbiguousCreateError(error)) {
        setCreatePhase('RECONCILING');
        openToast('VERIFICANDO ENVÍO', 'La conexión tardó en responder. Estamos verificando si Administración ya recibió la solicitud. No vuelvas a crearla.', 'warning');
        reconciliationController.current?.abort();
        reconciliationController.current = new AbortController();
        const reconciled = await pollOcReconciliation({ clientRequestId: pending.client_request_id,
          reconcile: solicitudesCompraService.reconciliarEnvio, signal: reconciliationController.current.signal });
        if (reconciled?.found) {
          clearPendingOcSubmission(); pendingSubmission.current = null; setCreatePhase('IDLE');
          openToast('SOLICITUD CONFIRMADA', `La solicitud #${reconciled.solicitud.id_solicitud_compra} ya había sido recibida por Administración. No se creó un duplicado.`, 'success');
          setFilterState('PENDIENTE'); setSearchState(''); setView('listado');
          await loadList({ page: 1, estado: 'PENDIENTE' });
          return reconciled;
        }
        setCreatePhase('AWAITING_RETRY');
        openToast('NO PUDIMOS CONFIRMAR TODAVÍA', 'Puedes reintentar el mismo envío de forma segura.', 'warning');
      } else {
        clearPendingOcSubmission(); pendingSubmission.current = null; setCreatePhase('IDLE');
        openToast('NO SE PUDO ENVIAR', mapSolicitudError(error), 'danger');
      }
      throw error;
    } finally { submitLock.current = false; }
  }, [loadList, openToast]);

  const invalidatePendingCreate = useCallback(() => {
    if (createPhase === 'SENDING' || createPhase === 'RECONCILING') return;
    clearPendingOcSubmission(); pendingSubmission.current = null; setCreatePhase('IDLE');
  }, [createPhase]);

  const retryPendingCreate = useCallback(async () => {
    const pending = pendingSubmission.current || loadPendingOcSubmission();
    if (!pending) return null;
    pendingSubmission.current = pending;
    return submit(pending.payload);
  }, [submit]);

  return {
    view, setView, listState, filter, setFilter, search, setSearch, clearSearch, loadList, openCreate, openDetail,
    detailState, warehouses, warehousesLoading, catalogState, loadCatalog, submit, createPhase,
    invalidatePendingCreate, retryPendingCreate
  };
}
