import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Select from "react-select";
import { personaService } from "../../../services/personasService";
import { parametrosService } from "../../../services/parametrosService";
import EntityTable from "../../../components/ui/EntityTable";
import HeaderModulo from "./components/common/HeaderModulo";
import ModuleFiltros from "./components/common/ModuleFiltros";
import ModuleKPICards from "./components/common/ModuleKPICards";
import ClienteCard from "./components/clientes/ClienteCard";
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

const normalizeClienteForView = (cliente) => {
  const origen = normalizeValue(cliente?.origen_cliente) === "empresa" ? "empresa" : "persona";
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
    origen_label: firstNonEmptyValue(
      cliente?.origen_label,
      origen === "empresa" ? "Cliente Empresa" : "Cliente Persona"
    ),
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
  const [viewMode, setViewMode] = useState(() => readViewMode("clientesViewMode"));

  const [estadoFiltro, setEstadoFiltro] = useState("todos");
  const [sortBy, setSortBy] = useState("recientes");
  const [filtersDraft, setFiltersDraft] = useState(createInitialFiltersDraft);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [clienteOriginType, setClienteOriginType] = useState("persona");
  const [errors, setErrors] = useState({});

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
        return {
          id: id ? String(id) : "",
          label: String(e?.nombre_empresa || `Empresa #${id ?? "N/D"}`),
        };
      }),
    [empresasCatalogo]
  );

  const empresaSelectOptions = useMemo(
    () =>
      empresaOptions.map((item) => ({
        value: item.id,
        label: item.label,
      })),
    [empresaOptions]
  );

  const empresaSelectValue = useMemo(() => {
    const selectedId = String(form.id_empresa ?? "");
    if (!selectedId) return null;
    return empresaSelectOptions.find((option) => option.value === selectedId) || null;
  }, [form.id_empresa, empresaSelectOptions]);

  const empresaSelectStyles = useMemo(
    () => buildClientesSelectStyles(Boolean(errors.id_empresa)),
    [errors.id_empresa]
  );

  const tipoClienteOptions = useMemo(
    () =>
      (Array.isArray(tiposCliente) ? tiposCliente : []).map((t) => {
        const id = t?.id_tipo_cliente;
        const label = t?.tipo_cliente || t?.descripcion || t?.nombre || `Tipo #${id ?? "N/D"}`;
        return {
          id: id ? String(id) : "",
          label: String(label),
        };
      }),
    [tiposCliente]
  );

  const tipoClienteSelectOptions = useMemo(
    () =>
      tipoClienteOptions.map((item) => ({
        value: item.id,
        label: item.label,
      })),
    [tipoClienteOptions]
  );

  const tipoClienteSelectValue = useMemo(() => {
    const selectedId = String(form.id_tipo_cliente ?? "");
    if (!selectedId) return null;
    return tipoClienteSelectOptions.find((option) => option.value === selectedId) || null;
  }, [form.id_tipo_cliente, tipoClienteSelectOptions]);

  const tipoClienteSelectStyles = useMemo(
    () => buildClientesSelectStyles(Boolean(errors.id_tipo_cliente)),
    [errors.id_tipo_cliente]
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

    try {
      const resp = await personaService.getClientes({
        page,
        limit,
        nombre: search?.trim() || undefined,
      });

      if (!mountedRef.current || requestId !== requestIdRef.current) return;

      const { items, total: totalResp } = normalizeListResponse(resp);
      setClientes((Array.isArray(items) ? items : []).map(normalizeClienteForView));
      setTotal(totalResp);
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
  }, [page, limit, search, safeToast]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    cargarCatalogos();
  }, [cargarCatalogos]);

  useEffect(() => {
    cargarClientes();
  }, [cargarClientes]);

  useEffect(() => {
    setPage(1);
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

    return {
      id_persona: personaId ? parseIntegerValue(personaId) : null,
      id_empresa: empresaId ? parseIntegerValue(empresaId) : null,
      id_tipo_cliente: tipoClienteId ? parseIntegerValue(tipoClienteId) : null,
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

    if (hasPersona && hasEmpresa) {
      currentErrors.id_persona = "Solo puede seleccionar una opcion";
      currentErrors.id_empresa = "Solo puede seleccionar una opcion";
    } else if (clienteOriginType === "persona") {
      if (!hasPersona) currentErrors.id_persona = "Seleccione una persona";
      if (hasEmpresa) currentErrors.id_empresa = "No aplica para Cliente Persona";
    } else if (clienteOriginType === "empresa") {
      if (!hasEmpresa) currentErrors.id_empresa = "Seleccione una empresa";
      if (hasPersona) currentErrors.id_persona = "No aplica para Cliente Empresa";
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
        await personaService.createCliente(payloadLimpio);
        safeToast("OK", "Cliente creado");
      }

      closeFormDrawer();
      setEditId(null);
      setForm(emptyForm);
      await cargarClientes();
    } catch (error) {
      safeToast("ERROR", error.message || "No se pudo guardar", "danger");
    } finally {
      if (mountedRef.current) setActionLoading(false);
    }
  };

  const iniciarEdicion = (cliente) => {
    setFiltersOpen(false);
    setEditId(cliente.id_cliente);
    setErrors({});
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
    setSearch("");
    clearVisualFilters();
    setFiltersOpen(false);
  };

  const closeAnyDrawer = () => {
    if (actionLoading) return;
    closeFormDrawer();
    setFiltersOpen(false);
  };

  return (
    <div className="personas-page">
      <div className="inv-catpro-card inv-prod-card personas-page__panel mb-3">
        <HeaderModulo
          iconClass="bi bi-person-lines-fill"
          title="Clientes"
          subtitle="Gestion visual de clientes"
          search={search}
          onSearchChange={setSearch}
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
                            </div>
                          </td>
                          <td>{toDisplayValue(cliente?.nombre_empresa)}</td>
                          <td>{toDisplayValue(cliente?.documento_valor, "N/D")}</td>
                          <td>{toDisplayValue(cliente?.telefono, "Sin telefono")}</td>
                          <td>{toDisplayValue(cliente?.correo, "Sin correo")}</td>
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
                <label className="form-label text-light text-opacity-75">Persona</label>
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
                  isDisabled={personaDisabled}
                />
                {errors.id_persona && <div className="invalid-feedback d-block">{errors.id_persona}</div>}
                <small className="clientes-modal__field-hint">
                  Para cambiar a empresa, selecciona primero el tipo "Cliente Empresa".
                </small>
              </div>
            ) : (
              <div className="col-12">
                <label className="form-label text-light text-opacity-75">Empresa</label>
                <Select
                  inputId="cliente-empresa-select"
                  className={`clientes-persona-select ${errors.id_empresa ? "is-invalid" : ""}`}
                  classNamePrefix="clientes-persona-select"
                  placeholder="Seleccione"
                  isSearchable
                  isClearable
                  options={empresaSelectOptions}
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
                  isDisabled={empresaDisabled}
                />
                {errors.id_empresa && <div className="invalid-feedback d-block">{errors.id_empresa}</div>}
                <small className="clientes-modal__field-hint">
                  Para cambiar a persona, selecciona primero el tipo "Cliente Persona".
                </small>
              </div>
            )}

            <div className="col-12">
              <label className="form-label text-light text-opacity-75">Tipo cliente</label>
              <Select
                inputId="cliente-tipo-select"
                className={`clientes-persona-select ${errors.id_tipo_cliente ? "is-invalid" : ""}`}
                classNamePrefix="clientes-persona-select"
                placeholder="Seleccione"
                isSearchable
                isClearable={false}
                options={tipoClienteSelectOptions}
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
