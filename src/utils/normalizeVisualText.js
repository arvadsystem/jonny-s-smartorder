const SMALL_WORDS = new Set([
  'a', 'al', 'con', 'de', 'del', 'e', 'el', 'en', 'la', 'las', 'lo', 'los', 'o', 'para', 'por', 'u', 'y'
]);

const collapseSpaces = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

const preserveToken = (token) => /^[A-Z0-9&/-]{2,}$/.test(token);

const capitalizeWord = (word) => {
  if (!word) return '';
  const chars = Array.from(word.toLowerCase());
  chars[0] = chars[0].toLocaleUpperCase('es-HN');
  return chars.join('');
};

export const normalizeVisualText = (value, options = {}) => {
  const mode = options?.mode === 'sentence' ? 'sentence' : 'title';
  const collapsed = collapseSpaces(value);
  if (!collapsed) return '';

  if (mode === 'sentence') {
    const chars = Array.from(collapsed.toLowerCase());
    chars[0] = chars[0].toLocaleUpperCase('es-HN');
    return chars.join('');
  }

  const words = collapsed.split(' ');
  return words
    .map((word, index) => {
      if (!word) return '';
      if (preserveToken(word)) return word;
      const lower = word.toLowerCase();
      if (index > 0 && SMALL_WORDS.has(lower)) return lower;
      return capitalizeWord(word);
    })
    .join(' ');
};

export const normalizeVisualFieldMap = (source, fieldMap) => {
  const next = { ...(source || {}) };
  Object.entries(fieldMap || {}).forEach(([field, mode]) => {
    if (!Object.prototype.hasOwnProperty.call(next, field)) return;
    next[field] = normalizeVisualText(next[field], { mode });
  });
  return next;
};

export default normalizeVisualText;
