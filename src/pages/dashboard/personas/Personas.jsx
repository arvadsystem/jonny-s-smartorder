import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { personaService } from "../../../services/personasService";
import Filtros from "./components/Filtros";
import HeaderPersonas from "./components/HeaderPersonas";
import KPICards from "./components/KPICards";
import PersonaCard from "./components/PersonaCard";
import "../sucursales/styles/sucursales.css";

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

const createInitialFiltersDraft = () => ({
  estadoFiltro: "todos",
  sortBy: "recientes",
});

const normalizeListResponse = (resp) => {
  if (Array.isArray(resp)) {
    return { items: resp, total: resp.length };
  }

  const items =
    (resp && (resp.items || resp.data || resp.rows || resp.resultados || resp.personas)) || [];
  const total =
    (resp && (resp.total || resp.totalItems || resp.count || resp.total_count)) ||
    (Array.isArray(items) ? items.length : 0);

  return { items: Array.isArray(items) ? items : [], total: Number(total) || 0 };
};

const normalizeValue = (value) => String(value ?? "").trim().toLowerCase();

const findFkId = (record, fkKey, textKeys, catalog, idKey, labelKey) => {
  if (record?.[fkKey]) return String(record[fkKey]);

  const recordTexts = textKeys.map((key) => normalizeValue(record?.[key])).filter(Boolean);
  if (!recordTexts.length) return "";

  const found = (Array.isArray(catalog) ? catalog : []).find((item) =>
    recordTexts.includes(normalizeValue(item?.[labelKey]))
  );

  return found?.[idKey] ? String(found[idKey]) : "";
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

const isGeneroFemenino = (value) => {
  const genero = normalizeGenero(value);
  return genero === "f" || genero === "femenino";
};

const isGeneroMasculino = (value) => {
  const genero = normalizeGenero(value);
  return genero === "m" || genero === "masculino";
};

export default function Personas({ openToast }) {
  const safeToast = useCallback(
    (title, message, variant = "success") => {
      if (typeof openToast === "function") openToast(title, message, variant);
    },
    [openToast]
  );

  const [telefonos, setTelefonos] = useState([]);
  const [direcciones, setDirecciones] = useState([]);
  const [correos, setCorreos] = useState([]);

  const [personas, setPersonas] = useState([]);
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

  const cargarCatalogos = useCallback(async () => {
    if (catalogosCargadosRef.current) return;

    try {
      const [telefonosResp, direccionesResp, correosResp] = await Promise.all([
        personaService.getTelefonos(),
        personaService.getDirecciones(),
        personaService.getCorreos(),
      ]);

      if (!mountedRef.current) return;

      setTelefonos(Array.isArray(telefonosResp) ? telefonosResp : []);
      setDirecciones(Array.isArray(direccionesResp) ? direccionesResp : []);
      setCorreos(Array.isArray(correosResp) ? correosResp : []);
      catalogosCargadosRef.current = true;
    } catch (error) {
      safeToast("ERROR", error.message || "No se pudo cargar catalogos", "danger");
    }
  }, [safeToast]);

  const cargarPersonas = useCallback(async () => {
    setLoading(true);
    const requestId = ++requestIdRef.current;

    try {
      const response = await personaService.getPersonasDetalle(page, limit);
      if (!mountedRef.current || requestId !== requestIdRef.current) return;

      const { items, total: totalResp } = normalizeListResponse(response);
      setPersonas(items);
      setTotal(totalResp);
    } catch (error) {
      if (!mountedRef.current) return;
      safeToast("ERROR", error.message || "No se pudo cargar personas", "danger");
      setPersonas([]);
      setTotal(0);
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [page, limit, safeToast]);

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
    cargarPersonas();
  }, [cargarPersonas]);

  useEffect(() => {
    const onResize = () => setCardsPerPage(resolveCardsPerPage(window.innerWidth));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const buildFormFromPersona = useCallback(
    (persona) => ({
      nombre: persona?.nombre || "",
      apellido: persona?.apellido || "",
      dni: persona?.dni || "",
      rtn: persona?.rtn || "",
      genero: persona?.genero || "",
      fecha_nacimiento: toDateInputValue(persona?.fecha_nacimiento),
      id_telefono: findFkId(
        persona,
        "id_telefono",
        ["telefono", "telefono_numero", "numero_telefono"],
        telefonos,
        "id_telefono",
        "telefono"
      ),
      id_direccion: findFkId(
        persona,
        "id_direccion",
        ["direccion", "direccion_detalle"],
        direcciones,
        "id_direccion",
        "direccion"
      ),
      id_correo: findFkId(
        persona,
        "id_correo",
        ["correo", "direccion_correo", "email"],
        correos,
        "id_correo",
        "direccion_correo"
      ),
    }),
    [telefonos, direcciones, correos]
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

  const capitalizeWords = (value) => value.replace(/\b\w/g, (letter) => letter.toUpperCase());

  const formatDNI = (value) => {
    const numbers = value.replace(/\D/g, "").slice(0, 13);
    return numbers
      .replace(/^(\d{4})(\d)/, "$1-$2")
      .replace(/^(\d{4}-\d{4})(\d)/, "$1-$2");
  };

  const validar = () => {
    const currentErrors = {};
    const today = new Date().toISOString().split("T")[0];

    if (!form.nombre) currentErrors.nombre = "Requerido";
    if (!form.apellido) currentErrors.apellido = "Requerido";
    if (!/^\d{4}-\d{4}-\d{5}$/.test(form.dni)) currentErrors.dni = "Formato invalido";
    if (!/^\d{1}$/.test(form.rtn)) currentErrors.rtn = "Debe ingresar solo el numero de complemento";
    if (!form.genero) currentErrors.genero = "Seleccione";
    if (!form.fecha_nacimiento || form.fecha_nacimiento > today) currentErrors.fecha_nacimiento = "Fecha invalida";
    if (!form.id_telefono) currentErrors.id_telefono = "Seleccione";
    if (!form.id_direccion) currentErrors.id_direccion = "Seleccione";
    if (!form.id_correo) currentErrors.id_correo = "Seleccione";

    setErrors(currentErrors);
    return Object.keys(currentErrors).length === 0;
  };

  const guardar = async (event) => {
    event.preventDefault();
    if (!validar() || actionLoading) return;

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
          for (const key of changedFields) {
            try {
              await personaService.actualizarPersonaCampo(editId, key, form[key]);
            } catch (error) {
              const fieldError = new Error(error?.message || "Error al actualizar campo");
              fieldError.campo = key;
              throw fieldError;
            }
          }
          safeToast("OK", "Persona actualizada");
        }
      } else {
        await personaService.crearPersona(form);
        safeToast("OK", "Persona creada");
      }

      setShowModal(false);
      setEditId(null);
      setForm(emptyForm);
      await cargarPersonas();
    } catch (error) {
      const campo = error?.campo ? ` (${error.campo})` : "";
      safeToast("ERROR", `${error.message || "No se pudo guardar"}${campo}`, "danger");
    } finally {
      if (mountedRef.current) setActionLoading(false);
    }
  };

  const iniciarEdicion = (persona) => {
    setFiltersOpen(false);
    setEditId(persona.id_persona);
    setErrors({});
    setForm(buildFormFromPersona(persona));
    setShowModal(true);
  };

  const openCreate = () => {
    setFiltersOpen(false);
    setEditId(null);
    setErrors({});
    setForm(emptyForm);
    setShowModal(true);
  };

  const openConfirmDelete = (persona) => {
    const nombre = `${persona?.nombre || ""} ${persona?.apellido || ""}`.trim();
    setConfirmModal({ show: true, idToDelete: persona?.id_persona ?? null, nombre: nombre || "Persona seleccionada" });
  };

  const closeConfirmDelete = () =>
    setConfirmModal({ show: false, idToDelete: null, nombre: "" });

  const eliminarConfirmado = async () => {
    const id = confirmModal.idToDelete;
    if (!id || actionLoading || deletingId) return;

    setDeletingId(id);
    try {
      await personaService.eliminarPersona(id);

      if (String(editId) === String(id)) {
        setShowModal(false);
        setEditId(null);
        setForm(emptyForm);
      }

      const quedaVaciaPagina = personas.length === 1 && page > 1;
      if (quedaVaciaPagina) {
        setPage((prev) => Math.max(1, prev - 1));
      } else {
        await cargarPersonas();
      }

      safeToast("OK", "Persona eliminada");
      closeConfirmDelete();
    } catch (error) {
      safeToast("ERROR", error.message || "No se pudo eliminar", "danger");
      await cargarPersonas();
    } finally {
      if (mountedRef.current) setDeletingId(null);
    }
  };

  const personasFiltradas = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const list = [...(Array.isArray(personas) ? personas : [])];

    const filtered = list.filter((persona) => {
      const activa = isPersonaActiva(persona);
      const matchEstado =
        estadoFiltro === "todos" ? true : estadoFiltro === "activo" ? activa : !activa;
      if (!matchEstado) return false;

      if (!needle) return true;

      const hay = [
        persona?.nombre,
        persona?.apellido,
        persona?.dni,
        persona?.rtn,
        persona?.direccion,
        persona?.telefono,
        persona?.telefono_numero,
        persona?.numero_telefono,
        persona?.correo,
        persona?.direccion_correo,
        persona?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(needle);
    });

    filtered.sort((a, b) => {
      if (sortBy === "nombre_asc") {
        return `${a?.nombre || ""} ${a?.apellido || ""}`.localeCompare(
          `${b?.nombre || ""} ${b?.apellido || ""}`,
          "es",
          { sensitivity: "base" }
        );
      }
      if (sortBy === "nombre_desc") {
        return `${b?.nombre || ""} ${b?.apellido || ""}`.localeCompare(
          `${a?.nombre || ""} ${a?.apellido || ""}`,
          "es",
          { sensitivity: "base" }
        );
      }
      return Number(b?.id_persona ?? 0) - Number(a?.id_persona ?? 0);
    });

    return filtered;
  }, [personas, search, estadoFiltro, sortBy]);

  const stats = useMemo(() => {
    const totalFiltradas = personasFiltradas.length;
    const activas = personasFiltradas.filter((item) => isPersonaActiva(item)).length;
    const femenino = personasFiltradas.filter((item) => isGeneroFemenino(item?.genero)).length;
    const masculino = personasFiltradas.filter((item) => isGeneroMasculino(item?.genero)).length;

    return {
      total: totalFiltradas,
      activas,
      inactivas: totalFiltradas - activas,
      femenino,
      masculino,
    };
  }, [personasFiltradas]);

  const hasActiveFilters = useMemo(
    () => search.trim() !== "" || estadoFiltro !== "todos" || sortBy !== "recientes",
    [search, estadoFiltro, sortBy]
  );

  const colsClass = cardsPerPage >= 6 ? "cols-3" : cardsPerPage >= 4 ? "cols-2" : "cols-1";

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
        <HeaderPersonas
          search={search}
          onSearchChange={setSearch}
          filtersOpen={filtersOpen}
          onOpenFilters={openFiltersDrawer}
          drawerOpen={showModal}
          onOpenCreate={openCreate}
        />

        <KPICards stats={stats} />

        <div className="inv-catpro-body inv-prod-body p-3">
          <div className="inv-prod-results-meta inv-cat-v2__results-meta">
            <span>{loading ? "Cargando personas..." : `${personasFiltradas.length} resultados`}</span>
            <span>{loading ? "" : `Total: ${total}`}</span>
            {hasActiveFilters ? <span className="inv-prod-active-filter-pill">Filtros activos</span> : null}
          </div>

          <div className={`inv-catpro-list ${isAnyDrawerOpen ? "drawer-open" : ""}`}>
            {loading ? (
              <div className="inv-catpro-loading" role="status" aria-live="polite">
                <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                <span>Cargando personas...</span>
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
            ) : (
              <div className={`inv-catpro-grid inv-catpro-grid-page ${colsClass}`}>
                {personasFiltradas.map((persona, idx) => (
                  <PersonaCard
                    key={persona?.id_persona ?? idx}
                    persona={persona}
                    index={idx}
                    onOpenEdit={iniciarEdicion}
                    onOpenDelete={openConfirmDelete}
                    actionLoading={actionLoading}
                    deletingId={deletingId}
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
        title="Nueva"
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
        className={`inv-prod-drawer inv-cat-v2__drawer ${showModal ? "show" : ""}`}
        id="per-form-drawer"
        role="dialog"
        aria-modal="true"
        aria-hidden={!showModal}
      >
        <div className="inv-prod-drawer-head">
          <i className="bi bi-people-fill inv-cat-v2__drawer-mark" aria-hidden="true" />
          <div>
            <div className="inv-prod-drawer-title">{editId ? "Editar persona" : "Nueva persona"}</div>
            <div className="inv-prod-drawer-sub">Completa los campos y guarda los cambios.</div>
          </div>
          <button
            type="button"
            className="inv-prod-drawer-close"
            onClick={() => setShowModal(false)}
            title="Cerrar"
            disabled={actionLoading}
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <form className="inv-prod-drawer-body inv-catpro-drawer-body-lite" onSubmit={guardar}>
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <label className="form-label text-light text-opacity-75">Nombre</label>
              <input
                className={`form-control ${errors.nombre ? "is-invalid" : ""}`}
                placeholder="Ej: Maria"
                value={form.nombre}
                onChange={(event) => setForm((state) => ({ ...state, nombre: capitalizeWords(event.target.value) }))}
              />
              {errors.nombre && <div className="invalid-feedback d-block">{errors.nombre}</div>}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label text-light text-opacity-75">Apellido</label>
              <input
                className={`form-control ${errors.apellido ? "is-invalid" : ""}`}
                placeholder="Ej: Rodriguez"
                value={form.apellido}
                onChange={(event) => setForm((state) => ({ ...state, apellido: capitalizeWords(event.target.value) }))}
              />
              {errors.apellido && <div className="invalid-feedback d-block">{errors.apellido}</div>}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label text-light text-opacity-75">DNI</label>
              <input
                className={`form-control ${errors.dni ? "is-invalid" : ""}`}
                placeholder="0000-0000-00000"
                value={form.dni}
                onChange={(event) => setForm((state) => ({ ...state, dni: formatDNI(event.target.value) }))}
              />
              {errors.dni && <div className="invalid-feedback d-block">{errors.dni}</div>}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label text-light text-opacity-75">RTN</label>
              <input
                className={`form-control ${errors.rtn ? "is-invalid" : ""}`}
                placeholder="9"
                maxLength={1}
                inputMode="numeric"
                pattern="\d*"
                value={form.rtn}
                onChange={(event) =>
                  setForm((state) => ({
                    ...state,
                    rtn: event.target.value.replace(/\D/g, "").slice(0, 1),
                  }))
                }
              />
              {errors.rtn && <div className="invalid-feedback d-block">{errors.rtn}</div>}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label text-light text-opacity-75">Genero</label>
              <select
                className={`form-select ${errors.genero ? "is-invalid" : ""}`}
                value={form.genero}
                onChange={(event) => setForm((state) => ({ ...state, genero: event.target.value }))}
              >
                <option value="">Seleccione</option>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
              </select>
              {errors.genero && <div className="invalid-feedback d-block">{errors.genero}</div>}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label text-light text-opacity-75">Fecha nacimiento</label>
              <input
                type="date"
                className={`form-control ${errors.fecha_nacimiento ? "is-invalid" : ""}`}
                value={form.fecha_nacimiento}
                onChange={(event) => setForm((state) => ({ ...state, fecha_nacimiento: event.target.value }))}
              />
              {errors.fecha_nacimiento && <div className="invalid-feedback d-block">{errors.fecha_nacimiento}</div>}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label text-light text-opacity-75">Telefono</label>
              <select
                className={`form-select ${errors.id_telefono ? "is-invalid" : ""}`}
                value={form.id_telefono}
                onChange={(event) => setForm((state) => ({ ...state, id_telefono: event.target.value }))}
              >
                <option value="">Seleccione</option>
                {telefonos.map((telefono) => (
                  <option key={telefono.id_telefono} value={telefono.id_telefono}>
                    {telefono.telefono}
                  </option>
                ))}
              </select>
              {errors.id_telefono && <div className="invalid-feedback d-block">{errors.id_telefono}</div>}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label text-light text-opacity-75">Direccion</label>
              <select
                className={`form-select ${errors.id_direccion ? "is-invalid" : ""}`}
                value={form.id_direccion}
                onChange={(event) => setForm((state) => ({ ...state, id_direccion: event.target.value }))}
              >
                <option value="">Seleccione</option>
                {direcciones.map((direccion) => (
                  <option key={direccion.id_direccion} value={direccion.id_direccion}>
                    {direccion.direccion}
                  </option>
                ))}
              </select>
              {errors.id_direccion && <div className="invalid-feedback d-block">{errors.id_direccion}</div>}
            </div>

            <div className="col-12">
              <label className="form-label text-light text-opacity-75">Correo</label>
              <select
                className={`form-select ${errors.id_correo ? "is-invalid" : ""}`}
                value={form.id_correo}
                onChange={(event) => setForm((state) => ({ ...state, id_correo: event.target.value }))}
              >
                <option value="">Seleccione</option>
                {correos.map((correo) => (
                  <option key={correo.id_correo} value={correo.id_correo}>
                    {correo.direccion_correo}
                  </option>
                ))}
              </select>
              {errors.id_correo && <div className="invalid-feedback d-block">{errors.id_correo}</div>}
            </div>
          </div>

          <div className="d-flex gap-2 mt-4">
            <button type="button" className="btn inv-prod-btn-subtle flex-fill" onClick={() => setShowModal(false)} disabled={actionLoading}>
              Cancelar
            </button>
            <button type="submit" className="btn inv-prod-btn-primary flex-fill" disabled={actionLoading || !!deletingId}>
              {actionLoading ? "Guardando..." : editId ? "Guardar" : "Crear"}
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
                <div className="inv-pro-confirm-title">Confirmar eliminacion</div>
                <div className="inv-pro-confirm-sub">Esta accion es permanente</div>
              </div>
              <button type="button" className="inv-pro-confirm-close" onClick={closeConfirmDelete} aria-label="Cerrar">
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <div className="inv-pro-confirm-body">
              <div className="inv-pro-confirm-question">Deseas eliminar esta persona?</div>
              <div className="inv-pro-confirm-name">
                <i className="bi bi-person-vcard" />
                <span>{confirmModal.nombre || "Persona seleccionada"}</span>
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
