import { useEffect, useMemo, useRef, useState } from 'react';
import InlineLoader from '../../../components/common/InlineLoader';
import SinPermiso from '../../../components/common/SinPermiso';
import SecurityConfirmAction from "./components/SecurityConfirmAction";
import { fmtHN } from '../../../utils/dateTime';
import { securityAuditApi } from './services/securityAuditApi';
import './sesiones-ui.css';
import './seguridad-auditoria-ui.css';

const PAGE_SIZE = 10;
const AUTO_REFRESH_MS = 15000;

const fmtDate = (value) => (value ? fmtHN(value) : '—');

const estadoUsuarioBadge = (estado) => {
  if (estado === true) return <span className="badge bg-success">ACTIVO</span>;
  if (estado === false) return <span className="badge bg-danger">BLOQUEADO</span>;
  return <span className="badge bg-secondary">—</span>;
};

const estadoSesionBadge = (sesion) => {
  if (sesion?.activa) {
    return <span className="sec-badge sec-badge-active">ACTIVA</span>;
  }
  return <span className="sec-badge sec-badge-closed">CERRADA</span>;
};

const estadoLoginBadge = (exito) => {
  if (exito === true) return <span className="sec-badge sec-badge-active">ÉXITO</span>;
  if (exito === false) return <span className="sec-badge sec-badge-fail">FALLIDO</span>;
  return <span className="sec-badge sec-badge-closed">—</span>;
};

const initialLoginsDraft = {
  estado: '',
  desde: '',
  hasta: ''
};

