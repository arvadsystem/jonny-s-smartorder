export const CAJA_SUCURSAL_STORAGE_PREFIX = 'jonny:ventas:caja:sucursal';

export const normalizeCajaStorageUserId = (value) => {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isInteger(parsed) && parsed > 0 ? String(parsed) : 'anon';
};

export const buildCajaSucursalStorageKey = (userId) =>
  `${CAJA_SUCURSAL_STORAGE_PREFIX}:${normalizeCajaStorageUserId(userId)}`;
