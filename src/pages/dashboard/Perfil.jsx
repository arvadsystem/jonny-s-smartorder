import { useEffect, useState } from "react";
import { perfilService } from "../../services/perfilService";
import usePasswordPolicies from "../../hooks/usePasswordPolicies";
import { validatePassword } from "../../utils/passwordValidator";

const Perfil = () => {
  const [data, setData] = useState(null);
  const [roles, setRoles] = useState([]);
  const [ultimo, setUltimo] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Form editar perfil
  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    telefono: "",
    email: "",
    direccion: "",
  });

  // Cambio de contraseña
  const [pw, setPw] = useState({
    actual: "",
    nueva: "",
    confirmacion: "",
  });

  // ✅ Toggle mostrar/ocultar password
  const [showPw, setShowPw] = useState({
    actual: false,
    nueva: false,
    confirmacion: false,
  });

  const { policies, loading: loadingPolicies, error: policiesError } = usePasswordPolicies();

  const passwordCheck = validatePassword(pw.nueva || "", policies || {});
  const confirmOk = pw.nueva.length > 0 && pw.nueva === pw.confirmacion;

  const canChangePassword =
    !loadingPolicies &&
    !policiesError &&
    pw.actual.length > 0 &&
    passwordCheck.allOk &&
    confirmOk;

  const cargar = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await perfilService.getPerfil();
      setData(res?.perfil || null);
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

  const onSavePerfil = async () => {
    try {
      await perfilService.updatePerfil(form);
      alert("Perfil actualizado.");
      await cargar();
    } catch (e) {
      alert(e?.message || "No se pudo actualizar el perfil");
    }
  };

  const onChangePassword = async () => {
    if (pw.nueva !== pw.confirmacion) {
      alert("La nueva contraseña y la confirmación no coinciden.");
      return;
    }

    try {
      await perfilService.changePassword({
        password_actual: pw.actual,
        password_nueva: pw.nueva,
      });

      alert("Contraseña actualizada.");
      setPw({ actual: "", nueva: "", confirmacion: "" });
      setShowPw({ actual: false, nueva: false, confirmacion: false });
    } catch (e) {
      alert(e?.message || "No se pudo cambiar la contraseña");
    }
  };

  if (loading) return <div className="p-4 text-muted">Cargando...</div>;
  if (error) return <div className="p-4 alert alert-danger">{error}</div>;

  return (
    <div className="p-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h3 className="mb-0">Mi perfil</h3>
          <small className="text-muted">Administra tu información y seguridad</small>
        </div>
      </div>

      <div className="row g-3">
        {/* Datos */}
        <div className="col-lg-7">
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

        {/* Seguridad */}
        <div className="col-lg-5">
          <div className="card shadow-sm mb-3">
            <div className="card-body">
              <h5 className="mb-3">Cambiar contraseña</h5>

              {loadingPolicies && (
                <div className="text-muted mb-2">
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Cargando políticas...
                </div>
              )}

              {policiesError && (
                <div className="alert alert-warning">
                  No se pudieron cargar las políticas de contraseña. Aún puedes intentar cambiarla,
                  pero no habrá validación en vivo.
                </div>
              )}

              {/* Contraseña actual */}
              <label className="form-label">Contraseña actual</label>
              <div className="input-group mb-2">
                <input
                  type={showPw.actual ? "text" : "password"}
                  className="form-control"
                  value={pw.actual}
                  onChange={(e) =>
                    setPw((s) => ({ ...s, actual: e.target.value }))
                  }
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setShowPw((s) => ({ ...s, actual: !s.actual }))}
                  title={showPw.actual ? "Ocultar" : "Mostrar"}
                >
                  <i className={`bi ${showPw.actual ? "bi-eye-slash" : "bi-eye"}`}></i>
                </button>
              </div>

              {/* Nueva contraseña */}
              <label className="form-label">Nueva contraseña</label>
              <div className="input-group mb-2">
                <input
                  type={showPw.nueva ? "text" : "password"}
                  className="form-control"
                  value={pw.nueva}
                  onChange={(e) =>
                    setPw((s) => ({ ...s, nueva: e.target.value }))
                  }
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setShowPw((s) => ({ ...s, nueva: !s.nueva }))}
                  title={showPw.nueva ? "Ocultar" : "Mostrar"}
                >
                  <i className={`bi ${showPw.nueva ? "bi-eye-slash" : "bi-eye"}`}></i>
                </button>
              </div>

              {/* Checklist */}
              <div className="border rounded p-2 mb-2">
                <div className="small fw-semibold mb-1">Debe cumplir:</div>
                <ul className="list-unstyled mb-0 small">
                  {passwordCheck.rules.map((r) => (
                    <li key={r.key} className={r.ok ? "text-success" : "text-danger"}>
                      <i className={`bi ${r.ok ? "bi-check-circle" : "bi-x-circle"} me-2`}></i>
                      {r.label}
                    </li>
                  ))}
                  <li className={confirmOk ? "text-success" : "text-danger"}>
                    <i className={`bi ${confirmOk ? "bi-check-circle" : "bi-x-circle"} me-2`}></i>
                    Confirmación coincide
                  </li>
                </ul>
              </div>

              {/* Confirmación */}
              <label className="form-label">Confirmación</label>
              <div className="input-group mb-3">
                <input
                  type={showPw.confirmacion ? "text" : "password"}
                  className="form-control"
                  value={pw.confirmacion}
                  onChange={(e) =>
                    setPw((s) => ({ ...s, confirmacion: e.target.value }))
                  }
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() =>
                    setShowPw((s) => ({ ...s, confirmacion: !s.confirmacion }))
                  }
                  title={showPw.confirmacion ? "Ocultar" : "Mostrar"}
                >
                  <i className={`bi ${showPw.confirmacion ? "bi-eye-slash" : "bi-eye"}`}></i>
                </button>
              </div>

              <button
                className="btn btn-outline-dark w-100"
                onClick={onChangePassword}
                disabled={!canChangePassword}
                title={
                  !canChangePassword
                    ? "Completa y cumple las políticas para habilitar"
                    : "Cambiar contraseña"
                }
              >
                Actualizar contraseña
              </button>

              {!confirmOk && pw.confirmacion.length > 0 && (
                <div className="small text-danger mt-2">
                  La confirmación no coincide.
                </div>
              )}
            </div>
          </div>

          {/* Roles + último acceso */}
          <div className="card shadow-sm">
            <div className="card-body">
              <h6 className="text-muted mb-2">Roles</h6>
              <div className="d-flex flex-wrap gap-2 mb-3">
                {roles.map((r) => (
                  <span className="badge bg-secondary" key={r.id_rol}>
                    {r.nombre}
                  </span>
                ))}
                {roles.length === 0 && <span className="text-muted">—</span>}
              </div>

              <h6 className="text-muted mb-2">Último acceso</h6>
              {ultimo ? (
                <ul className="list-unstyled mb-0 small">
                  <li><b>Fecha:</b> {new Date(ultimo.fecha_hora).toLocaleString()}</li>
                  <li><b>IP:</b> {ultimo.ip_origen || "—"}</li>
                  <li><b>Navegador:</b> {ultimo.navegador || "—"}</li>
                  <li><b>SO:</b> {ultimo.sistema_operativo || "—"}</li>
                  <li><b>Dispositivo:</b> {ultimo.dispositivo || "—"}</li>
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
