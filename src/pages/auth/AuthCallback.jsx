import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabaseClient';
import clientePublicoService from '../../services/clientePublicoService';
import './Login.scss';

const PUBLIC_LOGIN_PATH = '/auth/login';

const cleanCallbackUrl = () => {
  if (typeof window === 'undefined') return;
  window.history.replaceState({}, document.title, window.location.pathname);
};

const normalizeAuthType = (value) => String(value || '').trim().toLowerCase();

const resolveCallbackErrorMessage = (error) => {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || error?.status || '').toLowerCase();

  if (message.includes('expired') || code.includes('expired')) {
    return 'El enlace expiro. Solicita uno nuevo.';
  }
  if (message.includes('already') || message.includes('used') || message.includes('reused')) {
    return 'El enlace ya fue utilizado. Solicita uno nuevo si necesitas continuar.';
  }
  if (message.includes('invalid') || message.includes('not found') || code.includes('invalid')) {
    return 'El enlace no es valido. Solicita uno nuevo.';
  }
  return 'No se pudo procesar el enlace de autenticacion.';
};

const resolveNextPath = (value, fallback = PUBLIC_LOGIN_PATH) => {
  const raw = String(value || '').trim();
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return fallback;
  return raw;
};

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
        const directSearchParams = new URLSearchParams(window.location.search || '');
        const hashParams = new URLSearchParams(window.location.hash.substring(1));

        const getParam = (...keys) => {
          for (const key of keys) {
            const fromHook = searchParams.get(key);
            if (fromHook) return fromHook;
            const fromDirect = directSearchParams.get(key);
            if (fromDirect) return fromDirect;
            const fromHash = hashParams.get(key);
            if (fromHash) return fromHash;
          }
          return '';
        };

        const code = getParam('code');
        const tokenHash = getParam('token_hash');
        const type = normalizeAuthType(getParam('type'));
        const verifyToken = getParam('verify_token', 'verifyToken');
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const nextPath = resolveNextPath(getParam('next'), type === 'recovery' ? '/reset-password' : PUBLIC_LOGIN_PATH);

        if (verifyToken) {
          cleanCallbackUrl();
          setStatus('Verificando tu cuenta...');
          await clientePublicoService.verifyEmail({ token: verifyToken });
          setIsSuccess(true);
          setStatus('Cuenta verificada exitosamente');
          setTimeout(() => navigate(`${PUBLIC_LOGIN_PATH}?verified=1`, { replace: true }), 1800);
          return;
        }

        if (code) {
          setStatus('Validando enlace...');
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          cleanCallbackUrl();

          const session = data?.session;
          const resolvedType = type || normalizeAuthType(data?.user?.aud);
          if (resolvedType === 'recovery' || nextPath === '/reset-password') {
            navigate('/reset-password', { replace: true });
            return;
          }

          if ((type === 'signup' || type === 'email') && session?.access_token) {
            await clientePublicoService.verifyEmail({ access_token: session.access_token }).catch(() => {});
            setIsSuccess(true);
            setStatus('Cuenta verificada exitosamente');
            setTimeout(() => navigate(`${PUBLIC_LOGIN_PATH}?verified=1`, { replace: true }), 1800);
            return;
          }

          if (session?.access_token) {
            const response = await clientePublicoService.googleCallback({
              access_token: session.access_token,
              refresh_token: session.refresh_token || null
            });

            if (response?.usuario) {
              login(response);
              const isCliente = response.usuario.tipo_usuario === 'CLIENTE' || response.roles?.includes('Cliente');
              navigate(isCliente ? '/menu-publico' : '/dashboard', { replace: true });
              return;
            }
          }

          navigate(nextPath, { replace: true });
          return;
        }

        if (tokenHash && type) {
          setStatus(type === 'recovery' ? 'Validando recuperacion...' : 'Verificando tu cuenta...');
          const { data, error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type
          });
          if (verifyError) throw verifyError;
          cleanCallbackUrl();

          if (type === 'recovery') {
            navigate('/reset-password', { replace: true });
            return;
          }

          const session = data?.session;
          if (session?.access_token) {
            await clientePublicoService.verifyEmail({ access_token: session.access_token }).catch(() => {});
          } else {
            await clientePublicoService.verifyEmail({ token_hash: tokenHash, type }).catch(() => {});
          }

          setIsSuccess(true);
          setStatus('Cuenta verificada exitosamente');
          setTimeout(() => navigate(`${PUBLIC_LOGIN_PATH}?verified=1`, { replace: true }), 1800);
          return;
        }

        if (accessToken && refreshToken) {
          setStatus('Restaurando sesion...');
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          if (sessionError) throw sessionError;
          cleanCallbackUrl();

          if (type === 'recovery' || nextPath === '/reset-password') {
            navigate('/reset-password', { replace: true });
            return;
          }

          if (type === 'signup' || type === 'email') {
            await clientePublicoService.verifyEmail({ access_token: accessToken }).catch(() => {});
            setIsSuccess(true);
            setStatus('Cuenta verificada exitosamente');
            setTimeout(() => navigate(`${PUBLIC_LOGIN_PATH}?verified=1`, { replace: true }), 1800);
            return;
          }

          const response = await clientePublicoService.googleCallback({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          if (response?.usuario) {
            login(response);
            const isCliente = response.usuario.tipo_usuario === 'CLIENTE' || response.roles?.includes('Cliente');
            navigate(isCliente ? '/menu-publico' : '/dashboard', { replace: true });
            return;
          }

          if (data?.session) {
            navigate(nextPath, { replace: true });
            return;
          }
        }

        cleanCallbackUrl();
        setError('No se encontraron parametros de autenticacion validos.');
        setTimeout(() => navigate(PUBLIC_LOGIN_PATH, { replace: true }), 2500);
      } catch (err) {
        cleanCallbackUrl();
        setError(resolveCallbackErrorMessage(err));
        setTimeout(() => navigate(PUBLIC_LOGIN_PATH, { replace: true }), 3500);
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
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>!</div>
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
              OK
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              {status}
            </h2>
            <p style={{ color: 'rgba(212,165,116,0.75)', fontSize: '0.85rem' }}>
              Seras redirigido al login para iniciar sesion...
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
