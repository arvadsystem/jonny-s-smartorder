import { API_URL } from '../utils/constants';

export const ventaPayloadExample = {
  id_cliente: 2,
  id_sucursal: 1,
  metodo_pago: 'efectivo',
  descuento: 10,
  efectivo_entregado: 300,
  descripcion_envio: 'Para llevar',
  items: [
    {
      id_producto: 127,
      id_combo: null,
      id_receta: null,
      cantidad: 2
    },
    {
      id_producto: null,
      id_combo: 3,
      id_receta: null,
      cantidad: 1,
      observacion: 'sin cebolla, extra salsa'
    },
    {
      id_producto: null,
      id_combo: null,
      id_receta: 15,
      cantidad: 1,
      observacion: 'bien cocido'
    }
  ]
};

const readBody = async (response) => {
  const text = await response.text().catch(() => '');
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const getCookie = (name) => {
  if (typeof document === 'undefined') return null;

  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));

  if (!match) return null;

  const value = match.split('=').slice(1).join('=');
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const createVentaNative = async (payload) => {
  const headers = {
    'Content-Type': 'application/json'
  };

  const csrfToken = getCookie('csrf_token');
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  const response = await fetch(`${API_URL}/ventas`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(payload)
  });

  const data = await readBody(response);

  if (!response.ok) {
    const message =
      (data && typeof data === 'object' && (data.message || data.mensaje)) ||
      (typeof data === 'string' ? data : '') ||
      `Error HTTP ${response.status}`;

    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
};
