const AuthRequiredModal = ({
  open,
  onLogin,
  onClose
}) => {
  if (!open) return null;

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
          <span className="pm-auth-required-modal__eyebrow">PEDIDO CASI LISTO</span>
          <h2 id="pm-auth-required-title">Envíalo en pocos segundos...</h2>
          <div className="pm-auth-required-modal__message">
            <svg
              className="pm-auth-required-modal__message-trace"
              viewBox="0 0 420 62"
              preserveAspectRatio="none"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M 210 1 H 401 Q 419 1 419 19 V 43 Q 419 61 401 61 H 19 Q 1 61 1 43 V 19 Q 1 1 19 1 H 210"
                pathLength="100"
              />
            </svg>
            <p>
              Únete al club Jonny’s para enviar tu pedido
              <br />
              al restaurante, guardar tus datos y recibir
              <br />
              beneficios en próximas compras.
            </p>
          </div>
        </div>

        <div className="pm-auth-required-modal__actions">
          <button type="button" className="pm-auth-required-modal__primary" onClick={onLogin}>
            <i className="bi bi-box-arrow-in-right" aria-hidden="true" />
            <span>Continuar y confirmar</span>
          </button>
          <button type="button" className="pm-auth-required-modal__secondary" onClick={onClose}>
            Seguir viendo menú
          </button>
        </div>

        <p className="pm-auth-required-modal__benefits">
          <span>Pedidos más rápidos</span>
          <span aria-hidden="true">•</span>
          <span>Historial</span>
          <span aria-hidden="true">•</span>
          <span>Promociones futuras</span>
        </p>
      </section>
    </div>
  );
};

export default AuthRequiredModal;
