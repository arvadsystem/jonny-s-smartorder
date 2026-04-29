import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import PublicMenuFlowShell from '../components/layout/PublicMenuFlowShell';
import MenuLandingScreen from '../screens/MenuLandingScreen';
import OrderTypeScreen from '../screens/OrderTypeScreen';
import CatalogScreen from '../screens/CatalogScreen';
import { usePublicMenuFlow } from '../hooks/usePublicMenuFlow';
import PublicMenuStepGuard from './PublicMenuStepGuard';
import { PublicMenuFlowProvider } from '../store/PublicMenuFlowStore';
import { PUBLIC_MENU_STEPS } from '../types/publicMenuTypes';
import { getPublicMenuPathByStep } from './flowSteps';

import '../publicMenu.css';

const RedirectToBestStep = () => {
  const location = useLocation();
  const { selectors } = usePublicMenuFlow();

  const targetStep = selectors.hasBranchSelected
    ? (selectors.hasOrderTypeSelected ? PUBLIC_MENU_STEPS.MENU : PUBLIC_MENU_STEPS.ORDER_TYPE)
    : null;

  if (!targetStep) {
    return <Navigate to={{ pathname: '.', search: location.search }} replace />;
  }

  return (
    <Navigate
      to={{
        pathname: getPublicMenuPathByStep(targetStep).replace('/menu-publico/', ''),
        search: location.search
      }}
      replace
    />
  );
};

// Public module router isolated under /menu-publico/*
const PublicMenuRoutes = () => (
  <PublicMenuFlowProvider>
    <Routes>
      <Route element={<PublicMenuFlowShell />}>
        <Route index element={<MenuLandingScreen />} />
        <Route path="sucursal" element={<Navigate to=".." replace />} />

        <Route
          path="tipo-pedido"
          element={
            <PublicMenuStepGuard>
              <OrderTypeScreen />
            </PublicMenuStepGuard>
          }
        />

        <Route
          path="menu"
          element={
            <PublicMenuStepGuard>
              <CatalogScreen />
            </PublicMenuStepGuard>
          }
        />

        <Route path="*" element={<RedirectToBestStep />} />
      </Route>
    </Routes>
  </PublicMenuFlowProvider>
);

export default PublicMenuRoutes;
