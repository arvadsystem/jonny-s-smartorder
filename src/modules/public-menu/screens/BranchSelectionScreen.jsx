import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import SucursalCard from '../components/branch/SucursalCard';
import StateBlock from '../components/feedback/StateBlock';
import { useBranches } from '../hooks/useBranches';
import { usePublicMenuFlow } from '../hooks/usePublicMenuFlow';
import { getPublicMenuPathByStep } from '../routes/flowSteps';
import {
  PUBLIC_MENU_CART_STORAGE_KEY,
  PUBLIC_MENU_ORDER_TYPES,
  PUBLIC_MENU_STEPS
} from '../types/publicMenuTypes';

const DEFAULT_ORDER_TYPE = PUBLIC_MENU_ORDER_TYPES.PICKUP;

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
  const [manualSelectionEnabled, setManualSelectionEnabled] = useState(false);
  const [ignoreQueryPrefill, setIgnoreQueryPrefill] = useState(false);

  const queryBranchSlug = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return String(params.get('sucursal') || '').trim().toLowerCase();
  }, [location.search]);

  useEffect(() => {
    if (queryBranchSlug) {
      setIgnoreQueryPrefill(false);
      setManualSelectionEnabled(false);
      return;
    }

    setIgnoreQueryPrefill(true);
    setManualSelectionEnabled(true);
    actions.selectBranch(null);
    actions.selectOrderType(null);
    actions.selectMenu(null);
    clearPublicMenuCartStorage();
  }, [actions, queryBranchSlug]);

  useEffect(() => {
    if (!queryBranchSlug || ignoreQueryPrefill) return;
    if (loading || error) return;
    if (!Array.isArray(branches) || branches.length === 0) return;

    const branchFromQuery = findBranchBySlug(branches, queryBranchSlug);
    if (!branchFromQuery) {
      setIgnoreQueryPrefill(true);
      setManualSelectionEnabled(true);

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
      actions.selectOrderType(DEFAULT_ORDER_TYPE);
      setManualSelectionEnabled(false);
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

  const selectedBranch = state.selectedBranch;
  const showConfirmation = Boolean(selectedBranch?.id) && !manualSelectionEnabled;

  const handleContinueToMenu = () => {
    if (!selectedBranch?.id) return;
    if (!state.orderType) {
      actions.selectOrderType(DEFAULT_ORDER_TYPE);
    }
    navigate(getPublicMenuPathByStep(PUBLIC_MENU_STEPS.MENU));
  };

  const handleChangeBranch = () => {
    setManualSelectionEnabled(true);
    setIgnoreQueryPrefill(true);
    actions.selectBranch(null);
    actions.selectMenu(null);
    actions.selectOrderType(null);
    clearPublicMenuCartStorage();
  };

  const handleSelectBranch = (branch) => {
    setIgnoreQueryPrefill(true);
    actions.selectBranch(branch);
    actions.selectOrderType(DEFAULT_ORDER_TYPE);
    actions.selectMenu(null);
    setManualSelectionEnabled(false);
    clearPublicMenuCartStorage();
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

  if (showConfirmation) {
    return (
      <section className="pm-screen pm-branch-screen" aria-label="Confirmacion de sucursal">
        <div className="pm-screen__intro pm-branch-screen__hero">
          <span className="pm-screen__eyebrow">Paso 1 de 3</span>
          <h2 className="pm-screen__title">Confirma tu sucursal</h2>
          <p className="pm-screen__subtitle">
            Verifica que esta sea la sucursal correcta antes de ver el menu.
          </p>
        </div>

        <article className="pm-branch-confirm-card">
          {selectedBranch.imageUrl ? (
            <img
              src={selectedBranch.imageUrl}
              alt={selectedBranch.displayName || selectedBranch.name}
              className="pm-branch-confirm-card__image"
            />
          ) : null}

          <div className="pm-branch-confirm-card__body">
            <h3>{selectedBranch.displayName || selectedBranch.name}</h3>
            <p>{selectedBranch.address || 'Direccion no disponible'}</p>

            <div className="pm-branch-confirm-card__actions">
              <button type="button" className="btn btn-dark" onClick={handleContinueToMenu}>
                Ver menu
              </button>
              <button type="button" className="btn btn-outline-dark" onClick={handleChangeBranch}>
                Cambiar sucursal
              </button>
            </div>
          </div>
        </article>
      </section>
    );
  }

  return (
    <section className="pm-screen pm-branch-screen" aria-label="Seleccion de sucursal">
      <div className="pm-screen__intro pm-branch-screen__hero">
        <span className="pm-screen__eyebrow">Paso 1 de 3</span>
        <h2 className="pm-screen__title">Selecciona tu sucursal</h2>
        <p className="pm-screen__subtitle">
          Esta seleccion define menu vigente, tiempos y disponibilidad de productos.
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
