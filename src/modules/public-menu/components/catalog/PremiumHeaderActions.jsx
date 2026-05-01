import { useState } from 'react';
import { PUBLIC_MENU_ORDER_TYPE_OPTIONS } from '../../types/publicMenuTypes';

const getOrderTypeIcon = (orderTypeLabel = '') => {
  const normalized = String(orderTypeLabel || '').toLowerCase();
  if (normalized.includes('delivery') || normalized.includes('domicilio')) return 'bi-truck';
  if (normalized.includes('recoger') || normalized.includes('retiro') || normalized.includes('local')) {
    return 'bi-bag-check-fill';
  }
  if (normalized.includes('restaurante') || normalized.includes('comer') || normalized.includes('mesa')) {
    return 'bi-shop';
  }
  return 'bi-receipt-cutoff';
};

// PremiumHeaderActions: acciones compactas del header premium.
// Muestra iconos pequenos y concentra cambios de contexto en el icono de ubicacion.
// Props:
// - branchName/orderTypeLabel: contexto actual para accesibilidad y menu.
// - onChangeBranch/onChangeOrderType: handlers existentes del flujo.
// - cartCount: total de items del carrito para badge visual.
const PremiumHeaderActions = ({
  branchName = 'Sucursal',
  branchId = null,
  orderTypeLabel = 'Pedido',
  orderType = '',
  onChangeBranch,
  onSelectBranch,
  branches = [],
  branchesLoading = false,
  branchesError = '',
  onReloadBranches,
  onChangeOrderType,
  cartCount = 0,
  onHomeClick,
  onUserClick,
  onCartClick,
  greetingName = '',
  theme = 'dark',
  onToggleTheme
}) => {
  const [locationMenuOpen, setLocationMenuOpen] = useState(false);
  const [orderTypeMenuOpen, setOrderTypeMenuOpen] = useState(false);
  const orderTypeIcon = getOrderTypeIcon(orderTypeLabel);
  const hasBranchList = Array.isArray(branches) && branches.length > 0;

  const handleSelectOrderType = (nextOrderType) => {
    setOrderTypeMenuOpen(false);
    onChangeOrderType?.(nextOrderType);
  };

  const handleUserClick = () => {
    setLocationMenuOpen(false);
    setOrderTypeMenuOpen(false);
    onUserClick?.();
  };

  return (
    <div className="pm-premium-header__actions">
      <button
        type="button"
        className="pm-premium-header__icon-btn pm-premium-header__theme-btn"
        onClick={onToggleTheme}
        aria-label={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
        title={theme === 'light' ? 'Modo oscuro' : 'Modo claro'}
      >
        <i className={`bi ${theme === 'light' ? 'bi-moon-stars-fill' : 'bi-sun-fill'}`} aria-hidden="true" />
      </button>

      <div className="pm-premium-header__location-menu-wrap">
        <button
          type="button"
          className="pm-premium-header__icon-btn"
          aria-label={`Sucursal: ${branchName}`}
          title={branchName}
          onClick={() => {
            setOrderTypeMenuOpen(false);
            setLocationMenuOpen((prev) => !prev);
          }}
        >
          <i className="bi bi-geo-alt-fill" aria-hidden="true" />
        </button>

        {locationMenuOpen ? (
          <div className="pm-premium-header__location-menu" role="menu" aria-label="Sucursales disponibles">
            <div className="pm-premium-header__location-menu-title">
              <i className="bi bi-geo-alt-fill" aria-hidden="true" />
              <span>Sucursales</span>
            </div>

            {branchesLoading ? (
              <div className="pm-premium-header__location-menu-state">Cargando sucursales...</div>
            ) : null}

            {!branchesLoading && branchesError ? (
              <button
                type="button"
                className="pm-premium-header__location-menu-item"
                onClick={() => onReloadBranches?.()}
              >
                <i className="bi bi-arrow-clockwise" aria-hidden="true" />
                <span>Reintentar carga</span>
              </button>
            ) : null}

            {!branchesLoading && !branchesError && hasBranchList ? (
              branches.map((branch) => {
                const isCurrent = Number(branch?.id || 0) === Number(branchId || 0);
                return (
                  <button
                    type="button"
                    key={branch.id}
                    className={`pm-premium-header__location-menu-item ${isCurrent ? 'is-current' : ''}`}
                    onClick={() => {
                      setLocationMenuOpen(false);
                      onSelectBranch?.(branch);
                    }}
                  >
                    <i className="bi bi-shop" aria-hidden="true" />
                    <span>{branch.displayName || branch.name || 'Sucursal'}</span>
                  </button>
                );
              })
            ) : null}

            {!branchesLoading && !branchesError && !hasBranchList ? (
              <button
                type="button"
                className="pm-premium-header__location-menu-item"
                onClick={() => {
                  setLocationMenuOpen(false);
                  onChangeBranch?.();
                }}
              >
                <i className="bi bi-geo-alt-fill" aria-hidden="true" />
                <span>Buscar sucursal</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        className="pm-premium-header__icon-btn"
        onClick={() => {
          setLocationMenuOpen(false);
          setOrderTypeMenuOpen((prev) => !prev);
        }}
        aria-label={`Tipo de pedido: ${orderTypeLabel}`}
        title={`Tipo de pedido: ${orderTypeLabel}`}
        aria-expanded={orderTypeMenuOpen}
      >
        <i className={`bi ${orderTypeIcon}`} aria-hidden="true" />
      </button>

      {orderTypeMenuOpen ? (
        <div className="pm-premium-header__order-type-menu" role="menu" aria-label="Tipos de pedido">
          <div className="pm-premium-header__location-menu-title">
            <i className="bi bi-receipt-cutoff" aria-hidden="true" />
            <span>Tipo de pedido</span>
          </div>

          {PUBLIC_MENU_ORDER_TYPE_OPTIONS.map((option) => {
            const isCurrent = option.id === orderType;
            return (
              <button
                type="button"
                key={option.id}
                className={`pm-premium-header__location-menu-item ${isCurrent ? 'is-current' : ''}`}
                onClick={() => handleSelectOrderType(option.id)}
              >
                <i className={`bi ${getOrderTypeIcon(option.title)}`} aria-hidden="true" />
                <span>{option.title}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      <button type="button" className="pm-premium-header__icon-btn" onClick={onHomeClick} aria-label="Inicio">
        <i className="bi bi-house-door-fill" aria-hidden="true" />
      </button>

      <button
        type="button"
        className={`pm-premium-header__icon-btn ${greetingName ? 'pm-premium-header__user-btn' : ''}`}
        onClick={handleUserClick}
        aria-label={greetingName ? `Usuario ${greetingName}` : 'Iniciar sesion'}
        title={greetingName ? `Hola, ${greetingName}` : 'Iniciar sesion'}
      >
        {greetingName ? (
          <span className="pm-premium-header__user-name">
            Hola, {greetingName}
          </span>
        ) : null}
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
