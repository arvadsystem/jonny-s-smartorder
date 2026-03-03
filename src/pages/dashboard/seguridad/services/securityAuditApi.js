import { apiFetch } from '../../../../services/api';

export const securityAuditApi = {
  getUsuarioDetalle: async (idUsuario) => {
    return apiFetch(`/seguridad/usuarios/${idUsuario}/detalle`, 'GET');
  },

  getUsuarioSesiones: async (idUsuario, qs = '') => {
    return apiFetch(`/seguridad/usuarios/${idUsuario}/sesiones${qs ? `?${qs}` : ''}`, 'GET');
  },

  cerrarSesionesUsuario: async (idUsuario) => {
    return apiFetch(`/seguridad/usuarios/${idUsuario}/sesiones/cerrar`, 'POST');
  },

  getUsuarioLogins: async (idUsuario, qs = '') => {
    return apiFetch(`/seguridad/usuarios/${idUsuario}/logins${qs ? `?${qs}` : ''}`, 'GET');
  }
};
