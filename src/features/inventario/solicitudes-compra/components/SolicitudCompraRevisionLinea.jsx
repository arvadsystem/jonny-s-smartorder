import AppSelect from '../../../../components/common/AppSelect';
import { buildConversionPreview, formatConversionQuantity, isBaseOnlyLine, resolvePresentationLabel } from '../utils/solicitudesCompraConversionUtils';

const display = (value) => value === null || value === undefined || value === '' ? '—' : formatConversionQuantity(value);

export default function SolicitudCompraRevisionLinea({ line, errors = {}, providerOptions, providersLoading, disabled, editable }) {
  const inputId = `approved-quantity-${String(line._line_key || line.id_solicitud_detalle).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  const quantityErrorId = `${inputId}-error`;
  const isProduct = line.tipo_item === 'PRODUCTO';
  const administrative = !line.id_solicitud_detalle && line.origen_linea === 'ADMINISTRACION';
  const stockKey = String(line.estado_stock || '').toUpperCase();
  const stockLabel = { SIN_STOCK: 'Sin stock', STOCK_BAJO: 'Stock bajo', DISPONIBLE: 'Disponible' }[stockKey] || line.estado_stock || '—';
  const baseOnly = isBaseOnlyLine(line);
  const approvalPreview = buildConversionPreview({
    quantity: line.cantidad_aprobada,
    presentationLabel: resolvePresentationLabel(line),
    baseUnit: line.unidad_base,
    factor: line.factor_conversion_snapshot || '1',
    baseOnly
  });
  return (
    <article className="sol-comp-review-line">
      <div className="sol-comp-review-info">
        <div className="sol-comp-card-top"><strong>{line.nombre}</strong><span className="sol-comp-type-pill">{isProduct ? 'Producto' : 'Insumo'}</span></div><span className="sol-comp-origin-badge">{administrative ? 'Agregado por Administración' : line.origen_linea === 'CAPTURA_RAPIDA' ? 'Captura rápida' : 'Solicitado por sucursal'}</span>
        <p><span>{line.categoria || 'Sin categoría'}</span><span>{line.presentacion_snapshot || line.unidad_base || 'Unidad'}</span></p>
        <div className="sol-comp-quantities">
          <span>{administrative ? 'Cantidad agregada' : 'Solicitada'} <b>{display(line.cantidad_solicitada)}</b></span>
          <span>Base solicitada <b>{display(line.cantidad_base_solicitada)} {line.unidad_base || ''}</b></span>
          <span>Stock <b>{display(line.stock_actual)}</b></span>
          <span>Mínimo <b>{display(line.stock_minimo)}</b></span>
          <span className={`sol-comp-stock-text sol-comp-stock-text--${stockKey.toLowerCase() || 'unknown'}`}>Estado <b>{stockLabel}</b></span>
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
              step={isProduct ? '1' : '0.000001'}
              inputMode={isProduct ? 'numeric' : 'decimal'}
              value={line.cantidad_aprobada}
              disabled={disabled}
              aria-invalid={Boolean(errors.cantidad)}
              aria-describedby={errors.cantidad ? quantityErrorId : undefined}
              onChange={(event) => line.onChange({ cantidad_aprobada: event.target.value })}
            />
            {errors.cantidad ? <small id={quantityErrorId} className="sol-comp-field-error">{errors.cantidad}</small> : null}
            {approvalPreview.valid ? <span className="sol-comp-calculated-base"><small>{baseOnly ? 'Solicitud directa en unidad base' : 'Equivalencia de aprobación'}</small><strong>{baseOnly ? `${approvalPreview.baseQuantity} ${approvalPreview.baseUnit}` : `${approvalPreview.quantity} ${approvalPreview.presentationLabel} = ${approvalPreview.baseQuantity} ${approvalPreview.baseUnit}`}</strong><em>Cantidad base calculada para inventario: {approvalPreview.baseQuantity} {approvalPreview.baseUnit}</em></span> : null}
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
          {administrative ? <button type="button" className="btn btn-outline-danger btn-sm sol-comp-review-remove" disabled={disabled} onClick={line.onRemove}>Quitar</button> : null}
        </>
      ) : null}
    </article>
  );
}
