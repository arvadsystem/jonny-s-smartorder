import { formatDateLabel, getAntiguedadLabel, parseEstado } from '../utils/sucursalHelpers';

export default function SucursalCard({
  sucursal,
  index,
  canTapToEdit,
  isToggling = false,
  onOpenEdit,
  onOpenDelete,
  onToggleEstado
}) {
  const isActive = parseEstado(sucursal?.estado);
  const dotClass = isActive ? 'ok' : 'off';

  const handleCardKeyDown = (e) => {
    if (!canTapToEdit) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpenEdit(sucursal);
    }
  };

  return (
    <div
      className={`inv-catpro-item inv-cat-card inv-anim-in ${isActive ? '' : 'is-inactive-state'}`}
      role={canTapToEdit ? 'button' : undefined}
      tabIndex={canTapToEdit ? 0 : undefined}
      onClick={canTapToEdit ? () => onOpenEdit(sucursal) : undefined}
      onKeyDown={handleCardKeyDown}
      style={{ animationDelay: `${Math.min(index * 40, 240)}ms` }}
    >
      <div className="inv-cat-card__halo" aria-hidden="true">
        <i className="bi bi-shop" />
      </div>

      <div className="inv-catpro-item-top">
        <div className="inv-cat-card__title-wrap">
          <span className="inv-cat-card__icon" aria-hidden="true">
            <i className="bi bi-shop-window" />
          </span>
          <div>
            <div className="fw-bold">
              {index + 1}. {sucursal?.nombre_sucursal || 'Sucursal sin nombre'}
            </div>
            <div className="text-muted small">{sucursal?.texto_direccion || 'Sin direccion registrada'}</div>
          </div>
        </div>

        <span className={`inv-ins-card__badge ${isActive ? 'is-ok' : 'is-inactive'}`}>
          {isActive ? 'ACTIVO' : 'INACTIVO'}
        </span>
      </div>

      <div className="suc-page__card-details">
        <div className="suc-page__card-row">
          <i className="bi bi-telephone" />
          <span>{sucursal?.texto_telefono || 'Sin telefono'}</span>
        </div>
        <div className="suc-page__card-row">
          <i className="bi bi-envelope" />
          <span>{sucursal?.texto_correo || 'Sin correo'}</span>
        </div>
        <div className="suc-page__card-row">
          <i className="bi bi-calendar-event" />
          <span>{formatDateLabel(sucursal?.fecha_inauguracion)}</span>
        </div>
        <div className="suc-page__card-row">
          <i className="bi bi-clock-history" />
          <span>{getAntiguedadLabel(sucursal)}</span>
        </div>
      </div>

      <div className="inv-catpro-meta inv-catpro-item-footer">
        <div className="inv-catpro-code-wrap">
          <span className={`inv-catpro-state-dot ${dotClass}`} />
          <span className="inv-catpro-code">SUC-{String(sucursal?.id_sucursal ?? '-')}</span>
        </div>

        <div className="inv-catpro-meta-actions inv-catpro-action-bar inv-cat-card__actions">
          <button
            type="button"
            className="inv-catpro-action edit inv-catpro-action-compact"
            onClick={(e) => {
              e.stopPropagation();
              onOpenEdit(sucursal);
            }}
            onKeyDown={(e) => e.stopPropagation()}
            title="Editar"
            disabled={isToggling}
          >
            <i className="bi bi-pencil-square" />
            <span className="inv-catpro-action-label">Editar</span>
          </button>

          <button
            type="button"
            className={`inv-catpro-action ${isActive ? 'state-off' : 'state-on'} inv-catpro-action-compact`}
            onClick={async (e) => {
              e.stopPropagation();
              await onToggleEstado(sucursal, !isActive);
            }}
            onKeyDown={(e) => e.stopPropagation()}
            title={isActive ? 'Inactivar' : 'Activar'}
            disabled={isToggling}
          >
            <i className={`bi ${isActive ? 'bi-slash-circle' : 'bi-check-circle'}`} />
            <span className="inv-catpro-action-label">
              {isToggling ? 'Procesando' : isActive ? 'Inactivar' : 'Activar'}
            </span>
          </button>

          <button
            type="button"
            className="inv-catpro-action danger inv-catpro-action-compact"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDelete(sucursal);
            }}
            onKeyDown={(e) => e.stopPropagation()}
            title="Eliminar"
            disabled={isToggling}
          >
            <i className="bi bi-trash" />
            <span className="inv-catpro-action-label">Eliminar</span>
          </button>
        </div>
      </div>
    </div>
  );
}

