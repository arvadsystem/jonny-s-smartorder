import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Select from "react-select";
import { usePermisos } from "../../../context/PermisosContext";
import { useAuth } from "../../../hooks/useAuth";
import { personaService } from "../../../services/personasService";
import { PERMISSIONS } from "../../../utils/permissions";
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
import PersonaInlineCreateModal from "./components/common/PersonaInlineCreateModal";
import EmpresaInlineCreateModal from "./components/common/EmpresaInlineCreateModal";
import {
  buildPersonaPayloadFromForm,
  digitsOnly as digitsOnlyPersona,
  createInitialPersonaForm,
  formatDNI,
  formatPhone as formatPersonaPhone,
  limit as limitPersonaDigits,
  normalizeHumanNameInput,
  normalizePersonaFormValues,
  validatePersonaForm,
} from "./components/common/persona-form-shared";
import {
  buildEmpresaPayloadFromForm,
  createInitialEmpresaForm,
  digitsOnly as digitsOnlyEmpresa,
  formatPhone as formatEmpresaPhone,
  formatRtn,
  limitText as limitEmpresaDigits,
  normalizeEmpresaFormValues,
  validateEmpresaForm,
} from "./components/common/empresa-form-shared";
import "./components/common/crud-modal-theme.css";
import "./components/clientes/clientes-persona-select.css";

