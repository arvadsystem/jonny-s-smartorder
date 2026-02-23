import { useEffect, useMemo, useRef, useState } from 'react';
import { inventarioService } from '../../../services/inventarioService';

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

const CategoriasTab = ({
  categorias = [],
  loading = false,
  error = '',
  setError,
  reloadCategorias,
  onCategoriaPatched,
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

  const [form, setForm] = useState({
    nombre_categoria: '',
    codigo_categoria: '',
    descripcion: '',
    estado: true
  });

  const [formErrors, setFormErrors] = useState({});
  const carouselRef = useRef(null);
  // NEW: espejo local de categorias para parches parciales en edit/activar-inactivar (desktop y responsive).
  // WHY: evitar refetch completo visible de la grilla tras cambios de un solo item.
  // IMPACT: sincroniza con props `categorias`; si hay recarga del padre, prevalece la data remota.
  const [categoriasLocal, setCategoriasLocal] = useState(() => (Array.isArray(categorias) ? categorias : []));
  // NEW: flag de viewport responsive siguiendo breakpoints estandar del modulo (<= 991.98px).
  // WHY: aplicar cambios exclusivamente mobile/tablet sin afectar desktop.
  // IMPACT: controla UX de taps, drawers y estrategia de actualizacion local.
  const [isResponsiveViewport, setIsResponsiveViewport] = useState(() =>
    typeof window === 'undefined' ? false : window.innerWidth <= 991.98
  );

  const [cardsPerPage, setCardsPerPage] = useState(() =>
    typeof window === 'undefined' ? 6 : resolveCardsPerPage(window.innerWidth)
  );
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
    setCategoriasLocal(Array.isArray(categorias) ? categorias : []);
  }, [categorias]);

  const openCreate = () => {
    // FUNCIONALIDAD: ABRIR DRAWER CREAR
    // NEW: se cierra drawer de filtros para mantener un solo panel lateral abierto.
    // WHY: mismo patron de exclusividad usado en Insumos/Productos.
    // IMPACT: mejora UX; no afecta CRUD.
    setFiltersOpen(false);
    setDrawerMode('create');
    setEditId(null);
    setForm({ nombre_categoria: '', codigo_categoria: '', descripcion: '', estado: true });
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

  // ==============================
  // ELIMINAR (CONFIRMACION)
  // ==============================
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    idToDelete: null,
    nombre: ''
  });

  const openConfirmDelete = (id, nombre) => setConfirmModal({ show: true, idToDelete: id, nombre: nombre || '' });
  const closeConfirmDelete = () => setConfirmModal({ show: false, idToDelete: null, nombre: '' });

  // ==============================
  // HELPERS
  // ==============================
  const normalizeCodigo = (value) =>
    String(value ?? '')
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/[^A-Z0-9_]/g, '');

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
    if (!/^[A-Z0-9_]+$/.test(codigo)) errors.codigo_categoria = 'SOLO MAYUSCULAS, NUMEROS O _ (SIN ESPACIOS)';

    if (descripcion.length > 150) errors.descripcion = 'MAXIMO 150 CARACTERES';

    const cleaned = { nombre_categoria: nombre, codigo_categoria: codigo, estado };
    // FUNCIONALIDAD: NO ENVIAR NULL, SOLO SI HAY TEXTO
    if (descripcion) cleaned.descripcion = descripcion;

    return { ok: Object.keys(errors).length === 0, errors, cleaned };
  };

  // NEW: detecta conteo de productos si el backend ya lo incluye en la categoria.
  // WHY: evitar llamada DELETE cuando el frontend conoce que existe relacion con productos.
  // IMPACT: usa solo campos existentes si vienen; si no, cae al manejo backend.
  const getProductosAsignadosCount = (categoria) => {
    const candidates = [
      categoria?.cantidad_productos,
      categoria?.productos_count,
      categoria?.total_productos,
      categoria?.conteo_productos
    ];
    for (const raw of candidates) {
      const parsed = Number.parseInt(String(raw ?? ''), 10);
      if (!Number.isNaN(parsed) && parsed >= 0) return parsed;
    }
    return null;
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
  const kpis = useMemo(() => {
    const total = Array.isArray(categoriasLocal) ? categoriasLocal.length : 0;
    const activas = (categoriasLocal || []).filter((c) => !!c?.estado).length;
    const inactivas = total - activas;
    return { total, activas, inactivas };
  }, [categoriasLocal]);

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

      const matchEstado =
        estadoFiltro === 'todos'
          ? true
          : estadoFiltro === 'activo'
            ? !!c?.estado
            : !c?.estado;

      return matchTexto && matchEstado;
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
  }, [categoriasLocal, search, estadoFiltro, sortBy]);

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

  // ==============================
  // CREAR / EDITAR
  // ==============================
  const scrollCarousel = (direction) => {
    const node = carouselRef.current;
    if (!node) return;
    const delta = direction === 'next' ? node.clientWidth : -node.clientWidth;
    node.scrollBy({ left: delta, behavior: 'smooth' });
  };

  const onCarouselWheel = (e) => {
    const node = carouselRef.current;
    if (!node) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      // En algunos navegadores el listener wheel se ejecuta como passive.
      // Evitamos preventDefault para no disparar warnings en consola.
      node.scrollLeft += e.deltaY;
    }
  };

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
      const msg = err?.message || 'ERROR GUARDANDO CATEGORIA';
      safeSetError(msg);
      safeToast('ERROR', msg, 'danger');
    }
  };

  // NEW: cambio rapido de estado desde la card sin abrir drawer.
  // WHY: homogeneizar acciones hover con el patron de Insumos.
  // IMPACT: reutiliza `actualizarCategoriaCampo` y recarga categorias existente.
  const toggleEstadoCategoriaRapido = async (categoria, nextEstado) => {
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
        // NEW: validacion preventiva si el frontend ya conoce productos asignados.
        // WHY: evita request innecesaria y da feedback mas claro al usuario.
        // IMPACT: no cambia backend; solo mejora UX.
        const msg = 'NO SE PUEDE ELIMINAR LA CATEGORIA PORQUE TIENE PRODUCTOS ASIGNADOS. REASIGNA LOS PRODUCTOS Y VUELVE A INTENTAR.';
        closeConfirmDelete();
        safeSetError(msg);
        safeToast('CATEGORIA EN USO', msg, 'warning');
        return;
      }

      await inventarioService.eliminarCategoria(id);
      closeConfirmDelete();
      if (typeof reloadCategorias === 'function') await reloadCategorias();
      safeToast('ELIMINADO', 'LA CATEGORIA SE ELIMINO CORRECTAMENTE.', 'success');
    } catch (err) {
      const backendMessage = String(err?.data?.message || err?.data?.mensaje || err?.message || '').toLowerCase();
      const restrictionKeywords = ['foreign', 'constraint', 'referenc', 'fk', 'producto', 'asignad', 'uso', 'relacion'];
      const isRestriction = restrictionKeywords.some((k) => backendMessage.includes(k));
      // NEW: mensaje UX especifico cuando la categoria esta relacionada con productos.
      // WHY: la accion debe explicar claramente por que no se puede eliminar y que hacer.
      // IMPACT: solo cambia el texto mostrado al usuario; el flujo backend permanece igual.
      const msg = isRestriction
        ? 'NO SE PUEDE ELIMINAR LA CATEGORIA PORQUE TIENE PRODUCTOS ASIGNADOS. REASIGNA O ACTUALIZA ESOS PRODUCTOS Y LUEGO INTENTA DE NUEVO.'
        : (err?.message || 'ERROR ELIMINANDO CATEGORIA');
      safeSetError(msg);
      safeToast(isRestriction ? 'CATEGORIA EN USO' : 'ERROR', msg, isRestriction ? 'warning' : 'danger');
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

  return (
    <>
      <div className="inv-catpro-card inv-prod-card inv-cat-v2 mb-3">
        {/* FUNCIONALIDAD: HEADER */}
        <div className="inv-prod-header inv-cat-v2__header">
          <div className="inv-prod-title-wrap">
            <div className="inv-prod-title-row">
              <i className="bi bi-tag inv-prod-title-icon" />
              <span className="inv-prod-title">Categorías</span>
            </div>
            <div className="inv-prod-subtitle">Gestión visual de categorías</div>
          </div>

          <div className="inv-prod-header-actions inv-ins-header-actions inv-cat-v2__actions">
            <label className="inv-ins-search" aria-label="Buscar categorías">
              <i className="bi bi-search" />
              <input
                type="search"
                placeholder="Buscar por nombre, código o descripción..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>

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
              className={`inv-prod-toolbar-btn ${drawerOpen && drawerMode === 'create' ? 'is-on' : ''}`}
              onClick={openCreate}
              title="Nueva"
              aria-expanded={drawerOpen && drawerMode === 'create'}
              aria-controls="inv-cat-form-drawer"
            >
              <i className="bi bi-plus-circle" /> <span>Nuevo</span>
            </button>
          </div>
        </div>

        {/* NEW: dashboards centrados bajo el header, replicando forma/jerarquía de Insumos. */}
        {/* WHY: unificar layout visual entre submódulos de inventario. */}
        {/* IMPACT: solo presentación; se reutiliza `kpis` existente. */}
        <div className="inv-prod-kpis inv-cat-v2__kpis" aria-label="Resumen de categorías">
          {renderKpiCard('total', 'Total', kpis.total)}
          {renderKpiCard('activas', 'Activas', kpis.activas, 'is-ok')}
          {renderKpiCard('inactivas', 'Inactivas', kpis.inactivas, 'is-empty')}
        </div>

        {/* FUNCIONALIDAD: BODY */}
        <div className="inv-catpro-body inv-prod-body p-3">
          {error ? (
            <div className="alert alert-danger mb-3" role="alert">
              {error}
            </div>
          ) : null}

          <div className="inv-prod-results-meta inv-cat-v2__results-meta">
            <span>{loading ? 'Cargando categorías...' : `${categoriasFiltradas.length} resultados`}</span>
            <span>{loading ? '' : `Total: ${categoriasLocal.length}`}</span>
            {hasActiveFilters ? <span className="inv-prod-active-filter-pill">Filtros activos</span> : null}
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
              <div className="inv-catpro-carousel-wrap inv-prod-carousel-stage">
                {/* AJUSTE: se reutiliza el stage de Productos para que las flechas flotantes hereden el mismo layout visual. */}
                <button
                  type="button"
                  // AJUSTE: se replica el boton flotante del carrusel de Productos.
                  className={`btn inv-prod-carousel-float is-prev ${categoriasPages.length > 1 ? 'is-visible' : ''}`}
                  onClick={() => scrollCarousel('prev')}
                  aria-label="Pagina anterior"
                  disabled={categoriasPages.length <= 1}
                >
                  <i className="bi bi-chevron-left" />
                </button>

                <div className="inv-catpro-carousel" ref={carouselRef} onWheel={onCarouselWheel}>
                  {categoriasPages.map((page, pageIdx) => {
                    const colsClass = cardsPerPage >= 6 ? 'cols-3' : cardsPerPage >= 4 ? 'cols-2' : 'cols-1';

                    return (
                      <div className="inv-catpro-page" key={`page-${pageIdx}`} aria-label={`Pagina ${pageIdx + 1}`}>
                        <div className={`inv-catpro-grid inv-catpro-grid-page ${colsClass}`}>
                          {page.map((c, idx) => {
                            const globalIdx = pageIdx * cardsPerPage + idx;
                            const isActive = !!c?.estado;
                            const code = c?.codigo_categoria ?? '';
                            const dotClass = isActive ? 'ok' : 'off';
                            const isToggling = quickTogglingEstadoId === c?.id_categoria_producto;

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

                                      <button
                                        type="button"
                                        className="inv-catpro-action danger inv-catpro-action-compact"
                                        // NUEVO: evita que la accion interna de eliminar abra el modal de edicion.
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openConfirmDelete(c?.id_categoria_producto, c?.nombre_categoria);
                                        }}
                                        onKeyDown={(e) => e.stopPropagation()}
                                        title="Eliminar"
                                      >
                                        <i className="bi bi-trash" />
                                        <span className="inv-catpro-action-label">Eliminar</span>
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

                                      <button
                                        type="button"
                                        className={`inv-catpro-action ${isActive ? 'state-off' : 'state-on'} inv-catpro-action-compact`}
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          await toggleEstadoCategoriaRapido(c, !isActive);
                                        }}
                                        onKeyDown={(e) => e.stopPropagation()}
                                        title={isActive ? 'Inactivar' : 'Activar'}
                                        disabled={isToggling}
                                      >
                                        <i className={`bi ${isActive ? 'bi-slash-circle' : 'bi-check-circle'}`} />
                                        <span className="inv-catpro-action-label">
                                          {isToggling ? 'Procesando' : isActive ? 'Inactivar' : 'Activar'}
                                        </span>
                                      </button>

                                      <button
                                        type="button"
                                        className="inv-catpro-action danger inv-catpro-action-compact"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openConfirmDelete(c?.id_categoria_producto, c?.nombre_categoria);
                                      }}
                                      onKeyDown={(e) => e.stopPropagation()}
                                        title="Eliminar"
                                        disabled={isToggling}
                                      >
                                        <i className="bi bi-trash" />
                                        <span className="inv-catpro-action-label">Eliminar</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  // AJUSTE: se replica el boton flotante del carrusel de Productos.
                  className={`btn inv-prod-carousel-float is-next ${categoriasPages.length > 1 ? 'is-visible' : ''}`}
                  onClick={() => scrollCarousel('next')}
                  aria-label="Pagina siguiente"
                  disabled={categoriasPages.length <= 1}
                >
                  <i className="bi bi-chevron-right" />
                </button>
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
        className={`inv-prod-drawer inv-cat-v2__drawer ${filtersOpen ? 'show' : ''}`}
        id="inv-cat-filters-drawer"
        role="dialog"
        aria-modal="true"
        aria-hidden={!filtersOpen}
      >
        <div className="inv-prod-drawer-head">
          {/* NEW: watermark del drawer para reforzar identidad visual de categorias. */}
          {/* WHY: alternativa sutil sin hover y continuidad con el acento visual del card. */}
          {/* IMPACT: decorativo; no afecta el contenido ni la interaccion del drawer. */}
          <i className="bi bi-tags inv-cat-v2__drawer-mark" aria-hidden="true" />
          <div>
            <div className="inv-prod-drawer-title">Filtros de categorias</div>
            <div className="inv-prod-drawer-sub">Estado y orden visual del carrusel</div>
          </div>
          <button type="button" className="inv-prod-drawer-close" onClick={closeFiltersDrawer} title="Cerrar">
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="inv-prod-drawer-body inv-cat-v2__drawer-body">
          <div className="inv-prod-drawer-section">
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

          <div className="inv-prod-drawer-section">
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

          <div className="inv-prod-drawer-actions inv-cat-v2__drawer-actions">
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
        className={`inv-prod-drawer inv-cat-v2__drawer ${drawerOpen ? 'show' : ''}`}
        id="inv-cat-form-drawer"
        role="dialog"
        aria-modal="true"
        aria-hidden={!drawerOpen}
      >
        <div className="inv-prod-drawer-head">
          {/* NEW: watermark del drawer para reforzar identidad visual de categorias. */}
          {/* WHY: mantener el lenguaje visual del submodulo tambien en nuevo/editar. */}
          {/* IMPACT: decorativo; no cambia el flujo ni los campos del formulario. */}
          <i className="bi bi-tags inv-cat-v2__drawer-mark" aria-hidden="true" />
          <div>
            <div className="inv-prod-drawer-title">{drawerMode === 'create' ? 'Nueva categoria' : 'Editar categoria'}</div>
            <div className="inv-prod-drawer-sub">Completa los campos y guarda los cambios.</div>
          </div>
          {/* AJUSTE: se iguala el boton de cierre al patron de Productos para mantener diseno consistente. */}
          <button type="button" className="inv-prod-drawer-close" onClick={closeDrawer} title="Cerrar">
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <form className="inv-prod-drawer-body inv-catpro-drawer-body-lite" onSubmit={onSave}>
          <div className="mb-2">
            <label className="form-label">Nombre</label>
            <input
              className={`form-control ${nombreErrorMsg ? 'is-invalid' : ''}`}
              value={form.nombre_categoria}
              onChange={(e) => setForm((s) => ({ ...s, nombre_categoria: String(e.target.value ?? '').toUpperCase() }))}
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
              placeholder="Ej: BEB"
            />
            {codigoErrorMsg ? <div className="invalid-feedback d-block">{codigoErrorMsg}</div> : null}
          </div>

          <div className="mb-2">
            <label className="form-label">Descripcion (opcional)</label>
            <input
              className={`form-control ${formErrors.descripcion ? 'is-invalid' : ''}`}
              value={form.descripcion}
              onChange={(e) => setForm((s) => ({ ...s, descripcion: e.target.value }))}
              placeholder="Ej: Categoria para bebidas frias y calientes"
            />
            {formErrors.descripcion ? <div className="invalid-feedback">{formErrors.descripcion}</div> : null}
          </div>

          <div className="form-check mt-2 mb-3">
            <input
              className="form-check-input"
              type="checkbox"
              id="cat_estado"
              checked={!!form.estado}
              onChange={(e) => setForm((s) => ({ ...s, estado: e.target.checked }))}
            />
            <label className="form-check-label" htmlFor="cat_estado">
              Activo
            </label>
          </div>

          <div className="d-flex gap-2">
            <button type="button" className="btn inv-prod-btn-subtle flex-fill" onClick={closeDrawer}>
              Cancelar
            </button>
            <button type="submit" className="btn inv-prod-btn-primary flex-fill" disabled={loading || hasLiveDuplicates}>
              {loading ? 'Cargando...' : drawerMode === 'create' ? 'Crear' : 'Guardar'}
            </button>
          </div>
        </form>
      </aside>

      {/* FUNCIONALIDAD: MODAL CONFIRMAR ELIMINACION */}
      {confirmModal.show && (
        <div className="inv-pro-confirm-backdrop" role="dialog" aria-modal="true" onClick={closeConfirmDelete}>
          <div className="inv-pro-confirm-panel" onClick={(e) => e.stopPropagation()}>
            <div className="inv-pro-confirm-head">
              <div className="inv-pro-confirm-head-icon">
                <i className="bi bi-exclamation-triangle-fill" />
              </div>
              <div>
                <div className="inv-pro-confirm-title">Confirmar eliminacion</div>
                <div className="inv-pro-confirm-sub">Esta accion es permanente</div>
              </div>
              <button type="button" className="inv-pro-confirm-close" onClick={closeConfirmDelete} aria-label="Cerrar">
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <div className="inv-pro-confirm-body">
              <div className="inv-pro-confirm-question">Deseas eliminar esta categoria?</div>
              <div className="inv-pro-confirm-name">
                <i className="bi bi-tag" />
                <span>{confirmModal.nombre || 'Categoria seleccionada'}</span>
              </div>
            </div>

            <div className="inv-pro-confirm-footer">
              <button type="button" className="btn inv-pro-btn-cancel" onClick={closeConfirmDelete}>
                Cancelar
              </button>
              <button type="button" className="btn inv-pro-btn-danger" onClick={eliminarConfirmado}>
                <i className="bi bi-trash3" />
                <span>Eliminar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CategoriasTab;

