import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { perfilService } from '../../services/perfilService';
import usePasswordPolicies from '../../hooks/usePasswordPolicies';
import { validatePassword } from '../../utils/passwordValidator';
import './ForcePasswordChange.scss';

const parsePolicyBool = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;

  const normalized = String(value ?? '').trim().toLowerCase();
  return ['true', '1', 'si', 'sí', 'yes', 'y', 'on'].includes(normalized);
};

const resolvePasswordPolicyConfig = (policies) => {
  const minLenRaw = Number(policies?.password_min_length);
  const minLength = Number.isFinite(minLenRaw) && minLenRaw > 0 ? minLenRaw : 8;

  return {
    minLength,
    requireUpper: parsePolicyBool(policies?.password_require_upper ?? true),
    requireNumber: parsePolicyBool(policies?.password_require_number ?? true),
    requireSymbol: parsePolicyBool(policies?.password_require_symbol ?? false),
  };
};

const getStrengthData = ({ password = '', passed = 0, total = 1 }) => {
  const safePassword = String(password || '');
  if (!safePassword) {
    return { label: '', level: 'idle', percent: 0 };
  }

  const scorePercent = Math.round((passed / Math.max(total, 1)) * 100);
  if (scorePercent < 40) {
    return { label: 'Débil', level: 'weak', percent: Math.max(12, scorePercent) };
  }

  if (scorePercent < 80) {
    return { label: 'Media', level: 'medium', percent: scorePercent };
  }

  return { label: 'Fuerte', level: 'strong', percent: Math.max(90, scorePercent) };
};

const normalizePasswordChangeError = (message) => {
  const raw = String(message || '').trim();
  if (!raw) return 'No se pudo cambiar la contrasena.';
  const normalized = raw.toLowerCase();
  if (normalized.includes('ya fue utilizada recientemente')) {
    return 'La nueva contrasena ya fue utilizada recientemente. Elige una diferente.';
  }
  return raw;
};

