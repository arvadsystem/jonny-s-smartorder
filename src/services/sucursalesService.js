// IMPORTANTE: Importamos { apiFetch } con llaves.
import { apiFetch } from './api'; 

const sucursalesService = {
  // GET: Obtener todas
  // apiFetch ya devuelve la data procesada, no uses .data aquí
  getAll: () => apiFetch('/sucursales', 'GET'),

  // POST: Crear
  create: (data) => apiFetch('/sucursales', 'POST', data),

  // PUT: Actualizarr
  update: (id, campo, valor) => 
    apiFetch('/sucursales', 'PUT', {
      campo,
      valor,
      id_campo: 'id_sucursal',
      id_valor: id
    }),
    updateFull: (id, data) => 
    apiFetch(`/sucursales/${id}`, 'PUT', data),

  // DELETE: Eliminar
  delete: (id) => 
    apiFetch('/sucursales', 'DELETE', {
      columna_id: 'id_sucursal',
      valor_id: id
    })
};

export default sucursalesService;