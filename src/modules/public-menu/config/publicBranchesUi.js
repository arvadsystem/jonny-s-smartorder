const BRANCH_UI_BY_SLUG = Object.freeze({
  '21-octubre': {
    id: 1,
    slug: '21-octubre',
    nombre: "Jonny's 21 Octubre",
    foto: '/images/sucursal-21.jpg'
  },
  'el-carmen': {
    id: 2,
    slug: 'el-carmen',
    nombre: "Jonny's El Carmen",
    foto: '/images/sucursal-carmen.jpg'
  }
});

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const byId = new Map(
  Object.values(BRANCH_UI_BY_SLUG)
    .filter((branch) => Number(branch?.id) > 0)
    .map((branch) => [Number(branch.id), branch])
);

const inferByText = (text) => {
  const safeText = normalizeText(text);
  if (!safeText) return null;

  if (
    safeText.includes('21 octubre') ||
    safeText.includes("jonny's 21") ||
    safeText.includes('21 de agosto')
  ) {
    return BRANCH_UI_BY_SLUG['21-octubre'];
  }
  if (safeText.includes('el carmen')) {
    return BRANCH_UI_BY_SLUG['el-carmen'];
  }

  return null;
};

export const getBranchUiBySlug = (slug) =>
  BRANCH_UI_BY_SLUG[normalizeText(slug)] || null;

export const getBranchUiMeta = ({ id, name, imageUrl, slug, address }) => {
  const fromAddress = inferByText(address);

  const bySlug = getBranchUiBySlug(slug);
  if (bySlug) {
    return {
      ...bySlug,
      foto: bySlug.foto || imageUrl || ''
    };
  }

  // Address has higher trust than id/name for branch identity in this flow.
  if (fromAddress) {
    return {
      ...fromAddress,
      foto: fromAddress.foto || imageUrl || ''
    };
  }

  const numericId = Number(id || 0);
  const fromId = byId.get(numericId) || null;
  if (fromId) {
    return {
      ...fromId,
      foto: fromId.foto || imageUrl || ''
    };
  }

  const fromName = inferByText(name);
  if (fromName) {
    return {
      ...fromName,
      foto: fromName.foto || imageUrl || ''
    };
  }

  const fallbackSlug = numericId > 0 ? `sucursal-${numericId}` : normalizeText(name).replace(/\s+/g, '-');
  return {
    id: numericId || null,
    slug: fallbackSlug || '',
    nombre: String(name || 'Sucursal').trim() || 'Sucursal',
    foto: imageUrl || ''
  };
};
