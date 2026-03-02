import { apiFetch } from './api';

// NEW: helper para agregar `?incluir_inactivos=1` de forma retrocompatible.
// WHY: permitir listados admin con inactivos sin cambiar endpoints ni contratos existentes.
// IMPACT: los `get*` siguen funcionando igual si no se pasa opciones.
const withInactivosParam = (path, options) => {
  if (!options || options.incluirInactivos !== true) return path;
  return `${path}${path.includes('?') ? '&' : '?'}incluir_inactivos=1`;
};

const normalizeCatalogRows = (responsePayload) => {
  if (Array.isArray(responsePayload)) return responsePayload;
  if (Array.isArray(responsePayload?.data)) return responsePayload.data;
  if (Array.isArray(responsePayload?.resultado)) return responsePayload.resultado;
  return [];
};

export const inventarioService = {
  // ===== CATEGORIAS PRODUCTOS =====
  getCategorias: (options) => apiFetch(withInactivosParam('/categorias_productos', options), 'GET'),
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

  // NEW: CRUD de categorias de insumos replicando el patron de categorias_productos.
  // WHY: habilitar la UI unificada de "Categorías" sin alterar servicios existentes.
  // IMPACT: agrega endpoints nuevos retrocompatibles; no cambia llamadas actuales.
  getCategoriasInsumos: (options) => apiFetch(withInactivosParam('/categorias_insumos', options), 'GET'),
  crearCategoriaInsumo: (data) => apiFetch('/categorias_insumos', 'POST', data),
  actualizarCategoriaInsumoCampo: (id, campo, valor) =>
    apiFetch('/categorias_insumos', 'PUT', {
      campo,
      valor,
      id_campo: 'id_categoria_insumo',
      id_valor: id
    }),
  eliminarCategoriaInsumo: (id) =>
    apiFetch('/categorias_insumos', 'DELETE', {
      columna_id: 'id_categoria_insumo',
      valor_id: id
    }),

  // ===== INSUMOS =====
  getInsumos: (options) => apiFetch(withInactivosParam('/insumos', options), 'GET'),
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
  getProductos: (options) => apiFetch(withInactivosParam('/productos', options), 'GET'),
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

  // NEW: upload JSON/base64 para registrar imagenes en tabla `archivos`.
  // WHY: Productos e Insumos comparten la misma infraestructura de imagen principal sin multipart.
  // IMPACT: agrega `POST /archivos`; no altera servicios existentes.
  crearArchivoImagen: (data) => apiFetch('/archivos', 'POST', data),

  // ===== TIPO DEPARTAMENTO =====
  getTipoDepartamentos: () => apiFetch('/tipo_departamento', 'GET'),

  // NEW: catalogo de unidades de medida usado por Insumos.
  // WHY: `insumos.id_unidad_medida` ya existe en BD y el listado debe mostrar label/simbolo.
  // IMPACT: normaliza la respuesta del endpoint catalogo y mantiene `apiFetch` en JSON.
  getUnidadesMedida: async () => normalizeCatalogRows(await apiFetch('/parametros/catalogos/unidades_medida', 'GET')),

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
