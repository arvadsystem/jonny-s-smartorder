import { useEffect, useRef, useState } from 'react';
import ventasService from '../../../../services/ventasService';
import { resolveVentasApiErrorMessage } from '../utils/ventasHelpers';
import { isValidReversionPayload, stableReversionPayload } from '../utils/ventaReversionFlow';

export default function useVentaReversionPreview({ open, idFactura, payload, enabled }) {
  const [state, setState] = useState({
    signature: '',
    preview: null,
    loading: false,
    error: ''
  });
  const requestIdRef = useRef(0);
  const signature = stableReversionPayload(payload);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    if (!open || !idFactura || !enabled || !isValidReversionPayload(payload)) {
      return undefined;
    }
    const controller = new AbortController();
    Promise.resolve().then(() => {
      if (!controller.signal.aborted && requestId === requestIdRef.current) {
        setState({ signature, preview: null, loading: true, error: '' });
      }
    });
    const timer = window.setTimeout(() => {
      ventasService.previewReversion(idFactura, payload, { signal: controller.signal })
        .then((response) => {
          if (requestId === requestIdRef.current) {
            setState({ signature, preview: response?.data || response, loading: false, error: '' });
          }
        })
        .catch((requestError) => {
          if (
            requestId === requestIdRef.current
            && requestError?.code !== 'REQUEST_ABORTED'
            && requestError?.name !== 'AbortError'
          ) {
            setState({
              signature,
              preview: null,
              loading: false,
              error: resolveVentasApiErrorMessage(requestError, 'No se pudo calcular la vista previa.')
            });
          }
        })
        .finally(() => {
          if (requestId === requestIdRef.current) {
            setState((current) => current.signature === signature
              ? { ...current, loading: false }
              : current);
          }
        });
    }, 400);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, idFactura, open, payload, signature]);

  const valid = open && enabled && state.signature === signature;
  return {
    preview: valid ? state.preview : null,
    loading: Boolean(valid ? state.loading : (open && enabled && isValidReversionPayload(payload))),
    error: valid ? state.error : '',
    signature
  };
}
