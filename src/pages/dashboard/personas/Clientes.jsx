import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { personaService } from "../../../services/personasService";
import { parametrosService } from "../../../services/parametrosService";
import EntityTable from "../../../components/ui/EntityTable";
import HeaderModulo from "./components/common/HeaderModulo";
import ModuleFiltros from "./components/common/ModuleFiltros";
import ModuleKPICards from "./components/common/ModuleKPICards";
import ClienteCard from "./components/clientes/ClienteCard";
import "./components/common/crud-modal-theme.css";

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

const getDni = (cliente) => cliente?.persona_dni ?? cliente?.dni;

const getTelefono = (cliente) =>
  cliente?.telefono ??
  cliente?.telefono_numero ??
  cliente?.numero_telefono ??
  cliente?.persona_telefono ??
  cliente?.telefono_persona;

const getCorreo = (cliente) =>
  cliente?.correo ??
  cliente?.direccion_correo ??
  cliente?.email ??
  cliente?.persona_correo ??
  cliente?.correo_persona;

const getFechaRegistro = (cliente) => cliente?.fecha_registro ?? cliente?.fecha_ingreso ?? cliente?.created_at;

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

  const getPersonaNombre = useCallback((cliente) => {
    const fromBackend = cliente?.persona_nombre_completo?.trim();
    if (fromBackend) return fromBackend;

    const fallback = `${cliente?.persona_nombre || ""} ${cliente?.persona_apellido || ""}`.trim();
    if (fallback) return fallback;

    const personaId = cliente?.id_persona ? String(cliente.id_persona) : "";
    if (!personaId) return "No registrado";

    const option = personaOptions.find((item) => item.id === personaId);
    return option?.label || `Persona #${personaId}`;
  }, [personaOptions]);

  const getEmpresaNombre = useCallback((cliente) => {
    const fromBackend = cliente?.nombre_empresa || cliente?.empresa_nombre || cliente?.empresa;
    if (String(fromBackend ?? "").trim()) return String(fromBackend).trim();

    const empresaId = cliente?.id_empresa ? String(cliente.id_empresa) : "";
    if (!empresaId) return "No registrado";

    const option = empresaOptions.find((item) => item.id === empresaId);
    return option?.label || `Empresa #${empresaId}`;
  }, [empresaOptions]);

  const getTipoClienteNombre = useCallback((cliente) => {
    const fromBackend = cliente?.tipo_cliente_nombre || cliente?.tipo_cliente || cliente?.nombre_tipo_cliente;
    if (String(fromBackend ?? "").trim()) return String(fromBackend).trim();

    const tipoId = cliente?.id_tipo_cliente ? String(cliente.id_tipo_cliente) : "";
    if (!tipoId) return "No registrado";

    const option = tipoClienteOptions.find((item) => item.id === tipoId);
    return option?.label || `Tipo #${tipoId}`;
  }, [tipoClienteOptions]);

  const resolveIdFromLabel = (rawValue, options) => {
    const normalized = normalizeValue(rawValue);
    if (!normalized) return "";
    const found = options.find((item) => normalizeValue(item.label) === normalized);
    return found?.id || "";
  };

  const buildFormFromCliente = useCallback(
    (cliente) => ({
      id_persona:
        cliente?.id_persona
          ? String(cliente.id_persona)
          : resolveIdFromLabel(
              cliente?.persona_nombre_completo ||
                `${cliente?.persona_nombre || ""} ${cliente?.persona_apellido || ""}`.trim(),
              personaOptions
            ),
      id_empresa:
        cliente?.id_empresa
          ? String(cliente.id_empresa)
          : resolveIdFromLabel(cliente?.nombre_empresa || cliente?.empresa_nombre || cliente?.empresa, empresaOptions),
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
    }),
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
      setClientes(items);
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

  const sanitizeForm = () => ({
    id_persona: parseIntegerValue(form.id_persona),
    id_empresa: parseIntegerValue(form.id_empresa),
    id_tipo_cliente: parseIntegerValue(form.id_tipo_cliente),
    fecha_ingreso: form.fecha_ingreso,
    puntos: parseIntegerValue(form.puntos),
    estado: Boolean(form.estado),
  });

  const validar = () => {
    const currentErrors = {};
    const today = new Date().toISOString().split("T")[0];
    const payload = sanitizeForm();

    if (!form.id_persona) currentErrors.id_persona = "Seleccione";
    if (!form.id_empresa) currentErrors.id_empresa = "Seleccione";
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
    setForm(buildFormFromCliente(cliente));
    setShowModal(true);
  };

  const openCreate = () => {
    if (actionLoading || deletingId) return;
    setFiltersOpen(false);
    setEditId(null);
    setErrors({});
    setForm(emptyForm);
    setShowModal(true);
  };

  const openConfirmDelete = (cliente) =>
    setConfirmModal({
      show: true,
      idToDelete: cliente?.id_cliente ?? null,
      nombre: getPersonaNombre(cliente) || "",
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
        getPersonaNombre(cliente),
        getEmpresaNombre(cliente),
        getTipoClienteNombre(cliente),
        cliente?.persona_dni,
        cliente?.dni,
        cliente?.telefono,
        cliente?.telefono_numero,
        cliente?.numero_telefono,
        cliente?.correo,
        cliente?.direccion_correo,
        cliente?.email,
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
        return getPersonaNombre(a).localeCompare(getPersonaNombre(b), "es", { sensitivity: "base" });
      }
      if (sortBy === "nombre_desc") {
        return getPersonaNombre(b).localeCompare(getPersonaNombre(a), "es", { sensitivity: "base" });
      }
      return Number(b?.id_cliente ?? 0) - Number(a?.id_cliente ?? 0);
    });

    return filtered;
  }, [clientes, search, estadoFiltro, sortBy, getPersonaNombre, getEmpresaNombre, getTipoClienteNombre]);

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
                      <th scope="col">DNI</th>
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
                            <strong>{tableIndex + 1}. {toDisplayValue(getPersonaNombre(cliente), "Cliente sin nombre")}</strong>
                          </td>
                          <td>{toDisplayValue(getEmpresaNombre(cliente))}</td>
                          <td>{toDisplayValue(getDni(cliente), "N/D")}</td>
                          <td>{toDisplayValue(getTelefono(cliente), "Sin telefono")}</td>
                          <td>{toDisplayValue(getCorreo(cliente), "Sin correo")}</td>
                          <td>{formatDateLabel(getFechaRegistro(cliente))}</td>
                          <td>
                            <span className={`inv-ins-card__badge ${isActive ? "is-ok" : "is-inactive"}`}>
                              {isActive ? "ACTIVO" : "INACTIVO"}
                            </span>
                          </td>
                          <td>
                            <div className="inv-catpro-code-wrap personas-page__table-code-wrap">
                              <span className={`inv-catpro-state-dot ${isActive ? "ok" : "off"}`} />
                              <span className="inv-catpro-code">CLI-{String(idCliente ?? "-")}</span>
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
                    getPersonaNombre={getPersonaNombre}
                    getEmpresaNombre={getEmpresaNombre}
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
          <div className="row g-3 crud-modal__grid">
            <div className="col-12">
              <label className="form-label text-light text-opacity-75">Persona</label>
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
              {errors.id_persona && <div className="invalid-feedback d-block">{errors.id_persona}</div>}
            </div>

            <div className="col-12">
              <label className="form-label text-light text-opacity-75">Empresa</label>
              <select
                className={`form-select ${errors.id_empresa ? "is-invalid" : ""}`}
                value={form.id_empresa}
                onChange={(event) => setForm((state) => ({ ...state, id_empresa: event.target.value }))}
              >
                <option value="">Seleccione</option>
                {empresaOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              {errors.id_empresa && <div className="invalid-feedback d-block">{errors.id_empresa}</div>}
            </div>

            <div className="col-12">
              <label className="form-label text-light text-opacity-75">Tipo cliente</label>
              <select
                className={`form-select ${errors.id_tipo_cliente ? "is-invalid" : ""}`}
                value={form.id_tipo_cliente}
                onChange={(event) => setForm((state) => ({ ...state, id_tipo_cliente: event.target.value }))}
              >
                <option value="">Seleccione</option>
                {tipoClienteOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
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
