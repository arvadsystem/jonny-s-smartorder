import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { inventarioService } from '../../services/inventarioService';
import ProductosTab from './inventario/ProductosTab.jsx';
import AlmacenesTab from './inventario/AlmacenesTab.jsx';
import MovimientosTab from './inventario/MovimientosTab.jsx';
import AlertasTab from './inventario/AlertasTab.jsx';



const Inventario = () => {
  // ==============================
  // TAB ACTIVO (DESDE ?tab=)
  // ==============================
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('categorias'); // categorias | insumos | productos | almacenes | movimientos | alertas

  // SINCRONIZAR TAB CON URL
  useEffect(() => {
    const t = (searchParams.get('tab') || 'categorias').toLowerCase();
    // COMENTARIO EN MAYÚSCULAS: AHORA ACEPTA categorias | insumos | productos | almacenes | movimientos | alertas DESDE ?tab=
    setActiveTab(
      t === 'insumos'
        ? 'insumos'
        : t === 'productos'
        ? 'productos'
        : t === 'almacenes'
        ? 'almacenes'
        : t === 'movimientos'
        ? 'movimientos'
        : t === 'alertas'
        ? 'alertas'
        : 'categorias'
    );
  }, [searchParams]);

  // ==============================
  // MODALES CREAR (RESPONSIVE)
  // ==============================
  const [showCreateCategoriaSheet, setShowCreateCategoriaSheet] = useState(false);
  const [showCreateInsumoSheet, setShowCreateInsumoSheet] = useState(false);

  // ==============================
  // ESTADOS PRINCIPALES (CATEGORÍAS)
  // ==============================
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ==============================
  // FILTROS (CATEGORÍAS: BUSCAR + ESTADO)
  // ==============================
  const [search, setSearch] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('todos'); // todos | activo | inactivo

  // ==============================
  // FORM CREAR (CATEGORÍAS)
  // ==============================
  const [form, setForm] = useState({
    nombre_categoria: '',
    codigo_categoria: '',
    descripcion: '',
    estado: true
  });

  // ERRORES DEL FORM DE CREAR (POR CAMPO)
  const [createErrors, setCreateErrors] = useState({});

  // ==============================
  // EDITAR (CATEGORÍAS)
  // ==============================
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(null);

  // ERRORES DEL FORM DE EDITAR (POR CAMPO)
  const [editErrors, setEditErrors] = useState({});

  // ==============================
  // INSUMOS (SUBMÓDULO)
  // ==============================
  const [insumos, setInsumos] = useState([]);
  const [loadingInsumos, setLoadingInsumos] = useState(false);
  const [insumosLoaded, setInsumosLoaded] = useState(false);

  // ==============================
  // ALMACENES (PARA MOSTRAR NOMBRES EN LUGAR DE IDS)
  // ==============================
  const [almacenes, setAlmacenes] = useState([]);
  const [loadingAlmacenes, setLoadingAlmacenes] = useState(false);
  const [almacenesLoaded, setAlmacenesLoaded] = useState(false);

  // FILTROS INSUMOS
  const [insumoSearch, setInsumoSearch] = useState('');
  const [insumoEstadoFiltro, setInsumoEstadoFiltro] = useState('todos'); // todos | con_stock | sin_stock

  // FORM CREAR INSUMO
  const [insumoForm, setInsumoForm] = useState({
    nombre_insumo: '',
    precio: '',
    cantidad: '',
    fecha_ingreso_insumo: '',
    id_almacen: '',
    fecha_caducidad: '',
    descripcion: ''
  });

  // ERRORES CREAR INSUMO
  const [insumoCreateErrors, setInsumoCreateErrors] = useState({});

  // EDITAR INSUMO
  const [insumoEditId, setInsumoEditId] = useState(null);
  const [insumoEditForm, setInsumoEditForm] = useState(null);
  const [insumoEditErrors, setInsumoEditErrors] = useState({});

  // ==============================
  // TOAST PROFESIONAL (MENSAJES)
  // ==============================
  const [toast, setToast] = useState({
    show: false,
    title: '',
    message: '',
    variant: 'success' // success | danger | warning | info
  });

  // AUTO-CIERRE DEL TOAST
  useEffect(() => {
    if (!toast.show) return;
    const t = setTimeout(() => setToast((s) => ({ ...s, show: false })), 3000);
    return () => clearTimeout(t);
  }, [toast.show]);

  const openToast = (title, message, variant = 'success') => {
    setToast({ show: true, title, message, variant });
  };

  const closeToast = () => {
    setToast((s) => ({ ...s, show: false }));
  };

  const toastIcon = (variant) => {
    if (variant === 'danger') return '❌';
    if (variant === 'warning') return '⚠️';
    if (variant === 'info') return 'ℹ️';
    return '✅';
  };

  const toastBorderClass = (variant) => {
    if (variant === 'danger') return 'border-danger';
    if (variant === 'warning') return 'border-warning';
    if (variant === 'info') return 'border-info';
    return 'border-success';
  };

  // ==============================
  // MODAL DE CONFIRMACIÓN (ELIMINAR CATEGORÍA)
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
  // MODAL DE CONFIRMACIÓN (ELIMINAR INSUMO)
  // ==============================
  const [confirmModalInsumo, setConfirmModalInsumo] = useState({
    show: false,
    idToDelete: null,
    nombre: ''
  });

  const openConfirmDeleteInsumo = (id, nombre) => {
    setConfirmModalInsumo({ show: true, idToDelete: id, nombre: nombre || '' });
  };

  const closeConfirmDeleteInsumo = () => {
    setConfirmModalInsumo({ show: false, idToDelete: null, nombre: '' });
  };

  // ==============================
  // VALIDACIÓN MÍNIMA DE CATEGORÍA
  // ==============================
  const validarCategoria = (data) => {
    const nombre = (data.nombre_categoria || '').trim();
    const codigo = (data.codigo_categoria || '').trim().toUpperCase();
    const descripcion = (data.descripcion || '').trim();
    const estado = !!data.estado;

    const errors = {};

    if (nombre.length < 2) errors.nombre_categoria = 'MÍNIMO 2 CARACTERES';
    if (nombre.length > 50) errors.nombre_categoria = 'MÁXIMO 50 CARACTERES';

    if (codigo.length < 2) errors.codigo_categoria = 'MÍNIMO 2 CARACTERES';
    if (codigo.length > 10) errors.codigo_categoria = 'MÁXIMO 10 CARACTERES';
    if (!/^[A-Z0-9_]+$/.test(codigo)) {
      errors.codigo_categoria = 'SOLO MAYÚSCULAS, NÚMEROS O _ (SIN ESPACIOS)';
    }

    if (descripcion.length > 150) errors.descripcion = 'MÁXIMO 150 CARACTERES';

    return {
      ok: Object.keys(errors).length === 0,
      errors,
      cleaned: {
        nombre_categoria: nombre,
        codigo_categoria: codigo,
        descripcion: descripcion,
        estado: estado
      }
    };
  };

  // ==============================
  // CARGAR CATEGORÍAS
  // ==============================
  const cargarCategorias = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await inventarioService.getCategorias();
      setCategorias(Array.isArray(data) ? data : []);
    } catch (e) {
      const msg = e?.message || 'ERROR CARGANDO CATEGORÍAS';
      setError(msg);
      openToast('ERROR', msg, 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarCategorias();
  }, []);

  // ==============================
  // RESET FORM CREAR (CATEGORÍAS)
  // ==============================
  const resetForm = () => {
    setForm({
      nombre_categoria: '',
      codigo_categoria: '',
      descripcion: '',
      estado: true
    });
    setCreateErrors({});
  };

  // ==============================
  // CREAR CATEGORÍA
  // ==============================
  const onCrear = async (e) => {
    e.preventDefault();
    setError('');

    const v = validarCategoria(form);
    setCreateErrors(v.errors);
    if (!v.ok) return;

    try {
      await inventarioService.crearCategoria(v.cleaned);
      resetForm();
      setShowCreateCategoriaSheet(false);
      await cargarCategorias();
      openToast('CREADO', 'LA CATEGORÍA SE CREÓ CORRECTAMENTE.', 'success');
    } catch (e2) {
      const msg = e2?.message || 'ERROR CREANDO CATEGORÍA';
      setError(msg);
      openToast('ERROR', msg, 'danger');
    }
  };

  // ==============================
  // INICIAR EDICIÓN (CATEGORÍAS)
  // ==============================
  const iniciarEdicion = (cat) => {
    setError('');
    setEditErrors({});
    setEditId(cat.id_categoria_producto);
    setEditForm({
      nombre_categoria: cat.nombre_categoria ?? '',
      codigo_categoria: (cat.codigo_categoria ?? '').toUpperCase(),
      descripcion: cat.descripcion ?? '',
      estado: !!cat.estado
    });
  };

  // ==============================
  // CANCELAR EDICIÓN (CATEGORÍAS)
  // ==============================
  const cancelarEdicion = () => {
    setEditId(null);
    setEditForm(null);
    setEditErrors({});
  };

  // ==============================
  // GUARDAR EDICIÓN (CATEGORÍAS: CAMPO POR CAMPO)
  // ==============================
  const guardarEdicion = async () => {
    if (!editId || !editForm) return;
    setError('');

    const v = validarCategoria(editForm);
    setEditErrors(v.errors);
    if (!v.ok) return;

    try {
      const updates = [
        ['nombre_categoria', v.cleaned.nombre_categoria],
        ['codigo_categoria', v.cleaned.codigo_categoria],
        ['descripcion', v.cleaned.descripcion],
        ['estado', v.cleaned.estado]
      ];

      for (const [campo, valor] of updates) {
        await inventarioService.actualizarCategoriaCampo(editId, campo, valor);
      }

      cancelarEdicion();
      await cargarCategorias();
      openToast('ACTUALIZADO', 'LA CATEGORÍA SE ACTUALIZÓ CORRECTAMENTE.', 'success');
    } catch (e) {
      const msg = e?.message || 'ERROR ACTUALIZANDO CATEGORÍA';
      setError(msg);
      openToast('ERROR', msg, 'danger');
    }
  };

  // ==============================
  // ELIMINAR CATEGORÍA (CONFIRMADO)
  // ==============================
  const eliminarConfirmado = async () => {
    const id = confirmModal.idToDelete;
    if (!id) return;

    setError('');
    try {
      await inventarioService.eliminarCategoria(id);
      closeConfirmDelete();
      await cargarCategorias();
      openToast('ELIMINADO', 'LA CATEGORÍA SE ELIMINÓ CORRECTAMENTE.', 'success');
    } catch (e) {
      closeConfirmDelete();
      const msg = e?.message || 'ERROR ELIMINANDO CATEGORÍA';
      setError(msg);
      openToast('ERROR', msg, 'danger');
    }
  };

  // ==============================
  // ORDENAR + FILTRAR (CATEGORÍAS)
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
  // ==============================
  // INSUMOS: VALIDACIÓN + CRUD
  // ==============================
  // ==============================

  // FORMATEAR FECHA PARA INPUT TYPE="DATE"
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

  // VALIDACIÓN MÍNIMA INSUMO
  const validarInsumo = (data) => {
    const errors = {};

    const nombre = String(data?.nombre_insumo ?? '').trim();
    const descripcion = String(data?.descripcion ?? '').trim();

    const precioRaw = String(data?.precio ?? '').trim();
    const cantidadRaw = String(data?.cantidad ?? '').trim();
    const almacenRaw = String(data?.id_almacen ?? '').trim();

    const precio = Number.parseFloat(precioRaw);

    // ===== ANTES (PERMITÍA DECIMALES) =====
    // const cantidad = Number.parseFloat(cantidadRaw);

    // ===== AHORA (SOLO ENTEROS) =====
    const cantidad = Number.parseInt(cantidadRaw, 10);

    const id_almacen = Number.parseInt(almacenRaw, 10);

    const fechaIngreso = String(data?.fecha_ingreso_insumo ?? '').trim();
    const fechaCaducidad = String(data?.fecha_caducidad ?? '').trim();

    // NOMBRE OBLIGATORIO
    if (nombre.length < 2) errors.nombre_insumo = 'MÍNIMO 2 CARACTERES';
    if (nombre.length > 80) errors.nombre_insumo = 'MÁXIMO 80 CARACTERES';

    // PRECIO OBLIGATORIO
    if (!precioRaw) errors.precio = 'EL PRECIO ES OBLIGATORIO';
    else if (Number.isNaN(precio) || precio < 0) errors.precio = 'DEBE SER UN NÚMERO >= 0';

    // ===== AHORA (CANTIDAD ENTERA) =====
    if (!cantidadRaw) errors.cantidad = 'LA CANTIDAD ES OBLIGATORIA';
    else if (!/^\d+$/.test(cantidadRaw)) errors.cantidad = 'SOLO NÚMEROS ENTEROS (SIN DECIMALES)';
    else if (Number.isNaN(cantidad) || cantidad < 0) errors.cantidad = 'DEBE SER UN ENTERO >= 0';

    // ALMACÉN (FK)
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
        cantidad, // <-- ENTERO
        id_almacen,
        fecha_ingreso_insumo: fechaIngreso,
        fecha_caducidad: fechaCaducidad,
        descripcion
      }
    };
  };

  // CONSTRUIR PAYLOAD SIN NULLS (OMITIR OPCIONALES VACÍOS)
  const buildInsumoPayload = (cleaned) => {
    const payload = {
      nombre_insumo: cleaned.nombre_insumo,
      precio: cleaned.precio,
      cantidad: cleaned.cantidad, // <-- ENTERO
      id_almacen: cleaned.id_almacen
    };

    if (cleaned.descripcion) payload.descripcion = cleaned.descripcion;
    if (cleaned.fecha_ingreso_insumo) payload.fecha_ingreso_insumo = cleaned.fecha_ingreso_insumo;
    if (cleaned.fecha_caducidad) payload.fecha_caducidad = cleaned.fecha_caducidad;

    return payload;
  };

  // ==============================
  // CARGAR ALMACENES (DROPDOWN)
  // ==============================
  const cargarAlmacenes = async () => {
    setLoadingAlmacenes(true);
    try {
      const data = await inventarioService.getAlmacenes();
      setAlmacenes(Array.isArray(data) ? data : []);
      setAlmacenesLoaded(true);
    } catch (e) {
      const msg = e?.message || 'ERROR CARGANDO ALMACENES';
      setError(msg);
      openToast('ERROR', msg, 'danger');
    } finally {
      setLoadingAlmacenes(false);
    }
  };

  // CARGAR INSUMOS
  const cargarInsumos = async () => {
    setLoadingInsumos(true);
    setError('');

    try {
      const data = await inventarioService.getInsumos();
      setInsumos(Array.isArray(data) ? data : []);
      setInsumosLoaded(true);
    } catch (e) {
      const msg = e?.message || 'ERROR CARGANDO INSUMOS';
      setError(msg);
      openToast('ERROR', msg, 'danger');
    } finally {
      setLoadingInsumos(false);
    }
  };

  // LAZY LOAD: SOLO CUANDO SE ABRE EL TAB INSUMOS
  useEffect(() => {
    setError('');

    if (activeTab === 'insumos' && !insumosLoaded) {
      cargarInsumos();
    }
    if (activeTab === 'insumos' && !almacenesLoaded) {
      cargarAlmacenes();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ==============================
  // MAPA ID_ALMACEN -> OBJ (PARA MOSTRAR NOMBRES EN UI)
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

  // RESET FORM CREAR INSUMO
  const resetInsumoForm = () => {
    setInsumoForm({
      nombre_insumo: '',
      precio: '',
      cantidad: '',
      fecha_ingreso_insumo: '',
      id_almacen: '',
      fecha_caducidad: '',
      descripcion: ''
    });
    setInsumoCreateErrors({});
  };

  // CREAR INSUMO
  const onCrearInsumo = async (e) => {
    e.preventDefault();
    setError('');

    const v = validarInsumo(insumoForm);
    setInsumoCreateErrors(v.errors);
    if (!v.ok) return;

    try {
      const payload = buildInsumoPayload(v.cleaned);
      await inventarioService.crearInsumo(payload);

      resetInsumoForm();
      setShowCreateInsumoSheet(false);
      await cargarInsumos();

      openToast('CREADO', 'EL INSUMO SE CREÓ CORRECTAMENTE.', 'success');
    } catch (e2) {
      const msg = e2?.message || 'ERROR CREANDO INSUMO';
      setError(msg);
      openToast('ERROR', msg, 'danger');
    }
  };

  // INICIAR EDICIÓN INSUMO
  const iniciarEdicionInsumo = (i) => {
    setError('');
    setInsumoEditErrors({});
    setInsumoEditId(i.id_insumo);

    setInsumoEditForm({
      nombre_insumo: i.nombre_insumo ?? '',
      precio: i.precio ?? '',
      cantidad: i.cantidad ?? '',
      fecha_ingreso_insumo: toDateInputValue(i.fecha_ingreso_insumo),
      id_almacen: String(i.id_almacen ?? ''),
      fecha_caducidad: toDateInputValue(i.fecha_caducidad),
      descripcion: i.descripcion ?? ''
    });
  };

  // CANCELAR EDICIÓN INSUMO
  const cancelarEdicionInsumo = () => {
    setInsumoEditId(null);
    setInsumoEditForm(null);
    setInsumoEditErrors({});
  };

  // GUARDAR EDICIÓN INSUMO (SOLO CAMPOS QUE CAMBIARON)
  const guardarEdicionInsumo = async () => {
    if (!insumoEditId || !insumoEditForm) return;

    setError('');

    const v = validarInsumo(insumoEditForm);
    setInsumoEditErrors(v.errors);
    if (!v.ok) return;

    try {
      const actual = insumos.find((x) => x.id_insumo === insumoEditId);
      const cambios = [];

      const nombreActual = String(actual?.nombre_insumo ?? '').trim();
      const descActual = String(actual?.descripcion ?? '').trim();

      const precioActual = Number.parseFloat(String(actual?.precio ?? ''));

      // ===== AHORA (ENTEROS) =====
      const cantidadActual = Number.parseInt(String(actual?.cantidad ?? ''), 10);

      const almacenActual = Number.parseInt(String(actual?.id_almacen ?? ''), 10);

      const ingresoActual = toDateInputValue(actual?.fecha_ingreso_insumo);
      const caducidadActual = toDateInputValue(actual?.fecha_caducidad);

      if (v.cleaned.nombre_insumo !== nombreActual) cambios.push(['nombre_insumo', v.cleaned.nombre_insumo]);
      if (!Number.isNaN(v.cleaned.precio) && v.cleaned.precio !== precioActual) cambios.push(['precio', v.cleaned.precio]);
      if (!Number.isNaN(v.cleaned.cantidad) && v.cleaned.cantidad !== cantidadActual) cambios.push(['cantidad', v.cleaned.cantidad]);
      if (!Number.isNaN(v.cleaned.id_almacen) && v.cleaned.id_almacen !== almacenActual) cambios.push(['id_almacen', v.cleaned.id_almacen]);

      if (v.cleaned.descripcion !== descActual) cambios.push(['descripcion', v.cleaned.descripcion]);

      if (v.cleaned.fecha_ingreso_insumo && v.cleaned.fecha_ingreso_insumo !== ingresoActual) {
        cambios.push(['fecha_ingreso_insumo', v.cleaned.fecha_ingreso_insumo]);
      }
      if (v.cleaned.fecha_caducidad && v.cleaned.fecha_caducidad !== caducidadActual) {
        cambios.push(['fecha_caducidad', v.cleaned.fecha_caducidad]);
      }

      if (cambios.length === 0) {
        openToast('SIN CAMBIOS', 'NO HAY CAMBIOS PARA GUARDAR.', 'info');
        cancelarEdicionInsumo();
        return;
      }

      for (const [campo, valor] of cambios) {
        await inventarioService.actualizarInsumoCampo(insumoEditId, campo, valor);
      }

      cancelarEdicionInsumo();
      await cargarInsumos();

      openToast('ACTUALIZADO', 'EL INSUMO SE ACTUALIZÓ CORRECTAMENTE.', 'success');
    } catch (e2) {
      const msg = e2?.message || 'ERROR ACTUALIZANDO INSUMO';
      setError(msg);
      openToast('ERROR', msg, 'danger');
    }
  };

  // ELIMINAR INSUMO (CONFIRMADO)
  const eliminarConfirmadoInsumo = async () => {
    const id = confirmModalInsumo.idToDelete;
    if (!id) return;

    setError('');
    try {
      await inventarioService.eliminarInsumo(id);
      closeConfirmDeleteInsumo();
      await cargarInsumos();

      openToast('ELIMINADO', 'EL INSUMO SE ELIMINÓ CORRECTAMENTE.', 'success');
    } catch (e) {
      closeConfirmDeleteInsumo();
      const msg = e?.message || 'ERROR ELIMINANDO INSUMO';
      setError(msg);
      openToast('ERROR', msg, 'danger');
    }
  };

  // FILTRAR INSUMOS
  const insumosFiltrados = useMemo(() => {
    const lista = [...insumos].sort((a, b) => (a.id_insumo ?? 0) - (b.id_insumo ?? 0));
    const s = insumoSearch.trim().toLowerCase();

    return lista.filter((i) => {
      const texto = `${i.nombre_insumo ?? ''} ${i.descripcion ?? ''} ${getAlmacenLabel(i.id_almacen)}`.toLowerCase();
      const matchTexto = s ? texto.includes(s) : true;

      // ===== AHORA (ENTEROS) =====
      const cant = Number.parseInt(String(i.cantidad ?? '0'), 10);

      const conStock = !Number.isNaN(cant) && cant > 0;

      const matchEstado =
        insumoEstadoFiltro === 'todos'
          ? true
          : insumoEstadoFiltro === 'con_stock'
          ? conStock
          : !conStock;

      return matchTexto && matchEstado;
    });
  }, [insumos, insumoSearch, insumoEstadoFiltro, almacenesMap]);

  return (
    <div className="container-fluid p-3">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h3 className="m-0">Inventario</h3>
          <div className="text-muted small">
            {/* COMENTARIO EN MAYÚSCULAS: SUBTÍTULO DINÁMICO POR TAB (SIN ROMPER EL MOLDE EXISTENTE) */}
            {activeTab === 'categorias' && (
              <>
                Categorías: <span className="fw-semibold">{categoriasFiltradas.length}</span>
              </>
            )}

            {activeTab === 'insumos' && (
              <>
                Insumos: <span className="fw-semibold">{insumosFiltrados.length}</span>
              </>
            )}

            {activeTab === 'productos' && <>Productos</>}
            {activeTab === 'almacenes' && <>Almacenes</>}
            {activeTab === 'movimientos' && <>Movimientos (Kardex)</>}
            {activeTab === 'alertas' && <>Alertas de stock</>}
          </div>
        </div>
      </div>

      {/* =====================================
          TAB: CATEGORÍAS
          ===================================== */}
      {activeTab === 'categorias' && (
        <div className="card shadow-sm mb-3">
          <div className="card-header fw-semibold d-flex align-items-center justify-content-between">
            <span>Categorías de productos</span>

            <button
              type="button"
              className="btn btn-sm btn-primary d-md-none"
              onClick={() => setShowCreateCategoriaSheet(true)}
            >
              + Agregar
            </button>
          </div>

          <div className="card-body">
            {error && <div className="alert alert-danger">{error}</div>}

            <div className="d-none d-md-block">
              <form onSubmit={onCrear} className="row g-2 mb-3">
                <div className="col-12 col-md-3">
                  <label className="form-label mb-1">Nombre</label>
                  <input
                    className={`form-control ${createErrors.nombre_categoria ? 'is-invalid' : ''}`}
                    placeholder="Ej: Bebidas"
                    value={form.nombre_categoria}
                    onChange={(e) => setForm((s) => ({ ...s, nombre_categoria: e.target.value }))}
                    required
                  />
                  {createErrors.nombre_categoria && (
                    <div className="invalid-feedback">{createErrors.nombre_categoria}</div>
                  )}
                </div>

                <div className="col-12 col-md-2">
                  <label className="form-label mb-1">Código</label>
                  <input
                    className={`form-control ${createErrors.codigo_categoria ? 'is-invalid' : ''}`}
                    placeholder="Ej: BEB"
                    value={form.codigo_categoria}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, codigo_categoria: e.target.value.toUpperCase() }))
                    }
                    required
                  />
                  {createErrors.codigo_categoria && (
                    <div className="invalid-feedback">{createErrors.codigo_categoria}</div>
                  )}
                </div>

                <div className="col-12 col-md-5">
                  <label className="form-label mb-1">Descripción (opcional)</label>
                  <input
                    className={`form-control ${createErrors.descripcion ? 'is-invalid' : ''}`}
                    placeholder="Ej: Categoría para bebidas frías y calientes"
                    value={form.descripcion}
                    onChange={(e) => setForm((s) => ({ ...s, descripcion: e.target.value }))}
                  />
                  {createErrors.descripcion && (
                    <div className="invalid-feedback">{createErrors.descripcion}</div>
                  )}
                </div>

                <div className="col-12 col-md-1 d-flex align-items-end">
                  <div className="form-check">
                    <input
                      id="estadoNuevo"
                      className="form-check-input"
                      type="checkbox"
                      checked={form.estado}
                      onChange={(e) => setForm((s) => ({ ...s, estado: e.target.checked }))}
                    />
                    <label className="form-check-label" htmlFor="estadoNuevo">
                      Activo
                    </label>
                  </div>
                </div>

                <div className="col-12 col-md-1 d-grid align-items-end">
                  <button className="btn btn-primary" type="submit">
                    Crear
                  </button>
                </div>
              </form>
            </div>

            <div className="row g-2 mb-3">
              <div className="col-12 col-md-6">
                <input
                  className="form-control"
                  placeholder="Buscar por nombre, código o descripción..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="col-12 col-md-3">
                <select
                  className="form-select"
                  value={estadoFiltro}
                  onChange={(e) => setEstadoFiltro(e.target.value)}
                >
                  <option value="todos">Todos</option>
                  <option value="activo">Activos</option>
                  <option value="inactivo">Inactivos</option>
                </select>
              </div>

              <div className="col-12 col-md-3 d-grid">
                <button
                  className="btn btn-outline-secondary"
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

            <div className="d-md-none">
              {loading ? (
                <div className="text-muted">Cargando...</div>
              ) : categoriasFiltradas.length === 0 ? (
                <div className="text-muted">Sin datos</div>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {categoriasFiltradas.map((c, index) => {
                    const isEditing = editId === c.id_categoria_producto;

                    return (
                      <div key={c.id_categoria_producto} className="card border">
                        <div className="card-body">
                          <div className="d-flex justify-content-between align-items-start mb-2">
                            <div>
                              <div className="text-muted small">No. {index + 1}</div>
                              <div className="fw-bold">{isEditing ? 'EDITANDO' : c.nombre_categoria}</div>
                              <div className="text-muted small">
                                Código: <span className="fw-semibold">{c.codigo_categoria}</span> • Estado:{' '}
                                {isEditing
                                  ? editForm?.estado
                                    ? 'Activo'
                                    : 'Inactivo'
                                  : c.estado
                                  ? 'Activo'
                                  : 'Inactivo'}
                              </div>
                            </div>
                          </div>

                          <div className="mb-2">
                            <div className="small text-muted">Nombre</div>
                            {isEditing ? (
                              <>
                                <input
                                  className={`form-control form-control-sm ${editErrors.nombre_categoria ? 'is-invalid' : ''}`}
                                  value={editForm.nombre_categoria}
                                  onChange={(e) =>
                                    setEditForm((s) => ({ ...s, nombre_categoria: e.target.value }))
                                  }
                                />
                                {editErrors.nombre_categoria && (
                                  <div className="invalid-feedback">{editErrors.nombre_categoria}</div>
                                )}
                              </>
                            ) : (
                              <div>{c.nombre_categoria}</div>
                            )}
                          </div>

                          <div className="mb-2">
                            <div className="small text-muted">Código</div>
                            {isEditing ? (
                              <>
                                <input
                                  className={`form-control form-control-sm ${editErrors.codigo_categoria ? 'is-invalid' : ''}`}
                                  value={editForm.codigo_categoria}
                                  onChange={(e) =>
                                    setEditForm((s) => ({
                                      ...s,
                                      codigo_categoria: e.target.value.toUpperCase()
                                    }))
                                  }
                                />
                                {editErrors.codigo_categoria && (
                                  <div className="invalid-feedback">{editErrors.codigo_categoria}</div>
                                )}
                              </>
                            ) : (
                              <div className="fw-semibold">{c.codigo_categoria}</div>
                            )}
                          </div>

                          <div className="mb-2">
                            <div className="small text-muted">Descripción</div>
                            {isEditing ? (
                              <>
                                <input
                                  className={`form-control form-control-sm ${editErrors.descripcion ? 'is-invalid' : ''}`}
                                  value={editForm.descripcion}
                                  onChange={(e) =>
                                    setEditForm((s) => ({ ...s, descripcion: e.target.value }))
                                  }
                                />
                                {editErrors.descripcion && (
                                  <div className="invalid-feedback">{editErrors.descripcion}</div>
                                )}
                              </>
                            ) : (
                              <div>{c.descripcion}</div>
                            )}
                          </div>

                          <div className="mb-3">
                            <div className="small text-muted">Activo</div>
                            {isEditing ? (
                              <div className="form-check">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  checked={!!editForm.estado}
                                  onChange={(e) =>
                                    setEditForm((s) => ({ ...s, estado: e.target.checked }))
                                  }
                                />
                                <label className="form-check-label">Activo</label>
                              </div>
                            ) : (
                              <div>{c.estado ? 'Sí' : 'No'}</div>
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
                              <button className="btn btn-outline-primary" type="button" onClick={() => iniciarEdicion(c)}>
                                Editar
                              </button>
                              <button
                                className="btn btn-outline-danger"
                                type="button"
                                onClick={() => openConfirmDelete(c.id_categoria_producto, c.nombre_categoria)}
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

            <div className="d-none d-md-block">
              <div className="table-responsive">
                <table className="table table-sm table-striped align-middle">
                  <thead>
                    <tr>
                      <th style={{ width: 70 }}>No.</th>
                      <th>Nombre</th>
                      <th>Código</th>
                      <th>Descripción</th>
                      <th>Estado</th>
                      <th style={{ width: 220 }}>Acciones</th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading ? (
                      <tr><td colSpan="6">Cargando...</td></tr>
                    ) : categoriasFiltradas.length === 0 ? (
                      <tr><td colSpan="6">Sin datos</td></tr>
                    ) : (
                      categoriasFiltradas.map((c, index) => {
                        const isEditing = editId === c.id_categoria_producto;

                        return (
                          <tr key={c.id_categoria_producto}>
                            <td className="text-muted">{index + 1}</td>

                            <td>
                              {isEditing ? (
                                <>
                                  <input
                                    className={`form-control form-control-sm ${editErrors.nombre_categoria ? 'is-invalid' : ''}`}
                                    value={editForm.nombre_categoria}
                                    onChange={(e) =>
                                      setEditForm((s) => ({ ...s, nombre_categoria: e.target.value }))
                                    }
                                  />
                                  {editErrors.nombre_categoria && (
                                    <div className="invalid-feedback">{editErrors.nombre_categoria}</div>
                                  )}
                                </>
                              ) : (
                                c.nombre_categoria
                              )}
                            </td>

                            <td>
                              {isEditing ? (
                                <>
                                  <input
                                    className={`form-control form-control-sm ${editErrors.codigo_categoria ? 'is-invalid' : ''}`}
                                    value={editForm.codigo_categoria}
                                    onChange={(e) =>
                                      setEditForm((s) => ({
                                        ...s,
                                        codigo_categoria: e.target.value.toUpperCase()
                                      }))
                                    }
                                  />
                                  {editErrors.codigo_categoria && (
                                    <div className="invalid-feedback">{editErrors.codigo_categoria}</div>
                                  )}
                                </>
                              ) : (
                                c.codigo_categoria
                              )}
                            </td>

                            <td>
                              {isEditing ? (
                                <>
                                  <input
                                    className={`form-control form-control-sm ${editErrors.descripcion ? 'is-invalid' : ''}`}
                                    value={editForm.descripcion}
                                    onChange={(e) =>
                                      setEditForm((s) => ({ ...s, descripcion: e.target.value }))
                                    }
                                  />
                                  {editErrors.descripcion && (
                                    <div className="invalid-feedback">{editErrors.descripcion}</div>
                                  )}
                                </>
                              ) : (
                                c.descripcion
                              )}
                            </td>

                            <td>
                              {isEditing ? (
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  checked={!!editForm.estado}
                                  onChange={(e) =>
                                    setEditForm((s) => ({ ...s, estado: e.target.checked }))
                                  }
                                />
                              ) : (
                                c.estado ? 'Activo' : 'Inactivo'
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
                                  <button className="btn btn-sm btn-outline-primary" onClick={() => iniciarEdicion(c)} type="button">
                                    Editar
                                  </button>
                                  <button
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => openConfirmDelete(c.id_categoria_producto, c.nombre_categoria)}
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
        </div>
      )}

      {/* =====================================
          TAB: INSUMOS
          ===================================== */}
      {activeTab === 'insumos' && (
        <div className="card shadow-sm mb-3">
          <div className="card-header fw-semibold d-flex align-items-center justify-content-between">
            <span>Insumos</span>

            <button
              type="button"
              className="btn btn-sm btn-primary d-md-none"
              onClick={() => setShowCreateInsumoSheet(true)}
            >
              + Agregar
            </button>
          </div>

          <div className="card-body">
            {error && <div className="alert alert-danger">{error}</div>}

            {/* FORM CREAR (SOLO DESKTOP/TABLET) */}
            <div className="d-none d-md-block">
              <form onSubmit={onCrearInsumo} className="row g-2 mb-3">
                <div className="col-12 col-md-3">
                  <label className="form-label mb-1">Nombre del insumo</label>
                  <input
                    className={`form-control ${insumoCreateErrors.nombre_insumo ? 'is-invalid' : ''}`}
                    placeholder="Ej: Queso mozzarella"
                    value={insumoForm.nombre_insumo}
                    onChange={(e) => setInsumoForm((s) => ({ ...s, nombre_insumo: e.target.value }))}
                    required
                  />
                  {insumoCreateErrors.nombre_insumo && (
                    <div className="invalid-feedback">{insumoCreateErrors.nombre_insumo}</div>
                  )}
                </div>

                <div className="col-6 col-md-2">
                  <label className="form-label mb-1">Precio</label>
                  <input
                    className={`form-control ${insumoCreateErrors.precio ? 'is-invalid' : ''}`}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Ej: 120.50"
                    value={insumoForm.precio}
                    onChange={(e) => setInsumoForm((s) => ({ ...s, precio: e.target.value }))}
                    required
                  />
                  {insumoCreateErrors.precio && (
                    <div className="invalid-feedback">{insumoCreateErrors.precio}</div>
                  )}
                </div>

                <div className="col-6 col-md-2">
                  <label className="form-label mb-1">Cantidad</label>

                  {/* ======== AHORA (ENTEROS) ======== */}
                  <input
                    className={`form-control ${insumoCreateErrors.cantidad ? 'is-invalid' : ''}`}
                    type="number"
                    step="1"
                    min="0"
                    inputMode="numeric"
                    placeholder="Ej: 5"
                    value={insumoForm.cantidad}
                    onKeyDown={blockNonIntegerKeys}
                    onChange={(e) =>
                      setInsumoForm((s) => ({ ...s, cantidad: sanitizeInteger(e.target.value) }))
                    }
                    required
                  />

                  {insumoCreateErrors.cantidad && (
                    <div className="invalid-feedback">{insumoCreateErrors.cantidad}</div>
                  )}
                </div>

                <div className="col-12 col-md-2">
                  <label className="form-label mb-1">Almacén</label>
                  <select
                    className={`form-select ${insumoCreateErrors.id_almacen ? 'is-invalid' : ''}`}
                    value={String(insumoForm.id_almacen ?? '')}
                    onChange={(e) => setInsumoForm((s) => ({ ...s, id_almacen: e.target.value }))}
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

                  {insumoCreateErrors.id_almacen && (
                    <div className="invalid-feedback">{insumoCreateErrors.id_almacen}</div>
                  )}
                </div>

                <div className="col-12 col-md-3">
                  <label className="form-label mb-1">Fecha de ingreso (opcional)</label>
                  <input
                    className={`form-control ${insumoCreateErrors.fecha_ingreso_insumo ? 'is-invalid' : ''}`}
                    type="date"
                    value={insumoForm.fecha_ingreso_insumo}
                    onChange={(e) => setInsumoForm((s) => ({ ...s, fecha_ingreso_insumo: e.target.value }))}
                  />
                  {insumoCreateErrors.fecha_ingreso_insumo && (
                    <div className="invalid-feedback">{insumoCreateErrors.fecha_ingreso_insumo}</div>
                  )}
                </div>

                <div className="col-12 col-md-3">
                  <label className="form-label mb-1">Fecha de caducidad (opcional)</label>
                  <input
                    className={`form-control ${insumoCreateErrors.fecha_caducidad ? 'is-invalid' : ''}`}
                    type="date"
                    value={insumoForm.fecha_caducidad}
                    onChange={(e) => setInsumoForm((s) => ({ ...s, fecha_caducidad: e.target.value }))}
                  />
                  {insumoCreateErrors.fecha_caducidad && (
                    <div className="invalid-feedback">{insumoCreateErrors.fecha_caducidad}</div>
                  )}
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label mb-1">Descripción (opcional)</label>
                  <input
                    className={`form-control ${insumoCreateErrors.descripcion ? 'is-invalid' : ''}`}
                    placeholder="Ej: Bolsa de 1 libra"
                    value={insumoForm.descripcion}
                    onChange={(e) => setInsumoForm((s) => ({ ...s, descripcion: e.target.value }))}
                  />
                  {insumoCreateErrors.descripcion && (
                    <div className="invalid-feedback">{insumoCreateErrors.descripcion}</div>
                  )}
                </div>

                <div className="col-12 col-md-3 d-grid align-items-end">
                  <button className="btn btn-primary" type="submit">
                    Crear
                  </button>
                </div>
              </form>
            </div>

            {/* FILTROS INSUMOS */}
            <div className="row g-2 mb-3">
              <div className="col-12 col-md-6">
                <input
                  className="form-control"
                  placeholder="Buscar por nombre, descripción o almacén..."
                  value={insumoSearch}
                  onChange={(e) => setInsumoSearch(e.target.value)}
                />
              </div>

              <div className="col-12 col-md-3">
                <select
                  className="form-select"
                  value={insumoEstadoFiltro}
                  onChange={(e) => setInsumoEstadoFiltro(e.target.value)}
                >
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
                    setInsumoSearch('');
                    setInsumoEstadoFiltro('todos');
                  }}
                >
                  Limpiar filtros
                </button>
              </div>
            </div>

            {/* MOBILE CARDS INSUMOS */}
            <div className="d-md-none">
              {loadingInsumos ? (
                <div className="text-muted">Cargando...</div>
              ) : insumosFiltrados.length === 0 ? (
                <div className="text-muted">Sin datos</div>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {insumosFiltrados.map((i, index) => {
                    const isEditing = insumoEditId === i.id_insumo;

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
                                  className={`form-control form-control-sm ${insumoEditErrors.nombre_insumo ? 'is-invalid' : ''}`}
                                  value={insumoEditForm.nombre_insumo}
                                  onChange={(e) => setInsumoEditForm((s) => ({ ...s, nombre_insumo: e.target.value }))}
                                />
                                {insumoEditErrors.nombre_insumo && (
                                  <div className="invalid-feedback">{insumoEditErrors.nombre_insumo}</div>
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
                                    className={`form-control form-control-sm ${insumoEditErrors.precio ? 'is-invalid' : ''}`}
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={insumoEditForm.precio}
                                    onChange={(e) => setInsumoEditForm((s) => ({ ...s, precio: e.target.value }))}
                                  />
                                  {insumoEditErrors.precio && (
                                    <div className="invalid-feedback">{insumoEditErrors.precio}</div>
                                  )}
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
                                    className={`form-control form-control-sm ${insumoEditErrors.cantidad ? 'is-invalid' : ''}`}
                                    type="number"
                                    step="1"
                                    min="0"
                                    inputMode="numeric"
                                    value={insumoEditForm.cantidad}
                                    onKeyDown={blockNonIntegerKeys}
                                    onChange={(e) =>
                                      setInsumoEditForm((s) => ({ ...s, cantidad: sanitizeInteger(e.target.value) }))
                                    }
                                  />

                                  {insumoEditErrors.cantidad && (
                                    <div className="invalid-feedback">{insumoEditErrors.cantidad}</div>
                                  )}
                                </>
                              ) : (
                                <div>{i.cantidad}</div>
                              )}
                            </div>

                            <div className="col-6">
                              <div className="small text-muted">Almacén</div>
                              {isEditing ? (
                                <>
                                  <select
                                    className={`form-select form-select-sm ${insumoEditErrors.id_almacen ? 'is-invalid' : ''}`}
                                    value={String(insumoEditForm.id_almacen ?? '')}
                                    onChange={(e) => setInsumoEditForm((s) => ({ ...s, id_almacen: e.target.value }))}
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

                                  {insumoEditErrors.id_almacen && (
                                    <div className="invalid-feedback">{insumoEditErrors.id_almacen}</div>
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
                                    className={`form-control form-control-sm ${insumoEditErrors.fecha_ingreso_insumo ? 'is-invalid' : ''}`}
                                    type="date"
                                    value={insumoEditForm.fecha_ingreso_insumo}
                                    onChange={(e) => setInsumoEditForm((s) => ({ ...s, fecha_ingreso_insumo: e.target.value }))}
                                  />
                                  {insumoEditErrors.fecha_ingreso_insumo && (
                                    <div className="invalid-feedback">{insumoEditErrors.fecha_ingreso_insumo}</div>
                                  )}
                                </>
                              ) : (
                                <div>{toDateInputValue(i.fecha_ingreso_insumo) || '-'}</div>
                              )}
                            </div>

                            <div className="col-12">
                              <div className="small text-muted">Caducidad</div>
                              {isEditing ? (
                                <>
                                  <input
                                    className={`form-control form-control-sm ${insumoEditErrors.fecha_caducidad ? 'is-invalid' : ''}`}
                                    type="date"
                                    value={insumoEditForm.fecha_caducidad}
                                    onChange={(e) => setInsumoEditForm((s) => ({ ...s, fecha_caducidad: e.target.value }))}
                                  />
                                  {insumoEditErrors.fecha_caducidad && (
                                    <div className="invalid-feedback">{insumoEditErrors.fecha_caducidad}</div>
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
                                    className={`form-control form-control-sm ${insumoEditErrors.descripcion ? 'is-invalid' : ''}`}
                                    value={insumoEditForm.descripcion}
                                    onChange={(e) => setInsumoEditForm((s) => ({ ...s, descripcion: e.target.value }))}
                                  />
                                  {insumoEditErrors.descripcion && (
                                    <div className="invalid-feedback">{insumoEditErrors.descripcion}</div>
                                  )}
                                </>
                              ) : (
                                <div>{i.descripcion || '-'}</div>
                              )}
                            </div>
                          </div>

                          {isEditing ? (
                            <div className="d-grid gap-2 mt-3">
                              <button className="btn btn-success" type="button" onClick={guardarEdicionInsumo}>
                                Guardar
                              </button>
                              <button className="btn btn-secondary" type="button" onClick={cancelarEdicionInsumo}>
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <div className="d-grid gap-2 mt-3">
                              <button className="btn btn-outline-primary" type="button" onClick={() => iniciarEdicionInsumo(i)}>
                                Editar
                              </button>
                              <button className="btn btn-outline-danger" type="button" onClick={() => openConfirmDeleteInsumo(i.id_insumo, i.nombre_insumo)}>
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

            {/* DESKTOP TABLE INSUMOS */}
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
                    {loadingInsumos ? (
                      <tr><td colSpan="9">Cargando...</td></tr>
                    ) : insumosFiltrados.length === 0 ? (
                      <tr><td colSpan="9">Sin datos</td></tr>
                    ) : (
                      insumosFiltrados.map((i, index) => {
                        const isEditing = insumoEditId === i.id_insumo;

                        return (
                          <tr key={i.id_insumo}>
                            <td className="text-muted">{index + 1}</td>

                            <td>
                              {isEditing ? (
                                <>
                                  <input
                                    className={`form-control form-control-sm ${insumoEditErrors.nombre_insumo ? 'is-invalid' : ''}`}
                                    value={insumoEditForm.nombre_insumo}
                                    onChange={(e) => setInsumoEditForm((s) => ({ ...s, nombre_insumo: e.target.value }))}
                                  />
                                  {insumoEditErrors.nombre_insumo && (
                                    <div className="invalid-feedback">{insumoEditErrors.nombre_insumo}</div>
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
                                    className={`form-control form-control-sm ${insumoEditErrors.precio ? 'is-invalid' : ''}`}
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={insumoEditForm.precio}
                                    onChange={(e) => setInsumoEditForm((s) => ({ ...s, precio: e.target.value }))}
                                  />
                                  {insumoEditErrors.precio && (
                                    <div className="invalid-feedback">{insumoEditErrors.precio}</div>
                                  )}
                                </>
                              ) : (
                                i.precio
                              )}
                            </td>

                            <td>
                              {isEditing ? (
                                <>
                                  <input
                                    className={`form-control form-control-sm ${insumoEditErrors.cantidad ? 'is-invalid' : ''}`}
                                    type="number"
                                    step="1"
                                    min="0"
                                    inputMode="numeric"
                                    value={insumoEditForm.cantidad}
                                    onKeyDown={blockNonIntegerKeys}
                                    onChange={(e) =>
                                      setInsumoEditForm((s) => ({ ...s, cantidad: sanitizeInteger(e.target.value) }))
                                    }
                                  />

                                  {insumoEditErrors.cantidad && (
                                    <div className="invalid-feedback">{insumoEditErrors.cantidad}</div>
                                  )}
                                </>
                              ) : (
                                i.cantidad
                              )}
                            </td>

                            <td>
                              {isEditing ? (
                                <>
                                  <select
                                    className={`form-select form-select-sm ${insumoEditErrors.id_almacen ? 'is-invalid' : ''}`}
                                    value={String(insumoEditForm.id_almacen ?? '')}
                                    onChange={(e) => setInsumoEditForm((s) => ({ ...s, id_almacen: e.target.value }))}
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

                                  {insumoEditErrors.id_almacen && (
                                    <div className="invalid-feedback">{insumoEditErrors.id_almacen}</div>
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
                                    className={`form-control form-control-sm ${insumoEditErrors.fecha_ingreso_insumo ? 'is-invalid' : ''}`}
                                    type="date"
                                    value={insumoEditForm.fecha_ingreso_insumo}
                                    onChange={(e) => setInsumoEditForm((s) => ({ ...s, fecha_ingreso_insumo: e.target.value }))}
                                  />
                                  {insumoEditErrors.fecha_ingreso_insumo && (
                                    <div className="invalid-feedback">{insumoEditErrors.fecha_ingreso_insumo}</div>
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
                                    className={`form-control form-control-sm ${insumoEditErrors.fecha_caducidad ? 'is-invalid' : ''}`}
                                    type="date"
                                    value={insumoEditForm.fecha_caducidad}
                                    onChange={(e) => setInsumoEditForm((s) => ({ ...s, fecha_caducidad: e.target.value }))}
                                  />
                                  {insumoEditErrors.fecha_caducidad && (
                                    <div className="invalid-feedback">{insumoEditErrors.fecha_caducidad}</div>
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
                                    className={`form-control form-control-sm ${insumoEditErrors.descripcion ? 'is-invalid' : ''}`}
                                    value={insumoEditForm.descripcion}
                                    onChange={(e) => setInsumoEditForm((s) => ({ ...s, descripcion: e.target.value }))}
                                  />
                                  {insumoEditErrors.descripcion && (
                                    <div className="invalid-feedback">{insumoEditErrors.descripcion}</div>
                                  )}
                                </>
                              ) : (
                                i.descripcion || '-'
                              )}
                            </td>

                            <td>
                              {isEditing ? (
                                <div className="d-flex gap-2">
                                  <button className="btn btn-sm btn-success" onClick={guardarEdicionInsumo} type="button">
                                    Guardar
                                  </button>
                                  <button className="btn btn-sm btn-secondary" onClick={cancelarEdicionInsumo} type="button">
                                    Cancelar
                                  </button>
                                </div>
                              ) : (
                                <div className="d-flex gap-2">
                                  <button className="btn btn-sm btn-outline-primary" onClick={() => iniciarEdicionInsumo(i)} type="button">
                                    Editar
                                  </button>
                                  <button
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => openConfirmDeleteInsumo(i.id_insumo, i.nombre_insumo)}
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
        </div>
      )}

      {/* =====================================
          TAB: PRODUCTOS
          ===================================== */}
      {activeTab === 'productos' && (
        // COMENTARIO EN MAYÚSCULAS: SUBMÓDULO PRODUCTOS SE RENDERIZA AQUÍ (MISMO MOLDE REUTILIZABLE)
        <ProductosTab categorias={categorias} openToast={openToast} />
      )}

      {/* =====================================
          TAB: ALMACENES
          ===================================== */}
      {activeTab === 'almacenes' && (
        <AlmacenesTab openToast={openToast} />
      )}

      {/* =====================================
          TAB: MOVIMIENTOS
          ===================================== */}
      {activeTab === 'movimientos' && (
        <MovimientosTab openToast={openToast} />
      )}

      {/* =====================================
          TAB: ALERTAS
          ===================================== */}
      {activeTab === 'alertas' && (
        // COMENTARIO EN MAYÚSCULAS: SUBMÓDULO ALERTAS (STOCK BAJO / SIN STOCK) REUTILIZA EL MOLDE
        <AlertasTab openToast={openToast} />
      )}



      {/* ==============================
          TOAST PROFESIONAL (ARRIBA DERECHA)
          ============================== */}
      {toast.show && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 2000, width: 340, maxWidth: '90vw' }}>
          <div className={`card shadow-sm border ${toastBorderClass(toast.variant)}`}>
            <div className="card-body p-3">
              <div className="d-flex justify-content-between align-items-start">
                <div className="d-flex gap-2">
                  <div style={{ fontSize: 18 }}>{toastIcon(toast.variant)}</div>
                  <div>
                    <div className="fw-bold">{toast.title}</div>
                    <div className="text-muted small">{toast.message}</div>
                  </div>
                </div>

                <button type="button" className="btn btn-sm btn-light" onClick={closeToast}>
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==============================
          SHEET CREAR CATEGORÍA
          ============================== */}
      {showCreateCategoriaSheet && (
        <div
          className="modal fade show"
          style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 2500 }}
          role="dialog"
          aria-modal="true"
          onClick={() => setShowCreateCategoriaSheet(false)}
        >
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content shadow">
              <div className="modal-header d-flex align-items-center justify-content-between">
                <div className="fw-semibold">Agregar categoría</div>
                <button type="button" className="btn btn-sm btn-light" onClick={() => setShowCreateCategoriaSheet(false)}>
                  ✕
                </button>
              </div>

              <div className="modal-body">
                <form onSubmit={onCrear} className="row g-2">
                  <div className="col-12">
                    <label className="form-label mb-1">Nombre</label>
                    <input
                      className={`form-control ${createErrors.nombre_categoria ? 'is-invalid' : ''}`}
                      placeholder="Ej: Bebidas"
                      value={form.nombre_categoria}
                      onChange={(e) => setForm((s) => ({ ...s, nombre_categoria: e.target.value }))}
                      required
                    />
                    {createErrors.nombre_categoria && (
                      <div className="invalid-feedback">{createErrors.nombre_categoria}</div>
                    )}
                  </div>

                  <div className="col-12">
                    <label className="form-label mb-1">Código</label>
                    <input
                      className={`form-control ${createErrors.codigo_categoria ? 'is-invalid' : ''}`}
                      placeholder="Ej: BEB"
                      value={form.codigo_categoria}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, codigo_categoria: e.target.value.toUpperCase() }))
                      }
                      required
                    />
                    {createErrors.codigo_categoria && (
                      <div className="invalid-feedback">{createErrors.codigo_categoria}</div>
                    )}
                  </div>

                  <div className="col-12">
                    <label className="form-label mb-1">Descripción (opcional)</label>
                    <input
                      className={`form-control ${createErrors.descripcion ? 'is-invalid' : ''}`}
                      placeholder="Ej: Categoría para bebidas frías y calientes"
                      value={form.descripcion}
                      onChange={(e) => setForm((s) => ({ ...s, descripcion: e.target.value }))}
                    />
                    {createErrors.descripcion && (
                      <div className="invalid-feedback">{createErrors.descripcion}</div>
                    )}
                  </div>

                  <div className="col-12">
                    <div className="form-check">
                      <input
                        id="estadoNuevoMobile"
                        className="form-check-input"
                        type="checkbox"
                        checked={form.estado}
                        onChange={(e) => setForm((s) => ({ ...s, estado: e.target.checked }))}
                      />
                      <label className="form-check-label" htmlFor="estadoNuevoMobile">
                        Activo
                      </label>
                    </div>
                  </div>

                  <div className="col-12 d-grid gap-2 mt-2">
                    <button className="btn btn-primary" type="submit">
                      Guardar
                    </button>
                    <button className="btn btn-outline-secondary" type="button" onClick={() => setShowCreateCategoriaSheet(false)}>
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
          SHEET CREAR INSUMO (SOLO MÓVIL)
          ============================== */}
      {showCreateInsumoSheet && (
        <div
          className="modal fade show"
          style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 2500 }}
          role="dialog"
          aria-modal="true"
          onClick={() => setShowCreateInsumoSheet(false)}
        >
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: 12 }} onClick={(e) => e.stopPropagation()}>
            <div className="card shadow">
              <div className="card-header d-flex align-items-center justify-content-between">
                <div className="fw-semibold">Agregar insumo</div>
                <button type="button" className="btn btn-sm btn-light" onClick={() => setShowCreateInsumoSheet(false)}>
                  ✕
                </button>
              </div>

              <div className="card-body">
                <form onSubmit={onCrearInsumo} className="row g-2">
                  <div className="col-12">
                    <label className="form-label mb-1">Nombre del insumo</label>
                    <input
                      className={`form-control ${insumoCreateErrors.nombre_insumo ? 'is-invalid' : ''}`}
                      placeholder="Ej: Queso mozzarella"
                      value={insumoForm.nombre_insumo}
                      onChange={(e) => setInsumoForm((s) => ({ ...s, nombre_insumo: e.target.value }))}
                      required
                    />
                    {insumoCreateErrors.nombre_insumo && (
                      <div className="invalid-feedback">{insumoCreateErrors.nombre_insumo}</div>
                    )}
                  </div>

                  <div className="col-6">
                    <label className="form-label mb-1">Precio</label>
                    <input
                      className={`form-control ${insumoCreateErrors.precio ? 'is-invalid' : ''}`}
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Ej: 120.50"
                      value={insumoForm.precio}
                      onChange={(e) => setInsumoForm((s) => ({ ...s, precio: e.target.value }))}
                      required
                    />
                    {insumoCreateErrors.precio && (
                      <div className="invalid-feedback">{insumoCreateErrors.precio}</div>
                    )}
                  </div>

                  <div className="col-6">
                    <label className="form-label mb-1">Cantidad</label>

                    <input
                      className={`form-control ${insumoCreateErrors.cantidad ? 'is-invalid' : ''}`}
                      type="number"
                      step="1"
                      min="0"
                      inputMode="numeric"
                      placeholder="Ej: 5"
                      value={insumoForm.cantidad}
                      onKeyDown={blockNonIntegerKeys}
                      onChange={(e) =>
                        setInsumoForm((s) => ({ ...s, cantidad: sanitizeInteger(e.target.value) }))
                      }
                      required
                    />

                    {insumoCreateErrors.cantidad && (
                      <div className="invalid-feedback">{insumoCreateErrors.cantidad}</div>
                    )}
                  </div>

                  <div className="col-12">
                    <label className="form-label mb-1">Almacén</label>
                    <select
                      className={`form-select ${insumoCreateErrors.id_almacen ? 'is-invalid' : ''}`}
                      value={String(insumoForm.id_almacen ?? '')}
                      onChange={(e) => setInsumoForm((s) => ({ ...s, id_almacen: e.target.value }))}
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

                    {insumoCreateErrors.id_almacen && (
                      <div className="invalid-feedback">{insumoCreateErrors.id_almacen}</div>
                    )}
                  </div>

                  <div className="col-12">
                    <label className="form-label mb-1">Fecha de ingreso (opcional)</label>
                    <input
                      className={`form-control ${insumoCreateErrors.fecha_ingreso_insumo ? 'is-invalid' : ''}`}
                      type="date"
                      value={insumoForm.fecha_ingreso_insumo}
                      onChange={(e) => setInsumoForm((s) => ({ ...s, fecha_ingreso_insumo: e.target.value }))}
                    />
                    {insumoCreateErrors.fecha_ingreso_insumo && (
                      <div className="invalid-feedback">{insumoCreateErrors.fecha_ingreso_insumo}</div>
                    )}
                  </div>

                  <div className="col-12">
                    <label className="form-label mb-1">Fecha de caducidad (opcional)</label>
                    <input
                      className={`form-control ${insumoCreateErrors.fecha_caducidad ? 'is-invalid' : ''}`}
                      type="date"
                      value={insumoForm.fecha_caducidad}
                      onChange={(e) => setInsumoForm((s) => ({ ...s, fecha_caducidad: e.target.value }))}
                    />
                    {insumoCreateErrors.fecha_caducidad && (
                      <div className="invalid-feedback">{insumoCreateErrors.fecha_caducidad}</div>
                    )}
                  </div>

                  <div className="col-12">
                    <label className="form-label mb-1">Descripción (opcional)</label>
                    <input
                      className={`form-control ${insumoCreateErrors.descripcion ? 'is-invalid' : ''}`}
                      placeholder="Ej: Bolsa de 1 libra"
                      value={insumoForm.descripcion}
                      onChange={(e) => setInsumoForm((s) => ({ ...s, descripcion: e.target.value }))}
                    />
                    {insumoCreateErrors.descripcion && (
                      <div className="invalid-feedback">{insumoCreateErrors.descripcion}</div>
                    )}
                  </div>

                  <div className="col-12 d-grid gap-2 mt-2">
                    <button className="btn btn-primary" type="submit">
                      Guardar
                    </button>
                    <button className="btn btn-outline-secondary" type="button" onClick={() => setShowCreateInsumoSheet(false)}>
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>

              <div className="card-footer text-muted small">
                LAS FECHAS SON OPCIONALES. SI NO APLICA, DÉJALAS VACÍAS.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==============================
          MODAL CONFIRMACIÓN ELIMINAR (CATEGORÍAS)
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

      {/* ==============================
          MODAL CONFIRMACIÓN ELIMINAR (INSUMOS)
          ============================== */}
      {confirmModalInsumo.show && (
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
                <button type="button" className="btn-close btn-close-white" onClick={closeConfirmDeleteInsumo} />
              </div>

              <div className="modal-body">
                <div className="d-flex gap-3">
                  <div style={{ fontSize: 28 }}>⚠️</div>
                  <div>
                    <div className="fw-semibold">¿DESEAS ELIMINAR ESTE INSUMO?</div>
                    <div className="text-muted">
                      <span className="fw-bold">{confirmModalInsumo.nombre || '(SIN NOMBRE)'}</span>
                    </div>
                    <div className="text-muted small mt-2">ESTA ACCIÓN NO SE PUEDE DESHACER.</div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-outline-secondary" type="button" onClick={closeConfirmDeleteInsumo}>
                  Cancelar
                </button>
                <button className="btn btn-danger" type="button" onClick={eliminarConfirmadoInsumo}>
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

export default Inventario;
