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

const createInitialFiltersDraft = () => ({
  estadoFiltro: "todos",
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

const resolveClienteOrigen = (cliente) => {
  const explicitOrigen = normalizeValue(cliente?.origen_cliente);
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

  if (explicitOrigen === "empresa") return "empresa";
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
    tipo_cliente: tipoCliente || null,
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

const resolveClienteSucursalId = (cliente) =>
  parsePositiveInteger(
    firstNonEmptyValue(
      cliente?.id_sucursal,
      cliente?.sucursal_id,
      cliente?.persona_id_sucursal,
      cliente?.empresa_id_sucursal
    )
  );

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
  const [clienteOriginType, setClienteOriginType] = useState("persona");
  const [errors, setErrors] = useState({});
  const [useInlinePersonaCreate, setUseInlinePersonaCreate] = useState(false);
  const [useInlineEmpresaCreate, setUseInlineEmpresaCreate] = useState(false);
  const [inlinePersonaForm, setInlinePersonaForm] = useState(emptyInlinePersonaForm);
  const [inlineEmpresaForm, setInlineEmpresaForm] = useState(emptyInlineEmpresaForm);
  const [showPersonaCreateModal, setShowPersonaCreateModal] = useState(false);
  const [showEmpresaCreateModal, setShowEmpresaCreateModal] = useState(false);

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
  const catalogosCargadosRef = useRef(false);
  const panelRef = useRef(null);
  const empresaSearchCacheRef = useRef(new Map());
  const tipoSearchCacheRef = useRef(new Map());
  const empresaDebounceTimerRef = useRef(null);
  const tipoDebounceTimerRef = useRef(null);
  const empresaAbortRef = useRef(null);
  const empresaAsyncReqSeqRef = useRef(0);
  const tipoAsyncReqSeqRef = useRef(0);
  const sucursalFallbackNoticeRef = useRef('');

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
    blurFocusedElementInside("cli-form-drawer");
    setShowPersonaCreateModal(false);
    setShowEmpresaCreateModal(false);
    setShowModal(false);
  }, [blurFocusedElementInside]);

  const personaOptions = useMemo(
    () =>
      (Array.isArray(personasCatalogo) ? personasCatalogo : []).map((p) => {
        const id = p?.id_persona;
        const nombreCompleto = `${p?.nombre || ""} ${p?.apellido || ""}`.trim();
        return {
          id: id ? String(id) : "",
          label: nombreCompleto || `Persona #${id ?? "N/D"}`,
          dni: p?.dni || "",
        };
      }),
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

  const personaSelectValue = useMemo(() => {
    const selectedId = String(form.id_persona ?? "");
    if (!selectedId) return null;
    return personaSelectOptions.find((option) => option.value === selectedId) || null;
  }, [form.id_persona, personaSelectOptions]);

  const personaSelectStyles = useMemo(
    () => buildClientesSelectStyles(Boolean(errors.id_persona)),
    [errors.id_persona]
  );

  const empresaOptions = useMemo(
    () =>
      (Array.isArray(empresasCatalogo) ? empresasCatalogo : []).map((e) => {
        const id = e?.id_empresa;
        const nombreEmpresa = String(e?.nombre_empresa || `Empresa #${id ?? "N/D"}`).trim();
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
    const nombre = firstNonEmptyValue(clienteActual?.nombre_empresa, clienteActual?.nombre_principal, `Empresa #${selectedId}`);
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

  const empresaSelectValue = useMemo(() => {
    const selectedId = String(form.id_empresa ?? "").trim();
    if (!selectedId) return null;
    return (
      empresaSelectOptionsById.get(selectedId)
      || empresaSelectFallbackValue
      || {
        value: selectedId,
        label: `Empresa #${selectedId}`,
        searchText: normalizeSearchKey(`empresa ${selectedId}`),
      }
    );
  }, [form.id_empresa, empresaSelectOptionsById, empresaSelectFallbackValue]);

  const empresaSelectStyles = useMemo(
    () => buildClientesSelectStyles(Boolean(errors.id_empresa)),
    [errors.id_empresa]
  );

  const empresaDefaultOptions = useMemo(
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
    const label = firstNonEmptyValue(clienteActual?.tipo_cliente, `Tipo #${selectedId}`);
    return {
      value: selectedId,
      label,
      searchText: normalizeSearchKey(label),
    };
  }, [clientes, editId, form.id_tipo_cliente]);

  const tipoClienteSelectValue = useMemo(() => {
    const selectedId = String(form.id_tipo_cliente ?? "").trim();
    if (!selectedId) return null;
    return (
      tipoClienteSelectOptionsById.get(selectedId)
      || tipoClienteSelectFallbackValue
      || {
        value: selectedId,
        label: `Tipo #${selectedId}`,
        searchText: normalizeSearchKey(`tipo ${selectedId}`),
      }
    );
  }, [form.id_tipo_cliente, tipoClienteSelectOptionsById, tipoClienteSelectFallbackValue]);

  const tipoClienteSelectStyles = useMemo(
    () => buildClientesSelectStyles(Boolean(errors.id_tipo_cliente)),
    [errors.id_tipo_cliente]
  );

  const tipoClienteDefaultOptions = useMemo(
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
        cliente?.id_empresa
          ? String(cliente.id_empresa)
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

  const loadEmpresaOptions = useCallback(
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
                const nombreEmpresa = firstNonEmptyValue(item?.nombre_empresa, `Empresa #${id || "N/D"}`);
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

  const loadTipoClienteOptions = useCallback(
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

  const cargarCatalogos = useCallback(async () => {
    if (catalogosCargadosRef.current) return;

    try {
      const [personasResp, empresasResp, tiposResp] = await Promise.all([
        personaService.getPersonasDetalle(1, 100),
        personaService.getEmpresas({ page: 1, limit: 100 }),
        parametrosService.listarCatalogo("tipo_cliente"),
      ]);

      if (!mountedRef.current) return;

      setPersonasCatalogo(normalizeListResponse(personasResp).items);
      setEmpresasCatalogo(normalizeListResponse(empresasResp).items);
      setTiposCliente(normalizeArrayPayload(tiposResp));
      catalogosCargadosRef.current = true;
    } catch (error) {
      safeToast("ERROR", error.message || "No se pudieron cargar catalogos", "danger");
    }
  }, [safeToast]);

  const cargarClientes = useCallback(async () => {
    setLoading(true);
    const requestId = ++requestIdRef.current;
    const normalizedSucursalId = parsePositiveInteger(selectedSucursalId);

    try {
      const resp = await personaService.getClientes({
        page,
        limit,
        nombre: debouncedSearch || undefined,
        id_sucursal: normalizedSucursalId || undefined,
      });

      if (!mountedRef.current || requestId !== requestIdRef.current) return;

      const scopeMode = String(resp?.scope_info?.mode ?? '').trim().toLowerCase();
      if (normalizedSucursalId && scopeMode === 'global_fallback') {
        const marker = String(normalizedSucursalId);
        if (sucursalFallbackNoticeRef.current !== marker) {
          sucursalFallbackNoticeRef.current = marker;
          safeToast(
            'INFO',
            'Clientes se muestra en modo global: el modelo actual no permite filtrar por sucursal en backend.',
            'info'
          );
        }
      } else if (scopeMode !== 'global_fallback') {
        sucursalFallbackNoticeRef.current = '';
      }

      const { items, total: totalResp } = normalizeListResponse(resp);
      const normalizedItems = (Array.isArray(items) ? items : []).map(normalizeClienteForView);
      const hasSucursalMetadata = normalizedItems.some((item) => resolveClienteSucursalId(item) !== null);
      const filteredItems =
        normalizedSucursalId && hasSucursalMetadata
          ? normalizedItems.filter((item) => {
              const itemSucursalId = resolveClienteSucursalId(item);
              if (!itemSucursalId) return true;
              return itemSucursalId === normalizedSucursalId;
            })
          : normalizedItems;

      setClientes(filteredItems);
      setTotal(
        normalizedSucursalId && hasSucursalMetadata
          ? filteredItems.length
          : totalResp
      );
    } catch (error) {
      if (!mountedRef.current) return;
      safeToast("ERROR", error.message || "No se pudo cargar clientes", "danger");
      setClientes([]);
      setTotal(0);
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [page, limit, debouncedSearch, safeToast, selectedSucursalId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
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
    cargarClientes();
  }, [cargarClientes]);

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
    const tipoClienteId = String(form.id_tipo_cliente ?? "").trim();
    const contextSucursalId = parsePositiveInteger(selectedSucursalId);

    return {
      id_persona: personaId ? parseIntegerValue(personaId) : null,
      id_empresa: empresaId ? parseIntegerValue(empresaId) : null,
      id_tipo_cliente: tipoClienteId ? parseIntegerValue(tipoClienteId) : null,
      id_sucursal: contextSucursalId || null,
      fecha_ingreso: form.fecha_ingreso,
      puntos: parseIntegerValue(form.puntos),
      estado: Boolean(form.estado),
    };
  };

  const validar = () => {
    const currentErrors = {};
    const today = new Date().toISOString().split("T")[0];
    const payload = sanitizeForm();
    const hasPersona = Boolean(String(form.id_persona ?? "").trim());
    const hasEmpresa = Boolean(String(form.id_empresa ?? "").trim());
    const usingInlinePersona = clienteOriginType === "persona" && useInlinePersonaCreate;
    const usingInlineEmpresa = clienteOriginType === "empresa" && useInlineEmpresaCreate;

    if (hasPersona && hasEmpresa) {
      currentErrors.id_persona = "Solo puede seleccionar una opcion";
      currentErrors.id_empresa = "Solo puede seleccionar una opcion";
    } else if (clienteOriginType === "persona") {
      if (!hasPersona && !usingInlinePersona) currentErrors.id_persona = "Seleccione una persona";
      if (hasEmpresa) currentErrors.id_empresa = "No aplica para Cliente Persona";
    } else if (clienteOriginType === "empresa") {
      if (!hasEmpresa && !usingInlineEmpresa) currentErrors.id_empresa = "Seleccione una empresa";
      if (hasPersona) currentErrors.id_persona = "No aplica para Cliente Empresa";
    }

    if (usingInlinePersona) {
      const personaValidationErrors = validatePersonaForm(inlinePersonaForm);
      if (Object.keys(personaValidationErrors).length > 0) {
        currentErrors.id_persona = "Completa los datos de la persona nueva";
      }
    }

    if (usingInlineEmpresa) {
      const empresaValidationErrors = validateEmpresaForm(inlineEmpresaForm);
      if (Object.keys(empresaValidationErrors).length > 0) {
        currentErrors.id_empresa = "Completa los datos de la empresa nueva";
      }
    }

    if (!form.id_tipo_cliente) currentErrors.id_tipo_cliente = "Seleccione";
    if (!form.fecha_ingreso || form.fecha_ingreso > today) currentErrors.fecha_ingreso = "Fecha invalida";
    if (form.puntos === "") currentErrors.puntos = "Requerido";
    if (Number.isNaN(payload.puntos) || payload.puntos < 0) currentErrors.puntos = "Debe ser entero mayor o igual a 0";

    setErrors(currentErrors);
    return Object.keys(currentErrors).length === 0;
  };

  const guardar = async (event) => {
    event.preventDefault();
    if (!validar() || actionLoading) return;
    const contextSucursalId = parsePositiveInteger(selectedSucursalId);
    if (!editId && !contextSucursalId) {
      safeToast("INFO", "Selecciona una sucursal antes de crear el cliente", "info");
      return;
    }

    const payloadLimpio = sanitizeForm();
    setActionLoading(true);

    try {
      if (editId) {
        const clienteOriginal = clientes.find((item) => String(item.id_cliente) === String(editId));
        if (!clienteOriginal) {
          safeToast("ERROR", "No se encontro el registro a editar", "danger");
          await cargarClientes();
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
            updatePayload[key] = payloadLimpio[key];
          });

          await personaService.updateCliente(editId, updatePayload);
          safeToast("OK", "Cliente actualizado");
        }
      } else {
        if (clienteOriginType === "persona" && useInlinePersonaCreate) {
          await personaService.createClienteAtomico({
            origen: "persona",
            persona: buildPersonaPayloadFromForm(inlinePersonaForm),
            cliente: payloadLimpio,
          });
        } else if (clienteOriginType === "empresa" && useInlineEmpresaCreate) {
          await personaService.createClienteAtomico({
            origen: "empresa",
            empresa: buildEmpresaPayloadFromForm(inlineEmpresaForm),
            cliente: payloadLimpio,
          });
        } else {
          await personaService.createCliente(payloadLimpio);
        }
        safeToast("OK", "Cliente creado");
      }

      closeFormDrawer();
      setEditId(null);
      setForm(emptyForm);
      setUseInlinePersonaCreate(false);
      setUseInlineEmpresaCreate(false);
      setInlinePersonaForm(emptyInlinePersonaForm);
      setInlineEmpresaForm(emptyInlineEmpresaForm);
      setShowPersonaCreateModal(false);
      setShowEmpresaCreateModal(false);
      await cargarClientes();
    } catch (error) {
      safeToast("ERROR", error.message || "No se pudo guardar", "danger");
    } finally {
      if (mountedRef.current) setActionLoading(false);
    }
  };

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

  const iniciarEdicion = (cliente) => {
    setFiltersOpen(false);
    setEditId(cliente.id_cliente);
    setErrors({});
    setUseInlinePersonaCreate(false);
    setUseInlineEmpresaCreate(false);
    setInlinePersonaForm(emptyInlinePersonaForm);
    setInlineEmpresaForm(emptyInlineEmpresaForm);
    setShowPersonaCreateModal(false);
    setShowEmpresaCreateModal(false);
    const formValues = buildFormFromCliente(cliente);
    setForm(formValues);
    setClienteOriginType(formValues.id_empresa ? "empresa" : "persona");
    setShowModal(true);
  };

  const openCreate = () => {
    if (actionLoading || deletingId) return;
    setFiltersOpen(false);
    setEditId(null);
    setErrors({});
    setForm(emptyForm);
    setClienteOriginType("persona");
    setUseInlinePersonaCreate(false);
    setUseInlineEmpresaCreate(false);
    setInlinePersonaForm(emptyInlinePersonaForm);
    setInlineEmpresaForm(emptyInlineEmpresaForm);
    setShowPersonaCreateModal(false);
    setShowEmpresaCreateModal(false);
    setShowModal(true);
  };

  const handleOriginTypeChange = (nextType) => {
    if (nextType !== "persona" && nextType !== "empresa") return;
    setClienteOriginType(nextType);
    setForm((state) =>
      nextType === "persona"
        ? { ...state, id_empresa: "" }
        : { ...state, id_persona: "" }
    );
    if (nextType === "persona") {
      setUseInlineEmpresaCreate(false);
      setInlineEmpresaForm(emptyInlineEmpresaForm);
      setShowPersonaCreateModal(false);
      setShowEmpresaCreateModal(false);
    } else {
      setUseInlinePersonaCreate(false);
      setInlinePersonaForm(emptyInlinePersonaForm);
      setShowPersonaCreateModal(false);
      setShowEmpresaCreateModal(false);
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
      await personaService.deleteCliente(id);

      if (String(editId) === String(id)) {
        closeFormDrawer();
        setEditId(null);
        setForm(emptyForm);
      }

      const quedaVaciaPagina = clientes.length === 1 && page > 1;
      if (quedaVaciaPagina) {
        setPage((prev) => Math.max(1, prev - 1));
      } else {
        await cargarClientes();
      }

      safeToast("OK", "Cliente eliminado");
      closeConfirmDelete();
    } catch (error) {
      safeToast("ERROR", error.message || "No se pudo eliminar", "danger");
      await cargarClientes();
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
    recentStorageKey: "clientesRecentSearchesV1",
  });

  const stats = useMemo(() => {
    const totalFiltradas = clientesFiltrados.length;
    const activas = clientesFiltrados.filter((item) => isActivo(item)).length;
    return { total: totalFiltradas, activas, inactivas: totalFiltradas - activas };
  }, [clientesFiltrados]);

  const hasActiveFilters = useMemo(
    () => search.trim() !== "" || estadoFiltro !== "todos" || sortBy !== "recientes",
    [search, estadoFiltro, sortBy]
  );

  const drawerMode = editId ? "edit" : "create";
  const colsClass = cardsPerPage >= 6 ? "cols-3" : cardsPerPage >= 4 ? "cols-2" : "cols-1";
  const personaDisabled = actionLoading || clienteOriginType === "empresa";
  const empresaDisabled = actionLoading || clienteOriginType === "persona";
  const formOriginLabel = clienteOriginType === "empresa" ? "Cliente Empresa" : "Cliente Persona";

  const openFiltersDrawer = () => {
    if (actionLoading) return;
    closeFormDrawer();
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
            ) : viewMode === "table" ? (
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
                {clientesFiltrados.map((cliente, idx) => (
                  <ClienteCard
                    key={cliente?.id_cliente ?? idx}
                    cliente={cliente}
                    index={(page - 1) * limit + idx}
                    onOpenEdit={iniciarEdicion}
                    onOpenDelete={openConfirmDelete}
                    actionLoading={actionLoading}
                    deletingId={deletingId}
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
        drawerId="cli-filtros-drawer"
        iconClass="bi bi-person-lines-fill"
        title="Filtros de clientes"
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
        className={`inv-prod-drawer inv-cat-v2__drawer crud-modal clientes-modal ${showModal ? "show" : ""} ${
          drawerMode === "create" ? "is-create" : "is-edit"
        }`}
        id="cli-form-drawer"
        role="dialog"
        aria-modal="true"
        aria-hidden={!showModal}
      >
        <div className="inv-prod-drawer-head crud-modal__header">
          <div className="crud-modal__header-copy">
            <div className="inv-prod-drawer-title crud-modal__title">{drawerMode === "create" ? "Nuevo cliente" : "Editar cliente"}</div>
            <div className="inv-prod-drawer-sub crud-modal__subtitle">
              Completa los campos y guarda los cambios.
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

            <div className="clientes-modal__origin-row">
              <span
                className={`clientes-origin-chip ${clienteOriginType === "empresa" ? "is-empresa" : "is-persona"}`}
              >
                {formOriginLabel}
              </span>
              <span className="clientes-modal__origin-caption">
                {drawerMode === "edit" ? "Origen actual del cliente" : "Define el origen del cliente"}
              </span>
            </div>
            <p className="clientes-modal__origin-text">
              Seleccione una persona o una empresa. Solo puede elegir una opcion.
            </p>
          </div>

          <div className="row g-3 crud-modal__grid">
            {clienteOriginType === "persona" ? (
              <div className="col-12">
                <SmartSelectEntity
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
                  toggleCreateLabel="+ Crear persona nueva"
                  toggleExistingLabel="Usar persona existente"
                  toggleDisabled={actionLoading}
                  selector={
                    <Select
                      inputId="cliente-persona-select"
                      className={`clientes-persona-select ${errors.id_persona ? "is-invalid" : ""}`}
                      classNamePrefix="clientes-persona-select"
                      placeholder="Seleccione"
                      isSearchable
                      isClearable
                      options={personaSelectOptions}
                      value={personaSelectValue}
                      onChange={(option) => {
                        setClienteOriginType("persona");
                        setForm((state) => ({
                          ...state,
                          id_persona: option?.value ? String(option.value) : "",
                          id_empresa: "",
                        }));
                        setErrors((state) => ({ ...state, id_persona: undefined, id_empresa: undefined }));
                      }}
                      styles={personaSelectStyles}
                      menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                      menuPosition="fixed"
                      isDisabled={personaDisabled || useInlinePersonaCreate}
                    />
                  }
                  error={errors.id_persona}
                  helperText='Para cambiar a empresa, selecciona primero el tipo "Cliente Empresa".'
                  inlineContent={
                    <div className="smart-select-entity__summary">
                      <div className="small text-muted mb-2">
                        {String(inlinePersonaForm.nombre ?? "").trim()
                          ? "Persona nueva lista para guardar."
                          : "Completa los datos de la persona nueva para continuar."}
                      </div>
                      <div className="d-flex flex-wrap gap-2 align-items-center">
                        <span className="badge text-bg-light border">
                          {String(inlinePersonaForm.nombre ?? "").trim() || "Sin nombre"}{" "}
                          {String(inlinePersonaForm.apellido ?? "").trim()}
                        </span>
                        <span className="badge text-bg-light border">
                          DNI: {toDisplayValue(inlinePersonaForm.dni, "N/D")}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary mt-2"
                        onClick={() => setShowPersonaCreateModal(true)}
                        disabled={actionLoading}
                      >
                        {String(inlinePersonaForm.nombre ?? "").trim()
                          ? "Editar datos de persona"
                          : "Completar datos de persona"}
                      </button>
                    </div>
                  }
                />
              </div>
            ) : (
              <div className="col-12">
                <SmartSelectEntity
                  label="Empresa"
                  showToggle={drawerMode === "create"}
                  isInlineCreate={drawerMode === "create" && useInlineEmpresaCreate}
                  onToggleInline={() => {
                    setUseInlineEmpresaCreate((prev) => {
                      const next = !prev;
                      if (next) {
                        setShowEmpresaCreateModal(true);
                        setForm((state) => ({ ...state, id_empresa: "" }));
                      } else {
                        setInlineEmpresaForm(emptyInlineEmpresaForm);
                        setShowEmpresaCreateModal(false);
                      }
                      return next;
                    });
                    setErrors((state) => ({ ...state, id_empresa: undefined }));
                  }}
                  toggleCreateLabel="+ Crear empresa nueva"
                  toggleExistingLabel="Usar empresa existente"
                  toggleDisabled={actionLoading}
                  selector={
                    <AsyncSelect
                      inputId="cliente-empresa-select"
                      className={`clientes-persona-select ${errors.id_empresa ? "is-invalid" : ""}`}
                      classNamePrefix="clientes-persona-select"
                      placeholder="Seleccione"
                      cacheOptions
                      defaultOptions={empresaDefaultOptions}
                      loadOptions={loadEmpresaOptions}
                      isClearable
                      value={empresaSelectValue}
                      onChange={(option) => {
                        setClienteOriginType("empresa");
                        setForm((state) => ({
                          ...state,
                          id_empresa: option?.value ? String(option.value) : "",
                          id_persona: "",
                        }));
                        setErrors((state) => ({ ...state, id_persona: undefined, id_empresa: undefined }));
                      }}
                      styles={empresaSelectStyles}
                      menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                      menuPosition="fixed"
                      isDisabled={empresaDisabled || useInlineEmpresaCreate}
                      noOptionsMessage={() => "No se encontraron resultados"}
                      loadingMessage={() => "Buscando..."}
                    />
                  }
                  error={errors.id_empresa}
                  helperText='Para cambiar a persona, selecciona primero el tipo "Cliente Persona".'
                  inlineContent={
                    <div className="smart-select-entity__summary">
                      <div className="small text-muted mb-2">
                        {String(inlineEmpresaForm.nombre_empresa ?? "").trim()
                          ? "Empresa nueva lista para guardar."
                          : "Completa los datos de la empresa nueva para continuar."}
                      </div>
                      <div className="d-flex flex-wrap gap-2 align-items-center">
                        <span className="badge text-bg-light border">
                          {String(inlineEmpresaForm.nombre_empresa ?? "").trim() || "Sin nombre de empresa"}
                        </span>
                        <span className="badge text-bg-light border">
                          RTN: {toDisplayValue(inlineEmpresaForm.rtn, "N/D")}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary mt-2"
                        onClick={() => setShowEmpresaCreateModal(true)}
                        disabled={actionLoading}
                      >
                        {String(inlineEmpresaForm.nombre_empresa ?? "").trim()
                          ? "Editar datos de empresa"
                          : "Completar datos de empresa"}
                      </button>
                    </div>
                  }
                />
              </div>
            )}

            <div className="col-12">
              <label className="form-label text-light text-opacity-75">Tipo cliente</label>
              <AsyncSelect
                inputId="cliente-tipo-select"
                className={`clientes-persona-select ${errors.id_tipo_cliente ? "is-invalid" : ""}`}
                classNamePrefix="clientes-persona-select"
                placeholder="Seleccione"
                cacheOptions
                defaultOptions={tipoClienteDefaultOptions}
                loadOptions={loadTipoClienteOptions}
                isClearable={false}
                value={tipoClienteSelectValue}
                onChange={(option) =>
                  setForm((state) => ({
                    ...state,
                    id_tipo_cliente: option?.value ? String(option.value) : "",
                  }))
                }
                styles={tipoClienteSelectStyles}
                menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                menuPosition="fixed"
                noOptionsMessage={() => "No se encontraron resultados"}
                loadingMessage={() => "Buscando..."}
              />
              {errors.id_tipo_cliente && <div className="invalid-feedback d-block">{errors.id_tipo_cliente}</div>}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label text-light text-opacity-75">Fecha ingreso</label>
              <input
                type="date"
                className={`form-control ${errors.fecha_ingreso ? "is-invalid" : ""}`}
                value={form.fecha_ingreso}
                onChange={(event) => setForm((state) => ({ ...state, fecha_ingreso: event.target.value }))}
              />
              {errors.fecha_ingreso && <div className="invalid-feedback d-block">{errors.fecha_ingreso}</div>}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label text-light text-opacity-75">Puntos</label>
              <input
                type="number"
                step="1"
                min="0"
                className={`form-control ${errors.puntos ? "is-invalid" : ""}`}
                value={form.puntos}
                onChange={(event) => setForm((state) => ({ ...state, puntos: event.target.value }))}
              />
              {errors.puntos && <div className="invalid-feedback d-block">{errors.puntos}</div>}
            </div>

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
              type="submit"
              className="btn inv-prod-btn-primary flex-fill crud-modal__btn"
              disabled={actionLoading || !!deletingId}
            >
              {actionLoading ? "Guardando..." : drawerMode === "create" ? "Crear" : "Guardar"}
            </button>
          </div>
        </form>
      </aside>

      <PersonaInlineCreateModal
        show={
          showModal &&
          drawerMode === "create" &&
          clienteOriginType === "persona" &&
          useInlinePersonaCreate &&
          showPersonaCreateModal
        }
        initialForm={inlinePersonaForm}
        onClose={() => setShowPersonaCreateModal(false)}
        onSave={handleInlinePersonaModalSave}
      />

      <EmpresaInlineCreateModal
        show={
          showModal &&
          drawerMode === "create" &&
          clienteOriginType === "empresa" &&
          useInlineEmpresaCreate &&
          showEmpresaCreateModal
        }
        initialForm={inlineEmpresaForm}
        onClose={() => setShowEmpresaCreateModal(false)}
        onSave={handleInlineEmpresaModalSave}
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
              <div className="inv-pro-confirm-question">Deseas eliminar este cliente?</div>
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
                <i className="bi bi-trash3" />
                <span>Eliminar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clientes;
