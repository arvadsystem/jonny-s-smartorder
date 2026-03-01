import { useEffect, useMemo, useRef, useState } from 'react';
import { inventarioService } from '../../../services/inventarioService';
import { toUpperSafe } from '../../../utils/toUpperSafe';
import CategoriasInsumosPanel from './CategoriasInsumosPanel.jsx';
import CompactHeaderSwitch from './CompactHeaderSwitch.jsx';

const resolveCardsPerPage = (width) => {
  if (width >= 1200) return 6; // 3x2 desktop
  if (width >= 620) return 4; // 2x2 tablet
  return 2; // 1x2 mobile
};

// NEW: helper visual para mini-grafica tipo Productos en stat cards.
// WHY: reutilizar el mismo lenguaje visual (sparkline SVG) en dashboards de Categorias sin APIs nuevas.
// IMPACT: solo se usa en dashboards; no altera conteos ni logica de negocio.
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

// NEW: normaliza `estado` para soportar boolean/string/number en el filtrado del listado.
// WHY: al activar "Ver inactivos" el backend puede devolver booleans serializados y el filtro debe ser confiable.
// IMPACT: solo afecta el filtrado visual de Categorias en Inventario; no toca handlers ni endpoints.
const resolveCategoriaActiva = (categoria) => {
  const raw = categoria?.estado;
  if (raw === undefined || raw === null || raw === '') return true;
  if (raw === true || raw === 1 || raw === '1') return true;
  return String(raw).trim().toLowerCase() === 'true';
};

// NEW: mensaje UX exacto para bloqueo de inactivacion cuando la categoria tiene productos activos asignados.
// WHY: centralizar el texto requerido y reutilizarlo en validacion preventiva y manejo de error backend.
// IMPACT: solo afecta mensajes UI de Categorias; no cambia endpoints ni logica de negocio.
const CATEGORY_DELETE_BLOCKED_MESSAGE = 'NO SE PUEDE INACTIVAR LA CATEGORIA PORQUE TIENE PRODUCTOS ASIGNADOS. REASIGNA O ACTUALIZA ESOS PRODUCTOS Y LUEGO INTENTA DE NUEVO.';
// NEW: prefijo por defecto para codigos de categorias de productos.
// WHY: el usuario pidio que el alta de categorias de productos inicie con `PRO-`.
// IMPACT: solo prellena el formulario de create en Categorias de Productos.
const PRODUCT_CATEGORY_CODE_PREFIX = 'PRO-';
const CATEGORY_FILTER_SORT_LABELS = Object.freeze({
  recientes: 'Mas recientes',
  nombre_asc: 'Nombre (A-Z)',
  nombre_desc: 'Nombre (Z-A)',
  codigo_asc: 'Codigo (A-Z)',
  codigo_desc: 'Codigo (Z-A)'
});
// NEW: copy e iconografia unificados para todas las confirmaciones de inactivacion en Inventario.
// WHY: el usuario pidio el mismo mensaje y el mismo icono en todos los modulos al confirmar la inactivacion.
// IMPACT: solo homologa el modal de confirmacion de Categorias; no toca activacion, filtros ni cards.
const INACTIVATE_CONFIRM_COPY = Object.freeze({
  title: 'Confirmar inactivación',
  subtitle: 'Este registro quedará marcado como inactivo',
  question: '¿Deseas inactivar este registro?',
  fallbackName: 'Registro seleccionado',
  iconClass: 'bi bi-slash-circle'
});

// NEW: merge local/global de categorias por id para conservar activos e inactivos sin recargar la grilla.
// WHY: "Ver inactivos" debe responder con el dataset en memoria, incluso despues de inactivar o refrescar props activas.
// IMPACT: solo sincroniza estado local del tab; no modifica contratos ni estructura del backend.
const mergeCategoriasProductoById = (current, incoming) => {
  const map = new Map();
  (Array.isArray(current) ? current : []).forEach((item) => {
    const id = Number(item?.id_categoria_producto ?? 0);
    if (id) map.set(id, item);
  });
  (Array.isArray(incoming) ? incoming : []).forEach((item) => {
    const id = Number(item?.id_categoria_producto ?? 0);
    if (!id) return;
    map.set(id, { ...(map.get(id) || {}), ...item });
  });
  return Array.from(map.values());
};

const buildProductCategoryForm = () => ({
  nombre_categoria: '',
  codigo_categoria: PRODUCT_CATEGORY_CODE_PREFIX,
  descripcion: '',
  estado: true
});

