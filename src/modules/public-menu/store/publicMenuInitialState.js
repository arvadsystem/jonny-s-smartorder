// Factory to keep state reset logic centralized and predictable.
export const createPublicMenuInitialState = () => ({
  selectedBranch: null,
  orderType: null,
  selectedMenu: null,
  cartRevision: 0,
  ui: {
    toasts: [],
    confirm: {
      isOpen: false,
      title: '',
      message: '',
      confirmLabel: 'Confirmar'
    }
  }
});

// Extract only safe fields for localStorage persistence.
export const toPublicMenuSnapshot = (state) => ({
  selectedBranch: state.selectedBranch,
  orderType: state.orderType,
  selectedMenu: state.selectedMenu,
  cartRevision: state.cartRevision
});

