import { formatCurrency } from '../utils/ventasHelpers';

const getMetodoPagoLabel = (value) => {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized === 'tarjeta') return 'Tarjeta';
  if (normalized.startsWith('trans')) return 'Transferencia';
  return 'Efectivo';
};

export default function VentasTable({ ventas, onOpenDetail }) {
  return (
    <div className="ventas-page__table-card">
      <div className="table-responsive ventas-page__table-wrap">
        <table className="table ventas-page__table">
          <thead>
            <tr>
              <th scope="col">Venta</th>
              <th scope="col">Cliente</th>
              <th scope="col">Sucursal</th>
              <th scope="col">Fecha</th>
              <th scope="col">Items</th>
              <th scope="col">Pago</th>
              <th scope="col">Total</th>
              <th scope="col">Estado</th>
              <th scope="col" className="text-end">
                Accion
              </th>
            </tr>
          </thead>

          <tbody>
            {ventas.map((venta, index) => {
              const isCompleted = venta?.statusKey === 'completed';
              const badgeClass = isCompleted ? 'is-ok' : 'is-low';

              return (
                <tr
                  key={venta?.id_pedido ?? `${venta?.numero_venta}-${index}`}
                  className="ventas-page__table-row"
                  tabIndex={0}
                  onClick={() => onOpenDetail(venta)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onOpenDetail(venta);
                    }
                  }}
                >
                  <td>
                    <div className="ventas-page__table-sale">
                      <strong>{venta?.numero_venta}</strong>
                      <span>{venta?.nombre_usuario}</span>
                    </div>
                  </td>
                  <td>{venta?.cliente_nombre}</td>
                  <td>{venta?.nombre_sucursal}</td>
                  <td>
                    <div className="ventas-page__table-date">
                      <strong>{venta?.fecha_label}</strong>
                      <span>{venta?.hora_label}</span>
                    </div>
                  </td>
                  <td>{venta?.total_items}</td>
                  <td>
                    <span className="ventas-page__table-pill">{getMetodoPagoLabel(venta?.metodo_pago)}</span>
                  </td>
                  <td className="ventas-page__table-total">{formatCurrency(venta?.total)}</td>
                  <td>
                    <span className={`inv-ins-card__badge ${badgeClass}`}>{venta?.statusLabel}</span>
                  </td>
                  <td className="text-end">
                    <button
                      type="button"
                      className="ventas-page__table-detail-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenDetail(venta);
                      }}
                      onKeyDown={(event) => event.stopPropagation()}
                      title="Ver detalle"
                    >
                      <i className="bi bi-eye" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
