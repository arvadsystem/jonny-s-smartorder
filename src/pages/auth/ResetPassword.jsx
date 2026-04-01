import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import logo from '../../assets/images/logo-sin-fondo.png';
import bgImage from '../../assets/images/imagen-fondo.png';
import { motion, AnimatePresence } from 'framer-motion';
import { FiLock, FiEye, FiEyeOff, FiCheck } from 'react-icons/fi';
import './Login.scss';

/**
 * ResetPassword — Formulario para establecer nueva contraseña
 * El usuario llega aquí desde el link del correo de recuperación.
 * Supabase redirige con access_token en el hash fragment.
 */
const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Extraer access_token del hash fragment (Supabase lo pone ahí en recovery)
  const [accessToken, setAccessToken] = useState('');

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const token = hashParams.get('access_token');
    if (token) {
      setAccessToken(token);
    } else {
      setError('No se encontró un token de recuperación válido. Solicita un nuevo enlace.');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!password.trim()) {
      setError('Ingresa tu nueva contraseña.');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      // Actualizar contraseña vía Supabase API con el access_token
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ password })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.msg || 'Error al actualizar contraseña');

      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Error al restablecer la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-root">

      {/* ── PANEL IZQUIERDO ─────────────────────────────────────── */}
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

      {/* ── PANEL DERECHO ───────────────────────────────────────── */}
      <motion.aside
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
          <motion.div
            className="verification-sent"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35 }}
          >
            <div className="verification-icon success-icon">
              <FiCheck size={32} />
            </div>
            <h3>¡Contraseña actualizada!</h3>
            <p>Tu contraseña ha sido restablecida exitosamente. Ya puedes iniciar sesión con tu nueva contraseña.</p>
            <motion.button
              type="button"
              className="btn-cta"
              onClick={() => navigate('/')}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              style={{ marginTop: '1.5rem' }}
            >
              IR AL LOGIN  →
            </motion.button>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="login-form">
            <div className="field">
              <label>NUEVA CONTRASEÑA</label>
              <div className="input-wrap">
                <FiLock className="field-icon" />
                <input
                  id="reset-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={!accessToken}
                />
                <button type="button" className="eye-btn" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
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
                <motion.div className="error-msg" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button type="submit" className="btn-cta" disabled={loading || !accessToken} whileHover={!loading ? { y: -1 } : {}} whileTap={!loading ? { scale: 0.98 } : {}}>
              {loading ? <span className="loading-inner"><span className="spin" /> Actualizando...</span> : 'RESTABLECER CONTRASEÑA  →'}
            </motion.button>

            <p className="login-switch">
              <button type="button" className="link-btn" onClick={() => navigate('/')}>
                ← Volver al login
              </button>
            </p>
          </form>
        )}
      </motion.aside>
    </div>
  );
};

export default ResetPassword;
