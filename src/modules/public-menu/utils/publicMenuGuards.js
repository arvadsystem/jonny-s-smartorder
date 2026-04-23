import { PUBLIC_MENU_STEPS } from '../types/publicMenuTypes';

// Validation helpers used by shell and route guards.
export const hasBranchSelected = (state) => Boolean(state?.selectedBranch?.id);
export const hasOrderTypeSelected = (state) => Boolean(state?.orderType);
export const hasRequiredOrderContext = (state) => {
  if (!hasOrderTypeSelected(state)) return false;
  if (state?.orderType === 'dine-in') return true;
  if (state?.orderType === 'pickup') {
    const method = String(state?.pickupPaymentMethod || '').trim().toLowerCase();
    return method === 'caja' || method === 'transferencia';
  }
  return true;
};

export const canAccessStep = (state, stepKey) => {
  if (stepKey === PUBLIC_MENU_STEPS.BRANCH) return true;
  if (stepKey === PUBLIC_MENU_STEPS.ORDER_TYPE) return hasBranchSelected(state);
  if (stepKey === PUBLIC_MENU_STEPS.MENU) return hasBranchSelected(state) && hasRequiredOrderContext(state);
  return false;
};

// Returns the first mandatory step missing before the target step.
export const getFirstBlockedStep = (state, targetStep) => {
  if (targetStep === PUBLIC_MENU_STEPS.ORDER_TYPE && !hasBranchSelected(state)) {
    return PUBLIC_MENU_STEPS.BRANCH;
  }

  if (targetStep === PUBLIC_MENU_STEPS.MENU) {
    if (!hasBranchSelected(state)) return PUBLIC_MENU_STEPS.BRANCH;
    if (!hasRequiredOrderContext(state)) return PUBLIC_MENU_STEPS.ORDER_TYPE;
  }

  return null;
};

