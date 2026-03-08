import { useEffect, useState } from "react";
import { perfilService } from "../../services/perfilService";
import { fmtHN } from "../../utils/dateTime";
import "./perfil-toast.css";

const Perfil = () => {
  const [roles, setRoles] = useState([]);
  const [ultimo, setUltimo] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

  // Form editar perfil
  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    telefono: "",
    email: "",
    direccion: "",
  });

  const cargar = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await perfilService.getPerfil();
      setRoles(res?.roles || []);
      setUltimo(res?.ultimo_acceso || null);

      const p = res?.perfil || {};
      setForm({
        nombre: p.nombre || "",
        apellido: p.apellido || "",
        telefono: p.telefono || "",
        email: p.email || "",
        direccion: p.direccion || "",
      });
    } catch (e) {
      setError(e?.message || "Error cargando perfil");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    if (!showSaveConfirm) return undefined;
    const timer = setTimeout(() => setShowSaveConfirm(false), 3200);
    return () => clearTimeout(timer);
  }, [showSaveConfirm]);

  const onSavePerfil = async () => {
    try {
      await perfilService.updatePerfil(form);
      setShowSaveConfirm(true);
      await cargar();
    } catch (e) {
      alert(e?.message || "No se pudo actualizar el perfil");
    }
  };

  if (loading) return <div className="p-4 text-muted">Cargando...</div>;
  if (error) return <div className="p-4 alert alert-danger">{error}</div>;

  return (
    <div className="p-4">
      {showSaveConfirm && (
        <div className="perfil-save-toast" role="status" aria-live="polite">
          <div className="perfil-save-toast__body">
            <div className="perfil-save-toast__icon" aria-hidden="true">
              <i className="bi bi-check-circle-fill" />
            </div>
            <div className="perfil-save-toast__copy">
              <div className="perfil-save-toast__title">ACTUALIZADO</div>
              <div className="perfil-save-toast__subtitle">Perfil actualizado correctamente</div>
            </div>
            <button
              type="button"
              className="perfil-save-toast__close"
              onClick={() => setShowSaveConfirm(false)}
              aria-label="Cerrar"
            >
              <i className="bi bi-x-lg" />
            </button>
          </div>
        </div>
      )}

      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h3 className="mb-0">Mi perfil</h3>
          <small className="text-muted">Administra tu información</small>
        </div>
      </div>

      <div className="row g-3">
        {/* Datos */}
        <div className="col-lg-8">
          <div className="card shadow-sm">
            <div className="card-body">
              <h5 className="mb-3">Información personal</h5>

              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Nombre</label>
                  <input
                    className="form-control"
                    value={form.nombre}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, nombre: e.target.value }))
                    }
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Apellido</label>
                  <input
                    className="form-control"
                    value={form.apellido}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, apellido: e.target.value }))
                    }
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Teléfono</label>
                  <input
                    className="form-control"
                    value={form.telefono}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, telefono: e.target.value }))
                    }
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Email</label>
                  <input
                    className="form-control"
                    value={form.email}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, email: e.target.value }))
                    }
                  />
                </div>

                <div className="col-12">
                  <label className="form-label">Dirección</label>
                  <input
                    className="form-control"
                    value={form.direccion}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, direccion: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="d-flex justify-content-end mt-3">
                <button className="btn btn-primary" onClick={onSavePerfil}>
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <h6 className="text-muted mb-2">Roles</h6>
              <div className="d-flex flex-wrap gap-2">
                {roles.map((r) => (
                  <span className="badge bg-secondary" key={r.id_rol}>
                    {r.nombre}
                  </span>
                ))}
                {roles.length === 0 && <span className="text-muted">Sin roles asignados.</span>}
              </div>

              <h6 className="text-muted mt-4 mb-2">Último acceso</h6>
              {ultimo ? (
                <ul className="list-unstyled mb-0 small">
                  <li><b>Fecha:</b> {fmtHN(ultimo.fecha_hora)}</li>
                  <li><b>IP:</b> {ultimo.ip_origen || "-"}</li>
                  <li><b>Navegador:</b> {ultimo.navegador || "-"}</li>
                  <li><b>SO:</b> {ultimo.sistema_operativo || "-"}</li>
                  <li><b>Dispositivo:</b> {ultimo.dispositivo || "-"}</li>
                </ul>
              ) : (
                <div className="text-muted small">No hay registros de acceso aún.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Perfil;
