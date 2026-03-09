import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { inventarioService } from '../../../services/inventarioService';

const parseEstado = (value) => {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return Boolean(value);
};

// NEW: normaliza fechas visibles del kardex en una sola funcion reutilizable.
// WHY: la tabla y las cards mobile deben usar el mismo formato para no generar diferencias visuales.
// IMPACT: solo presentacion; no altera requests ni contratos del endpoint.
const formatKardexFecha = (value) => {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString('es-HN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatRefLabel = (movimiento) => {
  const origen = String(movimiento?.ref_origen ?? '').trim();
  const refId =
    movimiento?.id_ref === null || movimiento?.id_ref === undefined ? '' : String(movimiento?.id_ref).trim();

  if (origen && refId) return `${origen} #${refId}`;
  if (origen) return origen;
  if (refId) return `#${refId}`;
  return '-';
};

const getTipoBadgeClass = (tipo) => {
  const normalized = String(tipo ?? '').toUpperCase();
  if (normalized === 'ENTRADA') return 'is-entry';
  if (normalized === 'SALIDA') return 'is-exit';
  if (normalized === 'AJUSTE') return 'is-adjust';
  return 'is-neutral';
};

const formatSaldoLabel = (movimiento) => {
  if (movimiento?.es_legacy) return 'N/D';
  return `${movimiento?.saldo_antes ?? 'N/D'} -> ${movimiento?.saldo_despues ?? 'N/D'}`;
};

const formatCantidadLabel = (movimiento) => {
  const tipo = String(movimiento?.tipo ?? '').toUpperCase();
  const impacto = Number(movimiento?.impacto);
  const cantidad = Number(movimiento?.cantidad ?? 0);

  if (Number.isFinite(impacto) && impacto !== 0) return `${impacto > 0 ? '+' : ''}${impacto}`;
  if (tipo === 'AJUSTE') return `= ${cantidad}`;
  if (!cantidad) return '-';
  if (tipo === 'ENTRADA') return `+${cantidad}`;
  if (tipo === 'SALIDA') return `-${cantidad}`;
  return String(cantidad);
};

const formatSucursalOptionLabel = (sucursal, fallbackId = '') => {
  const id = String(sucursal?.id_sucursal ?? fallbackId ?? '').trim();
  if (!id) return 'Sucursal sin ID';

  const nombre = String(sucursal?.nombre_sucursal ?? '').trim() || `Sucursal ${id}`;
  return `${nombre}${parseEstado(sucursal?.estado) ? '' : ' (Inactiva)'}`;
};

const formatAlmacenOptionLabel = (almacen, sucursalesMap) => {
  const nombreAlmacen = String(almacen?.nombre ?? '').trim() || `Almacen ${almacen?.id_almacen ?? ''}`;
  const sucursal = sucursalesMap.get(String(almacen?.id_sucursal ?? '').trim());
  const nombreSucursal = String(sucursal?.nombre_sucursal ?? '').trim() || `Sucursal ${almacen?.id_sucursal ?? '-'}`;
  return `${nombreAlmacen} / ${nombreSucursal}`;
};

const formatItemOptionLabel = (item, fallbackLabel) => {
  const nombre =
    String(item?.nombre_producto ?? item?.nombre_insumo ?? '').trim() ||
    `${fallbackLabel} ${item?.id_producto ?? item?.id_insumo ?? ''}`;
  return `${nombre}${parseEstado(item?.estado) ? '' : ' (Inactivo)'}`;
};

const normalizeItemTipoFilter = (value) => {
  if (value === 'producto') return 'Producto';
  if (value === 'insumo') return 'Insumo';
  return '';
};

const getItemId = (item, itemTipo) =>
  itemTipo === 'producto' ? String(item?.id_producto ?? '').trim() : String(item?.id_insumo ?? '').trim();

const MOVIMIENTOS_PAGE_SIZE = 10;

const MovimientosTab = ({
  openToast,
  embedded = false,
  onMovimientoCreado,
  almacenes = [],
  sucursales = [],
  selectedAlmacenId = '',
  onSelectAlmacen,
  presetFilters = {},
  presetFiltersVersion = 0
}) => {
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingRefs, setLoadingRefs] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [productos, setProductos] = useState([]);
  const [insumos, setInsumos] = useState([]);

  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [listPage, setListPage] = useState(1);
  const [tipoFiltro, setTipoFiltro] = useState('todos');
  const [sucursalFiltro, setSucursalFiltro] = useState('');
  const [almacenFiltro, setAlmacenFiltro] = useState('todos');
  const [itemTipoFiltro, setItemTipoFiltro] = useState('todos');
  const [itemFiltroId, setItemFiltroId] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [filterDraft, setFilterDraft] = useState({
    id_almacen: '',
    tipo: 'todos',
    item_tipo: 'todos',
    id_item: '',
    desde: '',
    hasta: ''
  });

  const [form, setForm] = useState({
    tipo: 'ENTRADA',
    id_almacen: '',
    item_tipo: 'producto',
    id_item: '',
    cantidad: '',
    ref_origen: '',
    descripcion: ''
  });
  const [createErrors, setCreateErrors] = useState({});

  const modalPortalTarget = typeof document !== 'undefined' ? document.body : null;
  const kardexRequestIdRef = useRef(0);

  const safeToast = (title, message, variant = 'success') => {
    if (typeof openToast === 'function') openToast(title, message, variant);
  };

  const sucursalesMap = useMemo(() => {
    const map = new Map();
    for (const sucursal of Array.isArray(sucursales) ? sucursales : []) {
      const key = String(sucursal?.id_sucursal ?? '').trim();
      if (!key) continue;
      map.set(key, sucursal);
    }
    return map;
  }, [sucursales]);

  const almacenesMap = useMemo(() => {
    const map = new Map();
    for (const almacen of Array.isArray(almacenes) ? almacenes : []) {
      const key = String(almacen?.id_almacen ?? '').trim();
      if (!key) continue;
      map.set(key, almacen);
    }
    return map;
  }, [almacenes]);

  const sucursalesDisponibles = useMemo(() => {
    const ids = new Set();
    for (const almacen of Array.isArray(almacenes) ? almacenes : []) {
      const id = String(almacen?.id_sucursal ?? '').trim();
      if (!id) continue;
      ids.add(id);
    }

    return Array.from(ids)
      .sort((left, right) => Number(left) - Number(right))
      .map((id) => ({
        id,
        label: formatSucursalOptionLabel(sucursalesMap.get(id), id)
      }));
  }, [almacenes, sucursalesMap]);

  const selectedWarehouseFromParent =
    String(selectedAlmacenId ?? '').trim() && String(selectedAlmacenId ?? '').trim() !== 'todos'
      ? almacenesMap.get(String(selectedAlmacenId).trim()) || null
      : null;

  const defaultSucursalId = useMemo(() => {
    if (selectedWarehouseFromParent?.id_sucursal) return String(selectedWarehouseFromParent.id_sucursal);
    return sucursalesDisponibles[0]?.id ?? '';
  }, [selectedWarehouseFromParent?.id_sucursal, sucursalesDisponibles]);

  const baseSucursalId = useMemo(() => {
    const presetSucursal = String(presetFilters?.id_sucursal ?? '').trim();
    if (presetSucursal && sucursalesDisponibles.some((option) => option.id === presetSucursal)) return presetSucursal;
    return defaultSucursalId;
  }, [defaultSucursalId, presetFilters?.id_sucursal, sucursalesDisponibles]);

  const baseAlmacenId = useMemo(() => {
    const presetAlmacen = String(presetFilters?.id_almacen ?? 'todos').trim() || 'todos';
    if (presetAlmacen !== 'todos' && almacenesMap.has(presetAlmacen)) return presetAlmacen;
    return selectedWarehouseFromParent ? String(selectedWarehouseFromParent.id_almacen) : 'todos';
  }, [almacenesMap, presetFilters?.id_almacen, selectedWarehouseFromParent]);

  const baseTipoFiltro = useMemo(() => {
    const safeTipo = String(presetFilters?.tipo ?? 'todos').trim() || 'todos';
    return ['todos', 'ENTRADA', 'SALIDA', 'AJUSTE'].includes(safeTipo) ? safeTipo : 'todos';
  }, [presetFilters?.tipo]);

  const almacenesFiltroOptions = useMemo(() => {
    return (Array.isArray(almacenes) ? [...almacenes] : [])
      .filter((almacen) => (sucursalFiltro ? String(almacen?.id_sucursal ?? '') === String(sucursalFiltro) : true))
      .sort((left, right) => Number(left?.id_almacen ?? 0) - Number(right?.id_almacen ?? 0));
  }, [almacenes, sucursalFiltro]);

  const productosFiltroOptions = useMemo(() => {
    return (Array.isArray(productos) ? [...productos] : [])
      .filter((producto) => (almacenFiltro === 'todos' ? true : String(producto?.id_almacen ?? '') === String(almacenFiltro)))
      .sort((left, right) =>
        String(left?.nombre_producto ?? '').localeCompare(String(right?.nombre_producto ?? ''), 'es')
      );
  }, [almacenFiltro, productos]);

  const insumosFiltroOptions = useMemo(() => {
    return (Array.isArray(insumos) ? [...insumos] : [])
      .filter((insumo) => (almacenFiltro === 'todos' ? true : String(insumo?.id_almacen ?? '') === String(almacenFiltro)))
      .sort((left, right) =>
        String(left?.nombre_insumo ?? '').localeCompare(String(right?.nombre_insumo ?? ''), 'es')
      );
  }, [almacenFiltro, insumos]);

  const itemFiltroOptions = useMemo(() => {
    if (itemTipoFiltro === 'producto') return productosFiltroOptions;
    if (itemTipoFiltro === 'insumo') return insumosFiltroOptions;
    return [];
  }, [insumosFiltroOptions, itemTipoFiltro, productosFiltroOptions]);

  const filterDraftItemOptions = useMemo(() => {
    const draftWarehouseId = String(filterDraft.id_almacen ?? '').trim();
    if (!draftWarehouseId || filterDraft.item_tipo === 'todos') return [];

    const source = filterDraft.item_tipo === 'producto' ? productos : insumos;

    return (Array.isArray(source) ? [...source] : [])
      .filter((item) => String(item?.id_almacen ?? '') === draftWarehouseId)
      .sort((left, right) =>
        String(left?.nombre_producto ?? left?.nombre_insumo ?? '').localeCompare(
          String(right?.nombre_producto ?? right?.nombre_insumo ?? ''),
          'es'
        )
      );
  }, [filterDraft.id_almacen, filterDraft.item_tipo, insumos, productos]);

  const formItemOptions = useMemo(() => {
    const almacenId = String(form.id_almacen ?? '').trim();
    const source = form.item_tipo === 'producto' ? productos : insumos;

    return (Array.isArray(source) ? [...source] : [])
      .filter((item) => String(item?.id_almacen ?? '') === almacenId)
      .sort((left, right) =>
        String(left?.nombre_producto ?? left?.nombre_insumo ?? '').localeCompare(
          String(right?.nombre_producto ?? right?.nombre_insumo ?? ''),
          'es'
        )
      );
  }, [form.id_almacen, form.item_tipo, insumos, productos]);

  const selectedAlmacen = useMemo(() => {
    const safeId = String(almacenFiltro ?? '').trim();
    if (!safeId || safeId === 'todos') return null;
    return almacenesMap.get(safeId) || null;
  }, [almacenFiltro, almacenesMap]);

  const lockedFilterWarehouse = useMemo(() => {
    const selectedKey = String(selectedAlmacenId ?? '').trim();
    if (selectedKey && almacenesMap.has(selectedKey)) return almacenesMap.get(selectedKey) || null;

    const currentKey = String(almacenFiltro ?? '').trim();
    if (currentKey && currentKey !== 'todos') return almacenesMap.get(currentKey) || null;

    return null;
  }, [almacenFiltro, almacenesMap, selectedAlmacenId]);

  const scopeLabel = useMemo(() => {
    if (selectedAlmacen) return String(selectedAlmacen?.nombre ?? '').trim() || `Almacen #${selectedAlmacen?.id_almacen ?? '-'}`;
    if (sucursalFiltro) return formatSucursalOptionLabel(sucursalesMap.get(String(sucursalFiltro).trim()), sucursalFiltro);
    return 'Todos los almacenes';
  }, [selectedAlmacen, sucursalFiltro, sucursalesMap]);

  const kardexRequest = useMemo(
    () => ({
      id_sucursal: sucursalFiltro || undefined,
      id_almacen: almacenFiltro === 'todos' ? undefined : almacenFiltro,
      tipo: tipoFiltro === 'todos' ? undefined : tipoFiltro,
      item_tipo: itemTipoFiltro === 'todos' ? undefined : normalizeItemTipoFilter(itemTipoFiltro),
      id_item: itemFiltroId || undefined,
      desde: desde || undefined,
      hasta: hasta || undefined,
      q: debouncedSearch || undefined
    }),
    [almacenFiltro, debouncedSearch, desde, hasta, itemFiltroId, itemTipoFiltro, sucursalFiltro, tipoFiltro]
  );

  const hasActiveListadoFilters = useMemo(
    () =>
      search.trim() !== '' ||
      tipoFiltro !== 'todos' ||
      itemTipoFiltro !== 'todos' ||
      itemFiltroId !== '' ||
      desde !== '' ||
      hasta !== '',
    [desde, hasta, itemFiltroId, itemTipoFiltro, search, tipoFiltro]
  );

  const listTotalPages = useMemo(
    () => Math.max(1, Math.ceil(movimientos.length / MOVIMIENTOS_PAGE_SIZE)),
    [movimientos.length]
  );

  const paginatedMovimientos = useMemo(() => {
    const start = (listPage - 1) * MOVIMIENTOS_PAGE_SIZE;
    return movimientos.slice(start, start + MOVIMIENTOS_PAGE_SIZE);
  }, [listPage, movimientos]);

  const listPageWindow = useMemo(() => {
    if (!movimientos.length) return '0-0';
    const start = (listPage - 1) * MOVIMIENTOS_PAGE_SIZE + 1;
    const end = Math.min(movimientos.length, start + MOVIMIENTOS_PAGE_SIZE - 1);
    return `${start}-${end}`;
  }, [listPage, movimientos.length]);

  const visiblePageNumbers = useMemo(() => {
    if (listTotalPages <= 5) return Array.from({ length: listTotalPages }, (_, index) => index + 1);

    let start = Math.max(1, listPage - 2);
    let end = Math.min(listTotalPages, start + 4);
    start = Math.max(1, end - 4);

    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [listPage, listTotalPages]);

  const auxModalOpen = showCreateModal || showFiltersModal;

  const cargarReferencias = async () => {
    setLoadingRefs(true);

    try {
      const [productosData, insumosData] = await Promise.all([
        inventarioService.getProductos({ incluirInactivos: true }),
        inventarioService.getInsumos({ incluirInactivos: true })
      ]);

      setProductos(Array.isArray(productosData) ? productosData : []);
      setInsumos(Array.isArray(insumosData) ? insumosData : []);
    } catch (requestError) {
      const message = requestError?.message || 'ERROR CARGANDO REFERENCIAS DEL KARDEX';
      setError(message);
      safeToast('ERROR', message, 'danger');
    } finally {
      setLoadingRefs(false);
    }
  };

  const cargarKardex = async (request = kardexRequest) => {
    const requestId = ++kardexRequestIdRef.current;
    setLoading(true);
    setError('');

    try {
      const data = await inventarioService.getKardex(request);
      if (requestId !== kardexRequestIdRef.current) return;
      setMovimientos(Array.isArray(data) ? data : []);
    } catch (requestError) {
      if (requestId !== kardexRequestIdRef.current) return;
      const message = requestError?.message || 'ERROR CARGANDO KARDEX';
      setError(message);
      safeToast('ERROR', message, 'danger');
    } finally {
      if (requestId !== kardexRequestIdRef.current) return;
      setLoading(false);
    }
  };

  useEffect(() => {
    // FIX IMPORTANTE: debounce de busqueda para no disparar requests por cada tecla en kardex.
    if (typeof window === 'undefined') {
      setDebouncedSearch(search.trim());
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [search]);

  useEffect(() => {
    if (typeof document === 'undefined' || !auxModalOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [auxModalOpen]);

  useEffect(() => {
    cargarReferencias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cargarKardex(kardexRequest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kardexRequest]);

  useEffect(() => {
    setListPage(1);
  }, [kardexRequest]);

  useEffect(() => {
    if (!sucursalFiltro && defaultSucursalId) setSucursalFiltro(defaultSucursalId);
  }, [defaultSucursalId, sucursalFiltro]);

  useEffect(() => {
    setListPage((current) => Math.min(current, listTotalPages));
  }, [listTotalPages]);

  useEffect(() => {
    if (!baseSucursalId) return;

    const nextAlmacen =
      String(baseAlmacenId ?? 'todos').trim() !== 'todos' && almacenesMap.has(String(baseAlmacenId).trim())
        ? String(baseAlmacenId).trim()
        : 'todos';

    setSucursalFiltro(baseSucursalId);
    setAlmacenFiltro(nextAlmacen);
    setTipoFiltro(baseTipoFiltro);
  }, [almacenesMap, baseAlmacenId, baseSucursalId, baseTipoFiltro, presetFiltersVersion]);

  useEffect(() => {
    const normalizedSelected = String(selectedAlmacenId ?? '').trim();
    if (!normalizedSelected) return;

    if (normalizedSelected === 'todos') {
      setAlmacenFiltro('todos');
      return;
    }

    const selected = almacenesMap.get(normalizedSelected);
    if (!selected) return;

    setAlmacenFiltro(normalizedSelected);
    if (selected?.id_sucursal) setSucursalFiltro(String(selected.id_sucursal));
  }, [selectedAlmacenId, almacenesMap]);

  useEffect(() => {
    if (!showFiltersModal) return;
    if (!lockedFilterWarehouse?.id_almacen) return;

    setFilterDraft((current) => ({
      ...current,
      id_almacen: String(lockedFilterWarehouse.id_almacen)
    }));
  }, [lockedFilterWarehouse?.id_almacen, showFiltersModal]);

  useEffect(() => {
    if (almacenFiltro === 'todos') return;

    const stillExists = almacenesFiltroOptions.some(
      (almacen) => String(almacen?.id_almacen ?? '') === String(almacenFiltro)
    );

    if (!stillExists) {
      setAlmacenFiltro('todos');
      if (typeof onSelectAlmacen === 'function') onSelectAlmacen('todos');
    }
  }, [almacenFiltro, almacenesFiltroOptions, onSelectAlmacen]);

  useEffect(() => {
    if (itemTipoFiltro === 'todos') {
      if (itemFiltroId) setItemFiltroId('');
      return;
    }

    if (
      itemFiltroId &&
      !itemFiltroOptions.some((item) => getItemId(item, itemTipoFiltro) === String(itemFiltroId ?? '').trim())
    ) {
      setItemFiltroId('');
    }
  }, [itemFiltroId, itemFiltroOptions, itemTipoFiltro]);

  useEffect(() => {
    if (filterDraft.item_tipo === 'todos') {
      if (filterDraft.id_item) {
        setFilterDraft((current) => ({ ...current, id_item: '' }));
      }
      return;
    }

    if (
      filterDraft.id_item &&
      !filterDraftItemOptions.some(
        (item) => getItemId(item, filterDraft.item_tipo) === String(filterDraft.id_item ?? '').trim()
      )
    ) {
      setFilterDraft((current) => ({ ...current, id_item: '' }));
    }
  }, [filterDraft.id_item, filterDraft.item_tipo, filterDraftItemOptions]);

  useEffect(() => {
    if (!form.id_item) return;

    const selectedStillExists = formItemOptions.some(
      (item) => getItemId(item, form.item_tipo) === String(form.id_item ?? '').trim()
    );

    if (!selectedStillExists) {
      setForm((current) => ({ ...current, id_item: '' }));
    }
  }, [form.id_item, form.item_tipo, formItemOptions]);

  const resetForm = () => {
    const preferredAlmacenId =
      almacenFiltro !== 'todos'
        ? String(almacenFiltro)
        : selectedWarehouseFromParent
        ? String(selectedWarehouseFromParent.id_almacen)
        : '';

    setForm({
      tipo: 'ENTRADA',
      id_almacen: preferredAlmacenId,
      item_tipo: 'producto',
      id_item: '',
      cantidad: '',
      ref_origen: '',
      descripcion: ''
    });
    setCreateErrors({});
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const validarMovimiento = (data) => {
    const errors = {};
    const tipo = String(data?.tipo ?? '').trim().toUpperCase();
    const idAlmacenRaw = String(data?.id_almacen ?? '').trim();
    const itemTipo = String(data?.item_tipo ?? 'producto').trim().toLowerCase();
    const idItemRaw = String(data?.id_item ?? '').trim();
    const cantidadRaw = String(data?.cantidad ?? '').trim();
    const refOrigen = String(data?.ref_origen ?? '').trim();
    const descripcion = String(data?.descripcion ?? '').trim();

    const idAlmacen = Number.parseInt(idAlmacenRaw, 10);
    const idItem = Number.parseInt(idItemRaw, 10);
    const cantidad = Number.parseInt(cantidadRaw, 10);

    if (!['ENTRADA', 'SALIDA', 'AJUSTE'].includes(tipo)) errors.tipo = 'SELECCIONA UN TIPO VALIDO.';
    if (!idAlmacenRaw) errors.id_almacen = 'EL ALMACEN ES OBLIGATORIO.';
    else if (Number.isNaN(idAlmacen) || idAlmacen <= 0) errors.id_almacen = 'SELECCIONA UN ALMACEN VALIDO.';

    if (!['producto', 'insumo'].includes(itemTipo)) errors.item_tipo = 'SELECCIONA UN TIPO DE ITEM VALIDO.';
    if (!idItemRaw) errors.id_item = 'SELECCIONA UN ITEM.';
    else if (Number.isNaN(idItem) || idItem <= 0) errors.id_item = 'SELECCIONA UN ITEM VALIDO.';

    if (!cantidadRaw) errors.cantidad = 'LA CANTIDAD ES OBLIGATORIA.';
    else if (!/^\d+$/.test(cantidadRaw)) errors.cantidad = 'SOLO SE ACEPTAN ENTEROS.';
    else if (tipo === 'AJUSTE' ? cantidad < 0 : cantidad <= 0) {
      errors.cantidad = tipo === 'AJUSTE' ? 'AJUSTE DEBE SER MAYOR O IGUAL A 0.' : 'LA CANTIDAD DEBE SER MAYOR A 0.';
    }

    const itemSeleccionado =
      itemTipo === 'producto'
        ? productos.find((producto) => Number(producto?.id_producto ?? 0) === idItem)
        : insumos.find((insumo) => Number(insumo?.id_insumo ?? 0) === idItem);

    if (!itemSeleccionado && !errors.id_item) errors.id_item = 'EL ITEM SELECCIONADO NO EXISTE.';
    else if (
      itemSeleccionado &&
      Number(itemSeleccionado?.id_almacen ?? 0) !== Number(idAlmacen ?? 0) &&
      !errors.id_almacen
    ) {
      errors.id_item = 'EL ITEM NO CORRESPONDE AL ALMACEN SELECCIONADO.';
    }

    return {
      ok: Object.keys(errors).length === 0,
      errors,
      cleaned: {
        tipo,
        cantidad,
        id_almacen: idAlmacen,
        ...(itemTipo === 'producto' ? { id_producto: idItem } : { id_insumo: idItem }),
        ...(refOrigen ? { ref_origen: refOrigen } : {}),
        ...(descripcion ? { descripcion } : {})
      }
    };
  };

  const onCrear = async (event) => {
    event.preventDefault();
    const validated = validarMovimiento(form);
    setCreateErrors(validated.errors);
    if (!validated.ok) return;

    setSaving(true);
    setError('');

    try {
      await inventarioService.crearMovimientoInventario(validated.cleaned);
      await cargarKardex(kardexRequest);
      if (typeof onMovimientoCreado === 'function') await onMovimientoCreado(validated.cleaned);
      resetForm();
      setShowCreateModal(false);
      safeToast('CREADO', 'EL MOVIMIENTO SE REGISTRO CORRECTAMENTE.', 'success');
    } catch (requestError) {
      const message = requestError?.message || 'ERROR CREANDO MOVIMIENTO';
      setError(message);
      safeToast('ERROR', message, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const openFiltersModal = () => {
    const lockedWarehouseId =
      String(selectedAlmacenId ?? '').trim() && String(selectedAlmacenId ?? '').trim() !== 'todos'
        ? String(selectedAlmacenId).trim()
        : String(almacenFiltro ?? '').trim() && String(almacenFiltro ?? '').trim() !== 'todos'
        ? String(almacenFiltro).trim()
        : '';

    setFilterDraft({
      id_almacen: lockedWarehouseId,
      tipo: String(tipoFiltro ?? 'todos').trim() || 'todos',
      item_tipo: String(itemTipoFiltro ?? 'todos').trim() || 'todos',
      id_item: String(itemFiltroId ?? '').trim(),
      desde: String(desde ?? '').trim(),
      hasta: String(hasta ?? '').trim()
    });
    setShowFiltersModal(true);
  };

  const resetFilterDraft = () => {
    const lockedWarehouseId =
      String(selectedAlmacenId ?? '').trim() && String(selectedAlmacenId ?? '').trim() !== 'todos'
        ? String(selectedAlmacenId).trim()
        : lockedFilterWarehouse?.id_almacen
        ? String(lockedFilterWarehouse.id_almacen)
        : '';

    setFilterDraft({
      id_almacen: lockedWarehouseId,
      tipo: 'todos',
      item_tipo: 'todos',
      id_item: '',
      desde: '',
      hasta: ''
    });
  };

  const clearListadoFilters = () => {
    setSearch('');
    setTipoFiltro('todos');
    setItemTipoFiltro('todos');
    setItemFiltroId('');
    setDesde('');
    setHasta('');
    resetFilterDraft();
  };

  const applyFilterDraft = (event) => {
    event.preventDefault();

    setTipoFiltro(String(filterDraft.tipo ?? 'todos').trim() || 'todos');
    setItemTipoFiltro(String(filterDraft.item_tipo ?? 'todos').trim() || 'todos');
    setItemFiltroId(String(filterDraft.id_item ?? '').trim());
    setDesde(String(filterDraft.desde ?? '').trim());
    setHasta(String(filterDraft.hasta ?? '').trim());
    setShowFiltersModal(false);
  };

  const filtersModal =
    modalPortalTarget && showFiltersModal
      ? createPortal(
          <div className="inv-prod-pmodal inv-prod-pmodal--filters show" aria-hidden={!showFiltersModal}>
            <div className="inv-prod-pmodal__overlay" onClick={() => setShowFiltersModal(false)} />
            <div className="inv-prod-pmodal__viewport">
              <div
                className="inv-prod-pmodal__panel inv-prod-pmodal__panel--filters"
                role="dialog"
                aria-modal="true"
                aria-labelledby="inv-warehouse-moves-filters-title"
                onClick={(event) => event.stopPropagation()}
              >
                <form className="inv-prod-pmodal__form-shell" onSubmit={applyFilterDraft}>
                  <div className="inv-prod-pmodal__body inv-prod-pmodal__body--filters">
                    <div className="inv-ins-create-hero inv-ins-filter-hero">
                      <button
                        type="button"
                        className="inv-prod-drawer-close inv-ins-create-hero__close"
                        onClick={() => setShowFiltersModal(false)}
                        aria-label="Cerrar filtros de movimientos"
                      >
                        <i className="bi bi-x-lg" aria-hidden="true" />
                      </button>

                      <div className="inv-ins-create-hero__icon">
                        <i className="bi bi-funnel" aria-hidden="true" />
                      </div>

                      <div className="inv-ins-create-hero__copy">
                        <div className="inv-ins-create-hero__kicker">Vista De Filtros</div>
                        <div id="inv-warehouse-moves-filters-title" className="inv-ins-create-hero__title">
                          Ajusta el listado del kardex
                        </div>
                        <div className="inv-ins-create-hero__text">
                          El almacen se fija desde la card seleccionada y el resto del filtro se aplica al listado de
                          movimientos.
                        </div>
                      </div>
                    </div>

                    <div className="inv-prod-pmodal__sections inv-prod-pmodal__sections--filters">
                      <section className="inv-prod-pmodal__section">
                        <div className="inv-prod-pmodal__section-head">
                          <div className="inv-prod-pmodal__section-title">Filtros del listado</div>
                          <div className="inv-prod-pmodal__section-sub">
                            Usa el almacen activo, filtra por tipo, item, detalle y rango de fechas.
                          </div>
                        </div>

                        <div className="row g-3">
                          <div className="col-12">
                            <label className="form-label mb-1" htmlFor="inv-moves-filter-almacen">Almacen</label>
                            <select id="inv-moves-filter-almacen" className="form-select" value={filterDraft.id_almacen} disabled>
                              <option value={filterDraft.id_almacen || ''}>
                                {lockedFilterWarehouse
                                  ? formatAlmacenOptionLabel(lockedFilterWarehouse, sucursalesMap)
                                  : 'Selecciona una card de almacen'}
                              </option>
                            </select>
                          </div>

                          <div className="col-12 col-md-4">
                            <label className="form-label mb-1" htmlFor="inv-moves-filter-tipo">Tipo</label>
                            <select
                              id="inv-moves-filter-tipo"
                              className="form-select"
                              value={filterDraft.tipo}
                              onChange={(event) =>
                                setFilterDraft((current) => ({ ...current, tipo: event.target.value }))
                              }
                            >
                              <option value="todos">Todos</option>
                              <option value="ENTRADA">ENTRADA</option>
                              <option value="SALIDA">SALIDA</option>
                              <option value="AJUSTE">AJUSTE</option>
                            </select>
                          </div>

                          <div className="col-12 col-md-4">
                            <label className="form-label mb-1" htmlFor="inv-moves-filter-item-tipo">Item</label>
                            <select
                              id="inv-moves-filter-item-tipo"
                              className="form-select"
                              value={filterDraft.item_tipo}
                              onChange={(event) =>
                                setFilterDraft((current) => ({
                                  ...current,
                                  item_tipo: event.target.value,
                                  id_item: ''
                                }))
                              }
                            >
                              <option value="todos">Todos los items</option>
                              <option value="producto">Productos</option>
                              <option value="insumo">Insumos</option>
                            </select>
                          </div>

                          <div className="col-12 col-md-4">
                            <label className="form-label mb-1" htmlFor="inv-moves-filter-item-detalle">Detalle de item</label>
                            <select
                              id="inv-moves-filter-item-detalle"
                              className="form-select"
                              value={filterDraft.id_item}
                              onChange={(event) =>
                                setFilterDraft((current) => ({ ...current, id_item: event.target.value }))
                              }
                              disabled={filterDraft.item_tipo === 'todos'}
                            >
                              <option value="">
                                {filterDraft.item_tipo === 'todos'
                                  ? 'Seleccione primero un item'
                                  : filterDraft.item_tipo === 'producto'
                                  ? 'Todos los productos'
                                  : 'Todos los insumos'}
                              </option>
                              {filterDraftItemOptions.map((item) => (
                                <option
                                  key={getItemId(item, filterDraft.item_tipo)}
                                  value={getItemId(item, filterDraft.item_tipo)}
                                >
                                  {formatItemOptionLabel(
                                    item,
                                    filterDraft.item_tipo === 'producto' ? 'Producto' : 'Insumo'
                                  )}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="col-12 col-md-6">
                            <label className="form-label mb-1" htmlFor="inv-moves-filter-desde">Desde</label>
                            <input
                              id="inv-moves-filter-desde"
                              className="form-control"
                              type="date"
                              value={filterDraft.desde}
                              onChange={(event) =>
                                setFilterDraft((current) => ({ ...current, desde: event.target.value }))
                              }
                            />
                          </div>

                          <div className="col-12 col-md-6">
                            <label className="form-label mb-1" htmlFor="inv-moves-filter-hasta">Hasta</label>
                            <input
                              id="inv-moves-filter-hasta"
                              className="form-control"
                              type="date"
                              value={filterDraft.hasta}
                              onChange={(event) =>
                                setFilterDraft((current) => ({ ...current, hasta: event.target.value }))
                              }
                            />
                          </div>
                        </div>
                      </section>
                    </div>
                  </div>

                  <div className="inv-prod-pmodal__footer">
                    <button type="button" className="btn inv-prod-btn-subtle" onClick={resetFilterDraft}>
                      Limpiar
                    </button>
                    <button type="button" className="btn inv-prod-btn-outline" onClick={() => setShowFiltersModal(false)}>
                      Cancelar
                    </button>
                    <button type="submit" className="btn inv-prod-btn-primary">
                      Aplicar
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>,
          modalPortalTarget
        )
      : null;

  const createModal =
    modalPortalTarget && showCreateModal
      ? createPortal(
          <div className="inv-prod-pmodal inv-prod-pmodal--create show" aria-hidden={!showCreateModal}>
            <div className="inv-prod-pmodal__overlay" onClick={() => setShowCreateModal(false)} />
            <div className="inv-prod-pmodal__viewport">
              <div
                className="inv-prod-pmodal__panel inv-prod-pmodal__panel--create"
                role="dialog"
                aria-modal="true"
                aria-labelledby="inv-warehouse-move-create-title"
                onClick={(event) => event.stopPropagation()}
              >
                <form onSubmit={onCrear} className="inv-prod-pmodal__form-shell inv-prod-pmodal__form-shell--create">
                  <div className="inv-prod-pmodal__body">
                    <div className="inv-ins-create-hero is-create">
                      <button
                        type="button"
                        className="inv-prod-drawer-close inv-ins-create-hero__close"
                        onClick={() => setShowCreateModal(false)}
                        aria-label="Cerrar nuevo movimiento"
                        disabled={saving}
                      >
                        <i className="bi bi-x-lg" aria-hidden="true" />
                      </button>

                      <div className="inv-ins-create-hero__icon">
                        <i className="bi bi-plus-circle-dotted" aria-hidden="true" />
                      </div>

                      <div className="inv-ins-create-hero__copy">
                        <div className="inv-ins-create-hero__kicker">Nuevo Registro</div>
                        <div id="inv-warehouse-move-create-title" className="inv-ins-create-hero__title">
                          Alta rapida de movimiento
                        </div>
                        <div className="inv-ins-create-hero__text">
                          Registra entradas, salidas o ajustes usando el mismo endpoint actual del kardex.
                        </div>
                      </div>

                      <div className="inv-ins-create-hero__chips">
                        <span className="inv-ins-create-hero__chip">
                          <i className="bi bi-arrow-left-right" aria-hidden="true" /> {form.tipo}
                        </span>
                        <span className="inv-ins-create-hero__chip">
                          <i className="bi bi-box-seam" aria-hidden="true" /> {form.id_almacen || 'Sin almacen'}
                        </span>
                      </div>
                    </div>

                    <div className="inv-prod-pmodal__sections">
                      <section className="inv-prod-pmodal__section">
                        <div className="inv-prod-pmodal__section-head">
                          <div className="inv-prod-pmodal__section-title">Contexto</div>
                          <div className="inv-prod-pmodal__section-sub">Tipo de movimiento y almacen donde impactara el stock.</div>
                        </div>

                        <div className="row g-3">
                          <div className="col-12 col-md-4">
                            <label className="form-label mb-1" htmlFor="inv-moves-create-tipo">Tipo</label>
                            <select
                              id="inv-moves-create-tipo"
                              className={`form-select ${createErrors.tipo ? 'is-invalid' : ''}`}
                              value={form.tipo}
                              onChange={(event) => setForm((current) => ({ ...current, tipo: event.target.value }))}
                              disabled={saving}
                            >
                              <option value="ENTRADA">ENTRADA</option>
                              <option value="SALIDA">SALIDA</option>
                              <option value="AJUSTE">AJUSTE</option>
                            </select>
                            {createErrors.tipo ? <div className="invalid-feedback">{createErrors.tipo}</div> : null}
                          </div>

                          <div className="col-12 col-md-8">
                            <label className="form-label mb-1" htmlFor="inv-moves-create-almacen">Almacen</label>
                            <select
                              id="inv-moves-create-almacen"
                              className={`form-select ${createErrors.id_almacen ? 'is-invalid' : ''}`}
                              value={form.id_almacen}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  id_almacen: event.target.value,
                                  id_item: ''
                                }))
                              }
                              disabled={saving}
                            >
                              <option value="">{loadingRefs ? 'Cargando almacenes...' : 'Seleccione almacen'}</option>
                              {almacenes.map((almacen) => (
                                <option key={almacen.id_almacen} value={almacen.id_almacen}>
                                  {formatAlmacenOptionLabel(almacen, sucursalesMap)}
                                </option>
                              ))}
                            </select>
                            {createErrors.id_almacen ? <div className="invalid-feedback">{createErrors.id_almacen}</div> : null}
                          </div>
                        </div>
                      </section>

                      <section className="inv-prod-pmodal__section">
                        <div className="inv-prod-pmodal__section-head">
                          <div className="inv-prod-pmodal__section-title">Item y registro</div>
                          <div className="inv-prod-pmodal__section-sub">Selecciona el item, la cantidad y el contexto opcional del movimiento.</div>
                        </div>

                        <div className="row g-3">
                          <div className="col-12 col-md-4">
                            <label className="form-label mb-1" htmlFor="inv-moves-create-item-tipo">Tipo de item</label>
                            <select
                              id="inv-moves-create-item-tipo"
                              className={`form-select ${createErrors.item_tipo ? 'is-invalid' : ''}`}
                              value={form.item_tipo}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  item_tipo: event.target.value,
                                  id_item: ''
                                }))
                              }
                              disabled={saving}
                            >
                              <option value="producto">Producto</option>
                              <option value="insumo">Insumo</option>
                            </select>
                            {createErrors.item_tipo ? <div className="invalid-feedback">{createErrors.item_tipo}</div> : null}
                          </div>

                          <div className="col-12 col-md-8">
                            <label className="form-label mb-1" htmlFor="inv-moves-create-item">Item</label>
                            <select
                              id="inv-moves-create-item"
                              className={`form-select ${createErrors.id_item ? 'is-invalid' : ''}`}
                              value={form.id_item}
                              onChange={(event) => setForm((current) => ({ ...current, id_item: event.target.value }))}
                              disabled={loadingRefs || saving || !form.id_almacen}
                            >
                              <option value="">
                                {!form.id_almacen
                                  ? 'Seleccione primero un almacen'
                                  : loadingRefs
                                  ? 'Cargando items...'
                                  : form.item_tipo === 'producto'
                                  ? 'Seleccione producto'
                                  : 'Seleccione insumo'}
                              </option>
                              {formItemOptions.map((item) => (
                                <option key={getItemId(item, form.item_tipo)} value={getItemId(item, form.item_tipo)}>
                                  {formatItemOptionLabel(item, form.item_tipo === 'producto' ? 'Producto' : 'Insumo')}
                                </option>
                              ))}
                            </select>
                            {createErrors.id_item ? <div className="invalid-feedback">{createErrors.id_item}</div> : null}
                          </div>

                          <div className="col-12 col-md-4">
                            <label className="form-label mb-1" htmlFor="inv-moves-create-cantidad">Cantidad</label>
                            <input
                              id="inv-moves-create-cantidad"
                              className={`form-control ${createErrors.cantidad ? 'is-invalid' : ''}`}
                              type="number"
                              min={form.tipo === 'AJUSTE' ? '0' : '1'}
                              step="1"
                              inputMode="numeric"
                              value={form.cantidad}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  cantidad: String(event.target.value).replace(/[^\d]/g, '')
                                }))
                              }
                              disabled={saving}
                            />
                            {createErrors.cantidad ? <div className="invalid-feedback">{createErrors.cantidad}</div> : null}
                          </div>

                          <div className="col-12 col-md-8">
                            <label className="form-label mb-1" htmlFor="inv-moves-create-ref">Referencia</label>
                            <input
                              id="inv-moves-create-ref"
                              className="form-control"
                              value={form.ref_origen}
                              onChange={(event) => setForm((current) => ({ ...current, ref_origen: event.target.value }))}
                              placeholder="Ej: COMPRA, VENTA, AJUSTE MANUAL"
                              disabled={saving}
                            />
                          </div>

                          <div className="col-12">
                            <label className="form-label mb-1" htmlFor="inv-moves-create-observacion">Observacion</label>
                            <textarea
                              id="inv-moves-create-observacion"
                              className="form-control"
                              rows="3"
                              value={form.descripcion}
                              onChange={(event) => setForm((current) => ({ ...current, descripcion: event.target.value }))}
                              placeholder="Contexto adicional para el kardex"
                              disabled={saving}
                            />
                          </div>
                        </div>
                      </section>
                    </div>
                  </div>

                  <div className="inv-prod-pmodal__footer inv-prod-pmodal__footer--create">
                    <button type="button" className="btn inv-prod-btn-subtle" onClick={resetForm} disabled={saving}>
                      Limpiar
                    </button>
                    <button type="button" className="btn inv-prod-btn-outline" onClick={() => setShowCreateModal(false)} disabled={saving}>
                      Cancelar
                    </button>
                    <button type="submit" className="btn inv-prod-btn-primary" disabled={saving}>
                      {saving ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>,
          modalPortalTarget
        )
      : null;

  const rootClass = `inv-warehouse-moves ${embedded ? 'is-embedded' : ''}`;

  return (
    <>
      <section className={rootClass}>
        <div className="inv-warehouse-moves__header">
          <div className="inv-warehouse-moves__header-top">
            <div className="inv-warehouse-moves__title-wrap">
              <div className="inv-warehouse-moves__title-row">
                <i className="bi bi-arrow-left-right" aria-hidden="true" />
                <h3 className="inv-warehouse-moves__title">{`Movimientos: ${scopeLabel}`}</h3>
              </div>
            </div>

            <div className="inv-warehouse-moves__header-actions">
              <button type="button" className="inv-prod-toolbar-btn" onClick={openFiltersModal}>
                <i className="bi bi-funnel" aria-hidden="true" />
                <span>Filtros</span>
              </button>
              <button type="button" className="inv-prod-toolbar-btn" onClick={openCreateModal}>
                <i className="bi bi-plus-circle-dotted" aria-hidden="true" />
                <span>Nuevo movimiento</span>
              </button>
            </div>
          </div>

          <div className="inv-warehouse-moves__search-row">
            <label className="inv-ins-search inv-warehouse-moves__search" aria-label="Buscar movimientos">
              <i className="bi bi-search" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar item, referencia u observacion..."
              />
            </label>
            {hasActiveListadoFilters ? (
              <span className="inv-prod-active-filter-pill">
                <span>Filtros activos</span>
                <button
                  type="button"
                  className="inv-prod-active-filter-pill__clear"
                  onClick={clearListadoFilters}
                  aria-label="Limpiar filtros"
                  title="Limpiar filtros"
                >
                  <i className="bi bi-x-lg" aria-hidden="true" />
                </button>
              </span>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="alert alert-danger inv-warehouse-moves__alert">
            <i className="bi bi-exclamation-triangle-fill" aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="inv-warehouse-moves__table-shell">
          {loading ? (
            <div className="inv-warehouse-moves__empty">
              <i className="bi bi-arrow-repeat" aria-hidden="true" />
              <span>Cargando movimientos...</span>
            </div>
          ) : movimientos.length === 0 ? (
            <div className="inv-warehouse-moves__empty">
              <i className="bi bi-inbox" aria-hidden="true" />
              <span>No hay movimientos para los filtros aplicados.</span>
            </div>
          ) : (
            <>
              <div className="inv-warehouse-moves__table-responsive d-none d-lg-block">
                <table className="table inv-warehouse-moves__table align-middle mb-0">
                  <thead>
                    <tr>
                      <th className="inv-warehouse-moves__col-date inv-warehouse-moves__cell-center">Fecha / hora</th>
                      <th className="inv-warehouse-moves__col-type inv-warehouse-moves__cell-center">Tipo</th>
                      <th className="inv-warehouse-moves__col-item inv-warehouse-moves__cell-item">Item</th>
                      <th className="inv-warehouse-moves__col-qty inv-warehouse-moves__cell-center">Cantidad</th>
                      <th className="inv-warehouse-moves__col-stock inv-warehouse-moves__cell-center">Stock</th>
                      <th className="inv-warehouse-moves__col-ref inv-warehouse-moves__cell-center">Referencia</th>
                      <th className="inv-warehouse-moves__col-note inv-warehouse-moves__cell-note">Observacion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedMovimientos.map((movimiento) => (
                      <tr key={movimiento.id_movimiento} className="inv-warehouse-moves__row">
                        <td className="inv-warehouse-moves__cell-center">
                          <div className="inv-warehouse-moves__date">{formatKardexFecha(movimiento.fecha_mov)}</div>
                        </td>
                        <td className="inv-warehouse-moves__cell-center">
                          <span className={`inv-warehouse-type-pill ${getTipoBadgeClass(movimiento.tipo)}`}>
                            {String(movimiento.tipo ?? '-').toUpperCase()}
                          </span>
                        </td>
                        <td className="inv-warehouse-moves__cell-item">
                          <div className="inv-warehouse-moves__item-cell">
                            <div className="inv-warehouse-moves__item-main">{movimiento.item_nombre || '-'}</div>
                            <div className="inv-warehouse-moves__item-sub">
                              <span>{movimiento.item_tipo || '-'}</span>
                              {movimiento.es_legacy ? <span>Legacy</span> : null}
                            </div>
                          </div>
                        </td>
                        <td
                          className={`inv-warehouse-moves__qty inv-warehouse-moves__cell-center ${getTipoBadgeClass(
                            movimiento.tipo
                          )}`}
                        >
                          {formatCantidadLabel(movimiento)}
                        </td>
                        <td className="inv-warehouse-moves__cell-center">
                          <span className="inv-warehouse-moves__stock">{formatSaldoLabel(movimiento)}</span>
                        </td>
                        <td className="inv-warehouse-moves__cell-center">
                          <span className="inv-warehouse-moves__ref">{formatRefLabel(movimiento)}</span>
                        </td>
                        <td className="inv-warehouse-moves__cell-note">
                          <div className="inv-warehouse-moves__note-cell">
                            <div className="inv-warehouse-moves__note">
                              {String(movimiento.descripcion ?? '').trim() || 'Sin observacion'}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="inv-warehouse-moves__mobile-list d-lg-none">
                {paginatedMovimientos.map((movimiento) => (
                  <article key={movimiento.id_movimiento} className="inv-warehouse-moves__mobile-card">
                    <div className="inv-warehouse-moves__mobile-head">
                      <div>
                        <strong>{movimiento.item_nombre || '-'}</strong>
                        <span>{formatKardexFecha(movimiento.fecha_mov)}</span>
                      </div>
                      <span className={`inv-warehouse-type-pill ${getTipoBadgeClass(movimiento.tipo)}`}>
                        {String(movimiento.tipo ?? '-').toUpperCase()}
                      </span>
                    </div>
                    <div className="inv-warehouse-moves__mobile-grid">
                      <div>
                        <span>Item</span>
                        <strong>{movimiento.item_tipo || '-'}</strong>
                      </div>
                      <div>
                        <span>Cantidad</span>
                        <strong>{formatCantidadLabel(movimiento)}</strong>
                      </div>
                      <div>
                        <span>Stock</span>
                        <strong>{formatSaldoLabel(movimiento)}</strong>
                      </div>
                      <div>
                        <span>Referencia</span>
                        <strong>{formatRefLabel(movimiento)}</strong>
                      </div>
                    </div>
                    <p className="inv-warehouse-moves__mobile-note">
                      {String(movimiento.descripcion ?? '').trim() || 'Sin observacion'}
                    </p>
                  </article>
                ))}
              </div>

              <div className="inv-warehouse-moves__pagination inv-ins-pagination">
                <div className="inv-warehouse-moves__pagination-meta inv-ins-pagination__page">
                  {`Mostrando ${listPageWindow} de ${movimientos.length}`}
                </div>

                <div className="inv-warehouse-moves__pagination-controls">
                  <button
                    type="button"
                    className="inv-prod-toolbar-btn inv-warehouse-moves__page-btn"
                    onClick={() => setListPage((current) => Math.max(1, current - 1))}
                    disabled={listPage === 1}
                    aria-label="Pagina anterior"
                  >
                    <i className="bi bi-chevron-left" aria-hidden="true" />
                    <span>Anterior</span>
                  </button>

                  <div className="inv-warehouse-moves__pagination-pages">
                    {visiblePageNumbers.map((pageNumber) => (
                      <button
                        key={pageNumber}
                        type="button"
                        className={`inv-warehouse-moves__page-number ${pageNumber === listPage ? 'is-active' : ''}`.trim()}
                        onClick={() => setListPage(pageNumber)}
                        aria-label={`Ir a la pagina ${pageNumber}`}
                        aria-current={pageNumber === listPage ? 'page' : undefined}
                      >
                        {pageNumber}
                      </button>
                    ))}
                  </div>

                  <div className="inv-warehouse-moves__pagination-status inv-ins-pagination__page">
                    {`Pagina ${listPage} de ${listTotalPages}`}
                  </div>

                  <button
                    type="button"
                    className="inv-prod-toolbar-btn inv-warehouse-moves__page-btn"
                    onClick={() => setListPage((current) => Math.min(listTotalPages, current + 1))}
                    disabled={listPage === listTotalPages}
                    aria-label="Pagina siguiente"
                  >
                    <span>Siguiente</span>
                    <i className="bi bi-chevron-right" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {filtersModal}
      {createModal}
    </>
  );
};

export default MovimientosTab;
