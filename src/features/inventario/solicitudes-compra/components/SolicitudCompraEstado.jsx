import { getEstadoInfo } from '../utils/solicitudesCompraUtils';

export default function SolicitudCompraEstado({ estado, showMessage = false }) {
  const info = getEstadoInfo(estado);
  const key = String(estado || '').toLowerCase();
  const icon = { pendiente: 'bi-clock', aprobada: 'bi-check-circle', rechazada: 'bi-x-circle', recibida: 'bi-box2-heart', cancelada: 'bi-slash-circle' }[key] || 'bi-info-circle';
  return (
    <span className="sol-comp-state-wrap">
      <span className={`sol-comp-state sol-comp-state--${key}`}><i className={`bi ${icon}`} aria-hidden="true" /> {info.label}</span>
      {showMessage && info.message ? <small>{info.message}</small> : null}
    </span>
  );
}
