const getFirstImageValue = (values) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
};

const extractGoogleDriveId = (value) => {
  if (typeof value !== 'string') return null;

  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  const patterns = [
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = trimmedValue.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
};

const normalizeMenuImageSrc = (value) => {
  if (typeof value !== 'string') return null;

  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  const driveFileId = extractGoogleDriveId(trimmedValue);
  if (driveFileId) {
    return `https://lh3.googleusercontent.com/d/${driveFileId}=w1200`;
  }

  return trimmedValue;
};

export const resolveMenuItemImageSrc = (item) =>
  normalizeMenuImageSrc(getFirstImageValue([
    item?.url_imagen,
  ]));
