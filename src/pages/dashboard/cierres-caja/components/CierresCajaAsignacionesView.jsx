import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import { usePermisos } from '../../../../context/PermisosContext';
import sucursalesService from '../../../../services/sucursalesService';
import VentasToast from '../../ventas/components/VentasToast';
import CierresCajaFiltersDrawer from './CierresCajaFiltersDrawer';
import { extractCajasApiMessage, formatCajaDateTime } from '../../ventas/utils/cajasHelpers';
import { useCierresCaja } from '../../ventas/hooks/useCierresCaja';
import { PERMISSIONS } from '../../../../utils/permissions';
import CollapsibleSearchInput from '../../../../components/common/CollapsibleSearchInput';
import CierreCajaAbrirModal from '../../ventas/components/cierres/CierreCajaAbrirModal';

const buildScopeQuery = (value) => {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? { id_sucursal: parsed } : {};
};

const isTruthyState = (value) =>
  value === true || value === 'true' || value === 1 || value === '1';

const countActiveFilters = ({ id_caja = '', solo_activas = true, sucursal = '' }) =>
  (String(id_caja || '').trim() ? 1 : 0) + (solo_activas ? 0 : 1) + (String(sucursal || '').trim() ? 1 : 0);

const initialForm = Object.freeze({
  id_caja: '',
  id_usuario: '',
  rol_operativo: 'RESPONSABLE',
  estado: true,
  observacion: ''
});

const roleLabel = (row) => {
  const roles = [];
  if (row?.puede_responsable) roles.push('Responsable');
  if (row?.puede_auxiliar) roles.push('Auxiliar');
  return roles.length ? roles.join(' + ') : 'Sin rol';
};

