import VentaReversionPrintStatus from './VentaReversionPrintStatus';

export default function VentaReversionResult({ open, result }) {
  if (!result) return null;
  return (
    <>
      <div className="alert alert-success mt-3 mb-0">
        <strong>Reversión registrada correctamente</strong>
        <div>Código REV: <strong>{result.codigo_reversion || '--'}</strong></div>
        <div>Monto reversado: <strong>L {Number(result.monto_reversado || 0).toFixed(2)}</strong></div>
        <div>Resultado acumulado: <strong>{result.resultado_acumulado || result.estado_acumulado_resultante || '--'}</strong></div>
      </div>
      <VentaReversionPrintStatus open={open} impresion={result.impresion} />
    </>
  );
}
