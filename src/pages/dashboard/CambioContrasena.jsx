import { useEffect, useState } from "react";
import { perfilService } from "../../services/perfilService";
import usePasswordPolicies from "../../hooks/usePasswordPolicies";
import { validatePassword } from "../../utils/passwordValidator";
import SecurityConfirmAction from "./seguridad/components/SecurityConfirmAction";
import "./cambio-contrasena.css";
import "./perfil-toast.css";
import "./seguridad/sesiones-ui.css";

const CambioContrasena = () => {
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

  const updatePwField = (field) => (event) => {
    const value = event.target.value;
    setPw((state) => ({ ...state, [field]: value }));
  };

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

  const onChangePassword = async () => {
    if (pw.nueva !== pw.confirmacion) {
      mostrarAlerta("La nueva contraseña y la confirmación no coinciden.");
      return;
    }

    try {
      await perfilService.changePassword({
        clave_actual: pw.actual,
        clave_nueva: pw.nueva,
      });

      mostrarAlerta("Contraseña actualizada.", {
        titulo: "ACTUALIZADO",
        icono: "bi-check-circle-fill",
      });
      setPw({ actual: "", nueva: "", confirmacion: "" });
      setShowPw({ actual: false, nueva: false, confirmacion: false });
    } catch (e) {
      mostrarAlerta(e?.message || "No se pudo cambiar la contraseña");
    }
  };

  return (
    <div className="p-4 password-page">
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

      <div className="password-page__shell">
        <div className="d-flex align-items-center justify-content-between mb-3 password-page__header">
          <div>
            <h3 className="mb-0">Cambiar contraseña</h3>
            <small className="text-muted">Actualiza la contraseña de tu cuenta</small>
          </div>
        </div>

        <div className="row g-3 align-items-start">
          <div className="col-12 col-xl-8">
            <div className="card shadow-sm password-page__card">
              <div className="card-body password-page__card-body">
                {loadingPolicies && (
                  <div className="text-muted mb-3 password-page__notice">
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Cargando políticas...
                  </div>
                )}

                {policiesError && (
                  <div className="alert alert-warning password-page__notice">
                    No se pudieron cargar las políticas de contraseña. Aún puedes intentar cambiarla, pero no habrá validación en vivo.
                  </div>
                )}

                <div className="password-page__field">
                  <label className="form-label">Contraseña actual</label>
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
                  <label className="form-label">Nueva contraseña</label>
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
                      Confirmación coincide
                    </li>
                  </ul>
                </div>

                <div className="password-page__field">
                  <label className="form-label">Confirmación</label>
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
                      ? "Completa y cumple las políticas para habilitar"
                      : "Cambiar contraseña"
                  }
                  title="CONFIRMAR CAMBIO DE CONTRASEÑA"
                  subtitle="Se actualizará la contraseña de tu cuenta."
                  question="¿Deseas actualizar la contraseña?"
                  confirmLabel="Confirmar"
                  cancelLabel="Cancelar"
                  onConfirm={onChangePassword}
                >
                  Actualizar contraseña
                </SecurityConfirmAction>

                {!confirmOk && pw.confirmacion.length > 0 && (
                  <div className="small text-danger mt-2">La confirmación no coincide.</div>
                )}
              </div>
            </div>
          </div>

          <div className="col-12 col-xl-4">
            <div className="card shadow-sm password-page__side-card">
              <div className="card-body">
                <h6 className="mb-2">Recomendaciones</h6>
                <p className="mb-3 text-muted small">
                  Mantén tu cuenta segura usando una contraseña robusta y diferente a las anteriores.
                </p>
                <ul className="list-unstyled mb-0 small password-page__tips">
                  <li><i className="bi bi-shield-check me-2"></i>Evita datos personales.</li>
                  <li><i className="bi bi-key me-2"></i>No reutilices la misma clave.</li>
                  <li><i className="bi bi-clock-history me-2"></i>Actualiza la clave periódicamente.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CambioContrasena;
