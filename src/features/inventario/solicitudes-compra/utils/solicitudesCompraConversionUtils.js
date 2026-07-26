const TARGET_SCALE = 6;
const SCALE = 1_000_000n;
const powerOfTen = (exponent) => 10n ** BigInt(exponent);

const parseDecimal = (value, { allowZero = false, allowNegative = false } = {}) => {
  const text = String(value ?? '').trim();
  const pattern = allowNegative
    ? /^-?(?:0|[1-9]\d*)(?:\.\d{1,6})?$/
    : /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/;
  if (!pattern.test(text)) return null;
  const negative = text.startsWith('-');
  const unsigned = negative ? text.slice(1) : text;
  const [whole, fraction = ''] = unsigned.split('.');
  const digits = BigInt(`${whole}${fraction}`);
  if (!allowZero && digits === 0n) return null;
  return { digits: negative ? -digits : digits, scale: fraction.length };
};

const decimalToScaled6 = (decimal) => decimal.digits * powerOfTen(TARGET_SCALE - decimal.scale);

const fromScaled6 = (scaled) => {
  const negative = scaled < 0n;
  const absolute = negative ? -scaled : scaled;
  const integer = absolute / SCALE;
  const fraction = String(absolute % SCALE).padStart(TARGET_SCALE, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${integer}${fraction ? `.${fraction}` : ''}`;
};

export const normalizeConversionDecimal = (value, options = {}) => {
  const decimal = parseDecimal(value, options);
  return decimal === null ? null : fromScaled6(decimalToScaled6(decimal));
};

export const multiplyConversionDecimal = (quantity, factor) => {
  const left = parseDecimal(quantity);
  const right = parseDecimal(factor);
  if (!left || !right) return null;
  const product = left.digits * right.digits;
  const sourceScale = left.scale + right.scale;
  let scaled;
  if (sourceScale <= TARGET_SCALE) {
    scaled = product * powerOfTen(TARGET_SCALE - sourceScale);
  } else {
    const divisor = powerOfTen(sourceScale - TARGET_SCALE);
    scaled = product / divisor;
    if ((product % divisor) * 2n >= divisor) scaled += 1n;
  }
  return fromScaled6(scaled);
};

export const subtractConversionDecimal = (left, right) => {
  const leftDecimal = parseDecimal(left, { allowZero: true });
  const rightDecimal = parseDecimal(right, { allowZero: true });
  if (!leftDecimal || !rightDecimal) return null;
  return fromScaled6(decimalToScaled6(leftDecimal) - decimalToScaled6(rightDecimal));
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
