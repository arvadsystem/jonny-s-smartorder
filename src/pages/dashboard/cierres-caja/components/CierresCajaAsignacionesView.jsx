import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import { usePermisos } from '../../../../context/PermisosContext';
import sucursalesService from '../../../../services/sucursalesService';
import VentasToast from '../../ventas/components/VentasToast';
import CierreCajaDetalleModal from '../../ventas/components/cierres/CierreCajaDetalleModal';
import CierresCajaFiltersDrawer from './CierresCajaFiltersDrawer';
import { useCierresCaja } from '../../ventas/hooks/useCierresCaja';
import {
  extractCajasApiMessage,
  formatCajaDateTime,
  matchesCajaSession,
  resolveSessionStatusBadge
} from '../../ventas/utils/cajasHelpers';
import { PERMISSIONS } from '../../../../utils/permissions';

const buildScopeQuery = (value) => {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? { id_sucursal: parsed } : {};
};

const isTruthyState = (value) =>
  value === true || value === 'true' || value === 1 || value === '1';

const countActiveFilters = ({ estado_sesion = '' }) =>
  [estado_sesion].filter((value) => String(value || '').trim() !== '').length;

export default function CierresCajaAsignacionesView() {
  const { user } = useAuth();
  const { canAny, isSuperAdmin } = usePermisos();
  const {
    catalogos,
    sesiones,
    loadingCatalogos,
    loadingSesiones,
    detailLoading,
    error,
    toast,
    openToast,
    closeToast,
    loadCatalogos,
    loadSesiones,
    getSesionDetalle
  } = useCierresCaja();

  const [selectedSucursalId, setSelectedSucursalId] = useState('');
  const [scopeInitialized, setScopeInitialized] = useState(false);
  const [sucursales, setSucursales] = useState([]);
  const [loadingSucursales, setLoadingSucursales] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    estado_sesion: ''
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersDraft, setFiltersDraft] = useState({
    estado_sesion: ''
  });
  const [selectedDetalle, setSelectedDetalle] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const userSucursalId = Number.parseInt(String(user?.id_sucursal ?? ''), 10);
  const canSelectSucursal =
    isSuperAdmin || canAny([PERMISSIONS.VENTAS_CAJAS_MULTISUCURSAL_VER]);
  const canViewDetail = canAny([
    PERMISSIONS.VENTAS_CAJAS_DETALLE_VER,
    PERMISSIONS.VENTAS_CAJAS_REPORTE_VER
  ]);
  const canManageParticipants = canAny([PERMISSIONS.VENTAS_CAJAS_PARTICIPANTES_GESTIONAR]);

  const deferredSearch = useDeferredValue(search);
  const scopeQuery = useMemo(() => buildScopeQuery(selectedSucursalId), [selectedSucursalId]);
  const activeFilters = useMemo(
    () => countActiveFilters({ estado_sesion: filters.estado_sesion }),
    [filters.estado_sesion]
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
      estado_sesion: filters.estado_sesion || ''
    });
  }, [filters.estado_sesion, filtersOpen]);

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

  useEffect(() => {
    if (!scopeInitialized) return;
    void loadCatalogos(scopeQuery);
    void loadSesiones(scopeQuery);
  }, [loadCatalogos, loadSesiones, scopeInitialized, scopeQuery]);

  const visibleSesiones = useMemo(
    () =>
      sesiones.filter((session) => {
        if (!matchesCajaSession(session, deferredSearch)) return false;
        if (filters.estado_sesion) {
          return String(session.estado_codigo || '').toUpperCase() === String(filters.estado_sesion).toUpperCase();
        }
        return true;
      }),
    [deferredSearch, filters.estado_sesion, sesiones]
  );

  const stats = useMemo(() => {
    const activas = sesiones.filter((item) => item.estado_codigo === 'ABIERTA');
    const responsables = new Set(
      activas.map((item) => item.id_usuario_responsable).filter(Boolean)
    );

    return {
      cajasVisibles: catalogos.cajas.length,
      sesionesActivas: activas.length,
      responsablesActivos: responsables.size,
      gestionHabilitada: canManageParticipants
    };
  }, [canManageParticipants, catalogos.cajas.length, sesiones]);

  const openDetalle = async (sesion) => {
    if (!sesion?.id_sesion_caja || !canViewDetail) return;
    setSelectedDetalle(null);
    setDetailOpen(true);

    try {
      const detail = await getSesionDetalle(sesion.id_sesion_caja);
      setSelectedDetalle(detail);
    } catch {
      setDetailOpen(false);
      setSelectedDetalle(null);
    }
  };

  const openFiltersDrawer = () => {
    setFiltersDraft({
      estado_sesion: filters.estado_sesion || ''
    });
    setFiltersOpen(true);
  };

  const clearFiltersDrawer = () => {
    setFiltersDraft({
      estado_sesion: ''
    });
  };

  const applyFiltersDrawer = () => {
    setFilters({
      estado_sesion: filtersDraft.estado_sesion
    });
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
                  className="bi bi-people-fill text-danger inv-prod-title-icon"
                  style={{ background: 'rgba(220,53,69,0.12)' }}
                />
                <span className="inv-prod-title">Asignaciones operativas</span>
              </div>
              <div className="inv-prod-subtitle">
                Consulta de sesiones, responsables y equipo activo por caja.
              </div>
            </div>

            <div className="inv-prod-header-actions inv-ins-header-actions ventas-page__toolbar-actions fidelizacion-toolbar cierres-caja-toolbar">
              <input
                type="search"
                className="form-control fidelizacion-toolbar__search-input cierres-caja-toolbar__search-input"
                placeholder="Buscar por caja, sucursal o responsable..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />

              {canSelectSucursal ? (
                <div className="cierres-caja-toolbar__scope-inline" aria-label="Sucursal visible">
                  <i className="bi bi-shop" aria-hidden="true" />
                  <span className="cierres-caja-toolbar__scope-inline-label">Sucursal visible</span>
                  <select
                    className="form-select cierres-caja-toolbar__scope-inline-select"
                    value={selectedSucursalId}
                    onChange={(event) => setSelectedSucursalId(event.target.value)}
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
                onClick={() => {
                  void loadCatalogos(scopeQuery);
                  void loadSesiones(scopeQuery);
                }}
                disabled={loadingCatalogos || loadingSesiones}
                style={{ color: 'rgba(82, 44, 34, 0.86)' }}
              >
                <i className="bi bi-arrow-clockwise" />
                <span>Refrescar</span>
              </button>

              {canManageParticipants ? (
                <button
                  type="button"
                  className="inv-prod-toolbar-btn bg-white border cierres-caja-toolbar__cta"
                  onClick={() => setFilters((current) => ({ ...current, estado_sesion: 'ABIERTA' }))}
                  style={{ color: 'rgba(154, 83, 25, 0.9)' }}
                >
                  <i className="bi bi-unlock" />
                  <span>Solo abiertas</span>
                </button>
              ) : null}
            </div>
          </div>

          <div className="inv-prod-kpis ventas-page__stats" aria-label="Resumen operativo de asignaciones">
            <div className="inv-prod-kpi ventas-page__stat-card">
              <div className="ventas-page__stat-icon text-primary border-0 bg-white">
                <i className="bi bi-safe2" />
              </div>
              <div className="inv-prod-kpi-content">
                <span>Cajas visibles</span>
                <strong>{stats.cajasVisibles}</strong>
              </div>
            </div>
            <div className="inv-prod-kpi ventas-page__stat-card is-success">
              <div className="ventas-page__stat-icon text-success border-0 bg-white">
                <i className="bi bi-unlock-fill" />
              </div>
              <div className="inv-prod-kpi-content">
                <span>Sesiones activas</span>
                <strong>{stats.sesionesActivas}</strong>
              </div>
            </div>
            <div className="inv-prod-kpi ventas-page__stat-card is-warning">
              <div className="ventas-page__stat-icon text-warning border-0 bg-white">
                <i className="bi bi-person-check" />
              </div>
              <div className="inv-prod-kpi-content">
                <span>Responsables activos</span>
                <strong>{stats.responsablesActivos}</strong>
              </div>
            </div>
            <div className="inv-prod-kpi ventas-page__stat-card is-accent">
              <div className="ventas-page__stat-icon text-danger border-0 bg-white">
                <i className="bi bi-diagram-3" />
              </div>
              <div className="inv-prod-kpi-content">
                <span>Gestion operativa</span>
                <strong>{stats.gestionHabilitada ? 'Participantes por sesion' : 'Solo consulta'}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="cierres-caja-assignment__notice">
          <div className="cierres-caja-assignment__notice-icon">
            <i className="bi bi-info-circle-fill" />
          </div>
          <div>
            <strong>Estado real del backend de Asignaciones</strong>
            <p>
              La API actual permite agregar e inactivar participantes por sesion abierta
              (`/ventas/cajas/sesiones/:id/participantes`). No existe aun un CRUD REST dedicado para
              autorizaciones permanentes en `cajas_usuarios_autorizados`.
            </p>
          </div>
        </section>

        <div className="ventas-page__table-card flex-grow-1 d-flex flex-column min-h-0">
          <div className="ventas-page__table-wrap flex-grow-1 cierres-caja-table-desktop">
            <table className="table ventas-page__table">
              <thead>
                <tr>
                  <th>Sesion</th>
                  <th>Caja</th>
                  <th>Responsable</th>
                  <th>Fecha apertura</th>
                  <th className="text-center">Estado</th>
                  <th className="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loadingSesiones ? (
                  <tr>
                    <td colSpan="6" className="text-center py-5">
                      <div className="spinner-border text-danger" role="status" />
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan="6" className="text-center py-5">
                      <div className="ventas-create-modal__empty shadow-none border-0 bg-transparent">
                        <div className="ventas-create-modal__cart-empty-icon">
                          <i className="bi bi-exclamation-diamond text-danger" />
                        </div>
                        <span>{error}</span>
                      </div>
                    </td>
                  </tr>
                ) : visibleSesiones.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-5">
                      <div className="ventas-create-modal__empty shadow-none border-0 bg-transparent">
                        <div className="ventas-create-modal__cart-empty-icon">
                          <i className="bi bi-people text-secondary" />
                        </div>
                        <span>No hay sesiones visibles para revisar asignaciones operativas.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  visibleSesiones.map((sesion) => {
                    const statusBadge = resolveSessionStatusBadge(sesion);
                    return (
                      <tr
                        key={sesion.id_sesion_caja}
                        className="ventas-page__table-row"
                        onClick={() => openDetalle(sesion)}
                      >
                        <td>
                          <div className="ventas-page__table-sale">
                            <strong>SES-{String(sesion.id_sesion_caja).padStart(5, '0')}</strong>
                            <span>{sesion.nombre_sucursal || 'Sin sucursal'}</span>
                          </div>
                        </td>
                        <td className="align-middle">
                          <div className="ventas-page__table-sale">
                            <strong>{sesion.nombre_caja || 'Caja sin nombre'}</strong>
                            <span>{sesion.codigo_caja || 'Sin codigo'}</span>
                          </div>
                        </td>
                        <td className="align-middle">
                          <div className="ventas-page__table-sale">
                            <strong>{sesion.responsable_nombre || 'Sin responsable'}</strong>
                            <span>{sesion.responsable_usuario ? `@${sesion.responsable_usuario}` : 'Sin usuario'}</span>
                          </div>
                        </td>
                        <td className="align-middle text-muted small fw-semibold">
                          {formatCajaDateTime(sesion.fecha_apertura)}
                        </td>
                        <td className="text-center align-middle">
                          <span className={`ventas-page__table-pill ${statusBadge.className}`}>
                            {statusBadge.label}
                          </span>
                        </td>
                        <td className="text-end align-middle" onClick={(event) => event.stopPropagation()}>
                          <button
                            type="button"
                            className="ventas-page__table-detail-btn"
                            title="Ver equipo de sesion"
                            onClick={() => openDetalle(sesion)}
                            disabled={!canViewDetail}
                          >
                            <i className="bi bi-eye" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="cierres-caja-mobile-list">
            {loadingSesiones ? (
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
            ) : visibleSesiones.length === 0 ? (
              <div className="text-center py-4">
                <div className="ventas-create-modal__empty shadow-none border-0 bg-transparent">
                  <div className="ventas-create-modal__cart-empty-icon">
                    <i className="bi bi-people text-secondary" />
                  </div>
                  <span>No hay sesiones visibles para revisar asignaciones operativas.</span>
                </div>
              </div>
            ) : (
              visibleSesiones.map((sesion) => {
                const statusBadge = resolveSessionStatusBadge(sesion);
                return (
                  <article key={sesion.id_sesion_caja} className="cierres-caja-mobile-card">
                    <div className="cierres-caja-mobile-card__head">
                      <div>
                        <strong>SES-{String(sesion.id_sesion_caja).padStart(5, '0')}</strong>
                        <small>{sesion.nombre_sucursal || 'Sin sucursal'}</small>
                      </div>
                      <span className={`ventas-page__table-pill ${statusBadge.className}`}>
                        {statusBadge.label}
                      </span>
                    </div>

                    <div className="cierres-caja-mobile-card__body">
                      <div>
                        <span>Caja</span>
                        <strong>{sesion.nombre_caja || 'Caja sin nombre'}</strong>
                      </div>
                      <div>
                        <span>Responsable</span>
                        <strong>{sesion.responsable_nombre || 'Sin responsable'}</strong>
                      </div>
                      <div>
                        <span>Usuario</span>
                        <strong>{sesion.responsable_usuario ? `@${sesion.responsable_usuario}` : 'Sin usuario'}</strong>
                      </div>
                      <div>
                        <span>Apertura</span>
                        <strong>{formatCajaDateTime(sesion.fecha_apertura)}</strong>
                      </div>
                    </div>

                    <div className="cierres-caja-mobile-card__actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => openDetalle(sesion)}
                        disabled={!canViewDetail}
                      >
                        Ver detalle
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      </div>

      <CierresCajaFiltersDrawer
        open={filtersOpen}
        title="Refina asignaciones operativas"
        subtitle="Filtra las sesiones por estado para revisar responsables y participantes."
        activeFilters={activeFilters}
        onClose={() => setFiltersOpen(false)}
        onClear={clearFiltersDrawer}
        onApply={applyFiltersDrawer}
      >
        <div className="inv-prod-drawer-section inv-cat-filter-card">
          <div className="inv-prod-drawer-section-title">Estado de sesion</div>
          <select
            className="form-select"
            value={filtersDraft.estado_sesion}
            onChange={(event) =>
              setFiltersDraft((current) => ({ ...current, estado_sesion: event.target.value }))
            }
          >
            <option value="">Todas las sesiones</option>
            {(Array.isArray(catalogos.estados_sesion) ? catalogos.estados_sesion : []).map((estado) => (
              <option key={estado.id_estado_sesion_caja} value={estado.codigo}>
                {estado.nombre}
              </option>
            ))}
          </select>
        </div>
      </CierresCajaFiltersDrawer>

      <CierreCajaDetalleModal
        open={detailOpen}
        detalle={selectedDetalle}
        loading={detailLoading}
        canRegisterArqueo={false}
        canCloseSession={false}
        canUseCloseFlow={false}
        onClose={() => {
          setDetailOpen(false);
          setSelectedDetalle(null);
        }}
        onOpenArqueo={() => {}}
        onOpenCerrar={() => {}}
      />

      <VentasToast toast={toast} onClose={closeToast} />
    </>
  );
}
