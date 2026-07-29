import { useState } from 'react';
import ventasService from '../../../../services/ventasService';
import usePrintJobStatus from '../hooks/usePrintJobStatus';
import { getPrintStateLabel } from '../utils/ventaReversionFlow';
import { resolveVentasApiErrorMessage } from '../utils/ventasHelpers';

export default function VentaReversionReprintAction({ idReversion }) {
  const [loading, setLoading] = useState(false);
  const [queued, setQueued] = useState(null);
  const [error, setError] = useState('');
  const idTrabajo = Number(queued?.id_trabajo || 0) || null;
  const { job } = usePrintJobStatus({ active: Boolean(idTrabajo), idTrabajo, initialState: queued?.estado });

  const reprint = async () => {
    if (!idReversion || loading) return;
    setLoading(true);
    setError('');
    try {
      const response = await ventasService.reprintReversion(idReversion);
      setQueued(response?.job || response?.data?.job || null);
    } catch (requestError) {
      setError(resolveVentasApiErrorMessage(requestError, 'No se pudo reimprimir el comprobante.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2">
      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={reprint} disabled={!idReversion || loading}>
        <i className="bi bi-printer me-1" />
        {loading ? 'Enviando...' : 'Reimprimir comprobante'}
      </button>
      {queued ? <span className="small text-muted ms-2">Trabajo #{queued.id_trabajo}: {getPrintStateLabel(job?.estado || queued.estado)}</span> : null}
      {error ? <div className="text-danger small mt-1">{error}</div> : null}
    </div>
  );
}
