const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

const parsePublicHttpsUrl = (value, variableName) => {
  const rawValue = String(value || '').trim();
  if (!rawValue) {
    throw new Error(`${variableName} es obligatoria para el build de produccion.`);
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(rawValue);
  } catch {
    throw new Error(`${variableName} debe ser una URL valida.`);
  }

  if (parsedUrl.protocol !== 'https:') {
    throw new Error(`${variableName} debe usar HTTPS.`);
  }

  if (LOCAL_HOSTNAMES.has(parsedUrl.hostname.toLowerCase())) {
    throw new Error(`${variableName} no puede apuntar a localhost.`);
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw new Error(`${variableName} no puede incluir credenciales.`);
  }

  return rawValue.replace(/\/+$/, '');
};

export const validateProductionApiUrl = (value) => (
  parsePublicHttpsUrl(value, 'VITE_API_URL')
);

export const validateFrontendBuildEnv = (env = {}) => ({
  apiUrl: validateProductionApiUrl(env.VITE_API_URL)
});

export const resolveOptionalSupabasePublicUrl = (value) => {
  try {
    return parsePublicHttpsUrl(value, 'VITE_SUPABASE_URL');
  } catch {
    return '';
  }
};
