// million-ignore
import { useCallback, useEffect, useRef, useState } from 'react';
import ventasService from '../../../../services/ventasService';
import usePrintJobStatus from '../hooks/usePrintJobStatus';
import { getPrintStateLabel } from '../utils/ventaReversionFlow';
import { resolveVentasApiErrorMessage } from '../utils/ventasHelpers';

export default function VentaReversionReprintAction({ idReversion }) {
  const actionRootRef = useRef(null);
  const inFlightRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [queued, setQueued] = useState(null);
  const [error, setError] = useState('');
  const idTrabajo = Number(queued?.id_trabajo || 0) || null;
  const { job } = usePrintJobStatus({ active: Boolean(idTrabajo), idTrabajo, initialState: queued?.estado });

  const reprint = useCallback(async () => {
    if (!idReversion || inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    setError('');
    try {
      const response = await ventasService.reprintReversion(idReversion);
      setQueued(response?.job || response?.data?.job || null);
    } catch (requestError) {
      setError(resolveVentasApiErrorMessage(requestError, 'No se pudo reimprimir el comprobante.'));
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [idReversion]);

  useEffect(() => {
    const root = actionRootRef.current;
    if (!root) return undefined;

    const handleNativeClick = (event) => {
      const action = event.target?.closest?.('[data-action="reprint-reversion"]');
      if (!action || !root.contains(action)) return;
      event.preventDefault();
      void reprint();
    };

    root.addEventListener('click', handleNativeClick);
    return () => root.removeEventListener('click', handleNativeClick);
  }, [reprint]);

  return (
    <div className="mt-2" ref={actionRootRef}>
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm"
        data-action="reprint-reversion"
        data-reversion-id={idReversion || ''}
        disabled={!idReversion || loading}
      >
        <i className="bi bi-printer me-1" />
        {loading ? 'Enviando...' : 'Reimprimir comprobante'}
      </button>
      {queued ? <span className="small text-muted ms-2">Trabajo #{queued.id_trabajo}: {getPrintStateLabel(job?.estado || queued.estado)}</span> : null}
      {error ? <div className="text-danger small mt-1">{error}</div> : null}
    </div>
  );
}
