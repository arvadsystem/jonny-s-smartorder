import { apiFetch } from './api'; // Importa el helper HTTP central con manejo de auth/csrf/errores.

const normalizeCatalogRows = (responsePayload) => { // Normaliza diferentes formas de respuesta a un arreglo de filas.
  if (Array.isArray(responsePayload)) return responsePayload; // Soporta respuestas que ya vienen como arreglo directo.
  if (Array.isArray(responsePayload?.data)) return responsePayload.data; // Soporta respuestas con forma { data: [] }.
  if (Array.isArray(responsePayload?.resultado)) return responsePayload.resultado; // Soporta respuestas con forma { resultado: [] }.
  return []; // Entrega arreglo vacio cuando la forma no es reconocida.
}; // Cierra la funcion de normalizacion.

export const parametrosService = { // Expone operaciones CRUD para catalogos de Parametros.
  listarCatalogo: async (tabla) => { // Lista los registros de una tabla catalogo.
    const response = await apiFetch(`/parametros/catalogos/${tabla}`, 'GET'); // Llama al endpoint GET generico de catalogos.
    return normalizeCatalogRows(response); // Devuelve siempre un arreglo util para la UI.
  }, // Cierra listarCatalogo.
  crearCatalogo: (tabla, payload) => apiFetch(`/parametros/catalogos/${tabla}`, 'POST', payload), // Crea un registro en la tabla catalogo.
  actualizarCatalogoCampo: (tabla, payload) => apiFetch(`/parametros/catalogos/${tabla}`, 'PUT', payload), // Actualiza un campo puntual del registro.
  eliminarCatalogo: (tabla, payload) => apiFetch(`/parametros/catalogos/${tabla}`, 'DELETE', payload) // Elimina un registro por id.
}; // Cierra el objeto de servicio.
