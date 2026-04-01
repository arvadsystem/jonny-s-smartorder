const toText = (value, fallback = 'Sin dato') => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

const money = (value) => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 'L 0.00';
  return `L ${amount.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function PlanillaDetallePanel({ open, item, onClose }) {
  if (!open || !item) return null;

  const nombre =
    item.nombre_completo ||
    item.empleado_nombre ||
    item.nombre_empleado ||
    `${item.nombre || ''} ${item.apellido || ''}`.trim();

  return (
    <div className="planillas-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="planillas-modal" onClick={(event) => event.stopPropagation()}>
        <div className="planillas-modal__head">
          <div>
            <h5>Detalle de empleado en planilla</h5>
            <p>{toText(nombre, 'Empleado sin nombre')}</p>
          </div>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="planillas-detail-grid">
          <div><span>DNI</span><strong>{toText(item.dni, 'Sin DNI')}</strong></div>
          <div><span>Cargo</span><strong>{toText(item.cargo, 'Sin cargo')}</strong></div>
          <div><span>Salario base</span><strong>{money(item.salario_base)}</strong></div>
          <div><span>Bonos</span><strong>{money(item.total_bonos ?? item.bonos)}</strong></div>
          <div><span>Deducciones</span><strong>{money(item.total_deducciones ?? item.deducciones)}</strong></div>
          <div><span>Adelantos</span><strong>{money(item.total_adelantos_aplicados ?? item.adelantos)}</strong></div>
          <div><span>Horas extra tiempo</span><strong>{toText(item.he_tiempo ?? item.horas_extra_tiempo, '0')}</strong></div>
          <div><span>Neto a pagar</span><strong>{money(item.neto_pagar ?? item.total_neto_pagar ?? item.neto)}</strong></div>
        </div>
      </div>
    </div>
  );
}
