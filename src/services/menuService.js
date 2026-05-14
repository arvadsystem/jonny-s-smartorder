import apiFetch from './api'; // // Reutiliza tu helper apiFetch (misma forma que ya usan tus compas)

// // Obtiene productos por categoría (HU-65)
// // Llama al endpoint: GET /menu-pos/productos/:id_tipo_departamento
export const getProductosPorCategoria = async (idTipoDepartamento) => {
  // // Construye la URL con el id de la categoría
  const url = `/menu-pos/productos/${idTipoDepartamento}`; // // Endpoint del backend

  // // Llama al helper que ya maneja JWT/CSRF/cookies según tu proyecto
  const data = await apiFetch(url, { method: 'GET' }); // // Petición GET

  // // Tu backend retorna { ok, total, data }, devolvemos data para la UI
  return data?.data || []; // // Lista de productos
};