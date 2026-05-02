import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUser, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import { useAuth } from '../../hooks/useAuth';
import authService from '../../services/authService';
import clientePublicoService from '../../services/clientePublicoService';
import ForcePasswordChange from './ForcePasswordChange';
import logo from '../../assets/images/logo-sin-fondo.png';
import bgImage from '../../assets/images/imagen-fondo.png';
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

const RESEND_GENERIC_MESSAGE =
  'Si la cuenta existe y esta pendiente de verificacion, enviaremos un nuevo correo de verificacion.';

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, user } = useAuth();
  const forceLoginView = searchParams.get('intent') === 'login';

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [error, setError] = useState('');
  const [showForcePasswordModal, setShowForcePasswordModal] = useState(false);
  const [successMsg, setSuccessMsg] = useState(
    searchParams.get('verified') === '1'
      ? 'Cuenta verificada. Ya puedes iniciar sesion.'
      : ''
  );
  const [canResendVerification, setCanResendVerification] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [resendTarget, setResendTarget] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setShowForcePasswordModal(false);
      return;
    }

    const isCliente = isClienteUser(user);
    const mustChange = Boolean(user?.must_change_password);

    if (forceLoginView) {
      setShowForcePasswordModal(false);
      return;
    }

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
  }, [forceLoginView, navigate, user, searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setCanResendVerification(false);

    if (!identifier.trim() || !password.trim()) {
      setError('Por favor, ingresa tus credenciales.');
      return;
    }

    const normalizedIdentifier = String(identifier || '').trim();
    setLoading(true);

    try {
      let response = null;
      let internalError = null;

      try {
        response = await authService.login({
          nombre_usuario: normalizedIdentifier,
          clave: password
        });
      } catch (err) {
        internalError = err;

        const code = String(err?.code || err?.data?.code || '').toUpperCase();
        const shouldFallbackToCliente =
          code === 'ACCOUNT_SCOPE_INVALID' || normalizedIdentifier.includes('@');

        if (!shouldFallbackToCliente) throw err;

        response = await clientePublicoService.loginCliente({
          identifier: normalizedIdentifier,
          clave: password
        });
      }

      if (response?.usuario) {
        login(response);

        const usuario = response.usuario;
        const isCliente = isClienteUser(usuario);
        const mustChange = !isCliente && Boolean(usuario?.must_change_password);

        setShowForcePasswordModal(mustChange);
        setResendTarget('');

        if (!mustChange) {
          const from = searchParams.get('from');

          navigate(
            isCliente
              ? from === 'carrito'
                ? '/carrito'
                : '/menu-publico'
              : '/dashboard',
            { replace: true }
          );
        }

        return;
      } else if (internalError) {
        throw internalError;
      }

      if (internalError) throw internalError;
    } catch (err) {
      const errCode = String(err?.code || err?.data?.code || '').toUpperCase();
      let msg = err?.message || '';

      if (msg === 'Failed to fetch' || msg.includes('NetworkError')) {
        msg = 'Error de conexion con el servidor';
      }

      if (errCode === 'EMAIL_NOT_VERIFIED') {
        setCanResendVerification(true);
        setResendTarget(normalizedIdentifier);
      } else {
        setCanResendVerification(false);
      }

      setError(msg || 'Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    const target = String(resendTarget || identifier || '').trim();

    if (!target) {
      setError('Ingresa tu correo o usuario para reenviar la verificacion.');
      return;
    }

    setResendingVerification(true);
    setError('');

    try {
      const response = await clientePublicoService.resendVerification({
        identifier: target
      });

      setSuccessMsg(response?.message || RESEND_GENERIC_MESSAGE);
      setCanResendVerification(false);
    } catch (err) {
      setError(err?.message || 'No se pudo reenviar el correo de verificacion.');
    } finally {
      setResendingVerification(false);
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
            SISTEMA DE GESTION - HONDURAS
          </div>

          <div className="brand">
            <div className="logo-ring">
              <div className="halo" />
              <div className="ring" />
              <img src={logo} alt="Jonnys" className="logo-img" />
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

      <motion.aside
        className="panel-right"
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <div className="form-header">
          <h2>BIENVENIDO</h2>
          <p>Ingresa tus credenciales para continuar</p>
        </div>

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
            <label>CONTRASENA</label>
            <div className="input-wrap">
              <FiLock className="field-icon" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="**********"
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

          <div className="remember-row">
            <label className="check-label">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>Recordar sesion</span>
            </label>

            <button
              type="button"
              className="forgot-link"
              onClick={() => navigate('/recuperar-password')}
            >
              Olvidaste tu contrasena?
            </button>
          </div>

          <AnimatePresence>
            {successMsg && (
              <motion.div
                className="success-msg"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {successMsg}
              </motion.div>
            )}

            {error && (
              <motion.div
                className="error-msg"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {canResendVerification ? (
            <motion.button
              type="button"
              className="btn-resend-verification"
              disabled={resendingVerification}
              onClick={handleResendVerification}
              whileHover={!resendingVerification ? { y: -1 } : {}}
              whileTap={!resendingVerification ? { scale: 0.98 } : {}}
            >
              {resendingVerification
                ? 'Enviando correo...'
                : 'Reenviar correo de verificacion'}
            </motion.button>
          ) : null}

          <motion.button
            type="submit"
            className="btn-cta"
            disabled={loading}
            whileHover={!loading ? { y: -1 } : {}}
            whileTap={!loading ? { scale: 0.98 } : {}}
          >
            {loading ? (
              <span className="loading-inner">
                <span className="spin" /> Iniciando sesion...
              </span>
            ) : (
              'INICIAR SESION  ->'
            )}
          </motion.button>

          <motion.button
            type="button"
            className="btn-register"
            onClick={() => navigate('/registro')}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
          >
            REGISTRARSE
          </motion.button>

          <div className="menu-link-row">
            <button
              type="button"
              className="menu-publico-link"
              onClick={() => navigate('/menu-publico')}
            >
              Ver menu sin iniciar sesion -&gt;
            </button>
          </div>
        </form>
      </motion.aside>

      {showForcePasswordModal ? <ForcePasswordChange asModal /> : null}
    </div>
  );
};

export default Login;