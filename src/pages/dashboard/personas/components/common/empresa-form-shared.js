export const EMAIL_WITH_DOMAIN_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const RTN_DIGITS_LENGTH = 14;
export const RTN_DISPLAY_MAX_LENGTH = 16;
export const PHONE_DIGITS_LENGTH = 8;
export const PHONE_DISPLAY_MAX_LENGTH = 9;
export const RTN_FORMAT_ERROR = "El RTN debe contener 14 digitos numericos.";

export const normalizeText = (value, options = {}) => {
  const text = String(value ?? "");
  if (!options?.preserveTrailingSpace) return text.trim();
  return text.replace(/^\s+/, "");
};
export const digitsOnly = (value) => String(value ?? "").replace(/\D/g, "");
export const limitText = (value, max) => String(value ?? "").slice(0, max);

export const createInitialEmpresaForm = () => ({
  rtn: "",
  nombre_empresa: "",
  id_telefono: "",
  id_direccion: "",
  id_correo: "",
  estado: true,
});

export const formatRtn = (rawValue) => {
  const clean = limitText(digitsOnly(rawValue), RTN_DIGITS_LENGTH);
  const part1 = clean.slice(0, 4);
  const part2 = clean.slice(4, 8);
  const part3 = clean.slice(8, RTN_DIGITS_LENGTH);

  if (clean.length <= 4) return part1;
  if (clean.length <= 8) return `${part1}-${part2}`;
  return `${part1}-${part2}-${part3}`;
};

export const resolveCaretFromDigitIndex = (formattedValue, digitIndex) => {
  if (!formattedValue) return 0;
  if (digitIndex <= 0) return 0;

  let seenDigits = 0;
  for (let index = 0; index < formattedValue.length; index += 1) {
    const char = formattedValue[index];
    if (char >= "0" && char <= "9") {
      seenDigits += 1;
      if (seenDigits >= digitIndex) return index + 1;
    }
  }

  return formattedValue.length;
};

export const formatPhone = (digits8) => {
  const clean = String(digits8 ?? "");
  const part1 = clean.slice(0, 4);
  const part2 = clean.slice(4, 8);
  if (clean.length <= 4) return part1;
  return `${part1}-${part2}`;
};

const firstNonEmptyText = (...values) => {
  for (const value of values) {
    const text = normalizeText(value);
    if (text) return text;
  }
  return "";
};

const firstNonEmptyTextPreservingTrailingSpace = (...values) => {
  for (const value of values) {
    const text = normalizeText(value, { preserveTrailingSpace: true });
    if (text) return text;
  }
  return "";
};

const isLikelyForeignId = (value) => /^\d{1,6}$/.test(normalizeText(value));

const resolvePhoneDisplayValue = (value = {}) => {
  const preferredPhone = firstNonEmptyText(
    value?.texto_telefono,
    value?.telefono,
    value?.telefono_numero,
    value?.numero_telefono,
    value?.empresa_telefono
  );
  if (preferredPhone) return preferredPhone;

  const idPhone = firstNonEmptyText(value?.id_telefono);
  return idPhone;
};

const resolveAddressDisplayValue = (value = {}) => {
  const preferredAddress = firstNonEmptyTextPreservingTrailingSpace(
    value?.texto_direccion,
    value?.direccion,
    value?.direccion_detalle,
    value?.empresa_direccion
  );
  if (preferredAddress) return preferredAddress;

  const idAddress = firstNonEmptyTextPreservingTrailingSpace(value?.id_direccion);
  return isLikelyForeignId(idAddress) ? "" : idAddress;
};

const resolveEmailDisplayValue = (value = {}) => {
  const preferredEmail = firstNonEmptyText(
    value?.texto_correo,
    value?.correo,
    value?.direccion_correo,
    value?.email,
    value?.empresa_correo
  );
  if (preferredEmail) return preferredEmail;

  const idEmail = firstNonEmptyText(value?.id_correo);
  if (!idEmail || isLikelyForeignId(idEmail)) return "";
  return idEmail;
};

export const normalizeEmpresaFormValues = (value = {}) => ({
  rtn: formatRtn(value?.rtn),
  nombre_empresa: normalizeText(value?.nombre_empresa),
  id_telefono: formatPhone(
    limitText(digitsOnly(resolvePhoneDisplayValue(value)), PHONE_DIGITS_LENGTH)
  ),
  id_direccion: resolveAddressDisplayValue(value),
  id_correo: resolveEmailDisplayValue(value),
  estado: value?.estado === undefined ? true : Boolean(value.estado),
});

export const buildEmpresaPayloadFromForm = (sourceForm = {}) => {
  const rtnRaw = limitText(digitsOnly(sourceForm?.rtn), RTN_DIGITS_LENGTH);
  const telefonoRaw = limitText(digitsOnly(sourceForm?.id_telefono), PHONE_DIGITS_LENGTH);
  const direccion = normalizeText(sourceForm?.id_direccion);
  const correo = normalizeText(sourceForm?.id_correo);

  const payload = {
    rtn: rtnRaw,
    nombre_empresa: normalizeText(sourceForm?.nombre_empresa),
    estado: Boolean(sourceForm?.estado),
  };

  if (telefonoRaw) payload.texto_telefono = formatPhone(telefonoRaw);
  if (direccion) payload.texto_direccion = direccion;
  if (correo) payload.texto_correo = correo;

  return payload;
};

export const validateEmpresaForm = (form = {}) => {
  const currentErrors = {};
  const rtnRaw = limitText(digitsOnly(form.rtn), RTN_DIGITS_LENGTH);
  const telefonoRaw = digitsOnly(form.id_telefono);
  const correoValue = normalizeText(form.id_correo);

  if (!form.nombre_empresa?.trim()) currentErrors.nombre_empresa = "Requerido";
  if (!rtnRaw) {
    currentErrors.rtn = "Requerido";
  } else if (rtnRaw.length !== RTN_DIGITS_LENGTH) {
    currentErrors.rtn = RTN_FORMAT_ERROR;
  }

  if (telefonoRaw && telefonoRaw.length !== PHONE_DIGITS_LENGTH) {
    currentErrors.id_telefono = "Formato invalido";
  }

  if (correoValue && !EMAIL_WITH_DOMAIN_REGEX.test(correoValue)) {
    currentErrors.id_correo = "Ingrese un correo valido con dominio";
  }

  return currentErrors;
};
