import { toDisplayTitle } from '../textFormat';

const toMoneyNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
};

const toSafeQuantity = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.floor(parsed));
};

const normalizeToken = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_:-]/g, '');

const getCatalogIdentity = (product) => {
  if (Number(product?.id_receta || 0) > 0) return `receta:${Number(product.id_receta)}`;
  if (Number(product?.id_producto || 0) > 0) return `producto:${Number(product.id_producto)}`;
  return `anon:${String(product?.nombre_producto || product?.descripcion || '').trim().toLowerCase()}`;
};

const getCatalogKind = (product) => {
  if (Number(product?.id_receta || 0) > 0) return 'receta';
  if (Number(product?.id_producto || 0) > 0) return 'producto';
  return 'desconocido';
};

const getDisplayName = (product) =>
  toDisplayTitle(product?.nombre_producto || product?.descripcion || 'Producto');

const normalizeLineExtra = (extra) => ({
  id_extra: String(extra?.id_extra || '').trim(),
  codigo: String(extra?.codigo || '').trim(),
  nombre: toDisplayTitle(extra?.nombre || 'Extra'),
  cantidad: toSafeQuantity(extra?.cantidad || 1),
  precio_adicional: toMoneyNumber(extra?.precio_adicional || 0)
});

const normalizeLineSauce = (sauce) => ({
  id_salsa: Number(sauce?.id_salsa || 0),
  nombre: toDisplayTitle(sauce?.nombre || 'Salsa'),
  cantidad: toSafeQuantity(sauce?.cantidad || 1)
});

export const formatMoney = (value) => `L. ${toMoneyNumber(value).toFixed(2)}`;

export const calculateConfiguredUnitPrice = (precioBase, extras = []) => (
  toMoneyNumber(precioBase) +
  (Array.isArray(extras) ? extras : []).reduce(
    (total, extra) =>
      total +
      toMoneyNumber(extra?.precio_adicional || 0) * toSafeQuantity(extra?.cantidad || 1),
    0
  )
);

export const calculateLineSubtotal = (precioUnitario, cantidad) => (
  toMoneyNumber(precioUnitario) * toSafeQuantity(cantidad)
);

export const calculateOrderTotal = (items = []) =>
  (Array.isArray(items) ? items : []).reduce(
    (total, item) =>
      total + calculateLineSubtotal(item?.precioUnitario || 0, item?.cantidad || 1),
    0
  );

export const buildLineConfigSignature = ({
  product,
  extras = [],
  salsasPorUnidad = []
}) => {
  const extrasSignature = (Array.isArray(extras) ? extras : [])
    .map((extra) => (
      `${extra.id_extra}:${toMoneyNumber(extra.precio_adicional || 0).toFixed(2)}:${toSafeQuantity(extra.cantidad || 1)}`
    ))
    .sort()
    .join('|');

  const saucesSignature = (Array.isArray(salsasPorUnidad) ? salsasPorUnidad : [])
    .map((sauce) => `${Number(sauce.id_salsa || 0)}:${toSafeQuantity(sauce.cantidad || 1)}`)
    .sort()
    .join('|');

  return `${getCatalogIdentity(product)}::${extrasSignature}::${saucesSignature}`;
};

