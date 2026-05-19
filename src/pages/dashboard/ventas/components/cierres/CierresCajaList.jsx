import {
  formatCajaCurrency,
  formatCajaDateTime,
  resolveDifferenceBadge,
  resolveSessionStatusBadge
} from '../../utils/cajasHelpers';

export default function CierresCajaList({
  sesiones,
  loading,
  error,
  canViewDetail,
  canCloseSession,
  canRegisterArqueo,
  canUseCloseFlow,
  canViewCajaTheoreticalAmounts = true,
  onOpenDetalle,
  onOpenArqueo,
  onOpenCerrar
}) {
  const desktopColSpan = canViewCajaTheoreticalAmounts ? 9 : 7;
  const renderEmpty = (iconClass, message) => (
    <div className="ventas-create-modal__empty shadow-none border-0 bg-transparent">
      <div className="ventas-create-modal__cart-empty-icon">
        <i className={iconClass} />
      </div>
      <span>{message}</span>
    </div>
  );

  return (
    <div className="ventas-page__table-card flex-grow-1 d-flex flex-column min-h-0">
      <div className="ventas-page__table-wrap flex-grow-1 cierres-caja-table-desktop">
        <table className="table ventas-page__table">
          <thead>
            <tr>
              <th>Sesion</th>
              <th>Caja</th>
              <th>Responsable</th>
              <th>Fechas</th>
              <th className="text-end">Apertura</th>
              {canViewCajaTheoreticalAmounts ? <th className="text-end">Teórico</th> : null}
              <th className="text-center">Estado</th>
              {canViewCajaTheoreticalAmounts ? <th className="text-center">Diferencia</th> : null}
              <th className="text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={desktopColSpan} className="text-center py-5">
                  <div className="spinner-border text-danger" role="status" />
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={desktopColSpan} className="text-center py-5">
                  {renderEmpty('bi bi-exclamation-diamond text-danger', error)}
                </td>
              </tr>
            ) : sesiones.length === 0 ? (
              <tr>
                <td colSpan={desktopColSpan} className="text-center py-5">
                  {renderEmpty('bi bi-safe2 text-secondary', 'No hay sesiones de caja para los filtros aplicados.')}
                </td>
              </tr>
            ) : (
              sesiones.map((sesion) => {
                const statusBadge = resolveSessionStatusBadge(sesion);
                const differenceBadge = resolveDifferenceBadge(sesion.diferencia_cierre);
                const isOpen = sesion.estado_codigo === 'ABIERTA';
                const hasFormalClose = !isOpen && Boolean(sesion.fecha_cierre);
                const canOpenDetailForSession =
                  canViewDetail && (canViewCajaTheoreticalAmounts || hasFormalClose);

                return (
                  <tr
                    key={sesion.id_sesion_caja}
                    className="ventas-page__table-row"
                    onClick={() => canOpenDetailForSession && onOpenDetalle(sesion)}
                  >
                    <td>
                      <div className="ventas-page__table-sale">
                        <strong>SES-{String(sesion.id_sesion_caja).padStart(5, '0')}</strong>
                      </div>
                    </td>
                    <td className="align-middle">
                      <div className="ventas-page__table-sale">
                        <strong>{sesion.nombre_caja || 'Caja sin nombre'}</strong>
                      </div>
                    </td>
                    <td className="align-middle">
                      <div className="ventas-page__table-sale">
                        <strong>{sesion.responsable_nombre || 'Sin responsable'}</strong>
                      </div>
                    </td>
                    <td className="align-middle">
                      <div className="ventas-page__table-date">
                        <strong>{formatCajaDateTime(sesion.fecha_apertura)}</strong>
                      </div>
                    </td>
                    <td className="text-end align-middle ventas-page__table-total">
                      L. {formatCajaCurrency(sesion.monto_apertura)}
                    </td>
                    {canViewCajaTheoreticalAmounts ? (
                      <td className="text-end align-middle ventas-page__table-total">
                        L. {formatCajaCurrency(sesion.efectivo_teorico)}
                      </td>
                    ) : null}
                    <td className="text-center align-middle">
                      <span className={`ventas-page__table-pill ${statusBadge.className}`}>
                        {statusBadge.label}
                      </span>
                    </td>
                    {canViewCajaTheoreticalAmounts ? (
                      <td className="text-center align-middle">
                        <div className="d-grid gap-1 justify-items-center">
                          <span className={`ventas-page__table-pill ${differenceBadge.className}`}>
                            {differenceBadge.label}
                          </span>
                          <small className="text-muted fw-semibold">
                            {sesion.diferencia_cierre === null || sesion.diferencia_cierre === undefined
                              ? '-'
                              : `L. ${formatCajaCurrency(sesion.diferencia_cierre)}`}
                          </small>
                        </div>
                      </td>
                    ) : null}
                    <td className="text-end align-middle" onClick={(event) => event.stopPropagation()}>
                      <div className="d-inline-flex gap-2">
                        {canOpenDetailForSession ? (
                          <button
                            type="button"
                            className="ventas-page__table-detail-btn"
                            title="Ver detalle"
                            onClick={() => onOpenDetalle(sesion)}
                          >
                            <i className="bi bi-eye" />
                          </button>
                        ) : null}

                        {canRegisterArqueo ? (
                          <button
                            type="button"
                            className="ventas-page__table-detail-btn bg-white border-warning text-warning"
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
                            className="ventas-page__table-detail-btn bg-white border-danger text-danger"
                            title="Cerrar caja"
                            onClick={() => onOpenCerrar(sesion)}
                            disabled={!isOpen || !canUseCloseFlow}
                          >
                            <i className="bi bi-lock" />
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
          <div className="text-center py-4">{renderEmpty('bi bi-exclamation-diamond text-danger', error)}</div>
        ) : sesiones.length === 0 ? (
          <div className="text-center py-4">
            {renderEmpty('bi bi-safe2 text-secondary', 'No hay sesiones de caja para los filtros aplicados.')}
          </div>
        ) : (
          sesiones.map((sesion) => {
            const statusBadge = resolveSessionStatusBadge(sesion);
            const isOpen = sesion.estado_codigo === 'ABIERTA';
            const hasFormalClose = !isOpen && Boolean(sesion.fecha_cierre);
            const canOpenDetailForSession =
              canViewDetail && (canViewCajaTheoreticalAmounts || hasFormalClose);
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
                    <span>Apertura</span>
                    <strong>L. {formatCajaCurrency(sesion.monto_apertura)}</strong>
                  </div>
                  {canViewCajaTheoreticalAmounts ? (
                    <div>
                      <span>Teórico</span>
                      <strong>L. {formatCajaCurrency(sesion.efectivo_teorico)}</strong>
                    </div>
                  ) : null}
                </div>

                <div className="cierres-caja-mobile-card__meta">
                  <span>{formatCajaDateTime(sesion.fecha_apertura)}</span>
                  {canViewCajaTheoreticalAmounts ? (
                    <span className={`ventas-page__table-pill ${resolveDifferenceBadge(sesion.diferencia_cierre).className}`}>
                      {resolveDifferenceBadge(sesion.diferencia_cierre).label}
                    </span>
                  ) : (
                    <span className="ventas-page__table-pill bg-light border-secondary text-secondary">
                      Comparación no visible
                    </span>
                  )}
                </div>

                <div className="cierres-caja-mobile-card__actions">
                  {canOpenDetailForSession ? (
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onOpenDetalle(sesion)}>
                      Ver detalle
                    </button>
                  ) : null}
                  {canRegisterArqueo ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-warning"
                      onClick={() => onOpenArqueo(sesion)}
                      disabled={!isOpen}
                    >
                      Arqueo
                    </button>
                  ) : null}
                  {canCloseSession ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => onOpenCerrar(sesion)}
                      disabled={!isOpen || !canUseCloseFlow}
                    >
                      Cerrar
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
