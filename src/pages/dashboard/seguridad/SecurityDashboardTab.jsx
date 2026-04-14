import { useCallback, useEffect, useMemo, useState } from 'react';
import InlineLoader from '../../../components/common/InlineLoader';
import SinPermiso from '../../../components/common/SinPermiso';
import { usePermisos } from '../../../context/PermisosContext';
import { securityService } from '../../../services/securityService';
import { fmtHN } from '../../../utils/dateTime';
import './sesiones-ui.css';
import './security-dashboard-ui.css';

const RANGE_OPTIONS = Object.freeze([
  { key: '24h', label: '24 h' },
  { key: '7d', label: '7 d' },
  { key: '30d', label: '30 d' }
]);

const DEFAULT_DATA = Object.freeze({
  range: '24h',
  range_label: '24 horas',
  resumen: {
    logins_fallidos: 0,
    usuarios_bloqueados: 0,
    sesiones_activas_totales: 0,
    actividad_critica_total: 0,
    usuarios_sospechosos_total: 0
  },
  semaforo: {
    logins_fallidos: { valor: 0, estado: 'verde', umbral_amarillo: 0, umbral_rojo: 0 },
    usuarios_bloqueados: { valor: 0, estado: 'verde', umbral_amarillo: 0, umbral_rojo: 0 },
    usuarios_sospechosos: { valor: 0, estado: 'verde', umbral_amarillo: 0, umbral_rojo: 0 }
  },
  graficos: {
    logins_fallidos_barras: [],
    sesiones_activas_linea: []
  },
  tablas: {
    top_ips: [],
    usuarios_bloqueados: []
  },
  actividad_reciente: [],
  usuarios_sospechosos: []
});

const toInt = (value) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
};

const formatNumber = (value) => new Intl.NumberFormat('es-HN').format(toInt(value));

const statusToClass = (status) => {
  const normalized = String(status ?? '').toLowerCase();
  if (normalized === 'rojo') return 'is-rojo';
  if (normalized === 'amarillo') return 'is-amarillo';
  return 'is-verde';
};

const statusToText = (status) => {
  const normalized = String(status ?? '').toLowerCase();
  if (normalized === 'rojo') return 'Alerta';
  if (normalized === 'amarillo') return 'Precaucion';
  return 'Estable';
};

