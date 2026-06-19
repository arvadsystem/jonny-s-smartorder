export const formatPublicMenuCategoryLabel = (category) =>
  String(category || '')
    .replace(/\brefrescos\s*\/\s*agua\b/gi, 'Refrescos - Agua')
    .replace(/\bjugos\s+naturales?\b/gi, 'Jugos Naturales')
    .replace(/\bbirria\b/gi, 'Birria')
    .replace(/\bdogs\b/gi, 'Dogs')
    .replace(/\btenders\b/gi, 'Tenders');
