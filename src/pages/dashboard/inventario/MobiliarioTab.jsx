import { useEffect, useMemo, useState } from 'react';
import { inventarioService } from '../../../services/inventarioService';
import SinPermiso from '../../../components/common/SinPermiso';
import { usePermisos } from '../../../context/PermisosContext';
import { PERMISSIONS } from '../../../utils/permissions';

const resolveCardsPerPage = (width) => {
  if (width >= 1200) return 6;
  if (width >= 620) return 4;
  return 2;
};

const hasValue = (value) =>
  value !== undefined &&
  value !== null &&
  !(typeof value === 'string' && value.trim() === '');

const buildEmptyForm = () => ({
  nombre_bien: '',
  id_empleado: '',
  fecha_asignacion: ''
});

const parseDateUi = (value) => {
  if (!value) return '';
  const normalized = String(value).slice(0, 10);
  const [yy, mm, dd] = normalized.split('-');
  if (!yy || !mm || !dd) return normalized;
  return `${dd}/${mm}/${yy}`;
};

const getConfirmCopyByAction = (action) => {
  const safeAction = String(action ?? 'inactivar').trim().toLowerCase();
  if (safeAction === 'reactivar') {
    return {
      title: 'CONFIRMAR REACTIVACION',
      subtitle: 'El registro volvera al listado de activos.',
      note: 'El bien de mobiliario volvera a estar disponible para operaciones.',
      question: 'Deseas confirmar la reactivacion de este bien?',
      actionLabel: 'Reactivar',
      actionBusyLabel: 'Reactivando...',
      actionIcon: 'bi-arrow-clockwise',
      actionButtonClass: 'btn-success'
    };
  }

  return {
    title: 'CONFIRMAR INACTIVACION',
    subtitle: 'Este registro quedara marcado como inactivo.',
    note: 'Podras reactivar este bien de mobiliario mas adelante.',
    question: 'Deseas confirmar la inactivacion de este bien?',
    actionLabel: 'Inactivar',
    actionBusyLabel: 'Inactivando...',
    actionIcon: 'bi-slash-circle',
    actionButtonClass: 'btn-warning'
  };
};

