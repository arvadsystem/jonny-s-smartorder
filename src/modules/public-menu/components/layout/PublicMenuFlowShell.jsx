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
    title: 'Menu publico',
    subtitle: 'Primero elige la sucursal donde deseas pedir.'
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

  const stepMeta = STEP_COPY[currentStep] || STEP_COPY[PUBLIC_MENU_STEPS.BRANCH];
  const hasPreviousStep = currentStepIndex > 0;

  const getPrimaryAction = () => {
    if (currentStep === PUBLIC_MENU_STEPS.BRANCH) return null;

    if (currentStep === PUBLIC_MENU_STEPS.ORDER_TYPE) {
      return {
        label: 'Continuar',
        disabled: !selectors.hasOrderTypeSelected,
        helper: selectors.hasOrderTypeSelected ? '' : 'Selecciona un tipo de pedido',
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
      <PublicHeader
        title={stepMeta.title}
        subtitle={stepMeta.subtitle}
        onBack={hasPreviousStep ? handleBack : null}
        branchName={state.selectedBranch?.name}
      />

      <main className="pm-shell__content">
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

      <button
        type="button"
        className="pm-shell__reset-btn"
        onClick={() =>
          actions.openConfirm({
            title: 'Reiniciar flujo',
            message: 'Se perdera la sucursal y tipo de pedido seleccionados.',
            confirmLabel: 'Si, reiniciar'
          })
        }
      >
        Reiniciar flujo
      </button>

      {/* Botón provisional solicitado para iniciar sesión / Cerrar sesión */}
      {user ? (
        <button
          type="button"
          className="pm-shell__reset-btn"
          style={{ right: '140px', background: 'white', color: '#dc2626', fontWeight: 'bold', padding: '0.4rem 0.8rem', borderRadius: '4px' }}
          onClick={() => {
            logout();
            navigate('/menu-publico');
          }}
        >
          <i className="bi bi-box-arrow-right" style={{ marginRight: '6px' }}></i>
          Cerrar Sesión
        </button>
      ) : (
        <button
          type="button"
          className="pm-shell__reset-btn"
          style={{ right: '140px', background: 'white', color: '#311008', fontWeight: 'bold', padding: '0.4rem 0.8rem', borderRadius: '4px' }}
          onClick={() => navigate('/auth/login')}
        >
          <i className="bi bi-person-fill" style={{ marginRight: '6px' }}></i>
          Iniciar Sesión
        </button>
      )}

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
