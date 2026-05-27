import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import { usePermisos } from '../../../../context/PermisosContext';
import sucursalesService from '../../../../services/sucursalesService';
import cajasService from '../../../../services/cajasService';
import VentasToast from '../../ventas/components/VentasToast';
import CierreCajaDetalleModal from '../../ventas/components/cierres/CierreCajaDetalleModal';
import CierreCajaResolverDiferenciaModal, {
  canResolveCierreDifference
} from '../../ventas/components/cierres/CierreCajaResolverDiferenciaModal';
import CierresCajaPagination, {
  getPaginatedRows
} from '../../ventas/components/cierres/CierresCajaPagination';
import CierresCajaFiltersDrawer from './CierresCajaFiltersDrawer';
import CollapsibleSearchInput from '../../../../components/common/CollapsibleSearchInput';
import {
  extractCajasApiMessage,
  formatCajaCurrency,
  formatCajaDateTime,
  matchesCajaClosure,
  normalizeCierreReporte,
  resolveClosureStateBadge
} from '../../ventas/utils/cajasHelpers';
import { useCierresCaja } from '../../ventas/hooks/useCierresCaja';
import { normalizeRoles, PERMISSIONS } from '../../../../utils/permissions';

const buildScopeQuery = (value) => {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? { id_sucursal: parsed } : {};
};

const isTruthyState = (value) =>
  value === true || value === 'true' || value === 1 || value === '1';

const countActiveFilters = ({ estado = '', desde = '', hasta = '', sucursal = '' }) =>
  [estado, desde, hasta, sucursal].filter((value) => String(value || '').trim() !== '').length;

const CIERRES_HISTORIAL_PAGE_SIZE = 6;

const extractUserRoleNames = (user) => {
  const roleRows = Array.isArray(user?.roles) ? user.roles : [];
  const candidates = [
    user?.rol,
    user?.role,
    user?.rol_codigo,
    user?.codigo_rol,
    user?.rol_nombre,
    user?.nombre_rol,
    ...roleRows.flatMap((role) => {
      if (!role || typeof role !== 'object') return [role];
      return [
        role.codigo,
        role.codigo_rol,
        role.rol,
        role.role,
        role.nombre,
        role.nombre_rol,
        role.name
      ];
    })
  ];

  return normalizeRoles(candidates.filter(Boolean));
};

const resolveAdministrativeResolutionLabel = (closure = {}) => {
  const code = String(closure.resolucion_codigo || '').trim().toUpperCase();
  if (!code || code === 'PENDIENTE_REVISION') return 'Pendiente auditoria';
  if (code === 'CAJA_CUADRA') return 'Cuadrado';
  if (code === 'GASTO_EMPRESA') return 'Asumido por empresa';
  return closure.resolucion_nombre || closure.resolucion_label || 'Resuelto';
};

const withinDateRange = (value, from, to) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const isoDate = date.toISOString().slice(0, 10);
  if (from && isoDate < from) return false;
  if (to && isoDate > to) return false;
  return true;
};

