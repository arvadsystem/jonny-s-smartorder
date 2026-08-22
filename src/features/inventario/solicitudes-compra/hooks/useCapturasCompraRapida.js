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
  const [temporaryEvidence, setTemporaryEvidence] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({ total: 0, completed: 0, currentFile: '' });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const actionLock = useRef(false);
  const draftRef = useRef(null);
  const temporaryRef = useRef([]);

  const replaceTemporary = useCallback((next) => {
    temporaryRef.current = next;
    setTemporaryEvidence(next);
  }, []);

  const revokeTemporary = useCallback((items = temporaryRef.current) => {
    items.forEach((item) => { if (item.previewUrl) URL.revokeObjectURL(item.previewUrl); });
  }, []);

  useEffect(() => () => revokeTemporary(), [revokeTemporary]);

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
    setList((current) => ({ ...current, error: '' }));
    try {
      const [capturePayload, evidencePayload] = await Promise.all([
        solicitudesCompraService.getQuickCapture(id),
        solicitudesCompraService.listQuickCaptureEvidence(id)
      ]);
      const next = capturePayload?.captura || null;
      setDraft(next); draftRef.current = next;
      revokeTemporary(); replaceTemporary([]);
      setEvidence(Array.isArray(evidencePayload?.evidencias) ? evidencePayload.evidencias : []);
      setMode('edit');
    } catch (requestError) {
      const message = mapReceptionError(requestError);
      setList((current) => ({ ...current, error: message }));
    }
    finally { setBusy(''); }
  }, [replaceTemporary, revokeTemporary]);

  const openNew = useCallback(() => {
    revokeTemporary(); replaceTemporary([]);
    setDraft(null); draftRef.current = null; setEvidence([]); setError(''); setMode('edit');
  }, [replaceTemporary, revokeTemporary]);

  const addFiles = useCallback(async (selectedFiles) => {
    if (actionLock.current || String(draftRef.current?.estado || 'BORRADOR') !== 'BORRADOR') return;
    const files = Array.from(selectedFiles || []);
    const batch = validateInvoiceBatch(files, evidence.length + temporaryRef.current.length);
    if (!batch.valid) { setError(batch.error); return; }
    const previews = files.map((file, index) => ({
      id_temporal: `${Date.now()}-${index}-${file.name}`,
      file,
      nombre_original: file.name,
      tamano_bytes: file.size,
      previewUrl: URL.createObjectURL(file),
      estado: 'PENDIENTE'
    }));
    replaceTemporary([...temporaryRef.current, ...previews]);
    setUploadProgress({ total: files.length, completed: 0, currentFile: '' });
    try { await prevalidateInvoiceFiles(files); } catch (validationError) {
      replaceTemporary(temporaryRef.current.map((item) => files.includes(item.file) ? { ...item, estado: 'ERROR' } : item));
      setError(validationError.message); return;
    }
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
      }, ({ phase, file, completed, total }) => {
        setUploadProgress({ total, completed, currentFile: file.name });
        replaceTemporary(temporaryRef.current.map((item) => item.file === file ? { ...item, estado: phase === 'uploading' ? 'SUBIENDO' : phase === 'saved' ? 'GUARDADA' : 'ERROR' } : item));
      });
      const refreshed = await solicitudesCompraService.listQuickCaptureEvidence(current.id_captura_compra_rapida);
      setEvidence(Array.isArray(refreshed?.evidencias) ? refreshed.evidencias : []);
      const failedFiles = new Set(result.failures.map(({ file }) => file));
      const completedPreviews = temporaryRef.current.filter((item) => files.includes(item.file) && !failedFiles.has(item.file));
      revokeTemporary(completedPreviews);
      replaceTemporary(temporaryRef.current.filter((item) => !completedPreviews.includes(item)));
      if (result.failures.length) setError(`${result.uploaded} imágenes guardadas. Falló: ${result.failures.map(({ file }) => file.name).join(', ')}.`);
      else openToast('FACTURAS GUARDADAS', `${result.uploaded} imagen(es) guardadas.`, 'success');
      await loadList();
    } catch (requestError) {
      replaceTemporary(temporaryRef.current.map((item) => files.includes(item.file) ? { ...item, estado: 'ERROR' } : item));
      setError(mapReceptionError(requestError));
    }
    finally { actionLock.current = false; setBusy(''); setUploadProgress((currentProgress) => ({ ...currentProgress, currentFile: '' })); }
  }, [evidence.length, loadList, openToast, replaceTemporary, revokeTemporary]);

  const removeTemporaryEvidence = useCallback((idTemporary) => {
    if (actionLock.current) return;
    const removed = temporaryRef.current.find((item) => item.id_temporal === idTemporary);
    if (removed) revokeTemporary([removed]);
    replaceTemporary(temporaryRef.current.filter((item) => item.id_temporal !== idTemporary));
  }, [replaceTemporary, revokeTemporary]);

  const removeEvidence = useCallback(async (idEvidence) => {
    if (actionLock.current || !draftRef.current) return;
    actionLock.current = true; setBusy('delete'); setError('');
    try {
      await solicitudesCompraService.deleteQuickCaptureEvidence(draftRef.current.id_captura_compra_rapida, idEvidence);
      const refreshed = await solicitudesCompraService.listQuickCaptureEvidence(draftRef.current.id_captura_compra_rapida);
      setEvidence(Array.isArray(refreshed?.evidencias) ? refreshed.evidencias : []);
      await loadList();
    } catch (requestError) { setError(mapReceptionError(requestError)); }
    finally { actionLock.current = false; setBusy(''); }
  }, [loadList]);

  const send = useCallback(async () => {
    if (actionLock.current || !draftRef.current || evidence.length < 1) return;
    actionLock.current = true; setBusy('send'); setError('');
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
    actionLock.current = true; setBusy('discard'); setError('');
    try {
      await solicitudesCompraService.discardQuickCapture(draftRef.current.id_captura_compra_rapida);
      revokeTemporary(); replaceTemporary([]);
      setDraft(null); draftRef.current = null; setEvidence([]); setMode('list'); await loadList();
    } catch (requestError) { setError(mapReceptionError(requestError)); }
    finally { actionLock.current = false; setBusy(''); }
  }, [loadList, replaceTemporary, revokeTemporary]);

  return { mode, setMode, list, draft, evidence, temporaryEvidence, uploadProgress, busy, error, openNew, loadCapture, addFiles, removeTemporaryEvidence, removeEvidence, send, discard };
}
