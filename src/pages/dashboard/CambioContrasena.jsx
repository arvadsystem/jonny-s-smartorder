import { useEffect, useState } from "react";
import { perfilService } from "../../services/perfilService";
import usePasswordPolicies from "../../hooks/usePasswordPolicies";
import { useAuth } from "../../hooks/useAuth";
import { validatePassword } from "../../utils/passwordValidator";
import SecurityConfirmAction from "./seguridad/components/SecurityConfirmAction";
import "./cambio-contrasena.css";
import "./seguridad/sesiones-ui.css";

const PASSWORD_CHANGE_DATE_CANDIDATE_PATHS = [
  "ultimo_cambio_clave",
  "fecha_ultimo_cambio_clave",
  "password_changed_at",
  "perfil.ultimo_cambio_clave",
  "perfil.fecha_ultimo_cambio_clave",
  "perfil.password_changed_at",
  "perfil.clave_actualizada_en",
  "perfil.fecha_cambio_clave",
  "perfil.fecha_actualizacion_clave",
];

const getNestedValue = (obj, path) =>
  path.split(".").reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);

const parseValidDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const resolveLastPasswordChangeDate = (payload) => {
  for (const path of PASSWORD_CHANGE_DATE_CANDIDATE_PATHS) {
    const candidate = parseValidDate(getNestedValue(payload, path));
    if (candidate) return candidate;
  }
  return null;
};

const getDaysSince = (dateValue) => {
  if (!(dateValue instanceof Date)) return null;
  const diff = Date.now() - dateValue.getTime();
  if (Number.isNaN(diff) || diff < 0) return 0;
  return Math.floor(diff / 86400000);
};

