const SCALE_DIGITS = 4;
const SCALE = 10_000n;

const toScaled = (value, { allowZero = false, allowNegative = false } = {}) => {
  const text = String(value ?? '').trim();
  const pattern = allowNegative
    ? /^-?(?:0|[1-9]\d*)(?:\.\d{1,4})?$/
    : /^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/;
  if (!pattern.test(text)) return null;
  const negative = text.startsWith('-');
  const unsigned = negative ? text.slice(1) : text;
  const [whole, fraction = ''] = unsigned.split('.');
  const scaled = BigInt(whole) * SCALE + BigInt(fraction.padEnd(SCALE_DIGITS, '0') || '0');
  if (!allowZero && scaled === 0n) return null;
  return negative ? -scaled : scaled;
};

const fromScaled = (scaled) => {
  const negative = scaled < 0n;
  const absolute = negative ? -scaled : scaled;
  const integer = absolute / SCALE;
  const fraction = String(absolute % SCALE).padStart(SCALE_DIGITS, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${integer}${fraction ? `.${fraction}` : ''}`;
};

export const normalizeConversionDecimal = (value, options = {}) => {
  const scaled = toScaled(value, options);
  return scaled === null ? null : fromScaled(scaled);
};

export const multiplyConversionDecimal = (quantity, factor) => {
  const quantityScaled = toScaled(quantity);
  const factorScaled = toScaled(factor);
  if (quantityScaled === null || factorScaled === null) return null;
  const raw = quantityScaled * factorScaled;
  return fromScaled((raw + SCALE / 2n) / SCALE);
};

export const subtractConversionDecimal = (left, right) => {
  const leftScaled = toScaled(left, { allowZero: true });
  const rightScaled = toScaled(right, { allowZero: true });
  if (leftScaled === null || rightScaled === null) return null;
  return fromScaled(leftScaled - rightScaled);
};

export const formatConversionQuantity = (value) => {
  const normalized = normalizeConversionDecimal(value, { allowZero: true, allowNegative: true });
  if (normalized === null) return '';
  const negative = normalized.startsWith('-');
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [whole, fraction] = unsigned.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${grouped}${fraction ? `.${fraction}` : ''}`;
};

export const resolvePresentationLabel = (line) => String(
  line?.unidad_presentacion_visual
  || line?.presentacion_snapshot
  || line?.nombre_presentacion_visual
  || line?.presentacion
  || line?.unidad_base_visual
  || line?.unidad_base
  || 'Unidad'
).trim();

export const isBaseOnlyLine = (line) => {
  if (line?.baseOnly === true) return true;
  if (line?.id_presentacion_insumo) return false;
  const factor = normalizeConversionDecimal(line?.factor_conversion_snapshot ?? line?.factor_conversion_visual ?? '1');
  const presentation = String(line?.presentacion_snapshot || line?.nombre_presentacion_visual || line?.presentacion || '').trim();
  const baseUnit = String(line?.unidad_base || line?.unidad_base_visual || '').trim();
  return factor === '1' && (!presentation || !baseUnit || presentation === baseUnit || String(line?.tipo_item).toUpperCase() === 'PRODUCTO');
};

export const buildConversionPreview = ({
  quantity,
  presentationLabel,
  baseUnit,
  factor = '1',
  baseOnly = false
}) => {
  const normalizedQuantity = normalizeConversionDecimal(quantity);
  const normalizedFactor = normalizeConversionDecimal(factor);
  const resolvedPresentation = String(presentationLabel || baseUnit || 'Unidad').trim();
  const resolvedBaseUnit = String(baseUnit || 'Unidad base').trim();
  if (!normalizedQuantity || !normalizedFactor) return { valid: false };
  const baseQuantity = multiplyConversionDecimal(normalizedQuantity, normalizedFactor);
  if (!baseQuantity) return { valid: false };
  if (baseOnly) {
    return {
      valid: true,
      baseOnly: true,
      quantity: normalizedQuantity,
      baseQuantity,
      baseUnit: resolvedBaseUnit,
      factor: '1',
      text: `${formatConversionQuantity(normalizedQuantity)} ${resolvedBaseUnit}`
    };
  }
  return {
    valid: true,
    baseOnly: false,
    quantity: normalizedQuantity,
    presentationLabel: resolvedPresentation,
    baseQuantity,
    baseUnit: resolvedBaseUnit,
    factor: normalizedFactor,
    text: `${formatConversionQuantity(normalizedQuantity)} ${resolvedPresentation} equivalen a ${formatConversionQuantity(baseQuantity)} ${resolvedBaseUnit}`
  };
};
