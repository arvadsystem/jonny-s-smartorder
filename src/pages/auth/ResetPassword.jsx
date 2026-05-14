import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { FiLock, FiEye, FiEyeOff, FiCheck } from 'react-icons/fi';
import clientePublicoService from '../../services/clientePublicoService';
import logo from '../../assets/images/logo-sin-fondo.png';
import bgImage from '../../assets/images/imagen-fondo.png';
import './Login.scss';

const ResetPassword = () => {
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accessToken, setAccessToken] = useState('');

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const token = hashParams.get('access_token');
    if (token) {
      setAccessToken(token);
      return;
    }
    setError('No se encontró un token de recuperación válido. Solicita un nuevo enlace.');
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!password.trim()) {
      setError('Ingresa tu nueva contraseña.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    if (password.length < 10) {
      setError('La contraseña debe tener al menos 10 caracteres.');
      return;
    }

    if (!/[A-Z]/.test(password)) {
      setError('La contraseña debe incluir al menos una letra mayúscula.');
      return;
    }

    if (!/[0-9]/.test(password)) {
      setError('La contraseña debe incluir al menos un número.');
      return;
    }

    setLoading(true);
    try {
      await clientePublicoService.resetPassword({
        access_token: accessToken,
        nueva_clave: password
      });
      setSuccess(true);
    } catch (err) {
      setError(err?.message || 'Error al restablecer la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-root">
      <div className="panel-left">
        <img src={bgImage} alt="" className="bg-food" />
        <div className="vignette" />
        <div className="side-fade" />
        <div className="left-content">
          <div className="badge">
            <span className="dot" />
            SISTEMA DE GESTIÓN · HONDURAS
          </div>
          <div className="brand">
            <div className="logo-ring">
              <div className="halo" />
              <div className="ring" />
              <img src={logo} alt="Jonny's" className="logo-img" />
            </div>
            <div className="brand-text">
              <span className="brand-sub">RESTAURANTE</span>
              <h1 className="brand-name">JONNY'S</h1>
              <h2 className="brand-sub2">SMARTORDER</h2>
              <div className="gold-line" />
            </div>
          </div>
        </div>
      </div>

      <Motion.aside
        className="panel-right"
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <div className="form-header">
          <h2>Nueva contraseña</h2>
          <p>Crea una nueva contraseña para tu cuenta</p>
        </div>

        {success ? (
          <Motion.div
            className="verification-sent"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35 }}
          >
            <div className="verification-icon success-icon">
              <FiCheck size={32} />
            </div>
            <h3>¡Contraseña actualizada!</h3>
            <p>Ya puedes iniciar sesión con tu nueva contraseña.</p>
            <Motion.button
              type="button"
              className="btn-cta"
              onClick={() => navigate('/auth/login')}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              style={{ marginTop: '1.5rem' }}
            >
              IR AL LOGIN  →
            </Motion.button>
          </Motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="login-form">
            <div className="field">
              <label>NUEVA CONTRASEÑA</label>
              <div className="input-wrap">
                <FiLock className="field-icon" />
                <input
                  id="reset-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 10 caracteres, 1 mayúscula y 1 número"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={!accessToken}
                />
                <button
                  type="button"
                  className="eye-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  tabIndex={-1}
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>

            <div className="field">
              <label>CONFIRMAR CONTRASEÑA</label>
              <div className="input-wrap">
                <FiLock className="field-icon" />
                <input
                  id="reset-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Repite tu contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={!accessToken}
                />
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <Motion.div
                  className="error-msg"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  {error}
                </Motion.div>
              )}
            </AnimatePresence>

            <Motion.button
              type="submit"
              className="btn-cta"
              disabled={loading || !accessToken}
              whileHover={!loading ? { y: -1 } : {}}
              whileTap={!loading ? { scale: 0.98 } : {}}
            >
              {loading ? (
                <span className="loading-inner">
                  <span className="spin" /> Actualizando...
                </span>
              ) : (
                'RESTABLECER CONTRASEÑA  →'
              )}
            </Motion.button>

            <p className="login-switch">
              <button type="button" className="link-btn" onClick={() => navigate('/auth/login')}>
                ← Volver al login
              </button>
            </p>
          </form>
        )}
      </Motion.aside>
    </div>
  );
};

export default ResetPassword;
