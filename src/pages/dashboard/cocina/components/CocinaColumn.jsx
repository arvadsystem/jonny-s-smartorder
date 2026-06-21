import { useEffect, useMemo, useState } from 'react';
import { getColumnMeta } from '../utils/cocinaHelpers';
import CocinaOrderCard from './CocinaOrderCard';

const COLUMN_CSS_CLASS = {
  PENDIENTES: 'is-pending',
  EN_PREPARACION: 'is-prep',
  LISTOS_PARA_ENTREGA: 'is-ready'
};

const TV_PENDING_PAGE_SIZE = 6;
const TV_PREPARING_PAGE_SIZE = 3;
const TV_ROTATION_MS = 10000;

const getTvPageSize = (columnKey) =>
  columnKey === 'PENDIENTES' ? TV_PENDING_PAGE_SIZE : TV_PREPARING_PAGE_SIZE;

const paginateItems = (items, pageSize) => {
  const rows = Array.isArray(items) ? items : [];
  const size = Math.max(1, Number(pageSize) || 1);
  const pages = [];

  for (let index = 0; index < rows.length; index += size) {
    pages.push(rows.slice(index, index + size));
  }

  return pages.length ? pages : [[]];
};

export default function CocinaColumn({
  canAdvancePedido,
  isSuperAdmin = false,
  canOpenDetail,
  isScreenMode = false,
  canDeliverPedido = false,
  columnKey,
  pedidos,
  now,
  mutatingIds,
  onOpenDetail,
  onOpenInventoryAlerts,
  onOpenConfirm
}) {
  const column = getColumnMeta(columnKey);
  const cssClass = COLUMN_CSS_CLASS[columnKey] || 'is-pending';
  const [tvPageIndex, setTvPageIndex] = useState(0);

  const tvPageSize = getTvPageSize(columnKey);
  const tvPages = useMemo(
    () => paginateItems(pedidos, tvPageSize),
    [pedidos, tvPageSize]
  );
  const tvPedidosSignature = useMemo(
    () => (Array.isArray(pedidos) ? pedidos.map((pedido) => pedido?.id_pedido).join('|') : ''),
    [pedidos]
  );
  const totalTvPages = tvPages.length;
  const shouldPaginateForTv = isScreenMode && totalTvPages > 1;
  const visiblePedidos = isScreenMode
    ? tvPages[Math.min(tvPageIndex, totalTvPages - 1)] || []
    : pedidos;

  useEffect(() => {
    if (!isScreenMode) {
      setTvPageIndex(0);
      return;
    }

    setTvPageIndex(0);
  }, [isScreenMode, totalTvPages, tvPedidosSignature]);

  useEffect(() => {
    if (!shouldPaginateForTv) return undefined;

    const interval = window.setInterval(() => {
      setTvPageIndex((currentPage) => (currentPage + 1) % totalTvPages);
    }, TV_ROTATION_MS);

    return () => window.clearInterval(interval);
  }, [shouldPaginateForTv, totalTvPages]);

  return (
    <section className={`kds-column ${cssClass}`}>
      <header className="kds-column__header">
        <div className="kds-column__title">
          <span className="kds-column__dot" aria-hidden="true" />
          <strong>{column.title}</strong>
        </div>
        <div className="kds-column__meta">
          {shouldPaginateForTv ? (
            <span className="kds-column__page-indicator">
              {Math.min(tvPageIndex + 1, totalTvPages)}/{totalTvPages}
            </span>
          ) : null}
          <span className="kds-column__count">{pedidos.length}</span>
        </div>
      </header>

      <div className="kds-column__body">
        {visiblePedidos.map((pedido) => (
          <CocinaOrderCard
            key={pedido.id_pedido}
            pedido={pedido}
            isPendingColumn={columnKey === 'PENDIENTES'}
            now={now}
            canAdvance={canAdvancePedido(pedido)}
            isSuperAdmin={isSuperAdmin}
            canOpenDetail={canOpenDetail}
            isScreenMode={isScreenMode}
            canDeliverPedido={canDeliverPedido}
            disabled={mutatingIds.includes(pedido.id_pedido)}
            onOpenDetail={onOpenDetail}
            onOpenInventoryAlerts={onOpenInventoryAlerts}
            onOpenConfirm={onOpenConfirm}
          />
        ))}

        {pedidos.length === 0 ? (
          <div className="kds-column__empty">
            <i className="bi bi-inbox" aria-hidden="true" />
            <span>Sin pedidos</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