const UsuarioAuditDetail = ({ userId, onBack }) => {
  const [activeTab, setActiveTab] = useState('perfil');

  const [noPermiso, setNoPermiso] = useState(false);
  const [error, setError] = useState('');

  const [perfilLoading, setPerfilLoading] = useState(true);
  const [perfil, setPerfil] = useState(null);
  const [ultimoAcceso, setUltimoAcceso] = useState(null);
  const [sesionesActivasPerfil, setSesionesActivasPerfil] = useState(0);

  const [sesionesLoading, setSesionesLoading] = useState(false);
  const [sesionesRows, setSesionesRows] = useState([]);
  const [sesionesTotal, setSesionesTotal] = useState(0);
  const [sesionesFilters, setSesionesFilters] = useState({
    estado: 'todas',
    limit: PAGE_SIZE,
    offset: 0
  });

  const [loginsLoading, setLoginsLoading] = useState(false);
  const [loginsRows, setLoginsRows] = useState([]);
  const [loginsTotal, setLoginsTotal] = useState(0);
  const [loginsDraft, setLoginsDraft] = useState(initialLoginsDraft);
  const [loginsFilters, setLoginsFilters] = useState({
    ...initialLoginsDraft,
    limit: PAGE_SIZE,
    offset: 0
  });

  const [closingSessions, setClosingSessions] = useState(false);
  const [actionMessage, setActionMessage] = useState({ variant: '', message: '' });

  const sesionesRef = useRef(null);

  const resolvedUserId = Number(userId || 0);

  const loadPerfil = async () => {
    setPerfilLoading(true);
    setError('');
    setNoPermiso(false);
    try {
      const data = await securityAuditApi.getUsuarioDetalle(resolvedUserId);
      setPerfil(data?.perfil || null);
      setUltimoAcceso(data?.ultimo_acceso || null);
      setSesionesActivasPerfil(Number(data?.sesiones_activas || 0));
    } catch (e) {
      if (e?.status === 403) {
        setNoPermiso(true);
      } else {
        setError(e?.message || 'Error cargando detalle de usuario');
      }
    } finally {
      setPerfilLoading(false);
    }
  };

  const loadSesiones = async ({ silent = false } = {}) => {
    if (!silent) setSesionesLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      if (sesionesFilters.estado && sesionesFilters.estado !== 'todas') {
        qs.set('estado', sesionesFilters.estado);
      }
      qs.set('limit', String(sesionesFilters.limit));
      qs.set('offset', String(sesionesFilters.offset));
      qs.set('_ts', String(Date.now()));

      const data = await securityAuditApi.getUsuarioSesiones(resolvedUserId, qs.toString());
      setSesionesRows(data?.rows || []);
      setSesionesTotal(Number(data?.total || 0));
    } catch (e) {
      if (e?.status === 403) {
        setNoPermiso(true);
      } else {
        setError(e?.message || 'Error cargando sesiones del usuario');
      }
    } finally {
      if (!silent) setSesionesLoading(false);
    }
  };

  const loadLogins = async () => {
    setLoginsLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      if (loginsFilters.estado) qs.set('estado', loginsFilters.estado);
      if (loginsFilters.desde) qs.set('desde', loginsFilters.desde);
      if (loginsFilters.hasta) qs.set('hasta', loginsFilters.hasta);
      qs.set('limit', String(loginsFilters.limit));
      qs.set('offset', String(loginsFilters.offset));
      qs.set('_ts', String(Date.now()));

      const data = await securityAuditApi.getUsuarioLogins(resolvedUserId, qs.toString());
      setLoginsRows(data?.rows || []);
      setLoginsTotal(Number(data?.total || 0));
    } catch (e) {
      if (e?.status === 403) {
        setNoPermiso(true);
      } else {
        setError(e?.message || 'Error cargando logins del usuario');
      }
    } finally {
      setLoginsLoading(false);
    }
  };

  useEffect(() => {
    if (!resolvedUserId) return;
    loadPerfil();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedUserId]);

  useEffect(() => {
    if (!resolvedUserId || activeTab !== 'sesiones') return;
    loadSesiones();
    sesionesRef.current = loadSesiones;

    const timer = setInterval(() => {
      sesionesRef.current?.({ silent: true });
    }, AUTO_REFRESH_MS);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedUserId, activeTab, sesionesFilters.estado, sesionesFilters.limit, sesionesFilters.offset]);

  useEffect(() => {
    if (!resolvedUserId || activeTab !== 'logins') return;
    loadLogins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedUserId, activeTab, loginsFilters.estado, loginsFilters.desde, loginsFilters.hasta, loginsFilters.limit, loginsFilters.offset]);

  const sesionesCanPrev = sesionesFilters.offset > 0;
  const sesionesCanNext = sesionesFilters.offset + sesionesFilters.limit < sesionesTotal;
  const sesionesShown = Math.min(sesionesFilters.offset + sesionesRows.length, sesionesTotal);

  const loginsCanPrev = loginsFilters.offset > 0;
  const loginsCanNext = loginsFilters.offset + loginsFilters.limit < loginsTotal;
  const loginsShown = Math.min(loginsFilters.offset + loginsRows.length, loginsTotal);

  const fullName = useMemo(() => {
    if (!perfil) return 'USUARIO';
    const n = `${perfil?.nombre || ''} ${perfil?.apellido || ''}`.trim();
    return n || perfil?.nombre_usuario || 'USUARIO';
  }, [perfil]);

  const onAplicarLogins = () => {
    setLoginsFilters((prev) => ({
      ...prev,
      estado: loginsDraft.estado,
      desde: loginsDraft.desde,
      hasta: loginsDraft.hasta,
      offset: 0
    }));
  };

  const onLimpiarLogins = () => {
    setLoginsDraft(initialLoginsDraft);
    setLoginsFilters({
      ...initialLoginsDraft,
      limit: PAGE_SIZE,
      offset: 0
    });
  };

  const onCerrarSesiones = async () => {
    setClosingSessions(true);
    setActionMessage({ variant: '', message: '' });

    try {
      const data = await securityAuditApi.cerrarSesionesUsuario(resolvedUserId);
      const cerradas = Number(data?.cerradas || 0);
      if (cerradas > 0) {
        setActionMessage({
          variant: 'success',
          message: `SE CERRARON ${cerradas} SESIONES ACTIVAS DEL USUARIO.`
        });
      } else {
        setActionMessage({
          variant: 'info',
          message: 'NO HAY SESIONES ACTIVAS PARA CERRAR.'
        });
      }

      await loadPerfil();
      if (activeTab === 'sesiones') {
        await loadSesiones({ silent: true });
      }
    } catch (e) {
      setActionMessage({
        variant: 'danger',
        message: e?.message || 'NO SE PUDIERON CERRAR LAS SESIONES.'
      });
    } finally {
      setClosingSessions(false);
    }
  };

  if (noPermiso) {
    return <SinPermiso permiso="SEGURIDAD_VER" detalle="Solo Super Admin puede auditar usuarios." />;
  }

  return (
    <div className="card shadow-sm sec-sesiones-shell" style={{ backgroundColor: '#fff' }}>
      <div className="card-body p-0">
        <div className="sec-panel-header sec-sesiones-header">
          <div className="sec-panel-title-wrap">
            <div className="sec-panel-title-row">
              <i className="bi bi-person-vcard sec-panel-title-icon" />
              <span className="sec-panel-title">AUDITORÍA DE USUARIO</span>
            </div>
            <div className="sec-panel-subtitle">{fullName}</div>
          </div>

          <div className="sec-panel-header-actions sec-audit-header-actions gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={onBack}>
              <i className="bi bi-arrow-left me-2" />
              REGRESAR A USUARIOS
            </button>

          </div>
        </div>

        {actionMessage.message ? (
          <div className={`alert alert-${actionMessage.variant} sec-audit-message mb-0`} role="alert">
            {actionMessage.message}
          </div>
        ) : null}

        <div className="sec-audit-tabs">
          <button
            type="button"
            className={`sec-audit-tab-btn ${activeTab === 'perfil' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('perfil')}
          >
            PERFIL
          </button>
          <button
            type="button"
            className={`sec-audit-tab-btn ${activeTab === 'sesiones' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('sesiones')}
          >
            SESIONES
          </button>
          <button
            type="button"
            className={`sec-audit-tab-btn ${activeTab === 'logins' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('logins')}
          >
            LOGINS
          </button>
        </div>

        <div className="sec-panel-body p-3 sec-sesiones-body">
          {error ? <div className="alert alert-danger">{error}</div> : null}

          {activeTab === 'perfil' && (
            <>
              {perfilLoading ? (
                <InlineLoader />
              ) : (
                <>
                  <div className="sec-audit-profile-layout">
                    <aside className="sec-audit-profile-focus">
                      <div className="sec-audit-profile-focus-name">
                        {(fullName || perfil?.nombre_usuario || 'USUARIO').toUpperCase()}
                      </div>

                      <div className="sec-audit-profile-focus-avatar" aria-hidden="true">
                        <i className="bi bi-person-circle" />
                      </div>

                      <div className="sec-audit-profile-focus-stats">
                        <span className="sec-audit-chip">
                          <i className="bi bi-shield-check" />
                          SESIONES ACTIVAS: {sesionesActivasPerfil}
                        </span>
                        <span className="sec-audit-profile-focus-status">
                          {estadoUsuarioBadge(perfil?.estado)}
                        </span>
                      </div>
                    </aside>

                    <div className="sec-audit-profile-grid">
                      <div className="sec-audit-profile-item">
                        <div className="label">Usuario</div>
                        <div className="value">{perfil?.nombre_usuario || '—'}</div>
                      </div>
                      <div className="sec-audit-profile-item">
                        <div className="label">Rol</div>
                        <div className="value">{perfil?.rol || '—'}</div>
                      </div>
                      <div className="sec-audit-profile-item">
                        <div className="label">DNI</div>
                        <div className="value">{perfil?.dni || '—'}</div>
                      </div>
                      <div className="sec-audit-profile-item">
                        <div className="label">Correo</div>
                        <div className="value">{perfil?.correo || '—'}</div>
                      </div>
                      <div className="sec-audit-profile-item">
                        <div className="label">Teléfono</div>
                        <div className="value">{perfil?.telefono || '—'}</div>
                      </div>
                      <div className="sec-audit-profile-item">
                        <div className="label">Dirección</div>
                        <div className="value">{perfil?.direccion || '—'}</div>
                      </div>
                      <div className="sec-audit-profile-item">
                        <div className="label">Último acceso</div>
                        <div className="value">{fmtDate(ultimoAcceso?.fecha_hora)}</div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {activeTab === 'sesiones' && (
            <>
              <div className="row g-2 align-items-end mb-3">
                <div className="col-md-4">
                  <label className="form-label">Estado</label>
                  <select
                    className="form-select"
                    value={sesionesFilters.estado}
                    onChange={(e) =>
                      setSesionesFilters((prev) => ({
                        ...prev,
                        estado: e.target.value,
                        offset: 0
                      }))
                    }
                  >
                    <option value="todas">Todas</option>
                    <option value="activas">Activas</option>
                    <option value="cerradas">Cerradas</option>
                  </select>
                </div>
                <div className="col-md-8 d-flex justify-content-md-end">
                  <SecurityConfirmAction
                    className="btn btn-outline-danger mt-2 mt-md-0"
                    title="CONFIRMAR CIERRE DE SESIONES"
                    subtitle="Se forzará nuevo inicio de sesión para este usuario."
                    question="¿Deseas cerrar todas las sesiones activas de este usuario?"
                    onConfirm={onCerrarSesiones}
                    disabled={closingSessions}
                  >
                    {closingSessions ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        PROCESANDO...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-x-octagon me-2"></i>
                        CERRAR SESIONES
                      </>
                    )}
                  </SecurityConfirmAction>
                </div>
              </div>

              {sesionesLoading ? <InlineLoader /> : null}

              {!sesionesLoading && (
                <>
                  <div className="sec-results-meta sec-sesiones-results-meta">
                    <span>Mostrando {sesionesShown} de {sesionesTotal}</span>
                    <span className="text-muted">Actualización automática cada 15 s</span>
                  </div>

                  <div className="sec-sesiones-table-card">
                    <div className="table-responsive sec-sesiones-table-responsive">
                      <table className="table table-hover align-middle mb-0 sec-sesiones-table">
                        <thead>
                          <tr>
                            <th>Estado</th>
                            <th>Dispositivo</th>
                            <th>Navegador</th>
                            <th>SO</th>
                            <th>IP</th>
                            <th>Inicio</th>
                            <th>Última actividad</th>
                            <th>Cierre</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sesionesRows.length === 0 ? (
                            <tr>
                              <td colSpan="8" className="text-center text-muted py-4">
                                No hay sesiones para este usuario.
                              </td>
                            </tr>
                          ) : (
                            sesionesRows.map((s) => (
                              <tr key={s.id_sesion}>
                                <td>{estadoSesionBadge(s)}</td>
                                <td>{s.dispositivo || '—'}</td>
                                <td>{s.navegador || '—'}</td>
                                <td>{s.sistema_operativo || '—'}</td>
                                <td>{s.ip_origen || '—'}</td>
                                <td>{fmtDate(s.fecha_inicio)}</td>
                                <td>{fmtDate(s.ultima_actividad)}</td>
                                <td>{fmtDate(s.fecha_cierre)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="d-flex justify-content-between align-items-center mt-3">
                    <small className="text-muted">
                      Mostrando {sesionesShown} de {sesionesTotal}
                    </small>

                    <div className="btn-group">
                      <button
                        className="btn btn-outline-secondary"
                        disabled={!sesionesCanPrev}
                        onClick={() =>
                          setSesionesFilters((prev) => ({
                            ...prev,
                            offset: Math.max(0, prev.offset - prev.limit)
                          }))
                        }
                      >
                        Anterior
                      </button>
                      <button
                        className="btn btn-outline-secondary"
                        disabled={!sesionesCanNext}
                        onClick={() =>
                          setSesionesFilters((prev) => ({
                            ...prev,
                            offset: prev.offset + prev.limit
                          }))
                        }
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {activeTab === 'logins' && (
            <>
              <div className="row g-2 align-items-end mb-3">
                <div className="col-md-3">
                  <label className="form-label">Estado</label>
                  <select
                    className="form-select"
                    value={loginsDraft.estado}
                    onChange={(e) => setLoginsDraft((prev) => ({ ...prev, estado: e.target.value }))}
                  >
                    <option value="">Todos</option>
                    <option value="SUCCESS">Exitosos</option>
                    <option value="FAIL">Fallidos</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Desde</label>
                  <input
                    type="date"
                    className="form-control"
                    value={loginsDraft.desde}
                    onChange={(e) => setLoginsDraft((prev) => ({ ...prev, desde: e.target.value }))}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Hasta</label>
                  <input
                    type="date"
                    className="form-control"
                    value={loginsDraft.hasta}
                    onChange={(e) => setLoginsDraft((prev) => ({ ...prev, hasta: e.target.value }))}
                  />
                </div>
                <div className="col-md-3 d-flex gap-2">
                  <button className="btn btn-primary w-100" onClick={onAplicarLogins}>
                    Aplicar
                  </button>
                  <button className="btn btn-outline-secondary w-100" onClick={onLimpiarLogins}>
                    Limpiar
                  </button>
                </div>
              </div>

              {loginsLoading ? <InlineLoader /> : null}

              {!loginsLoading && (
                <>
                  <div className="sec-results-meta sec-sesiones-results-meta">
                    <span>Mostrando {loginsShown} de {loginsTotal}</span>
                    <span className="text-muted">Orden: más reciente primero</span>
                  </div>

                  <div className="sec-sesiones-table-card">
                    <div className="table-responsive sec-sesiones-table-responsive">
                      <table className="table table-hover align-middle mb-0 sec-sesiones-table">
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Estado</th>
                            <th>Usuario</th>
                            <th>IP</th>
                            <th>Navegador</th>
                            <th>SO</th>
                            <th>Dispositivo</th>
                            <th>Mensaje</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loginsRows.length === 0 ? (
                            <tr>
                              <td colSpan="8" className="text-center text-muted py-4">
                                No hay logins para este usuario.
                              </td>
                            </tr>
                          ) : (
                            loginsRows.map((r) => (
                              <tr key={r.id_login}>
                                <td>{fmtDate(r.fecha_hora)}</td>
                                <td>{estadoLoginBadge(r.exito)}</td>
                                <td>{r.usuario || r.nombre_usuario_intentado || '—'}</td>
                                <td>{r.ip_origen || '—'}</td>
                                <td>{r.navegador || '—'}</td>
                                <td>{r.sistema_operativo || '—'}</td>
                                <td>{r.dispositivo || '—'}</td>
                                <td className="small text-muted">{r.mensaje_error || '—'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="d-flex justify-content-between align-items-center mt-3">
                    <small className="text-muted">
                      Mostrando {loginsShown} de {loginsTotal}
                    </small>

                    <div className="btn-group">
                      <button
                        className="btn btn-outline-secondary"
                        disabled={!loginsCanPrev}
                        onClick={() =>
                          setLoginsFilters((prev) => ({
                            ...prev,
                            offset: Math.max(0, prev.offset - prev.limit)
                          }))
                        }
                      >
                        Anterior
                      </button>
                      <button
                        className="btn btn-outline-secondary"
                        disabled={!loginsCanNext}
                        onClick={() =>
                          setLoginsFilters((prev) => ({
                            ...prev,
                            offset: prev.offset + prev.limit
                          }))
                        }
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UsuarioAuditDetail;
