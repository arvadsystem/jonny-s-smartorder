import { useEffect, useMemo, useState } from "react";
import { securityService } from "../../../services/securityService";
import SinPermiso from "../../../components/common/SinPermiso";
import InlineLoader from "../../../components/common/InlineLoader";
import ConfirmButton from "../../../components/common/ConfirmButton";

const fmtDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleString();
};

const SesionesTab = () => {
  const [sesiones, setSesiones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noPermiso, setNoPermiso] = useState(false);
  const [error, setError] = useState("");

  // Estado para acciones por fila
  const [closingId, setClosingId] = useState(null);
  const [closingOtras, setClosingOtras] = useState(false);

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

  // ✅ Fallback para "sesión actual": asumimos que la activa con última actividad más reciente es la actual
  const currentSessionId = useMemo(() => {
    const act = sesionesActivas.slice();
    act.sort((a, b) => new Date(b.ultima_actividad) - new Date(a.ultima_actividad));
    return act[0]?.id_sesion ?? null;
  }, [sesionesActivas]);

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
              Puedes cerrar sesiones remotamente. Si cierras la sesión actual, el backend la bloqueará en la siguiente petición.
            </small>
          </div>

          <ConfirmButton
            className="btn btn-outline-danger"
            confirmText="¿Cerrar todas las otras sesiones?"
            onConfirm={onCerrarOtras}
            disabled={sesionesActivas.length <= 1 || closingOtras}
            title="Cierra todas excepto la sesión actual"
          >
            {closingOtras ? (
              <>
                <span className="spinner-border spinner-border-sm me-2"></span>
                Cerrando...
              </>
            ) : (
              <>
                <i className="bi bi-x-circle me-2"></i>
                Cerrar otras
              </>
            )}
          </ConfirmButton>
        </div>

        {loading && <InlineLoader />}
        {error && <div className="alert alert-danger">{error}</div>}

        {!loading && !error && (
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
                {sesiones.length === 0 && (
                  <tr>
                    <td colSpan="8" className="text-center text-muted py-4">
                      No hay sesiones registradas.
                    </td>
                  </tr>
                )}

                {sesiones.map((s) => {
                  const esActual = s.activa && s.id_sesion === currentSessionId;

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
                          disabled={!s.activa || closingId === s.id_sesion || esActual} // 🔒 evitamos cerrar la actual por UI
                          title={esActual ? "No puedes cerrar tu sesión actual desde aquí" : "Cerrar sesión"}
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

            <small className="text-muted">
            </small>
          </div>
        )}
      </div>
    </div>
  );
};

export default SesionesTab;

