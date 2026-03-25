import { getBranchUiMeta } from '../../../../modules/public-menu/config/publicBranchesUi';

// Reusa el mismo resolvedor de sucursal que usa el menu publico para evitar divergencias.
export const resolvePublicBranchMeta = (branch) => {
  if (!branch || typeof branch !== 'object') return null;

  const id = Number(branch?.id_sucursal ?? branch?.id ?? 0) || null;
  const name = String(branch?.nombre_sucursal || branch?.name || '').trim();
  const address = String(branch?.direccion || branch?.address || '').trim();
  const imageUrl = String(branch?.url_imagen || branch?.imageUrl || '').trim();
  const slug = String(branch?.slug || '').trim();

  const uiMeta = getBranchUiMeta({
    id,
    name,
    address,
    imageUrl,
    slug
  });

  return {
    id,
    name: name || uiMeta?.nombre || 'Sucursal',
    address,
    slug: String(uiMeta?.slug || '').trim(),
    imageUrl: String(uiMeta?.foto || imageUrl || '').trim()
  };
};

export const buildPublicMenuUrlByBranch = (branch) => {
  const meta = resolvePublicBranchMeta(branch);
  if (!meta?.slug) return '/menu-publico/sucursal';
  return `/menu-publico/sucursal?sucursal=${encodeURIComponent(meta.slug)}`;
};