const CategoriasTab = ({
  categorias = [],
  loading = false,
  error = '',
  setError,
  reloadCategorias,
  includeInactive = false,
  onIncludeInactiveChange,
  onCategoriaPatched,
  categoriasInsumos = [],
  loadingCategoriasInsumos = false,
  errorCategoriasInsumos = '',
  setErrorCategoriasInsumos,
  reloadCategoriasInsumos,
  includeInactiveCategoriasInsumos = false,
  onIncludeInactiveCategoriasInsumosChange,
  onCategoriaInsumoPatched,
  openToast
}) => {
  // FUNCIONALIDAD: TOAST SEGURO
  const safeToast = (title, message, variant = 'success') => {
    if (typeof openToast === 'function') openToast(title, message, variant);
  };

  // FUNCIONALIDAD: ERROR SEGURO
  const safeSetError = (msg) => {
    if (typeof setError === 'function') setError(msg);
  };
  // NEW: switch maestro del submódulo Categorías (INSUMOS/PRODUCTOS) con default INSUMOS.
  // WHY: unificar la UI en un solo submódulo sin refactorizar el panel existente de categorías de productos.
  // IMPACT: solo cambia qué panel se renderiza; la lógica actual de categorías de productos se conserva intacta.
  const [categoriaCatalogScope, setCategoriaCatalogScope] = useState('insumos');
  // NEW: copy del header principal sincronizado con el switch INSUMOS/PRODUCTOS.
  // WHY: el título visible del submódulo Categorías debe reflejar el catálogo activo sin recargar la vista.
  // IMPACT: solo texto de UI; no cambia filtros, datos, endpoints ni lógica del switch.
  const activeCategoriasHeaderCopy = useMemo(
    () => (
      categoriaCatalogScope === 'insumos'
        ? {
            title: 'Categorías de Insumos',
            subtitle: 'Gestión visual de categorías de insumos'
          }
        : {
            title: 'Categorías de Productos',
            subtitle: 'Gestión visual de categorías de productos'
          }
    ),
    [categoriaCatalogScope]
  );

  // ==============================
  // FILTROS
  // ==============================
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('todos'); // todos | activo | inactivo
  // NEW: orden de cards y borrador de filtros para aplicar desde drawer derecho.
  // WHY: alinear UX con Insumos/Productos (Aplicar / Limpiar) sin re-filtrar en cada cambio.
  // IMPACT: filtrado sigue siendo local; no cambia endpoints ni contratos.
  const [sortBy, setSortBy] = useState('recientes');
  const [filtersDraft, setFiltersDraft] = useState({ estadoFiltro: 'todos', sortBy: 'recientes' });

  // ==============================
  // DRAWER (CREAR / EDITAR)
  // ==============================
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState('create'); // create | edit
  const [editId, setEditId] = useState(null);
  // NEW: bloqueo de accion de activar/inactivar por card para evitar doble click concurrente.
  // WHY: prevenir multiples requests mientras se actualiza estado por campo.
  // IMPACT: solo controla UX local; usa el mismo endpoint existente.
  const [quickTogglingEstadoId, setQuickTogglingEstadoId] = useState(null);

  const [form, setForm] = useState(buildProductCategoryForm);

  const [formErrors, setFormErrors] = useState({});
  // NEW: espejo local de categorias para parches parciales en edit/activar-inactivar (desktop y responsive).
  // WHY: evitar refetch completo visible de la grilla tras cambios de un solo item.
  // IMPACT: sincroniza con props `categorias`; si hay recarga del padre, prevalece la data remota.
  const [categoriasLocal, setCategoriasLocal] = useState(() => (Array.isArray(categorias) ? categorias : []));
  // NEW: dataset global (activos + inactivos) exclusivo para KPIs y "Total" del header.
  // WHY: el toggle "Ver inactivos" debe afectar solo el listado visible, no los conteos globales.
  // IMPACT: realiza una carga adicional local a CategoriasTab; no modifica endpoints ni contratos.
  const [categoriasGlobalMetricsData, setCategoriasGlobalMetricsData] = useState(() => (Array.isArray(categorias) ? categorias : []));
  // NEW: flag de viewport responsive siguiendo breakpoints estandar del modulo (<= 991.98px).
  // WHY: aplicar cambios exclusivamente mobile/tablet sin afectar desktop.
  // IMPACT: controla UX de taps, drawers y estrategia de actualizacion local.
  const [isResponsiveViewport, setIsResponsiveViewport] = useState(() =>
    typeof window === 'undefined' ? false : window.innerWidth <= 991.98
  );

  const [cardsPerPage, setCardsPerPage] = useState(() =>
    typeof window === 'undefined' ? 6 : resolveCardsPerPage(window.innerWidth)
  );
  const [carouselPageIndex, setCarouselPageIndex] = useState(0);
  // NUEVO: feature flag para habilitar hover premium sin eliminar implementacion actual.
  const USE_PREMIUM_CATEGORY_CARDS = true;

  useEffect(() => {
    const onResize = () => {
      setCardsPerPage(resolveCardsPerPage(window.innerWidth));
      setIsResponsiveViewport(window.innerWidth <= 991.98);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    // NEW: fusiona props activas con el espejo local para no perder categorias inactivas ya hidratadas.
    // WHY: el padre puede seguir trayendo solo activas, pero el toggle "Ver inactivos" necesita conservar ambas en memoria.
    // IMPACT: evita vaciar la lista local al recibir nuevas props; el filtrado visual sigue igual.
    setCategoriasLocal((prev) => mergeCategoriasProductoById(prev, categorias));
    setCategoriasGlobalMetricsData((prev) => mergeCategoriasProductoById(prev, categorias));
  }, [categorias]);

  useEffect(() => {
    // NEW: hidrata silenciosamente el dataset completo de categorias (activas + inactivas) al montar el tab.
    // WHY: el toggle "Ver inactivos" debe filtrar localmente sin disparar recarga visible de cards.
    // IMPACT: los KPIs y el listado comparten una fuente completa en memoria; el flujo CRUD actual no cambia.
    let cancelled = false;
    const syncGlobalCategoriasMetrics = async () => {
      try {
        const data = await inventarioService.getCategorias({ incluirInactivos: true });
        if (!cancelled && Array.isArray(data)) {
          setCategoriasGlobalMetricsData(data);
          setCategoriasLocal((prev) => mergeCategoriasProductoById(prev, data));
        }
      } catch {
        // noop: el tab ya muestra errores de carga del listado visible; los KPIs mantienen el ultimo dataset global valido.
      }
    };

    void syncGlobalCategoriasMetrics();
    return () => {
      cancelled = true;
    };
  }, []);

  const openCreate = () => {
    // FUNCIONALIDAD: ABRIR DRAWER CREAR
    // NEW: se cierra drawer de filtros para mantener un solo panel lateral abierto.
    // WHY: mismo patron de exclusividad usado en Insumos/Productos.
    // IMPACT: mejora UX; no afecta CRUD.
    setFiltersOpen(false);
    setDrawerMode('create');
    setEditId(null);
    setForm(buildProductCategoryForm());
    setFormErrors({});
    setDrawerOpen(true);
  };

  const openEdit = (c) => {
    // FUNCIONALIDAD: ABRIR DRAWER EDITAR
    // NEW: se cierra drawer de filtros para mantener un solo panel lateral abierto.
    // WHY: evita superposicion de drawers derechos.
    // IMPACT: compatibilidad total con flujo actual de edicion.
    setFiltersOpen(false);
    setDrawerMode('edit');
    setEditId(c?.id_categoria_producto ?? null);
    setForm({
      nombre_categoria: String(c?.nombre_categoria ?? '').toUpperCase(),
      codigo_categoria: normalizeCodigo(c?.codigo_categoria ?? ''),
      descripcion: c?.descripcion ?? '',
      estado: !!c?.estado
    });
    setFormErrors({});
    setDrawerOpen(true);
  };

  const closeDrawer = () => setDrawerOpen(false);
  const closeFiltersDrawer = () => setFiltersOpen(false);

  // NEW: normalizador local de texto para campos elegibles del formulario de Categorías.
  // WHY: aplicar mayúsculas con exclusiones seguras sin tocar el flujo de validación ni submit.
  // IMPACT: solo afecta `nombre_categoria` y `descripcion` en create/edit; código mantiene `normalizeCodigo`.
  const normalizeCategoriaTextInput = (field, value) => toUpperSafe(value, field);

  // NEW: helpers del drawer de filtros con borrador aplicado.
  // WHY: replicar UX de drawer derecho de Insumos/Productos.
  // IMPACT: solo afecta estados locales de filtros.
  const openFiltersDrawer = () => {
    setDrawerOpen(false);
    setFiltersDraft({ estadoFiltro, sortBy });
    setFiltersOpen(true);
  };

  const applyFiltersDrawer = () => {
    setEstadoFiltro(filtersDraft.estadoFiltro || 'todos');
    setSortBy(filtersDraft.sortBy || 'recientes');
    setFiltersOpen(false);
  };

  const clearVisualFilters = () => {
    setEstadoFiltro('todos');
    setSortBy('recientes');
    setFiltersDraft({ estadoFiltro: 'todos', sortBy: 'recientes' });
  };

  const clearAllFilters = () => {
    setSearch('');
    clearVisualFilters();
    setFiltersOpen(false);
  };

  // NEW: toggle admin para incluir categorias inactivas usando el mismo GET con query param.
  // WHY: el backend filtra por `estado=true` por defecto despues del cambio a soft delete.
  // IMPACT: recarga solo datos del tab; no altera filtros visuales ni contratos existentes.
  const toggleIncludeInactive = async () => {
    const next = !includeInactive;
    safeSetError('');
    // NEW: el toggle solo cambia el filtro visible; ya no refetcha la grilla.
    // WHY: el dataset completo vive en memoria y el usuario pidio evitar recarga/flicker al abrir inactivos.
    // IMPACT: mantiene el mismo checkbox/UX, pero el cambio de vista es inmediato.
    if (typeof onIncludeInactiveChange === 'function') {
      onIncludeInactiveChange(next);
    }
  };

  // ==============================
  // ELIMINAR (CONFIRMACION)
  // ==============================
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    idToDelete: null,
    nombre: ''
  });
  // NEW: alerta roja local no bloqueante para restricciones de eliminacion (auto-dismiss 6s).
  // WHY: reemplazar la confirmacion cuando hay productos asignados y dar feedback claro sin bloquear la pantalla.
  // IMPACT: UI-only en Categorias; flujo de eliminacion valido permanece intacto.
  const [deleteBlockedAlert, setDeleteBlockedAlert] = useState('');
  const deleteBlockedAlertTimerRef = useRef(null);

  // NEW: helper para limpiar timer de alerta y evitar timers sueltos en reintentos/unmount.
  // WHY: garantizar auto-dismiss correcto y prevenir estados colgantes al navegar/cambiar de pantalla.
  // IMPACT: solo manejo de lifecycle de la alerta local.
  const clearDeleteBlockedAlertTimer = () => {
    if (deleteBlockedAlertTimerRef.current) {
      clearTimeout(deleteBlockedAlertTimerRef.current);
      deleteBlockedAlertTimerRef.current = null;
    }
  };

  // NEW: muestra la alerta roja exacta por 6 segundos y reinicia el timer si se intenta de nuevo.
  // WHY: cumplir el requerimiento UX sin reutilizar modales bloqueantes ni toasts globales.
  // IMPACT: no cambia CRUD; solo feedback visual temporal en la pantalla de Categorias.
  const showDeleteBlockedAlert = () => {
    clearDeleteBlockedAlertTimer();
    setDeleteBlockedAlert(CATEGORY_DELETE_BLOCKED_MESSAGE);
    deleteBlockedAlertTimerRef.current = setTimeout(() => {
      setDeleteBlockedAlert('');
      deleteBlockedAlertTimerRef.current = null;
    }, 6000);
  };

  const closeConfirmDelete = () => setConfirmModal({ show: false, idToDelete: null, nombre: '' });
  const openConfirmDelete = (id, nombre) => {
    const categoriaActual = (categoriasLocal || []).find((c) => Number(c?.id_categoria_producto ?? 0) === Number(id ?? 0));
    const countProductos = getProductosAsignadosCount(categoriaActual);
    if (countProductos !== null && countProductos > 0) {
      closeConfirmDelete();
      safeSetError('');
      showDeleteBlockedAlert();
      return;
    }
    clearDeleteBlockedAlertTimer();
    setDeleteBlockedAlert('');
    setConfirmModal({ show: true, idToDelete: id, nombre: nombre || '' });
  };

  useEffect(() => () => {
    if (deleteBlockedAlertTimerRef.current) {
      clearTimeout(deleteBlockedAlertTimerRef.current);
      deleteBlockedAlertTimerRef.current = null;
    }
  }, []);

  // ==============================
  // HELPERS
  // ==============================
  const normalizeCodigo = (value) =>
    String(value ?? '')
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/[^A-Z0-9_-]/g, '');

  const validarCategoria = (data) => {
    const nombre = String(data?.nombre_categoria ?? '').trim();
    const codigo = normalizeCodigo(data?.codigo_categoria ?? '');
    const descripcion = String(data?.descripcion ?? '').trim();
    const estado = !!data?.estado;

    const errors = {};

    if (nombre.length < 2) errors.nombre_categoria = 'MINIMO 2 CARACTERES';
    if (nombre.length > 50) errors.nombre_categoria = 'MAXIMO 50 CARACTERES';

    if (codigo.length < 2) errors.codigo_categoria = 'MINIMO 2 CARACTERES';
    if (codigo.length > 10) errors.codigo_categoria = 'MAXIMO 10 CARACTERES';
    if (!/^[A-Z0-9_-]+$/.test(codigo)) errors.codigo_categoria = 'SOLO MAYUSCULAS, NUMEROS, - O _ (SIN ESPACIOS)';

    if (descripcion.length > 150) errors.descripcion = 'MAXIMO 150 CARACTERES';

    const cleaned = { nombre_categoria: nombre, codigo_categoria: codigo, estado };
    // FUNCIONALIDAD: NO ENVIAR NULL, SOLO SI HAY TEXTO
    if (descripcion) cleaned.descripcion = descripcion;

    return { ok: Object.keys(errors).length === 0, errors, cleaned };
  };

  // NEW: detecta conteo de productos activos si el backend ya lo incluye en la categoria.
  // WHY: evitar pre-bloqueos incorrectos cuando solo existan productos inactivos.
  // IMPACT: si no viene conteo de activos, la validacion final queda en el backend (409).
  const getProductosAsignadosCount = (categoria) => {
    const candidates = [
      categoria?.cantidad_productos_activos,
      categoria?.productos_activos_count,
      categoria?.total_productos_activos,
      categoria?.conteo_productos_activos
    ];
    for (const raw of candidates) {
      const parsed = Number.parseInt(String(raw ?? ''), 10);
      if (!Number.isNaN(parsed) && parsed >= 0) return parsed;
    }
    return null;
  };

  // NEW: helper de bloqueo UI para inactivación usando el conteo ya disponible en la card (si el backend lo expone).
  // WHY: deshabilitar la acción de inactivar de forma consistente en desktop y responsive sin endpoints nuevos.
  // IMPACT: solo UI; si no hay conteo disponible, el fallback sigue siendo `openConfirmDelete` + validación backend 409.
  const isCategoriaUiBlockedForInactivation = (categoria) => {
    const count = getProductosAsignadosCount(categoria);
    return count !== null && count > 0;
  };

  // NEW: parche local por id para mantener la grilla estable tras editar/toggle.
  // WHY: evita "reload" visible de todas las cards cuando solo cambia una categoria.
  // IMPACT: sincroniza el mirror local y, si existe callback del padre, actualiza categorias compartidas.
  const patchCategoriaLocalById = (idCategoria, patch) => {
    const idNum = Number(idCategoria ?? 0);
    if (!idNum) return;
    setCategoriasLocal((prev) =>
      (Array.isArray(prev) ? prev : []).map((item) =>
        Number(item?.id_categoria_producto ?? 0) === idNum ? { ...item, ...patch } : item
      )
    );
    setCategoriasGlobalMetricsData((prev) =>
      (Array.isArray(prev) ? prev : []).map((item) =>
        Number(item?.id_categoria_producto ?? 0) === idNum ? { ...item, ...patch } : item
      )
    );
    if (typeof onCategoriaPatched === 'function' && patch && typeof patch === 'object') {
      try {
        onCategoriaPatched(idNum, patch);
      } catch {
        // NEW: fallback defensivo si el patch compartido del padre falla por cualquier motivo.
        // WHY: mantener consistencia entre tabs sin romper el flujo exitoso del CRUD.
        // IMPACT: dispara recarga segura solo en casos excepcionales; comportamiento normal no cambia.
        if (typeof reloadCategorias === 'function') void reloadCategorias();
      }
    }
  };

  // ==============================
  // KPIS
  // ==============================
  // NEW: fuente global de datos para KPIs y "Total" independiente del toggle de listado.
  // WHY: separar conteos globales (dashboard) del dataset visible filtrado en cards.
  // IMPACT: los KPIs ya no cambian al alternar "Ver inactivos"; el listado sigue filtrando igual.
  const categoriasDatasetGlobal = useMemo(
    () => (Array.isArray(categoriasGlobalMetricsData) ? categoriasGlobalMetricsData : []),
    [categoriasGlobalMetricsData]
  );

  const kpis = useMemo(() => {
    const total = categoriasDatasetGlobal.length;
    const activas = categoriasDatasetGlobal.filter((c) => resolveCategoriaActiva(c)).length;
    const inactivas = total - activas;
    return { total, activas, inactivas };
  }, [categoriasDatasetGlobal]);

  // NEW: series derivadas localmente para mini-graficas tipo Productos en dashboards.
  // WHY: mantener uniformidad visual sin requerir historico persistente ni nuevas llamadas API.
  // IMPACT: puramente decorativo; los valores principales siguen viniendo de `kpis`.
  const categoriasKpiSeries = useMemo(() => {
    const makeSeries = (value, neighbor = 0) => {
      const v = Math.max(0, Number(value ?? 0));
      const n = Math.max(0, Number(neighbor ?? 0));
      const delta = Math.max(1, Math.round(Math.max(v, n) * 0.12));
      return [
        Math.max(0, v - delta),
        Math.max(0, Math.round((v + n) / 2)),
        v,
        Math.max(0, v - Math.round(delta / 2)),
        v
      ];
    };
    return {
      total: makeSeries(kpis.total, kpis.activas),
      activas: makeSeries(kpis.activas, kpis.total),
      inactivas: makeSeries(kpis.inactivas, kpis.total)
    };
  }, [kpis]);

  // NEW: render reutilizable del KPI con sparkline, igual al patron visual de Productos.
  // WHY: evitar duplicar SVG/markup en cada stat card del dashboard de Categorias.
  // IMPACT: solo encapsula presentacion de la tarjeta; no toca calculos.
  const renderKpiCard = (key, label, value, className = '') => {
    const points = buildInventorySparkPoints(categoriasKpiSeries[key] || []);
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

  // ==============================
  // LISTADO FILTRADO
  // ==============================
  const categoriasFiltradas = useMemo(() => {
    const lista = [...(categoriasLocal || [])].sort(
      (a, b) => (a?.id_categoria_producto ?? 0) - (b?.id_categoria_producto ?? 0)
    );

    const s = search.trim().toLowerCase();
    const filtradas = lista.filter((c) => {
      const texto = `${c?.nombre_categoria ?? ''} ${c?.codigo_categoria ?? ''} ${c?.descripcion ?? ''}`.toLowerCase();
      const matchTexto = s ? texto.includes(s) : true;
      // NEW: modo "Ver inactivos" muestra exclusivamente estado=false; modo normal solo activos.
      // WHY: evitar mezclar activos e inactivos cuando el toggle admin está encendido.
      // IMPACT: filtrado local de la grilla; no altera la carga ni el resto de filtros.
      const isActive = resolveCategoriaActiva(c);
      const matchViewEstado = includeInactive ? !isActive : isActive;

      const matchEstado =
        estadoFiltro === 'todos'
          ? true
          : estadoFiltro === 'activo'
            ? isActive
            : !isActive;

      return matchTexto && matchEstado && matchViewEstado;
    });

    filtradas.sort((a, b) => {
      if (sortBy === 'nombre_asc') {
        return String(a?.nombre_categoria ?? '').localeCompare(String(b?.nombre_categoria ?? ''), 'es', { sensitivity: 'base' });
      }
      if (sortBy === 'nombre_desc') {
        return String(b?.nombre_categoria ?? '').localeCompare(String(a?.nombre_categoria ?? ''), 'es', { sensitivity: 'base' });
      }
      if (sortBy === 'codigo_asc') {
        return String(a?.codigo_categoria ?? '').localeCompare(String(b?.codigo_categoria ?? ''), 'es', { sensitivity: 'base' });
      }
      if (sortBy === 'codigo_desc') {
        return String(b?.codigo_categoria ?? '').localeCompare(String(a?.codigo_categoria ?? ''), 'es', { sensitivity: 'base' });
      }
      return Number(b?.id_categoria_producto ?? 0) - Number(a?.id_categoria_producto ?? 0);
    });

    return filtradas;
  }, [categoriasLocal, search, estadoFiltro, sortBy, includeInactive]);

  const hasActiveFilters = useMemo(
    () => search.trim() !== '' || estadoFiltro !== 'todos' || sortBy !== 'recientes',
    [search, estadoFiltro, sortBy]
  );

  const normalizedNombre = String(form?.nombre_categoria ?? '').trim().toUpperCase();
  const normalizedCodigo = normalizeCodigo(form?.codigo_categoria ?? '');

  const baseCategorias = Array.isArray(categoriasLocal) ? categoriasLocal : [];
  const isSameRecord = (cat) =>
    drawerMode === 'edit' &&
    Number(cat?.id_categoria_producto ?? 0) === Number(editId ?? 0);

  const nombreDuplicado =
    normalizedNombre.length > 0 &&
    baseCategorias.some((cat) => !isSameRecord(cat) && String(cat?.nombre_categoria ?? '').trim().toUpperCase() === normalizedNombre);

  const codigoDuplicado =
    normalizedCodigo.length > 0 &&
    baseCategorias.some((cat) => !isSameRecord(cat) && normalizeCodigo(cat?.codigo_categoria ?? '') === normalizedCodigo);

  const liveDuplicateErrors = {
    nombre_categoria: nombreDuplicado ? 'YA EXISTE UNA CATEGORIA CON ESE NOMBRE' : '',
    codigo_categoria: codigoDuplicado ? 'YA EXISTE UNA CATEGORIA CON ESE CODIGO' : ''
  };

  const nombreErrorMsg = formErrors.nombre_categoria || liveDuplicateErrors.nombre_categoria;
  const codigoErrorMsg = formErrors.codigo_categoria || liveDuplicateErrors.codigo_categoria;
  const hasLiveDuplicates = Boolean(liveDuplicateErrors.nombre_categoria || liveDuplicateErrors.codigo_categoria);

  const categoriasPages = useMemo(() => {
    const size = Math.max(1, cardsPerPage);
    const pages = [];
    for (let i = 0; i < categoriasFiltradas.length; i += size) {
      pages.push(categoriasFiltradas.slice(i, i + size));
    }
    return pages;
  }, [categoriasFiltradas, cardsPerPage]);
  const categoriasPageCount = Math.max(1, categoriasPages.length || 0);
  const currentCategoriasPage = categoriasPages[carouselPageIndex] || [];

  useEffect(() => {
    // NEW: mantiene el indice del carrusel dentro del rango valido al cambiar filtros o breakpoints.
    // WHY: conservar el patron paginado tipo Insumos sin dejar paginas vacias en Categorias.
    // IMPACT: solo corrige el estado visual del carrusel; no toca handlers ni datos.
    setCarouselPageIndex((prev) => Math.min(prev, Math.max(0, categoriasPageCount - 1)));
  }, [categoriasPageCount]);

  // NEW: referencia del registro en edición para aplicar las mismas reglas de bloqueo del card en el drawer responsive/desktop.
  // WHY: evitar bypass al intentar inactivar desde el checkbox `Activo` del formulario de edición.
  // IMPACT: solo deshabilita la opción de inactivar cuando el conteo de productos activos ya viene en la data.
  const editingCategoriaActual = useMemo(
    () => (Array.isArray(categoriasLocal) ? categoriasLocal.find((c) => Number(c?.id_categoria_producto ?? 0) === Number(editId ?? 0)) || null : null),
    [categoriasLocal, editId]
  );
  const editDrawerInactivationBlocked = useMemo(
    () => {
      if (drawerMode !== 'edit' || !editingCategoriaActual || !resolveCategoriaActiva(editingCategoriaActual)) return false;
      const count = getProductosAsignadosCount(editingCategoriaActual);
      return count !== null && count > 0;
    },
    [drawerMode, editingCategoriaActual]
  );

  // ==============================
  // CREAR / EDITAR
  // ==============================
  const onSave = async (e) => {
    e?.preventDefault?.();
    safeSetError('');

    const v = validarCategoria(form);
    const mergedErrors = {
      ...v.errors,
      ...(liveDuplicateErrors.nombre_categoria ? { nombre_categoria: liveDuplicateErrors.nombre_categoria } : {}),
      ...(liveDuplicateErrors.codigo_categoria ? { codigo_categoria: liveDuplicateErrors.codigo_categoria } : {})
    };
    setFormErrors(mergedErrors);
    if (!v.ok || hasLiveDuplicates) return;

    try {
      if (drawerMode === 'create') {
        await inventarioService.crearCategoria(v.cleaned);
        safeToast('CREADO', 'LA CATEGORIA SE CREO CORRECTAMENTE.', 'success');
      } else {
        if (!editId) return;

        // FUNCIONALIDAD: BACKEND ACTUALIZA POR CAMPO
        const updates = [
          ['nombre_categoria', v.cleaned.nombre_categoria],
          ['codigo_categoria', v.cleaned.codigo_categoria],
          ['descripcion', v.cleaned.descripcion ?? ''],
          ['estado', v.cleaned.estado]
        ];

        for (const [campo, valor] of updates) {
          await inventarioService.actualizarCategoriaCampo(editId, campo, valor);
        }

        // NEW: parche local/compartido del registro editado para evitar refetch visible de toda la grilla.
        // WHY: mejorar UX en desktop y mobile/tablet manteniendo el card estable tras guardar.
        // IMPACT: Productos/Insumos reciben el cambio si el padre expone `onCategoriaPatched`; create/delete siguen con refetch.
        patchCategoriaLocalById(editId, {
          nombre_categoria: v.cleaned.nombre_categoria,
          codigo_categoria: v.cleaned.codigo_categoria,
          descripcion: v.cleaned.descripcion ?? '',
          estado: v.cleaned.estado
        });

        safeToast('ACTUALIZADO', 'LA CATEGORIA SE ACTUALIZO CORRECTAMENTE.', 'success');
      }

      closeDrawer();
      // NEW: se evita refetch global en edit para no "recargar" visualmente toda la grilla.
      // WHY: el item editado ya se parchea localmente y en el estado compartido del modulo cuando hay callback.
      // IMPACT: create mantiene `reloadCategorias`; si el patch local fallara, el catch preserva el flujo y puede recargarse manualmente.
      const shouldReloadAfterSave = drawerMode === 'create';
      if (shouldReloadAfterSave && typeof reloadCategorias === 'function') await reloadCategorias();
    } catch (err) {
      const backendCode = String(err?.data?.code || '');
      const backendExactMessage = String(err?.data?.message || err?.data?.mensaje || '');
      if (Number(err?.status || 0) === 409 && backendCode === 'CATEGORY_HAS_ACTIVE_PRODUCTS') {
        // NEW: manejo explícito del bloqueo también en guardado por drawer (PUT estado=false).
        // WHY: responsive/desktop pueden intentar inactivar desde el checkbox "Activo"; debe mostrar el mismo mensaje y no guardar.
        // IMPACT: UI-only; el backend ya es la fuente de verdad con 409.
        safeSetError('');
        showDeleteBlockedAlert();
        if (v.cleaned?.estado === false) {
          setForm((s) => ({ ...s, estado: true }));
        }
        if (backendExactMessage) safeToast('BLOQUEADO', backendExactMessage, 'warning');
        return;
      }
      const msg = err?.message || 'ERROR GUARDANDO CATEGORIA';
      safeSetError(msg);
      safeToast('ERROR', msg, 'danger');
    }
  };

  // NEW: cambio rapido de estado desde la card sin abrir drawer.
  // WHY: homogeneizar acciones hover con el patron de Insumos.
  // IMPACT: reutiliza `actualizarCategoriaCampo` y recarga categorias existente.
  const _toggleEstadoCategoriaRapido = async (categoria, nextEstado) => {
    if (!categoria || quickTogglingEstadoId) return;
    setQuickTogglingEstadoId(categoria.id_categoria_producto);
    safeSetError('');
    try {
      const candidates = [nextEstado, nextEstado ? 1 : 0, nextEstado ? '1' : '0'];
      let updated = false;
      let lastError = null;
      for (const candidate of candidates) {
        try {
          await inventarioService.actualizarCategoriaCampo(categoria.id_categoria_producto, 'estado', candidate);
          updated = true;
          break;
        } catch (err) {
          lastError = err;
        }
      }
      if (!updated) throw (lastError || new Error('NO SE PUDO ACTUALIZAR EL ESTADO'));
      // NEW: patch local/compartido de estado para evitar refetch completo visible al activar/inactivar.
      // WHY: activar/inactivar solo afecta una card y sus KPIs; no requiere recarga total inmediata.
      // IMPACT: mantiene la grilla estable; si el backend cambia mas campos, un refetch posterior re-sincroniza.
      patchCategoriaLocalById(categoria.id_categoria_producto, { estado: !!nextEstado });
      safeToast('ACTUALIZADO', nextEstado ? 'CATEGORIA ACTIVADA.' : 'CATEGORIA INACTIVADA.', 'success');
    } catch (err) {
      const msg = err?.message || 'ERROR ACTUALIZANDO ESTADO DE CATEGORIA';
      safeSetError(msg);
      safeToast('ERROR', msg, 'danger');
    } finally {
      setQuickTogglingEstadoId(null);
    }
  };

  // ==============================
  // ELIMINAR
  // ==============================
  const eliminarConfirmado = async () => {
    const id = confirmModal.idToDelete;
    if (!id) return;

    safeSetError('');
    try {
      const categoriaActual = (categoriasLocal || []).find((c) => Number(c?.id_categoria_producto ?? 0) === Number(id ?? 0));
      const countProductos = getProductosAsignadosCount(categoriaActual);
      if (countProductos !== null && countProductos > 0) {
        closeConfirmDelete();
        safeSetError('');
        showDeleteBlockedAlert();
        return;
      }

      await inventarioService.eliminarCategoria(id);
      closeConfirmDelete();
      // NEW: la categoria inactivada permanece en memoria y cambia de vista por filtro local al instante.
      // WHY: evitar refetch visible y asegurar que aparezca de inmediato al activar "Ver inactivos".
      // IMPACT: conserva la UX estable de cards; el backend sigue siendo quien confirma la inactivacion.
      patchCategoriaLocalById(id, { estado: false });
      safeToast('INACTIVADA', 'LA CATEGORIA SE INACTIVO CORRECTAMENTE.', 'success');
    } catch (err) {
      const backendCode = String(err?.data?.code || '');
      const backendExactMessage = String(err?.data?.message || err?.data?.mensaje || '');
      if (Number(err?.status || 0) === 409 && backendCode === 'CATEGORY_HAS_ACTIVE_PRODUCTS') {
        closeConfirmDelete();
        safeSetError('');
        showDeleteBlockedAlert();
        if (backendExactMessage) safeToast('BLOQUEADO', backendExactMessage, 'warning');
        return;
      }
      const backendMessage = String(err?.data?.message || err?.data?.mensaje || err?.message || '').toLowerCase();
      const restrictionKeywords = ['foreign', 'constraint', 'referenc', 'fk', 'producto', 'asignad', 'uso', 'relacion'];
      const isRestriction = restrictionKeywords.some((k) => backendMessage.includes(k));
      // NEW: mensaje UX especifico cuando la categoria esta relacionada con productos.
      // WHY: la accion debe explicar claramente por que no se puede eliminar y que hacer.
      // IMPACT: solo cambia el texto mostrado al usuario; el flujo backend permanece igual.
      const msg = isRestriction
        ? CATEGORY_DELETE_BLOCKED_MESSAGE
        : (err?.message || 'ERROR INACTIVANDO CATEGORIA');
      if (isRestriction) {
        closeConfirmDelete();
        safeSetError('');
        showDeleteBlockedAlert();
      } else {
        safeSetError(msg);
        safeToast('ERROR', msg, 'danger');
      }
    }
  };

  // NEW: control centralizado del backdrop para drawers laterales (filtros + formulario).
  // WHY: replicar el patron de Insumos/Productos con un solo overlay que cierre el panel activo.
  // IMPACT: no cambia CRUD; solo comportamiento visual de drawers.
  const isAnyDrawerOpen = drawerOpen || filtersOpen;
  const closeAnyDrawer = () => {
    setDrawerOpen(false);
    setFiltersOpen(false);
  };
  const canTapCardToEdit = !isResponsiveViewport;

  // NEW: switch compacto del header para alternar INSUMOS/PRODUCTOS reutilizando el mismo estado `categoriaCatalogScope`.
  // WHY: mover el control al header principal y mantener una UX unificada sin tocar la lógica de paneles.
  // IMPACT: solo cambia presentación/ubicación del switch; el render condicional y CRUD permanecen intactos.
  const renderCatalogScopeSwitch = () => (
    <CompactHeaderSwitch
      value={categoriaCatalogScope}
      onChange={setCategoriaCatalogScope}
      ariaLabel="Cambiar catálogo de categorías"
    />
  );

  if (categoriaCatalogScope === 'insumos') {
    return (
      <CategoriasInsumosPanel
        categoriasInsumos={categoriasInsumos}
        loading={loadingCategoriasInsumos}
        error={errorCategoriasInsumos}
        setError={setErrorCategoriasInsumos}
        reloadCategoriasInsumos={reloadCategoriasInsumos}
        includeInactive={includeInactiveCategoriasInsumos}
        onIncludeInactiveChange={onIncludeInactiveCategoriasInsumosChange}
        onCategoriaInsumoPatched={onCategoriaInsumoPatched}
        openToast={openToast}
        catalogSwitch={renderCatalogScopeSwitch()}
        headerTitle={activeCategoriasHeaderCopy.title}
        headerSubtitle={activeCategoriasHeaderCopy.subtitle}
      />
    );
  }

  return (
    <>
      {/* NEW: helper class para habilitar sticky del header sin afectar otros cards reutilizados. */}
      {/* WHY: `position: sticky` falla si el contenedor mantiene `overflow: hidden`; el override se limita a este shell. */}
      {/* IMPACT: solo layout visual del header de Categorías; no cambia lógica ni eventos. */}
      <div className="inv-catpro-card inv-prod-card inv-cat-v2 inv-has-sticky-header mb-3">
        {/* FUNCIONALIDAD: HEADER */}
        <div className="inv-prod-header inv-cat-v2__header inv-cat-v3__header">
          {/* NEW: layout de header en dos columnas (izquierda: título+buscador / derecha: switch+acciones). */}
          {/* WHY: replicar la distribución de referencia manteniendo el mismo DOM funcional de búsqueda, switch y botones. */}
          {/* IMPACT: solo reorganiza presentación del header en Categorías; no modifica handlers ni lógica de estado. */}
          <div className="inv-cat-v3__layout">
            <div className="inv-cat-v3__title">
              <div className="inv-prod-title-wrap">
                <div className="inv-prod-title-row">
                  <i className="bi bi-tag inv-prod-title-icon" />
                  <span className="inv-prod-title">{activeCategoriasHeaderCopy.title}</span>
                </div>
                <div className="inv-prod-subtitle">{activeCategoriasHeaderCopy.subtitle}</div>
              </div>
            </div>

            <div className="inv-cat-v3__switch-slot">
              {renderCatalogScopeSwitch()}
            </div>

            <label className="inv-ins-search inv-cat-v3__search" aria-label="Buscar categorías">
              <i className="bi bi-search" />
              <input
                type="search"
                placeholder="Buscar por nombre, código o descripción..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>

            <div className="inv-prod-header-actions inv-ins-header-actions inv-cat-v2__actions inv-cat-v3__actions-stack">
              <button
                type="button"
                className={`inv-prod-toolbar-btn ${filtersOpen ? 'is-on' : ''}`}
                onClick={openFiltersDrawer}
                title="Filtros"
                aria-expanded={filtersOpen}
                aria-controls="inv-cat-filters-drawer"
              >
                <i className="bi bi-funnel" /> <span>Filtros</span>
              </button>

              <button
                type="button"
                className={`inv-prod-toolbar-btn inv-cat-v3__new-btn ${drawerOpen && drawerMode === 'create' ? 'is-on' : ''}`}
                onClick={openCreate}
                title="Nueva"
                aria-expanded={drawerOpen && drawerMode === 'create'}
                aria-controls="inv-cat-form-drawer"
              >
                <i className="bi bi-plus-circle" /> <span>Nuevo</span>
              </button>
            </div>
          </div>
        </div>

        {/* NEW: dashboards centrados bajo el header, replicando forma/jerarquía de Insumos. */}
        {/* WHY: unificar layout visual entre submódulos de inventario. */}
        {/* IMPACT: solo presentación; se reutiliza `kpis` existente. */}
        <div className="inv-prod-kpis inv-cat-v2__kpis inv-cat-unified-panel-shell" aria-label="Resumen de categorías">
          {renderKpiCard('total', 'Total', kpis.total)}
          {renderKpiCard('activas', 'Activas', kpis.activas, 'is-ok')}
          {renderKpiCard('inactivas', 'Inactivas', kpis.inactivas, 'is-empty')}
        </div>

        {/* FUNCIONALIDAD: BODY */}
        <div className="inv-catpro-body inv-prod-body p-3 inv-cat-unified-panel-shell">
          {deleteBlockedAlert ? (
            // NEW: alerta roja no bloqueante con auto-dismiss para restriccion de eliminacion por productos asignados.
            // WHY: reemplazar confirm modal cuando la categoria no se puede eliminar y permitir seguir usando la pantalla.
            // IMPACT: solo presentacion local en Categorias; no altera el flujo normal de eliminacion cuando si procede.
            <div className="alert alert-danger inv-cat-v2__delete-alert mb-3" role="alert" aria-live="assertive">
              {deleteBlockedAlert}
            </div>
          ) : null}
          {error ? (
            <div className="alert alert-danger mb-3" role="alert">
              {error}
            </div>
          ) : null}

          <div className="inv-prod-results-meta inv-cat-v2__results-meta inv-inventory-results-meta">
            <span>{loading ? 'Cargando categorías...' : `${categoriasFiltradas.length} resultados`}</span>
            <span>{loading ? '' : `Total: ${categoriasDatasetGlobal.length}`}</span>
            {/* NEW: toggle admin para pedir categorias inactivas al backend sin cambiar filtros locales. */}
            {/* WHY: los GET de inventario retornan activos por defecto tras el cambio a soft delete. */}
            {/* IMPACT: recarga usando el mismo endpoint; no altera contratos ni layout principal. */}
            <label className="form-check form-switch mb-0 inv-catpro-inline-toggle">
              <input
                className="form-check-input"
                type="checkbox"
                checked={!!includeInactive}
                onChange={() => { void toggleIncludeInactive(); }}
                disabled={loading}
              />
              <span className="form-check-label">Ver inactivos</span>
            </label>
            {hasActiveFilters ? (
              <span className="inv-prod-active-filter-pill">
                <span>Filtros activos</span>
                {/* NEW: acceso rápido para limpiar todos los filtros desde el resumen. */}
                {/* WHY: reutilizar el reset existente sin abrir el drawer de filtros. */}
                {/* IMPACT: usa `clearAllFilters`; la lógica de filtrado permanece intacta. */}
                <button
                  type="button"
                  className="inv-prod-active-filter-pill__clear"
                  onClick={clearAllFilters}
                  aria-label="Limpiar filtros"
                  title="Limpiar filtros"
                >
                  <i className="bi bi-x-lg" aria-hidden="true" />
                </button>
              </span>
            ) : null}
          </div>

          {/* FUNCIONALIDAD: LISTADO */}
          <div className={`inv-catpro-list ${drawerOpen || filtersOpen ? 'drawer-open' : ''}`}>
            {loading ? (
              <div className="inv-catpro-loading" role="status" aria-live="polite">
                <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                <span>Cargando categorias...</span>
              </div>
            ) : categoriasFiltradas.length === 0 ? (
              <div className="inv-catpro-empty">
                <div className="inv-catpro-empty-icon">
                  <i className="bi bi-inbox-fill" />
                </div>
                <div className="inv-catpro-empty-title">No hay categorias para mostrar</div>
                <div className="inv-catpro-empty-sub">
                  {hasActiveFilters ? 'Prueba limpiar filtros o crea una nueva categoria.' : 'Crea tu primera categoria.'}
                </div>

                <div className="d-flex gap-2 justify-content-center flex-wrap">
                  {hasActiveFilters ? (
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={clearAllFilters}
                    >
                      Limpiar filtros
                    </button>
                  ) : null}

                  <button type="button" className="btn btn-primary" onClick={openCreate}>
                    Nueva categoria
                  </button>
                </div>
              </div>
            ) : (
              <div className="inv-catpro-carousel-shell">
                <div className="inv-catpro-carousel-meta">
                  <span>{`Pagina ${carouselPageIndex + 1} de ${categoriasPageCount}`}</span>
                  <span>{`${categoriasFiltradas.length} categorias visibles`}</span>
                </div>
                <div className="inv-catpro-carousel-wrap inv-prod-carousel-stage inv-catpro-carousel-stage">
                {/* AJUSTE: se reutiliza el stage de Productos para que las flechas flotantes hereden el mismo layout visual. */}
                <button
                  type="button"
                  // AJUSTE: se replica el boton flotante del carrusel de Productos.
                  className={`btn inv-prod-carousel-float is-prev ${carouselPageIndex > 0 ? 'is-visible' : ''}`}
                  onClick={() => setCarouselPageIndex((prev) => Math.max(0, prev - 1))}
                  aria-label="Pagina anterior"
                  disabled={carouselPageIndex <= 0}
                >
                  <i className="bi bi-chevron-left" />
                </button>

                <div className={`inv-catpro-grid inv-catpro-grid-page ${cardsPerPage >= 6 ? 'cols-3' : cardsPerPage >= 4 ? 'cols-2' : 'cols-1'}`} key={`categorias-page-${carouselPageIndex}`}>
                          {currentCategoriasPage.map((c, idx) => {
                            const globalIdx = carouselPageIndex * cardsPerPage + idx;
                            const isActive = resolveCategoriaActiva(c);
                            const code = c?.codigo_categoria ?? '';
                            const dotClass = isActive ? 'ok' : 'off';
                            const isToggling = quickTogglingEstadoId === c?.id_categoria_producto;
                            const isInactivateUiBlocked = isActive && isCategoriaUiBlockedForInactivation(c);

                            // AJUSTE: se mantiene fallback del card actual cuando el modo premium esta desactivado.
                            if (!USE_PREMIUM_CATEGORY_CARDS) {
                              return (
                                <div
                                  key={c?.id_categoria_producto ?? globalIdx}
                                  className={`inv-catpro-item inv-anim-in ${isActive ? '' : 'is-inactive-state'}`}
                                  style={{ animationDelay: `${Math.min(globalIdx * 40, 240)}ms` }}
                                  role={canTapCardToEdit ? 'button' : undefined}
                                  tabIndex={canTapCardToEdit ? 0 : undefined}
                                  // AJUSTE: la edicion ahora se abre al interactuar con el card completo.
                                  onClick={canTapCardToEdit ? () => openEdit(c) : undefined}
                                  // NUEVO: soporte teclado para abrir modal desde el card.
                                  onKeyDown={canTapCardToEdit
                                    ? (e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                          e.preventDefault();
                                          openEdit(c);
                                        }
                                      }
                                    : undefined}
                                >
                                  <div className="inv-catpro-item-top">
                                    <div>
                                      <div className="fw-bold">
                                        {globalIdx + 1}. {c?.nombre_categoria ?? ''}
                                      </div>
                                      <div className="text-muted small">{c?.descripcion || 'Sin descripcion'}</div>
                                    </div>

                                      <span className={`inv-ins-card__badge ${isActive ? 'is-ok' : 'is-inactive'}`}>
                                        {isActive ? 'ACTIVO' : 'INACTIVO'}
                                      </span>
                                  </div>

                                  <div className="inv-catpro-meta inv-catpro-item-footer">
                                    <div className="inv-catpro-code-wrap">
                                      <span className={`inv-catpro-state-dot ${dotClass}`} />
                                      <span className="inv-catpro-code">{code}</span>
                                    </div>

                                    <div className="inv-catpro-meta-actions inv-catpro-action-bar">
                                      {/* AJUSTE: boton editar se elimina visualmente; editar se dispara desde el card. */}

                                      {/* NEW: el boton restante cambia de accion segun `isActive` para soportar activacion directa. */}
                                      {/* WHY: corregir coherencia de cards en modo "solo inactivos" sin duplicar botones. */}
                                      {/* IMPACT: usa el mismo flujo de confirmacion para inactivar y el update existente para activar. */}
                                      <button
                                        type="button"
                                        className={`inv-catpro-action ${isActive ? 'danger' : 'edit'} inv-catpro-action-compact`}
                                        // NEW: accion de estado dinamica en card (activo => inactivar, inactivo => activar).
                                        // WHY: permitir reactivacion directa desde el listado de inactivos sin romper el flujo de confirmacion al inactivar.
                                        // IMPACT: reutiliza handlers/endpoints existentes (`openConfirmDelete` y `_toggleEstadoCategoriaRapido`).
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (isActive) {
                                            openConfirmDelete(c?.id_categoria_producto, c?.nombre_categoria);
                                            return;
                                          }
                                          void _toggleEstadoCategoriaRapido(c, true);
                                        }}
                                        onKeyDown={(e) => e.stopPropagation()}
                                        title={isInactivateUiBlocked ? 'No se puede inactivar: tiene productos activos asignados' : (isActive ? 'Inactivar' : 'Activar')}
                                        aria-label={`${isActive ? 'Inactivar' : 'Activar'} ${c?.nombre_categoria || 'categoria'}`}
                                        disabled={isToggling || isInactivateUiBlocked}
                                      >
                                        <i className={`bi ${isActive ? 'bi-slash-circle' : 'bi-check-circle'}`} />
                                        <span className="inv-catpro-action-label">{isActive ? 'Inactivar' : 'Activar'}</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div
                                key={c?.id_categoria_producto ?? globalIdx}
                                // AJUSTE: card premium agrega capas visuales, manteniendo handlers y estructura base.
                                className={`inv-catpro-item inv-cat-card inv-anim-in ${isActive ? '' : 'is-inactive-state'}`}
                                style={{ animationDelay: `${Math.min(globalIdx * 40, 240)}ms` }}
                                role={canTapCardToEdit ? 'button' : undefined}
                                tabIndex={canTapCardToEdit ? 0 : undefined}
                                // AJUSTE: la edicion ahora se abre al interactuar con el card completo.
                                onClick={canTapCardToEdit ? () => openEdit(c) : undefined}
                                // NUEVO: soporte teclado para abrir modal desde el card.
                                onKeyDown={canTapCardToEdit
                                  ? (e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        openEdit(c);
                                      }
                                    }
                                  : undefined}
                              >
                                {/* NEW: watermark icon sutil reemplaza el circulo decorativo para reforzar identidad de categorias. */}
                                {/* WHY: mantener un acento visual elegante sin interferir con contenido ni interacciones. */}
                                {/* IMPACT: solo cambia capa decorativa del card; no altera handlers ni estructura funcional. */}
                                <div className="inv-cat-card__halo" aria-hidden="true">
                                  <i className="bi bi-tags" />
                                </div>
                                <div className="inv-catpro-item-top">
                                  <div className="inv-cat-card__title-wrap">
                                    {/* NUEVO: icono visual del card con micro-animacion en hover/focus. */}
                                    <span className="inv-cat-card__icon" aria-hidden="true">
                                      <i className="bi bi-tag" />
                                    </span>
                                    <div>
                                      <div className="fw-bold">
                                        {globalIdx + 1}. {c?.nombre_categoria ?? ''}
                                      </div>
                                      <div className="text-muted small">{c?.descripcion || 'Sin descripcion'}</div>
                                    </div>
                                  </div>
                                  <span className={`inv-ins-card__badge ${isActive ? 'is-ok' : 'is-inactive'}`}>
                                    {isActive ? 'ACTIVO' : 'INACTIVO'}
                                  </span>
                                </div>

                                <div className="inv-catpro-meta inv-catpro-item-footer">
                                  <div className="inv-catpro-code-wrap">
                                    <span className={`inv-catpro-state-dot ${dotClass}`} />
                                    <span className="inv-catpro-code">{code}</span>
                                  </div>

                                  <div className="inv-catpro-meta-actions inv-catpro-action-bar inv-cat-card__actions">
                                      {/* NEW: acciones hover para igualar patrón de Insumos/Productos. */}
                                      {/* WHY: exponer edición/estado/eliminación de forma consistente sin perder click en card. */}
                                      {/* IMPACT: reutiliza los mismos handlers/endpoints existentes. */}
                                      <button
                                        type="button"
                                        className="inv-catpro-action edit inv-catpro-action-compact"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openEdit(c);
                                        }}
                                        onKeyDown={(e) => e.stopPropagation()}
                                        title="Editar"
                                        disabled={isToggling}
                                      >
                                        <i className="bi bi-pencil-square" />
                                        <span className="inv-catpro-action-label">Editar</span>
                                      </button>

                                      {/* NEW: se oculta el botón intermedio de activar/inactivar para evitar acción duplicada en el card. */}
                                      {/* WHY: dejar solo el botón de advertencia/confirmación (`openConfirmDelete`) como flujo correcto en Categorías. */}
                                      {/* IMPACT: no elimina handlers ni lógica; solo quita un render duplicado en la UI del card. */}

                                      <button
                                        type="button"
                                        className={`inv-catpro-action ${isActive ? 'danger' : 'edit'} inv-catpro-action-compact`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (isActive) {
                                          openConfirmDelete(c?.id_categoria_producto, c?.nombre_categoria);
                                          return;
                                        }
                                        void _toggleEstadoCategoriaRapido(c, true);
                                      }}
                                      onKeyDown={(e) => e.stopPropagation()}
                                        title={isInactivateUiBlocked ? 'No se puede inactivar: tiene productos activos asignados' : (isActive ? 'Inactivar' : 'Activar')}
                                        aria-label={`${isActive ? 'Inactivar' : 'Activar'} ${c?.nombre_categoria || 'categoria'}`}
                                        disabled={isToggling || isInactivateUiBlocked}
                                      >
                                        <i className={`bi ${isActive ? 'bi-slash-circle' : 'bi-check-circle'}`} />
                                        <span className="inv-catpro-action-label">{isActive ? 'Inactivar' : 'Activar'}</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                </div>

                <button
                  type="button"
                  // AJUSTE: se replica el boton flotante del carrusel de Productos.
                  className={`btn inv-prod-carousel-float is-next ${carouselPageIndex < categoriasPageCount - 1 ? 'is-visible' : ''}`}
                  onClick={() => setCarouselPageIndex((prev) => Math.min(categoriasPageCount - 1, prev + 1))}
                  aria-label="Pagina siguiente"
                  disabled={carouselPageIndex >= categoriasPageCount - 1}
                >
                  <i className="bi bi-chevron-right" />
                </button>
              </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FUNCIONALIDAD: FAB SOLO RESPONSIVE */}
      <button
        type="button"
        className={`inv-catpro-fab d-md-none ${isAnyDrawerOpen ? 'is-hidden' : ''}`}
        onClick={openCreate}
        title="Nueva"
      >
        <i className="bi bi-plus" />
      </button>

      {/* NEW: backdrop compartido para drawers laterales (filtros y formulario). */}
      {/* WHY: mantener el patron visual de Insumos/Productos y evitar overlays duplicados. */}
      {/* IMPACT: solo controla cierre visual de paneles laterales. */}
      <div className={`inv-prod-drawer-backdrop inv-cat-v2__drawer-backdrop ${isAnyDrawerOpen ? 'show' : ''}`} onClick={closeAnyDrawer} aria-hidden={!isAnyDrawerOpen} />

      {/* NEW: drawer de filtros desde la derecha igual al patron de Insumos/Productos. */}
      {/* WHY: mover filtros a panel lateral con Aplicar/Limpiar y mantener header limpio. */}
      {/* IMPACT: reutiliza `filtersDraft`; filtrado sigue siendo local sin tocar servicios. */}
      <aside
        className={`inv-prod-drawer inv-cat-v2__drawer inv-cat-v2__drawer--filters ${filtersOpen ? 'show' : ''}`}
        id="inv-cat-filters-drawer"
        role="dialog"
        aria-modal="true"
        aria-hidden={!filtersOpen}
      >
        <div className="inv-prod-drawer-body inv-cat-v2__drawer-body">
          <div className="inv-cat-create-hero inv-cat-filter-hero">
            <button type="button" className="inv-prod-drawer-close inv-cat-create-hero__close" onClick={closeFiltersDrawer} title="Cerrar">
              <i className="bi bi-x-lg" />
            </button>
            <div className="inv-cat-create-hero__icon">
              <i className="bi bi-funnel" aria-hidden="true" />
            </div>
            <div className="inv-cat-create-hero__copy">
              <div className="inv-cat-create-hero__kicker">Vista De Filtros</div>
              <div className="inv-cat-create-hero__title">Ajusta el estado y el orden del catalogo</div>
            </div>
            <div className="inv-cat-create-hero__chips">
              <span className="inv-cat-create-hero__chip">
                <i className="bi bi-sliders2" aria-hidden="true" />
                {filtersDraft.estadoFiltro === 'activo'
                  ? 'Solo Activas'
                  : filtersDraft.estadoFiltro === 'inactivo'
                    ? 'Solo Inactivas'
                    : 'Todas Las Categorias'}
              </span>
              <span className="inv-cat-create-hero__chip">
                <i className="bi bi-arrow-down-up" aria-hidden="true" />
                {CATEGORY_FILTER_SORT_LABELS[filtersDraft.sortBy] || 'Mas recientes'}
              </span>
            </div>
          </div>

          <div className="inv-cat-filter-grid">
            <div className="inv-prod-drawer-section inv-cat-filter-card">
              <div className="inv-prod-drawer-section-title">Estado</div>
              <div className="inv-ins-chip-grid">
                <button
                  type="button"
                  className={`inv-ins-chip ${filtersDraft.estadoFiltro === 'todos' ? 'is-active' : ''}`}
                  onClick={() => setFiltersDraft((s) => ({ ...s, estadoFiltro: 'todos' }))}
                >
                  Todas
                </button>
                <button
                  type="button"
                  className={`inv-ins-chip ${filtersDraft.estadoFiltro === 'activo' ? 'is-active' : ''}`}
                  onClick={() => setFiltersDraft((s) => ({ ...s, estadoFiltro: 'activo' }))}
                >
                  Activas
                </button>
                <button
                  type="button"
                  className={`inv-ins-chip ${filtersDraft.estadoFiltro === 'inactivo' ? 'is-active' : ''}`}
                  onClick={() => setFiltersDraft((s) => ({ ...s, estadoFiltro: 'inactivo' }))}
                >
                  Inactivas
                </button>
              </div>
              <div className="inv-ins-help">Selecciona un estado o deja "Todas".</div>
            </div>

            <div className="inv-prod-drawer-section inv-cat-filter-card">
              <div className="inv-prod-drawer-section-title">Orden</div>
              <label className="form-label" htmlFor="cat_filter_sort">Ordenar por</label>
              <select
                id="cat_filter_sort"
                className="form-select"
                value={filtersDraft.sortBy}
                onChange={(e) => setFiltersDraft((s) => ({ ...s, sortBy: e.target.value }))}
              >
                <option value="recientes">Mas recientes</option>
                <option value="nombre_asc">Nombre (A-Z)</option>
                <option value="nombre_desc">Nombre (Z-A)</option>
                <option value="codigo_asc">Codigo (A-Z)</option>
                <option value="codigo_desc">Codigo (Z-A)</option>
              </select>
            </div>
          </div>

          <div className="inv-prod-drawer-actions inv-cat-v2__drawer-actions inv-cat-filter-actions">
            <button type="button" className="btn inv-prod-btn-subtle" onClick={clearVisualFilters}>
              Limpiar
            </button>
            <button type="button" className="btn inv-prod-btn-primary" onClick={applyFiltersDrawer}>
              Aplicar
            </button>
          </div>
        </div>
      </aside>

      {/* AJUSTE: modal de categorias con patron lateral derecho igual al de Productos. */}
      <aside
        className={`inv-prod-drawer inv-cat-v2__drawer ${drawerMode === 'create' ? 'inv-cat-v2__drawer--create' : 'inv-cat-v2__drawer--edit'} ${drawerOpen ? 'show' : ''}`}
        id="inv-cat-form-drawer"
        role="dialog"
        aria-modal="true"
        aria-hidden={!drawerOpen}
      >
        <form className={`inv-prod-drawer-body inv-catpro-drawer-body-lite inv-catpro-drawer-body-lite--premium ${drawerMode === 'create' ? 'inv-catpro-drawer-body-lite--create' : 'inv-catpro-drawer-body-lite--edit'}`} onSubmit={onSave}>
          {false ? (
            <div className="inv-cat-create-hero">
              {/* NEW: hero visual exclusivo del modo nuevo para que el alta se sienta mas premium. */}
              {/* WHY: el usuario pidio que los modales de nuevo en Categorias se vean mas profesionales y llamativos. */}
              {/* IMPACT: solo presentacion del drawer de create; campos, validacion y submit siguen iguales. */}
              <div className="inv-cat-create-hero__icon">
                <i className="bi bi-stars" aria-hidden="true" />
              </div>
              <div className="inv-cat-create-hero__copy">
                <div className="inv-cat-create-hero__kicker">Nuevo registro</div>
                <div className="inv-cat-create-hero__title">Organiza mejor tu catálogo</div>
                <div className="inv-cat-create-hero__text">Define una categoría clara para que productos y vistas administrativas se entiendan al instante.</div>
              </div>
              <div className="inv-cat-create-hero__chips">
                <span className="inv-cat-create-hero__chip"><i className="bi bi-upc-scan" aria-hidden="true" /> {form.codigo_categoria || PRODUCT_CATEGORY_CODE_PREFIX}</span>
                <span className="inv-cat-create-hero__chip"><i className="bi bi-check2-circle" aria-hidden="true" /> Activa por defecto</span>
              </div>
            </div>
          ) : null}

          {/* NEW: hero premium compartido entre crear y editar categorias. */}
          {/* WHY: el usuario pidio el mismo estilo en editar y quitar el texto descriptivo del bloque superior. */}
          {/* IMPACT: solo cambia la presentacion del drawer; el formulario conserva el mismo comportamiento. */}
          <div className={`inv-cat-create-hero ${drawerMode === 'create' ? 'is-create' : 'is-edit'}`}>
            {/* NEW: cierre embebido en el hero para retirar el header redundante del drawer. */}
            {/* WHY: el usuario pidio una sola cabecera visible en nuevo/editar. */}
            {/* IMPACT: el boton cerrar mantiene el mismo handler, solo cambia de posicion visual. */}
            <button type="button" className="inv-prod-drawer-close inv-cat-create-hero__close" onClick={closeDrawer} title="Cerrar">
              <i className="bi bi-x-lg" />
            </button>
            <div className="inv-cat-create-hero__icon">
              <i className="bi bi-stars" aria-hidden="true" />
            </div>
              <div className="inv-cat-create-hero__copy">
               <div className="inv-cat-create-hero__kicker">Catalogo de Productos</div>
               <div className="inv-cat-create-hero__title">{drawerMode === 'create' ? 'Nueva Categoria' : 'Editar Categoria'}</div>
            </div>
            <div className="inv-cat-create-hero__chips">
              <span className="inv-cat-create-hero__chip"><i className="bi bi-upc-scan" aria-hidden="true" /> {form.codigo_categoria || PRODUCT_CATEGORY_CODE_PREFIX}</span>
              <span className="inv-cat-create-hero__chip"><i className="bi bi-check2-circle" aria-hidden="true" /> {form.estado ? 'Estado Activo' : 'Estado Inactivo'}</span>
            </div>
          </div>

          <div className={`inv-cat-create-grid ${drawerMode === 'create' ? 'is-create' : 'is-edit'}`}>
            <div className="mb-2">
            <label className="form-label">Nombre</label>
            <input
              className={`form-control ${nombreErrorMsg ? 'is-invalid' : ''}`}
              value={form.nombre_categoria}
              onChange={(e) => setForm((s) => ({ ...s, nombre_categoria: normalizeCategoriaTextInput('nombre_categoria', e.target.value) }))}
              placeholder="Ej: Bebidas"
            />
            {nombreErrorMsg ? <div className="invalid-feedback d-block">{nombreErrorMsg}</div> : null}
          </div>

          <div className="mb-2">
            <label className="form-label">Codigo</label>
            <input
              className={`form-control ${codigoErrorMsg ? 'is-invalid' : ''}`}
              value={form.codigo_categoria}
              onChange={(e) => setForm((s) => ({ ...s, codigo_categoria: normalizeCodigo(e.target.value) }))}
              placeholder="Ej: PRO-BEB"
            />
            {codigoErrorMsg ? <div className="invalid-feedback d-block">{codigoErrorMsg}</div> : null}
          </div>
          </div>

          <div className="mb-2">
            <label className="form-label">Descripcion (Opcional)</label>
            <input
              className={`form-control ${formErrors.descripcion ? 'is-invalid' : ''}`}
              value={form.descripcion}
              onChange={(e) => setForm((s) => ({ ...s, descripcion: normalizeCategoriaTextInput('descripcion', e.target.value) }))}
              placeholder="Ej: Categoria para bebidas frias y calientes"
            />
            {formErrors.descripcion ? <div className="invalid-feedback">{formErrors.descripcion}</div> : null}
          </div>

          <div className={`form-check mt-2 mb-3 inv-catpro-form-check-row ${form.estado ? 'is-active' : 'is-inactive'}`}>
              <input
                className="form-check-input"
                type="checkbox"
                id="cat_estado"
              checked={!!form.estado}
              // NEW: bloquea la inactivación desde el checkbox cuando la categoría tiene productos activos (si el conteo está disponible).
              // WHY: mantener el mismo comportamiento en desktop y responsive que en la acción principal de la card.
              // IMPACT: solo UI del drawer; el backend sigue validando y devolviendo 409 como fuente de verdad.
              disabled={Boolean(loading) || (editDrawerInactivationBlocked && !!form.estado)}
              onChange={(e) => setForm((s) => ({ ...s, estado: e.target.checked }))}
              />
              <label className="form-check-label" htmlFor="cat_estado">
                {form.estado ? 'Activo' : 'Inactivo'}
              </label>
            {editDrawerInactivationBlocked && !!form.estado ? (
              <div className="form-text text-danger">{CATEGORY_DELETE_BLOCKED_MESSAGE}</div>
            ) : null}
          </div>

          <div className={`d-flex gap-2 ${drawerMode === 'create' ? 'inv-cat-create-actions' : 'inv-cat-edit-actions'}`}>
            <button type="button" className="btn inv-prod-btn-subtle flex-fill" onClick={closeDrawer}>
              Cancelar
            </button>
            <button type="submit" className="btn inv-prod-btn-primary flex-fill" disabled={loading || hasLiveDuplicates}>
              {loading ? 'Cargando...' : drawerMode === 'create' ? 'Crear' : 'Guardar'}
            </button>
          </div>
        </form>
      </aside>

      {/* FUNCIONALIDAD: MODAL CONFIRMAR INACTIVACION */}
      {confirmModal.show && (
        <div className="inv-pro-confirm-backdrop" role="dialog" aria-modal="true" onClick={closeConfirmDelete}>
          <div className="inv-pro-confirm-panel inv-pro-confirm-panel--danger" onClick={(e) => e.stopPropagation()}>
            <div className="inv-pro-confirm-glow" aria-hidden="true" />

            <div className="inv-pro-confirm-head">
              <div className="inv-pro-confirm-head-main">
                <div className="inv-pro-confirm-head-icon">
                  <i className={INACTIVATE_CONFIRM_COPY.iconClass} />
                </div>
                <div className="inv-pro-confirm-head-copy">
                  {/* NEW: etiqueta contextual del módulo para alinear la presentación con Productos e Insumos. */}
                  {/* WHY: el rediseño pide una línea visual unificada entre los tres modales de Inventario. */}
                  {/* IMPACT: solo mejora el encabezado del modal; el flujo de confirmación no cambia. */}
                  <div className="inv-pro-confirm-kicker">Categorías</div>
                  <div className="inv-pro-confirm-title">{INACTIVATE_CONFIRM_COPY.title}</div>
                  <div className="inv-pro-confirm-sub">{INACTIVATE_CONFIRM_COPY.subtitle}</div>
                </div>
              </div>
              <button type="button" className="inv-pro-confirm-close" onClick={closeConfirmDelete} aria-label="Cerrar">
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <div className="inv-pro-confirm-body">
              {/* NEW: nota operativa corta para explicar el efecto de la inactivación. */}
              {/* WHY: hacer el modal más claro y profesional sin agregar pasos extra al usuario. */}
              {/* IMPACT: solo agrega contexto visual; no altera la validación ni la llamada al backend. */}
              <div className="inv-pro-confirm-note">
                <i className="bi bi-shield-exclamation" aria-hidden="true" />
                <span>La categoría se moverá a inactivos y podrás volver a activarla cuando corresponda.</span>
              </div>

              <div className="inv-pro-confirm-question">{INACTIVATE_CONFIRM_COPY.question}</div>
              <div className="inv-pro-confirm-name">
                <div className="inv-pro-confirm-name-label">Registro seleccionado</div>
                <div className="inv-pro-confirm-name-value">
                  <i className={INACTIVATE_CONFIRM_COPY.iconClass} />
                  <span>{confirmModal.nombre || INACTIVATE_CONFIRM_COPY.fallbackName}</span>
                </div>
              </div>
            </div>

            <div className="inv-pro-confirm-footer">
              <button type="button" className="btn inv-pro-btn-cancel" onClick={closeConfirmDelete}>
                Cancelar
              </button>
              <button type="button" className="btn inv-pro-btn-danger" onClick={eliminarConfirmado}>
                <i className={INACTIVATE_CONFIRM_COPY.iconClass} />
                <span>Inactivar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CategoriasTab;