const csvEscape = (value) => {
  const raw = value === null || value === undefined ? '' : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildCsvContent = (data) => {
  const rows = [];
  rows.push('Resumen de seguridad');
  rows.push('Metrica,Valor');
  rows.push(`"Logins fallidos",${csvEscape(data?.resumen?.logins_fallidos ?? 0)}`);
  rows.push(`"Usuarios bloqueados",${csvEscape(data?.resumen?.usuarios_bloqueados ?? 0)}`);
  rows.push(`"Sesiones activas totales",${csvEscape(data?.resumen?.sesiones_activas_totales ?? 0)}`);
  rows.push(`"Actividad critica reciente",${csvEscape(data?.resumen?.actividad_critica_total ?? 0)}`);
  rows.push(`"Usuarios sospechosos",${csvEscape(data?.resumen?.usuarios_sospechosos_total ?? 0)}`);
  rows.push('');

  rows.push('Top IPs con fallos');
  rows.push('IP,Total fallos');
  (Array.isArray(data?.tablas?.top_ips) ? data.tablas.top_ips : []).forEach((row) => {
    rows.push(`${csvEscape(row?.ip_origen || 'IP no registrada')},${csvEscape(toInt(row?.total_fallos))}`);
  });
  rows.push('');

  rows.push('Usuarios bloqueados');
  rows.push('ID,Usuario,Nombre,Rol,Fallos en rango,Sesiones activas,Ultimo acceso');
  (Array.isArray(data?.tablas?.usuarios_bloqueados) ? data.tablas.usuarios_bloqueados : []).forEach((row) => {
    rows.push([
      csvEscape(toInt(row?.id_usuario)),
      csvEscape(row?.nombre_usuario || ''),
      csvEscape(row?.nombre_completo || ''),
      csvEscape(row?.rol || 'N/D'),
      csvEscape(toInt(row?.fallos_en_rango)),
      csvEscape(toInt(row?.sesiones_activas)),
      csvEscape(row?.ultimo_acceso ? fmtHN(row.ultimo_acceso) : '-')
    ].join(','));
  });
  rows.push('');

  rows.push('Usuarios sospechosos');
  rows.push('ID,Usuario,Nombre,Fallos consecutivos,Fallos en rango,Ultima IP,Ultimo fallo');
  (Array.isArray(data?.usuarios_sospechosos) ? data.usuarios_sospechosos : []).forEach((row) => {
    rows.push([
      csvEscape(toInt(row?.id_usuario)),
      csvEscape(row?.nombre_usuario || ''),
      csvEscape(row?.nombre_completo || ''),
      csvEscape(toInt(row?.fallos_consecutivos)),
      csvEscape(toInt(row?.fallos_en_rango)),
      csvEscape(row?.ultima_ip || 'IP no registrada'),
      csvEscape(row?.ultimo_fallo ? fmtHN(row.ultimo_fallo) : '-')
    ].join(','));
  });

  return rows.join('\n');
};

const downloadTextFile = (content, filename, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const buildPrintableHtml = ({ data, lastUpdated }) => {
  const resumen = data?.resumen || {};
  const topIpsRows = Array.isArray(data?.tablas?.top_ips) ? data.tablas.top_ips : [];
  const sospechososRows = Array.isArray(data?.usuarios_sospechosos) ? data.usuarios_sospechosos : [];
  const actividadRows = Array.isArray(data?.actividad_reciente) ? data.actividad_reciente : [];

  const topIpsHtml = topIpsRows.length === 0
    ? '<tr><td colspan="2">Sin registros.</td></tr>'
    : topIpsRows
      .map((row) => `<tr><td>${escapeHtml(row.ip_origen || 'IP no registrada')}</td><td>${escapeHtml(formatNumber(row.total_fallos))}</td></tr>`)
      .join('');

  const sospechososHtml = sospechososRows.length === 0
    ? '<tr><td colspan="4">Sin registros.</td></tr>'
    : sospechososRows
      .map((row) => `
        <tr>
          <td>${escapeHtml(row.nombre_usuario || '')}</td>
          <td>${escapeHtml(formatNumber(row.fallos_consecutivos))}</td>
          <td>${escapeHtml(row.ultima_ip || 'IP no registrada')}</td>
          <td>${escapeHtml(row.ultimo_fallo ? fmtHN(row.ultimo_fallo) : '-')}</td>
        </tr>
      `)
      .join('');

  const actividadHtml = actividadRows.length === 0
    ? '<tr><td colspan="4">Sin registros.</td></tr>'
    : actividadRows
      .map((row) => `
        <tr>
          <td>${escapeHtml(row.actor || 'N/D')}</td>
          <td>${escapeHtml(row.accion || '')}</td>
          <td>${escapeHtml(row.descripcion || '')}</td>
          <td>${escapeHtml(row.fecha_hora ? fmtHN(row.fecha_hora) : '-')}</td>
        </tr>
      `)
      .join('');

  return `
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Dashboard de seguridad</title>
  <style>
    body { font-family: Arial, sans-serif; color: #2a1c17; margin: 28px; }
    h1 { margin: 0 0 6px; font-size: 20px; }
    .meta { color: #6a5a4d; margin-bottom: 16px; font-size: 12px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
    .card { border: 1px solid #e4e3d1; border-radius: 10px; padding: 10px; }
    .label { color: #6a5a4d; font-size: 11px; text-transform: uppercase; }
    .value { font-size: 20px; font-weight: 700; color: #17080a; margin-top: 6px; }
    h2 { margin-top: 18px; font-size: 15px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #e4e3d1; padding: 6px 8px; text-align: left; font-size: 12px; }
    th { background: #f6f4ee; }
  </style>
</head>
<body>
  <h1>Dashboard de seguridad</h1>
  <div class="meta">Rango: ${escapeHtml(data?.range_label || '')} | Generado: ${escapeHtml(lastUpdated ? new Date(lastUpdated).toLocaleString('es-HN') : '-')}</div>

  <div class="grid">
    <div class="card"><div class="label">Logins fallidos</div><div class="value">${escapeHtml(formatNumber(resumen.logins_fallidos))}</div></div>
    <div class="card"><div class="label">Usuarios bloqueados</div><div class="value">${escapeHtml(formatNumber(resumen.usuarios_bloqueados))}</div></div>
    <div class="card"><div class="label">Sesiones activas</div><div class="value">${escapeHtml(formatNumber(resumen.sesiones_activas_totales))}</div></div>
  </div>

  <h2>Top IPs con fallos</h2>
  <table>
    <thead><tr><th>IP</th><th>Total fallos</th></tr></thead>
    <tbody>${topIpsHtml}</tbody>
  </table>

  <h2>Usuarios sospechosos</h2>
  <table>
    <thead><tr><th>Usuario</th><th>Fallos consecutivos</th><th>Ultima IP</th><th>Ultimo fallo</th></tr></thead>
    <tbody>${sospechososHtml}</tbody>
  </table>

  <h2>Actividad critica reciente</h2>
  <table>
    <thead><tr><th>Actor</th><th>Accion</th><th>Descripcion</th><th>Fecha/Hora</th></tr></thead>
    <tbody>${actividadHtml}</tbody>
  </table>
</body>
</html>
  `;
};

const BarChart = ({ rows }) => {
  const points = Array.isArray(rows) ? rows : [];
  const maxValue = Math.max(1, ...points.map((row) => toInt(row?.total)));

  return (
    <div className="sec-chart sec-chart--bars" role="img" aria-label="Grafico de barras de logins fallidos">
      {points.length === 0 ? (
        <div className="sec-chart-empty">Sin datos en el rango seleccionado.</div>
      ) : (
        <div className="sec-bars-grid">
          {points.map((point, index) => {
            const total = toInt(point?.total);
            const heightPercent = Math.max(5, Math.round((total / maxValue) * 100));
            return (
              <div className="sec-bar-item" key={`${point?.bucket_label || 'bucket'}-${index}`}>
                <div className="sec-bar-track">
                  <span className="sec-bar-fill" style={{ height: `${heightPercent}%` }} />
                </div>
                <small>{point?.bucket_label || '-'}</small>
                <strong>{formatNumber(total)}</strong>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const DonutChart = ({ total }) => {
  const activeSessions = toInt(total);
  const gradient = activeSessions > 0
    ? 'conic-gradient(#2d6b66 0deg 360deg)'
    : 'conic-gradient(#e3dbd0 0deg 360deg)';

  return (
    <div className="sec-chart sec-chart--donut" role="img" aria-label="Grafico de dona de sesiones activas">
      <div className="sec-donut-layout">
        <div className="sec-donut-chart" style={{ '--donut-gradient': gradient }}>
          <div className="sec-donut-center">
            <strong>{formatNumber(activeSessions)}</strong>
            <span>Sesiones activas</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const SecurityDashboardTab = () => {
  const { isSuperAdmin, loading: permisosLoading } = usePermisos();

  const [range, setRange] = useState(DEFAULT_DATA.range);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [noPermiso, setNoPermiso] = useState(false);
  const [data, setData] = useState(DEFAULT_DATA);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadSummary = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setError('');
      setNoPermiso(false);
    }

    try {
      const qs = new URLSearchParams();
      qs.set('range', range);
      qs.set('_ts', String(Date.now()));

      const payload = await securityService.getSecuritySummary(qs.toString());
      setData({
        ...DEFAULT_DATA,
        ...payload,
        resumen: { ...DEFAULT_DATA.resumen, ...(payload?.resumen || {}) },
        semaforo: { ...DEFAULT_DATA.semaforo, ...(payload?.semaforo || {}) },
        graficos: { ...DEFAULT_DATA.graficos, ...(payload?.graficos || {}) },
        tablas: { ...DEFAULT_DATA.tablas, ...(payload?.tablas || {}) },
        actividad_reciente: Array.isArray(payload?.actividad_reciente) ? payload.actividad_reciente : [],
        usuarios_sospechosos: Array.isArray(payload?.usuarios_sospechosos) ? payload.usuarios_sospechosos : []
      });
      setLastUpdated(Date.now());
    } catch (e) {
      if (e?.status === 403) {
        setNoPermiso(true);
        return;
      }
      setError(e?.message || 'Error cargando dashboard de seguridad');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    if (permisosLoading) return;
    if (!isSuperAdmin) {
      setLoading(false);
      setNoPermiso(true);
      return;
    }
    void loadSummary();
  }, [isSuperAdmin, permisosLoading, loadSummary]);

  const semaforos = useMemo(
    () => ([
      { key: 'logins_fallidos', label: 'Logins fallidos', value: data?.semaforo?.logins_fallidos },
      { key: 'usuarios_bloqueados', label: 'Usuarios bloqueados', value: data?.semaforo?.usuarios_bloqueados },
      { key: 'usuarios_sospechosos', label: 'Usuarios sospechosos', value: data?.semaforo?.usuarios_sospechosos },
      {
        key: 'actividad_critica',
        label: 'Actividad critica',
        value: data?.semaforo?.actividad_critica || {
          valor: toInt(data?.resumen?.actividad_critica_total),
          estado: toInt(data?.resumen?.actividad_critica_total) > 0 ? 'amarillo' : 'verde',
          umbral_amarillo: 0,
          umbral_rojo: 0
        }
      }
    ]),
    [data?.semaforo, data?.resumen?.actividad_critica_total]
  );

  const onExportExcel = () => {
    const csv = buildCsvContent(data);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    downloadTextFile(csv, `security-summary-${stamp}.csv`, 'text/csv;charset=utf-8;');
  };

  const onExportPdf = () => {
    const printableHtml = buildPrintableHtml({ data, lastUpdated });
    const popup = window.open('', '_blank', 'width=1100,height=840');
    if (!popup) return;
    popup.document.open();
    popup.document.write(printableHtml);
    popup.document.close();
    popup.focus();
    setTimeout(() => popup.print(), 250);
  };

  if (permisosLoading) return null;

  if (!isSuperAdmin || noPermiso) {
    return (
      <SinPermiso
        permiso="SUPER_ADMIN"
        detalle="Solo Super Admin puede consultar el dashboard de seguridad."
      />
    );
  }

  return (
    <div className="card shadow-sm sec-sesiones-shell sec-dashboard-shell" style={{ backgroundColor: '#fff' }}>
      <div className="card-body p-0">
        <div className="sec-panel-header sec-sesiones-header">
          <div className="sec-panel-title-wrap">
            <div className="sec-panel-title-row">
              <i className="bi bi-graph-up-arrow sec-panel-title-icon" />
              <span className="sec-panel-title">DASHBOARD DE SEGURIDAD</span>
            </div>
            <div className="sec-panel-subtitle">Monitoreo consolidado de seguridad del sistema.</div>
          </div>

          <div className="sec-panel-header-actions sec-dashboard-actions">
            <div className="sec-dashboard-range-segment" role="tablist" aria-label="Rango de tiempo">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={`sec-dashboard-range-btn ${range === option.key ? 'is-active' : ''}`}
                  onClick={() => setRange(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="btn btn-outline-secondary sec-sesiones-global-btn"
              onClick={() => void loadSummary()}
              disabled={loading}
            >
              <i className="bi bi-arrow-clockwise me-2" />
              Actualizar
            </button>
            <button type="button" className="btn btn-outline-secondary sec-sesiones-global-btn" onClick={onExportExcel}>
              <i className="bi bi-file-earmark-spreadsheet me-2" />
              Excel
            </button>
            <button type="button" className="btn btn-outline-secondary sec-sesiones-global-btn" onClick={onExportPdf}>
              <i className="bi bi-filetype-pdf me-2" />
              PDF
            </button>
          </div>
        </div>

        <div className="sec-panel-body p-3 sec-sesiones-body">
          {loading ? <InlineLoader /> : null}
          {error ? <div className="alert alert-danger">{error}</div> : null}

          {!loading && !error ? (
            <>
              <div className="sec-results-meta sec-sesiones-results-meta sec-dashboard-meta">
                <span>Rango activo: {data?.range_label || '-'}</span>
                <span className="text-muted">
                  Ultima actualizacion: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '-'}
                </span>
              </div>

              <section className="sec-dashboard-block">
                <div className="sec-dashboard-block-head">
                  <h4>Indicadores de estado</h4>
                </div>
                <div className="sec-semaforo-grid">
                  {semaforos.map((item) => {
                    const state = item.value || { valor: 0, estado: 'verde', umbral_amarillo: 0, umbral_rojo: 0 };
                    return (
                      <article key={item.key} className={`sec-semaforo-card ${statusToClass(state.estado)}`}>
                        <div className={`sec-semaforo-dot ${statusToClass(state.estado)}`} />
                        <div className="sec-semaforo-content">
                          <span>{item.label}</span>
                          <strong>{formatNumber(state.valor)}</strong>
                          <small>{statusToText(state.estado)}</small>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>

              <div className="sec-dashboard-chart-grid">
                <section className="sec-dashboard-block">
                  <div className="sec-dashboard-block-head">
                    <h4>Logins fallidos (barras)</h4>
                  </div>
                  <BarChart rows={data?.graficos?.logins_fallidos_barras} />
                </section>

                <section className="sec-dashboard-block">
                  <div className="sec-dashboard-block-head">
                    <h4>Sesiones activas</h4>
                  </div>
                  <DonutChart total={data?.resumen?.sesiones_activas_totales} />
                </section>
              </div>

              <div className="sec-dashboard-table-grid">
                <section className="sec-dashboard-block">
                  <div className="sec-dashboard-block-head">
                    <h4>Top IPs con fallos</h4>
                  </div>
                  <div className="sec-sesiones-table-card">
                    <div className="table-responsive sec-sesiones-table-responsive">
                      <table className="table table-hover align-middle mb-0 sec-sesiones-table">
                        <thead>
                          <tr>
                            <th style={{ width: 70 }}>#</th>
                            <th>IP origen</th>
                            <th style={{ width: 160 }}>Total fallos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(data?.tablas?.top_ips || []).length === 0 ? (
                            <tr>
                              <td colSpan="3" className="text-center text-muted py-4">Sin fallos en el rango.</td>
                            </tr>
                          ) : (
                            (data.tablas.top_ips || []).map((row, index) => (
                              <tr key={`${row?.ip_origen || 'ip'}-${index}`}>
                                <td className="text-muted">{index + 1}</td>
                                <td>{row?.ip_origen || 'IP no registrada'}</td>
                                <td>{formatNumber(row?.total_fallos)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>

                <section className="sec-dashboard-block">
                  <div className="sec-dashboard-block-head">
                    <h4>Usuarios bloqueados</h4>
                  </div>
                  <div className="sec-sesiones-table-card">
                    <div className="table-responsive sec-sesiones-table-responsive">
                      <table className="table table-hover align-middle mb-0 sec-sesiones-table">
                        <thead>
                          <tr>
                            <th>Usuario</th>
                            <th>Rol</th>
                            <th>Fallos</th>
                            <th>Sesiones</th>
                            <th>Ultimo acceso</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(data?.tablas?.usuarios_bloqueados || []).length === 0 ? (
                            <tr>
                              <td colSpan="5" className="text-center text-muted py-4">Sin usuarios bloqueados.</td>
                            </tr>
                          ) : (
                            (data.tablas.usuarios_bloqueados || []).map((row, index) => (
                              <tr key={`blocked-${row?.id_usuario || index}`}>
                                <td>
                                  <div className="sec-user-cell">
                                    <strong>{row?.nombre_usuario || '-'}</strong>
                                    <small>{row?.nombre_completo || ''}</small>
                                  </div>
                                </td>
                                <td>{row?.rol || 'N/D'}</td>
                                <td>{formatNumber(row?.fallos_en_rango)}</td>
                                <td>{formatNumber(row?.sesiones_activas)}</td>
                                <td>{row?.ultimo_acceso ? fmtHN(row.ultimo_acceso) : '-'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>
              </div>

              <div className="sec-dashboard-table-grid">
                <section className="sec-dashboard-block">
                  <div className="sec-dashboard-block-head">
                    <h4>Usuarios con comportamiento sospechoso</h4>
                  </div>
                  <div className="sec-sesiones-table-card">
                    <div className="table-responsive sec-sesiones-table-responsive">
                      <table className="table table-hover align-middle mb-0 sec-sesiones-table">
                        <thead>
                          <tr>
                            <th>Usuario</th>
                            <th>Fallos consecutivos</th>
                            <th>Fallos en rango</th>
                            <th>Ultima IP</th>
                            <th>Ultimo fallo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(data?.usuarios_sospechosos || []).length === 0 ? (
                            <tr>
                              <td colSpan="5" className="text-center text-muted py-4">Sin usuarios sospechosos en el rango.</td>
                            </tr>
                          ) : (
                            (data.usuarios_sospechosos || []).map((row, index) => (
                              <tr key={`sus-${row?.id_usuario || index}`}>
                                <td>
                                  <div className="sec-user-cell">
                                    <strong>{row?.nombre_usuario || '-'}</strong>
                                    <small>{row?.nombre_completo || ''}</small>
                                  </div>
                                </td>
                                <td>{formatNumber(row?.fallos_consecutivos)}</td>
                                <td>{formatNumber(row?.fallos_en_rango)}</td>
                                <td>{row?.ultima_ip || 'IP no registrada'}</td>
                                <td>{row?.ultimo_fallo ? fmtHN(row.ultimo_fallo) : '-'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>

                <section className="sec-dashboard-block">
                  <div className="sec-dashboard-block-head">
                    <h4>Actividad critica reciente</h4>
                  </div>
                  <div className="sec-sesiones-table-card">
                    <div className="table-responsive sec-sesiones-table-responsive">
                      <table className="table table-hover align-middle mb-0 sec-sesiones-table">
                        <thead>
                          <tr>
                            <th>Actor</th>
                            <th>Accion</th>
                            <th>Descripcion</th>
                            <th>Fecha/Hora</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(data?.actividad_reciente || []).length === 0 ? (
                            <tr>
                              <td colSpan="4" className="text-center text-muted py-4">Sin actividad critica en el rango.</td>
                            </tr>
                          ) : (
                            (data.actividad_reciente || []).map((row, index) => (
                              <tr key={`act-${row?.id_bitacora || index}`}>
                                <td>{row?.actor || 'N/D'}</td>
                                <td>{row?.accion || '-'}</td>
                                <td>{row?.descripcion || '-'}</td>
                                <td>{row?.fecha_hora ? fmtHN(row.fecha_hora) : '-'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default SecurityDashboardTab;
