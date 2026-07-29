const formatCurrency = (value) => `L ${Number(value || 0).toFixed(2)}`;

export default function VentaReversionLines({ items, cantidades, onChange, disabled }) {
  return (
    <div className="table-responsive mt-3">
      <table className="table table-sm align-middle">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Original</th>
            <th>Reversada</th>
            <th>Disponible</th>
            <th>Total disponible</th>
            <th>Cantidad a reversar</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const id = Number(item.id_detalle_factura);
            const available = Number(item.cantidad_disponible || 0);
            return (
              <tr key={id}>
                <td>{item.nombre || 'Item'}</td>
                <td>{item.cantidad_original}</td>
                <td>{item.cantidad_reversada}</td>
                <td>{available}</td>
                <td>{formatCurrency(item.total_disponible)}</td>
                <td>
                  <label className="visually-hidden" htmlFor={`reversion-line-${id}`}>
                    Cantidad a reversar de {item.nombre || 'item'}
                  </label>
                  <input
                    id={`reversion-line-${id}`}
                    className="form-control form-control-sm"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max={available}
                    step="1"
                    value={cantidades[id] ?? ''}
                    disabled={disabled || available <= 0}
                    onChange={(event) => onChange(id, event.target.value, available)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
