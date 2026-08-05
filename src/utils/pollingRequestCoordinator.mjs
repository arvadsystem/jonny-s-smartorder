export const POLLING_BASE_DELAY_MS = 10_000;
export const POLLING_MAX_DELAY_MS = 60_000;

export const calculatePollingDelay = (
  consecutiveFailures,
  baseDelayMs = POLLING_BASE_DELAY_MS,
  maxDelayMs = POLLING_MAX_DELAY_MS
) => {
  const failures = Math.max(0, Number.parseInt(String(consecutiveFailures ?? 0), 10) || 0);
  const base = Math.max(1, Number(baseDelayMs) || POLLING_BASE_DELAY_MS);
  const max = Math.max(base, Number(maxDelayMs) || POLLING_MAX_DELAY_MS);
  return Math.min(max, base * (2 ** failures));
};

export const createPollingRequestCoordinator = ({
  baseDelayMs = POLLING_BASE_DELAY_MS,
  maxDelayMs = POLLING_MAX_DELAY_MS
} = {}) => {
  let generation = 0;
  let activeToken = null;
  let consecutiveFailures = 0;

  const begin = (scopeKey = 'default') => {
    if (activeToken) return null;
    const token = {
      id: ++generation,
      scopeKey: String(scopeKey || 'default'),
      controller: new AbortController()
    };
    activeToken = token;
    return token;
  };

  const isCurrent = (token) => Boolean(
    token && activeToken === token && token.id === generation && !token.controller.signal.aborted
  );

  const finish = (token, { success }) => {
    if (!isCurrent(token)) return false;
    activeToken = null;
    consecutiveFailures = success ? 0 : consecutiveFailures + 1;
    return true;
  };

  const cancel = () => {
    generation += 1;
    if (activeToken && !activeToken.controller.signal.aborted) {
      activeToken.controller.abort();
    }
    activeToken = null;
  };

  const reset = () => {
    cancel();
    consecutiveFailures = 0;
  };

  return {
    begin,
    isCurrent,
    finish,
    cancel,
    reset,
    hasActiveRequest: () => Boolean(activeToken),
    getConsecutiveFailures: () => consecutiveFailures,
    getNextDelay: () => calculatePollingDelay(consecutiveFailures, baseDelayMs, maxDelayMs)
  };
};
