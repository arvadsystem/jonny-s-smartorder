import { useEffect, useMemo, useState } from 'react';
import { inventarioService } from '../../../services/inventarioService';

const MovimientosTab = ({ openToast }) => {
  // ==============================
  // ESTADOS PRINCIPALES
  // ==============================
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // LISTAS PARA DROPDOWNS (FK)
  const [almacenes, setAlmacenes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [loadingRefs, setLoadingRefs] = useState(false);

  // ==============================
  // MODAL CREAR (MÓVIL)
  // ==============================
  const [showCreateSheet, setShowCreateSheet] = useState(false);

  // ==============================
  // FILTROS
  // ==============================
  const [search, setSearch] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('todos'); // todos | ENTRADA | SALIDA | AJUSTE
  const [almacenFiltro, setAlmacenFiltro] = useState('todos'); // todos | id_almacen
  const [itemFiltro, setItemFiltro] = useState('todos'); // todos | producto | insumo
  const [desde, setDesde] = useState(''); // YYYY-MM-DD
  const [hasta, setHasta] = useState(''); // YYYY-MM-DD

  // ==============================
  // FORM CREAR
  // ==============================
  const [form, setForm] = useState({
    item_tipo: 'producto', // producto | insumo
    id_producto: '',
    id_insumo: '',
    id_almacen: '',
    tipo: 'ENTRADA',
    cantidad: '',
    ref_origen: '',
    id_ref: '',
    descripcion: ''
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
    titulo: ''
  });

  const openConfirmDelete = (id, titulo) => {
    setConfirmModal({ show: true, idToDelete: id, titulo: titulo || '' });
  };

  const closeConfirmDelete = () => {
    setConfirmModal({ show: false, idToDelete: null, titulo: '' });
  };

  // ==============================
  // HELPERS
  // ==============================
  const blockNonIntegerKeys = (e) => {
    const blocked = ['.', ',', 'e', 'E', '+', '-'];
    if (blocked.includes(e.key)) e.preventDefault();
  };

  const sanitizeInteger = (value) => String(value ?? '').replace(/[^\d]/g, '');

  const toDateOnly = (value) => {
    if (!value) return '';
    const s = String(value);
    if (s.includes('T')) return s.split('T')[0];
    // SI ES "2026-01-01 10:00:00", TOMAR SOLO FECHA
    if (s.includes(' ')) return s.split(' ')[0];
    return s;
  };

  const safeToast = (title, msg, variant) => {
    if (typeof openToast === 'function') openToast(title, msg, variant);
  };

  // ==============================
  // MAPAS ID -> LABEL
  // ==============================
  const almacenesMap = useMemo(() => {
    const m = new Map();
    for (const a of almacenes) m.set(String(a?.id_almacen), a);
    return m;
  }, [almacenes]);

  const productosMap = useMemo(() => {
    const m = new Map();
    for (const p of productos) m.set(String(p?.id_producto), p);
    return m;
  }, [productos]);

  const insumosMap = useMemo(() => {
    const m = new Map();
    for (const i of insumos) m.set(String(i?.id_insumo), i);
    return m;
  }, [insumos]);

  const getAlmacenLabel = (id) => {
    const a = almacenesMap.get(String(id));
    if (!a) return String(id || '-');
    // COMENTARIO EN MAYÚSCULAS: MISMO FORMATO QUE INSUMOS/PRODUCTOS (NOMBRE + SUCURSAL)
    return `${a.nombre} (Sucursal ${a.id_sucursal})`;
  };

  const getItemLabel = (mov) => {
    if (mov?.id_producto) {
      const p = productosMap.get(String(mov.id_producto));
      return p?.nombre_producto || `Producto #${mov.id_producto}`;
    }
    if (mov?.id_insumo) {
      const i = insumosMap.get(String(mov.id_insumo));
      return i?.nombre_insumo || `Insumo #${mov.id_insumo}`;
    }
    return '-';
  };

  const getItemTipo = (mov) => {
    if (mov?.id_producto) return 'Producto';
    if (mov?.id_insumo) return 'Insumo';
    return '-';
  };

  // ==============================
  // VALIDACIÓN MÍNIMA
  // ==============================
  const validarMovimiento = (data) => {
    const errors = {};

    const item_tipo = String(data?.item_tipo ?? 'producto');
    const id_producto_raw = String(data?.id_producto ?? '').trim();
    const id_insumo_raw = String(data?.id_insumo ?? '').trim();
    const id_almacen_raw = String(data?.id_almacen ?? '').trim();

    const tipo = String(data?.tipo ?? '').trim().toUpperCase();
    const cantidad_raw = String(data?.cantidad ?? '').trim();

    const ref_origen = String(data?.ref_origen ?? '').trim();
    const id_ref_raw = String(data?.id_ref ?? '').trim();
    const descripcion = String(data?.descripcion ?? '').trim();

    const id_almacen = Number.parseInt(id_almacen_raw, 10);
    const cantidad = Number.parseInt(cantidad_raw, 10);

    const id_producto = id_producto_raw ? Number.parseInt(id_producto_raw, 10) : null;
    const id_insumo = id_insumo_raw ? Number.parseInt(id_insumo_raw, 10) : null;

    // TIPO
    if (!['ENTRADA', 'SALIDA', 'AJUSTE'].includes(tipo)) {
      errors.tipo = 'TIPO INVÁLIDO (ENTRADA/SALIDA/AJUSTE)';
    }

    // CANTIDAD ENTERA > 0
    if (!cantidad_raw) errors.cantidad = 'LA CANTIDAD ES OBLIGATORIA';
    else if (!/^\d+$/.test(cantidad_raw)) errors.cantidad = 'SOLO ENTEROS (SIN DECIMALES)';
    else if (Number.isNaN(cantidad) || cantidad <= 0) errors.cantidad = 'DEBE SER UN ENTERO > 0';

    // ALMACÉN
    if (!id_almacen_raw) errors.id_almacen = 'EL ALMACÉN ES OBLIGATORIO';
    else if (Number.isNaN(id_almacen) || id_almacen <= 0) errors.id_almacen = 'ALMACÉN INVÁLIDO';

    // ITEM: PRODUCTO O INSUMO
    if (item_tipo === 'producto') {
      if (!id_producto_raw) errors.id_producto = 'SELECCIONA UN PRODUCTO';
      else if (Number.isNaN(id_producto) || id_producto <= 0) errors.id_producto = 'PRODUCTO INVÁLIDO';
    } else {
      if (!id_insumo_raw) errors.id_insumo = 'SELECCIONA UN INSUMO';
      else if (Number.isNaN(id_insumo) || id_insumo <= 0) errors.id_insumo = 'INSUMO INVÁLIDO';
    }

    // REF ORIGEN OPCIONAL
    if (ref_origen && ref_origen.length > 30) errors.ref_origen = 'MÁXIMO 30 CARACTERES';

    // ID_REF OPCIONAL ENTERO
    if (id_ref_raw && !/^\d+$/.test(id_ref_raw)) errors.id_ref = 'ID REF DEBE SER ENTERO';

    // DESCRIPCIÓN OPCIONAL
    if (descripcion && descripcion.length > 150) errors.descripcion = 'MÁXIMO 150 CARACTERES';

    const ok = Object.keys(errors).length === 0;

    // COMENTARIO EN MAYÚSCULAS: PAYLOAD LIMPIO (SIN NULLS EN OPCIONALES)
    const cleaned = {
      tipo,
      cantidad,
      id_almacen
    };

    if (item_tipo === 'producto') cleaned.id_producto = id_producto;
    else cleaned.id_insumo = id_insumo;

    if (ref_origen) cleaned.ref_origen = ref_origen;
    if (id_ref_raw) cleaned.id_ref = Number.parseInt(id_ref_raw, 10);
    if (descripcion) cleaned.descripcion = descripcion;

    return { ok, errors, cleaned };
  };

  // ==============================
  // CARGAS
  // ==============================
  const cargarRefs = async () => {
    setLoadingRefs(true);
    try {
      const [a, p, i] = await Promise.all([
        inventarioService.getAlmacenes(),
        inventarioService.getProductos(),
        inventarioService.getInsumos()
      ]);

      setAlmacenes(Array.isArray(a) ? a : []);
      setProductos(Array.isArray(p) ? p : []);
      setInsumos(Array.isArray(i) ? i : []);
    } catch (e) {
      const msg = e?.message || 'ERROR CARGANDO REFERENCIAS';
      setError(msg);
      safeToast('ERROR', msg, 'danger');
    } finally {
      setLoadingRefs(false);
    }
  };

  const cargarMovimientos = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await inventarioService.getMovimientosInventario();
      setMovimientos(Array.isArray(data) ? data : []);
    } catch (e) {
      const msg = e?.message || 'ERROR CARGANDO MOVIMIENTOS';
      setError(msg);
      safeToast('ERROR', msg, 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // COMENTARIO EN MAYÚSCULAS: CARGAR LISTAS FK + MOVIMIENTOS AL ENTRAR AL TAB
    cargarRefs();
    cargarMovimientos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==============================
  // CREAR
  // ==============================
  const resetForm = () => {
    setForm({
      item_tipo: 'producto',
      id_producto: '',
      id_insumo: '',
      id_almacen: '',
      tipo: 'ENTRADA',
      cantidad: '',
      ref_origen: '',
      id_ref: '',
      descripcion: ''
    });
    setCreateErrors({});
  };

  const onCrear = async (e) => {
    e.preventDefault();
    setError('');

    const v = validarMovimiento(form);
    setCreateErrors(v.errors);
    if (!v.ok) return;

    try {
      await inventarioService.crearMovimientoInventario(v.cleaned);
      resetForm();
      setShowCreateSheet(false);
      await cargarMovimientos();
      safeToast('CREADO', 'EL MOVIMIENTO SE REGISTRÓ CORRECTAMENTE.', 'success');
    } catch (e2) {
      const msg = e2?.message || 'ERROR CREANDO MOVIMIENTO';
      setError(msg);
      safeToast('ERROR', msg, 'danger');
    }
  };

  // ==============================
  // EDITAR
  // ==============================
  const iniciarEdicion = (m) => {
    setError('');
    setEditErrors({});
    setEditId(m.id_movimiento);

    // COMENTARIO EN MAYÚSCULAS: DETERMINAR SI ES PRODUCTO O INSUMO PARA EL FORM
    const item_tipo = m?.id_producto ? 'producto' : 'insumo';

    setEditForm({
      item_tipo,
      id_producto: String(m?.id_producto ?? ''),
      id_insumo: String(m?.id_insumo ?? ''),
      id_almacen: String(m?.id_almacen ?? ''),
      tipo: String(m?.tipo ?? 'ENTRADA').toUpperCase(),
      cantidad: String(m?.cantidad ?? ''),
      ref_origen: String(m?.ref_origen ?? ''),
      id_ref: String(m?.id_ref ?? ''),
      descripcion: String(m?.descripcion ?? '')
    });
  };

  const cancelarEdicion = () => {
    setEditId(null);
    setEditForm(null);
    setEditErrors({});
  };

  const guardarEdicion = async () => {
    if (!editId || !editForm) return;
    setError('');

    const v = validarMovimiento(editForm);
    setEditErrors(v.errors);
    if (!v.ok) return;

    try {
      const actual = movimientos.find((x) => x.id_movimiento === editId);
      if (!actual) {
        safeToast('ERROR', 'NO SE ENCONTRÓ EL MOVIMIENTO A EDITAR.', 'danger');
        cancelarEdicion();
        return;
      }

      // COMENTARIO EN MAYÚSCULAS: ENVIAR SOLO CAMPOS QUE CAMBIARON (PATRÓN REUTILIZABLE)
      const cambios = [];

      const actual_tipo = String(actual?.tipo ?? '').toUpperCase();
      const actual_cantidad = Number.parseInt(String(actual?.cantidad ?? ''), 10);
      const actual_almacen = Number.parseInt(String(actual?.id_almacen ?? ''), 10);

      const actual_prod = actual?.id_producto ? Number.parseInt(String(actual.id_producto), 10) : null;
      const actual_ins = actual?.id_insumo ? Number.parseInt(String(actual.id_insumo), 10) : null;

      const actual_ref_origen = String(actual?.ref_origen ?? '').trim();
      const actual_id_ref = actual?.id_ref !== null && actual?.id_ref !== undefined ? String(actual.id_ref) : '';
      const actual_desc = String(actual?.descripcion ?? '').trim();

      if (v.cleaned.tipo !== actual_tipo) cambios.push(['tipo', v.cleaned.tipo]);
      if (v.cleaned.cantidad !== actual_cantidad) cambios.push(['cantidad', v.cleaned.cantidad]);
      if (v.cleaned.id_almacen !== actual_almacen) cambios.push(['id_almacen', v.cleaned.id_almacen]);

      // ITEM (PRODUCTO/INSUMO)
      if (v.cleaned.id_producto) {
        if (actual_prod !== v.cleaned.id_producto) cambios.push(['id_producto', v.cleaned.id_producto]);
        if (actual_ins !== null) cambios.push(['id_insumo', '']); // COMENTARIO EN MAYÚSCULAS: LIMPIAR EL OTRO FK
      } else if (v.cleaned.id_insumo) {
        if (actual_ins !== v.cleaned.id_insumo) cambios.push(['id_insumo', v.cleaned.id_insumo]);
        if (actual_prod !== null) cambios.push(['id_producto', '']); // COMENTARIO EN MAYÚSCULAS: LIMPIAR EL OTRO FK
      }

      // OPCIONALES
      if ((v.cleaned.ref_origen || '') !== actual_ref_origen) cambios.push(['ref_origen', v.cleaned.ref_origen || '']);
      if (String(v.cleaned.id_ref ?? '') !== actual_id_ref) cambios.push(['id_ref', v.cleaned.id_ref ?? '']);
      if ((v.cleaned.descripcion || '') !== actual_desc) cambios.push(['descripcion', v.cleaned.descripcion || '']);

      if (cambios.length === 0) {
        safeToast('SIN CAMBIOS', 'NO HAY CAMBIOS PARA GUARDAR.', 'info');
        cancelarEdicion();
        return;
      }

      for (const [campo, valor] of cambios) {
        await inventarioService.actualizarMovimientoInventarioCampo(editId, campo, valor);
      }

      cancelarEdicion();
      await cargarMovimientos();
      safeToast('ACTUALIZADO', 'EL MOVIMIENTO SE ACTUALIZÓ CORRECTAMENTE.', 'success');
    } catch (e2) {
      const msg = e2?.message || 'ERROR ACTUALIZANDO MOVIMIENTO';
      setError(msg);
      safeToast('ERROR', msg, 'danger');
    }
  };

  // ==============================
  // ELIMINAR
  // ==============================
  const eliminarConfirmado = async () => {
    const id = confirmModal.idToDelete;
    if (!id) return;

    setError('');
    try {
      await inventarioService.eliminarMovimientoInventario(id);
      closeConfirmDelete();
      await cargarMovimientos();
      safeToast('ELIMINADO', 'EL MOVIMIENTO SE ELIMINÓ CORRECTAMENTE.', 'success');
    } catch (e) {
      closeConfirmDelete();
      const msg = e?.message || 'ERROR ELIMINANDO MOVIMIENTO';
      setError(msg);
      safeToast('ERROR', msg, 'danger');
    }
  };

  // ==============================
  // FILTRADO + ORDEN
  // ==============================
  const movimientosFiltrados = useMemo(() => {
    const lista = [...movimientos].sort((a, b) => (b.id_movimiento ?? 0) - (a.id_movimiento ?? 0));

    const s = search.trim().toLowerCase();
    const d = desde ? new Date(`${desde}T00:00:00`) : null;
    const h = hasta ? new Date(`${hasta}T23:59:59`) : null;

    return lista.filter((m) => {
      const itemLabel = getItemLabel(m);
      const almLabel = getAlmacenLabel(m.id_almacen);

      const texto = `${itemLabel} ${almLabel} ${m.tipo ?? ''} ${m.ref_origen ?? ''} ${m.descripcion ?? ''}`.toLowerCase();
      const matchTexto = s ? texto.includes(s) : true;

      const matchTipo = tipoFiltro === 'todos' ? true : String(m.tipo ?? '').toUpperCase() === tipoFiltro;

      const matchAlmacen =
        almacenFiltro === 'todos' ? true : String(m.id_almacen ?? '') === String(almacenFiltro);

      const isProd = !!m.id_producto;
      const matchItem =
        itemFiltro === 'todos'
          ? true
          : itemFiltro === 'producto'
          ? isProd
          : !isProd;

      // FECHAS
      const fechaStr = String(m.fecha_mov ?? '');
      const fechaOnly = toDateOnly(fechaStr);
      const fechaDate = fechaOnly ? new Date(`${fechaOnly}T12:00:00`) : null;

      const matchDesde = d && fechaDate ? fechaDate >= d : true;
      const matchHasta = h && fechaDate ? fechaDate <= h : true;

      return matchTexto && matchTipo && matchAlmacen && matchItem && matchDesde && matchHasta;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movimientos, search, tipoFiltro, almacenFiltro, itemFiltro, desde, hasta, almacenesMap, productosMap, insumosMap]);

  return (
    <div className="card shadow-sm mb-3">
      <div className="card-header fw-semibold d-flex align-items-center justify-content-between">
        <span>Movimientos (Kardex)</span>

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

        {/* ==============================
            FORM CREAR (DESKTOP/TABLET)
            ============================== */}
        <div className="d-none d-md-block">
          <form onSubmit={onCrear} className="row g-2 mb-3">
            <div className="col-12 col-md-2">
              <label className="form-label mb-1">Item</label>
              <select
                className="form-select"
                value={form.item_tipo}
                onChange={(e) =>
                  setForm((s) => ({
                    ...s,
                    item_tipo: e.target.value,
                    id_producto: '',
                    id_insumo: ''
                  }))
                }
              >
                <option value="producto">Producto</option>
                <option value="insumo">Insumo</option>
              </select>
            </div>

            <div className="col-12 col-md-3">
              <label className="form-label mb-1">{form.item_tipo === 'producto' ? 'Producto' : 'Insumo'}</label>

              {form.item_tipo === 'producto' ? (
                <>
                  <select
                    className={`form-select ${createErrors.id_producto ? 'is-invalid' : ''}`}
                    value={form.id_producto}
                    onChange={(e) => setForm((s) => ({ ...s, id_producto: e.target.value }))}
                    disabled={loadingRefs}
                  >
                    <option value="">{loadingRefs ? 'Cargando...' : 'Seleccione producto'}</option>
                    {productos.map((p) => (
                      <option key={p.id_producto} value={p.id_producto}>
                        {p.nombre_producto}
                      </option>
                    ))}
                  </select>
                  {createErrors.id_producto && <div className="invalid-feedback">{createErrors.id_producto}</div>}
                </>
              ) : (
                <>
                  <select
                    className={`form-select ${createErrors.id_insumo ? 'is-invalid' : ''}`}
                    value={form.id_insumo}
                    onChange={(e) => setForm((s) => ({ ...s, id_insumo: e.target.value }))}
                    disabled={loadingRefs}
                  >
                    <option value="">{loadingRefs ? 'Cargando...' : 'Seleccione insumo'}</option>
                    {insumos.map((i) => (
                      <option key={i.id_insumo} value={i.id_insumo}>
                        {i.nombre_insumo}
                      </option>
                    ))}
                  </select>
                  {createErrors.id_insumo && <div className="invalid-feedback">{createErrors.id_insumo}</div>}
                </>
              )}
            </div>

            <div className="col-12 col-md-2">
              <label className="form-label mb-1">Almacén</label>
              <select
                className={`form-select ${createErrors.id_almacen ? 'is-invalid' : ''}`}
                value={form.id_almacen}
                onChange={(e) => setForm((s) => ({ ...s, id_almacen: e.target.value }))}
                disabled={loadingRefs}
              >
                <option value="">{loadingRefs ? 'Cargando...' : 'Seleccione almacén'}</option>
                {almacenes.map((a) => (
                  <option key={a.id_almacen} value={a.id_almacen}>
                    {a.nombre} (Sucursal {a.id_sucursal})
                  </option>
                ))}
              </select>
              {createErrors.id_almacen && <div className="invalid-feedback">{createErrors.id_almacen}</div>}
            </div>

            <div className="col-6 col-md-2">
              <label className="form-label mb-1">Tipo</label>
              <select
                className={`form-select ${createErrors.tipo ? 'is-invalid' : ''}`}
                value={form.tipo}
                onChange={(e) => setForm((s) => ({ ...s, tipo: e.target.value }))}
              >
                <option value="ENTRADA">ENTRADA</option>
                <option value="SALIDA">SALIDA</option>
                <option value="AJUSTE">AJUSTE</option>
              </select>
              {createErrors.tipo && <div className="invalid-feedback">{createErrors.tipo}</div>}
            </div>

            <div className="col-6 col-md-1">
              <label className="form-label mb-1">Cantidad</label>
              <input
                className={`form-control ${createErrors.cantidad ? 'is-invalid' : ''}`}
                type="number"
                step="1"
                min="1"
                inputMode="numeric"
                value={form.cantidad}
                onKeyDown={blockNonIntegerKeys}
                onChange={(e) => setForm((s) => ({ ...s, cantidad: sanitizeInteger(e.target.value) }))}
                required
              />
              {createErrors.cantidad && <div className="invalid-feedback">{createErrors.cantidad}</div>}
            </div>

            <div className="col-12 col-md-2">
              <label className="form-label mb-1">Ref. origen (opcional)</label>
              <input
                className={`form-control ${createErrors.ref_origen ? 'is-invalid' : ''}`}
                placeholder="Ej: COMPRA / VENTA / AJUSTE"
                value={form.ref_origen}
                onChange={(e) => setForm((s) => ({ ...s, ref_origen: e.target.value }))}
              />
              {createErrors.ref_origen && <div className="invalid-feedback">{createErrors.ref_origen}</div>}
            </div>

            <div className="col-12 col-md-1">
              <label className="form-label mb-1">ID Ref (opcional)</label>
              <input
                className={`form-control ${createErrors.id_ref ? 'is-invalid' : ''}`}
                type="number"
                step="1"
                min="1"
                inputMode="numeric"
                value={form.id_ref}
                onKeyDown={blockNonIntegerKeys}
                onChange={(e) => setForm((s) => ({ ...s, id_ref: sanitizeInteger(e.target.value) }))}
              />
              {createErrors.id_ref && <div className="invalid-feedback">{createErrors.id_ref}</div>}
            </div>

            <div className="col-12 col-md-3">
              <label className="form-label mb-1">Descripción (opcional)</label>
              <input
                className={`form-control ${createErrors.descripcion ? 'is-invalid' : ''}`}
                placeholder="Ej: Ajuste por inventario físico"
                value={form.descripcion}
                onChange={(e) => setForm((s) => ({ ...s, descripcion: e.target.value }))}
              />
              {createErrors.descripcion && <div className="invalid-feedback">{createErrors.descripcion}</div>}
            </div>

            <div className="col-12 col-md-2 d-grid align-items-end">
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
          <div className="col-12 col-md-4">
            <input
              className="form-control"
              placeholder="Buscar por item, almacén, tipo, ref o descripción..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="col-6 col-md-2">
            <select className="form-select" value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="ENTRADA">ENTRADA</option>
              <option value="SALIDA">SALIDA</option>
              <option value="AJUSTE">AJUSTE</option>
            </select>
          </div>

          <div className="col-6 col-md-2">
            <select
              className="form-select"
              value={almacenFiltro}
              onChange={(e) => setAlmacenFiltro(e.target.value)}
              disabled={loadingRefs}
            >
              <option value="todos">Todos almacenes</option>
              {almacenes.map((a) => (
                <option key={a.id_almacen} value={a.id_almacen}>
                  {a.nombre} (Suc {a.id_sucursal})
                </option>
              ))}
            </select>
          </div>

          <div className="col-6 col-md-2">
            <select className="form-select" value={itemFiltro} onChange={(e) => setItemFiltro(e.target.value)}>
              <option value="todos">Todos items</option>
              <option value="producto">Productos</option>
              <option value="insumo">Insumos</option>
            </select>
          </div>

          <div className="col-6 col-md-2">
            <button
              className="btn btn-outline-secondary w-100"
              type="button"
              onClick={() => {
                setSearch('');
                setTipoFiltro('todos');
                setAlmacenFiltro('todos');
                setItemFiltro('todos');
                setDesde('');
                setHasta('');
              }}
            >
              Limpiar
            </button>
          </div>

          <div className="col-6 col-md-2">
            <label className="form-label mb-1">Desde</label>
            <input className="form-control" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>

          <div className="col-6 col-md-2">
            <label className="form-label mb-1">Hasta</label>
            <input className="form-control" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
        </div>

        {/* ==============================
            MOBILE: CARDS
            ============================== */}
        <div className="d-md-none">
          {loading ? (
            <div className="text-muted">Cargando...</div>
          ) : movimientosFiltrados.length === 0 ? (
            <div className="text-muted">Sin datos</div>
          ) : (
            <div className="d-flex flex-column gap-2">
              {movimientosFiltrados.map((m, index) => {
                const isEditing = editId === m.id_movimiento;

                return (
                  <div key={m.id_movimiento} className="card border">
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div>
                          <div className="text-muted small">No. {index + 1}</div>
                          <div className="fw-bold">{isEditing ? 'EDITANDO' : getItemLabel(m)}</div>
                          <div className="text-muted small">
                            {getItemTipo(m)} • {String(m.tipo || '').toUpperCase()} • {toDateOnly(m.fecha_mov)}
                          </div>
                        </div>
                      </div>

                      <div className="row g-2">
                        <div className="col-12">
                          <div className="small text-muted">Almacén</div>
                          {isEditing ? (
                            <>
                              <select
                                className={`form-select form-select-sm ${editErrors.id_almacen ? 'is-invalid' : ''}`}
                                value={editForm.id_almacen}
                                onChange={(e) => setEditForm((s) => ({ ...s, id_almacen: e.target.value }))}
                                disabled={loadingRefs}
                              >
                                <option value="">{loadingRefs ? 'Cargando...' : 'Seleccione almacén'}</option>
                                {almacenes.map((a) => (
                                  <option key={a.id_almacen} value={a.id_almacen}>
                                    {a.nombre} (Sucursal {a.id_sucursal})
                                  </option>
                                ))}
                              </select>
                              {editErrors.id_almacen && <div className="invalid-feedback">{editErrors.id_almacen}</div>}
                            </>
                          ) : (
                            <div>{getAlmacenLabel(m.id_almacen)}</div>
                          )}
                        </div>

                        <div className="col-6">
                          <div className="small text-muted">Tipo</div>
                          {isEditing ? (
                            <>
                              <select
                                className={`form-select form-select-sm ${editErrors.tipo ? 'is-invalid' : ''}`}
                                value={editForm.tipo}
                                onChange={(e) => setEditForm((s) => ({ ...s, tipo: e.target.value }))}
                              >
                                <option value="ENTRADA">ENTRADA</option>
                                <option value="SALIDA">SALIDA</option>
                                <option value="AJUSTE">AJUSTE</option>
                              </select>
                              {editErrors.tipo && <div className="invalid-feedback">{editErrors.tipo}</div>}
                            </>
                          ) : (
                            <div className="fw-semibold">{String(m.tipo || '').toUpperCase()}</div>
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
                                min="1"
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
                            <div className="fw-semibold">{m.cantidad}</div>
                          )}
                        </div>

                        <div className="col-12">
                          <div className="small text-muted">Ref/Descripción</div>
                          {isEditing ? (
                            <>
                              <input
                                className={`form-control form-control-sm ${editErrors.ref_origen ? 'is-invalid' : ''}`}
                                placeholder="Ref origen (opcional)"
                                value={editForm.ref_origen}
                                onChange={(e) => setEditForm((s) => ({ ...s, ref_origen: e.target.value }))}
                              />
                              {editErrors.ref_origen && <div className="invalid-feedback">{editErrors.ref_origen}</div>}

                              <input
                                className={`form-control form-control-sm mt-2 ${editErrors.descripcion ? 'is-invalid' : ''}`}
                                placeholder="Descripción (opcional)"
                                value={editForm.descripcion}
                                onChange={(e) => setEditForm((s) => ({ ...s, descripcion: e.target.value }))}
                              />
                              {editErrors.descripcion && <div className="invalid-feedback">{editErrors.descripcion}</div>}
                            </>
                          ) : (
                            <div className="text-muted">
                              {(m.ref_origen || '').trim() || '-'} • {(m.descripcion || '').trim() || '-'}
                            </div>
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
                          <button className="btn btn-outline-primary" type="button" onClick={() => iniciarEdicion(m)}>
                            Editar
                          </button>
                          <button
                            className="btn btn-outline-danger"
                            type="button"
                            onClick={() => openConfirmDelete(m.id_movimiento, getItemLabel(m))}
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
            DESKTOP: TABLE
            ============================== */}
        <div className="d-none d-md-block">
          <div className="table-responsive">
            <table className="table table-sm table-striped align-middle">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>No.</th>
                  <th>Item</th>
                  <th style={{ width: 110 }}>Tipo</th>
                  <th style={{ width: 110 }}>Cantidad</th>
                  <th style={{ width: 240 }}>Almacén</th>
                  <th style={{ width: 120 }}>Fecha</th>
                  <th style={{ width: 140 }}>Ref</th>
                  <th>Descripción</th>
                  <th style={{ width: 220 }}>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr><td colSpan="9">Cargando...</td></tr>
                ) : movimientosFiltrados.length === 0 ? (
                  <tr><td colSpan="9">Sin datos</td></tr>
                ) : (
                  movimientosFiltrados.map((m, index) => {
                    const isEditing = editId === m.id_movimiento;

                    return (
                      <tr key={m.id_movimiento}>
                        <td className="text-muted">{index + 1}</td>

                        <td>
                          <div className="fw-semibold">{getItemLabel(m)}</div>
                          <div className="text-muted small">{getItemTipo(m)}</div>
                        </td>

                        <td>
                          {isEditing ? (
                            <>
                              <select
                                className={`form-select form-select-sm ${editErrors.tipo ? 'is-invalid' : ''}`}
                                value={editForm.tipo}
                                onChange={(e) => setEditForm((s) => ({ ...s, tipo: e.target.value }))}
                              >
                                <option value="ENTRADA">ENTRADA</option>
                                <option value="SALIDA">SALIDA</option>
                                <option value="AJUSTE">AJUSTE</option>
                              </select>
                              {editErrors.tipo && <div className="invalid-feedback">{editErrors.tipo}</div>}
                            </>
                          ) : (
                            <span className="fw-semibold">{String(m.tipo || '').toUpperCase()}</span>
                          )}
                        </td>

                        <td>
                          {isEditing ? (
                            <>
                              <input
                                className={`form-control form-control-sm ${editErrors.cantidad ? 'is-invalid' : ''}`}
                                type="number"
                                step="1"
                                min="1"
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
                            <span className="fw-semibold">{m.cantidad}</span>
                          )}
                        </td>

                        <td>
                          {isEditing ? (
                            <>
                              <select
                                className={`form-select form-select-sm ${editErrors.id_almacen ? 'is-invalid' : ''}`}
                                value={editForm.id_almacen}
                                onChange={(e) => setEditForm((s) => ({ ...s, id_almacen: e.target.value }))}
                                disabled={loadingRefs}
                              >
                                <option value="">{loadingRefs ? 'Cargando...' : 'Seleccione almacén'}</option>
                                {almacenes.map((a) => (
                                  <option key={a.id_almacen} value={a.id_almacen}>
                                    {a.nombre} (Sucursal {a.id_sucursal})
                                  </option>
                                ))}
                              </select>
                              {editErrors.id_almacen && <div className="invalid-feedback">{editErrors.id_almacen}</div>}
                            </>
                          ) : (
                            getAlmacenLabel(m.id_almacen)
                          )}
                        </td>

                        <td>{toDateOnly(m.fecha_mov) || '-'}</td>

                        <td>
                          {isEditing ? (
                            <>
                              <input
                                className={`form-control form-control-sm ${editErrors.ref_origen ? 'is-invalid' : ''}`}
                                value={editForm.ref_origen}
                                onChange={(e) => setEditForm((s) => ({ ...s, ref_origen: e.target.value }))}
                              />
                              {editErrors.ref_origen && <div className="invalid-feedback">{editErrors.ref_origen}</div>}
                            </>
                          ) : (
                            (m.ref_origen || '-')
                          )}
                        </td>

                        <td>
                          {isEditing ? (
                            <>
                              <input
                                className={`form-control form-control-sm ${editErrors.descripcion ? 'is-invalid' : ''}`}
                                value={editForm.descripcion}
                                onChange={(e) => setEditForm((s) => ({ ...s, descripcion: e.target.value }))}
                              />
                              {editErrors.descripcion && <div className="invalid-feedback">{editErrors.descripcion}</div>}
                            </>
                          ) : (
                            (m.descripcion || '-')
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
                              <button className="btn btn-sm btn-outline-primary" type="button" onClick={() => iniciarEdicion(m)}>
                                Editar
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                type="button"
                                onClick={() => openConfirmDelete(m.id_movimiento, getItemLabel(m))}
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
                <div className="fw-semibold">Agregar movimiento</div>
                <button type="button" className="btn btn-sm btn-light" onClick={() => setShowCreateSheet(false)}>
                  ✕
                </button>
              </div>

              <div className="modal-body">
                <form onSubmit={onCrear} className="row g-2">
                  <div className="col-12">
                    <label className="form-label mb-1">Item</label>
                    <select
                      className="form-select"
                      value={form.item_tipo}
                      onChange={(e) =>
                        setForm((s) => ({
                          ...s,
                          item_tipo: e.target.value,
                          id_producto: '',
                          id_insumo: ''
                        }))
                      }
                    >
                      <option value="producto">Producto</option>
                      <option value="insumo">Insumo</option>
                    </select>
                  </div>

                  <div className="col-12">
                    <label className="form-label mb-1">{form.item_tipo === 'producto' ? 'Producto' : 'Insumo'}</label>

                    {form.item_tipo === 'producto' ? (
                      <>
                        <select
                          className={`form-select ${createErrors.id_producto ? 'is-invalid' : ''}`}
                          value={form.id_producto}
                          onChange={(e) => setForm((s) => ({ ...s, id_producto: e.target.value }))}
                          disabled={loadingRefs}
                        >
                          <option value="">{loadingRefs ? 'Cargando...' : 'Seleccione producto'}</option>
                          {productos.map((p) => (
                            <option key={p.id_producto} value={p.id_producto}>
                              {p.nombre_producto}
                            </option>
                          ))}
                        </select>
                        {createErrors.id_producto && <div className="invalid-feedback">{createErrors.id_producto}</div>}
                      </>
                    ) : (
                      <>
                        <select
                          className={`form-select ${createErrors.id_insumo ? 'is-invalid' : ''}`}
                          value={form.id_insumo}
                          onChange={(e) => setForm((s) => ({ ...s, id_insumo: e.target.value }))}
                          disabled={loadingRefs}
                        >
                          <option value="">{loadingRefs ? 'Cargando...' : 'Seleccione insumo'}</option>
                          {insumos.map((i) => (
                            <option key={i.id_insumo} value={i.id_insumo}>
                              {i.nombre_insumo}
                            </option>
                          ))}
                        </select>
                        {createErrors.id_insumo && <div className="invalid-feedback">{createErrors.id_insumo}</div>}
                      </>
                    )}
                  </div>

                  <div className="col-12">
                    <label className="form-label mb-1">Almacén</label>
                    <select
                      className={`form-select ${createErrors.id_almacen ? 'is-invalid' : ''}`}
                      value={form.id_almacen}
                      onChange={(e) => setForm((s) => ({ ...s, id_almacen: e.target.value }))}
                      disabled={loadingRefs}
                    >
                      <option value="">{loadingRefs ? 'Cargando...' : 'Seleccione almacén'}</option>
                      {almacenes.map((a) => (
                        <option key={a.id_almacen} value={a.id_almacen}>
                          {a.nombre} (Sucursal {a.id_sucursal})
                        </option>
                      ))}
                    </select>
                    {createErrors.id_almacen && <div className="invalid-feedback">{createErrors.id_almacen}</div>}
                  </div>

                  <div className="col-6">
                    <label className="form-label mb-1">Tipo</label>
                    <select
                      className={`form-select ${createErrors.tipo ? 'is-invalid' : ''}`}
                      value={form.tipo}
                      onChange={(e) => setForm((s) => ({ ...s, tipo: e.target.value }))}
                    >
                      <option value="ENTRADA">ENTRADA</option>
                      <option value="SALIDA">SALIDA</option>
                      <option value="AJUSTE">AJUSTE</option>
                    </select>
                    {createErrors.tipo && <div className="invalid-feedback">{createErrors.tipo}</div>}
                  </div>

                  <div className="col-6">
                    <label className="form-label mb-1">Cantidad</label>
                    <input
                      className={`form-control ${createErrors.cantidad ? 'is-invalid' : ''}`}
                      type="number"
                      step="1"
                      min="1"
                      inputMode="numeric"
                      value={form.cantidad}
                      onKeyDown={blockNonIntegerKeys}
                      onChange={(e) => setForm((s) => ({ ...s, cantidad: sanitizeInteger(e.target.value) }))}
                      required
                    />
                    {createErrors.cantidad && <div className="invalid-feedback">{createErrors.cantidad}</div>}
                  </div>

                  <div className="col-12">
                    <label className="form-label mb-1">Ref. origen (opcional)</label>
                    <input
                      className={`form-control ${createErrors.ref_origen ? 'is-invalid' : ''}`}
                      placeholder="Ej: COMPRA / VENTA / AJUSTE"
                      value={form.ref_origen}
                      onChange={(e) => setForm((s) => ({ ...s, ref_origen: e.target.value }))}
                    />
                    {createErrors.ref_origen && <div className="invalid-feedback">{createErrors.ref_origen}</div>}
                  </div>

                  <div className="col-12">
                    <label className="form-label mb-1">ID Ref (opcional)</label>
                    <input
                      className={`form-control ${createErrors.id_ref ? 'is-invalid' : ''}`}
                      type="number"
                      step="1"
                      min="1"
                      inputMode="numeric"
                      value={form.id_ref}
                      onKeyDown={blockNonIntegerKeys}
                      onChange={(e) => setForm((s) => ({ ...s, id_ref: sanitizeInteger(e.target.value) }))}
                    />
                    {createErrors.id_ref && <div className="invalid-feedback">{createErrors.id_ref}</div>}
                  </div>

                  <div className="col-12">
                    <label className="form-label mb-1">Descripción (opcional)</label>
                    <input
                      className={`form-control ${createErrors.descripcion ? 'is-invalid' : ''}`}
                      placeholder="Ej: Ajuste por inventario físico"
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
                    <div className="fw-semibold">¿DESEAS ELIMINAR ESTE MOVIMIENTO?</div>
                    <div className="text-muted">
                      <span className="fw-bold">{confirmModal.titulo || '(SIN DETALLE)'}</span>
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

export default MovimientosTab;
