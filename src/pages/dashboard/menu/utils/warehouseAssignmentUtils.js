export const normalizePositiveIdList = (value) => {
  const rawList = Array.isArray(value) ? value : [];
  return [...new Set(
    rawList
      .map((item) => Number.parseInt(String(item ?? '').trim(), 10))
      .filter((item) => Number.isSafeInteger(item) && item > 0)
  )];
};
