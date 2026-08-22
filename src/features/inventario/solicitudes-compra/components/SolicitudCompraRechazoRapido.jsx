import { useRef, useState } from 'react';
import { solicitudesCompraService } from '../../../../services/solicitudesCompraService';
import {
  buildRejectionPayload,
  getRevisionCommentError,
  mapRevisionError
} from '../utils/solicitudesCompraRevisionUtils';

const PRESETS = ['Solicitud duplicada', 'Creada por error', 'Ya no se requiere', 'Otro motivo'];

export default function SolicitudCompraRechazoRapido({ solicitud, onRefresh, openToast }) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const actionLock = useRef(false);
  const canReject = solicitud?.acciones?.puede_rechazar === true
    && String(solicitud?.estado || '').toUpperCase() === 'PENDIENTE';
  const commentError = getRevisionCommentError(comment, true);

  if (!canReject) return null;

  const close = () => {
    if (busy) return;
    setOpen(false);
    setComment('');
  };

  const confirm = async () => {
    if (actionLock.current || commentError) return;
    actionLock.current = true;
    setBusy(true);
    try {
      const payload = buildRejectionPayload(comment);
      await solicitudesCompraService.rechazarSolicitud(solicitud.id_solicitud_compra, payload);
      openToast('SOLICITUD RECHAZADA', 'La solicitud fue rechazada correctamente.', 'success');
      setOpen(false);
      setComment('');
      await onRefresh?.();
    } catch (error) {
      openToast('NO SE PUDO RECHAZAR', mapRevisionError(error, 'reject'), 'danger');
      if (error?.status === 409) {
        setOpen(false);
        setComment('');
        await onRefresh?.();
      }
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => setOpen(true)}>Rechazar</button>
      {open ? (
        <div className="sol-comp-confirm-modal-backdrop" role="presentation">
          <section className="sol-comp-confirm-modal" role="dialog" aria-modal="true" aria-labelledby={`quick-reject-${solicitud.id_solicitud_compra}`}>
            <header>
              <div>
                <strong id={`quick-reject-${solicitud.id_solicitud_compra}`}>Rechazar solicitud #{solicitud.id_solicitud_compra}</strong>
                <p>Esta acción marcará la solicitud como rechazada. La solicitud permanecerá en el historial.</p>
              </div>
            </header>
            <div className="sol-comp-quick-reject__body">
              <span className="sol-comp-field-label">Motivo del rechazo</span>
              <div className="sol-comp-quick-reject__presets">
                {PRESETS.map((preset) => <button type="button" className="btn btn-outline-secondary btn-sm" disabled={busy} key={preset} onClick={() => setComment(preset)}>{preset}</button>)}
              </div>
              <textarea value={comment} maxLength={1000} disabled={busy} onChange={(event) => setComment(event.target.value)} aria-describedby="quick-reject-error" />
              <small>{comment.length}/1000 caracteres</small>
              {commentError ? <p id="quick-reject-error" className="sol-comp-field-error">{commentError}</p> : null}
            </div>
            <footer className="sol-comp-confirm-modal__footer">
              <button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={close}>Volver</button>
              <button type="button" className="btn btn-danger" disabled={busy || Boolean(commentError)} onClick={confirm}>{busy ? 'Rechazando…' : 'Confirmar rechazo'}</button>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
