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

  async obtenerPreviewFacturacionSucursal(idSucursal) {
    const response = await apiFetch(`/sucursales/${idSucursal}/facturacion-preview`, 'GET');
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
