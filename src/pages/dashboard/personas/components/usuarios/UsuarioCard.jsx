const toDisplayValue = (value, fallback = 'No registrado') => {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
};

const formatDateLabel = (value) => {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('es-HN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
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
const getDni = (usuario) => usuario?.empleado?.dni || usuario?.dni;
const getTelefono = (usuario) => usuario?.empleado?.telefono || usuario?.telefono;
const getRolNombre = (usuario) => usuario?.rol?.nombre || usuario?.rol_nombre || usuario?.nombre_rol;

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
  const dni = toDisplayValue(getDni(usuario), 'N/D');
  const telefono = toDisplayValue(getTelefono(usuario), 'Sin telefono');
  const username = toDisplayValue(usuario?.nombre_usuario, 'Sin usuario');
  const foto = toDisplayValue(usuario?.foto_perfil, '');
  const rolNombre = toDisplayValue(getRolNombre(usuario), '—');
  const rolIcon = /admin/i.test(rolNombre) ? 'bi-shield-lock' : 'bi-person-badge';

  return (
    <article
      className={`inv-prod-catalog-card personas-emp-card inv-anim-in ${active ? 'is-ok' : 'is-inactive'} ${
        active ? '' : 'is-inactive-state'
      }`.trim()}
      style={{ animationDelay: `${Math.min(index * 40, 240)}ms` }}
    >
      <div className="inv-prod-thumb-wrap personas-emp-card__thumb">
        {foto ? (
          <img src={foto} alt={nombre} className="inv-prod-thumb" loading="lazy" />
        ) : (
          <div className="inv-prod-thumb placeholder">
            <i className="bi bi-image" />
            <span>Sin imagen</span>
          </div>
        )}
        <span className={`inv-prod-card-state ${active ? 'is-ok' : 'is-inactive'}`}>
          {active ? 'Activo' : 'Inactivo'}
        </span>
      </div>

      <div className="inv-prod-card-body personas-emp-card__body">
        <div className="inv-prod-card-bg-icon" aria-hidden="true">
          <i className="bi bi-person-badge" />
        </div>

        <div className="inv-prod-card-name">{`${index + 1}. ${nombre}`}</div>
        <div className="inv-prod-card-category">{`Sucursal: ${sucursal}`}</div>

        <div className="personas-emp-card__meta">
          <div className="personas-page__card-row">
            <i className="bi bi-person-vcard" />
            <span>DNI: {dni}</span>
          </div>
          <div className="personas-page__card-row">
            <i className="bi bi-telephone" />
            <span>{telefono}</span>
          </div>
          <div className="personas-page__card-row">
            <i className="bi bi-at" />
            <span>{username}</span>
          </div>
          <div className="personas-page__card-row">
            <i className={`bi ${rolIcon}`} />
            <span>{`Rol: ${rolNombre}`}</span>
          </div>
          <div className="personas-page__card-row">
            <i className="bi bi-calendar-event" />
            <span>{formatDateLabel(usuario?.fecha_creacion)}</span>
          </div>
        </div>

        <div className="inv-prod-stock-line personas-emp-card__footer">
          <div className="inv-prod-stock-meta personas-emp-card__stock-meta">
            <span className={`inv-catpro-state-dot ${active ? 'ok' : 'off'}`} />
            <div className="inv-prod-stock-copy personas-emp-card__stock-copy">
              <span>{active ? 'Usuario activo' : 'Usuario inactivo'}</span>
              <small className="personas-emp-card__code">{`USR-${String(idUsuario ?? '-')}`}</small>
            </div>
          </div>

          <div className="personas-emp-card__actions">
            <button
              type="button"
              className="btn inv-prod-btn-subtle personas-emp-card__action"
              onClick={() => onOpenDetail?.(usuario)}
              disabled={actionLoading || deleting}
              title="Ver detalle"
            >
              <i className="bi bi-eye" />
              <span>Ver detalle</span>
            </button>

            <button
              type="button"
              className="btn inv-prod-btn-outline personas-emp-card__action"
              onClick={() => onOpenEdit?.(usuario)}
              disabled={actionLoading || deleting}
              title="Editar"
            >
              <i className="bi bi-pencil-square" />
              <span>Editar</span>
            </button>

            <button
              type="button"
              className="btn inv-prod-card-action danger inv-prod-card-action-compact personas-emp-card__action personas-emp-card__action--danger"
              onClick={() => onOpenDelete?.(usuario)}
              disabled={actionLoading || deleting}
              title="Eliminar"
            >
              <i className={`bi ${deleting ? 'bi-hourglass-split' : 'bi-trash'}`} />
              <span className="inv-prod-card-action-label">{deleting ? 'Eliminando...' : 'Eliminar'}</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
