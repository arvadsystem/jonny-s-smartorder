import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import authService from '../../services/authService';
import logo from '../../assets/images/logo-sin-fondo.png';
import bgImage from '../../assets/images/imagen-fondo.png';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUser, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import './Login.scss';

const Login = () => {
  const navigate = useNavigate();
  const { login, user } = useAuth();

  const [nombreUsuario, setNombreUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const mustChange = Boolean(user?.must_change_password);
    navigate(mustChange ? '/cambiar-password' : '/dashboard', { replace: true });
  }, [navigate, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!nombreUsuario.trim() || !password.trim()) {
      setError('Por favor, ingresa tu usuario y contraseña.');
      return;
    }

    setLoading(true);
    try {
      const response = await authService.login({
        nombre_usuario: nombreUsuario,
        clave: password,
      });

      if (response?.usuario) login(response);

      const mustChange = Boolean(response?.usuario?.must_change_password);
      navigate(mustChange ? '/cambiar-password' : '/dashboard');
    } catch (err) {
      let msg = err.message;
      if (msg === 'Failed to fetch' || msg.includes('NetworkError')) {
        msg = 'Error de conexión con el servidor';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-root">

      {/* ── PANEL IZQUIERDO ─────────────────────────────────────── */}
      <div className="panel-left">
        {/* Capa 1: Imagen de fondo */}
        <img src={bgImage} alt="" className="bg-food" />

        {/* Capa 2: Vignette radial */}
        <div className="vignette" />

        {/* Capa 3: Fade lateral → fusión con panel derecho */}
        <div className="side-fade" />

        {/* Capa 4: Contenido */}
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
          <h2>Bienvenido de vuelta</h2>
          <p>Ingresa tus credenciales para continuar</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {/* USUARIO */}
          <div className="field">
            <label>USUARIO</label>
            <div className="input-wrap">
              <FiUser className="field-icon" />
              <input
                type="text"
                placeholder="Ej. vcarbajal"
                value={nombreUsuario}
                onChange={(e) => setNombreUsuario(e.target.value)}
                autoComplete="username"
              />
            </div>
          </div>

          {/* CONTRASEÑA */}
          <div className="field">
            <label>CONTRASEÑA</label>
            <div className="input-wrap">
              <FiLock className="field-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="eye-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>

          {/* Recordar / Olvidé */}
          <div className="remember-row">
            <label className="check-label">
              <input type="checkbox" />
              <span>Recordar sesión</span>
            </label>
            <button type="button" className="forgot-link">
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                className="error-msg"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* CTA */}
          <motion.button
            type="submit"
            className="btn-cta"
            disabled={loading}
            whileHover={!loading ? { y: -1 } : {}}
            whileTap={!loading ? { scale: 0.98 } : {}}
          >
            {loading ? (
              <span className="loading-inner">
                <span className="spin" /> Iniciando sesión...
              </span>
            ) : (
              'INICIAR SESIÓN  →'
            )}
          </motion.button>
        </form>
      </motion.aside>
    </div>
  );
};

export default Login;
