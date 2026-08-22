import useSolicitudCompraRecepcion from '../hooks/useSolicitudCompraRecepcion';
import { formatFileSize, MAX_INVOICE_EVIDENCES } from '../utils/solicitudesCompraRecepcionUtils';
import SolicitudCompraConfirmModal from './SolicitudCompraConfirmModal';
import SolicitudCompraRecepcionLinea from './SolicitudCompraRecepcionLinea';
import { buildConversionPreview, isBaseOnlyLine, resolvePresentationLabel, subtractConversionDecimal } from '../utils/solicitudesCompraConversionUtils';

export default function SolicitudCompraRecepcionPanel({ solicitud, detalles, canReceive, reloadDetail, reloadList, openToast }) {
  const reception = useSolicitudCompraRecepcion({ solicitud, detalles, canReceive, reloadDetail, reloadList, openToast });

  const handleInvoiceChange = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length) void reception.selectInvoices(files);
    event.target.value = '';
  };

  return (
    <section className="sol-comp-reception-panel" aria-labelledby="sol-comp-reception-title">
      <header>
        <div className="sol-comp-workflow-heading">
          <span aria-hidden="true"><i className="bi bi-box-arrow-in-down" /></span>
          <div><h3 id="sol-comp-reception-title">Recepción final</h3><p>Registra todas las cantidades recibidas y adjunta las imágenes de la factura.</p></div>
        </div>
        <span className="sol-comp-workflow-badge sol-comp-workflow-badge--definitive"><i className="bi bi-lock" aria-hidden="true" /> Operación definitiva</span>
      </header>

      {reception.validation.general.length ? (
        <div className="sol-comp-contract-error" role="alert">
          <strong>No se puede recibir por un error en el contrato del detalle.</strong>
          <p>{reception.validation.general.join(' ')}</p>
        </div>
      ) : null}

      <div className="sol-comp-reception-lines">
        {reception.lines.filter((line) => line.id_solicitud_detalle).map((line) => (
          <SolicitudCompraRecepcionLinea
            key={line.id_solicitud_detalle}
            line={line}
            errors={reception.validation.errors[String(line.id_solicitud_detalle)]}
            disabled={reception.controlsDisabled || reception.confirmation}
            onChange={(cantidad) => reception.updateLine(line.id_solicitud_detalle, cantidad)}
          />
        ))}
      </div>

      {reception.differences.length ? (
        <div className="sol-comp-difference-notice" role="alert">
          <i className="bi bi-exclamation-triangle" aria-hidden="true" /><div><strong>Hay {reception.differences.length} {reception.differences.length === 1 ? 'línea diferente' : 'líneas diferentes'}.</strong>
          <p>{reception.differences.map((line) => line.nombre || `Detalle ${line.id_solicitud_detalle}`).join(', ')}</p>
          </div>
        </div>
      ) : null}

      <div className="sol-comp-reception-form">
        <label className="sol-comp-reception-observation" htmlFor="sol-comp-reception-observation">
          Observación de recepción
          <textarea
            id="sol-comp-reception-observation"
            rows="4"
            maxLength="1000"
            value={reception.observation}
            disabled={reception.controlsDisabled || reception.confirmation}
            aria-invalid={Boolean(reception.observationError)}
            aria-describedby="sol-comp-reception-observation-help sol-comp-reception-observation-error"
            onChange={(event) => reception.setObservation(event.target.value)}
          />
          <small id="sol-comp-reception-observation-help">Cuando la cantidad recibida sea diferente de la aprobada, explica brevemente el motivo.</small>
          <span><small id="sol-comp-reception-observation-error" className="sol-comp-field-error">{reception.observationError}</small><small>{reception.observation.length} / 1000</small></span>
        </label>

        <div className="sol-comp-invoice-field">
          <span className="sol-comp-invoice-field__icon" aria-hidden="true"><i className="bi bi-camera" /></span>
          <div><strong>Factura / comprobantes</strong><p>{reception.evidence.items.length} de {MAX_INVOICE_EVIDENCES} imágenes guardadas</p></div>
          <label className="btn sol-comp-outline-action" htmlFor="sol-comp-invoice-input">Agregar imágenes</label>
          <input
            id="sol-comp-invoice-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={reception.controlsDisabled || reception.confirmation || reception.evidence.loading || reception.evidence.items.length >= MAX_INVOICE_EVIDENCES}
            aria-invalid={Boolean(reception.evidence.error)}
            aria-describedby="sol-comp-invoice-help sol-comp-invoice-error"
            onChange={handleInvoiceChange}
          />
          <small id="sol-comp-invoice-help">JPEG, PNG o WEBP. Máximo 6 MB por imagen y {MAX_INVOICE_EVIDENCES} imágenes.</small>
          <small id="sol-comp-invoice-error" className="sol-comp-field-error" aria-live="polite">{reception.evidence.loading ? 'Consultando imágenes…' : reception.evidenceBusy ? 'Procesando imágenes…' : reception.evidence.error}</small>
        </div>

        {reception.evidence.items.length ? (
          <div className="sol-comp-invoice-list">
            <div className="sol-comp-invoice-list__head"><strong>Imágenes guardadas</strong><button type="button" className="btn btn-outline-danger btn-sm" disabled={reception.controlsDisabled || reception.confirmation} onClick={() => reception.setRemoveAllConfirmation(true)}>Quitar todas</button></div>
            <div className="sol-comp-invoice-grid">
              {reception.evidence.items.map((item) => (
                <article className="sol-comp-invoice-preview" key={item.id_evidencia}>
                  {item.url_firmada ? <img src={item.url_firmada} alt={`Factura ${item.nombre_original || item.id_evidencia}`} /> : <span className="sol-comp-invoice-placeholder"><i className="bi bi-image" aria-hidden="true" /></span>}
                  <div><strong>{item.nombre_original || 'Factura'}</strong><span>{item.tipo_archivo}</span><span>{formatFileSize(item.tamano_bytes)}</span><button type="button" className="btn btn-outline-danger btn-sm" disabled={reception.controlsDisabled || reception.confirmation} onClick={() => reception.removeEvidence(item.id_evidencia)}>Quitar</button></div>
                </article>
              ))}
            </div>
          </div>
        ) : <p className="sol-comp-field-error" role="status">Agrega al menos una imagen para habilitar la recepción.</p>}
      </div>

      {reception.accessDenied ? <div className="sol-comp-contract-error" role="alert">No tienes permiso para registrar esta recepción.</div> : null}

      {!reception.confirmation ? (
        <div className="sol-comp-reception-actions">
          <button type="button" className="btn btn-primary" disabled={reception.receiveDisabled} onClick={reception.startConfirmation}>Registrar recepción</button>
        </div>
      ) : null}
      <SolicitudCompraConfirmModal
        open={reception.confirmation}
        title="Confirmar recepción final"
        description="Las cantidades recibidas se aplicarán automáticamente al inventario."
        icon="bi-box-arrow-in-down"
        confirmLabel="Confirmar recepción"
        busyLabel="Registrando…"
        busy={reception.busy}
        onClose={() => reception.setConfirmation(false)}
        onConfirm={reception.executeReception}
      >
        <p className="sol-comp-inventory-warning">
          <strong>Al confirmar, el sistema agregará automáticamente las cantidades base indicadas al inventario del almacén.</strong>
          No realice un ajuste manual adicional, porque esta recepción aplica la entrada automáticamente.
        </p>
        <div className="sol-comp-confirm-summary" aria-label="Líneas que se recibirán">
          {reception.lines.map((line) => {
            const baseOnly = isBaseOnlyLine(line);
            const input = {
              presentationLabel: resolvePresentationLabel(line),
              baseUnit: line.unidad_base,
              factor: line.factor_conversion_snapshot || '1',
              baseOnly
            };
            const approvedPreview = buildConversionPreview({ ...input, quantity: line.cantidad_aprobada });
            const receivedPreview = buildConversionPreview({ ...input, quantity: line.cantidad_recibida });
            const presentationDifference = subtractConversionDecimal(line.cantidad_recibida, line.cantidad_aprobada);
            const baseDifference = approvedPreview.valid && receivedPreview.valid
              ? subtractConversionDecimal(receivedPreview.baseQuantity, approvedPreview.baseQuantity)
              : null;
            const different = presentationDifference !== null && presentationDifference !== '0';
            return (
              <article className="sol-comp-confirm-row" key={line.id_solicitud_detalle}>
                <strong>{line.nombre}</strong>
                <span>{receivedPreview.valid ? `${receivedPreview.quantity} ${baseOnly ? receivedPreview.baseUnit : receivedPreview.presentationLabel}` : 'Cantidad pendiente'}</span>
                {receivedPreview.valid ? <small>Entrada al inventario: {receivedPreview.baseQuantity} {receivedPreview.baseUnit}</small> : null}
                {different ? <small className="sol-comp-confirm-row__difference">Diferencia: {presentationDifference} {baseOnly ? line.unidad_base : resolvePresentationLabel(line)}{baseDifference !== null ? ` · ${baseDifference} ${line.unidad_base}` : ''}</small> : null}
              </article>
            );
          })}
        </div>
        <div className="sol-comp-confirm-meta">
          <p><strong>Factura:</strong> {reception.evidence.items.length} {reception.evidence.items.length === 1 ? 'imagen guardada' : 'imágenes guardadas'}</p>
          {reception.observation.trim() ? <p><strong>Observación:</strong> {reception.observation}</p> : null}
          <p><i className="bi bi-lock" aria-hidden="true" /> Esta es una operación definitiva.</p>
        </div>
      </SolicitudCompraConfirmModal>
      <SolicitudCompraConfirmModal
        open={reception.removeAllConfirmation}
        title="Quitar todas las imágenes"
        description="Esta acción eliminará todas las imágenes de factura guardadas para esta solicitud."
        icon="bi-trash"
        confirmLabel="Quitar todas"
        busyLabel="Eliminando…"
        busy={reception.evidenceBusy}
        onClose={() => reception.setRemoveAllConfirmation(false)}
        onConfirm={reception.removeAllEvidence}
      >
        <p>Se eliminarán {reception.evidence.items.length} imágenes. Podrás cargar otras mientras la solicitud siga aprobada y sin recibir.</p>
      </SolicitudCompraConfirmModal>
    </section>
  );
}
