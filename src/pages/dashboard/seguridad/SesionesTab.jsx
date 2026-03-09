import { useEffect, useMemo, useRef, useState } from "react";
import { securityService } from "../../../services/securityService";
import SinPermiso from "../../../components/common/SinPermiso";
import InlineLoader from "../../../components/common/InlineLoader";
import SecurityConfirmAction from "./components/SecurityConfirmAction";
import { fmtHN } from "../../../utils/dateTime";
import { usePermisos } from "../../../context/PermisosContext";
import { PERMISSIONS } from "../../../utils/permissions";
import "./sesiones-ui.css";

const PAGE_SIZE = 10;
const AUTO_REFRESH_MS = 15000;

const fmtDate = (value) => fmtHN(value);

const isSesionFallida = (sesion) => {
  const estadoRaw =
    sesion?.estado_login ??
    sesion?.estado ??
    sesion?.resultado ??
    sesion?.status ??
    "";
  const estado = String(estadoRaw).toUpperCase();

  if (estado.includes("FAIL") || estado.includes("FALL")) return true;
  if (sesion?.exito === false) return true;

  return false;
};

// ======================================================
// PERSONAL (usuario normal) - HU79
// ======================================================
const SesionesTabPersonal = () => {
  const { canAny } = usePermisos();
  const canClosePersonal = canAny([PERMISSIONS.SEGURIDAD_SESIONES_CERRAR]);
  const [sesiones, setSesiones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noPermiso, setNoPermiso] = useState(false);
  const [error, setError] = useState("");

  const [closingId, setClosingId] = useState(null);
  const [closingOtras, setClosingOtras] = useState(false);

  const [page, setPage] = useState(1);
  const [segmento, setSegmento] = useState("todas");
  const [search, setSearch] = useState("");

  const [lastUpdated, setLastUpdated] = useState(null);

  const cargar = async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setError("");
      setNoPermiso(false);
    }

    try {
      // cache-bust para evitar respuestas cacheadas del GET
      const qs = new URLSearchParams({ _ts: String(Date.now()) }).toString();
      const data = await securityService.getSesiones(qs);
      setSesiones(data?.sesiones || []);
      setLastUpdated(Date.now());
    } catch (e) {
      if (e?.status === 403) {
        setNoPermiso(true);
        return;
      }
      setError(e?.message || "Error cargando sesiones");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const cargarRef = useRef(cargar);
  useEffect(() => {
    cargarRef.current = cargar;
  });

  useEffect(() => {
    cargar();
    const t = setInterval(() => {
      cargarRef.current?.({ silent: true });
    }, AUTO_REFRESH_MS);

    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sesionesActivas = useMemo(
    () => sesiones.filter((s) => s.activa),
    [sesiones]
  );

  const sesionesCerradas = useMemo(
    () => sesiones.filter((s) => !s.activa),
    [sesiones]
  );

  const sesionesFallidas = useMemo(
    () => sesiones.filter((s) => isSesionFallida(s)),
    [sesiones]
  );

  const sesionesFiltradas = useMemo(() => {
    const term = search.trim().toLowerCase();

    return sesiones.filter((s) => {
      if (segmento === "activas" && !s.activa) return false;
      if (segmento === "cerradas" && s.activa) return false;
      if (segmento === "fallidos" && !isSesionFallida(s)) return false;

      if (!term) return true;

      const texto = `${s?.dispositivo ?? ""} ${s?.navegador ?? ""} ${s?.sistema_operativo ?? ""} ${
        s?.ip_origen ?? ""
      } ${fmtDate(s?.fecha_inicio)} ${fmtDate(s?.ultima_actividad)}`.toLowerCase();

      return texto.includes(term);
    });
  }, [sesiones, segmento, search]);

  const segmentOptions = useMemo(
    () => [
      { key: "todas", label: "Todas", count: sesiones.length },
      { key: "activas", label: "Activas", count: sesionesActivas.length },
      { key: "cerradas", label: "Cerradas", count: sesionesCerradas.length },
      { key: "fallidos", label: "Fallidos", count: sesionesFallidas.length },
    ],
    [sesiones.length, sesionesActivas.length, sesionesCerradas.length, sesionesFallidas.length]
  );

  const totalPages = Math.max(1, Math.ceil(sesionesFiltradas.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const paginated = sesionesFiltradas.slice(start, start + PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [segmento, search]);

  const onCerrar = async (id_sesion) => {
    setClosingId(id_sesion);
    try {
      await securityService.cerrarSesion(id_sesion);
      await cargar({ silent: true });
    } catch (e) {
      alert(e?.message || "No se pudo cerrar la sesión");
    } finally {
      setClosingId(null);
    }
  };

  const onCerrarOtras = async () => {
    setClosingOtras(true);
    try {
      await securityService.cerrarOtras();
      await cargar({ silent: true });
    } catch (e) {
      alert(e?.message || "No se pudieron cerrar las otras sesiones");
    } finally {
      setClosingOtras(false);
    }
  };

  if (noPermiso) return <SinPermiso permiso="SEGURIDAD_VER" />;

  return (
    <div className="card shadow-sm sec-sesiones-shell" style={{ backgroundColor: "#fff" }}>
      <div className="card-body p-0">
        <div className="sec-panel-header sec-sesiones-header">
          <div className="sec-panel-title-wrap">
            <div className="sec-panel-title-row">
              <i className="bi bi-shield-lock sec-panel-title-icon" />
              <span className="sec-panel-title">Sesiones</span>
            </div>
            <div className="sec-panel-subtitle">Monitoreo y auditoría de accesos</div>
          </div>

          <div className="sec-panel-header-actions sec-sesiones-header-actions">
            <label className="sec-toolbar-search sec-sesiones-search" aria-label="Buscar sesiones">
              <i className="bi bi-search" />
              <input
                type="search"
                placeholder="Buscar por dispositivo, navegador, SO o IP..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>

            {canClosePersonal ? (
              <SecurityConfirmAction
                className="btn btn-outline-danger"
                title="CONFIRMAR CIERRE GLOBAL"
                subtitle="Se cerrarán todas las sesiones excepto la sesión actual."
                question="¿Deseas cerrar las demás sesiones activas?"
                onConfirm={onCerrarOtras}
                disabled={sesionesActivas.length <= 1 || closingOtras}
              >
                {closingOtras ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Cerrando...
                  </>
                ) : (
                  <>
                    <i className="bi bi-x-circle me-2"></i>
                    Cerrar sesiones (menos la actual)
                  </>
                )}
              </SecurityConfirmAction>
            ) : null}
          </div>
        </div>

        <div className="sec-kpis sec-sesiones-kpis" aria-label="Resumen de sesiones">
          <div className="sec-kpi sec-sesiones-kpi">
            <div className="sec-kpi-content">
              <span>Total</span>
              <strong>{sesiones.length}</strong>
            </div>
          </div>
          <div className="sec-kpi sec-sesiones-kpi is-ok">
            <div className="sec-kpi-content">
              <span>Activas</span>
              <strong>{sesionesActivas.length}</strong>
            </div>
          </div>
          <div className="sec-kpi sec-sesiones-kpi">
            <div className="sec-kpi-content">
              <span>Cerradas</span>
              <strong>{sesionesCerradas.length}</strong>
            </div>
          </div>
          <div className="sec-kpi sec-sesiones-kpi is-empty">
            <div className="sec-kpi-content">
              <span>Fallidos</span>
              <strong>{sesionesFallidas.length}</strong>
            </div>
          </div>
        </div>

        <div className="sec-sesiones-segments-wrap">
          <div className="sec-sesiones-segments" role="tablist" aria-label="Segmentos de sesiones">
            {segmentOptions.map((seg) => (
              <button
                key={seg.key}
                type="button"
                className={`sec-sesiones-segment-btn ${segmento === seg.key ? "is-active" : ""}`}
                onClick={() => setSegmento(seg.key)}
              >
                <span>{seg.label}</span>
                <span className="sec-sesiones-segment-count">{seg.count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="sec-panel-body p-3 sec-sesiones-body">
          {loading && <InlineLoader />}
          {error && <div className="alert alert-danger">{error}</div>}

          {!loading && !error && (
            <>
              <div className="sec-results-meta sec-sesiones-results-meta">
                <span>{sesionesFiltradas.length} resultados</span>
                <span>Total general: {sesiones.length}</span>
                <span className="text-muted">
                  Última actualización: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : "—"} (auto 15 s)
                </span>
                {segmento !== "todas" ? (
                  <span className="sec-results-pill">Filtro activo</span>
                ) : null}
              </div>

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
                        <th className="text-end">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.length === 0 && (
                        <tr>
                          <td colSpan="8" className="text-center text-muted py-4">
                            {segmento === "todas" && !search
                              ? "No hay sesiones registradas."
                              : "No hay sesiones para el filtro seleccionado."}
                          </td>
                        </tr>
                      )}

                      {paginated.map((s) => {
                        const esActual = !!s.es_actual && s.activa;
                        const esFallida = isSesionFallida(s);

                        return (
                          <tr key={s.id_sesion} className={esActual ? "sec-sesion-row-current" : ""}>
                            <td>
                              {esFallida ? (
                                <span className="badge bg-danger">Fallido</span>
                              ) : s.activa ? (
                                <span className={`badge ${esActual ? "bg-primary" : "bg-success"}`}>
                                  Activa{esActual ? " (Actual)" : ""}
                                </span>
                              ) : (
                                <span className="badge bg-secondary">Cerrada</span>
                              )}
                            </td>
                            <td>{s.dispositivo || "—"}</td>
                            <td>{s.navegador || "—"}</td>
                            <td>{s.sistema_operativo || "—"}</td>
                            <td>{s.ip_origen || "—"}</td>
                            <td>{fmtDate(s.fecha_inicio)}</td>
                            <td>{fmtDate(s.ultima_actividad)}</td>
                            <td className="text-end">
                              {canClosePersonal ? (
                                <SecurityConfirmAction
                                  className="btn btn-sm btn-outline-danger"
                                  title="CONFIRMAR CIERRE DE SESIÓN"
                                  subtitle="La sesión seleccionada se finalizará de inmediato."
                                  question="¿Deseas cerrar esta sesión?"
                                  onConfirm={() => onCerrar(s.id_sesion)}
                                  disabled={!s.activa || closingId === s.id_sesion || esActual}
                                >
                                  {closingId === s.id_sesion ? (
                                    <span className="spinner-border spinner-border-sm" />
                                  ) : (
                                    "Cerrar"
                                  )}
                                </SecurityConfirmAction>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="d-flex justify-content-between align-items-center mt-3">
                <small className="text-muted">
                  Mostrando {Math.min(page * PAGE_SIZE, sesionesFiltradas.length)} de {sesionesFiltradas.length}
                </small>

                <div className="btn-group">
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </button>
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ======================================================
// GLOBAL (Super Admin) - Sprint 3
// ======================================================
const SesionesTabGlobal = () => {
  const { canAny } = usePermisos();
  const canCloseGlobal = canAny([PERMISSIONS.SEGURIDAD_SESIONES_CERRAR_GLOBAL]);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [noPermiso, setNoPermiso] = useState(false);
  const [error, setError] = useState("");

  const [buscarInput, setBuscarInput] = useState("");
  const [buscar, setBuscar] = useState("");

  const [offset, setOffset] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [closingId, setClosingId] = useState(null);

  const load = async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setError("");
      setNoPermiso(false);
    }

    try {
      const qs = new URLSearchParams();
      if (buscar) qs.set("buscar", buscar);
      qs.set("limit", String(PAGE_SIZE));
      qs.set("offset", String(offset));
      qs.set("_ts", String(Date.now())); // cache-bust

      const data = await securityService.getSesionesGlobal(qs.toString());
      setRows(data?.rows || []);
      setTotal(data?.total || 0);
      setLastUpdated(Date.now());
    } catch (e) {
      if (e?.status === 403) {
        setNoPermiso(true);
        return;
      }
      setError(e?.message || "Error cargando sesiones globales");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscar, offset]);

  useEffect(() => {
    const t = setInterval(() => {
      loadRef.current?.({ silent: true });
    }, AUTO_REFRESH_MS);
    return () => clearInterval(t);
  }, []);

  const canPrev = offset > 0;
  const canNext = offset + rows.length < total;
  const shown = Math.min(offset + rows.length, total);

  const handleBuscarInput = (value) => {
    setBuscarInput(value);
    setOffset(0);
    setBuscar(value.trim());
  };

  const onCerrarGlobalMenosActual = async () => {
    try {
      await securityService.cerrarGlobalMenosActual();
      setOffset(0);
      await load({ silent: true });
    } catch (e) {
      alert(e?.message || "No se pudieron cerrar las sesiones");
    }
  };

  const onCerrarSesionGlobal = async (id_sesion, esActual) => {
    if (esActual) return;

    setClosingId(id_sesion);
    try {
      await securityService.cerrarSesionGlobal(id_sesion);
      await load({ silent: true });
    } catch (e) {
      alert(e?.message || "No se pudo cerrar la sesión");
    } finally {
      setClosingId(null);
    }
  };

  if (noPermiso) return <SinPermiso permiso="SEGURIDAD_VER" detalle="Solo Super Admin." />;

  return (
    <div className="card shadow-sm sec-sesiones-shell" style={{ backgroundColor: "#fff" }}>
      <div className="card-body p-0">
        <div className="sec-panel-header sec-sesiones-header">
          <div className="sec-panel-title-wrap">
            <div className="sec-panel-title-row">
              <i className="bi bi-shield-lock sec-panel-title-icon" />
              <span className="sec-panel-title">SESIONES</span>
            </div>
            <div className="sec-panel-subtitle">Vista Super Admin</div>
          </div>

          <div className="sec-panel-header-actions sec-sesiones-header-actions">
            <label className="sec-toolbar-search sec-sesiones-search" aria-label="Buscar sesiones globales">
              <i className="bi bi-search" />
              <input
                type="search"
                placeholder="Buscar por usuario / nombre / IP..."
                value={buscarInput}
                onChange={(e) => handleBuscarInput(e.target.value)}
                onInput={(e) => handleBuscarInput(e.currentTarget.value)}
              />
            </label>

            {canCloseGlobal ? (
              <SecurityConfirmAction
                className="btn btn-outline-danger sec-sesiones-global-btn"
                title="CONFIRMAR CIERRE GLOBAL"
                subtitle="Esta acción impactará sesiones activas del sistema."
                question="¿Deseas cerrar todas las sesiones excepto la actual?"
                onConfirm={onCerrarGlobalMenosActual}
                disabled={total <= 1}
              >
                <i className="bi bi-x-circle me-2"></i>
                Cerrar sesiones
              </SecurityConfirmAction>
            ) : null}
          </div>
        </div>

        <div className="sec-panel-body p-3 sec-sesiones-body">
          {loading && <InlineLoader />}
          {error && <div className="alert alert-danger">{error}</div>}

          {!loading && !error && (
            <>
              <div className="sec-results-meta sec-sesiones-results-meta">
                <span>Mostrando {shown} de {total}</span>
                <span className="text-muted">
                  Última actualización: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : "—"} (auto 15 s)
                </span>
              </div>

              <div className="sec-sesiones-table-card">
                <div className="table-responsive sec-sesiones-table-responsive">
                  <table className="table table-hover align-middle mb-0 sec-sesiones-table">
                    <thead>
                      <tr>
                        <th>Estado</th>
                        <th>Usuario</th>
                        <th>Dispositivo</th>
                        <th>Navegador</th>
                        <th>SO</th>
                        <th>IP</th>
                        <th>Inicio de sesión</th>
                        <th>Última actividad</th>
                        <th className="text-end">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 && (
                        <tr>
                          <td colSpan="9" className="text-center text-muted py-4">
                            {buscar
                              ? "No existe sesión activa para el dato ingresado."
                              : "No hay sesiones activas para el filtro."}
                          </td>
                        </tr>
                      )}

                      {rows.map((s) => {
                        const esActual = !!s.es_actual;

                        return (
                          <tr key={s.id_sesion} className={esActual ? "sec-sesion-row-current" : ""}>
                            <td>
                              <span className={`badge ${esActual ? "bg-primary" : "bg-success"}`}>
                                Activa{esActual ? " (Actual)" : ""}
                              </span>
                            </td>
                            <td>
                              <div className="fw-semibold">{s.nombre_usuario || "—"}</div>
                              <div className="small text-muted">
                                {[s.nombre, s.apellido].filter(Boolean).join(" ") || "—"}
                              </div>
                            </td>
                            <td>{s.dispositivo || "—"}</td>
                            <td>{s.navegador || "—"}</td>
                            <td>{s.sistema_operativo || "—"}</td>
                            <td>{s.ip_origen || "—"}</td>
                            <td>{fmtDate(s.fecha_inicio)}</td>
                            <td>{fmtDate(s.ultima_actividad)}</td>
                            <td className="text-end">
                              {canCloseGlobal ? (
                                <SecurityConfirmAction
                                  className="btn btn-sm btn-outline-danger"
                                  title="CONFIRMAR CIERRE DE SESIÓN"
                                  subtitle="El usuario deberá iniciar sesión nuevamente."
                                  question="¿Deseas cerrar esta sesión?"
                                  centered
                                  onConfirm={() => onCerrarSesionGlobal(s.id_sesion, esActual)}
                                  disabled={esActual || closingId === s.id_sesion}
                                >
                                  {closingId === s.id_sesion ? (
                                    <span className="spinner-border spinner-border-sm" />
                                  ) : esActual ? (
                                    "Actual"
                                  ) : (
                                    "Cerrar"
                                  )}
                                </SecurityConfirmAction>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="d-flex justify-content-between align-items-center mt-3">
                <small className="text-muted">Mostrando {shown} de {total}</small>

                <div className="btn-group">
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    disabled={!canPrev}
                    onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                  >
                    Anterior
                  </button>
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    disabled={!canNext}
                    onClick={() => setOffset((o) => o + PAGE_SIZE)}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const SesionesTab = () => {
  const { canAny, loading } = usePermisos();
  const canViewGlobal = canAny([PERMISSIONS.SEGURIDAD_SESIONES_VER_GLOBAL]);

  if (loading) return null;
  return canViewGlobal ? <SesionesTabGlobal /> : <SesionesTabPersonal />;
};

export default SesionesTab;