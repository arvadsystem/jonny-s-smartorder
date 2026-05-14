export const initialSucursalForm = {
  id_sucursal: null,
  nombre_sucursal: '',
  texto_direccion: '',
  texto_telefono: '',
  texto_correo: '',
  fecha_inauguracion: '',
  hora_inicio: '',
  hora_final: '',
  id_archivo_imagen: null,
  imagen_url_publica: '',
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
  estado: parseEstado(item?.estado),
  hora_inicio: item?.hora_inicio ? String(item.hora_inicio).slice(0, 5) : '',
  hora_final: item?.hora_final ? String(item.hora_final).slice(0, 5) : '',
  id_archivo_imagen: item?.id_archivo_imagen ? Number(item.id_archivo_imagen) : null,
  imagen_url_publica: String(item?.imagen_url_publica || '')
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
  hora_inicio: String(form?.hora_inicio ?? '').trim() || null,
  hora_final: String(form?.hora_final ?? '').trim() || null,
  id_archivo_imagen: Number(form?.id_archivo_imagen ?? 0) > 0 ? Number(form.id_archivo_imagen) : null,
  estado: !!form?.estado
});

export const sanitizePlainText = (value, max = 200) => {
  const raw = String(value ?? '');
  const cleaned = raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/[<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, max);
};

export const toTitleCase = (value) => {
  const cleaned = sanitizePlainText(value, 200)
    .toLocaleLowerCase('es');
  if (!cleaned) return '';
  return cleaned.replace(/(^|\s)(\p{L})/gu, (match, prefix, char) => `${prefix}${char.toLocaleUpperCase('es')}`);
};

export const toSentenceCase = (value) => {
  const cleaned = sanitizePlainText(value, 220).toLocaleLowerCase('es');
  if (!cleaned) return '';
  return cleaned.replace(/^(\p{L})/u, (char) => char.toLocaleUpperCase('es'));
};

export const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase();

export const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

export const hasPhoneLetters = (value) => /[a-zA-Z]/.test(String(value || ''));

export const normalizePhone = (value) => {
  const raw = sanitizePlainText(value, 30);
  return raw.replace(/[^\d+\-()\s]/g, '').replace(/\s+/g, ' ').trim();
};

export const validateSucursalForm = ({ form, sucursales = [], mode = 'create', editId = null }) => {
  const payload = normalizeSucursalPayload(buildSucursalPayload(form));
  const errors = {};

  if (!payload.nombre_sucursal) errors.nombre_sucursal = 'EL NOMBRE DE LA SUCURSAL ES OBLIGATORIO';
  else if (payload.nombre_sucursal.length < 2) errors.nombre_sucursal = 'MINIMO 2 CARACTERES';
  else if (payload.nombre_sucursal.length > 80) errors.nombre_sucursal = 'MAXIMO 80 CARACTERES';

  if (payload.texto_direccion && payload.texto_direccion.length > 200) {
    errors.texto_direccion = 'MAXIMO 200 CARACTERES';
  }

  if (payload.texto_telefono && payload.texto_telefono.length > 30) {
    errors.texto_telefono = 'MAXIMO 30 CARACTERES';
  } else if (payload.texto_telefono && hasPhoneLetters(payload.texto_telefono)) {
    errors.texto_telefono = 'EL TELEFONO NO DEBE CONTENER LETRAS';
  }

  if (payload.texto_correo) {
    if (payload.texto_correo.length > 120) {
      errors.texto_correo = 'MAXIMO 120 CARACTERES';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.texto_correo)) {
      errors.texto_correo = 'CORREO INVALIDO';
    }
  }

  if (payload.fecha_inauguracion && !isValidDate(payload.fecha_inauguracion)) {
    errors.fecha_inauguracion = 'FECHA INVALIDA';
  }

  if ((payload.hora_inicio && !payload.hora_final) || (!payload.hora_inicio && payload.hora_final)) {
    errors.hora_final = 'DEBE DEFINIR HORA INICIO Y HORA FINAL';
  }
  if (payload.hora_inicio && payload.hora_final && payload.hora_final <= payload.hora_inicio) {
    errors.hora_final = 'HORA FINAL DEBE SER MAYOR A HORA INICIO';
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

export const DIAS_SEMANA = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miercoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sabado' },
  { value: 7, label: 'Domingo' }
];

