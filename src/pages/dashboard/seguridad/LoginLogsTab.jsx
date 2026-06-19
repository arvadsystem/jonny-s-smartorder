import { useEffect, useMemo, useState } from "react";
import InlineLoader from "../../../components/common/InlineLoader";
import SinPermiso from "../../../components/common/SinPermiso";
import { apiFetch } from "../../../services/api";
import { fmtHN } from "../../../utils/dateTime";
import SecurityFiltersDrawer from "./components/SecurityFiltersDrawer";
import SecurityPaginationBar from "./components/SecurityPaginationBar";
import "./sesiones-ui.css";
import "./seguridad-auditoria-ui.css";

const PAGE_SIZE = 10;

const SORT_LABELS = {
  recientes: "Más recientes",
  antiguos: "Más antiguos",
  usuario_asc: "Usuario (A-Z)",
  usuario_desc: "Usuario (Z-A)",
  ip_asc: "IP (A-Z)",
  ip_desc: "IP (Z-A)",
};

const fmtDate = (value) => fmtHN(value);

const estadoBadge = (exito) => {
  const isSuccess =
    exito === true ||
    exito === 1 ||
    String(exito ?? "").trim().toLowerCase() === "true" ||
    String(exito ?? "").trim() === "1";

  const isFail =
    exito === false ||
    exito === 0 ||
    String(exito ?? "").trim().toLowerCase() === "false" ||
    String(exito ?? "").trim() === "0";

  if (isSuccess) return <span className="sec-badge sec-badge-active">ÉXITO</span>;
  if (isFail) return <span className="sec-badge sec-badge-fail">FALLIDO</span>;
  return <span className="sec-badge sec-badge-closed">-</span>;
};

const normalize = (value) => String(value || "").trim().toLowerCase();

const sortLogRows = (rows, sortBy) => {
  const source = Array.isArray(rows) ? [...rows] : [];

  if (sortBy === "antiguos") {
    source.sort((a, b) => new Date(a?.fecha_hora || 0).getTime() - new Date(b?.fecha_hora || 0).getTime());
    return source;
  }

  if (sortBy === "usuario_asc" || sortBy === "usuario_desc") {
    source.sort((a, b) => {
      const aUser = normalize(a?.usuario || a?.nombre_usuario_intentado);
      const bUser = normalize(b?.usuario || b?.nombre_usuario_intentado);
      return sortBy === "usuario_asc" ? aUser.localeCompare(bUser, "es") : bUser.localeCompare(aUser, "es");
    });
    return source;
  }

  if (sortBy === "ip_asc" || sortBy === "ip_desc") {
    source.sort((a, b) => {
      const aIp = normalize(a?.ip_origen);
      const bIp = normalize(b?.ip_origen);
      return sortBy === "ip_asc" ? aIp.localeCompare(bIp, "es") : bIp.localeCompare(aIp, "es");
    });
    return source;
  }

  source.sort((a, b) => new Date(b?.fecha_hora || 0).getTime() - new Date(a?.fecha_hora || 0).getTime());
  return source;
};

