import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { personaService } from "../../../services/personasService";
import sucursalesService from "../../../services/sucursalesService";
import HeaderModulo from "./components/common/HeaderModulo";
import ModuleFiltros from "./components/common/ModuleFiltros";
import ModuleKPICards from "./components/common/ModuleKPICards";
import EmpleadoCard from "./components/empleados/EmpleadoCard";
import "../sucursales/styles/sucursales.css";

const emptyForm = {
  id_persona: "",
  id_sucursal: "",
  fecha_ingreso: "",
  salario_base: "",
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

export default function Empleados({ openToast }) {
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
      estado: isActivo(empleado),
    }),
    [resolvePersonaId, resolveSucursalId]
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

  const cargarEmpleados = useCallback(async () => {
    setLoading(true);
    const requestId = ++requestIdRef.current;

    try {
      const resp = await personaService.getEmpleados({
        page,
        limit,
        nombre: search?.trim() || undefined,
      });
      if (!mountedRef.current || requestId !== requestIdRef.current) return;

      const { items, total: totalResp } = normalizeListResponse(resp);
      setEmpleados(items);
      setTotal(totalResp);
    } catch (error) {
      if (!mountedRef.current) return;
      safeToast("ERROR", error.message || "No se pudo cargar empleados", "danger");
      setEmpleados([]);
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
    cargarEmpleados();
  }, [cargarEmpleados]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    const onResize = () => setCardsPerPage(resolveCardsPerPage(window.innerWidth));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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
  }, [showModal, editId, empleados, buildFormFromEmpleado]);

  const sanitizeForm = () => ({
    id_persona: Number.parseInt(String(form.id_persona), 10),
    id_sucursal: Number.parseInt(String(form.id_sucursal), 10),
    fecha_ingreso: form.fecha_ingreso,
    salario_base: Number.parseFloat(String(form.salario_base).replace(",", ".")),
    estado: Boolean(form.estado),
  });

  const validar = () => {
    const currentErrors = {};
    const today = new Date().toISOString().split("T")[0];
    const payload = sanitizeForm();

    if (!form.id_persona) currentErrors.id_persona = "Seleccione";
    if (!form.id_sucursal) currentErrors.id_sucursal = "Seleccione";
    if (!form.fecha_ingreso || form.fecha_ingreso > today) currentErrors.fecha_ingreso = "Fecha invalida";
    if (form.salario_base === "") currentErrors.salario_base = "Requerido";
    if (Number.isNaN(payload.salario_base) || payload.salario_base < 0) {
      currentErrors.salario_base = "Debe ser un numero valido";
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
        const empleadoOriginal = empleados.find((item) => String(item.id_empleado) === String(editId));
        if (!empleadoOriginal) {
          safeToast("ERROR", "No se encontro el registro a editar", "danger");
          await cargarEmpleados();
          return;
        }

        const originalForm = buildFormFromEmpleado(empleadoOriginal);
        const changedKeys = Object.keys(emptyForm).filter((key) => {
          if (key === "estado") return Boolean(form.estado) !== Boolean(originalForm.estado);
          return String(form[key] ?? "") !== String(originalForm[key] ?? "");
        });

        if (!changedKeys.length) {
          safeToast("INFO", "No hay cambios para guardar", "info");
        } else {
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
          safeToast("OK", "Empleado actualizado");
        }
      } else {
        await personaService.createEmpleado(payloadLimpio);
        safeToast("OK", "Empleado creado");
      }

      setShowModal(false);
      setEditId(null);
      setForm(emptyForm);
      await cargarEmpleados();
    } catch (error) {
      safeToast("ERROR", error.message || "No se pudo guardar", "danger");
    } finally {
      if (mountedRef.current) setActionLoading(false);
    }
  };

  const iniciarEdicion = (empleado) => {
    setFiltersOpen(false);
    setEditId(empleado.id_empleado);
    setErrors({});
    setForm(buildFormFromEmpleado(empleado));
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

  const openConfirmDelete = (empleado) =>
    setConfirmModal({
      show: true,
      idToDelete: empleado?.id_empleado ?? null,
      nombre: getPersonaNombre(empleado) || "",
    });

  const closeConfirmDelete = () =>
    setConfirmModal({ show: false, idToDelete: null, nombre: "" });

  const eliminarConfirmado = async () => {
    const id = confirmModal.idToDelete;
    if (!id || actionLoading || deletingId) return;

    setDeletingId(id);
    try {
      await personaService.deleteEmpleado(id);

      if (String(editId) === String(id)) {
        setShowModal(false);
        setEditId(null);
        setForm(emptyForm);
      }

      const quedaVaciaPagina = empleados.length === 1 && page > 1;
      if (quedaVaciaPagina) {
        setPage((prev) => Math.max(1, prev - 1));
      } else {
        await cargarEmpleados();
      }

      safeToast("OK", "Empleado eliminado");
      closeConfirmDelete();
    } catch (error) {
      safeToast("ERROR", error.message || "No se pudo eliminar", "danger");
      await cargarEmpleados();
    } finally {
      if (mountedRef.current) setDeletingId(null);
    }
  };

  const empleadosFiltrados = useMemo(() => {
    const needle = search.toLowerCase().trim();
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
        empleado?.persona_dni,
        empleado?.dni,
        empleado?.telefono,
        empleado?.telefono_numero,
        empleado?.numero_telefono,
        empleado?.cargo,
        empleado?.nombre_cargo,
        empleado?.puesto,
        empleado?.rol,
        empleado?.salario_base,
        empleado?.fecha_ingreso,
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
      return Number(b?.id_empleado ?? 0) - Number(a?.id_empleado ?? 0);
    });

    return filtered;
  }, [empleados, search, estadoFiltro, sortBy, getPersonaNombre, getSucursalNombre]);

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

  const openFiltersDrawer = () => {
    if (actionLoading) return;
    setShowModal(false);
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
    setShowModal(false);
    setFiltersOpen(false);
  };

  return (
    <div className="suc-page">
      <div className="inv-catpro-card inv-prod-card inv-cat-v2 mb-3">
        <HeaderModulo
          iconClass="bi bi-person-badge-fill"
          title="Empleados"
          subtitle="Gestion visual de empleados"
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar por nombre, sucursal, DNI, cargo o telefono..."
          searchAriaLabel="Buscar empleados"
          filtersOpen={filtersOpen}
          onOpenFilters={openFiltersDrawer}
          createOpen={showModal}
          onOpenCreate={openCreate}
          createLabel="Nuevo"
          filtersControlsId="empd-filtros-drawer"
          formControlsId="empd-form-drawer"
        />

        <ModuleKPICards stats={stats} totalLabel="Total de empleados" />

        <div className="inv-catpro-body inv-prod-body p-3">
          <div className="inv-prod-results-meta inv-cat-v2__results-meta">
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
            ) : (
              <div className={`inv-catpro-grid inv-catpro-grid-page ${colsClass}`}>
                {empleadosFiltrados.map((empleado, idx) => (
                  <EmpleadoCard
                    key={empleado?.id_empleado ?? idx}
                    empleado={empleado}
                    index={(page - 1) * limit + idx}
                    onOpenEdit={iniciarEdicion}
                    onOpenDelete={openConfirmDelete}
                    actionLoading={actionLoading}
                    deletingId={deletingId}
                    getPersonaNombre={getPersonaNombre}
                    getSucursalNombre={getSucursalNombre}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="d-flex justify-content-end mt-3 gap-2 flex-wrap">
            <span className="badge rounded-pill text-bg-light border text-dark px-3 py-2 align-self-center">
              Pagina {page} de {totalPages}
            </span>
            <button
              className="btn btn-sm btn-outline-secondary rounded-pill px-3"
              disabled={page === 1 || loading || actionLoading || !!deletingId}
              onClick={() => setPage((prev) => prev - 1)}
            >
              <i className="bi bi-chevron-left me-1" />
              Anterior
            </button>
            <button
              className="btn btn-sm btn-outline-secondary rounded-pill px-3"
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
        className={`inv-prod-drawer inv-cat-v2__drawer ${showModal ? "show" : ""} ${
          drawerMode === "create" ? "is-create" : "is-edit"
        }`}
        id="empd-form-drawer"
        role="dialog"
        aria-modal="true"
        aria-hidden={!showModal}
      >
        <div className="inv-prod-drawer-head">
          <i className="bi bi-person-badge inv-cat-v2__drawer-mark" aria-hidden="true" />
          <div>
            <div className="inv-prod-drawer-title">{drawerMode === "create" ? "Nuevo empleado" : "Editar empleado"}</div>
            <div className="inv-prod-drawer-sub">Completa los campos y guarda los cambios.</div>
          </div>
          <button
            type="button"
            className="inv-prod-drawer-close"
            onClick={() => setShowModal(false)}
            title="Cerrar"
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <form className="inv-prod-drawer-body inv-catpro-drawer-body-lite" onSubmit={guardar}>
          <div className="row g-3">
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
              <label className="form-label text-light text-opacity-75">Sucursal</label>
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
              {errors.id_sucursal && <div className="invalid-feedback d-block">{errors.id_sucursal}</div>}
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

            <div className="col-12">
              <div className="form-check">
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

          <div className="d-flex gap-2 mt-4">
            <button
              type="button"
              className="btn inv-prod-btn-subtle flex-fill"
              onClick={() => setShowModal(false)}
              disabled={actionLoading || !!deletingId}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn inv-prod-btn-primary flex-fill"
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
