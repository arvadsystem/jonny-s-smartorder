import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { solicitudesCompraService } from '../../../../services/solicitudesCompraService';
import {
  buildApprovalPayload,
  buildRejectionPayload,
  createAdministrativeApprovalLine,
  createApprovalDraft,
  administrativeLineKey,
  getRevisionCommentError,
  mapRevisionError,
  updateApprovalDraftLine,
  validateApprovalDraft
} from '../utils/solicitudesCompraRevisionUtils';
import { applyProviderToLines } from '../utils/solicitudesCompraProviderUtils';
import { createCatalogRequestCoordinator, createEmptyCatalogState, mapSolicitudError } from '../utils/solicitudesCompraUtils';

const EMPTY_PROVIDERS = { items: [], loading: false, error: '', loaded: false };

export default function useSolicitudCompraRevision({
  solicitud,
  detalles,
  canApprove,
  canReject,
  reloadDetail,
  reloadList,
  openToast
}) {
  const pending = String(solicitud?.estado || '').toUpperCase() === 'PENDIENTE';
  const [lines, setLines] = useState(() => createApprovalDraft(detalles));
  const [comment, setComment] = useState('');
  const [providers, setProviders] = useState(() => (
    pending && canApprove ? { ...EMPTY_PROVIDERS, loading: true } : EMPTY_PROVIDERS
  ));
  const [confirmation, setConfirmation] = useState(null);
  const [busyAction, setBusyAction] = useState('');
  const [accessDenied, setAccessDenied] = useState(false);
  const [catalogState, setCatalogState] = useState(() => createEmptyCatalogState());
  const [catalogFeedback, setCatalogFeedback] = useState('');
  const providerRequest = useRef(0);
  const catalogRequest = useRef(createCatalogRequestCoordinator());
  const actionLock = useRef(false);

  const loadProviders = useCallback(async () => {
    if (!pending || !canApprove) return;
    const requestId = ++providerRequest.current;
    setProviders({ items: [], loading: true, error: '', loaded: false });
    try {
      const payload = await solicitudesCompraService.getProveedores({ page: 1, limit: 100 });
      if (requestId !== providerRequest.current) return;
      setProviders({
        items: Array.isArray(payload?.proveedores) ? payload.proveedores : [],
        loading: false, error: '', loaded: true
      });
    } catch (error) {
      if (requestId !== providerRequest.current) return;
      setProviders({ items: [], loading: false, error: mapRevisionError(error), loaded: true });
    }
  }, [canApprove, pending]);

  useEffect(() => {
    if (pending && canApprove) void loadProviders();
    return () => { providerRequest.current += 1; };
  }, [canApprove, loadProviders, pending]);

  const validation = useMemo(() => validateApprovalDraft(lines), [lines]);
  const approvalCommentError = getRevisionCommentError(comment);
  const rejectionCommentError = getRevisionCommentError(comment, true);
  const providerUnavailable = providers.loading || Boolean(providers.error) || (providers.loaded && providers.items.length === 0);
  const controlsDisabled = Boolean(busyAction) || accessDenied || !pending;
  const approveDisabled = controlsDisabled || !canApprove || !validation.valid || providerUnavailable || Boolean(approvalCommentError);
  const rejectDisabled = controlsDisabled || !canReject || Boolean(rejectionCommentError);

  const updateLine = useCallback((id, patch) => {
    setLines((current) => updateApprovalDraftLine(current, id, patch));
  }, []);
  const applyProviderToAll = useCallback((providerId) => setLines((current) => applyProviderToLines(current, providerId, 'all')), []);
  const fillMissingProviders = useCallback((providerId) => setLines((current) => applyProviderToLines(current, providerId, 'missing')), []);
  const loadCatalog = useCallback(async (options) => {
    const warehouseId = String(solicitud?.almacen?.id_almacen || '');
    const token = catalogRequest.current.begin(warehouseId);
    setCatalogState(createEmptyCatalogState(warehouseId, true));
    try {
      const payload = await solicitudesCompraService.getCatalogo({ ...options, id_almacen: warehouseId, limit: 12 });
      if (!catalogRequest.current.isCurrent(token, warehouseId)) return;
      setCatalogState({ items: payload?.items || [], pagination: payload?.pagination || {}, loading: false, error: '', requestedWarehouseId: warehouseId });
    } catch (error) {
      if (catalogRequest.current.isCurrent(token, warehouseId)) setCatalogState({ ...createEmptyCatalogState(warehouseId), error: mapSolicitudError(error) });
    }
  }, [solicitud?.almacen?.id_almacen]);
  const addAdministrativeLine = useCallback((line) => {
    const candidate = createAdministrativeApprovalLine(line);
    setLines((current) => {
      const duplicate = current.some((existing) => administrativeLineKey(existing) === administrativeLineKey(candidate));
      if (duplicate) { setCatalogFeedback('Este artículo ya está en la solicitud. Ajusta su cantidad aprobada en la línea existente.'); return current; }
      setCatalogFeedback('Artículo agregado a la revisión. Se guardará al aprobar la solicitud.');
      return [...current, candidate];
    });
  }, []);
  const removeAdministrativeLine = useCallback((lineKey) => setLines((current) => current.filter((line) => line.id_solicitud_detalle || line._line_key !== lineKey)), []);

  const refreshInformation = useCallback(async () => {
    await Promise.all([reloadDetail?.(), reloadList?.()]);
  }, [reloadDetail, reloadList]);

  const execute = useCallback(async (action) => {
    if (actionLock.current || !pending || accessDenied) return;
    if (action === 'approve' && (!canApprove || approveDisabled)) return;
    if (action === 'reject' && (!canReject || rejectDisabled)) return;
    actionLock.current = true;
    setBusyAction(action);
    try {
      if (action === 'approve') {
        const payload = buildApprovalPayload({ comentario: comment, detalles: lines });
        await solicitudesCompraService.aprobarSolicitud(solicitud.id_solicitud_compra, payload);
        openToast('SOLICITUD APROBADA', 'La solicitud fue aprobada correctamente.', 'success');
      } else {
        const payload = buildRejectionPayload(comment);
        await solicitudesCompraService.rechazarSolicitud(solicitud.id_solicitud_compra, payload);
        openToast('SOLICITUD RECHAZADA', 'La solicitud fue rechazada correctamente.', 'success');
      }
      setLines([]);
      setComment('');
      setConfirmation(null);
      await refreshInformation();
    } catch (error) {
      const message = mapRevisionError(error);
      openToast('NO SE PUDO COMPLETAR', message, 'danger');
      if (error?.status === 409) {
        setLines([]);
        setConfirmation(null);
        await refreshInformation();
      }
      if (error?.status === 403) {
        setAccessDenied(true);
        setConfirmation(null);
      }
    } finally {
      actionLock.current = false;
      setBusyAction('');
    }
  }, [accessDenied, approveDisabled, canApprove, canReject, comment, lines, openToast, pending, refreshInformation, rejectDisabled, solicitud?.id_solicitud_compra]);

  return {
    lines,
    comment,
    setComment,
    providers,
    retryProviders: loadProviders,
    validation,
    confirmation,
    setConfirmation,
    busyAction,
    controlsDisabled,
    approveDisabled,
    rejectDisabled,
    rejectionCommentError,
    approvalCommentError,
    accessDenied,
    updateLine,
    catalogState,
    catalogFeedback,
    loadCatalog,
    addAdministrativeLine,
    removeAdministrativeLine,
    applyProviderToAll,
    fillMissingProviders,
    execute
  };
}
