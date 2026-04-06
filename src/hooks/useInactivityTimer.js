import { useCallback, useEffect, useRef, useState } from 'react';

const INACTIVITY_EVENTS = Object.freeze(['mousemove', 'keydown', 'scroll', 'touchstart']);
const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000;
const DEFAULT_WARNING_MS = 2 * 60 * 1000;

const addInactivityListeners = (handler) => {
  const listenerOptions = { passive: true };
  INACTIVITY_EVENTS.forEach((eventName) => {
    window.addEventListener(eventName, handler, listenerOptions);
  });
};

const removeInactivityListeners = (handler) => {
  INACTIVITY_EVENTS.forEach((eventName) => {
    window.removeEventListener(eventName, handler);
  });
};

export const useInactivityTimer = ({
  enabled = true,
  onTimeout,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  warningMs = DEFAULT_WARNING_MS
} = {}) => {
  const [isWarningVisible, setWarningVisible] = useState(false);
  const [remainingMs, setRemainingMs] = useState(warningMs);

  const timeoutRef = useRef(null);
  const warningRef = useRef(null);
  const countdownRef = useRef(null);
  const expiresAtRef = useRef(0);
  const warningVisibleRef = useRef(false);
  const onTimeoutRef = useRef(onTimeout);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    warningVisibleRef.current = isWarningVisible;
  }, [isWarningVisible]);

  const clearCountdown = useCallback(() => {
    if (countdownRef.current) {
      window.clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const clearTimers = useCallback(() => {
    if (warningRef.current) {
      window.clearTimeout(warningRef.current);
      warningRef.current = null;
    }

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    clearCountdown();
  }, [clearCountdown]);

  const updateRemaining = useCallback(() => {
    const nextMs = Math.max(0, expiresAtRef.current - Date.now());
    setRemainingMs(nextMs);
  }, []);

  const openWarning = useCallback(() => {
    setWarningVisible(true);
    updateRemaining();
    clearCountdown();
    countdownRef.current = window.setInterval(updateRemaining, 1000);
  }, [clearCountdown, updateRemaining]);

  const triggerTimeout = useCallback(() => {
    setWarningVisible(false);
    clearTimers();
    onTimeoutRef.current?.();
  }, [clearTimers]);

  const resetTimer = useCallback(() => {
    if (!enabled) return;

    clearTimers();
    setWarningVisible(false);
    setRemainingMs(warningMs);

    expiresAtRef.current = Date.now() + timeoutMs;

    const warningDelay = Math.max(0, timeoutMs - warningMs);
    warningRef.current = window.setTimeout(openWarning, warningDelay);
    timeoutRef.current = window.setTimeout(triggerTimeout, timeoutMs);
  }, [clearTimers, enabled, openWarning, timeoutMs, triggerTimeout, warningMs]);

  const keepAlive = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    if (!enabled) {
      clearTimers();
      return undefined;
    }

    const handleActivity = () => {
      // Una vez visible el modal de advertencia, la renovacion
      // se confirma solo con "Seguir conectado".
      if (warningVisibleRef.current) return;
      resetTimer();
    };

    addInactivityListeners(handleActivity);
    const bootTimer = window.setTimeout(() => {
      resetTimer();
    }, 0);

    return () => {
      window.clearTimeout(bootTimer);
      removeInactivityListeners(handleActivity);
      clearTimers();
    };
  }, [clearTimers, enabled, resetTimer, warningMs]);

  return {
    isWarningVisible,
    remainingMs,
    keepAlive,
    forceReset: resetTimer
  };
};

export default useInactivityTimer;
