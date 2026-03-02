import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { personaService } from "../../../services/personasService";
import HeaderModulo from "./components/common/HeaderModulo";
import ModuleFiltros from "./components/common/ModuleFiltros";
import ModuleKPICards from "./components/common/ModuleKPICards";
import EmpresaCard from "./components/empresas/EmpresaCard";
import "../sucursales/styles/sucursales.css";

const emptyForm = {
  rtn: "",
  nombre_empresa: "",
  id_telefono: "",
  id_direccion: "",
  id_correo: "",
};

const createInitialFiltersDraft = () => ({
  estadoFiltro: "todos",
  sortBy: "recientes",
});

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

export default function Empresas({ openToast }) {
  const safeToast = useCallback(
    (title, message, variant = "success") => {
      if (typeof openToast === "function") openToast(title, message, variant);
    },
    [openToast]
  );

  const [telefonos, setTelefonos] = useState([]);
  const [direcciones, setDirecciones] = useState([]);
  const [correos, setCorreos] = useState([]);

  const [empresas, setEmpresas] = useState([]);
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
  const [togglingEstadoId, setTogglingEstadoId] = useState(null);
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
  const isAnyDrawerOpen = showModal || filtersOpen;

  const buildFormFromEmpresa = useCallback(
    (empresa) => ({
      rtn: empresa?.rtn || "",
      nombre_empresa: empresa?.nombre_empresa || "",
      id_telefono: findFkId(
        empresa,
        "id_telefono",
        ["telefono", "telefono_numero", "numero_telefono"],
        telefonos,
        "id_telefono",
        "telefono"
      ),
      id_direccion: findFkId(
        empresa,
        "id_direccion",
        ["direccion", "direccion_detalle"],
        direcciones,
        "id_direccion",
        "direccion"
      ),
      id_correo: findFkId(
        empresa,
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
      safeToast("ERROR", error.message || "No se pudieron cargar catalogos", "danger");
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
    } catch (error) {
      if (!mountedRef.current) return;
      safeToast("ERROR", error.message || "No se pudo cargar empresas", "danger");
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
    const empresaActual = empresas.find((item) => String(item.id_empresa) === String(editId));
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
    const currentErrors = {};

    if (!form.nombre_empresa?.trim()) currentErrors.nombre_empresa = "Requerido";
    if (!form.rtn?.trim()) currentErrors.rtn = "Requerido";
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
        const empresaOriginal = empresas.find((item) => String(item.id_empresa) === String(editId));
        if (!empresaOriginal) {
          safeToast("ERROR", "No se encontro la empresa a editar", "danger");
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
    } catch (error) {
      safeToast("ERROR", error.message || "No se pudo guardar", "danger");
    } finally {
      if (mountedRef.current) setActionLoading(false);
    }
  };

  const iniciarEdicion = (empresa) => {
    setFiltersOpen(false);
    setEditId(empresa.id_empresa);
    setErrors({});
    setForm(buildFormFromEmpresa(empresa));
    setShowModal(true);
  };

  const openCreate = () => {
    if (actionLoading || deletingId || togglingEstadoId) return;
    setFiltersOpen(false);
    setEditId(null);
    setErrors({});
    setForm(emptyForm);
    setShowModal(true);
  };

  const toggleEstadoEmpresa = async (empresa, nextEstado) => {
    if (actionLoading || deletingId || togglingEstadoId) return;
    const id = empresa.id_empresa;
    const estadoField = detectEstadoField(empresa) || "estado";

    if (!window.confirm(`Deseas ${nextEstado ? "habilitar" : "deshabilitar"} esta empresa?`)) {
      return;
    }

    setTogglingEstadoId(id);
    try {
      await personaService.updateEmpresa(id, { [estadoField]: nextEstado });

      setEmpresas((prev) =>
        prev.map((item) =>
          String(item.id_empresa) === String(id)
            ? { ...item, [estadoField]: nextEstado }
            : item
        )
      );

      safeToast("OK", `Empresa ${nextEstado ? "habilitada" : "deshabilitada"}`);
    } catch (error) {
      safeToast("ERROR", error.message || "No se pudo actualizar estado", "danger");
    } finally {
      if (mountedRef.current) setTogglingEstadoId(null);
    }
  };

  const openConfirmDelete = (empresa) => {
    setConfirmModal({
      show: true,
      idToDelete: empresa?.id_empresa ?? null,
      nombre: empresa?.nombre_empresa || "",
    });
  };

  const closeConfirmDelete = () =>
    setConfirmModal({ show: false, idToDelete: null, nombre: "" });

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
    } catch (error) {
      safeToast("ERROR", error.message || "No se pudo eliminar", "danger");
      await cargarEmpresas();
    } finally {
      if (mountedRef.current) setDeletingId(null);
    }
  };

  const empresasFiltradas = useMemo(() => {
    const needle = search.toLowerCase().trim();
    const list = [...(Array.isArray(empresas) ? empresas : [])];

    const filtered = list.filter((empresa) => {
      const activa = isEmpresaActiva(empresa);
      const matchEstado =
        estadoFiltro === "todos" ? true : estadoFiltro === "activo" ? activa : !activa;
      if (!matchEstado) return false;

      if (!needle) return true;

      const hay = [
        empresa?.nombre_empresa,
        empresa?.rtn,
        empresa?.telefono,
        empresa?.telefono_numero,
        empresa?.numero_telefono,
        empresa?.correo,
        empresa?.direccion_correo,
        empresa?.email,
        empresa?.direccion,
        empresa?.direccion_detalle,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(needle);
    });

    filtered.sort((a, b) => {
      if (sortBy === "nombre_asc") {
        return String(a?.nombre_empresa || "").localeCompare(String(b?.nombre_empresa || ""), "es", {
          sensitivity: "base",
        });
      }
      if (sortBy === "nombre_desc") {
        return String(b?.nombre_empresa || "").localeCompare(String(a?.nombre_empresa || ""), "es", {
          sensitivity: "base",
        });
      }
      return Number(b?.id_empresa ?? 0) - Number(a?.id_empresa ?? 0);
    });

    return filtered;
  }, [empresas, search, estadoFiltro, sortBy]);

  const stats = useMemo(() => {
    const totalFiltradas = empresasFiltradas.length;
    const activas = empresasFiltradas.filter((item) => isEmpresaActiva(item)).length;
    return { total: totalFiltradas, activas, inactivas: totalFiltradas - activas };
  }, [empresasFiltradas]);

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
          iconClass="bi bi-buildings-fill"
          title="Empresas"
          subtitle="Gestion visual de empresas"
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar por nombre, RTN, telefono, correo o direccion..."
          searchAriaLabel="Buscar empresas"
          filtersOpen={filtersOpen}
          onOpenFilters={openFiltersDrawer}
          createOpen={showModal}
          onOpenCreate={openCreate}
          createLabel="Nuevo"
          filtersControlsId="emp-filtros-drawer"
          formControlsId="emp-form-drawer"
        />

        <ModuleKPICards stats={stats} totalLabel="Total de empresas" />

        <div className="inv-catpro-body inv-prod-body p-3">
          <div className="inv-prod-results-meta inv-cat-v2__results-meta">
            <span>{loading ? "Cargando empresas..." : `${empresasFiltradas.length} resultados`}</span>
            <span>{loading ? "" : `Total: ${total}`}</span>
            {hasActiveFilters ? <span className="inv-prod-active-filter-pill">Filtros activos</span> : null}
          </div>

          <div className={`inv-catpro-list ${isAnyDrawerOpen ? "drawer-open" : ""}`}>
            {loading ? (
              <div className="inv-catpro-loading" role="status" aria-live="polite">
                <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                <span>Cargando empresas...</span>
              </div>
            ) : empresasFiltradas.length === 0 ? (
              <div className="inv-catpro-empty">
                <div className="inv-catpro-empty-icon">
                  <i className="bi bi-buildings" />
                </div>
                <div className="inv-catpro-empty-title">No hay empresas para mostrar</div>
                <div className="inv-catpro-empty-sub">
                  {hasActiveFilters ? "Prueba limpiar filtros o crea una nueva empresa." : "Crea tu primera empresa."}
                </div>

                <div className="d-flex gap-2 justify-content-center flex-wrap">
                  {hasActiveFilters ? (
                    <button type="button" className="btn btn-outline-secondary" onClick={clearAllFilters}>
                      Limpiar filtros
                    </button>
                  ) : null}
                  <button type="button" className="btn btn-primary" onClick={openCreate}>
                    Nueva empresa
                  </button>
                </div>
              </div>
            ) : (
              <div className={`inv-catpro-grid inv-catpro-grid-page ${colsClass}`}>
                {empresasFiltradas.map((empresa, idx) => (
                  <EmpresaCard
                    key={empresa?.id_empresa ?? idx}
                    empresa={empresa}
                    index={(page - 1) * limit + idx}
                    onOpenEdit={iniciarEdicion}
                    onOpenDelete={openConfirmDelete}
                    onToggleEstado={toggleEstadoEmpresa}
                    actionLoading={actionLoading}
                    deletingId={deletingId}
                    togglingEstadoId={togglingEstadoId}
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
              disabled={page === 1 || loading || actionLoading || !!deletingId || !!togglingEstadoId}
              onClick={() => setPage((prev) => prev - 1)}
            >
              <i className="bi bi-chevron-left me-1" />
              Anterior
            </button>

            <button
              className="btn btn-sm btn-outline-secondary rounded-pill px-3"
              disabled={page >= totalPages || loading || actionLoading || !!deletingId || !!togglingEstadoId}
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
        disabled={actionLoading || !!deletingId || !!togglingEstadoId}
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
        drawerId="emp-filtros-drawer"
        iconClass="bi bi-buildings-fill"
        title="Filtros de empresas"
        subtitle="Estado y orden visual del listado"
        draft={filtersDraft}
        onChangeDraft={setFiltersDraft}
        onClose={closeFiltersDrawer}
        onApply={applyFiltersDrawer}
        onClear={clearVisualFilters}
        allLabel="Todas"
        activeLabel="Activas"
        inactiveLabel="Inactivas"
      />

      <aside
        className={`inv-prod-drawer inv-cat-v2__drawer ${showModal ? "show" : ""} ${
          drawerMode === "create" ? "is-create" : "is-edit"
        }`}
        id="emp-form-drawer"
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
          <button type="button" className="inv-prod-drawer-close" onClick={() => setShowModal(false)} title="Cerrar">
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <form className="inv-prod-drawer-body inv-catpro-drawer-body-lite" onSubmit={guardar}>
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <label className="form-label text-light text-opacity-75">RTN</label>
              <input
                className={`form-control ${errors.rtn ? "is-invalid" : ""}`}
                value={form.rtn}
                onChange={(event) => setForm((state) => ({ ...state, rtn: event.target.value }))}
              />
              {errors.rtn && <div className="invalid-feedback d-block">{errors.rtn}</div>}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label text-light text-opacity-75">Nombre empresa</label>
              <input
                className={`form-control ${errors.nombre_empresa ? "is-invalid" : ""}`}
                value={form.nombre_empresa}
                onChange={(event) => setForm((state) => ({ ...state, nombre_empresa: event.target.value }))}
              />
              {errors.nombre_empresa && <div className="invalid-feedback d-block">{errors.nombre_empresa}</div>}
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
              type="button"
              className="btn inv-prod-btn-subtle flex-fill"
              onClick={() => setShowModal(false)}
              disabled={actionLoading || !!deletingId || !!togglingEstadoId}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn inv-prod-btn-primary flex-fill"
              disabled={actionLoading || !!deletingId || !!togglingEstadoId}
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
}
