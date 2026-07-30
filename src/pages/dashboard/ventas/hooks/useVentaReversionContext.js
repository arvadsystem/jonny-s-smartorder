import { useCallback, useEffect, useState } from 'react';
import ventasService from '../../../../services/ventasService';
import { resolveVentasApiErrorMessage } from '../utils/ventasHelpers';

export default function useVentaReversionContext({ open, idFactura }) {
  const [contextState, setContextState] = useState({ id: null, value: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((value) => value + 1), []);

  useEffect(() => {
    if (!open || !idFactura) {
      return undefined;
    }
    const controller = new AbortController();
    Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        setLoading(true);
        setError('');
      }
    });
    ventasService.getReversionContext(idFactura, { signal: controller.signal })
      .then((response) => setContextState({ id: idFactura, value: response?.data || response }))
      .catch((requestError) => {
        if (requestError?.code !== 'REQUEST_ABORTED' && requestError?.name !== 'AbortError') {
          setError(resolveVentasApiErrorMessage(requestError, 'No se pudo verificar la disponibilidad de reversión.'));
          setContextState({ id: idFactura, value: null });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [idFactura, open, reloadToken]);

  const context = open && contextState.id === idFactura ? contextState.value : null;
  return { context, loading: Boolean(open && idFactura && loading), error: open ? error : '', reload };
}
