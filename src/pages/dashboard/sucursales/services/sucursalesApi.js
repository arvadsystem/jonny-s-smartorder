import sucursalesService from '../../../../services/sucursalesService';

export const sucursalesApi = {
  list() {
    return sucursalesService.getAll();
  },

  create(payload) {
    return sucursalesService.create(payload);
  },

  updateFull(id, payload) {
    return sucursalesService.updateFull(id, payload);
  },

  async toggleEstado(id, nextEstado) {
    const candidates = [nextEstado, nextEstado ? 1 : 0, nextEstado ? '1' : '0', nextEstado ? 'true' : 'false'];
    let lastError = null;

    for (const candidate of candidates) {
      try {
        return await sucursalesService.update(id, 'estado', candidate);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('NO SE PUDO ACTUALIZAR EL ESTADO');
  },

  remove(id) {
    return sucursalesService.delete(id);
  }
};

