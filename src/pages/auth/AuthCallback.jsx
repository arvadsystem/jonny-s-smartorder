import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import clientePublicoService from '../../services/clientePublicoService';
import './Login.scss';

/**
 * AuthCallback — Procesa dos tipos de callback que Supabase envía:
 *
 * 1. VERIFICACIÓN DE EMAIL (signup):
 *    URL: /auth/callback#access_token=...&type=signup
 *    → Llamamos al backend con el access_token para activar la cuenta local
 *    → Redirigimos al login con ?verified=1
 *
 * 2. GOOGLE OAUTH:
 *    URL: /auth/callback#access_token=...  (sin type=signup)
 *    → Llamamos al backend para registrar/identificar usuario y emitir sesión local
 *    → Redirigimos al menú o dashboard según rol
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  const [status, setStatus] = useState('Procesando...');
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const processCallback = async () => {
      try {
        const rawSearch = typeof window !== 'undefined' ? window.location.search || '' : '';
        const directSearchParams = new URLSearchParams(rawSearch);

        const getParam = (...keys) => {
          for (const key of keys) {
            const fromHook = searchParams.get(key);
            if (fromHook) return fromHook;
            const fromDirect = directSearchParams.get(key);
            if (fromDirect) return fromDirect;
          }
          return '';
        };

        // Leer parámetros del hash fragment (#access_token=...&type=signup&...)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const hashType = hashParams.get('type'); // 'signup' para verificación de email

        const verifyToken = getParam('verify_token', 'verifyToken');

        // También puede venir token_hash como query param (flujo manual)
        const tokenHash = getParam('token_hash', 'token');
        const queryType = getParam('type');
        if (verifyToken) {
          setStatus('Verificando tu cuenta...');
          await clientePublicoService.verifyEmail({ token: verifyToken });
          setIsSuccess(true);
          setStatus('Cuenta verificada exitosamente');
          setTimeout(() => navigate('/?verified=1', { replace: true }), 2500);
          return;
        }

        // ── CASO 1: Verificación de email (type=signup en el hash) ──────────
        if (accessToken && hashType === 'signup') {
          setStatus('Verificando tu cuenta...');

          try {
            // Llamar al backend con el access_token para activar el usuario local
            await clientePublicoService.verifyEmail({ access_token: accessToken });
          } catch {
            // Si el backend falla pero Supabase ya verificó, seguimos igual
            // Si el backend falla pero Supabase ya verifico, seguimos igual.
          }

          setIsSuccess(true);
          setStatus('¡Cuenta verificada exitosamente!');

          // Redirigir al login con mensaje de éxito
          setTimeout(() => navigate('/?verified=1', { replace: true }), 2500);
          return;
        }

        // ── CASO 2: Google OAuth (access_token sin type=signup) ─────────────
        if (accessToken && hashType !== 'signup') {
          setStatus('Conectando con Google...');

          const response = await clientePublicoService.googleCallback({
            access_token: accessToken,
            refresh_token: hashParams.get('refresh_token') || null
          });

          if (response?.usuario) {
            login(response);
            const isCliente = response.usuario.tipo_usuario === 'CLIENTE' || response.roles?.includes('Cliente');
            navigate(isCliente ? '/menu-publico' : '/dashboard', { replace: true });
            return;
          }
        }

        // ── CASO 3: token_hash como query param (flujo manual/recuperación) ─
        if (tokenHash && queryType) {
          setStatus('Procesando enlace de seguridad...');

          // Para recovery, redirigir al formulario de reset
          if (queryType === 'recovery') {
            navigate(`/reset-password?token_hash=${tokenHash}&type=${queryType}`, { replace: true });
            return;
          }

          // Para signup via query param
          try {
            await clientePublicoService.verifyEmail({ token_hash: tokenHash, type: queryType });
          } catch {
            // Si el backend falla pero Supabase ya verifico, seguimos igual.
          }

          setIsSuccess(true);
          setStatus('¡Cuenta verificada exitosamente!');
          setTimeout(() => navigate('/?verified=1', { replace: true }), 2500);
          return;
        }

        // Sin parámetros reconocibles
        setError('No se encontraron parámetros de autenticación válidos.');
        setTimeout(() => navigate('/', { replace: true }), 3000);

      } catch (err) {
        setError(err.message || 'Error al procesar la autenticación');
        setTimeout(() => navigate('/', { replace: true }), 3000);
      }
    };

    void processCallback();
  }, [login, navigate, searchParams]);

  return (
    <div className="login-root" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{
        textAlign: 'center',
        maxWidth: 420,
        padding: '3rem 2rem',
        color: '#fdfaf5',
        fontFamily: 'Inter, system-ui, sans-serif'
      }}>
        {error ? (
          <>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚠️</div>
            <h2 style={{ fontSize: '1.3rem', marginBottom: '0.75rem', color: '#ff7b7b' }}>{error}</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
              Redirigiendo al login en unos segundos...
            </p>
          </>
        ) : isSuccess ? (
          <>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', margin: '0 auto 1.25rem',
              background: 'rgba(40,167,69,0.15)', border: '2px solid rgba(40,167,69,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.8rem'
            }}>
              ✅
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              {status}
            </h2>
            <p style={{ color: 'rgba(212,165,116,0.75)', fontSize: '0.85rem' }}>
              Serás redirigido al login para iniciar sesión...
            </p>
          </>
        ) : (
          <>
            <div className="callback-spinner" />
            <h2 style={{ fontSize: '1.2rem', marginTop: '1.5rem', fontWeight: 600, color: '#fdfaf5' }}>
              {status}
            </h2>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
