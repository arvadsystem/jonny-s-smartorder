import { apiFetch } from './api';

export const inventarioService = {
  // ===== CATEGORIAS PRODUCTOS =====
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
    }),

  // ===== INSUMOS =====
  getInsumos: () => apiFetch('/insumos', 'GET'),
  getAlmacenes: () => apiFetch('/almacenes', 'GET'),
  crearInsumo: (data) => apiFetch('/insumos', 'POST', data),
  actualizarInsumoCampo: (id, campo, valor) =>
    apiFetch('/insumos', 'PUT', {
      campo,
      valor,
      id_campo: 'id_insumo',
      id_valor: id
    }),
  eliminarInsumo: (id) =>
    apiFetch('/insumos', 'DELETE', {
      columna_id: 'id_insumo',
      valor_id: id
    }),

  // ===== PRODUCTOS =====
  getProductos: () => apiFetch('/productos', 'GET'),
  crearProducto: (data) => apiFetch('/productos', 'POST', data),
  actualizarProductoCampo: (id, campo, valor) =>
    apiFetch('/productos', 'PUT', {
      campo,
      valor,
      id_campo: 'id_producto',
      id_valor: id
    }),
  eliminarProducto: (id) =>
    apiFetch('/productos', 'DELETE', {
      columna_id: 'id_producto',
      valor_id: id
    }),

  // ===== TIPO DEPARTAMENTO =====
  getTipoDepartamentos: () => apiFetch('/tipo_departamento', 'GET'),

  // ===== ALMACENES =====
  crearAlmacen: (data) => apiFetch('/almacenes', 'POST', data),
  actualizarAlmacenCampo: (id, campo, valor) =>
    apiFetch('/almacenes', 'PUT', {
      campo,
      valor,
      id_campo: 'id_almacen',
      id_valor: id
    }),
  eliminarAlmacen: (id) =>
    apiFetch('/almacenes', 'DELETE', {
      columna_id: 'id_almacen',
      valor_id: id
    }),

  // ===== MOVIMIENTOS INVENTARIO (KARDEX) =====
  getMovimientosInventario: () => apiFetch('/movimientos_inventario', 'GET'),
  crearMovimientoInventario: (data) => apiFetch('/movimientos_inventario', 'POST', data),
  actualizarMovimientoInventarioCampo: (id, campo, valor) =>
    apiFetch('/movimientos_inventario', 'PUT', {
      campo,
      valor,
      id_campo: 'id_movimiento',
      id_valor: id
    }),
  eliminarMovimientoInventario: (id) =>
    apiFetch('/movimientos_inventario', 'DELETE', {
      columna_id: 'id_movimiento',
      valor_id: id
    })
};
