import { apiFetch } from './api';

// NEW: helper para agregar `?incluir_inactivos=1` de forma retrocompatible.
// WHY: permitir listados admin con inactivos sin cambiar endpoints ni contratos existentes.
// IMPACT: los `get*` siguen funcionando igual si no se pasa opciones.
const withInactivosParam = (path, options) => {
  if (!options || options.incluirInactivos !== true) return path;
  return `${path}${path.includes('?') ? '&' : '?'}incluir_inactivos=1`;
};

// NEW: CONSTRUYE QUERY PARAMS OPCIONALES PARA EL KARDEX FILTRADO.
// WHY: ALMACENES NECESITA PEDIR MOVIMIENTOS POR ALMACEN O SUCURSAL SIN ROMPER LAS LLAMADAS EXISTENTES.
// IMPACT: `GETMOVIMIENTOSINVENTARIO()` SIGUE FUNCIONANDO SIN ARGUMENTOS Y SOLO AGREGA QUERYSTRING CUANDO VIENE `OPTIONS`.
const withMovimientosFilters = (path, options) => {
  if (!options || typeof options !== 'object') return path;

  const params = new URLSearchParams();

  if (options.id_almacen !== undefined && options.id_almacen !== null && options.id_almacen !== '') {
    params.set('id_almacen', String(options.id_almacen));
  }

  if (options.id_sucursal !== undefined && options.id_sucursal !== null && options.id_sucursal !== '') {
    params.set('id_sucursal', String(options.id_sucursal));
  }

  const query = params.toString();
  if (!query) return path;

  return `${path}${path.includes('?') ? '&' : '?'}${query}`;
};

// NEW: CONSTRUYE QUERY PARAMS DEL KARDEX DESDE FILTROS OPCIONALES.
// WHY: LA VISTA `V_KARDEX_DETALLE` SOPORTA FILTROS RICOS Y LA UI DEBE CONSUMIRLOS SIN REPLICAR URLs.
// IMPACT: SOLO AGREGA QUERYSTRING CUANDO HAY FILTROS; EL AUTH/CSRF SIGUE CENTRALIZADO EN `APIFETCH`.
const withKardexFilters = (path, options) => {
  if (!options || typeof options !== 'object') return path;

  const params = new URLSearchParams();

  if (options.id_almacen !== undefined && options.id_almacen !== null && options.id_almacen !== '') {
    params.set('id_almacen', String(options.id_almacen));
  }

  if (options.id_sucursal !== undefined && options.id_sucursal !== null && options.id_sucursal !== '') {
    params.set('id_sucursal', String(options.id_sucursal));
  }

  if (options.tipo !== undefined && options.tipo !== null && options.tipo !== '') {
    params.set('tipo', String(options.tipo));
  }

  if (options.item_tipo !== undefined && options.item_tipo !== null && options.item_tipo !== '') {
    params.set('item_tipo', String(options.item_tipo));
  }

  if (options.id_item !== undefined && options.id_item !== null && options.id_item !== '') {
    params.set('id_item', String(options.id_item));
  }

  if (options.desde !== undefined && options.desde !== null && options.desde !== '') {
    params.set('desde', String(options.desde));
  }

  if (options.hasta !== undefined && options.hasta !== null && options.hasta !== '') {
    params.set('hasta', String(options.hasta));
  }

  if (options.q !== undefined && options.q !== null && options.q !== '') {
    params.set('q', String(options.q));
  }

  const query = params.toString();
  if (!query) return path;

  return `${path}${path.includes('?') ? '&' : '?'}${query}`;
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
  getKardex: (options) => apiFetch(withKardexFilters('/kardex', options), 'GET'),
  getMovimientosInventario: (options) => apiFetch(withMovimientosFilters('/movimientos_inventario', options), 'GET'),
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
