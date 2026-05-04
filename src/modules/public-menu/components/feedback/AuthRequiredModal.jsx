const AuthRequiredModal = ({
  open,
  message = '',
  onLogin,
  onClose
}) => {
  if (!open) return null;

  const cleanMessage = String(message || '')
    .replace(/\s*\(Ref:\s*[^)]+\)\s*$/i, '')
    .trim();

  return (
    <div className="pm-auth-required-modal__backdrop" role="presentation" onClick={onClose}>
      <section
        className="pm-auth-required-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pm-auth-required-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="pm-auth-required-modal__close"
          onClick={onClose}
          aria-label="Cerrar aviso"
        >
          <i className="bi bi-x-lg" aria-hidden="true" />
        </button>

        <div className="pm-auth-required-modal__icon" aria-hidden="true">
          <i className="bi bi-person-lock" />
        </div>

        <div className="pm-auth-required-modal__content">
          <span className="pm-auth-required-modal__eyebrow">Pedido pendiente</span>
          <h2 id="pm-auth-required-title">Inicia Sesión para enviar tu pedido</h2>
          <p>{cleanMessage || 'Tu sesión de cliente no es válida. Inicia sesión para confirmar el pedido.'}</p>
        </div>

        <div className="pm-auth-required-modal__actions">
          <button type="button" className="pm-auth-required-modal__primary" onClick={onLogin}>
            <i className="bi bi-box-arrow-in-right" aria-hidden="true" />
            <span>Iniciar Sesión</span>
          </button>
          <button type="button" className="pm-auth-required-modal__secondary" onClick={onClose}>
            Seguir viendo menú
          </button>
        </div>
      </section>
    </div>
  );
};

export default AuthRequiredModal;
