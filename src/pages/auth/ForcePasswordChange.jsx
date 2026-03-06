import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { personaService } from '../../services/personasService';
import './ForcePasswordChange.scss';

const MIN_LENGTH = 8;
const UPPERCASE_RE = /[A-Z]/;
const NUMBER_RE = /[0-9]/;
const SYMBOL_RE = /[^A-Za-z0-9]/;

const buildPasswordChecks = (value) => {
  const password = String(value || '');
  return {
    minLength: password.length >= MIN_LENGTH,
    hasUppercase: UPPERCASE_RE.test(password),
    hasNumber: NUMBER_RE.test(password),
    hasSymbol: SYMBOL_RE.test(password),
  };
};

const getStrengthData = (checks) => {
  const score = Object.values(checks).filter(Boolean).length;

  if (score <= 1) {
    return { label: 'Debil', level: 'weak', percent: 33 };
  }

  if (score <= 3) {
    return { label: 'Media', level: 'medium', percent: 66 };
  }

  return { label: 'Fuerte', level: 'strong', percent: 100 };
};

const ForcePasswordChange = () => {
  const navigate = useNavigate();
  const { user, login, logout } = useAuth();

  const [form, setForm] = useState({
    actual: '',
    nueva: '',
    confirmacion: '',
  });
  const [showPassword, setShowPassword] = useState({
    actual: false,
    nueva: false,
    confirmacion: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const passwordChecks = useMemo(() => buildPasswordChecks(form.nueva), [form.nueva]);
  const strength = useMemo(() => getStrengthData(passwordChecks), [passwordChecks]);

  const confirmationMatches =
    String(form.confirmacion || '').length > 0 && form.nueva === form.confirmacion;

  const canSubmit =
    !saving &&
    String(form.actual || '').trim().length > 0 &&
    String(form.nueva || '').trim().length > 0 &&
    confirmationMatches &&
    passwordChecks.minLength &&
    passwordChecks.hasUppercase &&
    passwordChecks.hasNumber;

  const onChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  const toggleField = (field) => {
    setShowPassword((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const actual = String(form.actual || '').trim();
    const nueva = String(form.nueva || '').trim();
    const confirmacion = String(form.confirmacion || '').trim();

    if (!actual || !nueva || !confirmacion) {
      setError('Completa todos los campos para continuar.');
      return;
    }

    if (!passwordChecks.minLength || !passwordChecks.hasUppercase || !passwordChecks.hasNumber) {
      setError('La nueva contrasena no cumple los requisitos minimos.');
      return;
    }

    if (nueva !== confirmacion) {
      setError('La nueva contrasena y la confirmacion no coinciden.');
      return;
    }

    if (actual === nueva) {
      setError('La nueva contrasena debe ser diferente de la actual.');
      return;
    }

    setSaving(true);
    try {
      await personaService.changePasswordUsuarioV2({
        password_actual: actual,
        password_nueva: nueva,
      });

      login({
        ...(user || {}),
        must_change_password: false,
      });

      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err?.message || 'No se pudo cambiar la contrasena.');
    } finally {
      setSaving(false);
    }
  };

  const onLogout = async () => {
    try {
      await logout();
    } finally {
      navigate('/', { replace: true });
    }
  };

  return (
    <div className="force-password-page">
      <div className="force-password-card">
        <div className="force-password-card__topbar">
          <i className="bi bi-lock-fill" aria-hidden="true"></i>
          <span>Accion requerida</span>
        </div>

        <div className="force-password-card__body">
          <div className="force-password-card__hero">
            <div className="force-password-card__hero-icon" aria-hidden="true">
              <i className="bi bi-shield-lock-fill"></i>
            </div>
            <h1>Cambio de contrasena obligatorio</h1>
            <p>
              Por seguridad, debes cambiar tu contrasena temporal antes de continuar.
            </p>
          </div>

          {error ? (
            <div className="force-password-alert" role="alert">
              <i className="bi bi-exclamation-triangle-fill" aria-hidden="true"></i>
              <span>{error}</span>
            </div>
          ) : null}

          <form onSubmit={onSubmit} noValidate>
            <div className="force-password-group">
              <label className="form-label">Contrasena actual</label>
              <div className="force-password-field">
                <span className="force-password-field__icon" aria-hidden="true">
                  <i className="bi bi-key-fill"></i>
                </span>
                <input
                  type={showPassword.actual ? 'text' : 'password'}
                  value={form.actual}
                  onChange={(e) => onChange('actual', e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="force-password-field__toggle"
                  onClick={() => toggleField('actual')}
                  aria-label={showPassword.actual ? 'Ocultar contrasena actual' : 'Mostrar contrasena actual'}
                >
                  <i className={`bi ${showPassword.actual ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`}></i>
                </button>
              </div>
            </div>

            <div className="force-password-group">
              <label className="form-label">Nueva contrasena</label>
              <div className="force-password-field">
                <span className="force-password-field__icon" aria-hidden="true">
                  <i className="bi bi-lock-fill"></i>
                </span>
                <input
                  type={showPassword.nueva ? 'text' : 'password'}
                  value={form.nueva}
                  onChange={(e) => onChange('nueva', e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="force-password-field__toggle"
                  onClick={() => toggleField('nueva')}
                  aria-label={showPassword.nueva ? 'Ocultar nueva contrasena' : 'Mostrar nueva contrasena'}
                >
                  <i className={`bi ${showPassword.nueva ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`}></i>
                </button>
              </div>

              <div className="force-password-strength">
                <div className="force-password-strength__meta">
                  <span>Fortaleza:</span>
                  <strong className={`is-${strength.level}`}>{strength.label}</strong>
                </div>
                <div className="force-password-strength__bar" role="presentation">
                  <span
                    className={`is-${strength.level}`}
                    style={{ width: `${strength.percent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="force-password-group">
              <label className="form-label">Confirmar nueva contrasena</label>
              <div className="force-password-field">
                <span className="force-password-field__icon" aria-hidden="true">
                  <i className="bi bi-lock"></i>
                </span>
                <input
                  type={showPassword.confirmacion ? 'text' : 'password'}
                  value={form.confirmacion}
                  onChange={(e) => onChange('confirmacion', e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="force-password-field__toggle"
                  onClick={() => toggleField('confirmacion')}
                  aria-label={showPassword.confirmacion ? 'Ocultar confirmacion' : 'Mostrar confirmacion'}
                >
                  <i className={`bi ${showPassword.confirmacion ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`}></i>
                </button>
              </div>

              {String(form.confirmacion || '').length > 0 && !confirmationMatches ? (
                <div className="force-password-help force-password-help--error">
                  La confirmacion no coincide con la nueva contrasena.
                </div>
              ) : null}
            </div>

            <div className="force-password-rules">
              <p>Requisitos minimos:</p>
              <ul>
                <li className={passwordChecks.minLength ? 'is-ok' : ''}>
                  <i className={`bi ${passwordChecks.minLength ? 'bi-check-circle-fill' : 'bi-dot'}`} aria-hidden="true"></i>
                  <span>8 caracteres minimo</span>
                </li>
                <li className={passwordChecks.hasUppercase ? 'is-ok' : ''}>
                  <i className={`bi ${passwordChecks.hasUppercase ? 'bi-check-circle-fill' : 'bi-dot'}`} aria-hidden="true"></i>
                  <span>1 mayuscula</span>
                </li>
                <li className={passwordChecks.hasNumber ? 'is-ok' : ''}>
                  <i className={`bi ${passwordChecks.hasNumber ? 'bi-check-circle-fill' : 'bi-dot'}`} aria-hidden="true"></i>
                  <span>1 numero</span>
                </li>
              </ul>
            </div>

            <button
              className="force-password-submit"
              type="submit"
              disabled={!canSubmit}
            >
              {saving ? 'Guardando...' : 'Guardar nueva contrasena'}
            </button>
          </form>

          <button
            type="button"
            className="force-password-logout"
            onClick={onLogout}
            disabled={saving}
          >
            Cerrar sesion
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForcePasswordChange;
