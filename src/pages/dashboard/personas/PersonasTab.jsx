import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { personaService } from "../../../services/personasService";

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

const normalizeValue = (v) => String(v ?? "").trim().toLowerCase();

const findFkId = (record, fkKey, textKeys, catalog, idKey, labelKey) => {
  if (record?.[fkKey]) return String(record[fkKey]);

  const recordTexts = textKeys.map((k) => normalizeValue(record?.[k])).filter(Boolean);
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

const PersonasTab = ({ openToast }) => {
  const safeToast = useCallback((title, message, variant = "success") => {
    if (typeof openToast === "function") openToast(title, message, variant);
  }, [openToast]);

  const [telefonos, setTelefonos] = useState([]);
  const [direcciones, setDirecciones] = useState([]);
  const [correos, setCorreos] = useState([]);

  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
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
  // Replica de confirmacion de eliminacion de Categorias
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

  const cargarCatalogos = useCallback(async () => {
    if (catalogosCargadosRef.current) return;

    try {
      const [t, d, c] = await Promise.all([
        personaService.getTelefonos(),
        personaService.getDirecciones(),
        personaService.getCorreos(),
      ]);

      if (!mountedRef.current) return;

      setTelefonos(Array.isArray(t) ? t : []);
      setDirecciones(Array.isArray(d) ? d : []);
      setCorreos(Array.isArray(c) ? c : []);
      catalogosCargadosRef.current = true;
    } catch (e) {
      safeToast("ERROR", e.message, "danger");
    }
  }, [safeToast]);

  const cargarPersonas = useCallback(async () => {
    setLoading(true);
    const requestId = ++requestIdRef.current;

    try {
      const resp = await personaService.getPersonasDetalle(page, limit);
      if (!mountedRef.current || requestId !== requestIdRef.current) return;

      const { items, total: totalResp } = normalizeListResponse(resp);
      setPersonas(items);
      setTotal(totalResp);
    } catch (e) {
      if (!mountedRef.current) return;
      safeToast("ERROR", e.message, "danger");
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

  const capitalizeWords = (value) => value.replace(/\b\w/g, (l) => l.toUpperCase());

  const formatDNI = (value) => {
    const numbers = value.replace(/\D/g, "").slice(0, 13);
    return numbers
      .replace(/^(\d{4})(\d)/, "$1-$2")
      .replace(/^(\d{4}-\d{4})(\d)/, "$1-$2");
  };

  const formatFecha = (fecha) => {
    if (!fecha) return "";
    return new Date(fecha).toLocaleDateString("es-HN");
  };

  const buildFormFromPersona = useCallback(
    (p) => ({
      nombre: p?.nombre || "",
      apellido: p?.apellido || "",
      dni: p?.dni || "",
      rtn: p?.rtn || "",
      genero: p?.genero || "",
      fecha_nacimiento: toDateInputValue(p?.fecha_nacimiento),
      id_telefono: findFkId(
        p,
        "id_telefono",
        ["telefono", "telefono_numero", "numero_telefono"],
        telefonos,
        "id_telefono",
        "telefono"
      ),
      id_direccion: findFkId(
        p,
        "id_direccion",
        ["direccion", "direccion_detalle"],
        direcciones,
        "id_direccion",
        "direccion"
      ),
      id_correo: findFkId(
        p,
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
    const personaActual = personas.find((p) => String(p.id_persona) === String(editId));
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

  const validar = () => {
    const e = {};
    const today = new Date().toISOString().split("T")[0];

    if (!form.nombre) e.nombre = "Requerido";
    if (!form.apellido) e.apellido = "Requerido";
    if (!/^\d{4}-\d{4}-\d{5}$/.test(form.dni)) e.dni = "Formato inv lido";
    if (!/^\d{1}$/.test(form.rtn)) e.rtn = "Debe ingresar solo el numero de complemento";
    if (!form.genero) e.genero = "Seleccione";
    if (!form.fecha_nacimiento || form.fecha_nacimiento > today) e.fecha_nacimiento = "Fecha inv lida";
    if (!form.id_telefono) e.id_telefono = "Seleccione";
    if (!form.id_direccion) e.id_direccion = "Seleccione";
    if (!form.id_correo) e.id_correo = "Seleccione";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (!validar() || actionLoading) return;

    setActionLoading(true);
    try {
      if (editId) {
        const personaOriginal = personas.find((p) => String(p.id_persona) === String(editId));
        if (!personaOriginal) {
          safeToast("ERROR", "No se encontr  el registro a editar", "danger");
          await cargarPersonas();
          return;
        }

        const originalForm = buildFormFromPersona(personaOriginal);

        const changedFields = Object.keys(emptyForm).filter(
          (key) => String(form[key] ?? "") !== String(originalForm[key] ?? "")
        );

        if (changedFields.length === 0) {
          safeToast("INFO", "No hay cambios para guardar", "info");
        } else {
          for (const key of changedFields) {
            try {
              await personaService.actualizarPersonaCampo(editId, key, form[key]);
            } catch (err) {
              const fieldError = new Error(err?.message || "Error al actualizar campo");
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
    } catch (err) {
      const campo = err?.campo ? ` (${err.campo})` : "";
      safeToast("ERROR", `${err.message || "No se pudo guardar"}${campo}`, "danger");
    } finally {
      if (mountedRef.current) setActionLoading(false);
    }
  };

  const iniciarEdicion = (p) => {
    setEditId(p.id_persona);
    setErrors({});
    setForm(buildFormFromPersona(p));
    setShowModal(true);
  };

  const eliminar = (id, nombreCompleto = "") => {
    if (actionLoading || deletingId) return;
    openConfirmDelete(id, nombreCompleto);
  };

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
    } catch (err) {
      safeToast("ERROR", err.message || "No se pudo eliminar", "danger");
      await cargarPersonas();
    } finally {
      if (mountedRef.current) setDeletingId(null);
    }
  };

  const personasFiltradas = useMemo(() => {
    const s = search.toLowerCase();
    if (!s) return personas;

    return personas.filter((p) =>
      `${p?.nombre || ""} ${p?.apellido || ""} ${p?.dni || ""}`.toLowerCase().includes(s)
    );
  }, [personas, search]);

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
  const totalFemenino = personas.filter((p) => String(p?.genero || "").toUpperCase() === "F").length;
  const totalMasculino = personas.filter((p) => String(p?.genero || "").toUpperCase() === "M").length;
  const hasActiveFilters = useMemo(() => search.trim() !== "", [search]);
  const toDisplayValue = (value) => {
    if (value === null || value === undefined) return "No registrado";
    const text = String(value).trim();
    return text ? text : "No registrado";
  };
  const prettifyKey = (key) =>
    String(key || "")
      .replace(/^id_/, "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  const getExtraFields = (persona) => {
    const ignored = new Set([
      "id_persona",
      "nombre",
      "apellido",
      "dni",
      "rtn",
      "genero",
      "fecha_nacimiento",
      "telefono",
      "id_telefono",
      "direccion",
      "id_direccion",
      "correo",
      "direccion_correo",
      "id_correo",
      "estado",
      "activo",
      "habilitado",
      "created_at",
      "updated_at",
      "created_by",
      "updated_by",
    ]);

    return Object.entries(persona || {})
      .filter(([key]) => !ignored.has(key))
      .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
      .slice(0, 6);
  };

  const drawerMode = editId ? "edit" : "create";
  const closeModal = () => setShowModal(false);
  const openConfirmDelete = (id, nombre) =>
    setConfirmModal({ show: true, idToDelete: id, nombre: nombre || "" });
  const closeConfirmDelete = () =>
    setConfirmModal({ show: false, idToDelete: null, nombre: "" });
  const colsClass = cardsPerPage >= 6 ? "cols-3" : cardsPerPage >= 4 ? "cols-2" : "cols-1";

  return (
    <div className="container-fluid px-0 overflow-hidden">
      <div className="card border-0 shadow-sm" style={{ borderRadius: 18 }}>
        <div className="card-body p-3 p-md-4">
          {/* Replica de contadores superiores estilo Categorias */}
          <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap mb-3">
            <div className="d-flex align-items-center gap-2">
              <div
                className="rounded-circle d-inline-flex align-items-center justify-content-center"
                style={{ width: 34, height: 34, background: "rgba(13,110,253,.12)", color: "#0d6efd" }}
              >
                <i className="bi bi-people-fill" />
              </div>
              <div>
                <div className="fw-semibold">Gestión de Personas</div>
                <small className="text-muted">Panel operativo</small>
              </div>
            </div>

            <div className="d-flex align-items-center gap-2 flex-wrap">
              <span className="badge rounded-pill text-bg-dark px-3 py-2">Total: {total}</span>
              <span className="badge rounded-pill text-bg-danger px-3 py-2">Femeninos: {totalFemenino}</span>
              <span className="badge rounded-pill text-bg-primary px-3 py-2">Masculinos: {totalMasculino}</span>
            </div>
          </div>

          <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap mb-3">
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-3 ${filtersOpen ? "btn-secondary" : "btn-outline-secondary"}`}
              onClick={() => setFiltersOpen((v) => !v)}
            >
              <i className="bi bi-sliders me-1" />
              Filtros
            </button>

            <button
              className="btn btn-primary btn-sm rounded-pill px-3"
              disabled={actionLoading || !!deletingId}
              onClick={() => {
                setEditId(null);
                setErrors({});
                setForm(emptyForm);
                setShowModal(true);
              }}
            >
              <i className="bi bi-plus-circle me-1" />
              Nueva Persona
            </button>
          </div>

          {filtersOpen && (
            <div className="row g-2 mb-3">
              <div className="col-12 col-md-9">
                <input
                  className="form-control"
                  placeholder="Buscar por nombre, apellido o DNI..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="col-12 col-md-3">
                <button
                  type="button"
                  className="btn btn-outline-secondary w-100 rounded-pill"
                  onClick={() => setSearch("")}
                  disabled={!hasActiveFilters}
                >
                  Limpiar
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-5 text-muted">Cargando...</div>
          ) : personasFiltradas.length === 0 ? (
            <div className="text-center py-5">
              <div className="text-muted mb-2">No hay personas para mostrar</div>
              <button
                type="button"
                className="btn btn-outline-secondary rounded-pill"
                onClick={() => setSearch("")}
              >
                Limpiar filtros
              </button>
            </div>
          ) : (
            /* Replica de estructura visual de cards de Categorias */
            <div className={`inv-catpro-grid inv-catpro-grid-page ${colsClass}`}>
              {personasFiltradas.map((p, idx) => {
                const globalIdx = (page - 1) * limit + idx;
                const isActive = isPersonaActiva(p);
                const dotClass = isActive ? "ok" : "off";
                const initials = `${String(p?.nombre || "").trim().charAt(0)}${String(p?.apellido || "")
                  .trim()
                  .charAt(0)}`.toUpperCase();
                const capsule = String(p?.genero || "").toUpperCase() || initials || "N/D";
                return (
                  <div
                    key={p?.id_persona ?? globalIdx}
                    className="inv-catpro-item inv-anim-in"
                    style={{ animationDelay: `${Math.min(globalIdx * 40, 240)}ms` }}
                  >
                    <div className="inv-catpro-item-top">
                      <div>
                        <div className="fw-bold">
                          {globalIdx + 1}. {p?.nombre || ""} {p?.apellido || ""}
                        </div>
                        <div className="text-muted small">
                          DNI: {p?.dni || "N/D"} | RTN: {p?.rtn || "N/D"}
                        </div>
                      </div>

                      <span className={`badge ${isActive ? "bg-success" : "bg-secondary"}`}>
                        {isActive ? "Activo" : "Inactivo"}
                      </span>
                    </div>

                    {/* Organizacion de campos en secciones con grid interno */}
                    <div className="pt-2 pb-1">
                      <div className="row g-2">
                        <div className="col-6 col-lg-4">
                          <div className="text-muted small">DNI</div>
                          <div className="small fw-semibold text-break">{toDisplayValue(p?.dni)}</div>
                        </div>
                        <div className="col-6 col-lg-4">
                          <div className="text-muted small">RTN</div>
                          <div className="small fw-semibold text-break">{toDisplayValue(p?.rtn)}</div>
                        </div>
                        <div className="col-6 col-lg-4">
                          <div className="text-muted small">Genero</div>
                          <div className="small fw-semibold text-break">{toDisplayValue(p?.genero)}</div>
                        </div>
                        <div className="col-6 col-lg-4">
                          <div className="text-muted small">Fecha Nacimiento</div>
                          <div className="small fw-semibold text-break">
                            {p?.fecha_nacimiento ? formatFecha(p.fecha_nacimiento) : "No registrado"}
                          </div>
                        </div>
                        <div className="col-6 col-lg-4">
                          <div className="text-muted small">Telefono</div>
                          <div className="small fw-semibold text-break">
                            {toDisplayValue(p?.telefono ?? p?.telefono_numero ?? p?.numero_telefono)}
                          </div>
                        </div>
                        <div className="col-6 col-lg-4">
                          <div className="text-muted small">Correo</div>
                          <div className="small fw-semibold text-break">
                            {toDisplayValue(p?.correo ?? p?.direccion_correo ?? p?.email)}
                          </div>
                        </div>
                        <div className="col-12">
                          <div className="text-muted small">Direccion</div>
                          <div className="small fw-semibold text-break">{toDisplayValue(p?.direccion)}</div>
                        </div>
                        {getExtraFields(p).map(([key, value]) => (
                          <div key={`${p?.id_persona ?? globalIdx}-${key}`} className="col-6 col-lg-4">
                            <div className="text-muted small">{prettifyKey(key)}</div>
                            <div className="small fw-semibold text-break">{toDisplayValue(value)}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="inv-catpro-meta inv-catpro-item-footer">
                      <div className="inv-catpro-code-wrap">
                        <span className={`inv-catpro-state-dot ${dotClass}`} />
                        <span className="inv-catpro-code">{capsule}</span>
                      </div>

                      <div className="inv-catpro-meta-actions inv-catpro-action-bar">
                        <button
                          type="button"
                          className="inv-catpro-action edit inv-catpro-action-compact"
                          onClick={() => iniciarEdicion(p)}
                          title="Editar"
                          disabled={actionLoading || !!deletingId}
                        >
                          <i className="bi bi-pencil-square" />
                          <span className="inv-catpro-action-label">Editar</span>
                        </button>

                        <button
                          type="button"
                          className="inv-catpro-action danger inv-catpro-action-compact"
                          onClick={() => eliminar(p.id_persona, `${p.nombre || ""} ${p.apellido || ""}`.trim())}
                          title="Eliminar"
                          disabled={actionLoading || deletingId === p.id_persona}
                        >
                          <i className={`bi ${deletingId === p.id_persona ? "bi-hourglass-split" : "bi-trash"}`} />
                          <span className="inv-catpro-action-label">
                            {deletingId === p.id_persona ? "Eliminando..." : "Eliminar"}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="d-flex justify-content-end mt-3 gap-2 flex-wrap">
            <span className="badge rounded-pill text-bg-light border text-dark px-3 py-2 align-self-center">
              Pagina {page} de {totalPages}
            </span>
            <button
              className="btn btn-sm btn-outline-secondary rounded-pill px-3"
              disabled={page === 1 || loading || actionLoading || !!deletingId}
              onClick={() => setPage((p) => p - 1)}
            >
              <i className="bi bi-chevron-left me-1" />
              Anterior
            </button>
            <button
              className="btn btn-sm btn-outline-secondary rounded-pill px-3"
              disabled={page >= totalPages || loading || actionLoading || !!deletingId}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
              <i className="bi bi-chevron-right ms-1" />
            </button>
          </div>
        </div>
      </div>

      {/* Replica de drawer de Categorias: backdrop + panel lateral derecho */}
      <div
        className={`inv-prod-drawer-backdrop inv-cat-v2__drawer-backdrop ${showModal ? "show" : ""}`}
        onClick={closeModal}
        aria-hidden={!showModal}
      />

      <aside
        className={`inv-prod-drawer inv-cat-v2__drawer ${showModal ? "show" : ""} ${drawerMode === "create" ? "is-create" : "is-edit"}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!showModal}
        style={{ background: "#f7f1e3", color: "#111827" }}
      >
        <div className="inv-prod-drawer-head">
          <i className="bi bi-people inv-cat-v2__drawer-mark" aria-hidden="true" />
          <div>
            <div className="inv-prod-drawer-title">{drawerMode === "create" ? "Nueva persona" : "Editar persona"}</div>
            <div className="inv-prod-drawer-sub" style={{ color: "#4b5563" }}>Completa los campos y guarda los cambios.</div>
          </div>
          <button
            type="button"
            className="inv-prod-drawer-close"
            onClick={closeModal}
            title="Cerrar"
            style={{ color: "#111827", borderColor: "rgba(17,24,39,.2)" }}
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <form className="inv-prod-drawer-body inv-catpro-drawer-body-lite" onSubmit={guardar} style={{ color: "#111827" }}>
          {/* Replica de formulario visual estilo Categorias */}
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <label className="form-label text-dark">Nombre</label>
              <input
                className={`form-control ${errors.nombre ? "is-invalid" : ""}`}
                style={{ color: "#111827" }}
                placeholder="Ej: Maria"
                value={form.nombre}
                onChange={(e) => setForm((s) => ({ ...s, nombre: capitalizeWords(e.target.value) }))}
              />
              {errors.nombre && <div className="invalid-feedback d-block">{errors.nombre}</div>}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label text-dark">Apellido</label>
              <input
                className={`form-control ${errors.apellido ? "is-invalid" : ""}`}
                style={{ color: "#111827" }}
                placeholder="Ej: Rodriguez"
                value={form.apellido}
                onChange={(e) => setForm((s) => ({ ...s, apellido: capitalizeWords(e.target.value) }))}
              />
              {errors.apellido && <div className="invalid-feedback d-block">{errors.apellido}</div>}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label text-dark">DNI</label>
              <input
                className={`form-control ${errors.dni ? "is-invalid" : ""}`}
                style={{ color: "#111827" }}
                placeholder="0000-0000-00000"
                value={form.dni}
                onChange={(e) => setForm((s) => ({ ...s, dni: formatDNI(e.target.value) }))}
              />
              {errors.dni && <div className="invalid-feedback d-block">{errors.dni}</div>}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label text-dark">RTN</label>
              <input
                className={`form-control ${errors.rtn ? "is-invalid" : ""}`}
                style={{ color: "#111827" }}
                placeholder="9"
                maxLength={1}
                inputMode="numeric"
                pattern="\d*"
                value={form.rtn}
                onChange={(e) =>
                  setForm((s) => ({
                    ...s,
                    rtn: e.target.value.replace(/\D/g, "").slice(0, 1),
                  }))
                }
              />
              {errors.rtn && <div className="invalid-feedback d-block">{errors.rtn}</div>}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label text-dark">Genero</label>
              <select
                className={`form-select ${errors.genero ? "is-invalid" : ""}`}
                style={{ color: "#111827" }}
                value={form.genero}
                onChange={(e) => setForm((s) => ({ ...s, genero: e.target.value }))}
              >
                <option value="">Seleccione</option>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
              </select>
              {errors.genero && <div className="invalid-feedback d-block">{errors.genero}</div>}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label text-dark">Fecha nacimiento</label>
              <input
                type="date"
                className={`form-control ${errors.fecha_nacimiento ? "is-invalid" : ""}`}
                style={{ color: "#111827" }}
                value={form.fecha_nacimiento}
                onChange={(e) => setForm((s) => ({ ...s, fecha_nacimiento: e.target.value }))}
              />
              {errors.fecha_nacimiento && <div className="invalid-feedback d-block">{errors.fecha_nacimiento}</div>}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label text-dark">Telefono</label>
              <select
                className={`form-select ${errors.id_telefono ? "is-invalid" : ""}`}
                style={{ color: "#111827" }}
                value={form.id_telefono}
                onChange={(e) => setForm((s) => ({ ...s, id_telefono: e.target.value }))}
              >
                <option value="">Seleccione</option>
                {telefonos.map((t) => (
                  <option key={t.id_telefono} value={t.id_telefono}>
                    {t.telefono}
                  </option>
                ))}
              </select>
              {errors.id_telefono && <div className="invalid-feedback d-block">{errors.id_telefono}</div>}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label text-dark">Direccion</label>
              <select
                className={`form-select ${errors.id_direccion ? "is-invalid" : ""}`}
                style={{ color: "#111827" }}
                value={form.id_direccion}
                onChange={(e) => setForm((s) => ({ ...s, id_direccion: e.target.value }))}
              >
                <option value="">Seleccione</option>
                {direcciones.map((d) => (
                  <option key={d.id_direccion} value={d.id_direccion}>
                    {d.direccion}
                  </option>
                ))}
              </select>
              {errors.id_direccion && <div className="invalid-feedback d-block">{errors.id_direccion}</div>}
            </div>

            <div className="col-12">
              <label className="form-label text-dark">Correo</label>
              <select
                className={`form-select ${errors.id_correo ? "is-invalid" : ""}`}
                style={{ color: "#111827" }}
                value={form.id_correo}
                onChange={(e) => setForm((s) => ({ ...s, id_correo: e.target.value }))}
              >
                <option value="">Seleccione</option>
                {correos.map((c) => (
                  <option key={c.id_correo} value={c.id_correo}>
                    {c.direccion_correo}
                  </option>
                ))}
              </select>
              {errors.id_correo && <div className="invalid-feedback d-block">{errors.id_correo}</div>}
            </div>

          </div>

          <div className="d-flex gap-2 mt-4">
            <button
              type="submit"
              className="btn btn-danger rounded-pill px-4 flex-fill"
              disabled={actionLoading || !!deletingId}
            >
              {actionLoading ? "Guardando..." : "Guardar"}
            </button>
            <button type="button" className="btn btn-light border rounded-pill px-4" onClick={closeModal}>
              Cancelar
            </button>
          </div>
        </form>
      </aside>

      {/* Replica exacta de modal de confirmacion de Categorias */}
      {confirmModal.show && (
        <div className="inv-pro-confirm-backdrop" role="dialog" aria-modal="true" onClick={closeConfirmDelete}>
          <div className="inv-pro-confirm-panel" onClick={(e) => e.stopPropagation()}>
            <div className="inv-pro-confirm-head">
              <div className="inv-pro-confirm-head-icon">
                <i className="bi bi-exclamation-triangle-fill" />
              </div>
              <div>
                <div className="inv-pro-confirm-title">CONFIRMAR ELIMINACIÓN</div>
                <div className="inv-pro-confirm-sub">Esta acción es permanente</div>
              </div>
              <button type="button" className="inv-pro-confirm-close" onClick={closeConfirmDelete} aria-label="Cerrar">
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <div className="inv-pro-confirm-body">
              <div className="inv-pro-confirm-question">¿Deseas eliminar esta persona?</div>
              <div className="inv-pro-confirm-name">
                <i className="bi bi-tag" />
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
};

export default PersonasTab;