// Construye una linea homogenea de carrito para mantener calculos y rendering desacoplados de la vista.
export const buildOrderLineFromProduct = ({
  product,
  lineKey,
  configuration = {}
}) => {
  const normalizedExtras = (Array.isArray(configuration?.extras) ? configuration.extras : [])
    .map(normalizeLineExtra)
    .filter((extra) => extra.id_extra && extra.codigo);

  const normalizedSauces = (Array.isArray(configuration?.salsasPorUnidad) ? configuration.salsasPorUnidad : [])
    .map(normalizeLineSauce)
    .filter((sauce) => sauce.id_salsa > 0 && sauce.cantidad > 0)
    .sort((left, right) => left.id_salsa - right.id_salsa);

  const cantidad = toSafeQuantity(configuration?.cantidad || 1);
  const precioBase = toMoneyNumber(product?.precio || 0);
  const precioUnitario = calculateConfiguredUnitPrice(precioBase, normalizedExtras);
  const subtotalLinea = calculateLineSubtotal(precioUnitario, cantidad);

  return {
    lineKey: String(lineKey || ''),
    configKey: buildLineConfigSignature({
      product,
      extras: normalizedExtras,
      salsasPorUnidad: normalizedSauces
    }),
    itemType: getCatalogKind(product),
    id_producto: Number(product?.id_producto || 0) || null,
    id_receta: Number(product?.id_receta || 0) || null,
    nombre: getDisplayName(product),
    precioBase,
    precioUnitario,
    cantidad,
    subtotalLinea,
    extras: normalizedExtras,
    salsasPorUnidad: normalizedSauces,
    salsasRequeridasPorUnidad: Math.max(0, Number(configuration?.salsasRequeridasPorUnidad || 0))
  };
};

export const updateLineQuantity = (line, nextQuantity) => {
  const cantidad = toSafeQuantity(nextQuantity);
  return {
    ...line,
    cantidad,
    subtotalLinea: calculateLineSubtotal(line?.precioUnitario || 0, cantidad)
  };
};

const buildStableExtrasToken = (line) => (
  (Array.isArray(line?.extras) ? line.extras : [])
    .map((extra) => {
      const code = normalizeToken(extra?.codigo || extra?.id_extra || extra?.nombre || 'extra');
      if (!code) return null;
      const qty = toSafeQuantity(extra?.cantidad || 1);
      const price = toMoneyNumber(extra?.precio_adicional || 0).toFixed(2);
      return `${code}*${qty}@${price}`;
    })
    .filter(Boolean)
    .sort()
    .join(',')
);

const buildStableSaucesToken = (line) => (
  (Array.isArray(line?.salsasPorUnidad) ? line.salsasPorUnidad : [])
    .map((sauce) => {
      const id = Number(sauce?.id_salsa || 0);
      if (!Number.isInteger(id) || id <= 0) return null;
      const qty = toSafeQuantity(sauce?.cantidad || 1);
      return `${id}*${qty}`;
    })
    .filter(Boolean)
    .sort()
    .join(',')
);

// Serializa extras/salsas en un formato estable para persistirlos via observacion en POST /ventas.
const buildLineObservation = (line) => {
  const extrasToken = buildStableExtrasToken(line);
  const saucesToken = buildStableSaucesToken(line);

  const fragments = [];
  if (extrasToken) fragments.push(`extras=${extrasToken}`);
  if (saucesToken) fragments.push(`salsas=${saucesToken}`);
  if (fragments.length === 0) return null;

  // Prefijo versionado para mantener compatibilidad si el formato cambia en el futuro.
  const packed = `POSCFG:v1|${fragments.join('|')}`.trim();
  return packed.slice(0, 200);
};

const toVentaItemContract = (line) => ({
  id_producto: line?.id_producto || null,
  id_receta: line?.id_receta || null,
  cantidad: toSafeQuantity(line?.cantidad || 1),
  observacion: buildLineObservation(line)
});

// Construye el contrato real de POST /ventas sin depender de campos no soportados por ventas.js.
export const buildMenuPosOrderPayload = ({ items = [], totalAmount = 0 }) => {
  const safeItems = Array.isArray(items) ? items : [];
  const derivedTotal = calculateOrderTotal(safeItems);
  const providedTotal = toMoneyNumber(totalAmount || 0);
  const safeTotal = providedTotal > 0 ? providedTotal : derivedTotal;

  return {
    id_cliente: null,
    metodo_pago: 'efectivo',
    descuento: 0,
    efectivo_entregado: safeTotal,
    descripcion_pedido: null,
    items: safeItems.map(toVentaItemContract)
  };
};
