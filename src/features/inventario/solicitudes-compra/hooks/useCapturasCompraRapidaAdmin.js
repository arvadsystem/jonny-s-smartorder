import { useCallback, useEffect, useRef, useState } from 'react';
import { solicitudesCompraService } from '../../../../services/solicitudesCompraService';
import { mapReceptionError } from '../utils/solicitudesCompraRecepcionUtils';
import { createCatalogRequestCoordinator, createEmptyCatalogState, mapSolicitudError, parseRequestedQuantity, upsertDraftLine } from '../utils/solicitudesCompraUtils';

const actionError = (error, action) => {
  if (error?.code === 'INVALID_STATE' || (error?.status === 409 && !error?.code)) return action === 'formalize'
    ? 'La captura cambió y ya no puede formalizarse.'
    : 'La captura cambió y ya no puede rechazarse.';
  if (error?.status === 403 || error?.code === 'FORBIDDEN') return action === 'formalize'
    ? 'No tienes permiso para formalizar esta captura.'
    : 'No tienes permiso para gestionar esta captura.';
  return mapReceptionError(error);
};

export default function useCapturasCompraRapidaAdmin({ openToast }) {
  const [mode, setMode] = useState('list');
  const [filter, setFilter] = useState('PENDIENTE');
  const [search, setSearch] = useState('');
  const searchRef = useRef(''); searchRef.current = search;
  const [list, setList] = useState({ items: [], pagination: {}, loading: true, error: '' });
  const [detail, setDetail] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState([]);
  const [providers, setProviders] = useState([]);
  const [catalogState, setCatalogState] = useState(() => createEmptyCatalogState());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const actionLock = useRef(false);
  const catalogRequest = useRef(createCatalogRequestCoordinator());
  const searchDebounce = useRef(null);

  const loadList = useCallback(async ({ page = 1, estado = filter, buscar = searchRef.current.trim().replace(/\s+/g, ' ') } = {}) => {
    setList((current) => ({ ...current, loading: true, error: '' }));
    try {
      const payload = await solicitudesCompraService.listQuickCaptures({ page, limit: 20, estado, buscar });
      setList({ items: Array.isArray(payload?.capturas) ? payload.capturas : [], pagination: payload?.pagination || {}, loading: false, error: '' });
    } catch (requestError) { setList((current) => ({ ...current, loading: false, error: mapReceptionError(requestError) })); }
  }, [filter]);
  useEffect(() => { void loadList({ page: 1 }); }, [loadList]);
  useEffect(() => () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); }, []);

  const changeSearch = useCallback((value) => {
    setSearch(value);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => void loadList({ page: 1, estado: filter, buscar: value.trim().replace(/\s+/g, ' ') }), 300);
  }, [filter, loadList]);
  const submitSearch = useCallback((value = searchRef.current) => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    void loadList({ page: 1, estado: filter, buscar: value.trim().replace(/\s+/g, ' ') });
  }, [filter, loadList]);

  const openDetail = useCallback(async (id) => {
    setLoadingDetail(true); setError('');
    try {
      const [capturePayload, evidencePayload] = await Promise.all([solicitudesCompraService.getQuickCapture(id), solicitudesCompraService.listQuickCaptureEvidence(id)]);
      setDetail(capturePayload?.captura || null); setEvidence(Array.isArray(evidencePayload?.evidencias) ? evidencePayload.evidencias : []); setMode('detail');
    } catch (requestError) { setList((current) => ({ ...current, error: mapReceptionError(requestError) })); }
    finally { setLoadingDetail(false); }
  }, []);
  const changeFilter = useCallback((value) => { if (searchDebounce.current) clearTimeout(searchDebounce.current); setFilter(value); }, []);
  const refreshDetail = useCallback(async () => {
    if (!detail?.id_captura_compra_rapida) return null;
    const payload = await solicitudesCompraService.getQuickCapture(detail.id_captura_compra_rapida);
    setDetail(payload?.captura || null); return payload?.captura || null;
  }, [detail?.id_captura_compra_rapida]);

  const reject = useCallback(async () => {
    const normalized = reason.trim().replace(/\s+/g, ' ');
    if (actionLock.current || !detail || !normalized || normalized.length > 1000) return;
    actionLock.current = true; setBusy(true); setError('');
    try {
      await solicitudesCompraService.rejectQuickCapture(detail.id_captura_compra_rapida, normalized);
      setRejectOpen(false); setReason(''); await Promise.all([refreshDetail(), loadList({ page: Number(list.pagination?.page || 1) })]);
      openToast('CAPTURA RECHAZADA', 'La captura fue rechazada correctamente.', 'success');
    } catch (requestError) {
      setError(actionError(requestError, 'reject'));
      if (requestError?.status === 409 || requestError?.code === 'INVALID_STATE') { setRejectOpen(false); await Promise.allSettled([refreshDetail(), loadList({ page: Number(list.pagination?.page || 1) })]); }
    } finally { actionLock.current = false; setBusy(false); }
  }, [detail, list.pagination?.page, loadList, openToast, reason, refreshDetail]);

  const loadCatalog = useCallback(async (options) => {
    const warehouseId = String(options?.id_almacen ?? ''); const token = catalogRequest.current.begin(warehouseId);
    setCatalogState(createEmptyCatalogState(warehouseId, true));
    try {
      const payload = await solicitudesCompraService.getCatalogo({ ...options, limit: 12 });
      if (!catalogRequest.current.isCurrent(token, warehouseId)) return;
      setCatalogState({ items: payload?.items || payload?.catalogo || [], pagination: payload?.pagination || {}, loading: false, error: '', requestedWarehouseId: warehouseId });
    } catch (requestError) { if (catalogRequest.current.isCurrent(token, warehouseId)) setCatalogState({ ...createEmptyCatalogState(warehouseId), error: mapSolicitudError(requestError) }); }
  }, []);
  const startFormalization = useCallback(async () => {
    if (!detail?.acciones?.puede_formalizar) return;
    setBusy(true); setError('');
    try { const payload = await solicitudesCompraService.getQuickCaptureProviders(); setProviders(Array.isArray(payload?.proveedores) ? payload.proveedores : []); setLines([]); setMode('formalize'); }
    catch (requestError) { setError(actionError(requestError, 'formalize')); }
    finally { setBusy(false); }
  }, [detail]);
  const addLine = useCallback((line) => setLines((current) => upsertDraftLine(current, { ...line, id_proveedor: '' }).lines), []);
  const updateLine = useCallback((index, patch) => setLines((current) => current.map((line, currentIndex) => currentIndex === index ? { ...line, ...patch } : line)), []);
  const removeLine = useCallback((index) => setLines((current) => current.filter((_, currentIndex) => currentIndex !== index)), []);
  const validLines = lines.length > 0 && lines.every((line) => parseRequestedQuantity(line.cantidad, line.tipo_item) && Number(line.id_proveedor) > 0);
  const formalize = useCallback(async () => {
    if (actionLock.current || !detail || !validLines) return null;
    actionLock.current = true; setBusy(true); setError('');
    try {
      const payload = { detalles: lines.map((line) => ({ tipo_item: line.tipo_item, id_item: Number(line.id_item), ...(line.id_presentacion_insumo ? { id_presentacion_insumo: Number(line.id_presentacion_insumo) } : {}), cantidad: parseRequestedQuantity(line.cantidad, line.tipo_item), id_proveedor: Number(line.id_proveedor) })) };
      const result = await solicitudesCompraService.formalizeQuickCapture(detail.id_captura_compra_rapida, payload);
      setConfirmOpen(false); setLines([]); setMode('detail'); await Promise.all([refreshDetail(), loadList({ page: Number(list.pagination?.page || 1) })]);
      openToast('COMPRA FORMALIZADA', 'La orden de compra se creó y el inventario fue actualizado correctamente.', 'success'); return result;
    } catch (requestError) {
      setError(actionError(requestError, 'formalize'));
      if (requestError?.status === 409 || requestError?.code === 'INVALID_STATE') { setConfirmOpen(false); setMode('detail'); await Promise.allSettled([refreshDetail(), loadList({ page: Number(list.pagination?.page || 1) })]); }
      return null;
    } finally { actionLock.current = false; setBusy(false); }
  }, [detail, lines, list.pagination?.page, loadList, openToast, refreshDetail, validLines]);

  return { mode, setMode, filter, changeFilter, search, setSearch: changeSearch, submitSearch, list, loadList, detail, evidence, loadingDetail, error, rejectOpen, setRejectOpen, reason, setReason, busy, openDetail, reject, catalogState, loadCatalog, lines, providers, startFormalization, addLine, updateLine, removeLine, validLines, confirmOpen, setConfirmOpen, formalize };
}
