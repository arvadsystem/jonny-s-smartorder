import { PUBLIC_MENU_STEPS } from '../types/publicMenuTypes';

// Central route map so every screen/navigation rule uses the same source of truth.
export const PUBLIC_MENU_BASE_PATH = '/menu-publico';

export const PUBLIC_MENU_STEP_TO_SEGMENT = Object.freeze({
  [PUBLIC_MENU_STEPS.BRANCH]: 'sucursal',
  [PUBLIC_MENU_STEPS.ORDER_TYPE]: 'tipo-pedido',
  [PUBLIC_MENU_STEPS.MENU]: 'menu'
});

export const PUBLIC_MENU_STEP_ORDER = [
  PUBLIC_MENU_STEPS.BRANCH,
  PUBLIC_MENU_STEPS.ORDER_TYPE,
  PUBLIC_MENU_STEPS.MENU
];

export const getPublicMenuPathByStep = (stepKey) => {
  const segment = PUBLIC_MENU_STEP_TO_SEGMENT[stepKey];
  return segment ? `${PUBLIC_MENU_BASE_PATH}/${segment}` : PUBLIC_MENU_BASE_PATH;
};

export const getPublicMenuStepFromPath = (pathname = '') => {
  const rawSegment = String(pathname)
    .replace(PUBLIC_MENU_BASE_PATH, '')
    .split('/')
    .filter(Boolean)[0];

  const entry = Object.entries(PUBLIC_MENU_STEP_TO_SEGMENT).find(([, segment]) => segment === rawSegment);
  return entry?.[0] || PUBLIC_MENU_STEPS.BRANCH;
};

