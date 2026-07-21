export const VENTAS_TIMEZONE = 'America/Tegucigalpa';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;
const HONDURAS_UTC_OFFSET_HOURS = 6;
const HOURS_72_MS = 72 * 60 * 60 * 1000;

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: VENTAS_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const parseCalendarDate = (value) => {
  const match = DATE_PATTERN.exec(String(value || ''));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) return null;
  return { year, month, day };
};
const parseClockTime = (value) => {
  const match = TIME_PATTERN.exec(String(value || ''));
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute, totalMinutes: (hour * 60) + minute };
};

const wallTimeToEpochMs = (date, time) =>
  Date.UTC(date.year, date.month - 1, date.day, time.hour + HONDURAS_UTC_OFFSET_HOURS, time.minute);

export const getTegucigalpaToday = (now = new Date()) => {
  const parts = Object.fromEntries(
    dateFormatter
      .formatToParts(now)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export const createDefaultVentasTemporalFilters = (now = new Date()) => {
  const today = getTegucigalpaToday(now);
  return {
    fechaDesde: today,
    fechaHasta: today,
    horaDesde: '',
    horaHasta: ''
  };
};

export const getVentasCashierMinDate = (now = new Date()) =>
  getTegucigalpaToday(new Date(now.getTime() - HOURS_72_MS));

export const validateVentasTemporalFilters = (
  filters = {},
  { limitedToLast72Hours = false, now = new Date() } = {}
) => {
  const fechaDesde = String(filters.fechaDesde || '').trim();
  const fechaHasta = String(filters.fechaHasta || '').trim();
  const horaDesde = String(filters.horaDesde || '').trim();
  const horaHasta = String(filters.horaHasta || '').trim();
  const desdeDate = parseCalendarDate(fechaDesde);
  const hastaDate = parseCalendarDate(fechaHasta);
  const today = getTegucigalpaToday(now);

  if (!desdeDate || !hastaDate) {
    return { ok: false, code: 'VENTAS_FECHA_INVALIDA', message: 'Selecciona una fecha inicial y una fecha final validas.' };
  }
  if (fechaHasta < fechaDesde) {
    return { ok: false, code: 'VENTAS_RANGO_FECHAS_INVALIDO', message: 'La fecha final no puede ser anterior a la fecha inicial.' };
  }
  if (fechaDesde > today || fechaHasta > today) {
    return { ok: false, code: 'VENTAS_FECHA_FUTURA', message: 'No puedes consultar fechas futuras.' };
  }

  const hasAnyTime = Boolean(horaDesde || horaHasta);
  if (hasAnyTime && (!horaDesde || !horaHasta)) {
    return { ok: false, code: 'VENTAS_HORAS_INCOMPLETAS', message: 'Selecciona tanto la hora inicial como la hora final.' };
  }
  if (hasAnyTime && fechaDesde !== fechaHasta) {
    return { ok: false, code: 'VENTAS_HORAS_REQUIEREN_UN_DIA', message: 'El rango de horas solo se puede usar cuando ambas fechas son iguales.' };
  }

  const desdeTime = hasAnyTime ? parseClockTime(horaDesde) : { hour: 0, minute: 0, totalMinutes: 0 };
  const hastaTime = hasAnyTime ? parseClockTime(horaHasta) : null;
  if (hasAnyTime && (!desdeTime || !hastaTime)) {
    return { ok: false, code: 'VENTAS_HORA_INVALIDA', message: 'Las horas deben tener un formato valido.' };
  }
  if (hasAnyTime && hastaTime.totalMinutes <= desdeTime.totalMinutes) {
    return { ok: false, code: 'VENTAS_RANGO_HORAS_INVALIDO', message: 'La hora final debe ser mayor que la hora inicial.' };
  }

  if (
    limitedToLast72Hours &&
    wallTimeToEpochMs(desdeDate, desdeTime) < (now.getTime() - HOURS_72_MS)
  ) {
    return {
      ok: false,
      code: 'VENTAS_RANGO_72H_EXCEDIDO',
      message: 'Como cajero, solo puedes consultar ventas comprendidas en las ultimas 72 horas.'
    };
  }

  return { ok: true, code: null, message: '' };
};
