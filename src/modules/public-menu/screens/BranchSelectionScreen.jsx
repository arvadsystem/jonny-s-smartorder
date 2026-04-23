import { useEffect, useMemo, useRef, useState } from 'react';
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

const clearPublicMenuCartStorage = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(PUBLIC_MENU_CART_STORAGE_KEY);
};

const getBranchSortNumber = (branch) => {
  const label = String(branch?.displayName || branch?.name || branch?.slug || '').trim();
  if (!label) return Number.POSITIVE_INFINITY;
  const match = label.match(/sucursal\s*(\d+)/i);
  if (!match) return Number.POSITIVE_INFINITY;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
};

const findBranchBySlug = (branches, rawSlug) => {
  const target = String(rawSlug || '').trim().toLowerCase();
  if (!target) return null;

  return (Array.isArray(branches) ? branches : []).find(
    (branch) => String(branch?.slug || '').trim().toLowerCase() === target
  ) || null;
};

const resolvePreviewOrderType = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === PUBLIC_MENU_ORDER_TYPES.DINE_IN) return PUBLIC_MENU_ORDER_TYPES.DINE_IN;
  if (normalized === PUBLIC_MENU_ORDER_TYPES.PICKUP) return PUBLIC_MENU_ORDER_TYPES.PICKUP;
  if (normalized === PUBLIC_MENU_ORDER_TYPES.DELIVERY) return PUBLIC_MENU_ORDER_TYPES.DELIVERY;
  return PUBLIC_MENU_ORDER_TYPES.DINE_IN;
};

// Step 1: customer picks the working branch for the rest of the flow.
const BranchSelectionScreen = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { state, actions } = usePublicMenuFlow();
  const { branches, loading, error, reloadBranches } = useBranches();
  const [ignoreQueryPrefill, setIgnoreQueryPrefill] = useState(false);
  const [queryBranchError, setQueryBranchError] = useState('');
  const autoPreviewRef = useRef('');
  const orderedBranches = useMemo(() => {
    const list = Array.isArray(branches) ? [...branches] : [];
    return list.sort((a, b) => {
      const sortA = getBranchSortNumber(a);
      const sortB = getBranchSortNumber(b);
      if (sortA !== sortB) return sortA - sortB;

      const nameA = String(a?.displayName || a?.name || '').trim().toLowerCase();
      const nameB = String(b?.displayName || b?.name || '').trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [branches]);

  const heroImage = useMemo(
    () => orderedBranches.find((branch) => branch?.imageUrl)?.imageUrl || '',
    [orderedBranches]
  );

  const queryBranchSlug = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return String(params.get('sucursal') || '').trim().toLowerCase();
  }, [location.search]);

  const previewAdminMode = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return String(params.get('preview_admin') || '').trim() === '1'
      && String(params.get('auto') || '').trim() === '1';
  }, [location.search]);

  const previewOrderType = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return resolvePreviewOrderType(params.get('tipo_pedido'));
  }, [location.search]);

  useEffect(() => {
    if (queryBranchSlug) {
      setIgnoreQueryPrefill(false);
      setQueryBranchError('');
      autoPreviewRef.current = '';
      return;
    }

    setIgnoreQueryPrefill(true);
    setQueryBranchError('');
  }, [queryBranchSlug]);

  useEffect(() => {
    if (!queryBranchSlug || ignoreQueryPrefill) return;
    if (loading || error) return;
    if (!Array.isArray(branches) || branches.length === 0) return;

    const branchFromQuery = findBranchBySlug(branches, queryBranchSlug);
    if (!branchFromQuery) {
      setIgnoreQueryPrefill(true);
      setQueryBranchError('El QR o enlace de sucursal no es valido. Selecciona una sucursal disponible.');

      if (state.selectedBranch?.id) {
        actions.selectBranch(null);
        actions.selectOrderType(null);
        actions.selectMenu(null);
      }
      clearPublicMenuCartStorage();
      return;
    }

    setQueryBranchError('');
    if (Number(state.selectedBranch?.id) !== Number(branchFromQuery.id)) {
      actions.selectBranch(branchFromQuery);
      actions.selectOrderType(null);
      clearPublicMenuCartStorage();
    }

    // En modo preview_admin forzamos entrada directa al menu para espejo en iframe.
    if (previewAdminMode) {
      const previewKey = `${queryBranchSlug}:${previewOrderType}`;
      if (autoPreviewRef.current !== previewKey) {
        autoPreviewRef.current = previewKey;
        actions.selectBranch(branchFromQuery);
        actions.selectOrderType(previewOrderType);
        if (previewOrderType === PUBLIC_MENU_ORDER_TYPES.PICKUP) {
          actions.setPickupPaymentMethod('caja');
        }
        navigate(getPublicMenuPathByStep(PUBLIC_MENU_STEPS.MENU), { replace: true });
      }
    }
  }, [
    actions,
    branches,
    error,
    ignoreQueryPrefill,
    loading,
    navigate,
    previewAdminMode,
    previewOrderType,
    queryBranchSlug,
    state.selectedBranch?.id
  ]);

  useEffect(() => {
    // Mantiene sincronizada la sucursal guardada en snapshot con la data fresca de BD.
    // Evita que en menu publico siga saliendo un nombre viejo despues de editar sucursales.
    if (loading || error) return;
    if (!state.selectedBranch?.id) return;
    if (!Array.isArray(branches) || branches.length === 0) return;

    const freshBranch = branches.find(
      (branch) => Number(branch?.id) === Number(state.selectedBranch?.id)
    );

    if (!freshBranch) return;

    const changed =
      String(freshBranch?.name || '') !== String(state.selectedBranch?.name || '') ||
      String(freshBranch?.displayName || '') !== String(state.selectedBranch?.displayName || '') ||
      String(freshBranch?.slug || '') !== String(state.selectedBranch?.slug || '') ||
      String(freshBranch?.imageUrl || '') !== String(state.selectedBranch?.imageUrl || '');

    if (changed) {
      actions.selectBranch(freshBranch);
    }
  }, [actions, branches, error, loading, state.selectedBranch]);

  const handleSelectBranch = (branch) => {
    const isBranchChange = Number(state.selectedBranch?.id) !== Number(branch?.id);
    setQueryBranchError('');
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
      <div
        className={`pm-screen__intro pm-branch-screen__hero ${heroImage ? 'has-photo' : ''}`}
        style={heroImage ? { backgroundImage: `url(${heroImage})` } : undefined}
      >
        <div className="pm-branch-screen__hero-overlay" aria-hidden="true" />
        <div className="pm-branch-screen__hero-content">
          <span className="pm-screen__eyebrow">Paso 1 de 3</span>
          <h2 className="pm-screen__title">Selecciona tu sucursal</h2>
          <p className="pm-screen__subtitle">
            El menu se ajusta a la sede y al tipo de pedido que elijas.
          </p>
        </div>
      </div>

      <div className="pm-screen__list">
        {queryBranchError ? (
          <div className="alert alert-warning py-2" role="alert">
            {queryBranchError}
          </div>
        ) : null}
        {orderedBranches.map((branch) => (
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