const LoginLogsTab = () => {
  const [loading, setLoading] = useState(true);
  const [noPermiso, setNoPermiso] = useState(false);
  const [error, setError] = useState("");

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [filters, setFilters] = useState({
    estado: "",
    desde: "",
    hasta: "",
    limit: PAGE_SIZE,
    offset: 0,
    sortBy: "recientes",
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filtersDraft, setFiltersDraft] = useState({
    estado: "",
    desde: "",
    hasta: "",
    sortBy: "recientes",
  });

  const load = async ({ nextFilters, nextSearch } = {}) => {
    const activeFilters = nextFilters || filters;
    const activeSearch = typeof nextSearch === "string" ? nextSearch : search;

    setLoading(true);
    setError("");
    setNoPermiso(false);

    try {
      const qs = new URLSearchParams();
      if (activeFilters.estado) qs.set("estado", activeFilters.estado);
      if (activeFilters.desde) qs.set("desde", activeFilters.desde);
      if (activeFilters.hasta) qs.set("hasta", activeFilters.hasta);
      if (activeSearch) qs.set("usuario", activeSearch);
      qs.set("limit", String(activeFilters.limit));
      qs.set("offset", String(activeFilters.offset));

      const data = await apiFetch(`/seguridad/logins?${qs.toString()}`, "GET");
      setRows(data?.rows || []);
      setTotal(data?.total || 0);
    } catch (e) {
      if (e?.status === 403) {
        setNoPermiso(true);
        return;
      }
      setError(e?.message || "Error cargando logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.offset, filters.limit, filters.estado, filters.desde, filters.hasta, search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const nextSearch = searchInput.trim();
      setSearch(nextSearch);
      setFilters((prev) => ({ ...prev, offset: 0 }));
    }, 250);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const onOpenFilters = () => {
    setFiltersDraft({
      estado: filters.estado,
      desde: filters.desde,
      hasta: filters.hasta,
      sortBy: filters.sortBy,
    });
    setDrawerOpen(true);
  };

  const onApplyFilters = () => {
    setFilters((prev) => ({
      ...prev,
      estado: filtersDraft.estado,
      desde: filtersDraft.desde,
      hasta: filtersDraft.hasta,
      sortBy: filtersDraft.sortBy,
      offset: 0,
    }));
    setDrawerOpen(false);
  };

  const onClearFilters = () => {
    const clearedDraft = { estado: "", desde: "", hasta: "", sortBy: "recientes" };
    setFiltersDraft(clearedDraft);
    setFilters((prev) => ({ ...prev, ...clearedDraft, offset: 0 }));
    setDrawerOpen(false);
  };

  const displayRows = useMemo(() => sortLogRows(rows, filters.sortBy), [rows, filters.sortBy]);

  const currentPage = Math.floor(filters.offset / filters.limit) + 1;

  const hasActiveFilters = useMemo(() => {
    return Boolean(filters.estado || filters.desde || filters.hasta || filters.sortBy !== "recientes" || search);
  }, [filters.estado, filters.desde, filters.hasta, filters.sortBy, search]);

  const resultsLabel = `${total} resultados`;

  const chips = [
    {
      icon: "bi-sliders2",
      label:
        filtersDraft.estado === "SUCCESS"
          ? "Solo exitosos"
          : filtersDraft.estado === "FAIL"
            ? "Solo fallidos"
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
        permiso="SEGURIDAD_VER"
        detalle="Requiere permiso para ver logs de inicio de sesión."
      />
    );
  }

  return (
    <>
      <div className="card shadow-sm sec-sesiones-shell" style={{ backgroundColor: "#fff" }}>
        <div className="card-body p-0">
          <div className="sec-panel-header">
            <div className="sec-panel-title-wrap">
              <div className="sec-panel-title-row">
                <i className="bi bi-journal-text sec-panel-title-icon" />
                <span className="sec-panel-title">Logs de login</span>
              </div>
              <div className="sec-panel-subtitle">
                Historial de intentos de inicio de sesión (exitosos y fallidos).
              </div>
            </div>

            <div className="sec-panel-header-actions sec-audit-header-actions">
              <label className="sec-toolbar-search sec-sesiones-search inv-ins-search" aria-label="Buscar logs de login">
                <i className="bi bi-search" />
                <input
                  type="search"
                  placeholder="Buscar por usuario..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </label>

              <button type="button" className="btn inv-prod-toolbar-btn" onClick={onOpenFilters}>
                <i className="bi bi-funnel me-1" />
                Filtros
              </button>
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
                    <table className="table table-hover align-middle mb-0 sec-sesiones-table sec-table-login-logs sec-mobile-card-table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Usuario</th>
                          <th>Estado</th>
                          <th>IP</th>
                          <th>Navegador</th>
                          <th>SO</th>
                          <th>Dispositivo</th>
                          <th>Mensaje</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayRows.length === 0 && (
                          <tr>
                            <td colSpan="8" className="text-center text-muted py-4">
                              No hay registros para los filtros seleccionados.
                            </td>
                          </tr>
                        )}

                        {displayRows.map((r) => (
                          <tr key={r.id_login}>
                            <td>{fmtDate(r.fecha_hora)}</td>
                            <td>{r.usuario || r.nombre_usuario_intentado || "-"}</td>
                            <td>{estadoBadge(r.exito)}</td>
                            <td>{r.ip_origen || "-"}</td>
                            <td>{r.navegador || "-"}</td>
                            <td>{r.sistema_operativo || "-"}</td>
                            <td>{r.dispositivo || "-"}</td>
                            <td className="small text-muted">{r.mensaje_error || "-"}</td>
                          </tr>
                        ))}
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
        title="Ajusta el estado y el orden del historial de logins"
        chips={chips}
        drawerId="sec-logins-filtros"
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
              className={`inv-ins-chip ${filtersDraft.estado === "SUCCESS" ? "is-active" : ""}`.trim()}
              onClick={() => setFiltersDraft((s) => ({ ...s, estado: "SUCCESS" }))}
            >
              Exitosos
            </button>
            <button
              type="button"
              className={`inv-ins-chip ${filtersDraft.estado === "FAIL" ? "is-active" : ""}`.trim()}
              onClick={() => setFiltersDraft((s) => ({ ...s, estado: "FAIL" }))}
            >
              Fallidos
            </button>
          </div>
          <div className="sec-filters-drawer-help">Selecciona un estado o deja “Todos”.</div>
        </div>

        <div className="sec-filters-drawer-section">
          <div className="inv-prod-drawer-section-title">Rango de fechas</div>
          <label className="form-label" htmlFor="sec_log_desde">Desde</label>
          <input
            id="sec_log_desde"
            type="date"
            className="form-control"
            value={filtersDraft.desde}
            onChange={(e) => setFiltersDraft((s) => ({ ...s, desde: e.target.value }))}
          />

          <label className="form-label" htmlFor="sec_log_hasta">Hasta</label>
          <input
            id="sec_log_hasta"
            type="date"
            className="form-control"
            value={filtersDraft.hasta}
            onChange={(e) => setFiltersDraft((s) => ({ ...s, hasta: e.target.value }))}
          />
        </div>

        <div className="sec-filters-drawer-section">
          <div className="inv-prod-drawer-section-title">Orden</div>
          <label className="form-label" htmlFor="sec_log_sort">Ordenar por</label>
          <select
            id="sec_log_sort"
            className="form-select"
            value={filtersDraft.sortBy}
            onChange={(e) => setFiltersDraft((s) => ({ ...s, sortBy: e.target.value }))}
          >
            <option value="recientes">Más recientes</option>
            <option value="antiguos">Más antiguos</option>
            <option value="usuario_asc">Usuario (A-Z)</option>
            <option value="usuario_desc">Usuario (Z-A)</option>
            <option value="ip_asc">IP (A-Z)</option>
            <option value="ip_desc">IP (Z-A)</option>
          </select>
        </div>
      </SecurityFiltersDrawer>
    </>
  );
};

export default LoginLogsTab;
