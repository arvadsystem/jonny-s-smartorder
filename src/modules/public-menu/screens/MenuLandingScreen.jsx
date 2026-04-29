import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import CatalogSkeleton from '../components/catalog/CatalogSkeleton';
import StateBlock from '../components/feedback/StateBlock';
import { useBranches } from '../hooks/useBranches';
import { usePublicMenuFlow } from '../hooks/usePublicMenuFlow';
import { getPublicMenuPathByStep } from '../routes/flowSteps';
import { PUBLIC_MENU_ORDER_TYPES, PUBLIC_MENU_STEPS } from '../types/publicMenuTypes';

// MenuLandingScreen actua como bootstrap visual minimo del flujo publico.
// No muestra portada: prepara sucursal/tipo por defecto y entra al catalogo premium real.
const MenuLandingScreen = () => {
  const navigate = useNavigate();
  const { state, actions, selectors } = usePublicMenuFlow();
  const { branches, loading, error, reloadBranches } = useBranches();

  // Prioriza sucursal abierta; si no hay, usa la primera disponible.
  const preferredBranch = useMemo(
    () => state.selectedBranch || branches.find((branch) => branch?.isOpen) || branches[0] || null,
    [branches, state.selectedBranch]
  );

  // Sin tocar logica de negocio: solo completa contexto minimo para abrir catalogo.
  useEffect(() => {
    if (!state.selectedBranch?.id && preferredBranch?.id) {
      actions.selectBranch(preferredBranch);
    }
  }, [actions, preferredBranch, state.selectedBranch?.id]);

  // Tipo de pedido por defecto para entrada directa al catalogo.
  useEffect(() => {
    if (!state.orderType) {
      actions.selectOrderType(PUBLIC_MENU_ORDER_TYPES.DINE_IN);
    }
  }, [actions, state.orderType]);

  // Cuando hay contexto valido, entra directo al catalogo premium.
  useEffect(() => {
    if (!selectors.hasBranchSelected || !selectors.hasRequiredOrderContext) return;
    navigate(getPublicMenuPathByStep(PUBLIC_MENU_STEPS.MENU), { replace: true });
  }, [navigate, selectors.hasBranchSelected, selectors.hasRequiredOrderContext]);

  if (error && !branches.length) {
    return (
      <StateBlock
        variant="error"
        title="No pudimos cargar las sucursales"
        description={error}
        actionLabel="Reintentar"
        onAction={reloadBranches}
      />
    );
  }

  // Pantalla de carga breve mientras se resuelve contexto y redireccion.
  if (loading || !selectors.hasBranchSelected || !selectors.hasRequiredOrderContext) {
    return <CatalogSkeleton />;
  }

  return null;
};

export default MenuLandingScreen;
