import { useEffect, useState } from "react";
import { securityService } from "../../../services/securityService";
import SinPermiso from "../../../components/common/SinPermiso";
import InlineLoader from "../../../components/common/InlineLoader";
import { usePermisos } from "../../../context/PermisosContext";
import { PERMISSIONS } from "../../../utils/permissions";

const PasswordPolicyTab = () => {
  const { canAny } = usePermisos();
  const canEditPolicy = canAny([PERMISSIONS.SEGURIDAD_CONFIG_EDITAR]);

  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noPermiso, setNoPermiso] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    password_min_length: "8",
    password_require_upper: "false",
    password_require_number: "false",
    password_require_symbol: "false"
  });

  const cargar = async () => {
    setLoading(true);
    setError("");
    setNoPermiso(false);

    try {
      const data = await securityService.getPasswordPolicies();
      const rows = data?.policies || [];
      setPolicies(rows);

      const map = Object.fromEntries(rows.map((r) => [r.clave, r.valor]));
      setForm((prev) => ({ ...prev, ...map }));
    } catch (e) {
      if (e?.status === 403) setNoPermiso(true);
      else setError(e?.message || "Error cargando politicas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const onChange = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const onGuardar = async () => {
    if (!canEditPolicy) return;

    const min = Number(form.password_min_length);
    if (!Number.isFinite(min) || min < 6 || min > 64) {
      alert("La longitud minima debe estar entre 6 y 64.");
      return;
    }

    setSaving(true);
    try {
      await securityService.updatePasswordPolicies(form);
      alert("Politicas actualizadas.");
      await cargar();
    } catch (e) {
      alert(e?.message || "No se pudieron actualizar las politicas");
    } finally {
      setSaving(false);
    }
  };

  if (noPermiso) return <SinPermiso permiso="SEGURIDAD_VER" />;

  return (
    <div className="card shadow-sm" style={{ backgroundColor: "#fff" }}>
      <div className="card-body">
        <div className="d-flex align-items-start justify-content-between gap-2">
          <div>
            <h5 className="mb-0">Politicas de contrasena</h5>
            <small className="text-muted">
              Estas reglas se aplican al cambio de contrasena.
            </small>
          </div>
          <button className="btn btn-primary" onClick={onGuardar} disabled={saving || loading || !canEditPolicy}>
            {saving ? (
              <>
                <span className="spinner-border spinner-border-sm me-2"></span>
                Guardando...
              </>
            ) : (
              "Guardar"
            )}
          </button>
        </div>

        <hr />

        {loading && <InlineLoader />}
        {error && <div className="alert alert-danger">{error}</div>}

        {!loading && !error && (
          <>
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label">Longitud minima</label>
                <input
                  className="form-control"
                  type="number"
                  min="6"
                  max="64"
                  value={form.password_min_length}
                  onChange={(e) => onChange("password_min_length", e.target.value)}
                  disabled={!canEditPolicy}
                />
                <div className="form-text">Recomendado: 8 a 12.</div>
              </div>

              <div className="col-md-4">
                <label className="form-label">Requiere mayuscula</label>
                <select
                  className="form-select"
                  value={String(form.password_require_upper)}
                  onChange={(e) => onChange("password_require_upper", e.target.value)}
                  disabled={!canEditPolicy}
                >
                  <option value="false">No</option>
                  <option value="true">Si</option>
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label">Requiere numero</label>
                <select
                  className="form-select"
                  value={String(form.password_require_number)}
                  onChange={(e) => onChange("password_require_number", e.target.value)}
                  disabled={!canEditPolicy}
                >
                  <option value="false">No</option>
                  <option value="true">Si</option>
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label">Requiere simbolo</label>
                <select
                  className="form-select"
                  value={String(form.password_require_symbol)}
                  onChange={(e) => onChange("password_require_symbol", e.target.value)}
                  disabled={!canEditPolicy}
                >
                  <option value="false">No</option>
                  <option value="true">Si</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <h6 className="text-muted mb-2">Valores actuales (BD)</h6>
              <div className="table-responsive">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Clave</th>
                      <th>Valor</th>
                      <th>Descripcion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {policies.map((p) => (
                      <tr key={p.clave}>
                        <td>{p.clave}</td>
                        <td>{String(p.valor)}</td>
                        <td>{p.descripcion || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PasswordPolicyTab;
