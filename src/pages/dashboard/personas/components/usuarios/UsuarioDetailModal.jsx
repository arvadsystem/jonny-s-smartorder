import { useEffect, useMemo, useState } from 'react';
import './usuarios-detail-modal.css';
import { resolveUserImageSrc } from './imageSourcePolicy';

const toDisplayValue = (value, fallback = '—') => {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return toDisplayValue(value);
  return date.toLocaleDateString('es-HN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
};

const detectEstado = (record) => {
  if (Object.prototype.hasOwnProperty.call(record || {}, 'estado')) return Boolean(record.estado);
  if (Object.prototype.hasOwnProperty.call(record || {}, 'activo')) return Boolean(record.activo);
  if (Object.prototype.hasOwnProperty.call(record || {}, 'habilitado')) return Boolean(record.habilitado);
  return null;
};

const getNombreCompleto = (usuario) =>
  usuario?.empleado?.nombre_completo
  || usuario?.nombre_completo
  || `${usuario?.nombre || ''} ${usuario?.apellido || ''}`.trim();

const getSucursal = (usuario) => usuario?.empleado?.sucursal_nombre || usuario?.sucursal_nombre;
const getDni = (usuario) => usuario?.empleado?.dni || usuario?.dni;
const getTelefono = (usuario) => usuario?.empleado?.telefono || usuario?.telefono;
const getCorreo = (usuario) => usuario?.empleado?.correo || usuario?.correo;
const getRolNombre = (usuario) => usuario?.rol?.nombre || usuario?.rol_nombre || usuario?.nombre_rol;

const getInitials = (fullName) => {
  const clean = String(fullName ?? '').trim();
  if (!clean) return 'U';

  const parts = clean
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const first = parts[0]?.charAt(0) || '';
  const second = (parts.length > 1 ? parts[parts.length - 1]?.charAt(0) : '') || '';
  return `${first}${second}`.toUpperCase() || first.toUpperCase() || 'U';
};

export default function UsuarioDetailModal({
  open = false,
  usuario = null,
  onClose,
}) {
  useEffect(() => {
    if (!open) return undefined;

    const handleEscape = (event) => {
      if (event.key === 'Escape' && typeof onClose === 'function') onClose();
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  const nombreCompleto = toDisplayValue(getNombreCompleto(usuario), 'Usuario sin nombre');
  const fotoPerfil = String(usuario?.foto_perfil || '').trim();
  const resolvedPhotoSrc = resolveUserImageSrc(fotoPerfil);
  const [failedImageSrc, setFailedImageSrc] = useState('');
  const initials = getInitials(nombreCompleto);
  const estado = detectEstado(usuario);
  const rolNombre = toDisplayValue(getRolNombre(usuario), '—');

  const showPhoto = Boolean(resolvedPhotoSrc) && failedImageSrc !== resolvedPhotoSrc;

  const tiles = useMemo(
    () => [
      {
        key: 'usuario',
        icon: 'bi-at',
        label: 'NOMBRE DE USUARIO',
        value: toDisplayValue(usuario?.nombre_usuario),
      },
      {
        key: 'nombre',
        icon: 'bi-person-vcard',
        label: 'NOMBRE COMPLETO',
        value: nombreCompleto,
      },
      {
        key: 'sucursal',
        icon: 'bi-shop',
        label: 'SUCURSAL',
        value: toDisplayValue(getSucursal(usuario)),
      },
      {
        key: 'dni',
        icon: 'bi-card-text',
        label: 'DNI',
        value: toDisplayValue(getDni(usuario)),
      },
      {
        key: 'telefono',
        icon: 'bi-telephone',
        label: 'TELÉFONO',
        value: toDisplayValue(getTelefono(usuario)),
      },
      {
        key: 'correo',
        icon: 'bi-envelope',
        label: 'CORREO',
        value: toDisplayValue(getCorreo(usuario)),
      },
      {
        key: 'rol',
        icon: /admin/i.test(rolNombre) ? 'bi-shield-lock' : 'bi-person-badge',
        label: 'ROL',
        value: rolNombre,
      },
      {
        key: 'estado',
        icon: 'bi-toggle-on',
        label: 'ESTADO',
        value: estado === null ? '—' : estado ? 'Activo' : 'Inactivo',
      },
      {
        key: 'fecha',
        icon: 'bi-calendar-event',
        label: 'FECHA DE CREACIÓN',
        value: formatDate(usuario?.fecha_creacion),
      },
    ],
    [estado, nombreCompleto, rolNombre, usuario]
  );

  if (!open || !usuario) return null;

  return (
    <div
      className="modal fade show inv-prod-modal-backdrop personas-emp-detail-backdrop"
      style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2550 }}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="modal-dialog modal-dialog-centered modal-dialog-scrollable inv-prod-modal-dialog usuarios-detail-modal__dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-content shadow inv-prod-modal-content usuarios-detail-modal">
          <div className="modal-header usuarios-detail-header">
            <span className="usuarios-detail-header__spacer" aria-hidden="true" />
            <h5 className="usuarios-detail-header__title">Detalle de usuario</h5>
            <button
              type="button"
              className="btn usuarios-detail-header__close"
              onClick={onClose}
              aria-label="Cerrar detalle"
            >
              <i className="bi bi-x-lg" />
            </button>
          </div>

          <div className="modal-body usuarios-detail-modal__body">
            <div className="usuarios-detail-modal__intro">
              <h4 className="usuarios-detail-modal__name">{nombreCompleto}</h4>
              <div className={`usuarios-detail-modal__avatar ${showPhoto ? 'has-image' : ''}`}>
                {showPhoto ? (
                  <img
                    src={resolvedPhotoSrc}
                    alt={nombreCompleto}
                    referrerPolicy="no-referrer"
                    onError={() => setFailedImageSrc(resolvedPhotoSrc)}
                  />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
            </div>

            <hr className="usuarios-detail-modal__divider" />

            <div className="usuarios-detail-grid" aria-label="Datos del usuario">
              {tiles.map((item) => (
                <article key={item.key} className="usuarios-detail-tile">
                  <div className="usuarios-detail-tile__icon" aria-hidden="true">
                    <i className={`bi ${item.icon}`} />
                  </div>
                  <div className="usuarios-detail-tile__copy">
                    <span className="usuarios-detail-tile__label">{item.label}</span>
                    <strong className="usuarios-detail-tile__value">{toDisplayValue(item.value)}</strong>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="modal-footer usuarios-detail-modal__footer">
            <button type="button" className="btn btn-outline-secondary usuarios-detail-modal__close-btn" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
