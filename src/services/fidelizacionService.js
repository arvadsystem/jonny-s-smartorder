import { apiFetch } from './api';

const buildQuery = (params = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (typeof value === 'string' && value.trim() === '') return;
    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

const fidelizacionService = {
  getPanel: (params = {}) => apiFetch(`/fidelizacion/panel${buildQuery(params)}`, 'GET'),
  
  listClientes: (params = {}) => apiFetch(`/fidelizacion/clientes${buildQuery(params)}`, 'GET'),
  
  getClienteById: (idCliente, params = {}) => 
    apiFetch(`/fidelizacion/clientes/${idCliente}${buildQuery(params)}`, 'GET'),
    
  getClienteMovimientos: (idCliente, params = {}) => 
    apiFetch(`/fidelizacion/clientes/${idCliente}/movimientos${buildQuery(params)}`, 'GET'),
    
  getClienteCanjeables: (idCliente, params = {}) => 
    apiFetch(`/fidelizacion/clientes/${idCliente}/canjeables${buildQuery(params)}`, 'GET'),
    
  getConfiguracion: (params = {}) => apiFetch(`/fidelizacion/configuracion${buildQuery(params)}`, 'GET'),
  
  saveConfiguracion: (payload) => apiFetch('/fidelizacion/configuracion', 'PUT', payload),
  
  createCanje: (payload) => apiFetch('/fidelizacion/canjes', 'POST', payload),
  
  listCanjes: (params = {}) => apiFetch(`/fidelizacion/canjes${buildQuery(params)}`, 'GET'),
  
  getCanjeById: (idCanje) => apiFetch(`/fidelizacion/canjes/${idCanje}`, 'GET')
};

export default fidelizacionService;
