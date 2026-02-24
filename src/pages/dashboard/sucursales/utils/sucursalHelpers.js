export const initialSucursalForm = {
  id_sucursal: null,
  nombre_sucursal: '',
  texto_direccion: '',
  texto_telefono: '',
  texto_correo: '',
  fecha_inauguracion: '',
  estado: true
};

export const resolveCardsPerPage = (width) => {
  if (width >= 1200) return 6;
  if (width >= 620) return 4;
  return 2;
};

export const parseEstado = (value) => {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return Boolean(value);
};

export const normalizeSucursalRecord = (item) => ({
  ...(item || {}),
  estado: parseEstado(item?.estado)
});

export const normalizeComparable = (value) =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

export const normalizeDateForInput = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const formatDateLabel = (value) => {
  if (!value) return 'Sin fecha';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('es-HN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  });
};

export const getAntiguedadLabel = (sucursal) =>
  sucursal?.antiguedad_calculada || sucursal?.antiguedad || sucursal?.antiguedad_texto || 'No disponible';

export const buildSucursalPayload = (form) => ({
  nombre_sucursal: String(form?.nombre_sucursal ?? '').trim(),
  texto_direccion: String(form?.texto_direccion ?? '').trim() || null,
  texto_telefono: String(form?.texto_telefono ?? '').trim() || null,
  texto_correo: String(form?.texto_correo ?? '').trim() || null,
  fecha_inauguracion: String(form?.fecha_inauguracion ?? '').trim() || null,
  estado: !!form?.estado
});

export const validateSucursalForm = ({ form, sucursales = [], mode = 'create', editId = null }) => {
  const payload = buildSucursalPayload(form);
  const errors = {};

  if (!payload.nombre_sucursal) errors.nombre_sucursal = 'EL NOMBRE DE LA SUCURSAL ES OBLIGATORIO';
  else if (payload.nombre_sucursal.length < 2) errors.nombre_sucursal = 'MINIMO 2 CARACTERES';
  else if (payload.nombre_sucursal.length > 80) errors.nombre_sucursal = 'MAXIMO 80 CARACTERES';

  if (payload.texto_direccion && payload.texto_direccion.length > 200) {
    errors.texto_direccion = 'MAXIMO 200 CARACTERES';
  }

  if (payload.texto_telefono && payload.texto_telefono.length > 30) {
    errors.texto_telefono = 'MAXIMO 30 CARACTERES';
  }

  if (payload.texto_correo) {
    if (payload.texto_correo.length > 120) {
      errors.texto_correo = 'MAXIMO 120 CARACTERES';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.texto_correo)) {
      errors.texto_correo = 'CORREO INVALIDO';
    }
  }

  const isSameRecord = (item) =>
    mode === 'edit' && Number(item?.id_sucursal ?? 0) === Number(editId ?? 0);

  const nombreNorm = normalizeComparable(payload.nombre_sucursal);
  const direccionNorm = normalizeComparable(payload.texto_direccion);

  const nombreDuplicado =
    !!nombreNorm &&
    (Array.isArray(sucursales) ? sucursales : []).some(
      (s) => !isSameRecord(s) && normalizeComparable(s?.nombre_sucursal) === nombreNorm
    );

  const direccionDuplicada =
    !!direccionNorm &&
    (Array.isArray(sucursales) ? sucursales : []).some(
      (s) => !isSameRecord(s) && normalizeComparable(s?.texto_direccion) === direccionNorm
    );

  if (nombreDuplicado) errors.nombre_sucursal = 'YA EXISTE UNA SUCURSAL CON ESE NOMBRE';
  if (direccionDuplicada) errors.texto_direccion = 'YA EXISTE UNA SUCURSAL CON ESA DIRECCION';

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    payload,
    duplicates: {
      nombre_sucursal: nombreDuplicado,
      texto_direccion: direccionDuplicada
    }
  };
};

export const extractApiMessage = (error, fallback = 'ERROR EN LA OPERACION') => {
  const data = error?.data;
  if (data && typeof data === 'object') {
    return String(data.message || data.mensaje || error?.message || fallback);
  }
  return String(error?.message || fallback);
};

export const inferDuplicateFieldErrors = (error) => {
  const message = extractApiMessage(error, '').toLowerCase();
  const result = {};

  if (!message) return result;
  if (message.includes('duplic') || message.includes('exists') || message.includes('existe')) {
    if (message.includes('nombre')) result.nombre_sucursal = 'YA EXISTE UNA SUCURSAL CON ESE NOMBRE';
    if (message.includes('direccion') || message.includes('dirección')) {
      result.texto_direccion = 'YA EXISTE UNA SUCURSAL CON ESA DIRECCION';
    }
  }

  return result;
};

export const buildSparklinePoints = (series, width = 120, height = 44, padding = 4) => {
  if (!Array.isArray(series) || series.length < 2) return '';
  const values = series.map((value) => Number(value ?? 0));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const safeWidth = Math.max(width - padding * 2, 1);
  const safeHeight = Math.max(height - padding * 2, 1);

  return values
    .map((value, index) => {
      const x = padding + (safeWidth * index) / (values.length - 1);
      const y = padding + safeHeight - ((value - min) / range) * safeHeight;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
};

export const buildKpiSeries = (stats) => {
  const makeSeries = (value, neighbor = 0) => {
    const v = Math.max(0, Number(value ?? 0));
    const n = Math.max(0, Number(neighbor ?? 0));
    const delta = Math.max(1, Math.round(Math.max(v, n) * 0.12));
    return [
      Math.max(0, v - delta),
      Math.max(0, Math.round((v + n) / 2)),
      v,
      Math.max(0, v - Math.round(delta / 2)),
      v
    ];
  };

  return {
    total: makeSeries(stats?.total, stats?.activas),
    activas: makeSeries(stats?.activas, stats?.total),
    inactivas: makeSeries(stats?.inactivas, stats?.total)
  };
};