export default function CierresCajaAsignacionesView() {
  const { user } = useAuth();
  const { canAny, isSuperAdmin } = usePermisos();
  const {
    toast,
    closeToast,
    saving,
    openToast,
    listCajaCatalogo,
    listCajaAsignaciones,
    listUsuariosOperativos,
    createCajaAsignacion,
    updateCajaAsignacion,
    inactivateCajaAsignacion,
    createCajaCatalogo
  } = useCierresCaja();

  const [selectedSucursalId, setSelectedSucursalId] = useState('');
  const [scopeInitialized, setScopeInitialized] = useState(false);
  const [sucursales, setSucursales] = useState([]);
  const [loadingSucursales, setLoadingSucursales] = useState(false);

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ id_caja: '', solo_activas: true });
  const [filtersDraft, setFiltersDraft] = useState({ id_caja: '', solo_activas: true, sucursal: '' });
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [cajas, setCajas] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [confirmDeactivateOpen, setConfirmDeactivateOpen] = useState(false);
  const [confirmDeactivateTarget, setConfirmDeactivateTarget] = useState(null);
  const [confirmDeactivateMessage, setConfirmDeactivateMessage] = useState('');
  const [newCajaOpen, setNewCajaOpen] = useState(false);
  const [newCajaUsuarios, setNewCajaUsuarios] = useState([]);
  const [newCajaCajas, setNewCajaCajas] = useState([]);
  const [loadingNewCajaUsuarios, setLoadingNewCajaUsuarios] = useState(false);
  const [loadingNewCajaCajas, setLoadingNewCajaCajas] = useState(false);
  const newCajaUsersRequestIdRef = useRef(0);
  const newCajaListRequestIdRef = useRef(0);
  const usuariosRequestIdRef = useRef(0);
  const lastUsersLoadKeyRef = useRef('');

  const userSucursalId = Number.parseInt(String(user?.id_sucursal ?? ''), 10);
  const canSelectSucursal = isSuperAdmin || canAny([PERMISSIONS.VENTAS_CAJAS_MULTISUCURSAL_VER]);
  const canManage = canAny([PERMISSIONS.VENTAS_CAJAS_PARTICIPANTES_GESTIONAR]);
  const canView = canAny([PERMISSIONS.VENTAS_CAJAS_LISTADO_VER, PERMISSIONS.VENTAS_CAJAS_DETALLE_VER]);

  const scopeQuery = useMemo(
    () => (canSelectSucursal ? buildScopeQuery(selectedSucursalId) : {}),
    [canSelectSucursal, selectedSucursalId]
  );
  const deferredSearch = useDeferredValue(search);
  const activeFilters = useMemo(
    () => countActiveFilters({ ...filters, sucursal: canSelectSucursal ? selectedSucursalId : '' }),
    [canSelectSucursal, filters, selectedSucursalId]
  );

  useEffect(() => {
    if (scopeInitialized) return;
    if (Number.isInteger(userSucursalId) && userSucursalId > 0) {
      setSelectedSucursalId(String(userSucursalId));
    }
    setScopeInitialized(true);
  }, [scopeInitialized, userSucursalId]);

  useEffect(() => {
    if (filtersOpen) return;
    setFiltersDraft({
      id_caja: filters.id_caja,
      solo_activas: filters.solo_activas,
      sucursal: selectedSucursalId || ''
    });
  }, [filters.id_caja, filters.solo_activas, filtersOpen, selectedSucursalId]);

  useEffect(() => {
    if (!canSelectSucursal) return undefined;
    let ignore = false;
    const loadBranches = async () => {
      setLoadingSucursales(true);
      try {
        const response = await sucursalesService.getAll();
        if (ignore) return;
        const rows = (Array.isArray(response) ? response : [])
          .filter((row) => isTruthyState(row?.estado))
          .map((row) => ({
            id_sucursal: Number(row?.id_sucursal ?? 0) || null,
            nombre_sucursal: String(row?.nombre_sucursal ?? '').trim()
          }))
          .filter((row) => row.id_sucursal && row.nombre_sucursal);
        setSucursales(rows);
      } catch (err) {
        if (!ignore) openToast('ERROR', extractCajasApiMessage(err, 'No se pudo cargar sucursales.'), 'danger');
      } finally {
        if (!ignore) setLoadingSucursales(false);
      }
    };
    void loadBranches();
    return () => {
      ignore = true;
    };
  }, [canSelectSucursal, openToast]);

  const loadData = useCallback(async () => {
    if (!scopeInitialized || !canView) return;
    setLoading(true);
    setError('');
    try {
      const [cajasRes, asigRes] = await Promise.all([
        listCajaCatalogo(scopeQuery),
        listCajaAsignaciones({
          ...scopeQuery,
          ...(filters.id_caja ? { id_caja: filters.id_caja } : {}),
          ...(filters.solo_activas ? {} : { incluir_inactivas: true })
        })
      ]);
      setCajas(Array.isArray(cajasRes) ? cajasRes : []);
      setAsignaciones(Array.isArray(asigRes) ? asigRes : []);
    } catch (err) {
      setCajas([]);
      setAsignaciones([]);
      setError(extractCajasApiMessage(err, 'No se pudo cargar las asignaciones.'));
    } finally {
      setLoading(false);
    }
  }, [canView, filters.id_caja, filters.solo_activas, listCajaAsignaciones, listCajaCatalogo, scopeInitialized, scopeQuery]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const loadUsersByCaja = useCallback(async (idCajaRaw, rolOperativo = 'AUXILIAR') => {
    const requestId = usuariosRequestIdRef.current + 1;
    usuariosRequestIdRef.current = requestId;
    const idCaja = Number.parseInt(String(idCajaRaw || ''), 10);
    const caja = cajas.find((item) => Number(item.id_caja) === idCaja);
    const idSucursal = Number(caja?.id_sucursal || 0);
    if (!idSucursal) {
      setUsuarios([]);
      setLoadingUsuarios(false);
      if (idCaja > 0) {
        openToast('ERROR', 'La caja seleccionada no tiene sucursal asociada.', 'danger');
      }
      return;
    }
    setUsuarios([]);
    setLoadingUsuarios(true);
    try {
      const response = await listUsuariosOperativos({
        id_sucursal: idSucursal,
        rol_operativo: String(rolOperativo || 'AUXILIAR').trim().toUpperCase()
      });
      if (usuariosRequestIdRef.current !== requestId) return;
      setUsuarios(Array.isArray(response) ? response : []);
    } catch (errorResponse) {
      if (usuariosRequestIdRef.current !== requestId) return;
      setUsuarios([]);
      openToast(
        'ERROR',
        extractCajasApiMessage(errorResponse, 'No se pudo cargar el listado de usuarios disponibles.'),
        'danger'
      );
    } finally {
      if (usuariosRequestIdRef.current === requestId) {
        setLoadingUsuarios(false);
      }
    }
  }, [cajas, listUsuariosOperativos, openToast]);

  useEffect(
    () => () => {
      usuariosRequestIdRef.current += 1;
    },
    []
  );

  const visible = useMemo(() => {
    const raw = String(deferredSearch || '').trim().toLowerCase();
    return asignaciones.filter((row) => {
      if (filters.solo_activas && !row.estado) return false;
      if (!raw) return true;
      return [
        row.nombre_caja,
        row.codigo_caja,
        row.nombre_sucursal,
        row.nombre_completo,
        row.nombre_usuario
      ].some((value) => String(value || '').toLowerCase().includes(raw));
    });
  }, [asignaciones, deferredSearch, filters.solo_activas]);

  const stats = useMemo(() => ({
    cajasVisibles: cajas.length,
    asignacionesActivas: visible.filter((row) => row.estado).length,
    responsablesActivos: visible.filter((row) => row.estado && row.puede_responsable).length,
    auxiliaresActivos: visible.filter((row) => row.estado && row.puede_auxiliar).length
  }), [cajas.length, visible]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...initialForm, id_caja: filters.id_caja || '' });
    setUsuarios([]);
    lastUsersLoadKeyRef.current = '';
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      id_caja: String(row.id_caja || ''),
      id_usuario: String(row.id_usuario || ''),
      rol_operativo: row.puede_responsable ? 'RESPONSABLE' : 'AUXILIAR',
      estado: Boolean(row.estado),
      observacion: String(row.observacion || '')
    });
    setUsuarios([]);
    lastUsersLoadKeyRef.current = '';
    setModalOpen(true);
  };

  const formValid = useMemo(() => {
    const idCaja = Number.parseInt(String(form.id_caja || ''), 10);
    const idUsuario = Number.parseInt(String(form.id_usuario || ''), 10);
    const singleRole = ['RESPONSABLE', 'AUXILIAR'].includes(String(form.rol_operativo || '').trim().toUpperCase());
    return idCaja > 0 && idUsuario > 0 && singleRole;
  }, [form]);

  useEffect(() => {
    if (!modalOpen) return;
    const idCaja = Number.parseInt(String(form.id_caja || ''), 10);
    const rolOperativo = String(form.rol_operativo || '').trim().toUpperCase();
    if (!Number.isInteger(idCaja) || idCaja <= 0) {
      lastUsersLoadKeyRef.current = '';
      setUsuarios([]);
      setLoadingUsuarios(false);
      return;
    }
    if (!['RESPONSABLE', 'AUXILIAR'].includes(rolOperativo)) {
      setUsuarios([]);
      setLoadingUsuarios(false);
      return;
    }
    const requestKey = `${idCaja}:${rolOperativo}`;
    if (lastUsersLoadKeyRef.current === requestKey) return;
    lastUsersLoadKeyRef.current = requestKey;
    setUsuarios([]);
    void loadUsersByCaja(idCaja, rolOperativo);
  }, [form.id_caja, form.rol_operativo, loadUsersByCaja, modalOpen]);

  useEffect(() => {
    if (modalOpen) return;
    lastUsersLoadKeyRef.current = '';
    setUsuarios([]);
    setLoadingUsuarios(false);
  }, [modalOpen]);

  const selectedCaja = useMemo(() => {
    const idCaja = Number.parseInt(String(form.id_caja || ''), 10);
    if (!Number.isInteger(idCaja) || idCaja <= 0) return null;
    return cajas.find((item) => Number(item.id_caja) === idCaja) || null;
  }, [cajas, form.id_caja]);

  const selectedCajaSucursalId = Number(selectedCaja?.id_sucursal || 0) || null;
  const selectedCajaSucursalNombre = String(selectedCaja?.nombre_sucursal || '').trim();
  const hasRolOperativo = ['RESPONSABLE', 'AUXILIAR'].includes(String(form.rol_operativo || '').trim().toUpperCase());
  const canPickUsuario = Boolean(selectedCajaSucursalId) && hasRolOperativo && !loadingUsuarios;
  const userPlaceholder = !selectedCaja
    ? 'Selecciona una caja primero'
    : !selectedCajaSucursalId
      ? 'La caja seleccionada no tiene sucursal asociada'
      : !hasRolOperativo
        ? 'Selecciona un rol operativo'
        : loadingUsuarios
          ? 'Cargando usuarios...'
          : 'Selecciona un usuario';

  const submitModal = async (event) => {
    event.preventDefault();
    if (!formValid) return;
    try {
      const payload = {
        puede_responsable: form.rol_operativo === 'RESPONSABLE',
        puede_auxiliar: form.rol_operativo === 'AUXILIAR',
        observacion: form.observacion.trim() || null
      };
      if (editing) {
        await updateCajaAsignacion(editing.id_caja_usuario_autorizado, {
          ...payload,
          estado: form.estado,
        });
      } else {
        await createCajaAsignacion({
          id_caja: Number(form.id_caja),
          id_usuario: Number(form.id_usuario),
          ...payload
        });
      }
      setModalOpen(false);
      await loadData();
    } catch {
      // Los hooks ya exponen toast de error; evitamos uncaught promise.
    }
  };


  const openDeactivateConfirm = (target, message) => {
    if (!target?.id_caja_usuario_autorizado) return;
    setConfirmDeactivateTarget(target);
    setConfirmDeactivateMessage(String(message || '¿Deseas desactivar esta asignación?'));
    setConfirmDeactivateOpen(true);
  };

  const closeDeactivateConfirm = () => {
    if (saving) return;
    setConfirmDeactivateOpen(false);
    setConfirmDeactivateTarget(null);
    setConfirmDeactivateMessage('');
  };

  const confirmDeactivate = async () => {
    if (!confirmDeactivateTarget?.id_caja_usuario_autorizado) return;
    try {
      await inactivateCajaAsignacion(confirmDeactivateTarget.id_caja_usuario_autorizado);
      setConfirmDeactivateOpen(false);
      setConfirmDeactivateTarget(null);
      setConfirmDeactivateMessage('');
      setModalOpen(false);
      await loadData();
    } catch {
      // Los hooks ya exponen toast de error; evitamos uncaught promise.
    }
  };
  const toggleState = async (row) => {
    if (!row?.id_caja_usuario_autorizado) return;
    if (row.estado) {
      openDeactivateConfirm(
        row,
        '¿Deseas desactivar esta asignación de caja? El usuario ya no podrá operar con este rol en esta caja.'
      );
      return;
    }
    try {
      if (row.estado) await inactivateCajaAsignacion(row.id_caja_usuario_autorizado);
      else await updateCajaAsignacion(row.id_caja_usuario_autorizado, { estado: true });
      await loadData();
    } catch {
      // Los hooks ya exponen toast de error; evitamos uncaught promise.
    }
  };

  const requestNewCajaUsuarios = useCallback(async (idSucursal, rolOperativo = 'RESPONSABLE') => {
    const requestId = newCajaUsersRequestIdRef.current + 1;
    newCajaUsersRequestIdRef.current = requestId;
    setLoadingNewCajaUsuarios(true);
    try {
      const response = await listUsuariosOperativos({ id_sucursal: idSucursal, rol_operativo: rolOperativo });
      if (newCajaUsersRequestIdRef.current !== requestId) return;
      setNewCajaUsuarios(Array.isArray(response) ? response : []);
    } catch {
      if (newCajaUsersRequestIdRef.current !== requestId) return;
      setNewCajaUsuarios([]);
    } finally {
      if (newCajaUsersRequestIdRef.current === requestId) setLoadingNewCajaUsuarios(false);
    }
  }, [listUsuariosOperativos]);

  const requestNewCajaCatalog = useCallback(async (idSucursal) => {
    const requestId = newCajaListRequestIdRef.current + 1;
    newCajaListRequestIdRef.current = requestId;
    setLoadingNewCajaCajas(true);
    try {
      const response = await listCajaCatalogo({ id_sucursal: idSucursal, incluir_inactivas: true });
      if (newCajaListRequestIdRef.current !== requestId) return;
      setNewCajaCajas(Array.isArray(response) ? response : []);
    } catch {
      if (newCajaListRequestIdRef.current !== requestId) return;
      setNewCajaCajas([]);
    } finally {
      if (newCajaListRequestIdRef.current === requestId) setLoadingNewCajaCajas(false);
    }
  }, [listCajaCatalogo]);

  const submitNewCaja = async (payload) => {
    try {
      await createCajaCatalogo(payload);
      setNewCajaOpen(false);
      await loadData();
    } catch {
      // Los hooks ya exponen toast de error; evitamos uncaught promise.
    }
  };

  if (!canView) return null;

  return (
    <>
      <div className="cierres-caja-page ventas-page d-flex flex-column gap-3 h-100 min-h-0">
        <section className="inv-catpro-card inv-prod-card border-0 bg-transparent shadow-none">
          <div className="inv-prod-header ventas-page__toolbar align-items-center bg-transparent px-0 pb-3" style={{ borderBottom: 'none' }}>
            <div className="inv-prod-title-wrap">
              <div className="inv-prod-title-row">
                <i className="bi bi-people-fill text-danger inv-prod-title-icon" style={{ background: 'rgba(220,53,69,0.12)' }} />
                <span className="inv-prod-title">Asignaciones</span>
              </div>
              <div className="inv-prod-subtitle">Gestion de autorizaciones permanentes caja-usuario.</div>
            </div>
            <div className="inv-prod-header-actions inv-ins-header-actions ventas-page__toolbar-actions fidelizacion-toolbar cierres-caja-toolbar">
              <CollapsibleSearchInput
                value={search}
                onValueChange={setSearch}
                onSubmit={(value) => setSearch(String(value || '').trim())}
                placeholder="Buscar por caja o usuario..."
                ariaLabel="Buscar asignaciones"
                expandDirection="left"
              />

              <button
                type="button"
                className="inv-prod-toolbar-btn bg-white border fidelizacion-toolbar__filter-btn"
                onClick={() => {
                  setFiltersDraft({
                    id_caja: filters.id_caja,
                    solo_activas: filters.solo_activas,
                    sucursal: selectedSucursalId || ''
                  });
                  setFiltersOpen(true);
                }}
              >
                <i className="bi bi-funnel" />
                <span>Filtros</span>
                {activeFilters > 0 ? (
                  <strong className="fidelizacion-toolbar__filter-count">{activeFilters}</strong>
                ) : null}
              </button>

              {canManage ? (
                <button
                  type="button"
                  className="inv-prod-toolbar-btn bg-white border cierres-caja-toolbar__cta"
                  onClick={() => setNewCajaOpen(true)}
                >
                  <i className="bi bi-plus-circle" />
                  <span>Nueva caja</span>
                </button>
              ) : null}

              {canManage ? (
                <button
                  type="button"
                  className="inv-prod-toolbar-btn bg-white border cierres-caja-toolbar__cta"
                  onClick={openCreate}
                >
                  <i className="bi bi-person-plus" />
                  <span>Nueva asignacion</span>
                </button>
              ) : null}
            </div>
          </div>
          <div className="inv-prod-kpis ventas-page__stats">
            <div className="inv-prod-kpi ventas-page__stat-card"><div className="ventas-page__stat-icon text-primary border-0 bg-white"><i className="bi bi-safe2" /></div><div className="inv-prod-kpi-content"><span>Cajas visibles</span><strong>{stats.cajasVisibles}</strong></div></div>
            <div className="inv-prod-kpi ventas-page__stat-card is-success"><div className="ventas-page__stat-icon text-success border-0 bg-white"><i className="bi bi-check2-circle" /></div><div className="inv-prod-kpi-content"><span>Asignaciones activas</span><strong>{stats.asignacionesActivas}</strong></div></div>
            <div className="inv-prod-kpi ventas-page__stat-card is-warning"><div className="ventas-page__stat-icon text-warning border-0 bg-white"><i className="bi bi-person-badge" /></div><div className="inv-prod-kpi-content"><span>Responsables</span><strong>{stats.responsablesActivos}</strong></div></div>
            <div className="inv-prod-kpi ventas-page__stat-card is-accent"><div className="ventas-page__stat-icon text-danger border-0 bg-white"><i className="bi bi-people" /></div><div className="inv-prod-kpi-content"><span>Auxiliares</span><strong>{stats.auxiliaresActivos}</strong></div></div>
          </div>
        </section>

        <div className="ventas-page__table-card flex-grow-1 d-flex flex-column min-h-0">
          <div className="ventas-page__table-wrap flex-grow-1 cierres-caja-table-desktop">
            <table className="table ventas-page__table">
              <thead><tr><th>Caja</th><th>Usuario</th><th>Roles</th><th className="text-center">Estado</th><th>Actualizacion</th><th className="text-end">Acciones</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan="6" className="text-center py-5"><div className="spinner-border text-danger" /></td></tr> : null}
                {!loading && error ? <tr><td colSpan="6" className="text-center py-4">{error}</td></tr> : null}
                {!loading && !error && visible.length === 0 ? <tr><td colSpan="6" className="text-center py-4">No hay asignaciones para los filtros aplicados.</td></tr> : null}
                {!loading && !error ? visible.map((row) => (
                  <tr key={row.id_caja_usuario_autorizado} className="ventas-page__table-row">
                    <td><div className="ventas-page__table-sale"><strong>{row.nombre_caja || 'Caja sin nombre'}</strong></div></td>
                    <td className="align-middle"><div className="ventas-page__table-sale"><strong>{row.nombre_completo || 'Sin nombre'}</strong></div></td>
                    <td className="align-middle"><span className="ventas-page__table-pill bg-white">{roleLabel(row)}</span></td>
                    <td className="text-center align-middle"><span className={`ventas-page__table-pill ${row.estado ? 'bg-success border-success text-white' : 'bg-secondary border-secondary text-white'}`}>{row.estado ? 'Activa' : 'Inactiva'}</span></td>
                    <td className="align-middle text-muted small fw-semibold">{formatCajaDateTime(row.fecha_actualizacion)}</td>
                    <td className="text-end align-middle">
                      <div className="d-inline-flex gap-2">
                        {canManage ? <button type="button" className="ventas-page__table-detail-btn bg-white border-secondary text-secondary" onClick={() => openEdit(row)}><i className="bi bi-pencil" /></button> : null}
                        {canManage ? <button type="button" className="ventas-page__table-detail-btn bg-white border-danger text-danger" onClick={() => void toggleState(row)}><i className={`bi ${row.estado ? 'bi-slash-circle' : 'bi-check2-circle'}`} /></button> : null}
                      </div>
                    </td>
                  </tr>
                )) : null}
              </tbody>
            </table>
          </div>

          <div className="cierres-caja-mobile-list">
            {!loading && !error && visible.length === 0 ? <div className="text-center py-4">No hay asignaciones para los filtros aplicados.</div> : null}
            {visible.map((row) => (
              <article key={row.id_caja_usuario_autorizado} className="cierres-caja-mobile-card">
                <div className="cierres-caja-mobile-card__head"><div><strong>{row.nombre_caja || 'Caja sin nombre'}</strong><small>{row.nombre_sucursal || 'Sin sucursal'}</small></div><span className={`ventas-page__table-pill ${row.estado ? 'bg-success border-success text-white' : 'bg-secondary border-secondary text-white'}`}>{row.estado ? 'Activa' : 'Inactiva'}</span></div>
                <div className="cierres-caja-mobile-card__body"><div><span>Usuario</span><strong>{row.nombre_completo || row.nombre_usuario || 'Sin usuario'}</strong></div><div><span>Roles</span><strong>{roleLabel(row)}</strong></div><div><span>Actualizacion</span><strong>{formatCajaDateTime(row.fecha_actualizacion)}</strong></div></div>
                {canManage ? <div className="cierres-caja-mobile-card__actions"><button type="button" className="btn btn-sm btn-outline-dark" onClick={() => openEdit(row)}>Editar</button></div> : null}
              </article>
            ))}
          </div>
        </div>
      </div>

      <CierresCajaFiltersDrawer
        open={filtersOpen}
        title="Refina asignaciones"
        subtitle="Filtra por sucursal, caja o incluye inactivas."
        activeFilters={activeFilters}
        onClose={() => setFiltersOpen(false)}
        onClear={() => setFiltersDraft({ id_caja: '', solo_activas: true, sucursal: '' })}
        onApply={() => {
          setFilters({
            id_caja: filtersDraft.id_caja,
            solo_activas: filtersDraft.solo_activas
          });
          if (canSelectSucursal) {
            setSelectedSucursalId(filtersDraft.sucursal);
          }
          setFiltersOpen(false);
        }}
      >
        {canSelectSucursal ? (
          <div className="inv-prod-drawer-section inv-cat-filter-card">
            <div className="inv-prod-drawer-section-title">Sucursal</div>
            <select
              className="form-select"
              value={filtersDraft.sucursal}
              onChange={(event) =>
                setFiltersDraft((current) => ({ ...current, sucursal: event.target.value }))
              }
              disabled={loadingSucursales}
            >
              <option value="">
                {loadingSucursales ? 'Cargando sucursales...' : 'Resumen multisucursal'}
              </option>
              {sucursales.map((sucursal) => (
                <option key={sucursal.id_sucursal} value={sucursal.id_sucursal}>
                  {sucursal.nombre_sucursal}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="inv-prod-drawer-section inv-cat-filter-card">
          <div className="inv-prod-drawer-section-title">Caja</div>
          <select className="form-select" value={filtersDraft.id_caja} onChange={(event) => setFiltersDraft((current) => ({ ...current, id_caja: event.target.value }))}>
            <option value="">Todas las cajas</option>
            {cajas.map((caja) => <option key={caja.id_caja} value={caja.id_caja}>{caja.nombre_caja} ({caja.codigo_caja || 'Sin codigo'})</option>)}
          </select>
        </div>
        <div className="inv-prod-drawer-section inv-cat-filter-card">
          <div className="inv-prod-drawer-section-title">Estado</div>
          <label className="form-check mt-2"><input className="form-check-input" type="checkbox" checked={filtersDraft.solo_activas} onChange={(event) => setFiltersDraft((current) => ({ ...current, solo_activas: event.target.checked }))} /><span className="form-check-label">Solo activas</span></label>
        </div>
      </CierresCajaFiltersDrawer>

      {modalOpen ? (
        <div className="ventas-modal-backdrop" onClick={() => setModalOpen(false)}>
          <section className="ventas-modal cierres-caja-action-modal cierres-caja-confirm-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <header className="ventas-modal__header"><div className="ventas-modal__title-wrap"><span className="ventas-modal__icon"><i className="bi bi-person-plus" /></span><div><h3>{editing ? 'Editar asignacion' : 'Nueva asignacion'}</h3><p>Define roles permanentes del usuario en la caja.</p></div></div><button type="button" className="ventas-modal__close-btn" onClick={() => setModalOpen(false)}><i className="bi bi-x-lg" /></button></header>
            <form className="ventas-modal__body cierres-caja-action-modal__body" onSubmit={submitModal}>
              <div className="cierres-caja-action-modal__grid">
                <label className="ventas-create-modal__field"><span>Caja</span><select className="ventas-create-modal__select" value={form.id_caja} disabled={Boolean(editing)} onChange={(event) => { const idCaja = event.target.value; lastUsersLoadKeyRef.current = ''; setUsuarios([]); setForm((current) => ({ ...current, id_caja: idCaja, id_usuario: '' })); }}><option value="">Selecciona una caja</option>{cajas.map((caja) => <option key={caja.id_caja} value={caja.id_caja}>{caja.nombre_caja} ({caja.codigo_caja || 'Sin codigo'})</option>)}</select></label>
                <label className="ventas-create-modal__field"><span>Rol operativo</span><select className="ventas-create-modal__select" value={form.rol_operativo} onChange={(event) => { lastUsersLoadKeyRef.current = ''; setUsuarios([]); setForm((current) => ({ ...current, rol_operativo: event.target.value, id_usuario: '' })); }}><option value="RESPONSABLE">Responsable</option><option value="AUXILIAR">Auxiliar</option></select></label>
                <label className="ventas-create-modal__field"><span>Usuario</span><select className="ventas-create-modal__select" value={form.id_usuario} disabled={!canPickUsuario} onChange={(event) => setForm((current) => ({ ...current, id_usuario: event.target.value }))}><option value="">{userPlaceholder}</option>{usuarios.map((u) => <option key={u.id_usuario} value={u.id_usuario}>{u.nombre_completo || u.nombre_usuario}</option>)}</select></label>
              </div>
              {selectedCaja ? <div className="text-muted small">Sucursal operativa: <strong>{selectedCajaSucursalNombre || 'Sin sucursal'}</strong></div> : null}
              <div className="d-flex flex-wrap gap-3">{editing ? <label className="form-check"><input className="form-check-input" type="checkbox" checked={form.estado} onChange={(event) => setForm((current) => ({ ...current, estado: event.target.checked }))} /><span className="form-check-label">Activa</span></label> : null}</div>
              {!formValid ? <div className="ventas-create-modal__error">Debe seleccionar solo un rol operativo: responsable o auxiliar.</div> : null}
              <label className="ventas-create-modal__field"><span>Observacion</span><textarea className="ventas-create-modal__note-input" rows="3" value={form.observacion} onChange={(event) => setForm((current) => ({ ...current, observacion: event.target.value }))} /></label>
              <footer className="ventas-detail-modal__footer"><div className="ventas-detail-modal__footer-actions"><button type="button" className="btn btn-outline-secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</button>{editing ? <button type="button" className="btn btn-outline-danger" disabled={saving || !editing?.id_caja_usuario_autorizado || !editing?.estado} onClick={() => openDeactivateConfirm(editing, `¿Deseas desactivar esta asignación de ${form.rol_operativo === 'RESPONSABLE' ? 'responsable' : 'auxiliar'}? El usuario ya no podrá operar con este rol permanente en esta caja.`)}>Desactivar asignación</button> : null}<button type="submit" className="btn btn-danger" disabled={!formValid || saving}>{saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear asignacion'}</button></div></footer>
            </form>
          </section>
        </div>
      ) : null}
      {confirmDeactivateOpen ? (
        <div className="ventas-modal-backdrop" onClick={closeDeactivateConfirm}>
          <section className="ventas-modal cierres-caja-action-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <header className="ventas-modal__header">
              <div className="ventas-modal__title-wrap">
                <span className="ventas-modal__icon"><i className="bi bi-exclamation-triangle" /></span>
                <div>
                  <h3>Confirmar desactivación</h3>
                  <p>Esta acción inactivará la asignación seleccionada.</p>
                </div>
              </div>
              <button type="button" className="ventas-modal__close-btn" onClick={closeDeactivateConfirm} disabled={saving}><i className="bi bi-x-lg" /></button>
            </header>
            <div className="ventas-modal__body cierres-caja-action-modal__body">
              <p className="mb-0">{confirmDeactivateMessage}</p>
              <div className="cierres-caja-resolution-note">
                <i className="bi bi-info-circle" />
                <span>Si la caja tiene una sesion abierta, primero debes cerrar la sesion antes de desactivar esta asignacion.</span>
              </div>
            </div>
            <footer className="ventas-detail-modal__footer">
              <div className="ventas-detail-modal__footer-actions cierres-caja-confirm-modal__actions">
                <button type="button" className="btn btn-outline-secondary" onClick={closeDeactivateConfirm} disabled={saving}>Cancelar</button>
                <button type="button" className="btn btn-danger" onClick={() => void confirmDeactivate()} disabled={saving}>{saving ? 'Procesando...' : 'Desactivar'}</button>
              </div>
            </footer>
          </section>
        </div>
      ) : null}

      <CierreCajaAbrirModal
        key={newCajaOpen ? 'nueva-caja-open' : 'nueva-caja-closed'}
        open={newCajaOpen}
        mode="nueva"
        cajasDisponibles={newCajaCajas}
        loadingCajas={loadingNewCajaCajas}
        saving={saving}
        canSelectSucursal={canSelectSucursal}
        selectedSucursalId={selectedSucursalId}
        sucursales={sucursales}
        usuariosDisponibles={newCajaUsuarios}
        loadingUsuarios={loadingNewCajaUsuarios}
        onRequestCajas={requestNewCajaCatalog}
        onRequestUsuarios={requestNewCajaUsuarios}
        onClose={() => setNewCajaOpen(false)}
        onSubmitOpenSesion={() => Promise.resolve()}
        onSubmitCreateCaja={submitNewCaja}
      />

      <VentasToast toast={toast} onClose={closeToast} />
    </>
  );
}





