import { useState } from 'react';

// PremiumHeaderActions: acciones compactas del header premium.
// Muestra iconos pequenos y concentra cambios de contexto en el icono de ubicacion.
// Props:
// - branchName/orderTypeLabel: contexto actual para accesibilidad y menu.
// - onChangeBranch/onChangeOrderType: handlers existentes del flujo.
// - cartCount: total de items del carrito para badge visual.
const PremiumHeaderActions = ({
  branchName = 'Sucursal',
  orderTypeLabel = 'Pedido',
  onChangeBranch,
  onChangeOrderType,
  cartCount = 0,
  onHomeClick,
  onUserClick,
  onCartClick
}) => {
  const [locationMenuOpen, setLocationMenuOpen] = useState(false);

  return (
    <div className="pm-premium-header__actions">
      <div className="pm-premium-header__location-menu-wrap">
        <button
          type="button"
          className="pm-premium-header__icon-btn"
          aria-label={`Sucursal: ${branchName} · ${orderTypeLabel}`}
          title={`${branchName} · ${orderTypeLabel}`}
          onClick={() => setLocationMenuOpen((prev) => !prev)}
        >
          <i className="bi bi-geo-alt-fill" aria-hidden="true" />
        </button>

        {locationMenuOpen ? (
          <div className="pm-premium-header__location-menu" role="menu" aria-label="Opciones de pedido">
            <button
              type="button"
              className="pm-premium-header__location-menu-item"
              onClick={() => {
                setLocationMenuOpen(false);
                onChangeBranch?.();
              }}
            >
              Cambiar sucursal
            </button>
            <button
              type="button"
              className="pm-premium-header__location-menu-item"
              onClick={() => {
                setLocationMenuOpen(false);
                onChangeOrderType?.();
              }}
            >
              Cambiar tipo de pedido
            </button>
          </div>
        ) : null}
      </div>

      <button type="button" className="pm-premium-header__icon-btn" onClick={onHomeClick} aria-label="Inicio">
        <i className="bi bi-house-door-fill" aria-hidden="true" />
      </button>

      <button type="button" className="pm-premium-header__icon-btn" onClick={onUserClick} aria-label="Iniciar sesion">
        <i className="bi bi-person-fill" aria-hidden="true" />
      </button>

      <button type="button" className="pm-premium-header__icon-btn pm-premium-header__cart-btn" onClick={onCartClick} aria-label="Carrito">
        <i className="bi bi-cart3" aria-hidden="true" />
        {cartCount > 0 ? <span className="pm-premium-header__cart-badge">{cartCount}</span> : null}
      </button>
    </div>
  );
};

export default PremiumHeaderActions;
