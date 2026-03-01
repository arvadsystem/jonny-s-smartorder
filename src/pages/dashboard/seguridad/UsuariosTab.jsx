import { useEffect, useState } from "react";
import InlineLoader from "../../../components/common/InlineLoader";
import SinPermiso from "../../../components/common/SinPermiso";
import { securityService } from "../../../services/securityService";
import { fmtHN } from "../../../utils/dateTime";
import { useAuth } from "../../../hooks/useAuth";

const PAGE_SIZE = 10;

// ✅ Honduras: backend manda ISO con Z
const fmtDate = (value) => (value ? fmtHN(value) : "—");

const estadoBadge = (estado) => {
  if (estado === true) return <span className="badge bg-success">Activo</span>;
  if (estado === false) return <span className="badge bg-danger">Bloqueado</span>;
  return <span className="badge bg-secondary">—</span>;
};

const UsuariosTab = () => {
  const { user } = useAuth();
  const isSuperAdmin = Number(user?.rol) === 1;

  const [loading, setLoading] = useState(true);
  const [noPermiso, setNoPermiso] = useState(false);
  const [error, setError] = useState("");

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);

  const [filters, setFilters] = useState({
    buscar: "",
    estado: "", // "" | activo | bloqueado
    limit: PAGE_SIZE,
    offset: 0,
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
      qs.set("_ts", String(Date.now())); // cache-bust

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

  // Carga inicial + recarga al cambiar paginación
  useEffect(() => {
    if (!isSuperAdmin) {
      setNoPermiso(true);
      setLoading(false);
      return;
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.offset, filters.limit, isSuperAdmin]);

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

  // ✅ contador acumulado: 10/107, 20/107, ...
  const shownCount = Math.min(filters.offset + rows.length, total);

  if (noPermiso) {
    return (
      <SinPermiso
        permiso="SEGURIDAD_VER"
        detalle="Solo Super Admin puede ver el listado global de usuarios (HU1085)."
      />
    );
  }

  return (
    <div className="card shadow-sm" style={{ backgroundColor: "#fff" }}>
      <div className="card-body">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
          <div>
            <h5 className="mb-0">Usuarios (global)</h5>
            <small className="text-muted">
              Listado completo de usuarios para auditoría y administración.
            </small>
          </div>
          <span className="badge text-bg-light border">{total} usuarios</span>
        </div>

        {/* Filtros */}
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
            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>ID</th>
                    <th>Usuario</th>
                    <th>Nombre</th>
                    <th>Rol</th>
                    <th style={{ width: 120 }}>Estado</th>
                    <th>Último acceso</th>
                    <th style={{ width: 140 }}>Sesiones activas</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan="7" className="text-center text-muted py-4">
                        No hay registros.
                      </td>
                    </tr>
                  )}

                  {rows.map((r) => {
                    const nombre = `${r?.nombre || ""} ${r?.apellido || ""}`.trim() || "—";
                    return (
                      <tr key={r.id_usuario}>
                        <td className="text-muted">{r.id_usuario}</td>
                        <td>{r.nombre_usuario || "—"}</td>
                        <td>{nombre}</td>
                        <td>{r.rol || "—"}</td>
                        <td>{estadoBadge(r.estado)}</td>
                        <td>{fmtDate(r.ultimo_acceso)}</td>
                        <td>
                          <span className="badge bg-primary">{Number(r.sesiones_activas || 0)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            <div className="d-flex justify-content-between align-items-center">
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
                      offset: Math.max(0, s.offset - s.limit),
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
                      offset: s.offset + s.limit,
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
  );
};

export default UsuariosTab;