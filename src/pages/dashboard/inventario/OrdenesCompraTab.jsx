import { useCallback, useEffect, useMemo, useState } from 'react';
import { inventarioService } from '../../../services/inventarioService';
import { usePermisos } from '../../../context/PermisosContext';
import { useAuth } from '../../../hooks/useAuth';
import { PERMISSIONS, isSuperAdminRoleList } from '../../../utils/permissions';
import {
  buildInventarioImageUploadPayload,
  getInventarioImageFileError,
  INVENTARIO_IMAGE_CONTEXT,
  optimizeInventarioImageForUpload,
  resolveInventarioEvidenceKind,
  resolveInventarioImageUrl
} from '../../../utils/inventarioImagenes';

const ORDER_LIMIT = 20;
const ESTADOS = ['PENDIENTE', 'APROBADA', 'RECHAZADA', 'EN_COMPRA', 'ABASTECIDA', 'CANCELADA'];
// AM: polling conservador para flujo de OC; prioriza estabilidad sobre "tiempo real".
const ORDERS_POLLING_MS = 15000;
// AM: ajusta Nueva Solicitud a 8 cards por pagina para mostrar 4x2 en desktop.
const CATALOG_CARDS_PER_PAGE = 8;
// AM: Flujo reutiliza el mismo tamano de pagina visual del carrusel de Nueva Solicitud.
const FLOW_CARDS_PER_PAGE = CATALOG_CARDS_PER_PAGE;
// AM: modos de descuento administrativos para compra real (monto fijo o porcentaje).
const DISCOUNT_TYPE_MONTO = 'MONTO';
const DISCOUNT_TYPE_PORCENTAJE = 'PORCENTAJE';
// AM: estados operativos de solicitudes de item no registrado dentro de una OC.
const ITEM_REQUEST_STATE_PENDIENTE = 'PENDIENTE';
const ITEM_REQUEST_STATE_EN_REVISION = 'EN_REVISION';
const ITEM_REQUEST_STATE_ATENDIDA = 'ATENDIDA';
const ITEM_REQUEST_STATE_RECHAZADA = 'RECHAZADA';

const hasValue = (value) =>
  value !== undefined &&
  value !== null &&
  !(typeof value === 'string' && value.trim() === '');

const parsePositiveInt = (rawValue) => {
  if (!hasValue(rawValue)) return null;
  const text = String(rawValue).trim();
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value <= 0) return null;
  return value;
};

const parseNonNegativeNumber = (rawValue) => {
  if (!hasValue(rawValue)) return null;
  const text = String(rawValue).trim();
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
};

const parseOptionalPositiveInt = (rawValue) => {
  if (!hasValue(rawValue)) return null;
  return parsePositiveInt(rawValue);
};

const round2 = (rawValue) => Math.round(Number(rawValue || 0) * 100) / 100;

const resolveDiscountType = (rawValue) => {
  const text = String(rawValue || DISCOUNT_TYPE_MONTO)
    .trim()
    .toUpperCase();
  if (text === DISCOUNT_TYPE_PORCENTAJE) return DISCOUNT_TYPE_PORCENTAJE;
  return DISCOUNT_TYPE_MONTO;
};

