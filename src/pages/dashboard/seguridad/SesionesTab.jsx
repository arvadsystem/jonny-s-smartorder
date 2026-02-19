import { useEffect, useMemo, useState } from "react";
import { securityService } from "../../../services/securityService";
import SinPermiso from "../../../components/common/SinPermiso";
import InlineLoader from "../../../components/common/InlineLoader";
import ConfirmButton from "../../../components/common/ConfirmButton";
import { fmtHN } from "../../../utils/dateTime";
const PAGE_SIZE = 10;

const fmtDate = (value) => fmtHN(value);

const SesionesTab = () => {
  const [sesiones, setSesiones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noPermiso, setNoPermiso] = useState(false);
  const [error, setError] = useState("");

  const [closingId, setClosingId] = useState(null);
  const [closingOtras, setClosingOtras] = useState(false);

  const [page, setPage] = useState(1);

  const cargar = async () => {
    setLoading(true);
    setError("");
    setNoPermiso(false);

    try {
      const data = await securityService.getSesiones();
      setSesiones(data?.sesiones || []);
    } catch (e) {
      if (e?.status === 403) {
        setNoPermiso(true);
        return;
      }
      setError(e?.message || "Error cargando sesiones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const sesionesActivas = useMemo(
    () => sesiones.filter((s) => s.activa),
    [sesiones]
  );

  // ----------------------
  // PAGINACIÓN
  // ----------------------
  const totalPages = Math.max(1, Math.ceil(sesiones.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const paginated = sesiones.slice(start, start + PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [sesiones]);

  const onCerrar = async (id_sesion) => {
    setClosingId(id_sesion);
    try {
      await securityService.cerrarSesion(id_sesion);
      await cargar();
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
      await cargar();
    } catch (e) {
      alert(e?.message || "No se pudieron cerrar las otras sesiones");
    } finally {
      setClosingOtras(false);
    }
  };

  if (noPermiso) return <SinPermiso permiso="SEGURIDAD_VER" />;

  return (
    <div className="card shadow-sm">
      <div className="card-body">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
          <div>
            <h5 className="mb-0">Sesiones activas</h5>
            <small className="text-muted">
              Puedes cerrar sesiones remotamente.
            </small>
          </div>

          <ConfirmButton
            className="btn btn-outline-danger"
            confirmText="¿Cerrar todas las sesiones excepto la actual?"
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
          </ConfirmButton>
        </div>

        {loading && <InlineLoader />}
        {error && <div className="alert alert-danger">{error}</div>}

        {!loading && !error && (
          <>
            <div className="table-responsive">
              <table className="table table-hover align-middle">
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
                        No hay sesiones registradas.
                      </td>
                    </tr>
                  )}

                  {paginated.map((s) => {
                    const esActual = !!s.es_actual && s.activa;

                    return (
                      <tr key={s.id_sesion} className={esActual ? "table-success" : ""}>
                        <td>
                          {s.activa ? (
                            <span className="badge bg-success">
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
                          <ConfirmButton
                            className="btn btn-sm btn-outline-danger"
                            confirmText="¿Cerrar esta sesión?"
                            onConfirm={() => onCerrar(s.id_sesion)}
                            disabled={!s.activa || closingId === s.id_sesion || esActual}
                          >
                            {closingId === s.id_sesion ? (
                              <span className="spinner-border spinner-border-sm" />
                            ) : (
                              "Cerrar"
                            )}
                          </ConfirmButton>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* CONTROLES DE PAGINACIÓN */}
            <div className="d-flex justify-content-between align-items-center mt-2">
              <small className="text-muted">
                Mostrando {Math.min(page * PAGE_SIZE, sesiones.length)} de {sesiones.length}
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
  );
};

export default SesionesTab;