import { useCallback, useEffect, useRef, useState } from 'react';
import { solicitudesCompraService } from '../../../../services/solicitudesCompraService';
import { mapReceptionError } from '../utils/solicitudesCompraRecepcionUtils';

const rejectionError = (error) => {
  if (error?.status === 409 || error?.code === 'INVALID_STATE') return 'La captura cambió y ya no puede rechazarse.';
  if (error?.status === 403 || error?.code === 'FORBIDDEN') return 'No tienes permiso para gestionar esta captura.';
  return mapReceptionError(error);
};

export default function useCapturasCompraRapidaAdmin({ openToast }) {
  const [mode, setMode] = useState('list');
  const [filter, setFilter] = useState('PENDIENTE');
  const [search, setSearch] = useState('');
  const searchRef = useRef('');
  searchRef.current = search;
  const [list, setList] = useState({ items: [], pagination: {}, loading: true, error: '' });
  const [detail, setDetail] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const actionLock = useRef(false);

  const loadList = useCallback(async ({ page = 1, estado = filter, buscar = searchRef.current.trim().replace(/\s+/g, ' ') } = {}) => {
    setList((current) => ({ ...current, loading: true, error: '' }));
    try {
      const payload = await solicitudesCompraService.listQuickCaptures({ page, limit: 20, estado, buscar });
      setList({ items: Array.isArray(payload?.capturas) ? payload.capturas : [], pagination: payload?.pagination || {}, loading: false, error: '' });
    } catch (requestError) { setList((current) => ({ ...current, loading: false, error: mapReceptionError(requestError) })); }
  }, [filter]);

  useEffect(() => { void loadList({ page: 1 }); }, [loadList]);

  const openDetail = useCallback(async (id) => {
    setLoadingDetail(true); setError('');
    try {
      const [capturePayload, evidencePayload] = await Promise.all([solicitudesCompraService.getQuickCapture(id), solicitudesCompraService.listQuickCaptureEvidence(id)]);
      setDetail(capturePayload?.captura || null);
      setEvidence(Array.isArray(evidencePayload?.evidencias) ? evidencePayload.evidencias : []);
      setMode('detail');
    } catch (requestError) { setList((current) => ({ ...current, error: mapReceptionError(requestError) })); }
    finally { setLoadingDetail(false); }
  }, []);

  const changeFilter = useCallback((value) => { setFilter(value); }, []);
  const refreshDetail = useCallback(async () => {
    if (!detail?.id_captura_compra_rapida) return;
    const payload = await solicitudesCompraService.getQuickCapture(detail.id_captura_compra_rapida);
    setDetail(payload?.captura || null);
  }, [detail?.id_captura_compra_rapida]);

  const reject = useCallback(async () => {
    const normalized = reason.trim().replace(/\s+/g, ' ');
    if (actionLock.current || !detail || !normalized || normalized.length > 1000) return;
    actionLock.current = true; setBusy(true); setError('');
    try {
      await solicitudesCompraService.rejectQuickCapture(detail.id_captura_compra_rapida, normalized);
      setRejectOpen(false); setReason('');
      await Promise.all([refreshDetail(), loadList({ page: Number(list.pagination?.page || 1) })]);
      openToast('CAPTURA RECHAZADA', 'La captura fue rechazada correctamente.', 'success');
    } catch (requestError) {
      setError(rejectionError(requestError));
      if (requestError?.status === 409 || requestError?.code === 'INVALID_STATE') {
        setRejectOpen(false);
        await Promise.allSettled([refreshDetail(), loadList({ page: Number(list.pagination?.page || 1) })]);
      }
    } finally { actionLock.current = false; setBusy(false); }
  }, [detail, list.pagination?.page, loadList, openToast, reason, refreshDetail]);

  return { mode, setMode, filter, changeFilter, search, setSearch, list, loadList, detail, evidence, loadingDetail, error, rejectOpen, setRejectOpen, reason, setReason, busy, openDetail, reject };
}
