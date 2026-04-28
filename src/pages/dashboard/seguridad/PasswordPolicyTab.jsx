import { useEffect, useState } from "react";
import { securityService } from "../../../services/securityService";
import SinPermiso from "../../../components/common/SinPermiso";
import InlineLoader from "../../../components/common/InlineLoader";
import { usePermisos } from "../../../context/PermisosContext";
import { PERMISSIONS } from "../../../utils/permissions";
import "./sesiones-ui.css";
import "./seguridad-auditoria-ui.css";

const ToastNotice = ({ alert, onClose }) => {
  if (!alert?.visible) return null;

  return (
    <div className="inv-toast-wrap" role="status" aria-live="polite">
      <article className={`inv-toast-card ${alert.variant || "info"}`.trim()}>
        <div className="inv-toast-icon" aria-hidden="true">
          <i className={`bi ${alert.icono}`} />
        </div>

        <div className="inv-toast-content">
          <div className="inv-toast-title">{alert.titulo}</div>
          <div className="inv-toast-message">{alert.mensaje}</div>
        </div>

        <button type="button" className="inv-toast-close" onClick={onClose} aria-label="Cerrar">
          <i className="bi bi-x-lg" />
        </button>

        <div className="inv-toast-progress" aria-hidden="true" />
      </article>
    </div>
  );
};

const PasswordPolicyTab = () => {
  const { canAny } = usePermisos();
  const canEditPolicy = canAny([PERMISSIONS.SEGURIDAD_CONFIG_EDITAR]);

  const [loading, setLoading] = useState(true);
  const [noPermiso, setNoPermiso] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [alerta, setAlerta] = useState({
    visible: false,
    titulo: "AVISO",
    mensaje: "",
    icono: "bi-exclamation-triangle-fill",
    variant: "info",
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

    const timer = setTimeout(() => setAlerta((prev) => ({ ...prev, visible: false })), 3200);
    return () => clearTimeout(timer);
  }, [alerta.visible]);

  const mostrarAlerta = (
    mensaje,
    { titulo = "AVISO", icono = "bi-exclamation-triangle-fill", variant = "info" } = {}
  ) => {
    setAlerta({ visible: true, titulo, mensaje, icono, variant });
  };

  const onChange = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const onGuardar = async () => {
    if (!canEditPolicy) return;

    const min = Number(form.password_min_length);
    if (!Number.isFinite(min) || min < 6 || min > 64) {
      mostrarAlerta("La longitud mínima debe estar entre 6 y 64.", {
        titulo: "VALIDACIÓN",
        icono: "bi-exclamation-circle-fill",
        variant: "warning",
      });
      return;
    }

    setSaving(true);
    try {
      await securityService.updatePasswordPolicies(form);
      mostrarAlerta("Políticas actualizadas correctamente.", {
        titulo: "ACTUALIZADO",
        icono: "bi-check-circle-fill",
        variant: "success",
      });
      await cargar();
    } catch (e) {
      mostrarAlerta(e?.message || "No se pudieron actualizar las políticas", {
        titulo: "ERROR",
        icono: "bi-x-octagon-fill",
        variant: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  if (noPermiso) return <SinPermiso permiso="SEGURIDAD_VER" />;

  return (
    <>
      <ToastNotice alert={alerta} onClose={() => setAlerta((prev) => ({ ...prev, visible: false }))} />

      <div className="card shadow-sm sec-sesiones-shell" style={{ backgroundColor: "#fff" }}>
        <div className="card-body p-0">
          <div className="sec-panel-header">
            <div className="sec-panel-title-wrap">
              <div className="sec-panel-title-row">
                <i className="bi bi-key sec-panel-title-icon" />
                <span className="sec-panel-title">Políticas de contraseña</span>
              </div>
              <div className="sec-panel-subtitle">
                Estas reglas se aplican a las contraseñas al momento de realizar el cambio.
              </div>
            </div>

            <div className="sec-panel-header-actions">
              <button
                className="btn inv-prod-toolbar-btn sec-btn-primary sec-sesiones-global-btn"
                onClick={onGuardar}
                disabled={saving || loading || !canEditPolicy}
              >
                {saving ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
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
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label sec-audit-filter-label">Longitud mínima</label>
                  <input
                    className="form-control sec-audit-filter-control"
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
                  <label className="form-label sec-audit-filter-label">Requiere mayúscula</label>
                  <select
                    className="form-select sec-audit-filter-control"
                    value={String(form.password_require_upper)}
                    onChange={(e) => onChange("password_require_upper", e.target.value)}
                    disabled={!canEditPolicy}
                  >
                    <option value="false">No</option>
                    <option value="true">Sí</option>
                  </select>
                </div>

                <div className="col-md-4">
                  <label className="form-label sec-audit-filter-label">Requiere número</label>
                  <select
                    className="form-select sec-audit-filter-control"
                    value={String(form.password_require_number)}
                    onChange={(e) => onChange("password_require_number", e.target.value)}
                    disabled={!canEditPolicy}
                  >
                    <option value="false">No</option>
                    <option value="true">Sí</option>
                  </select>
                </div>

                <div className="col-md-4">
                  <label className="form-label sec-audit-filter-label">Requiere símbolo</label>
                  <select
                    className="form-select sec-audit-filter-control"
                    value={String(form.password_require_symbol)}
                    onChange={(e) => onChange("password_require_symbol", e.target.value)}
                    disabled={!canEditPolicy}
                  >
                    <option value="false">No</option>
                    <option value="true">Sí</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default PasswordPolicyTab;
