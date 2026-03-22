const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const HAMBURGUESA_KEYWORDS = ['hamburguesa', 'burger', 'smash'];

const HAMBURGUESA_EXTRAS = [
  {
    id_extra: 'hamb-extra-bacon',
    codigo: 'extra_bacon',
    nombre: 'Extra bacon',
    precio_adicional: 30
  }
];

const sanitizeExtraOption = (option) => ({
  id_extra: String(option?.id_extra || '').trim(),
  codigo: String(option?.codigo || '').trim(),
  nombre: String(option?.nombre || 'Extra').trim(),
  precio_adicional: Number(option?.precio_adicional || 0)
});

const hasAnyKeyword = (rawValue, keywords = []) => {
  const text = normalizeText(rawValue);
  if (!text) return false;
  return keywords.some((keyword) => text.includes(normalizeText(keyword)));
};

export const isHamburguesaProduct = (product) => (
  hasAnyKeyword(product?.nombre_producto, HAMBURGUESA_KEYWORDS) ||
  hasAnyKeyword(product?.descripcion_producto, HAMBURGUESA_KEYWORDS) ||
  hasAnyKeyword(product?.descripcion, HAMBURGUESA_KEYWORDS) ||
  hasAnyKeyword(product?.nombre_departamento, HAMBURGUESA_KEYWORDS)
);

// Centraliza la estrategia inicial de extras para no dispersar hardcodes por la UI.
export const getMenuPosExtraOptions = (product) => {
  if (!product) return [];
  if (isHamburguesaProduct(product)) {
    return HAMBURGUESA_EXTRAS.map(sanitizeExtraOption);
  }
  return [];
};
