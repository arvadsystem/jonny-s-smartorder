import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePermisos } from '../../../context/PermisosContext';
import { PERMISSIONS } from '../../../utils/permissions';
import sucursalesService from '../../../services/sucursalesService';
import planillasService from '../../../services/planillasService';
import PlanillasHeader from './components/planillas/PlanillasHeader';
import PlanillasResumenCards from './components/planillas/PlanillasResumenCards';
import PlanillasTable from './components/planillas/PlanillasTable';
import {
  PlanillasLoadingState,
  PlanillasErrorState,
  PlanillasEmptyState
} from './components/planillas/PlanillasStates';
import PlanillaDetallePanel from './components/planillas/PlanillaDetallePanel';
import PlanillaMovimientosModal from './components/planillas/PlanillaMovimientosModal';
import PlanillaMovimientoFormModal from './components/planillas/PlanillaMovimientoFormModal';
import PlanillaAdelantosModal from './components/planillas/PlanillaAdelantosModal';
import PlanillaAuditoriaModal from './components/planillas/PlanillaAuditoriaModal';

const LIST_LIMIT = 20;
const DETAIL_LIMIT = 10;

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const toText = (value, fallback = '') => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

const normalizeListResponse = (response) => {
  if (Array.isArray(response)) {
    return { items: response, total: response.length, page: 1, limit: response.length || 1 };
  }

  const items = Array.isArray(response?.items)
    ? response.items
    : Array.isArray(response?.data)
      ? response.data
      : Array.isArray(response?.rows)
        ? response.rows
        : [];

  return {
    items,
    total: Number(response?.total ?? items.length) || items.length,
    page: Number(response?.page ?? 1) || 1,
    limit: Number(response?.limit ?? Math.max(items.length, 1)) || Math.max(items.length, 1)
  };
};

const normalizeResumen = (response) => {
  if (!response) return {};
  if (response.data && typeof response.data === 'object') return response.data;
  if (Array.isArray(response.items) && response.items[0]) return response.items[0];
  if (Array.isArray(response) && response[0]) return response[0];
  if (typeof response === 'object') return response;
  return {};
};

const normalizeSucursalId = (value) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? String(parsed) : '';
};

