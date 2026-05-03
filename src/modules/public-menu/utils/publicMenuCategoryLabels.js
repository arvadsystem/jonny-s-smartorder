export const formatPublicMenuCategoryLabel = (category) =>
  String(category || '')
    .replace(/\bbirria\b/gi, 'Birria')
    .replace(/\bdogs\b/gi, 'Dogs')
    .replace(/\btenders\b/gi, 'Tenders');