const MobiliarioTab = ({ openToast }) => {
  const { can, loading: permisosLoading } = usePermisos();
  const canVer = can(PERMISSIONS.INVENTARIO_MOBILIARIO_VER);
  const canCrear = can(PERMISSIONS.INVENTARIO_MOBILIARIO_CREAR);
  const canEditar = can(PERMISSIONS.INVENTARIO_MOBILIARIO_EDITAR);
  const canCambiarEstado = can(PERMISSIONS.INVENTARIO_MOBILIARIO_ESTADO_CAMBIAR);

  const safeToast = (title, message, variant = 'success') => {
    if (typeof openToast === 'function') openToast(title, message, variant);
  };

  const [rowsAll, setRowsAll] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [loadingEmpleados, setLoadingEmpleados] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showInactivos, setShowInactivos] = useState(false);
  const [error, setError] = useState('');
  const [modalMode, setModalMode] = useState('create');
  const [editingId, setEditingId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(buildEmptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [empleadoSearch, setEmpleadoSearch] = useState('');
  const [cardsPerPage, setCardsPerPage] = useState(() =>
    typeof window === 'undefined' ? 6 : resolveCardsPerPage(window.innerWidth)
  );
  const [carouselPageIndex, setCarouselPageIndex] = useState(0);
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    idToChange: null,
    nombre: '',
    action: 'inactivar'
  });
  const [changingEstado, setChangingEstado] = useState(false);

  const empleadosMap = useMemo(() => {
    const map = new Map();
    (Array.isArray(empleados) ? empleados : []).forEach((row) => {
      const key = Number.parseInt(String(row?.id_empleado ?? ''), 10);
      if (!Number.isInteger(key) || key <= 0) return;
      map.set(key, row?.empleado_nombre || `Empleado #${key}`);
    });
    return map;
  }, [empleados]);

  const empleadosCatalog = useMemo(() => {
    const source = Array.isArray(empleados) ? empleados : [];
    return source
      .map((row) => {
        const id = Number.parseInt(String(row?.id_empleado ?? ''), 10);
        if (!Number.isInteger(id) || id <= 0) return null;

        const nombre = String(row?.empleado_nombre ?? '').trim() || `Empleado #${id}`;
        const identidad = String(
          row?.identidad ?? row?.numero_identidad ?? row?.dni ?? row?.identificacion ?? ''
        ).trim();
        const codigo = String(row?.codigo_empleado ?? row?.codigo ?? '').trim();
        const detailParts = [];
        if (identidad) detailParts.push(`ID: ${identidad}`);
        if (codigo && codigo !== identidad) detailParts.push(`Cod: ${codigo}`);

        const searchStack = [
          nombre,
          identidad,
          codigo,
          row?.correo_electronico,
          row?.correo,
          row?.email,
          row?.id_empleado
        ]
          .filter(hasValue)
          .join(' ')
          .toLowerCase();

        return {
          id,
          nombre,
          detail: detailParts.join(' | '),
          searchStack
        };
      })
      .filter(Boolean);
  }, [empleados]);

  const empleadosSelectOptions = useMemo(() => {
    const query = String(empleadoSearch ?? '').trim().toLowerCase();
    const selectedId = Number.parseInt(String(form?.id_empleado ?? ''), 10);
    let filtered = query
      ? empleadosCatalog.filter((row) => row.searchStack.includes(query))
      : empleadosCatalog;

    if (Number.isInteger(selectedId) && selectedId > 0 && !filtered.some((row) => row.id === selectedId)) {
      const selectedRow = empleadosCatalog.find((row) => row.id === selectedId);
      if (selectedRow) filtered = [selectedRow, ...filtered];
    }

    return filtered;
  }, [empleadoSearch, empleadosCatalog, form?.id_empleado]);

  const drawerTitle = modalMode === 'edit' ? 'Editar bien' : 'Nuevo bien';
  const confirmCopy = useMemo(() => getConfirmCopyByAction(confirmModal.action), [confirmModal.action]);

  const loadRows = async () => {
    if (!canVer) return;
    setLoadingRows(true);
    setError('');
    try {
      // AM: se trae el dataset completo una sola vez para filtrar localmente y evitar recarga visual por cada cambio de busqueda/toggle.
      const data = await inventarioService.getMobiliario({
        incluirInactivos: true
      });
      const safeRows = Array.isArray(data) ? data : [];
      setRowsAll(safeRows);
    } catch (err) {
      const message = err?.message || 'No se pudo cargar el mobiliario.';
      setError(message);
      safeToast('ERROR', message, 'danger');
    } finally {
      setLoadingRows(false);
    }
  };

  const loadEmpleados = async () => {
    if (!canVer) return;
    setLoadingEmpleados(true);
    try {
      const data = await inventarioService.getEmpleadosCatalogoMobiliario();
      setEmpleados(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err?.message || 'No se pudo cargar el catalogo de empleados.';
      safeToast('ERROR', message, 'danger');
    } finally {
      setLoadingEmpleados(false);
    }
  };

  useEffect(() => {
    if (!canVer) return;
    void loadRows();
    // AM: carga inicial y recargas manuales despues de mutaciones; filtros/search se resuelven localmente para mayor velocidad.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canVer]);

  useEffect(() => {
    if (!canVer) return;
    void loadEmpleados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canVer]);

  useEffect(() => {
    const onResize = () => setCardsPerPage(resolveCardsPerPage(window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    setCarouselPageIndex(0);
  }, [cardsPerPage, rowsAll.length, search, showInactivos]);

  const resetModal = () => {
    setModalMode('create');
    setEditingId(null);
    setForm(buildEmptyForm());
    setFormErrors({});
    setEmpleadoSearch('');
    setShowModal(false);
  };

  const validateForm = () => {
    const nextErrors = {};
    const nombre = String(form.nombre_bien ?? '').trim();
    const idEmpleado = Number.parseInt(String(form.id_empleado ?? ''), 10);
    const fecha = String(form.fecha_asignacion ?? '').trim();

    if (nombre.length < 2) nextErrors.nombre_bien = 'Ingresa un nombre valido (minimo 2 caracteres).';
    if (!Number.isInteger(idEmpleado) || idEmpleado <= 0) nextErrors.id_empleado = 'Selecciona un empleado valido.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) nextErrors.fecha_asignacion = 'Selecciona una fecha valida.';

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const openCreateModal = () => {
    setModalMode('create');
    setEditingId(null);
    setForm(buildEmptyForm());
    setFormErrors({});
    setEmpleadoSearch('');
    setShowModal(true);
  };

  const openEditModal = (row) => {
    setModalMode('edit');
    setEditingId(Number(row?.id_mobiliario));
    setForm({
      nombre_bien: String(row?.nombre_bien ?? ''),
      id_empleado: String(row?.id_empleado ?? ''),
      fecha_asignacion: String(row?.fecha_asignacion ?? '').slice(0, 10)
    });
    setFormErrors({});
    setEmpleadoSearch(String(row?.empleado_nombre ?? '').trim());
    setShowModal(true);
  };

  const submitForm = async (event) => {
    event.preventDefault();
    if (!validateForm()) return;

    const payload = {
      nombre_bien: String(form.nombre_bien ?? '').trim(),
      id_empleado: Number.parseInt(String(form.id_empleado ?? ''), 10),
      fecha_asignacion: String(form.fecha_asignacion ?? '').trim()
    };

    setSaving(true);
    try {
      if (modalMode === 'edit' && editingId) {
        await inventarioService.actualizarMobiliario(editingId, payload);
        safeToast('EXITO', 'Bien de mobiliario actualizado correctamente.');
      } else {
        await inventarioService.crearMobiliario(payload);
        safeToast('EXITO', 'Bien de mobiliario registrado correctamente.');
      }
      resetModal();
      await loadRows();
    } catch (err) {
      const message = err?.message || 'No se pudo guardar el bien.';
      safeToast('ERROR', message, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const toggleEstado = (row) => {
    if (!canCambiarEstado) return;
    const idMobiliario = Number.parseInt(String(row?.id_mobiliario ?? ''), 10);
    if (!Number.isInteger(idMobiliario) || idMobiliario <= 0) return;

    const action = row?.activo ? 'inactivar' : 'reactivar';
    setConfirmModal({
      show: true,
      idToChange: idMobiliario,
      nombre: String(row?.nombre_bien ?? '').trim(),
      action
    });
  };

  const closeConfirmEstadoModal = (force = false) => {
    if (changingEstado && !force) return;
    setConfirmModal({ show: false, idToChange: null, nombre: '', action: 'inactivar' });
  };

  const confirmEstadoChange = async () => {
    if (!canCambiarEstado || changingEstado) return;
    const idMobiliario = Number.parseInt(String(confirmModal.idToChange ?? ''), 10);
    if (!Number.isInteger(idMobiliario) || idMobiliario <= 0) {
      closeConfirmEstadoModal();
      return;
    }

    const nextEstado = confirmModal.action === 'reactivar';
    setChangingEstado(true);
    try {
      await inventarioService.cambiarEstadoMobiliario(idMobiliario, nextEstado);
      safeToast('EXITO', nextEstado ? 'Bien reactivado correctamente.' : 'Bien inactivado correctamente.');
      closeConfirmEstadoModal(true);
      await loadRows();
    } catch (err) {
      const message = err?.message || 'No se pudo cambiar el estado del bien.';
      safeToast('ERROR', message, 'danger');
      closeConfirmEstadoModal(true);
    } finally {
      setChangingEstado(false);
    }
  };

  const rows = useMemo(() => {
    const source = Array.isArray(rowsAll) ? rowsAll : [];
    const searchText = String(search ?? '').trim().toLowerCase();

    return source.filter((row) => {
      const isActive = Boolean(row?.activo);
      // AM: al activar "Ver inactivos", se muestran unicamente inactivos.
      if (showInactivos && isActive) return false;
      if (!showInactivos && !isActive) return false;

      if (!searchText) return true;
      const nombre = String(row?.nombre_bien ?? '').toLowerCase();
      const empleado = String(row?.empleado_nombre ?? '').toLowerCase();
      const fecha = String(row?.fecha_asignacion ?? '').toLowerCase();
      return nombre.includes(searchText) || empleado.includes(searchText) || fecha.includes(searchText);
    });
  }, [rowsAll, search, showInactivos]);

  const baseRows = Array.isArray(rowsAll) ? rowsAll : [];
  const rowsTotal = Array.isArray(rows) ? rows.length : 0;
  const activosCount = baseRows.filter((row) => Boolean(row?.activo)).length;
  const inactivosCount = Math.max(0, baseRows.length - activosCount);
  const pageCount = Math.max(1, Math.ceil(rowsTotal / cardsPerPage));
  const safePageIndex = Math.min(carouselPageIndex, pageCount - 1);
  const pageStart = safePageIndex * cardsPerPage;
  const rowsPage = rows.slice(pageStart, pageStart + cardsPerPage);
  const closeDrawer = () => {
    setShowModal(false);
    setFormErrors({});
  };

  if (permisosLoading) return null;

  if (!canVer) {
    return <SinPermiso permiso={PERMISSIONS.INVENTARIO_MOBILIARIO_VER} />;
  }

  return (
    <>
      <div className="inv-catpro-card inv-prod-card inv-cat-v2 inv-has-sticky-header mb-3">
        <div className="inv-prod-header inv-cat-v2__header inv-cat-v3__header">
          <div className="inv-cat-v3__layout">
            <div className="inv-cat-v3__title">
              <div className="inv-prod-title-wrap">
                <div className="inv-prod-title-row">
                  <i className="bi bi-archive inv-prod-title-icon" />
                  <span className="inv-prod-title">Mobiliario</span>
                </div>
                <div className="inv-prod-subtitle">Registro de bienes asignados al personal</div>
              </div>
            </div>

            <label className="inv-ins-search inv-cat-v3__search" aria-label="Buscar mobiliario">
              <i className="bi bi-search" />
              <input
                type="search"
                placeholder="Buscar por bien o empleado responsable..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <div className="inv-prod-header-actions inv-ins-header-actions inv-cat-v2__actions inv-cat-v3__actions-stack">
              <label className="form-check form-switch mb-0 inv-catpro-inline-toggle">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={showInactivos}
                  onChange={(event) => setShowInactivos(event.target.checked)}
                />
                <span className="form-check-label">Solo inactivos</span>
              </label>

              {canCrear && (
                <button
                  type="button"
                  className={`inv-prod-toolbar-btn ${showModal && modalMode === 'create' ? 'is-on' : ''}`}
                  onClick={openCreateModal}
                >
                  <i className="bi bi-plus-circle" />
                  <span>Nuevo</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="inv-prod-kpis inv-cat-v2__kpis inv-cat-unified-panel-shell" aria-label="Resumen de mobiliario">
          <article className="inv-prod-kpi inv-invstat-card">
            <div className="inv-invstat-icon" aria-hidden="true">
              <i className="bi bi-grid-1x2" />
            </div>
            <div className="inv-prod-kpi-content">
              <span>Total</span>
              <strong>{baseRows.length}</strong>
            </div>
          </article>
          <article className="inv-prod-kpi inv-invstat-card is-ok">
            <div className="inv-invstat-icon" aria-hidden="true">
              <i className="bi bi-check-circle" />
            </div>
            <div className="inv-prod-kpi-content">
              <span>Activos</span>
              <strong>{activosCount}</strong>
            </div>
          </article>
          <article className="inv-prod-kpi inv-invstat-card is-empty">
            <div className="inv-invstat-icon" aria-hidden="true">
              <i className="bi bi-slash-circle" />
            </div>
            <div className="inv-prod-kpi-content">
              <span>Inactivos</span>
              <strong>{Math.max(0, inactivosCount)}</strong>
            </div>
          </article>
        </div>

        <div className="inv-catpro-body inv-prod-body p-3 inv-cat-unified-panel-shell">
          {error ? (
            <div className="alert alert-danger mb-3" role="alert">
              {error}
            </div>
          ) : null}

          <div className="inv-prod-results-meta inv-cat-v2__results-meta inv-inventory-results-meta">
            <span>{loadingRows ? 'Cargando mobiliario...' : `${rowsTotal} resultados`}</span>
            <span>{loadingRows ? '' : `Pagina ${safePageIndex + 1} de ${pageCount}`}</span>
          </div>

          <div className="inv-catpro-list">
            {loadingRows ? (
              <div className="inv-catpro-loading" role="status" aria-live="polite">
                <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                <span>Cargando mobiliario...</span>
              </div>
            ) : rowsTotal === 0 ? (
              <div className="inv-catpro-empty">
                <div className="inv-catpro-empty-icon">
                  <i className="bi bi-inbox-fill" />
                </div>
                <div className="inv-catpro-empty-title">No hay bienes para mostrar</div>
                <div className="inv-catpro-empty-sub">
                  {showInactivos ? 'No hay bienes inactivos para mostrar.' : 'Registra tu primer bien de mobiliario.'}
                </div>
                {canCrear ? (
                  <div className="d-flex justify-content-center">
                    <button type="button" className="btn btn-primary" onClick={openCreateModal}>
                      Nuevo bien
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="inv-catpro-carousel-shell">
                <div className="inv-catpro-carousel-meta">
                  <span>{`Pagina ${safePageIndex + 1} de ${pageCount}`}</span>
                  <span>{`${rowsTotal} bienes visibles`}</span>
                </div>

                <div
                  className={`inv-catpro-grid inv-catpro-grid-page ${cardsPerPage >= 6 ? 'cols-3' : cardsPerPage >= 4 ? 'cols-2' : 'cols-1'}`}
                  key={`mobiliario-page-${safePageIndex}`}
                >
                  {rowsPage.map((row) => {
                    const id = Number.parseInt(String(row?.id_mobiliario ?? ''), 10);
                    const isActive = Boolean(row?.activo);
                    const empleadoNombre =
                      String(row?.empleado_nombre ?? '').trim() ||
                      empleadosMap.get(Number(row?.id_empleado)) ||
                      `Empleado #${row?.id_empleado ?? ''}`;

                    return (
                      <article
                        key={id}
                        className={`inv-catpro-item inv-cat-card inv-anim-in inv-mob-card ${isActive ? '' : 'is-inactive-state'}`}
                      >
                        <span className="inv-mob-card__bg-icon" aria-hidden="true">
                          <i className="bi bi-lamp" />
                        </span>

                        <div className="inv-catpro-item-top inv-mob-card__body">
                          <div className="inv-mob-card__title-row">
                            <div className="inv-mob-card__title-wrap">
                              <h6 className="inv-cat-card__title mb-0">{row?.nombre_bien}</h6>
                            </div>
                          </div>

                          <div className="inv-mob-card__divider" />

                          <div className="inv-mob-card__meta-grid">
                            <div className="inv-mob-card__meta-cell">
                              <span className="inv-mob-card__meta-label">Empleado</span>
                              <p className="inv-cat-card__description mb-0">{empleadoNombre}</p>
                            </div>
                            <div className="inv-mob-card__meta-cell">
                              <span className="inv-mob-card__meta-label">Fecha</span>
                              <p className="inv-cat-card__description mb-0">{parseDateUi(row?.fecha_asignacion)}</p>
                            </div>
                          </div>
                        </div>

                        <div className="inv-catpro-meta inv-catpro-item-footer">
                          <div className="inv-catpro-code-wrap">
                            <span className={`inv-catpro-state-dot ${isActive ? 'ok' : 'off'}`} />
                            <span className="inv-catpro-code">{isActive ? 'Activo' : 'Inactivo'}</span>
                          </div>

                          <div className="inv-catpro-meta-actions inv-catpro-action-bar inv-cat-card__actions">
                            {canEditar ? (
                              <button
                                type="button"
                                className="inv-catpro-action edit inv-catpro-action-compact"
                                onClick={() => openEditModal(row)}
                              >
                                <i className="bi bi-pencil-square" />
                                <span className="inv-catpro-action-label">Editar</span>
                              </button>
                            ) : null}

                            {canCambiarEstado ? (
                              <button
                                type="button"
                                className={`inv-catpro-action ${isActive ? 'danger' : 'edit'} inv-catpro-action-compact`}
                                onClick={() => toggleEstado(row)}
                              >
                                <i className={`bi ${isActive ? 'bi-slash-circle' : 'bi-arrow-clockwise'}`} />
                                <span className="inv-catpro-action-label">{isActive ? 'Inactivar' : 'Reactivar'}</span>
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {pageCount > 1 ? (
                  <div className="d-flex justify-content-center gap-2 mt-3">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      disabled={safePageIndex <= 0}
                      onClick={() => setCarouselPageIndex((prev) => Math.max(0, prev - 1))}
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      disabled={safePageIndex >= pageCount - 1}
                      onClick={() => setCarouselPageIndex((prev) => Math.min(pageCount - 1, prev + 1))}
                    >
                      Siguiente
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        className={`inv-prod-drawer-backdrop inv-cat-v2__drawer-backdrop ${showModal ? 'show' : ''}`}
        onClick={closeDrawer}
        aria-hidden={!showModal}
      />

      <aside
        className={`inv-prod-drawer inv-cat-v2__drawer ${modalMode === 'create' ? 'inv-cat-v2__drawer--create' : 'inv-cat-v2__drawer--edit'} ${showModal ? 'show' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!showModal}
      >
        <form
          className={`inv-prod-drawer-body inv-catpro-drawer-body-lite inv-catpro-drawer-body-lite--premium ${modalMode === 'create' ? 'inv-catpro-drawer-body-lite--create' : 'inv-catpro-drawer-body-lite--edit'}`}
          onSubmit={submitForm}
        >
          <div className={`inv-cat-create-hero ${modalMode === 'create' ? 'is-create' : 'is-edit'}`}>
            <button type="button" className="inv-prod-drawer-close inv-cat-create-hero__close" onClick={closeDrawer} title="Cerrar">
              <i className="bi bi-x-lg" />
            </button>
            <div className="inv-cat-create-hero__icon">
              <i className="bi bi-lamp" aria-hidden="true" />
            </div>
            <div className="inv-cat-create-hero__copy">
              <div className="inv-cat-create-hero__kicker">Inventario de mobiliario</div>
              <div className="inv-cat-create-hero__title">{drawerTitle}</div>
            </div>
            <div className="inv-cat-create-hero__chips">
              <span className="inv-cat-create-hero__chip">
                <i className="bi bi-person-badge" aria-hidden="true" /> {hasValue(form.id_empleado) ? 'Empleado seleccionado' : 'Sin empleado'}
              </span>
              <span className="inv-cat-create-hero__chip">
                <i className="bi bi-calendar-event" aria-hidden="true" /> {hasValue(form.fecha_asignacion) ? parseDateUi(form.fecha_asignacion) : 'Sin fecha'}
              </span>
            </div>
          </div>

          <div className={`inv-cat-create-grid ${modalMode === 'create' ? 'is-create' : 'is-edit'}`}>
            <div className="mb-2">
              <label className="form-label">Nombre del bien</label>
              <input
                className={`form-control ${formErrors.nombre_bien ? 'is-invalid' : ''}`}
                value={form.nombre_bien}
                onChange={(event) => setForm((prev) => ({ ...prev, nombre_bien: event.target.value }))}
                maxLength={160}
                placeholder="Ejemplo: Escritorio ejecutivo"
              />
              {formErrors.nombre_bien ? <div className="invalid-feedback d-block">{formErrors.nombre_bien}</div> : null}
            </div>

            <div className="mb-2">
              <label className="form-label">Empleado</label>
              <input
                className="form-control mb-2"
                value={empleadoSearch}
                onChange={(event) => setEmpleadoSearch(event.target.value)}
                placeholder="Buscar por nombre, identidad o codigo de empleado..."
                disabled={loadingEmpleados}
              />
              <select
                className={`form-select ${formErrors.id_empleado ? 'is-invalid' : ''}`}
                value={form.id_empleado}
                onChange={(event) => {
                  const nextId = String(event.target.value ?? '');
                  const selected = empleadosCatalog.find((row) => String(row.id) === nextId);
                  setForm((prev) => ({ ...prev, id_empleado: nextId }));
                  if (selected) setEmpleadoSearch(selected.nombre);
                }}
                disabled={loadingEmpleados}
              >
                <option value="">
                  {loadingEmpleados
                    ? 'Cargando empleados...'
                    : empleadosSelectOptions.length > 0
                      ? 'Selecciona al empleado responsable'
                      : 'Sin coincidencias'}
                </option>
                {empleadosSelectOptions.map((empleado) => {
                  return (
                    <option key={empleado.id} value={empleado.id}>
                      {empleado.detail ? `${empleado.nombre} (${empleado.detail})` : empleado.nombre}
                    </option>
                  );
                })}
              </select>
              <div className="form-text">
                {empleadoSearch
                  ? `${empleadosSelectOptions.length} coincidencia(s) para "${empleadoSearch}".`
                  : `${empleadosCatalog.length} empleado(s) disponibles.`}
              </div>
              {formErrors.id_empleado ? <div className="invalid-feedback d-block">{formErrors.id_empleado}</div> : null}
            </div>
          </div>

          <div className="mb-2">
            <label className="form-label">Fecha de asignacion</label>
            <input
              type="date"
              className={`form-control ${formErrors.fecha_asignacion ? 'is-invalid' : ''}`}
              value={form.fecha_asignacion}
              onChange={(event) => setForm((prev) => ({ ...prev, fecha_asignacion: event.target.value }))}
            />
            {formErrors.fecha_asignacion ? <div className="invalid-feedback d-block">{formErrors.fecha_asignacion}</div> : null}
          </div>

          <div className={`d-flex gap-2 ${modalMode === 'create' ? 'inv-cat-create-actions' : 'inv-cat-edit-actions'}`}>
            <button type="button" className="btn inv-prod-btn-subtle flex-fill" onClick={closeDrawer} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn inv-prod-btn-primary flex-fill" disabled={saving || !hasValue(form.id_empleado)}>
              {saving ? 'Guardando...' : modalMode === 'edit' ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </form>
      </aside>

      {confirmModal.show ? (
        <div className="inv-pro-confirm-backdrop" role="dialog" aria-modal="true" onClick={closeConfirmEstadoModal}>
          <div className="inv-pro-confirm-panel" onClick={(event) => event.stopPropagation()}>
            <div className="inv-pro-confirm-glow" aria-hidden="true" />

            <div className="inv-pro-confirm-head">
              <div className="inv-pro-confirm-head-main">
                <div className="inv-pro-confirm-head-icon">
                  <i className={`bi ${confirmCopy.actionIcon}`} aria-hidden="true" />
                </div>
                <div className="inv-pro-confirm-head-copy">
                  <div className="inv-pro-confirm-kicker">Mobiliario</div>
                  <div className="inv-pro-confirm-title">{confirmCopy.title}</div>
                  <div className="inv-pro-confirm-sub">{confirmCopy.subtitle}</div>
                </div>
              </div>
              <button
                type="button"
                className="inv-pro-confirm-close"
                onClick={closeConfirmEstadoModal}
                aria-label="Cerrar"
                disabled={changingEstado}
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <div className="inv-pro-confirm-body">
              <div className="inv-pro-confirm-note">
                <i className="bi bi-shield-exclamation" aria-hidden="true" />
                <span>{confirmCopy.note}</span>
              </div>

              <div className="inv-pro-confirm-question">{confirmCopy.question}</div>

              <div className="inv-pro-confirm-name">
                <div className="inv-pro-confirm-name-label">Bien seleccionado</div>
                <div className="inv-pro-confirm-name-value">
                  <i className="bi bi-lamp" aria-hidden="true" />
                  <span>{confirmModal.nombre || 'Bien seleccionado'}</span>
                </div>
              </div>
            </div>

            <div className="inv-pro-confirm-footer">
              <button
                type="button"
                className="btn inv-pro-btn-cancel"
                onClick={closeConfirmEstadoModal}
                disabled={changingEstado}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`btn ${confirmCopy.actionButtonClass}`}
                onClick={confirmEstadoChange}
                disabled={changingEstado}
              >
                <i className={`bi ${changingEstado ? 'bi-hourglass-split' : confirmCopy.actionIcon}`} aria-hidden="true" />
                <span>{changingEstado ? confirmCopy.actionBusyLabel : confirmCopy.actionLabel}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default MobiliarioTab;

