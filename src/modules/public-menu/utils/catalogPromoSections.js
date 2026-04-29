// Etiquetas de seccion para mantener consistencia visual en los rails.
export const PROMO_SECTION_LABELS = Object.freeze({
  BEST_SELLERS: '\u{1F525} Mas vendidos',
  COMBOS: '\u{1F354} Combos recomendados',
  CRAVINGS: '\u{1F32E} Antojos del momento'
});

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const categoryIncludes = (product, keyword) =>
  normalizeText(product?.categoria?.nombre).includes(normalizeText(keyword));

const takeUniqueById = (rows, limit = 8) => {
  const result = [];
  const seen = new Set();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const id = Number(row?.id_detalle_menu || 0);
    if (!id || seen.has(id) || result.length >= limit) return;
    seen.add(id);
    result.push(row);
  });

  return result;
};

// Construye rails de venta sin depender de backend nuevo.
export const buildCatalogPromoSections = (products = []) => {
  const available = (Array.isArray(products) ? products : []).filter(
    (item) => Boolean(item?.disponibilidad?.available)
  );

  const combos = takeUniqueById(
    available.filter((item) => categoryIncludes(item, 'combo'))
  );

  const cravings = takeUniqueById(
    available.filter((item) => {
      const category = normalizeText(item?.categoria?.nombre);
      return (
        category.includes('taco') ||
        category.includes('hamb') ||
        category.includes('hot') ||
        category.includes('alita')
      );
    })
  );

  const bestSellers = takeUniqueById(
    available.filter((item) => !combos.some((combo) => combo.id_detalle_menu === item.id_detalle_menu))
  );

  return [
    {
      id: 'best-sellers',
      title: PROMO_SECTION_LABELS.BEST_SELLERS,
      badgeLabel: 'Popular',
      items: bestSellers
    },
    {
      id: 'combos',
      title: PROMO_SECTION_LABELS.COMBOS,
      badgeLabel: 'Combo top',
      items: combos
    },
    {
      id: 'cravings',
      title: PROMO_SECTION_LABELS.CRAVINGS,
      badgeLabel: 'Nuevo',
      items: cravings
    }
  ].filter((section) => section.items.length > 0);
};
