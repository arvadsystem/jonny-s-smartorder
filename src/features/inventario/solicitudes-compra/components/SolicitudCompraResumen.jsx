import { buildVisualEquivalence, parseRequestedQuantity } from '../utils/solicitudesCompraUtils';

export default function SolicitudCompraResumen({ lines, onChange, onRemove, observation, setObservation, submitting, onSubmit, disabled }) {
  return (
    <aside className="sol-comp-summary" aria-labelledby="summary-title">
      <div className="sol-comp-panel-heading"><span aria-hidden="true"><i className="bi bi-clipboard-check" /></span><div><h3 id="summary-title">Resumen de solicitud</h3><p>{lines.length} {lines.length === 1 ? 'línea seleccionada' : 'líneas seleccionadas'}</p></div></div>
      {!lines.length ? <div className="sol-comp-summary-empty"><i className="bi bi-basket" aria-hidden="true" /><strong>Tu solicitud está vacía</strong><span>Agrega artículos desde el catálogo.</span></div> : lines.map((line, index) => {
        const valid = parseRequestedQuantity(line.cantidad, line.tipo_item);
        const visualEquivalence = buildVisualEquivalence(line);
        return <div className="sol-comp-summary-line" key={`${line.tipo_item}-${line.id_item}-${line.id_presentacion_insumo || 'base'}`}>
          <div><strong>{line.nombre}</strong><small>{line.tipo_item === 'producto' ? 'Producto' : 'Insumo'} · {line.presentacion}</small>{visualEquivalence ? <small className="sol-comp-equivalence">{visualEquivalence}</small> : null}</div>
          <label>Cantidad<input type="number" min="0" step={line.tipo_item === 'producto' ? '1' : '0.0001'} value={line.cantidad} aria-invalid={!valid} onChange={(event) => onChange(index, event.target.value)} /></label>
          <button type="button" className="sol-comp-remove-line" aria-label={`Eliminar ${line.nombre}`} onClick={() => onRemove(index)}><i className="bi bi-trash" aria-hidden="true" /></button>
        </div>;
      })}
      <label className="sol-comp-observation-field">Observación opcional<textarea maxLength="1000" rows="4" value={observation} onChange={(event) => setObservation(event.target.value)} /><small>{observation.length}/1000</small></label>
      <button type="button" className="btn btn-primary w-100 sol-comp-submit-request" disabled={disabled || submitting} onClick={onSubmit}>{submitting ? 'Enviando…' : <><i className="bi bi-send" aria-hidden="true" /> Enviar solicitud</>}</button>
    </aside>
  );
}