export const FECHA_ESPECIAL_TIPOS = ['FERIADO', 'CIERRE_ESPECIAL', 'HORARIO_ESPECIAL'];

export const isValidTime = (value) => /^\d{2}:\d{2}(:\d{2})?$/.test(String(value || '').trim());
export const normalizeTime = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const raw = String(value).trim();
  if (!isValidTime(raw)) return null;
  return raw.length === 8 ? raw.slice(0, 5) : raw;
};
export const isEndTimeAfterStart = (start, end) => {
  const a = normalizeTime(start);
  const b = normalizeTime(end);
  if (!a || !b) return false;
  return b > a;
};
export const isValidDate = (value) => {
  const raw = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const [year, month, day] = raw.split('-').map((part) => Number(part));
  const dt = new Date(Date.UTC(year, month - 1, day));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() + 1 === month && dt.getUTCDate() === day;
};

export const normalizeSucursalPayload = (payload = {}) => {
  const nombre = toTitleCase(payload?.nombre_sucursal);
  const direccion = toSentenceCase(payload?.texto_direccion);
  const telefono = normalizePhone(payload?.texto_telefono);
  const correo = normalizeEmail(sanitizePlainText(payload?.texto_correo, 120));
  const fecha = String(payload?.fecha_inauguracion ?? '').trim();
  const estado = payload?.estado === true || payload?.estado === false ? payload.estado : Boolean(payload?.estado);

  return {
    ...payload,
    nombre_sucursal: nombre,
    texto_direccion: direccion || null,
    texto_telefono: telefono || null,
    texto_correo: correo || null,
    fecha_inauguracion: fecha || null,
    estado
  };
};

export const validateHorarioRegular = (horarios = []) => {
  const list = Array.isArray(horarios) ? horarios : [];
  if (list.length > 7) return { ok: false, message: 'No se pudieron guardar los horarios. Verifica los datos ingresados.' };
  const seen = new Set();
  for (const row of list) {
    const dia = Number(row?.dia_semana ?? 0);
    if (!Number.isInteger(dia) || dia < 1 || dia > 7 || seen.has(dia)) {
      return { ok: false, message: 'No se pudieron guardar los horarios. Verifica los datos ingresados.' };
    }
    seen.add(dia);
    const cerrado = Boolean(row?.cerrado);
    if (!cerrado && (!isValidTime(row?.hora_inicio) || !isValidTime(row?.hora_final) || !isEndTimeAfterStart(row?.hora_inicio, row?.hora_final))) {
      return { ok: false, message: 'No se pudieron guardar los horarios. Verifica los datos ingresados.' };
    }
  }
  return { ok: true };
};

export const validateFechaEspecial = (payload = {}) => {
  if (!isValidDate(payload?.fecha)) return { ok: false, message: 'No se pudo guardar la fecha especial.' };
  if (!FECHA_ESPECIAL_TIPOS.includes(String(payload?.tipo || '').trim().toUpperCase())) return { ok: false, message: 'No se pudo guardar la fecha especial.' };
  const descripcion = sanitizePlainText(payload?.descripcion, 200);
  if (String(payload?.descripcion || '').trim().length > 200) return { ok: false, message: 'No se pudo guardar la fecha especial.' };
  const cerrado = Boolean(payload?.cerrado);
  if (!cerrado && (!isValidTime(payload?.hora_inicio) || !isValidTime(payload?.hora_final) || !isEndTimeAfterStart(payload?.hora_inicio, payload?.hora_final))) {
    return { ok: false, message: 'No se pudo guardar la fecha especial.' };
  }
  return {
    ok: true,
    payload: {
      fecha: String(payload.fecha).trim(),
      tipo: String(payload.tipo).trim().toUpperCase(),
      descripcion,
      cerrado,
      hora_inicio: cerrado ? null : normalizeTime(payload.hora_inicio),
      hora_final: cerrado ? null : normalizeTime(payload.hora_final),
      estado: payload?.estado !== false
    }
  };
};
