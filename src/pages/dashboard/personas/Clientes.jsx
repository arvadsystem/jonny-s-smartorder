import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Select from "react-select";
import AsyncSelect from "react-select/async";
import { personaService } from "../../../services/personasService";
import { parametrosService } from "../../../services/parametrosService";
import EntityTable from "../../../components/ui/EntityTable";
import HeaderModulo from "./components/common/HeaderModulo";
import ModuleFiltros from "./components/common/ModuleFiltros";
import ModuleKPICards from "./components/common/ModuleKPICards";
import ClienteCard from "./components/clientes/ClienteCard";
import SearchSuggestionsDropdown from "./components/common/SearchSuggestionsDropdown";
import useSearchSuggestionsDropdown, {
  MIN_CHARS_FOR_SUGGESTIONS,
  normalizeSearchText,
} from "./components/common/useSearchSuggestionsDropdown";
import { buildPageRangeLabel, buildVisiblePageNumbers } from "./components/common/paginationWindow";
import SmartSelectEntity from "./components/common/SmartSelectEntity";
import PersonaInlineCreateModal from "./components/common/PersonaInlineCreateModal";
import EmpresaInlineCreateModal from "./components/common/EmpresaInlineCreateModal";
import {
  buildPersonaPayloadFromForm,
  createInitialPersonaForm,
  normalizePersonaFormValues,
  validatePersonaForm,
} from "./components/common/persona-form-shared";
import {
  buildEmpresaPayloadFromForm,
  createInitialEmpresaForm,
  normalizeEmpresaFormValues,
  validateEmpresaForm,
} from "./components/common/empresa-form-shared";
import "./components/common/crud-modal-theme.css";
import "./components/clientes/clientes-persona-select.css";

const emptyForm = {
  id_persona: "",
  id_empresa: "",
  id_tipo_cliente: "",
  fecha_ingreso: "",
  puntos: "",
  estado: true,
};

const emptyInlinePersonaForm = createInitialPersonaForm();

const emptyInlineEmpresaForm = createInitialEmpresaForm();

const createEmptyDuplicateResolution = () => ({
  visible: false,
  origin: null,
  message: "",
  suggestedId: null,
  suggestedLabel: "",
  requestPayload: null,
});

const createInitialFiltersDraft = () => ({
  estadoFiltro: "activo",
  sortBy: "recientes",
});

const buildClientesSelectStyles = (hasError = false) => ({
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
    (resp && (resp.items || resp.data || resp.rows || resp.resultados || resp.clientes)) || [];
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

const normalizeValue = (value) => String(value ?? "").trim().toLowerCase();
const normalizeSearchKey = (value) => String(value ?? "").trim().toLowerCase();

const ASYNC_SELECT_LIMIT = 80;
const ASYNC_SELECT_DEBOUNCE_MS = 300;
const SUGGESTION_LIMIT = 8;
const MAX_CLIENTES_PAGE_CACHE = 24;
const GLOBAL_STATS_FETCH_LIMIT = 1;
const PERSONAS_CATALOGO_PAGE_LIMIT = 200;
const PERSONAS_CATALOGO_MAX_PAGES = 200;

const isAbortError = (error) =>
  Boolean(error) && (
    error.name === "AbortError" ||
    error.code === "ABORT_ERR" ||
    String(error.message || "").toLowerCase().includes("aborted")
  );

const filterAsyncOptions = (options, needle, limit = ASYNC_SELECT_LIMIT) => {
  const normalizedNeedle = normalizeSearchKey(needle);
  const source = Array.isArray(options) ? options : [];
  const filtered = normalizedNeedle
    ? source.filter((option) =>
      String(option?.searchText || option?.label || "")
        .toLowerCase()
        .includes(normalizedNeedle)
    )
    : source;

  return filtered.slice(0, limit);
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

const firstNonEmptyValue = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
};

const resolveDuplicateBaseFromError = (error, origin) => {
  const status = Number(error?.status);
  const code = String(error?.code || error?.data?.code || "").trim().toUpperCase();
  if (status !== 409 || code !== "DUPLICATE_BASE") return null;

  const details =
    error?.data && typeof error.data === "object" && error.data.details && typeof error.data.details === "object"
      ? error.data.details
      : null;
  const suggestedRelation =
    details && details.suggested_relation && typeof details.suggested_relation === "object"
      ? details.suggested_relation
      : details;

  const suggestedId =
    origin === "empresa"
      ? extractPositiveIdFromAny(suggestedRelation, ["id_empresa_cliente", "id_empresa"])
      : extractPositiveIdFromAny(suggestedRelation, ["id_persona"]);
  if (!suggestedId) return null;

  const base = details && details.base && typeof details.base === "object" ? details.base : null;
  const suggestedLabel = String(
    origin === "empresa"
      ? firstNonEmptyValue(
        base?.nombre_empresa,
        base?.rtn ? `RTN: ${base.rtn}` : null,
        `Empresa #${suggestedId}`
      )
      : firstNonEmptyValue(
        base?.nombre_completo,
        base?.dni ? `DNI: ${base.dni}` : null,
        `Persona #${suggestedId}`
      )
  ).trim();

  const message = String(
    error?.message
      || error?.data?.message
      || (origin === "empresa"
        ? "Ya existe una empresa con ese RTN. Puedes vincularla para continuar."
        : "Ya existe una persona con ese DNI. Puedes vincularla para continuar.")
  ).trim();

  return {
    suggestedId,
    suggestedLabel,
    message,
  };
};

const resolveClienteOrigen = (cliente) => {
  const explicitOrigen = normalizeValue(cliente?.origen_cliente);
  if (explicitOrigen === "empresa" || explicitOrigen === "persona") return explicitOrigen;

  const hasPersona = Boolean(
    firstNonEmptyValue(
      cliente?.id_persona,
      cliente?.persona_nombre_completo,
      cliente?.persona_nombre,
      cliente?.persona_apellido,
      cliente?.persona_dni,
      cliente?.dni
    )
  );
  const hasEmpresa = Boolean(
    firstNonEmptyValue(
      cliente?.id_empresa_cliente,
      cliente?.id_empresa,
      cliente?.nombre_empresa,
      cliente?.empresa_rtn,
      cliente?.rtn
    )
  );

  if (hasPersona && !hasEmpresa) return "persona";
  if (hasEmpresa && !hasPersona) return "empresa";
  if (hasPersona && hasEmpresa) {
    // Regla legacy segura: si ambas relaciones existen, prioriza persona para visualizacion.
    return cliente?.id_persona ? "persona" : "empresa";
  }

  return "persona";
};

const normalizeClienteForView = (cliente) => {
  const origen = resolveClienteOrigen(cliente);
  const nombrePrincipal = firstNonEmptyValue(cliente?.nombre_principal);
  const documentoTipo = firstNonEmptyValue(cliente?.documento_tipo);
  const documentoLabel = firstNonEmptyValue(
    cliente?.documento_label,
    documentoTipo ? String(documentoTipo).toUpperCase() : null
  );
  const documentoValor = firstNonEmptyValue(cliente?.documento_valor);
  const telefono = firstNonEmptyValue(cliente?.telefono);
  const correo = firstNonEmptyValue(cliente?.correo);
  const tipoCliente = firstNonEmptyValue(cliente?.tipo_cliente);
  const rawPuntos = Number(cliente?.puntos ?? cliente?.puntos_acumulados ?? cliente?.total_puntos);
  const puntos = Number.isFinite(rawPuntos) && rawPuntos >= 0 ? rawPuntos : 0;
  const fechaIngreso = firstNonEmptyValue(cliente?.fecha_ingreso);
  const codigoCliente = firstNonEmptyValue(
    cliente?.codigo_cliente,
    cliente?.id_cliente ? `CLI-${cliente.id_cliente}` : null
  );

  return {
    ...cliente,
    codigo_cliente: codigoCliente,
    origen_cliente: origen,
    origen_label: origen === "empresa" ? "Cliente Empresa" : "Cliente Persona",
    nombre_principal: nombrePrincipal || null,
    subtitulo_principal: firstNonEmptyValue(cliente?.subtitulo_principal),
    tipo_cliente: firstNonEmptyValue(
      tipoCliente,
      cliente?.tipo_cliente_nombre,
      cliente?.nombre_tipo_cliente
    ) || null,
    telefono: telefono || null,
    correo: correo || null,
    fecha_ingreso: fechaIngreso || null,
    puntos,
    documento_tipo: documentoTipo || null,
    documento_label: documentoLabel || null,
    documento_valor: documentoValor || null,
  };
};

const parseIntegerValue = (value) => {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) ? parsed : NaN;
};

const parsePositiveInteger = (value) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const extractPositiveIdFromAny = (payload, candidateKeys = []) => {
  const queue = [payload];
  const seen = new Set();

  while (queue.length) {
    const node = queue.shift();
    if (node === null || node === undefined) continue;

    const direct = parsePositiveInteger(node);
    if (direct) return direct;

    if (typeof node === "string") {
      const text = node.trim();
      if (!text) continue;
      try {
        const parsed = JSON.parse(text);
        if (parsed !== node) queue.push(parsed);
      } catch {
        // ignore parse errors
      }
      continue;
    }

    if (typeof node !== "object") continue;
    if (seen.has(node)) continue;
    seen.add(node);

    if (Array.isArray(node)) {
      node.forEach((item) => queue.push(item));
      continue;
    }

    candidateKeys.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(node, key)) {
        queue.push(node[key]);
      }
    });

    Object.entries(node).forEach(([key, value]) => {
      if (/^id$|^id_|_id$/i.test(String(key))) queue.push(value);
    });

    Object.values(node).forEach((value) => queue.push(value));
  }

  return null;
};

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

