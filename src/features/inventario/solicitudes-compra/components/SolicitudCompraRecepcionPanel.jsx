import useSolicitudCompraRecepcion from '../hooks/useSolicitudCompraRecepcion';
import { formatFileSize } from '../utils/solicitudesCompraRecepcionUtils';
import SolicitudCompraRecepcionLinea from './SolicitudCompraRecepcionLinea';

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
        <h3 id="sol-comp-reception-title">Recepción final</h3>
        <p>Registra todas las cantidades recibidas y adjunta una fotografía de la factura.</p>
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
          <strong>Hay {reception.differences.length} {reception.differences.length === 1 ? 'línea diferente' : 'líneas diferentes'}.</strong>
          <p>{reception.differences.map((line) => line.nombre || `Detalle ${line.id_solicitud_detalle}`).join(', ')}</p>
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
          <span><small id="sol-comp-reception-observation-error" className="sol-comp-field-error">{reception.observationError}</small><small>{reception.observation.length}/1000</small></span>
        </label>

        <div className="sol-comp-invoice-field">
          <strong>Factura</strong>
          <label className="btn btn-outline-primary" htmlFor="sol-comp-invoice-input">Tomar foto o seleccionar imagen</label>
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

      {reception.confirmation ? (
        <div className="sol-comp-inline-confirm" role="group" aria-labelledby="sol-comp-receive-confirm-title" aria-live="polite">
          <div>
            <strong id="sol-comp-receive-confirm-title">Confirmar recepción final</strong>
            <p>La factura se guardará y las cantidades recibidas se aplicarán al inventario. Esta operación no puede repetirse en esta versión.</p>
            <ul>
              <li>{reception.lines.length} líneas</li>
              <li>{reception.differences.length} diferencias</li>
              <li>Factura: {reception.invoice.file?.name} ({formatFileSize(reception.invoice.file?.size)})</li>
              {reception.observation.trim() ? <li>Observación: {reception.observation}</li> : null}
            </ul>
          </div>
          <div>
            <button type="button" className="btn btn-outline-secondary" disabled={reception.busy} onClick={() => reception.setConfirmation(false)}>Volver</button>
            <button type="button" className="btn btn-primary" disabled={reception.busy || reception.receiveDisabled} onClick={reception.executeReception}>{reception.busy ? 'Registrando…' : 'Confirmar recepción'}</button>
          </div>
        </div>
      ) : (
        <div className="sol-comp-reception-actions">
          <button type="button" className="btn btn-primary" disabled={reception.receiveDisabled} onClick={reception.startConfirmation}>Registrar recepción</button>
        </div>
      )}
    </section>
  );
}
