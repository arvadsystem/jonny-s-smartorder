import { useState } from 'react';
import './usuarios-card.css';
import { resolveUserImageSrc } from './imageSourcePolicy';

const toDisplayValue = (value, fallback = 'No registrado') => {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
};

const isActivo = (usuario) => {
  if (Object.prototype.hasOwnProperty.call(usuario || {}, 'estado')) return Boolean(usuario.estado);
  if (Object.prototype.hasOwnProperty.call(usuario || {}, 'activo')) return Boolean(usuario.activo);
  if (Object.prototype.hasOwnProperty.call(usuario || {}, 'habilitado')) return Boolean(usuario.habilitado);
  return true;
};

const getNombreCompleto = (usuario) =>
  usuario?.empleado?.nombre_completo
  || usuario?.nombre_completo
  || `${usuario?.nombre || ''} ${usuario?.apellido || ''}`.trim();

const getSucursal = (usuario) => usuario?.empleado?.sucursal_nombre || usuario?.sucursal_nombre;
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
  const initials = `${first}${second}`.toUpperCase();
  return initials || first.toUpperCase() || 'U';
};

export default function UsuarioCard({
  usuario,
  index,
  onOpenEdit,
  onOpenDelete,
  onOpenDetail,
  actionLoading = false,
  deletingId = null,
}) {
  const active = isActivo(usuario);
  const idUsuario = usuario?.id_usuario;
  const deleting = deletingId === idUsuario;
  const nombre = toDisplayValue(getNombreCompleto(usuario), 'Usuario sin nombre');
  const sucursal = toDisplayValue(getSucursal(usuario));
  const username = toDisplayValue(usuario?.nombre_usuario, 'Sin usuario');
  const foto = String(usuario?.foto_perfil || '').trim();
  const initials = getInitials(nombre);
  const rolNombre = toDisplayValue(getRolNombre(usuario), '-');
  const rolIcon = /admin/i.test(rolNombre) ? 'bi-shield-lock' : 'bi-person-badge';
  const resolvedPhotoSrc = resolveUserImageSrc(foto);
  const [failedImageSrc, setFailedImageSrc] = useState('');
  const showPhoto = Boolean(resolvedPhotoSrc) && failedImageSrc !== resolvedPhotoSrc;

  return (
    <article
      className={`inv-prod-catalog-card personas-emp-card usuarios-card inv-anim-in ${active ? 'is-ok' : 'is-inactive'} ${active ? '' : 'is-inactive-state'}`.trim()}
      style={{ animationDelay: `${Math.min(index * 40, 240)}ms` }}
    >
      <div className="inv-prod-card-body personas-emp-card__body usuarios-card__body">
        <div className="usuarios-card__header">
          <span className={`inv-ins-card__badge ${active ? 'is-ok' : 'is-inactive'} usuarios-card__badge`}>
            <span className={`inv-catpro-state-dot ${active ? 'ok' : 'off'}`} />
            <span>{active ? 'Activo' : 'Inactivo'}</span>
          </span>
        </div>

        <div className="usuarios-card__main">
          <div className="usuarios-card__avatar-wrap">
            <div className={`usuarios-card__avatar ${showPhoto ? 'has-image' : ''}`}>
              {showPhoto ? (
                <img
                  src={resolvedPhotoSrc}
                  alt={nombre}
                  loading="eager"
                  referrerPolicy="no-referrer"
                  onError={() => setFailedImageSrc(resolvedPhotoSrc)}
                />
              ) : (
                <span>{initials}</span>
              )}
            </div>
          </div>

          <div className="usuarios-card__content">
            <div className="inv-prod-card-name usuarios-card__title">{nombre}</div>

            <div className="usuarios-card__meta">
              <div className="personas-page__card-row usuarios-card__row">
                <i className="bi bi-at" />
                <span>{`Usuario: ${username}`}</span>
              </div>
              <div className="personas-page__card-row usuarios-card__row">
                <i className={`bi ${rolIcon}`} />
                <span>{`Rol: ${rolNombre}`}</span>
              </div>
              <div className="personas-page__card-row usuarios-card__row">
                <i className="bi bi-shop" />
                <span>{`Sucursal: ${sucursal}`}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="inv-prod-stock-line personas-emp-card__footer usuarios-card__footer">
          <div className="inv-prod-stock-meta personas-emp-card__stock-meta">
            <span className={`inv-catpro-state-dot ${active ? 'ok' : 'off'}`} />
            <div className="inv-prod-stock-copy personas-emp-card__stock-copy">
              <span>{active ? 'Usuario activo' : 'Usuario inactivo'}</span>
              <small className="personas-emp-card__code">{`USR-${String(idUsuario ?? '-')}`}</small>
            </div>
          </div>

          <div className="personas-emp-card__actions usuarios-card__actions">
            <button
              type="button"
              className="inv-catpro-action inv-catpro-action-compact"
              onClick={() => onOpenDetail?.(usuario)}
              disabled={actionLoading || deleting}
              title="Detalle"
            >
              <i className="bi bi-eye" />
              <span className="inv-catpro-action-label">Detalle</span>
            </button>

            <button
              type="button"
              className="inv-catpro-action edit inv-catpro-action-compact"
              onClick={() => onOpenEdit?.(usuario)}
              disabled={actionLoading || deleting}
              title="Editar"
            >
              <i className="bi bi-pencil-square" />
              <span className="inv-catpro-action-label">Editar</span>
            </button>

            <button
              type="button"
              className="inv-catpro-action danger inv-catpro-action-compact usuarios-card__action--danger"
              onClick={() => onOpenDelete?.(usuario)}
              disabled={actionLoading || deleting}
              title="Eliminar"
              aria-label={deleting ? 'Eliminando...' : 'Eliminar'}
            >
              <i className={`bi ${deleting ? 'bi-hourglass-split' : 'bi-trash'}`} />
              <span className="inv-catpro-action-label">{deleting ? 'Eliminando...' : 'Eliminar'}</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
