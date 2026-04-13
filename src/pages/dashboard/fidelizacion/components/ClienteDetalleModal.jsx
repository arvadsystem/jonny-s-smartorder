import { useEffect } from 'react';
import { formatFechaHora, formatPoints } from '../utils/fidelizacionHelpers';

const InfoCard = ({ icon, label, value, accent = false }) => (
  <div className={`ventas-detail-modal__info-card${accent ? ' fidelizacion-detail__info-card--accent' : ''}`}>
    <span className="ventas-detail-modal__info-label">
      <i className={`bi ${icon}`} /> {label}
    </span>
    <strong>{value}</strong>
  </div>
);

export default function ClienteDetalleModal({ open, onClose, detalle, fallbackCliente, loading }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const cliente = detalle?.cliente || fallbackCliente || null;
  const resumen = detalle?.resumen || {
    puntos_disponibles: cliente?.puntos_disponibles || 0,
    puntos_acumulados_total: cliente?.puntos_acumulados_total || 0,
    puntos_canjeados_total: cliente?.puntos_canjeados_total || 0
  };
  const movimientos = Array.isArray(detalle?.ultimos_movimientos) ? detalle.ultimos_movimientos : [];
  const canjes = Array.isArray(detalle?.ultimos_canjes) ? detalle.ultimos_canjes : [];

  return (
    <div className="ventas-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="ventas-modal ventas-detail-modal fidelizacion-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fidelizacion-cliente-detalle-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ventas-modal__header">
          <div className="ventas-modal__title-wrap">
            <span className="ventas-modal__icon" aria-hidden="true">
              <i className="bi bi-person-badge" />
            </span>
            <div>
              <h3 id="fidelizacion-cliente-detalle-title">Detalle del cliente</h3>
              <p>{cliente?.nombre || 'Cliente de fidelizacion'}</p>
            </div>
          </div>

          <div className="ventas-modal__header-actions">
            <button type="button" className="ventas-modal__close-btn" onClick={onClose} aria-label="Cerrar">
              <i className="bi bi-x-lg" />
            </button>
          </div>
        </header>

        <div className="ventas-modal__body ventas-detail-modal__body">
          {loading ? (
            <div className="ventas-detail-modal__loading">
              <span className="spinner-border spinner-border-sm" aria-hidden="true" />
              <span>Cargando detalle del cliente...</span>
            </div>
          ) : (
            <>
              <div className="ventas-detail-modal__info-grid">
                <InfoCard icon="bi-person" label="Cliente" value={cliente?.nombre || '-'} />
                <InfoCard icon="bi-card-text" label="Identificador" value={cliente?.identificador || cliente?.nombre_usuario || '-'} />
                <InfoCard icon="bi-star" label="Puntos acumulados" value={formatPoints(resumen.puntos_acumulados_total)} />
                <InfoCard icon="bi-gift" label="Puntos canjeados" value={formatPoints(resumen.puntos_canjeados_total)} />
                <InfoCard icon="bi-wallet2" label="Saldo disponible" value={`${formatPoints(resumen.puntos_disponibles)} pts`} accent />
                <InfoCard icon="bi-clock-history" label="Ultima actividad" value={formatFechaHora(cliente?.fecha_ultima_actividad)} />
              </div>

              <div className="ventas-detail-modal__section">
                <div className="ventas-detail-modal__section-title">Ultimos movimientos</div>
                {movimientos.length ? (
                  <div className="ventas-detail-modal__table-wrap">
                    <table className="table ventas-detail-modal__table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Tipo</th>
                          <th>Origen</th>
                          <th>Sucursal</th>
                          <th>Delta</th>
                          <th>Saldo nuevo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {movimientos.map((movimiento) => (
                          <tr key={movimiento.id_movimiento}>
                            <td>{formatFechaHora(movimiento.fecha_creacion)}</td>
                            <td>
                              <span className={`ventas-page__table-pill ${movimiento.tipo_codigo === 'ACUMULACION' ? 'bg-primary border-primary text-white' : 'border-danger text-danger bg-white'}`}>
                                {movimiento.tipo_nombre || movimiento.tipo_codigo}
                              </span>
                            </td>
                            <td>{movimiento.origen_nombre || movimiento.origen_codigo}</td>
                            <td>{movimiento.nombre_sucursal || 'N/D'}</td>
                            <td className={movimiento.puntos_delta >= 0 ? 'text-primary fw-bold' : 'text-danger fw-bold'}>
                              {movimiento.puntos_delta > 0 ? '+' : ''}
                              {formatPoints(movimiento.puntos_delta)}
                            </td>
                            <td>{formatPoints(movimiento.saldo_nuevo)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="ventas-detail-modal__empty">No se registran movimientos recientes.</div>
                )}
              </div>

              <div className="ventas-detail-modal__section">
                <div className="ventas-detail-modal__section-title">Ultimos canjes</div>
                {canjes.length ? (
                  <div className="ventas-detail-modal__table-wrap">
                    <table className="table ventas-detail-modal__table">
                      <thead>
                        <tr>
                          <th>Canje</th>
                          <th>Fecha</th>
                          <th>Sucursal</th>
                          <th>Estado</th>
                          <th>Puntos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {canjes.map((canje) => (
                          <tr key={canje.id_canje}>
                            <td>CAN-{String(canje.id_canje).padStart(5, '0')}</td>
                            <td>{formatFechaHora(canje.fecha_creacion)}</td>
                            <td>{canje.nombre_sucursal || 'N/D'}</td>
                            <td>{canje.estado_nombre || canje.estado_codigo}</td>
                            <td>{formatPoints(canje.total_puntos)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="ventas-detail-modal__empty">El cliente aun no registra canjes.</div>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
