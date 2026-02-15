import { useCallback, useEffect, useMemo, useState } from 'react';
import { inventarioService } from '../../../services/inventarioService';

const AlertasTab = ({ openToast }) => {
  // ==============================
  // TOAST (SI NO VIENE DEL PADRE)
  // ==============================
  const safeToast = (title, message, variant = 'success') => {
    if (typeof openToast === 'function') openToast(title, message, variant);
  };

  // ==============================
  // ESTADOS PRINCIPALES
  // ==============================
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [productos, setProductos] = useState([]);
  const [insumos, setInsumos] = useState([]);

  // ==============================
  // REFERENCIAS PARA LABELS (NO MOSTRAR IDS)
  // ==============================
  const [almacenes, setAlmacenes] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [tipoDepartamentos, setTipoDepartamentos] = useState([]);

  // ==============================
  // FILTROS
  // ==============================
  const [search, setSearch] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('alertas'); // todos | alertas | sin_stock | bajo | ok
  const [itemFiltro, setItemFiltro] = useState('todos'); // todos | producto | insumo
  const [almacenFiltro, setAlmacenFiltro] = useState('todos'); // todos | id_almacen

  // ==============================
  // EDITAR (SOLO STOCK MÍNIMO)
  // ==============================
  const [editKey, setEditKey] = useState(null); // FORMATO: "producto:1" | "insumo:2"
  const [editForm, setEditForm] = useState(null);
  const [editErrors, setEditErrors] = useState({});

  // ==============================
  // HELPERS
  // ==============================
  const blockNonIntegerKeys = (e) => {
    const blocked = ['.', ',', 'e', 'E', '+', '-'];
    if (blocked.includes(e.key)) e.preventDefault();
  };

  const sanitizeInteger = (value) => String(value ?? '').replace(/[^\d]/g, '');

  // ==============================
  // MAPAS ID -> OBJ (LABELS)
  // ==============================
  const almacenesMap = useMemo(() => {
    const m = new Map();
    for (const a of almacenes) m.set(String(a?.id_almacen), a);
    return m;
  }, [almacenes]);

  const categoriasMap = useMemo(() => {
    const m = new Map();
    for (const c of categorias) m.set(String(c?.id_categoria_producto), c);
    return m;
  }, [categorias]);

  const tipoDeptoMap = useMemo(() => {
    const m = new Map();
    for (const d of tipoDepartamentos) m.set(String(d?.id_tipo_departamento), d);
    return m;
  }, [tipoDepartamentos]);

  const getAlmacenLabel = useCallback((id) => {
    const a = almacenesMap.get(String(id));
    if (!a) return String(id || '-');
    return `${a.nombre} (Sucursal ${a.id_sucursal})`;
  }, [almacenesMap]);

  const getCategoriaLabel = useCallback((id) => {
    const c = categoriasMap.get(String(id));
    if (!c) return String(id || '-');
    return `${c.nombre_categoria}`;
  }, [categoriasMap]);

  const getDeptoLabel = useCallback((id) => {
    if (!id && id !== 0) return '-';
    const d = tipoDeptoMap.get(String(id));
    if (!d) return String(id || '-');
    return `${d.nombre_departamento}${d.estado === false ? ' (Inactivo)' : ''}`;
  }, [tipoDeptoMap]);

  // ==============================
  // COMENTARIO EN MAYÚSCULAS: NORMALIZAR ITEMS PARA UNIFICAR PRODUCTOS + INSUMOS EN 1 LISTA
  // ==============================
  const items = useMemo(() => {
    const list = [];

    for (const p of productos) {
      list.push({
        item_tipo: 'producto',
        id: p?.id_producto,
        nombre: p?.nombre_producto ?? '',
        descripcion: p?.descripcion_producto ?? '',
        id_almacen: p?.id_almacen,
        cantidad: p?.cantidad ?? 0,
        stock_minimo: p?.stock_minimo ?? 0,
        id_categoria_producto: p?.id_categoria_producto,
        id_tipo_departamento: p?.id_tipo_departamento,
        precio: p?.precio
      });
    }

    for (const i of insumos) {
      list.push({
        item_tipo: 'insumo',
        id: i?.id_insumo,
        nombre: i?.nombre_insumo ?? '',
        descripcion: i?.descripcion ?? '',
        id_almacen: i?.id_almacen,
        cantidad: i?.cantidad ?? 0,
        stock_minimo: i?.stock_minimo ?? 0
      });
    }

    return list;
  }, [productos, insumos]);

  const getEstadoStock = (it) => {
    const stock = Number.parseInt(String(it?.cantidad ?? '0'), 10);
    const minimo = Number.parseInt(String(it?.stock_minimo ?? '0'), 10);

    if (!Number.isNaN(stock) && stock <= 0) return 'SIN STOCK';
    if (!Number.isNaN(stock) && !Number.isNaN(minimo) && stock <= minimo) return 'STOCK BAJO';
    return 'OK';
  };

  const estadoBadge = (estado) => {
    if (estado === 'SIN STOCK') return 'bg-danger';
    if (estado === 'STOCK BAJO') return 'bg-warning text-dark';
    return 'bg-success';
  };

  // ==============================
  // CARGAR TODO (API)
  // ==============================
  const cargarTodo = async () => {
    setLoading(true);
    setError('');
    try {
      // COMENTARIO EN MAYÚSCULAS: CARGA PARA ALERTAS = PRODUCTOS + INSUMOS + REFERENCIAS
      const [p, i, a, c, d] = await Promise.all([
        inventarioService.getProductos(),
        inventarioService.getInsumos(),
        inventarioService.getAlmacenes(),
        inventarioService.getCategorias(),
        inventarioService.getTipoDepartamentos()
      ]);

      setProductos(Array.isArray(p) ? p : []);
      setInsumos(Array.isArray(i) ? i : []);
      setAlmacenes(Array.isArray(a) ? a : []);
      setCategorias(Array.isArray(c) ? c : []);
      setTipoDepartamentos(Array.isArray(d) ? d : []);
    } catch (e) {
      const msg = e?.message || 'ERROR CARGANDO ALERTAS';
      setError(msg);
      safeToast('ERROR', msg, 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==============================
  // VALIDACIÓN STOCK MÍNIMO
  // ==============================
  const validarStockMinimo = (raw) => {
    const errors = {};
    const v = String(raw ?? '').trim();

    if (v === '') errors.stock_minimo = 'EL STOCK MÍNIMO ES OBLIGATORIO';
    else if (!/^\d+$/.test(v)) errors.stock_minimo = 'SOLO ENTEROS (SIN DECIMALES)';
    else {
      const n = Number.parseInt(v, 10);
      if (Number.isNaN(n) || n < 0) errors.stock_minimo = 'DEBE SER UN ENTERO >= 0';
    }

    return {
      ok: Object.keys(errors).length === 0,
      errors,
      cleaned: {
        stock_minimo: Number.parseInt(v || '0', 10)
      }
    };
  };

  // ==============================
  // INICIAR / CANCELAR EDICIÓN
  // ==============================
  const iniciarEdicion = (it) => {
    setError('');
    setEditErrors({});
    setEditKey(`${it.item_tipo}:${it.id}`);

    setEditForm({
      stock_minimo: String(it?.stock_minimo ?? '0')
    });
  };

  const cancelarEdicion = () => {
    setEditKey(null);
    setEditForm(null);
    setEditErrors({});
  };

  // ==============================
  // GUARDAR EDICIÓN (STOCK MÍNIMO)
  // ==============================
  const guardarEdicion = async () => {
    if (!editKey || !editForm) return;

    setError('');

    const v = validarStockMinimo(editForm.stock_minimo);
    setEditErrors(v.errors);
    if (!v.ok) return;

    try {
      const [tipo, idStr] = String(editKey).split(':');
      const id = Number.parseInt(idStr, 10);

      const actual = items.find((x) => x.item_tipo === tipo && String(x.id) === String(id));
      const actualMin = Number.parseInt(String(actual?.stock_minimo ?? '0'), 10);

      if (!Number.isNaN(actualMin) && v.cleaned.stock_minimo === actualMin) {
        safeToast('SIN CAMBIOS', 'NO HAY CAMBIOS PARA GUARDAR.', 'info');
        cancelarEdicion();
        return;
      }

      // COMENTARIO EN MAYÚSCULAS: ACTUALIZAR CAMPO stock_minimo USANDO EL MISMO MOLDE (PUT CAMPO-POR-CAMPO)
      if (tipo === 'producto') {
        await inventarioService.actualizarProductoCampo(id, 'stock_minimo', v.cleaned.stock_minimo);
      } else {
        await inventarioService.actualizarInsumoCampo(id, 'stock_minimo', v.cleaned.stock_minimo);
      }

      cancelarEdicion();
      await cargarTodo();
      safeToast('ACTUALIZADO', 'EL STOCK MÍNIMO SE ACTUALIZÓ CORRECTAMENTE.', 'success');
    } catch (e) {
      const msg = e?.message || 'ERROR ACTUALIZANDO STOCK MÍNIMO';
      setError(msg);
      safeToast('ERROR', msg, 'danger');
    }
  };

  // ==============================
  // FILTRAR + ORDENAR
  // ==============================
  const itemsFiltrados = useMemo(() => {
    const lista = [...items].sort((a, b) => {
      const ta = a.item_tipo === 'producto' ? 0 : 1;
      const tb = b.item_tipo === 'producto' ? 0 : 1;
      if (ta !== tb) return ta - tb;
      return (a.id ?? 0) - (b.id ?? 0);
    });

    const s = search.trim().toLowerCase();

    return lista.filter((it) => {
      const estado = getEstadoStock(it);

      const matchEstado =
        estadoFiltro === 'todos'
          ? true
          : estadoFiltro === 'alertas'
          ? estado === 'SIN STOCK' || estado === 'STOCK BAJO'
          : estadoFiltro === 'sin_stock'
          ? estado === 'SIN STOCK'
          : estadoFiltro === 'bajo'
          ? estado === 'STOCK BAJO'
          : estado === 'OK';

      const matchItem =
        itemFiltro === 'todos' ? true : String(it.item_tipo) === String(itemFiltro);

      const matchAlmacen =
        almacenFiltro === 'todos' ? true : String(it.id_almacen) === String(almacenFiltro);

      const texto = `${it.nombre ?? ''} ${it.descripcion ?? ''} ${it.item_tipo ?? ''} ${getAlmacenLabel(it.id_almacen)} ${
        it.item_tipo === 'producto'
          ? `${getCategoriaLabel(it.id_categoria_producto)} ${getDeptoLabel(it.id_tipo_departamento)}`
          : ''
      }`.toLowerCase();

      const matchTexto = s ? texto.includes(s) : true;

      return matchEstado && matchItem && matchAlmacen && matchTexto;
    });
  }, [items, search, estadoFiltro, itemFiltro, almacenFiltro, getAlmacenLabel, getCategoriaLabel, getDeptoLabel]);

  const resumen = useMemo(() => {
    let sinStock = 0;
    let bajo = 0;
    let ok = 0;

    for (const it of items) {
      const e = getEstadoStock(it);
      if (e === 'SIN STOCK') sinStock++;
      else if (e === 'STOCK BAJO') bajo++;
      else ok++;
    }

    return { sinStock, bajo, ok, total: items.length };
  }, [items]);

  return (
    <div className="card shadow-sm mb-3">
      <div className="card-header fw-semibold d-flex align-items-center justify-content-between">
        <span>Alertas de stock</span>

        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={cargarTodo}
          disabled={loading}
        >
          {loading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      <div className="card-body">
        {error && <div className="alert alert-danger">{error}</div>}

        {/* RESUMEN */}
        <div className="row g-2 mb-3">
          <div className="col-12 col-md-4">
            <div className="border rounded p-2">
              <div className="text-muted small">Sin stock</div>
              <div className="fw-bold text-danger">{resumen.sinStock}</div>
            </div>
          </div>
          <div className="col-12 col-md-4">
            <div className="border rounded p-2">
              <div className="text-muted small">Stock bajo</div>
              <div className="fw-bold text-warning">{resumen.bajo}</div>
            </div>
          </div>
          <div className="col-12 col-md-4">
            <div className="border rounded p-2">
              <div className="text-muted small">OK</div>
              <div className="fw-bold text-success">{resumen.ok}</div>
            </div>
          </div>
        </div>

        {/* FILTROS */}
        <div className="row g-2 mb-3">
          <div className="col-12 col-md-5">
            <input
              className="form-control"
              placeholder="Buscar por nombre, descripción, almacén, categoría o depto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="col-6 col-md-2">
            <select
              className="form-select"
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value)}
              disabled={loading}
            >
              <option value="alertas">Solo alertas</option>
              <option value="todos">Todos</option>
              <option value="sin_stock">Sin stock</option>
              <option value="bajo">Stock bajo</option>
              <option value="ok">OK</option>
            </select>
          </div>

          <div className="col-6 col-md-2">
            <select
              className="form-select"
              value={itemFiltro}
              onChange={(e) => setItemFiltro(e.target.value)}
              disabled={loading}
            >
              <option value="todos">Todos items</option>
              <option value="producto">Productos</option>
              <option value="insumo">Insumos</option>
            </select>
          </div>

          <div className="col-12 col-md-3">
            <select
              className="form-select"
              value={almacenFiltro}
              onChange={(e) => setAlmacenFiltro(e.target.value)}
              disabled={loading}
            >
              <option value="todos">Todos almacenes</option>
              {almacenes.map((a) => (
                <option key={a.id_almacen} value={a.id_almacen}>
                  {a.nombre} (Sucursal {a.id_sucursal})
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
                setEstadoFiltro('alertas');
                setItemFiltro('todos');
                setAlmacenFiltro('todos');
              }}
              disabled={loading}
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        {/* MOBILE CARDS */}
        <div className="d-md-none">
          {loading ? (
            <div className="text-muted">Cargando...</div>
          ) : itemsFiltrados.length === 0 ? (
            <div className="text-muted">Sin datos</div>
          ) : (
            <div className="d-flex flex-column gap-2">
              {itemsFiltrados.map((it, index) => {
                const key = `${it.item_tipo}:${it.id}`;
                const isEditing = editKey === key;
                const estado = getEstadoStock(it);

                return (
                  <div key={key} className="card border">
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div>
                          <div className="text-muted small">No. {index + 1}</div>
                          <div className="fw-bold">{it.nombre}</div>
                          <div className="text-muted small">
                            Tipo: <span className="fw-semibold">{it.item_tipo === 'producto' ? 'Producto' : 'Insumo'}</span>
                            {' '}• Almacén: <span className="fw-semibold">{getAlmacenLabel(it.id_almacen)}</span>
                          </div>

                          {it.item_tipo === 'producto' && (
                            <div className="text-muted small">
                              Categoría: <span className="fw-semibold">{getCategoriaLabel(it.id_categoria_producto)}</span>
                              {' '}• Depto: <span className="fw-semibold">{getDeptoLabel(it.id_tipo_departamento)}</span>
                            </div>
                          )}
                        </div>

                        <span className={`badge ${estadoBadge(estado)}`}>{estado}</span>
                      </div>

                      <div className="row g-2">
                        <div className="col-6">
                          <div className="small text-muted">Stock</div>
                          <div className="fw-semibold">{it.cantidad}</div>
                        </div>

                        <div className="col-6">
                          <div className="small text-muted">Stock mínimo</div>
                          {isEditing ? (
                            <>
                              <input
                                className={`form-control form-control-sm ${editErrors.stock_minimo ? 'is-invalid' : ''}`}
                                type="number"
                                step="1"
                                min="0"
                                inputMode="numeric"
                                value={editForm.stock_minimo}
                                onKeyDown={blockNonIntegerKeys}
                                onChange={(e) =>
                                  setEditForm((s) => ({ ...s, stock_minimo: sanitizeInteger(e.target.value) }))
                                }
                              />
                              {editErrors.stock_minimo && (
                                <div className="invalid-feedback">{editErrors.stock_minimo}</div>
                              )}
                            </>
                          ) : (
                            <div className="fw-semibold">{it.stock_minimo ?? 0}</div>
                          )}
                        </div>
                      </div>

                      <div className="mt-2">
                        <div className="small text-muted">Descripción</div>
                        <div>{it.descripcion || '-'}</div>
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
                          <button className="btn btn-outline-primary" type="button" onClick={() => iniciarEdicion(it)}>
                            Editar stock mínimo
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
                  <th style={{ width: 110 }}>Item</th>
                  <th>Nombre</th>
                  <th style={{ width: 160 }}>Categoría</th>
                  <th style={{ width: 200 }}>Almacén</th>
                  <th style={{ width: 140 }}>Departamento</th>
                  <th style={{ width: 90 }}>Stock</th>
                  <th style={{ width: 120 }}>Stock mín.</th>
                  <th style={{ width: 110 }}>Estado</th>
                  <th style={{ width: 180 }}>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr><td colSpan="10">Cargando...</td></tr>
                ) : itemsFiltrados.length === 0 ? (
                  <tr><td colSpan="10">Sin datos</td></tr>
                ) : (
                  itemsFiltrados.map((it, index) => {
                    const key = `${it.item_tipo}:${it.id}`;
                    const isEditing = editKey === key;
                    const estado = getEstadoStock(it);

                    return (
                      <tr key={key}>
                        <td className="text-muted">{index + 1}</td>

                        <td>{it.item_tipo === 'producto' ? 'Producto' : 'Insumo'}</td>

                        <td>
                          <div className="fw-semibold">{it.nombre}</div>
                          <div className="text-muted small">{it.descripcion || '-'}</div>
                        </td>

                        <td>{it.item_tipo === 'producto' ? getCategoriaLabel(it.id_categoria_producto) : '-'}</td>

                        <td>{getAlmacenLabel(it.id_almacen)}</td>

                        <td>{it.item_tipo === 'producto' ? getDeptoLabel(it.id_tipo_departamento) : '-'}</td>

                        <td className="fw-semibold">{it.cantidad}</td>

                        <td>
                          {isEditing ? (
                            <>
                              <input
                                className={`form-control form-control-sm ${editErrors.stock_minimo ? 'is-invalid' : ''}`}
                                type="number"
                                step="1"
                                min="0"
                                inputMode="numeric"
                                value={editForm.stock_minimo}
                                onKeyDown={blockNonIntegerKeys}
                                onChange={(e) =>
                                  setEditForm((s) => ({ ...s, stock_minimo: sanitizeInteger(e.target.value) }))
                                }
                              />
                              {editErrors.stock_minimo && (
                                <div className="invalid-feedback">{editErrors.stock_minimo}</div>
                              )}
                            </>
                          ) : (
                            <span className="fw-semibold">{it.stock_minimo ?? 0}</span>
                          )}
                        </td>

                        <td>
                          <span className={`badge ${estadoBadge(estado)}`}>{estado}</span>
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
                            <button className="btn btn-sm btn-outline-primary" type="button" onClick={() => iniciarEdicion(it)}>
                              Editar stock mín.
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="text-muted small mt-2">
            NOTA: “SIN STOCK” = 0. “STOCK BAJO” = STOCK ≤ STOCK MÍNIMO.
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlertasTab;
