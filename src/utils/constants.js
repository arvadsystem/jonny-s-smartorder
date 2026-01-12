// Definimos la URL de tu Backend Node.js
// Si en el futuro subes esto a la nube, solo cambias esta línea.
// Leemos la variable de entorno de Vite
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';