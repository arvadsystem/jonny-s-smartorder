import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import authService from '../../services/authService';
import clientePublicoService from '../../services/clientePublicoService';
import ForcePasswordChange from './ForcePasswordChange';
import logo from '../../assets/images/logo-sin-fondo.png';
import bgImage from '../../assets/images/imagen-fondo.png';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUser, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import './Login.scss';
const normalizeRoleName = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[\s-]+/g, '_')
    .toUpperCase();

const isClienteUser = (authUser) => {
  const tipoUsuario = normalizeRoleName(authUser?.tipo_usuario);
  if (tipoUsuario === 'CLIENTE') return true;

  const roles = Array.isArray(authUser?.roles) ? authUser.roles : [];
  return roles.map(normalizeRoleName).includes('CLIENTE');
};

const _MOTION = motion;

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, user } = useAuth();

  // ── Campo unificado (usuario o correo) ───────────────────────
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // ── Estado general ───────────────────────────────────────────
  const [error, setError] = useState('');
  const [showForcePasswordModal, setShowForcePasswordModal] = useState(false);
  const [successMsg, setSuccessMsg] = useState(
    searchParams.get('verified') === '1'
      ? '✅ ¡Correo verificado! Tu cuenta está activa. Ya puedes iniciar sesión.'
      : ''
  );
  const [loading, setLoading] = useState(false);

  // Redirección al ya tener sesión
  useEffect(() => {
    if (!user) {
      setShowForcePasswordModal(false);
      return;
    }

    const isCliente = isClienteUser(user);
    const mustChange = Boolean(user?.must_change_password);

    if (isCliente) {
      setShowForcePasswordModal(false);
      const from = searchParams.get('from');
      navigate(from === 'carrito' ? '/carrito' : '/menu-publico', { replace: true });
      return;
    }

    if (mustChange) {
      setShowForcePasswordModal(true);
      return;
    }

    setShowForcePasswordModal(false);
    navigate('/dashboard', { replace: true });
  }, [navigate, user, searchParams]);

  // ── Detectar si es email o nombre de usuario ─────────────────
  const isEmail = (value) => value.includes('@');

  // ── Submit unificado ─────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!identifier.trim() || !password.trim()) {
      setError('Por favor, ingresa tus credenciales.');
      return;
    }

    setLoading(true);
    try {
      let response;

      if (isEmail(identifier)) {
        // Flujo cliente → Supabase
        response = await clientePublicoService.loginCliente({ identifier, clave: password });
      } else {
        // Flujo empleado → Legacy
        response = await authService.login({ nombre_usuario: identifier, clave: password });
      }

      if (response?.usuario) {
        login(response);
        const usuario = response.usuario;
        setShowForcePasswordModal(!isClienteUser(usuario) && Boolean(usuario?.must_change_password));
      }
    } catch (err) {
      let msg = err.message;
      if (msg === 'Failed to fetch' || msg?.includes('NetworkError')) {
        msg = 'Error de conexión con el servidor';
      }
      setError(msg || 'Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  };

  // ── Google OAuth ─────────────────────────────────────────────
  const handleGoogleLogin = () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      setError('Google Auth no está configurado. Contacta al administrador.');
      return;
    }
    const redirectTo = `${window.location.origin}/auth/callback`;
    window.location.href = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
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
        {/* Cabecera */}
        <div className="form-header">
          <h2>BIENVENIDO</h2>
          <p>Ingresa tus credenciales para continuar</p>
        </div>

        {/* ══ FORMULARIO UNIFICADO ════════════════════════════════ */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="field">
            <label>USUARIO O CORREO</label>
            <div className="input-wrap">
              <FiUser className="field-icon" />
              <input
                id="login-identifier"
                type="text"
                placeholder="usuario123 o ejemplo@correo.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
              />
            </div>
          </div>

          <div className="field">
            <label>CONTRASEÑA</label>
            <div className="input-wrap">
              <FiLock className="field-icon" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button type="button" className="eye-btn" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>

          <div className="remember-row">
            <label className="check-label">
              <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
              <span>Recordar sesión</span>
            </label>
            <button type="button" className="forgot-link" onClick={() => navigate('/recuperar-password')}>
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          <AnimatePresence>
            {successMsg && (
              <motion.div className="success-msg" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {successMsg}
              </motion.div>
            )}
            {error && (
              <motion.div className="error-msg" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button type="submit" className="btn-cta" disabled={loading} whileHover={!loading ? { y: -1 } : {}} whileTap={!loading ? { scale: 0.98 } : {}}>
            {loading ? <span className="loading-inner"><span className="spin" /> Iniciando sesión...</span> : 'INICIAR SESIÓN  →'}
          </motion.button>

          {/* Botón Registrarse */}
          <motion.button
            type="button"
            className="btn-register"
            onClick={() => navigate('/registro')}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
          >
            REGISTRARSE
          </motion.button>

          {/* Separador social */}
          <div className="social-divider">
            <span className="divider-line" />
            <span className="divider-text">Autenticarse con</span>
            <span className="divider-line" />
          </div>

          {/* Botón Google */}
          <button type="button" className="btn-google" onClick={handleGoogleLogin}>
            <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span>Google</span>
          </button>

          {/* Link menú público */}
          <div className="menu-link-row">
            <button type="button" className="menu-publico-link" onClick={() => navigate('/menu-publico')}>
              Ver menú sin iniciar sesión →
            </button>
          </div>
        </form>
      </motion.aside>

      {showForcePasswordModal ? <ForcePasswordChange asModal /> : null}
    </div>
  );
};

export default Login;

