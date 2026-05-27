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

const withProductosListFilters = (path, options) => {
  if (!options || typeof options !== 'object') return path;

  const params = new URLSearchParams();
  const includeInactivos =
    options.incluirInactivos === true ||
    options.includeInactivos === true ||
    options.include_inactivos === true;

  if (includeInactivos) params.set('incluir_inactivos', '1');

  const search = String(
    options.q ?? options.search ?? options.busqueda ?? options.nombre ?? ''
  ).trim();
  if (search) params.set('q', search);

  if (options.estado !== undefined && options.estado !== null && options.estado !== '') {
    params.set('estado', String(options.estado));
  }

  if (options.stock !== undefined && options.stock !== null && options.stock !== '') {
    params.set('stock', String(options.stock));
  }

  if (
    options.id_categoria_producto !== undefined &&
    options.id_categoria_producto !== null &&
    options.id_categoria_producto !== ''
  ) {
    params.set('id_categoria_producto', String(options.id_categoria_producto));
  } else if (options.id_categoria !== undefined && options.id_categoria !== null && options.id_categoria !== '') {
    params.set('id_categoria_producto', String(options.id_categoria));
  }

  if (options.id_almacen !== undefined && options.id_almacen !== null && options.id_almacen !== '') {
    params.set('id_almacen', String(options.id_almacen));
  }

  if (options.id_sucursal !== undefined && options.id_sucursal !== null && options.id_sucursal !== '') {
    params.set('id_sucursal', String(options.id_sucursal));
  }

  if (
    options.id_tipo_departamento !== undefined &&
    options.id_tipo_departamento !== null &&
    options.id_tipo_departamento !== ''
  ) {
    params.set('id_tipo_departamento', String(options.id_tipo_departamento));
  }

  if (options.page !== undefined && options.page !== null && options.page !== '') {
    params.set('page', String(options.page));
  }

  if (options.pageSize !== undefined && options.pageSize !== null && options.pageSize !== '') {
    params.set('pageSize', String(options.pageSize));
  }

  if (options.sort !== undefined && options.sort !== null && options.sort !== '') {
    params.set('sort', String(options.sort));
  } else if (options.sortBy !== undefined && options.sortBy !== null && options.sortBy !== '') {
    params.set('sort', String(options.sortBy));
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

  if (options.page !== undefined && options.page !== null && options.page !== '') {
    params.set('page', String(options.page));
  }

  if (options.pageSize !== undefined && options.pageSize !== null && options.pageSize !== '') {
    params.set('pageSize', String(options.pageSize));
  } else if (options.limit !== undefined && options.limit !== null && options.limit !== '') {
    params.set('pageSize', String(options.limit));
  }

  const query = params.toString();
  if (!query) return path;

  return `${path}${path.includes('?') ? '&' : '?'}${query}`;
};

const withMovimientosReferenciasFilters = (path, options) => {
  if (!options || typeof options !== 'object') return path;

  const params = new URLSearchParams();

  if (options.item_tipo !== undefined && options.item_tipo !== null && options.item_tipo !== '') {
    params.set('item_tipo', String(options.item_tipo));
  }

  if (options.id_almacen !== undefined && options.id_almacen !== null && options.id_almacen !== '') {
    params.set('id_almacen', String(options.id_almacen));
  }

  if (options.id_sucursal !== undefined && options.id_sucursal !== null && options.id_sucursal !== '') {
    params.set('id_sucursal', String(options.id_sucursal));
  }

  if (options.limit !== undefined && options.limit !== null && options.limit !== '') {
    params.set('limit', String(options.limit));
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

  if (options.page !== undefined && options.page !== null && options.page !== '') {
    params.set('page', String(options.page));
  }

  if (options.pageSize !== undefined && options.pageSize !== null && options.pageSize !== '') {
    params.set('pageSize', String(options.pageSize));
  } else if (options.limit !== undefined && options.limit !== null && options.limit !== '') {
    params.set('pageSize', String(options.limit));
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

  // AM: page_size explicito para paginacion profesional; mantiene fallback legacy con limit.
  if (options.page_size !== undefined && options.page_size !== null && options.page_size !== '') {
    params.set('page_size', String(options.page_size));
  } else if (options.pageSize !== undefined && options.pageSize !== null && options.pageSize !== '') {
    params.set('page_size', String(options.pageSize));
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

  if (options.id_proveedor !== undefined && options.id_proveedor !== null && options.id_proveedor !== '') {
    params.set('id_proveedor', String(options.id_proveedor));
  }

  if (options.fecha_desde !== undefined && options.fecha_desde !== null && options.fecha_desde !== '') {
    params.set('fecha_desde', String(options.fecha_desde));
  }

  if (options.fecha_hasta !== undefined && options.fecha_hasta !== null && options.fecha_hasta !== '') {
    params.set('fecha_hasta', String(options.fecha_hasta));
  }

  if (
    options.evidencias_pendientes !== undefined &&
    options.evidencias_pendientes !== null &&
    options.evidencias_pendientes !== ''
  ) {
    params.set('evidencias_pendientes', String(options.evidencias_pendientes));
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
  actualizarCategoriaCompleta: (id, data) =>
    apiFetch('/categorias_productos/edicion', 'PUT', {
      id_categoria_producto: id,
      ...data
    }),
  actualizarCategoriaCampo: (id, campo, valor) =>
    apiFetch('/categorias_productos', 'PUT', {
      campo,
      valor,
      id_campo: 'id_categoria_producto',
      id_valor: id
    }),
  actualizarEstadoCategoria: (id, estado) =>
    apiFetch('/categorias_productos/estado', 'PATCH', {
      id_categoria_producto: id,
      estado
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
  actualizarCategoriaInsumoCompleta: (id, data) =>
    apiFetch('/categorias_insumos/edicion', 'PUT', {
      id_categoria_insumo: id,
      ...data
    }),
  actualizarCategoriaInsumoCampo: (id, campo, valor) =>
    apiFetch('/categorias_insumos', 'PUT', {
      campo,
      valor,
      id_campo: 'id_categoria_insumo',
      id_valor: id
    }),
  actualizarEstadoCategoriaInsumo: (id, estado) =>
    apiFetch('/categorias_insumos/estado', 'PATCH', {
      id_categoria_insumo: id,
      estado
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
    } catch {
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
      : '/almacenes/catalogo';
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
  actualizarInsumoCompleto: (id, data = {}) =>
    apiFetch('/insumos/edicion', 'PUT', {
      id_insumo: id,
      ...data
    }),
  actualizarInsumoCampo: (id, campo, valor) =>
    apiFetch('/insumos', 'PUT', {
      campo,
      valor,
      id_campo: 'id_insumo',
      id_valor: id
    }),
  actualizarEstadoInsumo: (id, estado) =>
    apiFetch('/insumos/estado', 'PATCH', {
      id_insumo: id,
      estado
    }),
  eliminarInsumo: (id) =>
    apiFetch('/insumos', 'DELETE', {
      columna_id: 'id_insumo',
      valor_id: id
    }),

  // ===== PRODUCTOS =====
  getProductos: (options) => apiFetch(withProductosListFilters('/productos', options), 'GET'),
  crearProducto: (data) => apiFetch('/productos', 'POST', data),
  actualizarProductoCampo: (id, campo, valor) =>
    apiFetch('/productos', 'PUT', {
      campo,
      valor,
      id_campo: 'id_producto',
      id_valor: id
    }),
  // AM: endpoint legado de compatibilidad; el flujo principal de Productos usa `actualizarProductoCampo`.
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
  // NEW: cleanup compensatorio de archivos temporales cuando falla la operacion principal de negocio.
  // WHY: evitar archivos huerfanos si la imagen se sube pero create/update del producto no se concreta.
  // IMPACT: se usa como best-effort; no altera flujos exitosos.
  eliminarArchivo: (idArchivo, payload = {}) => apiFetch(`/archivos/${idArchivo}`, 'DELETE', payload),

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
  getMovimientosReferencias: (options) =>
    apiFetch(withMovimientosReferenciasFilters('/movimientos_inventario/referencias', options), 'GET'),
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
  getOrdenCompraWorkflowEvidenciaFactura: (idOrdenCompra) =>
    apiFetch(`/orden_compras/workflow/${idOrdenCompra}/evidencias/factura`, 'GET'),
  getOrdenCompraWorkflowEvidenciaTransferencia: (idOrdenCompra) =>
    apiFetch(`/orden_compras/workflow/${idOrdenCompra}/evidencias/transferencia`, 'GET'),
  // AM: sugerencias backend por lote para proveedor recomendado por item durante creacion de OC.
  getOrdenCompraProveedoresSugeridos: (data = {}) =>
    apiFetch('/orden_compras/workflow/proveedores-sugeridos', 'POST', data),
  crearOrdenCompraWorkflow: (data) => apiFetch('/orden_compras/workflow', 'POST', data),
  aprobarOrdenCompraWorkflow: (idOrdenCompra, data = {}) =>
    apiFetch(`/orden_compras/workflow/${idOrdenCompra}/aprobar`, 'POST', data),
  rechazarOrdenCompraWorkflow: (idOrdenCompra, data = {}) =>
    apiFetch(`/orden_compras/workflow/${idOrdenCompra}/rechazar`, 'POST', data),
  cancelarOrdenCompraWorkflow: (idOrdenCompra, data = {}) =>
    apiFetch(`/orden_compras/workflow/${idOrdenCompra}/cancelar`, 'POST', data),
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
    apiFetch(`/orden_compras/workflow/${idOrdenCompra}/abastecer`, 'POST', data),

  // AM: CRUD del submodulo Inventario > Mobiliario (v1).
  getMobiliario: (options = {}) => {
    const params = new URLSearchParams();
    if (options?.q !== undefined && options?.q !== null && String(options.q).trim() !== '') {
      params.set('q', String(options.q).trim());
    }
    const includeInactivos =
      options?.incluirInactivos === true ||
      options?.includeInactivos === true ||
      options?.incluir_inactivos === true;
    if (includeInactivos) params.set('incluir_inactivos', '1');
    const query = params.toString();
    return apiFetch(query ? `/mobiliario?${query}` : '/mobiliario', 'GET');
  },
  crearMobiliario: (data = {}) => apiFetch('/mobiliario', 'POST', data),
  actualizarMobiliario: (idMobiliario, data = {}) => apiFetch(`/mobiliario/${idMobiliario}`, 'PUT', data),
  cambiarEstadoMobiliario: (idMobiliario, activo) =>
    apiFetch(`/mobiliario/${idMobiliario}/estado`, 'PATCH', { activo }),
  getEmpleadosCatalogoMobiliario: async () => {
    const limit = 100;
    const maxPages = 50;
    const collectedRows = [];
    let page = 1;
    let totalExpected = Number.POSITIVE_INFINITY;

    while (page <= maxPages && collectedRows.length < totalExpected) {
      const payload = await apiFetch(`/empleados?page=${page}&limit=${limit}&estado=true`, 'GET');
      const rows = normalizeCatalogRows(payload);
      if (!rows.length) break;

      collectedRows.push(...rows);

      const payloadTotal = Number(payload?.total);
      if (Number.isFinite(payloadTotal) && payloadTotal >= 0) {
        totalExpected = payloadTotal;
      }

      const payloadLimit = Number(payload?.limit);
      const effectiveLimit = Number.isFinite(payloadLimit) && payloadLimit > 0 ? payloadLimit : limit;
      if (rows.length < effectiveLimit) break;
      if (Number.isFinite(payloadTotal) && collectedRows.length >= payloadTotal) break;
      page += 1;
    }

    const uniqueRows = [];
    const seenIds = new Set();
    for (const row of collectedRows) {
      const idEmpleado = Number.parseInt(String(row?.id_empleado ?? ''), 10);
      if (!Number.isInteger(idEmpleado) || idEmpleado <= 0 || seenIds.has(idEmpleado)) continue;
      seenIds.add(idEmpleado);
      uniqueRows.push(row);
    }

    return uniqueRows.map((row) => ({
      id_empleado: row?.id_empleado,
      empleado_nombre:
        String(row?.persona_nombre_completo ?? '').trim() ||
        String([row?.persona_nombre, row?.persona_apellido].filter(Boolean).join(' ')).trim() ||
        `Empleado #${row?.id_empleado ?? ''}`,
      identidad: String(row?.persona_dni ?? row?.dni ?? row?.identidad ?? '').trim(),
      codigo_empleado: String(row?.codigo_empleado ?? row?.codigo ?? '').trim(),
      correo_electronico: String(row?.correo ?? row?.email ?? row?.texto_correo ?? '').trim()
    }));
  }
};