const normalizeAlmacenesSelection = (rawValue, max = 2) => {
  const source = Array.isArray(rawValue) ? rawValue : hasValue(rawValue) ? [rawValue] : [];
  return Array.from(
    new Set(
      source
        .map((value) => parsePositiveInt(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    )
  ).slice(0, Math.max(1, max));
};

const sanitizeInt = (rawValue) => String(rawValue ?? '').replace(/[^\d]/g, '');
const sanitizeDecimal = (rawValue) => String(rawValue ?? '').replace(/[^\d.]/g, '');
const normalizeText = (rawValue, max = 1000) =>
  String(rawValue ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

const boolish = (value) =>
  value === true ||
  value === 1 ||
  value === '1' ||
  String(value ?? '').trim().toLowerCase() === 'true';

const getStockState = (item) => {
  const qty = Number.parseInt(String(item?.cantidad ?? '0'), 10) || 0;
  const min = Number.parseInt(String(item?.stock_minimo ?? '0'), 10) || 0;
  if (qty <= 0) return 'SIN STOCK';
  if (qty <= min) return 'STOCK BAJO';
  return 'OK';
};

const resolveEstado = (row) => {
  const estado = String(row?.estado_flujo ?? '')
    .trim()
    .toUpperCase();
  if (ESTADOS.includes(estado)) return estado;
  return row?.estado ? 'ABASTECIDA' : 'PENDIENTE';
};

const badgeClass = (estado) => {
  if (estado === 'PENDIENTE') return 'bg-warning text-dark';
  if (estado === 'EN_ESPERA') return 'bg-secondary';
  if (estado === 'ENVIADO') return 'bg-dark';
  if (estado === 'APROBADA') return 'bg-primary';
  if (estado === 'RECHAZADA') return 'bg-danger';
  if (estado === 'EN_COMPRA') return 'bg-info text-dark';
  if (estado === 'ABASTECIDA') return 'bg-success';
  return 'bg-secondary';
};

const estadoToneClass = (estado) => `is-${String(estado || '').toLowerCase().replace('_', '-')}`;

const estadoIconClass = (estado) => {
  if (estado === 'PENDIENTE') return 'bi bi-hourglass-split';
  if (estado === 'EN_ESPERA') return 'bi bi-hourglass';
  if (estado === 'ENVIADO') return 'bi bi-send-check';
  if (estado === 'APROBADA') return 'bi bi-patch-check';
  if (estado === 'RECHAZADA') return 'bi bi-x-octagon';
  if (estado === 'EN_COMPRA') return 'bi bi-receipt';
  if (estado === 'ABASTECIDA') return 'bi bi-box-seam';
  return 'bi bi-slash-circle';
};

const formatEstadoLabel = (estado) => {
  if (estado === 'EN_ESPERA') return 'EN ESPERA';
  if (estado === 'ENVIADO') return 'ENVIADO';
  return String(estado || '').replace('_', ' ');
};

// AM: prioriza numeracion visible compactada para flujo y deja correlativo almacenado como fallback historico.
const resolveVisibleOrderNumber = (row) =>
  parsePositiveInt(row?.numero_oc_visible_flujo) ||
  parsePositiveInt(row?.numero_oc_visible) ||
  parsePositiveInt(row?.id_orden_compra) ||
  null;

const formatVisibleOrderNumber = (row) => String(resolveVisibleOrderNumber(row) || '-');

const getCategoriaLabel = (row, fallback = '') =>
  normalizeText(
    row?.nombre_categoria ||
      row?.nombre_categoria_producto ||
      row?.nombre_categoria_insumo ||
      row?.nombre,
    120
  ) || fallback;

const resolveItemRequestOnlyState = (row) => {
  const pendientes = Number(row?.total_solicitudes_item_pendientes || 0);
  const enRevision = Number(row?.total_solicitudes_item_en_revision || 0);
  const atendidas = Number(row?.total_solicitudes_item_atendidas || 0);
  const rechazadas = Number(row?.total_solicitudes_item_rechazadas || 0);

  if (enRevision > 0) return 'EN_REVISION';
  if (pendientes > 0) return 'PENDIENTE_REVISION';
  if (atendidas > 0 && rechazadas > 0) return 'PARCIAL';
  if (atendidas > 0) return 'ATENDIDA';
  if (rechazadas > 0) return 'RECHAZADA';
  return 'PENDIENTE_REVISION';
};

const itemRequestOnlyBadgeClass = (estadoSolicitud) => {
  if (estadoSolicitud === 'PENDIENTE_REVISION') return 'bg-warning text-dark';
  if (estadoSolicitud === 'EN_REVISION') return 'bg-info text-dark';
  if (estadoSolicitud === 'ATENDIDA') return 'bg-success';
  if (estadoSolicitud === 'RECHAZADA') return 'bg-danger';
  if (estadoSolicitud === 'PARCIAL') return 'bg-secondary';
  return 'bg-secondary';
};

const itemRequestOnlyLabel = (estadoSolicitud) => {
  if (estadoSolicitud === 'PENDIENTE_REVISION') return 'PENDIENTE REVISION';
  if (estadoSolicitud === 'EN_REVISION') return 'EN REVISION';
  if (estadoSolicitud === 'ATENDIDA') return 'ATENDIDA';
  if (estadoSolicitud === 'RECHAZADA') return 'RECHAZADA';
  if (estadoSolicitud === 'PARCIAL') return 'PARCIAL';
  return 'PENDIENTE REVISION';
};

const parseItemRequestState = (value) => {
  const estado = String(value || '')
    .trim()
    .toUpperCase();
  if (
    [
      ITEM_REQUEST_STATE_PENDIENTE,
      ITEM_REQUEST_STATE_EN_REVISION,
      ITEM_REQUEST_STATE_ATENDIDA,
      ITEM_REQUEST_STATE_RECHAZADA
    ].includes(estado)
  ) {
    return estado;
  }
  return ITEM_REQUEST_STATE_PENDIENTE;
};

const itemRequestBadgeClass = (estado) => {
  if (estado === ITEM_REQUEST_STATE_PENDIENTE) return 'bg-warning text-dark';
  if (estado === ITEM_REQUEST_STATE_EN_REVISION) return 'bg-info text-dark';
  if (estado === ITEM_REQUEST_STATE_ATENDIDA) return 'bg-success';
  if (estado === ITEM_REQUEST_STATE_RECHAZADA) return 'bg-danger';
  return 'bg-secondary';
};

const stockBadgeClass = (stockState) => {
  if (stockState === 'SIN STOCK') return 'is-out';
  if (stockState === 'STOCK BAJO') return 'is-low';
  return 'is-ok';
};

const stockStateLabel = (stockState) => {
  if (stockState === 'SIN STOCK') return 'Sin stock';
  if (stockState === 'STOCK BAJO') return 'Stock bajo';
  return 'Con stock';
};

const resolveItemIcon = (itemTipo) => (itemTipo === 'producto' ? 'bi bi-basket2-fill' : 'bi bi-box-seam-fill');

const formatDate = (rawValue) => {
  if (!rawValue) return '-';
  const text = String(rawValue);
  const date = text.includes('T') ? text.split('T')[0] : text.split(' ')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split('-');
    return `${day}/${month}/${year}`;
  }
  return text;
};

const formatTime = (rawValue) => {
  if (!rawValue) return '-';
  const text = String(rawValue).trim();
  const withSpace = text.replace('T', ' ');
  const parts = withSpace.split(' ');
  if (parts.length < 2) return '-';
  const timeRaw = String(parts[1] || '');
  const hhmmss = timeRaw.split('.')[0] || '';
  const [hh = '', mm = '', ss = ''] = hhmmss.split(':');
  if (!/^\d{2}$/.test(hh) || !/^\d{2}$/.test(mm)) return '-';
  return `${hh}:${mm}:${/^\d{2}$/.test(ss) ? ss : '00'}`;
};

const resolveSucursalLabel = (row) => {
  const nombre = normalizeText(row?.nombre_sucursal, 120);
  if (nombre) return nombre;
  const idSucursal = parsePositiveInt(row?.id_sucursal);
  return idSucursal ? `Sucursal #${idSucursal}` : '-';
};

// AM: etiquetas de historial de evidencias para lectura clara en detalle de OC abastecida.
const formatEvidenceTypeLabel = (tipo) => {
  const normalized = String(tipo || '')
    .trim()
    .toUpperCase();
  if (normalized === 'FACTURA_RECEPCION') return 'Factura recepcion';
  if (normalized === 'DEPOSITO_TRANSFERENCIA') return 'Deposito / transferencia';
  return 'Evidencia';
};

const formatEvidenceOriginLabel = (origen) => {
  const normalized = String(origen || '')
    .trim()
    .toUpperCase();
  if (normalized === 'RECEPCION_SUCURSAL') return 'Recepcion sucursal';
  if (normalized === 'CONVERSION_ADMIN') return 'Conversion administrativa';
  return normalizeText(origen, 80) || 'Origen no disponible';
};

const resolveEvidenceKindFromPayload = (mimeType, rawUrl) => resolveInventarioEvidenceKind(mimeType, rawUrl);

// AM: mensaje de negocio uniforme para incoherencia item-vs-almacen destino devuelta por backend (409).
const getWarehouseMismatchMessage = (error) => {
  const backendCode = String(error?.data?.code || '')
    .trim()
    .toUpperCase();
  const status = Number(error?.status || 0);
  if (status !== 409 || backendCode !== 'WAREHOUSE_ITEM_MISMATCH') return null;

  const mismatchData = error?.data?.data || {};
  const itemTipo = String(mismatchData?.item_tipo || '')
    .trim()
    .toLowerCase();
  const itemLabel = itemTipo === 'producto' ? 'producto' : itemTipo === 'insumo' ? 'insumo' : 'item';
  const idItem = parsePositiveInt(mismatchData?.id_item);
  const idAlmacenDestino = parsePositiveInt(mismatchData?.id_almacen_destino);
  const idAlmacenActual = parsePositiveInt(mismatchData?.id_almacen_actual);
  const idDetalle = parsePositiveInt(mismatchData?.id_detalle);
  const detalleLabel = idDetalle ? ` (detalle ${idDetalle})` : '';

  if (idItem && idAlmacenDestino && idAlmacenActual) {
    return `No se puede continuar: el ${itemLabel} ${idItem} pertenece al almacen ${idAlmacenActual} y no al destino ${idAlmacenDestino}${detalleLabel}.`;
  }
  if (idAlmacenDestino && idAlmacenActual) {
    return `No se puede continuar: el item pertenece al almacen ${idAlmacenActual} y no al destino ${idAlmacenDestino}${detalleLabel}.`;
  }
  return (
    error?.message ||
    `No se puede continuar por incoherencia entre almacen destino y almacen real del item${detalleLabel}.`
  );
};

// AM: recepcion se considera registrada aunque la factura sea opcional.
const hasReceptionRegistered = (row) =>
  Boolean(
    parsePositiveInt(row?.id_usuario_recepcion) ||
      hasValue(row?.fecha_recepcion_reportada) ||
      hasValue(normalizeText(row?.observacion_recepcion, 1000)) ||
      parsePositiveInt(row?.id_archivo_factura_recepcion)
  );

const formatMoney = (rawValue) => {
  const value = Number(rawValue);
  if (!Number.isFinite(value)) return 'L. 0.00';
  return `L. ${value.toFixed(2)}`;
};

const resolveItemAlmacenes = (row) => {
  const fromArray = normalizeAlmacenesSelection(row?.id_almacenes, 50);
  if (fromArray.length > 0) return fromArray;

  const fallback = parsePositiveInt(row?.id_almacen);
  return fallback ? [fallback] : [];
};

const toCatalog = (productos, insumos) => {
  const prod = (Array.isArray(productos) ? productos : [])
    .filter((row) => boolish(row?.estado))
    .map((row) => {
      const idAlmacenes = resolveItemAlmacenes(row);
      return {
        key: `producto:${row.id_producto}`,
        item_tipo: 'producto',
        id_item: Number(row.id_producto),
        id_almacen: idAlmacenes[0] || null,
        id_almacenes: idAlmacenes,
        nombre: row.nombre_producto || `Producto #${row.id_producto}`,
        categoria: getCategoriaLabel(row, 'Sin categoria'),
        descripcion: row.descripcion_producto || '',
        cantidad: Number.parseInt(String(row.cantidad ?? '0'), 10) || 0,
        stock_minimo: Number.parseInt(String(row.stock_minimo ?? '0'), 10) || 0
      };
    });

  const ins = (Array.isArray(insumos) ? insumos : [])
    .filter((row) => boolish(row?.estado))
    .map((row) => {
      const idAlmacenes = resolveItemAlmacenes(row);
      return {
        key: `insumo:${row.id_insumo}`,
        item_tipo: 'insumo',
        id_item: Number(row.id_insumo),
        id_almacen: idAlmacenes[0] || null,
        id_almacenes: idAlmacenes,
        nombre: row.nombre_insumo || `Insumo #${row.id_insumo}`,
        categoria: getCategoriaLabel(row, 'Sin categoria'),
        descripcion: row.descripcion || '',
        cantidad: Number.parseInt(String(row.cantidad ?? '0'), 10) || 0,
        stock_minimo: Number.parseInt(String(row.stock_minimo ?? '0'), 10) || 0
      };
    });

  return [...prod, ...ins].filter((row) => row.id_item > 0);
};

const toAlmacenesCatalog = (rows) =>
  (Array.isArray(rows) ? rows : [])
    .filter((row) => boolish(row?.sucursal_estado ?? row?.estado ?? true))
    .map((row) => ({
      id_almacen: Number(row.id_almacen),
      nombre: row.nombre || `Almacen #${row.id_almacen}`,
      id_sucursal: Number(row.id_sucursal),
      nombre_sucursal: row.nombre_sucursal || (row.id_sucursal ? `Sucursal #${row.id_sucursal}` : 'Sin sucursal')
    }))
    .filter((row) => row.id_almacen > 0);

const formatAlmacenDisplay = (almacen) => {
  if (!almacen) return '-';
  return `${almacen.nombre} (${almacen.nombre_sucursal})`;
};

const emptyConvertPanel = () => ({
  open: false,
  loading: false,
  submit_action: '',
  error: '',
  orden: null,
  id_proveedor: '',
  fecha_compra: '',
  observacion_admin: '',
  descuento_tipo: DISCOUNT_TYPE_MONTO,
  descuento_valor: '0',
  isv_pct: '0',
  detalles: [],
  factura_recepcion_url: '',
  factura_recepcion_mime_type: '',
  transferencia_url_actual: '',
  transferencia_mime_type: '',
  transferencia_file: null,
  transferencia_file_mime_type: '',
  transferencia_preview_url: '',
  transferencia_error: ''
});

const emptyReviewModal = () => ({
  open: false,
  mode: 'aprobar',
  orden: null,
  comentario: '',
  loading: false,
  error: ''
});

const emptySupplyModal = () => ({
  open: false,
  orden: null,
  observacion: '',
  loading: false,
  error: ''
});

const emptyRecepcionModal = () => ({
  open: false,
  orden: null,
  observacion: '',
  usuario_sistema: '',
  sucursal_sistema: '',
  fecha_sistema: '',
  hora_sistema: '',
  loading: false,
  error: '',
  factura_file: null,
  factura_file_mime_type: '',
  factura_preview_url: '',
  factura_error: ''
});

const emptyItemRequestModal = () => ({
  open: false,
  tipo_item: 'producto',
  nombre_sugerido: '',
  descripcion: '',
  cantidad_sugerida: '1',
  error: ''
});

const emptyEditDetallesModal = () => ({
  open: false,
  loading: false,
  error: '',
  orden: null,
  rows: [],
  add_rows: [],
  // AM: controla filtro rapido por tipo y texto en el bloque "Agregar nuevo item".
  selected_item_tipo: 'producto',
  search_item: ''
});

const emptyItemRequestDecisionModal = () => ({
  open: false,
  loading: false,
  error: '',
  orden: null,
  solicitud: null,
  accion: 'aprobar',
  comentario: ''
});

const emptyQuickCreateItemModal = () => ({
  open: false,
  loading: false,
  error: '',
  orden: null,
  solicitud: null,
  tipo_item: 'producto',
  nombre: '',
  descripcion: '',
  cantidad: '1',
  precio: '0',
  stock_minimo: '0',
  id_categoria_producto: '',
  id_categoria_insumo: '',
  id_unidad_medida: '',
  id_almacen: ''
});

const OrdenesCompraTab = ({ openToast }) => {
  const { can, canAny, loading: permisosLoading } = usePermisos();
  const { user } = useAuth();

  // AM: permisos OC granulares con fallback legacy durante la transicion 4B.
  const canCrear = canAny([
    PERMISSIONS.INVENTARIO_OC_CREAR_SOLICITUD,
    PERMISSIONS.INVENTARIO_ORDENES_COMPRA_CREAR
  ]);
  const canVerFlujo = canAny([
    PERMISSIONS.INVENTARIO_OC_VER_FLUJO,
    PERMISSIONS.INVENTARIO_ORDENES_COMPRA_VER,
    PERMISSIONS.INVENTARIO_ORDENES_COMPRA_VER_TODAS
  ]);
  const canVerDetalle = canAny([
    PERMISSIONS.INVENTARIO_OC_VER_DETALLE,
    PERMISSIONS.INVENTARIO_ORDENES_COMPRA_VER,
    PERMISSIONS.INVENTARIO_ORDENES_COMPRA_VER_TODAS
  ]);
  const canVer = canAny([
    PERMISSIONS.INVENTARIO_OC_VER_FLUJO,
    PERMISSIONS.INVENTARIO_OC_VER_DETALLE,
    PERMISSIONS.INVENTARIO_OC_CREAR_SOLICITUD,
    PERMISSIONS.INVENTARIO_ORDENES_COMPRA_VER,
    PERMISSIONS.INVENTARIO_ORDENES_COMPRA_CREAR,
    PERMISSIONS.INVENTARIO_ORDENES_COMPRA_VER_TODAS
  ]);
  const canVerTodas = can(PERMISSIONS.INVENTARIO_ORDENES_COMPRA_VER_TODAS);
  const canGestionar = canAny([
    PERMISSIONS.INVENTARIO_OC_EDITAR_SOLICITUD,
    PERMISSIONS.INVENTARIO_OC_APROBAR,
    PERMISSIONS.INVENTARIO_OC_RECHAZAR,
    PERMISSIONS.INVENTARIO_OC_CANCELAR,
    PERMISSIONS.INVENTARIO_OC_REVISAR_SOLICITUD_ITEM,
    PERMISSIONS.INVENTARIO_OC_ATENDER_SOLICITUD_ITEM,
    PERMISSIONS.INVENTARIO_ORDENES_COMPRA_GESTIONAR
  ]);
  const canEditarSolicitud = canAny([
    PERMISSIONS.INVENTARIO_OC_EDITAR_SOLICITUD,
    PERMISSIONS.INVENTARIO_ORDENES_COMPRA_GESTIONAR
  ]);
  const canAprobar = canAny([
    PERMISSIONS.INVENTARIO_OC_APROBAR,
    PERMISSIONS.INVENTARIO_ORDENES_COMPRA_GESTIONAR
  ]);
  const canRechazar = canAny([
    PERMISSIONS.INVENTARIO_OC_RECHAZAR,
    PERMISSIONS.INVENTARIO_ORDENES_COMPRA_GESTIONAR
  ]);
  const canCancelar = canAny([
    PERMISSIONS.INVENTARIO_OC_CANCELAR,
    PERMISSIONS.INVENTARIO_ORDENES_COMPRA_VER_TODAS,
    PERMISSIONS.INVENTARIO_ORDENES_COMPRA_GESTIONAR
  ]);
  const canConvertir = canAny([
    PERMISSIONS.INVENTARIO_OC_CONVERTIR_CONTINUAR,
    PERMISSIONS.INVENTARIO_ORDENES_COMPRA_CONVERTIR
  ]);
  const canAbastecer = canAny([
    PERMISSIONS.INVENTARIO_OC_ABASTECER,
    PERMISSIONS.INVENTARIO_ORDENES_COMPRA_ABASTECER
  ]);
  const canSubirFactura = canAny([
    PERMISSIONS.INVENTARIO_OC_SUBIR_FACTURA,
    PERMISSIONS.INVENTARIO_ORDENES_COMPRA_RECEPCIONAR
  ]);
  const canSubirDeposito = canAny([
    PERMISSIONS.INVENTARIO_OC_SUBIR_DEPOSITO,
    PERMISSIONS.INVENTARIO_ORDENES_COMPRA_CONVERTIR
  ]);
  const canVerEvidencias = canAny([
    PERMISSIONS.INVENTARIO_OC_VER_EVIDENCIAS,
    PERMISSIONS.INVENTARIO_ORDENES_COMPRA_VER,
    PERMISSIONS.INVENTARIO_ORDENES_COMPRA_VER_TODAS
  ]);
  const canVerHistorial = canAny([
    PERMISSIONS.INVENTARIO_OC_VER_HISTORIAL,
    PERMISSIONS.INVENTARIO_ORDENES_COMPRA_VER,
    PERMISSIONS.INVENTARIO_ORDENES_COMPRA_VER_TODAS
  ]);
  const canRevisarSolicitudItem = canAny([
    PERMISSIONS.INVENTARIO_OC_REVISAR_SOLICITUD_ITEM,
    PERMISSIONS.INVENTARIO_ORDENES_COMPRA_GESTIONAR
  ]);
  const canAtenderSolicitudItem = canAny([
    PERMISSIONS.INVENTARIO_OC_ATENDER_SOLICITUD_ITEM,
    PERMISSIONS.INVENTARIO_ORDENES_COMPRA_GESTIONAR
  ]);
  // AM: recepcion operativa solo con permiso dedicado; evita habilitarla por permiso de crear.
  const canRecepcionar = canAny([
    PERMISSIONS.INVENTARIO_OC_RECEPCIONAR,
    PERMISSIONS.INVENTARIO_ORDENES_COMPRA_RECEPCIONAR
  ]);
  // AM: solicitud de item nuevo solo para perfiles operativos sin alta directa de catalogo.
  const canCrearProductos = can(PERMISSIONS.INVENTARIO_PRODUCTOS_CREAR);
  const canCrearInsumos = can(PERMISSIONS.INVENTARIO_INSUMOS_CREAR);
  const canCrearCatalogoDirecto = canAny([
    PERMISSIONS.INVENTARIO_PRODUCTOS_CREAR,
    PERMISSIONS.INVENTARIO_INSUMOS_CREAR
  ]);
  const canVerAlmacenesCatalogo = canAny([
    PERMISSIONS.INVENTARIO_ALMACENES_VER,
    PERMISSIONS.INVENTARIO_ALMACENES_DETALLE_VER
  ]);
  const canVerCategoriasProductosCatalogo = canAny([PERMISSIONS.INVENTARIO_CATEGORIAS_VER]);
  const canVerCategoriasInsumosCatalogo = canAny([PERMISSIONS.INVENTARIO_CATEGORIAS_INSUMOS_VER]);
  const canVerUnidadesMedidaCatalogo = canAny([PERMISSIONS.PARAMETROS_UNIDADES_MEDIDA_VER]);
  const canVerProveedoresCatalogo = canAny([
    PERMISSIONS.INVENTARIO_PROVEEDORES_VER,
    PERMISSIONS.INVENTARIO_PROVEEDORES_DETALLE_VER
  ]);
  const canVerProductosCatalogo = canAny([
    PERMISSIONS.INVENTARIO_PRODUCTOS_VER,
    PERMISSIONS.INVENTARIO_PRODUCTOS_LISTADO_VER,
    PERMISSIONS.INVENTARIO_PRODUCTOS_DETALLE_VER
  ]);
  const canVerInsumosCatalogo = canAny([
    PERMISSIONS.INVENTARIO_INSUMOS_VER,
    PERMISSIONS.INVENTARIO_INSUMOS_LISTADO_VER,
    PERMISSIONS.INVENTARIO_INSUMOS_DETALLE_VER
  ]);
  const canSolicitarItemNuevo = canCrear && !canCrearCatalogoDirecto;
  // AM: separa actor operativo (cocina/cajero) de actor administrativo para no mezclar etapas.
  const isAdminFlowActor = canConvertir || canAbastecer || canGestionar || canVerTodas;
  const isSucursalOperativeActor = canRecepcionar && !isAdminFlowActor;
  // AM: visibilidad de historial/evidencias abastecidas limitada a super admin.
  const isSuperAdmin = isSuperAdminRoleList(user?.roles);
  // AM: cancelacion administrativa reservada para Admin/Super Admin.
  const canCancelarOrden = canCancelar || isSuperAdmin;
  const toast = useCallback(
    (title, message, variant = 'success') => {
      if (typeof openToast === 'function') openToast(title, message, variant);
    },
    [openToast]
  );

  const [productos, setProductos] = useState([]);
  const [insumos, setInsumos] = useState([]);
  // AM: catalogos auxiliares para alta rapida de solicitudes de item no registrado.
  const [categoriasProductos, setCategoriasProductos] = useState([]);
  const [categoriasInsumos, setCategoriasInsumos] = useState([]);
  const [unidadesMedida, setUnidadesMedida] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [almacenes, setAlmacenes] = useState([]);
  // AM: contexto backend para forzar sucursal automatica en creacion operativa.
  const [workflowCreateContext, setWorkflowCreateContext] = useState({
    id_sucursal_usuario: null,
    restringido_a_sucursal_usuario: false
  });
  const [draftAlmacenesBase, setDraftAlmacenesBase] = useState([]);
  const [catalogSucursalFilter, setCatalogSucursalFilter] = useState('');
  const [flowSucursalFilter, setFlowSucursalFilter] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [soloAlertas, setSoloAlertas] = useState(true);
  const [catalogPage, setCatalogPage] = useState(0);
// AM: pagina visual del carrusel del flujo de OC, sin tocar la paginacion backend existente.
  const [flowCarouselPage, setFlowCarouselPage] = useState(0);
  const [flowFiltersOpen, setFlowFiltersOpen] = useState(false);
  // AM: controla desplegables del layout OC sin alterar la logica interna de cada bloque.
  const [flowSectionOpen, setFlowSectionOpen] = useState(true);
  const [createSectionOpen, setCreateSectionOpen] = useState(false);
  const [draftSectionOpen, setDraftSectionOpen] = useState(false);
  const [draft, setDraft] = useState([]);
  const [draftItemRequests, setDraftItemRequests] = useState([]);
  const [observacion, setObservacion] = useState('');
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [creating, setCreating] = useState(false);

  const [scope, setScope] = useState('branch');
  const [scopeInitialized, setScopeInitialized] = useState(false);
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [ordenes, setOrdenes] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [loadingOrdenes, setLoadingOrdenes] = useState(false);
  const [rowBusy, setRowBusy] = useState({});
  const hasBusyRows = useMemo(() => Object.values(rowBusy || {}).some(Boolean), [rowBusy]);

  const [detalleActual, setDetalleActual] = useState({ loading: false, error: '', data: null });
  // AM: visor inline de evidencias dentro del modal de detalle para no abrir pestanas externas.
  const [detailEvidencePreview, setDetailEvidencePreview] = useState({
    url: '',
    title: '',
    kind: 'image',
    loading: false,
    error: ''
  });
  const [convertPanel, setConvertPanel] = useState(emptyConvertPanel);
  const [reviewModal, setReviewModal] = useState(emptyReviewModal);
  const [supplyModal, setSupplyModal] = useState(emptySupplyModal);
  const [recepcionModal, setRecepcionModal] = useState(emptyRecepcionModal);
  const [itemRequestModal, setItemRequestModal] = useState(emptyItemRequestModal);
  const [editDetallesModal, setEditDetallesModal] = useState(emptyEditDetallesModal);
  const [itemRequestDecisionModal, setItemRequestDecisionModal] = useState(emptyItemRequestDecisionModal);
  const [quickCreateItemModal, setQuickCreateItemModal] = useState(emptyQuickCreateItemModal);
  // AM: perfiles operativos crean OC fijando sucursal desde backend/contexto, sin selector manual.
  const isOperationalCreateRestricted =
    isSucursalOperativeActor && Boolean(workflowCreateContext?.restringido_a_sucursal_usuario);

  useEffect(() => {
    // AM: visibilidad del listado definida por rol (admins=global, operativos=sucursal).
    if (permisosLoading) return;
    if (!scopeInitialized) {
      setScope(canVerTodas ? 'all' : 'branch');
      setScopeInitialized(true);
      return;
    }
    if (!canVerTodas && scope === 'all') setScope('branch');
  }, [canVerTodas, permisosLoading, scope, scopeInitialized]);

  useEffect(() => {
    // AM: fija sucursal de catalogo para perfiles operativos restringidos por backend.
    if (!isOperationalCreateRestricted) return;
    const idSucursalUsuario = parseOptionalPositiveInt(workflowCreateContext?.id_sucursal_usuario);
    if (!idSucursalUsuario) return;
    setCatalogSucursalFilter(String(idSucursalUsuario));
  }, [isOperationalCreateRestricted, workflowCreateContext?.id_sucursal_usuario]);

  const catalog = useMemo(() => toCatalog(productos, insumos), [insumos, productos]);
  const almacenesCatalog = useMemo(() => toAlmacenesCatalog(almacenes), [almacenes]);
  const sucursalesCatalog = useMemo(() => {
    const map = new Map();
    for (const almacen of almacenesCatalog) {
      const idSucursal = parsePositiveInt(almacen?.id_sucursal);
      if (!idSucursal) continue;
      if (!map.has(idSucursal)) {
        map.set(idSucursal, {
          id_sucursal: idSucursal,
          nombre_sucursal: almacen.nombre_sucursal || `Sucursal #${idSucursal}`
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.id_sucursal - b.id_sucursal);
  }, [almacenesCatalog]);
  const almacenesCatalogFiltradosPorSucursal = useMemo(() => {
    const idSucursal = isOperationalCreateRestricted
      ? parseOptionalPositiveInt(workflowCreateContext?.id_sucursal_usuario)
      : parseOptionalPositiveInt(catalogSucursalFilter);
    if (!idSucursal) return almacenesCatalog;
    return almacenesCatalog.filter((row) => Number(row.id_sucursal) === Number(idSucursal));
  }, [almacenesCatalog, catalogSucursalFilter, isOperationalCreateRestricted, workflowCreateContext?.id_sucursal_usuario]);
  const almacenesMap = useMemo(
    () => new Map(almacenesCatalog.map((row) => [Number(row.id_almacen), row])),
    [almacenesCatalog]
  );
  const selectedBaseAlmacenes = useMemo(
    () =>
      normalizeAlmacenesSelection(draftAlmacenesBase, 1).filter((idAlmacen) =>
        almacenesMap.has(idAlmacen)
      ),
    [almacenesMap, draftAlmacenesBase]
  );

  useEffect(() => {
    if (almacenesCatalog.length === 0) {
      setDraftAlmacenesBase([]);
      return;
    }

    const visibleAlmacenes =
      almacenesCatalogFiltradosPorSucursal.length > 0
        ? almacenesCatalogFiltradosPorSucursal
        : almacenesCatalog;

    setDraftAlmacenesBase((prev) => {
      const valid = normalizeAlmacenesSelection(prev, 1).filter((idAlmacen) =>
        visibleAlmacenes.some((row) => Number(row.id_almacen) === Number(idAlmacen))
      );
      if (valid.length > 0) return valid;
      return [Number(visibleAlmacenes[0].id_almacen)];
    });
  }, [almacenesCatalog, almacenesCatalogFiltradosPorSucursal]);

  const filteredCatalog = useMemo(() => {
    const query = normalizeText(catalogSearch, 120).toLowerCase();
    // AM: el catalogo se gobierna por la sucursal/almacen destino seleccionado en la solicitud.
    const warehouseFilterSet = new Set(selectedBaseAlmacenes);
    // AM: evita mostrar catalogo fuera de alcance cuando el flujo operativo aun no resolvio su almacen base.
    if (isOperationalCreateRestricted && warehouseFilterSet.size === 0) return [];
    const shouldFilterByWarehouse = warehouseFilterSet.size > 0;
    return catalog
      .map((row) => ({ ...row, stock_state: getStockState(row) }))
      .filter((row) => {
        if (!shouldFilterByWarehouse) return true;
        const rowAlmacenes = normalizeAlmacenesSelection(row?.id_almacenes, 50);
        if (rowAlmacenes.length === 0) {
          const fallbackAlmacen = parsePositiveInt(row?.id_almacen);
          if (!fallbackAlmacen) return true;
          return warehouseFilterSet.has(fallbackAlmacen);
        }
        return rowAlmacenes.some((idAlmacen) => warehouseFilterSet.has(idAlmacen));
      })
      .filter((row) => (soloAlertas ? row.stock_state !== 'OK' : true))
      .filter((row) => (query ? `${row.nombre} ${row.descripcion} ${row.item_tipo}`.toLowerCase().includes(query) : true))
      .sort((a, b) => {
        const rank = { 'SIN STOCK': 0, 'STOCK BAJO': 1, OK: 2 };
        const rankA = rank[a.stock_state] ?? 99;
        const rankB = rank[b.stock_state] ?? 99;
        if (rankA !== rankB) return rankA - rankB;
        return a.nombre.localeCompare(b.nombre, 'es');
      })
      .slice(0, 120);
  }, [catalog, catalogSearch, isOperationalCreateRestricted, selectedBaseAlmacenes, soloAlertas]);

  const catalogPages = useMemo(() => {
    const pages = [];
    for (let i = 0; i < filteredCatalog.length; i += CATALOG_CARDS_PER_PAGE) {
      pages.push(filteredCatalog.slice(i, i + CATALOG_CARDS_PER_PAGE));
    }
    return pages;
  }, [filteredCatalog]);

  const catalogDotItems = useMemo(() => {
    const totalPages = catalogPages.length;
    if (totalPages <= 0) return [];

    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => ({ type: 'page', index }));
    }

    const pageSet = new Set([0, totalPages - 1, catalogPage, catalogPage - 1, catalogPage + 1]);
    if (catalogPage <= 2) {
      pageSet.add(1);
      pageSet.add(2);
    }
    if (catalogPage >= totalPages - 3) {
      pageSet.add(totalPages - 2);
      pageSet.add(totalPages - 3);
    }

    const sortedPages = Array.from(pageSet)
      .filter((index) => index >= 0 && index < totalPages)
      .sort((a, b) => a - b);

    const dots = [];
    for (let i = 0; i < sortedPages.length; i += 1) {
      const index = sortedPages[i];
      dots.push({ type: 'page', index });

      const next = sortedPages[i + 1];
      if (next !== undefined && next - index > 1) {
        dots.push({ type: 'ellipsis', key: `ellipsis-${index}-${next}` });
      }
    }
    return dots;
  }, [catalogPage, catalogPages.length]);

  const catalogTotals = useMemo(() => {
    const totals = {
      productos: 0,
      insumos: 0
    };
    for (const item of filteredCatalog) {
      if (item.item_tipo === 'producto') totals.productos += 1;
      if (item.item_tipo === 'insumo') totals.insumos += 1;
    }
    return totals;
  }, [filteredCatalog]);

  // AM: lista de catalogo elegible para editar lineas; excluye repetidos y filtra por sucursal de la orden.
  const editDetalleCatalogOptions = useMemo(() => {
    const existingRows = Array.isArray(editDetallesModal?.rows) ? editDetallesModal.rows : [];
    const newRows = Array.isArray(editDetallesModal?.add_rows) ? editDetallesModal.add_rows : [];
    const idSucursalOrden = parseOptionalPositiveInt(editDetallesModal?.orden?.id_sucursal);
    const takenKeys = new Set(
      [...existingRows, ...newRows]
        .map((row) => {
          const itemTipo = String(row?.item_tipo || '')
            .trim()
            .toLowerCase();
          const idItem = parsePositiveInt(row?.id_item);
          if (!['producto', 'insumo'].includes(itemTipo) || !idItem) return null;
          return `${itemTipo}:${idItem}`;
        })
        .filter(Boolean)
    );

    return catalog
      .map((row) => {
        const idAlmacenesBase = normalizeAlmacenesSelection(
          row?.id_almacenes_disponibles ?? row?.id_almacenes,
          50
        ).filter((idAlmacen) => almacenesMap.has(idAlmacen));
        const idAlmacenesSucursal = idAlmacenesBase.filter((idAlmacen) => {
          if (!idSucursalOrden) return true;
          const almacen = almacenesMap.get(idAlmacen);
          const idSucursalAlmacen = parseOptionalPositiveInt(almacen?.id_sucursal);
          return !idSucursalAlmacen || Number(idSucursalAlmacen) === Number(idSucursalOrden);
        });
        return {
          ...row,
          id_almacenes_sucursal: idAlmacenesSucursal
        };
      })
      .filter((row) => {
        const itemTipo = String(row?.item_tipo || '')
          .trim()
          .toLowerCase();
        const idItem = parsePositiveInt(row?.id_item);
        if (!['producto', 'insumo'].includes(itemTipo) || !idItem) return false;
        if (!Array.isArray(row?.id_almacenes_sucursal) || row.id_almacenes_sucursal.length <= 0) return false;
        return !takenKeys.has(`${itemTipo}:${idItem}`);
      })
      .sort((a, b) => String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es'))
      .slice(0, 300);
  }, [almacenesMap, catalog, editDetallesModal?.add_rows, editDetallesModal?.orden?.id_sucursal, editDetallesModal?.rows]);

  // AM: filtro UX (tipo + buscador) para seleccion rapida de producto/insumo en modal admin.
  const editDetalleCatalogFiltered = useMemo(() => {
    const tipo = String(editDetallesModal?.selected_item_tipo || 'producto')
      .trim()
      .toLowerCase();
    const search = normalizeText(editDetallesModal?.search_item, 120).toLowerCase();

    return editDetalleCatalogOptions
      .filter((row) => String(row?.item_tipo || '').toLowerCase() === tipo)
      .filter((row) =>
        search
          ? `${String(row?.nombre || '')} ${String(row?.descripcion || '')}`.toLowerCase().includes(search)
          : true
      )
      .slice(0, 150);
  }, [editDetalleCatalogOptions, editDetallesModal?.search_item, editDetallesModal?.selected_item_tipo]);

  const quickCreateAlmacenesOptions = useMemo(() => {
    const idSucursalOrden = parseOptionalPositiveInt(quickCreateItemModal?.orden?.id_sucursal);
    if (!idSucursalOrden) return almacenesCatalog;
    const scoped = almacenesCatalog.filter(
      (row) => Number(parseOptionalPositiveInt(row?.id_sucursal) || 0) === Number(idSucursalOrden)
    );
    return scoped.length > 0 ? scoped : almacenesCatalog;
  }, [almacenesCatalog, quickCreateItemModal?.orden?.id_sucursal]);

  useEffect(() => {
    if (!quickCreateItemModal?.open) return;
    if (parsePositiveInt(quickCreateItemModal?.id_almacen)) return;

    const idSucursalUsuarioActual = parseOptionalPositiveInt(workflowCreateContext?.id_sucursal_usuario);
    const preferidosUsuario = quickCreateAlmacenesOptions.filter((row) => {
      const idSucursalAlmacen = parseOptionalPositiveInt(row?.id_sucursal);
      if (!idSucursalUsuarioActual || !idSucursalAlmacen) return false;
      return Number(idSucursalAlmacen) === Number(idSucursalUsuarioActual);
    });
    const idAlmacenPredeterminado = parsePositiveInt(
      preferidosUsuario?.[0]?.id_almacen || quickCreateAlmacenesOptions?.[0]?.id_almacen
    );
    if (!idAlmacenPredeterminado) return;

    setQuickCreateItemModal((prev) => {
      if (!prev?.open) return prev;
      if (parsePositiveInt(prev?.id_almacen)) return prev;
      // AM: asegura autoseleccion de almacen al abrir modal aunque catalogos carguen despues.
      return { ...prev, id_almacen: String(idAlmacenPredeterminado) };
    });
  }, [quickCreateAlmacenesOptions, quickCreateItemModal?.id_almacen, quickCreateItemModal?.open, workflowCreateContext?.id_sucursal_usuario]);

  useEffect(() => {
    const pagesCount = catalogPages.length;
    if (pagesCount === 0) {
      if (catalogPage !== 0) setCatalogPage(0);
      return;
    }
    if (catalogPage > pagesCount - 1) {
      setCatalogPage(0);
    }
  }, [catalogPage, catalogPages.length]);

useEffect(() => {
  // AM: evita depender de memos declarados despues; calcula paginas desde el estado base ya disponible.
  const pagesCount = Math.ceil((ordenes.length || 0) / FLOW_CARDS_PER_PAGE);

  if (pagesCount === 0) {
    if (flowCarouselPage !== 0) setFlowCarouselPage(0);
    return;
  }

  if (flowCarouselPage > pagesCount - 1) {
    setFlowCarouselPage(0);
  }
}, [flowCarouselPage, ordenes.length]);

// AM: al cambiar filtros o pagina backend del flujo, reinicia el carrusel visual local.
useEffect(() => {
  setFlowCarouselPage(0);
}, [page, scope, estadoFiltro, search, flowSucursalFilter]);

  const draftValidation = useMemo(() => {
    const errors = {};
    for (const row of draft) {
      const cantidad = parsePositiveInt(row?.cantidad);
      const almacenesSeleccionados = normalizeAlmacenesSelection(row?.id_almacenes, 1);
      const almacenesDisponiblesItem = normalizeAlmacenesSelection(
        row?.id_almacenes_disponibles ?? row?.id_almacenes,
        50
      );
      if (!cantidad) {
        errors[row.key] = 'Cantidad invalida. Debe ser entero mayor a 0.';
      } else if (almacenesSeleccionados.length !== 1) {
        errors[row.key] = 'Selecciona exactamente 1 almacen destino.';
      } else if (almacenesSeleccionados.some((id) => !almacenesMap.has(id))) {
        errors[row.key] = 'Uno de los almacenes seleccionados ya no existe o esta inactivo.';
      } else if (
        almacenesDisponiblesItem.length > 0 &&
        almacenesSeleccionados.some((id) => !almacenesDisponiblesItem.includes(id))
      ) {
        errors[row.key] = 'El item no esta asignado al almacen seleccionado.';
      }
    }
    return errors;
  }, [draft, almacenesMap]);

  const draftTotals = useMemo(() => {
    const totals = { productos: 0, insumos: 0, unidades: 0 };
    for (const row of draft) {
      const cantidad = parsePositiveInt(row?.cantidad) || 0;
      totals.unidades += cantidad;
      if (row.item_tipo === 'producto') totals.productos += 1;
      if (row.item_tipo === 'insumo') totals.insumos += 1;
    }
    return totals;
  }, [draft]);

  const hasDraftErrors = Object.keys(draftValidation).length > 0;
  const hasDraftContent = draft.length > 0 || draftItemRequests.length > 0;

  // AM: conserva historial operativo visible para sucursal; los cards recepcionados quedan solo consulta.
  const ordenesVisibles = useMemo(() => {
    return ordenes;
  }, [ordenes]);

  const resolveEstadoVisual = useCallback(
    (row) => {
      const estado = resolveEstado(row);
      // AM: admin ve APROBADA como "EN ESPERA" hasta que sucursal registre recepcion.
      if (estado === 'APROBADA' && isAdminFlowActor && !hasReceptionRegistered(row)) return 'EN_ESPERA';
      // AM: para cocina/cajero, una OC recepcionada pasa a visual historica "ENVIADO" sin habilitar acciones operativas.
      if (estado === 'EN_COMPRA' && isSucursalOperativeActor && hasReceptionRegistered(row)) return 'ENVIADO';
      return estado;
    },
    [isAdminFlowActor, isSucursalOperativeActor]
  );

  // AM: replica el mismo patron del carrusel de Nueva Solicitud para el flujo visible actual.
const flowPages = useMemo(() => {
  const pages = [];
  for (let i = 0; i < ordenesVisibles.length; i += FLOW_CARDS_PER_PAGE) {
    pages.push(ordenesVisibles.slice(i, i + FLOW_CARDS_PER_PAGE));
  }
  return pages;
}, [ordenesVisibles]);

const flowDotItems = useMemo(() => {
  const totalPages = flowPages.length;
  if (totalPages <= 0) return [];

  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => ({ type: 'page', index }));
  }

  const pageSet = new Set([0, totalPages - 1, flowCarouselPage, flowCarouselPage - 1, flowCarouselPage + 1]);
  if (flowCarouselPage <= 2) {
    pageSet.add(1);
    pageSet.add(2);
  }
  if (flowCarouselPage >= totalPages - 3) {
    pageSet.add(totalPages - 2);
    pageSet.add(totalPages - 3);
  }

  const sortedPages = Array.from(pageSet)
    .filter((index) => index >= 0 && index < totalPages)
    .sort((a, b) => a - b);

  const dots = [];
  for (let i = 0; i < sortedPages.length; i += 1) {
    const index = sortedPages[i];
    dots.push({ type: 'page', index });

    const next = sortedPages[i + 1];
    if (next !== undefined && next - index > 1) {
      dots.push({ type: 'ellipsis', key: `flow-ellipsis-${index}-${next}` });
    }
  }

  return dots;
}, [flowCarouselPage, flowPages.length]);

  const workflowStats = useMemo(() => {
  const stats = {
    total: ordenesVisibles.length,
    pendientes: 0,
    aprobadas: 0,
    enCompra: 0,
    abastecidas: 0
  };
  for (const row of ordenesVisibles) {
    const estado = resolveEstadoVisual(row);
    if (estado === 'PENDIENTE') stats.pendientes += 1;
    if (estado === 'APROBADA' || estado === 'EN_ESPERA') stats.aprobadas += 1;
    if (estado === 'EN_COMPRA' || estado === 'ENVIADO') stats.enCompra += 1;
    if (estado === 'ABASTECIDA') stats.abastecidas += 1;
  }
  return stats;
}, [ordenesVisibles, resolveEstadoVisual]);

  // AM: layout operativo: arriba solicitud + flujo (si ambos permisos); abajo detalle de solicitud.
  const showDualTopPanels = canCrear && canVerFlujo;

  const loadCatalogs = useCallback(async (options = {}) => {
    if (!(canCrear || canConvertir || canGestionar || canAtenderSolicitudItem)) return;
    if (!options?.silent) setLoadingCatalog(true);
    try {
      // AM: primero resuelve contexto de creacion para derivar filtros seguros de catalogo operativo.
      const [prov, alm, contextoCreacion, catsProd, catsIns, units] = await Promise.all([
        canConvertir && canVerProveedoresCatalogo
          ? inventarioService.getProveedores()
          : Promise.resolve([]),
        (canCrear || canGestionar) && canVerAlmacenesCatalogo
          ? inventarioService.getAlmacenes()
          : Promise.resolve([]),
        canCrear ? inventarioService.getOrdenCompraWorkflowContextoCreacion() : Promise.resolve(null),
        canAtenderSolicitudItem && canVerCategoriasProductosCatalogo
          ? inventarioService.getCategorias()
          : Promise.resolve([]),
        canAtenderSolicitudItem && canVerCategoriasInsumosCatalogo
          ? inventarioService.getCategoriasInsumos()
          : Promise.resolve([]),
        canAtenderSolicitudItem && canVerUnidadesMedidaCatalogo
          ? inventarioService.getUnidadesMedida()
          : Promise.resolve([])
      ]);

      const contextData = contextoCreacion?.data || {};
      const almacenesPermitidosContexto = Array.isArray(contextData?.almacenes_permitidos)
        ? contextData.almacenes_permitidos
        : [];
      const almacenesFinales =
        canCrear && almacenesPermitidosContexto.length > 0 ? almacenesPermitidosContexto : Array.isArray(alm) ? alm : [];
      const idSucursalContexto = parseOptionalPositiveInt(contextData?.id_sucursal_usuario);
      const idAlmacenContexto = parsePositiveInt(almacenesPermitidosContexto?.[0]?.id_almacen);

      const catalogOptions =
        isSucursalOperativeActor && Boolean(contextData?.restringido_a_sucursal_usuario)
          ? {
            id_sucursal: idSucursalContexto || undefined,
            id_almacen: idAlmacenContexto || undefined
          }
          : undefined;

      const [p, i] = await Promise.all([
        canVerProductosCatalogo && (canCrear || canEditarSolicitud)
          ? inventarioService.getProductos(catalogOptions)
          : Promise.resolve([]),
        canVerInsumosCatalogo && (canCrear || canEditarSolicitud)
          ? inventarioService.getInsumos(catalogOptions)
          : Promise.resolve([])
      ]);

      setProductos(Array.isArray(p) ? p : []);
      setInsumos(Array.isArray(i) ? i : []);
      setProveedores(Array.isArray(prov) ? prov : []);
      setAlmacenes(almacenesFinales);
      setWorkflowCreateContext({
        id_sucursal_usuario: parseOptionalPositiveInt(contextData?.id_sucursal_usuario),
        restringido_a_sucursal_usuario: Boolean(contextData?.restringido_a_sucursal_usuario)
      });
      setCategoriasProductos(Array.isArray(catsProd) ? catsProd : []);
      setCategoriasInsumos(Array.isArray(catsIns) ? catsIns : []);
      setUnidadesMedida(Array.isArray(units) ? units : []);
    } catch (error) {
      if (!options?.silent) {
        toast('ERROR', error?.message || 'No se pudo cargar catalogo de ordenes de compra.', 'danger');
      }
    } finally {
      if (!options?.silent) setLoadingCatalog(false);
    }
  }, [
    canAtenderSolicitudItem,
    canConvertir,
    canCrear,
    canEditarSolicitud,
    canGestionar,
    canVerAlmacenesCatalogo,
    canVerCategoriasInsumosCatalogo,
    canVerCategoriasProductosCatalogo,
    canVerInsumosCatalogo,
    canVerProductosCatalogo,
    canVerProveedoresCatalogo,
    canVerUnidadesMedidaCatalogo,
    isSucursalOperativeActor,
    toast
  ]);

  useEffect(() => {
    if (permisosLoading) return;
    void loadCatalogs();
  }, [loadCatalogs, permisosLoading]);

  const loadOrdenes = useCallback(async (options = {}) => {
    if (!canVerFlujo) return;
    if (!options?.silent) setLoadingOrdenes(true);
    try {
      const response = await inventarioService.getOrdenesCompraWorkflow({
        scope,
        estado: estadoFiltro || undefined,
        q: search || undefined,
        page,
        limit: ORDER_LIMIT,
        id_sucursal: flowSucursalFilter || undefined
      });
      setOrdenes(Array.isArray(response?.data) ? response.data : []);
      setPagination({
        page: parsePositiveInt(response?.pagination?.page) || page,
        total: Number(response?.pagination?.total || 0),
        totalPages: parsePositiveInt(response?.pagination?.totalPages) || 1
      });
    } catch (error) {
      if (!options?.silent) {
        toast('ERROR', error?.message || 'No se pudo cargar listado de ordenes.', 'danger');
      }
    } finally {
      if (!options?.silent) setLoadingOrdenes(false);
    }
  }, [canVerFlujo, estadoFiltro, flowSucursalFilter, page, scope, search, toast]);

  useEffect(() => {
    if (permisosLoading) return;
    void loadOrdenes();
  }, [loadOrdenes, permisosLoading]);

  useEffect(() => {
    if (permisosLoading || !canVerFlujo) return undefined;
    // AM: polling moderado del flujo para reflejar cambios externos sin sobrecargar UI/API.
    const intervalId = window.setInterval(() => {
      if (document?.visibilityState === 'hidden' || hasBusyRows) return;
      void loadOrdenes({ silent: true });
    }, ORDERS_POLLING_MS);
    return () => window.clearInterval(intervalId);
  }, [canVerFlujo, hasBusyRows, loadOrdenes, permisosLoading]);

  const addToDraft = (item) => {
    setDraft((prev) => {
      const rows = Array.isArray(prev) ? prev : [];
      const current = rows.find((row) => row.key === item.key);
      if (!current) {
        const itemAlmacenes = normalizeAlmacenesSelection(
          item?.id_almacenes_disponibles ?? item?.id_almacenes,
          50
        );
        const validFromBase = selectedBaseAlmacenes.filter((idAlmacen) => itemAlmacenes.includes(idAlmacen));
        const fallbackAlmacen = itemAlmacenes.length > 0 ? [itemAlmacenes[0]] : [];

        return [
          ...rows,
          {
            ...item,
            cantidad: '1',
            id_almacenes_disponibles: itemAlmacenes,
            id_almacenes: validFromBase.length > 0 ? [validFromBase[0]] : fallbackAlmacen
          }
        ];
      }
      return rows.map((row) =>
        row.key === item.key
          ? { ...row, cantidad: String((parsePositiveInt(row.cantidad) || 0) + 1) }
          : row
      );
    });
  };

  // AM: mantiene control dual de cantidad (stepper +/- y entrada manual) en cards de detalle de solicitud.
  const setDraftCantidad = (key, value) => {
    const safeValue = sanitizeInt(value);
    setDraft((prev) =>
      prev.map((item) =>
        item.key === key
          ? {
              ...item,
              cantidad: safeValue
            }
          : item
      )
    );
  };

  // AM: evita cantidades <= 0 al usar botones de incremento/decremento.
  const stepDraftCantidad = (key, delta) => {
    setDraft((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item;
        const current = parsePositiveInt(item.cantidad) || 1;
        const next = Math.max(1, current + delta);
        return {
          ...item,
          cantidad: String(next)
        };
      })
    );
  };

  // AM: permite elegir exactamente 1 almacen destino por linea de solicitud.
  const toggleDraftAlmacen = (key, idAlmacen) => {
    const safeAlmacenId = parsePositiveInt(idAlmacen);
    if (!safeAlmacenId || !almacenesMap.has(safeAlmacenId)) return;

    setDraft((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item;
        const itemAlmacenes = normalizeAlmacenesSelection(item?.id_almacenes, 50);
        if (itemAlmacenes.length > 0 && !itemAlmacenes.includes(safeAlmacenId)) return item;
        return {
          ...item,
          id_almacenes: [safeAlmacenId]
        };
      })
    );
  };

  const toggleDraftAlmacenBase = (idAlmacen) => {
    const safeAlmacenId = parsePositiveInt(idAlmacen);
    if (!safeAlmacenId || !almacenesMap.has(safeAlmacenId)) return;
    setDraftAlmacenesBase([safeAlmacenId]);
  };

  const addItemRequestToDraft = () => {
    // AM: defensa extra en frontend para impedir solicitudes_item en perfiles con alta directa.
    if (!canSolicitarItemNuevo) return;
    const tipoItem = String(itemRequestModal.tipo_item || '').toLowerCase();
    const nombreSugerido = normalizeText(itemRequestModal.nombre_sugerido, 160);
    const descripcion = normalizeText(itemRequestModal.descripcion, 500);
    const cantidadSugerida = parsePositiveInt(itemRequestModal.cantidad_sugerida);

    if (!['producto', 'insumo'].includes(tipoItem)) {
      setItemRequestModal((prev) => ({ ...prev, error: 'Selecciona tipo de item valido.' }));
      return;
    }
    if (!nombreSugerido) {
      setItemRequestModal((prev) => ({ ...prev, error: 'Nombre sugerido es obligatorio.' }));
      return;
    }
    if (!cantidadSugerida) {
      setItemRequestModal((prev) => ({ ...prev, error: 'Cantidad sugerida debe ser un entero mayor a 0.' }));
      return;
    }

    setDraftItemRequests((prev) => [
      ...(Array.isArray(prev) ? prev : []),
      {
        key: `solicitud:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        tipo_item: tipoItem,
        nombre_sugerido: nombreSugerido,
        descripcion,
        cantidad_sugerida: String(cantidadSugerida)
      }
    ]);
    setItemRequestModal(emptyItemRequestModal());
  };

  const createSolicitud = async () => {
    if (!canCrear) return;
    if (!hasDraftContent) {
      toast('VALIDACION', 'Agrega items existentes o solicitudes de items nuevos para crear la solicitud.', 'warning');
      return;
    }
    if (hasDraftErrors) {
      toast('VALIDACION', 'Corrige las cantidades invalidas antes de crear la solicitud.', 'warning');
      return;
    }

    const detalles = [];
    for (const row of draft) {
      const idItem = parsePositiveInt(row.id_item);
      const cantidad = parsePositiveInt(row.cantidad);
      const idAlmacenes = normalizeAlmacenesSelection(row.id_almacenes, 1).filter((idAlmacen) =>
        almacenesMap.has(idAlmacen)
      );
      if (!idItem || !cantidad || !['producto', 'insumo'].includes(row.item_tipo)) {
        toast('VALIDACION', `Detalle invalido en ${row.nombre}.`, 'warning');
        return;
      }
      if (idAlmacenes.length !== 1) {
        toast('VALIDACION', `Selecciona 1 almacen destino en ${row.nombre}.`, 'warning');
        return;
      }
      detalles.push({
        item_tipo: row.item_tipo,
        id_item: idItem,
        cantidad,
        id_almacen_destino: idAlmacenes[0]
      });
    }

    setCreating(true);
    try {
      // AM: crea solicitud de orden en estado pendiente.
      await inventarioService.crearOrdenCompraWorkflow({
        observacion: normalizeText(observacion, 1000),
        detalles,
        // AM: perfiles administrativos no envian solicitudes_item; solo roles operativos sin alta directa.
        solicitudes_item: canSolicitarItemNuevo
          ? draftItemRequests.map((row) => ({
            tipo_item: row.tipo_item,
            nombre_sugerido: normalizeText(row.nombre_sugerido, 160),
            descripcion: normalizeText(row.descripcion, 500),
            cantidad_sugerida: parsePositiveInt(row.cantidad_sugerida) || 1
          }))
          : []
      });
      toast('SOLICITUD CREADA', 'Orden registrada correctamente.', 'success');
      setDraft([]);
      setDraftItemRequests([]);
      setObservacion('');
      setPage(1);
      await loadOrdenes();
    } catch (error) {
      toast('ERROR', error?.message || 'No se pudo crear la solicitud.', 'danger');
    } finally {
      setCreating(false);
    }
  };

  const uploadInventarioImage = async (file, options = {}) => {
    const bucket = String(options?.bucket || 'admin-docs').trim() || 'admin-docs';
    const fileValidationContext =
      options?.validationContext || INVENTARIO_IMAGE_CONTEXT.OC_EVIDENCIAS_PRIVADAS;
    const fileError = getInventarioImageFileError(file, fileValidationContext);
    if (fileError) {
      throw new Error(fileError);
    }

    let fileToUpload = file;
    if (resolveEvidenceKindFromPayload(file?.type, '') === 'image') {
      fileToUpload = await optimizeInventarioImageForUpload(file, fileValidationContext);
      const optimizedFileError = getInventarioImageFileError(fileToUpload, fileValidationContext);
      if (optimizedFileError) {
        throw new Error(optimizedFileError);
      }
    }

    const payload = await buildInventarioImageUploadPayload(fileToUpload);
    const response = await inventarioService.crearArchivoImagen({
      ...payload,
      bucket
    });
    const idArchivo = parsePositiveInt(response?.id_archivo);
    if (!idArchivo) {
      throw new Error('No se pudo obtener id_archivo para la evidencia.');
    }

    return {
      id_archivo: idArchivo,
      url_publica: resolveInventarioImageUrl(response?.url_publica || ''),
      mime_type: String(fileToUpload?.type || '').trim().toLowerCase()
    };
  };

  const resolveOrderEvidenceAccess = useCallback(
    async (idOrden, evidenceType, fallbackRawUrl = '') => {
      const idOrdenCompra = parsePositiveInt(idOrden);
      const fallbackUrl = resolveInventarioImageUrl(fallbackRawUrl);
      const fallbackKind = resolveEvidenceKindFromPayload('', fallbackUrl);
      if (!idOrdenCompra) {
        return {
          url: fallbackUrl,
          mime_type: '',
          kind: fallbackKind
        };
      }

      try {
        const response =
          evidenceType === 'transferencia'
            ? await inventarioService.getOrdenCompraWorkflowEvidenciaTransferencia(idOrdenCompra)
            : await inventarioService.getOrdenCompraWorkflowEvidenciaFactura(idOrdenCompra);
        const secureUrl = resolveInventarioImageUrl(response?.data?.url || response?.url || '') || fallbackUrl;
        const mimeType = String(response?.data?.mime_type || '').trim().toLowerCase();
        return {
          url: secureUrl,
          mime_type: mimeType,
          kind: resolveEvidenceKindFromPayload(mimeType, secureUrl)
        };
      } catch (error) {
        const status = Number(error?.status || 0);
        if (status === 403 || status === 404) {
          return {
            url: fallbackUrl,
            mime_type: '',
            kind: fallbackKind
          };
        }
        throw error;
      }
    },
    []
  );

  const setBusy = (idOrden, value) => setRowBusy((prev) => ({ ...prev, [idOrden]: value }));

  // AM: modal de revision para sustituir prompts y reforzar validacion de comentarios.
  const openReviewModal = (orden, mode) => {
    setReviewModal({
      open: true,
      mode,
      orden,
      comentario: '',
      loading: false,
      error: ''
    });
  };

  const submitReviewModal = async () => {
    const idOrden = parsePositiveInt(reviewModal?.orden?.id_orden_compra);
    const accionRevision = String(reviewModal?.mode || '')
      .trim()
      .toLowerCase();
    const estadoOrdenActual = resolveEstado(reviewModal?.orden);
    const comentario = normalizeText(reviewModal.comentario, 1000);
    if (!idOrden) {
      setReviewModal((prev) => ({ ...prev, error: 'No se pudo identificar la orden. Cierra y vuelve a intentar.' }));
      return;
    }
    if (!['aprobar', 'rechazar'].includes(accionRevision)) {
      setReviewModal((prev) => ({ ...prev, error: 'Accion invalida. Recarga y vuelve a intentar.' }));
      return;
    }
    if (reviewModal.loading || rowBusy[idOrden]) return;
    if (estadoOrdenActual !== 'PENDIENTE') {
      setReviewModal((prev) => ({
        ...prev,
        error: 'La orden ya no esta en estado PENDIENTE. Recarga el detalle antes de continuar.'
      }));
      return;
    }
    if (accionRevision === 'rechazar' && !comentario) {
      setReviewModal((prev) => ({ ...prev, error: 'El motivo de rechazo es obligatorio.' }));
      return;
    }

    setReviewModal((prev) => ({ ...prev, loading: true, error: '' }));
    setBusy(idOrden, true);
    try {
      if (accionRevision === 'rechazar') {
        await inventarioService.rechazarOrdenCompraWorkflow(idOrden, { comentario });
      } else {
        await inventarioService.aprobarOrdenCompraWorkflow(idOrden, { comentario });
      }
      toast(
        'ORDEN ACTUALIZADA',
        `Orden #${formatVisibleOrderNumber(reviewModal?.orden)} ${
          accionRevision === 'rechazar' ? 'rechazada' : 'aprobada'
        }.`,
        accionRevision === 'rechazar' ? 'warning' : 'success'
      );
      setReviewModal(emptyReviewModal());
      await loadOrdenes();
      if (detalleActual?.data?.orden?.id_orden_compra === idOrden) {
        await verDetalle({ id_orden_compra: idOrden });
      }
    } catch (error) {
      setReviewModal((prev) => ({
        ...prev,
        loading: false,
        error: error?.message || 'No se pudo actualizar la orden.'
      }));
    } finally {
      setBusy(idOrden, false);
    }
  };

  const openEditDetallesModal = async (orden) => {
    const idOrden = parsePositiveInt(orden?.id_orden_compra);
    if (!idOrden) return;
    setBusy(idOrden, true);
    try {
      const response = await inventarioService.getOrdenCompraWorkflowById(idOrden);
      const orderData = response?.data || {};
      const estado = resolveEstado(orderData?.orden || orden);
      if (estado !== 'PENDIENTE') {
        toast('VALIDACION', 'Solo puedes editar lineas en estado PENDIENTE.', 'warning');
        return;
      }

      const detalles = Array.isArray(orderData?.detalles) ? orderData.detalles : [];
      setEditDetallesModal({
        open: true,
        loading: false,
        error: '',
        orden: orderData?.orden || orden,
        rows: detalles.map((row) => ({
          id_detalle_orden: Number(row.id_detalle_orden),
          item_nombre: `${row.item_nombre || row.item_tipo || `Detalle #${row.id_detalle_orden}`}${
            row.almacen_destino_nombre ? ` - ${row.almacen_destino_nombre}` : ''
          }`,
          item_tipo: row.item_tipo || '-',
          id_item: parsePositiveInt(row?.id_producto || row?.id_insumo),
          cantidad: String(row.cantidad_orden || 0),
          eliminar: false
        })),
        add_rows: [],
        selected_item_tipo: 'producto',
        search_item: ''
      });
    } catch (error) {
      toast('ERROR', error?.message || 'No se pudo abrir edicion de detalles.', 'danger');
    } finally {
      setBusy(idOrden, false);
    }
  };

  const submitEditDetallesModal = async () => {
    const idOrden = parsePositiveInt(editDetallesModal?.orden?.id_orden_compra);
    if (!idOrden) return;
    const actualizar = [];
    const eliminar = [];
    const agregar = [];

    for (const row of editDetallesModal.rows) {
      const idDetalle = parsePositiveInt(row.id_detalle_orden);
      if (!idDetalle) continue;
      if (row.eliminar) {
        eliminar.push(idDetalle);
        continue;
      }
      const cantidad = parsePositiveInt(row.cantidad);
      if (!cantidad) {
        setEditDetallesModal((prev) => ({
          ...prev,
          error: `Cantidad invalida en ${row.item_nombre}.`
        }));
        return;
      }
      actualizar.push({ id_detalle_orden: idDetalle, cantidad });
    }

    for (const row of Array.isArray(editDetallesModal.add_rows) ? editDetallesModal.add_rows : []) {
      const itemTipo = String(row?.item_tipo || '')
        .trim()
        .toLowerCase();
      const idItem = parsePositiveInt(row?.id_item);
      const cantidad = parsePositiveInt(row?.cantidad);
      const idAlmacenDestino = parsePositiveInt(row?.id_almacen_destino);
      if (!['producto', 'insumo'].includes(itemTipo) || !idItem || !cantidad || !idAlmacenDestino) {
        setEditDetallesModal((prev) => ({
          ...prev,
          error: `Hay una linea nueva invalida en ${row?.item_nombre || 'item agregado'}.`
        }));
        return;
      }

      agregar.push({
        item_tipo: itemTipo,
        id_item: idItem,
        cantidad,
        id_almacen_destino: idAlmacenDestino
      });
    }

    if (actualizar.length === 0 && eliminar.length === 0 && agregar.length === 0) {
      setEditDetallesModal((prev) => ({ ...prev, error: 'No hay cambios para guardar.' }));
      return;
    }

    setEditDetallesModal((prev) => ({ ...prev, loading: true, error: '' }));
    setBusy(idOrden, true);
    try {
      await inventarioService.actualizarDetalleOrdenCompraWorkflow(idOrden, { actualizar, eliminar, agregar });
      toast(
        'DETALLE ACTUALIZADO',
        `Orden #${formatVisibleOrderNumber(editDetallesModal?.orden)} actualizada correctamente.`,
        'success'
      );
      setEditDetallesModal(emptyEditDetallesModal());
      await loadOrdenes();
      if (detalleActual?.data?.orden?.id_orden_compra === idOrden) {
        await verDetalle({ id_orden_compra: idOrden });
      }
    } catch (error) {
      setEditDetallesModal((prev) => ({
        ...prev,
        loading: false,
        error: error?.message || 'No se pudo actualizar detalle de la orden.'
      }));
    } finally {
      setBusy(idOrden, false);
    }
  };

  // AM: permite al administrador agregar nuevas lineas al editar una OC pendiente.
  const addCatalogItemToEditModal = (item) => {
    const idItem = parsePositiveInt(item?.id_item);
    const itemTipo = String(item?.item_tipo || '')
      .trim()
      .toLowerCase();
    if (!idItem || !['producto', 'insumo'].includes(itemTipo)) return;

    const idSucursalOrden = parseOptionalPositiveInt(editDetallesModal?.orden?.id_sucursal);
    const almacenesItem = normalizeAlmacenesSelection(
      item?.id_almacenes_sucursal ?? item?.id_almacenes_disponibles ?? item?.id_almacenes,
      50
    ).filter((idAlmacen) => almacenesMap.has(idAlmacen));
    const idAlmacenesDisponibles = almacenesItem.filter((idAlmacen) => {
      if (!idSucursalOrden) return true;
      const almacen = almacenesMap.get(idAlmacen);
      const idSucursalAlmacen = parseOptionalPositiveInt(almacen?.id_sucursal);
      return !idSucursalAlmacen || Number(idSucursalAlmacen) === Number(idSucursalOrden);
    });
    const idAlmacenDestino = idAlmacenesDisponibles[0] || null;
    if (!idAlmacenDestino) {
      toast('VALIDACION', `El item ${item?.nombre || idItem} no tiene almacen destino activo.`, 'warning');
      return;
    }

    setEditDetallesModal((prev) => {
      const addRows = Array.isArray(prev.add_rows) ? prev.add_rows : [];
      const duplicate = addRows.find(
        (row) => Number(row.id_item) === Number(idItem) && String(row.item_tipo) === String(itemTipo)
      );
      if (duplicate) {
        return {
          ...prev,
          error: '',
          add_rows: addRows.map((row) =>
            row.key === duplicate.key
              ? { ...row, cantidad: String((parsePositiveInt(row.cantidad) || 0) + 1) }
              : row
          )
        };
      }

      return {
        ...prev,
        error: '',
        add_rows: [
          ...addRows,
          {
            key: `new:${itemTipo}:${idItem}:${Date.now()}`,
            item_tipo: itemTipo,
            id_item: idItem,
            item_nombre: item?.nombre || `${itemTipo} #${idItem}`,
            cantidad: '1',
            id_almacen_destino: idAlmacenDestino,
            id_almacenes_disponibles: idAlmacenesDisponibles
          }
        ]
      };
    });
  };

  // AM: modal dedicado para aprobar/rechazar solicitudes de item no registrado.
  const openItemRequestDecision = (orden, solicitud, accion) => {
    setItemRequestDecisionModal({
      open: true,
      loading: false,
      error: '',
      orden,
      solicitud,
      accion,
      comentario: ''
    });
  };

  // AM: persiste decision administrativa de solicitud de item (aprobar/rechazar).
  const submitItemRequestDecision = async () => {
    const idOrden = parsePositiveInt(itemRequestDecisionModal?.orden?.id_orden_compra);
    const idSolicitud = parsePositiveInt(itemRequestDecisionModal?.solicitud?.id_solicitud_item);
    const accion = String(itemRequestDecisionModal?.accion || '').trim().toLowerCase();
    const estadoOrdenActual = resolveEstado(itemRequestDecisionModal?.orden);
    const estadoSolicitudActual = parseItemRequestState(itemRequestDecisionModal?.solicitud?.estado);
    const comentario = normalizeText(itemRequestDecisionModal?.comentario, 1000);
    if (!idOrden || !idSolicitud) {
      setItemRequestDecisionModal((prev) => ({
        ...prev,
        error: 'No se pudo identificar la solicitud. Cierra y vuelve a intentar.'
      }));
      return;
    }
    if (!['aprobar', 'rechazar'].includes(accion)) {
      setItemRequestDecisionModal((prev) => ({
        ...prev,
        error: 'Accion invalida para la solicitud de item.'
      }));
      return;
    }
    if (itemRequestDecisionModal.loading || rowBusy[idOrden]) return;
    if (estadoOrdenActual !== 'PENDIENTE') {
      setItemRequestDecisionModal((prev) => ({
        ...prev,
        error: 'La orden ya no esta en estado PENDIENTE. Recarga el detalle antes de continuar.'
      }));
      return;
    }
    const canReviewByState =
      accion === 'aprobar'
        ? estadoSolicitudActual === ITEM_REQUEST_STATE_PENDIENTE
        : [ITEM_REQUEST_STATE_PENDIENTE, ITEM_REQUEST_STATE_EN_REVISION].includes(estadoSolicitudActual);
    if (!canReviewByState) {
      setItemRequestDecisionModal((prev) => ({
        ...prev,
        error: 'La solicitud ya no admite esta accion. Recarga el detalle antes de continuar.'
      }));
      return;
    }
    if (accion === 'rechazar' && !comentario) {
      setItemRequestDecisionModal((prev) => ({
        ...prev,
        error: 'El comentario es obligatorio para rechazar la solicitud.'
      }));
      return;
    }

    setBusy(idOrden, true);
    setItemRequestDecisionModal((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      await inventarioService.revisarSolicitudItemOrdenCompraWorkflow(idOrden, idSolicitud, {
        accion,
        comentario_revision: comentario || undefined
      });
      toast(
        'SOLICITUD ACTUALIZADA',
        `Solicitud #${idSolicitud} ${accion === 'aprobar' ? 'aprobada' : 'rechazada'}.`,
        accion === 'aprobar' ? 'success' : 'warning'
      );
      setItemRequestDecisionModal(emptyItemRequestDecisionModal());
      await loadOrdenes();
      if (detalleActual?.data?.orden?.id_orden_compra === idOrden) {
        await verDetalle({ id_orden_compra: idOrden });
      }
    } catch (error) {
      setItemRequestDecisionModal((prev) => ({
        ...prev,
        loading: false,
        error: error?.message || 'No se pudo actualizar la solicitud de item.'
      }));
    } finally {
      setBusy(idOrden, false);
    }
  };

  // AM: prepara alta rapida de catalogo a partir de una solicitud aprobada.
  const openQuickCreateItemModalFromRequest = (orden, solicitud) => {
    const idSolicitud = parsePositiveInt(solicitud?.id_solicitud_item);
    if (!idSolicitud) return;
    const tipoItem = String(solicitud?.tipo_item || '')
      .trim()
      .toLowerCase();
    if (!['producto', 'insumo'].includes(tipoItem)) return;

    const idSucursalOrden = parseOptionalPositiveInt(orden?.id_sucursal);
    const almacenesCompatibles = almacenesCatalog.filter((row) => {
      const idSucursalAlmacen = parseOptionalPositiveInt(row?.id_sucursal);
      if (!idSucursalOrden || !idSucursalAlmacen) return true;
      return Number(idSucursalAlmacen) === Number(idSucursalOrden);
    });
    const idSucursalUsuarioActual = parseOptionalPositiveInt(workflowCreateContext?.id_sucursal_usuario);
    const preferidosUsuario = almacenesCompatibles.filter((row) => {
      const idSucursalAlmacen = parseOptionalPositiveInt(row?.id_sucursal);
      if (!idSucursalUsuarioActual || !idSucursalAlmacen) return false;
      return Number(idSucursalAlmacen) === Number(idSucursalUsuarioActual);
    });
    const idAlmacenPredeterminado = parsePositiveInt(
      preferidosUsuario?.[0]?.id_almacen || almacenesCompatibles?.[0]?.id_almacen
    );

    setQuickCreateItemModal({
      open: true,
      loading: false,
      error: '',
      orden,
      solicitud,
      tipo_item: tipoItem,
      nombre: normalizeText(solicitud?.nombre_sugerido, 160) || '',
      descripcion: normalizeText(solicitud?.descripcion, 500) || '',
      cantidad: String(parsePositiveInt(solicitud?.cantidad_sugerida) || 1),
      precio: '0',
      stock_minimo: '0',
      id_categoria_producto: '',
      id_categoria_insumo: '',
      id_unidad_medida: '',
      // AM: almacén predeterminado por sucursal del usuario (si aplica) y fallback a sucursal de la orden.
      id_almacen: String(idAlmacenPredeterminado || '')
    });
  };

  // AM: crea producto/insumo real y marca la solicitud como atendida en la OC.
  const submitQuickCreateItemModal = async () => {
    const idOrden = parsePositiveInt(quickCreateItemModal?.orden?.id_orden_compra);
    const idSolicitud = parsePositiveInt(quickCreateItemModal?.solicitud?.id_solicitud_item);
    const tipoItem = String(quickCreateItemModal?.tipo_item || '')
      .trim()
      .toLowerCase();
    if (!idOrden || !idSolicitud || !['producto', 'insumo'].includes(tipoItem)) return;
    if (tipoItem === 'producto' && !canCrearProductos) {
      setQuickCreateItemModal((prev) => ({ ...prev, error: 'No tienes permiso para crear productos.' }));
      return;
    }
    if (tipoItem === 'insumo' && !canCrearInsumos) {
      setQuickCreateItemModal((prev) => ({ ...prev, error: 'No tienes permiso para crear insumos.' }));
      return;
    }

    const nombre = normalizeText(quickCreateItemModal?.nombre, 160);
    const nombreInsumo = normalizeText(nombre, 80);
    const descripcion = normalizeText(quickCreateItemModal?.descripcion, 500) || '';
    const cantidad = parsePositiveInt(quickCreateItemModal?.cantidad);
    const precio = parseNonNegativeNumber(quickCreateItemModal?.precio);
    const stockMinimo = parseNonNegativeNumber(quickCreateItemModal?.stock_minimo);
    const idAlmacen = parsePositiveInt(quickCreateItemModal?.id_almacen);
    if (!nombre || !cantidad || precio === null || stockMinimo === null || !idAlmacen) {
      setQuickCreateItemModal((prev) => ({
        ...prev,
        error: 'Completa nombre, cantidad, precio, stock minimo y almacen validos.'
      }));
      return;
    }

    setBusy(idOrden, true);
    setQuickCreateItemModal((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      let idItemCreado = null;
      if (tipoItem === 'producto') {
        const idCategoriaProducto = parsePositiveInt(quickCreateItemModal?.id_categoria_producto);
        if (!idCategoriaProducto) {
          setQuickCreateItemModal((prev) => ({
            ...prev,
            loading: false,
            error: 'Selecciona categoria de producto.'
          }));
          return;
        }
        const payloadProducto = {
          nombre_producto: nombre,
          precio,
          cantidad,
          stock_minimo: Math.trunc(stockMinimo),
          descripcion_producto: descripcion,
          id_categoria_producto: idCategoriaProducto,
          id_almacen: idAlmacen
        };
        const responseProducto = await inventarioService.crearProducto(payloadProducto);
        idItemCreado = parsePositiveInt(responseProducto?.id_producto || responseProducto?.data?.id_producto);
      } else {
        const idCategoriaInsumo = parsePositiveInt(quickCreateItemModal?.id_categoria_insumo);
        if (!idCategoriaInsumo) {
          setQuickCreateItemModal((prev) => ({
            ...prev,
            loading: false,
            error: 'Selecciona categoria de insumo.'
          }));
          return;
        }
        const idUnidadMedida = parseOptionalPositiveInt(quickCreateItemModal?.id_unidad_medida);
        const payloadInsumo = {
          nombre_insumo: nombreInsumo,
          precio,
          cantidad,
          stock_minimo: Math.trunc(stockMinimo),
          descripcion,
          id_categoria_insumo: idCategoriaInsumo,
          id_unidad_medida: idUnidadMedida || undefined,
          id_almacen: idAlmacen
        };
        const responseInsumo = await inventarioService.crearInsumo(payloadInsumo);
        idItemCreado = parsePositiveInt(responseInsumo?.id_insumo || responseInsumo?.data?.id_insumo);
      }

      if (!idItemCreado) {
        throw new Error('No se pudo obtener el ID del item creado.');
      }

      // AM: marca la solicitud como atendida solo cuando el alta de catalogo fue exitosa.
      await inventarioService.atenderSolicitudItemOrdenCompraWorkflow(idOrden, idSolicitud, {
        id_item_creado: idItemCreado
      });

      toast('ITEM REGISTRADO', `${tipoItem} creado y solicitud atendida correctamente.`, 'success');
      setQuickCreateItemModal(emptyQuickCreateItemModal());
      await Promise.all([loadCatalogs({ silent: true }), loadOrdenes()]);
      if (detalleActual?.data?.orden?.id_orden_compra === idOrden) {
        await verDetalle({ id_orden_compra: idOrden });
      }
    } catch (error) {
      setQuickCreateItemModal((prev) => ({
        ...prev,
        loading: false,
        error: error?.message || 'No se pudo crear el item solicitado.'
      }));
    } finally {
      setBusy(idOrden, false);
    }
  };

  const verDetalle = async (orden) => {
    const idOrden = parsePositiveInt(orden?.id_orden_compra);
    if (!idOrden) return;
    setDetailEvidencePreview({ url: '', title: '', kind: 'image', loading: false, error: '' });
    setDetalleActual({ loading: true, error: '', data: null });
    try {
      const response = await inventarioService.getOrdenCompraWorkflowById(idOrden);
      setDetalleActual({ loading: false, error: '', data: response?.data || null });
    } catch (error) {
      setDetalleActual({
        loading: false,
        error: error?.message || 'No se pudo cargar detalle.',
        data: null
      });
    }
  };

  const closeDetalleModal = () => {
    setDetalleActual({ loading: false, error: '', data: null });
    setDetailEvidencePreview({ url: '', title: '', kind: 'image', loading: false, error: '' });
  };

  const openDetailEvidencePreview = useCallback(
    async (idOrden, row) => {
      const idOrdenCompra = parsePositiveInt(idOrden);
      const evidenceType = String(row?.tipo_evidencia || '')
        .trim()
        .toUpperCase();
      const previewTitle = formatEvidenceTypeLabel(row?.tipo_evidencia);

      setDetailEvidencePreview({
        url: '',
        title: previewTitle,
        kind: 'image',
        loading: true,
        error: ''
      });
      try {
        let evidenceAccess = { url: '', kind: 'unknown' };
        if (evidenceType === 'DEPOSITO_TRANSFERENCIA') {
          evidenceAccess = await resolveOrderEvidenceAccess(
            idOrdenCompra,
            'transferencia',
            row?.evidencia_url_publica
          );
        } else {
          evidenceAccess = await resolveOrderEvidenceAccess(
            idOrdenCompra,
            'factura',
            row?.evidencia_url_publica
          );
        }

        if (!evidenceAccess?.url) {
          throw new Error('Archivo no disponible.');
        }

        setDetailEvidencePreview({
          url: evidenceAccess.url,
          title: previewTitle,
          kind: evidenceAccess.kind || resolveEvidenceKindFromPayload('', evidenceAccess.url),
          loading: false,
          error: ''
        });
      } catch (error) {
        setDetailEvidencePreview({
          url: '',
          title: previewTitle,
          kind: 'image',
          loading: false,
          error: error?.message || 'No se pudo abrir la evidencia.'
        });
      }
    },
    [resolveOrderEvidenceAccess]
  );

  const openConvert = async (orden) => {
    const idOrden = parsePositiveInt(orden?.id_orden_compra);
    if (!idOrden) return;
    setBusy(idOrden, true);
    try {
      const response = await inventarioService.getOrdenCompraWorkflowById(idOrden);
      const orderData = response?.data?.orden || orden || {};
      const compraActual = response?.data?.compra_actual || {};
      const detalles = Array.isArray(response?.data?.detalles) ? response.data.detalles : [];
      if (detalles.length === 0) {
        toast('VALIDACION', 'La orden no tiene detalle para convertir.', 'warning');
        return;
      }
      if (!hasReceptionRegistered(orderData)) {
        toast('VALIDACION', 'La recepcion de sucursal aun no esta registrada para esta orden.', 'warning');
        return;
      }
      const descuentoTipoActual = resolveDiscountType(compraActual?.descuento_tipo);
      const descuentoValorActual = parseNonNegativeNumber(compraActual?.descuento_valor);
      const totalDetalleActual = parseNonNegativeNumber(compraActual?.total_detalle);
      const isvActual = parseNonNegativeNumber(compraActual?.isv);
      const isvPctActual =
        totalDetalleActual && totalDetalleActual > 0 && isvActual !== null
          ? round2((isvActual * 100) / totalDetalleActual)
          : 0;
      // AM: inicializa costos administrativos por item desde compra previa si existe; fallback a precio de referencia.
      const detallesAdmin = detalles.map((row) => {
        const idDetalleOrden = parsePositiveInt(row?.id_detalle_orden);
        const cantidadOrden = parsePositiveInt(row?.cantidad_orden) || 0;
        const subTotalCompra = parseNonNegativeNumber(row?.sub_total_compra);
        const precioReferencia = parseNonNegativeNumber(row?.precio_referencia) ?? 0;
        const precioUnitario =
          cantidadOrden > 0 && subTotalCompra !== null ? round2(subTotalCompra / cantidadOrden) : round2(precioReferencia);
        const descuentoLinea = round2(parseNonNegativeNumber(row?.descuento_compra) ?? 0);
        return {
          id_detalle_orden: idDetalleOrden,
          item_nombre: row?.item_nombre || row?.item_tipo || `Detalle #${idDetalleOrden || '-'}`,
          cantidad_orden: cantidadOrden,
          precio_unitario: String(precioUnitario),
          descuento: String(descuentoLinea)
        };
      });
      const [facturaRecepcionAccess, transferenciaAccess] = await Promise.all([
        resolveOrderEvidenceAccess(idOrden, 'factura', orderData?.factura_recepcion_url_publica),
        resolveOrderEvidenceAccess(idOrden, 'transferencia', compraActual?.transferencia_url_publica)
      ]);
      // AM: modal administrativo minimo para guardar datos y luego abastecer.
      setConvertPanel({
        open: true,
        loading: false,
        submit_action: '',
        error: '',
        orden: { ...orden, ...orderData },
        id_proveedor: sanitizeInt(compraActual?.id_proveedor || ''),
        fecha_compra: hasValue(compraActual?.fecha)
          ? String(compraActual.fecha).replace('T', ' ').split(' ')[0]
          : '',
        observacion_admin:
          normalizeText(compraActual?.observacion_pago, 1000) ||
          normalizeText(compraActual?.referencia_transferencia, 1000) ||
          '',
        descuento_tipo: descuentoTipoActual,
        descuento_valor: String(round2(descuentoValorActual ?? 0)),
        isv_pct: String(round2(isvPctActual)),
        detalles: detallesAdmin,
        factura_recepcion_url: facturaRecepcionAccess?.url || '',
        factura_recepcion_mime_type: facturaRecepcionAccess?.mime_type || '',
        transferencia_url_actual: transferenciaAccess?.url || '',
        transferencia_mime_type: transferenciaAccess?.mime_type || '',
        transferencia_file: null,
        transferencia_file_mime_type: '',
        transferencia_preview_url: '',
        transferencia_error: ''
      });
    } catch (error) {
      toast('ERROR', error?.message || 'No se pudo abrir conversion.', 'danger');
    } finally {
      setBusy(idOrden, false);
    }
  };

  // AM: actualiza costos/descuentos por linea sin salir del modal administrativo.
  const updateConvertDetailField = useCallback((idDetalleOrden, field, rawValue) => {
    const idDetalle = parsePositiveInt(idDetalleOrden);
    if (!idDetalle) return;
    setConvertPanel((prev) => ({
      ...prev,
      error: '',
      detalles: Array.isArray(prev.detalles)
        ? prev.detalles.map((row) =>
            parsePositiveInt(row?.id_detalle_orden) === idDetalle ? { ...row, [field]: sanitizeDecimal(rawValue) } : row
          )
        : prev.detalles
    }));
  }, []);

  // AM: calcula resumen financiero en cliente para validacion inmediata antes del POST /convertir.
  const convertPreview = useMemo(() => {
    const details = Array.isArray(convertPanel?.detalles) ? convertPanel.detalles : [];
    if (details.length === 0) {
      return {
        has_error: false,
        error: '',
        sub_total: 0,
        descuento_lineas: 0,
        descuento_global: 0,
        descuento_total: 0,
        total_detalle: 0,
        isv: 0,
        total: 0
      };
    }

    let subTotal = 0;
    let descuentoLineas = 0;
    for (const row of details) {
      const cantidad = parsePositiveInt(row?.cantidad_orden) || 0;
      const precioUnitario = parseNonNegativeNumber(row?.precio_unitario);
      const descuentoLinea = parseNonNegativeNumber(row?.descuento);
      if (precioUnitario === null || descuentoLinea === null) {
        return {
          has_error: true,
          error: 'Hay costos o descuentos de linea invalidos.',
          sub_total: 0,
          descuento_lineas: 0,
          descuento_global: 0,
          descuento_total: 0,
          total_detalle: 0,
          isv: 0,
          total: 0
        };
      }
      const itemSubTotal = round2(cantidad * precioUnitario);
      if (descuentoLinea > itemSubTotal) {
        return {
          has_error: true,
          error: `El descuento de linea no puede superar su subtotal (${row?.item_nombre || 'item'}).`,
          sub_total: 0,
          descuento_lineas: 0,
          descuento_global: 0,
          descuento_total: 0,
          total_detalle: 0,
          isv: 0,
          total: 0
        };
      }
      subTotal = round2(subTotal + itemSubTotal);
      descuentoLineas = round2(descuentoLineas + round2(descuentoLinea));
    }

    const descuentoTipo = resolveDiscountType(convertPanel?.descuento_tipo);
    const descuentoValor = parseNonNegativeNumber(convertPanel?.descuento_valor);
    if (descuentoValor === null) {
      return {
        has_error: true,
        error: 'Descuento global invalido.',
        sub_total: 0,
        descuento_lineas: 0,
        descuento_global: 0,
        descuento_total: 0,
        total_detalle: 0,
        isv: 0,
        total: 0
      };
    }
    if (descuentoTipo === DISCOUNT_TYPE_PORCENTAJE && descuentoValor > 100) {
      return {
        has_error: true,
        error: 'Descuento global en porcentaje no puede exceder 100.',
        sub_total: 0,
        descuento_lineas: 0,
        descuento_global: 0,
        descuento_total: 0,
        total_detalle: 0,
        isv: 0,
        total: 0
      };
    }

    const baseLineas = round2(subTotal - descuentoLineas);
    const descuentoGlobal =
      descuentoTipo === DISCOUNT_TYPE_PORCENTAJE ? round2(baseLineas * (descuentoValor / 100)) : round2(descuentoValor);
    if (descuentoGlobal > baseLineas) {
      return {
        has_error: true,
        error: 'El descuento global supera el total de lineas disponible.',
        sub_total: 0,
        descuento_lineas: 0,
        descuento_global: 0,
        descuento_total: 0,
        total_detalle: 0,
        isv: 0,
        total: 0
      };
    }

    const isvPct = parseNonNegativeNumber(convertPanel?.isv_pct);
    if (isvPct === null || isvPct > 100) {
      return {
        has_error: true,
        error: 'ISV % invalido. Debe estar entre 0 y 100.',
        sub_total: 0,
        descuento_lineas: 0,
        descuento_global: 0,
        descuento_total: 0,
        total_detalle: 0,
        isv: 0,
        total: 0
      };
    }

    const descuentoTotal = round2(descuentoLineas + descuentoGlobal);
    const totalDetalle = Math.max(0, round2(subTotal - descuentoTotal));
    const isv = round2(totalDetalle * (isvPct / 100));
    const total = round2(totalDetalle + isv);

    return {
      has_error: false,
      error: '',
      sub_total: subTotal,
      descuento_lineas: descuentoLineas,
      descuento_global: descuentoGlobal,
      descuento_total: descuentoTotal,
      total_detalle: totalDetalle,
      isv,
      total
    };
  }, [convertPanel?.descuento_tipo, convertPanel?.descuento_valor, convertPanel?.detalles, convertPanel?.isv_pct]);

  // AM: blinda acciones del modal administrativo segun estado real del detalle abierto.
  const convertPanelEstadoActual = resolveEstado(convertPanel?.orden);
  const convertPanelRecepcionRegistrada = hasReceptionRegistered(convertPanel?.orden);
  const canConvertPanelSave =
    canConvertir && convertPanelEstadoActual === 'EN_COMPRA' && convertPanelRecepcionRegistrada;
  const canConvertPanelSaveAndSupply = canConvertPanelSave && canAbastecer;

  // AM: soporta guardado administrativo parcial y accion final de guardar + abastecer.
  const doConvert = async (accion = 'guardar') => {
    if (!['guardar', 'guardar_y_abastecer'].includes(String(accion))) return;
    if (accion === 'guardar' && !canConvertir) return;
    if (accion === 'guardar_y_abastecer' && (!canConvertir || !canAbastecer)) return;
    const idOrden = parsePositiveInt(convertPanel?.orden?.id_orden_compra);
    const idProveedor = parsePositiveInt(convertPanel.id_proveedor);
    const transferenciaPersistida = hasValue(convertPanel?.transferencia_url_actual);
    const descuentoTipo = resolveDiscountType(convertPanel?.descuento_tipo);
    const descuentoValor = parseNonNegativeNumber(convertPanel?.descuento_valor);
    const isvPct = parseNonNegativeNumber(convertPanel?.isv_pct);
    const estadoOrdenActual = resolveEstado(convertPanel?.orden);
    const recepcionRegistradaActual = hasReceptionRegistered(convertPanel?.orden);
    if (estadoOrdenActual !== 'EN_COMPRA' || !recepcionRegistradaActual) {
      setConvertPanel((prev) => ({
        ...prev,
        error: 'La orden ya no se puede convertir en este estado. Recarga el detalle.',
        submit_action: ''
      }));
      return;
    }
    // AM: envia detalle financiero por linea para persistir costo unitario y descuento real por item.
    const detallesPayload = (Array.isArray(convertPanel?.detalles) ? convertPanel.detalles : []).map((row) => ({
      id_detalle_orden: parsePositiveInt(row?.id_detalle_orden),
      precio_unitario: parseNonNegativeNumber(row?.precio_unitario),
      descuento: parseNonNegativeNumber(row?.descuento) ?? 0
    }));
    if (!idOrden || !idProveedor) {
      setConvertPanel((prev) => ({ ...prev, error: 'Proveedor y orden son obligatorios.', submit_action: '' }));
      return;
    }
    if (detallesPayload.length === 0 || detallesPayload.some((row) => !row.id_detalle_orden || row.precio_unitario === null)) {
      setConvertPanel((prev) => ({
        ...prev,
        error: 'Debes completar costos validos por item antes de guardar.',
        submit_action: ''
      }));
      return;
    }
    if (descuentoValor === null || (descuentoTipo === DISCOUNT_TYPE_PORCENTAJE && descuentoValor > 100)) {
      setConvertPanel((prev) => ({
        ...prev,
        error: 'Descuento global invalido.',
        submit_action: ''
      }));
      return;
    }
    if (isvPct === null || isvPct > 100) {
      setConvertPanel((prev) => ({
        ...prev,
        error: 'ISV % invalido. Debe estar entre 0 y 100.',
        submit_action: ''
      }));
      return;
    }
    if (convertPreview.has_error) {
      setConvertPanel((prev) => ({
        ...prev,
        error: convertPreview.error || 'Corrige los montos administrativos antes de guardar.',
        submit_action: ''
      }));
      return;
    }
    if (convertPanel.loading || rowBusy[idOrden]) {
      // AM: evita doble envio por doble click o polling concurrente.
      return;
    }
    if (accion === 'guardar_y_abastecer' && !convertPanel.transferencia_file && !transferenciaPersistida) {
      setConvertPanel((prev) => ({
        ...prev,
        error: 'Para guardar y abastecer debes registrar imagen de deposito/transferencia.',
        submit_action: '',
        transferencia_error: 'Adjunta una imagen o usa una ya registrada.'
      }));
      return;
    }

    setConvertPanel((prev) => ({
      ...prev,
      loading: true,
      submit_action: accion,
      error: '',
      transferencia_error: ''
    }));
    setBusy(idOrden, true);
    try {
      let idArchivoTransferencia = null;
      if (convertPanel.transferencia_file) {
        const transferUpload = await uploadInventarioImage(convertPanel.transferencia_file, {
          bucket: 'admin-docs',
          validationContext: INVENTARIO_IMAGE_CONTEXT.OC_EVIDENCIAS_PRIVADAS
        });
        idArchivoTransferencia = transferUpload.id_archivo;
      }

      const observacionAdmin = normalizeText(convertPanel.observacion_admin, 1000);
      const payload = {
        accion,
        id_proveedor: idProveedor,
        fecha_compra: convertPanel.fecha_compra || undefined,
        descuento_tipo: descuentoTipo,
        descuento_valor: round2(descuentoValor ?? 0),
        isv_pct: round2(isvPct ?? 0),
        detalles: detallesPayload
      };
      if (observacionAdmin) {
        payload.observacion_admin = observacionAdmin;
        payload.referencia_transferencia = observacionAdmin;
      }
      if (idArchivoTransferencia) {
        payload.id_archivo_transferencia = idArchivoTransferencia;
      }

      await inventarioService.convertirOrdenCompraWorkflow(idOrden, payload);

      if (accion === 'guardar_y_abastecer') {
        await inventarioService.abastecerOrdenCompraWorkflow(idOrden, {
          observacion: normalizeText(convertPanel.observacion_admin, 200) || undefined
        });
      }

      toast(
        accion === 'guardar_y_abastecer' ? 'GUARDADO Y ABASTECIDO' : 'GUARDADO',
        accion === 'guardar_y_abastecer'
          ? `Orden #${formatVisibleOrderNumber(convertPanel?.orden)} guardada y abastecida correctamente.`
          : `Datos administrativos guardados para orden #${formatVisibleOrderNumber(convertPanel?.orden)}.`,
        'success'
      );
      closeConvertPanel();
      await loadOrdenes();
      if (detalleActual?.data?.orden?.id_orden_compra === idOrden) {
        await verDetalle({ id_orden_compra: idOrden });
      }
    } catch (error) {
      const mismatchMessage = getWarehouseMismatchMessage(error);
      setConvertPanel((prev) => ({
        ...prev,
        loading: false,
        submit_action: '',
        error: mismatchMessage || error?.message || 'No se pudo convertir orden.'
      }));
    } finally {
      setBusy(idOrden, false);
    }
  };

  const closeConvertPanel = () => {
    const preview = String(convertPanel?.transferencia_preview_url || '');
    if (preview.startsWith('blob:')) {
      URL.revokeObjectURL(preview);
    }
    setConvertPanel(emptyConvertPanel());
  };

  const closeRecepcionModal = () => {
    const preview = String(recepcionModal?.factura_preview_url || '');
    if (preview.startsWith('blob:')) {
      URL.revokeObjectURL(preview);
    }
    setRecepcionModal(emptyRecepcionModal());
  };

  // AM: modal de abastecimiento para sustituir prompt y evitar entradas ambiguas.
  const openSupplyModal = (orden) => {
    setSupplyModal({
      open: true,
      orden,
      observacion: '',
      loading: false,
      error: ''
    });
  };

  const doAbastecer = async () => {
    const idOrden = parsePositiveInt(supplyModal?.orden?.id_orden_compra);
    if (!idOrden) return;
    if (supplyModal.loading || rowBusy[idOrden]) return;
    const estadoOrdenActual = resolveEstado(supplyModal?.orden);
    const recepcionRegistradaActual = hasReceptionRegistered(supplyModal?.orden);
    if (estadoOrdenActual !== 'EN_COMPRA' || !recepcionRegistradaActual) {
      setSupplyModal((prev) => ({
        ...prev,
        error: 'La orden ya no se puede abastecer en su estado actual. Recarga el detalle.'
      }));
      return;
    }
    setSupplyModal((prev) => ({ ...prev, loading: true, error: '' }));
    setBusy(idOrden, true);
    try {
      await inventarioService.abastecerOrdenCompraWorkflow(idOrden, {
        observacion: normalizeText(supplyModal.observacion, 200)
      });
      toast('ABASTECIDA', `Orden #${formatVisibleOrderNumber(supplyModal?.orden)} abastecida correctamente.`, 'success');
      setSupplyModal(emptySupplyModal());
      await loadOrdenes();
      if (detalleActual?.data?.orden?.id_orden_compra === idOrden) {
        await verDetalle({ id_orden_compra: idOrden });
      }
    } catch (error) {
      const mismatchMessage = getWarehouseMismatchMessage(error);
      setSupplyModal((prev) => ({
        ...prev,
        loading: false,
        error: mismatchMessage || error?.message || 'No se pudo abastecer la orden.'
      }));
    } finally {
      setBusy(idOrden, false);
    }
  };

  const openRecepcionModal = (orden) => {
    const now = new Date();
    setRecepcionModal({
      open: true,
      orden,
      observacion: '',
      // AM: datos automaticos no editables para trazabilidad de la recepcion en sucursal.
      usuario_sistema: normalizeText(user?.nombre_usuario, 120) || `Usuario #${user?.id_usuario || '-'}`,
      sucursal_sistema: resolveSucursalLabel(orden),
      fecha_sistema: now.toLocaleDateString('es-HN'),
      hora_sistema: now.toLocaleTimeString('es-HN', { hour12: false }),
      loading: false,
      error: '',
      factura_file: null,
      factura_file_mime_type: '',
      factura_preview_url: '',
      factura_error: ''
    });
  };

  const doReportarRecepcion = async () => {
    const idOrden = parsePositiveInt(recepcionModal?.orden?.id_orden_compra);
    if (!idOrden) return;
    if (recepcionModal.loading || rowBusy[idOrden]) {
      // AM: evita doble envio por doble click o polling concurrente.
      return;
    }
    const estadoOrdenActual = resolveEstado(recepcionModal?.orden);
    const recepcionRegistradaActual = hasReceptionRegistered(recepcionModal?.orden);
    const canReportarRecepcion =
      estadoOrdenActual === 'APROBADA' || (estadoOrdenActual === 'EN_COMPRA' && !recepcionRegistradaActual);
    if (!canReportarRecepcion) {
      setRecepcionModal((prev) => ({
        ...prev,
        error: 'La recepcion ya no se puede registrar para esta orden. Recarga el detalle.'
      }));
      return;
    }

    setRecepcionModal((prev) => ({ ...prev, loading: true, error: '', factura_error: '' }));
    setBusy(idOrden, true);
    try {
      let idArchivoFactura = null;
      if (recepcionModal.factura_file) {
        const facturaUpload = await uploadInventarioImage(recepcionModal.factura_file, {
          bucket: 'admin-docs',
          validationContext: INVENTARIO_IMAGE_CONTEXT.OC_EVIDENCIAS_PRIVADAS
        });
        idArchivoFactura = facturaUpload.id_archivo;
      }

      const payload = {
        observacion_recepcion: normalizeText(recepcionModal.observacion, 1000)
      };
      if (idArchivoFactura) payload.id_archivo_factura_recepcion = idArchivoFactura;

      await inventarioService.reportarRecepcionOrdenCompraWorkflow(idOrden, payload);
      toast(
        'RECEPCION REPORTADA',
        `Recepcion registrada para orden #${formatVisibleOrderNumber(recepcionModal?.orden)}.`,
        'success'
      );
      closeRecepcionModal();
      await loadOrdenes();
      if (detalleActual?.data?.orden?.id_orden_compra === idOrden) {
        await verDetalle({ id_orden_compra: idOrden });
      }
    } catch (error) {
      setRecepcionModal((prev) => ({
        ...prev,
        loading: false,
        error: error?.message || 'No se pudo reportar recepcion.'
      }));
    } finally {
      setBusy(idOrden, false);
    }
  };

  const doCancelarOrden = async (row) => {
    const idOrden = parsePositiveInt(row?.id_orden_compra);
    if (!idOrden || rowBusy[idOrden]) return;
    const estadoActual = resolveEstado(row);
    const recepcionRegistradaParaCancelacion =
      Boolean(parsePositiveInt(row?.id_usuario_recepcion)) && Boolean(hasValue(row?.fecha_recepcion_reportada));
    const canCancelByState =
      estadoActual === 'PENDIENTE' ||
      estadoActual === 'APROBADA' ||
      (estadoActual === 'EN_COMPRA' && !recepcionRegistradaParaCancelacion);
    if (!canCancelarOrden || !canCancelByState) {
      toast('VALIDACION', 'La orden ya no se puede cancelar en su estado actual.', 'warning');
      return;
    }

    const confirmado = window.confirm(
      `Cancelar la orden #${formatVisibleOrderNumber(row)}? Esta accion no se puede deshacer.`
    );
    if (!confirmado) return;

    setBusy(idOrden, true);
    try {
      await inventarioService.cancelarOrdenCompraWorkflow(idOrden);
      toast('CANCELADA', `Orden #${formatVisibleOrderNumber(row)} cancelada correctamente.`, 'warning');
      await loadOrdenes();
      if (detalleActual?.data?.orden?.id_orden_compra === idOrden) {
        await verDetalle({ id_orden_compra: idOrden });
      }
    } catch (error) {
      toast('ERROR', error?.message || 'No se pudo cancelar la orden.', 'danger');
    } finally {
      setBusy(idOrden, false);
    }
  };

  const renderActions = (row, compact = false) => {
    const estado = resolveEstado(row);
    const recepcionRegistrada = hasReceptionRegistered(row);
    // AM: criterio canonico de bloqueo de cancelacion: usuario + fecha de recepcion.
    const recepcionRegistradaParaCancelacion =
      Boolean(parsePositiveInt(row?.id_usuario_recepcion)) && Boolean(hasValue(row?.fecha_recepcion_reportada));
    const isItemRequestOnlyCard =
      Number(row?.total_items || 0) <= 0 && Number(row?.total_solicitudes_item || 0) > 0;
    const hasOpenItemRequests =
      Number(row?.total_solicitudes_item_pendientes || 0) > 0 ||
      Number(row?.total_solicitudes_item_en_revision || 0) > 0;
    const busy = Boolean(rowBusy[row.id_orden_compra]);
    const actionClass = compact ? 'inv-oc-action-btn is-compact' : 'inv-oc-action-btn';
    const canShowApproveAction = estado === 'PENDIENTE' && canAprobar;
    const canShowRejectAction = estado === 'PENDIENTE' && canRechazar;
    const canShowRegisterReceptionAction =
      isSucursalOperativeActor &&
      canSubirFactura &&
      (estado === 'APROBADA' || (estado === 'EN_COMPRA' && !recepcionRegistrada));
    const canShowConvertAction =
      estado === 'EN_COMPRA' && isAdminFlowActor && canConvertir && canSubirDeposito && recepcionRegistrada;
    const canShowCancelAction =
      canCancelarOrden &&
      (estado === 'PENDIENTE' ||
        estado === 'APROBADA' ||
        (estado === 'EN_COMPRA' && !recepcionRegistradaParaCancelacion));

    return (
      <div className="inv-oc-actions">
        <button
          className={`${actionClass} is-neutral`}
          onClick={() => verDetalle(row)}
          disabled={busy || !canVerDetalle}
        >
          <i className="bi bi-eye" aria-hidden="true" />
          <span>Ver</span>
        </button>
        {canShowApproveAction && (
          <>
            {!isItemRequestOnlyCard && canEditarSolicitud && (
              <button
                className={`${actionClass} is-neutral`}
                onClick={() => openEditDetallesModal(row)}
                disabled={busy}
              >
                <i className="bi bi-pencil-square" aria-hidden="true" />
                <span>Editar lineas</span>
              </button>
            )}
            <button
              className={`${actionClass} is-primary`}
              onClick={() => openReviewModal(row, 'aprobar')}
              disabled={busy || (isItemRequestOnlyCard && hasOpenItemRequests)}
              title={
                isItemRequestOnlyCard && hasOpenItemRequests
                  ? 'Primero atiende o rechaza las solicitudes de item nuevo en el detalle.'
                  : ''
              }
            >
              <i className="bi bi-check2-circle" aria-hidden="true" />
              <span>Aprobar</span>
            </button>
            {canShowRejectAction && (
              <button
                className={`${actionClass} is-danger`}
                onClick={() => openReviewModal(row, 'rechazar')}
                disabled={busy}
              >
                <i className="bi bi-x-circle" aria-hidden="true" />
                <span>Rechazar</span>
              </button>
            )}
          </>
        )}
        {canShowRegisterReceptionAction && (
          <button className={`${actionClass} is-neutral`} onClick={() => openRecepcionModal(row)} disabled={busy}>
            <i className="bi bi-receipt" aria-hidden="true" />
            <span>Registrar recepcion</span>
          </button>
        )}
        {/* AM: al completar recepcion en sucursal, admin continua en modal de gestion/abastecimiento. */}
        {canShowConvertAction && (
          <button className={`${actionClass} is-success`} onClick={() => openConvert(row)} disabled={busy}>
            <i className="bi bi-arrow-repeat" aria-hidden="true" />
            <span>Convertir</span>
          </button>
        )}
        {canShowCancelAction && (
          <button className={`${actionClass} is-danger`} onClick={() => doCancelarOrden(row)} disabled={busy}>
            <i className="bi bi-slash-circle" aria-hidden="true" />
            <span>Cancelar</span>
          </button>
        )}
      </div>
    );
  };

  if (permisosLoading) return null;

  if (!canCrear && !canVerFlujo) {
    return <div className="alert alert-warning mb-0">No tienes permisos para Ordenes de compra.</div>;
  }

  return (
    <div className="inv-oc-module d-flex flex-column gap-3">
      <section className="card shadow-sm mb-0 inv-prod-card inv-has-sticky-header inv-oc-summary-card">
        <div className="card-header inv-prod-header">
          <div className="inv-prod-title-wrap">
            <div className="inv-prod-title-row">
              <i className="bi bi-bag-check inv-prod-title-icon" aria-hidden="true" />
              <span className="inv-prod-title">Ordenes de compra</span>
            </div>
            <div className="inv-prod-subtitle">Solicita, revisa y abastece en un flujo claro para cocina, caja y administracion</div>
          </div>
          <div className="inv-prod-header-actions inv-oc-summary-header-actions">
            <span className="badge rounded-pill text-bg-light border">Total en flujo: {pagination.total}</span>
          </div>
        </div>
        <div className="card-body inv-oc-summary-body">
          <div className="inv-oc-stats-band">
            <article className="inv-oc-stat-card inv-invstat-card is-pending">
              <div className="inv-invstat-icon" aria-hidden="true">
                <i className="bi bi-clock-history" />
              </div>
              <div className="inv-prod-kpi-content">
                <span>Pendientes</span>
                <strong>{workflowStats.pendientes}</strong>
              </div>
            </article>
            <article className="inv-oc-stat-card inv-invstat-card is-approved">
              <div className="inv-invstat-icon" aria-hidden="true">
                <i className="bi bi-check-circle" />
              </div>
              <div className="inv-prod-kpi-content">
                <span>Aprobadas</span>
                <strong>{workflowStats.aprobadas}</strong>
              </div>
            </article>
            <article className="inv-oc-stat-card inv-invstat-card is-buying">
              <div className="inv-invstat-icon" aria-hidden="true">
                <i className="bi bi-cart-check" />
              </div>
              <div className="inv-prod-kpi-content">
                <span>En compra</span>
                <strong>{workflowStats.enCompra}</strong>
              </div>
            </article>
            <article className="inv-oc-stat-card inv-invstat-card is-stocked">
              <div className="inv-invstat-icon" aria-hidden="true">
                <i className="bi bi-box-seam" />
              </div>
              <div className="inv-prod-kpi-content">
                <span>Abastecidas</span>
                <strong>{workflowStats.abastecidas}</strong>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* AM: layout principal: Nueva solicitud + Flujo en la franja superior para operacion rapida. */}
          {(canCrear || canVerFlujo) && (
        <div className={`inv-oc-top-panels ${showDualTopPanels ? 'is-dual' : ''}`}>
          {canCrear && (
             <section className="card shadow-sm inv-oc-card inv-oc-create-shell">
              <div className="card-header inv-oc-card__header inv-oc-card__header--stacked">
              <div className="inv-oc-panel-head">
                <div className="inv-oc-panel-title-wrap">
                  <div className="inv-oc-panel-title-row">
                    <i className="bi bi-bag-plus inv-oc-panel-title-icon" aria-hidden="true" />
                    <h4 className="mb-0">Nueva solicitud de compra</h4>
                  </div>
                </div>

                <div className="inv-oc-panel-header-actions">
                  <label className="inv-oc-panel-search" aria-label="Buscar producto o insumo">
                    <i className="bi bi-search" aria-hidden="true" />
                    <input
                      type="search"
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      placeholder="Buscar producto o insumo..."
                    />
                  </label>

                  <button
                    type="button"
                    className={`inv-oc-panel-toolbar-btn ${soloAlertas ? 'is-on' : ''}`}
                    onClick={() => setSoloAlertas((prev) => !prev)}
                    aria-pressed={soloAlertas}
                  >
                    <i className="bi bi-funnel" aria-hidden="true" />
                    <span>Filtros</span>
                  </button>
                  <button
                    type="button"
                    className="inv-oc-panel-collapse-btn"
                    onClick={() => setCreateSectionOpen((prev) => !prev)}
                    aria-expanded={createSectionOpen}
                    aria-controls="inv-oc-create-body"
                    title={createSectionOpen ? 'Contraer' : 'Desplegar'}
                  >
                    <i className={`bi ${createSectionOpen ? 'bi-chevron-up' : 'bi-chevron-down'}`} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="inv-oc-header-meta">
                <div className="inv-oc-header-badges">
                  <span className="badge rounded-pill text-bg-light">Productos: {catalogTotals.productos}</span>
                  <span className="badge rounded-pill text-bg-light">Insumos: {catalogTotals.insumos}</span>
                  <span className="badge rounded-pill text-bg-light">Total: {filteredCatalog.length}</span>
                </div>

                {!isOperationalCreateRestricted && almacenesCatalogFiltradosPorSucursal.length > 0 && (
                  <div className="inv-oc-header-chipline">
                    {/* AM: los chips de sucursal suben al header para compactar el cuerpo visualmente. */}
                    <div className="inv-oc-warehouse-chips">
                      {almacenesCatalogFiltradosPorSucursal.map((almacen) => {
                        const idAlmacen = Number(almacen.id_almacen);
                        const selected = selectedBaseAlmacenes.includes(idAlmacen);
                        return (
                          <button
                            key={`base-almacen-${idAlmacen}`}
                            type="button"
                            className={`inv-oc-warehouse-chip ${selected ? 'is-active' : ''}`}
                            onClick={() => toggleDraftAlmacenBase(idAlmacen)}
                            title={formatAlmacenDisplay(almacen)}
                          >
                            <i className="bi bi-building" aria-hidden="true" />
                            <span>{almacen.nombre_sucursal || almacen.nombre}</span>
                          </button>
                        );
                      })}
                    </div>
                    <label htmlFor="oc-ver-todos-sucursal" className="inv-oc-toggle inv-oc-toggle--compact mb-0">
                      <input
                        id="oc-ver-todos-sucursal"
                        className="form-check-input"
                        type="checkbox"
                        checked={!soloAlertas}
                        onChange={(e) => setSoloAlertas(!e.target.checked)}
                      />
                      <span>Ver todos de la sucursal</span>
                    </label>
                  </div>
                )}
              </div>
            </div>
            {createSectionOpen && (
            <div id="inv-oc-create-body" className="card-body d-flex flex-column">
                {almacenesCatalog.length === 0 && (
                  <div className="alert alert-warning py-2 mb-2">
                    No hay almacenes activos para enviar la solicitud. Configura al menos un almacen.
                  </div>
                )}
                {catalogPages.length === 0 ? (
                  <div className="inv-oc-empty-state flex-grow-1">
                    <i className="bi bi-inboxes" aria-hidden="true" />
                    <span>Sin items para el filtro actual.</span>
                  </div>
                ) : (
                  <>
                    <div key={`catalog-grid-${catalogPage}`} className="inv-oc-catalog-grid inv-oc-catalog-grid--animated mb-2">
                      {(catalogPages[catalogPage] || []).map((item) => (
                        <article className="inv-oc-catalog-card" key={item.key}>
                          <div className="inv-oc-catalog-card__head">
                            <div className="inv-oc-catalog-card__title-wrap">
                              <i className={resolveItemIcon(item.item_tipo)} aria-hidden="true" />
                              <h5>{item.nombre}</h5>
                            </div>
                          </div>
                          {/* AM: ficha simplificada para lectura rapida en alta de solicitud (sin mostrar almacen). */}
                          <div className="inv-oc-catalog-card__fields">
                            <div className="inv-oc-catalog-card__field">
                              <span>Estado</span>
                              <span className={`inv-oc-stock-badge ${stockBadgeClass(item.stock_state)} inv-oc-stock-badge--card`}>
                                {stockStateLabel(item.stock_state)}
                              </span>
                            </div>
                            <div className="inv-oc-catalog-card__field">
                              <span>Tipo</span>
                              <strong>{String(item.item_tipo || '').toLowerCase() === 'producto' ? 'Producto' : 'Insumo'}</strong>
                            </div>
                            <div className="inv-oc-catalog-card__field">
                              <span>Stock</span>
                              <strong>{item.cantidad}</strong>
                            </div>
                            <div className="inv-oc-catalog-card__field">
                              <span>Stock minimo</span>
                              <strong>{item.stock_minimo}</strong>
                            </div>
                          </div>
                          <button className="inv-oc-catalog-card__action" onClick={() => addToDraft(item)}>
                            <i className="bi bi-plus-circle" aria-hidden="true" />
                            <span>Agregar</span>
                          </button>
                        </article>
                      ))}
                    </div>

                    <div className="inv-oc-carousel-footer">
                      <div className="inv-oc-carousel-dots" role="tablist" aria-label="Paginas del carrusel">
                        {catalogDotItems.map((dot) => {
                          if (dot.type === 'ellipsis') {
                            return (
                              <span key={dot.key} className="inv-oc-carousel-ellipsis" aria-hidden="true">
                                ...
                              </span>
                            );
                          }

                          return (
                            <button
                              key={`catalog-dot-${dot.index}`}
                              type="button"
                              role="tab"
                              aria-selected={catalogPage === dot.index}
                              className={`inv-oc-carousel-dot ${catalogPage === dot.index ? 'is-active' : ''}`}
                              onClick={() => setCatalogPage(dot.index)}
                              title={`Ir a pagina ${dot.index + 1}`}
                            />
                          );
                        })}
                      </div>
                      <div className="inv-oc-carousel-controls">
                        <button
                          type="button"
                          className="inv-oc-carousel-nav"
                          onClick={() =>
                            setCatalogPage((prev) => (prev <= 0 ? Math.max(0, catalogPages.length - 1) : prev - 1))
                          }
                          disabled={catalogPages.length <= 1}
                          aria-label="Pagina anterior"
                        >
                          <i className="bi bi-chevron-left" aria-hidden="true" />
                        </button>
                        <span className="inv-oc-carousel-counter">Pagina {catalogPage + 1}/{catalogPages.length}</span>
                        <button
                          type="button"
                          className="inv-oc-carousel-nav"
                          onClick={() =>
                            setCatalogPage((prev) => (prev >= catalogPages.length - 1 ? 0 : prev + 1))
                          }
                          disabled={catalogPages.length <= 1}
                          aria-label="Pagina siguiente"
                        >
                          <i className="bi bi-chevron-right" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
                {/* AM: totales movidos al header compacto para mantener el cuerpo mas limpio. */}
              </div>
              )}
            </section>
          )}

          
                {canVerFlujo && (
            <section className="card shadow-sm inv-oc-card inv-oc-flow-shell">
              <div className="card-header inv-oc-card__header inv-oc-card__header--stacked">
                <div className="inv-oc-panel-head">
                  <div className="inv-oc-panel-title-wrap">
                    <div className="inv-oc-panel-title-row">
                      <i className="bi bi-kanban inv-oc-panel-title-icon" aria-hidden="true" />
                      <h4 className="mb-0">Flujo de ordenes de compra</h4>
                    </div>
                  </div>

                  <div className="inv-oc-panel-header-actions">
                    {/* AM: buscador alineado en una sola fila despues del titulo para mantener lectura compacta. */}
                    <label className="inv-oc-panel-search" aria-label="Buscar ordenes de compra">
                      <i className="bi bi-search" aria-hidden="true" />
                      <input
                        type="search"
                        value={search}
                        onChange={(e) => {
                          setPage(1);
                          setSearch(e.target.value);
                        }}
                        placeholder="Buscar por ID, usuario o texto..."
                      />
                    </label>
                    <button
                      type="button"
                      className={`inv-oc-panel-toolbar-btn ${flowFiltersOpen ? 'is-on' : ''}`}
                      onClick={() => setFlowFiltersOpen((prev) => !prev)}
                      aria-expanded={flowFiltersOpen}
                      aria-controls="inv-oc-flow-filters"
                    >
                      <i className="bi bi-funnel" aria-hidden="true" />
                      <span>Filtros</span>
                    </button>
                    <button
                      type="button"
                      className="inv-oc-panel-collapse-btn"
                      onClick={() => setFlowSectionOpen((prev) => !prev)}
                      aria-expanded={flowSectionOpen}
                      aria-controls="inv-oc-flow-body"
                      title={flowSectionOpen ? 'Contraer' : 'Desplegar'}
                    >
                      <i className={`bi ${flowSectionOpen ? 'bi-chevron-up' : 'bi-chevron-down'}`} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
              {flowSectionOpen && (
              <div id="inv-oc-flow-body" className="card-body d-flex flex-column gap-3">
                {flowFiltersOpen && (
                  <div id="inv-oc-flow-filters" className="inv-oc-flow-filters-panel">
                    <div className="row g-2">
                      <div className="col-12 col-md-4">
                        <label className="form-label mb-1">Vista</label>
                        <select
                          className="form-select"
                          value={scope}
                          onChange={(e) => {
                            setPage(1);
                            setScope(e.target.value);
                          }}
                        >
                          {canVerTodas ? (
                            <option value="all">Todas las sucursales</option>
                          ) : (
                            <option value="branch">Mi sucursal</option>
                          )}
                        </select>
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label mb-1">Sucursal</label>
                        <select
                          className="form-select"
                          value={flowSucursalFilter}
                          onChange={(e) => {
                            setPage(1);
                            setFlowSucursalFilter(e.target.value);
                          }}
                        >
                          <option value="">Todas</option>
                          {sucursalesCatalog.map((row) => (
                            <option key={`flow-sucursal-${row.id_sucursal}`} value={row.id_sucursal}>
                              {row.nombre_sucursal}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label mb-1">Estado</label>
                        <select
                          className="form-select"
                          value={estadoFiltro}
                          onChange={(e) => {
                            setPage(1);
                            setEstadoFiltro(e.target.value);
                          }}
                        >
                          <option value="">Todos</option>
                          {ESTADOS.map((estado) => (
                            <option key={estado} value={estado}>
                              {estado}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {loadingOrdenes ? (
                  <div className="text-muted small">Cargando...</div>
                ) : ordenesVisibles.length === 0 ? (
                  <div className="inv-oc-empty-state">
                    <i className="bi bi-inboxes" aria-hidden="true" />
                    <span>Sin ordenes para este filtro.</span>
                  </div>
                ) : (
                  <>
                  <div key={`flow-grid-${flowCarouselPage}`} className="inv-oc-flow-grid inv-oc-flow-grid--animated">
                    {(flowPages[flowCarouselPage] || []).map((row) => {
                      const estadoVisual = resolveEstadoVisual(row);
                      const isItemRequestOnlyCard =
                        Number(row?.total_items || 0) <= 0 && Number(row?.total_solicitudes_item || 0) > 0;
                      const itemRequestOnlyState = resolveItemRequestOnlyState(row);
                      const toneClass = isItemRequestOnlyCard
                        ? `is-item-request ${estadoToneClass(itemRequestOnlyState)}`
                        : estadoToneClass(estadoVisual);
                      const usuario = row.solicitante_nombre_usuario || `Usuario #${row.id_usuario}`;
                      const rol = row.solicitante_roles || 'Rol no disponible';
                      // AM: usa solo el numero compacto del flujo para evitar huecos visuales tras rechazo/cancelacion.
                      const flowVisibleNumber = parsePositiveInt(row?.numero_oc_visible_flujo);
                      const flowVisibleLabel = flowVisibleNumber ? ` #${flowVisibleNumber}` : '';

                            return (
                            <article key={row.id_orden_compra} className={`inv-oc-flow-card ${toneClass}`}>
                              <div className="inv-oc-flow-card__head">
                                <div className="inv-oc-flow-card__identity">
                                  <span className="inv-oc-flow-card__order">
                                    <i
                                      className={isItemRequestOnlyCard ? 'bi bi-lightbulb' : 'bi bi-journal-check'}
                                      aria-hidden="true"
                                    />
                                    {isItemRequestOnlyCard ? `Solicitud${flowVisibleLabel}` : `Orden${flowVisibleLabel}`}
                                  </span>
                                  {/* AM: deja solo el usuario solicitante para simplificar la card del flujo. */}
                                  <strong className="inv-oc-flow-card__user">{usuario}</strong>
                                </div>

                                {isItemRequestOnlyCard ? (
                                  <span className={`badge ${itemRequestOnlyBadgeClass(itemRequestOnlyState)} inv-oc-flow-card__state-badge`}>
                                    <i className="bi bi-tags me-1" aria-hidden="true" />
                                    {itemRequestOnlyLabel(itemRequestOnlyState)}
                                  </span>
                                ) : (
                                  <span className={`badge ${badgeClass(estadoVisual)} inv-oc-flow-card__state-badge`}>
                                    <i className={`${estadoIconClass(estadoVisual)} me-1`} aria-hidden="true" />
                                    {formatEstadoLabel(estadoVisual)}
                                  </span>
                                )}
                              </div>

                              {/* AM: fecha y hora separadas visualmente para lectura rapida. */}
                              <div className="inv-oc-flow-card__stamp-row">
                                <span className="inv-oc-flow-card__stamp">
                                  <i className="bi bi-calendar-event" aria-hidden="true" />
                                  {formatDate(row.fecha_creacion || row.fecha)}
                                </span>
                                <span className="inv-oc-flow-card__stamp">
                                  <i className="bi bi-clock-history" aria-hidden="true" />
                                  {formatTime(row.fecha_creacion)}
                                </span>
                              </div>

                              <div className="inv-oc-flow-card__actions-wrap">{renderActions(row, true)}</div>
                            </article>
                          );
                    })}
                  </div>

                  <div className="inv-oc-carousel-footer">
                    <div className="inv-oc-carousel-dots" role="tablist" aria-label="Paginas del carrusel del flujo">
                      {flowDotItems.map((dot) => {
                        if (dot.type === 'ellipsis') {
                          return (
                            <span key={dot.key} className="inv-oc-carousel-ellipsis" aria-hidden="true">
                              ...
                            </span>
                          );
                        }

                        return (
                          <button
                            key={`flow-dot-${dot.index}`}
                            type="button"
                            role="tab"
                            aria-selected={flowCarouselPage === dot.index}
                            className={`inv-oc-carousel-dot ${flowCarouselPage === dot.index ? 'is-active' : ''}`}
                            onClick={() => setFlowCarouselPage(dot.index)}
                            title={`Ir a pagina ${dot.index + 1}`}
                          />
                        );
                      })}
                    </div>

                    <div className="inv-oc-carousel-controls">
                      <button
                        type="button"
                        className="inv-oc-carousel-nav"
                        onClick={() =>
                          setFlowCarouselPage((prev) => (prev <= 0 ? Math.max(0, flowPages.length - 1) : prev - 1))
                        }
                        disabled={flowPages.length <= 1}
                        aria-label="Pagina anterior del flujo"
                      >
                        <i className="bi bi-chevron-left" aria-hidden="true" />
                      </button>
                      <span className="inv-oc-carousel-counter">
                        Pagina {flowCarouselPage + 1}/{flowPages.length}
                      </span>
                      <button
                        type="button"
                        className="inv-oc-carousel-nav"
                        onClick={() =>
                          setFlowCarouselPage((prev) => (prev >= flowPages.length - 1 ? 0 : prev + 1))
                        }
                        disabled={flowPages.length <= 1}
                        aria-label="Pagina siguiente del flujo"
                      >
                        <i className="bi bi-chevron-right" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </>
                )}

              </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* AM: detalle de solicitud se mantiene abajo como panel unico para evitar saturacion visual. */}
      {canCrear && (
        <div className="inv-oc-middle-panels">
          <section className="card shadow-sm inv-oc-card inv-oc-draft-card">
                <div className="card-header inv-oc-card__header inv-oc-card__header--stacked">
                <div className="inv-oc-panel-head">
                  <div className="inv-oc-panel-title-wrap">
                    <div className="inv-oc-panel-title-row">
                      <i className="bi bi-list-check inv-oc-panel-title-icon" aria-hidden="true" />
                      <div className="inv-oc-panel-title-copy">
                        <h4 className="mb-0">Detalle de solicitud</h4>
                        <p className="mb-0 text-muted small">Revisa las lineas, cantidades, almacenes y observacion antes de enviar.</p>
                      </div>
                    </div>
                  </div>

                  <div className="inv-oc-panel-header-actions">
                    <div className="inv-oc-header-badges">
                      <span className="badge rounded-pill text-bg-light">Lineas: {draft.length}</span>
                      <span className="badge rounded-pill text-bg-light">Productos: {draftTotals.productos}</span>
                      <span className="badge rounded-pill text-bg-light">Insumos: {draftTotals.insumos}</span>
                      <span className="badge rounded-pill text-bg-light">Unidades: {draftTotals.unidades}</span>
                    </div>

                    {canSolicitarItemNuevo && (
                      <button
                        className="inv-oc-panel-toolbar-btn"
                        onClick={() => setItemRequestModal({ ...emptyItemRequestModal(), open: true })}
                      >
                        <i className="bi bi-plus-square" aria-hidden="true" />
                        <span>Solicitar item nuevo</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="inv-oc-panel-collapse-btn"
                      onClick={() => setDraftSectionOpen((prev) => !prev)}
                      aria-expanded={draftSectionOpen}
                      aria-controls="inv-oc-draft-body"
                      title={draftSectionOpen ? 'Contraer' : 'Desplegar'}
                    >
                      <i className={`bi ${draftSectionOpen ? 'bi-chevron-up' : 'bi-chevron-down'}`} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
              {draftSectionOpen && (
              <div id="inv-oc-draft-body" className="card-body d-flex flex-column gap-3">
                <div className="inv-oc-draft-summary-band">
                  <article className="inv-oc-draft-summary-pill">
                    <i className="bi bi-card-checklist" aria-hidden="true" />
                    <div>
                      <span>Lineas listas</span>
                      <strong>{draft.length}</strong>
                    </div>
                  </article>

                  <article className="inv-oc-draft-summary-pill">
                    <i className="bi bi-box-seam" aria-hidden="true" />
                    <div>
                      <span>Productos + insumos</span>
                      <strong>{draftTotals.productos + draftTotals.insumos}</strong>
                    </div>
                  </article>

                  <article className="inv-oc-draft-summary-pill">
                    <i className="bi bi-lightbulb" aria-hidden="true" />
                    <div>
                      <span>Solicitudes nuevas</span>
                      <strong>{draftItemRequests.length}</strong>
                    </div>
                  </article>
                </div>
                {draft.length === 0 ? (
                  <div className="inv-oc-empty-state">
                    <i className="bi bi-list-check" aria-hidden="true" />
                    <span>Aun no hay items agregados.</span>
                  </div>
                ) : (
                  <div className="inv-oc-draft-grid">
                    {draft.map((row) => {
                      const selectedForRow = normalizeAlmacenesSelection(row.id_almacenes, 1).filter((idAlmacen) =>
                        almacenesMap.has(idAlmacen)
                      );
                      const allowedWarehousesForRow = normalizeAlmacenesSelection(
                        row?.id_almacenes_disponibles ?? row?.id_almacenes,
                        50
                      )
                        .map((idAlmacen) => almacenesMap.get(idAlmacen))
                        .filter(Boolean);
                      return (
                        <article key={row.key} className="inv-oc-draft-item-card">
                        <div className="inv-oc-draft-item-card__head">
                          <div className="inv-oc-draft-item-card__title">
                            <span className="inv-oc-draft-item-card__icon">
                              <i className={resolveItemIcon(row.item_tipo)} aria-hidden="true" />
                            </span>
                            <div className="d-flex flex-column">
                              <strong>{row.nombre}</strong>
                              <small className="text-capitalize">{row.item_tipo}</small>
                            </div>
                          </div>
                          <button
                            className="btn btn-sm btn-outline-danger inv-oc-draft-remove"
                            onClick={() => setDraft((prev) => prev.filter((item) => item.key !== row.key))}
                          >
                            <i className="bi bi-trash3 me-1" aria-hidden="true" />
                            Quitar
                          </button>
                        </div>
                        <div className="inv-oc-draft-item-card__body">
                          <label className="form-label mb-1">Cantidad</label>
                          {/* AM: stepper mixto para subir/bajar rapido y permitir escritura manual del numero. */}
                          <div className={`inv-oc-qty-control ${draftValidation[row.key] ? 'is-invalid' : ''}`}>
                            <button
                              type="button"
                              className="inv-oc-qty-btn"
                              onClick={() => stepDraftCantidad(row.key, -1)}
                              aria-label={`Disminuir cantidad de ${row.nombre}`}
                            >
                              <i className="bi bi-dash-lg" aria-hidden="true" />
                            </button>
                            <input
                              className="form-control form-control-sm inv-oc-qty-input"
                              value={row.cantidad}
                              onChange={(e) => setDraftCantidad(row.key, e.target.value)}
                            />
                            <button
                              type="button"
                              className="inv-oc-qty-btn"
                              onClick={() => stepDraftCantidad(row.key, 1)}
                              aria-label={`Aumentar cantidad de ${row.nombre}`}
                            >
                              <i className="bi bi-plus-lg" aria-hidden="true" />
                            </button>
                          </div>
                          {draftValidation[row.key] && (
                            <div className="invalid-feedback d-block">{draftValidation[row.key]}</div>
                          )}

                          <label className="form-label mb-1 mt-2">Almacen destino (1)</label>
                          <div className={`inv-oc-warehouse-chips ${draftValidation[row.key] ? 'is-invalid' : ''}`}>
                            {allowedWarehousesForRow.map((almacen) => {
                              const idAlmacen = Number(almacen.id_almacen);
                              const selected = selectedForRow.includes(idAlmacen);
                              return (
                                <button
                                  key={`${row.key}:almacen:${idAlmacen}`}
                                  type="button"
                                  className={`inv-oc-warehouse-chip ${selected ? 'is-active' : ''}`}
                                  onClick={() => toggleDraftAlmacen(row.key, idAlmacen)}
                                  title={formatAlmacenDisplay(almacen)}
                                >
                                  <i className="bi bi-shop" aria-hidden="true" />
                                  <span>{almacen.nombre_sucursal || almacen.nombre}</span>
                                </button>
                              );
                            })}
                          </div>
                          <small className="text-muted d-block mt-1">
                            Cantidad solicitada para la sucursal seleccionada.
                          </small>
                        </div>
                      </article>
                      );
                    })}
                  </div>
                )}

                {canSolicitarItemNuevo && (
                  <div className="inv-oc-draft-shell">
                    <div className="inv-oc-draft-shell__title">
                      <i className="bi bi-lightbulb" aria-hidden="true" />
                      <span>Solicitudes de item no registrado</span>
                    </div>
                    {draftItemRequests.length === 0 ? (
                      <div className="text-muted small px-2 py-2">Sin solicitudes de item nuevo.</div>
                    ) : (
                      <div className="d-flex flex-column gap-2 p-2">
                        {draftItemRequests.map((row) => (
                          <article
                              key={row.key}
                              className="inv-oc-draft-request-card"
                            >
                            <div className="d-flex flex-column">
                              <strong className="text-capitalize">{row.nombre_sugerido}</strong>
                              <small className="text-muted text-capitalize">{row.tipo_item}</small>
                              <small className="text-muted">
                                Cantidad sugerida: {row.cantidad_sugerida} {row.descripcion ? `- ${row.descripcion}` : ''}
                              </small>
                            </div>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger inv-oc-draft-request-card__remove"
                              onClick={() =>
                                setDraftItemRequests((prev) => prev.filter((item) => item.key !== row.key))
                              }
                            >
                              Quitar
                            </button>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="inv-oc-draft-footer-shell">
                  <section className="inv-oc-draft-note-panel">
                    <label className="form-label">Observacion</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={observacion}
                      onChange={(e) => setObservacion(e.target.value)}
                      placeholder="Ejemplo: Compra planificada para la siguiente semana..."
                    />
                    <div className="form-text">{normalizeText(observacion, 1000).length}/1000 caracteres</div>
                  </section>

                  <section className="inv-oc-draft-submit-panel">
                    <div className="inv-oc-draft-submit-panel__copy">
                      <span>Resumen para enviar</span>
                      <strong>
                        Productos: {draftTotals.productos} - Insumos: {draftTotals.insumos} - Unidades: {draftTotals.unidades}
                      </strong>
                      <small>{hasDraftErrors ? 'Corrige los campos marcados antes de enviar.' : 'Todo listo para aprobacion.'}</small>
                    </div>

                    <button
                      className="btn btn-primary inv-oc-primary-btn"
                      onClick={createSolicitud}
                      disabled={creating || hasDraftErrors || !hasDraftContent}
                    >
                      {creating ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                          Creando...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-send-check me-1" aria-hidden="true" />
                          Crear solicitud
                        </>
                      )}
                    </button>
                  </section>
                </div>
              </div>
              )}
            </section>
        </div>
      )}
      {detalleActual.loading || detalleActual.error || detalleActual.data ? (
        <div className="modal fade show d-block inv-oc-modal-layer" role="dialog" aria-modal="true">
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content inv-oc-modal">
              <div className="modal-header">
                <h5 className="modal-title d-flex align-items-center gap-2">
                  <i className="bi bi-journal-text" aria-hidden="true" />
                  Detalle de orden
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={closeDetalleModal}
                />
              </div>
              <div className="modal-body">
                {detalleActual.loading ? (
                  <div className="text-muted">Cargando detalle...</div>
                ) : detalleActual.error ? (
                  <div className="alert alert-danger mb-0">{detalleActual.error}</div>
                ) : (
                  <>
                    {/* AM: detalle profesional en modal compacto, sin cuadros legacy ni tablas planas como vista principal. */}
                    {(() => {
                      const orden = detalleActual.data?.orden || {};
                      // AM: detalles reales de la OC para mostrar claramente que se esta solicitando.
                      const detalles = Array.isArray(detalleActual.data?.detalles) ? detalleActual.data.detalles : [];
                      const evidenciasHistorial = Array.isArray(detalleActual.data?.evidencias_historial)
                        ? detalleActual.data.evidencias_historial
                        : [];
                      const solicitudesItem = Array.isArray(detalleActual.data?.solicitudes_item)
                        ? detalleActual.data.solicitudes_item
                        : [];
                      const estadoOrden = resolveEstadoVisual(orden);
                      const estadoOrdenReal = resolveEstado(orden);
                      const canViewEvidenciasAbastecida =
                        canVerEvidencias && canVerHistorial && estadoOrdenReal === 'ABASTECIDA';
                      return (
                        <div className="inv-oc-detail-modal">
                          <section className="inv-oc-detail-hero-card">
                            <div className="inv-oc-detail-hero-card__copy">
                              <span className="inv-oc-detail-kicker">Orden #{formatVisibleOrderNumber(orden)}</span>
                              <h6>{orden.solicitante_nombre_usuario || '-'}</h6>
                              <p>
                                <span>
                                  <i className="bi bi-person-badge me-1" aria-hidden="true" />
                                  {orden.solicitante_roles || 'Rol no disponible'}
                                </span>
                                <span>
                                  <i className="bi bi-calendar-event me-1" aria-hidden="true" />
                                  {formatDate(orden.fecha_creacion || orden.fecha)}
                                </span>
                                <span>
                                  <i className="bi bi-clock me-1" aria-hidden="true" />
                                  {formatTime(orden.fecha_creacion)}
                                </span>
                                <span>
                                  <i className="bi bi-shop me-1" aria-hidden="true" />
                                  {resolveSucursalLabel(orden)}
                                </span>
                              </p>
                            </div>
                            <span className={`badge ${badgeClass(estadoOrden)} inv-oc-detail-state-badge`}>
                              <i className={`${estadoIconClass(estadoOrden)} me-1`} aria-hidden="true" />
                              {estadoOrden}
                            </span>
                          </section>

                                                    {hasValue(orden?.observacion_solicitud) && (
                            <section className="inv-oc-detail-note-card">
                              <span>Observacion de solicitud</span>
                              <p>{orden.observacion_solicitud}</p>
                            </section>
                          )}

                          <section className="inv-oc-detail-section">
                            {detalles.length === 0 ? (
                              <div className="inv-oc-empty-state">
                                <i className="bi bi-box" aria-hidden="true" />
                                <span>Esta orden no tiene lineas de productos o insumos registradas.</span>
                              </div>
                            ) : (
                              <div className="inv-oc-detail-line-grid">
                                {detalles.map((row) => {
                                  const itemTipo = String(row?.item_tipo || '').toLowerCase() === 'producto' ? 'Producto' : 'Insumo';
                                  const itemIcon = itemTipo === 'Producto' ? 'bi-bag-check' : 'bi-box2-heart';
                                  const itemNombre = row?.item_nombre || `Detalle #${row?.id_detalle_orden || '-'}`;

                                  return (
                                    <article
                                      key={`detalle-orden-${row.id_detalle_orden}`}
                                      className="inv-oc-detail-line-card"
                                    >
                                      <div className="inv-oc-detail-line-card__head">
                                        <div className="inv-oc-detail-line-card__title">
                                          <span className="inv-oc-detail-line-card__type">
                                            <i className={`bi ${itemIcon}`} aria-hidden="true" />
                                            {itemTipo}
                                          </span>
                                          <strong>{itemNombre}</strong>
                                        </div>

                                        <span className="inv-oc-detail-line-card__qty">
                                          x{row?.cantidad_orden || 0}
                                        </span>
                                      </div>

                                      <div className="inv-oc-detail-line-card__meta">
                                        <span>
                                          <i className="bi bi-shop-window" aria-hidden="true" />
                                          {row?.almacen_destino_nombre || 'Sin almacen destino'}
                                        </span>

                                        <span>
                                          <i className="bi bi-bar-chart-line" aria-hidden="true" />
                                          Stock actual: {row?.stock_actual ?? 0}
                                        </span>

                                        {hasValue(row?.proveedor_sugerido_nombre) && (
                                          <span>
                                            <i className="bi bi-truck" aria-hidden="true" />
                                            {row.proveedor_sugerido_nombre}
                                          </span>
                                        )}
                                      </div>
                                    </article>
                                  );
                                })}
                              </div>
                            )}
                          </section>

                          {/* AM: bloque historico de evidencias solo para super admin cuando la OC ya esta abastecida. */}
                          {canViewEvidenciasAbastecida && (
                            <section className="inv-oc-detail-section">
                              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                                <h6 className="mb-0 inv-oc-detail-section__title">
                                  <i className="bi bi-images" aria-hidden="true" />
                                  Evidencias de orden abastecida
                                </h6>
                                <span className="badge text-bg-success">Super Admin</span>
                              </div>

                              {detailEvidencePreview.url ? (
                                <div className="border rounded-3 p-2 bg-white">
                                  <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
                                    <strong>{detailEvidencePreview.title || 'Vista previa de evidencia'}</strong>
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-secondary"
                                      onClick={() =>
                                        setDetailEvidencePreview({
                                          url: '',
                                          title: '',
                                          kind: 'image',
                                          loading: false,
                                          error: ''
                                        })
                                      }
                                    >
                                      Cerrar vista
                                    </button>
                                  </div>
                                  {detailEvidencePreview.kind !== 'image' ? (
                                    <a
                                      href={detailEvidencePreview.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="btn btn-outline-primary btn-sm"
                                    >
                                      Abrir documento
                                    </a>
                                  ) : (
                                    <img
                                      src={detailEvidencePreview.url}
                                      alt={detailEvidencePreview.title || 'Evidencia de orden de compra'}
                                      className="img-fluid rounded border"
                                    />
                                  )}
                                </div>
                              ) : null}
                              {detailEvidencePreview.loading ? (
                                <div className="text-muted small">Cargando evidencia...</div>
                              ) : null}
                              {detailEvidencePreview.error ? (
                                <div className="alert alert-warning py-2 mb-0">{detailEvidencePreview.error}</div>
                              ) : null}

                              {evidenciasHistorial.length === 0 ? (
                                <div className="inv-oc-empty-state">
                                  <i className="bi bi-clock-history" aria-hidden="true" />
                                  <span>Sin historial de evidencias para esta orden.</span>
                                </div>
                              ) : (
                                <div className="d-flex flex-column gap-2">
                                  {evidenciasHistorial.map((row) => {
                                    const hasEvidenceRef = Boolean(
                                      parsePositiveInt(row?.id_archivo) ||
                                        resolveInventarioImageUrl(row?.evidencia_url_publica)
                                    );
                                    return (
                                      <article
                                        key={`evidencia-historial-${row?.id_historial_evidencia || `${row?.tipo_evidencia}-${row?.id_archivo}-${row?.fecha_registro}`}`}
                                        className="border rounded-3 p-2 d-flex flex-column gap-1"
                                      >
                                        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                                          <strong>{formatEvidenceTypeLabel(row?.tipo_evidencia)}</strong>
                                          <span className="badge text-bg-light border">
                                            {formatEvidenceOriginLabel(row?.origen_etapa)}
                                          </span>
                                        </div>
                                        <small className="text-muted">
                                          {formatDate(row?.fecha_registro)} {formatTime(row?.fecha_registro)} -{' '}
                                          {normalizeText(row?.usuario_registro_nombre, 120) || 'Usuario no disponible'}
                                        </small>
                                        {parsePositiveInt(row?.id_compra) && (
                                          <small className="text-muted">Compra relacionada: #{row.id_compra}</small>
                                        )}
                                        {hasEvidenceRef ? (
                                          <button
                                            type="button"
                                            className="btn btn-sm btn-outline-primary align-self-start"
                                            title="Ver Factura"
                                            onClick={() =>
                                              openDetailEvidencePreview(
                                                orden?.id_orden_compra,
                                                row
                                              )
                                            }
                                          >
                                            Ver Factura
                                          </button>
                                        ) : (
                                          <small className="text-muted">Archivo no disponible.</small>
                                        )}
                                      </article>
                                    );
                                  })}
                                </div>
                              )}
                            </section>
                          )}

                          {solicitudesItem.length > 0 && (
                            <section className="inv-oc-detail-section">
                              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                                <h6 className="mb-0 inv-oc-detail-section__title">
                                  <i className="bi bi-lightbulb" aria-hidden="true" />
                                  Solicitudes de item no registrado
                                </h6>
                                <div className="d-flex flex-wrap gap-1">
                                  <span className="badge text-bg-secondary">Solicitudes: {solicitudesItem.length}</span>
                                </div>
                              </div>
                              <div className="d-flex flex-column gap-2">
                                {solicitudesItem.map((row) => {
                                  const estadoSolicitud = parseItemRequestState(row?.estado);
                                  const idSolicitud = parsePositiveInt(row?.id_solicitud_item);
                                  const canReviewRequest =
                                    canRevisarSolicitudItem &&
                                    estadoOrdenReal === 'PENDIENTE' &&
                                    (estadoSolicitud === ITEM_REQUEST_STATE_PENDIENTE ||
                                      estadoSolicitud === ITEM_REQUEST_STATE_EN_REVISION);
                                  const canOpenQuickCreate =
                                    canAtenderSolicitudItem &&
                                    estadoOrdenReal === 'PENDIENTE' &&
                                    estadoSolicitud === ITEM_REQUEST_STATE_EN_REVISION &&
                                    ((String(row?.tipo_item || '').toLowerCase() === 'producto' && canCrearProductos) ||
                                      (String(row?.tipo_item || '').toLowerCase() === 'insumo' && canCrearInsumos));

                                  return (
                                    <article
                                      key={`solicitud-item-${idSolicitud || `${row?.tipo_item || 'item'}-${row?.nombre_sugerido || 'nuevo'}`}`}
                                      className="border rounded-3 p-2 d-flex flex-column gap-2"
                                    >
                                      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                                        <div className="d-flex flex-column">
                                          <strong>{normalizeText(row?.nombre_sugerido, 160) || '-'}</strong>
                                          <small className="text-muted text-capitalize">
                                            {row?.tipo_item || '-'} - Cantidad sugerida: {parsePositiveInt(row?.cantidad_sugerida) || 1}
                                          </small>
                                        </div>
                                        <span className={`badge ${itemRequestBadgeClass(estadoSolicitud)}`}>{estadoSolicitud}</span>
                                      </div>
                                      {hasValue(row?.descripcion) && (
                                        <small className="text-muted">{normalizeText(row?.descripcion, 500)}</small>
                                      )}
                                      {hasValue(row?.comentario_revision) && (
                                        <small className="text-muted">
                                          Revision: {normalizeText(row?.comentario_revision, 500)}
                                        </small>
                                      )}
                                      {canReviewRequest && (
                                        <div className="d-flex flex-wrap gap-2">
                                          {estadoSolicitud === ITEM_REQUEST_STATE_PENDIENTE && (
                                            <button
                                              type="button"
                                              className="btn btn-sm btn-primary"
                                              onClick={() => openItemRequestDecision(orden, row, 'aprobar')}
                                              disabled={Boolean(rowBusy[orden?.id_orden_compra])}
                                            >
                                              Aprobar solicitud
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            className="btn btn-sm btn-outline-danger"
                                            onClick={() => openItemRequestDecision(orden, row, 'rechazar')}
                                            disabled={Boolean(rowBusy[orden?.id_orden_compra])}
                                          >
                                            Rechazar solicitud
                                          </button>
                                        </div>
                                      )}
                                      {canOpenQuickCreate && (
                                        <div className="d-flex flex-wrap gap-2">
                                          <button
                                            type="button"
                                            className="btn btn-sm btn-success"
                                            onClick={() => openQuickCreateItemModalFromRequest(orden, row)}
                                            disabled={Boolean(rowBusy[orden?.id_orden_compra])}
                                          >
                                            Agregar a catalogo
                                          </button>
                                        </div>
                                      )}
                                      {!canOpenQuickCreate &&
                                        estadoSolicitud === ITEM_REQUEST_STATE_EN_REVISION &&
                                        canAtenderSolicitudItem && (
                                        <small className="text-muted">
                                          Sin permiso para crear este tipo de item en catalogo.
                                        </small>
                                      )}
                                    </article>
                                  );
                                })}
                              </div>
                            </section>
                          )}
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-outline-secondary"
                  onClick={closeDetalleModal}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {reviewModal.open && (
        <div className="modal fade show d-block inv-oc-modal-layer" role="dialog" aria-modal="true">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content inv-oc-modal">
              <div className="modal-header">
                <h5 className="modal-title d-flex align-items-center gap-2">
                  <i
                    className={`bi ${
                      reviewModal.mode === 'rechazar' ? 'bi-x-octagon' : 'bi-patch-check'
                    }`}
                    aria-hidden="true"
                  />
                  {reviewModal.mode === 'rechazar' ? 'Rechazar orden' : 'Aprobar orden'}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setReviewModal(emptyReviewModal())}
                  disabled={reviewModal.loading}
                />
              </div>
              <div className="modal-body">
                <p className="text-muted mb-2">
                  Orden <strong>#{formatVisibleOrderNumber(reviewModal?.orden)}</strong>
                </p>
                <label className="form-label">
                  {reviewModal.mode === 'rechazar'
                    ? 'Motivo de rechazo (obligatorio)'
                    : 'Comentario de aprobacion (opcional)'}
                </label>
                <textarea
                  className={`form-control ${reviewModal.error ? 'is-invalid' : ''}`}
                  rows="3"
                  value={reviewModal.comentario}
                  onChange={(e) =>
                    setReviewModal((prev) => ({
                      ...prev,
                      comentario: e.target.value,
                      error: ''
                    }))
                  }
                  placeholder={
                    reviewModal.mode === 'rechazar'
                      ? 'Escribe el motivo del rechazo...'
                      : 'Comentario interno para la aprobacion...'
                  }
                />
                {reviewModal.error && <div className="invalid-feedback d-block">{reviewModal.error}</div>}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => setReviewModal(emptyReviewModal())}
                  disabled={reviewModal.loading}
                >
                  Cancelar
                </button>
                <button
                  className={`btn ${reviewModal.mode === 'rechazar' ? 'btn-danger' : 'btn-primary'}`}
                  onClick={submitReviewModal}
                  disabled={reviewModal.loading || (reviewModal.mode === 'rechazar' && !normalizeText(reviewModal.comentario, 1000))}
                >
                  {reviewModal.loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                      Guardando...
                    </>
                  ) : (
                    reviewModal.mode === 'rechazar' ? 'Confirmar rechazo' : 'Confirmar aprobacion'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {itemRequestModal.open && (
        <div className="modal fade show d-block inv-oc-modal-layer" role="dialog" aria-modal="true">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content inv-oc-modal">
              <div className="modal-header">
                <h5 className="modal-title d-flex align-items-center gap-2">
                  <i className="bi bi-plus-square" aria-hidden="true" />
                  Solicitar item no registrado
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setItemRequestModal(emptyItemRequestModal())}
                />
              </div>
              <div className="modal-body">
                <div className="row g-2">
                  <div className="col-12 col-md-4">
                    <label className="form-label mb-1">Tipo</label>
                    <select
                      className="form-select"
                      value={itemRequestModal.tipo_item}
                      onChange={(e) =>
                        setItemRequestModal((prev) => ({ ...prev, tipo_item: e.target.value, error: '' }))
                      }
                    >
                      <option value="producto">Producto</option>
                      <option value="insumo">Insumo</option>
                    </select>
                  </div>
                  <div className="col-12 col-md-8">
                    <label className="form-label mb-1">Nombre sugerido</label>
                    <input
                      className="form-control"
                      value={itemRequestModal.nombre_sugerido}
                      onChange={(e) =>
                        setItemRequestModal((prev) => ({ ...prev, nombre_sugerido: e.target.value, error: '' }))
                      }
                      placeholder="Ejemplo: Papel aluminio industrial"
                    />
                  </div>
                  <div className="col-12 col-md-4">
                    <label className="form-label mb-1">Cantidad sugerida</label>
                    <input
                      className="form-control"
                      value={itemRequestModal.cantidad_sugerida}
                      onChange={(e) =>
                        setItemRequestModal((prev) => ({
                          ...prev,
                          cantidad_sugerida: sanitizeInt(e.target.value),
                          error: ''
                        }))
                      }
                    />
                  </div>
                  <div className="col-12 col-md-8">
                    <label className="form-label mb-1">Descripcion</label>
                    <input
                      className="form-control"
                      value={itemRequestModal.descripcion}
                      onChange={(e) =>
                        setItemRequestModal((prev) => ({ ...prev, descripcion: e.target.value, error: '' }))
                      }
                      placeholder="Uso o detalle breve del item solicitado"
                    />
                  </div>
                </div>
                {itemRequestModal.error && <div className="alert alert-danger mt-2 mb-0">{itemRequestModal.error}</div>}
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-secondary" onClick={() => setItemRequestModal(emptyItemRequestModal())}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={addItemRequestToDraft}>
                  Agregar a solicitud
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {itemRequestDecisionModal.open && (
        <div className="modal fade show d-block inv-oc-modal-layer" role="dialog" aria-modal="true">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content inv-oc-modal">
              <div className="modal-header">
                <h5 className="modal-title d-flex align-items-center gap-2">
                  <i
                    className={`bi ${
                      itemRequestDecisionModal.accion === 'rechazar' ? 'bi-x-octagon' : 'bi-patch-check'
                    }`}
                    aria-hidden="true"
                  />
                  {itemRequestDecisionModal.accion === 'rechazar'
                    ? 'Rechazar solicitud de item'
                    : 'Aprobar solicitud de item'}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setItemRequestDecisionModal(emptyItemRequestDecisionModal())}
                  disabled={itemRequestDecisionModal.loading}
                />
              </div>
              <div className="modal-body">
                <p className="text-muted mb-2">
                  Orden <strong>#{formatVisibleOrderNumber(itemRequestDecisionModal?.orden)}</strong> - Solicitud{' '}
                  <strong>#{itemRequestDecisionModal.solicitud?.id_solicitud_item || '-'}</strong>
                </p>
                <label className="form-label">
                  {itemRequestDecisionModal.accion === 'rechazar'
                    ? 'Comentario (obligatorio)'
                    : 'Comentario (opcional)'}
                </label>
                <textarea
                  className={`form-control ${itemRequestDecisionModal.error ? 'is-invalid' : ''}`}
                  rows="3"
                  value={itemRequestDecisionModal.comentario}
                  onChange={(e) =>
                    setItemRequestDecisionModal((prev) => ({
                      ...prev,
                      comentario: e.target.value,
                      error: ''
                    }))
                  }
                  placeholder={
                    itemRequestDecisionModal.accion === 'rechazar'
                      ? 'Motivo del rechazo de la solicitud...'
                      : 'Comentario interno de la revision...'
                  }
                />
                {itemRequestDecisionModal.error && (
                  <div className="invalid-feedback d-block">{itemRequestDecisionModal.error}</div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => setItemRequestDecisionModal(emptyItemRequestDecisionModal())}
                  disabled={itemRequestDecisionModal.loading}
                >
                  Cancelar
                </button>
                <button
                  className={`btn ${itemRequestDecisionModal.accion === 'rechazar' ? 'btn-danger' : 'btn-primary'}`}
                  onClick={submitItemRequestDecision}
                  disabled={
                    itemRequestDecisionModal.loading ||
                    (itemRequestDecisionModal.accion === 'rechazar' &&
                      !normalizeText(itemRequestDecisionModal.comentario, 1000))
                  }
                >
                  {itemRequestDecisionModal.loading ? 'Guardando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {quickCreateItemModal.open && (
        <div className="modal fade show d-block inv-oc-modal-layer" role="dialog" aria-modal="true">
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content inv-oc-modal">
              <div className="modal-header">
                <h5 className="modal-title d-flex align-items-center gap-2">
                  <i className="bi bi-box-seam" aria-hidden="true" />
                  Alta rapida de {quickCreateItemModal.tipo_item}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setQuickCreateItemModal(emptyQuickCreateItemModal())}
                  disabled={quickCreateItemModal.loading}
                />
              </div>
              <div className="modal-body">
                <p className="text-muted mb-2">
                  Orden <strong>#{formatVisibleOrderNumber(quickCreateItemModal?.orden)}</strong> - Solicitud{' '}
                  <strong>#{quickCreateItemModal.solicitud?.id_solicitud_item || '-'}</strong>
                </p>
                <div className="row g-2">
                  <div className="col-12 col-md-6">
                    <label className="form-label mb-1">Nombre</label>
                    <input
                      className="form-control"
                      value={quickCreateItemModal.nombre}
                      onChange={(e) =>
                        setQuickCreateItemModal((prev) => ({ ...prev, nombre: e.target.value, error: '' }))
                      }
                    />
                  </div>
                  <div className="col-12 col-md-3">
                    <label className="form-label mb-1">Cantidad inicial</label>
                    <input
                      className="form-control"
                      value={quickCreateItemModal.cantidad}
                      onChange={(e) =>
                        setQuickCreateItemModal((prev) => ({
                          ...prev,
                          cantidad: sanitizeInt(e.target.value),
                          error: ''
                        }))
                      }
                    />
                  </div>
                  <div className="col-12 col-md-3">
                    <label className="form-label mb-1">Stock minimo</label>
                    <input
                      className="form-control"
                      value={quickCreateItemModal.stock_minimo}
                      onChange={(e) =>
                        setQuickCreateItemModal((prev) => ({
                          ...prev,
                          stock_minimo: sanitizeInt(e.target.value),
                          error: ''
                        }))
                      }
                    />
                  </div>
                  <div className="col-12 col-md-4">
                    <label className="form-label mb-1">Precio</label>
                    <input
                      className="form-control"
                      value={quickCreateItemModal.precio}
                      onChange={(e) =>
                        setQuickCreateItemModal((prev) => ({
                          ...prev,
                          precio: sanitizeDecimal(e.target.value),
                          error: ''
                        }))
                      }
                      placeholder="0.00"
                    />
                  </div>
                  <div className="col-12 col-md-8">
                    <label className="form-label mb-1">Almacen</label>
                    <select
                      className="form-select"
                      value={quickCreateItemModal.id_almacen}
                      onChange={(e) =>
                        setQuickCreateItemModal((prev) => ({
                          ...prev,
                          id_almacen: sanitizeInt(e.target.value),
                          error: ''
                        }))
                      }
                    >
                      <option value="">Selecciona almacen</option>
                      {quickCreateAlmacenesOptions.map((row) => (
                        <option key={`quick-add-almacen-${row.id_almacen}`} value={row.id_almacen}>
                          {row.nombre} ({row.nombre_sucursal || `Sucursal #${row.id_sucursal}`})
                        </option>
                      ))}
                    </select>
                  </div>
                  {quickCreateItemModal.tipo_item === 'producto' ? (
                    <div className="col-12">
                      <label className="form-label mb-1">Categoria de producto</label>
                      <select
                        className="form-select"
                        value={quickCreateItemModal.id_categoria_producto}
                        onChange={(e) =>
                          setQuickCreateItemModal((prev) => ({
                            ...prev,
                            id_categoria_producto: sanitizeInt(e.target.value),
                            error: ''
                          }))
                        }
                      >
                        <option value="">Selecciona categoria</option>
                          {categoriasProductos
                            .filter((row) => boolish(row?.estado ?? true))
                            .map((row) => (
                            <option key={`quick-add-cat-prod-${row.id_categoria_producto}`} value={row.id_categoria_producto}>
                              {getCategoriaLabel(row, `Categoria #${row.id_categoria_producto}`)}
                            </option>
                          ))}
                      </select>
                    </div>
                  ) : (
                    <>
                      <div className="col-12 col-md-8">
                        <label className="form-label mb-1">Categoria de insumo</label>
                        <select
                          className="form-select"
                          value={quickCreateItemModal.id_categoria_insumo}
                          onChange={(e) =>
                            setQuickCreateItemModal((prev) => ({
                              ...prev,
                              id_categoria_insumo: sanitizeInt(e.target.value),
                              error: ''
                            }))
                          }
                        >
                          <option value="">Selecciona categoria</option>
                          {categoriasInsumos
                            .filter((row) => boolish(row?.estado ?? true))
                            .map((row) => (
                              <option key={`quick-add-cat-ins-${row.id_categoria_insumo}`} value={row.id_categoria_insumo}>
                                {getCategoriaLabel(row, `Categoria #${row.id_categoria_insumo}`)}
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label mb-1">Unidad (opcional)</label>
                        <select
                          className="form-select"
                          value={quickCreateItemModal.id_unidad_medida}
                          onChange={(e) =>
                            setQuickCreateItemModal((prev) => ({
                              ...prev,
                              id_unidad_medida: sanitizeInt(e.target.value),
                              error: ''
                            }))
                          }
                        >
                          <option value="">Sin unidad</option>
                          {unidadesMedida.map((row) => (
                            <option key={`quick-add-um-${row.id_unidad_medida}`} value={row.id_unidad_medida}>
                              {row.nombre_unidad_medida || row.nombre || `Unidad #${row.id_unidad_medida}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                  <div className="col-12">
                    <label className="form-label mb-1">Descripcion</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      value={quickCreateItemModal.descripcion}
                      onChange={(e) =>
                        setQuickCreateItemModal((prev) => ({ ...prev, descripcion: e.target.value, error: '' }))
                      }
                    />
                  </div>
                </div>
                {quickCreateItemModal.error && <div className="alert alert-danger mt-2 mb-0">{quickCreateItemModal.error}</div>}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => setQuickCreateItemModal(emptyQuickCreateItemModal())}
                  disabled={quickCreateItemModal.loading}
                >
                  Cancelar
                </button>
                <button className="btn btn-success" onClick={submitQuickCreateItemModal} disabled={quickCreateItemModal.loading}>
                  {quickCreateItemModal.loading ? 'Guardando...' : 'Guardar y marcar atendida'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editDetallesModal.open && (
        <div className="modal fade show d-block inv-oc-modal-layer" role="dialog" aria-modal="true">
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content inv-oc-modal">
              <div className="modal-header">
                <h5 className="modal-title d-flex align-items-center gap-2">
                  <i className="bi bi-pencil-square" aria-hidden="true" />
                  Editar lineas de orden #{formatVisibleOrderNumber(editDetallesModal?.orden)}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setEditDetallesModal(emptyEditDetallesModal())}
                  disabled={editDetallesModal.loading}
                />
              </div>
              <div className="modal-body">
                <div className="table-responsive">
                  <table className="table table-sm align-middle">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Tipo</th>
                        <th style={{ width: 140 }}>Cantidad</th>
                        <th style={{ width: 120 }}>Eliminar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editDetallesModal.rows.map((row) => (
                        <tr key={row.id_detalle_orden}>
                          <td>{row.item_nombre}</td>
                          <td className="text-capitalize">{row.item_tipo}</td>
                          <td>
                            <input
                              className="form-control form-control-sm"
                              value={row.cantidad}
                              disabled={row.eliminar}
                              onChange={(e) =>
                                setEditDetallesModal((prev) => ({
                                  ...prev,
                                  error: '',
                                  rows: prev.rows.map((item) =>
                                    item.id_detalle_orden === row.id_detalle_orden
                                      ? { ...item, cantidad: sanitizeInt(e.target.value) }
                                      : item
                                  )
                                }))
                              }
                            />
                          </td>
                          <td>
                            <div className="form-check">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked={Boolean(row.eliminar)}
                                onChange={(e) =>
                                  setEditDetallesModal((prev) => ({
                                    ...prev,
                                    error: '',
                                    rows: prev.rows.map((item) =>
                                      item.id_detalle_orden === row.id_detalle_orden
                                        ? { ...item, eliminar: e.target.checked }
                                        : item
                                    )
                                  }))
                                }
                              />
                              <label className="form-check-label small">Eliminar</label>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="border rounded-3 p-2 mt-2">
                  <h6 className="mb-2">Agregar nuevo item</h6>
                  {/* AM: selector guiado por tipo + buscador; evita combobox largo y acelera seleccion en operacion real. */}
                  <div className="row g-2">
                    <div className="col-12 col-md-4">
                      <label className="form-label mb-1">Tipo de item</label>
                      <div className="btn-group btn-group-sm w-100" role="group" aria-label="Tipo de item">
                        <button
                          type="button"
                          className={`btn ${
                            String(editDetallesModal.selected_item_tipo || 'producto') === 'producto'
                              ? 'btn-primary'
                              : 'btn-outline-primary'
                          }`}
                          onClick={() =>
                            setEditDetallesModal((prev) => ({
                              ...prev,
                              selected_item_tipo: 'producto',
                              error: ''
                            }))
                          }
                        >
                          Productos
                        </button>
                        <button
                          type="button"
                          className={`btn ${
                            String(editDetallesModal.selected_item_tipo || 'producto') === 'insumo'
                              ? 'btn-primary'
                              : 'btn-outline-primary'
                          }`}
                          onClick={() =>
                            setEditDetallesModal((prev) => ({
                              ...prev,
                              selected_item_tipo: 'insumo',
                              error: ''
                            }))
                          }
                        >
                          Insumos
                        </button>
                      </div>
                    </div>
                    <div className="col-12 col-md-8">
                      <label className="form-label mb-1">Buscar item</label>
                      <div className="input-group input-group-sm">
                        <span className="input-group-text">
                          <i className="bi bi-search" aria-hidden="true" />
                        </span>
                        <input
                          className="form-control"
                          value={editDetallesModal.search_item || ''}
                          onChange={(e) =>
                            setEditDetallesModal((prev) => ({
                              ...prev,
                              search_item: e.target.value,
                              error: ''
                            }))
                          }
                          placeholder={`Buscar ${
                            String(editDetallesModal.selected_item_tipo || 'producto') === 'insumo'
                              ? 'insumos'
                              : 'productos'
                          }...`}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="table-responsive mt-2" style={{ maxHeight: 220 }}>
                    <table className="table table-sm align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Item</th>
                          <th>Almacenes de la sucursal</th>
                          <th style={{ width: 120 }}>Accion</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editDetalleCatalogFiltered.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="text-muted text-center py-3">
                              Sin resultados para este filtro.
                            </td>
                          </tr>
                        ) : (
                          editDetalleCatalogFiltered.map((row) => (
                            <tr key={`edit-item-row-${row.key}`}>
                              <td>
                                <strong>{row.nombre}</strong>{' '}
                                <small className="text-muted text-capitalize">({row.item_tipo})</small>
                              </td>
                              <td>
                                {normalizeAlmacenesSelection(row.id_almacenes_sucursal, 50)
                                  .map((idAlmacen) => {
                                    const almacen = almacenesMap.get(idAlmacen);
                                    return almacen?.nombre || null;
                                  })
                                  .filter(Boolean)
                                  .join(', ') || '-'}
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={() => addCatalogItemToEditModal(row)}
                                >
                                  Agregar
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  {Array.isArray(editDetallesModal.add_rows) && editDetallesModal.add_rows.length > 0 && (
                    <div className="table-responsive mt-2">
                      <table className="table table-sm align-middle mb-0">
                        <thead>
                          <tr>
                            <th>Nuevo item</th>
                            <th style={{ width: 130 }}>Cantidad</th>
                            <th style={{ width: 220 }}>Almacen destino</th>
                            <th style={{ width: 110 }}>Quitar</th>
                          </tr>
                        </thead>
                        <tbody>
                          {editDetallesModal.add_rows.map((row) => (
                            <tr key={row.key}>
                              <td>
                                {row.item_nombre} <small className="text-muted text-capitalize">({row.item_tipo})</small>
                              </td>
                              <td>
                                <input
                                  className="form-control form-control-sm"
                                  value={row.cantidad}
                                  onChange={(e) =>
                                    setEditDetallesModal((prev) => ({
                                      ...prev,
                                      error: '',
                                      add_rows: prev.add_rows.map((item) =>
                                        item.key === row.key
                                          ? { ...item, cantidad: sanitizeInt(e.target.value) }
                                          : item
                                      )
                                    }))
                                  }
                                />
                              </td>
                              <td>
                                <select
                                  className="form-select form-select-sm"
                                  value={row.id_almacen_destino || ''}
                                  onChange={(e) =>
                                    setEditDetallesModal((prev) => ({
                                      ...prev,
                                      error: '',
                                      add_rows: prev.add_rows.map((item) =>
                                        item.key === row.key
                                          ? { ...item, id_almacen_destino: parsePositiveInt(e.target.value) || '' }
                                          : item
                                      )
                                    }))
                                  }
                                >
                                  {normalizeAlmacenesSelection(row.id_almacenes_disponibles, 50).map((idAlmacen) => {
                                    const almacen = almacenesMap.get(idAlmacen);
                                    return (
                                      <option key={`${row.key}:almacen:${idAlmacen}`} value={idAlmacen}>
                                        {almacen?.nombre || `Almacen #${idAlmacen}`} (
                                        {almacen?.nombre_sucursal || `Sucursal #${almacen?.id_sucursal || '-'}`})
                                      </option>
                                    );
                                  })}
                                </select>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() =>
                                    setEditDetallesModal((prev) => ({
                                      ...prev,
                                      add_rows: prev.add_rows.filter((item) => item.key !== row.key),
                                      error: ''
                                    }))
                                  }
                                >
                                  Quitar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                {editDetallesModal.error && <div className="alert alert-danger mt-2 mb-0">{editDetallesModal.error}</div>}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => setEditDetallesModal(emptyEditDetallesModal())}
                  disabled={editDetallesModal.loading}
                >
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={submitEditDetallesModal} disabled={editDetallesModal.loading}>
                  {editDetallesModal.loading ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {recepcionModal.open && (
        <div className="modal fade show d-block inv-oc-modal-layer" role="dialog" aria-modal="true">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content inv-oc-modal">
              <div className="modal-header">
                <h5 className="modal-title d-flex align-items-center gap-2">
                  <i className="bi bi-receipt" aria-hidden="true" />
                  Registrar recepcion de orden #{formatVisibleOrderNumber(recepcionModal?.orden)}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={closeRecepcionModal}
                  disabled={recepcionModal.loading}
                />
              </div>
              <div className="modal-body">
                <div className="row g-2 mb-2">
                  <div className="col-12 col-md-6">
                    <label className="form-label mb-1">Usuario (auto)</label>
                    <input className="form-control" value={recepcionModal.usuario_sistema} readOnly disabled />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label mb-1">Sucursal (auto)</label>
                    <input className="form-control" value={recepcionModal.sucursal_sistema} readOnly disabled />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label mb-1">Fecha (auto)</label>
                    <input className="form-control" value={recepcionModal.fecha_sistema} readOnly disabled />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label mb-1">Hora (auto)</label>
                    <input className="form-control" value={recepcionModal.hora_sistema} readOnly disabled />
                  </div>
                </div>

                <label className="form-label mb-1">Factura de recepcion (opcional)</label>
                <input
                  className={`form-control ${recepcionModal.factura_error ? 'is-invalid' : ''}`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    const previousPreview = String(recepcionModal.factura_preview_url || '');
                    if (previousPreview.startsWith('blob:')) {
                      URL.revokeObjectURL(previousPreview);
                    }
                    if (!file) {
                      setRecepcionModal((prev) => ({
                        ...prev,
                        factura_file: null,
                        factura_file_mime_type: '',
                        factura_preview_url: '',
                        factura_error: ''
                      }));
                      return;
                    }
                    const validationError = getInventarioImageFileError(
                      file,
                      INVENTARIO_IMAGE_CONTEXT.OC_EVIDENCIAS_PRIVADAS
                    );
                    if (validationError) {
                      setRecepcionModal((prev) => ({
                        ...prev,
                        factura_file: null,
                        factura_file_mime_type: '',
                        factura_preview_url: '',
                        factura_error: validationError
                      }));
                      return;
                    }
                    setRecepcionModal((prev) => ({
                      ...prev,
                      factura_file: file,
                      factura_file_mime_type: String(file?.type || '').trim().toLowerCase(),
                      factura_preview_url: URL.createObjectURL(file),
                      factura_error: ''
                    }));
                  }}
                />
                {recepcionModal.factura_error && (
                  <div className="invalid-feedback d-block">{recepcionModal.factura_error}</div>
                )}
                {recepcionModal.factura_preview_url ? (
                  resolveEvidenceKindFromPayload(
                    recepcionModal.factura_file_mime_type,
                    recepcionModal.factura_preview_url
                  ) === 'pdf' ? (
                    <div className="mt-2">
                      <a
                        href={recepcionModal.factura_preview_url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-sm btn-outline-primary"
                      >
                        Abrir PDF seleccionado
                      </a>
                    </div>
                  ) : (
                    <img
                      src={recepcionModal.factura_preview_url}
                      alt="Factura de recepcion seleccionada"
                      className="img-fluid rounded border mt-2"
                    />
                  )
                ) : null}
                <label className="form-label mb-1 mt-2">Observacion (opcional)</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={recepcionModal.observacion}
                  onChange={(e) => setRecepcionModal((prev) => ({ ...prev, observacion: e.target.value }))}
                  placeholder="Comentario de recepcion en sucursal..."
                />
                {recepcionModal.error && <div className="alert alert-danger mt-2 mb-0">{recepcionModal.error}</div>}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-outline-secondary"
                  onClick={closeRecepcionModal}
                  disabled={recepcionModal.loading}
                >
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={doReportarRecepcion} disabled={recepcionModal.loading}>
                  {recepcionModal.loading ? 'Enviando...' : 'Guardar recepcion'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {supplyModal.open && (
        <div className="modal fade show d-block inv-oc-modal-layer" role="dialog" aria-modal="true">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content inv-oc-modal">
              <div className="modal-header">
                <h5 className="modal-title d-flex align-items-center gap-2">
                  <i className="bi bi-box-arrow-in-down" aria-hidden="true" />
                  Abastecer orden
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setSupplyModal(emptySupplyModal())}
                  disabled={supplyModal.loading}
                />
              </div>
              <div className="modal-body">
                <p className="text-muted mb-2">
                  Orden <strong>#{formatVisibleOrderNumber(supplyModal?.orden)}</strong> lista para ingreso a inventario.
                </p>
                <label className="form-label">Observacion (opcional)</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={supplyModal.observacion}
                  onChange={(e) => setSupplyModal((prev) => ({ ...prev, observacion: e.target.value }))}
                  placeholder="Observacion operativa del abastecimiento..."
                />
                {supplyModal.error && <div className="alert alert-danger mt-2 mb-0">{supplyModal.error}</div>}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => setSupplyModal(emptySupplyModal())}
                  disabled={supplyModal.loading}
                >
                  Cancelar
                </button>
                <button className="btn btn-success" onClick={doAbastecer} disabled={supplyModal.loading}>
                  {supplyModal.loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                      Abasteciendo...
                    </>
                  ) : (
                    'Confirmar abastecimiento'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {convertPanel.open && (
        <div className="modal fade show d-block inv-oc-modal-layer" role="dialog" aria-modal="true">
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content inv-oc-modal">
              <div className="modal-header">
                <h5 className="modal-title d-flex align-items-center gap-2">
                  <i className="bi bi-arrow-repeat" aria-hidden="true" />
                  Continuar orden #{formatVisibleOrderNumber(convertPanel?.orden)}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={closeConvertPanel}
                  disabled={convertPanel.loading}
                />
              </div>
              <div className="modal-body">
                {convertPanel.error && <div className="alert alert-danger">{convertPanel.error}</div>}
                <div className="row g-2 mb-3">
                  <div className="col-12 col-md-7">
                    <label className="form-label mb-1">Proveedor</label>
                    <select
                      className={`form-select ${parsePositiveInt(convertPanel.id_proveedor) ? '' : 'is-invalid'}`}
                      value={convertPanel.id_proveedor}
                      onChange={(e) =>
                        setConvertPanel((prev) => ({
                          ...prev,
                          id_proveedor: sanitizeInt(e.target.value),
                          error: ''
                        }))
                      }
                    >
                      <option value="">Seleccione proveedor</option>
                      {proveedores.map((row) => (
                        <option key={row.id_proveedor} value={row.id_proveedor}>
                          {row.nombre_proveedor || `Proveedor #${row.id_proveedor}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 col-md-5">
                    <label className="form-label mb-1">Fecha de compra</label>
                    <input
                      className="form-control"
                      type="date"
                      value={convertPanel.fecha_compra}
                      onChange={(e) =>
                        setConvertPanel((prev) => ({ ...prev, fecha_compra: e.target.value, error: '' }))
                      }
                    />
                  </div>
                </div>

                {/* AM: captura administrativa de costos reales por item para trazabilidad de compra. */}
                <div className="mb-3">
                  <label className="form-label mb-1">Costos y descuentos por item</label>
                  <div className="table-responsive border rounded">
                    <table className="table table-sm align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Item</th>
                          <th className="text-center">Cantidad</th>
                          <th>Costo unitario (L.)</th>
                          <th>Descuento linea (L.)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(Array.isArray(convertPanel.detalles) ? convertPanel.detalles : []).map((row) => (
                          <tr key={`convert-detail-${row.id_detalle_orden}`}>
                            <td>{row.item_nombre || `Detalle #${row.id_detalle_orden || '-'}`}</td>
                            <td className="text-center">{row.cantidad_orden || 0}</td>
                            <td style={{ minWidth: 150 }}>
                              <input
                                className="form-control form-control-sm"
                                value={row.precio_unitario}
                                onChange={(e) =>
                                  updateConvertDetailField(row.id_detalle_orden, 'precio_unitario', e.target.value)
                                }
                                placeholder="0.00"
                              />
                            </td>
                            <td style={{ minWidth: 150 }}>
                              <input
                                className="form-control form-control-sm"
                                value={row.descuento}
                                onChange={(e) => updateConvertDetailField(row.id_detalle_orden, 'descuento', e.target.value)}
                                placeholder="0.00"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* AM: parametros globales de la compra (descuento global + ISV) sin tocar inventario aun. */}
                <div className="row g-2 mb-3">
                  <div className="col-12 col-md-4">
                    <label className="form-label mb-1">Tipo descuento global</label>
                    <select
                      className="form-select"
                      value={resolveDiscountType(convertPanel.descuento_tipo)}
                      onChange={(e) =>
                        setConvertPanel((prev) => ({
                          ...prev,
                          descuento_tipo: resolveDiscountType(e.target.value),
                          error: ''
                        }))
                      }
                    >
                      <option value={DISCOUNT_TYPE_MONTO}>MONTO</option>
                      <option value={DISCOUNT_TYPE_PORCENTAJE}>PORCENTAJE</option>
                    </select>
                  </div>
                  <div className="col-12 col-md-4">
                    <label className="form-label mb-1">
                      Descuento global {resolveDiscountType(convertPanel.descuento_tipo) === DISCOUNT_TYPE_PORCENTAJE ? '(%)' : '(L.)'}
                    </label>
                    <input
                      className="form-control"
                      value={convertPanel.descuento_valor}
                      onChange={(e) =>
                        setConvertPanel((prev) => ({
                          ...prev,
                          descuento_valor: sanitizeDecimal(e.target.value),
                          error: ''
                        }))
                      }
                      placeholder="0.00"
                    />
                  </div>
                  <div className="col-12 col-md-4">
                    <label className="form-label mb-1">ISV (%)</label>
                    <input
                      className="form-control"
                      value={convertPanel.isv_pct}
                      onChange={(e) =>
                        setConvertPanel((prev) => ({
                          ...prev,
                          isv_pct: sanitizeDecimal(e.target.value),
                          error: ''
                        }))
                      }
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-12 col-md-3">
                    <div className="border rounded p-2 bg-light">
                      <small className="text-muted d-block">Subtotal</small>
                      <strong>{formatMoney(convertPreview.sub_total)}</strong>
                    </div>
                  </div>
                  <div className="col-12 col-md-3">
                    <div className="border rounded p-2 bg-light">
                      <small className="text-muted d-block">Descuento total</small>
                      <strong>{formatMoney(convertPreview.descuento_total)}</strong>
                    </div>
                  </div>
                  <div className="col-12 col-md-3">
                    <div className="border rounded p-2 bg-light">
                      <small className="text-muted d-block">ISV</small>
                      <strong>{formatMoney(convertPreview.isv)}</strong>
                    </div>
                  </div>
                  <div className="col-12 col-md-3">
                    <div className="border rounded p-2 bg-light">
                      <small className="text-muted d-block">Total</small>
                      <strong>{formatMoney(convertPreview.total)}</strong>
                    </div>
                  </div>
                </div>
                {convertPreview.has_error && <div className="alert alert-warning py-2">{convertPreview.error}</div>}

                <div className="mb-3">
                  <label className="form-label mb-1">Observaciones administrativas</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={convertPanel.observacion_admin}
                    onChange={(e) =>
                      setConvertPanel((prev) => ({
                        ...prev,
                        observacion_admin: e.target.value,
                        error: ''
                      }))
                    }
                    placeholder="Ejemplo: compra parcial pendiente de confirmar transferencia..."
                  />
                </div>

                {/* AM: modal admin con evidencias reutilizando upload actual sin WebSocket ni subestados nuevos. */}
                <div className="inv-oc-detail-evidence-grid">
                  <article className="inv-oc-evidence-card">
                    <span>Factura subida por sucursal</span>
                    {convertPanel.factura_recepcion_url ? (
                      (() => {
                        const facturaKind = resolveEvidenceKindFromPayload(
                          convertPanel.factura_recepcion_mime_type,
                          convertPanel.factura_recepcion_url
                        );
                        return (
                          <>
                            <a href={convertPanel.factura_recepcion_url} target="_blank" rel="noreferrer">
                              {facturaKind === 'pdf' ? 'Abrir PDF' : 'Ver imagen'}
                            </a>
                            {facturaKind === 'image' ? (
                              <img src={convertPanel.factura_recepcion_url} alt="Factura de recepcion en sucursal" />
                            ) : (
                              <small className="text-muted">Documento PDF disponible de forma segura.</small>
                            )}
                          </>
                        );
                      })()
                    ) : (
                      <small className="text-muted">No hay factura adjunta en esta recepcion.</small>
                    )}
                  </article>
                  <article className="inv-oc-evidence-card">
                    <span>Deposito / transferencia (opcional para Guardar)</span>
                    <input
                      className={`form-control ${convertPanel.transferencia_error ? 'is-invalid' : ''}`}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        // AM: libera preview anterior para evitar fugas al cambiar de archivo.
                        const previousPreview = String(convertPanel.transferencia_preview_url || '');
                        if (previousPreview.startsWith('blob:')) {
                          URL.revokeObjectURL(previousPreview);
                        }
                        if (!file) {
                          setConvertPanel((prev) => ({
                            ...prev,
                            transferencia_file: null,
                            transferencia_file_mime_type: '',
                            transferencia_preview_url: '',
                            transferencia_error: '',
                            error: ''
                          }));
                          return;
                        }
                        const validationError = getInventarioImageFileError(
                          file,
                          INVENTARIO_IMAGE_CONTEXT.OC_EVIDENCIAS_PRIVADAS
                        );
                        if (validationError) {
                          setConvertPanel((prev) => ({
                            ...prev,
                            transferencia_file: null,
                            transferencia_file_mime_type: '',
                            transferencia_preview_url: '',
                            transferencia_error: validationError
                          }));
                          return;
                        }
                        setConvertPanel((prev) => ({
                          ...prev,
                          transferencia_file: file,
                          transferencia_file_mime_type: String(file?.type || '').trim().toLowerCase(),
                          transferencia_preview_url: file ? URL.createObjectURL(file) : '',
                          transferencia_error: '',
                          error: ''
                        }));
                      }}
                    />
                    {convertPanel.transferencia_error && (
                      <div className="invalid-feedback d-block">{convertPanel.transferencia_error}</div>
                    )}
                    {(convertPanel.transferencia_preview_url || convertPanel.transferencia_url_actual) &&
                      (() => {
                        const transferenciaUrl = resolveInventarioImageUrl(
                          convertPanel.transferencia_preview_url || convertPanel.transferencia_url_actual
                        );
                        const transferenciaKind = resolveEvidenceKindFromPayload(
                          convertPanel.transferencia_preview_url
                            ? convertPanel.transferencia_file_mime_type
                            : convertPanel.transferencia_mime_type,
                          transferenciaUrl
                        );
                        return (
                          <>
                            <a href={transferenciaUrl} target="_blank" rel="noreferrer">
                              {transferenciaKind === 'pdf' ? 'Abrir PDF actual' : 'Ver imagen actual'}
                            </a>
                            {transferenciaKind === 'image' ? (
                              <img src={transferenciaUrl} alt="Comprobante de deposito o transferencia" />
                            ) : (
                              <small className="text-muted">Documento PDF disponible de forma segura.</small>
                            )}
                          </>
                        );
                      })()}
                  </article>
                </div>
                <p className="form-text mt-2 mb-0">
                  Guardar: persiste proveedor/evidencia sin mover inventario. Guardar y abastecer: persiste y ejecuta
                  abastecimiento append-only.
                </p>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-outline-secondary"
                  onClick={closeConvertPanel}
                  disabled={convertPanel.loading}
                >
                  Cancelar
                </button>
                {canConvertPanelSave && (
                  <button
                    className="btn btn-primary"
                    onClick={() => doConvert('guardar')}
                    disabled={convertPanel.loading}
                  >
                    {convertPanel.loading && convertPanel.submit_action === 'guardar' ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                        Guardando...
                      </>
                    ) : (
                      'Guardar'
                    )}
                  </button>
                )}
                {canConvertPanelSaveAndSupply && (
                  <button
                    className="btn btn-success"
                    onClick={() => doConvert('guardar_y_abastecer')}
                    disabled={convertPanel.loading}
                  >
                    {convertPanel.loading && convertPanel.submit_action === 'guardar_y_abastecer' ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                        Guardando y abasteciendo...
                      </>
                    ) : (
                      'Guardar y abastecer'
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdenesCompraTab;





