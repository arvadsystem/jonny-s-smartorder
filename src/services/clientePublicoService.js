import { apiFetch } from './api';

/**
 * clientePublicoService
 * Servicio para el flujo público del cliente web.
 * No requiere token para /api/public/menu ni /api/public/register.
 */
const clientePublicoService = {
  /**
   * Registrar un nuevo cliente con email y contraseña.
   * @param {{ email: string, clave: string, nombre?: string, apellido?: string }} data
   */
  register: async (data) => {
    return await apiFetch('/api/public/register', 'POST', data);
  },

  /**
   * Login de cliente con email y contraseña.
   * @param {{ email: string, clave: string }} data
   */
  loginCliente: async (data) => {
    return await apiFetch('/api/public/login', 'POST', data);
  },

  /**
   * Solicitar email de recuperación de contraseña.
   * @param {{ email: string }} data
   */
  forgotPassword: async (data) => {
    return await apiFetch('/api/public/forgot-password', 'POST', data);
  },

  resetPassword: async (data) => {
    return await apiFetch('/api/public/reset-password', 'POST', data);
  },

  /**
   * Obtener el menú público completo.
   */
  getMenu: async () => {
    return await apiFetch('/api/public/menu', 'GET');
  },

  /**
   * Obtener detalle de un ítem del menú.
   * @param {number} id
   */
  getMenuItem: async (id) => {
    return await apiFetch(`/api/public/menu/${id}`, 'GET');
  },

  /**
   * Callback de Google OAuth — envía access_token al backend.
   * @param {{ access_token: string, refresh_token?: string }} data
   */
  googleCallback: async (data) => {
    return await apiFetch('/api/public/google-callback', 'POST', data);
  },

  /**
   * Verificar email con token del link enviado.
   * @param {{ token_hash: string, type: string }} data
   */
  verifyEmail: async (data) => {
    return await apiFetch('/api/public/verify-email', 'POST', data);
  }
};

export default clientePublicoService;
