import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import SucursalCard from '../components/branch/SucursalCard';
import StateBlock from '../components/feedback/StateBlock';
import { useBranches } from '../hooks/useBranches';
import { usePublicMenuFlow } from '../hooks/usePublicMenuFlow';
import { getPublicMenuPathByStep } from '../routes/flowSteps';
import {
  PUBLIC_MENU_CART_STORAGE_KEY,
  PUBLIC_MENU_STEPS
} from '../types/publicMenuTypes';

const clearPublicMenuCartStorage = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(PUBLIC_MENU_CART_STORAGE_KEY);
};

const findBranchBySlug = (branches, rawSlug) => {
  const target = String(rawSlug || '').trim().toLowerCase();
  if (!target) return null;

  return (Array.isArray(branches) ? branches : []).find(
    (branch) => String(branch?.slug || '').trim().toLowerCase() === target
  ) || null;
};

// Step 1: customer picks the working branch for the rest of the flow.
const BranchSelectionScreen = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { state, actions } = usePublicMenuFlow();
  const { branches, loading, error, reloadBranches } = useBranches();
  const [ignoreQueryPrefill, setIgnoreQueryPrefill] = useState(false);

  const queryBranchSlug = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return String(params.get('sucursal') || '').trim().toLowerCase();
  }, [location.search]);

  useEffect(() => {
    if (queryBranchSlug) {
      setIgnoreQueryPrefill(false);
      return;
    }

    setIgnoreQueryPrefill(true);
  }, [queryBranchSlug]);

  useEffect(() => {
    if (!queryBranchSlug || ignoreQueryPrefill) return;
    if (loading || error) return;
    if (!Array.isArray(branches) || branches.length === 0) return;

    const branchFromQuery = findBranchBySlug(branches, queryBranchSlug);
    if (!branchFromQuery) {
      setIgnoreQueryPrefill(true);

      if (state.selectedBranch?.id) {
        actions.selectBranch(null);
        actions.selectOrderType(null);
        actions.selectMenu(null);
      }
      clearPublicMenuCartStorage();
      return;
    }

    if (Number(state.selectedBranch?.id) !== Number(branchFromQuery.id)) {
      actions.selectBranch(branchFromQuery);
      actions.selectOrderType(null);
      clearPublicMenuCartStorage();
    }
  }, [
    actions,
    branches,
    error,
    ignoreQueryPrefill,
    loading,
    queryBranchSlug,
    state.selectedBranch?.id
  ]);

  const handleSelectBranch = (branch) => {
    const isBranchChange = Number(state.selectedBranch?.id) !== Number(branch?.id);
    setIgnoreQueryPrefill(true);
    actions.selectBranch(branch);
    if (isBranchChange) {
      actions.selectOrderType(null);
      actions.selectMenu(null);
      clearPublicMenuCartStorage();
    }
    navigate(getPublicMenuPathByStep(PUBLIC_MENU_STEPS.ORDER_TYPE));
  };

  if (loading) {
    return (
      <StateBlock
        variant="loading"
        title="Cargando sucursales"
        description="Un momento, estamos preparando las opciones disponibles."
      />
    );
  }

  if (error) {
    return (
      <StateBlock
        variant="error"
        title="No pudimos cargar sucursales"
        description={error}
        actionLabel="Reintentar"
        onAction={reloadBranches}
      />
    );
  }

  if (!branches.length) {
    return (
      <StateBlock
        variant="empty"
        title="No hay sucursales disponibles"
        description="Intenta nuevamente en unos minutos."
      />
    );
  }

  return (
    <section className="pm-screen pm-branch-screen" aria-label="Seleccion de sucursal">
      <div className="pm-screen__intro pm-branch-screen__hero">
        <span className="pm-screen__eyebrow">Paso 1 de 3</span>
        <h2 className="pm-screen__title">Selecciona tu sucursal</h2>
        <p className="pm-screen__subtitle">
          Elige primero la sucursal y luego selecciona el tipo de pedido.
        </p>
      </div>

      <div className="pm-screen__list">
        {branches.map((branch) => (
          <SucursalCard
            key={branch.id}
            branch={branch}
            selected={Number(state.selectedBranch?.id) === Number(branch.id)}
            onSelect={handleSelectBranch}
          />
        ))}
      </div>
    </section>
  );
};

export default BranchSelectionScreen;
