import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { PUBLIC_MENU_ACTIONS, publicMenuFlowReducer } from './publicMenuFlowReducer';
import { createPublicMenuInitialState, toPublicMenuSnapshot } from './publicMenuInitialState';
import {
  clearPublicMenuSnapshot,
  loadPublicMenuSnapshot,
  savePublicMenuSnapshot
} from '../utils/publicMenuStorage';

const PublicMenuFlowContext = createContext(null);

// Provider isolated for this module so no other module depends on this state.
export const PublicMenuFlowProvider = ({ children }) => {
  const [state, dispatch] = useReducer(publicMenuFlowReducer, undefined, () => {
    const base = createPublicMenuInitialState();
    const snapshot = loadPublicMenuSnapshot();

    if (!snapshot) return base;
    return publicMenuFlowReducer(base, {
      type: PUBLIC_MENU_ACTIONS.HYDRATE,
      payload: snapshot
    });
  });

  useEffect(() => {
    savePublicMenuSnapshot(toPublicMenuSnapshot(state));
  }, [state]);

  const actions = useMemo(
    () => ({
      selectBranch: (branch) => dispatch({ type: PUBLIC_MENU_ACTIONS.SELECT_BRANCH, payload: branch }),
      selectOrderType: (orderType) =>
        dispatch({ type: PUBLIC_MENU_ACTIONS.SELECT_ORDER_TYPE, payload: orderType }),
      setDineInTable: (table) =>
        dispatch({ type: PUBLIC_MENU_ACTIONS.SET_DINE_IN_TABLE, payload: table }),
      setPickupPaymentMethod: (method) =>
        dispatch({ type: PUBLIC_MENU_ACTIONS.SET_PICKUP_PAYMENT_METHOD, payload: method }),
      selectMenu: (menu) => dispatch({ type: PUBLIC_MENU_ACTIONS.SELECT_MENU, payload: menu }),
      resetFlow: () => {
        clearPublicMenuSnapshot();
        dispatch({ type: PUBLIC_MENU_ACTIONS.RESET_FLOW });
      },
      pushToast: (toast) => dispatch({ type: PUBLIC_MENU_ACTIONS.PUSH_TOAST, payload: toast }),
      dismissToast: (toastId) =>
        dispatch({ type: PUBLIC_MENU_ACTIONS.DISMISS_TOAST, payload: toastId }),
      openConfirm: (payload) => dispatch({ type: PUBLIC_MENU_ACTIONS.OPEN_CONFIRM, payload }),
      closeConfirm: () => dispatch({ type: PUBLIC_MENU_ACTIONS.CLOSE_CONFIRM })
    }),
    []
  );

  const value = useMemo(() => ({ state, actions }), [state, actions]);
  return <PublicMenuFlowContext.Provider value={value}>{children}</PublicMenuFlowContext.Provider>;
};

// Dedicated hook to keep context access consistent across screens/components.
export const usePublicMenuFlowStore = () => {
  const context = useContext(PublicMenuFlowContext);

  if (!context) {
    throw new Error('usePublicMenuFlowStore debe usarse dentro de PublicMenuFlowProvider');
  }

  return context;
};

