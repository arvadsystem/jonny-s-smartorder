import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { solicitudesCompraService } from '../../../../services/solicitudesCompraService';
import {
  buildInvoiceUploadPayload, buildReceptionPayload, createReceptionDraft, getReceptionDifferences,
  getReceptionObservationError, mapReceptionError, prevalidateInvoiceFiles, readFileAsDataUrl,
  receiveWithReconciliation, updateReceptionDraftLine, uploadInvoiceFilesSequentially,
  uploadInvoiceWithReconciliation,
  validateInvoiceBatch, validateReceptionDraft
} from '../utils/solicitudesCompraRecepcionUtils';

const EMPTY_EVIDENCE = { items: [], loading: false, error: '' };
const normalizeEvidence = (item) => ({ ...item, url_firmada: /^https?:\/\//i.test(String(item?.url_firmada || '')) ? item.url_firmada : '' });

export default function useSolicitudCompraRecepcion({ solicitud, detalles, canReceive, reloadDetail, reloadList, openToast }) {
  const approved = String(solicitud?.estado || '').toUpperCase() === 'APROBADA';
  const idSolicitud = solicitud?.id_solicitud_compra;
  const [lines, setLines] = useState(() => createReceptionDraft(detalles));
  const [observation, setObservation] = useState('');
  const [evidence, setEvidence] = useState(EMPTY_EVIDENCE);
  const [evidenceBusy, setEvidenceBusy] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const [removeAllConfirmation, setRemoveAllConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const requestSequence = useRef(0);
  const receiveLock = useRef(false);
  const receptionRequestId = useRef(null);
  const uploadRequestIds = useRef(new WeakMap());

  const loadEvidence = useCallback(async () => {
    if (!idSolicitud) return;
    const requestId = ++requestSequence.current;
    setEvidence((current) => ({ ...current, loading: true, error: '' }));
    try {
      const payload = await solicitudesCompraService.getEvidencias(idSolicitud);
      if (requestId !== requestSequence.current) return;
      setEvidence({ items: (Array.isArray(payload?.evidencias) ? payload.evidencias : []).map(normalizeEvidence), loading: false, error: '' });
    } catch (error) {
      if (requestId === requestSequence.current) setEvidence((current) => ({ ...current, loading: false, error: mapReceptionError(error) }));
    }
  }, [idSolicitud]);

  useEffect(() => {
    if (approved) void loadEvidence();
    return () => { requestSequence.current += 1; };
  }, [approved, loadEvidence]);

  const validation = useMemo(() => validateReceptionDraft(lines), [lines]);
  const differences = useMemo(() => getReceptionDifferences(lines), [lines]);
  const observationError = getReceptionObservationError(observation, differences.length > 0);
  const controlsDisabled = busy || evidenceBusy || accessDenied || !approved;
  const receiveDisabled = controlsDisabled || evidence.loading || !canReceive || !validation.valid || Boolean(observationError) || evidence.items.length < 1;
  const updateLine = useCallback((id, cantidad) => {
    if (!receiveLock.current) setLines((current) => updateReceptionDraftLine(current, id, cantidad));
  }, []);

  const selectInvoices = useCallback(async (files) => {
    if (receiveLock.current || evidenceBusy) return;
    const selected = Array.from(files || []);
    const batchValidation = validateInvoiceBatch(selected, evidence.items.length);
    if (!batchValidation.valid) { setEvidence((current) => ({ ...current, error: batchValidation.error })); return; }
    setEvidenceBusy(true);
    setEvidence((current) => ({ ...current, error: '' }));
    try {
      await prevalidateInvoiceFiles(selected);
    } catch (error) {
      setEvidence((current) => ({ ...current, error: error.message }));
      setEvidenceBusy(false);
      return;
    }
    let result;
    try {
      result = await uploadInvoiceFilesSequentially(selected, async (file) => {
          const dataUrl = await readFileAsDataUrl(file);
          let uploadRequestId = uploadRequestIds.current.get(file);
          if (!uploadRequestId) {
            uploadRequestId = crypto.randomUUID();
            uploadRequestIds.current.set(file, uploadRequestId);
          }
          const factura = buildInvoiceUploadPayload(file, dataUrl);
          const uploadResult = await uploadInvoiceWithReconciliation({
            idSolicitud, factura, uploadRequestId,
            uploadRequest: solicitudesCompraService.subirFactura,
            reconcile: solicitudesCompraService.reconciliarFactura,
            onTimeout: () => openToast('CONFIRMANDO CARGA', 'Confirmando resultado de la factura…', 'info')
          });
          if (!uploadResult.confirmed) {
            const retry = await uploadInvoiceWithReconciliation({
              idSolicitud, factura, uploadRequestId,
              uploadRequest: solicitudesCompraService.subirFactura,
              reconcile: solicitudesCompraService.reconciliarFactura
            });
            if (!retry.confirmed) throw Object.assign(new Error('La carga todavía no fue confirmada. Intenta nuevamente.'), { code: 'REQUEST_TIMEOUT' });
          }
      });
    } finally {
      await loadEvidence();
      setEvidenceBusy(false);
    }
    const failureMessages = result.failures.map(({ file, error }) => `${file.name}: ${mapReceptionError(error)}`);
    if (failureMessages.length) openToast('CARGA PARCIAL', `${result.uploaded} imagen(es) guardadas. ${failureMessages.length} no se pudieron guardar. ${failureMessages.join(' ')}`, 'warning');
    else openToast('FACTURAS GUARDADAS', `${result.uploaded} imagen(es) de factura guardadas.`, 'success');
  }, [evidence.items.length, evidenceBusy, idSolicitud, loadEvidence, openToast]);

  const removeEvidence = useCallback(async (idEvidencia) => {
    if (receiveLock.current || evidenceBusy) return;
    setEvidenceBusy(true);
    try {
      await solicitudesCompraService.eliminarEvidencia(idSolicitud, idEvidencia);
      openToast('IMAGEN ELIMINADA', 'La imagen de factura fue eliminada.', 'success');
    } catch (error) { openToast('NO SE PUDO ELIMINAR', mapReceptionError(error), 'danger'); }
    finally {
      await loadEvidence();
      setEvidenceBusy(false);
    }
  }, [evidenceBusy, idSolicitud, loadEvidence, openToast]);

  const removeAllEvidence = useCallback(async () => {
    if (receiveLock.current || evidenceBusy) return;
    setEvidenceBusy(true);
    let failed = 0;
    try {
      for (const item of evidence.items) {
        try { await solicitudesCompraService.eliminarEvidencia(idSolicitud, item.id_evidencia); } catch { failed += 1; }
      }
    } finally {
      await loadEvidence();
      setEvidenceBusy(false); setRemoveAllConfirmation(false);
    }
    openToast(failed ? 'ELIMINACIÓN PARCIAL' : 'IMÁGENES ELIMINADAS', failed ? `${failed} imagen(es) no se pudieron eliminar.` : 'Todas las imágenes de factura fueron eliminadas.', failed ? 'warning' : 'success');
  }, [evidence.items, evidenceBusy, idSolicitud, loadEvidence, openToast]);

  const refreshInformation = useCallback(async () => { await Promise.all([reloadDetail?.(), reloadList?.()]); }, [reloadDetail, reloadList]);
  const startConfirmation = useCallback(() => {
    if (receiveDisabled || receiveLock.current) return;
    if (!receptionRequestId.current) receptionRequestId.current = crypto.randomUUID();
    setConfirmation(true);
  }, [receiveDisabled]);
  const executeReception = useCallback(async () => {
    if (receiveLock.current || receiveDisabled || !approved || !canReceive) return;
    receiveLock.current = true; setBusy(true);
    try {
      if (!receptionRequestId.current) receptionRequestId.current = crypto.randomUUID();
      const payload = buildReceptionPayload({ observacion: observation, detalles: lines, receptionRequestId: receptionRequestId.current });
      const result = await receiveWithReconciliation({
        idSolicitud, payload,
        receive: solicitudesCompraService.recibirSolicitud,
        reconcile: solicitudesCompraService.reconciliarRecepcion,
        onTimeout: () => openToast('CONFIRMANDO RECEPCIÓN', 'Confirmando resultado de la recepción…', 'info')
      });
      if (!result.confirmed) {
        openToast('RECEPCIÓN PENDIENTE', 'El servidor todavía no confirma la recepción. Puedes reintentar con el mismo identificador.', 'warning');
        return;
      }
      openToast('RECEPCIÓN REGISTRADA', 'La recepción fue registrada y aplicada al inventario.', 'success');
      receptionRequestId.current = null;
      setLines([]); setObservation(''); setConfirmation(false); await refreshInformation();
    } catch (error) {
      openToast('NO SE PUDO RECIBIR', mapReceptionError(error), 'danger');
      if (String(error?.code || '').toUpperCase() !== 'REQUEST_TIMEOUT') receptionRequestId.current = null;
      if (error?.status === 409) { setConfirmation(false); await Promise.all([loadEvidence(), refreshInformation()]); }
      if (error?.status === 403) { setAccessDenied(true); setConfirmation(false); }
    } finally { receiveLock.current = false; setBusy(false); }
  }, [approved, canReceive, idSolicitud, lines, loadEvidence, observation, openToast, receiveDisabled, refreshInformation]);

  return {
    lines, observation, setObservation, evidence, evidenceBusy, validation, differences, observationError,
    confirmation, setConfirmation, removeAllConfirmation, setRemoveAllConfirmation, busy, controlsDisabled,
    receiveDisabled, accessDenied, updateLine, selectInvoices, removeEvidence, removeAllEvidence,
    loadEvidence, startConfirmation, executeReception
  };
}
