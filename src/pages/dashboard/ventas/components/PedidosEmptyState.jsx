export default function PedidosEmptyState({
  title = 'Sin pedidos',
  description = 'No hay pedidos en esta columna.',
  icon = 'bi-journal-richtext'
}) {
  return (
    <div className="ventas-pedidos__empty">
      <div className="ventas-pedidos__empty-icon">
        <i className={`bi ${icon}`} />
      </div>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}
