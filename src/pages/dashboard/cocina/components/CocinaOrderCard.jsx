import { motion } from 'framer-motion';
const _MOTION = motion;
import {
  buildKitchenCountdown,
  formatServiceLabel,
  getOrderAction
} from '../utils/cocinaHelpers';

const SERVICE_CLASSES = {
  DELIVERY: 'is-service',
  PARA_LLEVAR: 'is-service',
  LOCAL: 'is-service'
};

const classifyModification = (value) => {
  const text = String(value || '').trim();
  const key = text.toLowerCase();
  if (!text) return null;
  if (key.includes('salsa')) return { type: 'salsa', label: text };
  if (key.includes('complemento') || key.includes('extra')) return { type: 'complemento', label: text };
  return { type: 'mod', label: text };
};

export default function CocinaOrderCard({
  canAdvance,
  isSuperAdmin = false,
  canOpenDetail,
  isPendingColumn = false,
  pedido,
  now,
  disabled,
  onOpenDetail,
  onOpenConfirm
}) {
  const action = getOrderAction(pedido);

  const countdown = buildKitchenCountdown({
    baseDateValue:
      pedido.kds_timer_base_at || pedido.visible_en_cocina_at || pedido.fecha_hora_facturacion || pedido.fecha_hora_pedido,
    expectedMinutes: pedido.expected_minutes_kds || 20,
    now
  });
  const timerClass = countdown.isDelayed ? 'is-critical' : 'is-normal';
  const isExpiring = countdown.isDelayed || pedido.esta_proximo_a_expirar === true;

  const allItems = Array.isArray(pedido.items) ? pedido.items : [];
  const isDensePendingCard = isPendingColumn && allItems.length > 3;
  const denseSplitIndex = Math.ceil(allItems.length / 2);
  const denseLeftItems = isDensePendingCard ? allItems.slice(0, denseSplitIndex) : allItems;
  const denseRightItems = isDensePendingCard ? allItems.slice(denseSplitIndex) : [];

  const showAdvanceBtn = canAdvance || isSuperAdmin;
  const tipoPedidoLabel = String(pedido?.tipo_servicio || '').trim()
    ? formatServiceLabel(pedido.tipo_servicio)
    : 'Pedido';

  const handleCardClick = () => {
    if (!canOpenDetail) return;
    onOpenDetail(pedido);
  };

  const handleKeyDown = (event) => {
    if (!canOpenDetail) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpenDetail(pedido);
    }
  };

  const isPublicMenu = allItems.some(
    (item) => String(item.observacion || '').includes('[PUBLIC-MENU]')
  );
  const hasStatusBadges = isExpiring || isPublicMenu;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.97 }}
      transition={{ duration: 0.16 }}
      className={`kds-card${isExpiring ? ' is-expiring' : ''}${disabled ? ' is-disabled' : ''}${isDensePendingCard ? ' cocina-order-card--dense' : ''}`}
      role={canOpenDetail ? 'button' : undefined}
      tabIndex={canOpenDetail ? 0 : -1}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
    >
      <div className="kds-card__head">
        <div className="kds-card__head-main">
          <span className="kds-card__ticket">{pedido.numero_ticket}</span>
          <div className="kds-card__head-client">
            <i className="bi bi-person" aria-hidden="true" />
            <span>{pedido.cliente_nombre || 'Consumidor final'}</span>
          </div>
          <span className={`kds-chip kds-card__head-type ${SERVICE_CLASSES[pedido.tipo_servicio] || 'is-service'}`}>
            {tipoPedidoLabel}
          </span>
        </div>
        <div className="kds-card__head-meta">
          <div className={`kds-card__timer ${timerClass}`} aria-label="Tiempo de espera">
            <i className="bi bi-clock" />
            <span>{countdown.remainingLabel}</span>
            {countdown.isDelayed ? (
              <span className="kds-card__timer-delay">{countdown.delayedLabel}</span>
            ) : null}
          </div>
        </div>
      </div>

      {hasStatusBadges ? (
        <div className="kds-card__badges">
          {isExpiring && (
            <span className="kds-chip is-expiring">
              <i className="bi bi-exclamation-triangle-fill" /> {countdown.isDelayed ? 'Retrasado' : 'Alerta'}
            </span>
          )}
          {isPublicMenu && (
            <span className="kds-chip is-public-menu">
              <i className="bi bi-globe" /> Online
            </span>
          )}
        </div>
      ) : null}

      <div className="kds-card__items">
        {(isDensePendingCard ? denseLeftItems : allItems).map((item) => {
          const visibleMods = Array.isArray(item.modificaciones)
            ? item.modificaciones
                .map(classifyModification)
                .filter(Boolean)
                .slice(0, 4)
            : [];
          const isOrphan = item.tipo_item === 'ITEM';

          return (
            <div
              key={item.id_detalle || `${item.tipo_item}-${item.nombre_item}`}
              className="kds-card__item"
            >
              <div className={`kds-qty${isOrphan ? ' is-muted' : ''}`}>{item.cantidad}</div>
              <div>
                <div className="kds-card__item-name">
                  {item.nombre_item}
                </div>
                {visibleMods.length > 0 ? (
                  <div className="kds-card__item-mods">
                    {visibleMods.map((mod) => (
                      <span key={`${item.id_detalle || item.nombre_item}-${mod.type}-${mod.label}`} className={`kds-mod is-${mod.type}`}>
                        {mod.label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      {isDensePendingCard ? (
        <div className="kds-card__items kds-card__items--secondary">
          {denseRightItems.map((item) => {
            const visibleMods = Array.isArray(item.modificaciones)
              ? item.modificaciones
                  .map(classifyModification)
                  .filter(Boolean)
                  .slice(0, 4)
              : [];
            const isOrphan = item.tipo_item === 'ITEM';

            return (
              <div
                key={item.id_detalle || `${item.tipo_item}-${item.nombre_item}`}
                className="kds-card__item"
              >
                <div className={`kds-qty${isOrphan ? ' is-muted' : ''}`}>{item.cantidad}</div>
                <div>
                  <div className="kds-card__item-name">
                    {item.nombre_item}
                  </div>
                  {visibleMods.length > 0 ? (
                    <div className="kds-card__item-mods">
                      {visibleMods.map((mod) => (
                        <span key={`${item.id_detalle || item.nombre_item}-${mod.type}-${mod.label}`} className={`kds-mod is-${mod.type}`}>
                          {mod.label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {Array.isArray(pedido.nota_general_pedido) && pedido.nota_general_pedido.length > 0 ? (
        <div className="kds-card__order-note">
          <span className="kds-card__order-note-label">Nota general del pedido</span>
          <div className="kds-card__order-note-text">
            {pedido.nota_general_pedido.join(' · ')}
          </div>
        </div>
      ) : null}

      {showAdvanceBtn && (
        <>
          <div className="kds-card__divider" />
          <div className="kds-card__actions">
            <button
              type="button"
              className={`kds-action-btn ${action.buttonClass}`}
              onClick={(event) => {
                event.stopPropagation();
                onOpenConfirm(pedido, action);
              }}
              disabled={disabled}
            >
              <i className={action.icon} />
              <span>{action.label}</span>
            </button>
          </div>
        </>
      )}
    </motion.article>
  );
}
