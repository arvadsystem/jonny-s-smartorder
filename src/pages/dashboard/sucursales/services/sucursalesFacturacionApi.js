import { apiFetch } from '../../../../services/api';

const unwrapSuccessPayload = (response) => {
  if (response && typeof response === 'object' && Object.prototype.hasOwnProperty.call(response, 'success')) {
    return response.data;
  }
  return response;
};

export const sucursalesFacturacionApi = {
  async obtenerFacturacionSucursal(idSucursal) {
    const response = await apiFetch(`/sucursales/${idSucursal}/facturacion-config`, 'GET');
    return unwrapSuccessPayload(response);
  },

  async guardarFacturacionSucursal(idSucursal, payload) {
    const response = await apiFetch(`/sucursales/${idSucursal}/facturacion-config`, 'PUT', payload);
    return unwrapSuccessPayload(response);
  },

  async subirLogoFacturacion(payload) {
    return apiFetch('/archivos', 'POST', {
      ...payload,
      bucket: 'admin-docs',
      contexto: 'facturacion-logo'
    });
  },

  async obtenerUrlArchivo(idArchivo) {
    return apiFetch(`/archivos/${idArchivo}/ver`, 'GET');
  },

  async eliminarArchivo(idArchivo) {
    return apiFetch(`/archivos/${idArchivo}`, 'DELETE');
  },

  async obtenerPreviewFacturacionSucursal(idSucursal) {
    const response = await apiFetch(`/sucursales/${idSucursal}/facturacion-preview`, 'GET');
    return unwrapSuccessPayload(response);
  },

  async obtenerImpresorasSucursal(idSucursal) {
    const response = await apiFetch(`/sucursales/${idSucursal}/impresoras-config`, 'GET');
    return unwrapSuccessPayload(response);
  },

  async guardarImpresorasSucursal(idSucursal, payload) {
    const response = await apiFetch(`/sucursales/${idSucursal}/impresoras-config`, 'PUT', payload);
    return unwrapSuccessPayload(response);
  },

  async obtenerRangosCaiSucursal(idSucursal) {
    const response = await apiFetch(`/sucursales/${idSucursal}/facturacion-rangos-cai`, 'GET');
    return unwrapSuccessPayload(response);
  },

  async crearRangoCaiSucursal(idSucursal, payload) {
    const response = await apiFetch(`/sucursales/${idSucursal}/facturacion-rangos-cai`, 'POST', payload);
    return unwrapSuccessPayload(response);
  },

  async activarRangoCaiSucursal(idSucursal, idRango) {
    const response = await apiFetch(`/sucursales/${idSucursal}/facturacion-rangos-cai/${idRango}/activar`, 'PATCH', {});
    return unwrapSuccessPayload(response);
  },

  async desactivarRangoCaiSucursal(idSucursal, idRango) {
    const response = await apiFetch(`/sucursales/${idSucursal}/facturacion-rangos-cai/${idRango}/desactivar`, 'PATCH', {});
    return unwrapSuccessPayload(response);
  }
};
