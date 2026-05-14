import { createPublicMenuInitialState } from './publicMenuInitialState';

export const PUBLIC_MENU_ACTIONS = Object.freeze({
  HYDRATE: 'HYDRATE',
  SELECT_BRANCH: 'SELECT_BRANCH',
  SELECT_ORDER_TYPE: 'SELECT_ORDER_TYPE',
  SET_DINE_IN_TABLE: 'SET_DINE_IN_TABLE',
  SET_PICKUP_PAYMENT_METHOD: 'SET_PICKUP_PAYMENT_METHOD',
  SELECT_MENU: 'SELECT_MENU',
  RESET_FLOW: 'RESET_FLOW',
  PUSH_TOAST: 'PUSH_TOAST',
  DISMISS_TOAST: 'DISMISS_TOAST',
  OPEN_CONFIRM: 'OPEN_CONFIRM',
  CLOSE_CONFIRM: 'CLOSE_CONFIRM'
});

const withToastId = (toast) => ({
  id: toast?.id || `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  type: toast?.type || 'info',
  message: toast?.message || '',
  durationMs: toast?.durationMs ?? 3000,
  createdAt: Date.now()
});

const applyHydrate = (state, payload) => {
  if (!payload || typeof payload !== 'object') return state;
  return {
    ...state,
    selectedBranch: payload.selectedBranch || null,
    orderType: payload.orderType || null,
    dineInTable: String(payload.dineInTable || ''),
    pickupPaymentMethod: String(payload.pickupPaymentMethod || ''),
    selectedMenu: payload.selectedMenu || null,
    cartRevision: Number(payload.cartRevision || 0)
  };
};

export const publicMenuFlowReducer = (state, action) => {
  switch (action.type) {
    case PUBLIC_MENU_ACTIONS.HYDRATE:
      return applyHydrate(state, action.payload);

    case PUBLIC_MENU_ACTIONS.SELECT_BRANCH: {
      const nextBranch = action.payload || null;
      const changedBranch = Number(state.selectedBranch?.id) !== Number(nextBranch?.id);

      return {
        ...state,
        selectedBranch: nextBranch,
        // Branch switch invalidates downstream selections.
        orderType: changedBranch ? null : state.orderType,
        dineInTable: changedBranch ? '' : state.dineInTable,
        pickupPaymentMethod: changedBranch ? '' : state.pickupPaymentMethod,
        selectedMenu: changedBranch ? null : state.selectedMenu,
        cartRevision: changedBranch ? state.cartRevision + 1 : state.cartRevision
      };
    }

    case PUBLIC_MENU_ACTIONS.SELECT_ORDER_TYPE:
      return {
        ...state,
        orderType: action.payload || null,
        // Solo conservamos mesa cuando la opcion activa es comer en restaurante.
        dineInTable: action.payload === 'dine-in' ? state.dineInTable : '',
        // Solo conservamos metodo cuando la opcion activa es retiro en local.
        pickupPaymentMethod: action.payload === 'pickup' ? state.pickupPaymentMethod : ''
      };

    case PUBLIC_MENU_ACTIONS.SET_DINE_IN_TABLE:
      return {
        ...state,
        dineInTable: String(action.payload || '')
      };

    case PUBLIC_MENU_ACTIONS.SET_PICKUP_PAYMENT_METHOD:
      return {
        ...state,
        pickupPaymentMethod: String(action.payload || '')
      };

    case PUBLIC_MENU_ACTIONS.SELECT_MENU:
      return {
        ...state,
        selectedMenu: action.payload || null
      };

    case PUBLIC_MENU_ACTIONS.RESET_FLOW:
      return createPublicMenuInitialState();

    case PUBLIC_MENU_ACTIONS.PUSH_TOAST: {
      // Evita spam visual cuando un mismo error ocurre por click repetido o red lenta.
      const nextToast = withToastId(action.payload);
      const lastToast = state.ui.toasts[state.ui.toasts.length - 1];
      if (
        lastToast &&
        String(lastToast.type || '') === String(nextToast.type || '') &&
        String(lastToast.message || '') === String(nextToast.message || '') &&
        Number(nextToast.createdAt || 0) - Number(lastToast.createdAt || 0) < 1200
      ) {
        return state;
      }

      return {
        ...state,
        ui: {
          ...state.ui,
          toasts: [...state.ui.toasts.slice(-3), nextToast]
        }
      };
    }

    case PUBLIC_MENU_ACTIONS.DISMISS_TOAST:
      return {
        ...state,
        ui: {
          ...state.ui,
          toasts: state.ui.toasts.filter((toast) => toast.id !== action.payload)
        }
      };

    case PUBLIC_MENU_ACTIONS.OPEN_CONFIRM:
      return {
        ...state,
        ui: {
          ...state.ui,
          confirm: {
            isOpen: true,
            title: action.payload?.title || '',
            message: action.payload?.message || '',
            confirmLabel: action.payload?.confirmLabel || 'Confirmar'
          }
        }
      };

    case PUBLIC_MENU_ACTIONS.CLOSE_CONFIRM:
      return {
        ...state,
        ui: {
          ...state.ui,
          confirm: {
            isOpen: false,
            title: '',
            message: '',
            confirmLabel: 'Confirmar'
          }
        }
      };

    default:
      return state;
  }
};
