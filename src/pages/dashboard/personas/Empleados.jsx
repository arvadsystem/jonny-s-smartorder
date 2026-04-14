import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Select from "react-select";
import { personaService } from "../../../services/personasService";
import sucursalesService from "../../../services/sucursalesService";
import { API_URL } from "../../../utils/constants";
import EntityTable from "../../../components/ui/EntityTable";
import HeaderModulo from "./components/common/HeaderModulo";
import ModuleFiltros from "./components/common/ModuleFiltros";
import ModuleKPICards from "./components/common/ModuleKPICards";
import EmpleadoCard from "./components/empleados/EmpleadoCard";
import EmployeeDetailModal from "./components/empleados/EmployeeDetailModal";
import SearchSuggestionsDropdown from "./components/common/SearchSuggestionsDropdown";
import useSearchSuggestionsDropdown, {
  MIN_CHARS_FOR_SUGGESTIONS,
  normalizeSearchText,
} from "./components/common/useSearchSuggestionsDropdown";
import SmartSelectEntity from "./components/common/SmartSelectEntity";
import PersonaInlineCreateModal from "./components/common/PersonaInlineCreateModal";
import {
  buildPersonaPayloadFromForm,
  createInitialPersonaForm,
  normalizePersonaFormValues,
  validatePersonaForm,
} from "./components/common/persona-form-shared";
import "./components/common/crud-modal-theme.css";
import "./components/empleados/empleados-modal.css";

const emptyForm = {
  id_persona: "",
  id_sucursal: "",
  fecha_ingreso: "",
  salario_base: "",
  cargo: "",
  nombre_referencia: "",
  telefono_referencia: "",
  estado: true,
};

const emptyInlinePersonaForm = createInitialPersonaForm();

const createInitialFiltersDraft = () => ({
  estadoFiltro: "todos",
  sortBy: "recientes",
});

const buildEmpleadosSelectStyles = (hasError = false) => ({
  control: (base, state) => ({
    ...base,
    minHeight: 42,
    borderRadius: 12,
    borderColor: hasError
      ? "var(--bs-danger, #dc3545)"
      : state.isFocused
        ? "rgba(158, 105, 61, 0.72)"
        : "rgba(206, 196, 177, 0.9)",
    boxShadow: state.isFocused
      ? "0 0 0 0.2rem rgba(158, 105, 61, 0.18)"
      : "none",
    backgroundColor: "#fff",
    "&:hover": {
      borderColor: hasError
        ? "var(--bs-danger, #dc3545)"
        : "rgba(158, 105, 61, 0.72)",
    },
  }),
  valueContainer: (base) => ({
    ...base,
    padding: "2px 12px",
  }),
  input: (base) => ({
    ...base,
    margin: 0,
    padding: 0,
  }),
  placeholder: (base) => ({
    ...base,
    color: "rgba(98, 83, 73, 0.75)",
  }),
  singleValue: (base) => ({
    ...base,
    color: "#2f1a10",
  }),
  indicatorsContainer: (base) => ({
    ...base,
    paddingRight: 4,
  }),
  dropdownIndicator: (base, state) => ({
    ...base,
    color: state.isFocused ? "rgba(99, 58, 37, 0.9)" : "rgba(99, 58, 37, 0.65)",
  }),
  clearIndicator: (base) => ({
    ...base,
    color: "rgba(120, 84, 66, 0.72)",
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 3000,
  }),
  menu: (base) => ({
    ...base,
    borderRadius: 12,
    border: "1px solid rgba(206, 196, 177, 0.9)",
    overflow: "hidden",
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused
      ? "rgba(243, 238, 226, 0.95)"
      : state.isSelected
        ? "rgba(236, 222, 205, 0.95)"
        : "#fff",
    color: "#2f1a10",
  }),
});

const normalizeListResponse = (resp) => {
  if (Array.isArray(resp)) {
    return { items: resp, total: resp.length };
  }

  const items =
    (resp && (resp.items || resp.data || resp.rows || resp.resultados || resp.empleados)) || [];
  const total =
    (resp && (resp.total || resp.totalItems || resp.count || resp.total_count)) ||
    (Array.isArray(items) ? items.length : 0);

  return { items: Array.isArray(items) ? items : [], total: Number(total) || 0 };
};

const normalizeArrayPayload = (resp) => {
  if (Array.isArray(resp)) return resp;
  if (Array.isArray(resp?.data)) return resp.data;
  if (Array.isArray(resp?.items)) return resp.items;
  if (Array.isArray(resp?.rows)) return resp.rows;
  if (Array.isArray(resp?.resultados)) return resp.resultados;
  if (Array.isArray(resp?.resultado)) return resp.resultado;
  return [];
};

const extractEmpleadoIdFromCreateResponse = (response) => {
  const candidates = [
    response?.id_empleado,
    response?.id,
    response?.insertId,
    response?.data?.id_empleado,
    response?.data?.id,
    response?.empleado?.id_empleado,
    response?.empleado?.id,
    response?.data?.empleado?.id_empleado,
    response?.data?.empleado?.id,
  ];

  for (const candidate of candidates) {
    const parsed = Number.parseInt(String(candidate ?? ""), 10);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }

  return null;
};

