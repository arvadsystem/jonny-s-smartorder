const POSTGRES_TIMESTAMP_PATTERN =
  /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d+))?([zZ]|[+-]\d{2}(?::?\d{2})?)?$/;

const normalizeOffset = (offset) => {
  if (!offset) return 'Z';
  if (/^[zZ]$/.test(offset)) return 'Z';
  if (/^[+-]\d{2}$/.test(offset)) return `${offset}:00`;
  if (/^[+-]\d{4}$/.test(offset)) return `${offset.slice(0, 3)}:${offset.slice(3)}`;
  return offset;
};

export const parseKardexUtcDate = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return new Date(value.getTime());

  const rawValue = String(value).trim();
  const match = POSTGRES_TIMESTAMP_PATTERN.exec(rawValue);

  if (!match) return new Date(rawValue);

  const [, datePart, timePart, fraction = '', offset] = match;
  const milliseconds = fraction ? `.${fraction.slice(0, 3).padEnd(3, '0')}` : '';
  return new Date(`${datePart}T${timePart}${milliseconds}${normalizeOffset(offset)}`);
};

export const formatKardexFecha = (value) => {
  if (value === null || value === undefined || value === '') return '-';

  const date = parseKardexUtcDate(value);
  if (!date || Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString('es-HN', {
    timeZone: 'America/Tegucigalpa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};
