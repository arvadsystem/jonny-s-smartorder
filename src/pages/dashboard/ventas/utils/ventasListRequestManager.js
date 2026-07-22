export const createVentasListRequestManager = () => {
  let sequence = 0;
  let activeRequest = null;

  return {
    start() {
      activeRequest?.controller.abort();
      const request = {
        id: ++sequence,
        controller: new AbortController()
      };
      activeRequest = request;
      return request;
    },
    isCurrent(request) {
      return Boolean(
        request &&
        activeRequest &&
        request.id === activeRequest.id &&
        request.controller === activeRequest.controller &&
        !request.controller.signal.aborted
      );
    },
    finish(request) {
      if (!this.isCurrent(request)) return false;
      activeRequest = null;
      return true;
    },
    abort() {
      activeRequest?.controller.abort();
      activeRequest = null;
    }
  };
};

export const isCancelledVentasListRequest = (error, request, manager) => Boolean(
  request?.controller?.signal?.aborted ||
  !manager?.isCurrent(request) ||
  error?.name === 'AbortError' ||
  error?.code === 'ABORT_ERR'
);

export const scheduleVentasActiveTabLoad = (callback) => {
  let cancelled = false;
  queueMicrotask(() => {
    if (!cancelled) callback();
  });
  return () => {
    cancelled = true;
  };
};

export const abortVentasListAndResetLoading = (manager, setLoading) => {
  manager?.abort();
  setLoading(false);
};
