import { formatDateLabel, getAntiguedadLabel, parseEstado } from '../utils/sucursalHelpers';

export default function SucursalCard({
  sucursal,
  index,
  canTapToEdit,
  canEdit = true,
  canDelete = true,
  canToggleEstado = true,
  isToggling = false,
  onOpenEdit,
  onOpenDelete,
  onToggleEstado
}) {
  const isActive = parseEstado(sucursal?.estado);
  const dotClass = isActive ? 'is-ok' : 'is-empty';
  const imageUrl = String(
    sucursal?.imagen_url_publica ||
    sucursal?.url_publica ||
    sucursal?.url_imagen ||
    ''
  ).trim();

  const handleCardKeyDown = (e) => {
    if (!canTapToEdit || !canEdit) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpenEdit(sucursal);
    }
  };

  return (
    <article
      className={`inv-prod-catalog-card suc-card inv-anim-in ${dotClass} ${isActive ? '' : 'is-inactive-state'}`}
      role={canTapToEdit && canEdit ? 'button' : undefined}
      tabIndex={canTapToEdit && canEdit ? 0 : undefined}
      onClick={canTapToEdit && canEdit ? () => onOpenEdit(sucursal) : undefined}
      onKeyDown={handleCardKeyDown}
      style={{ animationDelay: `${Math.min(index * 40, 240)}ms` }}
    >
      <div className="inv-prod-thumb-wrap suc-card__thumb-wrap">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={sucursal?.nombre_sucursal || 'Sucursal'}
            className="inv-prod-thumb suc-card__thumb-img"
            loading="lazy"
          />
        ) : (
          <div className="inv-prod-thumb placeholder suc-card__thumb-placeholder">
            <i className="bi bi-shop-window" />
            <span>Sin imagen</span>
          </div>
        )}
        <span className={`inv-prod-card-state ${dotClass}`}>
          {isActive ? 'ACTIVA' : 'INACTIVA'}
        </span>
      </div>

      <div className="inv-prod-card-body suc-card__body">
        <div className="inv-prod-card-bg-icon suc-card__bg-icon" aria-hidden="true">
          <i className="bi bi-shop" />
        </div>

        <div className="inv-prod-card-name">
          {sucursal?.nombre_sucursal || 'Sucursal sin nombre'}
        </div>
        <div className="inv-prod-card-category">
          {sucursal?.texto_direccion || 'Sin direccion registrada'}
        </div>

        <div className="inv-prod-card-metrics suc-card__meta">
          <div>
            <div className="inv-prod-card-label">Telefono</div>
            <div className="inv-prod-card-value">{sucursal?.texto_telefono || 'No registrado'}</div>
          </div>
          <div>
            <div className="inv-prod-card-label">Correo</div>
            <div className="inv-prod-card-value suc-card__truncate">{sucursal?.texto_correo || 'No registrado'}</div>
          </div>
        </div>

        <div className="inv-prod-stock-line suc-card__footer-line">
          <div className="inv-prod-stock-meta">
            <div className="inv-prod-stock-ring" style={{ '--stock-ratio': isActive ? 0.85 : 0.25 }} />
            <div className="inv-prod-stock-copy">
              <span>{formatDateLabel(sucursal?.fecha_inauguracion)}</span>
            </div>
          </div>
        </div>

        <div className="suc-card__row">
          <i className="bi bi-clock-history" />
          <span>{getAntiguedadLabel(sucursal)}</span>
        </div>

        <div className="inv-catpro-meta-actions inv-catpro-action-bar inv-cat-card__actions suc-card__actions">
          {canEdit ? (
            <button
              type="button"
              className="btn inv-prod-card-action inv-prod-card-action-compact"
              onClick={(e) => {
                e.stopPropagation();
                onOpenEdit(sucursal);
              }}
              onKeyDown={(e) => e.stopPropagation()}
              title="Editar"
              disabled={isToggling}
              aria-label="Editar sucursal"
            >
              <i className="bi bi-pencil-square" />
              <span className="inv-prod-card-action-label">Editar</span>
            </button>
          ) : null}

          {canToggleEstado ? (
            <button
              type="button"
              className={`btn inv-prod-card-action ${isActive ? 'inactivate' : ''} inv-prod-card-action-compact`}
              onClick={async (e) => {
                e.stopPropagation();
                await onToggleEstado(sucursal, !isActive);
              }}
              onKeyDown={(e) => e.stopPropagation()}
              title={isActive ? 'Inactivar' : 'Activar'}
              disabled={isToggling}
              aria-label={`${isActive ? 'Inactivar' : 'Activar'} sucursal`}
            >
              <i className={`bi ${isActive ? 'bi-slash-circle' : 'bi-check-circle'}`} />
              <span className="inv-prod-card-action-label">{isActive ? 'Inactivar' : 'Activar'}</span>
            </button>
          ) : null}

          {canDelete ? (
            <button
              type="button"
              className="btn inv-prod-card-action danger inv-prod-card-action-compact"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDelete(sucursal);
              }}
              onKeyDown={(e) => e.stopPropagation()}
              title="Eliminar"
              disabled={isToggling}
              aria-label="Eliminar sucursal"
            >
              <i className="bi bi-trash" />
              <span className="inv-prod-card-action-label">Eliminar</span>
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

