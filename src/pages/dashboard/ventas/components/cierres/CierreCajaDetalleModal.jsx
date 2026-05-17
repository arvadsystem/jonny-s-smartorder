import {
  formatCajaCurrency,
  formatCajaDateTime,
  resolveDifferenceBadge,
  resolveSessionStatusBadge
} from '../../utils/cajasHelpers';

const resolveRolCobroLabel = (row = {}) => {
  if (row.es_responsable || row.rol_participacion === 'RESPONSABLE') return 'Responsable';
  if (row.es_auxiliar || row.rol_participacion === 'AUXILIAR') return 'Auxiliar';
  return 'Ejecutor';
};

const resolveParticipantRole = (row = {}) => {
  const code = String(row.rol_codigo || row.rol_participacion || '').trim().toUpperCase();
  if (code === 'RESPONSABLE') return 'Responsable';
  if (code === 'AUXILIAR') return 'Auxiliar';
  return 'Ejecutor';
};

export default function CierreCajaDetalleModal({
  open,
  detalle,
  loading,
  canRegisterArqueo,
  canCloseSession,
  canUseCloseFlow,
  canViewCajaTheoreticalAmounts = true,
  onClose,
  onOpenArqueo,
  onOpenCerrar
}) {
  if (!open) return null;

  const sesion = detalle?.sesion;
  const resumen = detalle?.resumen_operativo ?? {};
  const participantes = Array.isArray(detalle?.equipo_caja) ? detalle.equipo_caja : (Array.isArray(detalle?.participantes) ? detalle.participantes : []);
  const cierre = detalle?.cierre ?? null;
  const statusBadge = resolveSessionStatusBadge(sesion);
  const differenceBadge = canViewCajaTheoreticalAmounts
    ? resolveDifferenceBadge(cierre?.diferencia ?? resumen?.diferencia_cierre ?? sesion?.diferencia_cierre ?? null)
    : { label: 'Comparación no visible', className: 'bg-light border-secondary text-secondary' };
  const isOpen = sesion?.estado_codigo === 'ABIERTA';

  return (
    <div className="ventas-modal-backdrop" onClick={onClose}>
      <section
        className="ventas-modal ventas-detail-modal cierres-caja-detail-modal"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ventas-modal__header">
          <div className="ventas-modal__title-wrap">
            <span className="ventas-modal__icon">
              <i className="bi bi-safe2-fill" />
            </span>
            <div>
              <h3>Detalle de cierre</h3>
              <p>
                {sesion?.id_sesion_caja
                  ? `Sesion SES-${String(sesion.id_sesion_caja).padStart(5, '0')}`
                  : 'Resumen operativo de la sesion'}
              </p>
            </div>
          </div>

          <div className="ventas-modal__header-actions">
            {canRegisterArqueo ? (
              <button
                type="button"
                className="ventas-modal__ghost-btn"
                title="Registrar arqueo"
                onClick={() => onOpenArqueo(sesion)}
                disabled={!isOpen}
              >
                <i className="bi bi-calculator" />
              </button>
            ) : null}
            {canCloseSession ? (
              <button
                type="button"
                className="ventas-modal__ghost-btn"
                title="Cerrar caja"
                onClick={() => onOpenCerrar(sesion)}
                disabled={!isOpen || !canUseCloseFlow}
              >
                <i className="bi bi-lock" />
              </button>
            ) : null}
            <button type="button" className="ventas-modal__close-btn" onClick={onClose} aria-label="Cerrar">
              <i className="bi bi-x-lg" />
            </button>
          </div>
        </header>

        <div className="ventas-modal__body ventas-detail-modal__body">
          {loading || !detalle ? (
            <div className="ventas-create-modal__empty shadow-none border-0 bg-transparent">
              <div className="spinner-border text-danger" role="status" />
              <span>Cargando detalle de la sesion...</span>
            </div>
          ) : (
            <div className="d-flex flex-column gap-4">
              <div className="cierres-caja-detail__badges">
                <span className={`ventas-page__table-pill ${statusBadge.className}`}>{statusBadge.label}</span>
                <span className={`ventas-page__table-pill ${differenceBadge.className}`}>{differenceBadge.label}</span>
                {cierre?.resolucion_nombre ? (
                  <span className="ventas-page__table-pill bg-white border-secondary text-secondary">
                    {cierre.resolucion_nombre}
                  </span>
                ) : null}
              </div>

              <section className="ventas-page__table-card">
                <div className="p-3 pb-0">
                  <div className="inv-prod-title-row mb-2">
                    <i className="bi bi-layout-text-window-reverse text-danger inv-prod-title-icon" style={{ background: 'rgba(220,53,69,0.1)' }} />
                    <span className="inv-prod-title">Detalle global</span>
                  </div>
                </div>
                <div className="ventas-page__table-wrap cierres-caja-detail__table-wrap">
                  <table className="table ventas-page__table">
                    <thead>
                      <tr>
                        <th>Caja</th>
                        <th>Sucursal</th>
                        <th className="text-end">Apertura</th>
                        <th>Cierre</th>
                        <th>Estado</th>
                        {canViewCajaTheoreticalAmounts ? <th className="text-end">Diferencia</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>{sesion?.nombre_caja || 'Sin caja'}</td>
                        <td>{sesion?.nombre_sucursal || 'Sin sucursal'}</td>
                        <td className="text-end">L. {formatCajaCurrency(sesion?.monto_apertura)}</td>
                        <td>{formatCajaDateTime(sesion?.fecha_cierre || cierre?.fecha_cierre)}</td>
                        <td>{statusBadge.label}</td>
                        {canViewCajaTheoreticalAmounts ? (
                          <td className="text-end">L. {formatCajaCurrency(cierre?.diferencia ?? resumen?.diferencia_cierre ?? 0)}</td>
                        ) : null}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="ventas-page__table-card">
                <div className="p-3 pb-0">
                  <div className="inv-prod-title-row mb-2">
                    <i className="bi bi-person-badge text-danger inv-prod-title-icon" style={{ background: 'rgba(220,53,69,0.1)' }} />
                    <span className="inv-prod-title">Equipo de caja</span>
                  </div>
                </div>
                <div className="ventas-page__table-wrap cierres-caja-detail__table-wrap">
                  <table className="table ventas-page__table">
                    <thead>
                      <tr>
                        <th>Usuario</th>
                        <th>Rol</th>
                        <th>Inicio</th>
                        <th>Fin</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {participantes.length === 0 ? (
                        <tr><td colSpan="5" className="text-center py-4 text-muted">No hay registros.</td></tr>
                      ) : participantes.map((row) => (
                        <tr key={row.id_participacion_caja || row.id_usuario}>
                          <td>{row.nombre_completo || row.nombre_usuario || 'Usuario no disponible'}</td>
                          <td>{resolveParticipantRole(row)}</td>
                          <td>{formatCajaDateTime(row.fecha_inicio)}</td>
                          <td>{formatCajaDateTime(row.fecha_fin)}</td>
                          <td>{row.activo ? 'Activo' : 'Inactivo'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="ventas-page__table-card">
                <div className="p-3 pb-0">
                  <div className="inv-prod-title-row mb-2">
                    <i className="bi bi-clipboard-data text-danger inv-prod-title-icon" style={{ background: 'rgba(220,53,69,0.1)' }} />
                    <span className="inv-prod-title">Resumen operativo</span>
                  </div>
                </div>
                <div className="ventas-page__table-wrap cierres-caja-detail__table-wrap">
                  <table className="table ventas-page__table">
                    <thead>
                      <tr>
                        {canViewCajaTheoreticalAmounts ? <th className="text-end">Ventas efectivo</th> : null}
                        {canViewCajaTheoreticalAmounts ? <th className="text-end">Ventas no efectivo</th> : null}
                        {canViewCajaTheoreticalAmounts ? <th className="text-end">Ingresos manuales</th> : null}
                        {canViewCajaTheoreticalAmounts ? <th className="text-end">Egresos manuales</th> : null}
                        <th className="text-end">Total responsable</th>
                        <th className="text-end">Total auxiliares</th>
                        {canViewCajaTheoreticalAmounts ? <th className="text-end">Monto teórico</th> : null}
                        <th className="text-end">Monto declarado</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {canViewCajaTheoreticalAmounts ? <td className="text-end">L. {formatCajaCurrency(resumen.ventas_efectivo)}</td> : null}
                        {canViewCajaTheoreticalAmounts ? <td className="text-end">L. {formatCajaCurrency(resumen.ventas_no_efectivo)}</td> : null}
                        {canViewCajaTheoreticalAmounts ? <td className="text-end">L. {formatCajaCurrency(resumen.ingresos_manuales)}</td> : null}
                        {canViewCajaTheoreticalAmounts ? <td className="text-end">L. {formatCajaCurrency(resumen.egresos_manuales)}</td> : null}
                        <td className="text-end">L. {formatCajaCurrency(resumen.total_responsable)}</td>
                        <td className="text-end">L. {formatCajaCurrency(resumen.total_auxiliares)}</td>
                        {canViewCajaTheoreticalAmounts ? (
                          <td className="text-end">L. {formatCajaCurrency(resumen.monto_teorico ?? resumen.efectivo_teorico)}</td>
                        ) : null}
                        <td className="text-end">L. {formatCajaCurrency(resumen.monto_declarado ?? cierre?.monto_declarado_cierre ?? resumen.monto_declarado_cierre)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="ventas-page__table-card">
                <div className="p-3 pb-0">
                  <div className="inv-prod-title-row mb-2">
                    <i className="bi bi-people text-danger inv-prod-title-icon" style={{ background: 'rgba(220,53,69,0.1)' }} />
                    <span className="inv-prod-title">Cobros por usuario</span>
                  </div>
                </div>
                <div className="ventas-page__table-wrap">
                  <table className="table ventas-page__table">
                    <thead>
                      <tr>
                        <th>Usuario</th>
                        <th className="text-center">Rol</th>
                        <th className="text-center">Cobros</th>
                        {canViewCajaTheoreticalAmounts ? <th className="text-end">Total efectivo</th> : null}
                        {canViewCajaTheoreticalAmounts ? <th className="text-end">Total no efectivo</th> : null}
                        <th className="text-end">Total cobrado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalle.cobros_por_usuario.length === 0 ? (
                        <tr>
                          <td colSpan={canViewCajaTheoreticalAmounts ? 6 : 4} className="text-center py-4 text-muted">
                            No hay registros.
                          </td>
                        </tr>
                      ) : (
                        detalle.cobros_por_usuario.map((row) => (
                          <tr key={row.id_usuario_ejecutor}>
                            <td>
                              <div className="ventas-page__table-sale">
                                <strong>{row.nombre_completo || row.nombre_usuario}</strong>
                                <span>{row.nombre_usuario ? `@${row.nombre_usuario}` : 'Usuario sin alias'}</span>
                              </div>
                            </td>
                            <td className="text-center align-middle">{resolveRolCobroLabel(row)}</td>
                            <td className="text-center align-middle">{row.cobros_registrados}</td>
                            {canViewCajaTheoreticalAmounts ? (
                              <td className="text-end align-middle">L. {formatCajaCurrency(row.total_efectivo)}</td>
                            ) : null}
                            {canViewCajaTheoreticalAmounts ? (
                              <td className="text-end align-middle">L. {formatCajaCurrency(row.total_no_efectivo)}</td>
                            ) : null}
                            <td className="text-end align-middle ventas-page__table-total">
                              L. {formatCajaCurrency(row.total_cobrado)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="ventas-page__table-card">
                <div className="p-3 pb-0">
                  <div className="inv-prod-title-row mb-2">
                    <i className="bi bi-calculator text-danger inv-prod-title-icon" style={{ background: 'rgba(220,53,69,0.1)' }} />
                    <span className="inv-prod-title">Arqueos</span>
                  </div>
                </div>
                <div className="ventas-page__table-wrap">
                  <table className="table ventas-page__table">
                    <thead>
                      <tr>
                        <th>Tipo</th>
                        <th>Fecha</th>
                        <th className="text-end">Contado</th>
                        {canViewCajaTheoreticalAmounts ? <th className="text-end">Diferencia</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {detalle.arqueos.length === 0 ? (
                        <tr>
                          <td colSpan={canViewCajaTheoreticalAmounts ? 4 : 3} className="text-center py-4 text-muted">
                            No hay registros.
                          </td>
                        </tr>
                      ) : (
                        detalle.arqueos.map((arqueo) => (
                          <tr key={arqueo.id_arqueo_caja}>
                            <td>{arqueo.tipo_nombre || arqueo.tipo_codigo}</td>
                            <td>{formatCajaDateTime(arqueo.fecha_arqueo)}</td>
                            <td className="text-end">L. {formatCajaCurrency(arqueo.monto_contado)}</td>
                            {canViewCajaTheoreticalAmounts ? (
                              <td className="text-end">L. {formatCajaCurrency(arqueo.diferencia)}</td>
                            ) : null}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {cierre?.observacion ? (
                <section className="ventas-page__table-card p-3">
                  <div className="inv-prod-title-row mb-2">
                    <i className="bi bi-chat-left-text text-danger inv-prod-title-icon" style={{ background: 'rgba(220,53,69,0.1)' }} />
                    <span className="inv-prod-title">Observacion de cierre</span>
                  </div>
                  <p className="mb-0 text-muted fw-semibold">{cierre.observacion}</p>
                </section>
              ) : null}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
