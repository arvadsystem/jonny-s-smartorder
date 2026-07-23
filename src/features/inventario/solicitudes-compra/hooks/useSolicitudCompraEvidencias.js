import { useCallback, useEffect, useRef, useState } from 'react';
import { solicitudesCompraService } from '../../../../services/solicitudesCompraService';
import { mapReceptionError } from '../utils/solicitudesCompraRecepcionUtils';

const CLOSED_STATE = { open: false, loading: false, error: '', items: [] };

const safeEvidence = (evidence) => ({
  id_evidencia: evidence?.id_evidencia,
  tipo_evidencia: evidence?.tipo_evidencia,
  nombre_original: evidence?.nombre_original,
  tipo_archivo: evidence?.tipo_archivo,
  tamano_bytes: evidence?.tamano_bytes,
  fecha_registro: evidence?.fecha_registro,
  usuario_registro: evidence?.usuario_registro,
  url_firmada: /^https?:\/\//i.test(String(evidence?.url_firmada || '')) ? evidence.url_firmada : '',
  expira_en_segundos: evidence?.expira_en_segundos
});

export default function useSolicitudCompraEvidencias({ idSolicitud }) {
  const [state, setState] = useState(CLOSED_STATE);
  const requestSequence = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestSequence.current;
    setState((current) => ({ ...current, open: true, loading: true, error: '', items: [] }));
    try {
      const payload = await solicitudesCompraService.getEvidencias(idSolicitud);
      if (requestId !== requestSequence.current) return;
      setState({
        open: true,
        loading: false,
        error: '',
        items: (Array.isArray(payload?.evidencias) ? payload.evidencias : []).map(safeEvidence)
      });
    } catch (error) {
      if (requestId === requestSequence.current) {
        setState({ open: true, loading: false, error: mapReceptionError(error), items: [] });
      }
    }
  }, [idSolicitud]);

  const close = useCallback(() => {
    requestSequence.current += 1;
    setState(CLOSED_STATE);
  }, []);

  useEffect(() => () => {
    requestSequence.current += 1;
  }, []);

  return { ...state, openViewer: load, refreshAccess: load, closeViewer: close };
}
