import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { personaService } from "../../../services/personasService";

const emptyForm = {
  rtn: "",
  nombre_empresa: "",
  id_telefono: "",
  id_direccion: "",
  id_correo: "",
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

const normalizeListResponse = (resp) => {
  if (Array.isArray(resp)) {
    return { data: resp, total: resp.length };
  }

  const data = (resp && (resp.data || resp.items || resp.rows || resp.resultados)) || [];
  const total =
    (resp && (resp.total || resp.totalItems || resp.count || resp.total_count)) ||
    (Array.isArray(data) ? data.length : 0);

  return { data: Array.isArray(data) ? data : [], total: Number(total) || 0 };
};

const resolveCardsPerPage = (width) => {
  if (width >= 1200) return 6;
  if (width >= 620) return 4;
  return 2;
};

const EmpresasTab = ({ openToast }) => {
  const safeToast = useCallback((title, message, variant = "success") => {
    if (typeof openToast === "function") openToast(title, message, variant);
  }, [openToast]);

  const [telefonos, setTelefonos] = useState([]);
  const [direcciones, setDirecciones] = useState([]);
  const [correos, setCorreos] = useState([]);

  const [empresas, setEmpresas] = useState([]);
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
  const [togglingEstadoId, setTogglingEstadoId] = useState(null);
  // Replica de confirmacion de eliminacion de Categorias.
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    idToDelete: null,
    nombre: "",
  });

  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);
  const catalogosCargadosRef = useRef(false);
  const [cardsPerPage, setCardsPerPage] = useState(() =>
    typeof window === "undefined" ? 6 : resolveCardsPerPage(window.innerWidth)
  );

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const detectEstadoField = (empresa) => {
    if (Object.prototype.hasOwnProperty.call(empresa || {}, "estado")) return "estado";
    if (Object.prototype.hasOwnProperty.call(empresa || {}, "activo")) return "activo";
    if (Object.prototype.hasOwnProperty.call(empresa || {}, "habilitado")) return "habilitado";
    return null;
  };

  const isEmpresaActiva = (empresa) => {
    const field = detectEstadoField(empresa);
    if (!field) return true;
    return Boolean(empresa[field]);
  };

  const buildFormFromEmpresa = useCallback(
    (e) => ({
      rtn: e?.rtn || "",
      nombre_empresa: e?.nombre_empresa || "",
      id_telefono: findFkId(
        e,
        "id_telefono",
        ["telefono", "telefono_numero", "numero_telefono"],
        telefonos,
        "id_telefono",
        "telefono"
      ),
      id_direccion: findFkId(
        e,
        "id_direccion",
        ["direccion", "direccion_detalle"],
        direcciones,
        "id_direccion",
        "direccion"
      ),
      id_correo: findFkId(
        e,
        "id_correo",
        ["correo", "direccion_correo", "email"],
        correos,
        "id_correo",
        "direccion_correo"
      ),
    }),
    [telefonos, direcciones, correos]
  );

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

  const cargarEmpresas = useCallback(async () => {
    setLoading(true);
    const requestId = ++requestIdRef.current;

    try {
      const resp = await personaService.getEmpresas({
        page,
        limit,
        nombre: search?.trim() || undefined,
      });
      if (!mountedRef.current || requestId !== requestIdRef.current) return;

      const { data, total: totalResp } = normalizeListResponse(resp);
      setEmpresas(data);
      setTotal(totalResp);
    } catch (e) {
      if (!mountedRef.current) return;
      safeToast("ERROR", e.message, "danger");
      setEmpresas([]);
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
    cargarEmpresas();
  }, [cargarEmpresas]);

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
    const empresaActual = empresas.find((e) => String(e.id_empresa) === String(editId));
    if (!empresaActual) return;

    setForm((prev) => {
      const resolved = buildFormFromEmpresa(empresaActual);
      const next = { ...prev };

      if (!prev.id_telefono && resolved.id_telefono) next.id_telefono = resolved.id_telefono;
      if (!prev.id_direccion && resolved.id_direccion) next.id_direccion = resolved.id_direccion;
      if (!prev.id_correo && resolved.id_correo) next.id_correo = resolved.id_correo;

      return next;
    });
  }, [showModal, editId, empresas, buildFormFromEmpresa]);

  const validar = () => {
    const e = {};

    if (!form.nombre_empresa?.trim()) e.nombre_empresa = "Requerido";
    if (!form.rtn?.trim()) e.rtn = "Requerido";
    if (!form.id_telefono) e.id_telefono = "Seleccione";
    if (!form.id_direccion) e.id_direccion = "Seleccione";
    if (!form.id_correo) e.id_correo = "Seleccione";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const guardar = async (event) => {
    event.preventDefault();
    if (!validar() || actionLoading) return;

    setActionLoading(true);
    try {
      if (editId) {
        const empresaOriginal = empresas.find((e) => String(e.id_empresa) === String(editId));
        if (!empresaOriginal) {
          safeToast("ERROR", "No se encontr  la empresa a editar", "danger");
          await cargarEmpresas();
          return;
        }

        const originalForm = buildFormFromEmpresa(empresaOriginal);
        const changedPayload = Object.fromEntries(
          Object.keys(emptyForm)
            .filter((key) => String(form[key] ?? "") !== String(originalForm[key] ?? ""))
            .map((key) => [key, form[key]])
        );

        if (!Object.keys(changedPayload).length) {
          safeToast("INFO", "No hay cambios para guardar", "info");
        } else {
          await personaService.updateEmpresa(editId, changedPayload);
          safeToast("OK", "Empresa actualizada");
        }
      } else {
        await personaService.createEmpresa(form);
        safeToast("OK", "Empresa creada");
      }

      setShowModal(false);
      setEditId(null);
      setForm(emptyForm);
      await cargarEmpresas();
    } catch (err) {
      safeToast("ERROR", err.message || "No se pudo guardar", "danger");
    } finally {
      if (mountedRef.current) setActionLoading(false);
    }
  };

  const iniciarEdicion = (empresa) => {
    setEditId(empresa.id_empresa);
    setErrors({});
    setForm(buildFormFromEmpresa(empresa));
    setShowModal(true);
  };

  const toggleEstadoEmpresa = async (empresa, nextEstado) => {
    if (actionLoading || deletingId || togglingEstadoId) return;
    const id = empresa.id_empresa;
    const estadoField = detectEstadoField(empresa) || "estado";

    if (!window.confirm(` Deseas ${nextEstado ? "habilitar" : "deshabilitar"} esta empresa?`)) {
      return;
    }

    setTogglingEstadoId(id);
    try {
      await personaService.updateEmpresa(id, { [estadoField]: nextEstado });

      // Mantiene el registro en tabla y actualiza solo el estado visual.
      setEmpresas((prev) =>
        prev.map((item) =>
          String(item.id_empresa) === String(id)
            ? { ...item, [estadoField]: nextEstado }
            : item
        )
      );

      safeToast("OK", `Empresa ${nextEstado ? "habilitada" : "deshabilitada"}`);
    } catch (err) {
      safeToast("ERROR", err.message || "No se pudo actualizar estado", "danger");
    } finally {
      if (mountedRef.current) setTogglingEstadoId(null);
    }
  };

  const eliminar = (id, nombreEmpresa = "") => {
    if (actionLoading || deletingId || togglingEstadoId) return;
    openConfirmDelete(id, nombreEmpresa);
  };

  const eliminarConfirmado = async () => {
    const id = confirmModal.idToDelete;
    if (!id || actionLoading || deletingId || togglingEstadoId) return;

    setDeletingId(id);
    try {
      await personaService.deleteEmpresa(id);

      if (String(editId) === String(id)) {
        setShowModal(false);
        setEditId(null);
        setForm(emptyForm);
      }

      const quedaVaciaPagina = empresas.length === 1 && page > 1;
      if (quedaVaciaPagina) {
        setPage((prev) => Math.max(1, prev - 1));
      } else {
        await cargarEmpresas();
      }

      safeToast("OK", "Empresa eliminada");
      closeConfirmDelete();
    } catch (err) {
      safeToast("ERROR", err.message || "No se pudo eliminar", "danger");
      await cargarEmpresas();
    } finally {
      if (mountedRef.current) setDeletingId(null);
    }
  };

  const empresasFiltradas = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return empresas;

    return empresas.filter((e) =>
      `${e?.nombre_empresa || ""} ${e?.rtn || ""}`.toLowerCase().includes(s)
    );
  }, [empresas, search]);
  const hasActiveFilters = useMemo(() => search.trim() !== "", [search]);

  const empresasActivas = empresas.filter(isEmpresaActiva).length;
  const empresasInactivas = Math.max(0, empresas.length - empresasActivas);

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
                style={{ width: 34, height: 34, background: "rgba(25,135,84,.12)", color: "#198754" }}
              >
                <i className="bi bi-buildings-fill" />
              </div>
              <div>
                <div className="fw-semibold">Gesti n de Empresas</div>
                <small className="text-muted">Panel corporativo</small>
              </div>
            </div>

            <div className="d-flex align-items-center gap-2 flex-wrap">
              <span className="badge rounded-pill text-bg-dark px-3 py-2">Total: {total}</span>
              <span className="badge rounded-pill text-bg-success px-3 py-2">Activas: {empresasActivas}</span>
              <span className="badge rounded-pill text-bg-secondary px-3 py-2">Inactivas: {empresasInactivas}</span>
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
              disabled={actionLoading || !!deletingId || !!togglingEstadoId}
              onClick={() => {
                setEditId(null);
                setErrors({});
                setForm(emptyForm);
                setShowModal(true);
              }}
            >
              <i className="bi bi-plus-circle me-1" />
              Nueva Empresa
            </button>
          </div>

          {filtersOpen && (
            <div className="row g-2 mb-3">
              <div className="col-12 col-md-9">
                <input
                  className="form-control"
                  placeholder="Buscar por nombre o RTN..."
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
          ) : empresasFiltradas.length === 0 ? (
            <div className="text-center py-5">
              <div className="text-muted mb-2">No hay empresas para mostrar</div>
              <button
                type="button"
                className="btn btn-outline-secondary rounded-pill"
                onClick={() => setSearch("")}
              >
                Limpiar filtros
              </button>
            </div>
          ) : (
            /* Replica de grid/tarjetas de Categorias con datos de empresas */
            <div className={`inv-catpro-grid inv-catpro-grid-page ${colsClass}`}>
              {empresasFiltradas.map((e, idx) => {
                const globalIdx = (page - 1) * limit + idx;
                const activa = isEmpresaActiva(e);
                const dotClass = activa ? "ok" : "off";
                const capsule = String(e?.rtn || "").trim().slice(-4) || "N/D";
                const isBusy = togglingEstadoId === e.id_empresa;
                return (
                  <div
                    key={e.id_empresa}
                    className="inv-catpro-item inv-anim-in"
                    style={{ animationDelay: `${Math.min(globalIdx * 40, 240)}ms` }}
                  >
                    <div className="inv-catpro-item-top">
                      <div>
                        <div className="fw-bold">
                          {globalIdx + 1}. {e?.nombre_empresa || ""}
                        </div>
                        <div className="text-muted small">RTN: {e?.rtn || "N/D"}</div>
                      </div>
                      <span className={`badge ${activa ? "bg-success" : "bg-secondary"}`}>
                        {activa ? "Activa" : "Inactiva"}
                      </span>
                    </div>

                    <div className="pt-2 pb-1">
                      <div className="row g-2">
                        <div className="col-12 col-lg-6">
                          <div className="text-muted small">Telefono</div>
                          <div className="small fw-semibold text-break">
                            {e?.telefono || e?.telefono_numero || e?.id_telefono || "No registrado"}
                          </div>
                        </div>
                        <div className="col-12 col-lg-6">
                          <div className="text-muted small">Correo</div>
                          <div className="small fw-semibold text-break">
                            {e?.correo || e?.direccion_correo || e?.id_correo || "No registrado"}
                          </div>
                        </div>
                        <div className="col-12">
                          <div className="text-muted small">Direccion</div>
                          <div className="small fw-semibold text-break">
                            {e?.direccion || e?.id_direccion || "No registrado"}
                          </div>
                        </div>
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
                          onClick={() => iniciarEdicion(e)}
                          title="Editar"
                          disabled={actionLoading || !!deletingId || !!togglingEstadoId}
                        >
                          <i className="bi bi-pencil-square" />
                          <span className="inv-catpro-action-label">Editar</span>
                        </button>

                        <button
                          type="button"
                          className={`inv-catpro-action ${activa ? "state-off" : "state-on"} inv-catpro-action-compact`}
                          onClick={() => toggleEstadoEmpresa(e, !activa)}
                          title={activa ? "Inactivar" : "Activar"}
                          disabled={actionLoading || !!deletingId || isBusy}
                        >
                          <i className={`bi ${activa ? "bi-slash-circle" : "bi-check-circle"}`} />
                          <span className="inv-catpro-action-label">
                            {isBusy ? "Procesando" : activa ? "Inactivar" : "Activar"}
                          </span>
                        </button>

                        <button
                          type="button"
                          className="inv-catpro-action danger inv-catpro-action-compact"
                          onClick={() => eliminar(e.id_empresa, e.nombre_empresa || "")}
                          title="Eliminar"
                          disabled={actionLoading || deletingId === e.id_empresa || !!togglingEstadoId}
                        >
                          <i className={`bi ${deletingId === e.id_empresa ? "bi-hourglass-split" : "bi-trash"}`} />
                          <span className="inv-catpro-action-label">Eliminar</span>
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
              disabled={page === 1 || loading || actionLoading || !!deletingId || !!togglingEstadoId}
              onClick={() => setPage((p) => p - 1)}
            >
              <i className="bi bi-chevron-left me-1" />
              Anterior
            </button>

            <button
              className="btn btn-sm btn-outline-secondary rounded-pill px-3"
              disabled={page >= totalPages || loading || actionLoading || !!deletingId || !!togglingEstadoId}
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
      >
        <div className="inv-prod-drawer-head">
          <i className="bi bi-buildings inv-cat-v2__drawer-mark" aria-hidden="true" />
          <div>
            <div className="inv-prod-drawer-title">{drawerMode === "create" ? "Nueva empresa" : "Editar empresa"}</div>
            <div className="inv-prod-drawer-sub">Completa los campos y guarda los cambios.</div>
          </div>
          <button type="button" className="inv-prod-drawer-close" onClick={closeModal} title="Cerrar">
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <form className="inv-prod-drawer-body inv-catpro-drawer-body-lite" onSubmit={guardar}>
          {/* Replica de formulario visual estilo Categorias */}
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <label className="form-label text-light text-opacity-75">RTN</label>
              <input
                className={`form-control ${errors.rtn ? "is-invalid" : ""}`}
                value={form.rtn}
                onChange={(e) => setForm((s) => ({ ...s, rtn: e.target.value }))}
              />
              {errors.rtn && <div className="invalid-feedback d-block">{errors.rtn}</div>}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label text-light text-opacity-75">Nombre Empresa</label>
              <input
                className={`form-control ${errors.nombre_empresa ? "is-invalid" : ""}`}
                value={form.nombre_empresa}
                onChange={(e) => setForm((s) => ({ ...s, nombre_empresa: e.target.value }))}
              />
              {errors.nombre_empresa && <div className="invalid-feedback d-block">{errors.nombre_empresa}</div>}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label text-light text-opacity-75">Telefono</label>
              <select
                className={`form-select ${errors.id_telefono ? "is-invalid" : ""}`}
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
              <label className="form-label text-light text-opacity-75">Direccion</label>
              <select
                className={`form-select ${errors.id_direccion ? "is-invalid" : ""}`}
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
              <label className="form-label text-light text-opacity-75">Correo</label>
              <select
                className={`form-select ${errors.id_correo ? "is-invalid" : ""}`}
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

            <div className="col-12">
              <div className="form-check mt-1">
                <input className="form-check-input" type="checkbox" checked readOnly id="empresa_estado_visual" />
                <label className="form-check-label text-light text-opacity-75" htmlFor="empresa_estado_visual">
                  Registro habilitado
                </label>
              </div>
            </div>
          </div>

          <div className="d-flex gap-2 mt-4">
            <button
              type="submit"
              className="btn btn-primary rounded-pill px-4 flex-fill"
              disabled={actionLoading || !!deletingId || !!togglingEstadoId}
            >
              {actionLoading ? "Guardando..." : "Guardar"}
            </button>
            <button type="button" className="btn btn-outline-light rounded-pill px-4" onClick={closeModal}>
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
                <div className="inv-pro-confirm-title">CONFIRMAR ELIMINACION</div>
                <div className="inv-pro-confirm-sub">Esta accion es permanente</div>
              </div>
              <button type="button" className="inv-pro-confirm-close" onClick={closeConfirmDelete} aria-label="Cerrar">
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <div className="inv-pro-confirm-body">
              <div className="inv-pro-confirm-question">Deseas eliminar esta empresa?</div>
              <div className="inv-pro-confirm-name">
                <i className="bi bi-building" />
                <span>{confirmModal.nombre || "Empresa seleccionada"}</span>
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

export default EmpresasTab;
