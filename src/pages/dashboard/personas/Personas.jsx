import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { personaService } from "../../../services/personasService";
import EntityTable from "../../../components/ui/EntityTable";
import StatsCardsRow from "../../../components/ui/StatsCardsRow";
import Filtros from "./components/Filtros";
import HeaderPersonas from "./components/HeaderPersonas";
import "./components/common/crud-modal-theme.css";
import "./components/personas-search-dropdown.css";

const emptyForm = {
  nombre: "",
  apellido: "",
  dni: "",
  rtn: "",
  genero: "",
  fecha_nacimiento: "",
  id_telefono: "",
  id_direccion: "",
  id_correo: "",
};

const createInitialTouched = () => ({
  nombre: false,
  apellido: false,
  dni: false,
  genero: false,
  fechaNacimiento: false,
  telefono: false,
  correo: false,
  rtn: false,
});

const formFieldToTouchedKey = {
  nombre: "nombre",
  apellido: "apellido",
  dni: "dni",
  genero: "genero",
  fecha_nacimiento: "fechaNacimiento",
  id_telefono: "telefono",
  id_correo: "correo",
  rtn: "rtn",
};

const createInitialFiltersDraft = () => ({
  generoFiltro: "todos",
  sortBy: "recientes",
});

const EMAIL_WITH_DOMAIN_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const isAbortError = (error) => error?.name === "AbortError";
const MIN_CHARS_FOR_SUGGESTIONS = 2;
const MAX_RECENT_SEARCHES = 8;
const SEARCH_DROPDOWN_ANIMATION_MS = 220;
const PERSONAS_RECENT_SEARCHES_KEY = "personasRecentSearchesV1";
const SEARCH_INPUT_SELECTOR = '.personas-page .inv-ins-search input[type="search"]';

const normalizeSearchText = (value) => String(value ?? "").trim();

const readRecentSearches = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PERSONAS_RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizeSearchText(item))
      .filter(Boolean)
      .slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
};

const persistRecentSearches = (items) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PERSONAS_RECENT_SEARCHES_KEY, JSON.stringify(items));
  } catch {
    // Keep working even if storage is unavailable.
  }
};

const appendRecentSearch = (currentItems, term) => {
  const normalized = normalizeSearchText(term);
  if (!normalized) return currentItems;
  const withoutDuplicate = (Array.isArray(currentItems) ? currentItems : []).filter(
    (item) => normalizeSearchText(item).toLowerCase() !== normalized.toLowerCase()
  );
  return [normalized, ...withoutDuplicate].slice(0, MAX_RECENT_SEARCHES);
};

const findSearchInput = () => {
  if (typeof document === "undefined") return null;
  return document.querySelector(SEARCH_INPUT_SELECTOR);
};

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const pickFirstNumber = (...values) => {
  for (const value of values) {
    const num = toNumberOrNull(value);
    if (num !== null) return num;
  }
  return null;
};

const pickFirstObject = (...values) => {
  for (const value of values) {
    if (value && typeof value === "object" && !Array.isArray(value)) return value;
  }
  return null;
};

const getResponseTotal = (resp) =>
  pickFirstNumber(
    resp?.total,
    resp?.totalItems,
    resp?.count,
    resp?.total_count,
    resp?.meta?.total,
    resp?.meta?.totalItems,
    resp?.meta?.count,
    resp?.pagination?.total,
    resp?.pagination?.totalItems,
    resp?.pagination?.count
  );

const extractGlobalStatsFromResponse = (resp) => {
  if (!resp || Array.isArray(resp) || typeof resp !== "object") return null;

  const statsSource = pickFirstObject(
    resp?.stats,
    resp?.totals,
    resp?.meta?.stats,
    resp?.meta?.totals,
    resp?.pagination?.stats,
    resp?.pagination?.totals
  );

  if (!statsSource) return null;

  const total = pickFirstNumber(
    statsSource?.total,
    statsSource?.total_personas,
    statsSource?.totalPersonas,
    statsSource?.personas_total,
    getResponseTotal(resp)
  );

  const femenino = pickFirstNumber(
    statsSource?.femenino,
    statsSource?.female,
    statsSource?.females,
    statsSource?.totalFemale,
    statsSource?.total_female,
    statsSource?.total_femenino,
    statsSource?.genero_femenino,
    statsSource?.mujeres
  );

  const masculino = pickFirstNumber(
    statsSource?.masculino,
    statsSource?.male,
    statsSource?.males,
    statsSource?.totalMale,
    statsSource?.total_male,
    statsSource?.total_masculino,
    statsSource?.genero_masculino,
    statsSource?.hombres
  );

  const activas = pickFirstNumber(
    statsSource?.activas,
    statsSource?.active,
    statsSource?.activos,
    statsSource?.totalActivas,
    statsSource?.total_activas
  );

  const inactivas = pickFirstNumber(
    statsSource?.inactivas,
    statsSource?.inactive,
    statsSource?.inactivos,
    statsSource?.totalInactivas,
    statsSource?.total_inactivas
  );

  if (total === null && femenino === null && masculino === null && activas === null && inactivas === null) {
    return null;
  }

  const resolvedTotal = Math.max(0, total ?? (femenino ?? 0) + (masculino ?? 0));
  const resolvedActivas = Math.max(
    0,
    Math.min(
      resolvedTotal,
      activas ?? (inactivas !== null ? Math.max(0, resolvedTotal - inactivas) : 0)
    )
  );
  const resolvedInactivas = Math.max(
    0,
    Math.min(
      resolvedTotal,
      inactivas ?? Math.max(0, resolvedTotal - resolvedActivas)
    )
  );

  return {
    total: resolvedTotal,
    activas: resolvedActivas,
    inactivas: resolvedInactivas,
    femenino: Math.max(0, femenino ?? 0),
    masculino: Math.max(0, masculino ?? 0),
  };
};

const normalizeListResponse = (resp) => {
  if (Array.isArray(resp)) {
    return { items: resp, total: resp.length };
  }

  const items =
    (resp && (resp.items || resp.data || resp.rows || resp.resultados || resp.personas)) || [];
  const total = getResponseTotal(resp) ?? (Array.isArray(items) ? items.length : 0);

  return { items: Array.isArray(items) ? items : [], total: Number(total) || 0 };
};

