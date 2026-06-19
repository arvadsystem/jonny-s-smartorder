export const toDisplayTitle = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/(^|[\s/+()\-])([a-záéíóúñü])/g, (_, prefix, char) => `${prefix}${char.toUpperCase()}`);

