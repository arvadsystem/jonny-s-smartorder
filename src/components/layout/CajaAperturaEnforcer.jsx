import { useEffect, useState } from 'react';
import cajasService from '../../services/cajasService';
import { useAuth } from '../../hooks/useAuth';
import { usePermisos } from '../../context/PermisosContext';
import { PERMISSIONS } from '../../utils/permissions';

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

  useEffect(() => {
    if (!user || !canOpen) {
      setLoading(false);
      return;
    }

    const checkState = async () => {
      try {
        setLoading(true);
        // Verificar si ya tiene sesión activa
        const sessionReq = await cajasService.getSesionActiva();
        if (sessionReq && sessionReq.id_sesion_caja) {
          // Ya tiene sesión, no mostrar modal
          setLoading(false);
          return;
        }
      } catch (e) {
        if (e.status !== 404) {
          console.error(e);
        }
      }

      try {
        // Buscar asignaciones activas para el usuario actual
        // El backend resuelve el usuario real si no es admin, pero le pasamos id_usuario por si acaso.
        const asignacionesReq = await cajasService.listAsignaciones({ id_usuario: user.id_usuario, activo: true });
        const rows = Array.isArray(asignacionesReq) ? asignacionesReq : (asignacionesReq?.rows || []);
        
        // CORRECCION 4: Solo mostramos si realmente tiene una caja asignada directamente a el.
        // Esto evita molestar a super admins que no operan caja directamente.
        if (rows.length > 0) {
          setAsignacion(rows[0]);
          setOpen(true);
        }
      } catch (e) {
        console.error('Error buscando asignaciones:', e);
      } finally {
        setLoading(false);
      }
    };

    checkState();
  }, [user, canOpen]);

  const handleOpenSession = async (e) => {
    e.preventDefault();
    if (!asignacion) return;
    
    const monto = parseFloat(montoApertura);
    if (isNaN(monto) || monto < 0) {
      setError('El monto de apertura debe ser un número válido mayor o igual a 0.');
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
    } catch (err) {
      setError(err.message || 'Error al aperturar sesión.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = () => {
    setOpen(false);
  };

  if (!open) return null;

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
              No tienes una sesión activa
            </div>
          </div>
        </div>

        <form onSubmit={handleOpenSession}>
          <div className="password-expiry-warning-body mb-4" style={{ fontSize: '14px', color: '#334155' }}>
            <p>Tienes asignada la caja <strong>{asignacion.nombre_caja}</strong>.</p>
            
            <div className="mb-3">
              <label className="form-label text-start d-block">Monto de Apertura Físico (L)</label>
              <input 
                type="number" 
                className="form-control" 
                min="0" 
                step="0.01" 
                required 
                value={montoApertura} 
                onChange={e => setMontoApertura(e.target.value)} 
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
                onChange={e => setObservacionApertura(e.target.value)} 
                disabled={actionLoading}
                placeholder="Ej. Billetes de baja denominación"
              />
            </div>

            {error && <div className="text-danger mt-2 small">{error}</div>}
          </div>

          <div className="d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-light" onClick={handleCancel} disabled={actionLoading}>
              Más tarde
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
