import { apiFetch } from './api';

/**
 * clientePublicoService
 * Servicio para el flujo público del cliente web.
 * Registro/login no requieren token para /api/public/register y /api/public/login.
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
   * DEPRECATED: el flujo público ahora usa /api/public-menu/*.
   */
  getMenu: async () => {
    throw new Error('clientePublicoService.getMenu esta deprecado. Usa src/modules/public-menu/services/publicMenuBootstrapService.');
  },

  /**
   * DEPRECATED: el flujo público ahora usa /api/public-menu/*.
   * @param {number} id
   */
  getMenuItem: async (_id) => {
    throw new Error('clientePublicoService.getMenuItem esta deprecado. Usa src/modules/public-menu/services/publicMenuBootstrapService.');
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
