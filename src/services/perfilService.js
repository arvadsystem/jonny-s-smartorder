import { apiFetch } from "./api";

export const perfilService = {
  getPerfil: async (config = {}) => apiFetch("/perfil", "GET", null, config),
  updatePerfil: async (payload) => apiFetch("/perfil", "PUT", payload),
  changePassword: async (payload) => apiFetch("/perfil/password", "PUT", payload),
};
