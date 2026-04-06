import PlanillasModalActions from './PlanillasModalActions';
import PlanillasModalLayout from './PlanillasModalLayout';

const toText = (value, fallback = 'Sin dato') => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

const money = (value) => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 'L 0.00';
  return `L ${amount.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const buildDetailSections = (item) => [
  {
    title: 'Datos del empleado',
    fields: [
      { label: 'DNI', value: toText(item.dni, 'Sin DNI') },
      { label: 'Cargo', value: toText(item.cargo, 'Sin cargo') },
      { label: 'Salario base', value: money(item.salario_base) },
      { label: 'Horas extra tiempo', value: toText(item.he_tiempo ?? item.horas_extra_tiempo, '0') }
    ]
  },
  {
    title: 'Totales en planilla',
    fields: [
      { label: 'Bonos', value: money(item.total_bonos ?? item.bonos) },
      { label: 'Deducciones', value: money(item.total_deducciones ?? item.deducciones) },
      { label: 'Adelantos', value: money(item.total_adelantos_aplicados ?? item.adelantos) },
      { label: 'Neto a pagar', value: money(item.neto_pagar ?? item.total_neto_pagar ?? item.neto), tone: 'neto' }
    ]
  }
];

export default function PlanillaDetallePanel({ open, item, onClose }) {
  if (!open || !item) return null;

  const nombre =
    item.nombre_completo ||
    item.empleado_nombre ||
    item.nombre_empleado ||
    `${item.nombre || ''} ${item.apellido || ''}`.trim();

  const sections = buildDetailSections(item);

  return (
    <PlanillasModalLayout
      open={open}
      onClose={onClose}
      title="Detalle de empleado en planilla"
      subtitle={toText(nombre, 'Empleado sin nombre')}
      size="lg"
      className="planillas-modal-shell--detalle"
      actions={<PlanillasModalActions onCancel={onClose} cancelLabel="Cerrar" hidePrimary />}
    >
      <div className="planillas-detail-panel">
        {sections.map((section) => (
          <section key={section.title} className="planillas-detail-panel__section">
            <h6 className="planillas-detail-panel__section-title">{section.title}</h6>
            <div className="planillas-detail-panel__grid">
              {section.fields.map((field) => (
                <article
                  key={`${section.title}-${field.label}`}
                  className={`planillas-detail-panel__card ${field.tone ? `is-${field.tone}` : ''}`}
                >
                  <span className="planillas-detail-panel__label">{field.label}</span>
                  <strong className="planillas-detail-panel__value">{field.value}</strong>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </PlanillasModalLayout>
  );
}
