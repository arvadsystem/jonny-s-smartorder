import { useEffect, useState } from 'react';
import cajasService from '../../services/cajasService';
import { useAuth } from '../../hooks/useAuth';
import { usePermisos } from '../../context/PermisosContext';
import { PERMISSIONS, normalizeRoles } from '../../utils/permissions';

export default function CajaAperturaEnforcer() {
  const { user } = useAuth();
  const { canAny } = usePermisos();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [asignacion, setAsignacion] = useState(null);
  const [error, setError] = useState('');

  const [montoApertura, setMontoApertura] = useState('');
  const [observacionApertura, setObservacionApertura] = useState('');

  const canOpen = canAny([PERMISSIONS.VENTAS_CAJAS_SESION_ABRIR]);
  const isCajero = normalizeRoles(user?.roles).includes('CAJERO');

  useEffect(() => {
    if (!user || !canOpen || !isCajero) {
      setOpen(false);
      setAsignacion(null);
      setLoading(false);
      return;
    }

    const checkState = async () => {
      try {
        setLoading(true);
        const sessionReq = await cajasService.getSesionActiva();
        if (sessionReq && sessionReq.id_sesion_caja) {
          setLoading(false);
          return;
        }
      } catch (errorResponse) {
        if (Number(errorResponse?.status || 0) !== 404) {
          setLoading(false);
          return;
        }
      }

      try {
        // AM: evita consumir /asignaciones para cajero y usa catalogos permitidos.
        const catalogosReq = await cajasService.getCatalogos({ solo_mias: true });
        const cajas = Array.isArray(catalogosReq?.cajas) ? catalogosReq.cajas : [];

        if (cajas.length > 0) {
          const caja = cajas[0];
          setAsignacion({
            id_caja: caja.id_caja,
            nombre_caja: caja.nombre_caja || caja.codigo_caja || 'Caja'
          });
          setOpen(true);
        } else {
          setAsignacion(null);
          setOpen(false);
        }
      } catch {
        setAsignacion(null);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    };

    checkState();
  }, [user, canOpen, isCajero]);

  const handleOpenSession = async (e) => {
    e.preventDefault();
    if (!asignacion) return;

    const monto = parseFloat(montoApertura);
    if (Number.isNaN(monto) || monto < 0) {
      setError('El monto de apertura debe ser un numero valido mayor o igual a 0.');
      return;
    }

    setActionLoading(true);
    setError('');

    try {
      await cajasService.openSesion({
        id_caja: asignacion.id_caja,
        monto_apertura: monto,
        observacion_apertura: observacionApertura.trim() || 'Apertura de turno'
      });
      setOpen(false);
    } catch (requestError) {
      setError(requestError.message || 'Error al aperturar sesion.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = () => {
    setOpen(false);
  };

  if (loading || !open) return null;

  return (
    <div className="password-expiry-warning-backdrop" role="dialog" aria-modal="true" style={{ zIndex: 1060 }}>
      <div className="password-expiry-warning-panel" style={{ maxWidth: '400px' }}>
        <button
          type="button"
          className="password-expiry-warning-close"
          onClick={handleCancel}
          disabled={actionLoading}
        >
          <i className="bi bi-x-lg" />
        </button>

        <div className="password-expiry-warning-head mb-3">
          <div className="password-expiry-warning-head-icon" aria-hidden="true" style={{ background: '#e0f2fe', color: '#0ea5e9' }}>
            <i className="bi bi-display" />
          </div>
          <div>
            <div className="password-expiry-warning-title" style={{ color: '#0f172a' }}>
              APERTURA DE CAJA
            </div>
            <div className="password-expiry-warning-subtitle" style={{ color: '#64748b' }}>
              No tienes una sesion activa
            </div>
          </div>
        </div>

        <form onSubmit={handleOpenSession}>
          <div className="password-expiry-warning-body mb-4" style={{ fontSize: '14px', color: '#334155' }}>
            <p>Tienes asignada la caja <strong>{asignacion.nombre_caja}</strong>.</p>

            <div className="mb-3">
              <label className="form-label text-start d-block">Monto de Apertura Fisico (L)</label>
              <input
                type="number"
                className="form-control"
                min="0"
                step="0.01"
                required
                value={montoApertura}
                onChange={(event) => setMontoApertura(event.target.value)}
                disabled={actionLoading}
                placeholder="Ej. 500.00"
              />
            </div>

            <div className="mb-3">
              <label className="form-label text-start d-block">Observaciones (Opcional)</label>
              <input
                type="text"
                className="form-control"
                value={observacionApertura}
                onChange={(event) => setObservacionApertura(event.target.value)}
                disabled={actionLoading}
                placeholder="Ej. Billetes de baja denominacion"
              />
            </div>

            {error && <div className="text-danger mt-2 small">{error}</div>}
          </div>

          <div className="d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-light" onClick={handleCancel} disabled={actionLoading}>
              Mas tarde
            </button>
            <button type="submit" className="btn btn-primary" disabled={actionLoading}>
              {actionLoading ? 'Abriendo...' : 'Aceptar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
