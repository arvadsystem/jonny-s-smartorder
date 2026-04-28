import { useEffect, useMemo, useState } from "react";
import InlineLoader from "../../../components/common/InlineLoader";
import SinPermiso from "../../../components/common/SinPermiso";
import { securityService } from "../../../services/securityService";
import { fmtHN } from "../../../utils/dateTime";
import { usePermisos } from "../../../context/PermisosContext";
import { PERMISSIONS } from "../../../utils/permissions";
import SecurityFiltersDrawer from "./components/SecurityFiltersDrawer";
import SecurityPaginationBar from "./components/SecurityPaginationBar";
import "./sesiones-ui.css";
import "./seguridad-auditoria-ui.css";

const PAGE_SIZE = 10;

const SORT_LABELS = {
  recientes: "Más recientes",
  nombre_asc: "Nombre (A-Z)",
  nombre_desc: "Nombre (Z-A)",
  usuario_asc: "Usuario (A-Z)",
  usuario_desc: "Usuario (Z-A)",
};

const fmtDate = (value) => (value ? fmtHN(value) : "-");

const estadoBadge = (estado) => {
  if (estado === true) return <span className="sec-badge sec-badge-active">ACTIVO</span>;
  if (estado === false) return <span className="sec-badge sec-badge-fail">BLOQUEADO</span>;
  return <span className="sec-badge sec-badge-closed">-</span>;
};

const normalize = (value) => String(value || "").trim().toLowerCase();

const sortUsersRows = (rows, sortBy) => {
  const source = Array.isArray(rows) ? [...rows] : [];

  if (sortBy === "nombre_asc" || sortBy === "nombre_desc") {
    source.sort((a, b) => {
      const aName = normalize(`${a?.nombre || ""} ${a?.apellido || ""}`);
      const bName = normalize(`${b?.nombre || ""} ${b?.apellido || ""}`);
      return sortBy === "nombre_asc" ? aName.localeCompare(bName, "es") : bName.localeCompare(aName, "es");
    });
    return source;
  }

  if (sortBy === "usuario_asc" || sortBy === "usuario_desc") {
    source.sort((a, b) => {
      const aUser = normalize(a?.nombre_usuario);
      const bUser = normalize(b?.nombre_usuario);
      return sortBy === "usuario_asc" ? aUser.localeCompare(bUser, "es") : bUser.localeCompare(aUser, "es");
    });
    return source;
  }

  source.sort((a, b) => Number(b?.id_usuario || 0) - Number(a?.id_usuario || 0));
  return source;
};

