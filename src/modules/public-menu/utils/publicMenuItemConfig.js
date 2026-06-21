const HAMBURGUESA_KEYWORDS = ['hamburguesa', 'burger', 'smash'];
const WINGS_SAUCE_KEYWORDS = ['alita', 'alitas', 'tender', 'tenders'];
const KITCHEN_NOTE_KEYWORDS = [
  'taco birria',
  'tacos birria',
  'taco de birria',
  'tacos de birria',
  'birria',
  'hot dog',
  'hot dogs',
  'hotdog',
  'hotdogs'
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

const inferSauceUnitsBaseFromText = (...sources) => {
  const text = normalizeText(sources.filter(Boolean).join(' '));
  if (!text) return 1;

  const containsKeyword = WINGS_SAUCE_KEYWORDS.some((keyword) => text.includes(normalizeText(keyword)));
  if (!containsKeyword) return 1;

  const match =
    text.match(/\b(\d{1,3})\s*(?:alitas?|tenders?)\b/i) ||
    text.match(/\b(\d{1,3})\s*(?:uds?|unidades?|pzas?|piezas?)\b/i) ||
    text.match(/\((\d{1,3})\s*(?:uds?|unidades?|pzas?|piezas?)\)/i);

  const units = Number(match?.[1] || 0);
  if (!Number.isFinite(units) || units <= 0) return 1;
  return Math.max(1, Math.floor(units));
};

const calculateFallbackWingSauceRequirement = ({ item, quantity = 1 }) => {
  const baseUnits = inferSauceUnitsBaseFromText(item?.nombre, item?.descripcion);
  if (baseUnits <= 1) return 0;
  const totalUnits = Math.max(1, Number(quantity || 1)) * baseUnits;
  return Math.max(0, Math.ceil(totalUnits / 6));
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

export const isWingsOrTendersItem = (item) => {
  const directMatch =
    hasAnyKeyword(item?.nombre, WINGS_SAUCE_KEYWORDS) ||
    hasAnyKeyword(item?.descripcion, WINGS_SAUCE_KEYWORDS) ||
    hasAnyKeyword(item?.categoria?.nombre, WINGS_SAUCE_KEYWORDS) ||
    hasAnyKeyword(item?.categoria?.nombre_producto, WINGS_SAUCE_KEYWORDS);

  if (directMatch) return true;

  return (Array.isArray(item?.salsas_componentes) ? item.salsas_componentes : []).some((component) =>
    hasAnyKeyword(component?.nombre_receta, WINGS_SAUCE_KEYWORDS)
  );
};

export const isKitchenNoteItem = (item) =>
  hasAnyKeyword(item?.nombre, KITCHEN_NOTE_KEYWORDS) ||
  hasAnyKeyword(item?.descripcion, KITCHEN_NOTE_KEYWORDS) ||
  hasAnyKeyword(item?.categoria?.nombre, KITCHEN_NOTE_KEYWORDS) ||
  hasAnyKeyword(item?.categoria?.nombre_producto, KITCHEN_NOTE_KEYWORDS);

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
  const requiredFromComponents = components.reduce((total, component) => {
    const multiplier = Math.max(1, Number(component?.multiplicador || 1));
    const baseUnits = Math.max(1, Number(component?.unidades_base || 1));
    const units = Math.max(1, Number(quantity || 1)) * multiplier * baseUnits;
    const rule = findMatchingSalsaRule(component?.reglas, units);
    return total + Number(rule?.salsas_requeridas || 0);
  }, 0);

  if (requiredFromComponents > 0) return requiredFromComponents;
  return calculateFallbackWingSauceRequirement({ item, quantity });
};

export const requiresItemConfiguration = (item) =>
  isKitchenNoteItem(item) ||
  getItemExtraOptions(item).length > 0 ||
  item?.salsas_requiere_seleccion === true ||
  getItemAllowedSauces(item).length > 0 ||
  calculateRequiredSauces(item, 1) > 0;

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