const Clientes = ({ openToast }) => {
  const safeToast = useCallback(
    (title, message, variant = "success") => {
      if (typeof openToast === "function") openToast(title, message, variant);
    },
    [openToast]
  );

  const [personasCatalogo, setPersonasCatalogo] = useState([]);
  const [empresasCatalogo, setEmpresasCatalogo] = useState([]);
  const [tiposCliente, setTiposCliente] = useState([]);

  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [viewMode, setViewMode] = useState(() => readViewMode("clientesViewMode"));

  const [estadoFiltro, setEstadoFiltro] = useState("activo");
  const [sortBy, setSortBy] = useState("recientes");
  const [filtersDraft, setFiltersDraft] = useState(createInitialFiltersDraft);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [page, setPage] = useState(1);
  const isTableView = viewMode === "table";
  const limit = isTableView ? 10 : 9;
  const [total, setTotal] = useState(0);
  const [globalStats, setGlobalStats] = useState({ total: 0, activas: 0, inactivas: 0 });

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [clienteOriginType, setClienteOriginType] = useState("persona");
  const [createStep, setCreateStep] = useState(1);
  const [errors, setErrors] = useState({});
  const [useInlinePersonaCreate, setUseInlinePersonaCreate] = useState(false);
  const [useInlineEmpresaCreate, setUseInlineEmpresaCreate] = useState(false);
  const [inlinePersonaForm, setInlinePersonaForm] = useState(emptyInlinePersonaForm);
  const [inlineEmpresaForm, setInlineEmpresaForm] = useState(emptyInlineEmpresaForm);
  const [showPersonaCreateModal, setShowPersonaCreateModal] = useState(false);
  const [showEmpresaCreateModal, setShowEmpresaCreateModal] = useState(false);
  const [showPersonaEditModal, setShowPersonaEditModal] = useState(false);
  const [showEmpresaEditModal, setShowEmpresaEditModal] = useState(false);
  const [inlinePersonaSaving, setInlinePersonaSaving] = useState(false);
  const [inlineEmpresaSaving, setInlineEmpresaSaving] = useState(false);
  const [duplicateResolution, setDuplicateResolution] = useState(createEmptyDuplicateResolution);

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
  const globalStatsRequestIdRef = useRef(0);
  const listAbortRef = useRef(null);
  const listPrefetchAbortRef = useRef(null);
  const clientesListCacheRef = useRef(new Map());
  const catalogosCargadosRef = useRef(false);
  const catalogosLoadingRef = useRef(false);
  const panelRef = useRef(null);
  const empresaSearchCacheRef = useRef(new Map());
  const tipoSearchCacheRef = useRef(new Map());
  const empresaDebounceTimerRef = useRef(null);
  const tipoDebounceTimerRef = useRef(null);
  const empresaAbortRef = useRef(null);
  const empresaAsyncReqSeqRef = useRef(0);
  const tipoAsyncReqSeqRef = useRef(0);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const isAnyDrawerOpen = showModal || filtersOpen;
  const visiblePageNumbers = useMemo(() => buildVisiblePageNumbers(page, totalPages), [page, totalPages]);

  const blurFocusedElementInside = useCallback((containerId) => {
    if (typeof document === "undefined") return;
    const container = document.getElementById(containerId);
    const active = document.activeElement;
    if (!container || !active) return;
    if (container.contains(active) && typeof active.blur === "function") {
      active.blur();
    }
  }, []);

  const resetDuplicateResolution = useCallback(() => {
    setDuplicateResolution(createEmptyDuplicateResolution());
  }, []);

  const closeFormDrawer = useCallback(() => {
    blurFocusedElementInside("cli-form-drawer");
    setShowPersonaCreateModal(false);
    setShowEmpresaCreateModal(false);
    setShowPersonaEditModal(false);
    setShowEmpresaEditModal(false);
    setCreateStep(1);
    resetDuplicateResolution();
    setShowModal(false);
  }, [blurFocusedElementInside, resetDuplicateResolution]);

  const personaOptions = useMemo(
    () =>
      (Array.isArray(personasCatalogo) ? personasCatalogo : []).map((p) => {
        const id = p?.id_persona;
        const nombreCompleto = `${p?.nombre || ""} ${p?.apellido || ""}`.trim();
        return {
          id: id ? String(id) : "",
          label: nombreCompleto || "Persona sin nombre",
          dni: p?.dni || "",
        };
      }),
    [personasCatalogo]
  );

  const personaRtnById = useMemo(
    () =>
      new Map(
        (Array.isArray(personasCatalogo) ? personasCatalogo : [])
          .map((p) => {
            const id = String(p?.id_persona ?? "").trim();
            const rtn = firstNonEmptyValue(
              p?.rtn,
              p?.RTN,
              p?.persona_rtn_complemento,
              p?.rtn_persona,
              p?.rtn_complemento,
              p?.complemento_rtn,
              p?.numero_rtn
            );
            return [id, rtn];
          })
          .filter(([id]) => id)
      ),
    [personasCatalogo]
  );

  const personaSelectOptions = useMemo(
    () =>
      personaOptions.map((item) => ({
        value: item.id,
        label: item.dni ? `${item.label} | DNI: ${item.dni}` : item.label,
      })),
    [personaOptions]
  );

  const _personaSelectValue = useMemo(() => {
    const selectedId = String(form.id_persona ?? "");
    if (!selectedId) return null;
    return personaSelectOptions.find((option) => option.value === selectedId) || null;
  }, [form.id_persona, personaSelectOptions]);

  const _personaSelectStyles = useMemo(
    () => buildClientesSelectStyles(Boolean(errors.id_persona)),
    [errors.id_persona]
  );

  const empresaOptions = useMemo(
    () =>
      (Array.isArray(empresasCatalogo) ? empresasCatalogo : []).map((e) => {
        const id = e?.id_empresa;
        const nombreEmpresa = String(firstNonEmptyValue(e?.nombre_empresa, "Empresa sin nombre")).trim();
        const rtn = firstNonEmptyValue(e?.rtn);
        const correo = firstNonEmptyValue(e?.direccion_correo, e?.correo);
        const telefono = firstNonEmptyValue(e?.telefono);
        const labelParts = [nombreEmpresa];
        if (rtn) labelParts.push(`RTN: ${rtn}`);
        if (correo) labelParts.push(correo);
        const label = labelParts.join(" | ");
        const searchText = normalizeSearchKey([nombreEmpresa, rtn, correo, telefono].join(" "));

        return {
          id: id ? String(id) : "",
          label,
          nombre_empresa: nombreEmpresa,
          rtn,
          correo,
          telefono,
          searchText,
        };
      }),
    [empresasCatalogo]
  );

  const empresaSelectOptions = useMemo(
    () =>
      empresaOptions.map((item) => ({
        value: item.id,
        label: item.label,
        searchText: item.searchText,
      })),
    [empresaOptions]
  );

  const empresaSelectOptionsById = useMemo(
    () => new Map(empresaSelectOptions.map((option) => [option.value, option])),
    [empresaSelectOptions]
  );

  const empresaSelectFallbackValue = useMemo(() => {
    const selectedId = String(form.id_empresa ?? "").trim();
    if (!selectedId) return null;
    const clienteActual = clientes.find((item) => String(item?.id_cliente ?? "") === String(editId ?? ""));
    const nombre = firstNonEmptyValue(clienteActual?.nombre_empresa, clienteActual?.nombre_principal, "Empresa seleccionada");
    const rtn = firstNonEmptyValue(clienteActual?.rtn, clienteActual?.documento_tipo === "rtn" ? clienteActual?.documento_valor : "");
    const correo = firstNonEmptyValue(clienteActual?.correo);
    const labelParts = [nombre];
    if (rtn) labelParts.push(`RTN: ${rtn}`);
    if (correo) labelParts.push(correo);
    return {
      value: selectedId,
      label: labelParts.join(" | "),
      searchText: normalizeSearchKey(`${nombre} ${rtn} ${correo}`),
    };
  }, [clientes, editId, form.id_empresa]);

  const _empresaSelectValue = useMemo(() => {
    const selectedId = String(form.id_empresa ?? "").trim();
    if (!selectedId) return null;
    return (
      empresaSelectOptionsById.get(selectedId)
      || empresaSelectFallbackValue
      || {
        value: selectedId,
        label: "Empresa seleccionada",
        searchText: normalizeSearchKey(`empresa ${selectedId}`),
      }
    );
  }, [form.id_empresa, empresaSelectOptionsById, empresaSelectFallbackValue]);

  const _empresaSelectStyles = useMemo(
    () => buildClientesSelectStyles(Boolean(errors.id_empresa)),
    [errors.id_empresa]
  );

  const _empresaDefaultOptions = useMemo(
    () => filterAsyncOptions(empresaSelectOptions, ""),
    [empresaSelectOptions]
  );

  const tipoClienteOptions = useMemo(
    () =>
      (Array.isArray(tiposCliente) ? tiposCliente : []).map((t) => {
        const id = t?.id_tipo_cliente;
        const label = t?.tipo_cliente || t?.descripcion || t?.nombre || `Tipo #${id ?? "N/D"}`;
        return {
          id: id ? String(id) : "",
          label: String(label),
          searchText: normalizeSearchKey(label),
        };
      }),
    [tiposCliente]
  );

  const tipoClienteSelectOptions = useMemo(
    () =>
      tipoClienteOptions.map((item) => ({
        value: item.id,
        label: item.label,
        searchText: item.searchText,
      })),
    [tipoClienteOptions]
  );

  const tipoClienteSelectOptionsById = useMemo(
    () => new Map(tipoClienteSelectOptions.map((option) => [option.value, option])),
    [tipoClienteSelectOptions]
  );

  const tipoClienteSelectFallbackValue = useMemo(() => {
    const selectedId = String(form.id_tipo_cliente ?? "").trim();
    if (!selectedId) return null;
    const clienteActual = clientes.find((item) => String(item?.id_cliente ?? "") === String(editId ?? ""));
    const label = firstNonEmptyValue(clienteActual?.tipo_cliente, "Tipo seleccionado");
    return {
      value: selectedId,
      label,
      searchText: normalizeSearchKey(label),
    };
  }, [clientes, editId, form.id_tipo_cliente]);

  const _tipoClienteSelectValue = useMemo(() => {
    const selectedId = String(form.id_tipo_cliente ?? "").trim();
    if (!selectedId) return null;
    return (
      tipoClienteSelectOptionsById.get(selectedId)
      || tipoClienteSelectFallbackValue
      || {
        value: selectedId,
        label: "Tipo seleccionado",
        searchText: normalizeSearchKey(`tipo ${selectedId}`),
      }
    );
  }, [form.id_tipo_cliente, tipoClienteSelectOptionsById, tipoClienteSelectFallbackValue]);

  const _tipoClienteSelectStyles = useMemo(
    () => buildClientesSelectStyles(Boolean(errors.id_tipo_cliente)),
    [errors.id_tipo_cliente]
  );

  const _tipoClienteDefaultOptions = useMemo(
    () => filterAsyncOptions(tipoClienteSelectOptions, ""),
    [tipoClienteSelectOptions]
  );

  const getClientePrincipalNombre = useCallback((cliente) => {
    return firstNonEmptyValue(cliente?.nombre_principal);
  }, []);

  const resolveIdFromLabel = (rawValue, options) => {
    const normalized = normalizeValue(rawValue);
    if (!normalized) return "";
    const found = options.find((item) => normalizeValue(item.label) === normalized);
    return found?.id || "";
  };

  const buildFormFromCliente = useCallback(
    (cliente) => {
      const resolvedPersona =
        cliente?.id_persona
          ? String(cliente.id_persona)
          : resolveIdFromLabel(
              cliente?.persona_nombre_completo ||
                `${cliente?.persona_nombre || ""} ${cliente?.persona_apellido || ""}`.trim(),
              personaOptions
            );

      const resolvedEmpresa =
        firstNonEmptyValue(cliente?.id_empresa_cliente, cliente?.id_empresa)
          ? String(firstNonEmptyValue(cliente?.id_empresa_cliente, cliente?.id_empresa))
          : resolveIdFromLabel(
              cliente?.nombre_empresa || cliente?.empresa_nombre || cliente?.empresa,
              empresaOptions
            );

      // Regla de prioridad para legados con ambas relaciones: priorizar persona en edición.
      const keepPersona = Boolean(resolvedPersona);

      return {
        id_persona: keepPersona ? resolvedPersona : "",
        id_empresa: keepPersona ? "" : resolvedEmpresa,
        id_tipo_cliente:
          cliente?.id_tipo_cliente
            ? String(cliente.id_tipo_cliente)
            : resolveIdFromLabel(
                cliente?.tipo_cliente_nombre || cliente?.tipo_cliente || cliente?.nombre_tipo_cliente,
                tipoClienteOptions
              ),
        fecha_ingreso: toDateInputValue(cliente?.fecha_ingreso),
        puntos:
          cliente?.puntos === null || cliente?.puntos === undefined
            ? ""
            : String(cliente.puntos),
        estado: isActivo(cliente),
      };
    },
    [personaOptions, empresaOptions, tipoClienteOptions]
  );

  useEffect(() => {
    empresaSearchCacheRef.current.clear();
  }, [empresaSelectOptions]);

  useEffect(() => {
    tipoSearchCacheRef.current.clear();
  }, [tipoClienteSelectOptions]);

  const _loadEmpresaOptions = useCallback(
    (inputValue = "") =>
      new Promise((resolve) => {
        const searchTerm = normalizeSearchKey(inputValue);
        const cacheKey = searchTerm || "__default__";

        if (empresaSearchCacheRef.current.has(cacheKey)) {
          resolve(empresaSearchCacheRef.current.get(cacheKey));
          return;
        }

        if (empresaDebounceTimerRef.current) {
          clearTimeout(empresaDebounceTimerRef.current);
        }

        if (empresaAbortRef.current) {
          empresaAbortRef.current.abort();
        }

        const requestSeq = ++empresaAsyncReqSeqRef.current;

        empresaDebounceTimerRef.current = setTimeout(async () => {
          try {
            if (!mountedRef.current || requestSeq !== empresaAsyncReqSeqRef.current) {
              resolve([]);
              return;
            }

            let options = [];

            if (searchTerm) {
              const controller = new AbortController();
              empresaAbortRef.current = controller;

              const response = await personaService.getEmpresas({
                page: 1,
                limit: ASYNC_SELECT_LIMIT,
                nombre: searchTerm,
                signal: controller.signal,
              });

              if (!mountedRef.current || requestSeq !== empresaAsyncReqSeqRef.current) {
                resolve([]);
                return;
              }

              const fetchedItems = normalizeListResponse(response).items;
              if (Array.isArray(fetchedItems) && fetchedItems.length) {
                setEmpresasCatalogo((prev) => {
                  const current = Array.isArray(prev) ? prev : [];
                  const map = new Map(current.map((item) => [String(item?.id_empresa ?? ""), item]));
                  fetchedItems.forEach((item) => {
                    const key = String(item?.id_empresa ?? "");
                    if (key) map.set(key, item);
                  });
                  return Array.from(map.values());
                });
              }

              const fetchedOptions = (Array.isArray(fetchedItems) ? fetchedItems : []).map((item) => {
                const id = String(item?.id_empresa ?? "").trim();
                const nombreEmpresa = firstNonEmptyValue(item?.nombre_empresa, "Empresa sin nombre");
                const rtn = firstNonEmptyValue(item?.rtn);
                const correo = firstNonEmptyValue(item?.direccion_correo, item?.correo);
                const telefono = firstNonEmptyValue(item?.telefono);
                const labelParts = [nombreEmpresa];
                if (rtn) labelParts.push(`RTN: ${rtn}`);
                if (correo) labelParts.push(correo);
                return {
                  value: id,
                  label: labelParts.join(" | "),
                  searchText: normalizeSearchKey(`${nombreEmpresa} ${rtn} ${correo} ${telefono}`),
                };
              });

              options = filterAsyncOptions(fetchedOptions, searchTerm);
            }

            if (!options.length) {
              options = filterAsyncOptions(empresaSelectOptions, searchTerm);
            }

            empresaSearchCacheRef.current.set(cacheKey, options);
            resolve(options);
          } catch (error) {
            if (error?.name === "AbortError") {
              resolve([]);
              return;
            }
            resolve(filterAsyncOptions(empresaSelectOptions, searchTerm));
          } finally {
            if (requestSeq === empresaAsyncReqSeqRef.current) {
              empresaAbortRef.current = null;
            }
          }
        }, ASYNC_SELECT_DEBOUNCE_MS);
      }),
    [empresaSelectOptions]
  );

  const _loadTipoClienteOptions = useCallback(
    (inputValue = "") =>
      new Promise((resolve) => {
        const searchTerm = normalizeSearchKey(inputValue);
        const cacheKey = searchTerm || "__default__";

        if (tipoSearchCacheRef.current.has(cacheKey)) {
          resolve(tipoSearchCacheRef.current.get(cacheKey));
          return;
        }

        if (tipoDebounceTimerRef.current) {
          clearTimeout(tipoDebounceTimerRef.current);
        }

        const requestSeq = ++tipoAsyncReqSeqRef.current;
        tipoDebounceTimerRef.current = setTimeout(() => {
          if (!mountedRef.current || requestSeq !== tipoAsyncReqSeqRef.current) {
            resolve([]);
            return;
          }

          const options = filterAsyncOptions(tipoClienteSelectOptions, searchTerm);
          tipoSearchCacheRef.current.set(cacheKey, options);
          resolve(options);
        }, ASYNC_SELECT_DEBOUNCE_MS);
      }),
    [tipoClienteSelectOptions]
  );

  const buildClientesCacheKey = useCallback(
    (targetPage) =>
      JSON.stringify({
        page: Number(targetPage) || 1,
        limit,
        search: normalizeSearchText(debouncedSearch),
        estado: estadoFiltro,
      }),
    [limit, debouncedSearch, estadoFiltro]
  );

  const normalizeClientesPage = useCallback(
    (items = []) =>
      (Array.isArray(items) ? items : []).map((item) => {
        const normalized = normalizeClienteForView(item);
        if (normalized?.tipo_cliente) return normalized;

        const tipoId = String(normalized?.id_tipo_cliente ?? "").trim();
        const tipoOption = tipoId ? tipoClienteSelectOptionsById.get(tipoId) : null;
        if (tipoOption?.label) {
          return {
            ...normalized,
            tipo_cliente: String(tipoOption.label).trim(),
          };
        }

        return normalized;
      }),
    [tipoClienteSelectOptionsById]
  );

  const setClientesCacheEntry = useCallback((cacheKey, data) => {
    if (!cacheKey) return;
    const cache = clientesListCacheRef.current;
    cache.delete(cacheKey);
    cache.set(cacheKey, {
      items: Array.isArray(data?.items) ? data.items : [],
      total: Math.max(0, Number(data?.total) || 0),
      cachedAt: Date.now(),
    });

    while (cache.size > MAX_CLIENTES_PAGE_CACHE) {
      const oldestKey = cache.keys().next().value;
      if (!oldestKey) break;
      cache.delete(oldestKey);
    }
  }, []);

  const clearClientesListCache = useCallback(() => {
    clientesListCacheRef.current.clear();
    listPrefetchAbortRef.current?.abort();
    listPrefetchAbortRef.current = null;
  }, []);

  const prefetchClientesPage = useCallback(
    async (targetPage, totalKnown = null) => {
      const nextPage = Number(targetPage);
      if (!Number.isFinite(nextPage) || nextPage < 1) return;

      const totalValue = Number.isFinite(Number(totalKnown)) ? Number(totalKnown) : null;
      if (totalValue !== null) {
        const totalPages = Math.max(1, Math.ceil(totalValue / limit));
        if (nextPage > totalPages) return;
      }

      const cacheKey = buildClientesCacheKey(nextPage);
      if (clientesListCacheRef.current.has(cacheKey)) return;

      listPrefetchAbortRef.current?.abort();
      const controller = new AbortController();
      listPrefetchAbortRef.current = controller;

      try {
        const estadoQuery = estadoFiltro === "inactivo" ? false : true;
        const resp = await personaService.getClientes({
          page: nextPage,
          limit,
          nombre: debouncedSearch || undefined,
          estado: estadoQuery,
          signal: controller.signal,
        });

        if (!mountedRef.current || controller.signal.aborted) return;
        const { items, total: totalResp } = normalizeListResponse(resp);
        const normalizedItems = normalizeClientesPage(items);
        setClientesCacheEntry(cacheKey, { items: normalizedItems, total: totalResp });
      } catch (error) {
        if (isAbortError(error)) return;
      } finally {
        if (listPrefetchAbortRef.current === controller) {
          listPrefetchAbortRef.current = null;
        }
      }
    },
    [
      buildClientesCacheKey,
      debouncedSearch,
      estadoFiltro,
      limit,
      normalizeClientesPage,
      setClientesCacheEntry,
    ]
  );

  const cargarPersonasCatalogoCompleto = useCallback(async () => {
    const personas = [];
    let currentPage = 1;
    let totalPages = 1;

    while (currentPage <= totalPages && currentPage <= PERSONAS_CATALOGO_MAX_PAGES) {
      const response = await personaService.getPersonas({
        page: currentPage,
        limit: PERSONAS_CATALOGO_PAGE_LIMIT,
      });
      const { items, total: totalItems } = normalizeListResponse(response);
      if (Array.isArray(items) && items.length) {
        personas.push(...items);
      }

      const safeTotal = Math.max(0, Number(totalItems) || 0);
      totalPages = Math.max(1, Math.ceil(safeTotal / PERSONAS_CATALOGO_PAGE_LIMIT));
      currentPage += 1;
    }

    return personas;
  }, []);

  const cargarCatalogos = useCallback(async () => {
    if (catalogosCargadosRef.current || catalogosLoadingRef.current) return;
    catalogosLoadingRef.current = true;

    try {
      const [personasTodas, empresasResp, tiposResp] = await Promise.all([
        cargarPersonasCatalogoCompleto(),
        personaService.getEmpresas({ page: 1, limit: 100 }),
        parametrosService.listarCatalogo("tipo_cliente"),
      ]);

      if (!mountedRef.current) return;

      const personasMap = new Map();
      personasTodas.forEach((persona) => {
        const id = String(persona?.id_persona ?? "").trim();
        if (!id) return;
        const previo = personasMap.get(id);
        if (!previo) {
          personasMap.set(id, persona);
          return;
        }
        const rtnSiguiente = firstNonEmptyValue(
          persona?.rtn,
          persona?.RTN,
          persona?.persona_rtn_complemento,
          persona?.rtn_persona,
          persona?.rtn_complemento,
          persona?.complemento_rtn,
          persona?.numero_rtn
        );

        if (rtnSiguiente) {
          personasMap.set(id, { ...previo, ...persona });
        } else {
          personasMap.set(id, { ...persona, ...previo });
        }
      });

      setPersonasCatalogo(Array.from(personasMap.values()));
      setEmpresasCatalogo(normalizeListResponse(empresasResp).items);
      setTiposCliente(normalizeArrayPayload(tiposResp));
      catalogosCargadosRef.current = true;
    } catch (error) {
      safeToast("ERROR", error.message || "No se pudieron cargar catalogos", "danger");
    } finally {
      catalogosLoadingRef.current = false;
    }
  }, [cargarPersonasCatalogoCompleto, safeToast]);

  const cargarClientes = useCallback(async (options = {}) => {
    const requestId = ++requestIdRef.current;
    const requestedPage = parsePositiveInteger(options?.page);
    const targetPage = requestedPage || page;
    const force = Boolean(options?.force);

    listAbortRef.current?.abort();
    listAbortRef.current = null;

    const cacheKey = buildClientesCacheKey(targetPage);
    if (!force) {
      const cached = clientesListCacheRef.current.get(cacheKey);
      if (cached) {
        setClientes(Array.isArray(cached.items) ? cached.items : []);
        setTotal(Math.max(0, Number(cached.total) || 0));
        setLoading(false);
        prefetchClientesPage(targetPage + 1, cached.total);
        return;
      }
    }

    setLoading(true);
    const controller = new AbortController();
    listAbortRef.current = controller;

    try {
      const estadoQuery = estadoFiltro === "inactivo" ? false : true;
      const resp = await personaService.getClientes({
        page: targetPage,
        limit,
        nombre: debouncedSearch || undefined,
        estado: estadoQuery,
        signal: controller.signal,
      });

      if (!mountedRef.current || requestId !== requestIdRef.current) return;

      const { items, total: totalResp } = normalizeListResponse(resp);
      const normalizedItems = normalizeClientesPage(items);
      setClientes(normalizedItems);
      setTotal(totalResp);
      setClientesCacheEntry(cacheKey, { items: normalizedItems, total: totalResp });
      prefetchClientesPage(targetPage + 1, totalResp);
    } catch (error) {
      if (isAbortError(error)) return;
      if (!mountedRef.current) return;
      safeToast("ERROR", error.message || "No se pudo cargar clientes", "danger");
      setClientes([]);
      setTotal(0);
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [
    buildClientesCacheKey,
    page,
    limit,
    debouncedSearch,
    estadoFiltro,
    safeToast,
    normalizeClientesPage,
    setClientesCacheEntry,
    prefetchClientesPage,
  ]);

  const cargarClientesGlobalStats = useCallback(async () => {
    const reqId = ++globalStatsRequestIdRef.current;

    try {
      const [activosResp, inactivosResp] = await Promise.all([
        personaService.getClientes({
          page: 1,
          limit: GLOBAL_STATS_FETCH_LIMIT,
          estado: true,
        }),
        personaService.getClientes({
          page: 1,
          limit: GLOBAL_STATS_FETCH_LIMIT,
          estado: false,
        }),
      ]);

      if (!mountedRef.current || reqId !== globalStatsRequestIdRef.current) return;

      const activosTotal = Math.max(0, Number(normalizeListResponse(activosResp).total) || 0);
      const inactivosTotal = Math.max(0, Number(normalizeListResponse(inactivosResp).total) || 0);
      setGlobalStats({
        total: activosTotal + inactivosTotal,
        activas: activosTotal,
        inactivas: inactivosTotal,
      });
    } catch {
      // Keep current KPI values when the stats refresh fails.
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
      if (empresaDebounceTimerRef.current) {
        clearTimeout(empresaDebounceTimerRef.current);
      }
      if (tipoDebounceTimerRef.current) {
        clearTimeout(tipoDebounceTimerRef.current);
      }
      if (empresaAbortRef.current) {
        empresaAbortRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    cargarCatalogos();
  }, [cargarCatalogos]);

  useEffect(() => {
    if (!showModal) return;
    cargarCatalogos();
  }, [showModal, cargarCatalogos]);

  useEffect(() => {
    cargarClientes();
  }, [cargarClientes]);

  useEffect(() => {
    void cargarClientesGlobalStats();
  }, [cargarClientesGlobalStats]);

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
      window.localStorage.setItem("clientesViewMode", viewMode);
    } catch {
      // Keep working even if storage is unavailable.
    }
  }, [viewMode]);

  useEffect(() => {
    clearClientesListCache();
    setPage(1);
  }, [viewMode, clearClientesListCache]);

  useEffect(() => {
    if (!showModal || !editId) return;
    const clienteActual = clientes.find((item) => String(item.id_cliente) === String(editId));
    if (!clienteActual) return;

    setForm((prev) => {
      const resolved = buildFormFromCliente(clienteActual);
      const next = { ...prev };

      if (!prev.id_persona && resolved.id_persona) next.id_persona = resolved.id_persona;
      if (!prev.id_empresa && resolved.id_empresa) next.id_empresa = resolved.id_empresa;
      if (!prev.id_tipo_cliente && resolved.id_tipo_cliente) next.id_tipo_cliente = resolved.id_tipo_cliente;

      return next;
    });
  }, [showModal, editId, clientes, buildFormFromCliente]);

  const sanitizeForm = () => {
    const personaId = String(form.id_persona ?? "").trim();
    const empresaId = String(form.id_empresa ?? "").trim();

    return {
      id_persona: personaId ? parseIntegerValue(personaId) : null,
      id_empresa: empresaId ? parseIntegerValue(empresaId) : null,
      id_empresa_cliente: empresaId ? parseIntegerValue(empresaId) : null,
      estado: Boolean(form.estado),
    };
  };

  const validar = () => {
    const currentErrors = {};
    const isCreateMode = !editId;
    const hasPersona = Boolean(String(form.id_persona ?? "").trim());
    const hasEmpresa = Boolean(String(form.id_empresa ?? "").trim());
    const usingInlinePersona = clienteOriginType === "persona" && (isCreateMode || useInlinePersonaCreate);
    const usingInlineEmpresa = clienteOriginType === "empresa" && (isCreateMode || useInlineEmpresaCreate);

    if (isCreateMode) {
      if (clienteOriginType === "persona") {
        if (hasEmpresa) currentErrors.id_empresa = "Este campo no aplica para Cliente Persona";
        if (hasPersona) currentErrors.id_persona = "En alta nueva no debes seleccionar persona existente.";
      } else if (clienteOriginType === "empresa") {
        if (hasPersona) currentErrors.id_persona = "Este campo no aplica para Cliente Empresa";
        if (hasEmpresa) currentErrors.id_empresa = "En alta nueva no debes seleccionar empresa existente.";
      }
    } else if (hasPersona && hasEmpresa) {
      currentErrors.id_persona = "Solo puedes seleccionar una opcion";
      currentErrors.id_empresa = "Solo puedes seleccionar una opcion";
    } else if (clienteOriginType === "persona") {
      if (!hasPersona && !usingInlinePersona) currentErrors.id_persona = "Selecciona una persona o crea una nueva";
      if (hasEmpresa) currentErrors.id_empresa = "Este campo no aplica para Cliente Persona";
    } else if (clienteOriginType === "empresa") {
      if (!hasEmpresa && !usingInlineEmpresa) currentErrors.id_empresa = "Selecciona una empresa o crea una nueva";
      if (hasPersona) currentErrors.id_persona = "Este campo no aplica para Cliente Empresa";
    }

    if (clienteOriginType === "persona" && usingInlinePersona) {
      const personaValidationErrors = validatePersonaForm(inlinePersonaForm);
      if (Object.keys(personaValidationErrors).length > 0) {
        currentErrors.id_persona = "Completa los datos de la persona antes de continuar";
      }
    }

    if (clienteOriginType === "empresa" && usingInlineEmpresa) {
      const empresaValidationErrors = validateEmpresaForm(inlineEmpresaForm);
      if (Object.keys(empresaValidationErrors).length > 0) {
        currentErrors.id_empresa = "Completa los datos de la empresa antes de continuar";
      }
    }

    setErrors(currentErrors);
    return Object.keys(currentErrors).length === 0;
  };

  const guardar = async (event) => {
    event.preventDefault();
    if (!validar() || actionLoading) return;

    const payloadLimpio = sanitizeForm();
    setActionLoading(true);

    try {
      if (editId) {
        const clienteOriginal = clientes.find((item) => String(item.id_cliente) === String(editId));
        if (!clienteOriginal) {
          safeToast("ERROR", "No se encontro el registro a editar", "danger");
          clearClientesListCache();
          await cargarClientes({ force: true });
          return;
        }

        const originalForm = buildFormFromCliente(clienteOriginal);
        const changedKeys = Object.keys(emptyForm).filter((key) => {
          if (key === "estado") return Boolean(form.estado) !== Boolean(originalForm.estado);
          return String(form[key] ?? "") !== String(originalForm[key] ?? "");
        });

        if (!changedKeys.length) {
          safeToast("INFO", "No hay cambios para guardar", "info");
        } else {
          const updatePayload = {};
          const estadoField = detectEstadoField(clienteOriginal) || "estado";

          changedKeys.forEach((key) => {
            if (key === "estado") {
              updatePayload[estadoField] = payloadLimpio.estado;
              return;
            }
            if (key === "id_empresa") {
              updatePayload.id_empresa_cliente = payloadLimpio.id_empresa_cliente;
            }
            updatePayload[key] = payloadLimpio[key];
          });

          await personaService.updateCliente(editId, updatePayload);
          safeToast("OK", "Cliente actualizado");
        }
      } else {
        resetDuplicateResolution();
        const atomicCreatePayload = {
          origen: clienteOriginType,
          strict_base_create: true,
          cliente: payloadLimpio,
          ...(clienteOriginType === "empresa"
            ? { empresa: buildEmpresaPayloadFromForm(inlineEmpresaForm) }
            : { persona: buildPersonaPayloadFromForm(inlinePersonaForm) }),
        };

        let createResult = null;
        try {
          createResult = await personaService.createClienteFull(atomicCreatePayload);
        } catch (atomicError) {
          const duplicateBase = resolveDuplicateBaseFromError(atomicError, clienteOriginType);
          if (duplicateBase) {
            setDuplicateResolution({
              visible: true,
              origin: clienteOriginType,
              message: duplicateBase.message,
              suggestedId: duplicateBase.suggestedId,
              suggestedLabel: duplicateBase.suggestedLabel,
              requestPayload: atomicCreatePayload,
            });
            safeToast("AVISO", duplicateBase.message, "warning");
            return;
          }

          const atomicStatus = Number(atomicError?.status);
          const atomicCode = String(atomicError?.code || atomicError?.data?.code || "").trim().toUpperCase();
          const allowCompatibilityFallback =
            atomicStatus === 500
            || atomicCode === "DB_SCHEMA_ERROR"
            || atomicCode === "DB_FUNCTION_ERROR"
            || atomicCode === "INTERNAL_ERROR";

          if (!allowCompatibilityFallback) throw atomicError;

          // Fallback progresivo: mantiene UX de un solo flujo en frontend,
          // pero usa rutas legacy cuando el backend atomico no puede resolver el esquema.
          if (clienteOriginType === "empresa") {
            const empresaCreada = await personaService.createEmpresa(
              buildEmpresaPayloadFromForm(inlineEmpresaForm),
              { context: "clientes" }
            );
            const idEmpresaFallback = extractPositiveIdFromAny(empresaCreada, [
              "id_empresa",
              "empresa_id",
              "id",
            ]);
            if (!idEmpresaFallback) throw atomicError;

            createResult = await personaService.createCliente({
              ...payloadLimpio,
              id_persona: null,
              id_empresa: idEmpresaFallback,
              id_empresa_cliente: idEmpresaFallback,
            });
          } else {
            const personaCreada = await personaService.createPersona(
              buildPersonaPayloadFromForm(inlinePersonaForm),
              { context: "clientes" }
            );
            const idPersonaFallback = extractPositiveIdFromAny(personaCreada, [
              "id_persona",
              "persona_id",
              "id",
            ]);
            if (!idPersonaFallback) throw atomicError;

            createResult = await personaService.createCliente({
              ...payloadLimpio,
              id_persona: idPersonaFallback,
              id_empresa: null,
              id_empresa_cliente: null,
            });
          }

          createResult = {
            ...(createResult || {}),
            message: createResult?.message || "Cliente creado con ruta compatible.",
          };
        }

        const backendMessage = String(
          createResult?.message || createResult?.data?.message || ""
        ).trim();
        if (createResult?.vinculado) {
          safeToast("INFO", backendMessage || "Cliente existente vinculado a la sucursal", "info");
        } else {
          safeToast("OK", backendMessage || "Cliente creado");
        }
      }

      closeFormDrawer();
      setEditId(null);
      setForm(emptyForm);
      setUseInlinePersonaCreate(false);
      setUseInlineEmpresaCreate(false);
      setInlinePersonaForm(emptyInlinePersonaForm);
      setInlineEmpresaForm(emptyInlineEmpresaForm);
      resetDuplicateResolution();
      setShowPersonaCreateModal(false);
      setShowEmpresaCreateModal(false);
      clearClientesListCache();
      if (!editId && page !== 1) {
        setPage(1);
        await cargarClientes({ page: 1, force: true });
      } else {
        await cargarClientes({ force: true });
      }
      await cargarClientesGlobalStats();
    } catch (error) {
      safeToast("ERROR", error.message || "No se pudo guardar", "danger");
    } finally {
      if (mountedRef.current) setActionLoading(false);
    }
  };

  const handleVincularDuplicado = useCallback(async () => {
    if (actionLoading) return;
    if (!duplicateResolution?.visible) return;
    const suggestedId = parsePositiveInteger(duplicateResolution.suggestedId);
    if (!suggestedId) {
      safeToast("ERROR", "No se encontro un registro valido para vincular.", "danger");
      return;
    }

    const basePayload = duplicateResolution.requestPayload;
    if (!basePayload || typeof basePayload !== "object") {
      safeToast("ERROR", "No se pudo reconstruir la solicitud para vincular.", "danger");
      return;
    }

    const origin = duplicateResolution.origin === "empresa" ? "empresa" : "persona";
    const retryPayload = {
      ...basePayload,
      strict_base_create: false,
      cliente: {
        ...(basePayload.cliente || {}),
      },
    };

    if (origin === "empresa") {
      retryPayload.cliente.id_empresa = suggestedId;
      retryPayload.cliente.id_empresa_cliente = suggestedId;
      retryPayload.cliente.id_persona = null;
    } else {
      retryPayload.cliente.id_persona = suggestedId;
      retryPayload.cliente.id_empresa = null;
      retryPayload.cliente.id_empresa_cliente = null;
    }

    setActionLoading(true);
    try {
      const createResult = await personaService.createClienteFull(retryPayload);
      const backendMessage = String(
        createResult?.message || createResult?.data?.message || ""
      ).trim();
      safeToast(
        createResult?.vinculado ? "INFO" : "OK",
        backendMessage || "Cliente vinculado correctamente.",
        createResult?.vinculado ? "info" : "success"
      );

      closeFormDrawer();
      setEditId(null);
      setForm(emptyForm);
      setUseInlinePersonaCreate(false);
      setUseInlineEmpresaCreate(false);
      setInlinePersonaForm(emptyInlinePersonaForm);
      setInlineEmpresaForm(emptyInlineEmpresaForm);
      resetDuplicateResolution();
      setShowPersonaCreateModal(false);
      setShowEmpresaCreateModal(false);
      clearClientesListCache();
      if (page !== 1) {
        setPage(1);
        await cargarClientes({ page: 1, force: true });
      } else {
        await cargarClientes({ force: true });
      }
      await cargarClientesGlobalStats();
    } catch (error) {
      safeToast("ERROR", error.message || "No se pudo vincular el registro existente.", "danger");
    } finally {
      if (mountedRef.current) setActionLoading(false);
    }
  }, [
    actionLoading,
    closeFormDrawer,
    duplicateResolution,
    safeToast,
    clearClientesListCache,
    page,
    cargarClientes,
    cargarClientesGlobalStats,
    resetDuplicateResolution
  ]);

  const handleInlinePersonaModalSave = useCallback(async (_personaPayload, personaFormState) => {
    setInlinePersonaForm(normalizePersonaFormValues(personaFormState));
    setErrors((state) => ({ ...state, id_persona: undefined }));
    setShowPersonaCreateModal(false);
  }, []);

  const handleInlineEmpresaModalSave = useCallback(async (_empresaPayload, empresaFormState) => {
    setInlineEmpresaForm(normalizeEmpresaFormValues(empresaFormState));
    setErrors((state) => ({ ...state, id_empresa: undefined }));
    setShowEmpresaCreateModal(false);
  }, []);

  const buildInlinePersonaFormFromCliente = useCallback((cliente) => {
    const personaId = parsePositiveInteger(cliente?.id_persona);
    const personaCatalogo = personaId
      ? (Array.isArray(personasCatalogo)
          ? personasCatalogo.find((item) => Number(item?.id_persona) === personaId)
          : null)
      : null;

    return normalizePersonaFormValues({
      nombre: firstNonEmptyValue(personaCatalogo?.nombre, cliente?.persona_nombre, cliente?.nombre),
      apellido: firstNonEmptyValue(personaCatalogo?.apellido, cliente?.persona_apellido, cliente?.apellido),
      dni: firstNonEmptyValue(
        personaCatalogo?.dni,
        cliente?.persona_dni,
        cliente?.dni,
        String(cliente?.documento_tipo || "").toLowerCase() === "dni" ? cliente?.documento_valor : ""
      ),
      rtn: firstNonEmptyValue(
        personaCatalogo?.rtn,
        cliente?.persona_rtn,
        String(cliente?.documento_tipo || "").toLowerCase() === "rtn" ? cliente?.documento_valor : ""
      ),
      genero: firstNonEmptyValue(personaCatalogo?.genero, cliente?.persona_genero, cliente?.genero),
      fecha_nacimiento: firstNonEmptyValue(
        personaCatalogo?.fecha_nacimiento,
        cliente?.persona_fecha_nacimiento,
        cliente?.fecha_nacimiento
      ),
      id_telefono: firstNonEmptyValue(
        personaCatalogo?.texto_telefono,
        personaCatalogo?.telefono,
        personaCatalogo?.telefono_numero,
        personaCatalogo?.numero_telefono,
        cliente?.persona_telefono,
        cliente?.telefono,
        personaCatalogo?.id_telefono
      ),
      id_direccion: firstNonEmptyValue(
        personaCatalogo?.texto_direccion,
        personaCatalogo?.direccion,
        personaCatalogo?.direccion_detalle,
        cliente?.persona_direccion,
        cliente?.direccion,
        personaCatalogo?.id_direccion
      ),
      id_correo: firstNonEmptyValue(
        personaCatalogo?.texto_correo,
        personaCatalogo?.direccion_correo,
        personaCatalogo?.correo,
        personaCatalogo?.email,
        cliente?.persona_correo,
        cliente?.correo,
        personaCatalogo?.id_correo
      ),
    });
  }, [personasCatalogo]);

  const buildInlineEmpresaFormFromCliente = useCallback((cliente) => {
    const empresaId =
      parsePositiveInteger(cliente?.id_empresa_cliente) || parsePositiveInteger(cliente?.id_empresa);
    const empresaCatalogo = empresaId
      ? (Array.isArray(empresasCatalogo)
          ? empresasCatalogo.find((item) => Number(item?.id_empresa) === empresaId)
          : null)
      : null;

    return normalizeEmpresaFormValues({
      rtn: firstNonEmptyValue(
        empresaCatalogo?.rtn,
        cliente?.empresa_rtn,
        cliente?.rtn,
        String(cliente?.documento_tipo || "").toLowerCase() === "rtn" ? cliente?.documento_valor : ""
      ),
      nombre_empresa: firstNonEmptyValue(
        empresaCatalogo?.nombre_empresa,
        cliente?.nombre_empresa,
        cliente?.empresa_nombre,
        cliente?.nombre_principal
      ),
      id_telefono: firstNonEmptyValue(
        empresaCatalogo?.texto_telefono,
        empresaCatalogo?.telefono,
        empresaCatalogo?.telefono_numero,
        empresaCatalogo?.numero_telefono,
        cliente?.empresa_telefono,
        cliente?.telefono,
        empresaCatalogo?.id_telefono
      ),
      id_direccion: firstNonEmptyValue(
        empresaCatalogo?.texto_direccion,
        empresaCatalogo?.direccion,
        empresaCatalogo?.direccion_detalle,
        cliente?.empresa_direccion,
        cliente?.direccion,
        empresaCatalogo?.id_direccion
      ),
      id_correo: firstNonEmptyValue(
        empresaCatalogo?.texto_correo,
        empresaCatalogo?.direccion_correo,
        empresaCatalogo?.correo,
        empresaCatalogo?.email,
        cliente?.empresa_correo,
        cliente?.correo,
        empresaCatalogo?.id_correo
      ),
      estado: empresaCatalogo?.estado === undefined ? isActivo(cliente) : Boolean(empresaCatalogo?.estado),
    });
  }, [empresasCatalogo]);

  const handleInlinePersonaEditSave = useCallback(
    async (_personaPayload, personaFormState) => {
      if (!editId) return;
      const clienteActual = clientes.find((item) => String(item?.id_cliente ?? "") === String(editId));
      const personaId = parsePositiveInteger(form.id_persona) || parsePositiveInteger(clienteActual?.id_persona);
      if (!personaId) {
        safeToast("ERROR", "No se encontro la persona vinculada para actualizar.", "danger");
        return;
      }

      setInlinePersonaSaving(true);
      try {
        await personaService.updatePersona(personaId, buildPersonaPayloadFromForm(personaFormState));
        const normalizedPersona = normalizePersonaFormValues(personaFormState);
        setInlinePersonaForm(normalizedPersona);
        setPersonasCatalogo((prev) => {
          const source = Array.isArray(prev) ? prev : [];
          const idKey = String(personaId).trim();
          const index = source.findIndex((item) => String(item?.id_persona ?? "").trim() === idKey);
          const current = index >= 0 ? source[index] : { id_persona: personaId };
          const rtnComplemento = String(normalizedPersona?.rtn ?? "").trim();
          const telefono = String(normalizedPersona?.id_telefono ?? "").trim();
          const direccion = String(normalizedPersona?.id_direccion ?? "").trim();
          const correo = String(normalizedPersona?.id_correo ?? "").trim();

          const patched = {
            ...current,
            id_persona: current?.id_persona ?? personaId,
            nombre: String(normalizedPersona?.nombre ?? "").trim(),
            apellido: String(normalizedPersona?.apellido ?? "").trim(),
            dni: String(normalizedPersona?.dni ?? "").trim(),
            genero: String(normalizedPersona?.genero ?? "").trim(),
            fecha_nacimiento: String(normalizedPersona?.fecha_nacimiento ?? "").trim(),
            rtn: rtnComplemento,
            RTN: rtnComplemento,
            persona_rtn: rtnComplemento,
            persona_rtn_complemento: rtnComplemento,
            rtn_persona: rtnComplemento,
            rtn_complemento: rtnComplemento,
            complemento_rtn: rtnComplemento,
            numero_rtn: rtnComplemento,
            texto_telefono: telefono,
            telefono,
            telefono_numero: telefono,
            numero_telefono: telefono,
            texto_direccion: direccion,
            direccion,
            direccion_detalle: direccion,
            texto_correo: correo,
            direccion_correo: correo,
            correo,
            email: correo,
          };

          if (index >= 0) {
            const next = [...source];
            next[index] = patched;
            return next;
          }

          return [patched, ...source];
        });
        setClientes((prev) =>
          (Array.isArray(prev) ? prev : []).map((item) => {
            if (String(item?.id_cliente ?? "") !== String(editId)) return item;
            return {
              ...item,
              id_persona: item?.id_persona ?? personaId,
              persona_dni: String(normalizedPersona?.dni ?? "").trim(),
              persona_genero: String(normalizedPersona?.genero ?? "").trim(),
              persona_rtn: String(normalizedPersona?.rtn ?? "").trim(),
              persona_rtn_complemento: String(normalizedPersona?.rtn ?? "").trim(),
              rtn_persona: String(normalizedPersona?.rtn ?? "").trim(),
              rtn_complemento: String(normalizedPersona?.rtn ?? "").trim(),
              complemento_rtn: String(normalizedPersona?.rtn ?? "").trim(),
              numero_rtn: String(normalizedPersona?.rtn ?? "").trim(),
              telefono: String(normalizedPersona?.id_telefono ?? "").trim(),
              persona_telefono: String(normalizedPersona?.id_telefono ?? "").trim(),
              direccion: String(normalizedPersona?.id_direccion ?? "").trim(),
              persona_direccion: String(normalizedPersona?.id_direccion ?? "").trim(),
              correo: String(normalizedPersona?.id_correo ?? "").trim(),
              persona_correo: String(normalizedPersona?.id_correo ?? "").trim(),
            };
          })
        );
        setShowPersonaEditModal(false);
        safeToast("OK", "Datos de persona actualizados");
        catalogosCargadosRef.current = false;
        await cargarCatalogos();
        clearClientesListCache();
        await cargarClientes({ force: true });
      } catch (error) {
        safeToast("ERROR", error.message || "No se pudo actualizar la persona.", "danger");
      } finally {
        if (mountedRef.current) setInlinePersonaSaving(false);
      }
    },
    [editId, clientes, form.id_persona, safeToast, clearClientesListCache, cargarClientes, cargarCatalogos]
  );

  const handleInlineEmpresaEditSave = useCallback(
    async (_empresaPayload, empresaFormState) => {
      if (!editId) return;
      const clienteActual = clientes.find((item) => String(item?.id_cliente ?? "") === String(editId));
      const empresaId =
        parsePositiveInteger(form.id_empresa)
        || parsePositiveInteger(clienteActual?.id_empresa_cliente)
        || parsePositiveInteger(clienteActual?.id_empresa);
      if (!empresaId) {
        safeToast("ERROR", "No se encontro la empresa vinculada para actualizar.", "danger");
        return;
      }

      setInlineEmpresaSaving(true);
      try {
        await personaService.updateEmpresa(empresaId, buildEmpresaPayloadFromForm(empresaFormState));
        setInlineEmpresaForm(normalizeEmpresaFormValues(empresaFormState));
        setShowEmpresaEditModal(false);
        safeToast("OK", "Datos de empresa actualizados");
        clearClientesListCache();
        await cargarClientes({ force: true });
      } catch (error) {
        safeToast("ERROR", error.message || "No se pudo actualizar la empresa.", "danger");
      } finally {
        if (mountedRef.current) setInlineEmpresaSaving(false);
      }
    },
    [editId, clientes, form.id_empresa, safeToast, clearClientesListCache, cargarClientes]
  );

  const openPersonaEditModal = useCallback(() => {
    if (!editId) return;
    const clienteActual = clientes.find((item) => String(item?.id_cliente ?? "") === String(editId));
    if (!clienteActual) return;
    setInlinePersonaForm(buildInlinePersonaFormFromCliente(clienteActual));
    setShowPersonaEditModal(true);
  }, [editId, clientes, buildInlinePersonaFormFromCliente]);

  const openEmpresaEditModal = useCallback(() => {
    if (!editId) return;
    const clienteActual = clientes.find((item) => String(item?.id_cliente ?? "") === String(editId));
    if (!clienteActual) return;
    setInlineEmpresaForm(buildInlineEmpresaFormFromCliente(clienteActual));
    setShowEmpresaEditModal(true);
  }, [editId, clientes, buildInlineEmpresaFormFromCliente]);

  const handleNextCreateStep = useCallback(() => {
    setCreateStep(2);
    resetDuplicateResolution();
    if (clienteOriginType === "persona") {
      setUseInlineEmpresaCreate(false);
      setInlineEmpresaForm(emptyInlineEmpresaForm);
      setShowEmpresaCreateModal(false);
      setUseInlinePersonaCreate(true);
      setShowPersonaCreateModal(true);
      setForm((state) => ({ ...state, id_persona: "", id_empresa: "" }));
    } else {
      setUseInlinePersonaCreate(false);
      setInlinePersonaForm(emptyInlinePersonaForm);
      setShowPersonaCreateModal(false);
      setUseInlineEmpresaCreate(true);
      setShowEmpresaCreateModal(true);
      setForm((state) => ({ ...state, id_empresa: "", id_persona: "" }));
    }
  }, [clienteOriginType, resetDuplicateResolution]);

  const handleBackToCreateStepOne = useCallback(() => {
    setCreateStep(1);
    setShowPersonaCreateModal(false);
    setShowEmpresaCreateModal(false);
    resetDuplicateResolution();
  }, [resetDuplicateResolution]);

  const iniciarEdicion = (cliente) => {
    setFiltersOpen(false);
    setEditId(cliente.id_cliente);
    setCreateStep(2);
    setErrors({});
    setUseInlinePersonaCreate(false);
    setUseInlineEmpresaCreate(false);
    setInlinePersonaForm(emptyInlinePersonaForm);
    setInlineEmpresaForm(emptyInlineEmpresaForm);
    setShowPersonaCreateModal(false);
    setShowEmpresaCreateModal(false);
    setShowPersonaEditModal(false);
    setShowEmpresaEditModal(false);
    resetDuplicateResolution();
    const formValues = buildFormFromCliente(cliente);
    const nextOrigin = formValues.id_empresa ? "empresa" : "persona";
    setForm(formValues);
    setClienteOriginType(nextOrigin);
    if (nextOrigin === "empresa") {
      setInlineEmpresaForm(buildInlineEmpresaFormFromCliente(cliente));
    } else {
      setInlinePersonaForm(buildInlinePersonaFormFromCliente(cliente));
    }
    setShowModal(true);
  };

  const openCreate = () => {
    if (actionLoading || deletingId) return;
    setFiltersOpen(false);
    setEditId(null);
    setCreateStep(1);
    setErrors({});
    setForm(emptyForm);
    setClienteOriginType("persona");
    setUseInlinePersonaCreate(false);
    setUseInlineEmpresaCreate(false);
    setInlinePersonaForm(emptyInlinePersonaForm);
    setInlineEmpresaForm(emptyInlineEmpresaForm);
    setShowPersonaCreateModal(false);
    setShowEmpresaCreateModal(false);
    setShowPersonaEditModal(false);
    setShowEmpresaEditModal(false);
    resetDuplicateResolution();
    setShowModal(true);
  };

  const handleOriginTypeChange = (nextType) => {
    if (nextType !== "persona" && nextType !== "empresa") return;
    setClienteOriginType(nextType);
    resetDuplicateResolution();
    setForm((state) =>
      nextType === "persona"
        ? { ...state, id_empresa: "" }
        : { ...state, id_persona: "" }
    );
    const isCreateMode = !editId;
    if (nextType === "persona") {
      setUseInlineEmpresaCreate(false);
      setInlineEmpresaForm(emptyInlineEmpresaForm);
      setShowEmpresaCreateModal(false);
      setShowEmpresaEditModal(false);
      setUseInlinePersonaCreate(isCreateMode ? true : false);
      setShowPersonaCreateModal(isCreateMode && createStep === 2);
    } else {
      setUseInlinePersonaCreate(false);
      setInlinePersonaForm(emptyInlinePersonaForm);
      setShowPersonaCreateModal(false);
      setShowPersonaEditModal(false);
      setUseInlineEmpresaCreate(isCreateMode ? true : false);
      setShowEmpresaCreateModal(isCreateMode && createStep === 2);
    }
    setErrors((state) => ({ ...state, id_persona: undefined, id_empresa: undefined }));
  };

  const openConfirmDelete = (cliente) =>
    setConfirmModal({
      show: true,
      idToDelete: cliente?.id_cliente ?? null,
      nombre: firstNonEmptyValue(cliente?.nombre_principal, getClientePrincipalNombre(cliente)),
    });

  const closeConfirmDelete = () =>
    setConfirmModal({ show: false, idToDelete: null, nombre: "" });

  const eliminarConfirmado = async () => {
    const id = confirmModal.idToDelete;
    if (!id || actionLoading || deletingId) return;

    setDeletingId(id);
    try {
      await personaService.updateCliente(id, { estado: false });

      if (String(editId) === String(id)) {
        closeFormDrawer();
        setEditId(null);
        setForm(emptyForm);
      }

      const quedaVaciaPagina = clientes.length === 1 && page > 1;
      if (quedaVaciaPagina) {
        setPage((prev) => Math.max(1, prev - 1));
      } else {
        clearClientesListCache();
        await cargarClientes({ force: true });
      }

      safeToast("OK", "Cliente inactivado");
      closeConfirmDelete();
      await cargarClientesGlobalStats();
    } catch (error) {
      safeToast("ERROR", error.message || "No se pudo inactivar", "danger");
      clearClientesListCache();
      await cargarClientes({ force: true });
    } finally {
      if (mountedRef.current) setDeletingId(null);
    }
  };

  const clientesFiltrados = useMemo(() => {
    const needle = search.toLowerCase().trim();
    const list = [...(Array.isArray(clientes) ? clientes : [])];

    const filtered = list.filter((cliente) => {
      const activo = isActivo(cliente);
      const matchEstado =
        estadoFiltro === "todos" ? true : estadoFiltro === "activo" ? activo : !activo;
      if (!matchEstado) return false;

      if (!needle) return true;

      const hay = [
        cliente?.nombre_principal,
        cliente?.origen_label,
        cliente?.tipo_cliente,
        cliente?.documento_valor,
        cliente?.dni,
        cliente?.rtn,
        cliente?.telefono,
        cliente?.correo,
        cliente?.puntos,
        cliente?.fecha_ingreso,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(needle);
    });

    filtered.sort((a, b) => {
      if (sortBy === "nombre_asc") {
        return getClientePrincipalNombre(a).localeCompare(getClientePrincipalNombre(b), "es", { sensitivity: "base" });
      }
      if (sortBy === "nombre_desc") {
        return getClientePrincipalNombre(b).localeCompare(getClientePrincipalNombre(a), "es", { sensitivity: "base" });
      }
      return Number(b?.id_cliente ?? 0) - Number(a?.id_cliente ?? 0);
    });

    return filtered;
  }, [clientes, search, estadoFiltro, sortBy, getClientePrincipalNombre]);
  const pageWindowLabel = useMemo(
    () => buildPageRangeLabel({ page, limit, total, currentLength: clientesFiltrados.length }),
    [clientesFiltrados.length, limit, page, total]
  );

  const predictiveSuggestions = useMemo(() => {
    const searchTerm = normalizeSearchText(search).toLowerCase();
    if (searchTerm.length < MIN_CHARS_FOR_SUGGESTIONS) return [];

    const source = Array.isArray(clientes) ? clientes : [];
    const suggestions = [];
    const seen = new Set();

    for (const cliente of source) {
      const activo = isActivo(cliente);
      const matchEstado =
        estadoFiltro === "todos" ? true : estadoFiltro === "activo" ? activo : !activo;
      if (!matchEstado) continue;

      const nombre = toDisplayValue(cliente?.nombre_principal, "Cliente sin nombre");
      const documento = toDisplayValue(cliente?.documento_valor, "");
      const telefono = toDisplayValue(cliente?.telefono, "");
      const correo = toDisplayValue(cliente?.correo, "");
      const tipo = toDisplayValue(cliente?.tipo_cliente, "");
      const haystack = [nombre, documento, telefono, correo, tipo].join(" ").toLowerCase();
      if (!haystack.includes(searchTerm)) continue;

      const dedupeKey = normalizeValue(nombre);
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const detailParts = [];
      if (documento && documento !== "No registrado") detailParts.push(documento);
      if (correo && correo !== "No registrado") detailParts.push(correo);
      else if (telefono && telefono !== "No registrado") detailParts.push(telefono);
      if (!detailParts.length && tipo && tipo !== "No registrado") detailParts.push(tipo);

      suggestions.push({
        id: `cli-${cliente?.id_cliente ?? dedupeKey}`,
        value: nombre,
        label: nombre,
        detail: detailParts.join(" | ") || "Cliente registrado",
      });

      if (suggestions.length >= SUGGESTION_LIMIT) break;
    }

    return suggestions;
  }, [clientes, estadoFiltro, search]);

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
    recentStorageKey: "clientesRecentSearchesV2",
  });

  const stats = useMemo(
    () => ({
      total: globalStats.total,
      activas: globalStats.activas,
      inactivas: globalStats.inactivas,
    }),
    [globalStats]
  );

  const hasActiveFilters = useMemo(
    () => search.trim() !== "" || estadoFiltro !== "activo" || sortBy !== "recientes",
    [search, estadoFiltro, sortBy]
  );

  const drawerMode = editId ? "edit" : "create";
  const isCreateFlow = drawerMode === "create";
  const isCreateStepOne = isCreateFlow && createStep === 1;
  const isCreateStepTwo = !isCreateFlow || createStep === 2;
  const colsClass = cardsPerPage >= 6 ? "cols-3" : cardsPerPage >= 4 ? "cols-2" : "cols-1";
  const _personaDisabled = actionLoading || clienteOriginType === "empresa";
  const _empresaDisabled = actionLoading || clienteOriginType === "persona";
  const formOriginLabel = clienteOriginType === "empresa" ? "Cliente Empresa" : "Cliente Persona";
  const isInlinePersonaFlow = drawerMode === "create" && clienteOriginType === "persona" && useInlinePersonaCreate;
  const isInlineEmpresaFlow = drawerMode === "create" && clienteOriginType === "empresa" && useInlineEmpresaCreate;
  const createSubtitle = isCreateStepOne
    ? "Paso 1 de 2: elige si el cliente sera Persona o Empresa."
    : isInlinePersonaFlow
      ? "Paso 2 de 2: completa la persona y finaliza el cliente."
      : isInlineEmpresaFlow
        ? "Paso 2 de 2: completa la empresa y finaliza el cliente."
        : "Paso 2 de 2: completa el registro base y guarda el cliente.";
  const clienteEditando = useMemo(
    () => (drawerMode === "edit"
      ? clientes.find((item) => String(item?.id_cliente ?? "") === String(editId ?? "")) || null
      : null),
    [drawerMode, clientes, editId]
  );
  const editPersonaSummary = useMemo(() => {
    if (!clienteEditando) return emptyInlinePersonaForm;

    const hasInlinePersonaData = Boolean(
      String(inlinePersonaForm?.nombre ?? "").trim()
      || String(inlinePersonaForm?.apellido ?? "").trim()
      || String(inlinePersonaForm?.dni ?? "").trim()
      || String(inlinePersonaForm?.rtn ?? "").trim()
    );
    if (hasInlinePersonaData) return inlinePersonaForm;
    return buildInlinePersonaFormFromCliente(clienteEditando);
  }, [clienteEditando, inlinePersonaForm, buildInlinePersonaFormFromCliente]);
  const editEmpresaSummary = useMemo(() => {
    if (!clienteEditando) return emptyInlineEmpresaForm;

    const hasInlineEmpresaData = Boolean(
      String(inlineEmpresaForm?.nombre_empresa ?? "").trim()
      || String(inlineEmpresaForm?.rtn ?? "").trim()
      || String(inlineEmpresaForm?.id_correo ?? "").trim()
      || String(inlineEmpresaForm?.id_telefono ?? "").trim()
    );
    if (hasInlineEmpresaData) return inlineEmpresaForm;
    return buildInlineEmpresaFormFromCliente(clienteEditando);
  }, [clienteEditando, inlineEmpresaForm, buildInlineEmpresaFormFromCliente]);

  const openFiltersDrawer = () => {
    if (actionLoading) return;
    closeFormDrawer();
    setFiltersDraft({ estadoFiltro, sortBy });
    setFiltersOpen(true);
  };

  const closeFiltersDrawer = () => setFiltersOpen(false);

  const applyFiltersDrawer = () => {
    setEstadoFiltro(filtersDraft.estadoFiltro === "inactivo" ? "inactivo" : "activo");
    setSortBy(filtersDraft.sortBy || "recientes");
    setFiltersOpen(false);
  };

  const clearVisualFilters = () => {
    setEstadoFiltro("activo");
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
    <div className="personas-page personas-page--clientes">
      <div className="inv-catpro-card inv-prod-card personas-page__panel mb-3" ref={panelRef}>
        <HeaderModulo
          iconClass="bi bi-person-lines-fill"
          title="Clientes"
          subtitle="Gestion visual de clientes"
          search={search}
          onSearchChange={handleSearchInputChange}
          searchPlaceholder="Buscar por persona, empresa, tipo, DNI, telefono o correo..."
          searchAriaLabel="Buscar clientes"
          filtersOpen={filtersOpen}
          onOpenFilters={openFiltersDrawer}
          createOpen={showModal}
          onOpenCreate={openCreate}
          createLabel="Nuevo"
          filtersControlsId="cli-filtros-drawer"
          formControlsId="cli-form-drawer"
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

        <ModuleKPICards stats={stats} totalLabel="Total de clientes" />

        <div className="inv-catpro-body inv-prod-body p-3">
          <div className="inv-prod-results-meta personas-page__results-meta">
            <span>{loading ? "Cargando clientes..." : `${clientesFiltrados.length} resultados`}</span>
            <span>{loading ? "" : `Total: ${total}`}</span>
            <label className="form-check form-switch mb-0 personas-page__inactive-toggle inv-catpro-inline-toggle">
              <input
                className="form-check-input"
                type="checkbox"
                role="switch"
                checked={estadoFiltro === "inactivo"}
                onChange={(event) => {
                  const nextEstado = event.target.checked ? "inactivo" : "activo";
                  setEstadoFiltro(nextEstado);
                  setFiltersDraft((state) => ({ ...state, estadoFiltro: nextEstado }));
                  setPage((prev) => (prev === 1 ? prev : 1));
                }}
                aria-label="Ver inactivos"
              />
              <span className="form-check-label">Ver inactivos</span>
            </label>
            {hasActiveFilters ? <span className="inv-prod-active-filter-pill">Filtros activos</span> : null}
          </div>

          <div className={`inv-catpro-list ${isAnyDrawerOpen ? "drawer-open" : ""}`}>
            {loading ? (
              <div className="inv-catpro-loading" role="status" aria-live="polite">
                <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                <span>Cargando clientes...</span>
              </div>
            ) : clientesFiltrados.length === 0 ? (
              <div className="inv-catpro-empty">
                <div className="inv-catpro-empty-icon">
                  <i className="bi bi-person-lines-fill" />
                </div>
                <div className="inv-catpro-empty-title">No hay clientes para mostrar</div>
                <div className="inv-catpro-empty-sub">
                  {hasActiveFilters ? "Prueba limpiar filtros o crea un nuevo cliente." : "Crea tu primer cliente."}
                </div>

                <div className="d-flex gap-2 justify-content-center flex-wrap">
                  {hasActiveFilters ? (
                    <button type="button" className="btn btn-outline-secondary" onClick={clearAllFilters}>
                      Limpiar filtros
                    </button>
                  ) : null}
                  <button type="button" className="btn btn-primary" onClick={openCreate}>
                    Nuevo cliente
                  </button>
                </div>
              </div>
            ) : isTableView ? (
              <EntityTable>
                <table className="table personas-page__table">
                  <thead>
                    <tr>
                      <th scope="col">Cliente</th>
                      <th scope="col">Empresa</th>
                      <th scope="col">Documento</th>
                      <th scope="col">Telefono</th>
                      <th scope="col">Correo</th>
                      <th scope="col">Puntos</th>
                      <th scope="col">Fecha registro</th>
                      <th scope="col">Estado</th>
                      <th scope="col">Codigo</th>
                      <th scope="col" className="text-end">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientesFiltrados.map((cliente, idx) => {
                      const isActive = isActivo(cliente);
                      const idCliente = cliente?.id_cliente;
                      const deleting = deletingId === idCliente;
                      const tableIndex = (page - 1) * limit + idx;

                      return (
                        <tr key={cliente?.id_cliente ?? idx} className={isActive ? "" : "is-inactive-state"}>
                          <td>
                            <div className="clientes-origin-cell">
                              <strong>{tableIndex + 1}. {toDisplayValue(cliente?.nombre_principal, "Cliente sin nombre")}</strong>
                              <span
                                className={`clientes-origin-chip ${cliente?.origen_cliente === "empresa" ? "is-empresa" : "is-persona"}`}
                              >
                                {toDisplayValue(cliente?.origen_label, "Cliente Persona")}
                              </span>
                              {cliente?.direccion && cliente?.direccion !== "No registrada" && (
                                <div className="text-muted small mt-1">
                                  <i className="bi bi-geo-alt me-1" />
                                  {cliente.direccion}
                                </div>
                              )}
                            </div>
                          </td>
                          <td>{toDisplayValue(cliente?.nombre_empresa)}</td>
                          <td>{toDisplayValue(cliente?.documento_valor, "N/D")}</td>
                          <td>{toDisplayValue(cliente?.telefono, "Sin telefono")}</td>
                          <td>{toDisplayValue(cliente?.correo, "Sin correo")}</td>
                          <td>
                            <span className="badge bg-secondary rounded-pill">
                              {cliente?.puntos ?? 0} pts
                            </span>
                          </td>
                          <td>{formatDateLabel(cliente?.fecha_ingreso)}</td>
                          <td>
                            <span className={`inv-ins-card__badge ${isActive ? "is-ok" : "is-inactive"}`}>
                              {isActive ? "ACTIVO" : "INACTIVO"}
                            </span>
                          </td>
                          <td>
                            <div className="inv-catpro-code-wrap personas-page__table-code-wrap">
                              <span className={`inv-catpro-state-dot ${isActive ? "ok" : "off"}`} />
                              <span className="inv-catpro-code">
                                {toDisplayValue(cliente?.codigo_cliente, `CLI-${String(idCliente ?? "-")}`)}
                              </span>
                            </div>
                          </td>
                          <td className="text-end">
                            <div className="personas-page__table-actions">
                              <button
                                type="button"
                                className="inv-catpro-action edit inv-catpro-action-compact"
                                onClick={() => iniciarEdicion(cliente)}
                                title="Editar"
                                disabled={actionLoading || deleting}
                              >
                                <i className="bi bi-pencil-square" />
                                <span className="inv-catpro-action-label">Editar</span>
                              </button>

                              <button
                                type="button"
                                className="inv-catpro-action danger inv-catpro-action-compact"
                                onClick={() => openConfirmDelete(cliente)}
                                title={isActive ? "Inactivar" : "Inactivo"}
                                disabled={actionLoading || deleting || !isActive}
                              >
                                <i className={`bi ${deleting ? "bi-hourglass-split" : "bi-slash-circle"}`} />
                                <span className="inv-catpro-action-label">{deleting ? "Inactivando..." : "Inactivar"}</span>
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
                {clientesFiltrados.map((cliente, idx) => (
                  <ClienteCard
                    key={cliente?.id_cliente ?? idx}
                    cliente={cliente}
                    index={(page - 1) * limit + idx}
                    onOpenEdit={iniciarEdicion}
                    onOpenDelete={openConfirmDelete}
                    actionLoading={actionLoading}
                    deletingId={deletingId}
                    personaRtnCatalog={personaRtnById.get(String(cliente?.id_persona ?? "").trim()) || ""}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="inv-warehouse-moves__pagination inv-ins-pagination">
            <div className="inv-warehouse-moves__pagination-meta inv-ins-pagination__page">
              {`Mostrando ${pageWindowLabel} de ${total}`}
            </div>

            <div className="inv-warehouse-moves__pagination-controls">
              <button
                type="button"
                className="inv-prod-toolbar-btn inv-warehouse-moves__page-btn"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1 || loading || actionLoading || !!deletingId}
                aria-label="Pagina anterior"
              >
                <i className="bi bi-chevron-left" aria-hidden="true" />
                <span>Anterior</span>
              </button>

              <div className="inv-warehouse-moves__pagination-pages">
                {visiblePageNumbers.map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    className={`inv-warehouse-moves__page-number ${pageNumber === page ? "is-active" : ""}`.trim()}
                    onClick={() => setPage(pageNumber)}
                    aria-label={`Ir a la pagina ${pageNumber}`}
                    aria-current={pageNumber === page ? "page" : undefined}
                  >
                    {pageNumber}
                  </button>
                ))}
              </div>

              <div className="inv-warehouse-moves__pagination-status inv-ins-pagination__page">
                {`Pagina ${page} de ${totalPages}`}
              </div>

              <button
                type="button"
                className="inv-prod-toolbar-btn inv-warehouse-moves__page-btn"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages || loading || actionLoading || !!deletingId}
                aria-label="Pagina siguiente"
              >
                <span>Siguiente</span>
                <i className="bi bi-chevron-right" aria-hidden="true" />
              </button>
            </div>
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
        drawerId="cli-filtros-drawer"
        iconClass="bi bi-person-lines-fill"
        title="Filtros de clientes"
        subtitle="Estado y orden visual del listado"
        draft={filtersDraft}
        onChangeDraft={setFiltersDraft}
        onClose={closeFiltersDrawer}
        onApply={applyFiltersDrawer}
        onClear={clearVisualFilters}
        allowAll={false}
        activeLabel="Activos"
        inactiveLabel="Inactivos"
      />

      <aside
        className={`inv-prod-drawer inv-cat-v2__drawer crud-modal clientes-modal ${showModal ? "show" : ""} ${
          drawerMode === "create" ? "is-create" : "is-edit"
        }`}
        id="cli-form-drawer"
        role="dialog"
        aria-modal="true"
        aria-hidden={!showModal}
      >
        <div className="inv-prod-drawer-head crud-modal__header">
          <div className="crud-modal__header-copy crud-modal__header-copy--insumo">
            <div className="crud-modal__hero-icon" aria-hidden="true">
              <i className="bi bi-people" />
            </div>
            <div className="crud-modal__hero-main">
              <div className="crud-modal__hero-kicker">{drawerMode === "create" ? "Nuevo registro" : "Edicion activa"}</div>
              <div className="inv-prod-drawer-title crud-modal__title">{drawerMode === "create" ? "Nuevo cliente" : "Editar cliente"}</div>
              <div className="inv-prod-drawer-sub crud-modal__subtitle">
                {drawerMode === "create" ? createSubtitle : "Actualiza los campos necesarios y guarda los cambios."}
              </div>
            </div>
            <div className="crud-modal__hero-chips">
              <span className="crud-modal__hero-chip">
                <i className="bi bi-person-check" /> Persona o empresa
              </span>
              <span className="crud-modal__hero-chip">
                <i className="bi bi-shield-check" /> Alta controlada
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
          {isCreateStepOne ? (
            <>
              <div className="clientes-modal__origin-helper">
                <div
                  className="personas-page__view-toggle clientes-modal__origin-toggle"
                  role="tablist"
                  aria-label="Tipo de cliente"
                >
                  <button
                    type="button"
                    className={`personas-page__view-btn clientes-modal__origin-option ${clienteOriginType === "persona" ? "is-active" : ""}`}
                    onClick={() => handleOriginTypeChange("persona")}
                    disabled={actionLoading || !isCreateFlow}
                    aria-pressed={clienteOriginType === "persona"}
                    title="Cliente Persona"
                  >
                    Cliente Persona
                  </button>
                  <button
                    type="button"
                    className={`personas-page__view-btn clientes-modal__origin-option ${clienteOriginType === "empresa" ? "is-active" : ""}`}
                    onClick={() => handleOriginTypeChange("empresa")}
                    disabled={actionLoading || !isCreateFlow}
                    aria-pressed={clienteOriginType === "empresa"}
                    title="Cliente Empresa"
                  >
                    Cliente Empresa
                  </button>
                </div>

                <div className="clientes-modal__origin-row">
                  <span
                    className={`clientes-origin-chip ${clienteOriginType === "empresa" ? "is-empresa" : "is-persona"}`}
                  >
                    {formOriginLabel}
                  </span>
                  <span className="clientes-modal__origin-caption">Paso 1: define el origen del cliente</span>
                </div>
                <p className="clientes-modal__origin-text">
                  Primero selecciona si el cliente sera Persona o Empresa y luego presiona Siguiente.
                </p>
              </div>

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
                  type="button"
                  className="btn inv-prod-btn-primary flex-fill crud-modal__btn"
                  onClick={handleNextCreateStep}
                  disabled={actionLoading || !!deletingId}
                >
                  Siguiente
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="clientes-modal__origin-helper">
                <div className="clientes-modal__origin-row">
                  <span
                    className={`clientes-origin-chip ${clienteOriginType === "empresa" ? "is-empresa" : "is-persona"}`}
                  >
                    {formOriginLabel}
                  </span>
                  <span className="clientes-modal__origin-caption">
                    {isCreateStepTwo && isCreateFlow ? "Paso 2: completa datos y finaliza el cliente" : "Origen actual del cliente"}
                  </span>
                </div>
                <p className="clientes-modal__origin-text">
                  {isCreateFlow
                    ? "Completa una sola vez los datos base y el sistema creara persona/empresa + cliente automaticamente."
                    : "Edita los datos del cliente y tambien los datos de la persona o empresa vinculada."}
                </p>
                <div
                  className="personas-page__view-toggle clientes-modal__origin-toggle"
                  role="tablist"
                  aria-label="Tipo de cliente"
                >
                  <button
                    type="button"
                    className={`personas-page__view-btn clientes-modal__origin-option ${clienteOriginType === "persona" ? "is-active" : ""}`}
                    onClick={() => handleOriginTypeChange("persona")}
                    disabled={actionLoading}
                    aria-pressed={clienteOriginType === "persona"}
                    title="Cliente Persona"
                  >
                    Cliente Persona
                  </button>
                  <button
                    type="button"
                    className={`personas-page__view-btn clientes-modal__origin-option ${clienteOriginType === "empresa" ? "is-active" : ""}`}
                    onClick={() => handleOriginTypeChange("empresa")}
                    disabled={actionLoading}
                    aria-pressed={clienteOriginType === "empresa"}
                    title="Cliente Empresa"
                  >
                    Cliente Empresa
                  </button>
                </div>
              </div>

              <div className="row g-3 crud-modal__grid">
                {clienteOriginType === "persona" ? (
                  <div className="col-12">
                    {isCreateFlow ? (
                      <div className="smart-select-entity__summary clientes-inline-summary clientes-modal__entity-block">
                        <div className="clientes-inline-summary__head">
                          <span
                            className={`clientes-inline-summary__status ${String(inlinePersonaForm.nombre ?? "").trim() ? "is-ready" : "is-pending"}`}
                          >
                            <i className={`bi ${String(inlinePersonaForm.nombre ?? "").trim() ? "bi-check2-circle" : "bi-info-circle"}`} />
                            {String(inlinePersonaForm.nombre ?? "").trim() ? "Persona lista" : "Pendiente"}
                          </span>
                          <span className="clientes-inline-summary__kind">Base Persona</span>
                        </div>
                        <div className="clientes-inline-summary__text">
                          {String(inlinePersonaForm.nombre ?? "").trim()
                            ? "Excelente. Ya puedes completar y guardar el cliente."
                            : "Primero completa los datos de la persona para continuar."}
                        </div>
                        <div className="clientes-inline-summary__meta-grid">
                          <div className="clientes-inline-summary__meta-item">
                            <span>Nombre</span>
                            <strong>
                              {String(inlinePersonaForm.nombre ?? "").trim() || "Sin nombre"}{" "}
                              {String(inlinePersonaForm.apellido ?? "").trim()}
                            </strong>
                          </div>
                          <div className="clientes-inline-summary__meta-item">
                            <span>Documento</span>
                            <strong>DNI: {toDisplayValue(inlinePersonaForm.dni, "N/D")}</strong>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm clientes-inline-summary__action"
                          onClick={() => setShowPersonaCreateModal(true)}
                          disabled={actionLoading}
                        >
                          <i className="bi bi-pencil-square me-2" />
                          {String(inlinePersonaForm.nombre ?? "").trim()
                            ? "Editar formulario de persona"
                            : "Abrir formulario de persona"}
                        </button>
                      </div>
                    ) : (
                      <div className="smart-select-entity__summary clientes-inline-summary clientes-modal__entity-block">
                        <div className="clientes-inline-summary__head">
                          <span className="clientes-inline-summary__status is-ready">
                            <i className="bi bi-check2-circle" />
                            Persona vinculada
                          </span>
                          <span className="clientes-inline-summary__kind">Base Persona</span>
                        </div>
                        <div className="clientes-inline-summary__text">
                          Edita los datos de la persona vinculada cuando lo necesites.
                        </div>
                        <div className="clientes-inline-summary__meta-grid">
                          <div className="clientes-inline-summary__meta-item">
                            <span>Nombre</span>
                            <strong>
                              {toDisplayValue(
                                `${String(editPersonaSummary?.nombre ?? "").trim()} ${String(editPersonaSummary?.apellido ?? "").trim()}`.trim(),
                                "Sin nombre"
                              )}
                            </strong>
                          </div>
                          <div className="clientes-inline-summary__meta-item">
                            <span>Documento</span>
                            <strong>DNI: {toDisplayValue(editPersonaSummary?.dni, "N/D")}</strong>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm clientes-inline-summary__action"
                          onClick={openPersonaEditModal}
                          disabled={actionLoading}
                        >
                          <i className="bi bi-pencil-square me-2" />
                          Editar datos de persona
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="col-12">
                    {isCreateFlow ? (
                      <div className="smart-select-entity__summary clientes-inline-summary clientes-modal__entity-block">
                        <div className="clientes-inline-summary__head">
                          <span
                            className={`clientes-inline-summary__status ${String(inlineEmpresaForm.nombre_empresa ?? "").trim() ? "is-ready" : "is-pending"}`}
                          >
                            <i className={`bi ${String(inlineEmpresaForm.nombre_empresa ?? "").trim() ? "bi-check2-circle" : "bi-info-circle"}`} />
                            {String(inlineEmpresaForm.nombre_empresa ?? "").trim() ? "Empresa lista" : "Pendiente"}
                          </span>
                          <span className="clientes-inline-summary__kind">Base Empresa</span>
                        </div>
                        <div className="clientes-inline-summary__text">
                          {String(inlineEmpresaForm.nombre_empresa ?? "").trim()
                            ? "Excelente. Ya puedes completar y guardar el cliente."
                            : "Primero completa los datos de la empresa para continuar."}
                        </div>
                        <div className="clientes-inline-summary__meta-grid">
                          <div className="clientes-inline-summary__meta-item">
                            <span>Empresa</span>
                            <strong>{String(inlineEmpresaForm.nombre_empresa ?? "").trim() || "Sin nombre de empresa"}</strong>
                          </div>
                          <div className="clientes-inline-summary__meta-item">
                            <span>Documento</span>
                            <strong>RTN: {toDisplayValue(inlineEmpresaForm.rtn, "N/D")}</strong>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm clientes-inline-summary__action"
                          onClick={() => setShowEmpresaCreateModal(true)}
                          disabled={actionLoading}
                        >
                          <i className="bi bi-pencil-square me-2" />
                          {String(inlineEmpresaForm.nombre_empresa ?? "").trim()
                            ? "Editar formulario de empresa"
                            : "Abrir formulario de empresa"}
                        </button>
                      </div>
                    ) : (
                      <div className="smart-select-entity__summary clientes-inline-summary clientes-modal__entity-block">
                        <div className="clientes-inline-summary__head">
                          <span className="clientes-inline-summary__status is-ready">
                            <i className="bi bi-check2-circle" />
                            Empresa vinculada
                          </span>
                          <span className="clientes-inline-summary__kind">Base Empresa</span>
                        </div>
                        <div className="clientes-inline-summary__text">
                          Edita los datos de la empresa vinculada cuando lo necesites.
                        </div>
                        <div className="clientes-inline-summary__meta-grid">
                          <div className="clientes-inline-summary__meta-item">
                            <span>Empresa</span>
                            <strong>{toDisplayValue(editEmpresaSummary?.nombre_empresa, "Sin nombre de empresa")}</strong>
                          </div>
                          <div className="clientes-inline-summary__meta-item">
                            <span>Documento</span>
                            <strong>RTN: {toDisplayValue(editEmpresaSummary?.rtn, "N/D")}</strong>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm clientes-inline-summary__action"
                          onClick={openEmpresaEditModal}
                          disabled={actionLoading}
                        >
                          <i className="bi bi-pencil-square me-2" />
                          Editar datos de empresa
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {isCreateFlow && duplicateResolution.visible ? (
                  <div className="col-12">
                    <div className="alert alert-warning mb-0">
                      <div className="fw-semibold mb-1">Ya existe registro base</div>
                      <div className="small">
                        {duplicateResolution.message || "Ya existe un registro con el mismo documento y no se creara duplicado."}
                      </div>
                      {duplicateResolution.suggestedLabel ? (
                        <div className="small mt-1">
                          Sugerido: <strong>{duplicateResolution.suggestedLabel}</strong>
                        </div>
                      ) : null}
                      <div className="mt-2">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-dark"
                          onClick={handleVincularDuplicado}
                          disabled={actionLoading}
                        >
                          Vincular existente
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Sprint 5: tipo_cliente, fecha_ingreso y puntos se gestionan en backend/BD */}

                {drawerMode === "edit" ? (
                  <div className="col-12">
                    <div className="form-check form-switch m-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="cliente_estado"
                        checked={Boolean(form.estado)}
                        onChange={(event) => setForm((state) => ({ ...state, estado: event.target.checked }))}
                      />
                      <label className="form-check-label text-light text-opacity-75" htmlFor="cliente_estado">
                        Registro activo
                      </label>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="d-flex gap-2 mt-4 crud-modal__footer">
                {isCreateFlow ? (
                  <button
                    type="button"
                    className="btn inv-prod-btn-subtle flex-fill crud-modal__btn"
                    onClick={handleBackToCreateStepOne}
                    disabled={actionLoading || !!deletingId}
                  >
                    Anterior
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn inv-prod-btn-subtle flex-fill crud-modal__btn"
                    onClick={closeFormDrawer}
                    disabled={actionLoading || !!deletingId}
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  className="btn inv-prod-btn-primary flex-fill crud-modal__btn"
                  disabled={actionLoading || !!deletingId}
                >
                  {actionLoading ? "Guardando..." : drawerMode === "create" ? "Crear cliente" : "Guardar cambios"}
                </button>
              </div>
            </>
          )}
        </form>
      </aside>

      <PersonaInlineCreateModal
        show={
          showModal
          && (
            (
              drawerMode === "create"
              && clienteOriginType === "persona"
              && useInlinePersonaCreate
              && showPersonaCreateModal
            )
            || (drawerMode === "edit" && showPersonaEditModal)
          )
        }
        initialForm={inlinePersonaForm}
        title={drawerMode === "edit" ? "Editar persona vinculada" : "Nueva persona"}
        subtitle={
          drawerMode === "edit"
            ? "Actualiza los datos de la persona y guarda los cambios."
            : "Completa los campos y guarda los cambios."
        }
        saving={inlinePersonaSaving}
        onClose={() => {
          if (drawerMode === "edit") {
            setShowPersonaEditModal(false);
            return;
          }
          setShowPersonaCreateModal(false);
        }}
        onSave={drawerMode === "edit" ? handleInlinePersonaEditSave : handleInlinePersonaModalSave}
      />

      <EmpresaInlineCreateModal
        show={
          showModal
          && (
            (
              drawerMode === "create"
              && clienteOriginType === "empresa"
              && useInlineEmpresaCreate
              && showEmpresaCreateModal
            )
            || (drawerMode === "edit" && showEmpresaEditModal)
          )
        }
        initialForm={inlineEmpresaForm}
        title={drawerMode === "edit" ? "Editar empresa vinculada" : "Crear empresa para este cliente"}
        subtitle={
          drawerMode === "edit"
            ? "Actualiza los datos de la empresa y guarda los cambios."
            : "Completa este paso y luego regresa para terminar el registro del cliente."
        }
        saving={inlineEmpresaSaving}
        onClose={() => {
          if (drawerMode === "edit") {
            setShowEmpresaEditModal(false);
            return;
          }
          setShowEmpresaCreateModal(false);
        }}
        onSave={drawerMode === "edit" ? handleInlineEmpresaEditSave : handleInlineEmpresaModalSave}
      />

      {confirmModal.show && (
        <div className="inv-pro-confirm-backdrop" role="dialog" aria-modal="true" onClick={closeConfirmDelete}>
          <div className="inv-pro-confirm-panel" onClick={(event) => event.stopPropagation()}>
            <div className="inv-pro-confirm-head">
              <div className="inv-pro-confirm-head-icon">
                <i className="bi bi-exclamation-triangle-fill" />
              </div>
              <div>
                <div className="inv-pro-confirm-title">CONFIRMAR INACTIVACION</div>
                <div className="inv-pro-confirm-sub">El cliente se ocultara del listado activo</div>
              </div>
              <button type="button" className="inv-pro-confirm-close" onClick={closeConfirmDelete} aria-label="Cerrar">
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <div className="inv-pro-confirm-body">
              <div className="inv-pro-confirm-question">Deseas inactivar este cliente?</div>
              <div className="inv-pro-confirm-name">
                <i className="bi bi-person-lines-fill" />
                <span>{confirmModal.nombre || "Cliente seleccionado"}</span>
              </div>
            </div>

            <div className="inv-pro-confirm-footer">
              <button type="button" className="btn inv-pro-btn-cancel" onClick={closeConfirmDelete}>
                Cancelar
              </button>
              <button type="button" className="btn inv-pro-btn-danger" onClick={eliminarConfirmado}>
                <i className="bi bi-slash-circle" />
                <span>Inactivar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clientes;
