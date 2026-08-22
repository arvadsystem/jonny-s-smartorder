import { useCallback, useEffect, useRef, useState } from 'react';
import { solicitudesCompraService } from '../../../../services/solicitudesCompraService';
import {
  buildInvoiceUploadPayload,
  mapReceptionError,
  prevalidateInvoiceFiles,
  readFileAsDataUrl,
  uploadInvoiceFilesSequentially,
  validateInvoiceBatch
} from '../utils/solicitudesCompraRecepcionUtils';

export default function useCapturasCompraRapida({ openToast }) {
  const [mode, setMode] = useState('list');
  const [list, setList] = useState({ items: [], loading: true, error: '' });
  const [draft, setDraft] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const actionLock = useRef(false);
  const draftRef = useRef(null);

  const loadList = useCallback(async () => {
    setList((current) => ({ ...current, loading: true, error: '' }));
    try {
      const payload = await solicitudesCompraService.listQuickCaptures({ page: 1, limit: 50 });
      setList({ items: Array.isArray(payload?.capturas) ? payload.capturas : [], loading: false, error: '' });
    } catch (requestError) {
      setList({ items: [], loading: false, error: mapReceptionError(requestError) });
    }
  }, []);

  useEffect(() => { void loadList(); }, [loadList]);

  const loadCapture = useCallback(async (id) => {
    setBusy('loading'); setError('');
    try {
      const [capturePayload, evidencePayload] = await Promise.all([
        solicitudesCompraService.getQuickCapture(id),
        solicitudesCompraService.listQuickCaptureEvidence(id)
      ]);
      const next = capturePayload?.captura || null;
      setDraft(next); draftRef.current = next;
      setEvidence(Array.isArray(evidencePayload?.evidencias) ? evidencePayload.evidencias : []);
      setMode('edit');
    } catch (requestError) { setError(mapReceptionError(requestError)); }
    finally { setBusy(''); }
  }, []);

  const openNew = useCallback(() => {
    setDraft(null); draftRef.current = null; setEvidence([]); setError(''); setMode('edit');
  }, []);

  const addFiles = useCallback(async (fileList) => {
    if (actionLock.current || String(draftRef.current?.estado || 'BORRADOR') !== 'BORRADOR') return;
    const files = Array.from(fileList || []);
    const batch = validateInvoiceBatch(files, evidence.length);
    if (!batch.valid) { setError(batch.error); return; }
    try { await prevalidateInvoiceFiles(files); } catch (validationError) { setError(validationError.message); return; }
    actionLock.current = true; setBusy('upload'); setError('');
    try {
      let current = draftRef.current;
      if (!current) {
        const created = await solicitudesCompraService.createQuickCapture();
        current = created?.captura;
        setDraft(current); draftRef.current = current;
      }
      const result = await uploadInvoiceFilesSequentially(files, async (file) => {
        const dataUrl = await readFileAsDataUrl(file);
        await solicitudesCompraService.uploadQuickCaptureInvoice(current.id_captura_compra_rapida, buildInvoiceUploadPayload(file, dataUrl));
      });
      const refreshed = await solicitudesCompraService.listQuickCaptureEvidence(current.id_captura_compra_rapida);
      setEvidence(Array.isArray(refreshed?.evidencias) ? refreshed.evidencias : []);
      if (result.failures.length) setError(`${result.uploaded} imágenes guardadas. Falló: ${result.failures.map(({ file }) => file.name).join(', ')}.`);
      else openToast('FACTURAS GUARDADAS', `${result.uploaded} imagen(es) guardadas.`, 'success');
      await loadList();
    } catch (requestError) { setError(mapReceptionError(requestError)); }
    finally { actionLock.current = false; setBusy(''); }
  }, [evidence.length, loadList, openToast]);

  const removeEvidence = useCallback(async (idEvidence) => {
    if (actionLock.current || !draftRef.current) return;
    actionLock.current = true; setBusy('delete');
    try {
      await solicitudesCompraService.deleteQuickCaptureEvidence(draftRef.current.id_captura_compra_rapida, idEvidence);
      setEvidence((current) => current.filter((item) => item.id_evidencia !== idEvidence));
    } catch (requestError) { setError(mapReceptionError(requestError)); }
    finally { actionLock.current = false; setBusy(''); }
  }, []);

  const send = useCallback(async () => {
    if (actionLock.current || !draftRef.current || evidence.length < 1) return;
    actionLock.current = true; setBusy('send');
    try {
      const result = await solicitudesCompraService.sendQuickCapture(draftRef.current.id_captura_compra_rapida);
      const next = { ...draftRef.current, ...result?.captura };
      setDraft(next); draftRef.current = next;
      openToast('CAPTURA ENVIADA', 'Las facturas fueron enviadas a Administración correctamente.', 'success');
      await loadList();
    } catch (requestError) { setError(mapReceptionError(requestError)); }
    finally { actionLock.current = false; setBusy(''); }
  }, [evidence.length, loadList, openToast]);

  const discard = useCallback(async () => {
    if (actionLock.current || !draftRef.current) return;
    actionLock.current = true; setBusy('discard');
    try {
      await solicitudesCompraService.discardQuickCapture(draftRef.current.id_captura_compra_rapida);
      setDraft(null); draftRef.current = null; setEvidence([]); setMode('list'); await loadList();
    } catch (requestError) { setError(mapReceptionError(requestError)); }
    finally { actionLock.current = false; setBusy(''); }
  }, [loadList]);

  return { mode, setMode, list, draft, evidence, busy, error, openNew, loadCapture, addFiles, removeEvidence, send, discard };
}
