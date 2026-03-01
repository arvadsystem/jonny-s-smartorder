import { apiFetch } from './api';

export const securityService = {
  // HU78
  getLoginLogs: async (qs = '') => {
    return apiFetch(`/seguridad/logins${qs ? `?${qs}` : ''}`, 'GET');
  },

  // HU79 - Sesiones (usuario actual)
  // ✅ Nota: ahora acepta querystring opcional (para cache-bust con _ts)
  getSesiones: async (qs = '') => {
    return apiFetch(`/seguridad/sesiones${qs ? `?${qs}` : ''}`, 'GET');
  },

  cerrarSesion: async (id_sesion) => {
    return apiFetch('/seguridad/sesiones/cerrar', 'POST', { id_sesion });
  },

  cerrarOtras: async () => {
    return apiFetch('/seguridad/sesiones/cerrar-otras', 'POST');
  },

  // Sprint 3 - GLOBAL (Super Admin)
  getSesionesGlobal: async (qs = '') => {
    return apiFetch(`/seguridad/sesiones/global${qs ? `?${qs}` : ''}`, 'GET');
  },

  cerrarGlobalMenosActual: async () => {
    return apiFetch('/seguridad/sesiones/cerrar-global-menos-actual', 'POST');
  },

  // HU84 - Cerrar 1 sesión específica (Super Admin)
  cerrarSesionGlobal: async (id_sesion) => {
    return apiFetch('/seguridad/sesiones/cerrar-global', 'POST', { id_sesion });
  },

  // HU1085 - Usuarios globales (Super Admin)
  getUsuariosGlobal: async (qs = '') => {
    return apiFetch(`/seguridad/usuarios/global${qs ? `?${qs}` : ''}`, 'GET');
  },

  // HU81 - Políticas contraseña
  getPasswordPolicies: async () => {
    return apiFetch('/seguridad/configuracion/password', 'GET');
  },

  updatePasswordPolicies: async (payload) => {
    return apiFetch('/seguridad/configuracion/password', 'PUT', payload);
  },
};