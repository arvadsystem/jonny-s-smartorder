export default function PedidosEmptyState() {
  return (
    <div className="ventas-pedidos__empty">
      <div className="ventas-pedidos__empty-icon">
        <i className="bi bi-journal-richtext" />
      </div>
      <strong>Sin pedidos pendientes desde Menu</strong>
      <p>
        Esta pantalla ya esta lista para recibir los pedidos que ingresen los clientes desde el
        menu. La integracion de persistencia y cobro se activara en la siguiente fase.
      </p>
    </div>
  );
}