export default function Planillas({
  openToast,
  selectedSucursalId = '',
  onSelectedSucursalChange,
}) {
  const { canAny } = usePermisos();

  const canView = canAny([PERMISSIONS.PLANILLAS_LISTADO_VER, PERMISSIONS.PLANILLAS_MODULO_VER]);
  const canViewDetalle = canAny([PERMISSIONS.PLANILLAS_DETALLE_VER]);
  const canGenerar = canAny([PERMISSIONS.PLANILLAS_GENERAR]);
  const canRecalcular = canAny([PERMISSIONS.PLANILLAS_RECALCULAR]);
  const canAplicarAdelantos = canAny([PERMISSIONS.PLANILLAS_ADELANTOS_APLICAR]);
  const canRegistrarMovimiento = canAny([PERMISSIONS.PLANILLAS_MOVIMIENTO_REGISTRAR]);
  const canAnularMovimiento = canAny([PERMISSIONS.PLANILLAS_MOVIMIENTO_ANULAR]);
  const canCerrar = canAny([PERMISSIONS.PLANILLAS_CERRAR]);
  const canPagar = canAny([PERMISSIONS.PLANILLAS_PAGAR]);
  const canAnular = canAny([PERMISSIONS.PLANILLAS_ANULAR]);
  const canVerAuditoria = canAny([PERMISSIONS.PLANILLAS_AUDITORIA_VER]);

  const safeToast = useCallback(
    (title, message, variant = 'success') => {
      if (typeof openToast === 'function') openToast(title, message, variant);
    },
    [openToast]
  );

  const [sucursales, setSucursales] = useState([]);
  const [selectedSucursal, setSelectedSucursal] = useState('');
  const [periodo, setPeriodo] = useState(currentMonth());
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [search, setSearch] = useState('');
  const [listPage, setListPage] = useState(1);

  const [planillas, setPlanillas] = useState([]);
  const [planillasTotal, setPlanillasTotal] = useState(0);
  const [selectedPlanillaId, setSelectedPlanillaId] = useState('');

  const [resumen, setResumen] = useState({});
  const [adelantosPendientes, setAdelantosPendientes] = useState([]);
  const [detalle, setDetalle] = useState([]);
  const [detallePage, setDetallePage] = useState(1);
  const [detalleTotal, setDetalleTotal] = useState(0);

  const [loadingSucursales, setLoadingSucursales] = useState(true);
  const [loadingPlanillas, setLoadingPlanillas] = useState(false);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [listError, setListError] = useState('');

  const [detailItem, setDetailItem] = useState(null);

  const [movimientosModal, setMovimientosModal] = useState({
    open: false,
    item: null,
    loading: false,
    items: []
  });

  const [movimientoFormModal, setMovimientoFormModal] = useState({
    open: false,
    tipo: 'bono',
    item: null,
    loading: false
  });

  const [adelantosModal, setAdelantosModal] = useState({
    open: false,
    item: null,
    loading: false,
    applying: false,
    items: []
  });

  const [auditoriaModal, setAuditoriaModal] = useState({
    open: false,
    loading: false,
    items: []
  });

  const externalSucursalId = useMemo(
    () => normalizeSucursalId(selectedSucursalId),
    [selectedSucursalId]
  );

  const handleSucursalChange = useCallback(
    (value) => {
      const normalized = normalizeSucursalId(value);
      setSelectedSucursal(normalized);
      if (typeof onSelectedSucursalChange === 'function') {
        onSelectedSucursalChange(normalized);
      }
    },
    [onSelectedSucursalChange]
  );

  const selectedPlanilla = useMemo(
    () =>
      planillas.find((planilla) => String(planilla.id_planilla ?? '') === String(selectedPlanillaId)) ||
      null,
    [planillas, selectedPlanillaId]
  );

  const sucursalOptions = useMemo(
    () =>
      (Array.isArray(sucursales) ? sucursales : []).map((sucursal) => ({
        value: String(sucursal.id_sucursal),
        label:
          sucursal.nombre_sucursal ||
          sucursal.nombre ||
          sucursal.sucursal ||
          `Sucursal #${sucursal.id_sucursal}`
      })),
    [sucursales]
  );

  const loadSucursales = useCallback(async () => {
    setLoadingSucursales(true);
    try {
      const response = await sucursalesService.getAll();
      const parsed = normalizeListResponse(response);
      setSucursales(parsed.items);

      const currentSucursalId = normalizeSucursalId(externalSucursalId || selectedSucursal);
      const hasCurrentSucursal = currentSucursalId
        ? parsed.items.some(
            (item) => normalizeSucursalId(item?.id_sucursal) === currentSucursalId
          )
        : false;

      if (!hasCurrentSucursal) {
        const fallbackSucursal = normalizeSucursalId(parsed.items[0]?.id_sucursal);
        if (fallbackSucursal) {
          handleSucursalChange(fallbackSucursal);
        }
      }
    } catch (error) {
      safeToast('ERROR', error.message || 'No se pudieron cargar sucursales', 'danger');
    } finally {
      setLoadingSucursales(false);
    }
  }, [externalSucursalId, handleSucursalChange, safeToast, selectedSucursal]);

  useEffect(() => {
    if (!externalSucursalId) return;
    setSelectedSucursal((previous) => (previous === externalSucursalId ? previous : externalSucursalId));
  }, [externalSucursalId]);

  const loadPlanillas = useCallback(async () => {
    if (!canView || !selectedSucursal) {
      setPlanillas([]);
      setSelectedPlanillaId('');
      return;
    }

    setLoadingPlanillas(true);
    setListError('');

    try {
      const response = await planillasService.listarPlanillas({
        page: listPage,
        limit: LIST_LIMIT,
        id_sucursal: selectedSucursal,
        periodo,
        search,
        estado: estadoFiltro || undefined
      });

      const parsed = normalizeListResponse(response);
      setPlanillas(parsed.items);
      setPlanillasTotal(parsed.total);

      if (parsed.items.length === 0) {
        setSelectedPlanillaId('');
        return;
      }

      const stillExists = parsed.items.some(
        (planilla) => String(planilla.id_planilla ?? '') === String(selectedPlanillaId)
      );

      if (!selectedPlanillaId || !stillExists) {
        setSelectedPlanillaId(String(parsed.items[0].id_planilla ?? ''));
      }
    } catch (error) {
      setListError(error.message || 'No se pudo cargar planillas');
      setPlanillas([]);
      setPlanillasTotal(0);
      setSelectedPlanillaId('');
    } finally {
      setLoadingPlanillas(false);
    }
  }, [canView, estadoFiltro, listPage, periodo, search, selectedPlanillaId, selectedSucursal]);

  const loadDetalleAndResumen = useCallback(async () => {
    if (!selectedPlanilla?.id_planilla || !canViewDetalle) {
      setDetalle([]);
      setResumen({});
      setDetalleTotal(0);
      return;
    }

    setLoadingDetalle(true);
    try {
      const [resumenResp, detalleResp] = await Promise.all([
        planillasService.obtenerResumenPlanilla(selectedPlanilla.id_planilla),
        planillasService.listarDetallePlanilla(selectedPlanilla.id_planilla, {
          page: detallePage,
          limit: DETAIL_LIMIT,
          search
        })
      ]);

      setResumen(normalizeResumen(resumenResp));
      const parsedDetalle = normalizeListResponse(detalleResp);
      setDetalle(parsedDetalle.items);
      setDetalleTotal(parsedDetalle.total);
    } catch (error) {
      safeToast('ERROR', error.message || 'No se pudo cargar el detalle de planilla', 'danger');
      setDetalle([]);
      setDetalleTotal(0);
      setResumen({});
    } finally {
      setLoadingDetalle(false);
    }
  }, [canViewDetalle, detallePage, safeToast, search, selectedPlanilla?.id_planilla]);

  const loadAdelantosPendientes = useCallback(async () => {
    if (!selectedSucursal || !canViewDetalle) {
      setAdelantosPendientes([]);
      return;
    }

    try {
      const response = await planillasService.listarAdelantosPendientesSucursal(selectedSucursal, {
        page: 1,
        limit: 10,
        periodo
      });
      setAdelantosPendientes(normalizeListResponse(response).items);
    } catch {
      setAdelantosPendientes([]);
    }
  }, [canViewDetalle, periodo, selectedSucursal]);

  useEffect(() => {
    loadSucursales();
  }, [loadSucursales]);

  useEffect(() => {
    setListPage(1);
  }, [selectedSucursal, periodo, estadoFiltro, search]);

  useEffect(() => {
    loadPlanillas();
  }, [loadPlanillas]);

  useEffect(() => {
    setDetallePage(1);
  }, [selectedPlanillaId, search]);

  useEffect(() => {
    loadDetalleAndResumen();
  }, [loadDetalleAndResumen]);

  useEffect(() => {
    loadAdelantosPendientes();
  }, [loadAdelantosPendientes]);

  const withAction = useCallback(
    async (task, successMessage) => {
      setLoadingAction(true);
      try {
        await task();
        if (successMessage) safeToast('OK', successMessage, 'success');
        await Promise.all([loadPlanillas(), loadDetalleAndResumen(), loadAdelantosPendientes()]);
      } catch (error) {
        safeToast('ERROR', error.message || 'No se pudo ejecutar la accion', 'danger');
      } finally {
        setLoadingAction(false);
      }
    },
    [loadAdelantosPendientes, loadDetalleAndResumen, loadPlanillas, safeToast]
  );

  const handleGenerar = () =>
    withAction(
      () => planillasService.generarPlanilla({ id_sucursal: Number(selectedSucursal), periodo }),
      'Planilla generada correctamente'
    );

  const handleRecalcular = () =>
    withAction(
      () => planillasService.recalcularPlanilla(selectedPlanilla.id_planilla, {}),
      'Planilla recalculada correctamente'
    );

  const handleChangeEstado = (estado) => {
    if (!selectedPlanilla?.id_planilla) return;
    const estadoMap = {
      cerrada: 'CALCULADA',
      pagada: 'PAGADA',
      anulada: 'ANULADA',
      borrador: 'BORRADOR',
      calculada: 'CALCULADA',
    };
    const estadoLabelMap = {
      cerrada: 'cerrar',
      pagada: 'pagar',
      anulada: 'anular',
      borrador: 'marcar como borrador',
      calculada: 'calcular',
    };
    const normalizedEstado = estadoMap[String(estado || '').toLowerCase()] || estado;
    const actionLabel = estadoLabelMap[String(estado || '').toLowerCase()] || 'actualizar estado';
    const ok = window.confirm(`Confirma que deseas ${actionLabel} la planilla seleccionada?`);
    if (!ok) return;
    withAction(
      () =>
        planillasService.actualizarEstadoPlanilla(selectedPlanilla.id_planilla, {
          estado: normalizedEstado,
        }),
      `Planilla marcada como ${estado}`
    );
  };

  const handleAnular = () => {
    if (!selectedPlanilla?.id_planilla) return;
    const motivo = window.prompt('Motivo de anulacion de planilla:') || '';
    if (!window.confirm('Esta accion anulara la planilla completa y revertira adelantos aplicados. Deseas continuar?')) return;
    withAction(
      () => planillasService.anularPlanilla(selectedPlanilla.id_planilla, { motivo }),
      'Planilla anulada correctamente'
    );
  };

  const openMovimientos = async (item) => {
    setMovimientosModal({ open: true, item, loading: true, items: [] });
    try {
      const response = await planillasService.listarMovimientosPlanilla(selectedPlanilla.id_planilla, {
        page: 1,
        limit: 50,
        id_detalle: item.id_detalle_planilla || item.id_detalle
      });
      setMovimientosModal({ open: true, item, loading: false, items: normalizeListResponse(response).items });
    } catch (error) {
      setMovimientosModal({ open: true, item, loading: false, items: [] });
      safeToast('ERROR', error.message || 'No se pudieron cargar movimientos', 'danger');
    }
  };

  const openAdelantos = async (item) => {
    setAdelantosModal({ open: true, item, loading: true, applying: false, items: [] });
    try {
      const response = await planillasService.listarAdelantosAplicablesPlanilla(selectedPlanilla.id_planilla, {
        page: 1,
        limit: 50,
        id_detalle: item.id_detalle_planilla || item.id_detalle
      });
      setAdelantosModal({
        open: true,
        item,
        loading: false,
        applying: false,
        items: normalizeListResponse(response).items
      });
    } catch (error) {
      setAdelantosModal({ open: true, item, loading: false, applying: false, items: [] });
      safeToast('ERROR', error.message || 'No se pudieron cargar adelantos', 'danger');
    }
  };

  const openAuditoria = async () => {
    if (!selectedPlanilla?.id_planilla) return;
    setAuditoriaModal({ open: true, loading: true, items: [] });
    try {
      const response = await planillasService.listarAuditoriaPlanilla(selectedPlanilla.id_planilla, {
        page: 1,
        limit: 100
      });
      setAuditoriaModal({ open: true, loading: false, items: normalizeListResponse(response).items });
    } catch (error) {
      setAuditoriaModal({ open: true, loading: false, items: [] });
      safeToast('ERROR', error.message || 'No se pudo cargar la auditoria', 'danger');
    }
  };

  const handleAnularMovimiento = (movimiento) => {
    const id = movimiento.id_movimiento_planilla || movimiento.id_movimiento;
    if (!id) return;
    const motivo = window.prompt('Motivo de anulacion del movimiento:') || '';
    if (!window.confirm('Deseas anular este movimiento de planilla?')) return;

    withAction(
      async () => {
        await planillasService.anularMovimientoPlanilla(id, { motivo });
        if (movimientosModal.item) {
          await openMovimientos(movimientosModal.item);
        }
      },
      'Movimiento anulado correctamente'
    );
  };

  const totalPagesDetalle = Math.max(1, Math.ceil(detalleTotal / DETAIL_LIMIT));
  const hasNoData = !loadingPlanillas && planillas.length === 0;

  if (!canView) {
    return (
      <div className="personas-page personas-page--planillas">
        <div className="inv-catpro-card inv-prod-card personas-page__panel mb-3 p-4">
          <div className="inv-catpro-empty">
            <div className="inv-catpro-empty-title">Sin permisos para Planillas</div>
            <div className="inv-catpro-empty-sub">
              Solicita el permiso PLANILLAS_MODULO_VER para acceder al submodulo.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="personas-page personas-page--planillas">
      <div className="inv-catpro-card inv-prod-card personas-page__panel mb-3">
        <div className="inv-catpro-body inv-prod-body p-3">
          <PlanillasHeader
            sucursalOptions={sucursalOptions}
            sucursalId={selectedSucursal}
            onSucursalChange={handleSucursalChange}
            periodo={periodo}
            onPeriodoChange={setPeriodo}
            selectedPlanilla={selectedPlanilla}
            onGenerar={handleGenerar}
            onRecalcular={handleRecalcular}
            onCerrar={() => handleChangeEstado('cerrada')}
            onPagar={() => handleChangeEstado('pagada')}
            onAnular={handleAnular}
            canGenerar={canGenerar}
            canRecalcular={canRecalcular}
            canCerrar={canCerrar}
            canPagar={canPagar}
            canAnular={canAnular}
            loadingAction={loadingAction || loadingSucursales}
          />

          <div className="planillas-toolbar">
            <div className="planillas-toolbar__field">
              <label htmlFor="planillas-select">Planilla</label>
              <select
                id="planillas-select"
                className="form-select"
                value={selectedPlanillaId}
                onChange={(event) => setSelectedPlanillaId(event.target.value)}
                disabled={loadingPlanillas || planillas.length === 0}
              >
                <option value="">Seleccione planilla</option>
                {planillas.map((planilla) => (
                  <option key={planilla.id_planilla} value={planilla.id_planilla}>
                    {planilla.codigo_planilla || `Planilla #${planilla.id_planilla}`} ·{' '}
                    {planilla.estado_descripcion ||
                      planilla.estado_planilla ||
                      planilla.estado ||
                      'Sin estado'}
                  </option>
                ))}
              </select>
            </div>

            <div className="planillas-toolbar__field">
              <label htmlFor="planillas-search">Buscar en detalle</label>
              <input
                id="planillas-search"
                type="search"
                className="form-control"
                placeholder="Nombre, DNI, cargo..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <div className="planillas-toolbar__field">
              <label htmlFor="planillas-estado-filtro">Estado</label>
              <select
                id="planillas-estado-filtro"
                className="form-select"
                value={estadoFiltro}
                onChange={(event) => setEstadoFiltro(event.target.value)}
              >
                <option value="">Todos</option>
                <option value="BORRADOR">Borrador</option>
                <option value="CALCULADA">Calculada</option>
                <option value="PAGADA">Pagada</option>
                <option value="ANULADA">Anulada</option>
              </select>
            </div>

            {canVerAuditoria ? (
              <div className="planillas-toolbar__audit">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={openAuditoria}
                  disabled={!selectedPlanilla?.id_planilla}
                >
                  <i className="bi bi-clock-history me-1" />
                  Auditoria
                </button>
              </div>
            ) : null}
          </div>

          <div className="planillas-alerts">
            <div className="planillas-alert planillas-alert--info">
              <i className="bi bi-info-circle" />
              <span>Horas extra tipo tiempo x tiempo se reflejan en el detalle de planilla.</span>
            </div>
            <div className="planillas-alert planillas-alert--warning">
              <i className="bi bi-wallet2" />
              <span>
                Adelantos pendientes en sucursal: <strong>{adelantosPendientes.length}</strong>
              </span>
            </div>
          </div>

          <PlanillasResumenCards resumen={resumen} />

          <div className="inv-prod-results-meta personas-page__results-meta">
            <span>
              {loadingPlanillas
                ? 'Cargando planillas...'
                : `Planillas: ${planillas.length} (total: ${planillasTotal})`}
            </span>
            <span>
              {loadingDetalle ? 'Cargando detalle...' : `Detalle: ${detalle.length} (total: ${detalleTotal})`}
            </span>
          </div>

          {loadingPlanillas ? (
            <PlanillasLoadingState message="Cargando planillas..." />
          ) : listError ? (
            <PlanillasErrorState message={listError} onRetry={loadPlanillas} />
          ) : hasNoData ? (
            <PlanillasEmptyState onGenerar={handleGenerar} canGenerar={canGenerar} />
          ) : loadingDetalle ? (
            <PlanillasLoadingState message="Cargando detalle de planilla..." />
          ) : (
            <>
              <PlanillasTable
                items={detalle}
                page={detallePage}
                limit={DETAIL_LIMIT}
                onOpenDetalle={setDetailItem}
                onOpenMovimientos={openMovimientos}
                onOpenBono={(item) => setMovimientoFormModal({ open: true, tipo: 'bono', item, loading: false })}
                onOpenDeduccion={(item) =>
                  setMovimientoFormModal({ open: true, tipo: 'deduccion', item, loading: false })
                }
                onOpenAdelanto={openAdelantos}
                onRecalcularDetalle={(item) =>
                  withAction(
                    () =>
                      planillasService.recalcularDetallePlanilla(
                        selectedPlanilla.id_planilla,
                        item.id_detalle_planilla || item.id_detalle,
                        {}
                      ),
                    'Detalle recalculado correctamente'
                  )
                }
                canRegistrarMovimiento={canRegistrarMovimiento}
                canAplicarAdelanto={canAplicarAdelantos}
                canRecalcular={canRecalcular}
              />

              <div className="personas-page__pagination">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  disabled={detallePage <= 1 || loadingDetalle}
                  onClick={() => setDetallePage((prev) => prev - 1)}
                >
                  <i className="bi bi-chevron-left me-1" />
                  Anterior
                </button>
                <span>
                  Pagina {detallePage} de {totalPagesDetalle}
                </span>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  disabled={detallePage >= totalPagesDetalle || loadingDetalle}
                  onClick={() => setDetallePage((prev) => prev + 1)}
                >
                  Siguiente
                  <i className="bi bi-chevron-right ms-1" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <PlanillaDetallePanel open={Boolean(detailItem)} item={detailItem} onClose={() => setDetailItem(null)} />

      <PlanillaMovimientosModal
        open={movimientosModal.open}
        item={movimientosModal.item}
        loading={movimientosModal.loading}
        movimientos={movimientosModal.items}
        onClose={() => setMovimientosModal({ open: false, item: null, loading: false, items: [] })}
        onAnular={handleAnularMovimiento}
        canAnular={canAnularMovimiento}
      />

      <PlanillaMovimientoFormModal
        open={movimientoFormModal.open}
        item={movimientoFormModal.item}
        tipo={movimientoFormModal.tipo}
        loading={movimientoFormModal.loading}
        onClose={() => setMovimientoFormModal({ open: false, tipo: 'bono', item: null, loading: false })}
        onSubmit={(payload) => {
          if (!movimientoFormModal.item || !selectedPlanilla?.id_planilla) return;
          withAction(
            async () => {
              setMovimientoFormModal((state) => ({ ...state, loading: true }));
              await planillasService.registrarMovimientoPlanilla(selectedPlanilla.id_planilla, {
                id_detalle:
                  movimientoFormModal.item.id_detalle_planilla || movimientoFormModal.item.id_detalle,
                ...payload
              });
              setMovimientoFormModal({ open: false, tipo: 'bono', item: null, loading: false });
            },
            'Movimiento registrado correctamente'
          );
        }}
      />

      <PlanillaAdelantosModal
        open={adelantosModal.open}
        item={adelantosModal.item}
        adelantos={adelantosModal.items}
        loading={adelantosModal.loading}
        applying={adelantosModal.applying}
        onClose={() =>
          setAdelantosModal({ open: false, item: null, loading: false, applying: false, items: [] })
        }
        onApply={(payload) => {
          if (!adelantosModal.item || !selectedPlanilla?.id_planilla) return;
          withAction(
            async () => {
              setAdelantosModal((state) => ({ ...state, applying: true }));
              await planillasService.aplicarAdelantoPlanilla(selectedPlanilla.id_planilla, {
                id_detalle: adelantosModal.item.id_detalle_planilla || adelantosModal.item.id_detalle,
                ...payload
              });
              setAdelantosModal({ open: false, item: null, loading: false, applying: false, items: [] });
            },
            'Adelanto aplicado correctamente'
          );
        }}
      />

      <PlanillaAuditoriaModal
        open={auditoriaModal.open}
        loading={auditoriaModal.loading}
        items={auditoriaModal.items}
        onClose={() => setAuditoriaModal({ open: false, loading: false, items: [] })}
      />
    </div>
  );
}
