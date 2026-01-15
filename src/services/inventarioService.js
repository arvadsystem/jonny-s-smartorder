import { apiFetch } from './api';

export const inventarioService = {
  // ===== CATEGORÍAS PRODUCTOS =====
  getCategorias: () => apiFetch('/categorias_productos', 'GET'),

  crearCategoria: (data) => apiFetch('/categorias_productos', 'POST', data),

  actualizarCategoriaCampo: (id, campo, valor) =>
    apiFetch('/categorias_productos', 'PUT', {
      campo,
      valor,
      id_campo: 'id_categoria_producto',
      id_valor: id
    }),

  eliminarCategoria: (id) =>
    apiFetch('/categorias_productos', 'DELETE', {
      columna_id: 'id_categoria_producto',
      valor_id: id
    })
};