const emptyForm = {
  id_persona: "",
  id_empresa: "",
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
  tipoFiltro: "todos",
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

const normalizeValue = (value) => String(value ?? "").trim().toLowerCase();
const normalizeSearchKey = (value) => String(value ?? "").trim().toLowerCase();

const ASYNC_SELECT_LIMIT = 80;
const ASYNC_SELECT_DEBOUNCE_MS = 300;
const SUGGESTION_LIMIT = 8;
const MAX_CLIENTES_PAGE_CACHE = 24;
const GLOBAL_STATS_FETCH_LIMIT = 1;
const PERSONAS_CATALOGO_PAGE_LIMIT = 200;
const PERSONAS_CATALOGO_MAX_PAGES = 200;
const CLIENTES_FILTRO_SCAN_MAX_PAGES = 200;
const CLIENTES_FILTRO_SCAN_CONCURRENCY = 4;
const CLIENTES_FORCE_COMPAT_CREATE_FLAG = "clientes_force_compat_create_v1";

const isAbortError = (error) =>
  Boolean(error) && (
    error.name === "AbortError" ||
    error.code === "ABORT_ERR" ||
    String(error.message || "").toLowerCase().includes("aborted")
  );

const _filterAsyncOptions = (options, needle, limit = ASYNC_SELECT_LIMIT) => {
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

const isUnregisteredPlaceholder = (value) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return (
    normalized === "no registrado"
    || normalized === "no registrada"
    || normalized === "n/d"
    || normalized === "na"
    || normalized === "sin registro"
  );
};

const sanitizeOptionalSeedValue = (value) => {
  if (value === null || value === undefined) return "";
  if (isUnregisteredPlaceholder(value)) return "";
  return String(value).trim();
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
      cliente?.nombre_tipo_cliente,
      "General"
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

const Clientes = ({ openToast, selectedSucursalId = "" }) => {
  const { canAny } = usePermisos();
  const { user } = useAuth();
  const canCreateCliente = canAny([PERMISSIONS.CLIENTES_CREAR]);
  const canListPersonas = canAny([PERMISSIONS.PERSONAS_LISTADO_VER, PERMISSIONS.PERSONAS_VER]);
  const canListEmpresas = canAny([PERMISSIONS.EMPRESAS_LISTADO_VER, PERMISSIONS.EMPRESAS_VER]);
  const canCreateEmpresaDesdeClientes = canAny([PERMISSIONS.EMPRESAS_CREAR_DESDE_CLIENTES, PERMISSIONS.EMPRESAS_CREAR]);
  const canEditCliente = canAny([PERMISSIONS.CLIENTES_EDITAR]);
  const canInactivateCliente = canAny([PERMISSIONS.CLIENTES_ESTADO_CAMBIAR]);
  const canDeleteCliente = canAny([PERMISSIONS.CLIENTES_ELIMINAR]);
  const canViewCliente = canAny([PERMISSIONS.CLIENTES_DETALLE_VER]);

  const safeToast = useCallback(
    (title, message, variant = "success") => {
      if (typeof openToast === "function") openToast(title, message, variant);
    },
    [openToast]
  );

  const [personasCatalogo, setPersonasCatalogo] = useState([]);
  const [empresasCatalogo, setEmpresasCatalogo] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [viewMode, setViewMode] = useState(() => readViewMode("clientesViewMode"));

  const [estadoFiltro, setEstadoFiltro] = useState("activo");
  const [sortBy, setSortBy] = useState("recientes");
  const [tipoFiltro, setTipoFiltro] = useState("todos");
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
  const [createSubmissionRequested, setCreateSubmissionRequested] = useState(false);
  const [duplicateResolution, setDuplicateResolution] = useState(createEmptyDuplicateResolution);

  const [actionLoading, setActionLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    idToDelete: null,
    nombre: "",
    estadoActual: true,
  });
  const [cardsPerPage, setCardsPerPage] = useState(() =>
    typeof window === "undefined" ? 6 : resolveCardsPerPage(window.innerWidth)
  );
  const [usingTipoCache, setUsingTipoCache] = useState(false);

  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);
  const globalStatsRequestIdRef = useRef(0);
  const listAbortRef = useRef(null);
  const listPrefetchAbortRef = useRef(null);
  const clientesListCacheRef = useRef(new Map());
  const clientesTipoFallbackCacheRef = useRef(new Map());
  const clientesOrigenFilterSupportRef = useRef(null);
  const catalogosCargadosRef = useRef(false);
  const catalogosLoadingRef = useRef(false);
  const panelRef = useRef(null);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const isAnyDrawerOpen = showModal || filtersOpen;
  const visiblePageNumbers = useMemo(() => buildVisiblePageNumbers(page, totalPages), [page, totalPages]);
  const resolvedOperationalSucursalId = useMemo(() => {
    const fromContext = parsePositiveInteger(selectedSucursalId);
    if (fromContext) return fromContext;

    const fromUser = parsePositiveInteger(
      user?.id_sucursal
      ?? user?.sucursal_id
      ?? user?.empleado?.id_sucursal
      ?? user?.empleado?.sucursal_id
      ?? user?.sucursal?.id_sucursal
      ?? user?.sucursal?.id
    );
    if (fromUser) return fromUser;

    return null;
  }, [selectedSucursalId, user]);
  const resolvedOperationalEmpresaId = useMemo(() => {
    const explicit = parsePositiveInteger(
      user?.id_empresa
      ?? user?.empresa_id
      ?? user?.id_empresa_usuario
      ?? user?.id_empresa_empleado
      ?? user?.empresa?.id_empresa
      ?? user?.empresa?.id
      ?? user?.empleado?.id_empresa
    );
    if (explicit) return explicit;

    const userEntries = user && typeof user === "object" ? Object.entries(user) : [];
    const inferred = userEntries.find(([key, value]) =>
      String(key).toLowerCase().includes("empresa")
      && parsePositiveInteger(value)
    );
    if (inferred) return parsePositiveInteger(inferred[1]);

    return null;
  }, [user]);

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
    setCreateSubmissionRequested(false);
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
        estado: isActivo(cliente),
      };
    },
    [personaOptions, empresaOptions]
  );



  const buildClientesCacheKey = useCallback(
    (targetPage) =>
      JSON.stringify({
        page: Number(targetPage) || 1,
        limit,
        search: normalizeSearchText(debouncedSearch),
        estado: estadoFiltro,
        tipo: tipoFiltro,
      }),
    [limit, debouncedSearch, estadoFiltro, tipoFiltro]
  );

  const normalizeClientesPage = useCallback(
    (items = []) =>
      (Array.isArray(items) ? items : []).map((item) => normalizeClienteForView(item)),
    []
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
    clientesTipoFallbackCacheRef.current.clear();
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
          origen: tipoFiltro !== "todos" ? tipoFiltro : undefined,
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
      tipoFiltro,
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

  const cargarCatalogos = useCallback(async (options = {}) => {
    const force = Boolean(options?.force);
    if (!force && (catalogosCargadosRef.current || catalogosLoadingRef.current)) return;
    if (force) catalogosCargadosRef.current = false;
    catalogosLoadingRef.current = true;

    try {
      const [personasResult, empresasResult] = await Promise.allSettled([
        canListPersonas ? cargarPersonasCatalogoCompleto() : Promise.resolve([]),
        canListEmpresas ? personaService.getEmpresas({ page: 1, limit: 100 }) : Promise.resolve({ items: [] }),
      ]);

      const personasTodas = personasResult.status === "fulfilled" && Array.isArray(personasResult.value)
        ? personasResult.value
        : [];
      const empresasResp = empresasResult.status === "fulfilled"
        ? empresasResult.value
        : { items: [] };

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
      catalogosCargadosRef.current = true;
      if (empresasResult.status === "rejected" && canCreateEmpresaDesdeClientes) {
        safeToast("INFO", "Continuamos sin catalogo de empresas. Puedes crear empresa desde el formulario.", "info");
      }
    } catch (error) {
      safeToast("ERROR", error.message || "No se pudieron cargar catalogos", "danger");
    } finally {
      catalogosLoadingRef.current = false;
    }
  }, [canCreateEmpresaDesdeClientes, canListEmpresas, canListPersonas, cargarPersonasCatalogoCompleto, safeToast]);

  const cargarClientes = useCallback(async (options = {}) => {
    const requestId = ++requestIdRef.current;
    const requestedPage = parsePositiveInteger(options?.page);
    const targetPage = requestedPage || page;
    const force = Boolean(options?.force);
    const silent = Boolean(options?.silent);

    listAbortRef.current?.abort();
    listAbortRef.current = null;

    const cacheKey = buildClientesCacheKey(targetPage);
    if (!force) {
      const cached = clientesListCacheRef.current.get(cacheKey);
      if (cached) {
        setUsingTipoCache(false);
        setClientes(Array.isArray(cached.items) ? cached.items : []);
        setTotal(Math.max(0, Number(cached.total) || 0));
        if (!silent) setLoading(false);
        prefetchClientesPage(targetPage + 1, cached.total);
        return;
      }
    }

    if (!silent) setLoading(true);
    const controller = new AbortController();
    listAbortRef.current = controller;

    try {
      const estadoQuery = estadoFiltro === "inactivo" ? false : true;
      let normalizedItems = [];
      let totalResp = 0;

      if (tipoFiltro !== "todos") {
        const tipoCacheKey = JSON.stringify({
          tipo: tipoFiltro,
          estado: estadoQuery,
          search: normalizeSearchText(debouncedSearch),
        });
        const backendSupportsOrigenFilter = clientesOrigenFilterSupportRef.current;
        const cachedTipoList =
          backendSupportsOrigenFilter === false
            ? clientesTipoFallbackCacheRef.current.get(tipoCacheKey)
            : null;
        if (backendSupportsOrigenFilter === false && Array.isArray(cachedTipoList)) {
          setUsingTipoCache(true);
          totalResp = cachedTipoList.length;
          const start = Math.max(0, (targetPage - 1) * limit);
          normalizedItems = cachedTipoList.slice(start, start + limit);
        } else {
          setUsingTipoCache(false);
          const firstResp = await personaService.getClientes({
            page: targetPage,
            limit,
            nombre: debouncedSearch || undefined,
            estado: estadoQuery,
            origen: tipoFiltro,
            signal: controller.signal,
          });
          const firstNormalized = normalizeListResponse(firstResp);
          const firstItems = normalizeClientesPage(firstNormalized.items);
          const canProbeOrigenSupport = firstItems.length > 0;
          const backendRespectsTipo = canProbeOrigenSupport
            ? firstItems.every(
                (item) => String(item?.origen_cliente ?? "").trim().toLowerCase() === tipoFiltro
              )
            : backendSupportsOrigenFilter === true;

          if (backendSupportsOrigenFilter === true || backendRespectsTipo) {
            if (canProbeOrigenSupport) clientesOrigenFilterSupportRef.current = true;
            normalizedItems = firstItems;
            totalResp = Number(firstNormalized.total) || 0;
          } else if (!canProbeOrigenSupport) {
            normalizedItems = firstItems;
            totalResp = Number(firstNormalized.total) || 0;
          } else {
            clientesOrigenFilterSupportRef.current = false;
            const matchedByPage = new Map();
            const firstPageMatches = firstItems.filter(
              (item) => String(item?.origen_cliente ?? "").trim().toLowerCase() === tipoFiltro
            );
            matchedByPage.set(targetPage, firstPageMatches);
            const backendTotalPages = Math.min(
              CLIENTES_FILTRO_SCAN_MAX_PAGES,
              Math.max(1, Math.ceil((Number(firstNormalized.total) || 0) / limit))
            );
            const remainingPages = [];
            for (let pageNum = 1; pageNum <= backendTotalPages; pageNum += 1) {
              if (pageNum !== targetPage) remainingPages.push(pageNum);
            }

            for (let index = 0; index < remainingPages.length; index += CLIENTES_FILTRO_SCAN_CONCURRENCY) {
              const batch = remainingPages.slice(index, index + CLIENTES_FILTRO_SCAN_CONCURRENCY);
              const responses = await Promise.all(
                batch.map(async (pageNum) => {
                  const pageResp = await personaService.getClientes({
                    page: pageNum,
                    limit,
                    nombre: debouncedSearch || undefined,
                    estado: estadoQuery,
                    origen: tipoFiltro,
                    signal: controller.signal,
                  });
                  const normalized = normalizeListResponse(pageResp);
                  const pageItems = normalizeClientesPage(normalized.items).filter(
                    (item) => String(item?.origen_cliente ?? "").trim().toLowerCase() === tipoFiltro
                  );
                  return { pageNum, pageItems };
                })
              );
              responses.forEach(({ pageNum, pageItems }) => {
                matchedByPage.set(pageNum, pageItems);
              });
            }

            const matchedItems = [];
            for (let pageNum = 1; pageNum <= backendTotalPages; pageNum += 1) {
              const itemsFromPage = matchedByPage.get(pageNum) || [];
              matchedItems.push(...itemsFromPage);
            }

            clientesTipoFallbackCacheRef.current.set(tipoCacheKey, matchedItems);

            totalResp = matchedItems.length;
            const start = Math.max(0, (targetPage - 1) * limit);
            normalizedItems = matchedItems.slice(start, start + limit);
          }
        }
      } else {
        const resp = await personaService.getClientes({
          page: targetPage,
          limit,
          nombre: debouncedSearch || undefined,
          estado: estadoQuery,
          signal: controller.signal,
        });
        const normalized = normalizeListResponse(resp);
        totalResp = Number(normalized.total) || 0;
        normalizedItems = normalizeClientesPage(normalized.items);
        setUsingTipoCache(false);
      }

      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      setClientes(normalizedItems);
      setTotal(totalResp);
      setClientesCacheEntry(cacheKey, { items: normalizedItems, total: totalResp });
      if (tipoFiltro === "todos") {
        prefetchClientesPage(targetPage + 1, totalResp);
      }
    } catch (error) {
      if (isAbortError(error)) return;
      if (!mountedRef.current) return;
      safeToast("ERROR", error.message || "No se pudo cargar clientes", "danger");
      setClientes([]);
      setTotal(0);
      setUsingTipoCache(false);
    } finally {
      if (!silent && mountedRef.current && requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [
    buildClientesCacheKey,
    page,
    limit,
    debouncedSearch,
    estadoFiltro,
    tipoFiltro,
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
    };
  }, []);

  useEffect(() => {
    if (!showModal || !editId) return;
    void cargarCatalogos();
  }, [showModal, editId, cargarCatalogos]);

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
    if (typeof window === "undefined") return;
    const forceCardsOnSmallViewport = () => {
      if (window.innerWidth <= 575.98) {
        setViewMode((prev) => (prev === "cards" ? prev : "cards"));
      }
    };
    forceCardsOnSmallViewport();
    window.addEventListener("resize", forceCardsOnSmallViewport);
    return () => window.removeEventListener("resize", forceCardsOnSmallViewport);
  }, []);

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
      id_sucursal: resolvedOperationalSucursalId || null,
      estado: Boolean(form.estado),
    };
  };

  const upsertPersonaCatalogoLocal = useCallback((personaId, personaFormState) => {
    const id = parsePositiveInteger(personaId);
    if (!id || !personaFormState || typeof personaFormState !== "object") return;

    const normalizedPersona = normalizePersonaFormValues(personaFormState);
    setPersonasCatalogo((prev) => {
      const source = Array.isArray(prev) ? prev : [];
      const nextItem = {
        id_persona: id,
        nombre: String(normalizedPersona.nombre ?? "").trim(),
        apellido: String(normalizedPersona.apellido ?? "").trim(),
        dni: String(normalizedPersona.dni ?? "").trim(),
        genero: String(normalizedPersona.genero ?? "").trim(),
        fecha_nacimiento: String(normalizedPersona.fecha_nacimiento ?? "").trim(),
        rtn: String(normalizedPersona.rtn ?? "").trim(),
        RTN: String(normalizedPersona.rtn ?? "").trim(),
        persona_rtn: String(normalizedPersona.rtn ?? "").trim(),
        persona_rtn_complemento: String(normalizedPersona.rtn ?? "").trim(),
        rtn_persona: String(normalizedPersona.rtn ?? "").trim(),
        rtn_complemento: String(normalizedPersona.rtn ?? "").trim(),
        complemento_rtn: String(normalizedPersona.rtn ?? "").trim(),
        numero_rtn: String(normalizedPersona.rtn ?? "").trim(),
        telefono: String(normalizedPersona.id_telefono ?? "").trim(),
        texto_telefono: String(normalizedPersona.id_telefono ?? "").trim(),
        telefono_numero: String(normalizedPersona.id_telefono ?? "").trim(),
        numero_telefono: String(normalizedPersona.id_telefono ?? "").trim(),
        direccion: String(normalizedPersona.id_direccion ?? "").trim(),
        texto_direccion: String(normalizedPersona.id_direccion ?? "").trim(),
        direccion_detalle: String(normalizedPersona.id_direccion ?? "").trim(),
        correo: String(normalizedPersona.id_correo ?? "").trim(),
        texto_correo: String(normalizedPersona.id_correo ?? "").trim(),
        direccion_correo: String(normalizedPersona.id_correo ?? "").trim(),
        email: String(normalizedPersona.id_correo ?? "").trim(),
      };

      const index = source.findIndex((item) => Number(item?.id_persona) === id);
      if (index >= 0) {
        const next = [...source];
        next[index] = { ...next[index], ...nextItem };
        return next;
      }
      return [nextItem, ...source];
    });
  }, []);

  const upsertEmpresaCatalogoLocal = useCallback((empresaId, empresaFormState) => {
    const id = parsePositiveInteger(empresaId);
    if (!id || !empresaFormState || typeof empresaFormState !== "object") return;

    const normalizedEmpresa = normalizeEmpresaFormValues(empresaFormState);
    setEmpresasCatalogo((prev) => {
      const source = Array.isArray(prev) ? prev : [];
      const nextItem = {
        id_empresa: id,
        nombre_empresa: String(normalizedEmpresa.nombre_empresa ?? "").trim(),
        rtn: String(normalizedEmpresa.rtn ?? "").trim(),
        telefono: String(normalizedEmpresa.id_telefono ?? "").trim(),
        correo: String(normalizedEmpresa.id_correo ?? "").trim(),
        direccion_correo: String(normalizedEmpresa.id_correo ?? "").trim(),
        direccion: String(normalizedEmpresa.id_direccion ?? "").trim(),
      };

      const index = source.findIndex((item) => Number(item?.id_empresa) === id);
      if (index >= 0) {
        const next = [...source];
        next[index] = { ...next[index], ...nextItem };
        return next;
      }
      return [nextItem, ...source];
    });
  }, []);

  const shouldShowCreatedClienteInCurrentView = useCallback((cliente) => {
    if (!cliente || debouncedSearch) return false;
    const activo = isActivo(cliente);
    const origen = resolveClienteOrigen(cliente);

    if (estadoFiltro === "activo" && !activo) return false;
    if (estadoFiltro === "inactivo" && activo) return false;
    if (tipoFiltro !== "todos" && origen !== tipoFiltro) return false;

    return true;
  }, [debouncedSearch, estadoFiltro, tipoFiltro]);

  const insertCreatedClienteLocally = useCallback((cliente) => {
    if (!cliente || !shouldShowCreatedClienteInCurrentView(cliente) || page !== 1) {
      return false;
    }

    const normalizedCliente = normalizeClienteForView(cliente);
    const clienteId = String(normalizedCliente?.id_cliente ?? "").trim();
    if (!clienteId) return false;

    setClientes((prev) => {
      const source = Array.isArray(prev) ? prev : [];
      const nextRows = [
        normalizedCliente,
        ...source.filter((item) => String(item?.id_cliente ?? "").trim() !== clienteId),
      ];
      return nextRows.slice(0, limit);
    });
    setTotal((prev) => Math.max(0, Number(prev) || 0) + 1);
    return true;
  }, [limit, page, shouldShowCreatedClienteInCurrentView]);

  const validar = () => {
    const currentErrors = {};
    const isCreateMode = !editId;
    const hasPersona = Boolean(String(form.id_persona ?? "").trim());
    const hasEmpresa = Boolean(String(form.id_empresa ?? "").trim());
    const usingInlinePersona = clienteOriginType === "persona" && (isCreateMode || useInlinePersonaCreate);
    const usingInlineEmpresa = clienteOriginType === "empresa" && (isCreateMode || useInlineEmpresaCreate);

    if (isCreateMode) {
      if (clienteOriginType === "persona") {
        Object.assign(currentErrors, validatePersonaForm(inlinePersonaForm));
      } else {
        Object.assign(currentErrors, validateEmpresaForm(inlineEmpresaForm));
      }


      setErrors(currentErrors);
      return Object.keys(currentErrors).length === 0;
    }

    if (hasPersona && hasEmpresa) {
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

  const handlePersonaBaseFieldChange = useCallback((field, value) => {
    setInlinePersonaForm((state) =>
      normalizePersonaFormValues({ ...state, [field]: value }, { preserveNameTrailingSpace: true })
    );
    setErrors((state) => ({ ...state, [field]: undefined, id_persona: undefined }));
  }, []);

  const handleEmpresaBaseFieldChange = useCallback((field, value) => {
    setInlineEmpresaForm((state) => normalizeEmpresaFormValues({ ...state, [field]: value }));
    setErrors((state) => ({ ...state, [field]: undefined, id_empresa: undefined }));
  }, []);

  const handlePersonaDniChange = useCallback((value) => {
    const formatted = formatDNI(limitPersonaDigits(digitsOnlyPersona(value), 13));
    handlePersonaBaseFieldChange("dni", formatted);
  }, [handlePersonaBaseFieldChange]);

  const handlePersonaRtnChange = useCallback((value) => {
    const complemento = limitPersonaDigits(digitsOnlyPersona(value), 1);
    handlePersonaBaseFieldChange("rtn", complemento);
  }, [handlePersonaBaseFieldChange]);

  const handlePersonaTelefonoChange = useCallback((value) => {
    const formatted = formatPersonaPhone(limitPersonaDigits(digitsOnlyPersona(value), 8));
    handlePersonaBaseFieldChange("id_telefono", formatted);
  }, [handlePersonaBaseFieldChange]);

  const handleEmpresaRtnChange = useCallback((value) => {
    const formatted = formatRtn(limitEmpresaDigits(digitsOnlyEmpresa(value), 14));
    handleEmpresaBaseFieldChange("rtn", formatted);
  }, [handleEmpresaBaseFieldChange]);

  const handleEmpresaTelefonoChange = useCallback((value) => {
    const formatted = formatEmpresaPhone(limitEmpresaDigits(digitsOnlyEmpresa(value), 8));
    handleEmpresaBaseFieldChange("id_telefono", formatted);
  }, [handleEmpresaBaseFieldChange]);

  const handleNextToCommercialStep = useCallback(() => {
    if (editId || createStep !== 2) return;

    const baseErrors =
      clienteOriginType === "persona"
        ? validatePersonaForm(inlinePersonaForm)
        : validateEmpresaForm(inlineEmpresaForm);

    if (Object.keys(baseErrors).length > 0) {
      setErrors((state) => ({ ...state, ...baseErrors }));
      safeToast("ERROR", "Completa los datos base del cliente antes de continuar.", "danger");
      return;
    }

    setErrors((state) => {
      const next = { ...state };
      Object.keys(baseErrors).forEach((key) => {
        delete next[key];
      });
      return next;
    });
    setCreateSubmissionRequested(false);
    setCreateStep(3);
  }, [editId, createStep, clienteOriginType, inlinePersonaForm, inlineEmpresaForm, safeToast]);

  const guardar = async (event) => {
    event.preventDefault();
    const isCreateMode = !editId;
    if (!editId && createStep !== 3) {
      safeToast("INFO", "Completa los pasos y presiona 'Crear cliente' en el paso 3.", "info");
      return;
    }
    if (!editId && !createSubmissionRequested) {
      return;
    }
    if (editId && !canEditCliente) {
      safeToast("ERROR", "No tienes permiso para editar clientes.", "danger");
      return;
    }
    if (!editId && !canCreateCliente) {
      safeToast("ERROR", "No tienes permiso para crear clientes.", "danger");
      return;
    }
    if (!editId && !resolvedOperationalSucursalId) {
      safeToast("ERROR", "No se pudo resolver la sucursal operativa. Selecciona una sucursal e intenta de nuevo.", "danger");
      return;
    }
    if (!validar() || actionLoading) return;

    const payloadLimpio = sanitizeForm();
    setActionLoading(true);
    let createResult = null;

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
          id_sucursal: resolvedOperationalSucursalId,
          id_empresa: resolvedOperationalEmpresaId || undefined,
          cliente: payloadLimpio,
          ...(clienteOriginType === "empresa"
            ? { empresa: buildEmpresaPayloadFromForm(inlineEmpresaForm) }
            : { persona: buildPersonaPayloadFromForm(inlinePersonaForm) }),
        };

        try {
          const forceCompatCreate =
            typeof window !== "undefined"
            && window.sessionStorage?.getItem(CLIENTES_FORCE_COMPAT_CREATE_FLAG) === "1";

          if (forceCompatCreate) {
            const compatBlockedError = new Error("Flujo atomico omitido para esta sesion.");
            compatBlockedError.status = 403;
            compatBlockedError.code = "CLIENTES_ATOMIC_ROUTE_BLOCKED";
            throw compatBlockedError;
          }

          createResult = await personaService.createClienteFull(atomicCreatePayload);
          if (typeof window !== "undefined") {
            window.sessionStorage?.removeItem(CLIENTES_FORCE_COMPAT_CREATE_FLAG);
          }
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
          const atomicMessage = String(
            atomicError?.message
            || atomicError?.data?.message
            || atomicError?.data?.mensaje
            || ""
          ).trim().toLowerCase();
          const isEmpresaContextResolutionError =
            atomicStatus === 403
            && atomicMessage.includes("no se pudo resolver la empresa del usuario");
          if (isEmpresaContextResolutionError && typeof window !== "undefined") {
            window.sessionStorage?.setItem(CLIENTES_FORCE_COMPAT_CREATE_FLAG, "1");
          }
          const allowCompatibilityFallback =
            atomicStatus === 500
            || atomicCode === "DB_SCHEMA_ERROR"
            || atomicCode === "DB_FUNCTION_ERROR"
            || atomicCode === "INTERNAL_ERROR"
            || atomicCode === "CLIENTES_ATOMIC_ROUTE_BLOCKED"
            || isEmpresaContextResolutionError;

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
              id_sucursal: resolvedOperationalSucursalId || null,
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
              id_sucursal: resolvedOperationalSucursalId || null,
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

      const createdCliente =
        createResult?.data?.cliente
        || createResult?.cliente
        || createResult?.data?.entidad
        || null;
      const createdPersonaId = parsePositiveInteger(createResult?.data?.id_persona);
      const createdEmpresaId = parsePositiveInteger(
        createResult?.data?.id_empresa_cliente
        ?? createResult?.data?.id_empresa
      );
      const wasLinked = Boolean(createResult?.vinculado);
      const insertedLocally =
        isCreateMode && !wasLinked && createdCliente
          ? insertCreatedClienteLocally(createdCliente)
          : false;

      if (isCreateMode && !wasLinked) {
        const createdIsActive = isActivo(createdCliente ?? payloadLimpio);
        setGlobalStats((prev) => {
          const current = {
            total: Math.max(0, Number(prev?.total) || 0),
            activas: Math.max(0, Number(prev?.activas) || 0),
            inactivas: Math.max(0, Number(prev?.inactivas) || 0),
          };
          return createdIsActive
            ? {
                total: current.total + 1,
                activas: current.activas + 1,
                inactivas: current.inactivas,
              }
            : {
                total: current.total + 1,
                activas: current.activas,
                inactivas: current.inactivas + 1,
              };
        });
      }

      if (isCreateMode && clienteOriginType === "persona" && createdPersonaId) {
        upsertPersonaCatalogoLocal(createdPersonaId, inlinePersonaForm);
      }
      if (isCreateMode && clienteOriginType === "empresa" && createdEmpresaId) {
        upsertEmpresaCatalogoLocal(createdEmpresaId, inlineEmpresaForm);
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
      if (!isCreateMode) {
        await cargarClientes({ force: true });
        void cargarClientesGlobalStats();
      } else if (!insertedLocally) {
        if (page !== 1) {
          setPage(1);
          void cargarClientes({ page: 1, force: true });
        } else if (debouncedSearch || !createdCliente || wasLinked || shouldShowCreatedClienteInCurrentView(createdCliente)) {
          void cargarClientes({ force: true });
        }
      }
    } catch (error) {
      safeToast("ERROR", error.message || "No se pudo guardar", "danger");
    } finally {
      if (!editId) setCreateSubmissionRequested(false);
      if (mountedRef.current) setActionLoading(false);
    }
  };

  const handleCreateFormKeyDown = useCallback((event) => {
    if (editId) return;
    if (createStep === 3) return;
    if (event.key !== "Enter") return;
    event.preventDefault();
  }, [editId, createStep]);

  const handleVincularDuplicado = useCallback(async () => {
    if (!canCreateCliente) {
      safeToast("ERROR", "No tienes permiso para crear clientes.", "danger");
      return;
    }
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
      id_sucursal: resolvedOperationalSucursalId,
      id_empresa: resolvedOperationalEmpresaId || basePayload?.id_empresa || undefined,
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

      const createdCliente =
        createResult?.data?.cliente
        || createResult?.cliente
        || createResult?.data?.entidad
        || null;
      const insertedLocally = createdCliente
        ? insertCreatedClienteLocally(createdCliente)
        : false;

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
      if (!insertedLocally) {
        if (page !== 1) {
          setPage(1);
          void cargarClientes({ page: 1, force: true });
        } else {
          void cargarClientes({ force: true });
        }
      }
    } catch (error) {
      safeToast("ERROR", error.message || "No se pudo vincular el registro existente.", "danger");
    } finally {
      if (mountedRef.current) setActionLoading(false);
    }
  }, [
    canCreateCliente,
    actionLoading,
    resolvedOperationalSucursalId,
    resolvedOperationalEmpresaId,
    closeFormDrawer,
    duplicateResolution,
    safeToast,
    clearClientesListCache,
    page,
    cargarClientes,
    resetDuplicateResolution,
    insertCreatedClienteLocally
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
        personaCatalogo?.RTN,
        personaCatalogo?.persona_rtn_complemento,
        personaCatalogo?.rtn_persona,
        personaCatalogo?.rtn_complemento,
        personaCatalogo?.complemento_rtn,
        personaCatalogo?.numero_rtn,
        cliente?.persona_rtn,
        cliente?.persona_rtn_complemento,
        cliente?.rtn_persona,
        cliente?.rtn_complemento,
        cliente?.complemento_rtn,
        cliente?.numero_rtn,
        cliente?.rtn,
        cliente?.RTN,
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
        cliente?.empresa_rtn,
        cliente?.rtn_empresa,
        cliente?.rtn,
        cliente?.RTN,
        String(cliente?.documento_tipo || "").toLowerCase() === "rtn" ? cliente?.documento_valor : "",
        empresaCatalogo?.rtn,
        empresaCatalogo?.RTN
      ),
      nombre_empresa: firstNonEmptyValue(
        cliente?.nombre_empresa,
        cliente?.empresa_nombre,
        cliente?.nombre_principal,
        empresaCatalogo?.nombre_empresa
      ),
      id_telefono: firstNonEmptyValue(
        cliente?.empresa_telefono,
        cliente?.telefono,
        empresaCatalogo?.texto_telefono,
        empresaCatalogo?.telefono,
        empresaCatalogo?.telefono_numero,
        empresaCatalogo?.numero_telefono,
        empresaCatalogo?.id_telefono
      ),
      id_direccion: sanitizeOptionalSeedValue(firstNonEmptyValue(
        cliente?.empresa_direccion,
        cliente?.direccion,
        empresaCatalogo?.texto_direccion,
        empresaCatalogo?.direccion,
        empresaCatalogo?.direccion_detalle,
        empresaCatalogo?.id_direccion
      )),
      id_correo: sanitizeOptionalSeedValue(firstNonEmptyValue(
        cliente?.empresa_correo,
        cliente?.correo,
        empresaCatalogo?.texto_correo,
        empresaCatalogo?.direccion_correo,
        empresaCatalogo?.correo,
        empresaCatalogo?.email,
        empresaCatalogo?.id_correo
      )),
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
        upsertPersonaCatalogoLocal(personaId, normalizedPersona);
        clearClientesListCache();
        await cargarClientes({ force: true });
      } catch (error) {
        safeToast("ERROR", error.message || "No se pudo actualizar la persona.", "danger");
      } finally {
        if (mountedRef.current) setInlinePersonaSaving(false);
      }
    },
    [editId, clientes, form.id_persona, safeToast, clearClientesListCache, cargarClientes, upsertPersonaCatalogoLocal]
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
        const normalizedEmpresa = normalizeEmpresaFormValues(empresaFormState);
        setInlineEmpresaForm(normalizedEmpresa);
        setShowEmpresaEditModal(false);
        safeToast("OK", "Datos de empresa actualizados");
        upsertEmpresaCatalogoLocal(empresaId, normalizedEmpresa);
        clearClientesListCache();
        await cargarClientes({ force: true });
      } catch (error) {
        safeToast("ERROR", error.message || "No se pudo actualizar la empresa.", "danger");
      } finally {
        if (mountedRef.current) setInlineEmpresaSaving(false);
      }
    },
    [editId, clientes, form.id_empresa, safeToast, clearClientesListCache, cargarClientes, upsertEmpresaCatalogoLocal]
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
      setShowPersonaCreateModal(false);
      setForm((state) => ({ ...state, id_persona: "", id_empresa: "" }));
    } else {
      setUseInlinePersonaCreate(false);
      setInlinePersonaForm(emptyInlinePersonaForm);
      setShowPersonaCreateModal(false);
      setUseInlineEmpresaCreate(true);
      setShowEmpresaCreateModal(false);
      setForm((state) => ({ ...state, id_empresa: "", id_persona: "" }));
    }
  }, [clienteOriginType, resetDuplicateResolution]);

  const handleBackToCreateStepOne = useCallback(() => {
    setCreateSubmissionRequested(false);
    setCreateStep(1);
    setShowPersonaCreateModal(false);
    setShowEmpresaCreateModal(false);
    resetDuplicateResolution();
  }, [resetDuplicateResolution]);

  const handleBackToCreateStepTwo = useCallback(() => {
    setCreateSubmissionRequested(false);
    setCreateStep(2);
    resetDuplicateResolution();
  }, [resetDuplicateResolution]);

  const iniciarEdicion = (cliente) => {
    if (!canEditCliente) return;
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
    if (!canCreateCliente) return;
    if (actionLoading || deletingId) return;
    setFiltersOpen(false);
    setEditId(null);
    setCreateStep(1);
    setCreateSubmissionRequested(false);
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
    setCreateSubmissionRequested(false);
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
      setShowPersonaCreateModal(false);
    } else {
      setUseInlinePersonaCreate(false);
      setInlinePersonaForm(emptyInlinePersonaForm);
      setShowPersonaCreateModal(false);
      setShowPersonaEditModal(false);
      setUseInlineEmpresaCreate(isCreateMode ? true : false);
      setShowEmpresaCreateModal(false);
    }
    setErrors((state) => ({ ...state, id_persona: undefined, id_empresa: undefined }));
  };

  const openConfirmDelete = (cliente) => {
    if (!canInactivateCliente) return;
    setConfirmModal({
      show: true,
      idToDelete: cliente?.id_cliente ?? null,
      nombre: firstNonEmptyValue(cliente?.nombre_principal, getClientePrincipalNombre(cliente)),
      estadoActual: isActivo(cliente),
    });
  };

  const closeConfirmDelete = () =>
    setConfirmModal({ show: false, idToDelete: null, nombre: "", estadoActual: true });

  const eliminarConfirmado = async () => {
    if (!canInactivateCliente) {
      safeToast("ERROR", "No tienes permiso para inactivar o activar clientes.", "danger");
      return;
    }
    const id = confirmModal.idToDelete;
    if (!id || actionLoading || deletingId) return;
    const shouldActivate = confirmModal.estadoActual === false;
    const wasActive = confirmModal.estadoActual === true;

    setDeletingId(id);
    try {
      await personaService.updateCliente(id, { estado: shouldActivate ? true : false });

      if (String(editId) === String(id)) {
        closeFormDrawer();
        setEditId(null);
        setForm(emptyForm);
      }

      const matchesEstadoFilter = (estadoValue) =>
        estadoFiltro === "todos" ? true : estadoFiltro === "activo" ? estadoValue : !estadoValue;
      const wasVisible = matchesEstadoFilter(wasActive);
      const willBeVisible = matchesEstadoFilter(shouldActivate);
      const quedaVaciaPagina = wasVisible && !willBeVisible && clientes.length === 1 && page > 1;

      setClientes((prev) => {
        const rows = Array.isArray(prev) ? prev : [];
        const nextRows = rows.map((item) =>
          String(item?.id_cliente ?? "") === String(id) ? { ...item, estado: shouldActivate } : item
        );

        if (wasVisible && !willBeVisible) {
          return nextRows.filter((item) => String(item?.id_cliente ?? "") !== String(id));
        }

        return nextRows;
      });
      setTotal((prev) => {
        const safePrev = Math.max(0, Number(prev) || 0);
        if (wasVisible && !willBeVisible) return Math.max(0, safePrev - 1);
        if (!wasVisible && willBeVisible) return safePrev + 1;
        return safePrev;
      });
      setGlobalStats((prev) => {
        const safePrev = {
          total: Math.max(0, Number(prev?.total) || 0),
          activas: Math.max(0, Number(prev?.activas) || 0),
          inactivas: Math.max(0, Number(prev?.inactivas) || 0),
        };

        if (wasActive === shouldActivate) return safePrev;
        if (shouldActivate) {
          return {
            ...safePrev,
            activas: safePrev.activas + 1,
            inactivas: Math.max(0, safePrev.inactivas - 1),
          };
        }

        return {
          ...safePrev,
          activas: Math.max(0, safePrev.activas - 1),
          inactivas: safePrev.inactivas + 1,
        };
      });

      clearClientesListCache();
      if (quedaVaciaPagina) {
        setPage((prev) => Math.max(1, prev - 1));
      } else {
        void cargarClientes({ force: true, silent: true });
      }

      safeToast("OK", shouldActivate ? "Cliente activado" : "Cliente inactivado");
      closeConfirmDelete();
      void cargarClientesGlobalStats();
    } catch (error) {
      safeToast("ERROR", error.message || (shouldActivate ? "No se pudo activar" : "No se pudo inactivar"), "danger");
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

      const originRaw = normalizeValue(firstNonEmptyValue(cliente?.origen_cliente, cliente?.origen, cliente?.origen_label));
      const isEmpresa = originRaw.includes("empresa");
      const isPersona = originRaw.includes("persona") || (!isEmpresa && originRaw.includes("individual"));
      const matchTipo =
        tipoFiltro === "todos"
          ? true
          : tipoFiltro === "empresa"
            ? isEmpresa
            : isPersona;
      if (!matchTipo) return false;

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
  }, [clientes, search, estadoFiltro, sortBy, tipoFiltro, getClientePrincipalNombre]);
  const clientesRender = useMemo(() => {
    return clientesFiltrados;
  }, [clientesFiltrados]);
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
      const originRaw = normalizeValue(firstNonEmptyValue(cliente?.origen_cliente, cliente?.origen, cliente?.origen_label));
      const isEmpresa = originRaw.includes("empresa");
      const isPersona = originRaw.includes("persona") || (!isEmpresa && originRaw.includes("individual"));
      const matchTipo =
        tipoFiltro === "todos"
          ? true
          : tipoFiltro === "empresa"
            ? isEmpresa
            : isPersona;
      if (!matchTipo) continue;

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
  }, [clientes, estadoFiltro, tipoFiltro, search]);

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
    () => search.trim() !== "" || estadoFiltro !== "activo" || sortBy !== "recientes" || tipoFiltro !== "todos",
    [search, estadoFiltro, sortBy, tipoFiltro]
  );

  const drawerMode = editId ? "edit" : "create";
  const isCreateFlow = drawerMode === "create";
  const isCreateStepOne = isCreateFlow && createStep === 1;
  const isCreateStepTwo = isCreateFlow && createStep === 2;
  const colsClass = cardsPerPage >= 6 ? "cols-3" : cardsPerPage >= 4 ? "cols-2" : "cols-1";
  const formOriginLabel = clienteOriginType === "empresa" ? "Empresa" : "Individual";
  const createSubtitle = isCreateStepOne
    ? "Paso 1 de 3: selecciona el tipo de cliente."
    : isCreateStepTwo
      ? "Paso 2 de 3: completa los datos base del cliente."
      : "Paso 3 de 3: revisa el resumen y crea el cliente.";
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
  const createPersonaSummaryRows = useMemo(
    () => [
      {
        label: "Nombre completo",
        value: `${String(inlinePersonaForm?.nombre ?? "").trim()} ${String(inlinePersonaForm?.apellido ?? "").trim()}`.trim(),
      },
      { label: "DNI", value: inlinePersonaForm?.dni },
      { label: "RTN complemento", value: inlinePersonaForm?.rtn },
      { label: "Genero", value: inlinePersonaForm?.genero },
      { label: "Fecha nacimiento", value: inlinePersonaForm?.fecha_nacimiento },
      { label: "Telefono", value: inlinePersonaForm?.id_telefono },
      { label: "Correo", value: inlinePersonaForm?.id_correo },
      { label: "Direccion", value: inlinePersonaForm?.id_direccion },
    ],
    [inlinePersonaForm]
  );
  const createEmpresaSummaryRows = useMemo(
    () => [
      { label: "Nombre empresa", value: inlineEmpresaForm?.nombre_empresa },
      { label: "RTN", value: inlineEmpresaForm?.rtn },
      { label: "Telefono", value: inlineEmpresaForm?.id_telefono },
      { label: "Correo", value: inlineEmpresaForm?.id_correo },
      { label: "Direccion", value: inlineEmpresaForm?.id_direccion },
    ],
    [inlineEmpresaForm]
  );

  const openFiltersDrawer = () => {
    if (actionLoading) return;
    closeFormDrawer();
    setFiltersDraft({ estadoFiltro, sortBy, tipoFiltro });
    setFiltersOpen(true);
  };

  const closeFiltersDrawer = () => setFiltersOpen(false);

  const applyFiltersDrawer = () => {
    setEstadoFiltro(filtersDraft.estadoFiltro === "inactivo" ? "inactivo" : "activo");
    setSortBy(filtersDraft.sortBy || "recientes");
    setTipoFiltro(
      filtersDraft.tipoFiltro === "empresa"
        ? "empresa"
        : filtersDraft.tipoFiltro === "persona"
          ? "persona"
          : "todos"
    );
    setFiltersOpen(false);
  };

  const clearVisualFilters = () => {
    setEstadoFiltro("activo");
    setSortBy("recientes");
    setTipoFiltro("todos");
    setFiltersDraft(createInitialFiltersDraft());
  };

  const clearAllFilters = () => {
    handleSearchInputChange("");
    clearVisualFilters();
    setUsingTipoCache(false);
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
          searchPlaceholder="Buscar por persona, empresa, DNI, telefono o correo..."
          searchAriaLabel="Buscar clientes"
          filtersOpen={filtersOpen}
          onOpenFilters={openFiltersDrawer}
          createOpen={showModal}
          onOpenCreate={openCreate}
          createLabel="Nuevo"
          canCreate={canCreateCliente}
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
            <span>{loading ? "Cargando clientes..." : `${clientesRender.length} resultados`}</span>
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
            {!loading && usingTipoCache ? (
              <span className="inv-prod-active-filter-pill">Cache aplicada</span>
            ) : null}
          </div>

          <div className={`inv-catpro-list ${isAnyDrawerOpen ? "drawer-open" : ""}`}>
            {loading ? (
              <div className="inv-catpro-loading" role="status" aria-live="polite">
                <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                <span>Cargando clientes...</span>
              </div>
            ) : clientesRender.length === 0 ? (
              <div className={`inv-catpro-empty ${estadoFiltro === "inactivo" ? "inv-catpro-empty--inactive-clean" : ""}`}>
                <div className="inv-catpro-empty-icon">
                  <i className="bi bi-person-lines-fill" />
                </div>
                <div className="inv-catpro-empty-title">
                  {estadoFiltro === "inactivo" ? "No hay clientes inactivos para mostrar" : "No hay clientes para mostrar"}
                </div>
                {estadoFiltro !== "inactivo" ? (
                  <>
                    <div className="inv-catpro-empty-sub">
                      {hasActiveFilters ? "Prueba limpiar filtros o crea un nuevo cliente." : "Crea tu primer cliente."}
                    </div>
                    <div className="d-flex gap-2 justify-content-center flex-wrap">
                      {hasActiveFilters ? (
                        <button type="button" className="btn btn-outline-secondary" onClick={clearAllFilters}>
                          Limpiar filtros
                        </button>
                      ) : null}
                      {canCreateCliente ? (
                        <button type="button" className="btn btn-primary" onClick={openCreate}>
                          Nuevo cliente
                        </button>
                      ) : null}
                    </div>
                  </>
                ) : null}
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
                    {clientesRender.map((cliente, idx) => {
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
                                disabled={actionLoading || deleting || !canEditCliente}
                              >
                                <i className="bi bi-pencil-square" />
                                <span className="inv-catpro-action-label">Editar</span>
                              </button>

                              <button
                                type="button"
                                className={`inv-catpro-action ${isActive ? "danger" : ""} inv-catpro-action-compact`.trim()}
                                onClick={() => openConfirmDelete(cliente)}
                                title={isActive ? "Inactivar" : "Activar"}
                                disabled={actionLoading || deleting || !canInactivateCliente}
                              >
                                <i className={`bi ${deleting ? "bi-hourglass-split" : (isActive ? "bi-slash-circle" : "bi-check-circle")}`} />
                                <span className="inv-catpro-action-label">
                                  {deleting ? (isActive ? "Inactivando..." : "Activando...") : (isActive ? "Inactivar" : "Activar")}
                                </span>
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
                {clientesRender.map((cliente, idx) => (
                  <ClienteCard
                    key={cliente?.id_cliente ?? idx}
                    cliente={cliente}
                    index={(page - 1) * limit + idx}
                    onOpenEdit={iniciarEdicion}
                    onOpenDelete={openConfirmDelete}
                    actionLoading={actionLoading}
                    deletingId={deletingId}
                    personaRtnCatalog={personaRtnById.get(String(cliente?.id_persona ?? "").trim()) || ""}
                    canEdit={canEditCliente}
                    canInactivate={canInactivateCliente}
                    canDelete={canDeleteCliente}
                    canView={canViewCliente}
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

      {canCreateCliente ? (
        <button
          type="button"
          className={`inv-catpro-fab d-md-none ${isAnyDrawerOpen ? "is-hidden" : ""}`}
          onClick={openCreate}
          title="Nuevo"
          disabled={actionLoading || !!deletingId}
        >
          <i className="bi bi-plus" />
        </button>
      ) : null}

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
        extraFilters={({ draft, onChangeDraft }) => (
          <div className="inv-cat-filter-card inv-prod-drawer-section">
            <div className="inv-prod-drawer-section-title">Tipo de cliente</div>
            <div className="inv-ins-chip-grid">
              <button
                type="button"
                className={`inv-ins-chip ${draft.tipoFiltro === "todos" ? "is-active" : ""}`}
                onClick={() => onChangeDraft((state) => ({ ...state, tipoFiltro: "todos" }))}
              >
                Todos
              </button>
              <button
                type="button"
                className={`inv-ins-chip ${draft.tipoFiltro === "persona" ? "is-active" : ""}`}
                onClick={() => onChangeDraft((state) => ({ ...state, tipoFiltro: "persona" }))}
              >
                Persona
              </button>
              <button
                type="button"
                className={`inv-ins-chip ${draft.tipoFiltro === "empresa" ? "is-active" : ""}`}
                onClick={() => onChangeDraft((state) => ({ ...state, tipoFiltro: "empresa" }))}
              >
                Empresa
              </button>
            </div>
            <div className="inv-ins-help">Combina este filtro con Activos o Inactivos segun tu necesidad.</div>
          </div>
        )}
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

        <form
          className="inv-prod-drawer-body inv-catpro-drawer-body-lite crud-modal__body"
          onSubmit={guardar}
          onKeyDown={handleCreateFormKeyDown}
        >
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
                    title="Individual"
                  >
                    Individual
                  </button>
                  <button
                    type="button"
                    className={`personas-page__view-btn clientes-modal__origin-option ${clienteOriginType === "empresa" ? "is-active" : ""}`}
                    onClick={() => handleOriginTypeChange("empresa")}
                    disabled={actionLoading || !isCreateFlow}
                    aria-pressed={clienteOriginType === "empresa"}
                    title="Empresa"
                  >
                    Empresa
                  </button>
                </div>

                <div className="clientes-modal__origin-row">
                  <span className={`clientes-origin-chip ${clienteOriginType === "empresa" ? "is-empresa" : "is-persona"}`}>
                    {formOriginLabel}
                  </span>
                  <span className="clientes-modal__origin-caption">Paso 1: tipo de cliente</span>
                </div>
                <p className="clientes-modal__origin-text">
                  Selecciona el tipo para continuar con el flujo guiado de alta.
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
          ) : isCreateStepTwo ? (
            <>
              <div className="clientes-modal__origin-helper">
                <div className="clientes-modal__origin-row">
                  <span className={`clientes-origin-chip ${clienteOriginType === "empresa" ? "is-empresa" : "is-persona"}`}>
                    {formOriginLabel}
                  </span>
                  <span className="clientes-modal__origin-caption">Paso 2: Datos base del cliente</span>
                </div>
                <p className="clientes-modal__origin-text">
                  {clienteOriginType === "empresa"
                    ? "Completa los datos de empresa del cliente."
                    : "Completa los datos individuales del cliente."}
                </p>
              </div>

              <div className="row g-3 crud-modal__grid">
                {clienteOriginType === "persona" ? (
                  <>
                    <div className="col-12">
                      <h6 className="mb-1">Datos individuales del cliente</h6>
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">Nombre</label>
                      <input
                        className={`form-control ${errors.nombre ? "is-invalid" : ""}`}
                        value={inlinePersonaForm.nombre}
                        onChange={(event) =>
                          handlePersonaBaseFieldChange(
                            "nombre",
                            normalizeHumanNameInput(event.target.value, { preserveTrailingSpace: true })
                          )
                        }
                        placeholder="Ej. Jose Maria"
                        disabled={actionLoading}
                      />
                      {errors.nombre ? <div className="invalid-feedback d-block">{errors.nombre}</div> : null}
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">Apellido</label>
                      <input
                        className={`form-control ${errors.apellido ? "is-invalid" : ""}`}
                        value={inlinePersonaForm.apellido}
                        onChange={(event) =>
                          handlePersonaBaseFieldChange(
                            "apellido",
                            normalizeHumanNameInput(event.target.value, { preserveTrailingSpace: true })
                          )
                        }
                        placeholder="Ej. Mejia Paz"
                        disabled={actionLoading}
                      />
                      {errors.apellido ? <div className="invalid-feedback d-block">{errors.apellido}</div> : null}
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">DNI</label>
                      <input
                        className={`form-control ${errors.dni ? "is-invalid" : ""}`}
                        value={inlinePersonaForm.dni}
                        onChange={(event) => handlePersonaDniChange(event.target.value)}
                        placeholder="0000-0000-00000"
                        disabled={actionLoading}
                      />
                      {errors.dni ? <div className="invalid-feedback d-block">{errors.dni}</div> : null}
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">RTN (complemento)</label>
                      <input
                        className={`form-control ${errors.rtn ? "is-invalid" : ""}`}
                        value={inlinePersonaForm.rtn}
                        onChange={(event) => handlePersonaRtnChange(event.target.value)}
                        placeholder="0"
                        disabled={actionLoading}
                      />
                      {errors.rtn ? <div className="invalid-feedback d-block">{errors.rtn}</div> : null}
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">Genero</label>
                      <Select
                        inputId="cliente-genero-select"
                        className={errors.genero ? "is-invalid" : ""}
                        classNamePrefix="clientes-genero-select"
                        placeholder="Selecciona genero"
                        isClearable
                        options={[
                          { value: "M", label: "Masculino" },
                          { value: "F", label: "Femenino" },
                          { value: "O", label: "Otro" },
                        ]}
                        value={
                          [
                            { value: "M", label: "Masculino" },
                            { value: "F", label: "Femenino" },
                            { value: "O", label: "Otro" },
                          ].find((option) => option.value === String(inlinePersonaForm.genero ?? "").trim().toUpperCase()) || null
                        }
                        onChange={(option) => handlePersonaBaseFieldChange("genero", option?.value || "")}
                        styles={buildClientesSelectStyles(Boolean(errors.genero))}
                        menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                        menuPosition="fixed"
                        isDisabled={actionLoading}
                      />
                      {errors.genero ? <div className="invalid-feedback d-block">{errors.genero}</div> : null}
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">Fecha nacimiento</label>
                      <input
                        type="date"
                        className={`form-control ${errors.fecha_nacimiento ? "is-invalid" : ""}`}
                        value={inlinePersonaForm.fecha_nacimiento}
                        onChange={(event) => handlePersonaBaseFieldChange("fecha_nacimiento", event.target.value)}
                        disabled={actionLoading}
                      />
                      {errors.fecha_nacimiento ? <div className="invalid-feedback d-block">{errors.fecha_nacimiento}</div> : null}
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">Telefono</label>
                      <input
                        className={`form-control ${errors.id_telefono ? "is-invalid" : ""}`}
                        value={inlinePersonaForm.id_telefono}
                        onChange={(event) => handlePersonaTelefonoChange(event.target.value)}
                        placeholder="9999-9999"
                        disabled={actionLoading}
                      />
                      {errors.id_telefono ? <div className="invalid-feedback d-block">{errors.id_telefono}</div> : null}
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">Correo</label>
                      <input
                        type="email"
                        className={`form-control ${errors.id_correo ? "is-invalid" : ""}`}
                        value={inlinePersonaForm.id_correo}
                        onChange={(event) => handlePersonaBaseFieldChange("id_correo", event.target.value)}
                        placeholder="usuario@dominio.com"
                        disabled={actionLoading}
                      />
                      {errors.id_correo ? <div className="invalid-feedback d-block">{errors.id_correo}</div> : null}
                    </div>
                    <div className="col-12">
                      <label className="form-label">Direccion</label>
                      <input
                        className="form-control"
                        value={inlinePersonaForm.id_direccion}
                        onChange={(event) => handlePersonaBaseFieldChange("id_direccion", event.target.value)}
                        placeholder="Ej. Col. Centro, Tegucigalpa"
                        disabled={actionLoading}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="col-12">
                      <h6 className="mb-1">Datos de empresa del cliente</h6>
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">RTN</label>
                      <input
                        className={`form-control ${errors.rtn ? "is-invalid" : ""}`}
                        value={inlineEmpresaForm.rtn}
                        onChange={(event) => handleEmpresaRtnChange(event.target.value)}
                        placeholder="0000-0000-000000"
                        disabled={actionLoading}
                      />
                      {errors.rtn ? <div className="invalid-feedback d-block">{errors.rtn}</div> : null}
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">Nombre empresa</label>
                      <input
                        className={`form-control ${errors.nombre_empresa ? "is-invalid" : ""}`}
                        value={inlineEmpresaForm.nombre_empresa}
                        onChange={(event) => handleEmpresaBaseFieldChange("nombre_empresa", event.target.value)}
                        placeholder="Ej. Inversiones Jonny's S. de R.L."
                        disabled={actionLoading}
                      />
                      {errors.nombre_empresa ? <div className="invalid-feedback d-block">{errors.nombre_empresa}</div> : null}
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">Telefono</label>
                      <input
                        className={`form-control ${errors.id_telefono ? "is-invalid" : ""}`}
                        value={inlineEmpresaForm.id_telefono}
                        onChange={(event) => handleEmpresaTelefonoChange(event.target.value)}
                        placeholder="9999-9999"
                        disabled={actionLoading}
                      />
                      {errors.id_telefono ? <div className="invalid-feedback d-block">{errors.id_telefono}</div> : null}
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">Correo</label>
                      <input
                        type="email"
                        className={`form-control ${errors.id_correo ? "is-invalid" : ""}`}
                        value={inlineEmpresaForm.id_correo}
                        onChange={(event) => handleEmpresaBaseFieldChange("id_correo", event.target.value)}
                        placeholder="empresa@dominio.com"
                        disabled={actionLoading}
                      />
                      {errors.id_correo ? <div className="invalid-feedback d-block">{errors.id_correo}</div> : null}
                    </div>
                    <div className="col-12">
                      <label className="form-label">Direccion</label>
                      <input
                        className="form-control"
                        value={inlineEmpresaForm.id_direccion}
                        onChange={(event) => handleEmpresaBaseFieldChange("id_direccion", event.target.value)}
                        placeholder="Ej. Blvd. Morazan, Tegucigalpa"
                        disabled={actionLoading}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="d-flex gap-2 mt-4 crud-modal__footer">
                <button
                  type="button"
                  className="btn inv-prod-btn-subtle flex-fill crud-modal__btn"
                  onClick={handleBackToCreateStepOne}
                  disabled={actionLoading || !!deletingId}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  className="btn inv-prod-btn-primary flex-fill crud-modal__btn"
                  onClick={handleNextToCommercialStep}
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
                  <span className={`clientes-origin-chip ${clienteOriginType === "empresa" ? "is-empresa" : "is-persona"}`}>
                    {formOriginLabel}
                  </span>
                  <span className="clientes-modal__origin-caption">
                    {isCreateFlow ? "Paso 3: Confirmar y crear cliente" : "Datos comerciales del cliente"}
                  </span>
                </div>
                <p className="clientes-modal__origin-text">
                  {isCreateFlow
                    ? "Verifica los datos ingresados en el paso anterior. Al confirmar, se creara el cliente."
                    : "Edita los datos comerciales y los datos base vinculados del cliente."}
                </p>
              </div>

              <div className="row g-3 crud-modal__grid">
                {!isCreateFlow ? (
                  <div className="col-12">
                    {clienteOriginType === "persona" ? (
                      <div className="smart-select-entity__summary clientes-inline-summary clientes-modal__entity-block">
                        <div className="clientes-inline-summary__head">
                          <span className="clientes-inline-summary__status is-ready">
                            <i className="bi bi-check2-circle" />
                            Datos base del cliente
                          </span>
                          <span className="clientes-inline-summary__kind">Individual</span>
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
                          Editar datos base del cliente
                        </button>
                      </div>
                    ) : (
                      <div className="smart-select-entity__summary clientes-inline-summary clientes-modal__entity-block">
                        <div className="clientes-inline-summary__head">
                          <span className="clientes-inline-summary__status is-ready">
                            <i className="bi bi-check2-circle" />
                            Datos base del cliente
                          </span>
                          <span className="clientes-inline-summary__kind">Empresa</span>
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
                          Editar datos base del cliente
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}

                {isCreateFlow ? (
                  <div className="col-12">
                    <div className="clientes-inline-summary">
                      <div className="clientes-inline-summary__head">
                        <span className="clientes-inline-summary__status is-ready">
                          <i className="bi bi-check2-circle" />
                          Resumen final
                        </span>
                        <span className="clientes-inline-summary__kind">{formOriginLabel}</span>
                      </div>
                      <div className="clientes-inline-summary__text">
                        Revisa la informacion antes de crear el cliente.
                      </div>
                      <div className="clientes-inline-summary__meta-grid">
                        {(clienteOriginType === "empresa" ? createEmpresaSummaryRows : createPersonaSummaryRows).map((item) => (
                          <div key={item.label} className="clientes-inline-summary__meta-item">
                            <span>{item.label}</span>
                            <strong>{toDisplayValue(item.value, "No registrado")}</strong>
                          </div>
                        ))}
                      </div>
                      <div className="alert alert-light border mb-0">
                        <div className="fw-semibold mb-1">Configuracion automatica</div>
                        <div className="small text-muted">
                          El cliente se registrara como tipo General. La fecha de ingreso se asigna automaticamente y los puntos se administran desde Fidelizacion.
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="col-12">
                      <h6 className="mb-1">Datos comerciales del cliente</h6>
                    </div>
                    <div className="col-12">
                      <div className="alert alert-light border mb-0">
                        <div className="fw-semibold mb-1">Configuracion automatica</div>
                        <div className="small text-muted">
                          Este cliente se registrara como tipo General. La fecha de ingreso sera asignada automaticamente y los puntos se administran desde Fidelizacion.
                        </div>
                      </div>
                    </div>
                  </>
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
                    onClick={handleBackToCreateStepTwo}
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
                  onClick={() => {
                    if (drawerMode === "create") setCreateSubmissionRequested(true);
                  }}
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
        saveLabel={drawerMode === "edit" ? "Guardar cambios" : "Crear"}
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
                <div className="inv-pro-confirm-title">
                  {confirmModal.estadoActual ? "CONFIRMAR INACTIVACION" : "CONFIRMAR ACTIVACION"}
                </div>
                <div className="inv-pro-confirm-sub">
                  {confirmModal.estadoActual
                    ? "El cliente se ocultara del listado activo"
                    : "El cliente volvera al listado activo"}
                </div>
              </div>
              <button type="button" className="inv-pro-confirm-close" onClick={closeConfirmDelete} aria-label="Cerrar">
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <div className="inv-pro-confirm-body">
              <div className="inv-pro-confirm-question">
                {confirmModal.estadoActual ? "Deseas inactivar este cliente?" : "Deseas activar este cliente?"}
              </div>
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
                <i className={`bi ${confirmModal.estadoActual ? "bi-slash-circle" : "bi-check-circle"}`} />
                <span>{confirmModal.estadoActual ? "Inactivar" : "Activar"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clientes;
