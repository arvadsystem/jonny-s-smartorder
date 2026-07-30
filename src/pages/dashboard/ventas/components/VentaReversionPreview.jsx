const money = (value) => `L ${Number(value || 0).toFixed(2)}`;

const resolveInventoryMessage = (line) => {
  if (line?.tipo_item === 'RECETA' && line?.motivo_no_devolucion === 'PREPARACION_INICIADA') {
    return {
      kind: 'warning',
      text: 'Esta receta ya inició preparación. El importe será reversado, pero sus insumos no regresarán al inventario.'
    };
  }
  if (line?.tipo_item === 'PRODUCTO' && line?.devuelve_inventario) {
    return {
      kind: 'info',
      text: 'El producto será devuelto al inventario.'
    };
  }
  return null;
};

export default function VentaReversionPreview({ preview, loading, error }) {
  if (loading) return <div className="alert alert-info mt-3 mb-0">Calculando vista previa...</div>;
  if (error) return <div className="alert alert-danger mt-3 mb-0">{error}</div>;
  if (!preview) return <div className="alert alert-light mt-3 mb-0">Selecciona cantidades válidas para calcular la reversión.</div>;

  const completesTotal = preview.estado_acumulado_resultante === 'TOTAL';
  const inventoryMessages = (Array.isArray(preview.lineas) ? preview.lineas : [])
    .map((line) => ({
      id: line.id_detalle_factura,
      message: resolveInventoryMessage(line)
    }))
    .filter((entry) => entry.message);

  return (
    <section className="ventas-detail-modal__section mt-3" aria-label="Vista previa de reversión">
      <div className="ventas-detail-modal__section-title">Vista previa calculada por el servidor</div>
      <dl className="ventas-detail-modal__totals-card mb-0">
        <div><span>Subtotal a reversar</span><strong>{money(preview.subtotal)}</strong></div>
        <div><span>Descuento a reversar</span><strong>{money(preview.descuento)}</strong></div>
        <div><span>ISV 15</span><strong>{money(preview.isv_15)}</strong></div>
        <div><span>ISV 18</span><strong>{money(preview.isv_18)}</strong></div>
        <div className="is-total"><span>Total a reversar</span><strong>{money(preview.total)}</strong></div>
        <div><span>Cantidad restante</span><strong>{preview.cantidad_restante_resultante}</strong></div>
        <div><span>Resultado acumulado</span><strong>{preview.estado_acumulado_resultante}</strong></div>
      </dl>
      {inventoryMessages.map(({ id, message }) => (
        <div key={`${id}-${message.kind}`} className={`alert alert-${message.kind} mt-2 mb-0`}>
          {message.text}
        </div>
      ))}
      {completesTotal ? (
        <div className="alert alert-warning mt-2 mb-0">
          Esta operación completará la reversión total de la venta.
        </div>
      ) : null}
    </section>
  );
}
