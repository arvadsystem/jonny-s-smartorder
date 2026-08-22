const normalizeProviderId = (value) => {
  const normalized = String(value ?? '').trim();
  return normalized && normalized !== '0' && Number.isFinite(Number(normalized)) && Number(normalized) > 0 ? normalized : '';
};

export const isMissingProvider = (value) => !normalizeProviderId(value);

export const applyProviderToLines = (lines, providerId, mode = 'all') => {
  const normalized = normalizeProviderId(providerId);
  if (!normalized || !Array.isArray(lines)) return Array.isArray(lines) ? lines.map((line) => ({ ...line })) : [];
  return lines.map((line) => mode === 'missing' && !isMissingProvider(line.id_proveedor)
    ? { ...line }
    : { ...line, id_proveedor: normalized });
};

export const countProviderReplacements = (lines, providerId) => {
  const normalized = normalizeProviderId(providerId);
  if (!normalized || !Array.isArray(lines)) return 0;
  return lines.filter((line) => {
    const current = normalizeProviderId(line.id_proveedor);
    return current && current !== normalized;
  }).length;
};

export const countMissingProviders = (lines) => Array.isArray(lines)
  ? lines.filter((line) => isMissingProvider(line.id_proveedor)).length
  : 0;

export const buildProviderDistribution = (lines, providerOptions) => {
  const names = new Map((providerOptions || []).map((option) => [String(option.value), option.label]));
  const counts = new Map();
  (lines || []).forEach((line) => {
    const id = normalizeProviderId(line.id_proveedor);
    const key = id || '';
    const current = counts.get(key) || { id_proveedor: key, nombre: id ? (names.get(id) || `Proveedor #${id}`) : 'Sin proveedor', cantidad: 0, missing: !id };
    current.cantidad += 1;
    counts.set(key, current);
  });
  return [...counts.values()].sort((left, right) => Number(right.missing) - Number(left.missing) || left.nombre.localeCompare(right.nombre));
};