const ForcePasswordChange = ({ asModal = false, onCompleted = null }) => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { policies } = usePasswordPolicies({ enabled: !asModal, suppressForbidden: true });

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

  const normalizedPolicies = useMemo(() => {
    const minLenRaw = Number(policies?.password_min_length);
    return {
      ...(policies || {}),
      password_min_length: Number.isFinite(minLenRaw) && minLenRaw > 0 ? minLenRaw : 8,
      password_require_upper: policies?.password_require_upper ?? true,
      password_require_number: policies?.password_require_number ?? true,
      password_require_symbol: policies?.password_require_symbol ?? false,
    };
  }, [policies]);

  const policyConfig = useMemo(() => resolvePasswordPolicyConfig(normalizedPolicies), [normalizedPolicies]);
  const passwordCheck = useMemo(
    () => validatePassword(String(form.nueva || ''), normalizedPolicies),
    [form.nueva, normalizedPolicies]
  );

  const ruleOkByKey = useMemo(
    () =>
      Object.fromEntries(
        (Array.isArray(passwordCheck?.rules) ? passwordCheck.rules : []).map((rule) => [rule.key, Boolean(rule.ok)])
      ),
    [passwordCheck]
  );

  const requirementRules = useMemo(() => {
    const rows = [{ key: 'min', label: `${policyConfig.minLength} caracteres mínimo` }];
    if (policyConfig.requireUpper) rows.push({ key: 'upper', label: '1 mayúscula' });
    if (policyConfig.requireNumber) rows.push({ key: 'number', label: '1 número' });
    if (policyConfig.requireSymbol) rows.push({ key: 'symbol', label: '1 símbolo' });
    return rows;
  }, [policyConfig]);

  const strength = useMemo(() => {
    const totalRules = Math.max(passwordCheck?.rules?.length || 0, 1);
    const passedRules = (passwordCheck?.rules || []).filter((rule) => Boolean(rule.ok)).length;
    return getStrengthData({
      password: form.nueva,
      passed: passedRules,
      total: totalRules,
    });
  }, [form.nueva, passwordCheck]);

  const confirmationMatches =
    String(form.confirmacion || '').length > 0 && form.nueva === form.confirmacion;

  const canSubmit =
    !saving &&
    String(form.actual || '').trim().length > 0 &&
    String(form.nueva || '').trim().length > 0 &&
    confirmationMatches &&
    Boolean(passwordCheck?.allOk);

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

    if (!passwordCheck?.allOk) {
      setError('La nueva contraseña no cumple los requisitos mínimos.');
      return;
    }

    if (nueva !== confirmacion) {
      setError('La nueva contraseña y la confirmación no coinciden.');
      return;
    }

    if (actual === nueva) {
      setError('La nueva contraseña debe ser diferente de la actual.');
      return;
    }

    setSaving(true);
    try {
      await perfilService.changePassword({
        clave_actual: actual,
        clave_nueva: nueva,
      });

      if (typeof onCompleted === 'function') {
        await onCompleted();
        return;
      }

      await logout();
      navigate('/auth/login', { replace: true });
    } catch (err) {
      setError(normalizePasswordChangeError(err?.message));
    } finally {
      setSaving(false);
    }
  };

  const onLogout = async () => {
    try {
      await logout();
    } finally {
      navigate('/auth/login', { replace: true });
    }
  };

  return (
    <div className={asModal ? 'force-password-page is-modal' : 'force-password-page'}>
      <div className="force-password-card">
        <div className="force-password-card__topbar">
          <i className="bi bi-lock-fill" aria-hidden="true"></i>
          <span>Acción requerida</span>
        </div>

        <div className="force-password-card__body">
          <div className="force-password-card__hero">
            <div className="force-password-card__hero-icon" aria-hidden="true">
              <i className="bi bi-shield-lock-fill"></i>
            </div>
            <h1>Cambio de contraseña obligatorio</h1>
            <p>
              {'Por seguridad, debe cambiar su contraseña antes de continuar, esta ya venció.'}
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
              <label className="form-label">Contraseña actual</label>
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
                  aria-label={showPassword.actual ? 'Ocultar contraseña actual' : 'Mostrar contraseña actual'}
                >
                  <i className={`bi ${showPassword.actual ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`}></i>
                </button>
              </div>
            </div>

            <div className="force-password-group">
              <label className="form-label">Nueva contraseña</label>
              <div className="force-password-field">
                <span className="force-password-field__icon" aria-hidden="true">
                  <i className="bi bi-lock-fill"></i>
                </span>
                <input
                  type={showPassword.nueva ? 'text' : 'password'}
                  value={form.nueva}
                  onChange={(e) => onChange('nueva', e.target.value)}
                  onInput={(e) => onChange('nueva', e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="force-password-field__toggle"
                  onClick={() => toggleField('nueva')}
                  aria-label={showPassword.nueva ? 'Ocultar nueva contraseña' : 'Mostrar nueva contraseña'}
                >
                  <i className={`bi ${showPassword.nueva ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`}></i>
                </button>
              </div>

              <div className="force-password-strength">
                <div className="force-password-strength__meta">
                  <span>Fortaleza de contraseña nueva:</span>
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
              <label className="form-label">Confirmar nueva contraseña</label>
              <div className="force-password-field">
                <span className="force-password-field__icon" aria-hidden="true">
                  <i className="bi bi-lock"></i>
                </span>
                <input
                  type={showPassword.confirmacion ? 'text' : 'password'}
                  value={form.confirmacion}
                  onChange={(e) => onChange('confirmacion', e.target.value)}
                  onInput={(e) => onChange('confirmacion', e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="force-password-field__toggle"
                  onClick={() => toggleField('confirmacion')}
                  aria-label={showPassword.confirmacion ? 'Ocultar confirmación' : 'Mostrar confirmación'}
                >
                  <i className={`bi ${showPassword.confirmacion ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`}></i>
                </button>
              </div>

              {String(form.confirmacion || '').length > 0 && !confirmationMatches ? (
                <div className="force-password-help force-password-help--error">
                  La confirmación no coincide con la nueva contraseña.
                </div>
              ) : null}
            </div>

            <div className="force-password-rules">
              <p>Requisitos mínimos:</p>
              <ul>
                {requirementRules.map((rule) => {
                  const ok = Boolean(ruleOkByKey[rule.key]);
                  return (
                    <li key={rule.key} className={ok ? 'is-ok' : ''}>
                      <i className={`bi ${ok ? 'bi-check-circle-fill' : 'bi-dot'}`} aria-hidden="true"></i>
                      <span>{rule.label}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <button
              className="force-password-submit"
              type="submit"
              disabled={!canSubmit}
            >
              {saving ? 'Guardando...' : 'Guardar nueva contraseña'}
            </button>
          </form>

          <button
            type="button"
            className="force-password-logout"
            onClick={onLogout}
            disabled={saving}
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForcePasswordChange;

