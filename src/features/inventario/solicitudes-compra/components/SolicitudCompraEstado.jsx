import { getEstadoInfo } from '../utils/solicitudesCompraUtils';

export default function SolicitudCompraEstado({ estado, showMessage = false }) {
  const info = getEstadoInfo(estado);
  const key = String(estado || '').toLowerCase();
  return (
    <span className="sol-comp-state-wrap">
      <span className={`sol-comp-state sol-comp-state--${key}`}>{info.label}</span>
      {showMessage && info.message ? <small>{info.message}</small> : null}
    </span>
  );
}
