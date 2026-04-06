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

export const normalizePersonaFormValues = (value = {}) => {
  const base = createInitialPersonaForm();
  return {
    ...base,
    nombre: String(value?.nombre ?? "").trim(),
    apellido: String(value?.apellido ?? "").trim(),
    dni: formatDNI(limit(digitsOnly(value?.dni ?? ""), DNI_DIGITS_LENGTH)),
    rtn: limit(digitsOnly(value?.rtn ?? ""), 1),
    genero: String(value?.genero ?? "").trim(),
    fecha_nacimiento: String(value?.fecha_nacimiento ?? "").trim(),
    id_telefono: formatPhone(
      limit(
        digitsOnly(
          value?.id_telefono ?? value?.texto_telefono ?? value?.telefono ?? ""
        ),
        PHONE_DIGITS_LENGTH
      )
    ),
    id_direccion: String(
      value?.id_direccion ?? value?.texto_direccion ?? value?.direccion ?? ""
    ).trim(),
    id_correo: String(
      value?.id_correo ??
        value?.texto_correo ??
        value?.direccion_correo ??
        value?.correo ??
        ""
    ).trim(),
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
      return trimmedValue ? "" : "Requerido";
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
        return "Ingrese un correo válido con dominio (ej: usuario@dominio.com)";
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

