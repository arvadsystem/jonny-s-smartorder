import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { inventarioService } from '../../../services/inventarioService';
import sucursalesService from '../../../services/sucursalesService';
import MovimientosTab from './MovimientosTab.jsx';

// NEW: normaliza el estado de sucursal para soportar booleans, strings y numericos.
// WHY: `sucursales` y `almacenes` pueden traer el estado en distintos formatos segun el origen.
// IMPACT: solo afecta labels/filtros; no modifica payloads ni persistencia.
const parseSucursalEstado = (value) => {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return Boolean(value);
};

const formatSucursalOptionLabel = (sucursal, id) => {
  const safeId = String(id ?? sucursal?.id_sucursal ?? '').trim();
  if (!safeId) return 'Sucursal sin ID';
  if (!sucursal) return `Sucursal ${safeId}`;

  const nombre = String(sucursal?.nombre_sucursal ?? '').trim() || `Sucursal ${safeId}`;
  return `${nombre}${parseSucursalEstado(sucursal?.estado) ? '' : ' (Inactiva)'}`;
};

const formatSucursalDisplayLabel = (sucursal, id) => {
  const safeId = String(id ?? '').trim();
  if (!safeId) return 'Sucursal sin ID';
  if (!sucursal) return `Sucursal ${safeId}`;

  const nombre = String(sucursal?.nombre_sucursal ?? '').trim() || `Sucursal ${safeId}`;
  return `${nombre}${parseSucursalEstado(sucursal?.estado) ? '' : ' (Inactiva)'}`;
};

const buildSucursalSelectOptions = ({ activeSucursales, sucursalesMap, selectedId }) => {
  const options = new Map();

  for (const sucursal of Array.isArray(activeSucursales) ? activeSucursales : []) {
    const id = String(sucursal?.id_sucursal ?? '').trim();
    if (!id) continue;

    options.set(id, {
      id,
      label: formatSucursalOptionLabel(sucursal, id),
      disabled: false
    });
  }

  const selectedKey = String(selectedId ?? '').trim();
  if (selectedKey && !options.has(selectedKey)) {
    options.set(selectedKey, {
      id: selectedKey,
      label: formatSucursalOptionLabel(sucursalesMap.get(selectedKey), selectedKey),
      disabled: true
    });
  }

  return Array.from(options.values()).sort((left, right) => Number(left.id) - Number(right.id));
};

// NEW: define el badge visible de estado usando el dato real disponible mas cercano (`sucursales.estado`).
// WHY: `almacenes` no tiene columna propia de estado y la UI requiere una senal operativa sin inventar campos.
// IMPACT: solo presentacion; el dato persistido sigue siendo `sucursal_estado`.
const getAlmacenStatusMeta = (almacen) => {
  const hasRealState = almacen?.sucursal_estado !== undefined && almacen?.sucursal_estado !== null;
  if (!hasRealState) {
    return { label: 'N/D', className: 'is-unknown', hint: 'Sin estado relacionado en BD' };
  }

  return parseSucursalEstado(almacen?.sucursal_estado)
    ? { label: 'ACTIVO', className: 'is-active', hint: 'Basado en la sucursal relacionada' }
    : { label: 'INACTIVO', className: 'is-inactive', hint: 'Basado en la sucursal relacionada' };
};

const formatMetricValue = (value) => {
  if (value === undefined || value === null || value === '') return 'N/D';
  const numeric = Number(value);
  return Number.isFinite(numeric) ? String(numeric) : String(value);
};

