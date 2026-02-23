import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { inventarioService } from '../../../services/inventarioService';

const DEFAULT_FILTERS = Object.freeze({ estados: [], almacen: 'todos', categoria: 'todos', sortBy: 'recientes' });
const STATUS_CHIPS = [
  { key: 'existencia', label: 'En existencia' },
  { key: 'bajo', label: 'Stock bajo' },
  { key: 'sin_stock', label: 'Sin stock' },
  { key: 'inactivo', label: 'Inactivo' }
];
const SORTS = [
  ['recientes', 'Mas recientes'],
  ['nombre_asc', 'Nombre A-Z'],
  ['nombre_desc', 'Nombre Z-A'],
  ['precio_desc', 'Precio mayor'],
  ['precio_asc', 'Precio menor'],
  ['stock_desc', 'Stock mayor'],
  ['stock_asc', 'Stock menor'],
  ['cad_asc', 'Caducidad proxima']
];

const emptyForm = () => ({
  nombre_insumo: '',
  precio: '',
  cantidad: '',
  stock_minimo: '0',
  fecha_ingreso_insumo: '',
  id_almacen: '',
  fecha_caducidad: '',
  descripcion: ''
});

const cloneFilters = (f) => ({ ...DEFAULT_FILTERS, ...(f || {}), estados: Array.isArray(f?.estados) ? [...f.estados] : [] });
const toDateInputValue = (v) => (!v ? '' : String(v).includes('T') ? String(v).split('T')[0] : String(v));
const parseIntSafe = (v, fb = 0) => { const n = Number.parseInt(String(v ?? ''), 10); return Number.isNaN(n) ? fb : n; };
const parseFloatSafe = (v, fb = 0) => { const n = Number.parseFloat(String(v ?? '')); return Number.isNaN(n) ? fb : n; };
const fmtMoney = (v) => `L. ${parseFloatSafe(v, 0).toFixed(2)}`;
const normalize = (v) => String(v ?? '').trim().toLowerCase();
const sanitizeSpaces = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? ''));

const dateLabel = (v) => {
  const d = toDateInputValue(v);
  if (!d) return 'Sin caducidad';
  if (!isDate(d)) return d;
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

const boolish = (v) => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  const s = normalize(v);
  if (!s) return null;
  if (['1', 'true', 'activo', 'active', 'si', 'yes'].includes(s)) return true;
  if (['0', 'false', 'inactivo', 'inactive', 'no'].includes(s)) return false;
  return null;
};

