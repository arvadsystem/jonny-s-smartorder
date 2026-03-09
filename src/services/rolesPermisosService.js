import { apiFetch } from './api';

const BASE_PATH = '/api/roles-permisos';

export const rolesPermisosService = {
  getRoles: async () => {
    return apiFetch(`${BASE_PATH}/roles`, 'GET');
  },

  getPermisos: async () => {
    return apiFetch(`${BASE_PATH}/permisos`, 'GET');
  },

  getRolDetalle: async (idRol, params = {}) => {
    const query = new URLSearchParams();

    if (params.page !== undefined && params.page !== null) {
      query.set('page', String(params.page));
    }

    if (params.limit !== undefined && params.limit !== null) {
      query.set('limit', String(params.limit));
    }

    if (params.search !== undefined && params.search !== null) {
      const term = String(params.search).trim();
      if (term) query.set('search', term);
    }

    const suffix = query.toString();
    const url = suffix
      ? `${BASE_PATH}/rol/${idRol}?${suffix}`
      : `${BASE_PATH}/rol/${idRol}`;

    return apiFetch(url, 'GET');
  },

  updateRolPermisos: async (idRol, permisos) => {
    return apiFetch(`${BASE_PATH}/rol/${idRol}`, 'PUT', { permisos });
  },

  getRolUsuarios: async (idRol) => {
    return apiFetch(`${BASE_PATH}/rol/${idRol}/usuarios`, 'GET');
  }
};