const normalizeValue = (value) => String(value ?? "").trim().toLowerCase();
const normalizeSearchToken = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const toDateInputValue = (value) => {
  if (!value) return "";
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const REFERENCE_PHONE_DIGITS = 8;
const ALLOWED_EDITING_KEYS = new Set([
  "Backspace",
  "Delete",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Tab",
  "Home",
  "End",
  "Enter",
]);
const REFERENCE_NAME_CHAR_REGEX = /^[\p{L}\s]$/u;

const digitsOnly = (value) => String(value ?? "").replace(/\D/g, "");

const resolveCaretFromDigitIndex = (formattedValue, digitIndex) => {
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

const formatReferencePhone = (value) => {
  const digits = digitsOnly(value).slice(0, REFERENCE_PHONE_DIGITS);
  if (!digits) return "";
  if (digits.length < 4) return digits;
  if (digits.length === 4) return `${digits}-`;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
};

const sanitizeReferenceName = (value) => String(value ?? "").replace(/[^\p{L}\s]/gu, "");

const resolveCardsPerPage = (width) => {
  if (width >= 1200) return 6;
  if (width >= 620) return 4;
  return 2;
};

const toDisplayValue = (value, fallback = "No registrado") => {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
};

const readViewMode = (storageKey) => {
  if (typeof window === "undefined") return "cards";
  try {
    return window.localStorage.getItem(storageKey) === "table" ? "table" : "cards";
  } catch {
    return "cards";
  }
};

const formatDateLabel = (value) => {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("es-HN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const getFirstNonEmptyField = (record, keys) => {
  if (!record || !Array.isArray(keys)) return "";
  for (const key of keys) {
    const value = record[key];
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
};

const getFirstNonEmptyValue = (values) => {
  if (!Array.isArray(values)) return "";
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
};

const getDni = (empleado) =>
  getFirstNonEmptyValue([
    getFirstNonEmptyField(empleado, ["persona_dni", "dni"]),
    getFirstNonEmptyField(empleado?.persona, ["dni", "persona_dni"]),
  ]);

const getTelefono = (empleado) =>
  getFirstNonEmptyValue([
    getFirstNonEmptyField(empleado, [
      "telefono",
      "texto_telefono",
      "telefono_texto",
      "telefono_numero",
      "numero_telefono",
      "persona_telefono",
      "telefono_persona",
      "celular",
    ]),
    getFirstNonEmptyField(empleado?.persona, [
      "telefono",
      "texto_telefono",
      "telefono_texto",
      "telefono_numero",
      "numero_telefono",
      "persona_telefono",
      "telefono_persona",
      "celular",
    ]),
  ]);

const getCorreo = (empleado) =>
  getFirstNonEmptyValue([
    getFirstNonEmptyField(empleado, [
      "correo",
      "texto_correo",
      "correo_texto",
      "direccion_correo",
      "email",
      "correo_electronico",
      "persona_correo",
      "correo_persona",
    ]),
    getFirstNonEmptyField(empleado?.persona, [
      "correo",
      "texto_correo",
      "correo_texto",
      "direccion_correo",
      "email",
      "correo_electronico",
      "persona_correo",
      "correo_persona",
    ]),
  ]);

const getCargo = (empleado) =>
  getFirstNonEmptyField(empleado, [
    "cargo",
    "nombre_cargo",
    "cargo_nombre",
    "puesto",
    "rol",
    "cargo_puesto",
    "cargo_descripcion",
  ]);

const getNombreReferencia = (empleado) =>
  getFirstNonEmptyField(empleado, ["nombre_referencia", "referencia_nombre", "nombre_contacto_referencia"]);

const getTelefonoReferencia = (empleado) =>
  getFirstNonEmptyField(empleado, ["telefono_referencia", "referencia_telefono", "telefono_contacto_referencia"]);
const SUGGESTION_LIMIT = 8;
const MAX_EMPLEADOS_PAGE_CACHE = 24;

const isAbortError = (error) =>
  Boolean(error) && (
    error.name === "AbortError" ||
    error.code === "ABORT_ERR" ||
    String(error.message || "").toLowerCase().includes("aborted")
  );

const IMAGE_ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const IMAGE_MAX_BYTES = 6 * 1024 * 1024;
const EMPLOYEE_IMAGE_PROCESSING_MESSAGE = "Procesando imagen... espere un momento.";
const EMPLOYEE_IMAGE_UPLOAD_ERROR_MESSAGE = "No se pudo guardar la imagen del empleado.";
const EMPLOYEE_IMAGE_REQUIRES_USER_MESSAGE = "No se pudo sincronizar la imagen del empleado en el servidor.";
const EMPLOYEE_IMAGES_STORAGE_KEY = "empleado_images";
const DATA_IMAGE_RE = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/i;
const ABSOLUTE_URL_RE = /^https?:\/\//i;
const UPLOADS_PATH_RE = /^\/uploads(?:\/|$)/i;
const EMPLEADO_IMAGE_VALUE_FIELDS = [
  "foto_perfil",
  "foto",
  "imagen",
  "imagen_perfil",
  "url_imagen",
  "foto_url",
  "photo_url",
  "avatar_url",
];
const EMPLEADO_SIGNED_URL_FIELDS = [
  "foto_perfil_url_firmada",
  "foto_perfil_signed_url",
  "foto_signed_url",
  "imagen_url_firmada",
  "imagen_signed_url",
  "signed_url",
  "signedUrl",
  "url_firmada",
];
const EMPLEADO_STORAGE_PATH_FIELDS = [
  "foto_storage_path",
  "foto_perfil_path",
  "foto_path",
  "imagen_storage_path",
  "imagen_path",
  "storage_path",
  "path",
];
const EMPLEADO_NESTED_IMAGE_KEYS = ["foto", "imagen", "photo", "avatar", "usuario", "empleado"];
const EMPLEADO_SIGNED_RESPONSE_ID_FIELDS = ["id_empleado", "empleado_id", "id"];
const EMPLEADO_SIGNED_RESPONSE_URL_FIELDS = [
  ...EMPLEADO_SIGNED_URL_FIELDS,
  ...EMPLEADO_IMAGE_VALUE_FIELDS,
  "url",
  "value",
  "src",
];
const EMPLEADO_USER_LOOKUP_LIMIT = 100;
const EMPLEADO_USER_LOOKUP_MAX_PAGES = 12;

const createImageDraftState = (previewUrl = "") => ({
  previewUrl: String(previewUrl || ""),
  loading: false,
  error: "",
});

const toImageValue = (value) => {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  return text || "";
};

const loadEmployeeImages = () => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(EMPLOYEE_IMAGES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
};

const saveEmployeeImage = (id, value, current = null) => {
  const empleadoId = toEmpleadoId(id);
  const imageValue = toImageValue(value);
  if (!empleadoId || !imageValue || typeof window === "undefined") {
    return current && typeof current === "object" ? current : loadEmployeeImages();
  }

  const source = current && typeof current === "object" ? current : loadEmployeeImages();
  const next = { ...source, [String(empleadoId)]: imageValue };

  try {
    window.localStorage.setItem(EMPLOYEE_IMAGES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignorar errores de quota/storage para no bloquear el guardado del empleado.
  }

  return next;
};

const removeEmployeeImage = (id, current = null) => {
  const empleadoId = toEmpleadoId(id);
  if (!empleadoId || typeof window === "undefined") {
    return current && typeof current === "object" ? current : loadEmployeeImages();
  }

  const source = current && typeof current === "object" ? current : loadEmployeeImages();
  if (!Object.prototype.hasOwnProperty.call(source, String(empleadoId))) return source;
  const next = { ...source };
  delete next[String(empleadoId)];

  try {
    window.localStorage.setItem(EMPLOYEE_IMAGES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignorar errores de storage para mantener estable la UI.
  }

  return next;
};

const toEmpleadoId = (value) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const getFirstPositiveInteger = (values = []) => {
  if (!Array.isArray(values)) return null;
  for (const value of values) {
    const parsed = toEmpleadoId(value);
    if (parsed) return parsed;
  }
  return null;
};

const extractEmpleadoUsuarioId = (empleado) =>
  getFirstPositiveInteger([
    empleado?.id_usuario,
    empleado?.usuario_id,
    empleado?.usuario?.id_usuario,
    empleado?.usuario?.id,
  ]);

const extractUsuarioEmpleadoId = (usuario) =>
  getFirstPositiveInteger([
    usuario?.id_empleado,
    usuario?.empleado_id,
    usuario?.empleado?.id_empleado,
    usuario?.empleado?.id,
  ]);

const extractUsuarioId = (usuario) =>
  getFirstPositiveInteger([
    usuario?.id_usuario,
    usuario?.usuario_id,
    usuario?.id,
    usuario?.usuario?.id_usuario,
    usuario?.usuario?.id,
  ]);

const isAbsoluteUrl = (value) => ABSOLUTE_URL_RE.test(toImageValue(value));
const isDataImageUrl = (value) => DATA_IMAGE_RE.test(toImageValue(value));
const isUploadsPath = (value) => UPLOADS_PATH_RE.test(toImageValue(value));

const resolveAgainstApiBase = (rawPath) => {
  try {
    return new URL(rawPath, API_URL).toString();
  } catch {
    return rawPath;
  }
};

const resolveRenderableImageSrc = (value) => {
  const normalized = toImageValue(value);
  if (!normalized) return "";
  if (isAbsoluteUrl(normalized) || isDataImageUrl(normalized)) return normalized;
  if (isUploadsPath(normalized)) return resolveAgainstApiBase(normalized);
  return "";
};

const getFirstImageFieldValue = (record, keys = []) => {
  if (!record || typeof record !== "object") return "";
  for (const key of keys) {
    const value = toImageValue(record[key]);
    if (value) return value;
  }
  return "";
};

const getNestedImageFieldValue = (record, nestedKeys = [], fieldKeys = []) => {
  if (!record || typeof record !== "object") return "";
  for (const nestedKey of nestedKeys) {
    const nested = record[nestedKey];
    if (!nested || typeof nested !== "object") continue;
    const value = getFirstImageFieldValue(nested, fieldKeys);
    if (value) return value;
  }
  return "";
};

const extractEmpleadoImageStoragePath = (empleado) => {
  const sources = [
    getFirstImageFieldValue(empleado, EMPLEADO_STORAGE_PATH_FIELDS),
    getNestedImageFieldValue(empleado, EMPLEADO_NESTED_IMAGE_KEYS, EMPLEADO_STORAGE_PATH_FIELDS),
    getFirstImageFieldValue(empleado?.persona, EMPLEADO_STORAGE_PATH_FIELDS),
    getNestedImageFieldValue(empleado?.persona, EMPLEADO_NESTED_IMAGE_KEYS, EMPLEADO_STORAGE_PATH_FIELDS),
  ];

  return getFirstNonEmptyValue(sources);
};

const extractEmpleadoImageRawValue = (empleado) => {
  const sources = [
    getFirstImageFieldValue(empleado, EMPLEADO_SIGNED_URL_FIELDS),
    getFirstImageFieldValue(empleado, EMPLEADO_IMAGE_VALUE_FIELDS),
    getNestedImageFieldValue(empleado, EMPLEADO_NESTED_IMAGE_KEYS, EMPLEADO_SIGNED_URL_FIELDS),
    getNestedImageFieldValue(empleado, EMPLEADO_NESTED_IMAGE_KEYS, EMPLEADO_IMAGE_VALUE_FIELDS),
    getFirstImageFieldValue(empleado?.persona, EMPLEADO_SIGNED_URL_FIELDS),
    getFirstImageFieldValue(empleado?.persona, EMPLEADO_IMAGE_VALUE_FIELDS),
    getNestedImageFieldValue(empleado?.persona, EMPLEADO_NESTED_IMAGE_KEYS, EMPLEADO_SIGNED_URL_FIELDS),
    getNestedImageFieldValue(empleado?.persona, EMPLEADO_NESTED_IMAGE_KEYS, EMPLEADO_IMAGE_VALUE_FIELDS),
  ];

  return getFirstNonEmptyValue(sources);
};

const resolveEmpleadoImageFromSources = (empleado, signedImageMap = {}, userImageMap = {}, localImageMap = {}) => {
  const empleadoId = toEmpleadoId(empleado?.id_empleado);
  if (empleadoId) {
    const cachedValue = toImageValue(signedImageMap[String(empleadoId)]);
    const cachedSrc = resolveRenderableImageSrc(cachedValue);
    if (cachedSrc) return cachedSrc;

    const userCachedValue = toImageValue(userImageMap[String(empleadoId)]);
    const userCachedSrc = resolveRenderableImageSrc(userCachedValue);
    if (userCachedSrc) return userCachedSrc;

    const localCachedValue = toImageValue(localImageMap[String(empleadoId)]);
    const localCachedSrc = resolveRenderableImageSrc(localCachedValue);
    if (localCachedSrc) return localCachedSrc;
  }

  const rawValue = extractEmpleadoImageRawValue(empleado);
  const resolvedSrc = resolveRenderableImageSrc(rawValue);
  if (resolvedSrc) return resolvedSrc;
  return "";
};

const extractUsuarioPhotoSrc = (usuario) => {
  const sources = [
    getFirstImageFieldValue(usuario, EMPLEADO_SIGNED_URL_FIELDS),
    getFirstImageFieldValue(usuario, EMPLEADO_IMAGE_VALUE_FIELDS),
    getNestedImageFieldValue(usuario, EMPLEADO_NESTED_IMAGE_KEYS, EMPLEADO_SIGNED_URL_FIELDS),
    getNestedImageFieldValue(usuario, EMPLEADO_NESTED_IMAGE_KEYS, EMPLEADO_IMAGE_VALUE_FIELDS),
  ];
  const rawValue = getFirstNonEmptyValue(sources);
  return resolveRenderableImageSrc(rawValue);
};

const extractSignedUrlValue = (payload) => {
  if (!payload) return "";
  if (typeof payload === "string") return resolveRenderableImageSrc(payload);
  if (typeof payload !== "object" || Array.isArray(payload)) return "";

  const candidate = getFirstImageFieldValue(payload, EMPLEADO_SIGNED_RESPONSE_URL_FIELDS);
  return resolveRenderableImageSrc(candidate);
};

const normalizeSignedImageMapResponse = (response, requestedRows = []) => {
  const map = {};
  const requestedIds = requestedRows
    .map((row) => toEmpleadoId(row?.id_empleado ?? row?.id ?? row?.empleado_id))
    .filter(Boolean);

  const assign = (rawId, rawValue) => {
    const id = toEmpleadoId(rawId);
    const value = extractSignedUrlValue(rawValue);
    if (!id || !value) return;
    map[String(id)] = value;
  };

  if (typeof response === "string") {
    if (requestedIds.length === 1) {
      assign(requestedIds[0], response);
    }
    return map;
  }

  if (!response || typeof response !== "object") return map;

  const rootCandidate = extractSignedUrlValue(response);
  if (rootCandidate && requestedIds.length === 1) {
    map[String(requestedIds[0])] = rootCandidate;
  }

  const objectBuckets = [
    response.urls,
    response.signed_urls,
    response.signedUrls,
    response.data?.urls,
    response.data?.signed_urls,
    response.data?.signedUrls,
  ];

  objectBuckets.forEach((bucket) => {
    if (!bucket || typeof bucket !== "object" || Array.isArray(bucket)) return;
    Object.entries(bucket).forEach(([rawId, value]) => assign(rawId, value));
  });

  const arrayBuckets = [
    response.items,
    response.data,
    response.rows,
    response.resultados,
    response.empleados,
    response.urls,
    response.signed_urls,
    response.signedUrls,
  ];

  arrayBuckets.forEach((bucket) => {
    if (!Array.isArray(bucket)) return;
    bucket.forEach((entry) => {
      if (typeof entry === "string") {
        if (requestedIds.length === 1) assign(requestedIds[0], entry);
        return;
      }
      if (!entry || typeof entry !== "object") return;
      const entryId = getFirstNonEmptyValue(
        EMPLEADO_SIGNED_RESPONSE_ID_FIELDS.map((field) => entry[field])
      );
      assign(entryId, entry);
    });
  });

  if (!Object.keys(map).length && response.data && typeof response.data === "object" && !Array.isArray(response.data)) {
    const nestedCandidate = extractSignedUrlValue(response.data);
    if (nestedCandidate && requestedIds.length === 1) {
      map[String(requestedIds[0])] = nestedCandidate;
    }
  }

  return map;
};

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });

const detectEstadoField = (record) => {
  if (Object.prototype.hasOwnProperty.call(record || {}, "estado")) return "estado";
  if (Object.prototype.hasOwnProperty.call(record || {}, "activo")) return "activo";
  if (Object.prototype.hasOwnProperty.call(record || {}, "habilitado")) return "habilitado";
  return null;
};

const isActivo = (record) => {
  const field = detectEstadoField(record);
  if (!field) return true;
  return Boolean(record[field]);
};

export default function Empleados({ openToast, selectedSucursalId = "" }) {
  const safeToast = useCallback(
    (title, message, variant = "success") => {
      if (typeof openToast === "function") openToast(title, message, variant);
    },
    [openToast]
  );

  const [personasCatalogo, setPersonasCatalogo] = useState([]);
  const [sucursales, setSucursales] = useState([]);

  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [viewMode, setViewMode] = useState(() => readViewMode("empleadosViewMode"));

  const [estadoFiltro, setEstadoFiltro] = useState("todos");
  const [sortBy, setSortBy] = useState("recientes");
  const [filtersDraft, setFiltersDraft] = useState(createInitialFiltersDraft);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [page, setPage] = useState(1);
  const limit = 10;
  const [total, setTotal] = useState(0);

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [useInlinePersonaCreate, setUseInlinePersonaCreate] = useState(false);
  const [inlinePersonaForm, setInlinePersonaForm] = useState(emptyInlinePersonaForm);
  const [showPersonaCreateModal, setShowPersonaCreateModal] = useState(false);
  const [detailEmpleado, setDetailEmpleado] = useState(null);
  const [formImage, setFormImage] = useState(() => createImageDraftState());
  const [employeeSignedImages, setEmployeeSignedImages] = useState({});
  const [employeeUserImages, setEmployeeUserImages] = useState({});
  const [employeeUserIds, setEmployeeUserIds] = useState({});
  const [employeeLocalImages, setEmployeeLocalImages] = useState(() => loadEmployeeImages());
  const [imageDirty, setImageDirty] = useState(false);

  const [actionLoading, setActionLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    idToDelete: null,
    nombre: "",
  });
  const [cardsPerPage, setCardsPerPage] = useState(() =>
    typeof window === "undefined" ? 6 : resolveCardsPerPage(window.innerWidth)
  );

  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);
  const listAbortRef = useRef(null);
  const listPrefetchAbortRef = useRef(null);
  const empleadosListCacheRef = useRef(new Map());
  const catalogosCargadosRef = useRef(false);
  const panelRef = useRef(null);
  const imageInputRef = useRef(null);
  const telefonoReferenciaInputRef = useRef(null);
  const telefonoReferenciaCaretRef = useRef(null);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const isAnyDrawerOpen = showModal || filtersOpen;

  const blurFocusedElementInside = useCallback((containerId) => {
    if (typeof document === "undefined") return;
    const container = document.getElementById(containerId);
    const active = document.activeElement;
    if (!container || !active) return;
    if (container.contains(active) && typeof active.blur === "function") {
      active.blur();
    }
  }, []);

  const closeFormDrawer = useCallback(() => {
    blurFocusedElementInside("empd-form-drawer");
    setShowPersonaCreateModal(false);
    setShowModal(false);
  }, [blurFocusedElementInside]);

  const personaOptions = useMemo(
    () =>
      (Array.isArray(personasCatalogo) ? personasCatalogo : []).map((persona) => {
        const id = persona?.id_persona;
        const nombreCompleto = `${persona?.nombre || ""} ${persona?.apellido || ""}`.trim();
        return {
          id: id ? String(id) : "",
          label: nombreCompleto || `Persona #${id ?? "N/D"}`,
          dni: persona?.dni || "",
        };
      }),
    [personasCatalogo]
  );

  const sucursalOptions = useMemo(
    () =>
      (Array.isArray(sucursales) ? sucursales : []).map((sucursal) => {
        const id = sucursal?.id_sucursal;
        const label = sucursal?.nombre_sucursal || sucursal?.nombre || sucursal?.sucursal || `Sucursal #${id ?? "N/D"}`;
        return {
          id: id ? String(id) : "",
          label: String(label),
        };
      }),
    [sucursales]
  );

  const personaSelectOptions = useMemo(
    () =>
      personaOptions.map((item) => ({
        value: item.id,
        label: item.dni ? `${item.label} | DNI: ${item.dni}` : item.label,
      })),
    [personaOptions]
  );

  const personaSelectValue = useMemo(() => {
    const selectedId = String(form.id_persona ?? "");
    if (!selectedId) return null;
    return personaSelectOptions.find((option) => option.value === selectedId) || null;
  }, [form.id_persona, personaSelectOptions]);

  const personaSelectStyles = useMemo(
    () => buildEmpleadosSelectStyles(Boolean(errors.id_persona)),
    [errors.id_persona]
  );

  const sucursalSelectOptions = useMemo(
    () =>
      sucursalOptions.map((item) => ({
        value: item.id,
        label: item.label,
      })),
    [sucursalOptions]
  );

  const sucursalSelectValue = useMemo(() => {
    const selectedId = String(form.id_sucursal ?? "");
    if (!selectedId) return null;
    return sucursalSelectOptions.find((option) => option.value === selectedId) || null;
  }, [form.id_sucursal, sucursalSelectOptions]);

  const sucursalSelectStyles = useMemo(
    () => buildEmpleadosSelectStyles(Boolean(errors.id_sucursal)),
    [errors.id_sucursal]
  );

  const selectedPersona = useMemo(() => {
    const selectedPersonaId = String(form.id_persona ?? "").trim();
    if (!selectedPersonaId) return null;
    return (
      (Array.isArray(personasCatalogo) ? personasCatalogo : []).find(
        (persona) => String(persona?.id_persona ?? "") === selectedPersonaId
      ) || null
    );
  }, [form.id_persona, personasCatalogo]);

  const selectedPersonaDni = useMemo(
    () => getFirstNonEmptyField(selectedPersona, ["dni", "persona_dni"]),
    [selectedPersona]
  );

  const selectedPersonaTelefono = useMemo(
    () =>
      getFirstNonEmptyField(selectedPersona, [
        "telefono",
        "texto_telefono",
        "telefono_numero",
        "numero_telefono",
        "persona_telefono",
        "telefono_persona",
      ]),
    [selectedPersona]
  );

  const resolveEmpleadoImage = useCallback(
    (empleado) => resolveEmpleadoImageFromSources(empleado, employeeSignedImages, employeeUserImages, employeeLocalImages),
    [employeeSignedImages, employeeUserImages, employeeLocalImages]
  );

  const mergeSignedImageMap = useCallback((incoming = {}) => {
    const entries = Object.entries(incoming || {});
    if (!entries.length) return;
    setEmployeeSignedImages((prev) => ({ ...prev, ...incoming }));
  }, []);

  const mergeEmployeeUserImageMap = useCallback((incoming = {}) => {
    const entries = Object.entries(incoming || {});
    if (!entries.length) return;
    setEmployeeUserImages((prev) => ({ ...prev, ...incoming }));
  }, []);

  const mergeEmployeeUserIdMap = useCallback((incoming = {}) => {
    const entries = Object.entries(incoming || {});
    if (!entries.length) return;
    setEmployeeUserIds((prev) => ({ ...prev, ...incoming }));
  }, []);

  const findUsuariosByEmpleadoIds = useCallback(async (ids = []) => {
    const targetKeys = new Set(
      (Array.isArray(ids) ? ids : [])
        .map((value) => toEmpleadoId(value))
        .filter(Boolean)
        .map((value) => String(value))
    );
    if (!targetKeys.size) {
      return { userIdsByEmployee: {}, userImagesByEmployee: {} };
    }

    const userIdsByEmployee = {};
    const userImagesByEmployee = {};
    let page = 1;
    let totalPages = EMPLEADO_USER_LOOKUP_MAX_PAGES;

    while (targetKeys.size && page <= totalPages && page <= EMPLEADO_USER_LOOKUP_MAX_PAGES) {
      const response = await personaService.getUsuariosV2({
        page,
        limit: EMPLEADO_USER_LOOKUP_LIMIT,
        q: "",
      });
      const { items, total: totalItems } = normalizeListResponse(response);
      if (!Array.isArray(items) || !items.length) break;

      if (page === 1) {
        const parsedTotal = Number(totalItems) || items.length;
        const pagesFromTotal = Math.max(1, Math.ceil(parsedTotal / EMPLEADO_USER_LOOKUP_LIMIT));
        totalPages = Math.min(pagesFromTotal, EMPLEADO_USER_LOOKUP_MAX_PAGES);
      }

      items.forEach((usuario) => {
        const empleadoId = extractUsuarioEmpleadoId(usuario);
        if (!empleadoId) return;

        const employeeKey = String(empleadoId);
        if (!targetKeys.has(employeeKey)) return;

        const usuarioId = extractUsuarioId(usuario);
        if (usuarioId) userIdsByEmployee[employeeKey] = usuarioId;

        const usuarioPhoto = extractUsuarioPhotoSrc(usuario);
        if (usuarioPhoto) userImagesByEmployee[employeeKey] = usuarioPhoto;

        targetKeys.delete(employeeKey);
      });

      if (items.length < EMPLEADO_USER_LOOKUP_LIMIT) break;
      page += 1;
    }

    return { userIdsByEmployee, userImagesByEmployee };
  }, []);

  const fetchLinkedUsuarioImagesForRows = useCallback(
    async (rows = []) => {
      const missingEmployeeIds = new Set();
      const directUserIds = {};

      (Array.isArray(rows) ? rows : []).forEach((row) => {
        const empleadoId = toEmpleadoId(row?.id_empleado ?? row?.id ?? row?.empleado_id);
        if (!empleadoId) return;
        const employeeKey = String(empleadoId);

        const directUserId = extractEmpleadoUsuarioId(row);
        if (directUserId) {
          directUserIds[employeeKey] = directUserId;
          return;
        }

        if (employeeUserIds[employeeKey] || employeeUserImages[employeeKey]) return;
        missingEmployeeIds.add(empleadoId);
      });

      if (Object.keys(directUserIds).length) {
        mergeEmployeeUserIdMap(directUserIds);
      }

      if (!missingEmployeeIds.size) return;

      try {
        const lookupResult = await findUsuariosByEmpleadoIds([...missingEmployeeIds]);
        if (!mountedRef.current) return;
        mergeEmployeeUserIdMap(lookupResult.userIdsByEmployee);
        mergeEmployeeUserImageMap(lookupResult.userImagesByEmployee);
      } catch {
        // El listado de empleados debe seguir funcionando aunque no haya permiso para consultar usuarios.
      }
    },
    [
      employeeUserIds,
      employeeUserImages,
      findUsuariosByEmpleadoIds,
      mergeEmployeeUserIdMap,
      mergeEmployeeUserImageMap,
    ]
  );

  const resolveLinkedUsuarioIdForEmpleado = useCallback(
    async (empleadoId, empleadoSnapshot = null) => {
      const parsedEmpleadoId = toEmpleadoId(empleadoId);
      if (!parsedEmpleadoId) return null;
      const employeeKey = String(parsedEmpleadoId);

      const fromSnapshot = extractEmpleadoUsuarioId(empleadoSnapshot);
      if (fromSnapshot) {
        mergeEmployeeUserIdMap({ [employeeKey]: fromSnapshot });
        return fromSnapshot;
      }

      const fromState = toEmpleadoId(employeeUserIds[employeeKey]);
      if (fromState) return fromState;

      const lookupResult = await findUsuariosByEmpleadoIds([parsedEmpleadoId]);
      if (!mountedRef.current) return null;

      mergeEmployeeUserIdMap(lookupResult.userIdsByEmployee);
      mergeEmployeeUserImageMap(lookupResult.userImagesByEmployee);

      return toEmpleadoId(lookupResult.userIdsByEmployee[employeeKey]);
    },
    [employeeUserIds, findUsuariosByEmpleadoIds, mergeEmployeeUserIdMap, mergeEmployeeUserImageMap]
  );

  const persistEmployeeImageViaUsuario = useCallback(
    async (empleadoId, imageValue, empleadoSnapshot = null) => {
      const parsedEmpleadoId = toEmpleadoId(empleadoId);
      if (!parsedEmpleadoId) throw new Error("Id de empleado invalido");

      const employeeKey = String(parsedEmpleadoId);
      const normalizedPhoto = toImageValue(imageValue) || null;
      const linkedUsuarioId = await resolveLinkedUsuarioIdForEmpleado(parsedEmpleadoId, empleadoSnapshot);
      if (!linkedUsuarioId) {
        const nextLocalMap = normalizedPhoto
          ? saveEmployeeImage(parsedEmpleadoId, normalizedPhoto, employeeLocalImages)
          : removeEmployeeImage(parsedEmpleadoId, employeeLocalImages);
        setEmployeeLocalImages(nextLocalMap);
        return { local_only: true };
      }

      const response = await personaService.updateUsuarioFotoV2(linkedUsuarioId, {
        foto_perfil: normalizedPhoto,
      });

      const responseImage = extractSignedUrlValue(response);
      const localImage = resolveRenderableImageSrc(normalizedPhoto);
      const nextImage = responseImage || localImage;

      setEmployeeUserIds((prev) => ({ ...prev, [employeeKey]: linkedUsuarioId }));
      setEmployeeUserImages((prev) => {
        const next = { ...prev };
        if (nextImage) next[employeeKey] = nextImage;
        else delete next[employeeKey];
        return next;
      });
      setEmployeeLocalImages((prev) => removeEmployeeImage(parsedEmpleadoId, prev));

      return response;
    },
    [employeeLocalImages, resolveLinkedUsuarioIdForEmpleado]
  );

  const fetchSignedImagesForRows = useCallback(
    async (rows = []) => {
      const deduped = new Map();

      (Array.isArray(rows) ? rows : []).forEach((row) => {
        const empleadoId = toEmpleadoId(row?.id_empleado ?? row?.id ?? row?.empleado_id);
        if (!empleadoId) return;
        if (toImageValue(employeeSignedImages[String(empleadoId)])) return;

        const directRenderable = resolveRenderableImageSrc(extractEmpleadoImageRawValue(row));
        if (directRenderable) return;

        const storagePath = extractEmpleadoImageStoragePath(row);
        if (!storagePath) return;
        deduped.set(String(empleadoId), { id_empleado: empleadoId, storage_path: storagePath });
      });

      const pending = [...deduped.values()];
      if (!pending.length) return;

      let resolvedBatchMap = {};
      try {
        const batchResponse = await personaService.getEmpleadosFotosFirmadasV2({ empleados: pending });
        if (!mountedRef.current) return;
        resolvedBatchMap = normalizeSignedImageMapResponse(batchResponse, pending);
        mergeSignedImageMap(resolvedBatchMap);
      } catch {
        resolvedBatchMap = {};
      }

      const unresolved = pending.filter(
        (row) => !toImageValue(resolvedBatchMap[String(row.id_empleado)])
      );
      if (!unresolved.length) return;

      const results = await Promise.allSettled(
        unresolved.map((row) =>
          personaService.getEmpleadoFotoFirmadaV2(row.id_empleado, {
            storage_path: row.storage_path,
          })
        )
      );
      if (!mountedRef.current) return;

      const fallbackMap = {};
      results.forEach((result, index) => {
        if (result.status !== "fulfilled") return;
        const row = unresolved[index];
        if (!row?.id_empleado) return;
        const signedValue = extractSignedUrlValue(result.value);
        if (!signedValue) return;
        fallbackMap[String(row.id_empleado)] = signedValue;
      });

      mergeSignedImageMap(fallbackMap);
    },
    [employeeSignedImages, mergeSignedImageMap]
  );

  const clearImagePicker = useCallback(() => {
    if (imageInputRef.current) imageInputRef.current.value = "";
  }, []);

  const clearFormImageDraft = useCallback(() => {
    clearImagePicker();
    setFormImage(createImageDraftState());
    setImageDirty(false);
  }, [clearImagePicker]);

  const removeFormImage = useCallback(() => {
    clearFormImageDraft();
    setImageDirty(true);
  }, [clearFormImageDraft]);

  const openDetailModal = useCallback((empleado) => {
    setDetailEmpleado(empleado || null);
  }, []);

  const closeDetailModal = useCallback(() => {
    setDetailEmpleado(null);
  }, []);

  const getPersonaNombre = useCallback(
    (empleado) => {
      const fromBackend = empleado?.persona_nombre_completo?.trim();
      if (fromBackend) return fromBackend;

      const fallback = `${empleado?.persona_nombre || ""} ${empleado?.persona_apellido || ""}`.trim();
      if (fallback) return fallback;

      const personaId = empleado?.id_persona ? String(empleado.id_persona) : "";
      if (!personaId) return "No registrado";

      const option = personaOptions.find((item) => item.id === personaId);
      return option?.label || `Persona #${personaId}`;
    },
    [personaOptions]
  );

  const getSucursalNombre = useCallback(
    (empleado) => {
      const fromBackend = empleado?.sucursal_nombre || empleado?.nombre_sucursal || empleado?.sucursal;
      if (String(fromBackend ?? "").trim()) return String(fromBackend).trim();

      const sucursalId = empleado?.id_sucursal ? String(empleado.id_sucursal) : "";
      if (!sucursalId) return "No registrado";

      const option = sucursalOptions.find((item) => item.id === sucursalId);
      return option?.label || `Sucursal #${sucursalId}`;
    },
    [sucursalOptions]
  );

  const resolvePersonaId = useCallback(
    (empleado) => {
      if (empleado?.id_persona) return String(empleado.id_persona);

      const texts = [
        empleado?.persona_nombre_completo,
        `${empleado?.persona_nombre || ""} ${empleado?.persona_apellido || ""}`.trim(),
      ]
        .map(normalizeValue)
        .filter(Boolean);

      if (!texts.length) return "";

      const found = personaOptions.find((item) => texts.includes(normalizeValue(item.label)));
      return found?.id || "";
    },
    [personaOptions]
  );

  const resolveSucursalId = useCallback(
    (empleado) => {
      if (empleado?.id_sucursal) return String(empleado.id_sucursal);

      const texts = [empleado?.sucursal_nombre, empleado?.nombre_sucursal, empleado?.sucursal]
        .map(normalizeValue)
        .filter(Boolean);

      if (!texts.length) return "";

      const found = sucursalOptions.find((item) => texts.includes(normalizeValue(item.label)));
      return found?.id || "";
    },
    [sucursalOptions]
  );

  const buildFormFromEmpleado = useCallback(
    (empleado) => ({
      id_persona: resolvePersonaId(empleado),
      id_sucursal: resolveSucursalId(empleado),
      fecha_ingreso: toDateInputValue(empleado?.fecha_ingreso),
      salario_base:
        empleado?.salario_base === null || empleado?.salario_base === undefined
          ? ""
          : String(empleado.salario_base),
      cargo: getCargo(empleado),
      nombre_referencia: getNombreReferencia(empleado),
      telefono_referencia: formatReferencePhone(getTelefonoReferencia(empleado)),
      estado: isActivo(empleado),
    }),
    [resolvePersonaId, resolveSucursalId]
  );

  const buildEmpleadosCacheKey = useCallback(
    (targetPage) =>
      JSON.stringify({
        page: Number(targetPage) || 1,
        limit,
        search: normalizeSearchText(debouncedSearch),
        sucursal: toEmpleadoId(selectedSucursalId) || null,
      }),
    [limit, debouncedSearch, selectedSucursalId]
  );

  const setEmpleadosCacheEntry = useCallback((cacheKey, data) => {
    if (!cacheKey) return;
    const cache = empleadosListCacheRef.current;
    cache.delete(cacheKey);
    cache.set(cacheKey, {
      items: Array.isArray(data?.items) ? data.items : [],
      total: Math.max(0, Number(data?.total) || 0),
      cachedAt: Date.now(),
    });

    while (cache.size > MAX_EMPLEADOS_PAGE_CACHE) {
      const oldestKey = cache.keys().next().value;
      if (!oldestKey) break;
      cache.delete(oldestKey);
    }
  }, []);

  const clearEmpleadosListCache = useCallback(() => {
    empleadosListCacheRef.current.clear();
    listPrefetchAbortRef.current?.abort();
    listPrefetchAbortRef.current = null;
  }, []);

  const prefetchEmpleadosPage = useCallback(
    async (targetPage, totalKnown = null) => {
      const nextPage = Number(targetPage);
      if (!Number.isFinite(nextPage) || nextPage < 1) return;

      const totalValue = Number.isFinite(Number(totalKnown)) ? Number(totalKnown) : null;
      if (totalValue !== null) {
        const totalPages = Math.max(1, Math.ceil(totalValue / limit));
        if (nextPage > totalPages) return;
      }

      const cacheKey = buildEmpleadosCacheKey(nextPage);
      if (empleadosListCacheRef.current.has(cacheKey)) return;

      listPrefetchAbortRef.current?.abort();
      const controller = new AbortController();
      listPrefetchAbortRef.current = controller;

      try {
        const normalizedSucursalId = toEmpleadoId(selectedSucursalId);
        const resp = await personaService.getEmpleados({
          page: nextPage,
          limit,
          nombre: debouncedSearch || undefined,
          id_sucursal: normalizedSucursalId || undefined,
          signal: controller.signal,
        });

        if (!mountedRef.current || controller.signal.aborted) return;
        const { items, total: totalResp } = normalizeListResponse(resp);
        setEmpleadosCacheEntry(cacheKey, { items, total: totalResp });
      } catch (error) {
        if (isAbortError(error)) return;
      } finally {
        if (listPrefetchAbortRef.current === controller) {
          listPrefetchAbortRef.current = null;
        }
      }
    },
    [
      buildEmpleadosCacheKey,
      debouncedSearch,
      limit,
      selectedSucursalId,
      setEmpleadosCacheEntry,
    ]
  );

  const cargarCatalogos = useCallback(async () => {
    if (catalogosCargadosRef.current) return;

    try {
      const [personasResp, sucursalesResp] = await Promise.all([
        personaService.getPersonasDetalle(1, 100),
        sucursalesService.getAll(),
      ]);

      if (!mountedRef.current) return;

      setPersonasCatalogo(normalizeListResponse(personasResp).items);
      setSucursales(normalizeArrayPayload(sucursalesResp));
      catalogosCargadosRef.current = true;
    } catch (error) {
      safeToast("ERROR", error.message || "No se pudieron cargar catalogos", "danger");
    }
  }, [safeToast]);

  const cargarEmpleados = useCallback(async (options = {}) => {
    const requestId = ++requestIdRef.current;
    const force = Boolean(options?.force);
    const requestedPage = Number(options?.page);
    const targetPage = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : page;

    listAbortRef.current?.abort();
    listAbortRef.current = null;

    const cacheKey = buildEmpleadosCacheKey(targetPage);
    if (!force) {
      const cached = empleadosListCacheRef.current.get(cacheKey);
      if (cached) {
        setEmpleados(Array.isArray(cached.items) ? cached.items : []);
        setTotal(Math.max(0, Number(cached.total) || 0));
        setLoading(false);
        prefetchEmpleadosPage(targetPage + 1, cached.total);
        return;
      }
    }

    setLoading(true);
    const controller = new AbortController();
    listAbortRef.current = controller;

    try {
      const normalizedSucursalId = toEmpleadoId(selectedSucursalId);
      const resp = await personaService.getEmpleados({
        page: targetPage,
        limit,
        nombre: debouncedSearch || undefined,
        id_sucursal: normalizedSucursalId || undefined,
        signal: controller.signal,
      });
      if (!mountedRef.current || requestId !== requestIdRef.current) return;

      const { items, total: totalResp } = normalizeListResponse(resp);
      setEmpleados(items);
      setTotal(totalResp);
      setEmpleadosCacheEntry(cacheKey, { items, total: totalResp });
      prefetchEmpleadosPage(targetPage + 1, totalResp);
    } catch (error) {
      if (isAbortError(error)) return;
      if (!mountedRef.current) return;
      safeToast("ERROR", error.message || "No se pudo cargar empleados", "danger");
      setEmpleados([]);
      setTotal(0);
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [
    buildEmpleadosCacheKey,
    page,
    limit,
    debouncedSearch,
    safeToast,
    selectedSucursalId,
    setEmpleadosCacheEntry,
    prefetchEmpleadosPage,
  ]);

  const fetchNewestEmpleadoId = useCallback(async () => {
    try {
      const firstPageResp = await personaService.getEmpleados({
        page: 1,
        limit: 1,
      });
      const { total: totalGlobal } = normalizeListResponse(firstPageResp);
      const lastPage = Math.max(1, Number(totalGlobal) || 1);

      const lastPageResp = await personaService.getEmpleados({
        page: lastPage,
        limit: 1,
      });
      const { items } = normalizeListResponse(lastPageResp);
      return toEmpleadoId(items?.[0]?.id_empleado);
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      listAbortRef.current?.abort();
      listAbortRef.current = null;
      listPrefetchAbortRef.current?.abort();
      listPrefetchAbortRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!showModal) return;
    cargarCatalogos();
  }, [showModal, cargarCatalogos]);

  useEffect(() => {
    cargarEmpleados();
  }, [cargarEmpleados]);

  useEffect(() => {
    if (!Array.isArray(empleados) || !empleados.length) return;
    void fetchSignedImagesForRows(empleados);
  }, [empleados, fetchSignedImagesForRows]);

  useEffect(() => {
    if (!Array.isArray(empleados) || !empleados.length) return;
    void fetchLinkedUsuarioImagesForRows(empleados);
  }, [empleados, fetchLinkedUsuarioImagesForRows]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      const nextSearch = normalizeSearchText(search);
      setDebouncedSearch((prev) => (prev === nextSearch ? prev : nextSearch));
    }, 300);

    return () => window.clearTimeout(timerId);
  }, [search]);

  useEffect(() => {
    const onResize = () => setCardsPerPage(resolveCardsPerPage(window.innerWidth));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("empleadosViewMode", viewMode);
    } catch {
      // Keep working even if storage is unavailable.
    }
  }, [viewMode]);

  useEffect(() => {
    if (!showModal || !editId) return;
    const empleadoActual = empleados.find((item) => String(item.id_empleado) === String(editId));
    if (!empleadoActual) return;

    setForm((prev) => {
      const resolved = buildFormFromEmpleado(empleadoActual);
      const next = { ...prev };

      if (!prev.id_persona && resolved.id_persona) next.id_persona = resolved.id_persona;
      if (!prev.id_sucursal && resolved.id_sucursal) next.id_sucursal = resolved.id_sucursal;

      return next;
    });
    setFormImage((prev) => {
      if (prev.previewUrl || prev.loading || imageDirty) return prev;
      const previewUrl = resolveEmpleadoImage(empleadoActual);
      return previewUrl ? createImageDraftState(previewUrl) : prev;
    });
  }, [showModal, editId, empleados, buildFormFromEmpleado, resolveEmpleadoImage, imageDirty]);

  useLayoutEffect(() => {
    if (telefonoReferenciaCaretRef.current === null) return;
    const input = telefonoReferenciaInputRef.current;
    if (!input) return;

    const nextCaret = telefonoReferenciaCaretRef.current;
    telefonoReferenciaCaretRef.current = null;
    try {
      input.setSelectionRange(nextCaret, nextCaret);
    } catch {
      // Some browsers can throw when the element is not focusable.
    }
  }, [form.telefono_referencia]);

  useEffect(() => {
    if (!detailEmpleado) return;

    const detailId = detailEmpleado?.id_empleado;
    if (!detailId) return;

    const refreshed = empleados.find((item) => String(item.id_empleado) === String(detailId));
    if (!refreshed) {
      setDetailEmpleado(null);
      return;
    }

    if (refreshed !== detailEmpleado) {
      setDetailEmpleado(refreshed);
    }
  }, [empleados, detailEmpleado]);

  const handleNombreReferenciaChange = useCallback((event) => {
    const sanitized = sanitizeReferenceName(event.target.value);
    setForm((state) => ({ ...state, nombre_referencia: sanitized }));
    setErrors((state) => ({ ...state, nombre_referencia: undefined }));
  }, []);

  const handleNombreReferenciaBeforeInput = useCallback((event) => {
    const data = event?.nativeEvent?.data ?? event?.data;
    if (!data) return;
    if (!REFERENCE_NAME_CHAR_REGEX.test(data)) {
      event.preventDefault();
    }
  }, []);

  const handleNombreReferenciaKeyDown = useCallback((event) => {
    if (event.ctrlKey || event.metaKey) return;
    if (ALLOWED_EDITING_KEYS.has(event.key)) return;
    if (event.key.length !== 1) return;
    if (!REFERENCE_NAME_CHAR_REGEX.test(event.key)) {
      event.preventDefault();
    }
  }, []);

  const handleNombreReferenciaPaste = useCallback(
    (event) => {
      event.preventDefault();
      const pasted = String(event.clipboardData?.getData("text") ?? "");
      const current = String(form.nombre_referencia ?? "");
      const input = event.currentTarget;
      const selectionStart = typeof input.selectionStart === "number" ? input.selectionStart : current.length;
      const selectionEnd = typeof input.selectionEnd === "number" ? input.selectionEnd : selectionStart;
      const merged = `${current.slice(0, selectionStart)}${pasted}${current.slice(selectionEnd)}`;
      const sanitized = sanitizeReferenceName(merged).slice(0, 120);
      setForm((state) => ({ ...state, nombre_referencia: sanitized }));
      setErrors((state) => ({ ...state, nombre_referencia: undefined }));
    },
    [form.nombre_referencia]
  );

  const handleTelefonoReferenciaChange = useCallback((event) => {
    const inputValue = event.target.value ?? "";
    const caretPosition = event.target.selectionStart ?? inputValue.length;
    const digitsBeforeCaret = digitsOnly(inputValue.slice(0, caretPosition)).length;
    const raw = digitsOnly(inputValue).slice(0, REFERENCE_PHONE_DIGITS);
    const formatted = formatReferencePhone(raw);

    telefonoReferenciaCaretRef.current = resolveCaretFromDigitIndex(
      formatted,
      Math.min(digitsBeforeCaret, raw.length)
    );

    setForm((state) => ({ ...state, telefono_referencia: formatted }));
    setErrors((state) => ({ ...state, telefono_referencia: undefined }));
  }, []);

  const handleTelefonoReferenciaBeforeInput = useCallback(
    (event) => {
      const data = event?.nativeEvent?.data ?? event?.data;
      if (!data) return;
      if (/\D/.test(data)) {
        event.preventDefault();
        return;
      }

      const input = event.currentTarget;
      const currentFormatted = String(form.telefono_referencia ?? "");
      const currentRaw = digitsOnly(currentFormatted);
      const selectionStart = typeof input.selectionStart === "number" ? input.selectionStart : currentFormatted.length;
      const selectionEnd = typeof input.selectionEnd === "number" ? input.selectionEnd : selectionStart;
      const rawStart = digitsOnly(currentFormatted.slice(0, selectionStart)).length;
      const rawEnd = digitsOnly(currentFormatted.slice(0, selectionEnd)).length;
      const nextLength = currentRaw.length - (rawEnd - rawStart) + digitsOnly(data).length;
      if (nextLength > REFERENCE_PHONE_DIGITS) {
        event.preventDefault();
      }
    },
    [form.telefono_referencia]
  );

  const handleTelefonoReferenciaKeyDown = useCallback(
    (event) => {
      if (event.ctrlKey || event.metaKey) return;
      if (ALLOWED_EDITING_KEYS.has(event.key)) return;
      if (event.key.length !== 1) return;
      if (!/\d/.test(event.key)) {
        event.preventDefault();
        return;
      }

      const input = event.currentTarget;
      const currentFormatted = String(form.telefono_referencia ?? "");
      const currentRaw = digitsOnly(currentFormatted);
      const selectionStart = typeof input.selectionStart === "number" ? input.selectionStart : currentFormatted.length;
      const selectionEnd = typeof input.selectionEnd === "number" ? input.selectionEnd : selectionStart;
      const rawStart = digitsOnly(currentFormatted.slice(0, selectionStart)).length;
      const rawEnd = digitsOnly(currentFormatted.slice(0, selectionEnd)).length;
      const nextLength = currentRaw.length - (rawEnd - rawStart) + 1;
      if (nextLength > REFERENCE_PHONE_DIGITS) {
        event.preventDefault();
      }
    },
    [form.telefono_referencia]
  );

  const handleTelefonoReferenciaPaste = useCallback(
    (event) => {
      event.preventDefault();
      const pastedRaw = digitsOnly(event.clipboardData?.getData("text") ?? "");
      const currentFormatted = String(form.telefono_referencia ?? "");
      const currentRaw = digitsOnly(currentFormatted);
      const input = event.currentTarget;
      const selectionStart = typeof input.selectionStart === "number" ? input.selectionStart : currentFormatted.length;
      const selectionEnd = typeof input.selectionEnd === "number" ? input.selectionEnd : selectionStart;
      const rawStart = digitsOnly(currentFormatted.slice(0, selectionStart)).length;
      const rawEnd = digitsOnly(currentFormatted.slice(0, selectionEnd)).length;
      const mergedRaw = `${currentRaw.slice(0, rawStart)}${pastedRaw}${currentRaw.slice(rawEnd)}`.slice(
        0,
        REFERENCE_PHONE_DIGITS
      );
      telefonoReferenciaCaretRef.current = formatReferencePhone(mergedRaw).length;
      setForm((state) => ({ ...state, telefono_referencia: formatReferencePhone(mergedRaw) }));
      setErrors((state) => ({ ...state, telefono_referencia: undefined }));
    },
    [form.telefono_referencia]
  );

  const sanitizeForm = () => ({
    id_persona: Number.parseInt(String(form.id_persona), 10),
    id_sucursal: Number.parseInt(String(form.id_sucursal), 10),
    fecha_ingreso: form.fecha_ingreso,
    salario_base: Number.parseFloat(String(form.salario_base).replace(",", ".")),
    cargo: String(form.cargo ?? "").trim(),
    nombre_referencia: String(form.nombre_referencia ?? "").trim(),
    telefono_referencia: String(form.telefono_referencia ?? "").trim(),
    estado: Boolean(form.estado),
  });

  const validar = () => {
    const currentErrors = {};
    const today = new Date().toISOString().split("T")[0];
    const payload = sanitizeForm();

    if (!useInlinePersonaCreate && !form.id_persona) {
      currentErrors.id_persona = "Selecciona una persona o crea una nueva";
    }

    if (useInlinePersonaCreate) {
      const personaValidationErrors = validatePersonaForm(inlinePersonaForm);
      if (Object.keys(personaValidationErrors).length > 0) {
        currentErrors.id_persona = "Completa los datos de la persona nueva antes de continuar";
      }
    }

    if (!form.id_sucursal) currentErrors.id_sucursal = "Selecciona una sucursal";
    if (!form.fecha_ingreso || form.fecha_ingreso > today) {
      currentErrors.fecha_ingreso = "Ingresa una fecha valida (hoy o anterior)";
    }
    if (form.salario_base === "") currentErrors.salario_base = "Ingresa el salario base";
    if (Number.isNaN(payload.salario_base) || payload.salario_base < 0) {
      currentErrors.salario_base = "Debe ser un numero valido";
    }
    const referenceName = String(form.nombre_referencia ?? "").trim();
    if (referenceName && !/^[\p{L}\s]+$/u.test(referenceName)) {
      currentErrors.nombre_referencia = "Solo letras y espacios";
    }

    const referencePhoneDigits = digitsOnly(form.telefono_referencia);
    if (referencePhoneDigits.length > 0 && referencePhoneDigits.length !== REFERENCE_PHONE_DIGITS) {
      currentErrors.telefono_referencia = "Formato invalido";
    }

    setErrors(currentErrors);
    return Object.keys(currentErrors).length === 0;
  };

  const onFormImageChange = useCallback(async (event) => {
    const input = event.target;
    const file = input?.files?.[0];
    if (!file) return;

    if (!IMAGE_ALLOWED_TYPES.has(file.type)) {
      setFormImage({
        previewUrl: "",
        loading: false,
        error: "Solo se permiten imagenes JPG, PNG o WEBP.",
      });
      setImageDirty(true);
      if (input) input.value = "";
      return;
    }

    if (file.size > IMAGE_MAX_BYTES) {
      setFormImage({
        previewUrl: "",
        loading: false,
        error: "La imagen supera el limite de 6 MB.",
      });
      setImageDirty(true);
      if (input) input.value = "";
      return;
    }

    setFormImage((prev) => ({ ...prev, loading: true, error: "" }));

    try {
      const previewUrl = await readFileAsDataUrl(file);
      if (!previewUrl) throw new Error("EMPTY_IMAGE_PREVIEW");
      setFormImage(createImageDraftState(previewUrl));
      setImageDirty(true);
    } catch {
      setFormImage({
        previewUrl: "",
        loading: false,
        error: "No se pudo procesar la imagen seleccionada.",
      });
      setImageDirty(true);
    } finally {
      if (input) input.value = "";
    }
  }, []);

  const resolveCreatedEmpleadoId = useCallback(
    async (createResponse) => {
      const fromResponse = extractEmpleadoIdFromCreateResponse(createResponse);
      if (fromResponse) return fromResponse;
      return fetchNewestEmpleadoId();
    },
    [fetchNewestEmpleadoId]
  );

  const buildImageChangePlan = useCallback(
    (originalEmpleado = null) => {
      if (formImage.loading) {
        return { ok: false, message: EMPLOYEE_IMAGE_PROCESSING_MESSAGE };
      }

      if (formImage.error) {
        return { ok: false, message: formImage.error };
      }

      if (!imageDirty) {
        return { ok: true, shouldSend: false, value: null };
      }

      const currentValue = originalEmpleado ? toImageValue(resolveEmpleadoImage(originalEmpleado)) : "";
      const nextValue = toImageValue(formImage.previewUrl);

      if (!nextValue && !currentValue) {
        return { ok: true, shouldSend: false, value: null };
      }

      if (nextValue && nextValue === currentValue) {
        return { ok: true, shouldSend: false, value: null };
      }

      return { ok: true, shouldSend: true, value: nextValue || null };
    },
    [formImage.loading, formImage.error, formImage.previewUrl, imageDirty, resolveEmpleadoImage]
  );

  const guardar = async (event) => {
    event.preventDefault();
    if (!validar() || actionLoading) return;

    const payloadLimpio = sanitizeForm();
    setActionLoading(true);

    try {
      if (editId) {
        const empleadoOriginal = empleados.find((item) => String(item.id_empleado) === String(editId));
        if (!empleadoOriginal) {
          safeToast("ERROR", "No se encontro el registro a editar", "danger");
          clearEmpleadosListCache();
          await cargarEmpleados({ force: true });
          return;
        }

        const imagePlan = buildImageChangePlan(empleadoOriginal);
        if (!imagePlan.ok) {
          setFormImage((prev) => ({ ...prev, loading: false, error: imagePlan.message }));
          safeToast("ERROR", imagePlan.message, "danger");
          return;
        }

        const originalForm = buildFormFromEmpleado(empleadoOriginal);
        const changedKeys = Object.keys(emptyForm).filter((key) => {
          if (key === "estado") return Boolean(form.estado) !== Boolean(originalForm.estado);
          return String(form[key] ?? "") !== String(originalForm[key] ?? "");
        });

        if (!changedKeys.length && !imagePlan.shouldSend) {
          safeToast("INFO", "No hay cambios para guardar", "info");
        } else {
          let imageWarning = "";

          if (changedKeys.length) {
            const updatePayload = {};
            const estadoField = detectEstadoField(empleadoOriginal) || "estado";

            changedKeys.forEach((key) => {
              if (key === "estado") {
                updatePayload[estadoField] = payloadLimpio.estado;
                return;
              }
              updatePayload[key] = payloadLimpio[key];
            });
            await personaService.updateEmpleado(editId, updatePayload);
          }

          if (imagePlan.shouldSend) {
            try {
              await persistEmployeeImageViaUsuario(editId, imagePlan.value, empleadoOriginal);
              setEmployeeSignedImages((prev) => {
                const next = { ...prev };
                delete next[String(editId)];
                return next;
              });
              setFormImage((prev) => ({ ...prev, loading: false, error: "" }));
            } catch (photoError) {
              if (String(photoError?.code || "").toUpperCase() === "EMPLEADO_USUARIO_REQUERIDO_PARA_FOTO") {
                imageWarning = EMPLOYEE_IMAGE_REQUIRES_USER_MESSAGE;
                setFormImage((prev) => ({ ...prev, loading: false, error: imageWarning }));
              } else {
                throw photoError;
              }
            }
          }

          if (imageWarning) {
            const toastMessage = changedKeys.length
              ? `Empleado actualizado. ${imageWarning}`
              : imageWarning;
            safeToast("INFO", toastMessage, "info");
          } else {
            safeToast("OK", "Empleado actualizado");
          }
        }
      } else {
        const imagePlan = buildImageChangePlan();
        if (!imagePlan.ok) {
          setFormImage((prev) => ({ ...prev, loading: false, error: imagePlan.message }));
          safeToast("ERROR", imagePlan.message, "danger");
          return;
        }

        const createResp = useInlinePersonaCreate
          ? await personaService.createEmpleadoAtomico({
              persona: buildPersonaPayloadFromForm(inlinePersonaForm),
              empleado: payloadLimpio,
            })
          : await personaService.createEmpleado(payloadLimpio);

        let imageWarning = "";
        if (imagePlan.shouldSend) {
          const createdEmpleadoId = await resolveCreatedEmpleadoId(createResp);
          if (createdEmpleadoId) {
            try {
              await persistEmployeeImageViaUsuario(createdEmpleadoId, imagePlan.value);
              setEmployeeSignedImages((prev) => {
                const next = { ...prev };
                delete next[String(createdEmpleadoId)];
                return next;
              });
              setFormImage((prev) => ({ ...prev, loading: false, error: "" }));
            } catch (photoError) {
              if (String(photoError?.code || "").toUpperCase() === "EMPLEADO_USUARIO_REQUERIDO_PARA_FOTO") {
                imageWarning = EMPLOYEE_IMAGE_REQUIRES_USER_MESSAGE;
                setFormImage((prev) => ({ ...prev, loading: false, error: imageWarning }));
              } else {
                throw photoError;
              }
            }
          } else {
            imageWarning =
              "Empleado creado. No se pudo asociar la imagen automaticamente porque no se encontro el ID del registro.";
            setFormImage((prev) => ({ ...prev, loading: false, error: imageWarning }));
          }
        }
        safeToast("OK", "Empleado creado");
        if (imageWarning) {
          safeToast("INFO", imageWarning, "info");
        }
      }

      closeFormDrawer();
      setEditId(null);
      setForm(emptyForm);
      setUseInlinePersonaCreate(false);
      setInlinePersonaForm(emptyInlinePersonaForm);
      clearFormImageDraft();
      clearEmpleadosListCache();
      if (!editId && page !== 1) {
        setPage(1);
        await cargarEmpleados({ page: 1, force: true });
      } else {
        await cargarEmpleados({ force: true });
      }
    } catch (error) {
      const errorMessage = String(error?.message || "No se pudo guardar").trim();
      const statusCode = Number(error?.status);
      if (String(error?.code || "").toUpperCase() === "EMPLEADO_USUARIO_REQUERIDO_PARA_FOTO") {
        const targetMessage = EMPLOYEE_IMAGE_REQUIRES_USER_MESSAGE;
        setFormImage((prev) => ({ ...prev, loading: false, error: targetMessage }));
        safeToast("INFO", targetMessage, "info");
        return;
      }

      const isPhotoError =
        /imagen|foto|photo|supabase|storage/i.test(errorMessage) ||
        statusCode === 413;

      if (isPhotoError) {
        const targetMessage = statusCode === 413
          ? "La imagen supera el limite permitido por el servidor."
          : (errorMessage || EMPLOYEE_IMAGE_UPLOAD_ERROR_MESSAGE);
        setFormImage((prev) => ({ ...prev, loading: false, error: targetMessage }));
        safeToast("ERROR", targetMessage, "danger");
      } else {
        safeToast("ERROR", errorMessage || "No se pudo guardar", "danger");
      }
    } finally {
      if (mountedRef.current) setActionLoading(false);
    }
  };

  const iniciarEdicion = (empleado) => {
    setFiltersOpen(false);
    setDetailEmpleado(null);
    setEditId(empleado.id_empleado);
    setErrors({});
    setUseInlinePersonaCreate(false);
    setInlinePersonaForm(emptyInlinePersonaForm);
    setShowPersonaCreateModal(false);
    setForm(buildFormFromEmpleado(empleado));
    setFormImage(createImageDraftState(resolveEmpleadoImage(empleado)));
    setImageDirty(false);
    clearImagePicker();
    setShowModal(true);
  };

  const handleInlinePersonaModalSave = useCallback(async (_personaPayload, personaFormState) => {
    setInlinePersonaForm(normalizePersonaFormValues(personaFormState));
    setErrors((state) => ({ ...state, id_persona: undefined }));
    setShowPersonaCreateModal(false);
  }, []);

  const openCreate = () => {
    if (actionLoading || deletingId) return;
    setFiltersOpen(false);
    setDetailEmpleado(null);
    setEditId(null);
    setErrors({});
    setForm(emptyForm);
    setUseInlinePersonaCreate(false);
    setInlinePersonaForm(emptyInlinePersonaForm);
    setShowPersonaCreateModal(false);
    clearFormImageDraft();
    setShowModal(true);
  };

  const openConfirmDelete = (empleado) => {
    setDetailEmpleado(null);
    setConfirmModal({
      show: true,
      idToDelete: empleado?.id_empleado ?? null,
      nombre: getPersonaNombre(empleado) || "",
    });
  };

  const closeConfirmDelete = () =>
    setConfirmModal({ show: false, idToDelete: null, nombre: "" });

  const eliminarConfirmado = async () => {
    const id = confirmModal.idToDelete;
    if (!id || actionLoading || deletingId) return;

    setDeletingId(id);
    try {
      await personaService.deleteEmpleado(id);
      setEmployeeSignedImages((prev) => {
        const next = { ...prev };
        delete next[String(id)];
        return next;
      });
      setEmployeeUserImages((prev) => {
        const next = { ...prev };
        delete next[String(id)];
        return next;
      });
      setEmployeeUserIds((prev) => {
        const next = { ...prev };
        delete next[String(id)];
        return next;
      });
      setEmployeeLocalImages((prev) => removeEmployeeImage(id, prev));

      if (String(editId) === String(id)) {
        closeFormDrawer();
        setEditId(null);
        setForm(emptyForm);
        clearFormImageDraft();
      }

      if (String(detailEmpleado?.id_empleado) === String(id)) {
        setDetailEmpleado(null);
      }

      const quedaVaciaPagina = empleados.length === 1 && page > 1;
      if (quedaVaciaPagina) {
        clearEmpleadosListCache();
        setPage((prev) => Math.max(1, prev - 1));
      } else {
        clearEmpleadosListCache();
        await cargarEmpleados({ force: true });
      }

      safeToast("OK", "Empleado eliminado");
      closeConfirmDelete();
    } catch (error) {
      safeToast("ERROR", error.message || "No se pudo eliminar", "danger");
      clearEmpleadosListCache();
      await cargarEmpleados({ force: true });
    } finally {
      if (mountedRef.current) setDeletingId(null);
    }
  };

  const empleadosFiltrados = useMemo(() => {
    const needle = normalizeSearchToken(search);
    const list = [...(Array.isArray(empleados) ? empleados : [])];

    const filtered = list.filter((empleado) => {
      const activo = isActivo(empleado);
      const matchEstado =
        estadoFiltro === "todos" ? true : estadoFiltro === "activo" ? activo : !activo;
      if (!matchEstado) return false;

      if (!needle) return true;

      const persona = getPersonaNombre(empleado);
      const sucursal = getSucursalNombre(empleado);
      const hay = [
        persona,
        sucursal,
        getDni(empleado),
        getTelefono(empleado),
        getCorreo(empleado),
        getCargo(empleado),
        getNombreReferencia(empleado),
        getTelefonoReferencia(empleado),
        empleado?.cargo_puesto,
        empleado?.cargo_descripcion,
        empleado?.direccion,
        empleado?.texto_direccion,
        empleado?.salario_base,
        empleado?.fecha_ingreso,
      ]
        .filter(Boolean)
        .join(" ");
      const haystack = normalizeSearchToken(hay);

      return haystack.includes(needle);
    });

    filtered.sort((a, b) => {
      if (sortBy === "nombre_asc") {
        return getPersonaNombre(a).localeCompare(getPersonaNombre(b), "es", { sensitivity: "base" });
      }
      if (sortBy === "nombre_desc") {
        return getPersonaNombre(b).localeCompare(getPersonaNombre(a), "es", { sensitivity: "base" });
      }
      return Number(b?.id_empleado ?? 0) - Number(a?.id_empleado ?? 0);
    });

    return filtered;
  }, [empleados, search, estadoFiltro, sortBy, getPersonaNombre, getSucursalNombre]);

  const predictiveSuggestions = useMemo(() => {
    const searchTerm = normalizeSearchToken(search);
    if (searchTerm.length < MIN_CHARS_FOR_SUGGESTIONS) return [];

    const source = Array.isArray(empleados) ? empleados : [];
    const suggestions = [];
    const seen = new Set();

    for (const empleado of source) {
      const activo = isActivo(empleado);
      const matchEstado =
        estadoFiltro === "todos" ? true : estadoFiltro === "activo" ? activo : !activo;
      if (!matchEstado) continue;

      const nombre = toDisplayValue(getPersonaNombre(empleado), "Empleado sin nombre");
      const dni = toDisplayValue(getDni(empleado), "");
      const telefono = toDisplayValue(getTelefono(empleado), "");
      const correo = toDisplayValue(getCorreo(empleado), "");
      const sucursal = toDisplayValue(getSucursalNombre(empleado), "");
      const cargo = toDisplayValue(getCargo(empleado), "");
      const haystack = normalizeSearchToken([nombre, dni, telefono, correo, sucursal, cargo].join(" "));
      if (!haystack.includes(searchTerm)) continue;

      const dedupeKey = normalizeSearchToken(nombre);
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const detailParts = [];
      if (dni && dni !== "No registrado") detailParts.push(`DNI: ${dni}`);
      if (telefono && telefono !== "No registrado") detailParts.push(telefono);
      if (correo && correo !== "No registrado") detailParts.push(correo);
      if (sucursal && sucursal !== "No registrado") detailParts.push(sucursal);

      suggestions.push({
        id: `empd-${empleado?.id_empleado ?? dedupeKey}`,
        value: nombre,
        label: nombre,
        detail: detailParts.join(" | ") || cargo || "Empleado registrado",
      });

      if (suggestions.length >= SUGGESTION_LIMIT) break;
    }

    return suggestions;
  }, [empleados, estadoFiltro, search, getPersonaNombre, getSucursalNombre]);

  const handleSearchUpdate = useCallback((value, { source } = {}) => {
    const normalized = normalizeSearchText(value);
    setPage((prev) => (prev === 1 ? prev : 1));
    if (!normalized) {
      setDebouncedSearch("");
      return;
    }
    if (source === "suggestion") {
      setDebouncedSearch((prev) => (prev === normalized ? prev : normalized));
    }
  }, []);

  const {
    handleSearchInputChange,
    searchDropdownRef,
    isSearchDropdownMounted,
    isSearchDropdownVisible,
    searchDropdownStyle,
    searchDropdownTitle,
    isPredictiveSearch,
    searchSuggestionItems,
    activeSuggestionIndex,
    applySearchSuggestion,
    removeRecentSearch,
    clearRecentSearches,
    recentSearchesCount,
  } = useSearchSuggestionsDropdown({
    panelRef,
    search,
    setSearch,
    committedSearch: debouncedSearch,
    onSearchUpdate: handleSearchUpdate,
    predictiveSuggestions,
    recentStorageKey: "empleadosRecentSearchesV1",
  });

  const stats = useMemo(() => {
    const totalFiltradas = empleadosFiltrados.length;
    const activas = empleadosFiltrados.filter((item) => isActivo(item)).length;
    return { total: totalFiltradas, activas, inactivas: totalFiltradas - activas };
  }, [empleadosFiltrados]);

  const hasActiveFilters = useMemo(
    () => search.trim() !== "" || estadoFiltro !== "todos" || sortBy !== "recientes",
    [search, estadoFiltro, sortBy]
  );

  const colsClass = cardsPerPage >= 6 ? "cols-3" : cardsPerPage >= 4 ? "cols-2" : "cols-1";
  const drawerMode = editId ? "edit" : "create";
  const todayDate = new Date().toISOString().split("T")[0];
  const isInlinePersonaFlow = drawerMode === "create" && useInlinePersonaCreate;
  const drawerSubtitle =
    drawerMode === "create"
      ? isInlinePersonaFlow
        ? "Paso 1 de 2: completa la persona. Luego define los datos del empleado y guarda."
        : "Paso 1: selecciona o crea la persona. Paso 2: completa la informacion laboral."
      : "Actualiza los campos necesarios y guarda los cambios.";
  const datosEmpleadoCopy = isInlinePersonaFlow
    ? "Persona base en proceso. Al terminar, completa la informacion laboral."
    : "Selecciona la persona base y completa la informacion laboral.";

  const openFiltersDrawer = () => {
    if (actionLoading) return;
    closeFormDrawer();
    setDetailEmpleado(null);
    setFiltersDraft({ estadoFiltro, sortBy });
    setFiltersOpen(true);
  };

  const closeFiltersDrawer = () => setFiltersOpen(false);

  const applyFiltersDrawer = () => {
    setEstadoFiltro(filtersDraft.estadoFiltro || "todos");
    setSortBy(filtersDraft.sortBy || "recientes");
    setFiltersOpen(false);
  };

  const clearVisualFilters = () => {
    setEstadoFiltro("todos");
    setSortBy("recientes");
    setFiltersDraft(createInitialFiltersDraft());
  };

  const clearAllFilters = () => {
    handleSearchInputChange("");
    clearVisualFilters();
    setFiltersOpen(false);
  };

  const closeAnyDrawer = () => {
    if (actionLoading) return;
    closeFormDrawer();
    setFiltersOpen(false);
  };

  return (
    <div className="personas-page personas-page--empleados">
      <div className="inv-catpro-card inv-prod-card personas-page__panel mb-3" ref={panelRef}>
        <HeaderModulo
          iconClass="bi bi-person-badge-fill"
          title="Empleados"
          subtitle="Gestion visual de empleados"
          search={search}
          onSearchChange={handleSearchInputChange}
          searchPlaceholder="Buscar por nombre, sucursal, DNI, cargo o telefono..."
          searchAriaLabel="Buscar empleados"
          filtersOpen={filtersOpen}
          onOpenFilters={openFiltersDrawer}
          createOpen={showModal}
          onOpenCreate={openCreate}
          createLabel="Nuevo"
          filtersControlsId="empd-filtros-drawer"
          formControlsId="empd-form-drawer"
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        <SearchSuggestionsDropdown
          mounted={isSearchDropdownMounted}
          visible={isSearchDropdownVisible}
          dropdownRef={searchDropdownRef}
          dropdownStyle={searchDropdownStyle}
          title={searchDropdownTitle}
          isPredictiveSearch={isPredictiveSearch}
          recentCount={recentSearchesCount}
          items={searchSuggestionItems}
          activeIndex={activeSuggestionIndex}
          searchValue={search}
          onApplySuggestion={applySearchSuggestion}
          onRemoveRecent={removeRecentSearch}
          onClearRecent={clearRecentSearches}
        />

        <ModuleKPICards stats={stats} totalLabel="Total de empleados" />

        <div className="inv-catpro-body inv-prod-body p-3">
          <div className="inv-prod-results-meta personas-page__results-meta">
            <span>{loading ? "Cargando empleados..." : `${empleadosFiltrados.length} resultados`}</span>
            <span>{loading ? "" : `Total: ${total}`}</span>
            {hasActiveFilters ? <span className="inv-prod-active-filter-pill">Filtros activos</span> : null}
          </div>

          <div className={`inv-catpro-list ${isAnyDrawerOpen ? "drawer-open" : ""}`}>
            {loading ? (
              <div className="inv-catpro-loading" role="status" aria-live="polite">
                <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                <span>Cargando empleados...</span>
              </div>
            ) : empleadosFiltrados.length === 0 ? (
              <div className="inv-catpro-empty">
                <div className="inv-catpro-empty-icon">
                  <i className="bi bi-person-badge" />
                </div>
                <div className="inv-catpro-empty-title">No hay empleados para mostrar</div>
                <div className="inv-catpro-empty-sub">
                  {hasActiveFilters ? "Prueba limpiar filtros o crea un nuevo empleado." : "Crea tu primer empleado."}
                </div>

                <div className="d-flex gap-2 justify-content-center flex-wrap">
                  {hasActiveFilters ? (
                    <button type="button" className="btn btn-outline-secondary" onClick={clearAllFilters}>
                      Limpiar filtros
                    </button>
                  ) : null}
                  <button type="button" className="btn btn-primary" onClick={openCreate}>
                    Nuevo empleado
                  </button>
                </div>
              </div>
            ) : viewMode === "table" ? (
              <EntityTable>
                <table className="table personas-page__table">
                  <thead>
                    <tr>
                      <th scope="col">Empleado</th>
                      <th scope="col">Sucursal</th>
                      <th scope="col">DNI</th>
                      <th scope="col">Telefono</th>
                      <th scope="col">Cargo</th>
                      <th scope="col">Fecha ingreso</th>
                      <th scope="col">Estado</th>
                      <th scope="col">Codigo</th>
                      <th scope="col" className="text-end">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {empleadosFiltrados.map((empleado, idx) => {
                      const isActive = isActivo(empleado);
                      const idEmpleado = empleado?.id_empleado;
                      const deleting = deletingId === idEmpleado;
                      const tableIndex = (page - 1) * limit + idx;

                      return (
                        <tr key={empleado?.id_empleado ?? idx} className={isActive ? "" : "is-inactive-state"}>
                          <td>
                            <strong>{tableIndex + 1}. {toDisplayValue(getPersonaNombre(empleado), "Empleado sin nombre")}</strong>
                          </td>
                          <td>{toDisplayValue(getSucursalNombre(empleado))}</td>
                          <td>{toDisplayValue(getDni(empleado), "N/D")}</td>
                          <td>{toDisplayValue(getTelefono(empleado), "Sin telefono")}</td>
                          <td>{toDisplayValue(getCargo(empleado), "Sin cargo")}</td>
                          <td>{formatDateLabel(empleado?.fecha_ingreso)}</td>
                          <td>
                            <span className={`inv-ins-card__badge ${isActive ? "is-ok" : "is-inactive"}`}>
                              {isActive ? "ACTIVO" : "INACTIVO"}
                            </span>
                          </td>
                          <td>
                            <div className="inv-catpro-code-wrap personas-page__table-code-wrap">
                              <span className={`inv-catpro-state-dot ${isActive ? "ok" : "off"}`} />
                              <span className="inv-catpro-code">EMP-{String(idEmpleado ?? "-")}</span>
                            </div>
                          </td>
                          <td className="text-end">
                            <div className="personas-page__table-actions">
                              <button
                                type="button"
                                className="inv-catpro-action inv-catpro-action-compact"
                                onClick={() => openDetailModal(empleado)}
                                title="Ver detalle"
                                disabled={actionLoading || deleting}
                              >
                                <i className="bi bi-eye" />
                                <span className="inv-catpro-action-label">Detalle</span>
                              </button>

                              <button
                                type="button"
                                className="inv-catpro-action edit inv-catpro-action-compact"
                                onClick={() => iniciarEdicion(empleado)}
                                title="Editar"
                                disabled={actionLoading || deleting}
                              >
                                <i className="bi bi-pencil-square" />
                                <span className="inv-catpro-action-label">Editar</span>
                              </button>

                              <button
                                type="button"
                                className="inv-catpro-action danger inv-catpro-action-compact"
                                onClick={() => openConfirmDelete(empleado)}
                                title="Eliminar"
                                disabled={actionLoading || deleting}
                              >
                                <i className={`bi ${deleting ? "bi-hourglass-split" : "bi-trash"}`} />
                                <span className="inv-catpro-action-label">{deleting ? "Eliminando..." : "Eliminar"}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </EntityTable>
            ) : (
              <div className={`inv-catpro-grid inv-catpro-grid-page ${colsClass}`}>
                {empleadosFiltrados.map((empleado, idx) => (
                  <EmpleadoCard
                    key={empleado?.id_empleado ?? idx}
                    empleado={empleado}
                    index={(page - 1) * limit + idx}
                    imageSrc={resolveEmpleadoImage(empleado)}
                    onOpenEdit={iniciarEdicion}
                    onOpenDelete={openConfirmDelete}
                    onOpenDetail={openDetailModal}
                    actionLoading={actionLoading}
                    deletingId={deletingId}
                    getPersonaNombre={getPersonaNombre}
                    getSucursalNombre={getSucursalNombre}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="personas-page__pagination">
            <button
              type="button"
              className="btn btn-outline-secondary"
              disabled={page === 1 || loading || actionLoading || !!deletingId}
              onClick={() => setPage((prev) => prev - 1)}
            >
              <i className="bi bi-chevron-left me-1" />
              Anterior
            </button>
            <span>
              Pagina {page} de {totalPages}
            </span>
            <button
              type="button"
              className="btn btn-outline-secondary"
              disabled={page >= totalPages || loading || actionLoading || !!deletingId}
              onClick={() => setPage((prev) => prev + 1)}
            >
              Siguiente
              <i className="bi bi-chevron-right ms-1" />
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        className={`inv-catpro-fab d-md-none ${isAnyDrawerOpen ? "is-hidden" : ""}`}
        onClick={openCreate}
        title="Nuevo"
        disabled={actionLoading || !!deletingId}
      >
        <i className="bi bi-plus" />
      </button>

      <div
        className={`inv-prod-drawer-backdrop inv-cat-v2__drawer-backdrop ${isAnyDrawerOpen ? "show" : ""}`}
        onClick={closeAnyDrawer}
        aria-hidden={!isAnyDrawerOpen}
      />

      <ModuleFiltros
        open={filtersOpen}
        drawerId="empd-filtros-drawer"
        iconClass="bi bi-person-badge-fill"
        title="Filtros de empleados"
        subtitle="Estado y orden visual del listado"
        draft={filtersDraft}
        onChangeDraft={setFiltersDraft}
        onClose={closeFiltersDrawer}
        onApply={applyFiltersDrawer}
        onClear={clearVisualFilters}
        allLabel="Todos"
        activeLabel="Activos"
        inactiveLabel="Inactivos"
      />

      <aside
        className={`inv-prod-drawer inv-cat-v2__drawer crud-modal empleados-modal ${showModal ? "show" : ""} ${
          drawerMode === "create" ? "is-create" : "is-edit"
        }`}
        id="empd-form-drawer"
        role="dialog"
        aria-modal="true"
        aria-hidden={!showModal}
      >
        <div className="inv-prod-drawer-head crud-modal__header">
          <div className="crud-modal__header-copy crud-modal__header-copy--insumo">
            <div className="crud-modal__hero-icon" aria-hidden="true">
              <i className="bi bi-person-workspace" />
            </div>
            <div className="crud-modal__hero-main">
              <div className="crud-modal__hero-kicker">{drawerMode === "create" ? "Nuevo registro" : "Edicion activa"}</div>
              <div className="inv-prod-drawer-title crud-modal__title">{drawerMode === "create" ? "Nuevo empleado" : "Editar empleado"}</div>
              <div className="inv-prod-drawer-sub crud-modal__subtitle">{drawerSubtitle}</div>
            </div>
            <div className="crud-modal__hero-chips">
              <span className="crud-modal__hero-chip">
                <i className="bi bi-briefcase" /> Datos laborales
              </span>
              <span className="crud-modal__hero-chip">
                <i className="bi bi-shield-check" /> Registro seguro
              </span>
            </div>
          </div>
          <button
            type="button"
            className="inv-prod-drawer-close crud-modal__close"
            onClick={closeFormDrawer}
            title="Cerrar"
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <form className="inv-prod-drawer-body inv-catpro-drawer-body-lite crud-modal__body" onSubmit={guardar}>
          <section className="crud-modal__section empleados-modal__section">
            <header className="crud-modal__section-head">
              <h4>Datos del empleado</h4>
              <p>{datosEmpleadoCopy}</p>
            </header>

            <div className="row g-3 crud-modal__grid">
              <div className="col-12">
                <SmartSelectEntity
                  className="empleados-modal__entity-block"
                  label="Persona"
                  showToggle={drawerMode === "create"}
                  isInlineCreate={drawerMode === "create" && useInlinePersonaCreate}
                  onToggleInline={() => {
                    setUseInlinePersonaCreate((prev) => {
                      const next = !prev;
                      if (next) {
                        setShowPersonaCreateModal(true);
                        setForm((state) => ({ ...state, id_persona: "" }));
                      } else {
                        setInlinePersonaForm(emptyInlinePersonaForm);
                        setShowPersonaCreateModal(false);
                      }
                      return next;
                    });
                    setErrors((state) => ({ ...state, id_persona: undefined }));
                  }}
                  toggleVariant="dual"
                  toggleCreateLabel="Crear persona nueva"
                  toggleExistingLabel="Usar persona existente"
                  toggleDisabled={actionLoading || Boolean(deletingId)}
                  selector={
                    drawerMode === "create" ? (
                      <Select
                        inputId="empleado-persona-select"
                        className={`empleados-select ${errors.id_persona ? "is-invalid" : ""}`}
                        classNamePrefix="empleados-select"
                        placeholder="Buscar y seleccionar persona"
                        isSearchable
                        isClearable
                        options={personaSelectOptions}
                        value={personaSelectValue}
                        onChange={(option) => {
                          setForm((state) => ({
                            ...state,
                            id_persona: option?.value ? String(option.value) : "",
                          }));
                          setErrors((state) => ({ ...state, id_persona: undefined }));
                        }}
                        styles={personaSelectStyles}
                        menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                        menuPosition="fixed"
                        isDisabled={actionLoading || Boolean(deletingId) || useInlinePersonaCreate}
                      />
                    ) : (
                      <select
                        className={`form-select ${errors.id_persona ? "is-invalid" : ""}`}
                        value={form.id_persona}
                        onChange={(event) => setForm((state) => ({ ...state, id_persona: event.target.value }))}
                      >
                        <option value="">Seleccione</option>
                        {personaOptions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label} {item.dni ? `| DNI: ${item.dni}` : ""}
                          </option>
                        ))}
                      </select>
                    )
                  }
                  error={errors.id_persona}
                  inlineContent={
                    <div className="smart-select-entity__summary empleados-inline-summary">
                      <div className="empleados-inline-summary__text">
                        {String(inlinePersonaForm.nombre ?? "").trim()
                          ? "Persona lista. Ahora completa sucursal, fecha de ingreso y salario base."
                          : "Primero completa los datos de la persona para continuar."}
                      </div>
                      <div className="empleados-inline-summary__chips">
                        <span className="empleados-inline-summary__chip">
                          {String(inlinePersonaForm.nombre ?? "").trim() || "Sin nombre"}{" "}
                          {String(inlinePersonaForm.apellido ?? "").trim()}
                        </span>
                        <span className="empleados-inline-summary__chip">
                          DNI: {toDisplayValue(inlinePersonaForm.dni, "N/D")}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm empleados-inline-summary__action"
                        onClick={() => setShowPersonaCreateModal(true)}
                        disabled={actionLoading || Boolean(deletingId)}
                      >
                        {String(inlinePersonaForm.nombre ?? "").trim()
                          ? "Revisar persona creada"
                          : "Abrir formulario de persona"}
                      </button>
                    </div>
                  }
                />
              </div>

              <div className="col-12">
                <div className="empleados-modal__persona-meta" role="status" aria-live="polite">
                  <div className="empleados-modal__persona-meta-item">
                    <span>DNI</span>
                    <strong>{toDisplayValue(selectedPersonaDni, "N/D")}</strong>
                  </div>
                  <div className="empleados-modal__persona-meta-item">
                    <span>Telefono</span>
                    <strong>{toDisplayValue(selectedPersonaTelefono, "Sin telefono")}</strong>
                  </div>
                </div>
              </div>

              <div className="col-12">
                <label className="form-label text-light text-opacity-75">Sucursal</label>
                {drawerMode === "create" ? (
                  <Select
                    inputId="empleado-sucursal-select"
                    className={`empleados-select ${errors.id_sucursal ? "is-invalid" : ""}`}
                    classNamePrefix="empleados-select"
                    placeholder="Selecciona una sucursal"
                    isSearchable
                    isClearable
                    options={sucursalSelectOptions}
                    value={sucursalSelectValue}
                    onChange={(option) => {
                      setForm((state) => ({
                        ...state,
                        id_sucursal: option?.value ? String(option.value) : "",
                      }));
                      setErrors((state) => ({ ...state, id_sucursal: undefined }));
                    }}
                    styles={sucursalSelectStyles}
                    menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                    menuPosition="fixed"
                    isDisabled={actionLoading || Boolean(deletingId)}
                  />
                ) : (
                  <select
                    className={`form-select ${errors.id_sucursal ? "is-invalid" : ""}`}
                    value={form.id_sucursal}
                    onChange={(event) => setForm((state) => ({ ...state, id_sucursal: event.target.value }))}
                  >
                    <option value="">Seleccione</option>
                    {sucursalOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                )}
                {errors.id_sucursal && <div className="invalid-feedback d-block">{errors.id_sucursal}</div>}
              </div>

              <div className="col-12">
                <label className="form-label text-light text-opacity-75">Cargo / Puesto</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.cargo}
                  onChange={(event) => setForm((state) => ({ ...state, cargo: event.target.value }))}
                  placeholder="Ej. Cajero, Supervisor, Auxiliar"
                  maxLength={120}
                />
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label text-light text-opacity-75">Nombre referencia</label>
                <input
                  type="text"
                  className={`form-control ${errors.nombre_referencia ? "is-invalid" : ""}`}
                  value={form.nombre_referencia}
                  onChange={handleNombreReferenciaChange}
                  onBeforeInput={handleNombreReferenciaBeforeInput}
                  onKeyDown={handleNombreReferenciaKeyDown}
                  onPaste={handleNombreReferenciaPaste}
                  placeholder="Nombre del contacto de referencia"
                  maxLength={120}
                />
                {errors.nombre_referencia && <div className="invalid-feedback d-block">{errors.nombre_referencia}</div>}
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label text-light text-opacity-75">Telefono referencia</label>
                <input
                  ref={telefonoReferenciaInputRef}
                  type="text"
                  inputMode="numeric"
                  className={`form-control ${errors.telefono_referencia ? "is-invalid" : ""}`}
                  value={form.telefono_referencia}
                  onChange={handleTelefonoReferenciaChange}
                  onBeforeInput={handleTelefonoReferenciaBeforeInput}
                  onKeyDown={handleTelefonoReferenciaKeyDown}
                  onPaste={handleTelefonoReferenciaPaste}
                  placeholder="Numero de referencia"
                  maxLength={9}
                />
                {errors.telefono_referencia && <div className="invalid-feedback d-block">{errors.telefono_referencia}</div>}
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label text-light text-opacity-75">Fecha de ingreso</label>
                <input
                  type="date"
                  className={`form-control ${errors.fecha_ingreso ? "is-invalid" : ""}`}
                  value={form.fecha_ingreso}
                  onChange={(event) => setForm((state) => ({ ...state, fecha_ingreso: event.target.value }))}
                  max={todayDate}
                />
                {errors.fecha_ingreso && <div className="invalid-feedback d-block">{errors.fecha_ingreso}</div>}
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label text-light text-opacity-75">Salario base</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={`form-control ${errors.salario_base ? "is-invalid" : ""}`}
                  value={form.salario_base}
                  onChange={(event) => setForm((state) => ({ ...state, salario_base: event.target.value }))}
                />
                {errors.salario_base && <div className="invalid-feedback d-block">{errors.salario_base}</div>}
              </div>
            </div>
          </section>

          <section className="crud-modal__section empleados-modal__section empleados-modal__section--secondary">
            <header className="crud-modal__section-head">
              <h4>Presentacion y estado</h4>
              <p>Configura imagen de perfil y disponibilidad del registro.</p>
            </header>

            <div className="row g-3 crud-modal__grid">
              <div className="col-12">
                <label className="form-label text-light text-opacity-75">Imagen (opcional)</label>
                <div className={`inv-prod-image-field personas-emp-form-image ${formImage.loading ? "is-loading" : ""}`}>
                  <div className={`inv-prod-image-preview ${formImage.previewUrl ? "has-image" : ""}`} aria-live="polite">
                    {formImage.loading ? (
                      <div className="inv-prod-image-loading" role="status">
                        <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                        <span>Procesando imagen...</span>
                      </div>
                    ) : formImage.previewUrl ? (
                      <img src={formImage.previewUrl} alt="Vista previa del empleado" />
                    ) : (
                      <div className="inv-prod-image-placeholder">
                        <i className="bi bi-image" />
                        <span>Sin imagen seleccionada</span>
                      </div>
                    )}
                  </div>

                  <div className="inv-prod-image-actions">
                    <label className="btn inv-prod-btn-subtle inv-prod-image-picker">
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        onChange={onFormImageChange}
                        disabled={actionLoading}
                      />
                      <i className="bi bi-upload" />
                      <span>{formImage.previewUrl ? "Cambiar imagen" : "Seleccionar imagen"}</span>
                    </label>

                    <button
                      type="button"
                      className="btn inv-prod-btn-outline"
                      onClick={removeFormImage}
                      disabled={!formImage.previewUrl && !formImage.error && !formImage.loading}
                    >
                      Quitar
                    </button>
                  </div>

                  {formImage.error ? (
                    <div className="inv-prod-image-feedback is-error">{formImage.error}</div>
                  ) : (
                    <div className="inv-prod-image-feedback">JPG, PNG o WEBP hasta 6 MB.</div>
                  )}
                </div>
              </div>

              <div className="col-12">
                <div className="form-check form-switch m-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="empleado_estado"
                    checked={Boolean(form.estado)}
                    onChange={(event) => setForm((state) => ({ ...state, estado: event.target.checked }))}
                  />
                  <label className="form-check-label text-light text-opacity-75" htmlFor="empleado_estado">
                    Registro activo
                  </label>
                </div>
              </div>
            </div>
          </section>

          <div className="d-flex gap-2 mt-4 crud-modal__footer">
            <button
              type="button"
              className="btn inv-prod-btn-subtle flex-fill crud-modal__btn"
              onClick={closeFormDrawer}
              disabled={actionLoading || !!deletingId}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn inv-prod-btn-primary flex-fill crud-modal__btn"
              disabled={actionLoading || !!deletingId}
            >
              {actionLoading ? "Guardando..." : drawerMode === "create" ? "Crear empleado" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </aside>

      <PersonaInlineCreateModal
        show={showModal && drawerMode === "create" && useInlinePersonaCreate && showPersonaCreateModal}
        initialForm={inlinePersonaForm}
        onClose={() => setShowPersonaCreateModal(false)}
        onSave={handleInlinePersonaModalSave}
      />

      <EmployeeDetailModal
        open={Boolean(detailEmpleado)}
        empleado={detailEmpleado}
        onClose={closeDetailModal}
        getPersonaNombre={getPersonaNombre}
        getSucursalNombre={getSucursalNombre}
        getImageSrc={resolveEmpleadoImage}
      />

      {confirmModal.show && (
        <div className="inv-pro-confirm-backdrop" role="dialog" aria-modal="true" onClick={closeConfirmDelete}>
          <div className="inv-pro-confirm-panel" onClick={(event) => event.stopPropagation()}>
            <div className="inv-pro-confirm-head">
              <div className="inv-pro-confirm-head-icon">
                <i className="bi bi-exclamation-triangle-fill" />
              </div>
              <div>
                <div className="inv-pro-confirm-title">CONFIRMAR ELIMINACION</div>
                <div className="inv-pro-confirm-sub">Esta accion es permanente</div>
              </div>
              <button type="button" className="inv-pro-confirm-close" onClick={closeConfirmDelete} aria-label="Cerrar">
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <div className="inv-pro-confirm-body">
              <div className="inv-pro-confirm-question">Deseas eliminar este empleado?</div>
              <div className="inv-pro-confirm-name">
                <i className="bi bi-person-badge" />
                <span>{confirmModal.nombre || "Empleado seleccionado"}</span>
              </div>
            </div>

            <div className="inv-pro-confirm-footer">
              <button type="button" className="btn inv-pro-btn-cancel" onClick={closeConfirmDelete}>
                Cancelar
              </button>
              <button type="button" className="btn inv-pro-btn-danger" onClick={eliminarConfirmado}>
                <i className="bi bi-trash3" />
                <span>Eliminar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
