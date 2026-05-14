import ventasService from '../../../../services/ventasService';

// Centraliza el puente MENU POS -> modulo Ventas sin tocar la logica interna de ventas.
export const submitMenuPosOrder = async (payload) => ventasService.create(payload);