const normalizeSuggestionItems = (resp) => {
  const directSuggestions = Array.isArray(resp?.suggestions) ? resp.suggestions : [];
  const { items } = normalizeListResponse(resp);
  const source = directSuggestions.length ? directSuggestions : items;
  const seen = new Set();
  const suggestions = [];

  for (const item of source) {
    const id = item?.id_persona ?? null;
    const nombre = normalizeSearchText(item?.nombre || `${item?.nombre || ""} ${item?.apellido || ""}`);
    const dni = normalizeSearchText(item?.dni);
    const correo = normalizeSearchText(item?.correo ?? item?.direccion_correo);
    const telefono = normalizeSearchText(item?.telefono);
    const value = normalizeSearchText(item?.value || nombre || dni || correo || telefono);
    if (!value) continue;

    const detailParts = [];
    if (dni) detailParts.push(`DNI: ${dni}`);
    if (correo) detailParts.push(correo);
    if (telefono) detailParts.push(telefono);
    const detail = detailParts.join(" | ");
    const key = `${value.toLowerCase()}|${detail.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    suggestions.push({
      id: id ?? key,
      value,
      label: nombre || value,
      detail,
    });

    if (suggestions.length >= MAX_RECENT_SEARCHES) break;
  }

  return suggestions;
};

const toDateInputValue = (value) => {
  if (!value) return "";
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const resolveCardsPerPage = (width) => {
  if (width >= 1200) return 6;
  if (width >= 620) return 4;
  return 2;
};

const readViewMode = (storageKey) => {
  if (typeof window === "undefined") return "cards";
  try {
    return window.localStorage.getItem(storageKey) === "table" ? "table" : "cards";
  } catch {
    return "cards";
  }
};

const lettersAndSpaces = (value) =>
  String(value ?? "").replace(
    /[^A-Za-z\u00C1\u00C9\u00CD\u00D3\u00DA\u00E1\u00E9\u00ED\u00F3\u00FA\u00D1\u00F1\u00DC\u00FC\s]/g,
    ""
  );

const capitalizeFirstOnly = (value) => {
  if (!value) return "";
  const s = String(value).toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const digitsOnly = (value) => String(value ?? "").replace(/\D/g, "");

const limit = (value, max) => String(value ?? "").slice(0, max);
const DNI_DIGITS_LENGTH = 13;
const DNI_DISPLAY_MAX_LENGTH = 15;
const PHONE_DIGITS_LENGTH = 8;
const PHONE_DISPLAY_MAX_LENGTH = 9;

const formatDNI = (digits13) => {
  const d = String(digits13 ?? "");
  const p1 = d.slice(0, 4);
  const p2 = d.slice(4, 8);
  const p3 = d.slice(8, DNI_DIGITS_LENGTH);
  if (d.length <= 4) return p1;
  if (d.length <= 8) return `${p1}-${p2}`;
  return `${p1}-${p2}-${p3}`;
};

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

const formatPhone = (digits8) => {
  const d = String(digits8 ?? "");
  const p1 = d.slice(0, 4);
  const p2 = d.slice(4, 8);
  if (d.length <= 4) return p1;
  return `${p1}-${p2}`;
};

const LETTERS_INPUT_REGEX = /^[A-Za-z\u00C1\u00C9\u00CD\u00D3\u00DA\u00E1\u00E9\u00ED\u00F3\u00FA\u00D1\u00F1\u00DC\u00FC\s]+$/;
const ALLOWED_EDITING_KEYS = new Set([
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
const DUPLICATE_MODAL_DEFAULT_MESSAGE = "Dato ya existe ya sea nombre, DNI, apellidos y telefonos";
const UNIQUE_STATUS_CODES = new Set([400, 409, 500]);
const UNIQUE_ERROR_HINTS = [
  "duplicate",
  "unique",
  "already exists",
  "already exist",
  "violates unique",
  "constraint",
  "23505",
  "personas_dni_unique",
  "telefonos_unique",
  "correos_unique",
  "personas_nombre_apellido_unique",
];

const collectErrorTokens = (value, bucket = [], visited = new Set()) => {
  if (value === null || value === undefined) return bucket;
  const valueType = typeof value;
  if (valueType === "string" || valueType === "number" || valueType === "boolean") {
    const text = String(value).trim();
    if (text) bucket.push(text);
    return bucket;
  }
  if (valueType !== "object") return bucket;
  if (visited.has(value)) return bucket;
  visited.add(value);
  if (Array.isArray(value)) {
    value.forEach((item) => collectErrorTokens(item, bucket, visited));
    return bucket;
  }
  Object.values(value).forEach((item) => collectErrorTokens(item, bucket, visited));
  return bucket;
};

const normalizeErrorText = (error) =>
  collectErrorTokens({
    message: error?.message,
    code: error?.code,
    status: error?.status,
    statusCode: error?.statusCode,
    data: error?.data,
    response: error?.response?.data,
    constraint: error?.constraint ?? error?.data?.constraint ?? error?.response?.data?.constraint,
    sqlState:
      error?.sqlState ??
      error?.data?.sqlState ??
      error?.data?.sqlstate ??
      error?.response?.data?.sqlState ??
      error?.response?.data?.sqlstate,
  })
    .join(" ")
    .toLowerCase();

const readErrorStatus = (error) => {
  const rawStatus =
    error?.status ??
    error?.statusCode ??
    error?.response?.status ??
    error?.response?.statusCode ??
    error?.data?.status ??
    error?.response?.data?.status;
  const parsed = Number(rawStatus);
  return Number.isFinite(parsed) ? parsed : null;
};

const isUniqueConstraintError = (error) => {
  const status = readErrorStatus(error);
  const normalizedText = normalizeErrorText(error);
  const hasUniqueHint = UNIQUE_ERROR_HINTS.some((hint) => normalizedText.includes(hint));
  if (status === 409) return true;
  if (UNIQUE_STATUS_CODES.has(status) && hasUniqueHint) return true;
  return hasUniqueHint;
};

const resolveDuplicateFieldLabel = (error) => {
  const normalizedText = normalizeErrorText(error);
  if (normalizedText.includes("personas_nombre_apellido_unique") || (normalizedText.includes("nombre") && normalizedText.includes("apellido"))) {
    return "Nombre y Apellido";
  }
  if (normalizedText.includes("personas_dni_unique") || normalizedText.includes("dni")) return "DNI";
  if (normalizedText.includes("telefonos_unique") || normalizedText.includes("telefono")) return "Telefono";
  if (normalizedText.includes("correos_unique") || normalizedText.includes("correo") || normalizedText.includes("email")) {
    return "Correo";
  }
  return "";
};

function PersonasActionModal({
  show,
  onClose,
  title,
  subtitle,
  question,
  detail = "",
  detailIconClass = "bi bi-person-vcard",
  cancelText = "Cancelar",
  confirmText = "Confirmar",
  onConfirm,
  confirmButtonClass = "btn inv-pro-btn-danger",
  confirmIconClass = "",
  hideCancel = false,
  confirmDisabled = false,
}) {
  if (!show) return null;
  const handleClose = () => {
    if (typeof onClose === "function") onClose();
  };
  const handleConfirm = () => {
    if (typeof onConfirm === "function") onConfirm();
  };

  return (
    <div className="inv-pro-confirm-backdrop" role="dialog" aria-modal="true" onClick={handleClose}>
      <div className="inv-pro-confirm-panel" onClick={(event) => event.stopPropagation()}>
        <div className="inv-pro-confirm-head">
          <div className="inv-pro-confirm-head-icon">
            <i className="bi bi-exclamation-triangle-fill" />
          </div>
          <div>
            <div className="inv-pro-confirm-title">{title}</div>
            <div className="inv-pro-confirm-sub">{subtitle}</div>
          </div>
          <button type="button" className="inv-pro-confirm-close" onClick={handleClose} aria-label="Cerrar">
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="inv-pro-confirm-body">
          <div className="inv-pro-confirm-question">{question}</div>
          {detail ? (
            <div className="inv-pro-confirm-name">
              <i className={detailIconClass} />
              <span>{detail}</span>
            </div>
          ) : null}
        </div>

        <div className="inv-pro-confirm-footer">
          {!hideCancel ? (
            <button type="button" className="btn inv-pro-btn-cancel" onClick={handleClose}>
              {cancelText}
            </button>
          ) : null}
          <button type="button" className={confirmButtonClass} onClick={handleConfirm} disabled={confirmDisabled}>
            {confirmIconClass ? <i className={confirmIconClass} /> : null}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

const detectEstadoField = (persona) => {
  if (Object.prototype.hasOwnProperty.call(persona || {}, "estado")) return "estado";
  if (Object.prototype.hasOwnProperty.call(persona || {}, "activo")) return "activo";
  if (Object.prototype.hasOwnProperty.call(persona || {}, "habilitado")) return "habilitado";
  return null;
};

const isPersonaActiva = (persona) => {
  const field = detectEstadoField(persona);
  if (!field) return true;
  return Boolean(persona[field]);
};

const normalizeGenero = (value) => String(value ?? "").trim().toLowerCase();

const normalizeGeneroKey = (value) => {
  const genero = normalizeGenero(value);
  if (!genero) return "";
  if (["f", "femenino", "female"].includes(genero)) return "femenino";
  if (["m", "masculino", "male"].includes(genero)) return "masculino";
  return "";
};

const getPersonaGeneroRaw = (persona) =>
  persona?.genero ?? persona?.sexo ?? persona?.gender ?? persona?.Genero ?? persona?.Sexo ?? persona?.Gender ?? "";

const getPersonaGeneroKey = (persona) => normalizeGeneroKey(getPersonaGeneroRaw(persona));

const isGeneroFemenino = (valueOrPersona) => {
  if (valueOrPersona && typeof valueOrPersona === "object") {
    return getPersonaGeneroKey(valueOrPersona) === "femenino";
  }
  return normalizeGeneroKey(valueOrPersona) === "femenino";
};

const isGeneroMasculino = (valueOrPersona) => {
  if (valueOrPersona && typeof valueOrPersona === "object") {
    return getPersonaGeneroKey(valueOrPersona) === "masculino";
  }
  return normalizeGeneroKey(valueOrPersona) === "masculino";
};

const toDisplayCardValue = (value, fallback = "No disponible") => {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text ? text : fallback;
};

const formatFechaNacimientoCard = (value) => {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return date.toLocaleDateString("es-HN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const formatGeneroCard = (value) => {
  const genero = normalizeGeneroKey(value);
  if (!genero) return "";
  if (genero === "femenino") return "Femenino";
  if (genero === "masculino") return "Masculino";
  return String(value).trim();
};

const getPersonaRtn = (persona) =>
  String(persona?.rtn ?? persona?.RTN ?? persona?.rtn_persona ?? persona?.numero_rtn ?? "").trim();

const buildStatsFromPersonas = (records, totalOverride = null) => {
  const list = Array.isArray(records) ? records : [];
  const totalValue = toNumberOrNull(totalOverride);
  const total = Math.max(0, totalValue ?? list.length);
  const activas = list.filter((item) => isPersonaActiva(item)).length;
  const femenino = list.filter((item) => isGeneroFemenino(item)).length;
  const masculino = list.filter((item) => isGeneroMasculino(item)).length;

  return {
    total,
    activas: Math.max(0, Math.min(activas, total)),
    inactivas: Math.max(0, total - Math.min(activas, total)),
    femenino: Math.max(0, femenino),
    masculino: Math.max(0, masculino),
  };
};

export default function Personas({ openToast }) {
  const safeToast = useCallback(
    (title, message, variant = "success") => {
      if (typeof openToast === "function") openToast(title, message, variant);
    },
    [openToast]
  );

  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState(() => readViewMode("personasViewMode"));
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState(() => readRecentSearches());

  const [generoFiltro, setGeneroFiltro] = useState("todos");
  const [sortBy, setSortBy] = useState("recientes");
  const [filtersDraft, setFiltersDraft] = useState(createInitialFiltersDraft);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [globalStats, setGlobalStats] = useState({
    total: 0,
    activas: 0,
    inactivas: 0,
    femenino: 0,
    masculino: 0,
  });

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState(createInitialTouched);

  const [actionLoading, setActionLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    idToDelete: null,
    nombre: "",
  });
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateMessage, setDuplicateMessage] = useState(DUPLICATE_MODAL_DEFAULT_MESSAGE);
  const [duplicateFieldLabel, setDuplicateFieldLabel] = useState("");

  const [cardsPerPage, setCardsPerPage] = useState(() =>
    typeof window === "undefined" ? 6 : resolveCardsPerPage(window.innerWidth)
  );

  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);
  const globalKpiRequestIdRef = useRef(0);
  const listAbortRef = useRef(null);
  const globalKpiAbortRef = useRef(null);
  const suggestionsAbortRef = useRef(null);
  const searchDropdownRef = useRef(null);
  const panelRef = useRef(null);
  const dniInputRef = useRef(null);
  const dniCaretRef = useRef(null);
  const telefonoInputRef = useRef(null);
  const telefonoCaretRef = useRef(null);
  const searchDropdownCloseTimerRef = useRef(null);
  const searchDropdownOpenFrameRef = useRef(null);
  const [searchDropdownPosition, setSearchDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 320,
  });
  const [isSearchDropdownMounted, setIsSearchDropdownMounted] = useState(false);
  const [isSearchDropdownVisible, setIsSearchDropdownVisible] = useState(false);

  const backendTotalPages = Math.max(1, Math.ceil(total / pageSize));
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
    blurFocusedElementInside("per-form-drawer");
    setShowModal(false);
  }, [blurFocusedElementInside]);

  const syncSearchDropdownPosition = useCallback(() => {
    const panel = panelRef.current;
    const input = findSearchInput();
    if (!panel || !input) return;

    const panelRect = panel.getBoundingClientRect();
    const inputRect = input.getBoundingClientRect();
    const nextLeft = Math.max(12, inputRect.left - panelRect.left);
    const availableWidth = Math.max(220, panelRect.width - nextLeft - 12);
    const nextWidth = Math.max(220, Math.min(inputRect.width, availableWidth));
    const nextTop = Math.max(0, inputRect.bottom - panelRect.top + 10);

    setSearchDropdownPosition((prev) => {
      const unchanged =
        Math.abs(prev.top - nextTop) < 1 &&
        Math.abs(prev.left - nextLeft) < 1 &&
        Math.abs(prev.width - nextWidth) < 1;
      if (unchanged) return prev;
      return { top: nextTop, left: nextLeft, width: nextWidth };
    });
  }, []);

  const cargarPersonas = useCallback(async () => {
    setLoading(true);
    setListError("");
    const requestId = ++requestIdRef.current;
    listAbortRef.current?.abort();
    const controller = new AbortController();
    listAbortRef.current = controller;

    try {
      const response = await personaService.getPersonas({
        page,
        limit: pageSize,
        search: debouncedSearch,
        sort: sortBy,
        genero: generoFiltro,
        signal: controller.signal,
      });
      if (!mountedRef.current || requestId !== requestIdRef.current) return;

      const { items, total: totalResp } = normalizeListResponse(response);
      setPersonas(items);
      setTotal(totalResp);
      setListError("");
    } catch (error) {
      if (isAbortError(error)) return;
      if (!mountedRef.current) return;
      safeToast("ERROR", error.message || "No se pudo cargar personas", "danger");
      setPersonas([]);
      setTotal(0);
      setListError(error.message || "No se pudo cargar personas");
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [page, pageSize, debouncedSearch, generoFiltro, sortBy, safeToast]);

  const cargarKpiGlobales = useCallback(async () => {
    const requestId = ++globalKpiRequestIdRef.current;
    globalKpiAbortRef.current?.abort();
    const controller = new AbortController();
    globalKpiAbortRef.current = controller;

    try {
      const firstResponse = await personaService.getPersonas({
        page: 1,
        limit: 1,
        search: "",
        sort: "recientes",
        genero: "todos",
        signal: controller.signal,
      });

      if (!mountedRef.current || requestId !== globalKpiRequestIdRef.current) return;

      // Inspeccion explicita de shape para KPI global:
      // response.total | response.meta.total | response.pagination.total
      // response.stats | response.totals
      const statsFromResponse = extractGlobalStatsFromResponse(firstResponse);
      if (statsFromResponse) {
        setGlobalStats(statsFromResponse);
        return;
      }

      const firstBatch = normalizeListResponse(firstResponse);
      const explicitTotal = getResponseTotal(firstResponse);
      setGlobalStats(
        buildStatsFromPersonas(
          firstBatch.items,
          explicitTotal !== null ? explicitTotal : firstBatch.items.length
        )
      );
    } catch (error) {
      if (isAbortError(error)) return;
      if (!mountedRef.current || requestId !== globalKpiRequestIdRef.current) return;
      safeToast("ERROR", error.message || "No se pudieron cargar KPI globales", "danger");
    }
  }, [safeToast]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      listAbortRef.current?.abort();
      globalKpiAbortRef.current?.abort();
      suggestionsAbortRef.current?.abort();
      if (searchDropdownCloseTimerRef.current) {
        window.clearTimeout(searchDropdownCloseTimerRef.current);
        searchDropdownCloseTimerRef.current = null;
      }
      if (searchDropdownOpenFrameRef.current) {
        window.cancelAnimationFrame(searchDropdownOpenFrameRef.current);
        searchDropdownOpenFrameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (normalizeSearchText(search) !== debouncedSearch) return;
    cargarPersonas();
  }, [cargarPersonas, debouncedSearch, search]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      if (String(search ?? "").trim()) return;
      cargarKpiGlobales();
    }, 600);

    return () => window.clearTimeout(timerId);
  }, [cargarKpiGlobales, search]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      const nextSearch = normalizeSearchText(search);
      setDebouncedSearch((prev) => (prev === nextSearch ? prev : nextSearch));
    }, 300);

    return () => window.clearTimeout(timerId);
  }, [search]);

  const pushRecentSearch = useCallback((term) => {
    const normalized = normalizeSearchText(term);
    if (!normalized) return;
    setRecentSearches((prev) => {
      const next = appendRecentSearch(prev, normalized);
      persistRecentSearches(next);
      return next;
    });
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    setActiveSuggestionIndex(-1);
    persistRecentSearches([]);
  }, []);

  const removeRecentSearch = useCallback((term) => {
    const normalized = normalizeSearchText(term).toLowerCase();
    if (!normalized) return;
    setRecentSearches((prev) => {
      const next = (Array.isArray(prev) ? prev : []).filter(
        (item) => normalizeSearchText(item).toLowerCase() !== normalized
      );
      persistRecentSearches(next);
      return next;
    });
    setActiveSuggestionIndex(-1);
  }, []);

  const applySearchSuggestion = useCallback(
    (value) => {
      const normalized = normalizeSearchText(value);
      if (!normalized) return;
      setSearch(normalized);
      setDebouncedSearch((prev) => (prev === normalized ? prev : normalized));
      setPage((prev) => (prev === 1 ? prev : 1));
      setActiveSuggestionIndex(-1);
      setIsSearchFocused(false);
      pushRecentSearch(normalized);
      const input = findSearchInput();
      if (input && typeof input.blur === "function") input.blur();
    },
    [pushRecentSearch]
  );

  const handleSearchChange = useCallback((value) => {
    setSearch(value);
    setPage((prev) => (prev === 1 ? prev : 1));
    setActiveSuggestionIndex(-1);
  }, []);

  useEffect(() => {
    if (!debouncedSearch) return;
    pushRecentSearch(debouncedSearch);
  }, [debouncedSearch, pushRecentSearch]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const handleFocusIn = (event) => {
      const input = findSearchInput();
      if (!input) return;
      const dropdown = searchDropdownRef.current;
      const target = event.target;
      const focusOnInput = target === input;
      const focusInsideDropdown = Boolean(dropdown && dropdown.contains(target));

      if (focusOnInput || focusInsideDropdown) {
        setIsSearchFocused(true);
        return;
      }

      setIsSearchFocused(false);
      setActiveSuggestionIndex(-1);
    };

    const handleMouseDown = (event) => {
      const input = findSearchInput();
      const dropdown = searchDropdownRef.current;
      const target = event.target;
      const clickOnInput = Boolean(input && (target === input || input.contains(target)));
      const clickInsideDropdown = Boolean(dropdown && dropdown.contains(target));
      if (!clickOnInput && !clickInsideDropdown) {
        setIsSearchFocused(false);
        setActiveSuggestionIndex(-1);
      }
    };

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, []);

  useEffect(() => {
    const searchTerm = normalizeSearchText(search);
    suggestionsAbortRef.current?.abort();

    if (!isSearchFocused || searchTerm.length < MIN_CHARS_FOR_SUGGESTIONS) {
      setSuggestionsLoading(false);
      setSuggestions([]);
      setActiveSuggestionIndex(-1);
      return undefined;
    }

    const controller = new AbortController();
    suggestionsAbortRef.current = controller;
    const timerId = window.setTimeout(async () => {
      setSuggestionsLoading(true);
      try {
        const response = await personaService.getPersonaSuggestions({
          search: searchTerm,
          limit: MAX_RECENT_SEARCHES,
          genero: generoFiltro,
          sort: "relevancia",
          signal: controller.signal,
        });
        if (!mountedRef.current || controller.signal.aborted) return;
        setSuggestions(normalizeSuggestionItems(response));
      } catch (error) {
        if (isAbortError(error)) return;
        if (!mountedRef.current) return;
        setSuggestions([]);
      } finally {
        if (mountedRef.current && !controller.signal.aborted) {
          setSuggestionsLoading(false);
        }
      }
    }, 180);

    return () => {
      window.clearTimeout(timerId);
      controller.abort();
    };
  }, [generoFiltro, isSearchFocused, search]);

  const isPredictiveSearch = normalizeSearchText(search).length >= MIN_CHARS_FOR_SUGGESTIONS;
  const recentSearchSuggestionItems = useMemo(
    () =>
      recentSearches.map((value) => ({
        id: `recent-${value.toLowerCase()}`,
        value,
        label: value,
        detail: "Busqueda reciente",
      })),
    [recentSearches]
  );
  const searchSuggestionItems = useMemo(
    () => (isPredictiveSearch ? suggestions : recentSearchSuggestionItems),
    [isPredictiveSearch, suggestions, recentSearchSuggestionItems]
  );
  const shouldShowSearchSuggestions = useMemo(() => {
    if (!isSearchFocused) return false;
    if (isPredictiveSearch) return suggestionsLoading || searchSuggestionItems.length > 0;
    return searchSuggestionItems.length > 0;
  }, [isPredictiveSearch, isSearchFocused, searchSuggestionItems.length, suggestionsLoading]);

  useEffect(() => {
    if (shouldShowSearchSuggestions) {
      if (searchDropdownCloseTimerRef.current) {
        window.clearTimeout(searchDropdownCloseTimerRef.current);
        searchDropdownCloseTimerRef.current = null;
      }
      setIsSearchDropdownMounted(true);
      if (searchDropdownOpenFrameRef.current) {
        window.cancelAnimationFrame(searchDropdownOpenFrameRef.current);
      }
      searchDropdownOpenFrameRef.current = window.requestAnimationFrame(() => {
        setIsSearchDropdownVisible(true);
      });
      return undefined;
    }

    setIsSearchDropdownVisible(false);
    return undefined;
  }, [shouldShowSearchSuggestions]);

  useEffect(() => {
    if (!isSearchDropdownMounted || isSearchDropdownVisible) return undefined;

    searchDropdownCloseTimerRef.current = window.setTimeout(() => {
      setIsSearchDropdownMounted(false);
      searchDropdownCloseTimerRef.current = null;
    }, SEARCH_DROPDOWN_ANIMATION_MS);

    return () => {
      if (searchDropdownCloseTimerRef.current) {
        window.clearTimeout(searchDropdownCloseTimerRef.current);
        searchDropdownCloseTimerRef.current = null;
      }
    };
  }, [isSearchDropdownMounted, isSearchDropdownVisible]);

  const searchDropdownTitle = isPredictiveSearch ? "Sugerencias" : "Busquedas recientes";
  const searchDropdownStyle = useMemo(
    () => ({
      top: `${searchDropdownPosition.top}px`,
      left: `${searchDropdownPosition.left}px`,
      width: `${searchDropdownPosition.width}px`,
    }),
    [searchDropdownPosition.left, searchDropdownPosition.top, searchDropdownPosition.width]
  );

  useEffect(() => {
    if (!isSearchDropdownMounted) return undefined;

    syncSearchDropdownPosition();
    const handleLayoutChange = () => syncSearchDropdownPosition();

    window.addEventListener("resize", handleLayoutChange);
    window.addEventListener("scroll", handleLayoutChange, true);
    return () => {
      window.removeEventListener("resize", handleLayoutChange);
      window.removeEventListener("scroll", handleLayoutChange, true);
    };
  }, [isSearchDropdownMounted, syncSearchDropdownPosition, searchSuggestionItems.length, suggestionsLoading]);

  useEffect(() => {
    setActiveSuggestionIndex((prev) =>
      searchSuggestionItems.length === 0 ? -1 : Math.min(prev, searchSuggestionItems.length - 1)
    );
  }, [searchSuggestionItems.length]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const handleKeyDown = (event) => {
      if (!isSearchFocused || !shouldShowSearchSuggestions || !searchSuggestionItems.length) return;
      const input = findSearchInput();
      if (!input || document.activeElement !== input) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveSuggestionIndex((prev) =>
          prev < searchSuggestionItems.length - 1 ? prev + 1 : searchSuggestionItems.length - 1
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveSuggestionIndex((prev) => (prev > 0 ? prev - 1 : 0));
        return;
      }

      if (event.key === "Enter" && activeSuggestionIndex >= 0) {
        event.preventDefault();
        applySearchSuggestion(searchSuggestionItems[activeSuggestionIndex]?.value);
        return;
      }

      if (event.key === "Escape") {
        setIsSearchFocused(false);
        setActiveSuggestionIndex(-1);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    activeSuggestionIndex,
    applySearchSuggestion,
    isSearchFocused,
    searchSuggestionItems,
    shouldShowSearchSuggestions,
  ]);

  useEffect(() => {
    const onResize = () => setCardsPerPage(resolveCardsPerPage(window.innerWidth));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("personasViewMode", viewMode);
    } catch {
      // Keep working even if storage is unavailable.
    }
  }, [viewMode]);

  useLayoutEffect(() => {
    if (dniCaretRef.current === null) return;
    const input = dniInputRef.current;
    if (!input) return;

    const nextCaret = dniCaretRef.current;
    dniCaretRef.current = null;
    try {
      input.setSelectionRange(nextCaret, nextCaret);
    } catch {
      // Some browsers can throw when the input is not focusable.
    }
  }, [form.dni]);

  useLayoutEffect(() => {
    if (telefonoCaretRef.current === null) return;
    const input = telefonoInputRef.current;
    if (!input) return;

    const nextCaret = telefonoCaretRef.current;
    telefonoCaretRef.current = null;
    try {
      input.setSelectionRange(nextCaret, nextCaret);
    } catch {
      // Some browsers can throw when the input is not focusable.
    }
  }, [form.id_telefono]);

  const buildFormFromPersona = useCallback(
    (persona) => {
      const dniRaw = limit(digitsOnly(persona?.dni ?? ""), DNI_DIGITS_LENGTH);
      const telefonoRaw = limit(
        digitsOnly(persona?.telefono ?? persona?.telefono_numero ?? persona?.numero_telefono ?? ""),
        PHONE_DIGITS_LENGTH
      );
      return {
        nombre: persona?.nombre || "",
        apellido: persona?.apellido || "",
        dni: formatDNI(dniRaw),
        rtn: limit(digitsOnly(persona?.rtn ?? ""), 1),
        genero: persona?.genero || "",
        fecha_nacimiento: toDateInputValue(persona?.fecha_nacimiento),
        id_telefono: formatPhone(telefonoRaw),
        id_direccion: persona?.direccion ?? persona?.direccion_detalle ?? "",
        id_correo: persona?.direccion_correo ?? persona?.correo ?? persona?.email ?? "",
      };
    },
    []
  );

  const buildPersonaPayloadFromForm = useCallback(
    (sourceForm, personaBase = null) => {
      const textoTelefono =
        String(sourceForm?.id_telefono ?? "").trim() ||
        String(
          personaBase?.telefono ??
            personaBase?.telefono_numero ??
            personaBase?.numero_telefono ??
            ""
        ).trim();

      const textoDireccion =
        String(sourceForm?.id_direccion ?? "").trim() ||
        String(personaBase?.direccion ?? "").trim();

      const textoCorreo =
        String(sourceForm?.id_correo ?? "").trim() ||
        String(personaBase?.direccion_correo ?? personaBase?.correo ?? personaBase?.email ?? "").trim();

      return {
        nombre: sourceForm?.nombre ?? "",
        apellido: sourceForm?.apellido ?? "",
        fecha_nacimiento: sourceForm?.fecha_nacimiento ?? "",
        genero: sourceForm?.genero ?? "",
        dni: sourceForm?.dni ?? "",
        rtn: sourceForm?.rtn ?? "",
        texto_direccion: textoDireccion,
        texto_telefono: textoTelefono,
        texto_correo: textoCorreo,
      };
    },
    []
  );

  useEffect(() => {
    if (!showModal || !editId) return;
    const personaActual = personas.find((item) => String(item.id_persona) === String(editId));
    if (!personaActual) return;

    setForm((prev) => {
      const resolved = buildFormFromPersona(personaActual);
      const next = { ...prev };

      if (!prev.id_telefono && resolved.id_telefono) next.id_telefono = resolved.id_telefono;
      if (!prev.id_direccion && resolved.id_direccion) next.id_direccion = resolved.id_direccion;
      if (!prev.id_correo && resolved.id_correo) next.id_correo = resolved.id_correo;

      return next;
    });
  }, [showModal, editId, personas, buildFormFromPersona]);

  const validateField = useCallback((fieldName, value, _fullFormState = null) => {
    void _fullFormState;
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
        if (trimmedValue && !/^\d{1}$/.test(trimmedValue)) return "Debe ingresar solo el numero de complemento";
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
          return "Ingrese un correo v\u00e1lido con dominio (ej: usuario@dominio.com)";
        }
        return "";
      default:
        return "";
    }
  }, []);

  const setFieldErrorState = useCallback((fieldName, errorMessage) => {
    setErrors((prevErrors) => {
      const nextErrors = { ...prevErrors };
      if (errorMessage) nextErrors[fieldName] = errorMessage;
      else delete nextErrors[fieldName];
      return nextErrors;
    });
  }, []);

  const updateFieldValue = useCallback(
    (fieldName, nextValue, touchOnChange = true) => {
      const touchedKey = formFieldToTouchedKey[fieldName];
      const isTouched = touchedKey ? Boolean(touched[touchedKey]) : false;
      const shouldValidate = Boolean(touchedKey && (isTouched || touchOnChange));

      if (touchedKey && touchOnChange && !isTouched) {
        setTouched((prev) => ({ ...prev, [touchedKey]: true }));
      }

      setForm((prevForm) => {
        const nextForm =
          prevForm[fieldName] === nextValue ? prevForm : { ...prevForm, [fieldName]: nextValue };
        if (shouldValidate) {
          const fieldError = validateField(fieldName, nextValue, nextForm);
          setFieldErrorState(fieldName, fieldError);
        }
        return nextForm;
      });
    },
    [setFieldErrorState, touched, validateField]
  );

  const handleFieldBlur = useCallback(
    (fieldName) => () => {
      const touchedKey = formFieldToTouchedKey[fieldName];
      if (!touchedKey) return;
      setTouched((prev) => (prev[touchedKey] ? prev : { ...prev, [touchedKey]: true }));
      const fieldError = validateField(fieldName, form[fieldName], form);
      setFieldErrorState(fieldName, fieldError);
    },
    [form, setFieldErrorState, validateField]
  );

  const handleLettersFieldChange = (field) => (event) => {
    const normalized = capitalizeFirstOnly(lettersAndSpaces(event.target.value));
    updateFieldValue(field, normalized, true);
  };

  const handleDniChange = (event) => {
    const inputValue = event.target.value ?? "";
    const caretPosition = event.target.selectionStart ?? inputValue.length;
    const digitsBeforeCaret = digitsOnly(inputValue.slice(0, caretPosition)).length;
    const raw = limit(digitsOnly(inputValue), DNI_DIGITS_LENGTH);
    const formatted = formatDNI(raw);

    dniCaretRef.current = resolveCaretFromDigitIndex(
      formatted,
      Math.min(digitsBeforeCaret, raw.length)
    );

    updateFieldValue("dni", formatted, true);
  };

  const handleRtnChange = (event) => {
    const normalized = limit(digitsOnly(event.target.value), 1);
    updateFieldValue("rtn", normalized, true);
  };

  const handleTelefonoChange = (event) => {
    const inputValue = event.target.value ?? "";
    const caretPosition = event.target.selectionStart ?? inputValue.length;
    const digitsBeforeCaret = digitsOnly(inputValue.slice(0, caretPosition)).length;
    const raw = limit(digitsOnly(inputValue), PHONE_DIGITS_LENGTH);
    const formatted = formatPhone(raw);

    telefonoCaretRef.current = resolveCaretFromDigitIndex(
      formatted,
      Math.min(digitsBeforeCaret, raw.length)
    );

    updateFieldValue("id_telefono", formatted, true);
  };

  const blockInvalidNumericBeforeInput = useCallback((event, fieldName, maxDigits) => {
    const data = event?.nativeEvent?.data ?? event?.data;
    if (!data) return;
    if (/\D/.test(data)) {
      event.preventDefault();
      return;
    }
    const currentFormatted = String(form[fieldName] ?? "");
    const currentRaw = digitsOnly(currentFormatted);
    if (currentRaw.length >= maxDigits) {
      const input = event.currentTarget;
      const hasSelection =
        typeof input.selectionStart === "number" &&
        typeof input.selectionEnd === "number" &&
        input.selectionStart !== input.selectionEnd;
      if (!hasSelection) {
        event.preventDefault();
        return;
      }
    }

    const input = event.currentTarget;
    const selectionStart =
      typeof input.selectionStart === "number" ? input.selectionStart : currentFormatted.length;
    const selectionEnd =
      typeof input.selectionEnd === "number" ? input.selectionEnd : selectionStart;
    const rawStart = digitsOnly(currentFormatted.slice(0, selectionStart)).length;
    const rawEnd = digitsOnly(currentFormatted.slice(0, selectionEnd)).length;
    const nextLength = currentRaw.length - (rawEnd - rawStart) + digitsOnly(data).length;
    if (nextLength > maxDigits) event.preventDefault();
  }, [form]);

  const blockInvalidNumericKeyDown = useCallback((event, fieldName, maxDigits) => {
    if (event.ctrlKey || event.metaKey) {
      return;
    }
    if (ALLOWED_EDITING_KEYS.has(event.key)) return;
    if (event.key.length !== 1) return;
    if (!/\d/.test(event.key)) {
      event.preventDefault();
      return;
    }
    const input = event.currentTarget;
    const currentFormatted = String(form[fieldName] ?? "");
    const selectionStart =
      typeof input.selectionStart === "number" ? input.selectionStart : currentFormatted.length;
    const selectionEnd =
      typeof input.selectionEnd === "number" ? input.selectionEnd : selectionStart;
    const currentRaw = digitsOnly(currentFormatted);
    const rawStart = digitsOnly(currentFormatted.slice(0, selectionStart)).length;
    const rawEnd = digitsOnly(currentFormatted.slice(0, selectionEnd)).length;
    const nextLength = currentRaw.length - (rawEnd - rawStart) + 1;
    if (nextLength > maxDigits) event.preventDefault();
  }, [form]);

  const handleDniPaste = useCallback((event) => {
    event.preventDefault();
    const pasted = event.clipboardData?.getData("text") ?? "";
    const raw = limit(digitsOnly(pasted), DNI_DIGITS_LENGTH);
    dniCaretRef.current = formatDNI(raw).length;
    updateFieldValue("dni", formatDNI(raw), true);
  }, [updateFieldValue]);

  const handleTelefonoPaste = useCallback((event) => {
    event.preventDefault();
    const pasted = event.clipboardData?.getData("text") ?? "";
    const raw = limit(digitsOnly(pasted), PHONE_DIGITS_LENGTH);
    telefonoCaretRef.current = formatPhone(raw).length;
    updateFieldValue("id_telefono", formatPhone(raw), true);
  }, [updateFieldValue]);

  const sanitizeNumericPaste = useCallback(
    (event, fieldName, maxDigits, formatter = (value) => value) => {
      event.preventDefault();
      const pastedRaw = digitsOnly(event.clipboardData?.getData("text") ?? "");
      const currentFormatted = String(form[fieldName] ?? "");
      const input = event.target;
      const selectionStart =
        typeof input.selectionStart === "number" ? input.selectionStart : currentFormatted.length;
      const selectionEnd =
        typeof input.selectionEnd === "number" ? input.selectionEnd : selectionStart;
      const currentRaw = digitsOnly(currentFormatted);
      const rawStart = digitsOnly(currentFormatted.slice(0, selectionStart)).length;
      const rawEnd = digitsOnly(currentFormatted.slice(0, selectionEnd)).length;
      const mergedRaw = limit(
        `${currentRaw.slice(0, rawStart)}${pastedRaw}${currentRaw.slice(rawEnd)}`,
        maxDigits
      );
      updateFieldValue(fieldName, formatter(mergedRaw), true);
    },
    [form, updateFieldValue]
  );

  const blockInvalidLettersBeforeInput = useCallback((event) => {
    const data = event?.nativeEvent?.data ?? event?.data;
    if (!data) return;
    if (!LETTERS_INPUT_REGEX.test(data)) event.preventDefault();
  }, []);

  const sanitizeLettersPaste = useCallback(
    (event, fieldName) => {
      event.preventDefault();
      const pasted = String(event.clipboardData?.getData("text") ?? "");
      const current = String(form[fieldName] ?? "");
      const input = event.target;
      const selectionStart = typeof input.selectionStart === "number" ? input.selectionStart : current.length;
      const selectionEnd = typeof input.selectionEnd === "number" ? input.selectionEnd : selectionStart;
      const merged = `${current.slice(0, selectionStart)}${pasted}${current.slice(selectionEnd)}`;
      const normalized = capitalizeFirstOnly(lettersAndSpaces(merged));
      updateFieldValue(fieldName, normalized, true);
    },
    [form, updateFieldValue]
  );

  const validar = () => {
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
      const fieldError = validateField(fieldName, form[fieldName], form);
      if (fieldError) currentErrors[fieldName] = fieldError;
    });

    setTouched({
      nombre: true,
      apellido: true,
      dni: true,
      genero: true,
      fechaNacimiento: true,
      telefono: true,
      correo: true,
      rtn: true,
    });
    setErrors(currentErrors);
    return Object.keys(currentErrors).length === 0;
  };

  const closeDuplicateModal = useCallback(() => {
    setShowDuplicateModal(false);
    setDuplicateMessage(DUPLICATE_MODAL_DEFAULT_MESSAGE);
    setDuplicateFieldLabel("");
  }, []);

  const guardar = async (event) => {
    event.preventDefault();
    if (!validar() || actionLoading) return;

    setShowDuplicateModal(false);
    setDuplicateFieldLabel("");
    setDuplicateMessage(DUPLICATE_MODAL_DEFAULT_MESSAGE);
    setActionLoading(true);
    try {
      if (editId) {
        const personaOriginal = personas.find((item) => String(item.id_persona) === String(editId));
        if (!personaOriginal) {
          safeToast("ERROR", "No se encontro el registro a editar", "danger");
          await cargarPersonas();
          return;
        }

        const originalForm = buildFormFromPersona(personaOriginal);
        const changedFields = Object.keys(emptyForm).filter(
          (key) => String(form[key] ?? "") !== String(originalForm[key] ?? "")
        );

        if (!changedFields.length) {
          safeToast("INFO", "No hay cambios para guardar", "info");
        } else {
          const payload = buildPersonaPayloadFromForm(form, personaOriginal);
          await personaService.updatePersona(editId, payload);
          safeToast("OK", "Persona actualizada");
        }
      } else {
        const payload = buildPersonaPayloadFromForm(form);
        await personaService.createPersona(payload);
        safeToast("OK", "Persona creada");
      }

      closeFormDrawer();
      setEditId(null);
      setForm(emptyForm);
      setTouched(createInitialTouched());
      await cargarPersonas();
      await cargarKpiGlobales();
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const resolvedFieldLabel = resolveDuplicateFieldLabel(error);
        setDuplicateFieldLabel(resolvedFieldLabel);
        setDuplicateMessage(DUPLICATE_MODAL_DEFAULT_MESSAGE);
        setShowDuplicateModal(true);
        return;
      }
      const campo = error?.campo ? ` (${error.campo})` : "";
      safeToast("ERROR", `${error.message || "No se pudo guardar"}${campo}`, "danger");
    } finally {
      if (mountedRef.current) setActionLoading(false);
    }
  };

  const iniciarEdicion = useCallback((persona) => {
    setFiltersOpen(false);
    closeDuplicateModal();
    setEditId(persona.id_persona);
    setErrors({});
    setTouched(createInitialTouched());
    setForm(buildFormFromPersona(persona));
    setShowModal(true);
  }, [buildFormFromPersona, closeDuplicateModal]);

  const openCreate = useCallback(() => {
    setFiltersOpen(false);
    closeDuplicateModal();
    setEditId(null);
    setErrors({});
    setTouched(createInitialTouched());
    setForm(emptyForm);
    setShowModal(true);
  }, [closeDuplicateModal]);

  const openConfirmDelete = useCallback((persona) => {
    const nombre = `${persona?.nombre || ""} ${persona?.apellido || ""}`.trim();
    setConfirmModal({ show: true, idToDelete: persona?.id_persona ?? null, nombre: nombre || "Persona seleccionada" });
  }, []);

  const closeConfirmDelete = useCallback(
    () => setConfirmModal({ show: false, idToDelete: null, nombre: "" }),
    []
  );

  const eliminarConfirmado = useCallback(async () => {
    const id = confirmModal.idToDelete;
    if (!id || actionLoading || deletingId) return;

    setDeletingId(id);
    try {
      await personaService.eliminarPersona(id);

      if (String(editId) === String(id)) {
        closeFormDrawer();
        setEditId(null);
        setForm(emptyForm);
      }

      const quedaVaciaPagina = personas.length === 1 && page > 1;
      if (quedaVaciaPagina) {
        setPage((prev) => Math.max(1, prev - 1));
      } else {
        await cargarPersonas();
      }
      await cargarKpiGlobales();

      safeToast("OK", "Persona eliminada");
      closeConfirmDelete();
    } catch (error) {
      safeToast("ERROR", error.message || "No se pudo eliminar", "danger");
      await cargarPersonas();
    } finally {
      if (mountedRef.current) setDeletingId(null);
    }
  }, [
    actionLoading,
    cargarKpiGlobales,
    cargarPersonas,
    closeConfirmDelete,
    closeFormDrawer,
    deletingId,
    editId,
    page,
    personas.length,
    confirmModal.idToDelete,
    safeToast,
  ]);

  const useGlobalFilterData = false;
  const personasFuente = useMemo(() => personas, [personas]);
  const isListLoading = loading;
  const isListInitialLoading = loading && personasFuente.length === 0;
  const isListRefreshing = loading && personasFuente.length > 0;

  const personasFiltradas = useMemo(() => {
    return Array.isArray(personasFuente) ? personasFuente : [];
  }, [personasFuente]);

  const totalPages = useMemo(() => {
    if (!useGlobalFilterData) return backendTotalPages;
    return Math.max(1, Math.ceil(personasFiltradas.length / pageSize));
  }, [useGlobalFilterData, backendTotalPages, personasFiltradas.length, pageSize]);

  const personasRenderizadas = useMemo(() => {
    if (!useGlobalFilterData) return personasFiltradas;
    const start = (page - 1) * pageSize;
    return personasFiltradas.slice(start, start + pageSize);
  }, [useGlobalFilterData, personasFiltradas, page, pageSize]);

  useEffect(() => {
    if (page <= totalPages) return;
    setPage(totalPages);
  }, [page, totalPages]);

  const hasActiveFilters = useMemo(
    () => search.trim() !== "" || generoFiltro !== "todos" || sortBy !== "recientes",
    [search, generoFiltro, sortBy]
  );

  const colsClass = useMemo(
    () => (cardsPerPage >= 6 ? "cols-3" : cardsPerPage >= 4 ? "cols-2" : "cols-1"),
    [cardsPerPage]
  );
  const statsCards = useMemo(
    () => [
      {
        key: "total-personas",
        iconClass: "bi-people",
        label: "Total de personas",
        value: globalStats.total,
        accent: "default",
      },
      {
        key: "femenino",
        iconClass: "bi-gender-female",
        label: "Femenino",
        value: globalStats.femenino ?? 0,
        accent: "info",
      },
      {
        key: "masculino",
        iconClass: "bi-gender-male",
        label: "Masculino",
        value: globalStats.masculino ?? 0,
        accent: "accent",
      },
    ],
    [globalStats.femenino, globalStats.masculino, globalStats.total]
  );

  const openFiltersDrawer = useCallback(() => {
    if (actionLoading) return;
    closeFormDrawer();
    setFiltersDraft({ generoFiltro, sortBy });
    setFiltersOpen(true);
  }, [actionLoading, closeFormDrawer, generoFiltro, sortBy]);

  const focusFiltersTrigger = useCallback(() => {
    if (typeof document === "undefined") return;
    const trigger = document.querySelector('button[aria-controls="per-filtros-drawer"]');
    if (trigger && typeof trigger.focus === "function") trigger.focus();
  }, []);

  const closeFiltersDrawer = useCallback(() => {
    blurFocusedElementInside("per-filtros-drawer");
    setFiltersOpen(false);
    if (typeof window !== "undefined") {
      window.setTimeout(focusFiltersTrigger, 0);
    }
  }, [blurFocusedElementInside, focusFiltersTrigger]);

  const applyFiltersDrawer = useCallback(() => {
    setGeneroFiltro(filtersDraft.generoFiltro || "todos");
    setSortBy(filtersDraft.sortBy || "recientes");
    setPage((prev) => (prev === 1 ? prev : 1));
    closeFiltersDrawer();
  }, [closeFiltersDrawer, filtersDraft.generoFiltro, filtersDraft.sortBy]);

  const clearVisualFilters = useCallback(() => {
    setGeneroFiltro("todos");
    setSortBy("recientes");
    setFiltersDraft(createInitialFiltersDraft());
    setPage((prev) => (prev === 1 ? prev : 1));
  }, []);

  const clearAllFilters = useCallback(() => {
    setSearch("");
    clearVisualFilters();
    setFiltersOpen(false);
    setSuggestions([]);
    setActiveSuggestionIndex(-1);
  }, [clearVisualFilters]);

  const closeAnyDrawer = useCallback(() => {
    if (actionLoading) return;
    closeFormDrawer();
    blurFocusedElementInside("per-filtros-drawer");
    setFiltersOpen(false);
  }, [actionLoading, blurFocusedElementInside, closeFormDrawer]);

  const retryListLoad = useCallback(() => {
    cargarPersonas();
  }, [cargarPersonas]);

  return (
    <div className="personas-page">
      <div className="inv-catpro-card inv-prod-card personas-page__panel mb-3" ref={panelRef}>
        <HeaderPersonas
          search={search}
          onSearchChange={handleSearchChange}
          filtersOpen={filtersOpen}
          onOpenFilters={openFiltersDrawer}
          drawerOpen={showModal}
          onOpenCreate={openCreate}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {isSearchDropdownMounted ? (
          <div
            className={`personas-search-dropdown ${
              isSearchDropdownVisible ? "is-open" : "is-closing"
            }`}
            ref={searchDropdownRef}
            role="listbox"
            aria-label="Sugerencias de busqueda"
            style={searchDropdownStyle}
          >
            <div className="personas-search-dropdown__header">
              <div className="personas-search-dropdown__title">
                <span className="personas-search-dropdown__title-icon" aria-hidden="true">
                  <i className="bi bi-search" />
                </span>
                <span>{searchDropdownTitle}</span>
              </div>
              {!isPredictiveSearch && recentSearches.length ? (
                <button
                  type="button"
                  className="personas-search-dropdown__clear-btn"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={clearRecentSearches}
                >
                  Limpiar
                </button>
              ) : null}
            </div>

            <div className="personas-search-dropdown__list" role="presentation">
              {suggestionsLoading && isPredictiveSearch ? (
                <div className="personas-search-dropdown__empty">
                  <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                  <span>Buscando sugerencias...</span>
                </div>
              ) : null}

              {searchSuggestionItems.map((suggestion, idx) => {
                const isActive = idx === activeSuggestionIndex;
                const detailText = suggestion.detail || (isPredictiveSearch ? "Sugerencia de busqueda" : "Busqueda reciente");
                return (
                  <div
                    key={suggestion.id ?? `${suggestion.value}-${idx}`}
                    className={`personas-search-dropdown__item ${isActive ? "is-active" : ""}`}
                    style={{ "--item-delay": `${Math.min(idx * 26, 120)}ms` }}
                  >
                    <button
                      type="button"
                      className="personas-search-dropdown__item-main"
                      aria-selected={isActive}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => applySearchSuggestion(suggestion.value)}
                    >
                      <span className="personas-search-dropdown__item-icon" aria-hidden="true">
                        <i className="bi bi-search" />
                      </span>
                      <span className="personas-search-dropdown__item-copy">
                        <span className="personas-search-dropdown__item-title">{suggestion.label}</span>
                        <span className="personas-search-dropdown__item-subtitle">{detailText}</span>
                      </span>
                    </button>

                    {!isPredictiveSearch ? (
                      <button
                        type="button"
                        className="personas-search-dropdown__item-remove"
                        aria-label={`Eliminar busqueda reciente ${suggestion.label}`}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={(event) => {
                          event.stopPropagation();
                          removeRecentSearch(suggestion.value);
                        }}
                      >
                        <i className="bi bi-x-lg" />
                      </button>
                    ) : null}
                  </div>
                );
              })}

              {!suggestionsLoading && isPredictiveSearch && searchSuggestionItems.length === 0 ? (
                <div className="personas-search-dropdown__empty">Sin sugerencias para "{search.trim()}"</div>
              ) : null}
            </div>
          </div>
        ) : null}

        <StatsCardsRow cards={statsCards} ariaLabel="Resumen de personas" />

        <div className="inv-catpro-body inv-prod-body p-3">
          <div className="inv-prod-results-meta personas-page__results-meta">
            <span>{isListInitialLoading ? "Cargando personas..." : `${personasFiltradas.length} resultados`}</span>
            <span>{isListInitialLoading ? "" : `Total: ${useGlobalFilterData ? personasFuente.length : total}`}</span>
            {isListRefreshing ? <span className="text-muted">Actualizando...</span> : null}
            {hasActiveFilters ? <span className="inv-prod-active-filter-pill">Filtros activos</span> : null}
          </div>

          <div className={`inv-catpro-list ${isAnyDrawerOpen ? "drawer-open" : ""}`}>
            {isListInitialLoading ? (
              <div className="inv-catpro-loading" role="status" aria-live="polite">
                <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                <span>Cargando personas...</span>
              </div>
            ) : listError ? (
              <div className="alert alert-danger d-flex flex-wrap align-items-center justify-content-between gap-2 mb-0" role="alert">
                <span>{listError}</span>
                <button type="button" className="btn btn-sm btn-outline-danger" onClick={retryListLoad}>
                  Reintentar
                </button>
              </div>
            ) : personasFiltradas.length === 0 ? (
              <div className="inv-catpro-empty">
                <div className="inv-catpro-empty-icon">
                  <i className="bi bi-people" />
                </div>
                <div className="inv-catpro-empty-title">No hay personas para mostrar</div>
                <div className="inv-catpro-empty-sub">
                  {hasActiveFilters ? "Prueba limpiar filtros o crear una nueva persona." : "Crea tu primera persona."}
                </div>

                <div className="d-flex gap-2 justify-content-center flex-wrap">
                  {hasActiveFilters ? (
                    <button type="button" className="btn btn-outline-secondary" onClick={clearAllFilters}>
                      Limpiar filtros
                    </button>
                  ) : null}
                  <button type="button" className="btn btn-primary" onClick={openCreate}>
                    Nueva persona
                  </button>
                </div>
              </div>
            ) : viewMode === "table" ? (
              <EntityTable>
                <table className="table personas-page__table">
                  <thead>
                    <tr>
                      <th scope="col">Persona</th>
                      <th scope="col">DNI</th>
                      <th scope="col">RTN</th>
                      <th scope="col">Direccion</th>
                      <th scope="col">Telefono</th>
                      <th scope="col">Correo</th>
                      <th scope="col">Fecha nacimiento</th>
                      <th scope="col">Genero</th>
                      <th scope="col">Codigo</th>
                      <th scope="col" className="text-end">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {personasRenderizadas.map((persona, idx) => {
                      const isActive = isPersonaActiva(persona);
                      const dotClass = isActive ? "ok" : "off";
                      const idPersona = persona?.id_persona;
                      const deleting = deletingId === idPersona;
                      const tableIndex = (useGlobalFilterData ? (page - 1) * pageSize : 0) + idx;
                      const nombreCompleto = `${persona?.nombre || ""} ${persona?.apellido || ""}`.trim() || "Persona sin nombre";
                      const telefono = persona?.telefono ?? persona?.telefono_numero ?? persona?.numero_telefono;
                      const direccion = persona?.direccion ?? persona?.direccion_detalle;
                      const correo = persona?.direccion_correo ?? persona?.correo ?? persona?.email;
                      const rtn = getPersonaRtn(persona);
                      const genero = formatGeneroCard(getPersonaGeneroRaw(persona));

                      return (
                        <tr key={persona?.id_persona ?? idx} className={isActive ? "" : "is-inactive-state"}>
                          <td>
                            <strong>{tableIndex + 1}. {nombreCompleto}</strong>
                          </td>
                          <td>{toDisplayCardValue(persona?.dni)}</td>
                          <td>{toDisplayCardValue(rtn, "\u2014")}</td>
                          <td>{toDisplayCardValue(direccion, "No disponible")}</td>
                          <td>{toDisplayCardValue(telefono, "No disponible")}</td>
                          <td>{toDisplayCardValue(correo, "No disponible")}</td>
                          <td>{formatFechaNacimientoCard(persona?.fecha_nacimiento)}</td>
                          <td>{toDisplayCardValue(genero, "\u2014")}</td>
                          <td>
                            <div className="inv-catpro-code-wrap personas-page__table-code-wrap">
                              <span className={`inv-catpro-state-dot ${dotClass}`} />
                              <span className="inv-catpro-code">PER-{String(idPersona ?? "-")}</span>
                            </div>
                          </td>
                          <td className="text-end">
                            <div className="personas-page__table-actions">
                              <button
                                type="button"
                                className="inv-catpro-action edit inv-catpro-action-compact"
                                onClick={() => iniciarEdicion(persona)}
                                title="Editar"
                                disabled={actionLoading || deleting}
                              >
                                <i className="bi bi-pencil-square" />
                                <span className="inv-catpro-action-label">Editar</span>
                              </button>

                              <button
                                type="button"
                                className="inv-catpro-action danger inv-catpro-action-compact"
                                onClick={() => openConfirmDelete(persona)}
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
                {personasRenderizadas.map((persona, idx) => {
                  const isActive = isPersonaActiva(persona);
                  const dotClass = isActive ? "ok" : "off";
                  const idPersona = persona?.id_persona;
                  const deleting = deletingId === idPersona;
                  const cardIndex = (useGlobalFilterData ? (page - 1) * pageSize : 0) + idx;
                  const nombreCompleto = `${persona?.nombre || ""} ${persona?.apellido || ""}`.trim() || "Persona sin nombre";
                  const telefono = persona?.telefono ?? persona?.telefono_numero ?? persona?.numero_telefono;
                  const direccion = persona?.direccion ?? persona?.direccion_detalle;
                  const correo = persona?.direccion_correo ?? persona?.correo ?? persona?.email;
                  const rtn = getPersonaRtn(persona);
                  const genero = formatGeneroCard(getPersonaGeneroRaw(persona));

                  return (
                    <div
                      key={persona?.id_persona ?? idx}
                      className={`inv-catpro-item inv-cat-card inv-anim-in ${isActive ? "" : "is-inactive-state"}`}
                      style={{ animationDelay: `${Math.min(idx * 40, 240)}ms` }}
                    >
                      <div className="inv-cat-card__halo" aria-hidden="true">
                        <i className="bi bi-people" />
                      </div>

                      <div className="inv-catpro-item-top">
                        <div className="inv-cat-card__title-wrap">
                          <span className="inv-cat-card__icon" aria-hidden="true">
                            <i className="bi bi-person-vcard" />
                          </span>
                          <div>
                            <div className="fw-bold">
                              {cardIndex + 1}. {nombreCompleto}
                            </div>
                            <div className="text-muted small">DNI: {toDisplayCardValue(persona?.dni)}</div>
                          </div>
                        </div>
                      </div>

                      <div className="personas-page__card-details">
                        <div className="personas-page__card-row">
                          <i className="bi bi-file-earmark-text" />
                          <span>RTN: {toDisplayCardValue(rtn, "\u2014")}</span>
                        </div>
                        <div className="personas-page__card-row">
                          <i className="bi bi-geo-alt" />
                          <span>{toDisplayCardValue(direccion, "No disponible")}</span>
                        </div>
                        <div className="personas-page__card-row">
                          <i className="bi bi-telephone" />
                          <span>{toDisplayCardValue(telefono, "No disponible")}</span>
                        </div>
                        <div className="personas-page__card-row">
                          <i className="bi bi-envelope" />
                          <span>{toDisplayCardValue(correo, "No disponible")}</span>
                        </div>
                        <div className="personas-page__card-row">
                          <i className="bi bi-calendar-event" />
                          <span>{formatFechaNacimientoCard(persona?.fecha_nacimiento)}</span>
                        </div>
                        {genero ? (
                          <div className="personas-page__card-row">
                            <i className="bi bi-gender-ambiguous" />
                            <span>{genero}</span>
                          </div>
                        ) : null}
                      </div>

                      <div className="inv-catpro-meta inv-catpro-item-footer">
                        <div className="inv-catpro-code-wrap">
                          <span className={`inv-catpro-state-dot ${dotClass}`} />
                          <span className="inv-catpro-code">PER-{String(idPersona ?? "-")}</span>
                        </div>

                        <div className="inv-catpro-meta-actions inv-catpro-action-bar inv-cat-card__actions">
                          <button
                            type="button"
                            className="inv-catpro-action edit inv-catpro-action-compact"
                            onClick={() => iniciarEdicion(persona)}
                            title="Editar"
                            disabled={actionLoading || deleting}
                          >
                            <i className="bi bi-pencil-square" />
                            <span className="inv-catpro-action-label">Editar</span>
                          </button>

                          <button
                            type="button"
                            className="inv-catpro-action danger inv-catpro-action-compact"
                            onClick={() => openConfirmDelete(persona)}
                            title="Eliminar"
                            disabled={actionLoading || deleting}
                          >
                            <i className={`bi ${deleting ? "bi-hourglass-split" : "bi-trash"}`} />
                            <span className="inv-catpro-action-label">{deleting ? "Eliminando..." : "Eliminar"}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="personas-page__pagination">
            <button
              type="button"
              className="btn btn-outline-secondary"
              disabled={page === 1 || isListLoading || actionLoading || !!deletingId}
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
              disabled={page >= totalPages || isListLoading || actionLoading || !!deletingId}
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
        title="Nueva"
        aria-label="Nueva persona"
      >
        <i className="bi bi-plus" />
      </button>

      <div
        className={`inv-prod-drawer-backdrop inv-cat-v2__drawer-backdrop ${isAnyDrawerOpen ? "show" : ""}`}
        onClick={closeAnyDrawer}
        aria-hidden={!isAnyDrawerOpen}
      />

      <Filtros
        open={filtersOpen}
        draft={filtersDraft}
        onChangeDraft={setFiltersDraft}
        onClose={closeFiltersDrawer}
        onApply={applyFiltersDrawer}
        onClear={clearVisualFilters}
      />

      <aside
        className={`inv-prod-drawer inv-cat-v2__drawer crud-modal personas-modal ${showModal ? "show" : ""} ${
          editId ? "is-edit" : "is-create"
        }`}
        id="per-form-drawer"
        role="dialog"
        aria-modal="true"
        aria-hidden={!showModal}
      >
        <div className="inv-prod-drawer-head crud-modal__header">
          <div className="crud-modal__header-copy">
            <div className="inv-prod-drawer-title crud-modal__title">{editId ? "Editar persona" : "Nueva persona"}</div>
            <div className="inv-prod-drawer-sub crud-modal__subtitle">Completa los campos y guarda los cambios.</div>
          </div>
          <button
            type="button"
            className="inv-prod-drawer-close crud-modal__close"
            onClick={closeFormDrawer}
            title="Cerrar"
            aria-label="Cerrar formulario"
            disabled={actionLoading}
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <form className="inv-prod-drawer-body inv-catpro-drawer-body-lite crud-modal__body" onSubmit={guardar}>
          <div className="row g-3 crud-modal__grid">
            <div className="col-12 col-md-6">
              <label className="form-label" style={{ color: "#000" }}>Nombre</label>
              <input
                className={`form-control ${touched.nombre && errors.nombre ? "is-invalid" : ""}`}
                style={{ color: "#000" }}
                placeholder="Ej: Maria"
                value={form.nombre}
                onChange={handleLettersFieldChange("nombre")}
                onBeforeInput={blockInvalidLettersBeforeInput}
                onPaste={(event) => sanitizeLettersPaste(event, "nombre")}
                onBlur={handleFieldBlur("nombre")}
              />
              {touched.nombre && errors.nombre && <div className="invalid-feedback d-block">{errors.nombre}</div>}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label" style={{ color: "#000" }}>Apellido</label>
              <input
                className={`form-control ${touched.apellido && errors.apellido ? "is-invalid" : ""}`}
                style={{ color: "#000" }}
                placeholder="Ej: Rodriguez"
                value={form.apellido}
                onChange={handleLettersFieldChange("apellido")}
                onBeforeInput={blockInvalidLettersBeforeInput}
                onPaste={(event) => sanitizeLettersPaste(event, "apellido")}
                onBlur={handleFieldBlur("apellido")}
              />
              {touched.apellido && errors.apellido && <div className="invalid-feedback d-block">{errors.apellido}</div>}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label" style={{ color: "#000" }}>DNI</label>
              <input
                ref={dniInputRef}
                type="text"
                className={`form-control ${touched.dni && errors.dni ? "is-invalid" : ""}`}
                style={{ color: "#000" }}
                placeholder="0000-0000-00000"
                inputMode="numeric"
                autoComplete="off"
                maxLength={DNI_DISPLAY_MAX_LENGTH}
                value={form.dni}
                onChange={handleDniChange}
                onBeforeInput={(event) => blockInvalidNumericBeforeInput(event, "dni", DNI_DIGITS_LENGTH)}
                onKeyDown={(event) => blockInvalidNumericKeyDown(event, "dni", DNI_DIGITS_LENGTH)}
                onPaste={handleDniPaste}
                onBlur={handleFieldBlur("dni")}
              />
              {touched.dni && errors.dni && <div className="invalid-feedback d-block">{errors.dni}</div>}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label" style={{ color: "#000" }}>RTN</label>
              <input
                className={`form-control ${touched.rtn && errors.rtn ? "is-invalid" : ""}`}
                style={{ color: "#000" }}
                placeholder="9"
                maxLength={1}
                inputMode="numeric"
                pattern="\d*"
                value={form.rtn}
                onChange={handleRtnChange}
                onBeforeInput={(event) => blockInvalidNumericBeforeInput(event, "rtn", 1)}
                onKeyDown={(event) => blockInvalidNumericKeyDown(event, "rtn", 1)}
                onPaste={(event) => sanitizeNumericPaste(event, "rtn", 1)}
                onBlur={handleFieldBlur("rtn")}
              />
              {touched.rtn && errors.rtn && <div className="invalid-feedback d-block">{errors.rtn}</div>}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label" style={{ color: "#000" }}>Genero</label>
              <select
                className={`form-select ${touched.genero && errors.genero ? "is-invalid" : ""}`}
                style={{ color: "#000" }}
                value={form.genero}
                onChange={(event) => updateFieldValue("genero", event.target.value, true)}
                onBlur={handleFieldBlur("genero")}
              >
                <option value="">Seleccione</option>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
              </select>
              {touched.genero && errors.genero && <div className="invalid-feedback d-block">{errors.genero}</div>}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label" style={{ color: "#000" }}>Fecha nacimiento</label>
              <input
                type="date"
                className={`form-control ${touched.fechaNacimiento && errors.fecha_nacimiento ? "is-invalid" : ""}`}
                style={{ color: "#000" }}
                value={form.fecha_nacimiento}
                onChange={(event) => updateFieldValue("fecha_nacimiento", event.target.value, true)}
                onBlur={handleFieldBlur("fecha_nacimiento")}
              />
              {touched.fechaNacimiento && errors.fecha_nacimiento && <div className="invalid-feedback d-block">{errors.fecha_nacimiento}</div>}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label" style={{ color: "#000" }}>Telefono</label>
              <input
                ref={telefonoInputRef}
                type="text"
                className={`form-control ${touched.telefono && errors.id_telefono ? "is-invalid" : ""}`}
                style={{ color: "#000" }}
                placeholder="0000-0000"
                inputMode="numeric"
                autoComplete="tel"
                maxLength={PHONE_DISPLAY_MAX_LENGTH}
                value={form.id_telefono}
                onChange={handleTelefonoChange}
                onBeforeInput={(event) => blockInvalidNumericBeforeInput(event, "id_telefono", PHONE_DIGITS_LENGTH)}
                onKeyDown={(event) => blockInvalidNumericKeyDown(event, "id_telefono", PHONE_DIGITS_LENGTH)}
                onPaste={handleTelefonoPaste}
                onBlur={handleFieldBlur("id_telefono")}
              />
              {touched.telefono && errors.id_telefono && <div className="invalid-feedback d-block">{errors.id_telefono}</div>}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label" style={{ color: "#000" }}>Direccion</label>
              <input
                type="text"
                className={`form-control ${errors.id_direccion ? "is-invalid" : ""}`}
                style={{ color: "#000" }}
                placeholder="Ej: Lomas de Santa Lucia"
                value={form.id_direccion}
                onChange={(event) => setForm((state) => ({ ...state, id_direccion: event.target.value }))}
              />
              {errors.id_direccion && <div className="invalid-feedback d-block">{errors.id_direccion}</div>}
            </div>

            <div className="col-12">
              <label className="form-label" style={{ color: "#000" }}>Correo</label>
              <input
                type="text"
                className={`form-control ${touched.correo && errors.id_correo ? "is-invalid" : ""}`}
                style={{ color: "#000" }}
                placeholder="ejemplo@correo.com"
                value={form.id_correo}
                onChange={(event) => updateFieldValue("id_correo", event.target.value, true)}
                onBlur={handleFieldBlur("id_correo")}
              />
              {touched.correo && errors.id_correo && <div className="invalid-feedback d-block">{errors.id_correo}</div>}
            </div>
          </div>

          <div className="d-flex gap-2 mt-4 crud-modal__footer">
            <button type="button" className="btn inv-prod-btn-subtle flex-fill crud-modal__btn" onClick={closeFormDrawer} disabled={actionLoading}>
              Cancelar
            </button>
            <button type="submit" className="btn inv-prod-btn-primary flex-fill crud-modal__btn" disabled={actionLoading || !!deletingId}>
              {actionLoading ? "Guardando..." : editId ? "Guardar" : "Crear"}
            </button>
          </div>
        </form>
      </aside>

      <PersonasActionModal
        show={confirmModal.show}
        onClose={closeConfirmDelete}
        title="Confirmar eliminacion"
        subtitle="Esta accion es permanente"
        question="Deseas eliminar esta persona?"
        detail={confirmModal.nombre || "Persona seleccionada"}
        detailIconClass="bi bi-person-vcard"
        cancelText="Cancelar"
        confirmText="Eliminar"
        onConfirm={eliminarConfirmado}
        confirmButtonClass="btn inv-pro-btn-danger"
        confirmIconClass="bi bi-trash3"
      />

      <PersonasActionModal
        show={showDuplicateModal}
        onClose={closeDuplicateModal}
        title="No se pudo guardar"
        subtitle="Revisa los datos e intenta nuevamente"
        question={duplicateMessage}
        detail={duplicateFieldLabel ? `Campo duplicado: ${duplicateFieldLabel}` : ""}
        detailIconClass="bi bi-exclamation-circle"
        confirmText="Entendido"
        onConfirm={closeDuplicateModal}
        confirmButtonClass="btn inv-pro-btn-danger"
        confirmIconClass="bi bi-check2-circle"
        hideCancel
      />
    </div>
  );
}
