import { Navigate, useLocation } from 'react-router-dom';
import { usePublicMenuFlow } from '../hooks/usePublicMenuFlow';
import { getFirstBlockedStep } from '../utils/publicMenuGuards';
import { PUBLIC_MENU_BASE_PATH, getPublicMenuPathByStep, getPublicMenuStepFromPath } from './flowSteps';
import { PUBLIC_MENU_STEPS } from '../types/publicMenuTypes';

// Route-level guard that blocks direct access when required previous steps are missing.
const PublicMenuStepGuard = ({ children }) => {
  const { state } = usePublicMenuFlow();
  const location = useLocation();
  const currentStep = getPublicMenuStepFromPath(location.pathname);
  const firstBlockedStep = getFirstBlockedStep(state, currentStep);

  if (firstBlockedStep) {
    const redirectPath = currentStep === PUBLIC_MENU_STEPS.MENU
      ? PUBLIC_MENU_BASE_PATH
      : getPublicMenuPathByStep(firstBlockedStep);

    return (
      <Navigate
        to={{
          pathname: redirectPath,
          search: location.search
        }}
        replace
      />
    );
  }

  return children;
};

export default PublicMenuStepGuard;
