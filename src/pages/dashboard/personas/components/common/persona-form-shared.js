export const EMAIL_WITH_DOMAIN_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const DNI_DIGITS_LENGTH = 13;
export const PHONE_DIGITS_LENGTH = 8;

export const ALLOWED_EDITING_KEYS = new Set([
  "Backspace",
  "Delete",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "Tab",
  "Enter",
  "Escape",
]);

export const LETTERS_INPUT_REGEX = /^[A-Za-z\u00C1\u00C9\u00CD\u00D3\u00DA\u00E1\u00E9\u00ED\u00F3\u00FA\u00D1\u00F1\u00DC\u00FC\s]+$/;

export const createInitialPersonaForm = () => ({
  nombre: "",
  apellido: "",
  dni: "",
  rtn: "",
  genero: "",
  fecha_nacimiento: "",
  id_telefono: "",
  id_direccion: "",
  id_correo: "",
});

export const createInitialPersonaTouched = () => ({
  nombre: false,
  apellido: false,
  dni: false,
  genero: false,
  fechaNacimiento: false,
  telefono: false,
  correo: false,
  rtn: false,
});

export const personaFormFieldToTouchedKey = {
  nombre: "nombre",
  apellido: "apellido",
  dni: "dni",
  genero: "genero",
  fecha_nacimiento: "fechaNacimiento",
  id_telefono: "telefono",
  id_correo: "correo",
  rtn: "rtn",
};

export const lettersAndSpaces = (value) =>
  String(value ?? "").replace(
    /[^A-Za-z\u00C1\u00C9\u00CD\u00D3\u00DA\u00E1\u00E9\u00ED\u00F3\u00FA\u00D1\u00F1\u00DC\u00FC\s]/g,
    ""
  );

