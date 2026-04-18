// Shared enums/config for the public menu module.
export const PUBLIC_MENU_ORDER_TYPES = Object.freeze({
  DINE_IN: 'dine-in',
  PICKUP: 'pickup',
  DELIVERY: 'delivery'
});

export const PUBLIC_MENU_ORDER_TYPE_OPTIONS = [
  {
    id: PUBLIC_MENU_ORDER_TYPES.DINE_IN,
    title: 'Comer en restaurante',
    description: 'Realizas el pedido aqui y pagas directamente en caja.',
    paymentCopy: 'Pago en caja al llegar al restaurante.'
  },
  {
    id: PUBLIC_MENU_ORDER_TYPES.PICKUP,
    title: 'Retiro en local',
    description: 'Pides en linea y retiras en la sucursal seleccionada.',
    paymentCopy: 'Puedes pagar en caja al retirar o por transferencia.'
  },
  {
    id: PUBLIC_MENU_ORDER_TYPES.DELIVERY,
    title: 'Delivery',
    description: 'Recibelo donde estes dentro de la zona de cobertura.',
    paymentCopy: 'Pago por transferencia para confirmar el pedido.'
  }
];

export const PUBLIC_MENU_STORAGE_KEY = 'public-menu-flow-v1';
export const PUBLIC_MENU_CART_STORAGE_KEY = 'public-menu-cart-v1';

export const PUBLIC_MENU_STEPS = Object.freeze({
  BRANCH: 'branch',
  ORDER_TYPE: 'orderType',
  MENU: 'menu'
});
