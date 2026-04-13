import {
  formatCajaCurrency,
  formatCajaDateTime,
  resolveDifferenceBadge,
  resolveSessionStatusBadge
} from '../../utils/cajasHelpers';

const InfoCard = ({ icon, label, value, accent = false }) => (
  <article className={`ventas-detail-modal__info-card ${accent ? 'cierres-caja-detail__info-card--accent' : ''}`}>
    <span className="ventas-detail-modal__info-icon">
      <i className={icon} />
    </span>
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  </article>
);

export default function CierreCajaDetalleModal({
  open,
  detalle,
  loading,
  canRegisterArqueo,
  canCloseSession,
  canUseCloseFlow,
  onClose,
  onOpenArqueo,
  onOpenCerrar
}) {
  if (!open) return null;

  const sesion = detalle?.sesion;
  const responsable = detalle?.responsable;
  const resumen = detalle?.resumen_operativo ?? {};
  const participantes = Array.isArray(detalle?.participantes) ? detalle.participantes : [];
  const auxiliares = participantes.filter((item) => item.rol_codigo !== 'RESPONSABLE');
  const cierre = detalle?.cierre ?? null;
  const statusBadge = resolveSessionStatusBadge(sesion);
  const differenceBadge = resolveDifferenceBadge(
    cierre?.diferencia ?? resumen?.diferencia_cierre ?? sesion?.diferencia_cierre ?? null
  );
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

              <div className="ventas-detail-modal__info-grid">
                <InfoCard icon="bi bi-shop" label="Caja" value={sesion?.nombre_caja || 'Sin caja'} />
                <InfoCard icon="bi bi-building" label="Sucursal" value={sesion?.nombre_sucursal || 'Sin sucursal'} />
                <InfoCard icon="bi bi-cash-stack" label="Monto apertura" value={`L. ${formatCajaCurrency(sesion?.monto_apertura)}`} />
                <InfoCard
                  icon="bi bi-activity"
                  label="Diferencia"
                  value={`L. ${formatCajaCurrency(cierre?.diferencia ?? resumen?.diferencia_cierre ?? 0)}`}
                  accent
                />
              </div>

              <div className="cierres-caja-detail__two-column">
                <section className="ventas-page__table-card p-3">
                  <div className="inv-prod-title-row mb-2">
                    <i className="bi bi-person-badge text-danger inv-prod-title-icon" style={{ background: 'rgba(220,53,69,0.1)' }} />
                    <span className="inv-prod-title">Equipo de caja</span>
                  </div>

                  <div className="cierres-caja-detail__team-grid">
                    <article className="cierres-caja-detail__team-card">
                      <span className="cierres-caja-detail__team-label">Responsable</span>
                      <strong>{responsable?.nombre_completo || sesion?.responsable_nombre || 'Sin responsable'}</strong>
                      <small>{responsable?.nombre_usuario ? `@${responsable.nombre_usuario}` : 'Usuario no disponible'}</small>
                    </article>

                    <article className="cierres-caja-detail__team-card">
                      <span className="cierres-caja-detail__team-label">Auxiliares</span>
                      {auxiliares.length === 0 ? (
                        <strong>Sin auxiliares</strong>
                      ) : (
                        <div className="cierres-caja-detail__team-list">
                          {auxiliares.map((auxiliar) => (
                            <span key={auxiliar.id_participacion_caja}>
                              {auxiliar.nombre_completo || auxiliar.nombre_usuario}
                            </span>
                          ))}
                        </div>
                      )}
                    </article>
                  </div>
                </section>

                <section className="ventas-page__table-card p-3">
                  <div className="inv-prod-title-row mb-2">
                    <i className="bi bi-clipboard-data text-danger inv-prod-title-icon" style={{ background: 'rgba(220,53,69,0.1)' }} />
                    <span className="inv-prod-title">Resumen operativo</span>
                  </div>

                  <div className="d-grid gap-2">
                    <InfoCard icon="bi bi-cash-coin" label="Ventas efectivo" value={`L. ${formatCajaCurrency(resumen.ventas_efectivo)}`} />
                    <InfoCard icon="bi bi-credit-card-2-front" label="Ventas no efectivo" value={`L. ${formatCajaCurrency(resumen.ventas_no_efectivo)}`} />
                    <InfoCard icon="bi bi-plus-circle" label="Ingresos manuales" value={`L. ${formatCajaCurrency(resumen.ingresos_manuales)}`} />
                    <InfoCard icon="bi bi-dash-circle" label="Egresos manuales" value={`L. ${formatCajaCurrency(resumen.egresos_manuales)}`} />
                    <InfoCard icon="bi bi-calculator" label="Monto teorico" value={`L. ${formatCajaCurrency(resumen.efectivo_teorico)}`} accent />
                    <InfoCard
                      icon="bi bi-journal-check"
                      label="Monto declarado"
                      value={`L. ${formatCajaCurrency(cierre?.monto_declarado_cierre ?? resumen.monto_declarado_cierre ?? 0)}`}
                    />
                  </div>
                </section>
              </div>

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
                        <th className="text-center">Cobros</th>
                        <th className="text-end">Total cobrado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalle.cobros_por_usuario.length === 0 ? (
                        <tr>
                          <td colSpan="3" className="text-center py-4 text-muted">
                            No hay cobros registrados en esta sesion.
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
                            <td className="text-center align-middle">{row.cobros_registrados}</td>
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

              <div className="cierres-caja-detail__two-column">
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
                          <th className="text-end">Diferencia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalle.arqueos.length === 0 ? (
                          <tr>
                            <td colSpan="4" className="text-center py-4 text-muted">
                              No hay arqueos registrados.
                            </td>
                          </tr>
                        ) : (
                          detalle.arqueos.map((arqueo) => (
                            <tr key={arqueo.id_arqueo_caja}>
                              <td>{arqueo.tipo_nombre || arqueo.tipo_codigo}</td>
                              <td>{formatCajaDateTime(arqueo.fecha_arqueo)}</td>
                              <td className="text-end">L. {formatCajaCurrency(arqueo.monto_contado)}</td>
                              <td className="text-end">L. {formatCajaCurrency(arqueo.diferencia)}</td>
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
                      <i className="bi bi-exclamation-diamond text-danger inv-prod-title-icon" style={{ background: 'rgba(220,53,69,0.1)' }} />
                      <span className="inv-prod-title">Incidencias</span>
                    </div>
                  </div>
                  <div className="ventas-page__table-wrap">
                    <table className="table ventas-page__table">
                      <thead>
                        <tr>
                          <th>Tipo</th>
                          <th>Estado</th>
                          <th>Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalle.incidencias.length === 0 ? (
                          <tr>
                            <td colSpan="3" className="text-center py-4 text-muted">
                              No hay incidencias registradas.
                            </td>
                          </tr>
                        ) : (
                          detalle.incidencias.map((incidencia) => (
                            <tr key={incidencia.id_incidencia_caja}>
                              <td>{incidencia.tipo_nombre || incidencia.tipo_codigo}</td>
                              <td>{incidencia.estado_nombre || incidencia.estado_codigo}</td>
                              <td>{formatCajaDateTime(incidencia.fecha_incidencia)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>

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
