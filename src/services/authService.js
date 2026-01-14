import { apiFetch } from './api';

const authService = {
  login: async (credentials) => {
    return await apiFetch('/login', 'POST', credentials);
  },

  me: async () => {
    return await apiFetch('/me', 'GET');
  },

  logout: async () => {
    return await apiFetch('/logout', 'POST');
  }
};

export default authService;
