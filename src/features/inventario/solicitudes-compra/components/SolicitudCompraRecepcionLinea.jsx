import { compareDecimalQuantities } from '../utils/solicitudesCompraRecepcionUtils';

const value = (raw) => raw === null || raw === undefined || raw === '' ? '—' : raw;

export default function SolicitudCompraRecepcionLinea({ line, errors, disabled, onChange }) {
  const isProduct = line.tipo_item === 'PRODUCTO';
  const comparison = compareDecimalQuantities(line.cantidad_recibida, line.cantidad_aprobada);
  const different = comparison !== null && comparison !== 0;
  const invalid = comparison === null;
  const quantityErrorId = `sol-comp-received-error-${line.id_solicitud_detalle}`;

  return (
    <article className={`sol-comp-reception-line${different ? ' is-different' : ''}`}>
      <div className="sol-comp-reception-info">
        <div className="sol-comp-card-top"><strong>{line.nombre}</strong><span className="sol-comp-type-pill">{isProduct ? 'Producto' : 'Insumo'}</span></div>
        <p><span>{line.categoria || 'Sin categoría'}</span><span>{line.presentacion_snapshot || line.unidad_base || 'Unidad'}</span></p>
        <div className="sol-comp-quantities">
          <span>Aprobada <b>{value(line.cantidad_aprobada)}</b></span>
          <span>Base aprobada <b>{value(line.cantidad_base_aprobada)}</b></span>
          <span>Proveedor <b>{line.proveedor?.nombre_proveedor || 'Sin asignar'}</b></span>
          <span>Stock <b>{value(line.stock_actual)}</b></span>
          <span>Mínimo <b>{value(line.stock_minimo)}</b></span>
        </div>
        {errors?.integridad ? <p className="sol-comp-field-error" role="alert">{errors.integridad}</p> : null}
        {errors?.id ? <p className="sol-comp-field-error" role="alert">{errors.id}</p> : null}
      </div>
      <label className="sol-comp-reception-quantity" htmlFor={`sol-comp-received-${line.id_solicitud_detalle}`}>
        Cantidad recibida
        <input
          id={`sol-comp-received-${line.id_solicitud_detalle}`}
          type="number"
          min={isProduct ? '1' : '0.0001'}
          step={isProduct ? '1' : '0.0001'}
          inputMode={isProduct ? 'numeric' : 'decimal'}
          value={line.cantidad_recibida}
          disabled={disabled}
          aria-invalid={Boolean(errors?.cantidad)}
          aria-describedby={errors?.cantidad ? quantityErrorId : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
        {errors?.cantidad ? <small id={quantityErrorId} className="sol-comp-field-error">{errors.cantidad}</small> : null}
      </label>
      <div className={`sol-comp-difference sol-comp-difference--${invalid ? 'invalid' : different ? 'different' : 'equal'}`}>
        <i className={`bi ${invalid ? 'bi-x-circle' : different ? 'bi-exclamation-triangle' : 'bi-check-circle'}`} aria-hidden="true" />
        <strong>{invalid ? 'Cantidad inválida' : different ? 'Diferencia' : 'Igual'}</strong>
        {different ? <small>Aprobada: {value(line.cantidad_aprobada)} · Recibida: {value(line.cantidad_recibida)}</small> : null}
      </div>
    </article>
  );
}
