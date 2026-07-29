import usePrintJobStatus from '../hooks/usePrintJobStatus';
import { getPrintStateLabel } from '../utils/ventaReversionFlow';

export default function VentaReversionPrintStatus({ open, impresion }) {
  const idTrabajo = Number(impresion?.id_trabajo || 0) || null;
  const { job, error } = usePrintJobStatus({
    active: open,
    idTrabajo,
    initialState: impresion?.estado
  });
  if (!impresion) return null;
  if (!impresion.automatica_habilitada) {
    return (
      <div className="alert alert-secondary mt-3 mb-0">
        <strong>Impresión automática deshabilitada.</strong><br />
        La reversión fue registrada. La impresión automática está deshabilitada para esta sucursal.
      </div>
    );
  }
  const label = getPrintStateLabel(job?.estado || impresion.estado);
  const failed = label === 'Fallido';
  return (
    <div className={`alert alert-${failed ? 'warning' : 'info'} mt-3 mb-0`}>
      <strong>{idTrabajo ? `Trabajo #${idTrabajo}` : 'Trabajo de impresión'}</strong><br />
      {failed
        ? 'La reversión fue registrada correctamente, pero el comprobante no pudo imprimirse.'
        : 'Comprobante enviado a la cola de impresión.'}
      <br />Estado: <strong>{label}</strong>
      {error ? <div className="small mt-1">{error}</div> : null}
    </div>
  );
}
