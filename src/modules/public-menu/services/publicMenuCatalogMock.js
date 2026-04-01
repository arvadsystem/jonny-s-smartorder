// Mock catalog dataset used while backend endpoints are pending.
const BASE_PRODUCTS = [
  {
    id: 101,
    name: 'Hamburguesa Clasica',
    description: 'Carne artesanal, queso cheddar y papas crujientes.',
    category: 'Hamburguesas',
    price: 169,
    imageUrl: '',
    prepMinutes: 15,
    isFeatured: true,
    soldOutInBranches: []
  },
  {
    id: 102,
    name: 'Hamburguesa Doble Bacon',
    description: 'Doble carne, bacon ahumado y salsa especial.',
    category: 'Hamburguesas',
    price: 219,
    imageUrl: '',
    prepMinutes: 18,
    isFeatured: false,
    soldOutInBranches: [2]
  },
  {
    id: 201,
    name: 'Tacos Birria (3)',
    description: 'Tortilla de maiz, birria y consome de la casa.',
    category: 'Tacos',
    price: 189,
    imageUrl: '',
    prepMinutes: 14,
    isFeatured: true,
    soldOutInBranches: []
  },
  {
    id: 202,
    name: 'Hot Dog Supremo',
    description: 'Salchicha premium, cebolla crispy y salsa de ajo.',
    category: 'Hot Dogs',
    price: 139,
    imageUrl: '',
    prepMinutes: 11,
    isFeatured: false,
    soldOutInBranches: [1, 2]
  },
  {
    id: 301,
    name: 'Jugo Naranja Natural',
    description: 'Hecho al momento, sin azucar agregada.',
    category: 'Jugos Naturales',
    price: 79,
    imageUrl: '',
    prepMinutes: 5,
    isFeatured: false,
    soldOutInBranches: []
  },
  {
    id: 302,
    name: 'Limonada Hierbabuena',
    description: 'Refrescante y ligera para cualquier plato.',
    category: 'Bebidas',
    price: 69,
    imageUrl: '',
    prepMinutes: 4,
    isFeatured: false,
    soldOutInBranches: []
  },
  {
    id: 401,
    name: 'Combo Familiar',
    description: '4 hamburguesas, papas grandes y 2 bebidas.',
    category: 'Combos',
    price: 649,
    imageUrl: '',
    prepMinutes: 22,
    isFeatured: true,
    soldOutInBranches: [2]
  },
  {
    id: 402,
    name: 'Combo Express',
    description: '1 hamburguesa, 1 bebida y papas medianas.',
    category: 'Combos',
    price: 219,
    imageUrl: '',
    prepMinutes: 12,
    isFeatured: false,
    soldOutInBranches: []
  },
  {
    id: 501,
    name: 'Helado Sarita Vainilla',
    description: 'Copa individual, ideal para cerrar con postre.',
    category: 'Postres',
    price: 55,
    imageUrl: '',
    prepMinutes: 2,
    isFeatured: false,
    soldOutInBranches: [1]
  }
];

const DELIVERY_BLOCKED_CATEGORIES = new Set(['Bebidas Alcoholicas']);

const toCatalogProduct = (raw, branchId) => ({
  id: raw.id,
  name: raw.name,
  description: raw.description,
  category: raw.category,
  price: raw.price,
  imageUrl: raw.imageUrl,
  prepMinutes: raw.prepMinutes,
  isFeatured: raw.isFeatured,
  isSoldOut: raw.soldOutInBranches.includes(Number(branchId))
});

// Provides mock catalog by branch and order type rules.
export const getPublicMenuMockCatalog = ({ branchId, orderType }) => {
  const rows = BASE_PRODUCTS
    .map((product) => toCatalogProduct(product, branchId))
    .filter((product) => {
      if (orderType === 'delivery') {
        return !DELIVERY_BLOCKED_CATEGORIES.has(product.category);
      }
      return true;
    });

  return rows;
};

