import { useMemo } from 'react';
import useSolicitudCompraRevision from '../hooks/useSolicitudCompraRevision';
import SolicitudCompraConfirmModal from './SolicitudCompraConfirmModal';
import SolicitudCompraRevisionLinea from './SolicitudCompraRevisionLinea';
import ProveedorBulkAssignment from './ProveedorBulkAssignment';
import SolicitudCompraCatalogo from './SolicitudCompraCatalogo';
import { buildConversionPreview, isBaseOnlyLine, resolvePresentationLabel } from '../utils/solicitudesCompraConversionUtils';

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

      {canApprove ? <section className="sol-comp-review-catalog" aria-labelledby="review-catalog-title"><div><h4 id="review-catalog-title">Agregar productos o insumos</h4><p>Los artículos se agregarán al almacén fijo de la solicitud únicamente cuando confirmes la aprobación.</p></div><SolicitudCompraCatalogo warehouseId={solicitud?.almacen?.id_almacen} state={review.catalogState} loadCatalog={review.loadCatalog} onAdd={review.addAdministrativeLine} quantityLabel="Cantidad a agregar" addLabel="Agregar a solicitud" previewLabel="Cantidad que se aprobará" />{review.catalogFeedback ? <p className="sol-comp-feedback" aria-live="polite">{review.catalogFeedback}</p> : null}</section> : null}

      {canApprove ? <ProveedorBulkAssignment providerOptions={providerOptions} lines={review.lines} onApplyAll={review.applyProviderToAll} onFillMissing={review.fillMissingProviders} disabled={review.controlsDisabled || review.providers.loading || Boolean(review.providers.error)} /> : null}

      <div className="sol-comp-review-lines">
        {review.lines.map((line) => (
          <SolicitudCompraRevisionLinea
            key={line._line_key || line.id_solicitud_detalle}
            line={{ ...line, onChange: (patch) => review.updateLine(line._line_key || line.id_solicitud_detalle, patch), onRemove: () => review.removeAdministrativeLine(line._line_key) }}
            errors={review.validation.errors[String(line.id_solicitud_detalle || line._line_key)]}
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

      {review.confirmation === 'reject' ? (
        <div className="sol-comp-inline-confirm sol-comp-inline-confirm--reject" role="group" aria-labelledby="sol-comp-confirm-title" aria-live="polite">
          <div>
            <span className="sol-comp-inline-confirm__icon" aria-hidden="true"><i className="bi bi-exclamation-octagon" /></span>
            <strong id="sol-comp-confirm-title">Confirmar rechazo</strong>
            <p>La solicitud quedará rechazada con el comentario registrado.</p>
          </div>
          <div>
            <button type="button" className="btn btn-outline-secondary" disabled={Boolean(review.busyAction)} onClick={() => review.setConfirmation(null)}>Volver</button>
            <button type="button" className="btn btn-danger" disabled={Boolean(review.busyAction)} onClick={() => review.execute('reject')}>
              {review.busyAction === 'reject' ? 'Rechazando…' : 'Confirmar rechazo'}
            </button>
          </div>
        </div>
      ) : (
        <div className="sol-comp-review-actions">
          {canReject ? <button type="button" className="btn btn-outline-danger" disabled={review.rejectDisabled} onClick={() => review.setConfirmation('reject')}>Rechazar solicitud</button> : null}
          {canApprove ? <button type="button" className="btn btn-primary" disabled={review.approveDisabled} onClick={() => review.setConfirmation('approve')}>Aprobar solicitud</button> : null}
        </div>
      )}
      <SolicitudCompraConfirmModal
        open={review.confirmation === 'approve'}
        title="Confirmar aprobación"
        description="Se aprobarán todas las líneas con las cantidades y proveedores seleccionados."
        icon="bi-check-circle"
        confirmLabel="Confirmar aprobación"
        busyLabel="Aprobando…"
        busy={review.busyAction === 'approve'}
        onClose={() => review.setConfirmation(null)}
        onConfirm={() => review.execute('approve')}
      >
        <div className="sol-comp-confirm-summary" aria-label="Líneas que se aprobarán">
          {review.lines.map((line) => {
            const preview = buildConversionPreview({
              quantity: line.cantidad_aprobada,
              presentationLabel: resolvePresentationLabel(line),
              baseUnit: line.unidad_base,
              factor: line.factor_conversion_snapshot || '1',
              baseOnly: isBaseOnlyLine(line)
            });
            return (
              <article className="sol-comp-confirm-row" key={line._line_key || line.id_solicitud_detalle}>
                <strong>{line.nombre}</strong>
                <span>{preview.valid ? `${preview.quantity} ${preview.baseOnly ? preview.baseUnit : preview.presentationLabel}` : 'Cantidad pendiente'}</span>
                {preview.valid && !preview.baseOnly ? <small>Cantidad base: {preview.baseQuantity} {preview.baseUnit}</small> : null}
                <small>{line.origen_linea === 'ADMINISTRACION' ? 'Agregado por Administración' : 'Solicitado por sucursal'}</small>
                <small>Proveedor: {providerOptions.find((option) => option.value === String(line.id_proveedor))?.label || 'Sin seleccionar'}</small>
              </article>
            );
          })}
        </div>
      </SolicitudCompraConfirmModal>
      {canReject && review.rejectionCommentError && !review.comment.trim() ? <p className="sol-comp-review-hint">Para rechazar, registra primero un comentario.</p> : null}
    </section>
  );
}
