import { useMemo } from 'react';
import { usePublicMenuFlowStore } from '../store/PublicMenuFlowStore';
import { PUBLIC_MENU_STEPS } from '../types/publicMenuTypes';
import { canAccessStep, hasBranchSelected, hasOrderTypeSelected } from '../utils/publicMenuGuards';

// High-level selectors so screens stay focused on rendering.
export const usePublicMenuFlow = () => {
  const { state, actions } = usePublicMenuFlowStore();

  const selectors = useMemo(
    () => ({
      hasBranchSelected: hasBranchSelected(state),
      hasOrderTypeSelected: hasOrderTypeSelected(state),
      canAccessBranch: canAccessStep(state, PUBLIC_MENU_STEPS.BRANCH),
      canAccessOrderType: canAccessStep(state, PUBLIC_MENU_STEPS.ORDER_TYPE),
      canAccessMenu: canAccessStep(state, PUBLIC_MENU_STEPS.MENU)
    }),
    [state]
  );

  return {
    state,
    actions,
    selectors
  };
};

