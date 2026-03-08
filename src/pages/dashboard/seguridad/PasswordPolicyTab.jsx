import { useEffect, useState } from "react";
import { securityService } from "../../../services/securityService";
import SinPermiso from "../../../components/common/SinPermiso";
import InlineLoader from "../../../components/common/InlineLoader";
import "../perfil-toast.css";
import "./sesiones-ui.css";

const PasswordPolicyTab = () => {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noPermiso, setNoPermiso] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [alerta, setAlerta] = useState({
    visible: false,
    titulo: "AVISO",
    mensaje: "",
    icono: "bi-exclamation-triangle-fill",
  });

  const [form, setForm] = useState({
    password_min_length: "8",
    password_require_upper: "false",
    password_require_number: "false",
    password_require_symbol: "false",
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
      else setError(e?.message || "Error cargando políticas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    if (!alerta.visible) return undefined;
    const timer = setTimeout(
      () => setAlerta((prev) => ({ ...prev, visible: false })),
      3200
    );
    return () => clearTimeout(timer);
  }, [alerta.visible]);

  const mostrarAlerta = (
    mensaje,
    { titulo = "AVISO", icono = "bi-exclamation-triangle-fill" } = {}
  ) => {
    setAlerta({ visible: true, titulo, mensaje, icono });
  };

  const onChange = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const onGuardar = async () => {
    // Validacion minima
    const min = Number(form.password_min_length);
    if (!Number.isFinite(min) || min < 6 || min > 64) {
      mostrarAlerta("La longitud mínima debe estar entre 6 y 64.");
      return;
    }

    setSaving(true);
    try {
      await securityService.updatePasswordPolicies(form);
      mostrarAlerta("Políticas actualizadas.", {
        titulo: "ACTUALIZADO",
        icono: "bi-check-circle-fill",
      });
      await cargar();
    } catch (e) {
      mostrarAlerta(e?.message || "No se pudieron actualizar las políticas");
    } finally {
      setSaving(false);
    }
  };

  if (noPermiso) return <SinPermiso permiso="SEGURIDAD_VER" />;

  return (
    <>
      {alerta.visible && (
        <div className="perfil-save-toast" role="status" aria-live="polite">
          <div className="perfil-save-toast__body">
            <div className="perfil-save-toast__icon" aria-hidden="true">
              <i className={`bi ${alerta.icono}`} />
            </div>
            <div className="perfil-save-toast__copy">
              <div className="perfil-save-toast__title">{alerta.titulo}</div>
              <div className="perfil-save-toast__subtitle">{alerta.mensaje}</div>
            </div>
            <button
              type="button"
              className="perfil-save-toast__close"
              onClick={() => setAlerta((prev) => ({ ...prev, visible: false }))}
              aria-label="Cerrar"
            >
              <i className="bi bi-x-lg" />
            </button>
          </div>
        </div>
      )}

      <div className="card shadow-sm sec-sesiones-shell" style={{ backgroundColor: "#fff" }}>
      <div className="card-body p-0">
        <div className="sec-panel-header">
          <div className="sec-panel-title-wrap">
            <div className="sec-panel-title-row">
              <i className="bi bi-key sec-panel-title-icon" />
              <span className="sec-panel-title">POLÍTICAS DE CONTRASEÑA</span>
            </div>
            <div className="sec-panel-subtitle">
              Estas reglas se aplican a las contraseñas al momento de realizar el cambio.
            </div>
          </div>

          <div className="sec-panel-header-actions">
            <button className="btn btn-primary" onClick={onGuardar} disabled={saving || loading}>
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
        </div>

        <div className="sec-panel-body p-3 sec-sesiones-body">
          {loading && <InlineLoader />}
          {error && <div className="alert alert-danger">{error}</div>}

          {!loading && !error && (
            <>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Longitud mínima</label>
                  <input
                    className="form-control"
                    type="number"
                    min="6"
                    max="64"
                    value={form.password_min_length}
                    onChange={(e) => onChange("password_min_length", e.target.value)}
                  />
                  <div className="form-text">Recomendado: 8 a 12.</div>
                </div>

                <div className="col-md-4">
                  <label className="form-label">Requiere mayúscula</label>
                  <select
                    className="form-select"
                    value={String(form.password_require_upper)}
                    onChange={(e) => onChange("password_require_upper", e.target.value)}
                  >
                    <option value="false">No</option>
                    <option value="true">Sí</option>
                  </select>
                </div>

                <div className="col-md-4">
                  <label className="form-label">Requiere número</label>
                  <select
                    className="form-select"
                    value={String(form.password_require_number)}
                    onChange={(e) => onChange("password_require_number", e.target.value)}
                  >
                    <option value="false">No</option>
                    <option value="true">Sí</option>
                  </select>
                </div>

                <div className="col-md-4">
                  <label className="form-label">Requiere símbolo</label>
                  <select
                    className="form-select"
                    value={String(form.password_require_symbol)}
                    onChange={(e) => onChange("password_require_symbol", e.target.value)}
                  >
                    <option value="false">No</option>
                    <option value="true">Sí</option>
                  </select>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      </div>
    </>
  );
};

export default PasswordPolicyTab;

