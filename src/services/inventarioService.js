import { apiFetch } from './api';

// NEW: helper para agregar `?incluir_inactivos=1` de forma retrocompatible.
// WHY: permitir listados admin con inactivos sin cambiar endpoints ni contratos existentes.
// IMPACT: los `get*` siguen funcionando igual si no se pasa opciones.
const withInactivosParam = (path, options) => {
  if (!options || options.incluirInactivos !== true) return path;
  return `${path}${path.includes('?') ? '&' : '?'}incluir_inactivos=1`;
};

// AM: filtros opcionales de catalogo para OC (estado + alcance por sucursal/almacen).
// AM: mantiene compatibilidad porque solo agrega query params cuando vienen en `options`.
const withItemCatalogFilters = (path, options) => {
  if (!options || typeof options !== 'object') return path;

  const params = new URLSearchParams();
  const includeInactivos =
    options.incluirInactivos === true ||
    options.includeInactivos === true ||
    options.include_inactivos === true;

  if (includeInactivos) params.set('incluir_inactivos', '1');

  if (options.id_sucursal !== undefined && options.id_sucursal !== null && options.id_sucursal !== '') {
    params.set('id_sucursal', String(options.id_sucursal));
  }

  if (options.id_almacen !== undefined && options.id_almacen !== null && options.id_almacen !== '') {
    params.set('id_almacen', String(options.id_almacen));
  }

  const query = params.toString();
  if (!query) return path;
  return `${path}${path.includes('?') ? '&' : '?'}${query}`;
};

const withAlmacenesFilters = (path, options) => {
  if (!options || typeof options !== 'object') return path;

  const includeInactivos =
    options.include_inactivos === true ||
    options.includeInactivos === true ||
    options.incluirInactivos === true;

  if (!includeInactivos) return path;
  return `${path}${path.includes('?') ? '&' : '?'}include_inactivos=1`;
};