export default function CierresCajaHistorialView() {
  const { user } = useAuth();
  const { canAny, isSuperAdmin } = usePermisos();
  const {
    detailLoading,
    saving,
    toast,
    openToast,
    closeToast,
    getSesionDetalle,
    editCierre,
    resolveCloseDifference
  } = useCierresCaja();

  const [selectedSucursalId, setSelectedSucursalId] = useState('');
  const [scopeInitialized, setScopeInitialized] = useState(false);
  const [sucursales, setSucursales] = useState([]);
  const [loadingSucursales, setLoadingSucursales] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    fecha_desde: '',
    fecha_hasta: '',
    estado: ''
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersDraft, setFiltersDraft] = useState({
    sucursal: '',
    fecha_desde: '',
    fecha_hasta: '',
    estado: ''
  });
  const [cierres, setCierres] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [selectedDetalle, setSelectedDetalle] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [resolveDetalle, setResolveDetalle] = useState(null);
  const [resolveOpen, setResolveOpen] = useState(false);
  const historyRequestIdRef = useRef(0);

  const userSucursalId = Number.parseInt(String(user?.id_sucursal ?? ''), 10);
  const canSelectSucursal =
    isSuperAdmin || canAny([PERMISSIONS.VENTAS_CAJAS_MULTISUCURSAL_VER]);
  const canViewDetail = canAny([
    PERMISSIONS.VENTAS_CAJAS_DETALLE_VER,
    PERMISSIONS.VENTAS_CAJAS_REPORTE_VER
  ]);
  const canViewHistory = canAny([PERMISSIONS.VENTAS_CAJAS_REPORTE_VER]);
  const canEditClose = canAny([PERMISSIONS.VENTAS_CAJAS_SESION_CERRAR]);
  const roleSet = useMemo(() => new Set(extractUserRoleNames(user)), [user]);
  const isAdminRole = roleSet.has('ADMIN') || roleSet.has('ADMINISTRADOR') || roleSet.has('SUPER_ADMIN');
  const canResolveDifference =
    (isSuperAdmin || isAdminRole) && canAny([PERMISSIONS.VENTAS_CAJAS_DIFERENCIA_RESOLVER]);

  const deferredSearch = useDeferredValue(search);
  const scopeQuery = useMemo(
    () => (canSelectSucursal ? buildScopeQuery(selectedSucursalId) : {}),
    [canSelectSucursal, selectedSucursalId]
  );
  const activeFilters = useMemo(
    () =>
      countActiveFilters({
        estado: filters.estado,
        desde: filters.fecha_desde,
        hasta: filters.fecha_hasta,
        sucursal: canSelectSucursal ? selectedSucursalId : ''
      }),
    [canSelectSucursal, filters.estado, filters.fecha_desde, filters.fecha_hasta, selectedSucursalId]
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
      sucursal: selectedSucursalId || '',
      fecha_desde: filters.fecha_desde || '',
      fecha_hasta: filters.fecha_hasta || '',
      estado: filters.estado || ''
    });
  }, [filters.estado, filters.fecha_desde, filters.fecha_hasta, filtersOpen, selectedSucursalId]);

  useEffect(() => {
    if (!canSelectSucursal) return undefined;

    let ignore = false;
    const loadBranchCatalog = async () => {
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
          .filter((row) => row.id_sucursal && row.nombre_sucursal)
          .sort((a, b) =>
            a.nombre_sucursal.localeCompare(b.nombre_sucursal, 'es', { sensitivity: 'base' })
          );
        setSucursales(rows);
      } catch (errorResponse) {
        if (!ignore) {
          openToast(
            'ERROR',
            extractCajasApiMessage(errorResponse, 'No se pudo cargar el catalogo de sucursales.'),
            'danger'
          );
        }
      } finally {
        if (!ignore) setLoadingSucursales(false);
      }
    };

    void loadBranchCatalog();
    return () => {
      ignore = true;
    };
  }, [canSelectSucursal, openToast]);

  useEffect(() => {
    if (!detailOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [detailOpen]);

  const loadHistory = useCallback(async () => {
    if (!canViewHistory) {
      setCierres([]);
      setError('');
      setLoading(false);
      return;
    }
    const requestId = historyRequestIdRef.current + 1;
    historyRequestIdRef.current = requestId;
    setLoading(true);
    setError('');
    try {
      const response = await cajasService.getReporteCierres(scopeQuery);
      if (historyRequestIdRef.current !== requestId) return;
      setCierres((Array.isArray(response) ? response : []).map(normalizeCierreReporte));
    } catch (errorResponse) {
      if (historyRequestIdRef.current !== requestId) return;
      const message = extractCajasApiMessage(
        errorResponse,
        'No se pudo cargar el historial de cierres.'
      );
      setCierres([]);
      setError(message);
      openToast('ERROR', message, 'danger');
    } finally {
      if (historyRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [canViewHistory, openToast, scopeQuery]);

  useEffect(() => {
    if (!scopeInitialized || !canViewHistory) return;
    void loadHistory();
  }, [canViewHistory, loadHistory, scopeInitialized]);

  useEffect(
    () => () => {
      historyRequestIdRef.current += 1;
    },
    []
  );

  const visibleCierres = useMemo(() => {
    return cierres.filter((closure) => {
      if (!matchesCajaClosure(closure, deferredSearch)) return false;

      if (filters.fecha_desde || filters.fecha_hasta) {
        if (!withinDateRange(closure.fecha_cierre, filters.fecha_desde, filters.fecha_hasta)) {
          return false;
        }
      }

      if (filters.estado) {
        const badge = resolveClosureStateBadge(closure);
        if (badge.key !== filters.estado) return false;
      }

      return true;
    });
  }, [cierres, deferredSearch, filters.estado, filters.fecha_desde, filters.fecha_hasta]);
  const historyPageData = useMemo(
    () => getPaginatedRows(visibleCierres, historyPage, CIERRES_HISTORIAL_PAGE_SIZE),
    [historyPage, visibleCierres]
  );

  useEffect(() => {
    setHistoryPage(1);
  }, [
    deferredSearch,
    filters.estado,
    filters.fecha_desde,
    filters.fecha_hasta,
    selectedSucursalId
  ]);

  const stats = useMemo(() => {
    const totalCierres = cierres.length;
    const cuadrados = cierres.filter((item) => Number(item.diferencia || 0) === 0).length;
    const pendientes = cierres.filter((item) => resolveClosureStateBadge(item).key === 'PENDIENTE').length;
    const diferenciaAcumulada = cierres.reduce((sum, item) => sum + Number(item.diferencia || 0), 0);

    return {
      totalCierres,
      cuadrados,
      pendientes,
      diferenciaAcumulada
    };
  }, [cierres]);

  const openDetalle = async (closure) => {
    if (!closure?.id_sesion_caja || !canViewDetail) return;
    setSelectedDetalle(null);
    setDetailOpen(true);

    try {
      const detail = await getSesionDetalle(closure.id_sesion_caja);
      setSelectedDetalle(detail);
    } catch {
      setDetailOpen(false);
      setSelectedDetalle(null);
    }
  };

  const handleResolveDifference = async (payload) => {
    const sourceDetalle = resolveDetalle || selectedDetalle;
    const idCierreCaja = sourceDetalle?.cierre?.id_cierre_caja;
    const idSesionCaja = sourceDetalle?.sesion?.id_sesion_caja;
    if (!idCierreCaja || !idSesionCaja) return null;

    const response = await resolveCloseDifference(idCierreCaja, payload);
    const detail = await getSesionDetalle(idSesionCaja);
    if (selectedDetalle?.sesion?.id_sesion_caja === idSesionCaja) {
      setSelectedDetalle(detail);
    }
    setResolveDetalle(detail);
    await loadHistory();
    return response;
  };

  const openResolveDifference = async (closure) => {
    if (!canResolveCierreDifference({
      cierre: closure,
      sesion: closure,
      canResolveDifference,
      canViewCajaTheoreticalAmounts: true
    })) {
      return;
    }
    setResolveDetalle(null);
    setResolveOpen(true);
    try {
      const detail = await getSesionDetalle(closure.id_sesion_caja);
      setResolveDetalle(detail);
    } catch {
      setResolveOpen(false);
      setResolveDetalle(null);
    }
  };

  const handleQuickEdit = async (closure) => {
    if (!canEditClose || !closure?.id_cierre_caja || !closure?.editable_en_ventana) return;
    const motivo = window.prompt('Motivo de edicion (obligatorio):', 'Ajuste operativo');
    if (!motivo || !motivo.trim()) return;
    const montoInput = window.prompt(
      'Monto declarado de cierre:',
      String(closure?.monto_declarado_cierre ?? '0')
    );
    if (montoInput === null) return;
    const parsed = Number(montoInput);
    if (!Number.isFinite(parsed) || parsed < 0) {
      openToast('ERROR', 'Monto declarado invalido.', 'danger');
      return;
    }

    try {
      await editCierre(closure.id_cierre_caja, {
        monto_declarado_cierre: parsed,
        id_resolucion_cierre_caja: closure.id_resolucion_cierre_caja || null,
        observacion_cierre: closure.resolucion_nombre || null,
        motivo_edicion: motivo.trim()
      });
      await loadHistory();
    } catch {
      // El hook ya muestra toast de error.
    }
  };

  const estadoOptions = useMemo(
    () => [
      { key: 'CUADRADO', label: 'Cuadrados' },
      { key: 'SOBRANTE', label: 'Sobrantes' },
      { key: 'RESUELTO', label: 'Resueltos' },
      { key: 'PENDIENTE', label: 'Pendientes auditoria' }
    ],
    []
  );

  const openFiltersDrawer = () => {
    setFiltersDraft({
      sucursal: selectedSucursalId || '',
      fecha_desde: filters.fecha_desde || '',
      fecha_hasta: filters.fecha_hasta || '',
      estado: filters.estado || ''
    });
    setFiltersOpen(true);
  };

  const clearFiltersDrawer = () => {
    setFiltersDraft({
      sucursal: '',
      fecha_desde: '',
      fecha_hasta: '',
      estado: ''
    });
  };

  const applyFiltersDrawer = () => {
    setFilters({
      fecha_desde: filtersDraft.fecha_desde,
      fecha_hasta: filtersDraft.fecha_hasta,
      estado: filtersDraft.estado
    });
    if (canSelectSucursal) {
      setSelectedSucursalId(filtersDraft.sucursal);
    }
    setFiltersOpen(false);
  };

  return (
    <>
      <div className="cierres-caja-page ventas-page d-flex flex-column gap-3 h-100 min-h-0">
        <section className="inv-catpro-card inv-prod-card border-0 bg-transparent shadow-none">
          <div
            className="inv-prod-header ventas-page__toolbar align-items-center bg-transparent px-0 pb-3"
            style={{ borderBottom: 'none' }}
          >
            <div className="inv-prod-title-wrap">
              <div className="inv-prod-title-row">
                <i
                  className="bi bi-clock-history text-danger inv-prod-title-icon"
                  style={{ background: 'rgba(220,53,69,0.12)' }}
                />
                <span className="inv-prod-title">Cierres e historial</span>
              </div>
              <div className="inv-prod-subtitle">
                Consulta de cierres realizados, diferencias y resoluciones por caja.
              </div>
            </div>

            <div className="inv-prod-header-actions inv-ins-header-actions ventas-page__toolbar-actions fidelizacion-toolbar cierres-caja-toolbar">
              <CollapsibleSearchInput
                value={search}
                onValueChange={setSearch}
                onSubmit={(value) => setSearch(String(value || '').trim())}
                placeholder="Buscar por caja, responsable, usuario de cierre o resolucion..."
                ariaLabel="Buscar cierres de caja"
                expandDirection="left"
                className="cierres-caja-toolbar__search-compact"
              />

              <button
                type="button"
                className="inv-prod-toolbar-btn bg-white border fidelizacion-toolbar__filter-btn"
                onClick={openFiltersDrawer}
              >
                <i className="bi bi-funnel" />
                <span>Filtros</span>
                {activeFilters > 0 ? (
                  <strong className="fidelizacion-toolbar__filter-count">{activeFilters}</strong>
                ) : null}
              </button>

              <button
                type="button"
                className="inv-prod-toolbar-btn bg-white border"
                onClick={() => void loadHistory()}
                disabled={loading}
                style={{ color: 'rgba(82, 44, 34, 0.86)' }}
              >
                <i className="bi bi-arrow-clockwise" />
                <span>Refrescar</span>
              </button>

              {stats.pendientes > 0 ? (
                <button
                  type="button"
                  className="inv-prod-toolbar-btn bg-white border cierres-caja-toolbar__cta"
                  onClick={() => setFilters((current) => ({ ...current, estado: 'PENDIENTE' }))}
                  style={{ color: 'rgba(154, 83, 25, 0.9)' }}
                >
                  <i className="bi bi-exclamation-circle" />
                  <span>Ver pendientes</span>
                </button>
              ) : null}
            </div>
          </div>

          <div className="inv-prod-kpis ventas-page__stats" aria-label="Resumen de cierres historicos">
            <div className="inv-prod-kpi ventas-page__stat-card">
              <div className="ventas-page__stat-icon text-primary border-0 bg-white">
                <i className="bi bi-journal-check" />
              </div>
              <div className="inv-prod-kpi-content">
                <span>Cierres visibles</span>
                <strong>{stats.totalCierres}</strong>
              </div>
            </div>

            <div className="inv-prod-kpi ventas-page__stat-card is-success">
              <div className="ventas-page__stat-icon text-success border-0 bg-white">
                <i className="bi bi-check2-circle" />
              </div>
              <div className="inv-prod-kpi-content">
                <span>Cierres cuadrados</span>
                <strong>{stats.cuadrados}</strong>
              </div>
            </div>

            <div className="inv-prod-kpi ventas-page__stat-card is-warning">
              <div className="ventas-page__stat-icon text-warning border-0 bg-white">
                <i className="bi bi-hourglass-split" />
              </div>
              <div className="inv-prod-kpi-content">
                <span>Pendientes de revisar</span>
                <strong>{stats.pendientes}</strong>
              </div>
            </div>

            <div className="inv-prod-kpi ventas-page__stat-card is-accent">
              <div className="ventas-page__stat-icon text-danger border-0 bg-white">
                <i className="bi bi-cash-stack" />
              </div>
              <div className="inv-prod-kpi-content">
                <span>Diferencia acumulada</span>
                <strong>L. {formatCajaCurrency(stats.diferenciaAcumulada)}</strong>
              </div>
            </div>
          </div>
        </section>

        <div className="ventas-page__table-card flex-grow-1 d-flex flex-column min-h-0">
          <div className="inv-prod-results-meta cierres-caja-results-meta">
            <span>{loading ? 'Cargando cierres...' : `${historyPageData.rows.length} resultados`}</span>
            <span>
              {loading
                ? ''
                : `Mostrando ${
                  historyPageData.total === 0 ? 0 : ((historyPageData.page - 1) * historyPageData.pageSize) + 1
                }-${
                  historyPageData.total === 0
                    ? 0
                    : Math.min(((historyPageData.page - 1) * historyPageData.pageSize) + historyPageData.rows.length, historyPageData.total)
                } de ${historyPageData.total}`}
            </span>
          </div>

          <div className="ventas-page__table-wrap flex-grow-1 cierres-caja-table-desktop">
            <table className="table ventas-page__table">
              <thead>
                <tr>
                  <th>Cierre</th>
                  <th>Caja</th>
                  <th>Responsable</th>
                  <th>Fecha cierre</th>
                  <th className="text-end">Declarado</th>
                  <th className="text-center">Resultado</th>
                  <th>Resolucion</th>
                  <th className="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" className="text-center py-5">
                      <div className="spinner-border text-danger" role="status" />
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan="8" className="text-center py-5">
                      <div className="ventas-create-modal__empty shadow-none border-0 bg-transparent">
                        <div className="ventas-create-modal__cart-empty-icon">
                          <i className="bi bi-exclamation-diamond text-danger" />
                        </div>
                        <span>{error}</span>
                      </div>
                    </td>
                  </tr>
                ) : visibleCierres.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-5">
                      <div className="ventas-create-modal__empty shadow-none border-0 bg-transparent">
                        <div className="ventas-create-modal__cart-empty-icon">
                          <i className="bi bi-journal-x text-secondary" />
                        </div>
                        <span>No hay cierres para los filtros aplicados.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  historyPageData.rows.map((closure) => {
                    const closureBadge = resolveClosureStateBadge(closure);
                    const resolutionLabel = resolveAdministrativeResolutionLabel(closure);
                    const canResolveClosure = canResolveCierreDifference({
                      cierre: closure,
                      sesion: closure,
                      canResolveDifference,
                      canViewCajaTheoreticalAmounts: true
                    });

                    return (
                      <tr
                        key={closure.id_cierre_caja}
                        className="ventas-page__table-row"
                        onClick={() => openDetalle(closure)}
                      >
                        <td>
                          <div className="ventas-page__table-sale">
                            <strong>CIE-{String(closure.id_cierre_caja).padStart(5, '0')}</strong>
                          </div>
                        </td>
                        <td className="align-middle">
                          <div className="ventas-page__table-sale">
                            <strong>{closure.nombre_caja || 'Caja sin nombre'}</strong>
                          </div>
                        </td>
                        <td className="align-middle">
                          <div className="ventas-page__table-sale">
                            <strong>{closure.responsable_nombre || 'Sin responsable'}</strong>
                          </div>
                        </td>
                        <td className="align-middle text-muted small fw-semibold">
                          {formatCajaDateTime(closure.fecha_cierre)}
                        </td>
                        <td className="text-end align-middle ventas-page__table-total">
                          L. {formatCajaCurrency(closure.monto_declarado_cierre)}
                        </td>
                        <td className="text-center align-middle">
                          <span className={`ventas-page__table-pill ${closureBadge.className}`}>
                            {closureBadge.label}
                          </span>
                        </td>
                        <td className="align-middle text-muted small fw-semibold">
                          {resolutionLabel}
                        </td>
                        <td className="text-end align-middle" onClick={(event) => event.stopPropagation()}>
                          <div className="d-inline-flex gap-2">
                            <button
                              type="button"
                              className="ventas-page__table-detail-btn"
                              title="Ver detalle"
                              onClick={() => openDetalle(closure)}
                              disabled={!canViewDetail}
                            >
                              <i className="bi bi-eye" />
                            </button>
                            {canResolveClosure ? (
                              <button
                                type="button"
                                className="ventas-page__table-detail-btn bg-white border-danger text-danger"
                                title="Resolver diferencia"
                                onClick={() => void openResolveDifference(closure)}
                                disabled={saving || detailLoading}
                              >
                                <i className="bi bi-shield-check" />
                              </button>
                            ) : null}
                            {canEditClose && closure.editable_en_ventana ? (
                              <button
                                type="button"
                                className="ventas-page__table-detail-btn bg-white border-warning text-warning"
                                title="Editar cierre"
                                onClick={() => void handleQuickEdit(closure)}
                                disabled={saving}
                              >
                                <i className="bi bi-pencil-square" />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="cierres-caja-mobile-list">
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-danger" role="status" />
              </div>
            ) : error ? (
              <div className="text-center py-4">
                <div className="ventas-create-modal__empty shadow-none border-0 bg-transparent">
                  <div className="ventas-create-modal__cart-empty-icon">
                    <i className="bi bi-exclamation-diamond text-danger" />
                  </div>
                  <span>{error}</span>
                </div>
              </div>
            ) : visibleCierres.length === 0 ? (
              <div className="text-center py-4">
                <div className="ventas-create-modal__empty shadow-none border-0 bg-transparent">
                  <div className="ventas-create-modal__cart-empty-icon">
                    <i className="bi bi-journal-x text-secondary" />
                  </div>
                  <span>No hay cierres para los filtros aplicados.</span>
                </div>
              </div>
            ) : (
              historyPageData.rows.map((closure) => {
                const closureBadge = resolveClosureStateBadge(closure);
                const resolutionLabel = resolveAdministrativeResolutionLabel(closure);
                const canResolveClosure = canResolveCierreDifference({
                  cierre: closure,
                  sesion: closure,
                  canResolveDifference,
                  canViewCajaTheoreticalAmounts: true
                });
                return (
                  <article key={closure.id_cierre_caja} className="cierres-caja-mobile-card">
                    <div className="cierres-caja-mobile-card__head">
                      <div>
                        <strong>CIE-{String(closure.id_cierre_caja).padStart(5, '0')}</strong>
                      </div>
                      <span className={`ventas-page__table-pill ${closureBadge.className}`}>
                        {closureBadge.label}
                      </span>
                    </div>

                    <div className="cierres-caja-mobile-card__body">
                      <div>
                        <span>Caja</span>
                        <strong>{closure.nombre_caja || 'Caja sin nombre'}</strong>
                      </div>
                      <div>
                        <span>Responsable</span>
                        <strong>{closure.responsable_nombre || 'Sin responsable'}</strong>
                      </div>
                      <div>
                        <span>Declarado</span>
                        <strong>L. {formatCajaCurrency(closure.monto_declarado_cierre)}</strong>
                      </div>
                      <div>
                        <span>Resolucion</span>
                        <strong>{resolutionLabel}</strong>
                      </div>
                    </div>

                    <div className="cierres-caja-mobile-card__meta">
                      <span>{formatCajaDateTime(closure.fecha_cierre)}</span>
                      <span className="text-muted fw-semibold">
                        {closure.diferencia === null || closure.diferencia === undefined
                          ? '-'
                          : `L. ${formatCajaCurrency(closure.diferencia)}`}
                      </span>
                    </div>

                    <div className="cierres-caja-mobile-card__actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => openDetalle(closure)}
                        disabled={!canViewDetail}
                      >
                        Ver detalle
                      </button>
                      {canResolveClosure ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => void openResolveDifference(closure)}
                          disabled={saving || detailLoading}
                        >
                          Resolver diferencia
                        </button>
                      ) : null}
                      {canEditClose && closure.editable_en_ventana ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-warning"
                          onClick={() => void handleQuickEdit(closure)}
                          disabled={saving}
                        >
                          Editar cierre
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })
            )}
          </div>

          {!loading && !error && historyPageData.total > 0 ? (
            <CierresCajaPagination
              totalItems={historyPageData.total}
              pageSize={historyPageData.pageSize}
              currentPage={historyPageData.page}
              onPageChange={setHistoryPage}
            />
          ) : null}
        </div>
      </div>

      <CierresCajaFiltersDrawer
        open={filtersOpen}
        title="Refina cierres e historial"
        subtitle="Ajusta estado y rango de fechas sin expandir la cabecera."
        activeFilters={activeFilters}
        onClose={() => setFiltersOpen(false)}
        onClear={clearFiltersDrawer}
        onApply={applyFiltersDrawer}
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
          <div className="inv-prod-drawer-section-title">Estado del cierre</div>
          <select
            className="form-select"
            value={filtersDraft.estado}
            onChange={(event) =>
              setFiltersDraft((current) => ({ ...current, estado: event.target.value }))
            }
          >
            <option value="">Todos los cierres</option>
            {estadoOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="inv-prod-drawer-section inv-cat-filter-card">
          <div className="inv-prod-drawer-section-title">Desde</div>
          <input
            type="date"
            className="form-control"
            value={filtersDraft.fecha_desde}
            onChange={(event) =>
              setFiltersDraft((current) => ({ ...current, fecha_desde: event.target.value }))
            }
          />
        </div>

        <div className="inv-prod-drawer-section inv-cat-filter-card">
          <div className="inv-prod-drawer-section-title">Hasta</div>
          <input
            type="date"
            className="form-control"
            value={filtersDraft.fecha_hasta}
            onChange={(event) =>
              setFiltersDraft((current) => ({ ...current, fecha_hasta: event.target.value }))
            }
          />
        </div>
      </CierresCajaFiltersDrawer>

      <CierreCajaDetalleModal
        open={detailOpen}
        detalle={selectedDetalle}
        loading={detailLoading}
        canRegisterArqueo={false}
        canCloseSession={false}
        canUseCloseFlow={false}
        canResolveDifference={canResolveDifference}
        saving={saving}
        onClose={() => {
          setDetailOpen(false);
          setSelectedDetalle(null);
        }}
        onOpenArqueo={() => {}}
        onOpenCerrar={() => {}}
        onResolveDifference={handleResolveDifference}
      />

      <CierreCajaResolverDiferenciaModal
        open={resolveOpen}
        detalle={resolveDetalle}
        saving={saving || detailLoading || !resolveDetalle}
        onClose={() => {
          if (saving) return;
          setResolveOpen(false);
          setResolveDetalle(null);
        }}
        onSubmit={handleResolveDifference}
      />

      <VentasToast toast={toast} onClose={closeToast} />
    </>
  );
}
