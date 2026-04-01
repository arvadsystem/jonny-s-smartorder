import { useEffect, useState } from 'react';

// Toast ligero reutilizable para confirmar acciones exitosas del modulo menu.
const MenuActionToast = ({
  message = '',
  title = 'Operacion realizada',
  variant = 'success',
  durationMs = 3200,
  onClose
}) => {
  const [visible, setVisible] = useState(Boolean(message));

  useEffect(() => {
    setVisible(Boolean(message));
  }, [message]);

  useEffect(() => {
    if (!visible) return undefined;
    const timer = setTimeout(() => {
      setVisible(false);
      onClose?.();
    }, Math.max(1200, Number(durationMs || 0)));
    return () => clearTimeout(timer);
  }, [visible, durationMs, onClose]);

  if (!visible || !message) return null;

  const isError = variant === 'danger' || variant === 'error';
  const wrapperStyle = { zIndex: 1200 };
  const cardClass = isError ? 'alert alert-danger shadow' : 'alert alert-success shadow';
  const iconClass = isError ? 'bi bi-x-circle-fill' : 'bi bi-check-circle-fill';

  return (
    <div className="position-fixed bottom-0 end-0 p-3" style={wrapperStyle} role="status" aria-live="polite">
      <div className={cardClass} style={{ minWidth: 280, maxWidth: 420 }}>
        <div className="d-flex align-items-start gap-2">
          <i className={iconClass} aria-hidden="true" />
          <div className="flex-grow-1">
            <div className="fw-semibold">{title}</div>
            <div className="small">{message}</div>
          </div>
          <button
            type="button"
            className="btn-close"
            aria-label="Cerrar notificacion"
            onClick={() => {
              setVisible(false);
              onClose?.();
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default MenuActionToast;
