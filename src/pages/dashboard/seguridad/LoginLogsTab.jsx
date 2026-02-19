import { useEffect, useState } from "react";
import InlineLoader from "../../../components/common/InlineLoader";
import SinPermiso from "../../../components/common/SinPermiso";
import { apiFetch } from "../../../services/api";
import { fmtHN } from "../../../utils/dateTime";

const fmtDate = (value) => fmtHN(value);

const estadoBadge = (exito) => {
  if (exito === true) return <span className="badge bg-success">Éxito</span>;
  if (exito === false) return <span className="badge bg-danger">Fallido</span>;
  return <span className="badge bg-secondary">—</span>;
};

const LoginLogsTab = () => {
  const [loading, setLoading] = useState(true);
  const [noPermiso, setNoPermiso] = useState(false);
  const [error, setError] = useState("");

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);

  // filtros + paginación (simples)
  const [filters, setFilters] = useState({
    estado: "", // SUCCESS | FAIL | ""
    desde: "",
    hasta: "",
    usuario: "",
    limit: 10,
    offset: 0,
  });

  const load = async () => {
    setLoading(true);
    setError("");
    setNoPermiso(false);

    try {
      const qs = new URLSearchParams();
      if (filters.estado) qs.set("estado", filters.estado);
      if (filters.desde) qs.set("desde", filters.desde);
      if (filters.hasta) qs.set("hasta", filters.hasta);
      if (filters.usuario) qs.set("usuario", filters.usuario);
      qs.set("limit", String(filters.limit));
      qs.set("offset", String(filters.offset));

      // ✅ Endpoint backend HU78
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

  // recarga cuando cambie la paginación
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.offset, filters.limit]);

  const onApplyFilters = () => {
    // al aplicar filtros, reiniciamos a primera página
    setFilters((s) => ({ ...s, offset: 0 }));
    setTimeout(load, 0);
  };

  const onClear = () => {
    setFilters({ estado: "", desde: "", hasta: "", usuario: "", limit: 10, offset: 0 });
    setTimeout(load, 0);
  };

  const canPrev = filters.offset > 0;
  const canNext = filters.offset + filters.limit < total;

  if (noPermiso) return <SinPermiso permiso="SEGURIDAD_VER" detalle="Requiere permiso para ver logs de login (HU78)." />;

  return (
    <div className="card shadow-sm">
      <div className="card-body">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
          <div>
            <h5 className="mb-0">Logs de login</h5>
            <small className="text-muted">
              Historial de intentos de inicio de sesión (exitosos y fallidos).
            </small>
          </div>
        </div>

        {/* Filtros */}
        <div className="row g-2 align-items-end mb-3">
          <div className="col-md-3">
            <label className="form-label">Estado</label>
            <select
              className="form-select"
              value={filters.estado}
              onChange={(e) => setFilters((s) => ({ ...s, estado: e.target.value }))}
            >
              <option value="">Todos</option>
              <option value="SUCCESS">Exitosos</option>
              <option value="FAIL">Fallidos</option>
            </select>
          </div>

          <div className="col-md-3">
            <label className="form-label">Desde</label>
            <input
              type="date"
              className="form-control"
              value={filters.desde}
              onChange={(e) => setFilters((s) => ({ ...s, desde: e.target.value }))}
            />
          </div>

          <div className="col-md-3">
            <label className="form-label">Hasta</label>
            <input
              type="date"
              className="form-control"
              value={filters.hasta}
              onChange={(e) => setFilters((s) => ({ ...s, hasta: e.target.value }))}
            />
          </div>

          <div className="col-md-3">
            <label className="form-label">Usuario (opcional)</label>
            <input
              className="form-control"
              placeholder="admin, cajero..."
              value={filters.usuario}
              onChange={(e) => setFilters((s) => ({ ...s, usuario: e.target.value }))}
            />
          </div>

          <div className="col-12 d-flex gap-2">
            <button className="btn btn-primary" onClick={onApplyFilters}>
              Aplicar
            </button>
            <button className="btn btn-outline-secondary" onClick={onClear}>
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
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan="8" className="text-center text-muted py-4">
                        No hay registros.
                      </td>
                    </tr>
                  )}

                  {rows.map((r) => (
                    <tr key={r.id_login}>
                      <td>{fmtDate(r.fecha_hora)}</td>
                      <td>{r.usuario || r.nombre_usuario_intentado || "—"}</td>
                      <td>{estadoBadge(r.exito)}</td>
                      <td>{r.ip_origen || "—"}</td>
                      <td>{r.navegador || "—"}</td>
                      <td>{r.sistema_operativo || "—"}</td>
                      <td>{r.dispositivo || "—"}</td>
                      <td className="small text-muted">{r.mensaje_error || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            <div className="d-flex justify-content-between align-items-center">
              <small className="text-muted">
                Mostrando {rows.length} de {total}
              </small>

              <div className="btn-group">
                <button
                  className="btn btn-outline-secondary"
                  disabled={!canPrev}
                  onClick={() =>
                    setFilters((s) => ({ ...s, offset: Math.max(0, s.offset - s.limit) }))
                  }
                >
                  Anterior
                </button>
                <button
                  className="btn btn-outline-secondary"
                  disabled={!canNext}
                  onClick={() =>
                    setFilters((s) => ({ ...s, offset: s.offset + s.limit }))
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

export default LoginLogsTab;
