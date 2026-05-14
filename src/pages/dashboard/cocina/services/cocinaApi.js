import cocinaService from '../../../../services/cocinaService';

export const cocinaApi = {
  listPedidos(params = {}) {
    return cocinaService.listPedidos(params);
  },

  updateEstado(idPedido, estadoDestino) {
    return cocinaService.updatePedidoEstado(idPedido, {
      estado_destino: estadoDestino
    });
  }
};
