import { useCallback, useEffect, useMemo, useState } from 'react';
import { inventarioService } from '../../../services/inventarioService';

const ProductosTab = ({ categorias = [], openToast }) => {
  // ==============================
  // TOAST (SI NO VIENE DEL PADRE)
  // ==============================
  const safeToast = (title, message, variant = 'success') => {
    if (typeof openToast === 'function') openToast(title, message, variant);
  };

  // ==============================
  // ESTADOS PRINCIPALES
  // ==============================
  const [productos, setProductos] = useState([]);
  const [loadingProductos, setLoadingProductos] = useState(true);
  const [error, setError] = useState('');

  // ==============================
  // DEPENDENCIAS (DROPDOWNS FK)
  // ==============================
  const [almacenes, setAlmacenes] = useState([]);
  const [loadingAlmacenes, setLoadingAlmacenes] = useState(false);

  const [tipoDepartamentos, setTipoDepartamentos] = useState([]);
  const [loadingTipoDepto, setLoadingTipoDepto] = useState(false);

  // ==============================
  // FILTROS
  // ==============================
  const [search, setSearch] = useState('');
  const [stockFiltro, setStockFiltro] = useState('todos'); // todos | con_stock | sin_stock
  const [categoriaFiltro, setCategoriaFiltro] = useState('todos'); // todos | id_categoria
  const [almacenFiltro, setAlmacenFiltro] = useState('todos'); // todos | id_almacen
  const [deptoFiltro, setDeptoFiltro] = useState('todos'); // todos | id_tipo_departamento

  // ==============================
  // MODAL CREAR (RESPONSIVE)
  // ==============================
  const [showCreateProductoSheet, setShowCreateProductoSheet] = useState(false);

  // ==============================
  // FORM CREAR
  // ==============================
  const [form, setForm] = useState({
    nombre_producto: '',
    precio: '',
    cantidad: '',
    descripcion_producto: '',
    fecha_ingreso_producto: '',
    fecha_caducidad: '',
    id_categoria_producto: '',
    id_almacen: '',
    id_tipo_departamento: '' // OPCIONAL
  });

  const [createErrors, setCreateErrors] = useState({});

  // ==============================
  // EDITAR
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
  // SOLO ENTEROS EN INPUT (BLOQUEAR DECIMALES)
  // ==============================
  const blockNonIntegerKeys = (e) => {
    const blocked = ['.', ',', 'e', 'E', '+', '-'];
    if (blocked.includes(e.key)) e.preventDefault();
  };

  const sanitizeInteger = (value) => String(value ?? '').replace(/[^\d]/g, '');

  // ==============================
  // MAPS PARA LABELS (NO MOSTRAR IDS)
  // ==============================
  const categoriasMap = useMemo(() => {
    const m = new Map();
    for (const c of categorias) {
      m.set(String(c?.id_categoria_producto), c);
    }
    return m;
  }, [categorias]);

  const almacenesMap = useMemo(() => {
    const m = new Map();
    for (const a of almacenes) {
      m.set(String(a?.id_almacen), a);
    }
    return m;
  }, [almacenes]);

  const tipoDeptoMap = useMemo(() => {
    const m = new Map();
    for (const d of tipoDepartamentos) {
      m.set(String(d?.id_tipo_departamento), d);
    }
    return m;
  }, [tipoDepartamentos]);

  const getCategoriaLabel = useCallback((id) => {
    const c = categoriasMap.get(String(id));
    if (!c) return String(id || '-');
    return `${c.nombre_categoria}`;
  }, [categoriasMap]);

  const getAlmacenLabel = useCallback((id) => {
    const a = almacenesMap.get(String(id));
    if (!a) return String(id || '-');
    return `${a.nombre} (Sucursal ${a.id_sucursal})`;
  }, [almacenesMap]);

  const getDeptoLabel = useCallback((id) => {
    if (!id && id !== 0) return '-';
    const d = tipoDeptoMap.get(String(id));
    if (!d) return String(id || '-');
    return `${d.nombre_departamento}${d.estado === false ? ' (Inactivo)' : ''}`;
  }, [tipoDeptoMap]);

  // ==============================
  // VALIDACIÓN MÍNIMA (PRODUCTOS)
  // ==============================
  const validarProducto = (data) => {
    // === LIMPIEZA ===
    const nombre = String(data?.nombre_producto ?? '').trim();
    const descripcion = String(data?.descripcion_producto ?? '').trim();

    const precioRaw = String(data?.precio ?? '').trim();
    const cantidadRaw = String(data?.cantidad ?? '').trim();

    const categoriaRaw = String(data?.id_categoria_producto ?? '').trim();
    const almacenRaw = String(data?.id_almacen ?? '').trim();
    const deptoRaw = String(data?.id_tipo_departamento ?? '').trim(); // OPCIONAL

    const fechaIngreso = String(data?.fecha_ingreso_producto ?? '').trim();
    const fechaCaducidad = String(data?.fecha_caducidad ?? '').trim();

    const errors = {};

    // === NOMBRE OBLIGATORIO ===
    if (nombre.length < 2) errors.nombre_producto = 'MÍNIMO 2 CARACTERES';
    if (nombre.length > 80) errors.nombre_producto = 'MÁXIMO 80 CARACTERES';

    // === PRECIO OBLIGATORIO (DECIMAL) ===
    const precio = Number.parseFloat(precioRaw);
    if (!precioRaw) errors.precio = 'EL PRECIO ES OBLIGATORIO';
    else if (Number.isNaN(precio) || precio < 0) errors.precio = 'DEBE SER UN NÚMERO >= 0';

    // === CANTIDAD OBLIGATORIA (ENTERO) ===
    const cantidad = Number.parseInt(cantidadRaw, 10);
    if (!cantidadRaw) errors.cantidad = 'LA CANTIDAD ES OBLIGATORIA';
    else if (!/^\d+$/.test(cantidadRaw)) errors.cantidad = 'SOLO ENTEROS (SIN DECIMALES)';
    else if (Number.isNaN(cantidad) || cantidad < 0) errors.cantidad = 'DEBE SER UN ENTERO >= 0';

    // === FK CATEGORÍA OBLIGATORIA ===
    const id_categoria_producto = Number.parseInt(categoriaRaw, 10);
    if (!categoriaRaw) errors.id_categoria_producto = 'LA CATEGORÍA ES OBLIGATORIA';
    else if (Number.isNaN(id_categoria_producto) || id_categoria_producto <= 0)
      errors.id_categoria_producto = 'DEBE SER UN NÚMERO > 0';

    // === FK ALMACÉN OBLIGATORIA ===
    const id_almacen = Number.parseInt(almacenRaw, 10);
    if (!almacenRaw) errors.id_almacen = 'EL ALMACÉN ES OBLIGATORIO';
    else if (Number.isNaN(id_almacen) || id_almacen <= 0) errors.id_almacen = 'DEBE SER UN NÚMERO > 0';

    // === FK TIPO_DEPARTAMENTO (OPCIONAL) ===
    let id_tipo_departamento = null;
    if (deptoRaw) {
      const parsed = Number.parseInt(deptoRaw, 10);
      if (Number.isNaN(parsed) || parsed <= 0) errors.id_tipo_departamento = 'DEBE SER UN NÚMERO > 0';
      else id_tipo_departamento = parsed;
    }

    // === DESCRIPCIÓN OPCIONAL ===
    if (descripcion.length > 150) errors.descripcion_producto = 'MÁXIMO 150 CARACTERES';

    // === FECHAS OPCIONALES ===
    if (fechaIngreso && !/^\d{4}-\d{2}-\d{2}$/.test(fechaIngreso)) {
      errors.fecha_ingreso_producto = 'FORMATO INVÁLIDO (YYYY-MM-DD)';
    }
    if (fechaCaducidad && !/^\d{4}-\d{2}-\d{2}$/.test(fechaCaducidad)) {
      errors.fecha_caducidad = 'FORMATO INVÁLIDO (YYYY-MM-DD)';
    }

    return {
      ok: Object.keys(errors).length === 0,
      errors,
      cleaned: {
        nombre_producto: nombre,
        precio,
        cantidad,
        descripcion_producto: descripcion,
        fecha_ingreso_producto: fechaIngreso,
        fecha_caducidad: fechaCaducidad,
        id_categoria_producto,
        id_almacen,
        id_tipo_departamento // PUEDE SER null (PERO NO LO ENVIAREMOS SI ES NULL)
      }
    };
  };

  // ==============================
  // CONSTRUIR PAYLOAD SIN NULLS
  // ==============================
  const buildProductoPayload = (cleaned) => {
    // COMENTARIO EN MAYÚSCULAS: OMITIMOS CAMPOS OPCIONALES VACÍOS PARA NO ENVIAR NULLS
    const payload = {
      nombre_producto: cleaned.nombre_producto,
      precio: cleaned.precio,
      cantidad: cleaned.cantidad,
      id_categoria_producto: cleaned.id_categoria_producto,
      id_almacen: cleaned.id_almacen
    };

    if (cleaned.descripcion_producto) payload.descripcion_producto = cleaned.descripcion_producto;
    if (cleaned.fecha_ingreso_producto) payload.fecha_ingreso_producto = cleaned.fecha_ingreso_producto;
    if (cleaned.fecha_caducidad) payload.fecha_caducidad = cleaned.fecha_caducidad;

    // COMENTARIO EN MAYÚSCULAS: SOLO ENVIAR id_tipo_departamento SI VIENE CON VALOR (NO NULL)
    if (cleaned.id_tipo_departamento) payload.id_tipo_departamento = cleaned.id_tipo_departamento;

    return payload;
  };

  // ==============================
  // CARGAS (API)
  // ==============================
  const cargarProductos = async () => {
    setLoadingProductos(true);
    setError('');
    try {
      // COMENTARIO EN MAYÚSCULAS: PRODUCTOS SE CARGA DESDE EL BACKEND /productos
      const data = await inventarioService.getProductos();
      setProductos(Array.isArray(data) ? data : []);
    } catch (e) {
      const msg = e?.message || 'ERROR CARGANDO PRODUCTOS';
      setError(msg);
      safeToast('ERROR', msg, 'danger');
    } finally {
      setLoadingProductos(false);
    }
  };

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

  const cargarTipoDepartamentos = async () => {
    setLoadingTipoDepto(true);
    try {
      // COMENTARIO EN MAYÚSCULAS: TIPO_DEPARTAMENTO VIENE DE /tipo_departamento
      const data = await inventarioService.getTipoDepartamentos();
      setTipoDepartamentos(Array.isArray(data) ? data : []);
    } catch (e) {
      const msg = e?.message || 'ERROR CARGANDO TIPO DEPARTAMENTO';
      setError(msg);
      safeToast('ERROR', msg, 'danger');
    } finally {
      setLoadingTipoDepto(false);
    }
  };

  useEffect(() => {
    // COMENTARIO EN MAYÚSCULAS: CARGA INICIAL DEL TAB PRODUCTOS
    cargarProductos();
    cargarAlmacenes();
    cargarTipoDepartamentos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==============================
  // RESET FORM CREAR
  // ==============================
  const resetForm = () => {
    setForm({
      nombre_producto: '',
      precio: '',
      cantidad: '',
      descripcion_producto: '',
      fecha_ingreso_producto: '',
      fecha_caducidad: '',
      id_categoria_producto: '',
      id_almacen: '',
      id_tipo_departamento: ''
    });
    setCreateErrors({});
  };

  // ==============================
  // CREAR PRODUCTO
  // ==============================
  const onCrear = async (e) => {
    e.preventDefault();
    setError('');

    const v = validarProducto(form);
    setCreateErrors(v.errors);
    if (!v.ok) return;

    try {
      const payload = buildProductoPayload(v.cleaned);
      await inventarioService.crearProducto(payload);

      resetForm();
      setShowCreateProductoSheet(false);
      await cargarProductos();

      safeToast('CREADO', 'EL PRODUCTO SE CREÓ CORRECTAMENTE.', 'success');
    } catch (e2) {
      const msg = e2?.message || 'ERROR CREANDO PRODUCTO';
      setError(msg);
      safeToast('ERROR', msg, 'danger');
    }
  };

  // ==============================
  // INICIAR / CANCELAR EDICIÓN
  // ==============================
  const iniciarEdicion = (p) => {
    setError('');
    setEditErrors({});
    setEditId(p.id_producto);

    setEditForm({
      nombre_producto: p.nombre_producto ?? '',
      precio: p.precio ?? '',
      cantidad: p.cantidad ?? '',
      descripcion_producto: p.descripcion_producto ?? '',
      fecha_ingreso_producto: toDateInputValue(p.fecha_ingreso_producto),
      fecha_caducidad: toDateInputValue(p.fecha_caducidad),
      id_categoria_producto: String(p.id_categoria_producto ?? ''),
      id_almacen: String(p.id_almacen ?? ''),
      id_tipo_departamento: p.id_tipo_departamento ? String(p.id_tipo_departamento) : ''
    });
  };

  const cancelarEdicion = () => {
    setEditId(null);
    setEditForm(null);
    setEditErrors({});
  };

  // ==============================
  // GUARDAR EDICIÓN (CAMPO POR CAMPO)
  // ==============================
  const guardarEdicion = async () => {
    if (!editId || !editForm) return;

    setError('');
    const v = validarProducto(editForm);
    setEditErrors(v.errors);
    if (!v.ok) return;

    try {
      // COMENTARIO EN MAYÚSCULAS: SOLO ACTUALIZAMOS CAMPOS QUE CAMBIARON
      const actual = productos.find((x) => x.id_producto === editId);

      const cambios = [];

      const nombreActual = String(actual?.nombre_producto ?? '').trim();
      const precioActual = Number.parseFloat(String(actual?.precio ?? ''));
      const cantidadActual = Number.parseInt(String(actual?.cantidad ?? ''), 10);

      const descActual = String(actual?.descripcion_producto ?? '').trim();

      const catActual = Number.parseInt(String(actual?.id_categoria_producto ?? ''), 10);
      const almActual = Number.parseInt(String(actual?.id_almacen ?? ''), 10);

      const ingresoActual = toDateInputValue(actual?.fecha_ingreso_producto);
      const caducidadActual = toDateInputValue(actual?.fecha_caducidad);

      const deptoActual = actual?.id_tipo_departamento ? Number.parseInt(String(actual.id_tipo_departamento), 10) : null;

      if (v.cleaned.nombre_producto !== nombreActual) cambios.push(['nombre_producto', v.cleaned.nombre_producto]);
      if (!Number.isNaN(v.cleaned.precio) && v.cleaned.precio !== precioActual) cambios.push(['precio', v.cleaned.precio]);
      if (!Number.isNaN(v.cleaned.cantidad) && v.cleaned.cantidad !== cantidadActual) cambios.push(['cantidad', v.cleaned.cantidad]);

      if (!Number.isNaN(v.cleaned.id_categoria_producto) && v.cleaned.id_categoria_producto !== catActual) {
        cambios.push(['id_categoria_producto', v.cleaned.id_categoria_producto]);
      }

      if (!Number.isNaN(v.cleaned.id_almacen) && v.cleaned.id_almacen !== almActual) {
        cambios.push(['id_almacen', v.cleaned.id_almacen]);
      }

      // DESCRIPCIÓN: PERMITIMOS VACÍO (NO ES NULL)
      if (v.cleaned.descripcion_producto !== descActual) cambios.push(['descripcion_producto', v.cleaned.descripcion_producto]);

      // FECHAS: SOLO ENVIAR SI VIENE CON VALOR (EVITAR ENVIAR VACÍO Y QUE EL SP FALLE)
      if (v.cleaned.fecha_ingreso_producto && v.cleaned.fecha_ingreso_producto !== ingresoActual) {
        cambios.push(['fecha_ingreso_producto', v.cleaned.fecha_ingreso_producto]);
      }
      if (v.cleaned.fecha_caducidad && v.cleaned.fecha_caducidad !== caducidadActual) {
        cambios.push(['fecha_caducidad', v.cleaned.fecha_caducidad]);
      }

      // TIPO_DEPARTAMENTO: SOLO ENVIAR SI EL USUARIO SELECCIONÓ UNO (NO NULL)
      if (v.cleaned.id_tipo_departamento && v.cleaned.id_tipo_departamento !== deptoActual) {
        cambios.push(['id_tipo_departamento', v.cleaned.id_tipo_departamento]);
      }

      if (cambios.length === 0) {
        safeToast('SIN CAMBIOS', 'NO HAY CAMBIOS PARA GUARDAR.', 'info');
        cancelarEdicion();
        return;
      }

      for (const [campo, valor] of cambios) {
        await inventarioService.actualizarProductoCampo(editId, campo, valor);
      }

      cancelarEdicion();
      await cargarProductos();

      safeToast('ACTUALIZADO', 'EL PRODUCTO SE ACTUALIZÓ CORRECTAMENTE.', 'success');
    } catch (e2) {
      const msg = e2?.message || 'ERROR ACTUALIZANDO PRODUCTO';
      setError(msg);
      safeToast('ERROR', msg, 'danger');
    }
  };

  // ==============================
  // ELIMINAR PRODUCTO (CONFIRMADO)
  // ==============================
  const eliminarConfirmado = async () => {
    const id = confirmModal.idToDelete;
    if (!id) return;

    setError('');
    try {
      await inventarioService.eliminarProducto(id);
      closeConfirmDelete();
      await cargarProductos();

      safeToast('ELIMINADO', 'EL PRODUCTO SE ELIMINÓ CORRECTAMENTE.', 'success');
    } catch (e) {
      closeConfirmDelete();
      const msg = e?.message || 'ERROR ELIMINANDO PRODUCTO';
      setError(msg);
      safeToast('ERROR', msg, 'danger');
    }
  };

  // ==============================
  // FILTRAR + ORDENAR
  // ==============================
  const productosFiltrados = useMemo(() => {
    const lista = [...productos].sort((a, b) => (a.id_producto ?? 0) - (b.id_producto ?? 0));
    const s = search.trim().toLowerCase();

    return lista.filter((p) => {
      const texto = `${p.nombre_producto ?? ''} ${p.descripcion_producto ?? ''} ${getCategoriaLabel(p.id_categoria_producto)} ${getAlmacenLabel(p.id_almacen)} ${getDeptoLabel(p.id_tipo_departamento)}`.toLowerCase();
      const matchTexto = s ? texto.includes(s) : true;

      const cant = Number.parseInt(String(p.cantidad ?? '0'), 10);
      const conStock = !Number.isNaN(cant) && cant > 0;

      const matchStock =
        stockFiltro === 'todos' ? true : stockFiltro === 'con_stock' ? conStock : !conStock;

      const matchCategoria =
        categoriaFiltro === 'todos' ? true : String(p.id_categoria_producto) === String(categoriaFiltro);

      const matchAlmacen =
        almacenFiltro === 'todos' ? true : String(p.id_almacen) === String(almacenFiltro);

      const matchDepto =
        deptoFiltro === 'todos'
          ? true
          : String(p.id_tipo_departamento ?? '') === String(deptoFiltro);

      return matchTexto && matchStock && matchCategoria && matchAlmacen && matchDepto;
    });
  }, [productos, search, stockFiltro, categoriaFiltro, almacenFiltro, deptoFiltro, getCategoriaLabel, getAlmacenLabel, getDeptoLabel]);

  return (
    <div className="card shadow-sm mb-3">
      <div className="card-header fw-semibold d-flex align-items-center justify-content-between">
        <span>Productos</span>

        <button
          type="button"
          className="btn btn-sm btn-primary d-md-none"
          onClick={() => setShowCreateProductoSheet(true)}
        >
          + Agregar
        </button>
      </div>

      <div className="card-body">
        {error && <div className="alert alert-danger">{error}</div>}

        {/* FORM CREAR (SOLO DESKTOP/TABLET) */}
        <div className="d-none d-md-block">
          <form onSubmit={onCrear} className="row g-2 mb-3">
            <div className="col-12 col-md-3">
              <label className="form-label mb-1">Nombre del producto</label>
              <input
                className={`form-control ${createErrors.nombre_producto ? 'is-invalid' : ''}`}
                placeholder="Ej: Hamburguesa clásica"
                value={form.nombre_producto}
                onChange={(e) => setForm((s) => ({ ...s, nombre_producto: e.target.value }))}
                required
              />
              {createErrors.nombre_producto && <div className="invalid-feedback">{createErrors.nombre_producto}</div>}
            </div>

            <div className="col-6 col-md-2">
              <label className="form-label mb-1">Precio</label>
              <input
                className={`form-control ${createErrors.precio ? 'is-invalid' : ''}`}
                type="number"
                step="0.01"
                min="0"
                placeholder="Ej: 150.00"
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
                placeholder="Ej: 10"
                value={form.cantidad}
                onKeyDown={blockNonIntegerKeys}
                onChange={(e) => setForm((s) => ({ ...s, cantidad: sanitizeInteger(e.target.value) }))}
                required
              />
              {createErrors.cantidad && <div className="invalid-feedback">{createErrors.cantidad}</div>}
            </div>

            <div className="col-12 col-md-2">
              <label className="form-label mb-1">Categoría</label>
              <select
                className={`form-select ${createErrors.id_categoria_producto ? 'is-invalid' : ''}`}
                value={String(form.id_categoria_producto ?? '')}
                onChange={(e) => setForm((s) => ({ ...s, id_categoria_producto: e.target.value }))}
                required
              >
                <option value="">Seleccione categoría</option>
                {categorias.map((c) => (
                  <option key={c.id_categoria_producto} value={c.id_categoria_producto}>
                    {c.nombre_categoria}
                  </option>
                ))}
              </select>
              {createErrors.id_categoria_producto && (
                <div className="invalid-feedback">{createErrors.id_categoria_producto}</div>
              )}
            </div>

            <div className="col-12 col-md-3">
              <label className="form-label mb-1">Almacén</label>
              <select
                className={`form-select ${createErrors.id_almacen ? 'is-invalid' : ''}`}
                value={String(form.id_almacen ?? '')}
                onChange={(e) => setForm((s) => ({ ...s, id_almacen: e.target.value }))}
                required
                disabled={loadingAlmacenes}
              >
                <option value="">
                  {loadingAlmacenes ? 'Cargando almacenes...' : 'Seleccione almacén'}
                </option>
                {almacenes.map((a) => (
                  <option key={a.id_almacen} value={a.id_almacen}>
                    {a.nombre} (Sucursal {a.id_sucursal})
                  </option>
                ))}
              </select>
              {createErrors.id_almacen && <div className="invalid-feedback">{createErrors.id_almacen}</div>}
            </div>

            <div className="col-12 col-md-3">
              <label className="form-label mb-1">Tipo departamento (opcional)</label>
              <select
                className={`form-select ${createErrors.id_tipo_departamento ? 'is-invalid' : ''}`}
                value={String(form.id_tipo_departamento ?? '')}
                onChange={(e) => setForm((s) => ({ ...s, id_tipo_departamento: e.target.value }))}
                disabled={loadingTipoDepto}
              >
                <option value="">
                  {loadingTipoDepto ? 'Cargando...' : 'Sin departamento'}
                </option>
                {tipoDepartamentos.map((d) => (
                  <option key={d.id_tipo_departamento} value={d.id_tipo_departamento}>
                    {d.nombre_departamento}{d.estado === false ? ' (Inactivo)' : ''}
                  </option>
                ))}
              </select>
              {createErrors.id_tipo_departamento && (
                <div className="invalid-feedback">{createErrors.id_tipo_departamento}</div>
              )}
            </div>

            <div className="col-12 col-md-3">
              <label className="form-label mb-1">Fecha ingreso (opcional)</label>
              <input
                className={`form-control ${createErrors.fecha_ingreso_producto ? 'is-invalid' : ''}`}
                type="date"
                value={form.fecha_ingreso_producto}
                onChange={(e) => setForm((s) => ({ ...s, fecha_ingreso_producto: e.target.value }))}
              />
              {createErrors.fecha_ingreso_producto && (
                <div className="invalid-feedback">{createErrors.fecha_ingreso_producto}</div>
              )}
            </div>

            <div className="col-12 col-md-3">
              <label className="form-label mb-1">Fecha caducidad (opcional)</label>
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
                className={`form-control ${createErrors.descripcion_producto ? 'is-invalid' : ''}`}
                placeholder="Ej: Incluye papas y bebida"
                value={form.descripcion_producto}
                onChange={(e) => setForm((s) => ({ ...s, descripcion_producto: e.target.value }))}
              />
              {createErrors.descripcion_producto && (
                <div className="invalid-feedback">{createErrors.descripcion_producto}</div>
              )}
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
          <div className="col-12 col-md-4">
            <input
              className="form-control"
              placeholder="Buscar por nombre, descripción, categoría, almacén..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="col-12 col-md-2">
            <select className="form-select" value={stockFiltro} onChange={(e) => setStockFiltro(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="con_stock">Con stock</option>
              <option value="sin_stock">Sin stock</option>
            </select>
          </div>

          <div className="col-12 col-md-2">
            <select className="form-select" value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)}>
              <option value="todos">Todas las categorías</option>
              {categorias.map((c) => (
                <option key={c.id_categoria_producto} value={c.id_categoria_producto}>
                  {c.nombre_categoria}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-md-2">
            <select className="form-select" value={almacenFiltro} onChange={(e) => setAlmacenFiltro(e.target.value)}>
              <option value="todos">Todos los almacenes</option>
              {almacenes.map((a) => (
                <option key={a.id_almacen} value={a.id_almacen}>
                  {a.nombre} (Sucursal {a.id_sucursal})
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-md-2">
            <select className="form-select" value={deptoFiltro} onChange={(e) => setDeptoFiltro(e.target.value)}>
              <option value="todos">Todos los deptos</option>
              {tipoDepartamentos.map((d) => (
                <option key={d.id_tipo_departamento} value={d.id_tipo_departamento}>
                  {d.nombre_departamento}{d.estado === false ? ' (Inactivo)' : ''}
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
                setStockFiltro('todos');
                setCategoriaFiltro('todos');
                setAlmacenFiltro('todos');
                setDeptoFiltro('todos');
              }}
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        {/* MOBILE CARDS */}
        <div className="d-md-none">
          {loadingProductos ? (
            <div className="text-muted">Cargando...</div>
          ) : productosFiltrados.length === 0 ? (
            <div className="text-muted">Sin datos</div>
          ) : (
            <div className="d-flex flex-column gap-2">
              {productosFiltrados.map((p, index) => {
                const isEditing = editId === p.id_producto;

                return (
                  <div key={p.id_producto} className="card border">
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div>
                          <div className="text-muted small">No. {index + 1}</div>
                          <div className="fw-bold">{isEditing ? 'EDITANDO' : p.nombre_producto}</div>
                          <div className="text-muted small">
                            Categoría: <span className="fw-semibold">{getCategoriaLabel(p.id_categoria_producto)}</span> •
                            Stock: <span className="fw-semibold">{p.cantidad}</span>
                          </div>
                          <div className="text-muted small">
                            Almacén: <span className="fw-semibold">{getAlmacenLabel(p.id_almacen)}</span>
                          </div>
                        </div>
                      </div>

                      {/* CAMPOS */}
                      <div className="mb-2">
                        <div className="small text-muted">Nombre</div>
                        {isEditing ? (
                          <>
                            <input
                              className={`form-control form-control-sm ${editErrors.nombre_producto ? 'is-invalid' : ''}`}
                              value={editForm.nombre_producto}
                              onChange={(e) => setEditForm((s) => ({ ...s, nombre_producto: e.target.value }))}
                            />
                            {editErrors.nombre_producto && <div className="invalid-feedback">{editErrors.nombre_producto}</div>}
                          </>
                        ) : (
                          <div>{p.nombre_producto}</div>
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
                            <div>{p.precio}</div>
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
                                onChange={(e) => setEditForm((s) => ({ ...s, cantidad: sanitizeInteger(e.target.value) }))}
                              />
                              {editErrors.cantidad && <div className="invalid-feedback">{editErrors.cantidad}</div>}
                            </>
                          ) : (
                            <div>{p.cantidad}</div>
                          )}
                        </div>

                        <div className="col-12">
                          <div className="small text-muted">Categoría</div>
                          {isEditing ? (
                            <>
                              <select
                                className={`form-select form-select-sm ${editErrors.id_categoria_producto ? 'is-invalid' : ''}`}
                                value={String(editForm.id_categoria_producto ?? '')}
                                onChange={(e) => setEditForm((s) => ({ ...s, id_categoria_producto: e.target.value }))}
                              >
                                <option value="">Seleccione</option>
                                {categorias.map((c) => (
                                  <option key={c.id_categoria_producto} value={c.id_categoria_producto}>
                                    {c.nombre_categoria}
                                  </option>
                                ))}
                              </select>
                              {editErrors.id_categoria_producto && (
                                <div className="invalid-feedback">{editErrors.id_categoria_producto}</div>
                              )}
                            </>
                          ) : (
                            <div>{getCategoriaLabel(p.id_categoria_producto)}</div>
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
                                  {loadingAlmacenes ? 'Cargando...' : 'Seleccione'}
                                </option>
                                {almacenes.map((a) => (
                                  <option key={a.id_almacen} value={a.id_almacen}>
                                    {a.nombre} (Sucursal {a.id_sucursal})
                                  </option>
                                ))}
                              </select>
                              {editErrors.id_almacen && <div className="invalid-feedback">{editErrors.id_almacen}</div>}
                            </>
                          ) : (
                            <div>{getAlmacenLabel(p.id_almacen)}</div>
                          )}
                        </div>

                        <div className="col-12">
                          <div className="small text-muted">Departamento (opcional)</div>
                          {isEditing ? (
                            <>
                              <select
                                className={`form-select form-select-sm ${editErrors.id_tipo_departamento ? 'is-invalid' : ''}`}
                                value={String(editForm.id_tipo_departamento ?? '')}
                                onChange={(e) => setEditForm((s) => ({ ...s, id_tipo_departamento: e.target.value }))}
                                disabled={loadingTipoDepto}
                              >
                                <option value="">
                                  {loadingTipoDepto ? 'Cargando...' : 'Sin departamento'}
                                </option>
                                {tipoDepartamentos.map((d) => (
                                  <option key={d.id_tipo_departamento} value={d.id_tipo_departamento}>
                                    {d.nombre_departamento}{d.estado === false ? ' (Inactivo)' : ''}
                                  </option>
                                ))}
                              </select>
                              {editErrors.id_tipo_departamento && (
                                <div className="invalid-feedback">{editErrors.id_tipo_departamento}</div>
                              )}
                            </>
                          ) : (
                            <div>{getDeptoLabel(p.id_tipo_departamento)}</div>
                          )}
                        </div>

                        <div className="col-12">
                          <div className="small text-muted">Descripción (opcional)</div>
                          {isEditing ? (
                            <>
                              <input
                                className={`form-control form-control-sm ${editErrors.descripcion_producto ? 'is-invalid' : ''}`}
                                value={editForm.descripcion_producto}
                                onChange={(e) => setEditForm((s) => ({ ...s, descripcion_producto: e.target.value }))}
                              />
                              {editErrors.descripcion_producto && (
                                <div className="invalid-feedback">{editErrors.descripcion_producto}</div>
                              )}
                            </>
                          ) : (
                            <div className="text-muted">{p.descripcion_producto || '-'}</div>
                          )}
                        </div>

                        <div className="col-12">
                          {isEditing ? (
                            <div className="d-flex gap-2 mt-2">
                              <button className="btn btn-sm btn-primary" type="button" onClick={guardarEdicion}>
                                Guardar
                              </button>
                              <button className="btn btn-sm btn-outline-secondary" type="button" onClick={cancelarEdicion}>
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <div className="d-flex gap-2 mt-2">
                              <button className="btn btn-sm btn-outline-primary" type="button" onClick={() => iniciarEdicion(p)}>
                                Editar
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                type="button"
                                onClick={() => openConfirmDelete(p.id_producto, p.nombre_producto)}
                              >
                                Eliminar
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* DESKTOP TABLE */}
        <div className="d-none d-md-block">
          {loadingProductos ? (
            <div className="text-muted">Cargando...</div>
          ) : productosFiltrados.length === 0 ? (
            <div className="text-muted">Sin datos</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>No.</th>
                    <th>Nombre</th>
                    <th>Categoría</th>
                    <th>Almacén</th>
                    <th>Departamento</th>
                    <th className="text-end">Precio</th>
                    <th className="text-end">Cantidad</th>
                    <th style={{ width: 220 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {productosFiltrados.map((p, index) => {
                    const isEditing = editId === p.id_producto;

                    return (
                      <tr key={p.id_producto}>
                        <td className="text-muted">{index + 1}</td>

                        <td>
                          {isEditing ? (
                            <>
                              <input
                                className={`form-control form-control-sm ${editErrors.nombre_producto ? 'is-invalid' : ''}`}
                                value={editForm.nombre_producto}
                                onChange={(e) => setEditForm((s) => ({ ...s, nombre_producto: e.target.value }))}
                              />
                              {editErrors.nombre_producto && <div className="invalid-feedback">{editErrors.nombre_producto}</div>}
                            </>
                          ) : (
                            <div className="fw-semibold">{p.nombre_producto}</div>
                          )}
                          {!isEditing && (
                            <div className="text-muted small">{p.descripcion_producto || '-'}</div>
                          )}
                        </td>

                        <td>
                          {isEditing ? (
                            <>
                              <select
                                className={`form-select form-select-sm ${editErrors.id_categoria_producto ? 'is-invalid' : ''}`}
                                value={String(editForm.id_categoria_producto ?? '')}
                                onChange={(e) => setEditForm((s) => ({ ...s, id_categoria_producto: e.target.value }))}
                              >
                                <option value="">Seleccione</option>
                                {categorias.map((c) => (
                                  <option key={c.id_categoria_producto} value={c.id_categoria_producto}>
                                    {c.nombre_categoria}
                                  </option>
                                ))}
                              </select>
                              {editErrors.id_categoria_producto && (
                                <div className="invalid-feedback">{editErrors.id_categoria_producto}</div>
                              )}
                            </>
                          ) : (
                            <span>{getCategoriaLabel(p.id_categoria_producto)}</span>
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
                                  {loadingAlmacenes ? 'Cargando...' : 'Seleccione'}
                                </option>
                                {almacenes.map((a) => (
                                  <option key={a.id_almacen} value={a.id_almacen}>
                                    {a.nombre} (Sucursal {a.id_sucursal})
                                  </option>
                                ))}
                              </select>
                              {editErrors.id_almacen && <div className="invalid-feedback">{editErrors.id_almacen}</div>}
                            </>
                          ) : (
                            <span>{getAlmacenLabel(p.id_almacen)}</span>
                          )}
                        </td>

                        <td>
                          {isEditing ? (
                            <>
                              <select
                                className={`form-select form-select-sm ${editErrors.id_tipo_departamento ? 'is-invalid' : ''}`}
                                value={String(editForm.id_tipo_departamento ?? '')}
                                onChange={(e) => setEditForm((s) => ({ ...s, id_tipo_departamento: e.target.value }))}
                                disabled={loadingTipoDepto}
                              >
                                <option value="">
                                  {loadingTipoDepto ? 'Cargando...' : 'Sin departamento'}
                                </option>
                                {tipoDepartamentos.map((d) => (
                                  <option key={d.id_tipo_departamento} value={d.id_tipo_departamento}>
                                    {d.nombre_departamento}{d.estado === false ? ' (Inactivo)' : ''}
                                  </option>
                                ))}
                              </select>
                              {editErrors.id_tipo_departamento && (
                                <div className="invalid-feedback">{editErrors.id_tipo_departamento}</div>
                              )}
                            </>
                          ) : (
                            <span>{getDeptoLabel(p.id_tipo_departamento)}</span>
                          )}
                        </td>

                        <td className="text-end">
                          {isEditing ? (
                            <>
                              <input
                                className={`form-control form-control-sm text-end ${editErrors.precio ? 'is-invalid' : ''}`}
                                type="number"
                                step="0.01"
                                min="0"
                                value={editForm.precio}
                                onChange={(e) => setEditForm((s) => ({ ...s, precio: e.target.value }))}
                              />
                              {editErrors.precio && <div className="invalid-feedback">{editErrors.precio}</div>}
                            </>
                          ) : (
                            <span className="fw-semibold">{p.precio}</span>
                          )}
                        </td>

                        <td className="text-end">
                          {isEditing ? (
                            <>
                              <input
                                className={`form-control form-control-sm text-end ${editErrors.cantidad ? 'is-invalid' : ''}`}
                                type="number"
                                step="1"
                                min="0"
                                inputMode="numeric"
                                value={editForm.cantidad}
                                onKeyDown={blockNonIntegerKeys}
                                onChange={(e) => setEditForm((s) => ({ ...s, cantidad: sanitizeInteger(e.target.value) }))}
                              />
                              {editErrors.cantidad && <div className="invalid-feedback">{editErrors.cantidad}</div>}
                            </>
                          ) : (
                            <span className="fw-semibold">{p.cantidad}</span>
                          )}
                        </td>

                        <td>
                          {isEditing ? (
                            <div className="d-flex gap-2">
                              <button className="btn btn-sm btn-primary" type="button" onClick={guardarEdicion}>
                                Guardar
                              </button>
                              <button className="btn btn-sm btn-outline-secondary" type="button" onClick={cancelarEdicion}>
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <div className="d-flex gap-2">
                              <button className="btn btn-sm btn-outline-primary" type="button" onClick={() => iniciarEdicion(p)}>
                                Editar
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                type="button"
                                onClick={() => openConfirmDelete(p.id_producto, p.nombre_producto)}
                              >
                                Eliminar
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ==============================
            SHEET CREAR PRODUCTO (MÓVIL CENTRADO)
            ============================== */}
        {showCreateProductoSheet && (
          <div
            className="modal fade show"
            style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 2500 }}
            role="dialog"
            aria-modal="true"
            onClick={() => setShowCreateProductoSheet(false)}
          >
            <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content shadow">
                <div className="modal-header d-flex align-items-center justify-content-between">
                  <div className="fw-semibold">Agregar producto</div>
                  <button type="button" className="btn btn-sm btn-light" onClick={() => setShowCreateProductoSheet(false)}>
                    ✕
                  </button>
                </div>

                <div className="modal-body">
                  <form onSubmit={onCrear} className="row g-2">
                    <div className="col-12">
                      <label className="form-label mb-1">Nombre</label>
                      <input
                        className={`form-control ${createErrors.nombre_producto ? 'is-invalid' : ''}`}
                        value={form.nombre_producto}
                        onChange={(e) => setForm((s) => ({ ...s, nombre_producto: e.target.value }))}
                        required
                      />
                      {createErrors.nombre_producto && <div className="invalid-feedback">{createErrors.nombre_producto}</div>}
                    </div>

                    <div className="col-6">
                      <label className="form-label mb-1">Precio</label>
                      <input
                        className={`form-control ${createErrors.precio ? 'is-invalid' : ''}`}
                        type="number"
                        step="0.01"
                        min="0"
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
                        value={form.cantidad}
                        onKeyDown={blockNonIntegerKeys}
                        onChange={(e) => setForm((s) => ({ ...s, cantidad: sanitizeInteger(e.target.value) }))}
                        required
                      />
                      {createErrors.cantidad && <div className="invalid-feedback">{createErrors.cantidad}</div>}
                    </div>

                    <div className="col-12">
                      <label className="form-label mb-1">Categoría</label>
                      <select
                        className={`form-select ${createErrors.id_categoria_producto ? 'is-invalid' : ''}`}
                        value={String(form.id_categoria_producto ?? '')}
                        onChange={(e) => setForm((s) => ({ ...s, id_categoria_producto: e.target.value }))}
                        required
                      >
                        <option value="">Seleccione</option>
                        {categorias.map((c) => (
                          <option key={c.id_categoria_producto} value={c.id_categoria_producto}>
                            {c.nombre_categoria}
                          </option>
                        ))}
                      </select>
                      {createErrors.id_categoria_producto && (
                        <div className="invalid-feedback">{createErrors.id_categoria_producto}</div>
                      )}
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
                          {loadingAlmacenes ? 'Cargando...' : 'Seleccione'}
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
                      <label className="form-label mb-1">Tipo departamento (opcional)</label>
                      <select
                        className={`form-select ${createErrors.id_tipo_departamento ? 'is-invalid' : ''}`}
                        value={String(form.id_tipo_departamento ?? '')}
                        onChange={(e) => setForm((s) => ({ ...s, id_tipo_departamento: e.target.value }))}
                        disabled={loadingTipoDepto}
                      >
                        <option value="">
                          {loadingTipoDepto ? 'Cargando...' : 'Sin departamento'}
                        </option>
                        {tipoDepartamentos.map((d) => (
                          <option key={d.id_tipo_departamento} value={d.id_tipo_departamento}>
                            {d.nombre_departamento}{d.estado === false ? ' (Inactivo)' : ''}
                          </option>
                        ))}
                      </select>
                      {createErrors.id_tipo_departamento && (
                        <div className="invalid-feedback">{createErrors.id_tipo_departamento}</div>
                      )}
                    </div>

                    <div className="col-12">
                      <label className="form-label mb-1">Descripción (opcional)</label>
                      <input
                        className={`form-control ${createErrors.descripcion_producto ? 'is-invalid' : ''}`}
                        value={form.descripcion_producto}
                        onChange={(e) => setForm((s) => ({ ...s, descripcion_producto: e.target.value }))}
                      />
                      {createErrors.descripcion_producto && (
                        <div className="invalid-feedback">{createErrors.descripcion_producto}</div>
                      )}
                    </div>

                    <div className="col-12 d-grid gap-2 mt-2">
                      <button className="btn btn-primary" type="submit">
                        Guardar
                      </button>
                      <button className="btn btn-outline-secondary" type="button" onClick={() => setShowCreateProductoSheet(false)}>
                        Cancelar
                      </button>
                    </div>
                  </form>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* ==============================
            MODAL CONFIRMAR ELIMINAR
            ============================== */}
        {confirmModal.show && (
          <div
            className="modal fade show"
            style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 2600 }}
            role="dialog"
            aria-modal="true"
            onClick={closeConfirmDelete}
          >
            <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content shadow">
                <div className="modal-header d-flex align-items-center justify-content-between">
                  <div className="fw-semibold">Confirmar eliminación</div>
                  <button type="button" className="btn btn-sm btn-light" onClick={closeConfirmDelete}>
                    ✕
                  </button>
                </div>

                <div className="modal-body">
                  <div className="mb-2">
                    ¿Deseas eliminar este producto?
                  </div>
                  {confirmModal.nombre && (
                    <div className="text-muted small">
                      <span className="fw-semibold">{confirmModal.nombre}</span>
                    </div>
                  )}
                </div>

                <div className="modal-footer d-flex gap-2">
                  <button className="btn btn-outline-secondary" type="button" onClick={closeConfirmDelete}>
                    Cancelar
                  </button>
                  <button className="btn btn-danger" type="button" onClick={eliminarConfirmado}>
                    Eliminar
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

export default ProductosTab;
