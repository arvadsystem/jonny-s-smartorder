import { useEffect, useMemo, useRef, useState } from "react";
import InlineLoader from "../../../components/common/InlineLoader";
import SinPermiso from "../../../components/common/SinPermiso";
import SecurityConfirmAction from "./components/SecurityConfirmAction";
import SecurityFiltersDrawer from "./components/SecurityFiltersDrawer";
import SecurityPaginationBar from "./components/SecurityPaginationBar";
import { fmtHN } from "../../../utils/dateTime";
import { usePermisos } from "../../../context/PermisosContext";
import { PERMISSIONS } from "../../../utils/permissions";
import { securityAuditApi } from "./services/securityAuditApi";
import "./sesiones-ui.css";
import "./seguridad-auditoria-ui.css";

const PAGE_SIZE = 10;
const AUTO_REFRESH_MS = 15000;

const fmtDate = (value) => (value ? fmtHN(value) : "-");
const normalize = (value) => String(value || "").trim().toLowerCase();

const estadoUsuarioBadge = (estado) => {
  if (estado === true) return <span className="sec-badge sec-badge-active">ACTIVO</span>;
  if (estado === false) return <span className="sec-badge sec-badge-fail">BLOQUEADO</span>;
  return <span className="sec-badge sec-badge-closed">-</span>;
};

const estadoSesionBadge = (sesion) => {
  if (sesion?.activa) {
    return <span className="sec-badge sec-badge-active">ACTIVA</span>;
  }
  return <span className="sec-badge sec-badge-closed">CERRADA</span>;
};

const estadoLoginBadge = (exito) => {
  if (exito === true) return <span className="sec-badge sec-badge-active">ÉXITO</span>;
  if (exito === false) return <span className="sec-badge sec-badge-fail">FALLIDO</span>;
  return <span className="sec-badge sec-badge-closed">-</span>;
};

const SESIONES_SORT_LABELS = {
  recientes: "Más recientes",
  antiguas: "Más antiguas",
  ip_asc: "IP (A-Z)",
  ip_desc: "IP (Z-A)",
};

const LOGINS_SORT_LABELS = {
  recientes: "Más recientes",
  antiguos: "Más antiguos",
  usuario_asc: "Usuario (A-Z)",
  usuario_desc: "Usuario (Z-A)",
  ip_asc: "IP (A-Z)",
  ip_desc: "IP (Z-A)",
};

