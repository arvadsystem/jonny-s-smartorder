import { useEffect, useMemo, useState } from 'react';
import { inventarioService } from '../../../services/inventarioService';

const AlmacenesTab = ({ openToast }) => {
  // ==============================
  // ESTADOS PRINCIPALES
  // ==============================
  const [almacenes, setAlmacenes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ==============================
  // FILTROS (BUSCAR + SUCURSAL)
  // ==============================
  const [search, setSearch] = useState('');
  const [sucursalFiltro, setSucursalFiltro] = useState('todas'); // todas | <id>

  // ==============================
  // MODAL CREAR (RESPONSIVE)
  // ==============================
  const [showCreateSheet, setShowCreateSheet] = useState(false);

  // FORM CREAR
  const [form, setForm] = useState({
    nombre: '',
    id_sucursal: ''
  });

  const [createErrors, setCreateErrors] = useState({});

  // ==============================
  // EDITAR (INLINE)
  // ==============================
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editErrors, setEditErrors] = useState({});

  // ==============================
  // MODAL CONFIRMAR ELIMINAR
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
  // VALIDACIÓN MÍNIMA
  // ==============================
  const validarAlmacen = (data) => {
    const errors = {};
    const nombre = String(data?.nombre ?? '').trim();
    const sucRaw = String(data?.id_sucursal ?? '').trim();
    const id_sucursal = Number.parseInt(sucRaw, 10);

    if (nombre.length < 2) errors.nombre = 'MÍNIMO 2 CARACTERES';
    if (nombre.length > 80) errors.nombre = 'MÁXIMO 80 CARACTERES';

    if (!sucRaw) errors.id_sucursal = 'LA SUCURSAL ES OBLIGATORIA';
    else if (!/^\d+$/.test(sucRaw)) errors.id_sucursal = 'SOLO NÚMEROS ENTEROS';
    else if (Number.isNaN(id_sucursal) || id_sucursal <= 0) errors.id_sucursal = 'DEBE SER > 0';

    return {
      ok: Object.keys(errors).length === 0,
      errors,
      cleaned: { nombre, id_sucursal }
    };
  };

  // ==============================
  // CARGAR ALMACENES
  // ==============================
  const cargarAlmacenes = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await inventarioService.getAlmacenes();
      setAlmacenes(Array.isArray(data) ? data : []);
    } catch (e) {
      const msg = e?.message || 'ERROR CARGANDO ALMACENES';
      setError(msg);
      openToast?.('ERROR', msg, 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarAlmacenes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==============================
  // RESET FORM CREAR
  // ==============================
  const resetForm = () => {
    setForm({ nombre: '', id_sucursal: '' });
    setCreateErrors({});
  };

  // ==============================
  // CREAR ALMACÉN
  // ==============================
  const onCrear = async (e) => {
    e.preventDefault();
    setError('');

    const v = validarAlmacen(form);
    setCreateErrors(v.errors);
    if (!v.ok) return;

    try {
      // COMENTARIO EN MAYÚSCULAS: NO ENVIAR NULLS, SOLO LOS CAMPOS REQUERIDOS
      await inventarioService.crearAlmacen({
        nombre: v.cleaned.nombre,
        id_sucursal: v.cleaned.id_sucursal
      });

      resetForm();
      setShowCreateSheet(false);
      await cargarAlmacenes();
      openToast?.('CREADO', 'EL ALMACÉN SE CREÓ CORRECTAMENTE.', 'success');
    } catch (e2) {
      const msg = e2?.message || 'ERROR CREANDO ALMACÉN';
      setError(msg);
      openToast?.('ERROR', msg, 'danger');
    }
  };

  // ==============================
  // INICIAR EDICIÓN
  // ==============================
  const iniciarEdicion = (a) => {
    setError('');
    setEditErrors({});
    setEditId(a.id_almacen);
    setEditForm({
      nombre: a.nombre ?? '',
      id_sucursal: String(a.id_sucursal ?? '')
    });
  };

  const cancelarEdicion = () => {
    setEditId(null);
    setEditForm(null);
    setEditErrors({});
  };

  // ==============================
  // GUARDAR EDICIÓN (CAMPO POR CAMPO, SOLO SI CAMBIÓ)
  // ==============================
  const guardarEdicion = async () => {
    if (!editId || !editForm) return;
    setError('');

    const v = validarAlmacen(editForm);
    setEditErrors(v.errors);
    if (!v.ok) return;

    try {
      const actual = almacenes.find((x) => x.id_almacen === editId);
      const cambios = [];

      const nombreActual = String(actual?.nombre ?? '').trim();
      const sucActual = Number.parseInt(String(actual?.id_sucursal ?? ''), 10);

      if (v.cleaned.nombre !== nombreActual) cambios.push(['nombre', v.cleaned.nombre]);
      if (!Number.isNaN(v.cleaned.id_sucursal) && v.cleaned.id_sucursal !== sucActual) {
        cambios.push(['id_sucursal', v.cleaned.id_sucursal]);
      }

      if (cambios.length === 0) {
        openToast?.('SIN CAMBIOS', 'NO HAY CAMBIOS PARA GUARDAR.', 'info');
        cancelarEdicion();
        return;
      }

      for (const [campo, valor] of cambios) {
        await inventarioService.actualizarAlmacenCampo(editId, campo, valor);
      }

      cancelarEdicion();
      await cargarAlmacenes();
      openToast?.('ACTUALIZADO', 'EL ALMACÉN SE ACTUALIZÓ CORRECTAMENTE.', 'success');
    } catch (e2) {
      const msg = e2?.message || 'ERROR ACTUALIZANDO ALMACÉN';
      setError(msg);
      openToast?.('ERROR', msg, 'danger');
    }
  };

  // ==============================
  // ELIMINAR (CONFIRMADO)
  // ==============================
  const eliminarConfirmado = async () => {
    const id = confirmModal.idToDelete;
    if (!id) return;

    setError('');
    try {
      await inventarioService.eliminarAlmacen(id);
      closeConfirmDelete();
      await cargarAlmacenes();
      openToast?.('ELIMINADO', 'EL ALMACÉN SE ELIMINÓ CORRECTAMENTE.', 'success');
    } catch (e) {
      closeConfirmDelete();
      const msg = e?.message || 'ERROR ELIMINANDO ALMACÉN';
      setError(msg);
      openToast?.('ERROR', msg, 'danger');
    }
  };

  // ==============================
  // FILTRADO
  // ==============================
  const sucursalesDisponibles = useMemo(() => {
    const setIds = new Set();
    for (const a of almacenes) {
      if (a?.id_sucursal !== undefined && a?.id_sucursal !== null) setIds.add(String(a.id_sucursal));
    }
    return Array.from(setIds).sort((x, y) => Number(x) - Number(y));
  }, [almacenes]);

  const almacenesFiltrados = useMemo(() => {
    const lista = [...almacenes].sort((a, b) => (a.id_almacen ?? 0) - (b.id_almacen ?? 0));
    const s = search.trim().toLowerCase();

    return lista.filter((a) => {
      const texto = `${a.nombre ?? ''} sucursal ${a.id_sucursal ?? ''}`.toLowerCase();
      const matchTexto = s ? texto.includes(s) : true;

      const matchSucursal = sucursalFiltro === 'todas' ? true : String(a.id_sucursal) === String(sucursalFiltro);

      return matchTexto && matchSucursal;
    });
  }, [almacenes, search, sucursalFiltro]);

  return (
    <div className="card shadow-sm mb-3">
      <div className="card-header fw-semibold d-flex align-items-center justify-content-between">
        <span>Almacenes</span>

        <button
          type="button"
          className="btn btn-sm btn-primary d-md-none"
          onClick={() => setShowCreateSheet(true)}
        >
          + Agregar
        </button>
      </div>

      <div className="card-body">
        {error && <div className="alert alert-danger">{error}</div>}

        {/* FORM CREAR (SOLO DESKTOP/TABLET) */}
        <div className="d-none d-md-block">
          <form onSubmit={onCrear} className="row g-2 mb-3">
            <div className="col-12 col-md-6">
              <label className="form-label mb-1">Nombre</label>
              <input
                className={`form-control ${createErrors.nombre ? 'is-invalid' : ''}`}
                placeholder="Ej: Almacén Principal"
                value={form.nombre}
                onChange={(e) => setForm((s) => ({ ...s, nombre: e.target.value }))}
                required
              />
              {createErrors.nombre && <div className="invalid-feedback">{createErrors.nombre}</div>}
            </div>

            <div className="col-12 col-md-3">
              <label className="form-label mb-1">Sucursal (No.)</label>
              <input
                className={`form-control ${createErrors.id_sucursal ? 'is-invalid' : ''}`}
                placeholder="Ej: 1"
                inputMode="numeric"
                value={form.id_sucursal}
                onChange={(e) =>
                  setForm((s) => ({ ...s, id_sucursal: String(e.target.value).replace(/[^\d]/g, '') }))
                }
                required
              />
              {createErrors.id_sucursal && <div className="invalid-feedback">{createErrors.id_sucursal}</div>}
            </div>

            <div className="col-12 col-md-3 d-grid align-items-end">
              <button className="btn btn-primary" type="submit">
                Crear
              </button>
            </div>
          </form>
        </div>

        {/* FILTROS */}
        <div className="row g-2 mb-3">
          <div className="col-12 col-md-6">
            <input
              className="form-control"
              placeholder="Buscar por nombre o sucursal..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="col-12 col-md-3">
            <select
              className="form-select"
              value={sucursalFiltro}
              onChange={(e) => setSucursalFiltro(e.target.value)}
            >
              <option value="todas">Todas las sucursales</option>
              {sucursalesDisponibles.map((id) => (
                <option key={id} value={id}>
                  Sucursal {id}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-md-3 d-grid">
            <button
              className="btn btn-outline-secondary"
              type="button"
              onClick={() => {
                setSearch('');
                setSucursalFiltro('todas');
              }}
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        {/* MOBILE CARDS */}
        <div className="d-md-none">
          {loading ? (
            <div className="text-muted">Cargando...</div>
          ) : almacenesFiltrados.length === 0 ? (
            <div className="text-muted">Sin datos</div>
          ) : (
            <div className="d-flex flex-column gap-2">
              {almacenesFiltrados.map((a, index) => {
                const isEditing = editId === a.id_almacen;

                return (
                  <div key={a.id_almacen} className="card border">
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div>
                          <div className="text-muted small">No. {index + 1}</div>
                          <div className="fw-bold">{isEditing ? 'EDITANDO' : a.nombre}</div>
                          <div className="text-muted small">
                            Sucursal: <span className="fw-semibold">{a.id_sucursal}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mb-2">
                        <div className="small text-muted">Nombre</div>
                        {isEditing ? (
                          <>
                            <input
                              className={`form-control form-control-sm ${editErrors.nombre ? 'is-invalid' : ''}`}
                              value={editForm.nombre}
                              onChange={(e) => setEditForm((s) => ({ ...s, nombre: e.target.value }))}
                            />
                            {editErrors.nombre && <div className="invalid-feedback">{editErrors.nombre}</div>}
                          </>
                        ) : (
                          <div>{a.nombre}</div>
                        )}
                      </div>

                      <div className="mb-3">
                        <div className="small text-muted">Sucursal (No.)</div>
                        {isEditing ? (
                          <>
                            <input
                              className={`form-control form-control-sm ${editErrors.id_sucursal ? 'is-invalid' : ''}`}
                              inputMode="numeric"
                              value={editForm.id_sucursal}
                              onChange={(e) =>
                                setEditForm((s) => ({
                                  ...s,
                                  id_sucursal: String(e.target.value).replace(/[^\d]/g, '')
                                }))
                              }
                            />
                            {editErrors.id_sucursal && (
                              <div className="invalid-feedback">{editErrors.id_sucursal}</div>
                            )}
                          </>
                        ) : (
                          <div>{a.id_sucursal}</div>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="d-grid gap-2">
                          <button className="btn btn-success" type="button" onClick={guardarEdicion}>
                            Guardar
                          </button>
                          <button className="btn btn-secondary" type="button" onClick={cancelarEdicion}>
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="d-grid gap-2">
                          <button className="btn btn-outline-primary" type="button" onClick={() => iniciarEdicion(a)}>
                            Editar
                          </button>
                          <button
                            className="btn btn-outline-danger"
                            type="button"
                            onClick={() => openConfirmDelete(a.id_almacen, a.nombre)}
                          >
                            Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* DESKTOP TABLE */}
        <div className="d-none d-md-block">
          <div className="table-responsive">
            <table className="table table-sm table-striped align-middle">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>No.</th>
                  <th>Nombre</th>
                  <th style={{ width: 140 }}>Sucursal</th>
                  <th style={{ width: 220 }}>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr><td colSpan="4">Cargando...</td></tr>
                ) : almacenesFiltrados.length === 0 ? (
                  <tr><td colSpan="4">Sin datos</td></tr>
                ) : (
                  almacenesFiltrados.map((a, index) => {
                    const isEditing = editId === a.id_almacen;

                    return (
                      <tr key={a.id_almacen}>
                        <td className="text-muted">{index + 1}</td>

                        <td>
                          {isEditing ? (
                            <>
                              <input
                                className={`form-control form-control-sm ${editErrors.nombre ? 'is-invalid' : ''}`}
                                value={editForm.nombre}
                                onChange={(e) => setEditForm((s) => ({ ...s, nombre: e.target.value }))}
                              />
                              {editErrors.nombre && <div className="invalid-feedback">{editErrors.nombre}</div>}
                            </>
                          ) : (
                            a.nombre
                          )}
                        </td>

                        <td>
                          {isEditing ? (
                            <>
                              <input
                                className={`form-control form-control-sm ${editErrors.id_sucursal ? 'is-invalid' : ''}`}
                                inputMode="numeric"
                                value={editForm.id_sucursal}
                                onChange={(e) =>
                                  setEditForm((s) => ({
                                    ...s,
                                    id_sucursal: String(e.target.value).replace(/[^\d]/g, '')
                                  }))
                                }
                              />
                              {editErrors.id_sucursal && (
                                <div className="invalid-feedback">{editErrors.id_sucursal}</div>
                              )}
                            </>
                          ) : (
                            `Sucursal ${a.id_sucursal}`
                          )}
                        </td>

                        <td>
                          {isEditing ? (
                            <div className="d-flex gap-2">
                              <button className="btn btn-sm btn-success" onClick={guardarEdicion} type="button">
                                Guardar
                              </button>
                              <button className="btn btn-sm btn-secondary" onClick={cancelarEdicion} type="button">
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <div className="d-flex gap-2">
                              <button className="btn btn-sm btn-outline-primary" onClick={() => iniciarEdicion(a)} type="button">
                                Editar
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => openConfirmDelete(a.id_almacen, a.nombre)}
                                type="button"
                              >
                                Eliminar
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ==============================
          MODAL CREAR (MÓVIL CENTRADO)
          ============================== */}
      {showCreateSheet && (
        <div
          className="modal fade show"
          style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 2500 }}
          role="dialog"
          aria-modal="true"
          onClick={() => setShowCreateSheet(false)}
        >
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content shadow">
              <div className="modal-header d-flex align-items-center justify-content-between">
                <div className="fw-semibold">Agregar almacén</div>
                <button type="button" className="btn btn-sm btn-light" onClick={() => setShowCreateSheet(false)}>
                  ✕
                </button>
              </div>

              <div className="modal-body">
                <form onSubmit={onCrear} className="row g-2">
                  <div className="col-12">
                    <label className="form-label mb-1">Nombre</label>
                    <input
                      className={`form-control ${createErrors.nombre ? 'is-invalid' : ''}`}
                      placeholder="Ej: Almacén Principal"
                      value={form.nombre}
                      onChange={(e) => setForm((s) => ({ ...s, nombre: e.target.value }))}
                      required
                    />
                    {createErrors.nombre && <div className="invalid-feedback">{createErrors.nombre}</div>}
                  </div>

                  <div className="col-12">
                    <label className="form-label mb-1">Sucursal (No.)</label>
                    <input
                      className={`form-control ${createErrors.id_sucursal ? 'is-invalid' : ''}`}
                      placeholder="Ej: 1"
                      inputMode="numeric"
                      value={form.id_sucursal}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, id_sucursal: String(e.target.value).replace(/[^\d]/g, '') }))
                      }
                      required
                    />
                    {createErrors.id_sucursal && <div className="invalid-feedback">{createErrors.id_sucursal}</div>}
                  </div>

                  <div className="col-12 d-grid gap-2 mt-2">
                    <button className="btn btn-primary" type="submit">
                      Guardar
                    </button>
                    <button className="btn btn-outline-secondary" type="button" onClick={() => setShowCreateSheet(false)}>
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>

              <div className="modal-footer">
                <div className="text-muted small me-auto">LA SUCURSAL ES OBLIGATORIA</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==============================
          MODAL CONFIRMACIÓN ELIMINAR
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
                    <div className="fw-semibold">¿DESEAS ELIMINAR ESTE ALMACÉN?</div>
                    <div className="text-muted">
                      <span className="fw-bold">{confirmModal.nombre || '(SIN NOMBRE)'}</span>
                    </div>
                    <div className="text-muted small mt-2">ESTA ACCIÓN NO SE PUEDE DESHACER.</div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-outline-secondary" type="button" onClick={closeConfirmDelete}>
                  Cancelar
                </button>
                <button className="btn btn-danger" type="button" onClick={eliminarConfirmado}>
                  Sí, eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlmacenesTab;
