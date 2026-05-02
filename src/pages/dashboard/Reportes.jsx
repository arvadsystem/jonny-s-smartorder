import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import SinPermiso from '../../components/common/SinPermiso';
import { usePermisos } from '../../context/PermisosContext';
import {
  MODULE_PRIMARY_PERMISSION,
  getAllowedTabs
} from '../../utils/permissions';
import { reportesService } from '../../services/reportesService';

const REPORT_KEYS = [
  'ventas-resumen',
  'ventas-metodos-pago',
  'caja-cierres',
  'caja-diferencias',
  'inventario-stock-critico',
  'inventario-kardex',
  'ventas-descuentos',
  'ventas-items'
];

const REPORT_HANDLERS = {
  'ventas-resumen': reportesService.getVentasResumen,
  'ventas-metodos-pago': reportesService.getVentasMetodosPago,
  'caja-cierres': reportesService.getCajaCierres,
  'caja-diferencias': reportesService.getCajaDiferencias,
  'inventario-stock-critico': reportesService.getInventarioStockCritico,
  'inventario-kardex': reportesService.getInventarioKardex,
  'ventas-descuentos': reportesService.getVentasDescuentos,
  'ventas-items': reportesService.getVentasItems
};

const INITIAL_FILTERS = {
  fecha_inicio: '',
  fecha_fin: '',
  sucursal: '',
  caja: '',
  usuario: '',
  tipo_diferencia: '',
  estado: ''
};

