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

const normalizeKey = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const splitModLabel = (rawLabel) => {
  const text = String(rawLabel || '').trim();
  const colonIndex = text.indexOf(':');
  if (colonIndex <= 0) return { title: '', value: text };
  return {
    title: text.slice(0, colonIndex).trim(),
    value: text.slice(colonIndex + 1).trim()
  };
};

const buildItemModGroups = (item) => {
  const groups = [];
  const map = new Map();
  const pushValue = (key, title, type, value) => {
    if (!value) return;
    if (!map.has(key)) {
      map.set(key, { key, title, type, values: [] });
      groups.push(map.get(key));
    }
    const target = map.get(key);
    if (!target.values.includes(value)) target.values.push(value);
  };

  const mods = Array.isArray(item?.modificaciones) ? item.modificaciones : [];
  const noteValues = [];
  mods
    .map(classifyModification)
    .filter(Boolean)
    .slice(0, 8)
    .forEach((mod) => {
      const parts = splitModLabel(mod.label);
      const rawTitle = String(parts.title || '').trim();
      const titleKey = normalizeKey(rawTitle);
      const value = parts.value || mod.label;
      const rawKey = normalizeKey(mod.label);

      const isExplicitSalsaTitle =
        titleKey === 'salsa' ||
        titleKey === 'salsas' ||
        titleKey === 'salsa alitas' ||
        titleKey === 'salsas alitas';
      const isExplicitComplementTitle =
        titleKey === 'complemento' ||
        titleKey === 'complementos';
      const isExplicitNoteTitle =
        titleKey === 'nota' ||
        titleKey === 'notas' ||
        titleKey === 'observacion' ||
        titleKey === 'observaciones' ||
        titleKey === 'comentario' ||
        titleKey === 'comentarios' ||
        titleKey === 'descripcion';

      const isExplicitSalsaLine =
        rawKey.startsWith('salsa alitas:') ||
        rawKey.startsWith('salsas alitas:') ||
        rawKey.startsWith('salsa:') ||
        rawKey.startsWith('salsas:');
      const isExplicitComplementLine =
        rawKey.startsWith('complemento:') ||
        rawKey.startsWith('complementos:');

      if (isExplicitSalsaTitle || isExplicitSalsaLine) {
        const title = rawTitle || 'Salsa alitas';
        const key = titleKey || 'salsas';
        pushValue(key, title, 'salsa', value);
        return;
      }

      if (isExplicitComplementTitle || isExplicitComplementLine) {
        const title = rawTitle || 'Complementos';
        const key = titleKey || 'complementos';
        pushValue(key, title, 'complemento', value);
        return;
      }

      if (isExplicitNoteTitle) {
        if (value) noteValues.push(value);
        return;
      }

      if (rawTitle) {
        noteValues.push(`${rawTitle}: ${value}`);
        return;
      }

      if (mod.label) noteValues.push(mod.label);
    });

  if (item?.observacion) noteValues.push(String(item.observacion).trim());
  const mergedNote = noteValues
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter((value, index, arr) => arr.indexOf(value) === index)
    .join(', ');
  if (mergedNote) pushValue('notas', 'Notas', 'nota', mergedNote);

  return groups;
};

export default function CocinaOrderCard({
  canAdvance,
  isSuperAdmin = false,
  canOpenDetail,
  isScreenMode = false,
  isPendingColumn = false,
  pedido,
  now,
  disabled,
  onOpenDetail,
  onOpenInventoryAlerts,
  onOpenConfirm
}) {
  const action = getOrderAction(pedido);

  const countdown = buildKitchenCountdown({
    // AM: Usa la base ya normalizada para evitar discrepancias entre backend y timer del card.
    baseDateValue: pedido.kds_timer_base_at || null,
    expectedMinutes: pedido.expected_minutes_kds || 20,
    now
  });
  const timerClass = countdown.isDelayed ? 'is-critical' : 'is-normal';
  // AM: La alerta roja debe depender solo del contador real del pedido.
  const isExpiring = countdown.isDelayed;

  const allItems = Array.isArray(pedido.items) ? pedido.items : [];

  const isLargeScreenOrder = isScreenMode && allItems.length > 3;
  const isDensePendingCard = !isScreenMode && isPendingColumn && allItems.length > 3;
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

  const isPublicMenu = String(pedido?.descripcion_pedido || '').toLowerCase().includes('[public-menu]');
  const inventoryAlertsTotal = Number(pedido?.inventario_alertas_total ?? 0) || 0;
  const inventoryAlertsPending = Number(pedido?.inventario_alertas_pendientes ?? 0) || 0;
  const hasInventoryAlerts = inventoryAlertsTotal > 0;
  const hasStatusBadges = isExpiring || isPublicMenu || hasInventoryAlerts;
  const renderItem = (item) => {
    const groupedMods = buildItemModGroups(item).sort((a, b) => {
      const rank = { salsa: 0, complemento: 1, nota: 2, mod: 3 };
      return (rank[a.type] ?? 9) - (rank[b.type] ?? 9);
    });
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
          {groupedMods.length > 0 ? (
            <div className="kds-card__item-mods">
              {groupedMods.map((group) => (
                <p key={`${item.id_detalle || item.nombre_item}-${group.key}`} className={`kds-mod-line is-${group.type}`}>
                  <span className="kds-mod-line__title">{group.title}:</span>{' '}
                  <span className="kds-mod-line__values">
                    {group.values.join(', ')}
                  </span>
                </p>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <article
      className={`kds-card${isExpiring ? ' is-expiring' : ''}${disabled ? ' is-disabled' : ''}${isDensePendingCard ? ' cocina-order-card--dense' : ''}${isLargeScreenOrder ? ' cocina-order-card--tv-large' : ''}`}
      role={canOpenDetail ? 'button' : undefined}
      tabIndex={canOpenDetail ? 0 : -1}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
    >
      <div className="kds-card__content">
        <div className="kds-card__head">
          <div className="kds-card__head-main">
            <span className="kds-card__ticket">{pedido.numero_ticket}</span>
            {!isScreenMode ? (
              <div className="kds-card__head-client">
                <i className="bi bi-person" aria-hidden="true" />
                <span>{pedido.cliente_nombre || 'Consumidor final'}</span>
              </div>
            ) : null}
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
            {hasInventoryAlerts && (
              <button
                type="button"
                className="kds-chip kds-card__inventory-alert"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenInventoryAlerts?.(pedido);
                }}
                aria-label={`Ver ${inventoryAlertsTotal} alertas de inventario del pedido`}
              >
                <i className="bi bi-exclamation-diamond-fill" aria-hidden="true" />
                <span>Inventario con advertencias</span>
                <strong>{inventoryAlertsPending || inventoryAlertsTotal}</strong>
              </button>
            )}
          </div>
        ) : null}

        <div className="kds-card__body-scroll">
          <div className="kds-card__items">
            {denseLeftItems.map(renderItem)}
          </div>
          {isDensePendingCard ? (
            <div className="kds-card__items kds-card__items--secondary">
              {denseRightItems.map(renderItem)}
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
        </div>
      </div>
      {showAdvanceBtn && (
        <div className="kds-card__footer">
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
        </div>
      )}
    </article>
  );
}
