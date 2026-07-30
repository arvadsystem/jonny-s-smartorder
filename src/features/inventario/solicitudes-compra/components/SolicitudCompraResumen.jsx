import { parseRequestedQuantity } from '../utils/solicitudesCompraUtils';
import { buildConversionPreview, isBaseOnlyLine, resolvePresentationLabel } from '../utils/solicitudesCompraConversionUtils';

export default function SolicitudCompraResumen({ lines, onChange, onRemove, observation, setObservation, submitting, onSubmit, disabled }) {
  return (
    <aside className="sol-comp-summary" aria-labelledby="summary-title">
      <div className="sol-comp-summary__header">
        <div className="sol-comp-panel-heading"><span aria-hidden="true"><i className="bi bi-clipboard-check" /></span><div><h3 id="summary-title">Resumen de solicitud</h3></div></div>
        <span className="sol-comp-summary__count">{lines.length} {lines.length === 1 ? 'línea' : 'líneas'}</span>
      </div>
      {!lines.length ? <div className="sol-comp-summary-empty"><i className="bi bi-basket" aria-hidden="true" /><strong>Tu solicitud está vacía</strong><span>Agrega productos o insumos desde el catálogo.</span><small>El resumen se actualizará automáticamente.</small></div> : <div className="sol-comp-summary__lines">{lines.map((line, index) => {
        const valid = parseRequestedQuantity(line.cantidad, line.tipo_item);
        const baseOnly = isBaseOnlyLine(line);
        const conversion = buildConversionPreview({
          quantity: line.cantidad,
          presentationLabel: resolvePresentationLabel(line),
          baseUnit: line.unidad_base_visual || 'Unidad',
          factor: line.factor_conversion_visual || '1',
          baseOnly
        });
        const lineKey = `${line.tipo_item}-${line.id_item}-${line.id_presentacion_insumo || 'base'}`;
        const errorId = `sol-comp-summary-quantity-${lineKey}`;
        const errorMessage = line.tipo_item === 'producto'
          ? 'Ingresa una cantidad entera mayor que cero.'
          : 'Ingresa una cantidad mayor que cero con hasta seis decimales.';
        return <article className="sol-comp-summary-line" key={lineKey}>
          <div className="sol-comp-summary-line__top">
            <strong>{line.nombre}</strong>
            <button type="button" className="sol-comp-remove-line" aria-label={`Eliminar ${line.nombre}`} title="Eliminar línea" onClick={() => onRemove(index)}><i className="bi bi-trash" aria-hidden="true" /></button>
          </div>
          <div className="sol-comp-summary-line__meta"><span>{line.tipo_item === 'producto' ? 'Producto' : 'Insumo'}</span><span>Presentación: {line.nombre_presentacion_visual || line.presentacion}</span></div>
          <label>Cantidad solicitada
            <input type="number" min="0" step={line.tipo_item === 'producto' ? '1' : '0.000001'} inputMode={line.tipo_item === 'producto' ? 'numeric' : 'decimal'} value={line.cantidad} aria-invalid={!valid} aria-describedby={!valid ? errorId : undefined} onChange={(event) => onChange(index, event.target.value)} />
            {!valid ? <small id={errorId} className="sol-comp-field-error" role="alert">{errorMessage}</small> : null}
          </label>
          {conversion.valid ? baseOnly
            ? <div className="sol-comp-equivalence"><strong>{conversion.quantity} {conversion.baseUnit}</strong><small>Sin presentación de compra. Solicitud directa en unidad base.</small></div>
            : <div className="sol-comp-equivalence"><small>Equivalencia</small><strong>{conversion.quantity} {conversion.presentationLabel} = {conversion.baseQuantity} {conversion.baseUnit}</strong></div>
            : null}
        </article>;
      })}</div>}
      <div className="sol-comp-summary__observation">
        <label className="sol-comp-observation-field">Observación opcional
          <small>Agrega una nota general para Administración cuando sea necesario.</small>
          <textarea maxLength="1000" rows="4" value={observation} onChange={(event) => setObservation(event.target.value)} />
          <span className="sol-comp-observation__count">{observation.length} / 1000</span>
        </label>
      </div>
      <div className="sol-comp-submit-zone">
        <small><i className="bi bi-check2-circle" aria-hidden="true" /> Verifica las cantidades antes de enviar.</small>
        <button type="button" className="btn sol-comp-submit-request" disabled={disabled || submitting} onClick={onSubmit}>{submitting ? 'Enviando…' : <><i className="bi bi-send" aria-hidden="true" /> Enviar solicitud</>}</button>
      </div>
    </aside>
  );
}
