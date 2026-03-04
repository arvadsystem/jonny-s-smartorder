import { useEffect, useMemo } from 'react';

const toDisplayValue = (value, fallback = '—') => {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
};

const formatDateLabel = (value) => {
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

const getNombre = (usuario) =>
  usuario?.empleado?.nombre_completo
  || usuario?.nombre_completo
  || `${usuario?.nombre || ''} ${usuario?.apellido || ''}`.trim();

const getSucursal = (usuario) => usuario?.empleado?.sucursal_nombre || usuario?.sucursal_nombre;
const getDni = (usuario) => usuario?.empleado?.dni || usuario?.dni;
const getTelefono = (usuario) => usuario?.empleado?.telefono || usuario?.telefono;
const getCorreo = (usuario) => usuario?.empleado?.correo || usuario?.correo;
const getRolNombre = (usuario) => usuario?.rol?.nombre || usuario?.rol_nombre || usuario?.nombre_rol;

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

  const nombre = toDisplayValue(getNombre(usuario), 'Usuario sin nombre');
  const estado = detectEstado(usuario);
  const foto = toDisplayValue(usuario?.foto_perfil, '');

  const details = useMemo(
    () => [
      {
        key: 'usuario',
        icon: 'bi-at',
        label: 'Nombre de usuario',
        value: toDisplayValue(usuario?.nombre_usuario),
      },
      {
        key: 'nombre',
        icon: 'bi-person-vcard',
        label: 'Nombre completo',
        value: nombre,
      },
      {
        key: 'sucursal',
        icon: 'bi-shop',
        label: 'Sucursal',
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
        label: 'Telefono',
        value: toDisplayValue(getTelefono(usuario)),
      },
      {
        key: 'correo',
        icon: 'bi-envelope',
        label: 'Correo',
        value: toDisplayValue(getCorreo(usuario), 'Sin correo'),
      },
      {
        key: 'rol',
        icon: /admin/i.test(toDisplayValue(getRolNombre(usuario), '')) ? 'bi-shield-lock' : 'bi-person-badge',
        label: 'Rol',
        value: toDisplayValue(getRolNombre(usuario), '—'),
      },
      {
        key: 'fecha',
        icon: 'bi-calendar-event',
        label: 'Fecha de creacion',
        value: formatDateLabel(usuario?.fecha_creacion),
      },
      {
        key: 'estado',
        icon: 'bi-toggle-on',
        label: 'Estado',
        value: estado === null ? '—' : estado ? 'Activo' : 'Inactivo',
      },
    ],
    [estado, nombre, usuario]
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
        className="modal-dialog modal-dialog-centered modal-dialog-scrollable inv-prod-modal-dialog inv-ins-detail-modal-dialog personas-emp-detail-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-content shadow inv-prod-modal-content inv-ins-detail-modal inv-ins-detail-modal--editorial personas-emp-detail-modal">
          <div className="modal-header inv-ins-detail-modal__header">
            <div className="inv-ins-detail-modal__title-wrap">
              <div className="inv-ins-detail-modal__icon">
                <i className="bi bi-person-badge" />
              </div>
              <div>
                <div className="fw-semibold">Detalle de usuario</div>
                <div className="small text-muted">{nombre}</div>
              </div>
            </div>

            <div className="inv-ins-detail-modal__header-actions">
              <button
                type="button"
                className="btn btn-sm inv-ins-detail-modal__close"
                onClick={onClose}
                aria-label="Cerrar detalle"
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>
          </div>

          <div className="modal-body inv-prod-modal-body inv-ins-detail-modal__body inv-ins-detail-modal__body--editorial">
            <div className="inv-ins-detail-modal__ambient" aria-hidden="true">
              <span className="is-one" />
              <span className="is-two" />
              <span className="is-three" />
            </div>

            <div className="inv-ins-detail-modal__editorial-grid">
              <section className="inv-ins-detail-modal__lead personas-emp-detail__lead">
                <span className="inv-ins-detail-modal__eyebrow">Usuario</span>
                <strong className="inv-ins-detail-modal__lead-price personas-emp-detail__lead-price">{nombre}</strong>

                <div className={`inv-prod-image-preview personas-emp-detail__image ${foto ? 'has-image' : ''}`}>
                  {foto ? (
                    <img src={foto} alt={nombre} />
                  ) : (
                    <div className="inv-prod-image-placeholder">
                      <i className="bi bi-image" />
                      <span>Sin imagen</span>
                    </div>
                  )}
                </div>
              </section>

              <section className="inv-ins-detail-modal__list" aria-label="Datos del usuario">
                {details.map((item, index) => (
                  <article
                    key={item.key}
                    className="inv-ins-detail-modal__line"
                    style={{ animationDelay: `${index * 70}ms` }}
                  >
                    <div className="inv-ins-detail-modal__line-icon" aria-hidden="true">
                      <i className={`bi ${item.icon}`} />
                    </div>
                    <div className="inv-ins-detail-modal__line-copy">
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  </article>
                ))}
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
