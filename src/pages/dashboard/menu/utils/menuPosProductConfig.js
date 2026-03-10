import { getMenuPosExtraOptions } from '../config/menuPosExtrasConfig';
import { toDisplayTitle } from '../textFormat';

const toSafePositiveInt = (value, fallback = 1) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
};

const normalizeExtraSelection = (extra) => ({
  id_extra: String(extra?.id_extra || '').trim(),
  codigo: String(extra?.codigo || '').trim(),
  nombre: toDisplayTitle(extra?.nombre || 'Extra'),
  cantidad: toSafePositiveInt(extra?.cantidad, 1),
  precio_adicional: Number(extra?.precio_adicional || 0)
});

export const getProductExtraOptions = (product) => (
  getMenuPosExtraOptions(product).map(normalizeExtraSelection)
);

export const requiresProductConfiguration = (product) => (
  product?.salsas_requiere_seleccion === true ||
  getProductExtraOptions(product).length > 0
);

// Homologa la configuración mínima para que agregar rápido y agregar desde overlay usen la misma estructura.
export const buildDefaultProductConfiguration = (product) => ({
  cantidad: 1,
  extras: [],
  salsasPorUnidad: [],
  salsasRequeridasPorUnidad: Number(product?.salsas_requeridas_base || 0)
});

export const normalizeProductConfiguration = (product, configuration = {}) => {
  const allExtraOptions = getProductExtraOptions(product);
  const extrasById = new Map(allExtraOptions.map((extra) => [extra.id_extra, extra]));

  const selectedExtras = (Array.isArray(configuration?.extras) ? configuration.extras : [])
    .map((extra) => {
      const option = extrasById.get(String(extra?.id_extra || '').trim());
      if (!option) return null;
      return option;
    })
    .filter(Boolean);

  const selectedSauces = (Array.isArray(configuration?.salsasPorUnidad) ? configuration.salsasPorUnidad : [])
    .map((sauce) => ({
      id_salsa: Number(sauce?.id_salsa || 0),
      nombre: toDisplayTitle(sauce?.nombre || 'Salsa'),
      cantidad: toSafePositiveInt(sauce?.cantidad, 1)
    }))
    .filter((sauce) => sauce.id_salsa > 0 && sauce.cantidad > 0)
    .sort((left, right) => left.id_salsa - right.id_salsa);

  return {
    cantidad: toSafePositiveInt(configuration?.cantidad, 1),
    extras: selectedExtras,
    salsasPorUnidad: selectedSauces,
    salsasRequeridasPorUnidad: Math.max(0, Number(configuration?.salsasRequeridasPorUnidad || 0))
  };
};
