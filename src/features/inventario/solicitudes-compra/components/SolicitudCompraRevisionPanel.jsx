import { useMemo } from 'react';
import useSolicitudCompraRevision from '../hooks/useSolicitudCompraRevision';
import SolicitudCompraRevisionLinea from './SolicitudCompraRevisionLinea';

export default function SolicitudCompraRevisionPanel({ solicitud, detalles, canApprove, canReject, reloadDetail, reloadList, openToast }) {
  const review = useSolicitudCompraRevision({ solicitud, detalles, canApprove, canReject, reloadDetail, reloadList, openToast });
  const providerOptions = useMemo(() => review.providers.items.map((provider) => ({
    value: String(provider.id_proveedor),
    label: provider.nombre_proveedor
  })), [review.providers.items]);
  const contractErrors = review.validation.general;
  const visibleCommentError = review.approvalCommentError || (review.confirmation === 'reject' ? review.rejectionCommentError : '');

  return (
    <section className="sol-comp-review-panel" aria-labelledby="sol-comp-review-title">
      <header>
        <div className="sol-comp-workflow-heading">
          <span aria-hidden="true"><i className="bi bi-shield-check" /></span>
          <div><h3 id="sol-comp-review-title">Revisión administrativa</h3><p>Revisa todas las líneas antes de aprobar o registra el motivo del rechazo.</p></div>
        </div>
        <span className="sol-comp-workflow-badge"><i className="bi bi-hourglass-split" aria-hidden="true" /> Acción pendiente</span>
      </header>

      {canApprove ? (
        <div className="sol-comp-provider-status" aria-live="polite">
          {review.providers.loading ? <span><i className="bi bi-arrow-repeat" aria-hidden="true" /> Cargando proveedores…</span> : null}
          {review.providers.error ? <span className="sol-comp-field-error"><i className="bi bi-exclamation-circle" aria-hidden="true" /> {review.providers.error} <button type="button" className="btn btn-link btn-sm" onClick={review.retryProviders}>Reintentar</button></span> : null}
          {review.providers.loaded && !review.providers.error && review.providers.items.length === 0 ? <span className="sol-comp-field-error"><i className="bi bi-exclamation-triangle" aria-hidden="true" /> No hay proveedores disponibles. La aprobación está bloqueada.</span> : null}
          {review.providers.loaded && review.providers.items.length > 0 ? <span className="sol-comp-provider-status__available"><i className="bi bi-truck" aria-hidden="true" /> {review.providers.items.length} proveedores disponibles.</span> : null}
        </div>
      ) : null}

      {contractErrors.length ? (
        <div className="sol-comp-contract-error" role="alert">
          <strong>No se puede aprobar por un error en el contrato del detalle.</strong>
          <p>{contractErrors.join(' ')}</p>
        </div>
      ) : null}

      <div className="sol-comp-review-lines">
        {review.lines.filter((line) => line.id_solicitud_detalle).map((line) => (
          <SolicitudCompraRevisionLinea
            key={line.id_solicitud_detalle}
            line={{ ...line, onChange: (patch) => review.updateLine(line.id_solicitud_detalle, patch) }}
            errors={review.validation.errors[String(line.id_solicitud_detalle)]}
            providerOptions={providerOptions}
            providersLoading={review.providers.loading}
            disabled={review.controlsDisabled}
            editable={canApprove}
          />
        ))}
      </div>

      <label className="sol-comp-review-comment">
        <strong>Comentario de Administración</strong>
        <small>Para aprobar es opcional. Para rechazar debes registrar el motivo.</small>
        <textarea
          rows="4"
          maxLength="1000"
          value={review.comment}
          disabled={review.controlsDisabled}
          aria-invalid={Boolean(visibleCommentError)}
          aria-describedby={visibleCommentError ? 'sol-comp-comment-error' : undefined}
          onChange={(event) => review.setComment(event.target.value)}
        />
        <span><small id="sol-comp-comment-error" className={visibleCommentError ? 'sol-comp-field-error' : ''}>{visibleCommentError}</small><small>{review.comment.length} / 1000</small></span>
      </label>

      {review.accessDenied ? <div className="sol-comp-contract-error" role="alert">No tienes permiso para revisar esta solicitud.</div> : null}

      {review.confirmation ? (
        <div className={`sol-comp-inline-confirm sol-comp-inline-confirm--${review.confirmation}`} role="group" aria-labelledby="sol-comp-confirm-title" aria-live="polite">
          <div>
            <span className="sol-comp-inline-confirm__icon" aria-hidden="true"><i className={`bi ${review.confirmation === 'approve' ? 'bi-check-circle' : 'bi-exclamation-octagon'}`} /></span>
            <strong id="sol-comp-confirm-title">{review.confirmation === 'approve' ? 'Confirmar aprobación' : 'Confirmar rechazo'}</strong>
            <p>{review.confirmation === 'approve'
              ? 'Se aprobarán todas las líneas con las cantidades y proveedores seleccionados.'
              : 'La solicitud quedará rechazada con el comentario registrado.'}</p>
          </div>
          <div>
            <button type="button" className="btn btn-outline-secondary" disabled={Boolean(review.busyAction)} onClick={() => review.setConfirmation(null)}>Volver</button>
            <button type="button" className={review.confirmation === 'approve' ? 'btn btn-primary' : 'btn btn-danger'} disabled={Boolean(review.busyAction)} onClick={() => review.execute(review.confirmation)}>
              {review.busyAction === 'approve' ? 'Aprobando…' : review.busyAction === 'reject' ? 'Rechazando…' : review.confirmation === 'approve' ? 'Confirmar aprobación' : 'Confirmar rechazo'}
            </button>
          </div>
        </div>
      ) : (
        <div className="sol-comp-review-actions">
          {canReject ? <button type="button" className="btn btn-outline-danger" disabled={review.rejectDisabled} onClick={() => review.setConfirmation('reject')}>Rechazar solicitud</button> : null}
          {canApprove ? <button type="button" className="btn btn-primary" disabled={review.approveDisabled} onClick={() => review.setConfirmation('approve')}>Aprobar solicitud</button> : null}
        </div>
      )}
      {canReject && review.rejectionCommentError && !review.comment.trim() ? <p className="sol-comp-review-hint">Para rechazar, registra primero un comentario.</p> : null}
    </section>
  );
}
