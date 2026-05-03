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
    }),

  obtenerHorariosSucursal: (idSucursal) => apiFetch(`/sucursales/${idSucursal}/horarios`, 'GET'),
  guardarHorariosSucursal: (idSucursal, horarios) =>
    apiFetch(`/sucursales/${idSucursal}/horarios`, 'PUT', { horarios }),
  obtenerFechasEspecialesSucursal: (idSucursal, filtros = {}) => {
    const params = new URLSearchParams();
    if (filtros?.desde) params.set('desde', String(filtros.desde).trim());
    if (filtros?.hasta) params.set('hasta', String(filtros.hasta).trim());
    if (filtros?.tipo) params.set('tipo', String(filtros.tipo).trim());
    if (filtros?.estado !== undefined && filtros?.estado !== null && filtros?.estado !== '') {
      params.set('estado', String(filtros.estado));
    }
    const query = params.toString();
    return apiFetch(`/sucursales/${idSucursal}/fechas-especiales${query ? `?${query}` : ''}`, 'GET');
  },
  crearFechaEspecialSucursal: (idSucursal, payload) =>
    apiFetch(`/sucursales/${idSucursal}/fechas-especiales`, 'POST', payload),
  actualizarFechaEspecialSucursal: (idSucursal, idFechaEspecial, payload) =>
    apiFetch(`/sucursales/${idSucursal}/fechas-especiales/${idFechaEspecial}`, 'PUT', payload),
  eliminarFechaEspecialSucursal: (idSucursal, idFechaEspecial) =>
    apiFetch(`/sucursales/${idSucursal}/fechas-especiales/${idFechaEspecial}`, 'DELETE')
};

export default sucursalesService;