export const capitalizeFirstOnly = (value) => {
  if (!value) return "";
  const s = String(value).toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const normalizeHumanNameInput = (value, { preserveTrailingSpace = false } = {}) => {
  const noInvalidChars = lettersAndSpaces(value).replace(/\s+/g, " ").replace(/^\s+/, "");
  const hadTrailingSpace = preserveTrailingSpace && /\s$/.test(noInvalidChars);
  const base = noInvalidChars.trimEnd();
  if (!base) return "";
  const words = base.split(" ").filter(Boolean).map((word) => capitalizeFirstOnly(word));
  const normalized = words.join(" ");
  return hadTrailingSpace ? `${normalized} ` : normalized;
};

export const digitsOnly = (value) => String(value ?? "").replace(/\D/g, "");

export const limit = (value, max) => String(value ?? "").slice(0, max);

export const formatDNI = (digits13) => {
  const d = String(digits13 ?? "");
  const p1 = d.slice(0, 4);
  const p2 = d.slice(4, 8);
  const p3 = d.slice(8, DNI_DIGITS_LENGTH);
  if (d.length <= 4) return p1;
  if (d.length <= 8) return `${p1}-${p2}`;
  return `${p1}-${p2}-${p3}`;
};

export const formatPhone = (digits8) => {
  const d = String(digits8 ?? "");
  const p1 = d.slice(0, 4);
  const p2 = d.slice(4, PHONE_DIGITS_LENGTH);
  if (d.length <= 4) return p1;
  return `${p1}-${p2}`;
};

const normalizeTextValue = (value) => String(value ?? "").trim();
const normalizeComparableText = (value) =>
  normalizeTextValue(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const UI_PLACEHOLDER_VALUES = new Set([
  "no registrado",
  "no registrada",
  "sin registrar",
  "sin registro",
  "no disponible",
  "sin correo",
  "sin telefono",
  "sin direccion",
  "n/d",
  "null",
  "undefined",
]);

const isUiPlaceholderText = (value) => {
  const normalized = normalizeComparableText(value);
  if (!normalized) return false;
  if (UI_PLACEHOLDER_VALUES.has(normalized)) return true;
  if (/^no registrad[oa]$/.test(normalized)) return true;
  return false;
};

const firstNonEmptyText = (...values) => {
  for (const value of values) {
    const text = normalizeTextValue(value);
    if (!text) continue;
    if (isUiPlaceholderText(text)) continue;
    return text;
  }
  return "";
};

const isLikelyForeignId = (value) => {
  const text = normalizeTextValue(value);
  return /^\d{1,6}$/.test(text);
};

const resolvePhoneDisplayValue = (value = {}) => {
  const preferredPhone = firstNonEmptyText(
    value?.texto_telefono,
    value?.telefono,
    value?.telefono_numero,
    value?.numero_telefono,
    value?.persona_telefono,
    value?.telefono_persona
  );
  if (preferredPhone) return preferredPhone;

  const idPhone = firstNonEmptyText(value?.id_telefono);
  return idPhone;
};

const resolveAddressDisplayValue = (value = {}) => {
  const preferredAddress = firstNonEmptyText(
    value?.texto_direccion,
    value?.direccion,
    value?.direccion_detalle,
    value?.persona_direccion,
    value?.direccion_persona
  );
  if (preferredAddress) return preferredAddress;

  const idAddress = firstNonEmptyText(value?.id_direccion);
  return isLikelyForeignId(idAddress) ? "" : idAddress;
};

const resolveEmailDisplayValue = (value = {}) => {
  const preferredEmail = firstNonEmptyText(
    value?.texto_correo,
    value?.direccion_correo,
    value?.correo,
    value?.email,
    value?.correo_electronico,
    value?.persona_correo,
    value?.correo_persona
  );
  if (preferredEmail) return preferredEmail;

  const idEmail = firstNonEmptyText(value?.id_correo);
  if (!idEmail || isLikelyForeignId(idEmail)) return "";
  return idEmail;
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

export const normalizePersonaFormValues = (value = {}, options = {}) => {
  const preserveNameTrailingSpace = Boolean(options?.preserveNameTrailingSpace);
  const base = createInitialPersonaForm();
  const telefonoFuente = resolvePhoneDisplayValue(value);
  const direccionFuente = resolveAddressDisplayValue(value);
  const correoFuente = resolveEmailDisplayValue(value);

  return {
    ...base,
    nombre: normalizeHumanNameInput(value?.nombre, { preserveTrailingSpace: preserveNameTrailingSpace }),
    apellido: normalizeHumanNameInput(value?.apellido, { preserveTrailingSpace: preserveNameTrailingSpace }),
    dni: formatDNI(limit(digitsOnly(value?.dni ?? ""), DNI_DIGITS_LENGTH)),
    rtn: limit(digitsOnly(value?.rtn ?? ""), 1),
    genero: String(value?.genero ?? "").trim(),
    fecha_nacimiento: String(value?.fecha_nacimiento ?? "").trim(),
    id_telefono: formatPhone(
      limit(
        digitsOnly(telefonoFuente),
        PHONE_DIGITS_LENGTH
      )
    ),
    id_direccion: direccionFuente,
    id_correo: correoFuente,
  };
};

export const buildPersonaPayloadFromForm = (sourceForm = {}) => ({
  nombre: sourceForm?.nombre ?? "",
  apellido: sourceForm?.apellido ?? "",
  fecha_nacimiento: sourceForm?.fecha_nacimiento ?? "",
  genero: sourceForm?.genero ?? "",
  dni: sourceForm?.dni ?? "",
  rtn: sourceForm?.rtn ?? "",
  texto_direccion: String(sourceForm?.id_direccion ?? "").trim(),
  texto_telefono: String(sourceForm?.id_telefono ?? "").trim(),
  texto_correo: String(sourceForm?.id_correo ?? "").trim(),
});

export const validatePersonaField = (fieldName, value) => {
  const currentValue = String(value ?? "");
  const trimmedValue = currentValue.trim();
  const today = new Date().toISOString().split("T")[0];

  switch (fieldName) {
    case "nombre":
    case "apellido":
      if (!trimmedValue) return "Requerido";
      if (!LETTERS_INPUT_REGEX.test(trimmedValue)) return "Solo letras y espacios";
      return "";
    case "dni": {
      const dniRaw = digitsOnly(currentValue);
      if (!dniRaw) return "";
      if (dniRaw.length !== DNI_DIGITS_LENGTH) return "Formato invalido";
      return "";
    }
    case "rtn":
      if (trimmedValue && !/^\d{1}$/.test(trimmedValue)) {
        return "Debe ingresar solo el numero de complemento";
      }
      return "";
    case "genero":
      return trimmedValue ? "" : "Seleccione";
    case "fecha_nacimiento":
      if (trimmedValue && trimmedValue > today) return "Fecha invalida";
      return "";
    case "id_telefono": {
      const telefonoRaw = digitsOnly(currentValue);
      if (!telefonoRaw) return "";
      if (telefonoRaw.length !== PHONE_DIGITS_LENGTH) return "Formato invalido";
      return "";
    }
    case "id_correo":
      if (trimmedValue && !EMAIL_WITH_DOMAIN_REGEX.test(trimmedValue)) {
        return "Ingrese un correo valido con dominio (ej: usuario@dominio.com)";
      }
      return "";
    default:
      return "";
  }
};

export const validatePersonaForm = (form = {}) => {
  const fieldsToValidate = [
    "nombre",
    "apellido",
    "dni",
    "rtn",
    "genero",
    "fecha_nacimiento",
    "id_telefono",
    "id_correo",
  ];

  const currentErrors = {};
  fieldsToValidate.forEach((fieldName) => {
    const fieldError = validatePersonaField(fieldName, form[fieldName], form);
    if (fieldError) currentErrors[fieldName] = fieldError;
  });

  return currentErrors;
};
