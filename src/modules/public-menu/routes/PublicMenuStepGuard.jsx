import { Navigate, useLocation } from 'react-router-dom';
import { usePublicMenuFlow } from '../hooks/usePublicMenuFlow';
import { getFirstBlockedStep } from '../utils/publicMenuGuards';
import { getPublicMenuPathByStep, getPublicMenuStepFromPath } from './flowSteps';

// Route-level guard that blocks direct access when required previous steps are missing.
const PublicMenuStepGuard = ({ children }) => {
  const { state } = usePublicMenuFlow();
  const location = useLocation();
  const currentStep = getPublicMenuStepFromPath(location.pathname);
  const firstBlockedStep = getFirstBlockedStep(state, currentStep);

  if (firstBlockedStep) {
    return (
      <Navigate
        to={{
          pathname: getPublicMenuPathByStep(firstBlockedStep),
          search: location.search
        }}
        replace
      />
    );
  }

  return children;
};

export default PublicMenuStepGuard;
