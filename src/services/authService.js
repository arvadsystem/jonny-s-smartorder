import { apiFetch } from './api';

const authService = {
    // Login
    login: async (credentials) => {
        // credentials ahora será: 
        // { "nombre_usuario": "Admin", "clave": "12345" }
        return await apiFetch('/login', 'POST', credentials);
    },

    // Registro
    register: async (userData) => {
        return await apiFetch('/usuarios', 'POST', userData);
    }
};

export default authService;