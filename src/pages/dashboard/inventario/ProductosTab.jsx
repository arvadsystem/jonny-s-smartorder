import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { inventarioService } from '../../../services/inventarioService';

const getStockMeta = (cantidad) => {
  const qty = Number.parseInt(String(cantidad ?? '0'), 10);
  if (Number.isNaN(qty) || qty <= 0) return { qty: 0, label: 'Sin stock', className: 'is-empty' };
  if (qty <= 5) return { qty, label: 'Stock bajo', className: 'is-low' };
  return { qty, label: 'Con stock', className: 'is-ok' };
};

const buildCreateImageState = () => ({
  file: null,
  previewUrl: '',
  loading: false,
  error: ''
});

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
  const [sortBy, setSortBy] = useState('recientes');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [createPanelOpen, setCreatePanelOpen] = useState(false);
  const currentPage = 1;
  const pageSize = 8;
  const renderLegacyLayouts = false;

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
  const [creating, setCreating] = useState(false);
  const [createImage, setCreateImage] = useState(buildCreateImageState);

  // ==============================
  // EDITAR
  // ==============================
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editErrors, setEditErrors] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  // ==============================
  // MODAL CONFIRMAR ELIMINAR
  // ==============================
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    idToDelete: null,
    nombre: ''
  });
  const [deleting, setDeleting] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerEditMode, setDrawerEditMode] = useState(false);
  const [selectedProductoId, setSelectedProductoId] = useState(null);
  const [localEstadoMap, setLocalEstadoMap] = useState({});
  const [imageErrorMap, setImageErrorMap] = useState({});
  const [drawerMessage, setDrawerMessage] = useState('');
  const [togglingEstado, setTogglingEstado] = useState(false);
  const catalogCarouselRef = useRef(null);
  const [carouselState, setCarouselState] = useState({ canPrev: false, canNext: false });

  const openConfirmDelete = (id, nombre) => {
    setConfirmModal({ show: true, idToDelete: id, nombre: nombre || '' });
  };

  const closeConfirmDelete = () => {
    setConfirmModal({ show: false, idToDelete: null, nombre: '' });
    setDeleting(false);
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

  const formatMoney = (value) => {
    const n = Number.parseFloat(String(value ?? '0'));
    if (Number.isNaN(n)) return 'L. 0.00';
    return `L. ${n.toFixed(2)}`;
  };

  useEffect(() => {
    return () => {
      if (createImage.previewUrl && createImage.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(createImage.previewUrl);
      }
    };
  }, [createImage.previewUrl]);

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

  const selectedProducto = useMemo(() => {
    if (!selectedProductoId) return null;
    return productos.find((p) => Number(p?.id_producto) === Number(selectedProductoId)) || null;
  }, [productos, selectedProductoId]);

  const resolveEstadoActivo = useCallback((producto) => {
    if (!producto) return false;
    const localEstado = localEstadoMap[producto?.id_producto];
    if (localEstado === true || localEstado === false) return localEstado;
    return producto?.estado !== false;
  }, [localEstadoMap]);

  const resolveEstadoProducto = useCallback((producto) => {
    if (!resolveEstadoActivo(producto)) return { label: 'Inactivo', className: 'is-inactive' };

    const stockMeta = getStockMeta(producto?.cantidad);
    if (stockMeta.qty <= 0) return { label: 'Sin existencias', className: 'is-empty' };
    if (stockMeta.qty <= 5) return { label: 'Stock bajo', className: 'is-low' };
    return { label: 'En existencia', className: 'is-ok' };
  }, [resolveEstadoActivo]);

  const clearCreateImage = useCallback(() => {
    setCreateImage(buildCreateImageState());
  }, []);

  const setCreateImageError = useCallback((message) => {
    setCreateImage({
      ...buildCreateImageState(),
      error: message
    });
  }, []);

  const onCreateImageChange = useCallback((event) => {
    const input = event.target;
    const file = input?.files?.[0];

    if (!file) {
      clearCreateImage();
      return;
    }

    if (!String(file.type || '').startsWith('image/')) {
      setCreateImage((prev) => ({
        ...prev,
        loading: false,
        error: 'Selecciona una imagen válida (JPG, PNG o WEBP).'
      }));
      input.value = '';
      return;
    }

    const maxSizeMb = 6;
    const maxSizeBytes = maxSizeMb * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setCreateImage((prev) => ({
        ...prev,
        loading: false,
        error: `La imagen supera ${maxSizeMb} MB.`
      }));
      input.value = '';
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setCreateImage({
      file,
      previewUrl,
      loading: true,
      error: ''
    });

    const probe = new Image();
    probe.onload = () => {
      setCreateImage((prev) => {
        if (prev.previewUrl !== previewUrl) return prev;
        return {
          ...prev,
          loading: false,
          error: ''
        };
      });
    };
    probe.onerror = () => {
      setCreateImageError('No se pudo cargar la imagen seleccionada.');
      input.value = '';
    };
    probe.src = previewUrl;
  }, [clearCreateImage, setCreateImageError]);

  const onCreatePreviewError = useCallback(() => {
    setCreateImageError('No se pudo mostrar la vista previa de la imagen.');
  }, [setCreateImageError]);

  const markImageAsError = useCallback((productoId) => {
    if (!productoId) return;
    setImageErrorMap((prev) => {
      if (prev[productoId]) return prev;
      return { ...prev, [productoId]: true };
    });
  }, []);

  const getProductoImageSrc = useCallback((producto) => {
    if (!producto) return '';
    const id = producto?.id_producto;
    if (imageErrorMap[id]) return '';
    return String(producto?.imagen_url || producto?.imagen || '').trim();
  }, [imageErrorMap]);

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
    clearCreateImage();
  };

  // ==============================
  // CREAR PRODUCTO
  // ==============================
  const onCrear = async (e) => {
    e.preventDefault();
    if (creating) return;
    setError('');

    const v = validarProducto(form);
    setCreateErrors(v.errors);
    if (!v.ok) return;

    setCreating(true);
    try {
      const payload = buildProductoPayload(v.cleaned);
      await inventarioService.crearProducto(payload);

      resetForm();
      setCreatePanelOpen(false);
      setShowCreateProductoSheet(false);
      await cargarProductos();

      safeToast('CREADO', 'EL PRODUCTO SE CREÓ CORRECTAMENTE.', 'success');
    } catch (e2) {
      const msg = e2?.message || 'ERROR CREANDO PRODUCTO';
      setError(msg);
      safeToast('ERROR', msg, 'danger');
    } finally {
      setCreating(false);
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
    setSavingEdit(false);
  };

  const abrirDrawerProducto = (producto) => {
    iniciarEdicion(producto);
    setSelectedProductoId(producto?.id_producto ?? null);
    setDrawerEditMode(false);
    setDrawerMessage('');
    setDrawerOpen(true);
  };

  const cerrarDrawerProducto = () => {
    setDrawerOpen(false);
    setDrawerEditMode(false);
    setDrawerMessage('');
    setSelectedProductoId(null);
    cancelarEdicion();
  };

  const duplicarProductoDesdeDrawer = () => {
    if (!selectedProducto) return;

    setForm({
      nombre_producto: selectedProducto?.nombre_producto ?? '',
      precio: selectedProducto?.precio ?? '',
      cantidad: selectedProducto?.cantidad ?? '',
      descripcion_producto: selectedProducto?.descripcion_producto ?? '',
      fecha_ingreso_producto: toDateInputValue(selectedProducto?.fecha_ingreso_producto),
      fecha_caducidad: toDateInputValue(selectedProducto?.fecha_caducidad),
      id_categoria_producto: String(selectedProducto?.id_categoria_producto ?? ''),
      id_almacen: String(selectedProducto?.id_almacen ?? ''),
      id_tipo_departamento: selectedProducto?.id_tipo_departamento ? String(selectedProducto?.id_tipo_departamento) : ''
    });
    setCreateErrors({});
    clearCreateImage();
    setCreatePanelOpen(true);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setShowCreateProductoSheet(true);
    }
  };

  const toggleEstadoProductoDesdeDrawer = async () => {
    if (!selectedProducto || togglingEstado) return;

    const productId = selectedProducto?.id_producto;
    const currentActive = resolveEstadoActivo(selectedProducto);
    const nextActive = !currentActive;

    setLocalEstadoMap((prev) => ({ ...prev, [productId]: nextActive }));
    setDrawerMessage(nextActive ? 'Activando producto...' : 'Desactivando producto...');
    setTogglingEstado(true);

    try {
      const estadoCandidates = [nextActive ? 1 : 0, nextActive ? '1' : '0', nextActive];
      let estadoUpdated = false;
      let lastError = null;

      for (const estadoValue of estadoCandidates) {
        try {
          await inventarioService.actualizarProductoCampo(productId, 'estado', estadoValue);
          estadoUpdated = true;
          break;
        } catch (e) {
          lastError = e;
        }
      }

      if (!estadoUpdated) {
        throw lastError || new Error('No se pudo actualizar el estado.');
      }

      setProductos((prev) =>
        prev.map((item) => (
          Number(item?.id_producto) === Number(productId)
            ? { ...item, estado: nextActive }
            : item
        ))
      );
      setLocalEstadoMap((prev) => {
        if (!Object.prototype.hasOwnProperty.call(prev, productId)) return prev;
        const next = { ...prev };
        delete next[productId];
        return next;
      });
      setDrawerMessage(nextActive ? 'Producto activado.' : 'Producto desactivado.');
      safeToast('EXITO', nextActive ? 'Producto activado.' : 'Producto desactivado.', 'success');
    } catch (e) {
      setLocalEstadoMap((prev) => {
        if (!Object.prototype.hasOwnProperty.call(prev, productId)) return prev;
        const next = { ...prev };
        delete next[productId];
        return next;
      });
      const msg = e?.message || 'No se pudo actualizar el estado. Intenta de nuevo.';
      setDrawerMessage(msg);
      safeToast('ERROR', msg, 'danger');
    } finally {
      setTogglingEstado(false);
    }
  };

  // ==============================
  // GUARDAR EDICIÓN (CAMPO POR CAMPO)
  // ==============================
  const guardarEdicion = async () => {
    if (!editId || !editForm || savingEdit) return;

    setError('');
    const v = validarProducto(editForm);
    setEditErrors(v.errors);
    if (!v.ok) return;

    setSavingEdit(true);
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
        setDrawerMessage('Cambios guardados.');
        safeToast('INFO', 'Cambios guardados.', 'success');
        return;
      }

      for (const [campo, valor] of cambios) {
        await inventarioService.actualizarProductoCampo(editId, campo, valor);
      }
      await cargarProductos();
      setLocalEstadoMap((prev) => {
        if (!Object.prototype.hasOwnProperty.call(prev, editId)) return prev;
        const next = { ...prev };
        delete next[editId];
        return next;
      });
      setDrawerMessage('Cambios guardados.');
      setDrawerEditMode(false);
      safeToast('EXITO', 'Cambios guardados.', 'success');
    } catch {
      const msg = 'No se pudo guardar. Intenta de nuevo.';
      setError(msg);
      safeToast('ERROR', msg, 'danger');
    } finally {
      setSavingEdit(false);
    }
  };

  // ==============================
  // ELIMINAR PRODUCTO (CONFIRMADO)
  // ==============================
  const eliminarConfirmado = async () => {
    const id = confirmModal.idToDelete;
    if (!id || deleting) return;

    setDeleting(true);
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
      setDeleting(false);
    }
  };

  // ==============================
  // FILTRAR + ORDENAR
  // ==============================
  const productosFiltrados = useMemo(() => {
    const s = search.trim().toLowerCase();

    const filtered = [...productos].filter((p) => {
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

    filtered.sort((a, b) => {
      if (sortBy === 'nombre_asc') {
        return String(a?.nombre_producto ?? '').localeCompare(String(b?.nombre_producto ?? ''), 'es', { sensitivity: 'base' });
      }
      if (sortBy === 'nombre_desc') {
        return String(b?.nombre_producto ?? '').localeCompare(String(a?.nombre_producto ?? ''), 'es', { sensitivity: 'base' });
      }
      if (sortBy === 'precio_desc') return Number(b?.precio ?? 0) - Number(a?.precio ?? 0);
      if (sortBy === 'precio_asc') return Number(a?.precio ?? 0) - Number(b?.precio ?? 0);
      if (sortBy === 'stock_desc') return Number(b?.cantidad ?? 0) - Number(a?.cantidad ?? 0);
      if (sortBy === 'stock_asc') return Number(a?.cantidad ?? 0) - Number(b?.cantidad ?? 0);
      return Number(b?.id_producto ?? 0) - Number(a?.id_producto ?? 0);
    });

    return filtered;
  }, [productos, search, stockFiltro, categoriaFiltro, almacenFiltro, deptoFiltro, sortBy, getCategoriaLabel, getAlmacenLabel, getDeptoLabel]);

  const kpis = useMemo(() => {
    const total = Array.isArray(productos) ? productos.length : 0;
    const conStock = (productos || []).filter((p) => getStockMeta(p?.cantidad).qty > 0).length;
    const stockBajo = (productos || []).filter((p) => getStockMeta(p?.cantidad).className === 'is-low').length;
    const sinStock = total - conStock;
    return { total, conStock, stockBajo, sinStock };
  }, [productos]);

  const hasActiveFilters = useMemo(() => {
    return (
      search.trim() !== '' ||
      stockFiltro !== 'todos' ||
      categoriaFiltro !== 'todos' ||
      almacenFiltro !== 'todos' ||
      deptoFiltro !== 'todos' ||
      sortBy !== 'recientes'
    );
  }, [search, stockFiltro, categoriaFiltro, almacenFiltro, deptoFiltro, sortBy]);

  const productosPaginados = productosFiltrados;
  const rangoHasta = productosFiltrados.length;

  const updateCarouselState = useCallback(() => {
    const el = catalogCarouselRef.current;
    if (!el) {
      setCarouselState({ canPrev: false, canNext: false });
      return;
    }

    const canPrev = el.scrollLeft > 6;
    const canNext = el.scrollLeft + el.clientWidth < el.scrollWidth - 6;
    setCarouselState((prev) => (
      prev.canPrev === canPrev && prev.canNext === canNext
        ? prev
        : { canPrev, canNext }
    ));
  }, []);

  useEffect(() => {
    const el = catalogCarouselRef.current;
    if (!el) return undefined;

    updateCarouselState();
    const onScroll = () => updateCarouselState();
    const onResize = () => updateCarouselState();

    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);

    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, [updateCarouselState, productosPaginados.length, loadingProductos]);

  const scrollCatalog = (direction) => {
    const el = catalogCarouselRef.current;
    if (!el) return;
    const distance = Math.max(280, Math.floor(el.clientWidth * 0.82));
    const left = direction === 'next' ? distance : -distance;
    el.scrollBy({ left, behavior: 'smooth' });
  };

  const resetFiltros = () => {
    setSearch('');
    setStockFiltro('todos');
    setCategoriaFiltro('todos');
    setAlmacenFiltro('todos');
    setDeptoFiltro('todos');
    setSortBy('recientes');
  };

  const activarEdicionDrawer = () => {
    if (!selectedProducto) return;
    iniciarEdicion(selectedProducto);
    setDrawerEditMode(true);
    setDrawerMessage('');
  };

  const ajustarCantidadDrawer = (delta) => {
    setDrawerEditMode(true);
    setEditForm((s) => {
      if (!s) return s;
      const actual = Number.parseInt(String(s.cantidad ?? '0'), 10);
      const next = Math.max(0, (Number.isNaN(actual) ? 0 : actual) + delta);
      return { ...s, cantidad: String(next) };
    });
  };

  const onCantidadDrawerChange = (value) => {
    setDrawerEditMode(true);
    setEditForm((s) => {
      if (!s) return s;
      return { ...s, cantidad: sanitizeInteger(value) };
    });
  };

  const guardarDrawerCambios = async () => {
    await guardarEdicion();
  };

  const historialDrawer = useMemo(() => {
    if (!selectedProducto) return [];
    const items = [];
    if (selectedProducto?.fecha_ingreso_producto) {
      items.push(`Ingreso registrado: ${toDateInputValue(selectedProducto.fecha_ingreso_producto)}`);
    }
    if (selectedProducto?.fecha_caducidad) {
      items.push(`Caducidad programada: ${toDateInputValue(selectedProducto.fecha_caducidad)}`);
    }
    items.push(`Stock actual: ${Number.parseInt(String(editForm?.cantidad ?? selectedProducto?.cantidad ?? '0'), 10) || 0}`);
    return items;
  }, [selectedProducto, editForm]);

  const drawerEstadoActivo = selectedProducto ? resolveEstadoActivo(selectedProducto) : true;
  const drawerImageSrc = getProductoImageSrc(selectedProducto);

  const renderCreateImageField = (className = 'col-12') => (
    <div className={className}>
      <label className="form-label mb-1">Imagen (opcional)</label>
      <div className={`inv-prod-image-field ${createImage.loading ? 'is-loading' : ''}`}>
        <div className={`inv-prod-image-preview ${createImage.previewUrl ? 'has-image' : ''}`} aria-live="polite">
          {createImage.loading ? (
            <div className="inv-prod-image-loading" role="status">
              <span className="spinner-border spinner-border-sm" aria-hidden="true" />
              <span>Cargando imagen...</span>
            </div>
          ) : createImage.previewUrl ? (
            <img src={createImage.previewUrl} alt="Vista previa del producto" onError={onCreatePreviewError} />
          ) : (
            <div className="inv-prod-image-placeholder">
              <i className="bi bi-image" />
              <span>Sin imagen seleccionada</span>
            </div>
          )}
        </div>

        <div className="inv-prod-image-actions">
          <label className="btn inv-prod-btn-subtle inv-prod-image-picker">
            <input type="file" accept="image/*" onChange={onCreateImageChange} />
            <i className="bi bi-upload" />
            <span>{createImage.previewUrl ? 'Cambiar imagen' : 'Seleccionar imagen'}</span>
          </label>

          <button
            type="button"
            className="btn inv-prod-btn-outline"
            onClick={clearCreateImage}
            disabled={!createImage.previewUrl && !createImage.error && !createImage.loading}
          >
            Quitar
          </button>
        </div>

        {createImage.error ? (
          <div className="inv-prod-image-feedback is-error">{createImage.error}</div>
        ) : (
          <div className="inv-prod-image-feedback">JPG, PNG o WEBP hasta 6 MB.</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="card shadow-sm mb-3 inv-prod-card">
      <div className="card-header inv-prod-header">
        <div className="inv-prod-title-wrap">
          <div className="inv-prod-title-row">
            <i className="bi bi-bag-check inv-prod-title-icon" />
            <span className="inv-prod-title">Productos</span>
          </div>
          <div className="inv-prod-subtitle">Gestión visual del catálogo con filtros y acciones en línea</div>
        </div>

        <div className="inv-prod-header-actions">
          <button
            type="button"
            className={`inv-prod-toolbar-btn ${filtersOpen ? 'is-on' : ''}`}
            onClick={() => setFiltersOpen((s) => !s)}
            aria-expanded={filtersOpen}
            aria-controls="inv-prod-filters"
          >
            <i className="bi bi-funnel" />
            <span>Filtros</span>
          </button>

          <button
            type="button"
            className={`inv-prod-toolbar-btn d-none d-md-inline-flex ${createPanelOpen ? 'is-on' : ''}`}
            onClick={() => setCreatePanelOpen((s) => !s)}
            aria-expanded={createPanelOpen}
            aria-controls="inv-prod-create-panel"
          >
            <i className="bi bi-plus-circle" />
            <span>Nuevo</span>
          </button>

          <button
            type="button"
            className="inv-prod-toolbar-btn d-md-none"
            onClick={() => setShowCreateProductoSheet(true)}
            aria-label="Abrir modal de crear producto"
          >
            <i className="bi bi-plus-circle" />
            <span>Nuevo</span>
          </button>
        </div>
      </div>

      <div className="inv-prod-kpis">
        <div className="inv-prod-kpi">
          <span>Total</span>
          <strong>{kpis.total}</strong>
        </div>
        <div className="inv-prod-kpi is-ok">
          <span>Con stock</span>
          <strong>{kpis.conStock}</strong>
        </div>
        <div className="inv-prod-kpi is-low">
          <span>Stock bajo</span>
          <strong>{kpis.stockBajo}</strong>
        </div>
        <div className="inv-prod-kpi is-empty">
          <span>Sin stock</span>
          <strong>{kpis.sinStock}</strong>
        </div>
      </div>

      <div className="card-body inv-prod-body">
        {error && <div className="alert alert-danger inv-prod-alert">{error}</div>}

        {/* FORM CREAR (SOLO DESKTOP/TABLET) */}
        <div
          id="inv-prod-create-panel"
          className={`inv-prod-create-wrap d-none d-md-block ${createPanelOpen ? 'open' : ''}`}
          aria-hidden={!createPanelOpen}
        >
          <div className="inv-prod-section-head inv-prod-panel-head">
            <div className="inv-prod-panel-eyebrow">Alta rápida</div>
            <div className="inv-prod-section-title">Registro de producto</div>
            <div className="inv-prod-section-sub">Completa los datos esenciales sin salir del catálogo</div>
          </div>

          <form onSubmit={onCrear} className="row g-2 mb-1 inv-prod-create-form">
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

            {renderCreateImageField('col-12 col-md-6')}

            <div className="col-12 col-md-6 inv-prod-create-actions-col">
              <div className="inv-prod-create-actions">
                <button className="btn inv-prod-btn-primary" type="submit" disabled={creating}>
                  {creating ? 'Creando...' : 'Crear'}
                </button>
                <button className="btn inv-prod-btn-subtle" type="button" onClick={resetForm} disabled={creating}>
                  Limpiar
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* FILTROS */}
        <div className="inv-prod-results-meta">
          <span>{loadingProductos ? 'Cargando productos...' : `${productosFiltrados.length} resultados`}</span>
          <span>{loadingProductos ? '' : `Mostrando ${rangoHasta} de ${productos.length}`}</span>
          {hasActiveFilters ? <span className="inv-prod-active-filter-pill">Filtros activos</span> : null}
        </div>

        <div id="inv-prod-filters" className={`inv-prod-filters ${filtersOpen ? 'open' : ''}`} aria-hidden={!filtersOpen}>
          <div className="inv-prod-panel-head inv-prod-filters-head">
            <div className="inv-prod-panel-eyebrow">Búsqueda avanzada</div>
            <div className="inv-prod-section-title">Filtros y orden del catálogo</div>
            <div className="inv-prod-section-sub">Refina resultados por stock, categoría, almacén y departamento</div>
          </div>

          <div className="row g-2 inv-prod-filters-grid">
            <div className="col-12 col-md-4">
              <input
                className="form-control"
                placeholder="Buscar productos…"
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

            <div className="col-12 col-md-2">
              <select className="form-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="recientes">Mas recientes</option>
                <option value="nombre_asc">Nombre A-Z</option>
                <option value="nombre_desc">Nombre Z-A</option>
                <option value="precio_desc">Precio mayor</option>
                <option value="precio_asc">Precio menor</option>
                <option value="stock_desc">Stock mayor</option>
                <option value="stock_asc">Stock menor</option>
              </select>
            </div>

            <div className="col-12 col-md-2 d-grid">
              <button
                className="btn btn-outline-secondary inv-prod-btn-subtle"
                type="button"
                onClick={resetFiltros}
              >
                Limpiar filtros
              </button>
            </div>
          </div>
        </div>

        <div className="inv-prod-catalog-zone">
          {loadingProductos ? (
            <div className="inv-prod-skeleton-grid" role="status" aria-live="polite">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div key={`sk-${idx}`} className="inv-prod-skeleton-card" />
              ))}
            </div>
          ) : productosPaginados.length === 0 ? (
            <div className="inv-prod-empty inv-prod-empty-rich">
              <i className={`bi ${hasActiveFilters ? 'bi-search' : 'bi-box-seam'}`} />
              <div className="inv-prod-empty-title">
                {hasActiveFilters
                  ? 'No encontramos productos con esos filtros.'
                  : 'Aún no hay productos. Haz clic en ‘Nuevo’ para crear el primero.'}
              </div>
            </div>
          ) : (
            <div className="inv-prod-catalog-shell">
              <div className="inv-prod-carousel-caption">Carrusel de productos</div>
              <div className="inv-prod-carousel-stage">
                <button
                  type="button"
                  className={`btn inv-prod-carousel-float is-prev ${carouselState.canPrev ? 'is-visible' : ''}`}
                  aria-label="Desplazar carrusel a la izquierda"
                  onClick={() => scrollCatalog('prev')}
                  disabled={!carouselState.canPrev}
                >
                  <i className="bi bi-chevron-left" />
                </button>

                <div className="inv-prod-catalog-grid inv-prod-catalog-carousel" ref={catalogCarouselRef}>
                {productosPaginados.map((p, index) => {
                  const estado = resolveEstadoProducto(p);
                  const stock = getStockMeta(p.cantidad);
                  const imgSrc = getProductoImageSrc(p);
                  const stockMin = Number.parseInt(String(p?.stock_minimo ?? 10), 10);
                  const ratioBase = stockMin > 0 ? stock.qty / (stockMin * 2) : stock.qty / 20;
                  const ratio = Math.max(0, Math.min(1, Number.isNaN(ratioBase) ? 0 : ratioBase));

                  return (
                    <article
                      key={p.id_producto}
                      className={`inv-prod-catalog-card ${Number(selectedProductoId) === Number(p.id_producto) && drawerOpen ? 'is-selected' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => abrirDrawerProducto(p)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          abrirDrawerProducto(p);
                        }
                      }}
                    >
                      <div className="inv-prod-thumb-wrap">
                        {imgSrc ? (
                          <img
                            src={imgSrc}
                            alt={p?.nombre_producto || 'Producto'}
                            className="inv-prod-thumb"
                            loading="lazy"
                            onError={() => markImageAsError(p?.id_producto)}
                          />
                        ) : (
                          <div className="inv-prod-thumb placeholder">
                            <i className="bi bi-image" />
                            <span>Sin imagen</span>
                          </div>
                        )}
                        <span className={`inv-prod-card-state ${estado.className}`}>{estado.label}</span>
                      </div>

                      <div className="inv-prod-card-body">
                        <div className="inv-prod-card-name">{p?.nombre_producto || 'Producto sin nombre'}</div>
                        <div className="inv-prod-card-category">{getCategoriaLabel(p?.id_categoria_producto)}</div>

                        <div className="inv-prod-card-metrics">
                          <div>
                            <div className="inv-prod-card-label">Precio</div>
                            <div className="inv-prod-card-value">{formatMoney(p?.precio)}</div>
                          </div>
                          <div>
                            <div className="inv-prod-card-label">Existencias</div>
                            <div className="inv-prod-card-value">{Number.parseInt(String(p?.cantidad ?? '0'), 10) || 0}</div>
                          </div>
                        </div>

                        <div className="inv-prod-stock-line">
                          <div className="inv-prod-stock-meta">
                            <div className="inv-prod-stock-ring" style={{ '--stock-ratio': ratio }} />
                            <div className="inv-prod-stock-copy">
                              <span>{stock.label}</span>
                              <small>Ítem #{index + 1}</small>
                            </div>
                          </div>

                          <button
                            type="button"
                            className="btn inv-prod-card-action danger inv-prod-card-action-compact"
                            onClick={(e) => {
                              e.stopPropagation();
                              openConfirmDelete(p?.id_producto, p?.nombre_producto);
                            }}
                            onKeyDown={(e) => e.stopPropagation()}
                            aria-label={`Eliminar ${p?.nombre_producto || 'producto'}`}
                            title="Eliminar producto"
                          >
                            <i className="bi bi-trash" />
                            <span className="inv-prod-card-action-label">Eliminar</span>
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
                </div>

                <button
                  type="button"
                  className={`btn inv-prod-carousel-float is-next ${carouselState.canNext ? 'is-visible' : ''}`}
                  aria-label="Desplazar carrusel a la derecha"
                  onClick={() => scrollCatalog('next')}
                  disabled={!carouselState.canNext}
                >
                  <i className="bi bi-chevron-right" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* MOBILE CARDS (LEGACY) */}
        {renderLegacyLayouts ? (
        <div className="d-none inv-prod-mobile-zone">
          {loadingProductos ? (
            <div className="inv-prod-loading" role="status" aria-live="polite">Cargando...</div>
          ) : productosPaginados.length === 0 ? (
            <div className="inv-prod-empty">Sin datos</div>
          ) : (
            <div className="d-flex flex-column gap-2 inv-prod-mobile-list">
              {productosPaginados.map((p, index) => {
                const isEditing = editId === p.id_producto;
                const stockMeta = getStockMeta(p.cantidad);

                return (
                  <div key={p.id_producto} className={`card border inv-prod-mobile-card ${isEditing ? 'is-editing' : ''}`}>
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div>
                          <div className="text-muted small">No. {(currentPage - 1) * pageSize + index + 1}</div>
                          <div className="fw-bold">{isEditing ? 'EDITANDO' : p.nombre_producto}</div>
                          <div className="text-muted small">
                            Categoría: <span className="fw-semibold">{getCategoriaLabel(p.id_categoria_producto)}</span> •
                            Stock: <span className="fw-semibold">{p.cantidad}</span>
                          </div>
                          <div className="text-muted small">
                            Almacén: <span className="fw-semibold">{getAlmacenLabel(p.id_almacen)}</span>
                          </div>
                        </div>

                        <span className={`inv-prod-stock-badge ${stockMeta.className}`}>{stockMeta.label}</span>
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
                            <div className="d-flex gap-2 mt-2 inv-prod-actions">
                              <button className="btn btn-sm btn-primary inv-prod-btn-primary" type="button" onClick={guardarEdicion} disabled={savingEdit}>
                                {savingEdit ? 'Guardando...' : 'Guardar'}
                              </button>
                              <button className="btn btn-sm btn-outline-secondary inv-prod-btn-subtle" type="button" onClick={cancelarEdicion} disabled={savingEdit}>
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <div className="d-flex gap-2 mt-2 inv-prod-actions">
                              <button className="btn btn-sm btn-outline-primary inv-prod-btn-outline" type="button" onClick={() => iniciarEdicion(p)}>
                                <i className="bi bi-pencil-square" /> Editar
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger inv-prod-btn-danger-lite"
                                type="button"
                                onClick={() => openConfirmDelete(p.id_producto, p.nombre_producto)}
                              >
                                <i className="bi bi-trash3" /> Eliminar
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
        ) : null}

        {/* DESKTOP TABLE (LEGACY) */}
        {renderLegacyLayouts ? (
        <div className="d-none inv-prod-table-zone">
          {loadingProductos ? (
            <div className="inv-prod-loading" role="status" aria-live="polite">Cargando...</div>
          ) : productosPaginados.length === 0 ? (
            <div className="inv-prod-empty">Sin datos</div>
          ) : (
            <div className="table-responsive inv-prod-table-wrap">
              <table className="table table-sm align-middle inv-prod-table">
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
                  {productosPaginados.map((p, index) => {
                    const isEditing = editId === p.id_producto;
                    const stockMeta = getStockMeta(p.cantidad);

                    return (
                      <tr key={p.id_producto} className={isEditing ? 'is-editing' : ''}>
                        <td className="text-muted">{(currentPage - 1) * pageSize + index + 1}</td>

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
                            <span className={`fw-semibold inv-prod-stock-inline ${stockMeta.className}`}>{p.cantidad}</span>
                          )}
                        </td>

                        <td>
                          {isEditing ? (
                            <div className="d-flex gap-2 inv-prod-actions">
                              <button className="btn btn-sm btn-primary inv-prod-btn-primary" type="button" onClick={guardarEdicion} disabled={savingEdit}>
                                {savingEdit ? 'Guardando...' : 'Guardar'}
                              </button>
                              <button className="btn btn-sm btn-outline-secondary inv-prod-btn-subtle" type="button" onClick={cancelarEdicion} disabled={savingEdit}>
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <div className="d-flex gap-2 inv-prod-actions">
                              <button className="btn btn-sm btn-outline-primary inv-prod-btn-outline" type="button" onClick={() => iniciarEdicion(p)}>
                                <i className="bi bi-pencil-square" /> Editar
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger inv-prod-btn-danger-lite"
                                type="button"
                                onClick={() => openConfirmDelete(p.id_producto, p.nombre_producto)}
                              >
                                <i className="bi bi-trash3" /> Eliminar
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
        ) : null}

        <div className={`inv-prod-drawer-backdrop ${drawerOpen ? 'show' : ''}`} onClick={cerrarDrawerProducto} />
        <aside className={`inv-prod-drawer ${drawerOpen ? 'show' : ''}`} aria-hidden={!drawerOpen}>
          {selectedProducto ? (
            <>
              <div className="inv-prod-drawer-head">
                <div>
                  <div className="inv-prod-drawer-title">{selectedProducto?.nombre_producto || 'Producto'}</div>
                  <div className="inv-prod-drawer-sub">{getCategoriaLabel(selectedProducto?.id_categoria_producto)}</div>
                </div>
                <button type="button" className="inv-prod-drawer-close" onClick={cerrarDrawerProducto} aria-label="Cerrar detalle">
                  <i className="bi bi-x-lg" />
                </button>
              </div>

              <div className="inv-prod-drawer-body">
                <div className="inv-prod-drawer-hero">
                  <div className={`inv-prod-drawer-image ${drawerImageSrc ? '' : 'placeholder'}`}>
                    {drawerImageSrc ? (
                      <img
                        src={drawerImageSrc}
                        alt={selectedProducto?.nombre_producto || 'Producto'}
                        onError={() => markImageAsError(selectedProducto?.id_producto)}
                      />
                    ) : (
                      <div className="inv-prod-drawer-image-empty">
                        <i className="bi bi-image" />
                        <span>Sin imagen</span>
                      </div>
                    )}
                  </div>

                  <div className="inv-prod-drawer-price">
                    <div className="inv-prod-drawer-price-main">{formatMoney(editForm?.precio ?? selectedProducto?.precio)}</div>
                    <div className="inv-prod-drawer-price-sub">
                      Costo: {formatMoney(selectedProducto?.costo ?? selectedProducto?.costo_producto ?? selectedProducto?.precio ?? 0)}
                    </div>
                    <span className={`inv-prod-drawer-status-pill ${drawerEstadoActivo ? 'is-active' : 'is-inactive'}`}>
                      {drawerEstadoActivo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </div>

                <div className="inv-prod-drawer-form">
                  <div>
                    <label>Nombre</label>
                    <input
                      type="text"
                      value={editForm?.nombre_producto ?? ''}
                      onChange={(e) => {
                        setDrawerEditMode(true);
                        setEditForm((s) => ({ ...s, nombre_producto: e.target.value }));
                      }}
                      disabled={!drawerEditMode}
                    />
                  </div>
                  <div>
                    <label>Precio (L.)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editForm?.precio ?? ''}
                      onChange={(e) => {
                        setDrawerEditMode(true);
                        setEditForm((s) => ({ ...s, precio: e.target.value }));
                      }}
                      disabled={!drawerEditMode}
                    />
                  </div>
                </div>

                <div className="inv-prod-drawer-grid">
                  <div>
                    <span>Existencias actuales</span>
                    <strong>{Number.parseInt(String(editForm?.cantidad ?? selectedProducto?.cantidad ?? '0'), 10) || 0}</strong>
                  </div>
                  <div>
                    <span>Stock minimo</span>
                    <strong>{Number.parseInt(String(selectedProducto?.stock_minimo ?? 10), 10) || 10}</strong>
                  </div>
                  <div>
                    <span>Unidad</span>
                    <strong>{selectedProducto?.unidad_medida || selectedProducto?.unidad || 'Unidad'}</strong>
                  </div>
                  <div>
                    <span>Almacen / sucursal</span>
                    <strong>{getAlmacenLabel(selectedProducto?.id_almacen)}</strong>
                  </div>
                </div>

                <div className="inv-prod-drawer-section">
                  <div className="inv-prod-drawer-section-title">Ajustar existencias</div>
                  <div className="inv-prod-stepper">
                    <button type="button" onClick={() => ajustarCantidadDrawer(-1)} aria-label="Disminuir existencia">
                      −
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={String(editForm?.cantidad ?? selectedProducto?.cantidad ?? '')}
                      onChange={(e) => onCantidadDrawerChange(e.target.value)}
                    />
                    <button type="button" onClick={() => ajustarCantidadDrawer(1)} aria-label="Aumentar existencia">
                      +
                    </button>
                  </div>
                </div>

                <div className="inv-prod-drawer-actions">
                  <button type="button" className="btn inv-prod-btn-outline" onClick={activarEdicionDrawer} disabled={togglingEstado}>Editar</button>
                  <button type="button" className="btn inv-prod-btn-subtle" onClick={duplicarProductoDesdeDrawer} disabled={togglingEstado}>Duplicar</button>
                  <button
                    type="button"
                    className={`btn ${drawerEstadoActivo ? 'inv-prod-btn-danger-lite' : 'inv-prod-btn-success-lite'}`}
                    onClick={toggleEstadoProductoDesdeDrawer}
                    disabled={togglingEstado}
                  >
                    {togglingEstado ? 'Procesando...' : drawerEstadoActivo ? 'Desactivar' : 'Activar'}
                  </button>
                  <button type="button" className="btn inv-prod-btn-primary" onClick={guardarDrawerCambios} disabled={savingEdit || togglingEstado}>
                    {savingEdit ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>

                {drawerMessage ? <div className="inv-prod-drawer-feedback">{drawerMessage}</div> : null}

                <div className="inv-prod-drawer-section">
                  <div className="inv-prod-drawer-section-title">Historial del producto</div>
                  <ul className="inv-prod-history-list">
                    {historialDrawer.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          ) : null}
        </aside>

        {/* ==============================
            SHEET CREAR PRODUCTO (MÓVIL CENTRADO)
            ============================== */}
        {showCreateProductoSheet && (
          <div
            className="modal fade show inv-prod-modal-backdrop"
            style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 2500 }}
            role="dialog"
            aria-modal="true"
            onClick={() => setShowCreateProductoSheet(false)}
          >
            <div className="modal-dialog modal-dialog-centered inv-prod-modal-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content shadow inv-prod-modal-content">
                <div className="modal-header d-flex align-items-center justify-content-between inv-prod-modal-header">
                  <div>
                    <div className="fw-semibold">Agregar producto</div>
                    <div className="small text-muted">Completa los campos y guarda</div>
                  </div>
                  <button type="button" className="btn btn-sm btn-light inv-prod-modal-close" onClick={() => setShowCreateProductoSheet(false)}>
                    <i className="bi bi-x-lg" />
                  </button>
                </div>

                <div className="modal-body inv-prod-modal-body">
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

                    {renderCreateImageField('col-12')}

                    <div className="col-12 d-grid gap-2 mt-2">
                      <button className="btn btn-primary inv-prod-btn-primary" type="submit" disabled={creating}>
                        {creating ? 'Guardando...' : 'Guardar'}
                      </button>
                      <button className="btn btn-outline-secondary inv-prod-btn-subtle" type="button" onClick={() => setShowCreateProductoSheet(false)} disabled={creating}>
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
            className="modal fade show inv-prod-modal-backdrop inv-prod-modal-backdrop-danger"
            style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 2600 }}
            role="dialog"
            aria-modal="true"
            onClick={closeConfirmDelete}
          >
            <div className="modal-dialog modal-dialog-centered inv-prod-modal-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content shadow inv-prod-modal-content inv-prod-delete-modal">
                <div className="modal-header d-flex align-items-center justify-content-between inv-prod-modal-header danger">
                  <div>
                    <div className="fw-semibold">Confirmar eliminación</div>
                    <div className="small text-muted">Esta acción no se puede deshacer</div>
                  </div>
                  <button type="button" className="btn btn-sm btn-light inv-prod-modal-close" onClick={closeConfirmDelete}>
                    <i className="bi bi-x-lg" />
                  </button>
                </div>

                <div className="modal-body inv-prod-modal-body">
                  <div className="mb-2">
                    ¿Deseas eliminar este producto?
                  </div>
                  {confirmModal.nombre && (
                    <div className="text-muted small inv-prod-delete-name">
                      <i className="bi bi-tag" />
                      <span className="fw-semibold">{confirmModal.nombre}</span>
                    </div>
                  )}
                </div>

                <div className="modal-footer d-flex gap-2 inv-prod-modal-footer">
                  <button className="btn btn-outline-secondary inv-prod-btn-subtle" type="button" onClick={closeConfirmDelete} disabled={deleting}>
                    Cancelar
                  </button>
                  <button className="btn btn-danger inv-prod-btn-danger" type="button" onClick={eliminarConfirmado} disabled={deleting}>
                    {deleting ? 'Eliminando...' : 'Eliminar'}
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



