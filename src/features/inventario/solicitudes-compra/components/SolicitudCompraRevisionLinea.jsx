import AppSelect from '../../../../components/common/AppSelect';

const display = (value) => value === null || value === undefined || value === '' ? '—' : value;

export default function SolicitudCompraRevisionLinea({ line, errors = {}, providerOptions, providersLoading, disabled, editable }) {
  const inputId = `approved-quantity-${line.id_solicitud_detalle}`;
  const quantityErrorId = `${inputId}-error`;
  const isProduct = line.tipo_item === 'PRODUCTO';
  return (
    <article className="sol-comp-review-line">
      <div className="sol-comp-review-info">
        <div className="sol-comp-card-top"><strong>{line.nombre}</strong><span>{isProduct ? 'Producto' : 'Insumo'}</span></div>
        <p>{line.categoria || 'Sin categoría'} · {line.presentacion_snapshot || line.unidad_base || 'Unidad'}</p>
        <div className="sol-comp-quantities">
          <span>Solicitada <b>{display(line.cantidad_solicitada)}</b></span>
          <span>Base solicitada <b>{display(line.cantidad_base_solicitada)} {line.unidad_base || ''}</b></span>
          <span>Stock <b>{display(line.stock_actual)}</b></span>
          <span>Mínimo <b>{display(line.stock_minimo)}</b></span>
          <span>Estado <b>{line.estado_stock || '—'}</b></span>
        </div>
      </div>
      {editable ? (
        <>
          <label className="sol-comp-review-quantity" htmlFor={inputId}>
            Cantidad aprobada
            <input
              id={inputId}
              type="number"
              min="0"
              step={isProduct ? '1' : '0.0001'}
              inputMode={isProduct ? 'numeric' : 'decimal'}
              value={line.cantidad_aprobada}
              disabled={disabled}
              aria-invalid={Boolean(errors.cantidad)}
              aria-describedby={errors.cantidad ? quantityErrorId : undefined}
              onChange={(event) => line.onChange({ cantidad_aprobada: event.target.value })}
            />
            {errors.cantidad ? <small id={quantityErrorId} className="sol-comp-field-error">{errors.cantidad}</small> : null}
          </label>
          <div className="sol-comp-review-provider">
            <AppSelect
              label="Proveedor"
              placeholder={providersLoading ? 'Cargando proveedores…' : 'Selecciona un proveedor'}
              value={line.id_proveedor}
              options={providerOptions}
              onChange={(value) => line.onChange({ id_proveedor: value })}
              searchable={providerOptions.length > 1}
              disabled={disabled || providersLoading}
              error={errors.proveedor || ''}
              emptyText="No hay proveedores disponibles."
            />
          </div>
        </>
      ) : null}
    </article>
  );
}
