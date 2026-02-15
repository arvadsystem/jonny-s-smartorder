import { useMemo, useState } from 'react';
import { inventarioService } from '../../../services/inventarioService';

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
      nombre_categoria: c?.nombre_categoria ?? '',
      codigo_categoria: c?.codigo_categoria ?? '',
      descripcion: c?.descripcion ?? '',
      estado: !!c?.estado
    });
    setFormErrors({});
    setDrawerOpen(true);
  };

  const closeDrawer = () => setDrawerOpen(false);

  // ==============================
  // ELIMINAR (CONFIRMACIÓN)
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

    if (nombre.length < 2) errors.nombre_categoria = 'MÍNIMO 2 CARACTERES';
    if (nombre.length > 50) errors.nombre_categoria = 'MÁXIMO 50 CARACTERES';

    if (codigo.length < 2) errors.codigo_categoria = 'MÍNIMO 2 CARACTERES';
    if (codigo.length > 10) errors.codigo_categoria = 'MÁXIMO 10 CARACTERES';
    if (!/^[A-Z0-9_]+$/.test(codigo)) errors.codigo_categoria = 'SOLO MAYÚSCULAS, NÚMEROS O _ (SIN ESPACIOS)';

    if (descripcion.length > 150) errors.descripcion = 'MÁXIMO 150 CARACTERES';

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

  // ==============================
  // CREAR / EDITAR
  // ==============================
  const onSave = async (e) => {
    e?.preventDefault?.();
    safeSetError('');

    const v = validarCategoria(form);
    setFormErrors(v.errors);
    if (!v.ok) return;

    try {
      if (drawerMode === 'create') {
        await inventarioService.crearCategoria(v.cleaned);
        safeToast('CREADO', 'LA CATEGORÍA SE CREÓ CORRECTAMENTE.', 'success');
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

        safeToast('ACTUALIZADO', 'LA CATEGORÍA SE ACTUALIZÓ CORRECTAMENTE.', 'success');
      }

      closeDrawer();
      if (typeof reloadCategorias === 'function') await reloadCategorias();
    } catch (err) {
      const msg = err?.message || 'ERROR GUARDANDO CATEGORÍA';
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
      safeToast('ELIMINADO', 'LA CATEGORÍA SE ELIMINÓ CORRECTAMENTE.', 'success');
    } catch (err) {
      const msg = err?.message || 'ERROR ELIMINANDO CATEGORÍA';
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
              <div className="inv-catpro-title">Categorías de productos</div>
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
                  placeholder="Buscar por nombre, código o descripción..."
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
            {!loading && categoriasFiltradas.length === 0 ? (
              <div className="inv-catpro-empty">
                <div className="inv-catpro-empty-icon">
                  <i className="bi bi-inbox-fill" />
                </div>
                <div className="inv-catpro-empty-title">No hay categorías para mostrar</div>
                <div className="inv-catpro-empty-sub">
                  {hasActiveFilters ? 'Prueba limpiar filtros o crea una nueva categoría.' : 'Crea tu primera categoría.'}
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
                    Nueva categoría
                  </button>
                </div>
              </div>
            ) : (
              <div className="inv-catpro-grid">
                {categoriasFiltradas.map((c, idx) => {
                  const isActive = !!c?.estado;
                  const code = c?.codigo_categoria ?? '';
                  const dotClass = isActive ? 'ok' : 'off';

                  return (
                    <div
                      key={c?.id_categoria_producto ?? idx}
                      className="inv-catpro-item inv-anim-in"
                      style={{ animationDelay: `${Math.min(idx * 40, 240)}ms` }}
                    >
                      <div className="inv-catpro-item-top">
                        <div>
                          <div className="fw-bold">
                            {idx + 1}. {c?.nombre_categoria ?? ''}
                          </div>
                          <div className="text-muted small">{c?.descripcion || 'Sin descripción'}</div>
                        </div>

                        <span className={`badge ${isActive ? 'bg-success' : 'bg-secondary'}`}>
                          {isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>

                      <div className="inv-catpro-meta">
                        <div className="inv-catpro-code-wrap">
                          <span className={`inv-catpro-state-dot ${dotClass}`} />
                          <span className="inv-catpro-code">{code}</span>
                        </div>

                        <div className="inv-catpro-meta-actions">
                          <button
                            type="button"
                            className="inv-catpro-action edit inv-catpro-action-compact"
                            onClick={() => openEdit(c)}
                            title="Editar"
                          >
                            <i className="bi bi-pencil-square" />
                            <span className="inv-catpro-action-label">Editar</span>
                          </button>

                          <button
                            type="button"
                            className="inv-catpro-action danger inv-catpro-action-compact"
                            onClick={() => openConfirmDelete(c?.id_categoria_producto, c?.nombre_categoria)}
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

      {/* FUNCIONALIDAD: BACKDROP */}
      <div className={`inv-catpro-backdrop ${drawerOpen ? 'show' : ''}`} onClick={closeDrawer} aria-hidden={!drawerOpen} />

      {/* FUNCIONALIDAD: DRAWER */}
      <div
        className={`inv-catpro-drawer ${drawerOpen ? 'show' : ''} ${drawerMode === 'create' ? 'is-create' : 'is-edit'}`}
        role="dialog"
        aria-modal="true"
      >
        <div className="inv-catpro-drawer-head d-flex align-items-start justify-content-between gap-2">
          <div>
            <div className={`inv-catpro-drawer-chip inv-catpro-drawer-chip-hero ${drawerMode === 'create' ? 'is-create' : 'is-edit'}`}>
              <i className={`bi ${drawerMode === 'create' ? 'bi-plus-circle-fill' : 'bi-pencil-fill'}`} />
              <span>{drawerMode === 'create' ? 'MODO CREACIÓN' : 'MODO EDICIÓN'}</span>
            </div>
            <div className="inv-catpro-drawer-sub">Completa los campos y guarda los cambios.</div>
          </div>

          <button type="button" className="btn inv-catpro-close" onClick={closeDrawer} title="Cerrar">
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <form className="inv-catpro-drawer-body" onSubmit={onSave}>
          <div className="mb-2">
            <label className="form-label">Nombre</label>
            <input
              className={`form-control ${formErrors.nombre_categoria ? 'is-invalid' : ''}`}
              value={form.nombre_categoria}
              onChange={(e) => setForm((s) => ({ ...s, nombre_categoria: e.target.value }))}
              placeholder="Ej: Bebidas"
            />
            {formErrors.nombre_categoria ? <div className="invalid-feedback">{formErrors.nombre_categoria}</div> : null}
          </div>

          <div className="mb-2">
            <label className="form-label">Código</label>
            <input
              className={`form-control ${formErrors.codigo_categoria ? 'is-invalid' : ''}`}
              value={form.codigo_categoria}
              onChange={(e) => setForm((s) => ({ ...s, codigo_categoria: normalizeCodigo(e.target.value) }))}
              placeholder="Ej: BEB"
            />
            {formErrors.codigo_categoria ? <div className="invalid-feedback">{formErrors.codigo_categoria}</div> : null}
          </div>

          <div className="mb-2">
            <label className="form-label">Descripción (opcional)</label>
            <input
              className={`form-control ${formErrors.descripcion ? 'is-invalid' : ''}`}
              value={form.descripcion}
              onChange={(e) => setForm((s) => ({ ...s, descripcion: e.target.value }))}
              placeholder="Ej: Categoría para bebidas frías y calientes"
            />
            {formErrors.descripcion ? <div className="invalid-feedback">{formErrors.descripcion}</div> : null}
          </div>

          <div className="form-check mt-2">
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

          <div className="inv-catpro-drawer-footer">
            <button type="submit" className="btn btn-primary inv-catpro-save flex-fill" disabled={loading}>
              {loading ? 'Cargando...' : drawerMode === 'create' ? 'Crear' : 'Guardar'}
            </button>
            <button type="button" className="btn btn-outline-light inv-catpro-cancel" onClick={closeDrawer}>
              Cancelar
            </button>
          </div>
        </form>
      </div>

      {/* FUNCIONALIDAD: MODAL CONFIRMAR ELIMINACIÓN */}
      {confirmModal.show && (
        <div className="inv-pro-confirm-backdrop" role="dialog" aria-modal="true" onClick={closeConfirmDelete}>
          <div className="inv-pro-confirm-panel" onClick={(e) => e.stopPropagation()}>
            <div className="inv-pro-confirm-head">
              <div className="inv-pro-confirm-head-icon">
                <i className="bi bi-exclamation-triangle-fill" />
              </div>
              <div>
                <div className="inv-pro-confirm-title">Confirmar eliminación</div>
                <div className="inv-pro-confirm-sub">Esta acción es permanente</div>
              </div>
              <button type="button" className="inv-pro-confirm-close" onClick={closeConfirmDelete} aria-label="Cerrar">
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <div className="inv-pro-confirm-body">
              <div className="inv-pro-confirm-question">¿Deseas eliminar esta categoría?</div>
              <div className="inv-pro-confirm-name">
                <i className="bi bi-tag" />
                <span>{confirmModal.nombre || 'Categoría seleccionada'}</span>
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
