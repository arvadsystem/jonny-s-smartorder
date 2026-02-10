import { useEffect, useMemo, useState } from 'react';
import { inventarioService } from '../../../services/inventarioService';

const InsumosTab = ({ openToast }) => {
  // ==============================
  // TOAST SEGURO (SI NO VIENE DEL PADRE)
  // ==============================
  const safeToast = (title, message, variant = 'success') => {
    if (typeof openToast === 'function') openToast(title, message, variant);
  };

  // ==============================
  // ESTADOS PRINCIPALES
  // ==============================
  const [insumos, setInsumos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ==============================
  // ALMACENES (DROPDOWN FK)
  // ==============================
  const [almacenes, setAlmacenes] = useState([]);
  const [loadingAlmacenes, setLoadingAlmacenes] = useState(false);

  // ==============================
  // FILTROS (BUSCAR + STOCK)
  // ==============================
  const [search, setSearch] = useState('');
  const [stockFiltro, setStockFiltro] = useState('todos'); // todos | con_stock | sin_stock

  // ==============================
  // MODAL CREAR (RESPONSIVE)
  // ==============================
  const [showCreateSheet, setShowCreateSheet] = useState(false);

  // ==============================
  // FORM CREAR
  // ==============================
  const [form, setForm] = useState({
    nombre_insumo: '',
    precio: '',
    cantidad: '',
    fecha_ingreso_insumo: '',
    id_almacen: '',
    fecha_caducidad: '',
    descripcion: ''
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
  // HELPERS
  // ==============================
  const toDateInputValue = (value) => {
    if (!value) return '';
    const s = String(value);
    if (s.includes('T')) return s.split('T')[0];
    return s;
  };

  // ==============================
  // SOLO ENTEROS EN CANTIDAD (BLOQUEAR DECIMALES)
  // ==============================
  const blockNonIntegerKeys = (e) => {
    const blocked = ['.', ',', 'e', 'E', '+', '-'];
    if (blocked.includes(e.key)) e.preventDefault();
  };

  const sanitizeInteger = (value) => String(value ?? '').replace(/[^\d]/g, '');

  // ==============================
  // MAPA ID_ALMACEN -> LABEL (NO MOSTRAR IDS)
  // ==============================
  const almacenesMap = useMemo(() => {
    const m = new Map();
    for (const a of almacenes) {
      m.set(String(a?.id_almacen), a);
    }
    return m;
  }, [almacenes]);

  const getAlmacenLabel = (id) => {
    const a = almacenesMap.get(String(id));
    if (!a) return String(id || '-');
    return `${a.nombre} (Sucursal ${a.id_sucursal})`;
  };

  // ==============================
  // VALIDACIÓN MÍNIMA (INSUMOS)
  // ==============================
  const validarInsumo = (data) => {
    const errors = {};

    const nombre = String(data?.nombre_insumo ?? '').trim();
    const descripcion = String(data?.descripcion ?? '').trim();

    const precioRaw = String(data?.precio ?? '').trim();
    const cantidadRaw = String(data?.cantidad ?? '').trim();
    const almacenRaw = String(data?.id_almacen ?? '').trim();

    const precio = Number.parseFloat(precioRaw);
    const cantidad = Number.parseInt(cantidadRaw, 10); // ENTERO
    const id_almacen = Number.parseInt(almacenRaw, 10);

    const fechaIngreso = String(data?.fecha_ingreso_insumo ?? '').trim();
    const fechaCaducidad = String(data?.fecha_caducidad ?? '').trim();

    // NOMBRE OBLIGATORIO
    if (nombre.length < 2) errors.nombre_insumo = 'MÍNIMO 2 CARACTERES';
    if (nombre.length > 80) errors.nombre_insumo = 'MÁXIMO 80 CARACTERES';

    // PRECIO OBLIGATORIO (DECIMAL)
    if (!precioRaw) errors.precio = 'EL PRECIO ES OBLIGATORIO';
    else if (Number.isNaN(precio) || precio < 0) errors.precio = 'DEBE SER UN NÚMERO >= 0';

    // CANTIDAD OBLIGATORIA (ENTERO)
    if (!cantidadRaw) errors.cantidad = 'LA CANTIDAD ES OBLIGATORIA';
    else if (!/^\d+$/.test(cantidadRaw)) errors.cantidad = 'SOLO ENTEROS (SIN DECIMALES)';
    else if (Number.isNaN(cantidad) || cantidad < 0) errors.cantidad = 'DEBE SER UN ENTERO >= 0';

    // ALMACÉN OBLIGATORIO (FK)
    if (!almacenRaw) errors.id_almacen = 'EL ALMACÉN ES OBLIGATORIO';
    else if (Number.isNaN(id_almacen) || id_almacen <= 0) errors.id_almacen = 'DEBE SER UN NÚMERO > 0';

    // DESCRIPCIÓN OPCIONAL
    if (descripcion.length > 150) errors.descripcion = 'MÁXIMO 150 CARACTERES';

    // FECHAS OPCIONALES
    if (fechaIngreso && !/^\d{4}-\d{2}-\d{2}$/.test(fechaIngreso)) {
      errors.fecha_ingreso_insumo = 'FORMATO INVÁLIDO (YYYY-MM-DD)';
    }
    if (fechaCaducidad && !/^\d{4}-\d{2}-\d{2}$/.test(fechaCaducidad)) {
      errors.fecha_caducidad = 'FORMATO INVÁLIDO (YYYY-MM-DD)';
    }

    return {
      ok: Object.keys(errors).length === 0,
      errors,
      cleaned: {
        nombre_insumo: nombre,
        precio,
        cantidad,
        id_almacen,
        fecha_ingreso_insumo: fechaIngreso,
        fecha_caducidad: fechaCaducidad,
        descripcion
      }
    };
  };

  // ==============================
  // COMENTARIO EN MAYÚSCULAS: CONSTRUIR PAYLOAD SIN NULLS (OMITIR OPCIONALES VACÍOS)
  // ==============================
  const buildPayload = (cleaned) => {
    const payload = {
      nombre_insumo: cleaned.nombre_insumo,
      precio: cleaned.precio,
      cantidad: cleaned.cantidad,
      id_almacen: cleaned.id_almacen
    };

    if (cleaned.descripcion) payload.descripcion = cleaned.descripcion;
    if (cleaned.fecha_ingreso_insumo) payload.fecha_ingreso_insumo = cleaned.fecha_ingreso_insumo;
    if (cleaned.fecha_caducidad) payload.fecha_caducidad = cleaned.fecha_caducidad;

    return payload;
  };

  // ==============================
  // CARGAS INICIALES
  // ==============================
  const cargarAlmacenes = async () => {
    setLoadingAlmacenes(true);
    try {
      const data = await inventarioService.getAlmacenes();
      setAlmacenes(Array.isArray(data) ? data : []);
    } catch (e) {
      const msg = e?.message || 'ERROR CARGANDO ALMACENES';
      setError(msg);
      safeToast('ERROR', msg, 'danger');
    } finally {
      setLoadingAlmacenes(false);
    }
  };

  const cargarInsumos = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await inventarioService.getInsumos();
      setInsumos(Array.isArray(data) ? data : []);
    } catch (e) {
      const msg = e?.message || 'ERROR CARGANDO INSUMOS';
      setError(msg);
      safeToast('ERROR', msg, 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // COMENTARIO EN MAYÚSCULAS: AL ENTRAR AL TAB, CARGA INSUMOS + ALMACENES
    cargarInsumos();
    cargarAlmacenes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==============================
  // RESET FORM CREAR
  // ==============================
  const resetForm = () => {
    setForm({
      nombre_insumo: '',
      precio: '',
      cantidad: '',
      fecha_ingreso_insumo: '',
      id_almacen: '',
      fecha_caducidad: '',
      descripcion: ''
    });
    setCreateErrors({});
  };

  // ==============================
  // CREAR INSUMO
  // ==============================
  const onCrear = async (e) => {
    e.preventDefault();
    setError('');

    const v = validarInsumo(form);
    setCreateErrors(v.errors);
    if (!v.ok) return;

    try {
      await inventarioService.crearInsumo(buildPayload(v.cleaned));
      resetForm();
      setShowCreateSheet(false);
      await cargarInsumos();
      safeToast('CREADO', 'EL INSUMO SE CREÓ CORRECTAMENTE.', 'success');
    } catch (e2) {
      const msg = e2?.message || 'ERROR CREANDO INSUMO';
      setError(msg);
      safeToast('ERROR', msg, 'danger');
    }
  };

  // ==============================
  // INICIAR / CANCELAR EDICIÓN
  // ==============================
  const iniciarEdicion = (i) => {
    setError('');
    setEditErrors({});
    setEditId(i.id_insumo);
    setEditForm({
      nombre_insumo: i.nombre_insumo ?? '',
      precio: i.precio ?? '',
      cantidad: i.cantidad ?? '',
      fecha_ingreso_insumo: toDateInputValue(i.fecha_ingreso_insumo),
      id_almacen: String(i.id_almacen ?? ''),
      fecha_caducidad: toDateInputValue(i.fecha_caducidad),
      descripcion: i.descripcion ?? ''
    });
  };

  const cancelarEdicion = () => {
    setEditId(null);
    setEditForm(null);
    setEditErrors({});
  };

  // ==============================
  // GUARDAR EDICIÓN (SOLO CAMPOS QUE CAMBIARON)
  // ==============================
  const guardarEdicion = async () => {
    if (!editId || !editForm) return;

    setError('');
    const v = validarInsumo(editForm);
    setEditErrors(v.errors);
    if (!v.ok) return;

    try {
      const actual = insumos.find((x) => x.id_insumo === editId);
      const cambios = [];

      const nombreActual = String(actual?.nombre_insumo ?? '').trim();
      const descActual = String(actual?.descripcion ?? '').trim();
      const precioActual = Number.parseFloat(String(actual?.precio ?? ''));
      const cantActual = Number.parseInt(String(actual?.cantidad ?? ''), 10);
      const almacenActual = Number.parseInt(String(actual?.id_almacen ?? ''), 10);

      const ingresoActual = toDateInputValue(actual?.fecha_ingreso_insumo);
      const caducidadActual = toDateInputValue(actual?.fecha_caducidad);

      if (v.cleaned.nombre_insumo !== nombreActual) cambios.push(['nombre_insumo', v.cleaned.nombre_insumo]);
      if (!Number.isNaN(v.cleaned.precio) && v.cleaned.precio !== precioActual) cambios.push(['precio', v.cleaned.precio]);
      if (!Number.isNaN(v.cleaned.cantidad) && v.cleaned.cantidad !== cantActual) cambios.push(['cantidad', v.cleaned.cantidad]);
      if (!Number.isNaN(v.cleaned.id_almacen) && v.cleaned.id_almacen !== almacenActual) cambios.push(['id_almacen', v.cleaned.id_almacen]);

      // COMENTARIO EN MAYÚSCULAS: DESCRIPCIÓN SE PUEDE DEJAR VACÍA (TEXTO), SE ENVÍA TAL CUAL
      if (v.cleaned.descripcion !== descActual) cambios.push(['descripcion', v.cleaned.descripcion]);

      // COMENTARIO EN MAYÚSCULAS: FECHAS SOLO SE ACTUALIZAN SI VIENEN CON VALOR (NO ENVIAR NULL)
      if (v.cleaned.fecha_ingreso_insumo && v.cleaned.fecha_ingreso_insumo !== ingresoActual) {
        cambios.push(['fecha_ingreso_insumo', v.cleaned.fecha_ingreso_insumo]);
      }
      if (v.cleaned.fecha_caducidad && v.cleaned.fecha_caducidad !== caducidadActual) {
        cambios.push(['fecha_caducidad', v.cleaned.fecha_caducidad]);
      }

      if (cambios.length === 0) {
        safeToast('SIN CAMBIOS', 'NO HAY CAMBIOS PARA GUARDAR.', 'info');
        cancelarEdicion();
        return;
      }

      for (const [campo, valor] of cambios) {
        await inventarioService.actualizarInsumoCampo(editId, campo, valor);
      }

      cancelarEdicion();
      await cargarInsumos();
      safeToast('ACTUALIZADO', 'EL INSUMO SE ACTUALIZÓ CORRECTAMENTE.', 'success');
    } catch (e2) {
      const msg = e2?.message || 'ERROR ACTUALIZANDO INSUMO';
      setError(msg);
      safeToast('ERROR', msg, 'danger');
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
      await inventarioService.eliminarInsumo(id);
      closeConfirmDelete();
      await cargarInsumos();
      safeToast('ELIMINADO', 'EL INSUMO SE ELIMINÓ CORRECTAMENTE.', 'success');
    } catch (e) {
      closeConfirmDelete();
      const msg = e?.message || 'ERROR ELIMINANDO INSUMO';
      setError(msg);
      safeToast('ERROR', msg, 'danger');
    }
  };

  // ==============================
  // FILTRAR + ORDENAR
  // ==============================
  const insumosFiltrados = useMemo(() => {
    const lista = [...insumos].sort((a, b) => (a.id_insumo ?? 0) - (b.id_insumo ?? 0));
    const s = search.trim().toLowerCase();

    return lista.filter((i) => {
      const texto = `${i.nombre_insumo ?? ''} ${i.descripcion ?? ''} ${getAlmacenLabel(i.id_almacen)}`.toLowerCase();
      const matchTexto = s ? texto.includes(s) : true;

      const cant = Number.parseInt(String(i.cantidad ?? '0'), 10);
      const conStock = !Number.isNaN(cant) && cant > 0;

      const matchStock =
        stockFiltro === 'todos' ? true : stockFiltro === 'con_stock' ? conStock : !conStock;

      return matchTexto && matchStock;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insumos, search, stockFiltro, almacenesMap]);

  return (
    <div className="card shadow-sm mb-3">
      <div className="card-header fw-semibold d-flex align-items-center justify-content-between">
        <span>Insumos</span>

        <button type="button" className="btn btn-sm btn-primary d-md-none" onClick={() => setShowCreateSheet(true)}>
          + Agregar
        </button>
      </div>

      <div className="card-body">
        {error && <div className="alert alert-danger">{error}</div>}

        {/* ==============================
            FORM CREAR (SOLO DESKTOP/TABLET)
            ============================== */}
        <div className="d-none d-md-block">
          <form onSubmit={onCrear} className="row g-2 mb-3">
            <div className="col-12 col-md-3">
              <label className="form-label mb-1">Nombre del insumo</label>
              <input
                className={`form-control ${createErrors.nombre_insumo ? 'is-invalid' : ''}`}
                placeholder="Ej: Queso mozzarella"
                value={form.nombre_insumo}
                onChange={(e) => setForm((s) => ({ ...s, nombre_insumo: e.target.value }))}
                required
              />
              {createErrors.nombre_insumo && <div className="invalid-feedback">{createErrors.nombre_insumo}</div>}
            </div>

            <div className="col-6 col-md-2">
              <label className="form-label mb-1">Precio</label>
              <input
                className={`form-control ${createErrors.precio ? 'is-invalid' : ''}`}
                type="number"
                step="0.01"
                min="0"
                placeholder="Ej: 120.50"
                value={form.precio}
                onChange={(e) => setForm((s) => ({ ...s, precio: e.target.value }))}
                required
              />
              {createErrors.precio && <div className="invalid-feedback">{createErrors.precio}</div>}
            </div>

            <div className="col-6 col-md-2">
              <label className="form-label mb-1">Cantidad</label>
              <input
                className={`form-control ${createErrors.cantidad ? 'is-invalid' : ''}`}
                type="number"
                step="1"
                min="0"
                inputMode="numeric"
                placeholder="Ej: 5"
                value={form.cantidad}
                onKeyDown={blockNonIntegerKeys}
                onChange={(e) => setForm((s) => ({ ...s, cantidad: sanitizeInteger(e.target.value) }))}
                required
              />
              {createErrors.cantidad && <div className="invalid-feedback">{createErrors.cantidad}</div>}
            </div>

            <div className="col-12 col-md-2">
              <label className="form-label mb-1">Almacén</label>
              <select
                className={`form-select ${createErrors.id_almacen ? 'is-invalid' : ''}`}
                value={String(form.id_almacen ?? '')}
                onChange={(e) => setForm((s) => ({ ...s, id_almacen: e.target.value }))}
                required
                disabled={loadingAlmacenes}
              >
                <option value="">{loadingAlmacenes ? 'Cargando almacenes...' : 'Seleccione un almacén'}</option>
                {almacenes.map((a) => (
                  <option key={a.id_almacen} value={a.id_almacen}>
                    {a.nombre} (Sucursal {a.id_sucursal})
                  </option>
                ))}
              </select>
              {createErrors.id_almacen && <div className="invalid-feedback">{createErrors.id_almacen}</div>}
            </div>

            <div className="col-12 col-md-3">
              <label className="form-label mb-1">Fecha de ingreso (opcional)</label>
              <input
                className={`form-control ${createErrors.fecha_ingreso_insumo ? 'is-invalid' : ''}`}
                type="date"
                value={form.fecha_ingreso_insumo}
                onChange={(e) => setForm((s) => ({ ...s, fecha_ingreso_insumo: e.target.value }))}
              />
              {createErrors.fecha_ingreso_insumo && (
                <div className="invalid-feedback">{createErrors.fecha_ingreso_insumo}</div>
              )}
            </div>

            <div className="col-12 col-md-3">
              <label className="form-label mb-1">Fecha de caducidad (opcional)</label>
              <input
                className={`form-control ${createErrors.fecha_caducidad ? 'is-invalid' : ''}`}
                type="date"
                value={form.fecha_caducidad}
                onChange={(e) => setForm((s) => ({ ...s, fecha_caducidad: e.target.value }))}
              />
              {createErrors.fecha_caducidad && <div className="invalid-feedback">{createErrors.fecha_caducidad}</div>}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label mb-1">Descripción (opcional)</label>
              <input
                className={`form-control ${createErrors.descripcion ? 'is-invalid' : ''}`}
                placeholder="Ej: Bolsa de 1 libra"
                value={form.descripcion}
                onChange={(e) => setForm((s) => ({ ...s, descripcion: e.target.value }))}
              />
              {createErrors.descripcion && <div className="invalid-feedback">{createErrors.descripcion}</div>}
            </div>

            <div className="col-12 col-md-3 d-grid align-items-end">
              <button className="btn btn-primary" type="submit">
                Crear
              </button>
            </div>
          </form>
        </div>

        {/* ==============================
            FILTROS
            ============================== */}
        <div className="row g-2 mb-3">
          <div className="col-12 col-md-6">
            <input
              className="form-control"
              placeholder="Buscar por nombre, descripción o almacén..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="col-12 col-md-3">
            <select className="form-select" value={stockFiltro} onChange={(e) => setStockFiltro(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="con_stock">Con stock</option>
              <option value="sin_stock">Sin stock</option>
            </select>
          </div>

          <div className="col-12 col-md-3 d-grid">
            <button
              className="btn btn-outline-secondary"
              type="button"
              onClick={() => {
                setSearch('');
                setStockFiltro('todos');
              }}
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        {/* ==============================
            MOBILE: CARDS
            ============================== */}
        <div className="d-md-none">
          {loading ? (
            <div className="text-muted">Cargando...</div>
          ) : insumosFiltrados.length === 0 ? (
            <div className="text-muted">Sin datos</div>
          ) : (
            <div className="d-flex flex-column gap-2">
              {insumosFiltrados.map((i, index) => {
                const isEditing = editId === i.id_insumo;

                return (
                  <div key={i.id_insumo} className="card border">
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div>
                          <div className="text-muted small">No. {index + 1}</div>
                          <div className="fw-bold">{isEditing ? 'EDITANDO' : i.nombre_insumo}</div>
                          <div className="text-muted small">
                            Stock: <span className="fw-semibold">{i.cantidad}</span> • Almacén:{' '}
                            <span className="fw-semibold">{getAlmacenLabel(i.id_almacen)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mb-2">
                        <div className="small text-muted">Nombre</div>
                        {isEditing ? (
                          <>
                            <input
                              className={`form-control form-control-sm ${editErrors.nombre_insumo ? 'is-invalid' : ''}`}
                              value={editForm.nombre_insumo}
                              onChange={(e) => setEditForm((s) => ({ ...s, nombre_insumo: e.target.value }))}
                            />
                            {editErrors.nombre_insumo && (
                              <div className="invalid-feedback">{editErrors.nombre_insumo}</div>
                            )}
                          </>
                        ) : (
                          <div>{i.nombre_insumo}</div>
                        )}
                      </div>

                      <div className="row g-2">
                        <div className="col-6">
                          <div className="small text-muted">Precio</div>
                          {isEditing ? (
                            <>
                              <input
                                className={`form-control form-control-sm ${editErrors.precio ? 'is-invalid' : ''}`}
                                type="number"
                                step="0.01"
                                min="0"
                                value={editForm.precio}
                                onChange={(e) => setEditForm((s) => ({ ...s, precio: e.target.value }))}
                              />
                              {editErrors.precio && <div className="invalid-feedback">{editErrors.precio}</div>}
                            </>
                          ) : (
                            <div>{i.precio}</div>
                          )}
                        </div>

                        <div className="col-6">
                          <div className="small text-muted">Cantidad</div>
                          {isEditing ? (
                            <>
                              <input
                                className={`form-control form-control-sm ${editErrors.cantidad ? 'is-invalid' : ''}`}
                                type="number"
                                step="1"
                                min="0"
                                inputMode="numeric"
                                value={editForm.cantidad}
                                onKeyDown={blockNonIntegerKeys}
                                onChange={(e) =>
                                  setEditForm((s) => ({ ...s, cantidad: sanitizeInteger(e.target.value) }))
                                }
                              />
                              {editErrors.cantidad && <div className="invalid-feedback">{editErrors.cantidad}</div>}
                            </>
                          ) : (
                            <div>{i.cantidad}</div>
                          )}
                        </div>

                        <div className="col-12">
                          <div className="small text-muted">Almacén</div>
                          {isEditing ? (
                            <>
                              <select
                                className={`form-select form-select-sm ${editErrors.id_almacen ? 'is-invalid' : ''}`}
                                value={String(editForm.id_almacen ?? '')}
                                onChange={(e) => setEditForm((s) => ({ ...s, id_almacen: e.target.value }))}
                                disabled={loadingAlmacenes}
                              >
                                <option value="">
                                  {loadingAlmacenes ? 'Cargando almacenes...' : 'Seleccione un almacén'}
                                </option>
                                {almacenes.map((a) => (
                                  <option key={a.id_almacen} value={a.id_almacen}>
                                    {a.nombre} (Sucursal {a.id_sucursal})
                                  </option>
                                ))}
                              </select>
                              {editErrors.id_almacen && (
                                <div className="invalid-feedback">{editErrors.id_almacen}</div>
                              )}
                            </>
                          ) : (
                            <div>{getAlmacenLabel(i.id_almacen)}</div>
                          )}
                        </div>

                        <div className="col-6">
                          <div className="small text-muted">Ingreso</div>
                          {isEditing ? (
                            <>
                              <input
                                className={`form-control form-control-sm ${
                                  editErrors.fecha_ingreso_insumo ? 'is-invalid' : ''
                                }`}
                                type="date"
                                value={editForm.fecha_ingreso_insumo}
                                onChange={(e) => setEditForm((s) => ({ ...s, fecha_ingreso_insumo: e.target.value }))}
                              />
                              {editErrors.fecha_ingreso_insumo && (
                                <div className="invalid-feedback">{editErrors.fecha_ingreso_insumo}</div>
                              )}
                            </>
                          ) : (
                            <div>{toDateInputValue(i.fecha_ingreso_insumo) || '-'}</div>
                          )}
                        </div>

                        <div className="col-6">
                          <div className="small text-muted">Caducidad</div>
                          {isEditing ? (
                            <>
                              <input
                                className={`form-control form-control-sm ${
                                  editErrors.fecha_caducidad ? 'is-invalid' : ''
                                }`}
                                type="date"
                                value={editForm.fecha_caducidad}
                                onChange={(e) => setEditForm((s) => ({ ...s, fecha_caducidad: e.target.value }))}
                              />
                              {editErrors.fecha_caducidad && (
                                <div className="invalid-feedback">{editErrors.fecha_caducidad}</div>
                              )}
                            </>
                          ) : (
                            <div>{toDateInputValue(i.fecha_caducidad) || '-'}</div>
                          )}
                        </div>

                        <div className="col-12">
                          <div className="small text-muted">Descripción</div>
                          {isEditing ? (
                            <>
                              <input
                                className={`form-control form-control-sm ${editErrors.descripcion ? 'is-invalid' : ''}`}
                                value={editForm.descripcion}
                                onChange={(e) => setEditForm((s) => ({ ...s, descripcion: e.target.value }))}
                              />
                              {editErrors.descripcion && (
                                <div className="invalid-feedback">{editErrors.descripcion}</div>
                              )}
                            </>
                          ) : (
                            <div>{i.descripcion || '-'}</div>
                          )}
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="d-grid gap-2 mt-3">
                          <button className="btn btn-success" type="button" onClick={guardarEdicion}>
                            Guardar
                          </button>
                          <button className="btn btn-secondary" type="button" onClick={cancelarEdicion}>
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="d-grid gap-2 mt-3">
                          <button className="btn btn-outline-primary" type="button" onClick={() => iniciarEdicion(i)}>
                            Editar
                          </button>
                          <button
                            className="btn btn-outline-danger"
                            type="button"
                            onClick={() => openConfirmDelete(i.id_insumo, i.nombre_insumo)}
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

        {/* ==============================
            DESKTOP: TABLA
            ============================== */}
        <div className="d-none d-md-block">
          <div className="table-responsive">
            <table className="table table-sm table-striped align-middle">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>No.</th>
                  <th>Nombre</th>
                  <th style={{ width: 110 }}>Precio</th>
                  <th style={{ width: 120 }}>Cantidad</th>
                  <th style={{ width: 210 }}>Almacén</th>
                  <th style={{ width: 130 }}>Ingreso</th>
                  <th style={{ width: 130 }}>Caducidad</th>
                  <th>Descripción</th>
                  <th style={{ width: 220 }}>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="9">Cargando...</td>
                  </tr>
                ) : insumosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan="9">Sin datos</td>
                  </tr>
                ) : (
                  insumosFiltrados.map((i, index) => {
                    const isEditing = editId === i.id_insumo;

                    return (
                      <tr key={i.id_insumo}>
                        <td className="text-muted">{index + 1}</td>

                        <td>
                          {isEditing ? (
                            <>
                              <input
                                className={`form-control form-control-sm ${
                                  editErrors.nombre_insumo ? 'is-invalid' : ''
                                }`}
                                value={editForm.nombre_insumo}
                                onChange={(e) => setEditForm((s) => ({ ...s, nombre_insumo: e.target.value }))}
                              />
                              {editErrors.nombre_insumo && (
                                <div className="invalid-feedback">{editErrors.nombre_insumo}</div>
                              )}
                            </>
                          ) : (
                            i.nombre_insumo
                          )}
                        </td>

                        <td>
                          {isEditing ? (
                            <>
                              <input
                                className={`form-control form-control-sm ${editErrors.precio ? 'is-invalid' : ''}`}
                                type="number"
                                step="0.01"
                                min="0"
                                value={editForm.precio}
                                onChange={(e) => setEditForm((s) => ({ ...s, precio: e.target.value }))}
                              />
                              {editErrors.precio && <div className="invalid-feedback">{editErrors.precio}</div>}
                            </>
                          ) : (
                            i.precio
                          )}
                        </td>

                        <td>
                          {isEditing ? (
                            <>
                              <input
                                className={`form-control form-control-sm ${editErrors.cantidad ? 'is-invalid' : ''}`}
                                type="number"
                                step="1"
                                min="0"
                                inputMode="numeric"
                                value={editForm.cantidad}
                                onKeyDown={blockNonIntegerKeys}
                                onChange={(e) =>
                                  setEditForm((s) => ({ ...s, cantidad: sanitizeInteger(e.target.value) }))
                                }
                              />
                              {editErrors.cantidad && <div className="invalid-feedback">{editErrors.cantidad}</div>}
                            </>
                          ) : (
                            i.cantidad
                          )}
                        </td>

                        <td>
                          {isEditing ? (
                            <>
                              <select
                                className={`form-select form-select-sm ${editErrors.id_almacen ? 'is-invalid' : ''}`}
                                value={String(editForm.id_almacen ?? '')}
                                onChange={(e) => setEditForm((s) => ({ ...s, id_almacen: e.target.value }))}
                                disabled={loadingAlmacenes}
                              >
                                <option value="">
                                  {loadingAlmacenes ? 'Cargando almacenes...' : 'Seleccione un almacén'}
                                </option>
                                {almacenes.map((a) => (
                                  <option key={a.id_almacen} value={a.id_almacen}>
                                    {a.nombre} (Sucursal {a.id_sucursal})
                                  </option>
                                ))}
                              </select>
                              {editErrors.id_almacen && (
                                <div className="invalid-feedback">{editErrors.id_almacen}</div>
                              )}
                            </>
                          ) : (
                            getAlmacenLabel(i.id_almacen)
                          )}
                        </td>

                        <td>
                          {isEditing ? (
                            <>
                              <input
                                className={`form-control form-control-sm ${
                                  editErrors.fecha_ingreso_insumo ? 'is-invalid' : ''
                                }`}
                                type="date"
                                value={editForm.fecha_ingreso_insumo}
                                onChange={(e) => setEditForm((s) => ({ ...s, fecha_ingreso_insumo: e.target.value }))}
                              />
                              {editErrors.fecha_ingreso_insumo && (
                                <div className="invalid-feedback">{editErrors.fecha_ingreso_insumo}</div>
                              )}
                            </>
                          ) : (
                            toDateInputValue(i.fecha_ingreso_insumo) || '-'
                          )}
                        </td>

                        <td>
                          {isEditing ? (
                            <>
                              <input
                                className={`form-control form-control-sm ${
                                  editErrors.fecha_caducidad ? 'is-invalid' : ''
                                }`}
                                type="date"
                                value={editForm.fecha_caducidad}
                                onChange={(e) => setEditForm((s) => ({ ...s, fecha_caducidad: e.target.value }))}
                              />
                              {editErrors.fecha_caducidad && (
                                <div className="invalid-feedback">{editErrors.fecha_caducidad}</div>
                              )}
                            </>
                          ) : (
                            toDateInputValue(i.fecha_caducidad) || '-'
                          )}
                        </td>

                        <td>
                          {isEditing ? (
                            <>
                              <input
                                className={`form-control form-control-sm ${
                                  editErrors.descripcion ? 'is-invalid' : ''
                                }`}
                                value={editForm.descripcion}
                                onChange={(e) => setEditForm((s) => ({ ...s, descripcion: e.target.value }))}
                              />
                              {editErrors.descripcion && (
                                <div className="invalid-feedback">{editErrors.descripcion}</div>
                              )}
                            </>
                          ) : (
                            i.descripcion || '-'
                          )}
                        </td>

                        <td>
                          {isEditing ? (
                            <div className="d-flex gap-2">
                              <button className="btn btn-sm btn-success" type="button" onClick={guardarEdicion}>
                                Guardar
                              </button>
                              <button className="btn btn-sm btn-secondary" type="button" onClick={cancelarEdicion}>
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <div className="d-flex gap-2">
                              <button
                                className="btn btn-sm btn-outline-primary"
                                type="button"
                                onClick={() => iniciarEdicion(i)}
                              >
                                Editar
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                type="button"
                                onClick={() => openConfirmDelete(i.id_insumo, i.nombre_insumo)}
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

        {/* ==============================
            SHEET CREAR (SOLO MÓVIL)
            ============================== */}
        {showCreateSheet && (
          <div
            className="modal fade show"
            style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 2500 }}
            role="dialog"
            aria-modal="true"
            onClick={() => setShowCreateSheet(false)}
          >
            <div
              style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: 12 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="card shadow">
                <div className="card-header d-flex align-items-center justify-content-between">
                  <div className="fw-semibold">Agregar insumo</div>
                  <button type="button" className="btn btn-sm btn-light" onClick={() => setShowCreateSheet(false)}>
                    ✕
                  </button>
                </div>

                <div className="card-body">
                  <form onSubmit={onCrear} className="row g-2">
                    <div className="col-12">
                      <label className="form-label mb-1">Nombre del insumo</label>
                      <input
                        className={`form-control ${createErrors.nombre_insumo ? 'is-invalid' : ''}`}
                        placeholder="Ej: Queso mozzarella"
                        value={form.nombre_insumo}
                        onChange={(e) => setForm((s) => ({ ...s, nombre_insumo: e.target.value }))}
                        required
                      />
                      {createErrors.nombre_insumo && (
                        <div className="invalid-feedback">{createErrors.nombre_insumo}</div>
                      )}
                    </div>

                    <div className="col-6">
                      <label className="form-label mb-1">Precio</label>
                      <input
                        className={`form-control ${createErrors.precio ? 'is-invalid' : ''}`}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Ej: 120.50"
                        value={form.precio}
                        onChange={(e) => setForm((s) => ({ ...s, precio: e.target.value }))}
                        required
                      />
                      {createErrors.precio && <div className="invalid-feedback">{createErrors.precio}</div>}
                    </div>

                    <div className="col-6">
                      <label className="form-label mb-1">Cantidad</label>
                      <input
                        className={`form-control ${createErrors.cantidad ? 'is-invalid' : ''}`}
                        type="number"
                        step="1"
                        min="0"
                        inputMode="numeric"
                        placeholder="Ej: 5"
                        value={form.cantidad}
                        onKeyDown={blockNonIntegerKeys}
                        onChange={(e) => setForm((s) => ({ ...s, cantidad: sanitizeInteger(e.target.value) }))}
                        required
                      />
                      {createErrors.cantidad && <div className="invalid-feedback">{createErrors.cantidad}</div>}
                    </div>

                    <div className="col-12">
                      <label className="form-label mb-1">Almacén</label>
                      <select
                        className={`form-select ${createErrors.id_almacen ? 'is-invalid' : ''}`}
                        value={String(form.id_almacen ?? '')}
                        onChange={(e) => setForm((s) => ({ ...s, id_almacen: e.target.value }))}
                        required
                        disabled={loadingAlmacenes}
                      >
                        <option value="">
                          {loadingAlmacenes ? 'Cargando almacenes...' : 'Seleccione un almacén'}
                        </option>
                        {almacenes.map((a) => (
                          <option key={a.id_almacen} value={a.id_almacen}>
                            {a.nombre} (Sucursal {a.id_sucursal})
                          </option>
                        ))}
                      </select>
                      {createErrors.id_almacen && <div className="invalid-feedback">{createErrors.id_almacen}</div>}
                    </div>

                    <div className="col-12">
                      <label className="form-label mb-1">Fecha de ingreso (opcional)</label>
                      <input
                        className={`form-control ${createErrors.fecha_ingreso_insumo ? 'is-invalid' : ''}`}
                        type="date"
                        value={form.fecha_ingreso_insumo}
                        onChange={(e) => setForm((s) => ({ ...s, fecha_ingreso_insumo: e.target.value }))}
                      />
                      {createErrors.fecha_ingreso_insumo && (
                        <div className="invalid-feedback">{createErrors.fecha_ingreso_insumo}</div>
                      )}
                    </div>

                    <div className="col-12">
                      <label className="form-label mb-1">Fecha de caducidad (opcional)</label>
                      <input
                        className={`form-control ${createErrors.fecha_caducidad ? 'is-invalid' : ''}`}
                        type="date"
                        value={form.fecha_caducidad}
                        onChange={(e) => setForm((s) => ({ ...s, fecha_caducidad: e.target.value }))}
                      />
                      {createErrors.fecha_caducidad && (
                        <div className="invalid-feedback">{createErrors.fecha_caducidad}</div>
                      )}
                    </div>

                    <div className="col-12">
                      <label className="form-label mb-1">Descripción (opcional)</label>
                      <input
                        className={`form-control ${createErrors.descripcion ? 'is-invalid' : ''}`}
                        placeholder="Ej: Bolsa de 1 libra"
                        value={form.descripcion}
                        onChange={(e) => setForm((s) => ({ ...s, descripcion: e.target.value }))}
                      />
                      {createErrors.descripcion && <div className="invalid-feedback">{createErrors.descripcion}</div>}
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

                <div className="card-footer text-muted small">LAS FECHAS SON OPCIONALES. SI NO APLICA, DÉJALAS VACÍAS.</div>
              </div>
            </div>
          </div>
        )}

        {/* ==============================
            MODAL CONFIRMAR ELIMINAR
            ============================== */}
        {confirmModal.show && (
          <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.55)' }} role="dialog" aria-modal="true">
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
                      <div className="fw-semibold">¿DESEAS ELIMINAR ESTE INSUMO?</div>
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
    </div>
  );
};

export default InsumosTab;