const money = (value) =>
  Number(value || 0).toLocaleString('es-HN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

const Reportes = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isSuperAdmin, loading: permisosLoading, permisos } = usePermisos();

  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState(null);

  const allowedTabs = useMemo(
    () => getAllowedTabs('reportes', permisos, { isSuperAdmin }),
    [isSuperAdmin, permisos]
  );

  const fallbackTab = allowedTabs[0]?.key || null;
  const rawTab = String(searchParams.get('tab') || fallbackTab || '').toLowerCase();
  const normalizedTab = REPORT_KEYS.includes(rawTab) ? rawTab : fallbackTab;
  const activeTab = allowedTabs.some((tab) => tab.key === normalizedTab) ? normalizedTab : fallbackTab;
  const isVentasResumenTab = activeTab === 'ventas-resumen';
  const isVentasMetodosTab = activeTab === 'ventas-metodos-pago';
  const isCajaCierresTab = activeTab === 'caja-cierres';
  const isCajaDiferenciasTab = activeTab === 'caja-diferencias';

  useEffect(() => {
    if (permisosLoading || !activeTab) return;
    if (rawTab === activeTab) return;

    const next = new URLSearchParams(searchParams);
    next.set('tab', activeTab);
    setSearchParams(next, { replace: true });
  }, [activeTab, rawTab, permisosLoading, searchParams, setSearchParams]);

  const runReport = async (tabKey) => {
    const fetcher = REPORT_HANDLERS[tabKey];
    if (!fetcher) return;

    setLoading(true);
    setError('');

    try {
      const data = await fetcher(filters);
      setPayload(data || null);
    } catch (err) {
      setError(err?.message || 'No se pudo cargar el reporte.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeTab) return;
    runReport(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  if (permisosLoading) return null;

  if (!fallbackTab) {
    return (
      <SinPermiso
        permiso={MODULE_PRIMARY_PERMISSION.reportes}
        detalle="No tienes acceso a ningun reporte habilitado."
      />
    );
  }

  const kpis = payload?.data?.kpis || null;
  const serieDiaria = Array.isArray(payload?.data?.serie_diaria) ? payload.data.serie_diaria : [];
  const desgloseEstado = Array.isArray(payload?.data?.desglose_por_estado) ? payload.data.desglose_por_estado : [];
  const resumenMetodos = Array.isArray(payload?.data?.resumen_por_metodo) ? payload.data.resumen_por_metodo : [];
  const serieMetodo = Array.isArray(payload?.data?.serie_diaria_por_metodo) ? payload.data.serie_diaria_por_metodo : [];
  const cierresCaja = Array.isArray(payload?.data?.cierres) ? payload.data.cierres : [];
  const diferenciasCaja = Array.isArray(payload?.data?.diferencias) ? payload.data.diferencias : [];

  return (
    <div className="container-fluid p-3 reportes-page">
      <div className="reportes-header">
        <div>
          <h2 className="reportes-title">Reportes</h2>
          <p className="reportes-subtitle">Analitica operativa para ventas, caja e inventario.</p>
        </div>
      </div>

      <div className="reportes-filters card border-0 shadow-sm">
        <div className="card-body">
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-2">
              <label className="form-label">Fecha inicio</label>
              <input
                type="date"
                className="form-control"
                value={filters.fecha_inicio}
                onChange={(event) => setFilters((prev) => ({ ...prev, fecha_inicio: event.target.value }))}
              />
            </div>
            <div className="col-12 col-md-2">
              <label className="form-label">Fecha fin</label>
              <input
                type="date"
                className="form-control"
                value={filters.fecha_fin}
                onChange={(event) => setFilters((prev) => ({ ...prev, fecha_fin: event.target.value }))}
              />
            </div>
            <div className="col-12 col-md-2">
              <label className="form-label">Sucursal</label>
              <input
                type="text"
                className="form-control"
                placeholder="ID"
                value={filters.sucursal}
                onChange={(event) => setFilters((prev) => ({ ...prev, sucursal: event.target.value }))}
              />
            </div>
            <div className="col-12 col-md-2">
              <label className="form-label">Caja</label>
              <input
                type="text"
                className="form-control"
                placeholder="ID"
                value={filters.caja}
                onChange={(event) => setFilters((prev) => ({ ...prev, caja: event.target.value }))}
              />
            </div>
            <div className="col-12 col-md-2">
              <label className="form-label">Usuario</label>
              <input
                type="text"
                className="form-control"
                placeholder="ID"
                value={filters.usuario}
                onChange={(event) => setFilters((prev) => ({ ...prev, usuario: event.target.value }))}
              />
            </div>
            <div className="col-12 col-md-2">
              <label className="form-label">Estado</label>
              <input
                type="text"
                className="form-control"
                placeholder="Ej. Cancelado"
                value={filters.estado}
                onChange={(event) => setFilters((prev) => ({ ...prev, estado: event.target.value }))}
              />
            </div>
            <div className="col-12 col-md-2">
              <label className="form-label">Tipo diferencia</label>
              <select
                className="form-select"
                value={filters.tipo_diferencia}
                onChange={(event) => setFilters((prev) => ({ ...prev, tipo_diferencia: event.target.value }))}
              >
                <option value="">Todos</option>
                <option value="faltante">Faltante</option>
                <option value="sobrante">Sobrante</option>
              </select>
            </div>
            <div className="col-12 d-grid d-md-flex justify-content-md-end mt-2">
              <button type="button" className="btn btn-primary" onClick={() => runReport(activeTab)} disabled={loading}>
                {loading ? 'Consultando...' : 'Aplicar filtros'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="reportes-tabs nav nav-pills" role="tablist" aria-label="Tipos de reporte">
        {allowedTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`nav-link ${tab.key === activeTab ? 'active' : ''}`}
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.set('tab', tab.key);
              setSearchParams(next);
            }}
          >
            <i className={`${tab.icon} me-2`} />
            {tab.label}
          </button>
        ))}
      </div>

      {isVentasResumenTab && kpis ? (
        <div className="reportes-kpis-grid">
          <article className="reportes-kpi-card"><span>Total ventas</span><strong>L {money(kpis.total_ventas)}</strong></article>
          <article className="reportes-kpi-card"><span>Cantidad ventas</span><strong>{kpis.cantidad_ventas || 0}</strong></article>
          <article className="reportes-kpi-card"><span>Subtotal</span><strong>L {money(kpis.subtotal)}</strong></article>
          <article className="reportes-kpi-card"><span>Descuentos</span><strong>L {money(kpis.descuentos)}</strong></article>
          <article className="reportes-kpi-card"><span>Impuestos</span><strong>L {money(kpis.impuestos)}</strong></article>
          <article className="reportes-kpi-card"><span>Total neto</span><strong>L {money(kpis.total_neto)}</strong></article>
          <article className="reportes-kpi-card"><span>Promedio venta</span><strong>L {money(kpis.promedio_por_venta)}</strong></article>
          <article className="reportes-kpi-card"><span>Canceladas/Anuladas</span><strong>{kpis.ventas_canceladas_o_anuladas || 0}</strong></article>
        </div>
      ) : null}

      {isVentasMetodosTab && kpis ? (
        <div className="reportes-kpis-grid">
          <article className="reportes-kpi-card"><span>Total general</span><strong>L {money(kpis.total_general)}</strong></article>
          <article className="reportes-kpi-card"><span>Total ventas</span><strong>{kpis.total_ventas || 0}</strong></article>
          <article className="reportes-kpi-card"><span>Metodos activos</span><strong>{kpis.metodos_activos || 0}</strong></article>
        </div>
      ) : null}

      {isCajaCierresTab && kpis ? (
        <div className="reportes-kpis-grid">
          <article className="reportes-kpi-card"><span>Cierres</span><strong>{kpis.cantidad_cierres || 0}</strong></article>
          <article className="reportes-kpi-card"><span>Total esperado</span><strong>L {money(kpis.total_esperado)}</strong></article>
          <article className="reportes-kpi-card"><span>Total contado</span><strong>L {money(kpis.total_contado)}</strong></article>
          <article className="reportes-kpi-card"><span>Diferencia total</span><strong>L {money(kpis.diferencia_total)}</strong></article>
          <article className="reportes-kpi-card"><span>Con diferencia</span><strong>{kpis.cierres_con_diferencia || 0}</strong></article>
          <article className="reportes-kpi-card"><span>Sin diferencia</span><strong>{kpis.cierres_sin_diferencia || 0}</strong></article>
        </div>
      ) : null}

      {isCajaDiferenciasTab && kpis ? (
        <div className="reportes-kpis-grid">
          <article className="reportes-kpi-card"><span>Diferencias</span><strong>{kpis.cantidad_diferencias || 0}</strong></article>
          <article className="reportes-kpi-card"><span>Total absoluto</span><strong>L {money(kpis.total_diferencia_absoluta)}</strong></article>
          <article className="reportes-kpi-card"><span>Total faltantes</span><strong>L {money(kpis.total_faltantes)}</strong></article>
          <article className="reportes-kpi-card"><span>Total sobrantes</span><strong>L {money(kpis.total_sobrantes)}</strong></article>
          <article className="reportes-kpi-card"><span>Cantidad faltantes</span><strong>{kpis.cantidad_faltantes || 0}</strong></article>
          <article className="reportes-kpi-card"><span>Cantidad sobrantes</span><strong>{kpis.cantidad_sobrantes || 0}</strong></article>
        </div>
      ) : null}

      <div className="card border-0 shadow-sm reportes-result mt-2">
        <div className="card-body">
          {error ? <div className="alert alert-danger mb-0">{error}</div> : null}

          {!error && payload ? (
            <>
              <div className="reportes-meta mb-3">
                <span className="badge text-bg-primary">{payload.reporte || activeTab}</span>
                <span className="badge text-bg-light">
                  {isVentasResumenTab
                    ? 'Fase 2A'
                    : isVentasMetodosTab
                      ? 'Fase 2B'
                      : isCajaCierresTab
                        ? 'Fase 2C'
                        : isCajaDiferenciasTab
                          ? 'Fase 2D'
                          : 'Fase 1'}
                </span>
              </div>

              {isVentasResumenTab ? (
                <div className="row g-3">
                  <div className="col-12 col-lg-6">
                    <div className="table-responsive reportes-table-wrap">
                      <table className="table table-sm align-middle mb-0">
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th className="text-end">Ventas</th>
                            <th className="text-end">Total neto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {serieDiaria.length === 0 ? (
                            <tr><td colSpan={3} className="text-center text-muted py-3">Sin datos diarios.</td></tr>
                          ) : serieDiaria.map((item) => (
                            <tr key={item.fecha}>
                              <td>{item.fecha}</td>
                              <td className="text-end">{item.cantidad_ventas}</td>
                              <td className="text-end">L {money(item.total_neto)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="col-12 col-lg-6">
                    <div className="table-responsive reportes-table-wrap">
                      <table className="table table-sm align-middle mb-0">
                        <thead>
                          <tr>
                            <th>Estado</th>
                            <th className="text-end">Ventas</th>
                            <th className="text-end">Total neto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {desgloseEstado.length === 0 ? (
                            <tr><td colSpan={3} className="text-center text-muted py-3">Sin desglose por estado.</td></tr>
                          ) : desgloseEstado.map((item) => (
                            <tr key={item.estado}>
                              <td>{item.estado}</td>
                              <td className="text-end">{item.cantidad_ventas}</td>
                              <td className="text-end">L {money(item.total_neto)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : isVentasMetodosTab ? (
                <div className="row g-3">
                  <div className="col-12 col-xl-7">
                    <div className="table-responsive reportes-table-wrap">
                      <table className="table table-sm align-middle mb-0">
                        <thead>
                          <tr>
                            <th>Metodo de pago</th>
                            <th className="text-end">Ventas</th>
                            <th className="text-end">Total vendido</th>
                            <th className="text-end">%</th>
                            <th className="text-end">Ticket promedio</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resumenMetodos.length === 0 ? (
                            <tr><td colSpan={5} className="text-center text-muted py-3">Sin datos por metodo.</td></tr>
                          ) : resumenMetodos.map((item) => (
                            <tr key={`${item.metodo_pago_codigo || item.metodo_pago}-${item.total_vendido}`}>
                              <td>{item.metodo_pago}</td>
                              <td className="text-end">{item.cantidad_ventas}</td>
                              <td className="text-end">L {money(item.total_vendido)}</td>
                              <td className="text-end">{money(item.porcentaje_sobre_total)}%</td>
                              <td className="text-end">L {money(item.ticket_promedio)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="col-12 col-xl-5">
                    <div className="table-responsive reportes-table-wrap">
                      <table className="table table-sm align-middle mb-0">
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Metodo</th>
                            <th className="text-end">Ventas</th>
                            <th className="text-end">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {serieMetodo.length === 0 ? (
                            <tr><td colSpan={4} className="text-center text-muted py-3">Sin serie diaria por metodo.</td></tr>
                          ) : serieMetodo.map((item) => (
                            <tr key={`${item.fecha}-${item.metodo_pago_codigo || item.metodo_pago}`}>
                              <td>{item.fecha}</td>
                              <td>{item.metodo_pago}</td>
                              <td className="text-end">{item.cantidad_ventas}</td>
                              <td className="text-end">L {money(item.total_vendido)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : isCajaCierresTab ? (
                <div className="table-responsive reportes-table-wrap">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Fecha cierre</th>
                        <th>Sucursal</th>
                        <th>Caja</th>
                        <th>Responsable</th>
                        <th className="text-end">Esperado</th>
                        <th className="text-end">Contado</th>
                        <th className="text-end">Diferencia</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cierresCaja.length === 0 ? (
                        <tr><td colSpan={8} className="text-center text-muted py-3">Sin cierres para los filtros aplicados.</td></tr>
                      ) : cierresCaja.map((item) => (
                        <tr key={item.id_cierre_caja}>
                          <td>{item.fecha_cierre || item.fecha_apertura || '-'}</td>
                          <td>{item.sucursal || '-'}</td>
                          <td>{item.codigo_caja ? `${item.codigo_caja} - ${item.caja || ''}` : (item.caja || '-')}</td>
                          <td>{item.responsable || item.usuario_cierre || '-'}</td>
                          <td className="text-end">L {money(item.total_esperado)}</td>
                          <td className="text-end">L {money(item.total_contado)}</td>
                          <td className="text-end">L {money(item.diferencia)}</td>
                          <td>{item.estado_cierre || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : isCajaDiferenciasTab ? (
                <div className="table-responsive reportes-table-wrap">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Fecha cierre</th>
                        <th>Sucursal</th>
                        <th>Caja</th>
                        <th>Responsable</th>
                        <th className="text-end">Esperado</th>
                        <th className="text-end">Contado</th>
                        <th className="text-end">Diferencia</th>
                        <th>Tipo</th>
                        <th>Resolucion</th>
                        <th>Observacion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diferenciasCaja.length === 0 ? (
                        <tr><td colSpan={10} className="text-center text-muted py-3">Sin diferencias para los filtros aplicados.</td></tr>
                      ) : diferenciasCaja.map((item) => (
                        <tr key={`${item.id_cierre_caja}-${item.tipo_diferencia}`}>
                          <td>{item.fecha_cierre || '-'}</td>
                          <td>{item.sucursal || '-'}</td>
                          <td>{item.codigo_caja ? `${item.codigo_caja} - ${item.caja || ''}` : (item.caja || '-')}</td>
                          <td>{item.responsable || '-'}</td>
                          <td className="text-end">L {money(item.total_esperado)}</td>
                          <td className="text-end">L {money(item.total_contado)}</td>
                          <td className="text-end">L {money(item.diferencia)}</td>
                          <td>{item.tipo_diferencia || '-'}</td>
                          <td>{item.estado_resolucion || '-'}</td>
                          <td>{item.observacion || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <pre className="reportes-json mb-0">{JSON.stringify(payload, null, 2)}</pre>
              )}
            </>
          ) : null}

          {!error && !payload && !loading ? (
            <p className="text-muted mb-0">Sin datos para mostrar.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Reportes;
