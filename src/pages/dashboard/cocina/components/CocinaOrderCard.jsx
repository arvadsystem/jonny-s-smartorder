import { useState } from 'react';
import { motion } from 'framer-motion';
const _MOTION = motion;
import {
  formatServiceLabel,
  formatTimerLabel,
  getOrderAction,
  resolveOrderColumnKey
} from '../utils/cocinaHelpers';

// ── Constantes ───────────────────────────────────────────────────────
const MAX_VISIBLE_ITEMS = 4;
const WARN_MINUTES = 30;
const CRITICAL_MINUTES = 60;

// ── Chip de servicio ─────────────────────────────────────────────────
const SERVICE_CLASSES = {
  DELIVERY: 'is-service',
  PARA_LLEVAR: 'is-service',
  LOCAL: 'is-service'
};

// ── Timer helpers ────────────────────────────────────────────────────
function getTimerClass(minutosEnEspera) {
  if (minutosEnEspera === null || minutosEnEspera === undefined) return '';
  if (minutosEnEspera >= CRITICAL_MINUTES) return 'is-critical';
  if (minutosEnEspera >= WARN_MINUTES) return 'is-warning';
  return '';
}

// ── Componente principal ─────────────────────────────────────────────
export default function CocinaOrderCard({
  canAdvance,
  isSuperAdmin = false,
  canOpenDetail,
  canDeliverPedido = false,
  pedido,
  now,
  disabled,
  onOpenDetail,
  onOpenConfirm
}) {
  const [showAllItems, setShowAllItems] = useState(false);
  const action = getOrderAction(pedido);
  const columnKey = resolveOrderColumnKey(pedido);
  const isReadyColumn = columnKey === 'LISTOS_PARA_ENTREGA';

  const fechaRef = pedido.visible_en_cocina_at || pedido.fecha_hora_facturacion || pedido.fecha_hora_pedido;
  const timerLabel = formatTimerLabel(fechaRef, now);
  const minutosEnEspera = pedido.minutos_en_espera ?? null;
  const timerClass = getTimerClass(minutosEnEspera);
  const isExpiring = pedido.esta_proximo_a_expirar === true;

  const allItems = Array.isArray(pedido.items) ? pedido.items : [];
  const visibleItems = showAllItems ? allItems : allItems.slice(0, MAX_VISIBLE_ITEMS);
  const hiddenCount = allItems.length - visibleItems.length;

  // Determinar si mostrar el botón principal de avance
  const showAdvanceBtn = canAdvance || isSuperAdmin;
  // Mostrar botón "No entregado" solo en LISTOS_PARA_ENTREGA con permiso
  const showFailBtn = isReadyColumn && (canDeliverPedido || isSuperAdmin);
  // ¿Tiene alguna acción de botón?
  const hasTwoActions = showAdvanceBtn && showFailBtn;

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

  // Detectar si es un ítem desde menú público (observación contiene [PUBLIC-MENU])
  const isPublicMenu = allItems.some(
    (item) => String(item.observacion || '').includes('[PUBLIC-MENU]')
  );

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.97 }}
      transition={{ duration: 0.16 }}
      className={`kds-card${isExpiring ? ' is-expiring' : ''}${disabled ? ' is-disabled' : ''}`}
      role={canOpenDetail ? 'button' : undefined}
      tabIndex={canOpenDetail ? 0 : -1}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
    >
      {/* Cabecera: ticket + timer */}
      <div className="kds-card__head">
        <span className="kds-card__ticket">{pedido.numero_ticket}</span>
        <div className={`kds-card__timer ${timerClass}`} aria-label="Tiempo de espera">
          <i className="bi bi-clock" />
          <span>{timerLabel}</span>
        </div>
      </div>

      {/* Badges de servicio y estado */}
      <div className="kds-card__badges">
        <span className={`kds-chip ${SERVICE_CLASSES[pedido.tipo_servicio] || 'is-service'}`}>
          {formatServiceLabel(pedido.tipo_servicio)}
        </span>
        {isExpiring && (
          <span className="kds-chip is-expiring">
            <i className="bi bi-exclamation-triangle-fill" /> Alerta
          </span>
        )}
        {isPublicMenu && (
          <span className="kds-chip is-public-menu">
            <i className="bi bi-globe" /> Online
          </span>
        )}
      </div>

      {/* Cliente */}
      <div className="kds-card__client">
        <i className="bi bi-person" aria-hidden="true" />
        <span>{pedido.cliente_nombre || 'Consumidor final'}</span>
      </div>

      {/* Lista de ítems (colapsable) */}
      <div className="kds-card__items">
        {visibleItems.map((item) => {
          const visibleMods = Array.isArray(item.modificaciones)
            ? item.modificaciones.filter(Boolean).slice(0, 3)
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
                      <span key={mod} className="kds-mod">
                        {mod}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Ver más / menos ítems */}
      {allItems.length > MAX_VISIBLE_ITEMS && (
        <button
          type="button"
          className="kds-card__more"
          onClick={(event) => {
            event.stopPropagation();
            setShowAllItems((prev) => !prev);
          }}
        >
          {showAllItems ? (
            <>
              <i className="bi bi-chevron-up" />
              <span>Ver menos</span>
            </>
          ) : (
            <>
              <i className="bi bi-chevron-down" />
              <span>+{hiddenCount} ítems más</span>
            </>
          )}
        </button>
      )}

      {/* Botón(es) de acción */}
      {(showAdvanceBtn || showFailBtn) && (
        <>
          <div className="kds-card__divider" />
          <div className={`kds-card__actions${hasTwoActions ? ' has-two' : ''}`}>
            {showAdvanceBtn && (
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
            )}
            {showFailBtn && (
              <button
                type="button"
                className="kds-action-btn is-fail"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenConfirm(pedido, {
                    label: 'No entregado',
                    nextStatus: 'NO_ENTREGADO',
                    buttonClass: 'is-fail',
                    icon: 'bi bi-x-circle'
                  });
                }}
                disabled={disabled}
                title="Marcar como no entregado"
              >
                <i className="bi bi-x-circle" />
                <span>No entregado</span>
              </button>
            )}
          </div>
        </>
      )}
    </motion.article>
  );
}