const UsuariosTab = ({ onOpenAudit }) => {
  const { canAny } = usePermisos();
  const canViewAudit = canAny([PERMISSIONS.SEGURIDAD_USUARIOS_VER]);

  const [loading, setLoading] = useState(true);
  const [noPermiso, setNoPermiso] = useState(false);
  const [error, setError] = useState("");

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [filters, setFilters] = useState({
    estado: "",
    limit: PAGE_SIZE,
    offset: 0,
    sortBy: "recientes",
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filtersDraft, setFiltersDraft] = useState({
    estado: "",
    sortBy: "recientes",
  });

  const load = async ({ silent = false, nextFilters, nextSearch } = {}) => {
    const activeFilters = nextFilters || filters;
    const activeSearch = typeof nextSearch === "string" ? nextSearch : search;

    if (!silent) {
      setLoading(true);
      setError("");
      setNoPermiso(false);
    }

    try {
      const qs = new URLSearchParams();
      if (activeSearch) qs.set("buscar", activeSearch);
      if (activeFilters.estado) qs.set("estado", activeFilters.estado);
      qs.set("limit", String(activeFilters.limit));
      qs.set("offset", String(activeFilters.offset));
      qs.set("_ts", String(Date.now()));

      const data = await securityService.getUsuariosGlobal(qs.toString());
      setRows(data?.rows || []);
      setTotal(data?.total || 0);
    } catch (e) {
      if (e?.status === 403) {
        setNoPermiso(true);
        return;
      }
      setError(e?.message || "Error cargando usuarios");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.offset, filters.limit, filters.estado, search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const nextSearch = searchInput.trim();
      setSearch(nextSearch);
      setFilters((prev) => ({ ...prev, offset: 0 }));
    }, 250);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const onOpenFilters = () => {
    setFiltersDraft({ estado: filters.estado, sortBy: filters.sortBy });
    setDrawerOpen(true);
  };

  const onApplyFilters = () => {
    setFilters((prev) => ({
      ...prev,
      estado: filtersDraft.estado,
      sortBy: filtersDraft.sortBy,
      offset: 0,
    }));
    setDrawerOpen(false);
  };

  const onClearFilters = () => {
    const clearedDraft = { estado: "", sortBy: "recientes" };
    setFiltersDraft(clearedDraft);
    setFilters((prev) => ({ ...prev, ...clearedDraft, offset: 0 }));
    setDrawerOpen(false);
  };

  const displayRows = useMemo(() => sortUsersRows(rows, filters.sortBy), [rows, filters.sortBy]);

  const currentPage = Math.floor(filters.offset / filters.limit) + 1;

  const hasActiveFilters = useMemo(() => {
    return Boolean(filters.estado || filters.sortBy !== "recientes" || search);
  }, [filters.estado, filters.sortBy, search]);

  const resultsLabel = `${total} resultados`;

  const chips = [
    {
      icon: "bi-sliders2",
      label:
        filtersDraft.estado === "activo"
          ? "Solo activos"
          : filtersDraft.estado === "bloqueado"
            ? "Solo bloqueados"
            : "Todos los estados",
    },
    {
      icon: "bi-arrow-down-up",
      label: SORT_LABELS[filtersDraft.sortBy] || "Más recientes",
    },
  ];

  if (noPermiso) {
    return (
      <SinPermiso
        permiso="SEGURIDAD_USUARIOS_VER"
        detalle="No tienes permiso para ver el listado global de usuarios."
      />
    );
  }

  return (
    <>
      <div className="card shadow-sm sec-sesiones-shell" style={{ backgroundColor: "#fff" }}>
        <div className="card-body p-0">
          <div className="sec-panel-header sec-sesiones-header">
            <div className="sec-panel-title-wrap">
              <div className="sec-panel-title-row">
                <i className="bi bi-people sec-panel-title-icon" />
                <span className="sec-panel-title">Usuarios</span>
              </div>
              <div className="sec-panel-subtitle">Listado global para auditoría y control</div>
            </div>

            <div className="sec-panel-header-actions sec-audit-header-actions">
              <label className="sec-toolbar-search sec-sesiones-search inv-ins-search" aria-label="Buscar usuarios">
                <i className="bi bi-search" />
                <input
                  type="search"
                  placeholder="Buscar por usuario, nombre o rol..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </label>

              <button type="button" className="btn inv-prod-toolbar-btn" onClick={onOpenFilters}>
                <i className="bi bi-funnel me-1" />
                Filtros
              </button>

              <span className="sec-audit-chip">
                <i className="bi bi-person-lines-fill" />
                TOTAL: {total}
              </span>
            </div>
          </div>

          <div className="sec-panel-body p-3 sec-sesiones-body">
            {loading && <InlineLoader />}
            {error && <div className="alert alert-danger">{error}</div>}

            {!loading && !error && (
              <>
                <div className="sec-results-meta sec-sesiones-results-meta inv-inventory-results-meta">
                  <span>{resultsLabel}</span>
                  {hasActiveFilters ? (
                    <button
                      type="button"
                      className="sec-filter-pill sec-filter-pill--clear"
                      onClick={onClearFilters}
                      aria-label="Limpiar filtros activos"
                    >
                      Filtros activos
                      <i className="bi bi-x-lg" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>

                <div className="sec-sesiones-table-card">
                  <div className="table-responsive sec-sesiones-table-responsive">
                    <table className="table table-hover align-middle mb-0 sec-sesiones-table">
                      <thead>
                        <tr>
                          <th style={{ width: 90 }}>ID</th>
                          <th>Usuario</th>
                          <th>Nombre</th>
                          <th>Rol</th>
                          <th style={{ width: 120 }}>Estado</th>
                          <th>Último acceso</th>
                          <th style={{ width: 140 }}>Sesiones activas</th>
                          {canViewAudit ? <th className="text-end">Auditoría</th> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {displayRows.length === 0 && (
                          <tr>
                            <td colSpan={canViewAudit ? "8" : "7"} className="text-center text-muted py-4">
                              No hay registros para los filtros seleccionados.
                            </td>
                          </tr>
                        )}

                        {displayRows.map((r) => {
                          const nombre = `${r?.nombre || ""} ${r?.apellido || ""}`.trim() || "-";
                          return (
                            <tr key={r.id_usuario}>
                              <td className="text-muted">{r.id_usuario}</td>
                              <td>{r.nombre_usuario || "-"}</td>
                              <td>{nombre}</td>
                              <td>{r.rol || "-"}</td>
                              <td>{estadoBadge(r.estado)}</td>
                              <td>{fmtDate(r.ultimo_acceso)}</td>
                              <td>
                                <span className="badge bg-primary">{Number(r.sesiones_activas || 0)}</span>
                              </td>
                              {canViewAudit ? (
                                <td className="text-end">
                                  <button
                                    type="button"
                                    className="btn btn-sm inv-prod-toolbar-btn sec-btn-ghost sec-audit-table-btn"
                                    onClick={() => onOpenAudit?.(r)}
                                  >
                                    <i className="bi bi-eye" />
                                    Ver
                                  </button>
                                </td>
                              ) : null}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <SecurityPaginationBar
                  totalItems={total}
                  pageSize={filters.limit}
                  currentPage={currentPage}
                  onPageChange={(nextPage) =>
                    setFilters((s) => ({
                      ...s,
                      offset: (nextPage - 1) * s.limit,
                    }))
                  }
                />
              </>
            )}
          </div>
        </div>
      </div>

      <SecurityFiltersDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onApply={onApplyFilters}
        onClear={onClearFilters}
        title="Ajusta el estado y el orden del listado de usuarios"
        chips={chips}
        drawerId="sec-usuarios-filtros"
      >
        <div className="sec-filters-drawer-section">
          <div className="inv-prod-drawer-section-title">Estado</div>
          <div className="sec-filters-drawer-chip-grid inv-ins-chip-grid">
            <button
              type="button"
              className={`inv-ins-chip ${filtersDraft.estado === "" ? "is-active" : ""}`.trim()}
              onClick={() => setFiltersDraft((s) => ({ ...s, estado: "" }))}
            >
              Todos
            </button>
            <button
              type="button"
              className={`inv-ins-chip ${filtersDraft.estado === "activo" ? "is-active" : ""}`.trim()}
              onClick={() => setFiltersDraft((s) => ({ ...s, estado: "activo" }))}
            >
              Activos
            </button>
            <button
              type="button"
              className={`inv-ins-chip ${filtersDraft.estado === "bloqueado" ? "is-active" : ""}`.trim()}
              onClick={() => setFiltersDraft((s) => ({ ...s, estado: "bloqueado" }))}
            >
              Bloqueados
            </button>
          </div>
          <div className="sec-filters-drawer-help">Selecciona un estado o deja “Todos”.</div>
        </div>

        <div className="sec-filters-drawer-section">
          <div className="inv-prod-drawer-section-title">Orden</div>
          <label className="form-label" htmlFor="sec_users_sort">Ordenar por</label>
          <select
            id="sec_users_sort"
            className="form-select"
            value={filtersDraft.sortBy}
            onChange={(e) => setFiltersDraft((s) => ({ ...s, sortBy: e.target.value }))}
          >
            <option value="recientes">Más recientes</option>
            <option value="nombre_asc">Nombre (A-Z)</option>
            <option value="nombre_desc">Nombre (Z-A)</option>
            <option value="usuario_asc">Usuario (A-Z)</option>
            <option value="usuario_desc">Usuario (Z-A)</option>
          </select>
        </div>
      </SecurityFiltersDrawer>
    </>
  );
};

export default UsuariosTab;