// AM: helper de filtros para proveedores manteniendo compatibilidad del endpoint base.
const withProveedoresFilters = (path, options) => {
  if (!options || typeof options !== 'object') return path;

  const includeInactivos =
    options.include_inactivos === true ||
    options.includeInactivos === true ||
    options.incluirInactivos === true;

  if (!includeInactivos) return path;
  return `${path}${path.includes('?') ? '&' : '?'}include_inactivos=1`;
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

// AM: construye query params para listado de ordenes de compra workflow.
// AM: permite scope/estado/busqueda/paginacion sin romper contratos existentes.
const withOrdenesCompraFilters = (path, options) => {
  if (!options || typeof options !== 'object') return path;

  const params = new URLSearchParams();

  if (options.scope !== undefined && options.scope !== null && options.scope !== '') {
    params.set('scope', String(options.scope));
  }

  if (options.estado !== undefined && options.estado !== null && options.estado !== '') {
    params.set('estado', String(options.estado));
  }

  if (options.q !== undefined && options.q !== null && options.q !== '') {
    params.set('q', String(options.q));
  }

  if (options.page !== undefined && options.page !== null && options.page !== '') {
    params.set('page', String(options.page));
  }

  if (options.limit !== undefined && options.limit !== null && options.limit !== '') {
    params.set('limit', String(options.limit));
  }

  if (options.id_sucursal !== undefined && options.id_sucursal !== null && options.id_sucursal !== '') {
    params.set('id_sucursal', String(options.id_sucursal));
  }

  if (options.id_almacen !== undefined && options.id_almacen !== null && options.id_almacen !== '') {
    params.set('id_almacen', String(options.id_almacen));
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

// AM: normaliza el catalogo de almacenes y filtra filas invalidas para evitar selects vacios por payloads mixtos.
const normalizeAlmacenesRows = (responsePayload) => (
  normalizeCatalogRows(responsePayload).filter((row) => {
    const idAlmacen = Number.parseInt(String(row?.id_almacen ?? ''), 10);
    return Number.isInteger(idAlmacen) && idAlmacen > 0;
  })
);

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
  getInsumos: (options) => apiFetch(withItemCatalogFilters('/insumos', options), 'GET'),
  // AM: carga almacenes con fallback defensivo al catalogo liviano cuando el endpoint completo falla.
  // AM: evita dejar vacios los modales create/edit de Productos e Insumos por errores en vistas agregadas.
  getAlmacenes: async (options) => {
    const normalizedOptions = options && typeof options === 'object' ? options : {};
    const includeInactivosRequested =
      normalizedOptions.include_inactivos === true ||
      normalizedOptions.includeInactivos === true ||
      normalizedOptions.incluirInactivos === true;

    const primaryPath = withAlmacenesFilters('/almacenes', normalizedOptions);
    try {
      const primaryPayload = await apiFetch(primaryPath, 'GET');
      const primaryRows = normalizeAlmacenesRows(primaryPayload);
      if (primaryRows.length > 0) return primaryRows;
    } catch (primaryError) {
      // AM: si el endpoint dashboard falla, intenta el catalogo simple para no bloquear el formulario.
      const fallbackPath = includeInactivosRequested
        ? '/almacenes/catalogo?include_inactivos=1'
        : '/almacenes/catalogo';
      const fallbackPayload = await apiFetch(fallbackPath, 'GET');
      return normalizeAlmacenesRows(fallbackPayload);
    }

    // AM: cuando el endpoint principal responde vacio, consulta catalogo con inactivos para no perder opciones legacy.
    const fallbackPath = includeInactivosRequested
      ? '/almacenes/catalogo?include_inactivos=1'
      : '/almacenes/catalogo?include_inactivos=1';
    const fallbackPayload = await apiFetch(fallbackPath, 'GET');
    return normalizeAlmacenesRows(fallbackPayload);
  },
  // AM: catalogo de proveedores para conversion de OC a compra.
  getProveedores: (options) => apiFetch(withProveedoresFilters('/proveedores', options), 'GET'),
  // AM: alta rapida de proveedor para no bloquear conversion de ordenes en operacion diaria.
  crearProveedor: (data) => apiFetch('/proveedores', 'POST', data),
  // AM: CRUD operativo para el submodulo Proveedores dentro de Inventario.
  actualizarProveedor: (id, data) => apiFetch(`/proveedores/${id}`, 'PUT', data),
  getProveedorById: (id) => apiFetch(`/proveedores/${id}`, 'GET'),
  getProveedorDependencias: (id) => apiFetch(`/proveedores/${id}/dependencias`, 'GET'),
  inactivarProveedor: (id, motivo) =>
    apiFetch(`/proveedores/${id}/inactivar`, 'PATCH', motivo ? { motivo } : {}),
  reactivarProveedor: (id) => apiFetch(`/proveedores/${id}/reactivar`, 'PATCH', {}),
  eliminarProveedor: (id) => apiFetch(`/proveedores/${id}`, 'DELETE'),
  crearInsumo: (data) => apiFetch('/insumos', 'POST', data),
  actualizarInsumoCampo: (id, campo, valor) =>
    apiFetch('/insumos', 'PUT', {
      campo,
      valor,
      id_campo: 'id_insumo',
      id_valor: id
    }),
  // AM: edicion completa de insumo sincronizando uno o varios almacenes en una sola operacion.
  actualizarInsumoMultiAlmacen: (id, data = {}) =>
    apiFetch('/insumos/multi-almacen', 'PUT', {
      id_insumo: id,
      ...data
    }),
  eliminarInsumo: (id) =>
    apiFetch('/insumos', 'DELETE', {
      columna_id: 'id_insumo',
      valor_id: id
    }),

  // ===== PRODUCTOS =====
  getProductos: (options) => apiFetch(withItemCatalogFilters('/productos', options), 'GET'),
  crearProducto: (data) => apiFetch('/productos', 'POST', data),
  actualizarProductoCampo: (id, campo, valor) =>
    apiFetch('/productos', 'PUT', {
      campo,
      valor,
      id_campo: 'id_producto',
      id_valor: id
    }),
  // AM: edicion completa de producto sincronizando uno o varios almacenes en una sola operacion.
  actualizarProductoMultiAlmacen: (id, data = {}) =>
    apiFetch('/productos/multi-almacen', 'PUT', {
      id_producto: id,
      ...data
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
  actualizarAlmacen: (id, data) => apiFetch(`/almacenes/${id}`, 'PUT', data),
  getAlmacenDependencias: (id) => apiFetch(`/almacenes/${id}/dependencias`, 'GET'),
  inactivarAlmacen: (id, motivo) =>
    apiFetch(`/almacenes/${id}/inactivar`, 'PATCH', motivo ? { motivo } : {}),
  reactivarAlmacen: (id) => apiFetch(`/almacenes/${id}/reactivar`, 'PATCH', {}),
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
  // DEPRECATED / BACKEND 405 APPEND-ONLY:
  // Se conserva por compatibilidad; la UI no debe usar update/delete de movimientos.
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
    }),

  // AM: workflow transaccional de ordenes de compra.
  getOrdenesCompraWorkflow: (options) => apiFetch(withOrdenesCompraFilters('/orden_compras/workflow', options), 'GET'),
  // AM: contexto de creacion con sucursal/almacenes permitidos segun usuario autenticado.
  getOrdenCompraWorkflowContextoCreacion: () => apiFetch('/orden_compras/workflow/contexto_creacion', 'GET'),
  getOrdenCompraWorkflowById: (idOrdenCompra) => apiFetch(`/orden_compras/workflow/${idOrdenCompra}`, 'GET'),
  crearOrdenCompraWorkflow: (data) => apiFetch('/orden_compras/workflow', 'POST', data),
  aprobarOrdenCompraWorkflow: (idOrdenCompra, data = {}) =>
    apiFetch(`/orden_compras/workflow/${idOrdenCompra}/aprobar`, 'POST', data),
  rechazarOrdenCompraWorkflow: (idOrdenCompra, data = {}) =>
    apiFetch(`/orden_compras/workflow/${idOrdenCompra}/rechazar`, 'POST', data),
  actualizarDetalleOrdenCompraWorkflow: (idOrdenCompra, data = {}) =>
    apiFetch(`/orden_compras/workflow/${idOrdenCompra}/detalles`, 'PUT', data),
  // AM: revision administrativa de solicitudes de item no registrado (aprobar/rechazar).
  revisarSolicitudItemOrdenCompraWorkflow: (idOrdenCompra, idSolicitudItem, data = {}) =>
    apiFetch(`/orden_compras/workflow/${idOrdenCompra}/solicitudes_item/${idSolicitudItem}/revisar`, 'POST', data),
  // AM: marca solicitud de item como atendida luego de alta real en catalogo.
  atenderSolicitudItemOrdenCompraWorkflow: (idOrdenCompra, idSolicitudItem, data = {}) =>
    apiFetch(`/orden_compras/workflow/${idOrdenCompra}/solicitudes_item/${idSolicitudItem}/atender`, 'POST', data),
  convertirOrdenCompraWorkflow: (idOrdenCompra, data = {}) =>
    apiFetch(`/orden_compras/workflow/${idOrdenCompra}/convertir`, 'POST', data),
  reportarRecepcionOrdenCompraWorkflow: (idOrdenCompra, data = {}) =>
    apiFetch(`/orden_compras/workflow/${idOrdenCompra}/recepcion`, 'POST', data),
  abastecerOrdenCompraWorkflow: (idOrdenCompra, data = {}) =>
    apiFetch(`/orden_compras/workflow/${idOrdenCompra}/abastecer`, 'POST', data)
};