const sortSesionesRows = (rows, sortBy) => {
  const source = Array.isArray(rows) ? [...rows] : [];

  if (sortBy === "antiguas") {
    source.sort((a, b) => new Date(a?.fecha_inicio || 0).getTime() - new Date(b?.fecha_inicio || 0).getTime());
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

  source.sort((a, b) => new Date(b?.fecha_inicio || 0).getTime() - new Date(a?.fecha_inicio || 0).getTime());
  return source;
};

const sortLoginsRows = (rows, sortBy) => {
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

const initialSesionesDraft = {
  estado: "todas",
  sortBy: "recientes",
};

const initialLoginsDraft = {
  estado: "",
  desde: "",
  hasta: "",
  sortBy: "recientes",
};

const UsuarioAuditDetail = ({ userId, onBack }) => {
  const { canAny } = usePermisos();
  const canCloseUserSessions = canAny([PERMISSIONS.SEGURIDAD_SESIONES_CERRAR_GLOBAL]);
  const [activeTab, setActiveTab] = useState("perfil");

  const [noPermiso, setNoPermiso] = useState(false);
  const [error, setError] = useState("");

  const [perfilLoading, setPerfilLoading] = useState(true);
  const [perfil, setPerfil] = useState(null);
  const [ultimoAcceso, setUltimoAcceso] = useState(null);
  const [sesionesActivasPerfil, setSesionesActivasPerfil] = useState(0);

  const [sesionesLoading, setSesionesLoading] = useState(false);
  const [sesionesRows, setSesionesRows] = useState([]);
  const [sesionesTotal, setSesionesTotal] = useState(0);
  const [sesionesFilters, setSesionesFilters] = useState({
    ...initialSesionesDraft,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [sesionesDraft, setSesionesDraft] = useState(initialSesionesDraft);
  const [sesionesDrawerOpen, setSesionesDrawerOpen] = useState(false);

  const [loginsLoading, setLoginsLoading] = useState(false);
  const [loginsRows, setLoginsRows] = useState([]);
  const [loginsTotal, setLoginsTotal] = useState(0);
  const [loginsDraft, setLoginsDraft] = useState(initialLoginsDraft);
  const [loginsFilters, setLoginsFilters] = useState({
    ...initialLoginsDraft,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loginsDrawerOpen, setLoginsDrawerOpen] = useState(false);

  const [closingSessions, setClosingSessions] = useState(false);
  const [actionMessage, setActionMessage] = useState({ variant: "", message: "" });

  const sesionesRef = useRef(null);

  const resolvedUserId = Number(userId || 0);

  const loadPerfil = async () => {
    setPerfilLoading(true);
    setError("");
    setNoPermiso(false);
    try {
      const data = await securityAuditApi.getUsuarioDetalle(resolvedUserId);
      setPerfil(data?.perfil || null);
      setUltimoAcceso(data?.ultimo_acceso || null);
      setSesionesActivasPerfil(Number(data?.sesiones_activas || 0));
    } catch (e) {
      if (e?.status === 403) {
        setNoPermiso(true);
      } else {
        setError(e?.message || "Error cargando detalle de usuario");
      }
    } finally {
      setPerfilLoading(false);
    }
  };

  const loadSesiones = async ({ silent = false } = {}) => {
    if (!silent) setSesionesLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (sesionesFilters.estado && sesionesFilters.estado !== "todas") {
        qs.set("estado", sesionesFilters.estado);
      }
      qs.set("limit", String(sesionesFilters.limit));
      qs.set("offset", String(sesionesFilters.offset));
      qs.set("_ts", String(Date.now()));

      const data = await securityAuditApi.getUsuarioSesiones(resolvedUserId, qs.toString());
      setSesionesRows(data?.rows || []);
      setSesionesTotal(Number(data?.total || 0));
    } catch (e) {
      if (e?.status === 403) {
        setNoPermiso(true);
      } else {
        setError(e?.message || "Error cargando sesiones del usuario");
      }
    } finally {
      if (!silent) setSesionesLoading(false);
    }
  };

  const loadLogins = async ({ nextFilters } = {}) => {
    const activeFilters = nextFilters || loginsFilters;

    setLoginsLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (activeFilters.estado) qs.set("estado", activeFilters.estado);
      if (activeFilters.desde) qs.set("desde", activeFilters.desde);
      if (activeFilters.hasta) qs.set("hasta", activeFilters.hasta);
      qs.set("limit", String(activeFilters.limit));
      qs.set("offset", String(activeFilters.offset));
      qs.set("_ts", String(Date.now()));

      const data = await securityAuditApi.getUsuarioLogins(resolvedUserId, qs.toString());
      setLoginsRows(data?.rows || []);
      setLoginsTotal(Number(data?.total || 0));
    } catch (e) {
      if (e?.status === 403) {
        setNoPermiso(true);
      } else {
        setError(e?.message || "Error cargando logins del usuario");
      }
    } finally {
      setLoginsLoading(false);
    }
  };

  useEffect(() => {
    if (!resolvedUserId) return;
    loadPerfil();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedUserId]);

  useEffect(() => {
    if (!resolvedUserId || activeTab !== "sesiones") return;
    loadSesiones();
    sesionesRef.current = loadSesiones;

    const timer = setInterval(() => {
      sesionesRef.current?.({ silent: true });
    }, AUTO_REFRESH_MS);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedUserId, activeTab, sesionesFilters.estado, sesionesFilters.limit, sesionesFilters.offset]);

  useEffect(() => {
    if (!resolvedUserId || activeTab !== "logins") return;
    loadLogins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedUserId, activeTab, loginsFilters.estado, loginsFilters.desde, loginsFilters.hasta, loginsFilters.limit, loginsFilters.offset]);

  const sesionesCurrentPage = Math.floor(sesionesFilters.offset / sesionesFilters.limit) + 1;
  const loginsCurrentPage = Math.floor(loginsFilters.offset / loginsFilters.limit) + 1;

  const sesionesDisplayRows = useMemo(
    () => sortSesionesRows(sesionesRows, sesionesFilters.sortBy),
    [sesionesRows, sesionesFilters.sortBy]
  );

  const loginsDisplayRows = useMemo(
    () => sortLoginsRows(loginsRows, loginsFilters.sortBy),
    [loginsRows, loginsFilters.sortBy]
  );

  const fullName = useMemo(() => {
    if (!perfil) return "USUARIO";
    const n = `${perfil?.nombre || ""} ${perfil?.apellido || ""}`.trim();
    return n || perfil?.nombre_usuario || "USUARIO";
  }, [perfil]);

  const hasSesionesFilters = sesionesFilters.estado !== "todas" || sesionesFilters.sortBy !== "recientes";

  const hasLoginsFilters =
    Boolean(loginsFilters.estado || loginsFilters.desde || loginsFilters.hasta) ||
    loginsFilters.sortBy !== "recientes";

  const sesionesResultsLabel = `${sesionesTotal} resultados`;

  const loginsResultsLabel = `${loginsTotal} resultados`;

  const onOpenSesionesFilters = () => {
    setSesionesDraft({
      estado: sesionesFilters.estado,
      sortBy: sesionesFilters.sortBy,
    });
    setSesionesDrawerOpen(true);
  };

  const onApplySesionesFilters = () => {
    setSesionesFilters((prev) => ({
      ...prev,
      estado: sesionesDraft.estado,
      sortBy: sesionesDraft.sortBy,
      offset: 0,
    }));
    setSesionesDrawerOpen(false);
  };

  const onClearSesionesFilters = () => {
    const cleared = { ...initialSesionesDraft };
    setSesionesDraft(cleared);
    setSesionesFilters((prev) => ({ ...prev, ...cleared, offset: 0 }));
    setSesionesDrawerOpen(false);
  };

  const onOpenLoginsFilters = () => {
    setLoginsDraft({
      estado: loginsFilters.estado,
      desde: loginsFilters.desde,
      hasta: loginsFilters.hasta,
      sortBy: loginsFilters.sortBy,
    });
    setLoginsDrawerOpen(true);
  };

  const onAplicarLogins = () => {
    setLoginsFilters((prev) => ({
      ...prev,
      estado: loginsDraft.estado,
      desde: loginsDraft.desde,
      hasta: loginsDraft.hasta,
      sortBy: loginsDraft.sortBy,
      offset: 0,
    }));
    setLoginsDrawerOpen(false);
  };

  const onLimpiarLogins = () => {
    const clearedFilters = {
      ...initialLoginsDraft,
      limit: PAGE_SIZE,
      offset: 0,
    };
    setLoginsDraft(initialLoginsDraft);
    setLoginsFilters(clearedFilters);
    setLoginsDrawerOpen(false);
  };

  const onCerrarSesiones = async () => {
    setClosingSessions(true);
    setActionMessage({ variant: "", message: "" });

    try {
      const data = await securityAuditApi.cerrarSesionesUsuario(resolvedUserId);
      const cerradas = Number(data?.cerradas || 0);
      if (cerradas > 0) {
        setActionMessage({
          variant: "success",
          message: `Se cerraron ${cerradas} sesiones activas del usuario.`,
        });
      } else {
        setActionMessage({
          variant: "info",
          message: "No hay sesiones activas para cerrar.",
        });
      }

      await loadPerfil();
      if (activeTab === "sesiones") {
        await loadSesiones({ silent: true });
      }
    } catch (e) {
      setActionMessage({
        variant: "danger",
        message: e?.message || "No se pudieron cerrar las sesiones.",
      });
    } finally {
      setClosingSessions(false);
    }
  };

  const sesionesDrawerChips = [
    {
      icon: "bi-sliders2",
      label:
        sesionesDraft.estado === "activas"
          ? "Solo activas"
          : sesionesDraft.estado === "cerradas"
            ? "Solo cerradas"
            : "Todos los estados",
    },
    {
      icon: "bi-arrow-down-up",
      label: SESIONES_SORT_LABELS[sesionesDraft.sortBy] || "Más recientes",
    },
  ];

  const loginsDrawerChips = [
    {
      icon: "bi-sliders2",
      label:
        loginsDraft.estado === "SUCCESS"
          ? "Solo exitosos"
          : loginsDraft.estado === "FAIL"
            ? "Solo fallidos"
            : "Todos los estados",
    },
    {
      icon: "bi-arrow-down-up",
      label: LOGINS_SORT_LABELS[loginsDraft.sortBy] || "Más recientes",
    },
  ];

  if (noPermiso) {
    return <SinPermiso permiso="SEGURIDAD_USUARIOS_VER" detalle="No tienes permiso para auditar usuarios." />;
  }

  return (
    <>
      <div className="card shadow-sm sec-sesiones-shell" style={{ backgroundColor: "#fff" }}>
        <div className="card-body p-0">
          <div className="sec-panel-header sec-sesiones-header">
            <div className="sec-panel-title-wrap">
              <div className="sec-panel-title-row">
                <i className="bi bi-person-vcard sec-panel-title-icon" />
                <span className="sec-panel-title">Auditoría de usuario</span>
              </div>
              <div className="sec-panel-subtitle">{fullName}</div>
            </div>

            <div className="sec-panel-header-actions sec-audit-header-actions gap-2">
              <button type="button" className="btn inv-prod-toolbar-btn sec-btn-ghost sec-sesiones-global-btn" onClick={onBack}>
                <i className="bi bi-arrow-left me-2" />
                Regresar a usuarios
              </button>
            </div>
          </div>

          {actionMessage.message ? (
            <div className={`alert alert-${actionMessage.variant} sec-audit-message mb-0`} role="alert">
              {actionMessage.message}
            </div>
          ) : null}

          <div className="sec-audit-tabs">
            <div className="sec-audit-tabs-list">
              <button
                type="button"
                className={`sec-audit-tab-btn ${activeTab === "perfil" ? "is-active" : ""}`}
                onClick={() => setActiveTab("perfil")}
              >
                Perfil
              </button>
              <button
                type="button"
                className={`sec-audit-tab-btn ${activeTab === "sesiones" ? "is-active" : ""}`}
                onClick={() => setActiveTab("sesiones")}
              >
                Sesiones
              </button>
              <button
                type="button"
                className={`sec-audit-tab-btn ${activeTab === "logins" ? "is-active" : ""}`}
                onClick={() => setActiveTab("logins")}
              >
                Logins
              </button>
            </div>

            {activeTab === "sesiones" ? (
              <div className="sec-panel-header-actions sec-audit-header-actions sec-audit-tabs-actions">
                <button type="button" className="btn inv-prod-toolbar-btn" onClick={onOpenSesionesFilters}>
                  <i className="bi bi-funnel me-1" />
                  Filtros
                </button>

                {canCloseUserSessions ? (
                  <SecurityConfirmAction
                    className="btn inv-prod-toolbar-btn sec-btn-danger sec-sesiones-global-btn"
                    title="CONFIRMAR CIERRE DE SESIONES"
                    subtitle="Se forzará un nuevo inicio de sesión para este usuario."
                    question="¿Deseas cerrar todas las sesiones activas de este usuario?"
                    onConfirm={onCerrarSesiones}
                    disabled={closingSessions}
                  >
                    {closingSessions ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-x-octagon me-2" />
                        Cerrar sesiones
                      </>
                    )}
                  </SecurityConfirmAction>
                ) : null}

                <span className="sec-audit-tabs-results">{sesionesResultsLabel}</span>
              </div>
            ) : null}

            {activeTab === "logins" ? (
              <div className="sec-panel-header-actions sec-audit-header-actions sec-audit-tabs-actions">
                <button type="button" className="btn inv-prod-toolbar-btn" onClick={onOpenLoginsFilters}>
                  <i className="bi bi-funnel me-1" />
                  Filtros
                </button>
                <span className="sec-audit-tabs-results">{loginsResultsLabel}</span>
              </div>
            ) : null}
          </div>

          <div className="sec-panel-body p-3 sec-sesiones-body">
            {error ? <div className="alert alert-danger">{error}</div> : null}

            {activeTab === "perfil" && (
              <>
                {perfilLoading ? (
                  <InlineLoader />
                ) : (
                  <>
                    <div className="sec-audit-profile-layout">
                      <aside className="sec-audit-profile-focus">
                        <div className="sec-audit-profile-focus-name">
                          {(fullName || perfil?.nombre_usuario || "USUARIO").toUpperCase()}
                        </div>

                        <div className="sec-audit-profile-focus-avatar" aria-hidden="true">
                          <i className="bi bi-person-circle" />
                        </div>

                        <div className="sec-audit-profile-focus-stats">
                          <span className="sec-audit-chip">
                            <i className="bi bi-shield-check" />
                            SESIONES ACTIVAS: {sesionesActivasPerfil}
                          </span>
                          <span className="sec-audit-profile-focus-status">{estadoUsuarioBadge(perfil?.estado)}</span>
                        </div>
                      </aside>

                      <div className="sec-audit-profile-grid">
                        <div className="sec-audit-profile-item">
                          <div className="label">Usuario</div>
                          <div className="value">{perfil?.nombre_usuario || "-"}</div>
                        </div>
                        <div className="sec-audit-profile-item">
                          <div className="label">Rol</div>
                          <div className="value">{perfil?.rol || "-"}</div>
                        </div>
                        <div className="sec-audit-profile-item">
                          <div className="label">DNI</div>
                          <div className="value">{perfil?.dni || "-"}</div>
                        </div>
                        <div className="sec-audit-profile-item">
                          <div className="label">Correo</div>
                          <div className="value">{perfil?.correo || "-"}</div>
                        </div>
                        <div className="sec-audit-profile-item">
                          <div className="label">Teléfono</div>
                          <div className="value">{perfil?.telefono || "-"}</div>
                        </div>
                        <div className="sec-audit-profile-item">
                          <div className="label">Dirección</div>
                          <div className="value">{perfil?.direccion || "-"}</div>
                        </div>
                        <div className="sec-audit-profile-item">
                          <div className="label">Último acceso</div>
                          <div className="value">{fmtDate(ultimoAcceso?.fecha_hora)}</div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {activeTab === "sesiones" && (
              <>
                {sesionesLoading ? <InlineLoader /> : null}

                {!sesionesLoading && (
                  <>
                    {hasSesionesFilters ? (
                      <div className="sec-results-meta sec-sesiones-results-meta inv-inventory-results-meta">
                        <button
                          type="button"
                          className="sec-filter-pill sec-filter-pill--clear"
                          onClick={onClearSesionesFilters}
                          aria-label="Limpiar filtros de sesiones"
                        >
                          Filtros activos
                          <i className="bi bi-x-lg" aria-hidden="true" />
                        </button>
                      </div>
                    ) : null}

                    <div className="small text-muted mb-2">
                      Orden: {SESIONES_SORT_LABELS[sesionesFilters.sortBy] || "Más recientes"}
                    </div>

                    <div className="small text-muted mb-2">Actualización automática cada 15 s</div>

                    <div className="sec-sesiones-table-card">
                      <div className="table-responsive sec-sesiones-table-responsive">
                        <table className="table table-hover align-middle mb-0 sec-sesiones-table">
                          <thead>
                            <tr>
                              <th>Estado</th>
                              <th>Dispositivo</th>
                              <th>Navegador</th>
                              <th>SO</th>
                              <th>IP</th>
                              <th>Inicio</th>
                              <th>Última actividad</th>
                              <th>Cierre</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sesionesDisplayRows.length === 0 ? (
                              <tr>
                                <td colSpan="8" className="text-center text-muted py-4">
                                  No hay sesiones para este usuario.
                                </td>
                              </tr>
                            ) : (
                              sesionesDisplayRows.map((s) => (
                                <tr key={s.id_sesion}>
                                  <td>{estadoSesionBadge(s)}</td>
                                  <td>{s.dispositivo || "-"}</td>
                                  <td>{s.navegador || "-"}</td>
                                  <td>{s.sistema_operativo || "-"}</td>
                                  <td>{s.ip_origen || "-"}</td>
                                  <td>{fmtDate(s.fecha_inicio)}</td>
                                  <td>{fmtDate(s.ultima_actividad)}</td>
                                  <td>{fmtDate(s.fecha_cierre)}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <SecurityPaginationBar
                      totalItems={sesionesTotal}
                      pageSize={sesionesFilters.limit}
                      currentPage={sesionesCurrentPage}
                      onPageChange={(nextPage) =>
                        setSesionesFilters((prev) => ({
                          ...prev,
                          offset: (nextPage - 1) * prev.limit,
                        }))
                      }
                    />
                  </>
                )}
              </>
            )}

            {activeTab === "logins" && (
              <>
                {loginsLoading ? <InlineLoader /> : null}

                {!loginsLoading && (
                  <>
                    {hasLoginsFilters ? (
                      <div className="sec-results-meta sec-sesiones-results-meta inv-inventory-results-meta">
                        <button
                          type="button"
                          className="sec-filter-pill sec-filter-pill--clear"
                          onClick={onLimpiarLogins}
                          aria-label="Limpiar filtros de logins"
                        >
                          Filtros activos
                          <i className="bi bi-x-lg" aria-hidden="true" />
                        </button>
                      </div>
                    ) : null}

                    <div className="small text-muted mb-2">
                      Orden: {LOGINS_SORT_LABELS[loginsFilters.sortBy] || "Más recientes"}
                    </div>

                    <div className="sec-sesiones-table-card">
                      <div className="table-responsive sec-sesiones-table-responsive">
                        <table className="table table-hover align-middle mb-0 sec-sesiones-table">
                          <thead>
                            <tr>
                              <th>Fecha</th>
                              <th>Estado</th>
                              <th>Usuario</th>
                              <th>IP</th>
                              <th>Navegador</th>
                              <th>SO</th>
                              <th>Dispositivo</th>
                              <th>Mensaje</th>
                            </tr>
                          </thead>
                          <tbody>
                            {loginsDisplayRows.length === 0 ? (
                              <tr>
                                <td colSpan="8" className="text-center text-muted py-4">
                                  No hay logins para este usuario.
                                </td>
                              </tr>
                            ) : (
                              loginsDisplayRows.map((r) => (
                                <tr key={r.id_login}>
                                  <td>{fmtDate(r.fecha_hora)}</td>
                                  <td>{estadoLoginBadge(r.exito)}</td>
                                  <td>{r.usuario || r.nombre_usuario_intentado || "-"}</td>
                                  <td>{r.ip_origen || "-"}</td>
                                  <td>{r.navegador || "-"}</td>
                                  <td>{r.sistema_operativo || "-"}</td>
                                  <td>{r.dispositivo || "-"}</td>
                                  <td className="small text-muted">{r.mensaje_error || "-"}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <SecurityPaginationBar
                      totalItems={loginsTotal}
                      pageSize={loginsFilters.limit}
                      currentPage={loginsCurrentPage}
                      onPageChange={(nextPage) =>
                        setLoginsFilters((prev) => ({
                          ...prev,
                          offset: (nextPage - 1) * prev.limit,
                        }))
                      }
                    />
                  </>
                )}
              </>
            )}

          </div>
        </div>
      </div>

      <SecurityFiltersDrawer
        open={sesionesDrawerOpen}
        onClose={() => setSesionesDrawerOpen(false)}
        onApply={onApplySesionesFilters}
        onClear={onClearSesionesFilters}
        title="Ajusta el estado y el orden de las sesiones del usuario"
        chips={sesionesDrawerChips}
        drawerId="sec-user-sesiones-filtros"
      >
        <div className="sec-filters-drawer-section">
          <div className="inv-prod-drawer-section-title">Estado</div>
          <div className="sec-filters-drawer-chip-grid inv-ins-chip-grid">
            <button
              type="button"
              className={`inv-ins-chip ${sesionesDraft.estado === "todas" ? "is-active" : ""}`.trim()}
              onClick={() => setSesionesDraft((prev) => ({ ...prev, estado: "todas" }))}
            >
              Todas
            </button>
            <button
              type="button"
              className={`inv-ins-chip ${sesionesDraft.estado === "activas" ? "is-active" : ""}`.trim()}
              onClick={() => setSesionesDraft((prev) => ({ ...prev, estado: "activas" }))}
            >
              Activas
            </button>
            <button
              type="button"
              className={`inv-ins-chip ${sesionesDraft.estado === "cerradas" ? "is-active" : ""}`.trim()}
              onClick={() => setSesionesDraft((prev) => ({ ...prev, estado: "cerradas" }))}
            >
              Cerradas
            </button>
          </div>
          <div className="sec-filters-drawer-help">Selecciona un estado o deja “Todas”.</div>
        </div>

        <div className="sec-filters-drawer-section">
          <div className="inv-prod-drawer-section-title">Orden</div>
          <label className="form-label" htmlFor="sec_user_sesiones_sort">Ordenar por</label>
          <select
            id="sec_user_sesiones_sort"
            className="form-select"
            value={sesionesDraft.sortBy}
            onChange={(e) => setSesionesDraft((prev) => ({ ...prev, sortBy: e.target.value }))}
          >
            <option value="recientes">Más recientes</option>
            <option value="antiguas">Más antiguas</option>
            <option value="ip_asc">IP (A-Z)</option>
            <option value="ip_desc">IP (Z-A)</option>
          </select>
        </div>
      </SecurityFiltersDrawer>

      <SecurityFiltersDrawer
        open={loginsDrawerOpen}
        onClose={() => setLoginsDrawerOpen(false)}
        onApply={onAplicarLogins}
        onClear={onLimpiarLogins}
        title="Ajusta filtros y orden de los inicios de sesión"
        chips={loginsDrawerChips}
        drawerId="sec-user-logins-filtros"
      >
        <div className="sec-filters-drawer-section">
          <div className="inv-prod-drawer-section-title">Estado</div>
          <div className="sec-filters-drawer-chip-grid inv-ins-chip-grid">
            <button
              type="button"
              className={`inv-ins-chip ${loginsDraft.estado === "" ? "is-active" : ""}`.trim()}
              onClick={() => setLoginsDraft((prev) => ({ ...prev, estado: "" }))}
            >
              Todos
            </button>
            <button
              type="button"
              className={`inv-ins-chip ${loginsDraft.estado === "SUCCESS" ? "is-active" : ""}`.trim()}
              onClick={() => setLoginsDraft((prev) => ({ ...prev, estado: "SUCCESS" }))}
            >
              Exitosos
            </button>
            <button
              type="button"
              className={`inv-ins-chip ${loginsDraft.estado === "FAIL" ? "is-active" : ""}`.trim()}
              onClick={() => setLoginsDraft((prev) => ({ ...prev, estado: "FAIL" }))}
            >
              Fallidos
            </button>
          </div>
          <div className="sec-filters-drawer-help">Selecciona un estado o deja “Todos”.</div>
        </div>

        <div className="sec-filters-drawer-section">
          <div className="inv-prod-drawer-section-title">Rango de fechas</div>

          <label className="form-label" htmlFor="sec_user_logins_desde">Desde</label>
          <input
            id="sec_user_logins_desde"
            type="date"
            className="form-control"
            value={loginsDraft.desde}
            onChange={(e) => setLoginsDraft((prev) => ({ ...prev, desde: e.target.value }))}
          />

          <label className="form-label" htmlFor="sec_user_logins_hasta">Hasta</label>
          <input
            id="sec_user_logins_hasta"
            type="date"
            className="form-control"
            value={loginsDraft.hasta}
            onChange={(e) => setLoginsDraft((prev) => ({ ...prev, hasta: e.target.value }))}
          />
        </div>

        <div className="sec-filters-drawer-section">
          <div className="inv-prod-drawer-section-title">Orden</div>
          <label className="form-label" htmlFor="sec_user_logins_sort">Ordenar por</label>
          <select
            id="sec_user_logins_sort"
            className="form-select"
            value={loginsDraft.sortBy}
            onChange={(e) => setLoginsDraft((prev) => ({ ...prev, sortBy: e.target.value }))}
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

export default UsuarioAuditDetail;