const AlmacenesTab = ({ openToast }) => {
  const [almacenes, setAlmacenes] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingSucursales, setLoadingSucursales] = useState(false);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [selectedAlmacenId, setSelectedAlmacenId] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState({ nombre: '', id_sucursal: '' });
  const [createErrors, setCreateErrors] = useState({});

  const [detailId, setDetailId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editErrors, setEditErrors] = useState({});

  const [confirmModal, setConfirmModal] = useState({
    show: false,
    idToDelete: null,
    nombre: ''
  });
  const [deletingConfirm, setDeletingConfirm] = useState(false);
  const [confirmDeleteError, setConfirmDeleteError] = useState('');

  const movimientosRef = useRef(null);
  const modalPortalTarget = typeof document !== 'undefined' ? document.body : null;
  const showEditModal = Boolean(editForm && editId !== null);

  const safeToast = (title, message, variant = 'success') => {
    if (typeof openToast === 'function') openToast(title, message, variant);
  };

  const sucursalesMap = useMemo(() => {
    const map = new Map();
    for (const sucursal of Array.isArray(sucursales) ? sucursales : []) {
      const key = String(sucursal?.id_sucursal ?? '').trim();
      if (!key) continue;
      map.set(key, sucursal);
    }
    return map;
  }, [sucursales]);

  const sucursalesActivas = useMemo(() => {
    return (Array.isArray(sucursales) ? [...sucursales] : [])
      .filter((sucursal) => parseSucursalEstado(sucursal?.estado))
      .sort((left, right) => Number(left?.id_sucursal ?? 0) - Number(right?.id_sucursal ?? 0));
  }, [sucursales]);

  const createSucursalOptions = useMemo(
    () =>
      buildSucursalSelectOptions({
        activeSucursales: sucursalesActivas,
        sucursalesMap,
        selectedId: form.id_sucursal
      }),
    [form.id_sucursal, sucursalesActivas, sucursalesMap]
  );

  const editSucursalOptions = useMemo(
    () =>
      buildSucursalSelectOptions({
        activeSucursales: sucursalesActivas,
        sucursalesMap,
        selectedId: editForm?.id_sucursal
      }),
    [editForm?.id_sucursal, sucursalesActivas, sucursalesMap]
  );

  const canCreateWithCatalog = createSucursalOptions.length > 0 || loadingSucursales;
  const canEditWithCatalog = editSucursalOptions.length > 0 || loadingSucursales;

  const editHasLegacySelected =
    !!editForm &&
    !loadingSucursales &&
    editSucursalOptions.some(
      (option) => option.id === String(editForm?.id_sucursal ?? '').trim() && option.disabled === true
    );

  const validarAlmacen = (data, { allowLegacyId = null } = {}) => {
    const errors = {};
    const nombre = String(data?.nombre ?? '').trim();
    const sucRaw = String(data?.id_sucursal ?? '').trim();
    const id_sucursal = Number.parseInt(sucRaw, 10);

    if (nombre.length < 2) errors.nombre = 'MINIMO 2 CARACTERES';
    else if (nombre.length > 80) errors.nombre = 'MAXIMO 80 CARACTERES';

    if (!sucRaw) {
      errors.id_sucursal = 'LA SUCURSAL ES OBLIGATORIA';
    } else if (!/^\d+$/.test(sucRaw)) {
      errors.id_sucursal = 'SELECCIONA UNA SUCURSAL VALIDA';
    } else if (Number.isNaN(id_sucursal) || id_sucursal <= 0) {
      errors.id_sucursal = 'SELECCIONA UNA SUCURSAL VALIDA';
    } else {
      const selectedKey = String(id_sucursal);
      const legacyKey = String(allowLegacyId ?? '').trim();
      const sucursal = sucursalesMap.get(selectedKey);
      const legacyAllowed = legacyKey !== '' && legacyKey === selectedKey;

      if (!sucursal && !legacyAllowed) {
        errors.id_sucursal = 'LA SUCURSAL SELECCIONADA NO EXISTE EN EL CATALOGO';
      } else if (sucursal && !parseSucursalEstado(sucursal?.estado) && !legacyAllowed) {
        errors.id_sucursal = 'LA SUCURSAL SELECCIONADA ESTA INACTIVA';
      }
    }

    return {
      ok: Object.keys(errors).length === 0,
      errors,
      cleaned: { nombre, id_sucursal }
    };
  };

  const cargarCatalogos = async () => {
    setLoading(true);
    setLoadingSucursales(true);
    setError('');

    try {
      const [almacenesData, sucursalesData] = await Promise.all([
        inventarioService.getAlmacenes(),
        sucursalesService.getAll()
      ]);

      setAlmacenes(Array.isArray(almacenesData) ? almacenesData : []);
      setSucursales(Array.isArray(sucursalesData) ? sucursalesData : []);
    } catch (fetchError) {
      const message = fetchError?.message || 'ERROR CARGANDO ALMACENES';
      setError(message);
      safeToast('ERROR', message, 'danger');
    } finally {
      setLoading(false);
      setLoadingSucursales(false);
    }
  };

  const cargarAlmacenes = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await inventarioService.getAlmacenes();
      setAlmacenes(Array.isArray(data) ? data : []);
    } catch (fetchError) {
      const message = fetchError?.message || 'ERROR CARGANDO ALMACENES';
      setError(message);
      safeToast('ERROR', message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarCatalogos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // NEW: bloquea el scroll del body mientras un modal premium de Almacenes esta abierto.
    // WHY: el shell overlay de Inventario necesita aislar la interaccion y evitar scroll del fondo.
    // IMPACT: solo UX temporal; no altera formularios ni requests.
    if (typeof document === 'undefined') return undefined;
    if (!showCreateModal && !showEditModal) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showCreateModal, showEditModal]);

  const resetCreateForm = () => {
    // AJUSTE: el alta debe obligar a elegir la sucursal manualmente.
    // IMPACT: solo cambia el valor inicial del select; validacion y persistencia siguen iguales.
    setForm({ nombre: '', id_sucursal: '' });
    setCreateErrors({});
  };

  const openCreate = () => {
    resetCreateForm();
    setShowCreateModal(true);
  };

  const closeCreate = () => {
    setShowCreateModal(false);
    resetCreateForm();
  };

  const onCrear = async (event) => {
    event.preventDefault();
    setError('');

    const validation = validarAlmacen(form);
    setCreateErrors(validation.errors);
    if (!validation.ok) return;

    try {
      await inventarioService.crearAlmacen({
        nombre: validation.cleaned.nombre,
        id_sucursal: validation.cleaned.id_sucursal
      });

      closeCreate();
      await cargarAlmacenes();
      safeToast('CREADO', 'EL ALMACEN SE CREO CORRECTAMENTE.', 'success');
    } catch (requestError) {
      const message = requestError?.message || 'ERROR CREANDO ALMACEN';
      setError(message);
      safeToast('ERROR', message, 'danger');
    }
  };

  const iniciarEdicion = (almacen) => {
    setDetailId(null);
    setEditErrors({});
    setEditId(almacen?.id_almacen ?? null);
    setEditForm({
      nombre: almacen?.nombre ?? '',
      id_sucursal: String(almacen?.id_sucursal ?? '')
    });
  };

  const cancelarEdicion = () => {
    setEditId(null);
    setEditForm(null);
    setEditErrors({});
  };

  const guardarEdicion = async (event) => {
    event.preventDefault();
    if (editId === null || !editForm) return;

    const actual = almacenes.find((item) => Number(item?.id_almacen ?? 0) === Number(editId ?? 0));
    if (!actual) {
      safeToast('ERROR', 'NO SE ENCONTRO EL ALMACEN A EDITAR.', 'danger');
      cancelarEdicion();
      return;
    }

    const validation = validarAlmacen(editForm, { allowLegacyId: actual?.id_sucursal });
    setEditErrors(validation.errors);
    if (!validation.ok) return;

    try {
      const cambios = [];
      const nombreActual = String(actual?.nombre ?? '').trim();
      const sucursalActual = Number.parseInt(String(actual?.id_sucursal ?? ''), 10);

      if (validation.cleaned.nombre !== nombreActual) cambios.push(['nombre', validation.cleaned.nombre]);
      if (!Number.isNaN(validation.cleaned.id_sucursal) && validation.cleaned.id_sucursal !== sucursalActual) {
        cambios.push(['id_sucursal', validation.cleaned.id_sucursal]);
      }

      if (!cambios.length) {
        safeToast('SIN CAMBIOS', 'NO HAY CAMBIOS PARA GUARDAR.', 'info');
        cancelarEdicion();
        return;
      }

      for (const [campo, valor] of cambios) {
        await inventarioService.actualizarAlmacenCampo(editId, campo, valor);
      }

      cancelarEdicion();
      await cargarAlmacenes();
      safeToast('ACTUALIZADO', 'EL ALMACEN SE ACTUALIZO CORRECTAMENTE.', 'success');
    } catch (requestError) {
      const message = requestError?.message || 'ERROR ACTUALIZANDO ALMACEN';
      setError(message);
      safeToast('ERROR', message, 'danger');
    }
  };

  const openConfirmDelete = (id, nombre) => {
    setConfirmDeleteError('');
    setConfirmModal({ show: true, idToDelete: id, nombre: nombre || '' });
  };

  const closeConfirmDelete = () => {
    if (deletingConfirm) return;
    setConfirmDeleteError('');
    setConfirmModal({ show: false, idToDelete: null, nombre: '' });
  };

  const eliminarConfirmado = async () => {
    const id = confirmModal.idToDelete;
    if (!id || deletingConfirm) return;

    setDeletingConfirm(true);
    setConfirmDeleteError('');

    try {
      await inventarioService.eliminarAlmacen(id);
      if (Number(detailId ?? 0) === Number(id)) setDetailId(null);
      if (Number(editId ?? 0) === Number(id)) cancelarEdicion();
      await cargarAlmacenes();
      setDeletingConfirm(false);
      setConfirmModal({ show: false, idToDelete: null, nombre: '' });
      safeToast('ELIMINADO', 'EL ALMACEN SE ELIMINO CORRECTAMENTE.', 'success');
    } catch (requestError) {
      const message = requestError?.message || 'ERROR ELIMINANDO ALMACEN';
      setDeletingConfirm(false);
      setConfirmDeleteError(message);
      setError(message);
      safeToast('ERROR', message, 'danger');
    }
  };

  const scrollToMovimientos = () => {
    movimientosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const selectAlmacenCard = (almacen) => {
    if (!almacen?.id_almacen) return;
    setSelectedAlmacenId(String(almacen.id_almacen));
  };

  const handleMovimientoCreado = async () => {
    await cargarAlmacenes();
  };

  const almacenesFiltrados = useMemo(() => {
    const safeSearch = search.trim().toLowerCase();

    // NEW: las cards superiores muestran todos los almacenes existentes y solo respetan la busqueda textual.
    // WHY: la seleccion del almacen ahora se hace desde la card y ese estado gobierna el resumen/listado inferior.
    // IMPACT: el filtro por sucursal se conserva para movimientos, pero deja de ocultar almacenes en la cabecera visual.
    return (Array.isArray(almacenes) ? [...almacenes] : [])
      .sort((left, right) => Number(left?.id_almacen ?? 0) - Number(right?.id_almacen ?? 0))
      .filter((almacen) => {
        const texto = `${almacen?.nombre ?? ''} ${formatSucursalDisplayLabel(
          sucursalesMap.get(String(almacen?.id_sucursal ?? '').trim()),
          almacen?.id_sucursal
        )}`.toLowerCase();

        return safeSearch ? texto.includes(safeSearch) : true;
      });
  }, [almacenes, search, sucursalesMap]);

  useEffect(() => {
    if (!almacenesFiltrados.length) {
      setSelectedAlmacenId('');
      return;
    }

    if (!selectedAlmacenId) {
      setSelectedAlmacenId(String(almacenesFiltrados[0].id_almacen));
      return;
    }

    if (
      !almacenesFiltrados.some((almacen) => String(almacen?.id_almacen ?? '') === String(selectedAlmacenId))
    ) {
      setSelectedAlmacenId(String(almacenesFiltrados[0].id_almacen));
    }
  }, [almacenesFiltrados, selectedAlmacenId]);

  const detailAlmacen = useMemo(() => {
    const safeId = Number(detailId ?? 0);
    if (!safeId) return null;
    return almacenes.find((almacen) => Number(almacen?.id_almacen ?? 0) === safeId) || null;
  }, [almacenes, detailId]);

  const confirmAlmacen = useMemo(() => {
    const safeId = Number(confirmModal.idToDelete ?? 0);
    if (!safeId) return null;
    return almacenes.find((almacen) => Number(almacen?.id_almacen ?? 0) === safeId) || null;
  }, [almacenes, confirmModal.idToDelete]);

  const detailStatusMeta = useMemo(() => getAlmacenStatusMeta(detailAlmacen), [detailAlmacen]);

  const detailMetrics = useMemo(() => {
    if (!detailAlmacen) return [];

    return [
      {
        key: 'sucursal',
        label: 'Sucursal',
        icon: 'bi bi-shop',
        value: formatSucursalDisplayLabel(
          sucursalesMap.get(String(detailAlmacen?.id_sucursal ?? '').trim()),
          detailAlmacen?.id_sucursal
        )
      },
      { key: 'estado', label: 'Estado', icon: 'bi bi-shield-check', value: detailStatusMeta.label },
      { key: 'total', label: 'Total items', icon: 'bi bi-box-seam', value: formatMetricValue(detailAlmacen?.total_items) },
      { key: 'alertas', label: 'Alertas stock', icon: 'bi bi-exclamation-triangle', value: formatMetricValue(detailAlmacen?.alertas_stock) },
      { key: 'movs', label: 'Movimientos hoy', icon: 'bi bi-arrow-left-right', value: formatMetricValue(detailAlmacen?.movimientos_hoy) },
      { key: 'entradas', label: 'Entradas hoy', icon: 'bi bi-arrow-down-left', value: formatMetricValue(detailAlmacen?.entradas_hoy) },
      { key: 'salidas', label: 'Salidas hoy', icon: 'bi bi-arrow-up-right', value: formatMetricValue(detailAlmacen?.salidas_hoy) },
      { key: 'ajustes', label: 'Ajustes hoy', icon: 'bi bi-sliders', value: formatMetricValue(detailAlmacen?.ajustes_hoy) }
    ];
  }, [detailAlmacen, detailStatusMeta.label, sucursalesMap]);

  const createHeroSucursalLabel = useMemo(() => {
    if (!form.id_sucursal) return 'Selecciona una sucursal';
    return formatSucursalOptionLabel(sucursalesMap.get(String(form.id_sucursal).trim()), form.id_sucursal);
  }, [form.id_sucursal, sucursalesMap]);

  const editHeroSucursalLabel = useMemo(() => {
    if (!editForm?.id_sucursal) return 'Selecciona una sucursal';
    return formatSucursalOptionLabel(sucursalesMap.get(String(editForm.id_sucursal).trim()), editForm.id_sucursal);
  }, [editForm?.id_sucursal, sucursalesMap]);

  const centeredGridClass =
    !loading && almacenesFiltrados.length > 0 && almacenesFiltrados.length < 3 ? 'is-centered' : '';

  const cardsContent = loading ? (
    <div className={`inv-warehouse-grid ${centeredGridClass}`.trim()}>
      {[1, 2, 3].map((skeleton) => (
        <div key={skeleton} className="inv-warehouse-card inv-warehouse-card--skeleton" aria-hidden="true" />
      ))}
    </div>
  ) : almacenesFiltrados.length === 0 ? (
    <div className="inv-warehouse-empty">
      <i className="bi bi-inbox" aria-hidden="true" />
      <div className="mt-2">No hay almacenes para la busqueda actual.</div>
    </div>
  ) : (
    <div className={`inv-warehouse-grid ${centeredGridClass}`.trim()}>
      {almacenesFiltrados.map((almacen, index) => {
        const statusMeta = getAlmacenStatusMeta(almacen);
        const isSelected = String(selectedAlmacenId ?? '') === String(almacen?.id_almacen ?? '');
        const highlights = [
          {
            key: 'items',
            label: 'Total items',
            icon: 'bi bi-box-seam',
            value: formatMetricValue(almacen?.total_items),
            tone: ''
          },
          {
            key: 'alertas',
            label: 'Alertas stock',
            icon: 'bi bi-exclamation-diamond',
            value: formatMetricValue(almacen?.alertas_stock),
            tone: Number(almacen?.alertas_stock ?? 0) > 0 ? 'is-alert' : ''
          },
          {
            key: 'movs',
            label: 'Movs. hoy',
            icon: 'bi bi-arrow-left-right',
            value: formatMetricValue(almacen?.movimientos_hoy),
            tone: ''
          }
        ];

        return (
          <article
            key={almacen.id_almacen}
            className={`inv-warehouse-card inv-anim-in ${isSelected ? 'is-selected' : ''} ${
              Number(almacen?.alertas_stock ?? 0) > 0 ? 'has-alerts' : ''
            }`.trim()}
            role="button"
            tabIndex={0}
            style={{ animationDelay: `${Math.min(index * 40, 240)}ms` }}
            onClick={() => selectAlmacenCard(almacen)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                selectAlmacenCard(almacen);
              }
            }}
          >
            <div className="inv-warehouse-card__halo" aria-hidden="true">
              <i className="bi bi-building" />
            </div>

            <div className="inv-warehouse-card__header">
              <div className="inv-warehouse-card__title-wrap">
                <span className="inv-warehouse-card__icon" aria-hidden="true">
                  <i className="bi bi-building-fill" />
                </span>
                <div>
                  <div className="inv-warehouse-card__name">{almacen.nombre || `Almacen ${almacen.id_almacen}`}</div>
                  <div className="inv-warehouse-card__branch">
                    <i className="bi bi-shop" aria-hidden="true" />
                    <span>
                      {formatSucursalDisplayLabel(
                        sucursalesMap.get(String(almacen?.id_sucursal ?? '').trim()),
                        almacen?.id_sucursal
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <span className={`inv-warehouse-card__status ${statusMeta.className}`} title={statusMeta.hint}>
                {statusMeta.label}
              </span>
            </div>

            <div className="inv-warehouse-card__body">
              {highlights.map((item) => (
                <div key={item.key} className={`inv-warehouse-card__fact ${item.tone}`.trim()}>
                  <span className="inv-warehouse-card__fact-icon" aria-hidden="true">
                    <i className={item.icon} />
                  </span>
                  <div className="inv-warehouse-card__fact-copy">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                </div>
              ))}
            </div>

            <div className="inv-warehouse-card__meta">
              <span className="inv-warehouse-card__meta-pill">
                <i className="bi bi-arrow-down-left" aria-hidden="true" />
                <span>Entradas</span>
                <strong>{formatMetricValue(almacen?.entradas_hoy)}</strong>
              </span>
              <span className="inv-warehouse-card__meta-pill">
                <i className="bi bi-sliders" aria-hidden="true" />
                <span>Ajustes</span>
                <strong>{formatMetricValue(almacen?.ajustes_hoy)}</strong>
              </span>
              <span className="inv-warehouse-card__meta-pill">
                <i className="bi bi-arrow-up-right" aria-hidden="true" />
                <span>Salidas</span>
                <strong>{formatMetricValue(almacen?.salidas_hoy)}</strong>
              </span>
            </div>

            <div className="inv-warehouse-card__footer">
              <div className="inv-warehouse-card__actions">
                <button
                  type="button"
                  className="btn inv-prod-btn-subtle inv-warehouse-card__action"
                  onClick={(event) => {
                    event.stopPropagation();
                    iniciarEdicion(almacen);
                  }}
                  title="Editar"
                  disabled={deletingConfirm}
                >
                  <i className="bi bi-pencil-square" />
                  <span>Editar</span>
                </button>

                <button
                  type="button"
                  className="btn inv-prod-btn-danger-lite inv-warehouse-card__action"
                  onClick={(event) => {
                    event.stopPropagation();
                    openConfirmDelete(almacen.id_almacen, almacen.nombre);
                  }}
                  title="Eliminar"
                  disabled={deletingConfirm}
                >
                  <i className="bi bi-trash" />
                  <span>Eliminar</span>
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );

  const createModal =
    modalPortalTarget && showCreateModal
      ? createPortal(
          <div className="inv-prod-pmodal inv-prod-pmodal--create show" aria-hidden={!showCreateModal}>
            <div className="inv-prod-pmodal__overlay" onClick={closeCreate} />
            <div className="inv-prod-pmodal__viewport">
              <div
                className="inv-prod-pmodal__panel inv-prod-pmodal__panel--create"
                role="dialog"
                aria-modal="true"
                aria-labelledby="inv-warehouse-create-title"
                onClick={(event) => event.stopPropagation()}
              >
                <form onSubmit={onCrear} className="inv-prod-pmodal__form-shell inv-prod-pmodal__form-shell--create">
                  <div className="inv-prod-pmodal__body">
                    <div className="inv-ins-create-hero is-create">
                      <button
                        type="button"
                        className="inv-prod-drawer-close inv-ins-create-hero__close"
                        onClick={closeCreate}
                        aria-label="Cerrar alta de almacen"
                      >
                        <i className="bi bi-x-lg" aria-hidden="true" />
                      </button>

                      <div className="inv-ins-create-hero__icon">
                        <i className="bi bi-building-add" aria-hidden="true" />
                      </div>

                      <div className="inv-ins-create-hero__copy">
                        <div className="inv-ins-create-hero__kicker">Nuevo Registro</div>
                        <div id="inv-warehouse-create-title" className="inv-ins-create-hero__title">
                          Alta rapida de almacen
                        </div>
                        <div className="inv-ins-create-hero__text">
                          Registra la ubicacion base y dejala lista para recibir movimientos desde el mismo modulo.
                        </div>
                      </div>

                      <div className="inv-ins-create-hero__chips">
                        <span className="inv-ins-create-hero__chip">
                          <i className="bi bi-shop" aria-hidden="true" /> {createHeroSucursalLabel}
                        </span>
                        <span className="inv-ins-create-hero__chip">
                          <i className="bi bi-box-seam" aria-hidden="true" /> Kardex habilitado
                        </span>
                      </div>
                    </div>

                    <div className="inv-prod-pmodal__sections">
                      <section className="inv-prod-pmodal__section">
                        <div className="inv-prod-pmodal__section-head">
                          <div className="inv-prod-pmodal__section-title">Datos principales</div>
                          <div className="inv-prod-pmodal__section-sub">
                            Nombre y sucursal real del almacen segun el catalogo activo.
                          </div>
                        </div>

                        <div className="row g-3">
                          <div className="col-12">
                            <label className="form-label mb-1">Nombre del almacen</label>
                            <input
                              className={`form-control ${createErrors.nombre ? 'is-invalid' : ''}`}
                              value={form.nombre}
                              onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))}
                              placeholder="Ej: Bodega Norte"
                            />
                            {createErrors.nombre ? <div className="invalid-feedback">{createErrors.nombre}</div> : null}
                          </div>

                          <div className="col-12">
                            <label className="form-label mb-1">Sucursal</label>
                            <select
                              className={`form-select ${createErrors.id_sucursal ? 'is-invalid' : ''}`}
                              value={form.id_sucursal}
                              onChange={(event) =>
                                setForm((current) => ({ ...current, id_sucursal: event.target.value }))
                              }
                              disabled={!canCreateWithCatalog}
                            >
                              <option value="">{loadingSucursales ? 'Cargando sucursales...' : 'Seleccione una sucursal'}</option>
                              {createSucursalOptions.map((option) => (
                                <option key={option.id} value={option.id} disabled={option.disabled}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            {createErrors.id_sucursal ? (
                              <div className="invalid-feedback">{createErrors.id_sucursal}</div>
                            ) : null}
                          </div>
                        </div>
                      </section>
                    </div>
                  </div>

                  <div className="inv-prod-pmodal__footer inv-prod-pmodal__footer--create">
                    <button type="button" className="btn inv-prod-btn-subtle" onClick={resetCreateForm}>
                      Limpiar
                    </button>
                    <button type="button" className="btn inv-prod-btn-outline" onClick={closeCreate}>
                      Cancelar
                    </button>
                    <button type="submit" className="btn inv-prod-btn-primary" disabled={!canCreateWithCatalog}>
                      Guardar
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>,
          modalPortalTarget
        )
      : null;

  const detailModal = detailAlmacen ? (
    <div
      className="modal fade show"
      style={{ display: 'block', backgroundColor: 'rgba(17, 8, 10, 0.55)', zIndex: 2600 }}
      role="dialog"
      aria-modal="true"
      onClick={() => setDetailId(null)}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg" onClick={(event) => event.stopPropagation()}>
        <div className="modal-content shadow inv-warehouse-detail-modal__body">
          <div className="modal-body">
            <div className="inv-warehouse-detail-modal__hero">
              <div className="inv-warehouse-detail-modal__hero-main">
                <p className="inv-warehouse-detail-modal__eyebrow">Detalle de almacen</p>
                <strong>{detailAlmacen.nombre || `Almacen ${detailAlmacen.id_almacen}`}</strong>
                <p>
                  {formatSucursalDisplayLabel(
                    sucursalesMap.get(String(detailAlmacen?.id_sucursal ?? '').trim()),
                    detailAlmacen?.id_sucursal
                  )}
                </p>
              </div>
              <span className={`inv-warehouse-card__status ${detailStatusMeta.className}`}>{detailStatusMeta.label}</span>
            </div>

            <div className="inv-warehouse-detail-modal__grid mt-3">
              {detailMetrics.map((metric) => (
                <div key={metric.key} className="inv-warehouse-detail-modal__card">
                  <div className="inv-warehouse-detail-modal__card-head">
                    <i className={metric.icon} aria-hidden="true" />
                    <span>{metric.label}</span>
                  </div>
                  <strong>{metric.value}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="modal-footer inv-warehouse-detail-modal__footer">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => {
                if (!detailAlmacen?.id_almacen) return;
                setSelectedAlmacenId(String(detailAlmacen.id_almacen));
                window.setTimeout(scrollToMovimientos, 80);
              }}
            >
              Ver Kardex
            </button>
            <button type="button" className="btn btn-light" onClick={() => iniciarEdicion(detailAlmacen)}>
              Editar
            </button>
            <button
              type="button"
              className="btn btn-outline-danger"
              onClick={() => openConfirmDelete(detailAlmacen.id_almacen, detailAlmacen.nombre)}
            >
              Eliminar
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setDetailId(null)}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  const editModal =
    modalPortalTarget && showEditModal
      ? createPortal(
          <div className="inv-prod-pmodal inv-prod-pmodal--create show" aria-hidden={!showEditModal}>
            <div className="inv-prod-pmodal__overlay" onClick={cancelarEdicion} />
            <div className="inv-prod-pmodal__viewport">
              <div
                className="inv-prod-pmodal__panel inv-prod-pmodal__panel--create"
                role="dialog"
                aria-modal="true"
                aria-labelledby="inv-warehouse-edit-title"
                onClick={(event) => event.stopPropagation()}
              >
                <form onSubmit={guardarEdicion} className="inv-prod-pmodal__form-shell inv-prod-pmodal__form-shell--create">
                  <div className="inv-prod-pmodal__body">
                    <div className="inv-ins-create-hero is-edit">
                      <button
                        type="button"
                        className="inv-prod-drawer-close inv-ins-create-hero__close"
                        onClick={cancelarEdicion}
                        aria-label="Cerrar edicion de almacen"
                      >
                        <i className="bi bi-x-lg" aria-hidden="true" />
                      </button>

                      <div className="inv-ins-create-hero__icon">
                        <i className="bi bi-building-gear" aria-hidden="true" />
                      </div>

                      <div className="inv-ins-create-hero__copy">
                        <div className="inv-ins-create-hero__kicker">Edicion Activa</div>
                        <div id="inv-warehouse-edit-title" className="inv-ins-create-hero__title">
                          Actualiza Tu Almacen
                        </div>
                      </div>

                      <div className="inv-ins-create-hero__chips">
                        <span className="inv-ins-create-hero__chip">
                          <i className="bi bi-shop" aria-hidden="true" /> {editHeroSucursalLabel}
                        </span>
                        <span className="inv-ins-create-hero__chip">
                          <i className="bi bi-shield-check" aria-hidden="true" /> Kardex operativo
                        </span>
                      </div>
                    </div>

                    <div className="inv-prod-pmodal__sections">
                      <section className="inv-prod-pmodal__section">
                        <div className="inv-prod-pmodal__section-head">
                          <div className="inv-prod-pmodal__section-title">Datos principales</div>
                          <div className="inv-prod-pmodal__section-sub">
                            Ajusta nombre y sucursal respetando el catalogo operativo actual.
                          </div>
                        </div>

                        <div className="row g-3">
                          <div className="col-12">
                            <label className="form-label mb-1">Nombre del almacen</label>
                            <input
                              className={`form-control ${editErrors.nombre ? 'is-invalid' : ''}`}
                              value={editForm.nombre}
                              onChange={(event) => setEditForm((current) => ({ ...current, nombre: event.target.value }))}
                              placeholder="Ej: Bodega Norte"
                            />
                            {editErrors.nombre ? <div className="invalid-feedback">{editErrors.nombre}</div> : null}
                          </div>

                          <div className="col-12">
                            <label className="form-label mb-1">Sucursal</label>
                            <select
                              className={`form-select ${editErrors.id_sucursal ? 'is-invalid' : ''}`}
                              value={editForm.id_sucursal}
                              onChange={(event) =>
                                setEditForm((current) => ({ ...current, id_sucursal: event.target.value }))
                              }
                              disabled={!canEditWithCatalog}
                            >
                              <option value="">
                                {loadingSucursales ? 'Cargando sucursales...' : 'Seleccione una sucursal'}
                              </option>
                              {editSucursalOptions.map((option) => (
                                <option key={option.id} value={option.id} disabled={option.disabled}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            {editErrors.id_sucursal ? <div className="invalid-feedback">{editErrors.id_sucursal}</div> : null}
                            {editHasLegacySelected ? (
                              <div className="form-text">
                                La sucursal actual esta fuera del catalogo activo, pero puede conservarse.
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </section>
                    </div>
                  </div>

                  <div className="inv-prod-pmodal__footer inv-prod-pmodal__footer--create">
                    <button type="button" className="btn inv-prod-btn-outline" onClick={cancelarEdicion}>
                      Cancelar
                    </button>
                    <button type="submit" className="btn inv-prod-btn-primary">
                      Guardar cambios
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>,
          modalPortalTarget
        )
      : null;

  const confirmDeleteModal = confirmModal.show ? (
    <div className="inv-pro-confirm-backdrop" role="dialog" aria-modal="true" onClick={closeConfirmDelete}>
      <div className="inv-pro-confirm-panel inv-pro-confirm-panel--danger" onClick={(event) => event.stopPropagation()}>
        <div className="inv-pro-confirm-glow" aria-hidden="true" />

        <div className="inv-pro-confirm-head">
          <div className="inv-pro-confirm-head-main">
            <div className="inv-pro-confirm-head-icon">
              <i className="bi bi-trash3" aria-hidden="true" />
            </div>
            <div className="inv-pro-confirm-head-copy">
              <div className="inv-pro-confirm-kicker">Almacenes</div>
              <div className="inv-pro-confirm-title">Confirmar eliminacion</div>
              <div className="inv-pro-confirm-sub">Esta accion es permanente y afecta el tablero actual.</div>
            </div>
          </div>
          <button
            type="button"
            className="inv-pro-confirm-close"
            onClick={closeConfirmDelete}
            aria-label="Cerrar"
            disabled={deletingConfirm}
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="inv-pro-confirm-body">
          <div className="inv-pro-confirm-note">
            <i className="bi bi-shield-exclamation" aria-hidden="true" />
            <span>El almacen dejara de estar disponible para consulta y para registrar nuevos movimientos.</span>
          </div>

          <div className="inv-pro-confirm-question">Deseas eliminar este almacen?</div>

          <div className="inv-pro-confirm-name">
            <div className="inv-pro-confirm-name-label">Registro seleccionado</div>
            <div className="inv-pro-confirm-name-value">
              <i className="bi bi-building-fill-gear" aria-hidden="true" />
              <span>{confirmModal.nombre || confirmAlmacen?.nombre || 'Almacen seleccionado'}</span>
            </div>
          </div>

          {confirmDeleteError ? (
            <div className="alert alert-danger inv-pro-confirm-error mb-0" role="alert">
              {confirmDeleteError}
            </div>
          ) : null}
        </div>

        <div className="inv-pro-confirm-footer">
          <button type="button" className="btn inv-pro-btn-cancel" onClick={closeConfirmDelete} disabled={deletingConfirm}>
            Cancelar
          </button>
          <button type="button" className="btn inv-pro-btn-danger" onClick={eliminarConfirmado} disabled={deletingConfirm}>
            <i className={`bi ${deletingConfirm ? 'bi-hourglass-split' : 'bi-trash3'}`} aria-hidden="true" />
            <span>{deletingConfirm ? 'Eliminando...' : 'Eliminar'}</span>
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div className="card shadow-sm mb-3 inv-prod-card inv-ins-module inv-has-sticky-header inv-warehouse-module">
        <div className="card-header inv-prod-header">
          <div className="inv-prod-title-wrap">
            <div className="inv-prod-title-row">
              <i className="bi bi-building inv-prod-title-icon" aria-hidden="true" />
              <span className="inv-prod-title">Almacenes</span>
            </div>
            <div className="inv-prod-subtitle">Gestion visual de almacenes y kardex por sucursal</div>
          </div>

          <div className="inv-prod-header-actions">
            <label className="inv-ins-search inv-prod-header-search" aria-label="Buscar almacenes">
              <i className="bi bi-search" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar almacen..."
              />
            </label>
            <button type="button" className="inv-prod-toolbar-btn" onClick={openCreate} disabled={!canCreateWithCatalog}>
              <i className="bi bi-plus-circle" aria-hidden="true" />
              <span>Nuevo almacen</span>
            </button>
          </div>
        </div>

        <div className="card-body inv-warehouse-body">
          {error ? (
            <div className="alert alert-danger mb-0">
              <i className="bi bi-exclamation-triangle-fill me-2" aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="inv-warehouse-results-meta">
            Total Almacenes: <strong>{almacenes.length}</strong>
          </div>

          {cardsContent}

          <div ref={movimientosRef}>
            <MovimientosTab
              openToast={openToast}
              embedded
              almacenes={almacenes}
              sucursales={sucursales}
              selectedAlmacenId={selectedAlmacenId}
              onSelectAlmacen={setSelectedAlmacenId}
              onMovimientoCreado={handleMovimientoCreado}
            />
          </div>
        </div>
      </div>

      {createModal}
      {detailModal}
      {editModal}
      {confirmDeleteModal}
    </>
  );
};

export default AlmacenesTab;
