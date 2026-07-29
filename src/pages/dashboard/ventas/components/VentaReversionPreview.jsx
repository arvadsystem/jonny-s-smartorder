const money = (value) => `L ${Number(value || 0).toFixed(2)}`;

export default function VentaReversionPreview({ preview, loading, error }) {
  if (loading) return <div className="alert alert-info mt-3 mb-0">Calculando vista previa...</div>;
  if (error) return <div className="alert alert-danger mt-3 mb-0">{error}</div>;
  if (!preview) return <div className="alert alert-light mt-3 mb-0">Selecciona cantidades válidas para calcular la reversión.</div>;
  const completesTotal = preview.estado_acumulado_resultante === 'TOTAL';
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
      {completesTotal ? (
        <div className="alert alert-warning mt-2 mb-0">
          Esta operación completará la reversión total de la venta.
        </div>
      ) : null}
    </section>
  );
}
