import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clientePublicoService from '../../services/clientePublicoService';
import logo from '../../assets/images/logo-sin-fondo.png';
import bgImage from '../../assets/images/imagen-fondo.png';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMail, FiArrowLeft } from 'react-icons/fi';
import './Login.scss';

const _MOTION = motion;

const RecuperarPassword = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!email.trim()) {
      setError('Ingresa tu correo electrónico.');
      return;
    }

    setLoading(true);
    try {
      const response = await clientePublicoService.forgotPassword({ email });
      setSuccessMsg(response?.message || 'Si el correo está registrado, recibirás instrucciones de recuperación.');
    } catch (err) {
      setError(err.message || 'Error al enviar el correo');
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
          <h2>Recuperar contraseña</h2>
          <p>Te enviaremos instrucciones de recuperación a tu correo</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="field">
            <label>TU CORREO ELECTRÓNICO</label>
            <div className="input-wrap">
              <FiMail className="field-icon" />
              <input
                id="recovery-email"
                type="email"
                placeholder="tucorreo@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div className="error-msg" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {error}
              </motion.div>
            )}
            {successMsg && (
              <motion.div className="success-msg" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {successMsg}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button type="submit" className="btn-cta" disabled={loading} whileHover={!loading ? { y: -1 } : {}} whileTap={!loading ? { scale: 0.98 } : {}}>
            {loading ? <span className="loading-inner"><span className="spin" /> Enviando...</span> : 'ENVIAR ENLACE  →'}
          </motion.button>

          <p className="login-switch">
            <button type="button" className="link-btn" onClick={() => navigate('/auth/login')}>
              <FiArrowLeft style={{ marginRight: '0.3rem', verticalAlign: 'middle' }} />
              Volver al login
            </button>
          </p>
        </form>
      </motion.aside>
    </div>
  );
};

export default RecuperarPassword;
