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
  // ==============================
  // TOAST (SI NO VIENE DEL PADRE)
  // ==============================
  const safeToast = (title, message, variant = 'success') => {
    if (typeof openToast === 'function') openToast(title, message, variant);
  };

  const safeSetError = (msg) => {
    if (typeof setError === 'function') setError(msg);
  };

  // ==============================
  // MODAL/SHEET CREAR (MÓVIL)
  // ==============================
  const [showCreateCategoriaSheet, setShowCreateCategoriaSheet] = useState(false);

  // ==============================
  // FILTROS (BUSCAR + ESTADO)
  // ==============================
  const [search, setSearch] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('todos'); // todos | activo | inactivo

  // ==============================
  // FORM CREAR
  // ==============================
  const [form, setForm] = useState({
    nombre_categoria: '',
    codigo_categoria: '',
    descripcion: '',
    estado: true
  });

  const [createErrors, setCreateErrors] = useState({});

  // ==============================
  // EDITAR
  // ==============================
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editErrors, setEditErrors] = useState({});

  // ==============================
  // MODAL CONFIRMACIÓN ELIMINAR
  // ==============================
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    idToDelete: null,
    nombre: ''
  });

  const openConfirmDelete = (id, nombre) => {
    setConfirmModal({ show: true, idToDelete: id, nombre: nombre || '' });
  };

  const closeConfirmDelete = () => {
    setConfirmModal({ show: false, idToDelete: null, nombre: '' });
  };

  // ==============================
  // HELPERS
  // ==============================
  const normalizeCodigo = (value) =>
    String(value ?? '')
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/[^A-Z0-9_]/g, '');

  // ==============================
  // VALIDACIÓN MÍNIMA
  // ==============================
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
    if (!/^[A-Z0-9_]+$/.test(codigo)) {
      errors.codigo_categoria = 'SOLO MAYÚSCULAS, NÚMEROS O _ (SIN ESPACIOS)';
    }

    if (descripcion.length > 150) errors.descripcion = 'MÁXIMO 150 CARACTERES';

    // COMENTARIO EN MAYÚSCULAS: NO ENVIAR NULL EN OPCIONALES, MEJOR OMITIR
    const cleaned = {
      nombre_categoria: nombre,
      codigo_categoria: codigo,
      estado
    };
    if (descripcion) cleaned.descripcion = descripcion;

    return {
      ok: Object.keys(errors).length === 0,
      errors,
      cleaned
    };
  };

  // ==============================
  // LISTA FILTRADA (SIN IDS)
  // ==============================
  const categoriasFiltradas = useMemo(() => {
    const lista = [...categorias].sort(
      (a, b) => (a.id_categoria_producto ?? 0) - (b.id_categoria_producto ?? 0)
    );

    const s = search.trim().toLowerCase();

    return lista.filter((c) => {
      const texto = `${c.nombre_categoria ?? ''} ${c.codigo_categoria ?? ''} ${c.descripcion ?? ''}`.toLowerCase();
      const matchTexto = s ? texto.includes(s) : true;

      const matchEstado =
        estadoFiltro === 'todos'
          ? true
          : estadoFiltro === 'activo'
          ? !!c.estado
          : !c.estado;

      return matchTexto && matchEstado;
    });
  }, [categorias, search, estadoFiltro]);

  // ==============================
  // ACCIONES (CREAR)
  // ==============================
  const resetForm = () => {
    setForm({ nombre_categoria: '', codigo_categoria: '', descripcion: '', estado: true });
    setCreateErrors({});
  };

  const onCrear = async (e) => {
    e.preventDefault();
    safeSetError('');

    const v = validarCategoria(form);
    setCreateErrors(v.errors);
    if (!v.ok) return;

    try {
      await inventarioService.crearCategoria(v.cleaned);

      resetForm();
      setShowCreateCategoriaSheet(false);

      if (typeof reloadCategorias === 'function') await reloadCategorias();

      safeToast('CREADO', 'LA CATEGORÍA SE CREÓ CORRECTAMENTE.', 'success');
    } catch (err) {
      const msg = err?.message || 'ERROR CREANDO CATEGORÍA';
      safeSetError(msg);
      safeToast('ERROR', msg, 'danger');
    }
  };

  // ==============================
  // ACCIONES (EDITAR)
  // ==============================
  const iniciarEdicion = (c) => {
    setEditId(c.id_categoria_producto);
    setEditForm({
      nombre_categoria: c.nombre_categoria ?? '',
      codigo_categoria: c.codigo_categoria ?? '',
      descripcion: c.descripcion ?? '',
      estado: !!c.estado
    });
    setEditErrors({});
  };

  const cancelarEdicion = () => {
    setEditId(null);
    setEditForm(null);
    setEditErrors({});
  };

  const guardarEdicion = async () => {
    if (!editId || !editForm) return;

    safeSetError('');

    const v = validarCategoria(editForm);
    setEditErrors(v.errors);
    if (!v.ok) return;

    try {
      // COMENTARIO EN MAYÚSCULAS: BACKEND ACTUALIZA POR CAMPO (SP / actualizacion por campo)
      const updates = [
        ['nombre_categoria', v.cleaned.nombre_categoria],
        ['codigo_categoria', v.cleaned.codigo_categoria],
        // descripcion puede no venir (omitida)
        ['descripcion', v.cleaned.descripcion ?? ''],
        ['estado', v.cleaned.estado]
      ];

      for (const [campo, valor] of updates) {
        await inventarioService.actualizarCategoriaCampo(editId, campo, valor);
      }

      cancelarEdicion();
      if (typeof reloadCategorias === 'function') await reloadCategorias();

      safeToast('ACTUALIZADO', 'LA CATEGORÍA SE ACTUALIZÓ CORRECTAMENTE.', 'success');
    } catch (err) {
      const msg = err?.message || 'ERROR ACTUALIZANDO CATEGORÍA';
      safeSetError(msg);
      safeToast('ERROR', msg, 'danger');
    }
  };

  // ==============================
  // ACCIONES (ELIMINAR)
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

  // ==============================
  // UI
  // ==============================
  return (
    <>
      <div className="card shadow-sm mb-3">
        <div className="card-header fw-semibold d-flex align-items-center justify-content-between">
          <span>Categorías de productos</span>

          {/* COMENTARIO EN MAYÚSCULAS: EN MÓVIL SE ABRE SHEET PARA CREAR */}
          <button
            className="btn btn-sm btn-primary d-md-none"
            type="button"
            onClick={() => setShowCreateCategoriaSheet(true)}
          >
            + Crear
          </button>
        </div>

        <div className="card-body">
          {error ? (
            <div className="alert alert-danger mb-3" role="alert">
              {error}
            </div>
          ) : null}

          {/* =====================================
              CREAR (DESKTOP)
              ===================================== */}
          <form className="d-none d-md-block mb-3" onSubmit={onCrear}>
            <div className="row g-2 align-items-end">
              <div className="col-md-3">
                <label className="form-label">Nombre</label>
                <input
                  className={`form-control ${createErrors.nombre_categoria ? 'is-invalid' : ''}`}
                  value={form.nombre_categoria}
                  onChange={(e) => setForm((s) => ({ ...s, nombre_categoria: e.target.value }))}
                  placeholder="Ej: Bebidas"
                />
                {createErrors.nombre_categoria ? (
                  <div className="invalid-feedback">{createErrors.nombre_categoria}</div>
                ) : null}
              </div>

              <div className="col-md-2">
                <label className="form-label">Código</label>
                <input
                  className={`form-control ${createErrors.codigo_categoria ? 'is-invalid' : ''}`}
                  value={form.codigo_categoria}
                  onChange={(e) => setForm((s) => ({ ...s, codigo_categoria: normalizeCodigo(e.target.value) }))}
                  placeholder="Ej: BEB"
                />
                {createErrors.codigo_categoria ? (
                  <div className="invalid-feedback">{createErrors.codigo_categoria}</div>
                ) : null}
              </div>

              <div className="col-md-4">
                <label className="form-label">Descripción (opcional)</label>
                <input
                  className={`form-control ${createErrors.descripcion ? 'is-invalid' : ''}`}
                  value={form.descripcion}
                  onChange={(e) => setForm((s) => ({ ...s, descripcion: e.target.value }))}
                  placeholder="Ej: Categoría para bebidas frías y calientes"
                />
                {createErrors.descripcion ? <div className="invalid-feedback">{createErrors.descripcion}</div> : null}
              </div>

              <div className="col-md-1 d-flex align-items-center gap-2">
                <div className="form-check mt-4">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="estadoCreateCategoria"
                    checked={!!form.estado}
                    onChange={(e) => setForm((s) => ({ ...s, estado: e.target.checked }))}
                  />
                  <label className="form-check-label" htmlFor="estadoCreateCategoria">
                    Activo
                  </label>
                </div>
              </div>

              <div className="col-md-2">
                <button className="btn btn-primary w-100" type="submit" disabled={loading}>
                  {loading ? 'Cargando...' : 'Crear'}
                </button>
              </div>
            </div>
          </form>

          {/* =====================================
              FILTROS
              ===================================== */}
          <div className="row g-2 mb-3">
            <div className="col-md-8">
              <input
                className="form-control"
                placeholder="Buscar por nombre, código o descripción..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="col-md-2">
              <select className="form-select" value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)}>
                <option value="todos">Todos</option>
                <option value="activo">Activos</option>
                <option value="inactivo">Inactivos</option>
              </select>
            </div>
            <div className="col-md-2">
              <button
                className="btn btn-outline-secondary w-100"
                type="button"
                onClick={() => {
                  setSearch('');
                  setEstadoFiltro('todos');
                }}
              >
                Limpiar filtros
              </button>
            </div>
          </div>

          {/* =====================================
              LISTADO (DESKTOP = TABLA)
              ===================================== */}
          <div className="d-none d-md-block table-responsive">
            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>No.</th>
                  <th>Nombre</th>
                  <th>Código</th>
                  <th>Descripción</th>
                  <th style={{ width: 120 }}>Estado</th>
                  <th style={{ width: 180 }}>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {!loading && categoriasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-muted py-4 text-center">
                      No hay categorías para mostrar.
                    </td>
                  </tr>
                ) : null}

                {categoriasFiltradas.map((c, idx) => {
                  const isEdit = editId === c.id_categoria_producto;

                  return (
                    <tr key={c.id_categoria_producto ?? idx}>
                      <td>{idx + 1}</td>

                      <td>
                        {isEdit ? (
                          <>
                            <input
                              className={`form-control form-control-sm ${
                                editErrors.nombre_categoria ? 'is-invalid' : ''
                              }`}
                              value={editForm?.nombre_categoria ?? ''}
                              onChange={(e) =>
                                setEditForm((s) => ({ ...s, nombre_categoria: e.target.value }))
                              }
                            />
                            {editErrors.nombre_categoria ? (
                              <div className="invalid-feedback">{editErrors.nombre_categoria}</div>
                            ) : null}
                          </>
                        ) : (
                          c.nombre_categoria
                        )}
                      </td>

                      <td>
                        {isEdit ? (
                          <>
                            <input
                              className={`form-control form-control-sm ${
                                editErrors.codigo_categoria ? 'is-invalid' : ''
                              }`}
                              value={editForm?.codigo_categoria ?? ''}
                              onChange={(e) =>
                                setEditForm((s) => ({ ...s, codigo_categoria: normalizeCodigo(e.target.value) }))
                              }
                            />
                            {editErrors.codigo_categoria ? (
                              <div className="invalid-feedback">{editErrors.codigo_categoria}</div>
                            ) : null}
                          </>
                        ) : (
                          c.codigo_categoria
                        )}
                      </td>

                      <td>
                        {isEdit ? (
                          <>
                            <input
                              className={`form-control form-control-sm ${editErrors.descripcion ? 'is-invalid' : ''}`}
                              value={editForm?.descripcion ?? ''}
                              onChange={(e) => setEditForm((s) => ({ ...s, descripcion: e.target.value }))}
                            />
                            {editErrors.descripcion ? (
                              <div className="invalid-feedback">{editErrors.descripcion}</div>
                            ) : null}
                          </>
                        ) : (
                          c.descripcion || '-'
                        )}
                      </td>

                      <td>
                        {isEdit ? (
                          <div className="form-check">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id={`estadoEdit_${c.id_categoria_producto}`}
                              checked={!!editForm?.estado}
                              onChange={(e) => setEditForm((s) => ({ ...s, estado: e.target.checked }))}
                            />
                            <label className="form-check-label" htmlFor={`estadoEdit_${c.id_categoria_producto}`}>
                              Activo
                            </label>
                          </div>
                        ) : (
                          <span className={`badge ${c.estado ? 'bg-success' : 'bg-secondary'}`}>
                            {c.estado ? 'Activo' : 'Inactivo'}
                          </span>
                        )}
                      </td>

                      <td className="d-flex gap-2">
                        {isEdit ? (
                          <>
                            <button className="btn btn-sm btn-primary" type="button" onClick={guardarEdicion}>
                              Guardar
                            </button>
                            <button className="btn btn-sm btn-outline-secondary" type="button" onClick={cancelarEdicion}>
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button className="btn btn-sm btn-outline-primary" type="button" onClick={() => iniciarEdicion(c)}>
                              Editar
                            </button>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              type="button"
                              onClick={() => openConfirmDelete(c.id_categoria_producto, c.nombre_categoria)}
                            >
                              Eliminar
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* =====================================
              LISTADO (MÓVIL = CARDS)
              ===================================== */}
          <div className="d-md-none">
            {!loading && categoriasFiltradas.length === 0 ? (
              <div className="text-muted text-center py-4">No hay categorías para mostrar.</div>
            ) : null}

            {categoriasFiltradas.map((c, idx) => (
              <div key={c.id_categoria_producto ?? idx} className="border rounded p-3 mb-2">
                <div className="d-flex justify-content-between align-items-start">
                  <div className="fw-semibold">
                    {idx + 1}. {c.nombre_categoria}
                  </div>
                  <span className={`badge ${c.estado ? 'bg-success' : 'bg-secondary'}`}>
                    {c.estado ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                <div className="text-muted small mt-1">
                  <div><span className="fw-semibold">Código:</span> {c.codigo_categoria}</div>
                  <div><span className="fw-semibold">Descripción:</span> {c.descripcion || '-'}</div>
                </div>

                <div className="d-flex gap-2 mt-3">
                  <button className="btn btn-sm btn-outline-primary" type="button" onClick={() => iniciarEdicion(c)}>
                    Editar
                  </button>
                  <button
                    className="btn btn-sm btn-outline-danger"
                    type="button"
                    onClick={() => openConfirmDelete(c.id_categoria_producto, c.nombre_categoria)}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ==============================
          SHEET CREAR CATEGORÍA (MÓVIL)
          ============================== */}
      {showCreateCategoriaSheet && (
        <div
          className="modal fade show"
          style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 2500 }}
          role="dialog"
          aria-modal="true"
          onClick={() => setShowCreateCategoriaSheet(false)}
        >
          <div className="modal-dialog modal-fullscreen-md-down" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content shadow">
              <div className="modal-header">
                <h5 className="modal-title">Crear categoría</h5>
                <button type="button" className="btn-close" onClick={() => setShowCreateCategoriaSheet(false)} />
              </div>

              <form onSubmit={onCrear}>
                <div className="modal-body">
                  <div className="mb-2">
                    <label className="form-label">Nombre</label>
                    <input
                      className={`form-control ${createErrors.nombre_categoria ? 'is-invalid' : ''}`}
                      value={form.nombre_categoria}
                      onChange={(e) => setForm((s) => ({ ...s, nombre_categoria: e.target.value }))}
                      placeholder="Ej: Bebidas"
                    />
                    {createErrors.nombre_categoria ? (
                      <div className="invalid-feedback">{createErrors.nombre_categoria}</div>
                    ) : null}
                  </div>

                  <div className="mb-2">
                    <label className="form-label">Código</label>
                    <input
                      className={`form-control ${createErrors.codigo_categoria ? 'is-invalid' : ''}`}
                      value={form.codigo_categoria}
                      onChange={(e) => setForm((s) => ({ ...s, codigo_categoria: normalizeCodigo(e.target.value) }))}
                      placeholder="Ej: BEB"
                    />
                    {createErrors.codigo_categoria ? (
                      <div className="invalid-feedback">{createErrors.codigo_categoria}</div>
                    ) : null}
                  </div>

                  <div className="mb-2">
                    <label className="form-label">Descripción (opcional)</label>
                    <input
                      className={`form-control ${createErrors.descripcion ? 'is-invalid' : ''}`}
                      value={form.descripcion}
                      onChange={(e) => setForm((s) => ({ ...s, descripcion: e.target.value }))}
                      placeholder="Ej: Categoría para bebidas frías y calientes"
                    />
                    {createErrors.descripcion ? <div className="invalid-feedback">{createErrors.descripcion}</div> : null}
                  </div>

                  <div className="form-check mt-2">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="estadoCreateCategoriaMobile"
                      checked={!!form.estado}
                      onChange={(e) => setForm((s) => ({ ...s, estado: e.target.checked }))}
                    />
                    <label className="form-check-label" htmlFor="estadoCreateCategoriaMobile">
                      Activo
                    </label>
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    className="btn btn-outline-secondary"
                    type="button"
                    onClick={() => setShowCreateCategoriaSheet(false)}
                  >
                    Cancelar
                  </button>
                  <button className="btn btn-primary" type="submit" disabled={loading}>
                    {loading ? 'Cargando...' : 'Crear'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ==============================
          MODAL CONFIRMACIÓN ELIMINAR (CATEGORÍA)
          ============================== */}
      {confirmModal.show && (
        <div
          className="modal fade show"
          style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.55)' }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title">CONFIRMAR ELIMINACIÓN</h5>
                <button type="button" className="btn-close btn-close-white" onClick={closeConfirmDelete} />
              </div>

              <div className="modal-body">
                <div className="d-flex gap-3">
                  <div style={{ fontSize: 28 }}>⚠️</div>
                  <div>
                    <div className="fw-semibold">¿DESEAS ELIMINAR ESTA CATEGORÍA?</div>
                    <div className="text-muted small mt-1">
                      {confirmModal.nombre ? `Categoría: ${confirmModal.nombre}` : 'Esta acción no se puede deshacer.'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={closeConfirmDelete}>
                  Cancelar
                </button>
                <button type="button" className="btn btn-danger" onClick={eliminarConfirmado}>
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CategoriasTab;
