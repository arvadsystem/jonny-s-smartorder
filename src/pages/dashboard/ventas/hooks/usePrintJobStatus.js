import { useEffect, useState } from 'react';
import ventasService from '../../../../services/ventasService';
import { isFinalPrintState } from '../utils/ventaReversionFlow';

export default function usePrintJobStatus({ active, idTrabajo, initialState = 'PENDIENTE' }) {
  const [job, setJob] = useState(idTrabajo ? { id_trabajo: idTrabajo, estado: initialState } : null);
  const [errorState, setErrorState] = useState({ id: null, message: '' });

  useEffect(() => {
    if (!active || !idTrabajo) return undefined;
    let cancelled = false;
    let attempts = 0;
    let timer = null;
    const poll = async () => {
      attempts += 1;
      try {
        const response = await ventasService.getPrintJob(idTrabajo);
        const nextJob = response?.job || response?.data?.job || null;
        if (cancelled || !nextJob) return;
        setJob(nextJob);
        if (isFinalPrintState(nextJob.estado) || attempts >= 20) return;
      } catch {
        if (!cancelled) {
          setErrorState({ id: idTrabajo, message: 'No se pudo actualizar el estado de impresión.' });
        }
        if (attempts >= 20) return;
      }
      timer = window.setTimeout(poll, 2000);
    };
    timer = window.setTimeout(poll, 2000);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [active, idTrabajo]);

  const currentJob = Number(job?.id_trabajo) === Number(idTrabajo)
    ? job
    : idTrabajo ? { id_trabajo: idTrabajo, estado: initialState } : null;
  return {
    job: currentJob,
    error: Number(errorState.id) === Number(idTrabajo) ? errorState.message : ''
  };
}
