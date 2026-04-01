import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import PublicMenuFlowShell from '../components/layout/PublicMenuFlowShell';
import BranchSelectionScreen from '../screens/BranchSelectionScreen';
import OrderTypeScreen from '../screens/OrderTypeScreen';
import CatalogScreen from '../screens/CatalogScreen';
import PublicMenuStepGuard from './PublicMenuStepGuard';
import { PublicMenuFlowProvider } from '../store/PublicMenuFlowStore';

import '../publicMenu.css';

const RedirectToBranch = () => {
  const location = useLocation();
  return <Navigate to={{ pathname: 'sucursal', search: location.search }} replace />;
};

// Public module router isolated under /menu-publico/*
const PublicMenuRoutes = () => (
  <PublicMenuFlowProvider>
    <Routes>
      <Route element={<PublicMenuFlowShell />}>
        <Route index element={<RedirectToBranch />} />
        <Route path="sucursal" element={<BranchSelectionScreen />} />

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

        <Route path="*" element={<RedirectToBranch />} />
      </Route>
    </Routes>
  </PublicMenuFlowProvider>
);

export default PublicMenuRoutes;
