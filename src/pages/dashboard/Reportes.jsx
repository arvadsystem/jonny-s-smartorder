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

const EXPORT_REPORT_KEYS = Object.freeze({
  'ventas-resumen': 'ventas_resumen',
  'ventas-metodos-pago': 'ventas_metodos_pago',
  'caja-cierres': 'caja_cierres',
  'caja-diferencias': 'caja_diferencias',
  'inventario-stock-critico': 'inventario_stock_critico',
  'inventario-kardex': 'inventario_kardex',
  'ventas-descuentos': 'ventas_descuentos',
  'ventas-items': 'ventas_items'
});

const INITIAL_FILTERS = {
  fecha_inicio: '',
  fecha_fin: '',
  sucursal: '',
  almacen: '',
  caja: '',
  usuario: '',
  tipo_diferencia: '',
  tipo_descuento: '',
  tipo_item: '',
  solo_criticos: '',
  categoria: '',
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
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState(null);

  const allowedTabs = useMemo(
    () => getAllowedTabs('reportes', permisos, { isSuperAdmin }),
    [isSuperAdmin, permisos]
  );
  const canExportExcel = useMemo(
    () => isSuperAdmin || (Array.isArray(permisos) && permisos.includes('REPORTES_EXPORTAR_EXCEL')),
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
  const isStockCriticoTab = activeTab === 'inventario-stock-critico';
  const isKardexTab = activeTab === 'inventario-kardex';
  const isVentasDescuentosTab = activeTab === 'ventas-descuentos';
  const isVentasItemsTab = activeTab === 'ventas-items';

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

  const handleExportExcel = async () => {
    if (!activeTab) return;
    const reporte = EXPORT_REPORT_KEYS[activeTab];
    if (!reporte) return;

    setExporting(true);
    setError('');

    try {
      const { blob, filename } = await reportesService.exportExcel({ reporte, filters });
      const downloadUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = filename || `reporte_${reporte}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setError(err?.message || 'No se pudo exportar el reporte.');
    } finally {
      setExporting(false);
    }
  };

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
  const stockCriticoItems = Array.isArray(payload?.data?.items) ? payload.data.items : [];
  const kardexMovimientos = Array.isArray(payload?.data?.movimientos) ? payload.data.movimientos : [];
  const descuentosResumen = Array.isArray(payload?.data?.resumen_tipo_descuento) ? payload.data.resumen_tipo_descuento : [];
  const descuentosDetalle = Array.isArray(payload?.data?.detalle) ? payload.data.detalle : [];
  const ventasItemsResumen = Array.isArray(payload?.data?.resumen_items) ? payload.data.resumen_items : [];
  const ventasItemsDetalle = Array.isArray(payload?.data?.detalle) ? payload.data.detalle : [];

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
              <label className="form-label">Almacén</label>
              <input
                type="text"
                className="form-control"
                placeholder="ID"
                value={filters.almacen}
                onChange={(event) => setFilters((prev) => ({ ...prev, almacen: event.target.value }))}
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
              <label className="form-label">Categoría</label>
              <input
                type="text"
                className="form-control"
                placeholder="ID o nombre"
                value={filters.categoria}
                onChange={(event) => setFilters((prev) => ({ ...prev, categoria: event.target.value }))}
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
            <div className="col-12 col-md-2">
              <label className="form-label">Tipo descuento</label>
              <input
                type="text"
                className="form-control"
                placeholder="ID o nombre"
                value={filters.tipo_descuento}
                onChange={(event) => setFilters((prev) => ({ ...prev, tipo_descuento: event.target.value }))}
              />
            </div>
            <div className="col-12 col-md-2">
              <label className="form-label">Tipo item</label>
              <select
                className="form-select"
                value={filters.tipo_item}
                onChange={(event) => setFilters((prev) => ({ ...prev, tipo_item: event.target.value }))}
              >
                <option value="">Todos</option>
                <option value="producto">Producto</option>
                <option value="combo">Combo</option>
                <option value="receta">Receta</option>
              </select>
            </div>
            <div className="col-12 col-md-2">
              <label className="form-label">Solo críticos</label>
              <select
                className="form-select"
                value={filters.solo_criticos}
                onChange={(event) => setFilters((prev) => ({ ...prev, solo_criticos: event.target.value }))}
              >
                <option value="">Todos</option>
                <option value="true">Sí</option>
                <option value="false">No</option>
              </select>
            </div>
            <div className="col-12 d-grid d-md-flex justify-content-md-end mt-2">
              <button type="button" className="btn btn-primary" onClick={() => runReport(activeTab)} disabled={loading}>
                {loading ? 'Consultando...' : 'Aplicar filtros'}
              </button>
              {canExportExcel ? (
                <button
                  type="button"
                  className="btn btn-outline-success ms-md-2 mt-2 mt-md-0"
                  onClick={handleExportExcel}
                  disabled={exporting || loading}
                >
                  {exporting ? 'Exportando...' : 'Exportar Excel'}
                </button>
              ) : null}
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

      {isStockCriticoTab && kpis ? (
        <div className="reportes-kpis-grid">
          <article className="reportes-kpi-card"><span>Items revisados</span><strong>{kpis.total_items_revisados || 0}</strong></article>
          <article className="reportes-kpi-card"><span>Total críticos</span><strong>{kpis.total_criticos || 0}</strong></article>
          <article className="reportes-kpi-card"><span>Agotados</span><strong>{kpis.total_agotados || 0}</strong></article>
          <article className="reportes-kpi-card"><span>Bajo stock</span><strong>{kpis.total_stock_bajo || 0}</strong></article>
          <article className="reportes-kpi-card"><span>Productos críticos</span><strong>{kpis.productos_criticos || 0}</strong></article>
          <article className="reportes-kpi-card"><span>Insumos críticos</span><strong>{kpis.insumos_criticos || 0}</strong></article>
        </div>
      ) : null}

      {isKardexTab && kpis ? (
        <div className="reportes-kpis-grid">
          <article className="reportes-kpi-card"><span>Total movimientos</span><strong>{kpis.total_movimientos || 0}</strong></article>
          <article className="reportes-kpi-card"><span>Entradas</span><strong>{kpis.entradas || 0}</strong></article>
          <article className="reportes-kpi-card"><span>Salidas</span><strong>{kpis.salidas || 0}</strong></article>
          <article className="reportes-kpi-card"><span>Ajustes/Otros</span><strong>{kpis.ajustes_otros || 0}</strong></article>
          <article className="reportes-kpi-card"><span>Items únicos</span><strong>{kpis.items_unicos || 0}</strong></article>
        </div>
      ) : null}

      {isVentasDescuentosTab && kpis ? (
        <div className="reportes-kpis-grid">
          <article className="reportes-kpi-card"><span>Total descuento</span><strong>L {money(kpis.total_descuento)}</strong></article>
          <article className="reportes-kpi-card"><span>Ventas con descuento</span><strong>{kpis.ventas_con_descuento || 0}</strong></article>
          <article className="reportes-kpi-card"><span>Líneas con descuento</span><strong>{kpis.lineas_con_descuento || 0}</strong></article>
          <article className="reportes-kpi-card"><span>Ticket promedio descuento</span><strong>L {money(kpis.ticket_promedio_descuento)}</strong></article>
        </div>
      ) : null}

      {isVentasItemsTab && kpis ? (
        <div className="reportes-kpis-grid">
          <article className="reportes-kpi-card"><span>Total vendido</span><strong>L {money(kpis.total_vendido)}</strong></article>
          <article className="reportes-kpi-card"><span>Ventas</span><strong>{kpis.ventas || 0}</strong></article>
          <article className="reportes-kpi-card"><span>Líneas</span><strong>{kpis.lineas || 0}</strong></article>
          <article className="reportes-kpi-card"><span>Items únicos</span><strong>{kpis.cantidad_items || 0}</strong></article>
          <article className="reportes-kpi-card"><span>Ticket promedio</span><strong>L {money(kpis.ticket_promedio)}</strong></article>
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
                        : isStockCriticoTab
                          ? 'Fase 3A'
                            : isKardexTab
                              ? 'Fase 3B'
                            : isVentasDescuentosTab
                              ? 'Fase 4A'
                            : isVentasItemsTab
                              ? 'Fase 4B'
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
              ) : isStockCriticoTab ? (
                <div className="table-responsive reportes-table-wrap">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Tipo</th>
                        <th>Nombre</th>
                        <th>Categoría</th>
                        <th>Almacén</th>
                        <th>Sucursal</th>
                        <th className="text-end">Cantidad</th>
                        <th className="text-end">Stock mínimo</th>
                        <th className="text-end">Diferencia</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockCriticoItems.length === 0 ? (
                        <tr><td colSpan={9} className="text-center text-muted py-3">Sin items para los filtros aplicados.</td></tr>
                      ) : stockCriticoItems.map((item, index) => (
                        <tr key={`${item.tipo_item}-${item.nombre}-${item.almacen}-${index}`}>
                          <td>{item.tipo_item || '-'}</td>
                          <td>{item.nombre || '-'}</td>
                          <td>{item.categoria || '-'}</td>
                          <td>{item.almacen || '-'}</td>
                          <td>{item.sucursal || '-'}</td>
                          <td className="text-end">{item.cantidad_actual ?? 0}</td>
                          <td className="text-end">{item.stock_minimo ?? 0}</td>
                          <td className="text-end">{item.diferencia_minimo ?? 0}</td>
                          <td>{item.estado || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : isKardexTab ? (
                <div className="table-responsive reportes-table-wrap">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Tipo mov.</th>
                        <th>Tipo item</th>
                        <th>Item</th>
                        <th>Almacén</th>
                        <th>Sucursal</th>
                        <th className="text-end">Cantidad</th>
                        <th className="text-end">Saldo antes</th>
                        <th className="text-end">Saldo después</th>
                        <th>Referencia</th>
                        <th>Descripción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kardexMovimientos.length === 0 ? (
                        <tr><td colSpan={11} className="text-center text-muted py-3">Sin movimientos para los filtros aplicados.</td></tr>
                      ) : kardexMovimientos.map((item) => (
                        <tr key={item.id_movimiento}>
                          <td>{item.fecha_mov || '-'}</td>
                          <td>{item.tipo || '-'}</td>
                          <td>{item.item_tipo || '-'}</td>
                          <td>{item.item_nombre || '-'}</td>
                          <td>{item.nombre_almacen || '-'}</td>
                          <td>{item.nombre_sucursal || '-'}</td>
                          <td className="text-end">{item.cantidad ?? 0}</td>
                          <td className="text-end">{item.saldo_antes ?? 0}</td>
                          <td className="text-end">{item.saldo_despues ?? 0}</td>
                          <td>{item.ref_origen ? `${item.ref_origen}${item.id_ref ? ` #${item.id_ref}` : ''}` : '-'}</td>
                          <td>{item.descripcion || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : isVentasDescuentosTab ? (
                <div className="row g-3">
                  <div className="col-12 col-xl-4">
                    <div className="table-responsive reportes-table-wrap">
                      <table className="table table-sm align-middle mb-0">
                        <thead>
                          <tr>
                            <th>Tipo descuento</th>
                            <th className="text-end">Líneas</th>
                            <th className="text-end">Ventas</th>
                            <th className="text-end">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {descuentosResumen.length === 0 ? (
                            <tr><td colSpan={4} className="text-center text-muted py-3">Sin resumen por tipo.</td></tr>
                          ) : descuentosResumen.map((item) => (
                            <tr key={`${item.tipo_descuento}-${item.total_descuento}`}>
                              <td>{item.tipo_descuento || '-'}</td>
                              <td className="text-end">{item.cantidad_lineas || 0}</td>
                              <td className="text-end">{item.ventas || 0}</td>
                              <td className="text-end">L {money(item.total_descuento)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="col-12 col-xl-8">
                    <div className="table-responsive reportes-table-wrap">
                      <table className="table table-sm align-middle mb-0">
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Sucursal</th>
                            <th>Caja</th>
                            <th>Usuario</th>
                            <th>Factura</th>
                            <th>Pedido</th>
                            <th>Cliente</th>
                            <th>Tipo descuento</th>
                            <th className="text-end">Descuento</th>
                            <th className="text-end">Subtotal línea</th>
                            <th className="text-end">Total línea</th>
                            <th>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {descuentosDetalle.length === 0 ? (
                            <tr><td colSpan={12} className="text-center text-muted py-3">Sin descuentos aplicados para los filtros.</td></tr>
                          ) : descuentosDetalle.map((item, index) => (
                            <tr key={`${item.factura}-${item.pedido || 'na'}-${index}`}>
                              <td>{item.fecha || '-'}</td>
                              <td>{item.sucursal || '-'}</td>
                              <td>{item.caja || '-'}</td>
                              <td>{item.usuario || '-'}</td>
                              <td>{item.factura || '-'}</td>
                              <td>{item.pedido || '-'}</td>
                              <td>{item.cliente || '-'}</td>
                              <td>{item.tipo_descuento || '-'}</td>
                              <td className="text-end">L {money(item.descuento)}</td>
                              <td className="text-end">L {money(item.subtotal_linea)}</td>
                              <td className="text-end">L {money(item.total_linea)}</td>
                              <td>{item.estado || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : isVentasItemsTab ? (
                <div className="row g-3">
                  <div className="col-12 col-xl-5">
                    <div className="table-responsive reportes-table-wrap">
                      <table className="table table-sm align-middle mb-0">
                        <thead>
                          <tr>
                            <th>Tipo</th>
                            <th>Item</th>
                            <th>Categoría</th>
                            <th className="text-end">Cantidad</th>
                            <th className="text-end">Ventas</th>
                            <th className="text-end">Subtotal</th>
                            <th className="text-end">Descuento</th>
                            <th className="text-end">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ventasItemsResumen.length === 0 ? (
                            <tr><td colSpan={8} className="text-center text-muted py-3">Sin resumen por item.</td></tr>
                          ) : ventasItemsResumen.map((item) => (
                            <tr key={`${item.tipo_item}-${item.id_item}-${item.nombre_item}`}>
                              <td>{item.tipo_item || '-'}</td>
                              <td>{item.nombre_item || '-'}</td>
                              <td>{item.categoria || '-'}</td>
                              <td className="text-end">{item.cantidad_vendida ?? 0}</td>
                              <td className="text-end">{item.ventas || 0}</td>
                              <td className="text-end">L {money(item.subtotal)}</td>
                              <td className="text-end">L {money(item.descuento)}</td>
                              <td className="text-end">L {money(item.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="col-12 col-xl-7">
                    <div className="table-responsive reportes-table-wrap">
                      <table className="table table-sm align-middle mb-0">
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Sucursal</th>
                            <th>Caja</th>
                            <th>Usuario</th>
                            <th>Factura</th>
                            <th>Pedido</th>
                            <th>Tipo item</th>
                            <th>Item</th>
                            <th>Categoría</th>
                            <th className="text-end">Cantidad</th>
                            <th className="text-end">Subtotal</th>
                            <th className="text-end">Descuento</th>
                            <th className="text-end">Total</th>
                            <th>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ventasItemsDetalle.length === 0 ? (
                            <tr><td colSpan={14} className="text-center text-muted py-3">Sin detalle para los filtros aplicados.</td></tr>
                          ) : ventasItemsDetalle.map((item, index) => (
                            <tr key={`${item.factura}-${item.pedido || 'na'}-${item.tipo_item || 'na'}-${index}`}>
                              <td>{item.fecha || '-'}</td>
                              <td>{item.sucursal || '-'}</td>
                              <td>{item.caja || '-'}</td>
                              <td>{item.usuario || '-'}</td>
                              <td>{item.factura || '-'}</td>
                              <td>{item.pedido || '-'}</td>
                              <td>{item.tipo_item || '-'}</td>
                              <td>{item.item || '-'}</td>
                              <td>{item.categoria || '-'}</td>
                              <td className="text-end">{item.cantidad ?? 0}</td>
                              <td className="text-end">L {money(item.subtotal)}</td>
                              <td className="text-end">L {money(item.descuento)}</td>
                              <td className="text-end">L {money(item.total)}</td>
                              <td>{item.estado || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
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
