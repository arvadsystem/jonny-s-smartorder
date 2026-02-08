import { useEffect, useState } from "react";
import { perfilService } from "../../services/perfilService";

const Perfil = () => {
  const [data, setData] = useState(null);
  const [roles, setRoles] = useState([]);
  const [ultimo, setUltimo] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Form editar perfil (solo campos permitidos por tu backend)
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
                    onChange={(e) => setForm((s) => ({ ...s, nombre: e.target.value }))}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Apellido</label>
                  <input
                    className="form-control"
                    value={form.apellido}
                    onChange={(e) => setForm((s) => ({ ...s, apellido: e.target.value }))}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Teléfono</label>
                  <input
                    className="form-control"
                    value={form.telefono}
                    onChange={(e) => setForm((s) => ({ ...s, telefono: e.target.value }))}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Email</label>
                  <input
                    className="form-control"
                    value={form.email}
                    onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                  />
                </div>

                <div className="col-12">
                  <label className="form-label">Dirección</label>
                  <input
                    className="form-control"
                    value={form.direccion}
                    onChange={(e) => setForm((s) => ({ ...s, direccion: e.target.value }))}
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

              <label className="form-label">Contraseña actual</label>
              <input
                type="password"
                className="form-control mb-2"
                value={pw.actual}
                onChange={(e) => setPw((s) => ({ ...s, actual: e.target.value }))}
              />

              <label className="form-label">Nueva contraseña</label>
              <input
                type="password"
                className="form-control mb-2"
                value={pw.nueva}
                onChange={(e) => setPw((s) => ({ ...s, nueva: e.target.value }))}
              />

              <label className="form-label">Confirmación</label>
              <input
                type="password"
                className="form-control mb-3"
                value={pw.confirmacion}
                onChange={(e) => setPw((s) => ({ ...s, confirmacion: e.target.value }))}
              />

              <button className="btn btn-outline-dark w-100" onClick={onChangePassword}>
                Actualizar contraseña
              </button>
            </div>
          </div>

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