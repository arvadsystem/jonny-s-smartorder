import cocinaService from '../../../../services/cocinaService';

export const cocinaApi = {
  listPedidos(params = {}, config = {}) {
    return cocinaService.listPedidos(params, config);
  },

  getInventarioAlertas(idPedido) {
    return cocinaService.getInventarioAlertas(idPedido);
  },

  updateEstado(idPedido, estadoDestino) {
    return cocinaService.updatePedidoEstado(idPedido, {
      estado_destino: estadoDestino
    });
  }
};
