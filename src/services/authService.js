import { apiFetch } from './api';

const authService = {
  login: async (credentials) => {
    return await apiFetch('/login', 'POST', credentials);
  },

  me: async (config = {}) => {
    return await apiFetch('/me', 'GET', null, config);
  },

  logout: async () => {
    return await apiFetch('/logout', 'POST');
  }
};

export default authService;
