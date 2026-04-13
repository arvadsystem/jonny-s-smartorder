const HAMBURGUESA_KEYWORDS = ['hamburguesa', 'burger', 'smash'];

const FALLBACK_HAMBURGUESA_EXTRAS = [
  {
    id_extra: 'hamb-extra-bacon',
    codigo: 'extra_bacon',
    nombre: 'Extra bacon',
    precio_adicional: 30
  }
];

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const toPositiveInt = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const hasAnyKeyword = (value, keywords = []) => {
  const text = normalizeText(value);
  if (!text) return false;
  return keywords.some((keyword) => text.includes(normalizeText(keyword)));
};

const findMatchingSalsaRule = (rules, unidades) => {
  const units = Number(unidades);
  if (!Number.isFinite(units) || units <= 0) return null;

  const orderedRules = [...(Array.isArray(rules) ? rules : [])].sort(
    (left, right) => Number(left?.min_unidades || 0) - Number(right?.min_unidades || 0)
  );

  return (
    orderedRules.find((rule) => {
      const min = Number(rule?.min_unidades || 0);
      const max =
        rule?.max_unidades === null || rule?.max_unidades === undefined
          ? null
          : Number(rule.max_unidades);

      if (!Number.isFinite(min) || units < min) return false;
      if (max !== null && Number.isFinite(max) && units > max) return false;
      return true;
    }) || null
  );
};

export const isHamburguesaItem = (item) =>
  hasAnyKeyword(item?.nombre, HAMBURGUESA_KEYWORDS) ||
  hasAnyKeyword(item?.descripcion, HAMBURGUESA_KEYWORDS) ||
  hasAnyKeyword(item?.categoria?.nombre, HAMBURGUESA_KEYWORDS);

export const getItemExtraOptions = (item) => {
  const backendOptions = Array.isArray(item?.extras_opciones) ? item.extras_opciones : [];
  if (backendOptions.length > 0) {
    return backendOptions
      .map((extra) => ({
        id_extra: String(extra?.id_extra || '').trim(),
        codigo: String(extra?.codigo || '').trim(),
        nombre: String(extra?.nombre || 'Extra').trim(),
        precio_adicional: Number(extra?.precio_adicional || 0)
      }))
      .filter((extra) => extra.id_extra);
  }

  if (String(item?.tipo_item || '') === 'RECETA' && isHamburguesaItem(item)) {
    return FALLBACK_HAMBURGUESA_EXTRAS.map((extra) => ({ ...extra }));
  }

  return [];
};

export const getItemAllowedSauces = (item) =>
  (Array.isArray(item?.salsas_permitidas) ? item.salsas_permitidas : [])
    .map((sauce) => ({
      id_salsa: toPositiveInt(sauce?.id_salsa, 0),
      nombre: String(sauce?.nombre || 'Salsa').trim(),
      nivel_picante: Number(sauce?.nivel_picante || 0),
      orden: Number(sauce?.orden || 0),
      disponible: Boolean(sauce?.disponible ?? true)
    }))
    .filter((sauce) => sauce.id_salsa > 0)
    .sort((left, right) => {
      const orderA = Number(left?.orden || 0);
      const orderB = Number(right?.orden || 0);
      if (orderA !== orderB) return orderA - orderB;
      return String(left?.nombre || '').localeCompare(String(right?.nombre || ''), 'es', {
        sensitivity: 'base'
      });
    });

export const calculateRequiredSauces = (item, quantity = 1) => {
  const components = Array.isArray(item?.salsas_componentes) ? item.salsas_componentes : [];

  return components.reduce((total, component) => {
    const multiplier = Math.max(1, Number(component?.multiplicador || 1));
    const units = Math.max(1, Number(quantity || 1)) * multiplier;
    const rule = findMatchingSalsaRule(component?.reglas, units);
    return total + Number(rule?.salsas_requeridas || 0);
  }, 0);
};

export const requiresItemConfiguration = (item) =>
  getItemExtraOptions(item).length > 0 ||
  item?.salsas_requiere_seleccion === true;

export const normalizeSelectedSauces = (rawSauces = []) => {
  const merged = new Map();

  (Array.isArray(rawSauces) ? rawSauces : []).forEach((entry) => {
    const id = toPositiveInt(entry?.id_salsa, 0);
    const qty = toPositiveInt(entry?.cantidad, 0);
    if (!id || !qty) return;
    const current = merged.get(id) || { cantidad: 0, nombre: '' };
    merged.set(id, {
      cantidad: current.cantidad + qty,
      nombre: String(entry?.nombre || current.nombre || '').trim()
    });
  });

  return Array.from(merged.entries())
    .map(([id_salsa, data]) => ({
      id_salsa: Number(id_salsa),
      cantidad: Number(data?.cantidad || 0),
      nombre: String(data?.nombre || '').trim()
    }))
    .sort((left, right) => left.id_salsa - right.id_salsa);
};

export const countSelectedSauces = (rawSauces = []) =>
  normalizeSelectedSauces(rawSauces).reduce(
    (sum, entry) => sum + Number(entry?.cantidad || 0),
    0
  );
