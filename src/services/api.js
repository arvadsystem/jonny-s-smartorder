import { API_URL } from '../utils/constants';

// Función genérica para hacer peticiones
export const apiFetch = async (endpoint, method = 'GET', body = null) => {
    
    // 1. Recuperamos el token del almacenamiento local
    const token = localStorage.getItem('token');

    // 2. Configuramos los headers
    const headers = {
        'Content-Type': 'application/json',
    };

    // Si hay token, lo inyectamos en la cabecera Authorization
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const options = {
        method,
        headers,
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, options);

        // 3. Manejo de error 401 (No autorizado / Token vencido)
        if (response.status === 401) {
            console.warn("Sesión expirada o token inválido. Cerrando sesión...");
            
            // Limpiamos todo rastro de la sesión
            localStorage.removeItem('token');
            localStorage.removeItem('usuario');
            
            // Forzamos la recarga y redirección al Login
            // Usamos window.location en lugar de navigate porque este es un archivo JS puro, no un componente React
            window.location.href = '/';
            return; 
        }

        // Si la respuesta no es OK (ej: 400, 500, etc, pero no 401)
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Error HTTP: ${response.status}`);
        }

        // Si todo sale bien, devolvemos el JSON
        return await response.json();

    } catch (error) {
        throw error;
    }
};