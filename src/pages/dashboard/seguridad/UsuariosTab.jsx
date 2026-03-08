import { useEffect, useState } from "react";
import InlineLoader from "../../../components/common/InlineLoader";
import SinPermiso from "../../../components/common/SinPermiso";
import { securityService } from "../../../services/securityService";
import { fmtHN } from "../../../utils/dateTime";
import { usePermisos } from "../../../context/PermisosContext";
import { PERMISSIONS } from "../../../utils/permissions";
import "./sesiones-ui.css";
import "./seguridad-auditoria-ui.css";

const PAGE_SIZE = 10;

const fmtDate = (value) => (value ? fmtHN(value) : "-");

const estadoBadge = (estado) => {
  if (estado === true) return <span className="sec-badge sec-badge-active">ACTIVO</span>;
  if (estado === false) return <span className="sec-badge sec-badge-fail">BLOQUEADO</span>;
  return <span className="sec-badge sec-badge-closed">-</span>;
};

const UsuariosTab = ({ onOpenAudit }) => {
  const { canAny } = usePermisos();
  const canViewAudit = canAny([PERMISSIONS.SEGURIDAD_USUARIOS_VER]);

  const [loading, setLoading] = useState(true);
  const [noPermiso, setNoPermiso] = useState(false);
  const [error, setError] = useState("");

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);

  const [filters, setFilters] = useState({
    buscar: "",
    estado: "",
    limit: PAGE_SIZE,
    offset: 0
  });

  const load = async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setError("");
      setNoPermiso(false);
    }

    try {
      const qs = new URLSearchParams();
      if (filters.buscar) qs.set("buscar", filters.buscar);
      if (filters.estado) qs.set("estado", filters.estado);
      qs.set("limit", String(filters.limit));
      qs.set("offset", String(filters.offset));
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
  }, [filters.offset, filters.limit]);

  const onApplyFilters = () => {
    setFilters((s) => ({ ...s, offset: 0 }));
    setTimeout(() => load(), 0);
  };

  const onClear = () => {
    setFilters({ buscar: "", estado: "", limit: PAGE_SIZE, offset: 0 });
    setTimeout(() => load(), 0);
  };

  const canPrev = filters.offset > 0;
  const canNext = filters.offset + filters.limit < total;
  const shownCount = Math.min(filters.offset + rows.length, total);

  if (noPermiso) {
    return (
      <SinPermiso
        permiso="SEGURIDAD_USUARIOS_VER"
        detalle="No tienes permiso para ver el listado global de usuarios."
      />
    );
  }

  return (
    <div className="card shadow-sm sec-sesiones-shell" style={{ backgroundColor: "#fff" }}>
      <div className="card-body p-0">
        <div className="inv-prod-header sec-sesiones-header">
          <div className="inv-prod-title-wrap">
            <div className="inv-prod-title-row">
              <i className="bi bi-people inv-prod-title-icon" />
              <span className="inv-prod-title">USUARIOS</span>
            </div>
            <div className="inv-prod-subtitle">Listado global para auditoria y control</div>
          </div>

          <div className="inv-prod-header-actions sec-audit-header-actions">
            <span className="sec-audit-chip">
              <i className="bi bi-person-lines-fill" />
              TOTAL: {total}
            </span>
          </div>
        </div>

        <div className="inv-prod-body p-3 sec-sesiones-body">
          <div className="row g-2 align-items-end mb-3">
            <div className="col-md-6">
              <label className="form-label">Buscar</label>
              <input
                className="form-control"
                placeholder="usuario, nombre, apellido o rol..."
                value={filters.buscar}
                onChange={(e) => setFilters((s) => ({ ...s, buscar: e.target.value }))}
              />
            </div>

            <div className="col-md-3">
              <label className="form-label">Estado</label>
              <select
                className="form-select"
                value={filters.estado}
                onChange={(e) => setFilters((s) => ({ ...s, estado: e.target.value }))}
              >
                <option value="">Todos</option>
                <option value="activo">Activos</option>
                <option value="bloqueado">Bloqueados</option>
              </select>
            </div>

            <div className="col-md-3 d-flex gap-2">
              <button className="btn btn-primary w-100" onClick={onApplyFilters}>
                Aplicar
              </button>
              <button className="btn btn-outline-secondary w-100" onClick={onClear}>
                Limpiar
              </button>
            </div>
          </div>

          {loading && <InlineLoader />}
          {error && <div className="alert alert-danger">{error}</div>}

          {!loading && !error && (
            <>
              <div className="inv-prod-results-meta sec-sesiones-results-meta">
                <span>Mostrando {shownCount} de {total}</span>
                <span className="text-muted">Paginacion de 10 en 10</span>
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
                        <th>Ultimo acceso</th>
                        <th style={{ width: 140 }}>Sesiones activas</th>
                        {canViewAudit ? <th className="text-end">Auditoria</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={canViewAudit ? "8" : "7"} className="text-center text-muted py-4">
                            No hay registros.
                          </td>
                        </tr>
                      )}

                      {rows.map((r) => {
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
                                  className="btn btn-sm btn-outline-secondary sec-audit-table-btn"
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

              <div className="d-flex justify-content-between align-items-center mt-3">
                <small className="text-muted">
                  Mostrando {shownCount} de {total}
                </small>

                <div className="btn-group">
                  <button
                    className="btn btn-outline-secondary"
                    disabled={!canPrev}
                    onClick={() =>
                      setFilters((s) => ({
                        ...s,
                        offset: Math.max(0, s.offset - s.limit)
                      }))
                    }
                  >
                    Anterior
                  </button>
                  <button
                    className="btn btn-outline-secondary"
                    disabled={!canNext}
                    onClick={() =>
                      setFilters((s) => ({
                        ...s,
                        offset: s.offset + s.limit
                      }))
                    }
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

export default UsuariosTab;