const CambioContrasena = () => {
  const { user } = useAuth();
  const [pw, setPw] = useState({
    actual: "",
    nueva: "",
    confirmacion: "",
  });

  const [showPw, setShowPw] = useState({
    actual: false,
    nueva: false,
    confirmacion: false,
  });
  const [alerta, setAlerta] = useState({
    visible: false,
    titulo: "AVISO",
    mensaje: "",
    icono: "bi-exclamation-triangle-fill",
    variant: "info",
  });
  const [lastPasswordChangeDays, setLastPasswordChangeDays] = useState(null);

  const { policies, loading: loadingPolicies, error: policiesError } = usePasswordPolicies();

  const passwordCheck = validatePassword(pw.nueva || "", policies || {});
  const confirmOk = pw.nueva.length > 0 && pw.nueva === pw.confirmacion;
  const totalStrengthChecks = Math.max(passwordCheck.rules.length, 1);
  const passedStrengthChecks = passwordCheck.rules.filter((rule) => rule.ok).length;
  const strengthPercent = pw.nueva.length > 0
    ? Math.round((passedStrengthChecks / totalStrengthChecks) * 100)
    : 0;
  const strengthState =
    pw.nueva.length === 0
      ? "idle"
      : strengthPercent < 40
        ? "weak"
        : strengthPercent < 80
          ? "medium"
          : "strong";
  const strengthLabel =
    strengthState === "idle"
      ? ""
      : strengthState === "weak"
        ? "D\u00e9bil"
        : strengthState === "medium"
          ? "Regular"
          : "Segura";

  const canChangePassword =
    !loadingPolicies &&
    !policiesError &&
    pw.actual.length > 0 &&
    passwordCheck.allOk &&
    confirmOk;
  const lastPasswordChangeText =
    lastPasswordChangeDays === null
      ? "Sin registro"
      : lastPasswordChangeDays <= 0
        ? "Hoy"
        : `Hace ${lastPasswordChangeDays} ${lastPasswordChangeDays === 1 ? "d\u00eda" : "d\u00edas"}`;
  const showRecommendation =
    !Boolean(user?.password_policy_excluded) &&
    (lastPasswordChangeDays !== null
      ? lastPasswordChangeDays >= 30
      : Boolean(user?.password_recommend_change));

  const updatePwField = (field) => (event) => {
    const value = event.target.value;
    setPw((state) => ({ ...state, [field]: value }));
  };

  const cargarUltimoCambioClave = async () => {
    try {
      const perfilPayload = await perfilService.getPerfil();
      const fechaUltimoCambio = resolveLastPasswordChangeDate(perfilPayload);
      setLastPasswordChangeDays(getDaysSince(fechaUltimoCambio));
    } catch {
      setLastPasswordChangeDays(null);
    }
  };

  useEffect(() => {
    cargarUltimoCambioClave();
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
    { titulo = "AVISO", icono = "bi-exclamation-triangle-fill", variant = "info" } = {}
  ) => {
    setAlerta({ visible: true, titulo, mensaje, icono, variant });
  };

  const onChangePassword = async () => {
    if (pw.nueva !== pw.confirmacion) {
      mostrarAlerta("La nueva contrase\u00f1a y la confirmaci\u00f3n no coinciden.", {
        variant: "warning",
      });
      return;
    }

    try {
      await perfilService.changePassword({
        clave_actual: pw.actual,
        clave_nueva: pw.nueva,
      });

      mostrarAlerta("Contrase\u00f1a actualizada.", {
        titulo: "ACTUALIZADO",
        icono: "bi-check-circle-fill",
        variant: "success",
      });
      setPw({ actual: "", nueva: "", confirmacion: "" });
      setShowPw({ actual: false, nueva: false, confirmacion: false });
      await cargarUltimoCambioClave();
    } catch (e) {
      mostrarAlerta(e?.message || "No se pudo cambiar la contrase\u00f1a", {
        variant: "danger",
      });
    }
  };

  return (
    <div className="p-4 password-page">
      {alerta.visible && (
        <div className="inv-toast-wrap" role="status" aria-live="polite">
          <article className={`inv-toast-card ${alerta.variant || "info"}`.trim()}>
            <div className="inv-toast-icon" aria-hidden="true">
              <i className={`bi ${alerta.icono}`} />
            </div>

            <div className="inv-toast-content">
              <div className="inv-toast-title">{alerta.titulo}</div>
              <div className="inv-toast-message">{alerta.mensaje}</div>
            </div>

            <button
              type="button"
              className="inv-toast-close"
              onClick={() => setAlerta((prev) => ({ ...prev, visible: false }))}
              aria-label="Cerrar"
            >
              <i className="bi bi-x-lg" />
            </button>

            <div className="inv-toast-progress" aria-hidden="true" />
          </article>
        </div>
      )}

      <div className="password-page__shell">
        <div className="mb-3 password-page__header">
          <div className="password-page__header-main">
            <div className="password-page__header-icon" aria-hidden="true">
              <i className="bi bi-lock-fill"></i>
            </div>
            <div className="password-page__header-copy">
              <div className="password-page__header-topline">
                <h3 className="mb-0">Cambiar contrase&ntilde;a</h3>
              </div>
              <div className="password-page__header-note">
                Mantenga su cuenta protegida con una clave robusta y bien definida.
              </div>
            </div>
            <div className="password-page__last-change" aria-label="\u00daltimo cambio">
              <span>&Uacute;ltimo cambio</span>
              <strong>{lastPasswordChangeText}</strong>
              {showRecommendation ? <small>Se recomienda actualizar</small> : null}
            </div>
          </div>
        </div>

        <div className="row g-3 align-items-start">
          <div className="col-12 col-xl-8">
            <div className="card shadow-sm password-page__card">
              <div className="card-body password-page__card-body">
                {loadingPolicies && (
                  <div className="text-muted mb-3 password-page__notice">
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Cargando pol&iacute;ticas...
                  </div>
                )}

                {policiesError && (
                  <div className="alert alert-warning password-page__notice">
                    No se pudieron cargar las pol&iacute;ticas de contrase&ntilde;a. A&uacute;n puedes intentar cambiarla, pero no habr&aacute; validaci&oacute;n en vivo.
                  </div>
                )}

                <div className="password-page__field">
                  <label className="form-label">Contrase&ntilde;a actual</label>
                  <div className="input-group">
                    <input
                      type={showPw.actual ? "text" : "password"}
                      className="form-control"
                      value={pw.actual}
                      onChange={updatePwField("actual")}
                      onInput={updatePwField("actual")}
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
                </div>

                <div className="password-page__field">
                  <label className="form-label">Nueva contrase&ntilde;a</label>
                  <div className="input-group">
                    <input
                      type={showPw.nueva ? "text" : "password"}
                      className="form-control"
                      value={pw.nueva}
                      onChange={updatePwField("nueva")}
                      onInput={updatePwField("nueva")}
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
                </div>

                <div className="password-page__strength">
                  <div className="password-page__strength-head">
                    <span>Fortaleza actual de su nueva clave.</span>
                    <strong>{strengthLabel}</strong>
                  </div>
                  <div className="password-page__strength-track" role="presentation">
                    <div
                      className={`password-page__strength-fill is-${strengthState}`}
                      style={{ width: `${strengthPercent}%` }}
                    />
                  </div>
                </div>

                <div className="border rounded p-3 mb-3 password-page__rules">
                  <div className="small fw-semibold mb-2">Debe cumplir:</div>
                  <ul className="list-unstyled mb-0 small">
                    {passwordCheck.rules.map((r) => (
                      <li key={r.key} className={r.ok ? "text-success" : "text-danger"}>
                        <i className={`bi ${r.ok ? "bi-check-circle" : "bi-x-circle"} me-2`}></i>
                        {r.label}
                      </li>
                    ))}
                    <li className={confirmOk ? "text-success" : "text-danger"}>
                      <i className={`bi ${confirmOk ? "bi-check-circle" : "bi-x-circle"} me-2`}></i>
                      Confirmaci&oacute;n coincide
                    </li>
                  </ul>
                </div>

                <div className="password-page__field">
                  <label className="form-label">Confirmaci&oacute;n</label>
                  <div className="input-group">
                    <input
                      type={showPw.confirmacion ? "text" : "password"}
                      className="form-control"
                      value={pw.confirmacion}
                      onChange={updatePwField("confirmacion")}
                      onInput={updatePwField("confirmacion")}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setShowPw((s) => ({ ...s, confirmacion: !s.confirmacion }))}
                      title={showPw.confirmacion ? "Ocultar" : "Mostrar"}
                    >
                      <i className={`bi ${showPw.confirmacion ? "bi-eye-slash" : "bi-eye"}`}></i>
                    </button>
                  </div>
                </div>

                <SecurityConfirmAction
                  className="btn btn-outline-dark w-100 password-page__submit"
                  disabled={!canChangePassword}
                  triggerTitle={
                    !canChangePassword
                      ? "Completa y cumple las pol\u00edticas para habilitar"
                      : "Cambiar contrase\u00f1a"
                  }
                  title={"CONFIRMAR CAMBIO DE CONTRASEÑA"}
                  subtitle={"Se actualizará la contraseña de tu cuenta."}
                  question={"¿Deseas actualizar la contraseña?"}
                  confirmLabel="Confirmar"
                  cancelLabel="Cancelar"
                  onConfirm={onChangePassword}
                >
                  Actualizar contrase&ntilde;a
                </SecurityConfirmAction>

                {!confirmOk && pw.confirmacion.length > 0 && (
                  <div className="small text-danger mt-2">La confirmaci&oacute;n no coincide.</div>
                )}
              </div>
            </div>
          </div>

          <div className="col-12 col-xl-4">
            <div className="card shadow-sm password-page__side-card password-page__side-card--ok">
              <div className="card-body">
                <h6 className="mb-2"><i className="bi bi-shield-check me-2" aria-hidden="true"></i>Recomendaciones</h6>
                <p className="mb-3 text-muted small">
                  Mant&eacute;n tu cuenta segura usando una contrase&ntilde;a robusta y diferente a las anteriores.
                </p>
                <ul className="list-unstyled mb-0 small password-page__tips">
                  <li><i className="bi bi-shield-check me-2"></i>Evita datos personales.</li>
                  <li><i className="bi bi-key me-2"></i>No reutilices la misma clave.</li>
                  <li><i className="bi bi-clock-history me-2"></i>Actualiza la clave peri&oacute;dicamente.</li>
                </ul>
              </div>
            </div>

            <div className="card shadow-sm password-page__side-card password-page__side-card--warn password-page__advice-card mt-3">
              <div className="card-body">
                <h6 className="mb-2"><i className="bi bi-patch-check me-2" aria-hidden="true"></i>Consejo de seguridad</h6>
                <p className="mb-0 small">
                  Utilice frases largas combinando palabras, n&uacute;meros y s&iacute;mbolos. Ejemplo: Jonny$2026!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CambioContrasena;
