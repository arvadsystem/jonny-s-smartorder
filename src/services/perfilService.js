import { apiFetch } from "./api";

export const perfilService = {
  getPerfil: async () => apiFetch("/perfil", "GET"),
  updatePerfil: async (payload) => apiFetch("/perfil", "PUT", payload),
  changePassword: async (payload) => apiFetch("/perfil/password", "PUT", payload),
};
