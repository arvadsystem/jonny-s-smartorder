import { apiFetch } from "./api";

export const securityService = {
  // HU79
  getSesiones: async () => apiFetch("/seguridad/sesiones", "GET"),
  cerrarSesion: async (id_sesion) =>
    apiFetch("/seguridad/sesiones/cerrar", "POST", { id_sesion }),
  cerrarOtras: async () => apiFetch("/seguridad/sesiones/cerrar-otras", "POST"),

  // HU81
  getPasswordPolicies: async () => apiFetch("/seguridad/configuracion/password", "GET"),
  updatePasswordPolicies: async (payload) =>
    apiFetch("/seguridad/configuracion/password", "PUT", payload),
};
