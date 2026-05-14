import { useEffect } from 'react';

// Toast renderer kept dumb and fully controlled via props.
const ToastHost = ({ toasts = [], onDismiss }) => {
  useEffect(() => {
    const timers = toasts.map((toast) =>
      window.setTimeout(() => onDismiss?.(toast.id), toast.durationMs || 3000)
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [toasts, onDismiss]);

  if (!toasts.length) return null;

  return (
    <aside className="pm-toast-host" aria-live="assertive">
      {toasts.map((toast) => (
        <article key={toast.id} className={`pm-toast pm-toast--${toast.type}`}>
          <p className="pm-toast__message">{toast.message}</p>
          <button
            type="button"
            className="pm-toast__close"
            aria-label="Cerrar mensaje"
            onClick={() => onDismiss?.(toast.id)}
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </article>
      ))}
    </aside>
  );
};

export default ToastHost;

