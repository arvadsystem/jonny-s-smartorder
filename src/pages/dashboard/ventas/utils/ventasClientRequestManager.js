export const createVentasClientRequestManager = () => {
  let sequence = 0;
  let activeRequest = null;

  return {
    start(search = '') {
      activeRequest?.controller.abort();
      const request = {
        id: ++sequence,
        search: String(search || '').trim(),
        controller: new AbortController()
      };
      activeRequest = request;
      return request;
    },
    isCurrent(request) {
      return Boolean(
        request
        && activeRequest
        && request.id === activeRequest.id
        && request.search === activeRequest.search
        && request.controller === activeRequest.controller
        && !request.controller.signal.aborted
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

export const isCancelledVentasClientRequest = (error, signal) => Boolean(
  signal?.aborted
  || error?.name === 'AbortError'
  || error?.code === 'ABORT_ERR'
);

