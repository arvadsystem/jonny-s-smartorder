import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clientePublicoService from '../../services/clientePublicoService';
import logo from '../../assets/images/logo-sin-fondo.png';
import bgImage from '../../assets/images/imagen-fondo.png';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUser, FiMail, FiLock, FiEye, FiEyeOff, FiCheck } from 'react-icons/fi';
import './Login.scss';

const Registro = () => {
  const navigate = useNavigate();

  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!email.trim() || !password.trim()) {
      setError('Correo y contraseña son obligatorios.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const response = await clientePublicoService.register({ email, clave: password, nombre, apellido });

      if (response?.requiresVerification) {
        setSuccessMsg(`Te hemos enviado un correo de verificación a ${email}. Revisa tu bandeja de entrada para activar tu cuenta.`);
      } else {
        setSuccessMsg(response?.message || 'Registro exitoso.');
      }
    } catch (err) {
      setError(err.message || 'Error al crear la cuenta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-root">

      {/* ── PANEL IZQUIERDO (reutilizado) ──────────────────────── */}
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
          <h2>Crea tu cuenta</h2>
          <p>Regístrate para hacer tus pedidos en línea</p>
        </div>

        {successMsg ? (
          <motion.div
            className="verification-sent"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35 }}
          >
            <div className="verification-icon">
              <FiCheck size={32} />
            </div>
            <h3>¡Revisa tu correo!</h3>
            <p>{successMsg}</p>
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
            <div className="fields-row">
              <div className="field">
                <label>NOMBRE</label>
                <div className="input-wrap">
                  <FiUser className="field-icon" />
                  <input
                    id="register-nombre"
                    type="text"
                    placeholder="Juan"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                  />
                </div>
              </div>
              <div className="field">
                <label>APELLIDO</label>
                <div className="input-wrap">
                  <FiUser className="field-icon" />
                  <input
                    id="register-apellido"
                    type="text"
                    placeholder="Pérez"
                    value={apellido}
                    onChange={(e) => setApellido(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="field">
              <label>CORREO ELECTRÓNICO</label>
              <div className="input-wrap">
                <FiMail className="field-icon" />
                <input
                  id="register-email"
                  type="email"
                  placeholder="tucorreo@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="field">
              <label>CONTRASEÑA</label>
              <div className="input-wrap">
                <FiLock className="field-icon" />
                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
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
                  id="register-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Repite tu contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
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

            <motion.button type="submit" className="btn-cta" disabled={loading} whileHover={!loading ? { y: -1 } : {}} whileTap={!loading ? { scale: 0.98 } : {}}>
              {loading ? <span className="loading-inner"><span className="spin" /> Creando cuenta...</span> : 'CREAR CUENTA  →'}
            </motion.button>

            <p className="login-switch">
              ¿Ya tienes cuenta?{' '}
              <button type="button" className="link-btn" onClick={() => navigate('/')}>
                Inicia sesión
              </button>
            </p>
          </form>
        )}
      </motion.aside>
    </div>
  );
};

export default Registro;
