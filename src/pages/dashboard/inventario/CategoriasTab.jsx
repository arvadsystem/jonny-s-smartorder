import { useEffect, useMemo, useRef, useState } from 'react';
import { inventarioService } from '../../../services/inventarioService';

const resolveCardsPerPage = (width) => {
  if (width >= 1200) return 6; // 3x2 desktop
  if (width >= 620) return 4; // 2x2 tablet
  return 2; // 1x2 mobile
};

const CategoriasTab = ({
  categorias = [],
  loading = false,
  error = '',
  setError,
  reloadCategorias,
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

  // ==============================
  // DRAWER (CREAR / EDITAR)
  // ==============================
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState('create'); // create | edit
  const [editId, setEditId] = useState(null);

  const [form, setForm] = useState({
    nombre_categoria: '',
    codigo_categoria: '',
    descripcion: '',
    estado: true
  });

  const [formErrors, setFormErrors] = useState({});
  const carouselRef = useRef(null);

  const [cardsPerPage, setCardsPerPage] = useState(() =>
    typeof window === 'undefined' ? 6 : resolveCardsPerPage(window.innerWidth)
  );
  // NUEVO: feature flag para habilitar hover premium sin eliminar implementacion actual.
  const USE_PREMIUM_CATEGORY_CARDS = true;

  useEffect(() => {
    const onResize = () => setCardsPerPage(resolveCardsPerPage(window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const openCreate = () => {
    // FUNCIONALIDAD: ABRIR DRAWER CREAR
    setDrawerMode('create');
    setEditId(null);
    setForm({ nombre_categoria: '', codigo_categoria: '', descripcion: '', estado: true });
    setFormErrors({});
    setDrawerOpen(true);
  };

  const openEdit = (c) => {
    // FUNCIONALIDAD: ABRIR DRAWER EDITAR
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

  // ==============================
  // KPIS
  // ==============================
  const kpis = useMemo(() => {
    const total = Array.isArray(categorias) ? categorias.length : 0;
    const activas = (categorias || []).filter((c) => !!c?.estado).length;
    const inactivas = total - activas;
    return { total, activas, inactivas };
  }, [categorias]);

  // ==============================
  // LISTADO FILTRADO
  // ==============================
  const categoriasFiltradas = useMemo(() => {
    const lista = [...(categorias || [])].sort(
      (a, b) => (a?.id_categoria_producto ?? 0) - (b?.id_categoria_producto ?? 0)
    );

    const s = search.trim().toLowerCase();

    return lista.filter((c) => {
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
  }, [categorias, search, estadoFiltro]);

  const hasActiveFilters = useMemo(() => search.trim() !== '' || estadoFiltro !== 'todos', [search, estadoFiltro]);

  const normalizedNombre = String(form?.nombre_categoria ?? '').trim().toUpperCase();
  const normalizedCodigo = normalizeCodigo(form?.codigo_categoria ?? '');

  const baseCategorias = Array.isArray(categorias) ? categorias : [];
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

        safeToast('ACTUALIZADO', 'LA CATEGORIA SE ACTUALIZO CORRECTAMENTE.', 'success');
      }

      closeDrawer();
      if (typeof reloadCategorias === 'function') await reloadCategorias();
    } catch (err) {
      const msg = err?.message || 'ERROR GUARDANDO CATEGORIA';
      safeSetError(msg);
      safeToast('ERROR', msg, 'danger');
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
      await inventarioService.eliminarCategoria(id);
      closeConfirmDelete();
      if (typeof reloadCategorias === 'function') await reloadCategorias();
      safeToast('ELIMINADO', 'LA CATEGORIA SE ELIMINO CORRECTAMENTE.', 'success');
    } catch (err) {
      const msg = err?.message || 'ERROR ELIMINANDO CATEGORIA';
      safeSetError(msg);
      safeToast('ERROR', msg, 'danger');
    }
  };

  return (
    <>
      <div className="inv-catpro-card mb-3">
        {/* FUNCIONALIDAD: HEADER */}
        <div className="inv-catpro-header px-3 py-3">
          <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-tag" />
              <div className="inv-catpro-title">Categorias de productos</div>
            </div>

            <div className="d-flex align-items-center gap-2 flex-wrap">
              <div className="inv-catpro-kpi">TOTAL:{kpis.total}</div>
              <div className="inv-catpro-kpi inv-catpro-kpi-ok">ACTIVAS:{kpis.activas}</div>
              <div className="inv-catpro-kpi inv-catpro-kpi-off">INACTIVAS:{kpis.inactivas}</div>

              <button
                type="button"
                className={`inv-catpro-pillbtn filters ${filtersOpen ? 'is-on' : ''}`}
                onClick={() => setFiltersOpen((s) => !s)}
                title="Filtros"
              >
                <i className="bi bi-sliders" /> <span>Filtros</span>
              </button>

              <button type="button" className="inv-catpro-pillbtn primary" onClick={openCreate} title="Nueva">
                <i className="bi bi-plus" /> <span>Nueva</span>
              </button>
            </div>
          </div>
        </div>

        {/* FUNCIONALIDAD: BODY */}
        <div className="inv-catpro-body p-3">
          {error ? (
            <div className="alert alert-danger mb-3" role="alert">
              {error}
            </div>
          ) : null}

          {/* FUNCIONALIDAD: FILTROS OCULTOS */}
          <div className={`inv-catpro-filters ${filtersOpen ? 'open' : ''}`}>
            <div className="row g-2">
              <div className="col-12 col-md-8">
                <input
                  className="form-control"
                  placeholder="Buscar por nombre, codigo o descripcion..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="col-12 col-md-2">
                <select className="form-select" value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)}>
                  <option value="todos">Todos</option>
                  <option value="activo">Activos</option>
                  <option value="inactivo">Inactivos</option>
                </select>
              </div>

              <div className="col-12 col-md-2">
                <button
                  className="btn btn-outline-secondary w-100"
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setEstadoFiltro('todos');
                  }}
                >
                  Limpiar
                </button>
              </div>
            </div>
          </div>

          {/* FUNCIONALIDAD: LISTADO */}
          <div className={`inv-catpro-list ${drawerOpen ? 'drawer-open' : ''}`}>
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
                      onClick={() => {
                        setSearch('');
                        setEstadoFiltro('todos');
                        setFiltersOpen(false);
                      }}
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

                            // AJUSTE: se mantiene fallback del card actual cuando el modo premium esta desactivado.
                            if (!USE_PREMIUM_CATEGORY_CARDS) {
                              return (
                                <div
                                  key={c?.id_categoria_producto ?? globalIdx}
                                  className="inv-catpro-item inv-anim-in"
                                  style={{ animationDelay: `${Math.min(globalIdx * 40, 240)}ms` }}
                                  role="button"
                                  tabIndex={0}
                                  // AJUSTE: la edicion ahora se abre al interactuar con el card completo.
                                  onClick={() => openEdit(c)}
                                  // NUEVO: soporte teclado para abrir modal desde el card.
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      openEdit(c);
                                    }
                                  }}
                                >
                                  <div className="inv-catpro-item-top">
                                    <div>
                                      <div className="fw-bold">
                                        {globalIdx + 1}. {c?.nombre_categoria ?? ''}
                                      </div>
                                      <div className="text-muted small">{c?.descripcion || 'Sin descripcion'}</div>
                                    </div>

                                    <span className={`badge ${isActive ? 'bg-success' : 'bg-secondary'}`}>
                                      {isActive ? 'Activo' : 'Inactivo'}
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
                                className="inv-catpro-item inv-cat-card inv-anim-in"
                                style={{ animationDelay: `${Math.min(globalIdx * 40, 240)}ms` }}
                                role="button"
                                tabIndex={0}
                                // AJUSTE: la edicion ahora se abre al interactuar con el card completo.
                                onClick={() => openEdit(c)}
                                // NUEVO: soporte teclado para abrir modal desde el card.
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    openEdit(c);
                                  }
                                }}
                              >
                                {/* NUEVO: halo decorativo animado para enfatizar hover/focus sin cambiar la paleta. */}
                                <div className="inv-cat-card__halo" aria-hidden="true" />
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

                                  <span className={`badge ${isActive ? 'bg-success' : 'bg-secondary'}`}>
                                    {isActive ? 'Activo' : 'Inactivo'}
                                  </span>
                                </div>

                                <div className="inv-catpro-meta inv-catpro-item-footer">
                                  <div className="inv-catpro-code-wrap">
                                    <span className={`inv-catpro-state-dot ${dotClass}`} />
                                    <span className="inv-catpro-code">{code}</span>
                                  </div>

                                  <div className="inv-catpro-meta-actions inv-catpro-action-bar inv-cat-card__actions">
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
        className={`inv-catpro-fab d-md-none ${drawerOpen ? 'is-hidden' : ''}`}
        onClick={openCreate}
        title="Nueva"
      >
        <i className="bi bi-plus" />
      </button>

      {/* AJUSTE: modal de categorias con patron lateral derecho igual al de Productos. */}
      <div className={`inv-prod-drawer-backdrop ${drawerOpen ? 'show' : ''}`} onClick={closeDrawer} aria-hidden={!drawerOpen} />
      <aside className={`inv-prod-drawer ${drawerOpen ? 'show' : ''}`} role="dialog" aria-modal="true">
        <div className="inv-prod-drawer-head">
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