// NEW: helper visual para mini-grafica tipo Productos en stat cards de Inventario.
// WHY: reutilizar el mismo estilo de sparkline en dashboards de Insumos sin dependencias nuevas.
// IMPACT: solo afecta la presentacion del dashboard; no modifica datos ni filtros.
const buildInventorySparkPoints = (series, width = 120, height = 44, padding = 4) => {
  if (!Array.isArray(series) || series.length < 2) return '';
  const values = series.map((value) => Number(value ?? 0));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const safeWidth = Math.max(width - padding * 2, 1);
  const safeHeight = Math.max(height - padding * 2, 1);

  return values
    .map((value, index) => {
      const x = padding + (safeWidth * index) / (values.length - 1);
      const y = padding + safeHeight - ((value - min) / range) * safeHeight;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
};

const getStatusUi = (activo, cantidad, stockMin) => {
  if (!activo) {
    return { key: 'inactivo', badge: 'INACTIVO', badgeClass: 'is-inactive', cardClass: 'is-inactive', primary: 'Ajustar stock', primaryBtn: 'inv-prod-btn-subtle' };
  }
  if (cantidad <= 0) {
    return { key: 'sin_stock', badge: 'SIN STOCK', badgeClass: 'is-out', cardClass: 'is-out', primary: 'Reabastecer', primaryBtn: 'inv-prod-btn-primary' };
  }
  if (cantidad <= stockMin) {
    return { key: 'bajo', badge: 'STOCK BAJO', badgeClass: 'is-low', cardClass: 'is-low', primary: 'Ajustar stock', primaryBtn: 'inv-prod-btn-outline' };
  }
  return { key: 'existencia', badge: 'EN EXISTENCIA', badgeClass: 'is-ok', cardClass: 'is-ok', primary: 'Ajustar stock', primaryBtn: 'inv-prod-btn-outline' };
};

const InsumosTab = ({ openToast, categorias = [] }) => {
  const safeToast = useCallback((title, message, variant = 'success') => {
    if (typeof openToast === 'function') openToast(title, message, variant);
  }, [openToast]);

  const [insumos, setInsumos] = useState([]);
  const [almacenes, setAlmacenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingAlmacenes, setLoadingAlmacenes] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [appliedFilters, setAppliedFilters] = useState(() => cloneFilters(DEFAULT_FILTERS));
  const [draftFilters, setDraftFilters] = useState(() => cloneFilters(DEFAULT_FILTERS));

  const [drawer, setDrawer] = useState(null); // null | filters | form
  const [drawerMode, setDrawerMode] = useState('create'); // create | edit
  const [selectedId, setSelectedId] = useState(null);
  const [drawerMsg, setDrawerMsg] = useState('');
  const [focusCantidad, setFocusCantidad] = useState(false);

  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [createErrors, setCreateErrors] = useState({});
  const [editErrors, setEditErrors] = useState({});
  const [creating, setCreating] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [togglingEstado, setTogglingEstado] = useState(false);
  const [localEstadoMap, setLocalEstadoMap] = useState({});

  const [confirmModal, setConfirmModal] = useState({ show: false, idToDelete: null, nombre: '' });
  const [deleting, setDeleting] = useState(false);

  const frequentRef = useRef(null);
  const allRef = useRef(null);
  const cantidadInputRef = useRef(null);
  const nombreInputRef = useRef(null);
  const [freqNav, setFreqNav] = useState({ canPrev: false, canNext: false });
  const [allNav, setAllNav] = useState({ canPrev: false, canNext: false });

  const categoriasMap = useMemo(() => {
    const m = new Map();
    for (const c of Array.isArray(categorias) ? categorias : []) m.set(String(c?.id_categoria_producto), c);
    return m;
  }, [categorias]);

  // NEW: categorias activas para selects/filtros que dependen del catalogo compartido.
  // WHY: ocultar categorias inactivas en otros submodulos sin afectar labels historicos.
  // IMPACT: `categoriasMap` conserva todas para mostrar etiquetas; los selects usan solo activas.
  const categoriasActivas = useMemo(() => {
    const isActive = (categoria) => {
      const parsed = boolish(categoria?.estado);
      if (parsed === null) return categoria?.estado === undefined || categoria?.estado === null || categoria?.estado === '';
      return parsed;
    };
    return (Array.isArray(categorias) ? categorias : []).filter(isActive);
  }, [categorias]);

  const almacenesMap = useMemo(() => {
    const m = new Map();
    for (const a of almacenes) m.set(String(a?.id_almacen), a);
    return m;
  }, [almacenes]);

  const getAlmacenLabel = useCallback((id) => {
    const a = almacenesMap.get(String(id));
    return a ? `${a.nombre} (Sucursal ${a.id_sucursal})` : `Almacen ID #${String(id || '-')}`;
  }, [almacenesMap]);

  const estadoField = useMemo(() => {
    if (!insumos.length) return null;
    if (insumos.some((i) => Object.prototype.hasOwnProperty.call(i || {}, 'estado'))) return 'estado';
    if (insumos.some((i) => Object.prototype.hasOwnProperty.call(i || {}, 'activo'))) return 'activo';
    return null;
  }, [insumos]);

  const categoriaField = useMemo(() => {
    if (!insumos.length) return null;
    if (insumos.some((i) => Object.prototype.hasOwnProperty.call(i || {}, 'id_categoria_insumo'))) return 'id_categoria_insumo';
    if (insumos.some((i) => Object.prototype.hasOwnProperty.call(i || {}, 'id_categoria'))) return 'id_categoria';
    if (insumos.some((i) => Object.prototype.hasOwnProperty.call(i || {}, 'id_categoria_producto'))) return 'id_categoria_producto';
    return null;
  }, [insumos]);

  const categoriaLabelField = useMemo(() => {
    if (!insumos.length) return null;
    if (insumos.some((i) => Object.prototype.hasOwnProperty.call(i || {}, 'nombre_categoria'))) return 'nombre_categoria';
    if (insumos.some((i) => Object.prototype.hasOwnProperty.call(i || {}, 'categoria'))) return 'categoria';
    return null;
  }, [insumos]);

  const frequentMetricField = useMemo(() => {
    if (insumos.some((i) => Object.prototype.hasOwnProperty.call(i || {}, 'veces_comprado'))) return 'veces_comprado';
    if (insumos.some((i) => Object.prototype.hasOwnProperty.call(i || {}, 'total_compras'))) return 'total_compras';
    if (insumos.some((i) => Object.prototype.hasOwnProperty.call(i || {}, 'movimientos_count'))) return 'movimientos_count';
    return null;
  }, [insumos]);

  const resolveActivo = useCallback((insumo) => {
    if (!insumo) return true;
    if (typeof localEstadoMap[insumo?.id_insumo] === 'boolean') return localEstadoMap[insumo.id_insumo];
    if (!estadoField) return true;
    const parsed = boolish(insumo?.[estadoField]);
    return parsed === null ? Boolean(insumo?.[estadoField]) : parsed;
  }, [estadoField, localEstadoMap]);

  const getCategoriaValue = useCallback((insumo) => (!categoriaField || !insumo ? '' : String(insumo?.[categoriaField] ?? '')), [categoriaField]);

  const getCategoriaLabel = useCallback((insumo) => {
    if (!insumo) return '';
    if (categoriaLabelField) {
      const raw = String(insumo?.[categoriaLabelField] ?? '').trim();
      if (raw) return raw;
    }
    if (!categoriaField) return '';
    const id = insumo?.[categoriaField];
    if (categoriaField === 'id_categoria_producto') {
      const c = categoriasMap.get(String(id));
      if (c?.nombre_categoria) return String(c.nombre_categoria);
    }
    return id !== undefined && id !== null && String(id).trim() !== '' ? `Categoria #${id}` : '';
  }, [categoriaField, categoriaLabelField, categoriasMap]);

  const snapshot = useCallback((insumo) => {
    const cantidad = Math.max(0, parseIntSafe(insumo?.cantidad, 0));
    const stockMin = Math.max(0, parseIntSafe(insumo?.stock_minimo, 0));
    const activo = resolveActivo(insumo);
    return { cantidad, stockMin, activo, ui: getStatusUi(activo, cantidad, stockMin) };
  }, [resolveActivo]);

  // NEW: validacion centralizada para create/edit con reglas consistentes.
  // WHY: evitar diferencias entre alta y edicion y bloquear submit invalido.
  // IMPACT: no cambia endpoints; solo mejora UX y consistencia del frontend.
  const validarInsumo = useCallback((data) => {
    const errors = {};
    const nombre = sanitizeSpaces(data?.nombre_insumo);
    const descripcion = sanitizeSpaces(data?.descripcion);
    const precioRaw = String(data?.precio ?? '').trim();
    const cantidadRaw = String(data?.cantidad ?? '').trim();
    const stockRaw = String(data?.stock_minimo ?? '').trim();
    const almacenRaw = String(data?.id_almacen ?? '').trim();
    const ingreso = String(data?.fecha_ingreso_insumo ?? '').trim();
    const cad = String(data?.fecha_caducidad ?? '').trim();
    const precio = Number.parseFloat(precioRaw);
    const cantidad = Number.parseInt(cantidadRaw, 10);
    const stock_minimo = Number.parseInt(stockRaw, 10);
    const id_almacen = Number.parseInt(almacenRaw, 10);

    if (nombre.length < 2) errors.nombre_insumo = 'MINIMO 2 CARACTERES';
    else if (nombre.length > 80) errors.nombre_insumo = 'MAXIMO 80 CARACTERES';
    if (!precioRaw) errors.precio = 'EL PRECIO ES OBLIGATORIO';
    else if (Number.isNaN(precio) || precio < 0) errors.precio = 'DEBE SER UN NUMERO >= 0';
    if (!cantidadRaw) errors.cantidad = 'LA CANTIDAD ES OBLIGATORIA';
    else if (!/^\d+$/.test(cantidadRaw)) errors.cantidad = 'SOLO ENTEROS (SIN DECIMALES)';
    else if (Number.isNaN(cantidad) || cantidad < 0) errors.cantidad = 'DEBE SER UN ENTERO >= 0';
    if (!stockRaw) errors.stock_minimo = 'EL STOCK MINIMO ES OBLIGATORIO';
    else if (!/^\d+$/.test(stockRaw)) errors.stock_minimo = 'SOLO ENTEROS (SIN DECIMALES)';
    else if (Number.isNaN(stock_minimo) || stock_minimo < 0) errors.stock_minimo = 'DEBE SER UN ENTERO >= 0';
    if (!almacenRaw) errors.id_almacen = 'EL ALMACEN ES OBLIGATORIO';
    else if (Number.isNaN(id_almacen) || id_almacen <= 0) errors.id_almacen = 'DEBE SER UN NUMERO > 0';
    if (descripcion.length > 150) errors.descripcion = 'MAXIMO 150 CARACTERES';
    if (ingreso && !isDate(ingreso)) errors.fecha_ingreso_insumo = 'FORMATO INVALIDO (YYYY-MM-DD)';
    if (cad && !isDate(cad)) errors.fecha_caducidad = 'FORMATO INVALIDO (YYYY-MM-DD)';
    if (!errors.fecha_ingreso_insumo && ingreso) {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      if (ingreso > today) errors.fecha_ingreso_insumo = 'NO PUEDE SER FECHA FUTURA';
    }
    if (!errors.fecha_ingreso_insumo && !errors.fecha_caducidad && ingreso && cad && cad < ingreso) {
      errors.fecha_caducidad = 'DEBE SER >= FECHA DE INGRESO';
    }
    // NEW: no se fuerza stock_minimo <= cantidad.
    // WHY: un stock minimo mayor a la existencia actual representa un faltante valido.
    // IMPACT: se permiten escenarios reales de reposicion sin romper compatibilidad.
    return { ok: Object.keys(errors).length === 0, errors, cleaned: { nombre_insumo: nombre, precio, cantidad, stock_minimo, id_almacen, fecha_ingreso_insumo: ingreso, fecha_caducidad: cad, descripcion } };
  }, []);

  const buildPayload = useCallback((c) => {
    const payload = { nombre_insumo: c.nombre_insumo, precio: c.precio, cantidad: c.cantidad, stock_minimo: c.stock_minimo, id_almacen: c.id_almacen };
    if (c.descripcion) payload.descripcion = c.descripcion;
    if (c.fecha_ingreso_insumo) payload.fecha_ingreso_insumo = c.fecha_ingreso_insumo;
    if (c.fecha_caducidad) payload.fecha_caducidad = c.fecha_caducidad;
    return payload;
  }, []);

  const apiError = useCallback((e, fallback, setFieldErrors) => {
    const data = e?.data;
    const msg = String((data && typeof data === 'object' && (data.message || data.mensaje)) || e?.message || fallback || 'ERROR');
    if (typeof setFieldErrors === 'function' && data?.errors && typeof data.errors === 'object') {
      const mapped = {};
      for (const [k, v] of Object.entries(data.errors)) mapped[k] = String(Array.isArray(v) ? v[0] : v || '').toUpperCase();
      setFieldErrors((prev) => ({ ...prev, ...mapped }));
    }
    const s = Number(e?.status || 0);
    safeToast(s === 401 ? 'SESION EXPIRADA' : s === 403 ? 'SIN PERMISOS' : s === 400 ? 'VALIDACION' : 'ERROR', msg, s >= 500 ? 'danger' : (s === 400 || s === 401 || s === 403 ? 'warning' : 'danger'));
    return msg;
  }, [safeToast]);

  const cargarInsumos = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await inventarioService.getInsumos();
      setInsumos(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(apiError(e, 'ERROR CARGANDO INSUMOS'));
    } finally {
      setLoading(false);
    }
  }, [apiError]);

  const cargarAlmacenes = useCallback(async () => {
    setLoadingAlmacenes(true);
    try {
      const data = await inventarioService.getAlmacenes();
      setAlmacenes(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(apiError(e, 'ERROR CARGANDO ALMACENES'));
    } finally {
      setLoadingAlmacenes(false);
    }
  }, [apiError]);

  useEffect(() => {
    cargarInsumos();
    cargarAlmacenes();
  }, [cargarAlmacenes, cargarInsumos]);

  const selectedInsumo = useMemo(() => insumos.find((i) => Number(i?.id_insumo) === Number(selectedId)) || null, [insumos, selectedId]);

  const resetCreate = useCallback(() => {
    setForm(emptyForm());
    setCreateErrors({});
  }, []);

  const startEdit = useCallback((i) => {
    if (!i) return;
    setEditId(i.id_insumo);
    setEditErrors({});
    setEditForm({
      nombre_insumo: String(i?.nombre_insumo ?? ''),
      precio: String(i?.precio ?? ''),
      cantidad: String(i?.cantidad ?? ''),
      stock_minimo: String(i?.stock_minimo ?? '0'),
      fecha_ingreso_insumo: toDateInputValue(i?.fecha_ingreso_insumo),
      id_almacen: String(i?.id_almacen ?? ''),
      fecha_caducidad: toDateInputValue(i?.fecha_caducidad),
      descripcion: String(i?.descripcion ?? '')
    });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditId(null);
    setEditForm(null);
    setEditErrors({});
  }, []);

  const openFilters = useCallback(() => {
    // NEW: drawer de filtros con estado draft para aplicar/limpiar sin re-filtrar en cada clic.
    // WHY: replica el patrón UX lateral de Productos.
    // IMPACT: filtrado sigue siendo local; no toca integración backend.
    setDraftFilters(cloneFilters(appliedFilters));
    setDrawerMsg('');
    setDrawer('filters');
  }, [appliedFilters]);

  const openCreate = useCallback(() => {
    resetCreate();
    cancelEdit();
    setDrawerMode('create');
    setDrawer('form');
    setSelectedId(null);
    setDrawerMsg('');
    setFocusCantidad(false);
  }, [cancelEdit, resetCreate]);

  const openEdit = useCallback((i, opts = {}) => {
    if (!i) return;
    startEdit(i);
    setSelectedId(i.id_insumo);
    setDrawerMode('edit');
    setDrawer('form');
    setDrawerMsg('');
    setFocusCantidad(Boolean(opts.focusCantidad));
  }, [startEdit]);

  const closeDrawer = useCallback(() => {
    setDrawer(null);
    setDrawerMsg('');
    setFocusCantidad(false);
  }, []);

  useEffect(() => {
    if (drawer !== 'form' || typeof window === 'undefined') return;
    const node = focusCantidad ? cantidadInputRef.current : nombreInputRef.current;
    if (!node) return;
    const raf = window.requestAnimationFrame(() => {
      node.focus();
      if (focusCantidad && typeof node.select === 'function') node.select();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [drawer, drawerMode, focusCantidad]);

  useEffect(() => {
    if (drawer == null || typeof document === 'undefined') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [drawer]);

  const setField = useCallback((field, value) => {
    setDrawerMsg('');
    if (drawerMode === 'create') {
      setForm((s) => ({ ...s, [field]: value }));
      setCreateErrors((s) => (s[field] ? { ...s, [field]: '' } : s));
      return;
    }
    setEditForm((s) => ({ ...(s || emptyForm()), [field]: value }));
    setEditErrors((s) => (s[field] ? { ...s, [field]: '' } : s));
  }, [drawerMode]);

  const saveCreate = useCallback(async () => {
    const v = validarInsumo(form);
    setCreateErrors(v.errors);
    if (!v.ok) return;
    setCreating(true);
    setError('');
    try {
      await inventarioService.crearInsumo(buildPayload(v.cleaned));
      await cargarInsumos();
      resetCreate();
      closeDrawer();
      safeToast('CREADO', 'EL INSUMO SE CREO CORRECTAMENTE.', 'success');
    } catch (e) {
      const msg = apiError(e, 'ERROR CREANDO INSUMO', setCreateErrors);
      setError(msg);
      setDrawerMsg(msg);
    } finally {
      setCreating(false);
    }
  }, [apiError, buildPayload, cargarInsumos, closeDrawer, form, resetCreate, safeToast, validarInsumo]);

  const saveEdit = useCallback(async () => {
    if (!editId || !editForm || savingEdit) return;
    const v = validarInsumo(editForm);
    setEditErrors(v.errors);
    if (!v.ok) return;
    setSavingEdit(true);
    setError('');
    try {
      const actual = insumos.find((x) => Number(x?.id_insumo) === Number(editId));
      if (!actual) throw new Error('INSUMO NO ENCONTRADO');
      const c = v.cleaned;
      const changes = [];
      if (c.nombre_insumo !== sanitizeSpaces(actual?.nombre_insumo)) changes.push(['nombre_insumo', c.nombre_insumo]);
      if (c.precio !== parseFloatSafe(actual?.precio, 0)) changes.push(['precio', c.precio]);
      if (c.cantidad !== parseIntSafe(actual?.cantidad, 0)) changes.push(['cantidad', c.cantidad]);
      if (c.stock_minimo !== parseIntSafe(actual?.stock_minimo, 0)) changes.push(['stock_minimo', c.stock_minimo]);
      if (c.id_almacen !== parseIntSafe(actual?.id_almacen, 0)) changes.push(['id_almacen', c.id_almacen]);
      if (c.descripcion !== sanitizeSpaces(actual?.descripcion)) changes.push(['descripcion', c.descripcion]);
      // NEW: se mantiene compatibilidad evitando enviar fechas vacías al update por campo.
      // WHY: algunos backends/SP del proyecto no aceptan null/vacío en fecha.
      // IMPACT: editar fechas funciona; limpiar fecha queda pendiente de soporte backend.
      if (c.fecha_ingreso_insumo && c.fecha_ingreso_insumo !== toDateInputValue(actual?.fecha_ingreso_insumo)) changes.push(['fecha_ingreso_insumo', c.fecha_ingreso_insumo]);
      if (c.fecha_caducidad && c.fecha_caducidad !== toDateInputValue(actual?.fecha_caducidad)) changes.push(['fecha_caducidad', c.fecha_caducidad]);
      if (!changes.length) {
        setDrawerMsg('NO HAY CAMBIOS PARA GUARDAR.');
        safeToast('SIN CAMBIOS', 'NO HAY CAMBIOS PARA GUARDAR.', 'info');
        return;
      }
      for (const [campo, valor] of changes) await inventarioService.actualizarInsumoCampo(editId, campo, valor);
      await cargarInsumos();
      setDrawerMsg('CAMBIOS GUARDADOS.');
      safeToast('ACTUALIZADO', 'EL INSUMO SE ACTUALIZO CORRECTAMENTE.', 'success');
    } catch (e) {
      const msg = apiError(e, 'ERROR ACTUALIZANDO INSUMO', setEditErrors);
      setError(msg);
      setDrawerMsg(msg);
    } finally {
      setSavingEdit(false);
    }
  }, [apiError, cargarInsumos, editForm, editId, insumos, safeToast, savingEdit, validarInsumo]);

  const setConfirm = useCallback((id, nombre) => setConfirmModal({ show: true, idToDelete: id, nombre: nombre || '' }), []);
  const closeConfirm = useCallback(() => { setConfirmModal({ show: false, idToDelete: null, nombre: '' }); setDeleting(false); }, []);

  const deleteConfirmed = useCallback(async () => {
    if (!confirmModal.idToDelete || deleting) return;
    setDeleting(true);
    setError('');
    try {
      await inventarioService.eliminarInsumo(confirmModal.idToDelete);
      if (Number(selectedId) === Number(confirmModal.idToDelete)) { closeDrawer(); cancelEdit(); }
      closeConfirm();
      await cargarInsumos();
      safeToast('ELIMINADO', 'EL INSUMO SE ELIMINO CORRECTAMENTE.', 'success');
    } catch (e) {
      setError(apiError(e, 'ERROR ELIMINANDO INSUMO'));
      closeConfirm();
    } finally {
      setDeleting(false);
    }
  }, [apiError, cancelEdit, cargarInsumos, closeConfirm, closeDrawer, confirmModal.idToDelete, deleting, safeToast, selectedId]);

  const toggleEstado = useCallback(async (insumo, nextActive) => {
    if (!estadoField || !insumo || togglingEstado) return;
    setTogglingEstado(true);
    setLocalEstadoMap((s) => ({ ...s, [insumo.id_insumo]: nextActive }));
    setDrawerMsg(nextActive ? 'ACTIVANDO INSUMO...' : 'INACTIVANDO INSUMO...');
    try {
      let done = false;
      let lastStateError = null;
      for (const candidate of (nextActive ? [1, '1', true] : [0, '0', false])) {
        try {
          await inventarioService.actualizarInsumoCampo(insumo.id_insumo, estadoField, candidate);
          done = true;
          break;
        } catch (err) {
          lastStateError = err;
        }
      }
      if (!done) throw (lastStateError || new Error('NO SE PUDO ACTUALIZAR EL ESTADO'));
      setInsumos((prev) => prev.map((it) => (Number(it?.id_insumo) === Number(insumo.id_insumo) ? { ...it, [estadoField]: nextActive } : it)));
      setLocalEstadoMap((s) => { const n = { ...s }; delete n[insumo.id_insumo]; return n; });
      setDrawerMsg(nextActive ? 'INSUMO ACTIVADO.' : 'INSUMO INACTIVADO.');
      safeToast('EXITO', nextActive ? 'INSUMO ACTIVADO.' : 'INSUMO INACTIVADO.', 'success');
    } catch (e) {
      setLocalEstadoMap((s) => { const n = { ...s }; delete n[insumo.id_insumo]; return n; });
      const msg = apiError(e, 'NO SE PUDO ACTUALIZAR EL ESTADO');
      setError(msg);
      setDrawerMsg(msg);
    } finally {
      setTogglingEstado(false);
    }
  }, [apiError, estadoField, safeToast, togglingEstado]);

  const clearFilters = useCallback(() => {
    setSearch('');
    const clean = cloneFilters(DEFAULT_FILTERS);
    setAppliedFilters(clean);
    setDraftFilters(clean);
  }, []);

  const applyFilters = useCallback(() => { setAppliedFilters(cloneFilters(draftFilters)); closeDrawer(); }, [draftFilters, closeDrawer]);

  const categoriaOptions = useMemo(() => {
    if (!categoriaField && !categoriaLabelField) return [];
    if (categoriaField === 'id_categoria_producto' && categorias.length) {
      return categoriasActivas
        .map((c) => ({ value: String(c?.id_categoria_producto), label: String(c?.nombre_categoria || c?.id_categoria_producto) }))
        .filter((x) => x.value);
    }
    const map = new Map();
    for (const i of insumos) {
      const val = getCategoriaValue(i);
      if (!val) continue;
      const label = getCategoriaLabel(i) || val;
      if (!map.has(val)) map.set(val, label);
    }
    return [...map.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));
  }, [categoriaField, categoriaLabelField, categorias, categoriasActivas, getCategoriaLabel, getCategoriaValue, insumos]);

  const filtered = useMemo(() => {
    const s = normalize(search);
    const statusSet = new Set(appliedFilters.estados);
    const list = [...insumos].filter((i) => {
      const st = snapshot(i).ui.key;
      if (statusSet.size && !statusSet.has(st)) return false;
      if (appliedFilters.almacen !== 'todos' && String(i?.id_almacen ?? '') !== String(appliedFilters.almacen)) return false;
      if (appliedFilters.categoria !== 'todos' && String(getCategoriaValue(i) || '') !== String(appliedFilters.categoria)) return false;
      if (!s) return true;
      const text = `${i?.nombre_insumo ?? ''} ${i?.descripcion ?? ''} ${getAlmacenLabel(i?.id_almacen)} ${getCategoriaLabel(i)} ${i?.id_insumo ?? ''}`.toLowerCase();
      return text.includes(s);
    });
    list.sort((a, b) => {
      const k = appliedFilters.sortBy || 'recientes';
      if (k === 'nombre_asc') return String(a?.nombre_insumo ?? '').localeCompare(String(b?.nombre_insumo ?? ''), 'es', { sensitivity: 'base' });
      if (k === 'nombre_desc') return String(b?.nombre_insumo ?? '').localeCompare(String(a?.nombre_insumo ?? ''), 'es', { sensitivity: 'base' });
      if (k === 'precio_desc') return parseFloatSafe(b?.precio, 0) - parseFloatSafe(a?.precio, 0);
      if (k === 'precio_asc') return parseFloatSafe(a?.precio, 0) - parseFloatSafe(b?.precio, 0);
      if (k === 'stock_desc') return parseIntSafe(b?.cantidad, 0) - parseIntSafe(a?.cantidad, 0);
      if (k === 'stock_asc') return parseIntSafe(a?.cantidad, 0) - parseIntSafe(b?.cantidad, 0);
      if (k === 'cad_asc') {
        const ca = toDateInputValue(a?.fecha_caducidad) || '9999-12-31';
        const cb = toDateInputValue(b?.fecha_caducidad) || '9999-12-31';
        if (ca !== cb) return ca.localeCompare(cb);
      }
      return Number(b?.id_insumo ?? 0) - Number(a?.id_insumo ?? 0);
    });
    return list;
  }, [appliedFilters, getAlmacenLabel, getCategoriaLabel, getCategoriaValue, insumos, search, snapshot]);

  const frecuentes = useMemo(() => {
    const list = [...filtered];
    if (frequentMetricField) {
      list.sort((a, b) => parseFloatSafe(b?.[frequentMetricField], 0) - parseFloatSafe(a?.[frequentMetricField], 0) || Number(b?.id_insumo ?? 0) - Number(a?.id_insumo ?? 0));
    } else {
      // NEW: fallback seguro si no existe métrica real de "mas comprados".
      // WHY: el carrusel debe funcionar hoy sin inventar datos.
      // IMPACT: listo para reemplazar cuando el backend exponga la métrica.
      // TODO: replace with most-purchased metric when available
      list.sort((a, b) => (toDateInputValue(b?.fecha_ingreso_insumo) || '0000-00-00').localeCompare(toDateInputValue(a?.fecha_ingreso_insumo) || '0000-00-00') || parseIntSafe(b?.cantidad, 0) - parseIntSafe(a?.cantidad, 0));
    }
    return list.slice(0, 10);
  }, [filtered, frequentMetricField]);

  const kpis = useMemo(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const lim = new Date(now); lim.setDate(lim.getDate() + 30);
    const limit = `${lim.getFullYear()}-${String(lim.getMonth() + 1).padStart(2, '0')}-${String(lim.getDate()).padStart(2, '0')}`;
    let existencia = 0, bajo = 0, sin_stock = 0, inactivo = 0, cad = 0;
    for (const i of insumos) {
      const st = snapshot(i).ui.key;
      if (st === 'existencia') existencia++;
      else if (st === 'bajo') bajo++;
      else if (st === 'sin_stock') sin_stock++;
      else if (st === 'inactivo') inactivo++;
      const fc = toDateInputValue(i?.fecha_caducidad);
      if (fc && fc >= today && fc <= limit) cad++;
    }
    return { total: insumos.length, existencia, bajo, sin_stock, inactivo, cad };
  }, [insumos, snapshot]);

  // NEW: series decorativas derivadas de KPIs para renderizar sparklines tipo Productos.
  // WHY: unificar visualmente los dashboards sin persistencia historica adicional.
  // IMPACT: no altera conteos; solo agrega linea SVG sutil en cada tarjeta.
  const insumosKpiSeries = useMemo(() => {
    const makeSeries = (value, neighbor = 0) => {
      const v = Math.max(0, Number(value ?? 0));
      const n = Math.max(0, Number(neighbor ?? 0));
      const delta = Math.max(1, Math.round(Math.max(v, n) * 0.1));
      return [
        Math.max(0, v - delta),
        Math.max(0, Math.round((v + n) / 2)),
        v,
        Math.max(0, v - Math.round(delta / 2)),
        v
      ];
    };
    return {
      total: makeSeries(kpis.total, kpis.existencia),
      existencia: makeSeries(kpis.existencia, kpis.total),
      bajo: makeSeries(kpis.bajo, kpis.existencia),
      sin_stock: makeSeries(kpis.sin_stock, kpis.bajo),
      inactivo: makeSeries(kpis.inactivo, kpis.total),
      cad: makeSeries(kpis.cad, kpis.sin_stock)
    };
  }, [kpis]);

  // NEW: renderer del KPI con sparkline reutilizando markup visual de Productos.
  // WHY: mantener consistencia y evitar duplicar SVG inline en cada tarjeta del dashboard.
  // IMPACT: componente local de presentacion; no toca logica del resto del modulo.
  const renderKpiCard = (key, label, value, className = '') => {
    const points = buildInventorySparkPoints(insumosKpiSeries[key] || []);
    return (
      <div className={`inv-prod-kpi ${className}`.trim()}>
        {points ? (
          <svg className="inv-prod-kpi-spark" viewBox="0 0 120 44" preserveAspectRatio="none" aria-hidden="true">
            <polyline points={points} />
          </svg>
        ) : null}
        <div className="inv-prod-kpi-content">
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      </div>
    );
  };

  const hasActiveFilters = useMemo(() => (
    search.trim() !== '' || appliedFilters.almacen !== 'todos' || appliedFilters.categoria !== 'todos' || appliedFilters.sortBy !== 'recientes' || appliedFilters.estados.length > 0
  ), [appliedFilters, search]);

  const updateNav = useCallback((ref, setter) => {
    const el = ref.current;
    if (!el) return setter({ canPrev: false, canNext: false });
    const canPrev = el.scrollLeft > 6;
    const canNext = el.scrollLeft + el.clientWidth < el.scrollWidth - 6;
    setter((prev) => (prev.canPrev === canPrev && prev.canNext === canNext ? prev : { canPrev, canNext }));
  }, []);

  const wheelToHorizontal = useCallback((e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) e.currentTarget.scrollLeft += e.deltaY; }, []);
  const scrollCarousel = useCallback((ref, dir) => {
    const el = ref.current;
    if (!el) return;
    const delta = Math.max(260, Math.floor(el.clientWidth * 0.92));
    el.scrollBy({ left: dir === 'next' ? delta : -delta, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const el = frequentRef.current; if (!el) return undefined;
    const onScroll = () => updateNav(frequentRef, setFreqNav);
    const onResize = () => updateNav(frequentRef, setFreqNav);
    updateNav(frequentRef, setFreqNav);
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => { el.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize); };
  }, [frecuentes.length, loading, updateNav]);

  useEffect(() => {
    const el = allRef.current; if (!el) return undefined;
    const onScroll = () => updateNav(allRef, setAllNav);
    const onResize = () => updateNav(allRef, setAllNav);
    updateNav(allRef, setAllNav);
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => { el.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize); };
  }, [filtered.length, loading, updateNav]);

  const formValues = drawerMode === 'create' ? form : (editForm || emptyForm());
  const formErrors = drawerMode === 'create' ? createErrors : editErrors;
  const previewItem = useMemo(() => (drawerMode === 'create' ? { ...formValues } : (selectedInsumo ? { ...selectedInsumo, ...formValues } : null)), [drawerMode, formValues, selectedInsumo]);
  const previewSnap = useMemo(() => (previewItem ? snapshot(previewItem) : null), [previewItem, snapshot]);
  const submitDrawer = async (e) => { e.preventDefault(); if (drawerMode === 'create') await saveCreate(); else await saveEdit(); };
  const blockNonIntegerKeys = (e) => { if (['.', ',', 'e', 'E', '+', '-'].includes(e.key)) e.preventDefault(); };
  const intInput = (v) => String(v ?? '').replace(/[^\d]/g, '');
  const isAnyDrawerOpen = drawer === 'filters' || drawer === 'form';
  const fieldErr = (key) => (formErrors[key] ? <div className="invalid-feedback d-block">{formErrors[key]}</div> : null);

  const renderCard = (i) => {
    const s = snapshot(i);
    const ui = s.ui;
    const inactive = ui.key === 'inactivo';
    const isSel = drawer === 'form' && Number(selectedId) === Number(i?.id_insumo);
    const desc = sanitizeSpaces(i?.descripcion) || 'Sin descripcion';
    const categoriaText = getCategoriaLabel(i);

    return (
      <article
        key={i?.id_insumo}
        className={`inv-ins-card ${ui.cardClass} ${isSel ? 'is-selected' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => openEdit(i)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openEdit(i);
          }
        }}
      >
        <div className="inv-ins-card__head">
          <div className="inv-ins-card__title-wrap">
            <div className="inv-ins-card__title">{i?.nombre_insumo || `Insumo #${i?.id_insumo ?? '-'}`}</div>
            <div className="inv-ins-card__sub">{categoriaText || `ID #${i?.id_insumo ?? '-'}`}</div>
          </div>
          <span className={`inv-ins-card__badge ${ui.badgeClass}`}>{ui.badge}</span>
        </div>

        <div className="inv-ins-card__body">
          <div className="inv-ins-card__grid">
            <div>
              <div className="inv-ins-card__label">Existencias</div>
              <div className="inv-ins-card__value">{s.cantidad}</div>
            </div>
            <div>
              <div className="inv-ins-card__label">Stock minimo</div>
              <div className="inv-ins-card__value">
                {ui.key === 'bajo' ? (
                  <span className="inv-ins-card__warn"><i className="bi bi-exclamation-triangle-fill" /> {s.stockMin}</span>
                ) : s.stockMin}
              </div>
            </div>
            <div>
              <div className="inv-ins-card__label">Precio</div>
              <div className="inv-ins-card__value">{fmtMoney(i?.precio)}</div>
            </div>
            <div>
              <div className="inv-ins-card__label">Almacen</div>
              <div className="inv-ins-card__value inv-ins-card__value--clip">{getAlmacenLabel(i?.id_almacen)}</div>
            </div>
          </div>

          <div className="inv-ins-card__line">
            <span>Caducidad</span>
            <strong>{toDateInputValue(i?.fecha_caducidad) ? dateLabel(i?.fecha_caducidad) : 'Sin caducidad'}</strong>
          </div>

          <div className="inv-ins-card__desc" title={desc}>{desc}</div>

          <div className="inv-ins-card__footer">
            <div className="inv-ins-card__actions">
              <button
                type="button"
                className={`btn ${ui.primaryBtn} inv-ins-card__btn-main`}
                onClick={(e) => {
                  e.stopPropagation();
                  openEdit(i, { focusCantidad: true });
                }}
                disabled={inactive}
              >
                <i className={`bi ${ui.key === 'sin_stock' ? 'bi-box-arrow-in-down' : 'bi-sliders2-vertical'}`} />
                <span>{ui.primary}</span>
              </button>
              <button
                type="button"
                className="btn inv-prod-btn-subtle inv-ins-card__btn"
                onClick={(e) => {
                  e.stopPropagation();
                  openEdit(i);
                }}
                disabled={inactive}
              >
                <i className="bi bi-pencil-square" />
                <span>Editar</span>
              </button>
            </div>

            {!inactive ? (
              <div className="inv-ins-card__hover">
                <button
                  type="button"
                  className="btn inv-ins-card__tertiary"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (estadoField) void toggleEstado(i, false);
                  }}
                  disabled={!estadoField || togglingEstado}
                  title={estadoField ? 'Inactivar' : 'Inactivar no disponible'}
                >
                  <i className="bi bi-slash-circle" />
                  <span>Inactivar</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </article>
    );
  };


  return (
    <>
      <div className="card shadow-sm mb-3 inv-prod-card inv-ins-module">
        <div className="card-header inv-prod-header">
          <div className="inv-prod-title-wrap">
            <div className="inv-prod-title-row">
              <i className="bi bi-box2-heart inv-prod-title-icon" />
              <span className="inv-prod-title">Insumos</span>
            </div>
            <div className="inv-prod-subtitle">Gestion Visual de Insumos</div>
          </div>

          <div className="inv-prod-header-actions inv-ins-header-actions">
            <label className="inv-ins-search" aria-label="Buscar insumos">
              <i className="bi bi-search" />
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." />
            </label>
            <button type="button" className={`inv-prod-toolbar-btn ${drawer === 'filters' ? 'is-on' : ''}`} onClick={openFilters}>
              <i className="bi bi-funnel" /> <span>Filtros</span>
            </button>
            <button type="button" className={`inv-prod-toolbar-btn ${drawer === 'form' && drawerMode === 'create' ? 'is-on' : ''}`} onClick={openCreate}>
              <i className="bi bi-plus-circle" /> <span>Nuevo</span>
            </button>
          </div>
        </div>

        <div className="inv-prod-kpis">
          {renderKpiCard('total', 'Total', kpis.total)}
          {renderKpiCard('existencia', 'En existencia', kpis.existencia, 'is-ok')}
          {renderKpiCard('bajo', 'Stock bajo', kpis.bajo, 'is-low')}
          {renderKpiCard('sin_stock', 'Sin stock', kpis.sin_stock, 'is-empty')}
          {renderKpiCard('inactivo', 'Inactivos', kpis.inactivo)}
          {renderKpiCard('cad', 'Por caducar (30d)', kpis.cad, kpis.cad > 0 ? 'is-low' : '')}
        </div>

        <div className="card-body inv-prod-body">
          {error ? <div className="alert alert-danger inv-prod-alert">{error}</div> : null}

          <div className="inv-prod-results-meta">
            <span>{loading ? 'Cargando insumos...' : `${filtered.length} resultados`}</span>
            <span>{loading ? '' : `Total: ${insumos.length}`}</span>
            {hasActiveFilters ? <span className="inv-prod-active-filter-pill">Filtros activos</span> : null}
            {!estadoField ? <span className="inv-ins-inline-note">{'// TODO: backend support required (inactivo)'}</span> : null}
          </div>

          <section className="inv-ins-section">
            <div className="inv-ins-section__head">
              <div>
                <div className="inv-prod-panel-eyebrow">Prioridad</div>
                <div className="inv-ins-section__title">Insumos frecuentes</div>
              </div>
            </div>

            {loading ? (
              <div className="inv-ins-skeleton-track is-frequent">
                {Array.from({ length: 3 }).map((_, i) => <div key={i} className="inv-ins-skeleton-card" />)}
              </div>
            ) : frecuentes.length === 0 ? (
              <div className="inv-ins-empty">{hasActiveFilters ? 'No hay insumos para los filtros actuales.' : 'Aun no hay insumos.'}</div>
            ) : (
              <div className="inv-prod-carousel-stage inv-ins-carousel-stage">
                <button type="button" className={`btn inv-prod-carousel-float is-prev ${freqNav.canPrev ? 'is-visible' : ''}`} onClick={() => scrollCarousel(frequentRef, 'prev')} disabled={!freqNav.canPrev} aria-label="Anterior frecuentes">
                  <i className="bi bi-chevron-left" />
                </button>
                <div ref={frequentRef} className="inv-ins-track is-frequent" onWheel={wheelToHorizontal}>{frecuentes.map(renderCard)}</div>
                <button type="button" className={`btn inv-prod-carousel-float is-next ${freqNav.canNext ? 'is-visible' : ''}`} onClick={() => scrollCarousel(frequentRef, 'next')} disabled={!freqNav.canNext} aria-label="Siguiente frecuentes">
                  <i className="bi bi-chevron-right" />
                </button>
              </div>
            )}
          </section>

          <section className="inv-ins-section">
            <div className="inv-ins-section__head">
              <div>
                <div className="inv-prod-panel-eyebrow">Catalogo</div>
                <div className="inv-ins-section__title">Todos los insumos</div>
              </div>
              <button type="button" className="btn inv-prod-btn-subtle inv-ins-clear" onClick={clearFilters}>
                <i className="bi bi-arrow-counterclockwise" /> <span>Limpiar</span>
              </button>
            </div>

            {loading ? (
              <div className="inv-ins-skeleton-track is-all">
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="inv-ins-skeleton-card" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="inv-ins-empty">{hasActiveFilters ? 'No se encontraron insumos con los filtros aplicados.' : 'Crea tu primer insumo.'}</div>
            ) : (
              <div className="inv-prod-carousel-stage inv-ins-carousel-stage">
                <button type="button" className={`btn inv-prod-carousel-float is-prev ${allNav.canPrev ? 'is-visible' : ''}`} onClick={() => scrollCarousel(allRef, 'prev')} disabled={!allNav.canPrev} aria-label="Anterior catalogo">
                  <i className="bi bi-chevron-left" />
                </button>
                <div ref={allRef} className="inv-ins-track is-all" onWheel={wheelToHorizontal}>{filtered.map(renderCard)}</div>
                <button type="button" className={`btn inv-prod-carousel-float is-next ${allNav.canNext ? 'is-visible' : ''}`} onClick={() => scrollCarousel(allRef, 'next')} disabled={!allNav.canNext} aria-label="Siguiente catalogo">
                  <i className="bi bi-chevron-right" />
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
      {/* NEW: reutiliza el shell glass/backdrop de Categorias para unificar el drawer de Insumos sin tocar su contenido. */}
      {/* WHY: mantener el mismo contenedor visual (overlay + blur + animacion) entre submodulos de Inventario. */}
      {/* IMPACT: solo cambia la capa visual del drawer; formularios, filtros y handlers permanecen iguales. */}
      <div className={`inv-prod-drawer-backdrop inv-cat-v2__drawer-backdrop ${isAnyDrawerOpen ? 'show' : ''}`} onClick={closeDrawer} aria-hidden={!isAnyDrawerOpen} />

      <aside className={`inv-prod-drawer inv-cat-v2__drawer inv-ins-drawer ${drawer === 'filters' ? 'show' : ''}`} id="inv-ins-filters-drawer" role="dialog" aria-modal="true" aria-hidden={drawer !== 'filters'}>
        <div className="inv-prod-drawer-head">
          {/* NEW: watermark decorativo del shell de Categorias para igualar jerarquia visual del header del drawer. */}
          {/* WHY: replicar el acento visual del panel lateral sin afectar legibilidad ni foco. */}
          {/* IMPACT: elemento puramente decorativo; sin impacto funcional. */}
          <i className="bi bi-box-seam inv-cat-v2__drawer-mark" aria-hidden="true" />
          <div>
            <div className="inv-prod-drawer-title">Filtros de insumos</div>
            <div className="inv-prod-drawer-sub">Estados, categorias, almacenes y orden</div>
          </div>
          <button type="button" className="inv-prod-drawer-close" onClick={closeDrawer}><i className="bi bi-x-lg" /></button>
        </div>

        <div className="inv-prod-drawer-body">
          <div className="inv-prod-drawer-section">
            <div className="inv-prod-drawer-section-title">Estados</div>
            <div className="inv-ins-chip-grid">
              {STATUS_CHIPS.map((chip) => {
                const on = draftFilters.estados.includes(chip.key);
                return (
                  <button
                    key={chip.key}
                    type="button"
                    className={`inv-ins-chip ${on ? 'is-active' : ''}`}
                    onClick={() => setDraftFilters((s) => ({ ...s, estados: on ? s.estados.filter((x) => x !== chip.key) : [...s.estados, chip.key] }))}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
            <div className="inv-ins-help">Si no seleccionas estados, se muestran todos.</div>
          </div>

          <div className="inv-prod-drawer-section">
            <div className="inv-prod-drawer-section-title">Filtros adicionales</div>
            <div className="inv-ins-drawer-fields">
              <div>
                <label className="form-label">Almacen</label>
                <select className="form-select" value={String(draftFilters.almacen)} onChange={(e) => setDraftFilters((s) => ({ ...s, almacen: e.target.value }))}>
                  <option value="todos">Todos los almacenes</option>
                  {almacenes.map((a) => <option key={a.id_almacen} value={a.id_almacen}>{a.nombre} (Sucursal {a.id_sucursal})</option>)}
                </select>
              </div>

              <div>
                <label className="form-label">Categoria</label>
                <select
                  className="form-select"
                  value={String(draftFilters.categoria)}
                  onChange={(e) => setDraftFilters((s) => ({ ...s, categoria: e.target.value }))}
                  disabled={categoriaOptions.length === 0}
                >
                  <option value="todos">{categoriaOptions.length ? 'Todas las categorias' : 'No disponible'}</option>
                  {categoriaOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                {!categoriaOptions.length ? <div className="inv-ins-help">{categoriaField || categoriaLabelField ? 'Sin datos suficientes para filtrar.' : 'No se detecto categoria en insumos.'}</div> : null}
              </div>

              <div>
                <label className="form-label">Orden</label>
                <select className="form-select" value={String(draftFilters.sortBy)} onChange={(e) => setDraftFilters((s) => ({ ...s, sortBy: e.target.value }))}>
                  {SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="inv-prod-drawer-actions inv-ins-drawer-actions">
            <button type="button" className="btn inv-prod-btn-subtle" onClick={clearFilters}>Limpiar</button>
            <button type="button" className="btn inv-prod-btn-primary" onClick={applyFilters}>Aplicar</button>
          </div>
        </div>
      </aside>

      <aside className={`inv-prod-drawer inv-cat-v2__drawer inv-ins-drawer ${drawer === 'form' ? 'show' : ''}`} id="inv-ins-form-drawer" role="dialog" aria-modal="true" aria-hidden={drawer !== 'form'}>
        <div className="inv-prod-drawer-head">
          {/* NEW: watermark decorativo compartido con el patron de Categorias. */}
          {/* WHY: unificar el shell del drawer de alta/edicion con el resto del modulo Inventario. */}
          {/* IMPACT: solo presentacional; no altera validaciones ni submit. */}
          <i className="bi bi-box-seam inv-cat-v2__drawer-mark" aria-hidden="true" />
          <div>
            <div className="inv-prod-drawer-title">{drawerMode === 'create' ? 'Nuevo insumo' : 'Editar insumo'}</div>
            <div className="inv-prod-drawer-sub">{drawerMode === 'create' ? 'Completa los campos y guarda.' : (selectedInsumo?.nombre_insumo || `Insumo #${selectedInsumo?.id_insumo ?? '-'}`)}</div>
          </div>
          <button type="button" className="inv-prod-drawer-close" onClick={closeDrawer}><i className="bi bi-x-lg" /></button>
        </div>

        <form className="inv-prod-drawer-body" onSubmit={submitDrawer}>
          <div className="inv-ins-drawer-hero">
            <div className="inv-ins-drawer-hero__price">{fmtMoney(formValues?.precio || 0)}</div>
            {previewSnap ? <span className={`inv-ins-card__badge ${previewSnap.ui.badgeClass}`}>{previewSnap.ui.badge}</span> : null}
          </div>

          <div className="inv-ins-drawer-fields">
            <div>
              <label className="form-label">Nombre del insumo</label>
              <input ref={nombreInputRef} className={`form-control ${formErrors.nombre_insumo ? 'is-invalid' : ''}`} value={formValues.nombre_insumo ?? ''} onChange={(e) => setField('nombre_insumo', e.target.value)} placeholder="Ej: Queso mozzarella" />
              {fieldErr('nombre_insumo')}
            </div>

            <div className="inv-ins-drawer-grid">
              <div>
                <label className="form-label">Precio</label>
                <input className={`form-control ${formErrors.precio ? 'is-invalid' : ''}`} type="number" step="0.01" min="0" value={formValues.precio ?? ''} onChange={(e) => setField('precio', e.target.value)} />
                {fieldErr('precio')}
              </div>
              <div>
                <label className="form-label">Cantidad</label>
                <input ref={cantidadInputRef} className={`form-control ${formErrors.cantidad ? 'is-invalid' : ''}`} type="number" step="1" min="0" inputMode="numeric" value={formValues.cantidad ?? ''} onKeyDown={blockNonIntegerKeys} onChange={(e) => setField('cantidad', intInput(e.target.value))} />
                {fieldErr('cantidad')}
              </div>
              <div>
                <label className="form-label">Stock minimo</label>
                <input className={`form-control ${formErrors.stock_minimo ? 'is-invalid' : ''}`} type="number" step="1" min="0" inputMode="numeric" value={formValues.stock_minimo ?? ''} onKeyDown={blockNonIntegerKeys} onChange={(e) => setField('stock_minimo', intInput(e.target.value))} />
                {fieldErr('stock_minimo')}
              </div>
              <div>
                <label className="form-label">Almacen</label>
                <select className={`form-select ${formErrors.id_almacen ? 'is-invalid' : ''}`} value={String(formValues.id_almacen ?? '')} onChange={(e) => setField('id_almacen', e.target.value)} disabled={loadingAlmacenes}>
                  <option value="">{loadingAlmacenes ? 'Cargando almacenes...' : 'Seleccione un almacen'}</option>
                  {almacenes.map((a) => <option key={a.id_almacen} value={a.id_almacen}>{a.nombre} (Sucursal {a.id_sucursal})</option>)}
                </select>
                {fieldErr('id_almacen')}
              </div>
              <div>
                <label className="form-label">Fecha ingreso (opcional)</label>
                <input className={`form-control ${formErrors.fecha_ingreso_insumo ? 'is-invalid' : ''}`} type="date" value={formValues.fecha_ingreso_insumo ?? ''} onChange={(e) => setField('fecha_ingreso_insumo', e.target.value)} />
                {fieldErr('fecha_ingreso_insumo')}
              </div>
              <div>
                <label className="form-label">Fecha caducidad (opcional)</label>
                <input className={`form-control ${formErrors.fecha_caducidad ? 'is-invalid' : ''}`} type="date" value={formValues.fecha_caducidad ?? ''} onChange={(e) => setField('fecha_caducidad', e.target.value)} />
                {fieldErr('fecha_caducidad')}
              </div>
            </div>

            <div>
              <label className="form-label">Descripcion (opcional)</label>
              <textarea className={`form-control ${formErrors.descripcion ? 'is-invalid' : ''}`} rows="3" value={formValues.descripcion ?? ''} onChange={(e) => setField('descripcion', e.target.value)} />
              {fieldErr('descripcion')}
              <div className="inv-ins-help">Se sanitizan espacios extra al guardar.</div>
            </div>
          </div>

          {drawerMode === 'edit' ? (
            <>
              <div className="inv-prod-drawer-section">
                <div className="inv-prod-drawer-section-title">Ajustar existencias</div>
                <div className="inv-ins-stepper">
                  <button type="button" onClick={() => setField('cantidad', String(Math.max(0, parseIntSafe(editForm?.cantidad, 0) - 1)))} disabled={savingEdit}>-</button>
                  <input type="text" inputMode="numeric" value={String(editForm?.cantidad ?? '')} onChange={(e) => setField('cantidad', intInput(e.target.value))} />
                  <button type="button" onClick={() => setField('cantidad', String(parseIntSafe(editForm?.cantidad, 0) + 1))} disabled={savingEdit}>+</button>
                </div>
              </div>

              <div className="inv-prod-drawer-grid">
                <div><span>Existencias</span><strong>{previewSnap?.cantidad ?? 0}</strong></div>
                <div><span>Stock minimo</span><strong>{previewSnap?.stockMin ?? 0}</strong></div>
                <div><span>Almacen</span><strong>{getAlmacenLabel(previewItem?.id_almacen)}</strong></div>
                <div><span>Caducidad</span><strong>{dateLabel(previewItem?.fecha_caducidad)}</strong></div>
              </div>

              <div className="inv-prod-drawer-section">
                <div className="inv-prod-drawer-section-title">Estado del insumo</div>
                {estadoField ? (
                  <button
                    type="button"
                    className={`btn ${resolveActivo(selectedInsumo) ? 'inv-prod-btn-danger-lite' : 'inv-prod-btn-success-lite'} w-100`}
                    onClick={() => selectedInsumo && void toggleEstado(selectedInsumo, !resolveActivo(selectedInsumo))}
                    disabled={togglingEstado || savingEdit}
                  >
                    {togglingEstado ? 'Procesando...' : (resolveActivo(selectedInsumo) ? 'Inactivar' : 'Reactivar')}
                  </button>
                ) : (
                  <div className="inv-ins-disabled-note">
                    Inactivar/Reactivar no disponible.
                    <div className="small text-muted mt-1">{'// TODO: backend support required'}</div>
                  </div>
                )}
              </div>
            </>
          ) : null}

          {drawerMsg ? <div className="inv-prod-drawer-feedback">{drawerMsg}</div> : null}

          <div className="inv-ins-drawer-footer">
            <button type="button" className="btn inv-prod-btn-subtle" onClick={closeDrawer} disabled={creating || savingEdit || togglingEstado}>Cancelar</button>
            {drawerMode === 'edit' ? (
              <button type="button" className="btn inv-prod-btn-danger-lite" onClick={() => setConfirm(selectedInsumo?.id_insumo, selectedInsumo?.nombre_insumo)} disabled={savingEdit || togglingEstado || !selectedInsumo}>Eliminar</button>
            ) : (
              <button type="button" className="btn inv-prod-btn-subtle" onClick={resetCreate} disabled={creating}>Limpiar</button>
            )}
            <button type="submit" className="btn inv-prod-btn-primary" disabled={creating || savingEdit || togglingEstado || (drawerMode === 'edit' && !editForm)}>
              {drawerMode === 'create' ? (creating ? 'Creando...' : 'Crear') : (savingEdit ? 'Guardando...' : 'Guardar cambios')}
            </button>
          </div>
        </form>
      </aside>
      {confirmModal.show && (
        <div className="modal fade show inv-prod-modal-backdrop inv-prod-modal-backdrop-danger" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 2600 }} role="dialog" aria-modal="true" onClick={closeConfirm}>
          <div className="modal-dialog modal-dialog-centered inv-prod-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content shadow inv-prod-modal-content inv-prod-delete-modal">
              <div className="modal-header d-flex align-items-center justify-content-between inv-prod-modal-header danger">
                <div>
                  <div className="fw-semibold">Confirmar eliminacion</div>
                  <div className="small text-muted">Esta accion no se puede deshacer</div>
                </div>
                <button type="button" className="btn btn-sm btn-light inv-prod-modal-close" onClick={closeConfirm}><i className="bi bi-x-lg" /></button>
              </div>
              <div className="modal-body inv-prod-modal-body">
                <div className="mb-2">Deseas eliminar este insumo?</div>
                {confirmModal.nombre ? <div className="text-muted small inv-prod-delete-name"><i className="bi bi-box2-heart" /> <span className="fw-semibold">{confirmModal.nombre}</span></div> : null}
              </div>
              <div className="modal-footer d-flex gap-2 inv-prod-modal-footer">
                <button className="btn btn-outline-secondary inv-prod-btn-subtle" type="button" onClick={closeConfirm} disabled={deleting}>Cancelar</button>
                <button className="btn btn-danger inv-prod-btn-danger" type="button" onClick={deleteConfirmed} disabled={deleting}>{deleting ? 'Eliminando...' : 'Eliminar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default InsumosTab;
