import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import PublicHeader from './PublicHeader';
import StickyActionBar from './StickyActionBar';
import ConfirmModal from '../feedback/ConfirmModal';
import ToastHost from '../feedback/ToastHost';
import { useAuth } from '../../../../hooks/useAuth';
import { usePublicMenuFlow } from '../../hooks/usePublicMenuFlow';
import { PUBLIC_MENU_STEPS } from '../../types/publicMenuTypes';
import {
  getPublicMenuPathByStep,
  getPublicMenuStepFromPath,
  PUBLIC_MENU_STEP_ORDER
} from '../../routes/flowSteps';

const STEP_COPY = {
  [PUBLIC_MENU_STEPS.BRANCH]: {
    title: 'Menu',
    subtitle: 'Elige la sucursal donde deseas pedir.'
  },
  [PUBLIC_MENU_STEPS.ORDER_TYPE]: {
    title: 'Tipo de pedido',
    subtitle: 'Selecciona como quieres recibir tu pedido.'
  },
  [PUBLIC_MENU_STEPS.MENU]: {
    title: 'Catalogo',
    subtitle: 'Explora categorias y productos disponibles en tiempo real.'
  }
};

// Shell keeps step navigation and sticky actions centralized.
const PublicMenuFlowShell = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { state, actions, selectors } = usePublicMenuFlow();
  const currentStep = getPublicMenuStepFromPath(location.pathname);
  const currentStepIndex = PUBLIC_MENU_STEP_ORDER.indexOf(currentStep);
  const normalizedPath = String(location.pathname || '').replace(/\/+$/, '');
  const isLandingView = normalizedPath === '/menu-publico' || normalizedPath === '';
  const [orderTypeActionArmed, setOrderTypeActionArmed] = useState(true);

  const stepMeta = STEP_COPY[currentStep] || STEP_COPY[PUBLIC_MENU_STEPS.BRANCH];
  const hasPreviousStep = currentStepIndex > 0;

  // Evita salto accidental en movil cuando el boton "Continuar" se habilita
  // en el mismo toque que selecciona metodo de pago.
  useEffect(() => {
    if (currentStep !== PUBLIC_MENU_STEPS.ORDER_TYPE) {
      setOrderTypeActionArmed(true);
      return;
    }
    setOrderTypeActionArmed(false);
    const timer = window.setTimeout(() => setOrderTypeActionArmed(true), 350);
    return () => window.clearTimeout(timer);
  }, [currentStep, state.orderType, state.pickupPaymentMethod]);

  const getPrimaryAction = () => {
    if (currentStep === PUBLIC_MENU_STEPS.BRANCH) return null;

    if (currentStep === PUBLIC_MENU_STEPS.ORDER_TYPE) {
      const needsPickupPaymentMethod =
        state.orderType === 'pickup' &&
        !['caja', 'transferencia'].includes(
          String(state.pickupPaymentMethod || '').trim().toLowerCase()
        );
      return {
        label: 'Continuar',
        disabled: !selectors.hasRequiredOrderContext || !orderTypeActionArmed,
        helper: !selectors.hasOrderTypeSelected
          ? 'Selecciona un tipo de pedido'
          : (needsPickupPaymentMethod ? 'Selecciona metodo de pago para retiro en local' : ''),
        onClick: () => navigate(getPublicMenuPathByStep(PUBLIC_MENU_STEPS.MENU))
      };
    }

    return null;
  };

  const primaryAction = getPrimaryAction();

  const handleBack = () => {
    if (!hasPreviousStep) return;
    // En el paso de catalogo regresamos directo al selector de sucursal.
    if (currentStep === PUBLIC_MENU_STEPS.MENU) {
      navigate(getPublicMenuPathByStep(PUBLIC_MENU_STEPS.BRANCH));
      return;
    }
    const previousStep = PUBLIC_MENU_STEP_ORDER[currentStepIndex - 1];
    navigate(getPublicMenuPathByStep(previousStep));
  };

  const handleResetFlow = () => {
    actions.resetFlow();
    actions.closeConfirm();
    actions.pushToast({
      type: 'success',
      message: 'Reiniciamos tu seleccion de pedido.'
    });
    navigate(getPublicMenuPathByStep(PUBLIC_MENU_STEPS.BRANCH));
  };

  return (
    <div className="pm-shell">
      {!isLandingView && currentStep !== PUBLIC_MENU_STEPS.MENU ? (
        <PublicHeader
          title={stepMeta.title}
          subtitle={stepMeta.subtitle}
          onBack={hasPreviousStep ? handleBack : null}
          branchName={state.selectedBranch?.name}
          actions={
            <div className="pm-shell__header-actions">
              {user ? (
                <button
                  type="button"
                  className="pm-shell__header-btn"
                  onClick={() => {
                    logout();
                    navigate('/menu-publico');
                  }}
                >
                  <i className="bi bi-box-arrow-right" aria-hidden="true" />
                  <span>Cerrar Sesion</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="pm-shell__header-btn pm-shell__header-btn--wide"
                  onClick={() => navigate('/auth/login?from=public-menu')}
                >
                  <i className="bi bi-person-fill" aria-hidden="true" />
                  <span>Iniciar Sesion</span>
                </button>
              )}

              <button
                type="button"
                className="pm-shell__header-btn pm-shell__header-btn--wide"
                onClick={() =>
                  actions.openConfirm({
                    title: 'Volver al inicio',
                    message:
                      'Si vuelves al inicio se perderan la sucursal, el tipo de pedido y los productos agregados al carrito.',
                    confirmLabel: 'Si, volver al inicio'
                  })
                }
              >
                <i className="bi bi-house-door-fill" aria-hidden="true" />
                <span>Inicio</span>
              </button>
            </div>
          }
        />
      ) : null}

      <main
        className={`pm-shell__content ${currentStep === PUBLIC_MENU_STEPS.MENU ? 'pm-shell__content--catalog' : ''}`}
      >
        <Outlet />
      </main>

      {primaryAction ? (
        <StickyActionBar
          primaryLabel={primaryAction.label}
          primaryDisabled={primaryAction.disabled}
          onPrimary={primaryAction.onClick}
          hideSecondary={!hasPreviousStep}
          onSecondary={handleBack}
          helperText={primaryAction.helper}
        />
      ) : null}

      <ConfirmModal
        open={state.ui.confirm.isOpen}
        title={state.ui.confirm.title}
        message={state.ui.confirm.message}
        confirmLabel={state.ui.confirm.confirmLabel}
        onConfirm={handleResetFlow}
        onCancel={actions.closeConfirm}
      />

      <ToastHost toasts={state.ui.toasts} onDismiss={actions.dismissToast} />
    </div>
  );
};

export default PublicMenuFlowShell;
