import { API_URL } from '../utils/constants';

// Función genérica para hacer peticiones
export const apiFetch = async (endpoint, method = 'GET', body = null) => {
    
    // Configuración básica de cabeceras
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            // Aquí agregaríamos el token de autorización en el futuro
            // 'Authorization': `Bearer ${token}` 
        },
    };

    // Si hay datos para enviar (POST/PUT), los convertimos a String
    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        // Ejecutamos el fetch uniendo la URL base con el endpoint (ej: /login)
        const response = await fetch(`${API_URL}${endpoint}`, options);

        // Fetch no lanza error si el status es 400 o 500, hay que validarlo manual:
        if (!response.ok) {
            // Intentamos leer el mensaje de error que envía el backend
            const errorData = await response.json().catch(() => ({}));
            // Lanzamos un error para que el 'catch' del componente lo capture
            throw new Error(errorData.message || `Error HTTP: ${response.status}`);
        }

        // Si todo sale bien, devolvemos el JSON parseado
        return await response.json();

    } catch (error) {
        // Relanzamos el error para manejarlo en el componente
        throw error;
    }
};