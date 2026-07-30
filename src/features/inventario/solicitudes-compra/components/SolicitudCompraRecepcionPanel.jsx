import useSolicitudCompraRecepcion from '../hooks/useSolicitudCompraRecepcion';
import { formatFileSize } from '../utils/solicitudesCompraRecepcionUtils';
import SolicitudCompraConfirmModal from './SolicitudCompraConfirmModal';
import SolicitudCompraRecepcionLinea from './SolicitudCompraRecepcionLinea';
import { buildConversionPreview, isBaseOnlyLine, resolvePresentationLabel, subtractConversionDecimal } from '../utils/solicitudesCompraConversionUtils';

export default function SolicitudCompraRecepcionPanel({ solicitud, detalles, canReceive, reloadDetail, reloadList, openToast }) {
  const reception = useSolicitudCompraRecepcion({ solicitud, detalles, canReceive, reloadDetail, reloadList, openToast });

  const handleInvoiceChange = (event) => {
    const file = event.target.files?.[0];
    if (file) void reception.selectInvoice(file);
    event.target.value = '';
  };

  return (
    <section className="sol-comp-reception-panel" aria-labelledby="sol-comp-reception-title">
      <header>
        <div className="sol-comp-workflow-heading">
          <span aria-hidden="true"><i className="bi bi-box-arrow-in-down" /></span>
          <div><h3 id="sol-comp-reception-title">Recepción final</h3><p>Registra todas las cantidades recibidas y adjunta una fotografía de la factura.</p></div>
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
          <div><strong>Factura</strong><p>Tomar foto o seleccionar imagen</p></div>
          <label className="btn sol-comp-outline-action" htmlFor="sol-comp-invoice-input">Tomar foto o seleccionar imagen</label>
          <input
            id="sol-comp-invoice-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            disabled={reception.controlsDisabled || reception.confirmation || reception.invoice.validating}
            aria-invalid={Boolean(reception.invoice.error)}
            aria-describedby="sol-comp-invoice-help sol-comp-invoice-error"
            onChange={handleInvoiceChange}
          />
          <small id="sol-comp-invoice-help">JPEG, PNG o WEBP. Máximo 6 MB.</small>
          <small id="sol-comp-invoice-error" className="sol-comp-field-error" aria-live="polite">{reception.invoice.validating ? 'Validando imagen…' : reception.invoice.error}</small>
        </div>

        {reception.invoice.file ? (
          <div className="sol-comp-invoice-preview">
            <img src={reception.invoice.previewUrl} alt={`Vista previa de la factura ${reception.invoice.file.name}`} />
            <div>
              <strong>{reception.invoice.file.name}</strong>
              <span>{reception.invoice.file.type}</span>
              <span>{formatFileSize(reception.invoice.file.size)}</span>
              <div>
                <label className="btn btn-outline-secondary btn-sm" htmlFor="sol-comp-invoice-input">Cambiar imagen</label>
                <button type="button" className="btn btn-outline-danger btn-sm" disabled={reception.controlsDisabled || reception.confirmation} onClick={reception.removeInvoice}>Quitar imagen</button>
              </div>
            </div>
          </div>
        ) : null}
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
        description="La factura se guardará y las cantidades recibidas se aplicarán automáticamente al inventario."
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
          <p><strong>Factura:</strong> {reception.invoice.file?.name} ({formatFileSize(reception.invoice.file?.size)})</p>
          {reception.observation.trim() ? <p><strong>Observación:</strong> {reception.observation}</p> : null}
          <p><i className="bi bi-lock" aria-hidden="true" /> Esta es una operación definitiva.</p>
        </div>
      </SolicitudCompraConfirmModal>
    </section>
  );
}
