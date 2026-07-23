import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { solicitudesCompraService } from '../../../../services/solicitudesCompraService';
import {
  buildReceptionPayload,
  createReceptionDraft,
  getReceptionDifferences,
  getReceptionObservationError,
  mapReceptionError,
  readFileAsDataUrl,
  updateReceptionDraftLine,
  validateInvoiceBytes,
  validateInvoiceMetadata,
  validateReceptionDraft
} from '../utils/solicitudesCompraRecepcionUtils';

const EMPTY_INVOICE = { file: null, previewUrl: '', error: '', validating: false };

export default function useSolicitudCompraRecepcion({
  solicitud,
  detalles,
  canReceive,
  reloadDetail,
  reloadList,
  openToast
}) {
  const approved = String(solicitud?.estado || '').toUpperCase() === 'APROBADA';
  const [lines, setLines] = useState(() => createReceptionDraft(detalles));
  const [observation, setObservation] = useState('');
  const [invoice, setInvoice] = useState(EMPTY_INVOICE);
  const [confirmation, setConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const previewUrlRef = useRef('');
  const invoiceRequest = useRef(0);
  const receiveLock = useRef(false);

  const revokePreview = useCallback(() => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = '';
  }, []);

  useEffect(() => () => {
    invoiceRequest.current += 1;
    revokePreview();
  }, [revokePreview]);

  const validation = useMemo(() => validateReceptionDraft(lines), [lines]);
  const differences = useMemo(() => getReceptionDifferences(lines), [lines]);
  const observationError = getReceptionObservationError(observation, differences.length > 0);
  const controlsDisabled = busy || accessDenied || !approved;
  const receiveDisabled = controlsDisabled
    || !canReceive
    || !validation.valid
    || Boolean(observationError)
    || !invoice.file
    || Boolean(invoice.error)
    || invoice.validating;

  const updateLine = useCallback((id, cantidad) => {
    if (receiveLock.current) return;
    setLines((current) => updateReceptionDraftLine(current, id, cantidad));
  }, []);

  const selectInvoice = useCallback(async (file) => {
    if (receiveLock.current || !file) return;
    const requestId = ++invoiceRequest.current;
    const metadata = validateInvoiceMetadata(file);
    if (!metadata.valid) {
      setInvoice((current) => ({ ...current, error: metadata.error, validating: false }));
      return;
    }
    setInvoice((current) => ({ ...current, error: '', validating: true }));
    try {
      const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
      if (requestId !== invoiceRequest.current) return;
      const binaryValidation = validateInvoiceBytes(file, bytes);
      if (!binaryValidation.valid) {
        setInvoice((current) => ({ ...current, error: binaryValidation.error, validating: false }));
        return;
      }
      const previewUrl = URL.createObjectURL(file);
      revokePreview();
      previewUrlRef.current = previewUrl;
      setInvoice({ file, previewUrl, error: '', validating: false });
    } catch {
      if (requestId === invoiceRequest.current) {
        setInvoice((current) => ({ ...current, error: 'No fue posible validar la fotografía.', validating: false }));
      }
    }
  }, [revokePreview]);

  const removeInvoice = useCallback(() => {
    if (receiveLock.current) return;
    invoiceRequest.current += 1;
    revokePreview();
    setInvoice(EMPTY_INVOICE);
  }, [revokePreview]);

  const refreshInformation = useCallback(async () => {
    await Promise.all([reloadDetail?.(), reloadList?.()]);
  }, [reloadDetail, reloadList]);

  const startConfirmation = useCallback(() => {
    if (!receiveDisabled && !receiveLock.current) setConfirmation(true);
  }, [receiveDisabled]);

  const executeReception = useCallback(async () => {
    if (receiveLock.current || receiveDisabled || !approved || !canReceive) return;
    receiveLock.current = true;
    setBusy(true);
    try {
      const bytes = new Uint8Array(await invoice.file.slice(0, 12).arrayBuffer());
      const binaryValidation = validateInvoiceBytes(invoice.file, bytes);
      if (!binaryValidation.valid) throw new Error(binaryValidation.error);
      const dataUrl = await readFileAsDataUrl(invoice.file);
      const payload = buildReceptionPayload({
        observacion: observation,
        detalles: lines,
        factura: {
          nombre_original: invoice.file.name,
          mime_type: invoice.file.type,
          data_url: dataUrl
        }
      });
      await solicitudesCompraService.recibirSolicitud(solicitud.id_solicitud_compra, payload);
      openToast('RECEPCIÓN REGISTRADA', 'La recepción fue registrada y aplicada al inventario.', 'success');
      setLines([]);
      setObservation('');
      setConfirmation(false);
      revokePreview();
      setInvoice(EMPTY_INVOICE);
      await refreshInformation();
    } catch (error) {
      openToast('NO SE PUDO RECIBIR', mapReceptionError(error), 'danger');
      if (error?.status === 409) {
        setLines([]);
        setObservation('');
        setConfirmation(false);
        revokePreview();
        setInvoice(EMPTY_INVOICE);
        await refreshInformation();
      }
      if (error?.status === 403) {
        setAccessDenied(true);
        setConfirmation(false);
      }
    } finally {
      receiveLock.current = false;
      setBusy(false);
    }
  }, [approved, canReceive, invoice.file, lines, observation, openToast, receiveDisabled, refreshInformation, revokePreview, solicitud?.id_solicitud_compra]);

  return {
    lines,
    observation,
    setObservation,
    invoice,
    validation,
    differences,
    observationError,
    confirmation,
    setConfirmation,
    busy,
    controlsDisabled,
    receiveDisabled,
    accessDenied,
    updateLine,
    selectInvoice,
    removeInvoice,
    startConfirmation,
    executeReception
  };
}
